/**
 * @file PzipPluginTui
 * @project SlothTool
 * @module PZIP Plugin / TUI
 * @description 提供 pzip 的全屏 Ink 压缩、扫描预演和过滤规则编辑工作流。
 * @logic 1. 任务启动时立即加锁并固定参数；2. 预演和归档共用服务；3. 规则列表及详情按终端高度分页。
 * @dependencies Libraries: react/ink, Services: ./service.js, Storage: ./config.js, I18N: ./i18n.js
 * @index_tags pzip TUI, ZIP工作流, 扫描预演, 过滤规则, 响应式布局
 * @author holic512
 */

import path from 'node:path';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {wrapText as wrapLine, editText, editorViewport, graphemes, nextTabIndex, statusSymbol} from './shared-interaction.js';
import {BUILT_IN_RULE_NAMES} from './config.js';
import {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    removeCustomRule,
    resolveSourceDirectory,
    toggleBuiltInRule,
    validateArchiveTarget
} from './service.js';
import {formatPzipError, getLanguage, messages, t} from './i18n.js';

const h = React.createElement;
const COLORS = {accent: 'cyan', success: 'green', warning: 'yellow', danger: 'red', muted: 'gray', border: 'blue'};

function formatBytes(value) {
    if (value === null || value === undefined) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let amount = Number(value);
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) {
        amount /= 1024;
        index += 1;
    }
    return `${amount.toLocaleString(undefined, {maximumFractionDigits: 2})} ${units[index]}`;
}

function cloneConfig(config) {
    return {builtInRules: {...config.builtInRules}, customExcludePatterns: [...config.customExcludePatterns]};
}

function requestedOutput(sourceDirectory, outputPath) {
    const source = path.resolve(sourceDirectory.trim() || process.cwd());
    const target = outputPath
        ? path.resolve(outputPath)
        : path.join(path.dirname(source), `${path.basename(source)}.zip`);
    return target.toLowerCase().endsWith('.zip') ? target : `${target}.zip`;
}

export function getRuleWindow(itemCount, selectedIndex, visibleCount) {
    const count = Math.max(1, visibleCount);
    const selected = Math.max(0, Math.min(selectedIndex, Math.max(0, itemCount - 1)));
    const start = Math.max(0, Math.min(selected - Math.floor(count / 2), itemCount - count));
    return {start, end: Math.min(itemCount, start + count)};
}

function Panel({title, height, children, color = COLORS.border}) {
    return h(Box, {
        borderStyle: 'round', borderColor: color, paddingX: 1, flexDirection: 'column',
        width: '100%', height, overflow: 'hidden'
    }, h(Text, {bold: true, color: COLORS.accent, wrap: 'truncate-end'}, title), children);
}

function Line({label, value, color}) {
    return h(Text, {color, wrap: 'truncate-middle'}, `${label}: ${value || '-'}`);
}

function resultLines(result, kind) {
    if (!result) return [];
    return [
        kind === 'preview' ? t('tui.result.candidate') : t('tui.labels.archive'),
        result.archivePath,
        kind === 'preview' ? t('tui.result.notReserved') : '',
        `${t('tui.labels.source')}: ${result.sourceDirectory}`,
        `${t('filesIncluded')}: ${result.includedFileCount}`,
        `${t('directoriesIncluded')}: ${result.includedDirectoryCount}`,
        `${t('filesExcluded')}: ${result.excludedFileCount}`,
        `${t('sourceBytes')}: ${formatBytes(result.sourceBytes)}`,
        ...(kind === 'archive' ? [`${t('archiveBytes')}: ${formatBytes(result.archiveBytes)}`] : []),
        `${t('tui.exclusions.builtIn')}: ${result.exclusions.builtIn}`,
        `${t('tui.exclusions.gitignore')}: ${result.exclusions.gitignore}`,
        `${t('tui.exclusions.custom')}: ${result.exclusions.custom}`,
        `${t('tui.exclusions.symlink')}: ${result.exclusions.symlink}`,
        `${t('tui.exclusions.special')}: ${result.exclusions.special}`,
        `${t('warningsTitle')}: ${result.warnings.length}`
    ].filter(Boolean);
}

export function PzipTuiApp({archive = createZipArchive, initialSourceDirectory = process.cwd()}) {
    const app = useApp();
    const {columns = 80, rows = 24} = useWindowSize();
    const taskLock = useRef(false);
    const [activeTab, setActiveTab] = useState('compress');
    const [sourceDirectory, setSourceDirectory] = useState(initialSourceDirectory);
    const [outputPath, setOutputPath] = useState('');
    const [config, setConfig] = useState(() => getConfigSummary());
    const [selectedFilterIndex, setSelectedFilterIndex] = useState(0);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');
    const [draftCursor, setDraftCursor] = useState(0);
    const [inputError, setInputError] = useState('');
    const [activeTask, setActiveTask] = useState(null);
    const [lastArchive, setLastArchive] = useState(null);
    const [lastPreview, setLastPreview] = useState(null);
    const [lastScan, setLastScan] = useState(null);
    const [lastError, setLastError] = useState(null);
    const [detailView, setDetailView] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);
    const [status, setStatus] = useState({text: t('tui.status.ready'), color: COLORS.success});

    const filterItems = useMemo(() => [
        ...BUILT_IN_RULE_NAMES.map(name => ({kind: 'builtIn', name, enabled: config.builtInRules[name]})),
        ...config.customExcludePatterns.map(name => ({kind: 'custom', name, enabled: true}))
    ], [config]);
    const selectedItem = filterItems[selectedFilterIndex];
    const mainHeight = Math.max(3, rows - 4);
    const innerRows = Math.max(0, mainHeight - 3);
    const compact = columns < 70 || rows < 15;
    const tooSmall = columns < 30 || rows < 8;

    useEffect(() => {
        if (selectedFilterIndex >= filterItems.length) {
            setSelectedFilterIndex(Math.max(0, filterItems.length - 1));
        }
    }, [filterItems.length, selectedFilterIndex]);
    useEffect(() => {
        if (process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION === 'render-exit') app.exit();
    }, [app]);

    function openDetail(view) {
        setDetailView(view);
        setDetailScroll(0);
    }

    function beginEdit(type) {
        setEditing(type);
        const initial = type === 'source' ? sourceDirectory : type === 'output' ? outputPath : '';
        setDraft(initial);
        setDraftCursor(graphemes(initial).length);
        setInputError('');
    }

    function commitEdit() {
        try {
            if (editing === 'source') {
                if (!draft.trim()) throw new Error(t('tui.errors.sourceEmpty'));
                setSourceDirectory(resolveSourceDirectory(draft.trim()));
            } else if (editing === 'output') {
                validateArchiveTarget(sourceDirectory, draft.trim() || undefined);
                setOutputPath(draft.trim());
            } else if (editing === 'pattern') {
                const next = addCustomRule(draft);
                setConfig(next);
                setSelectedFilterIndex(BUILT_IN_RULE_NAMES.length + next.customExcludePatterns.length - 1);
                setStatus({text: t('tui.status.saved'), color: COLORS.success});
            }
            setEditing(null);
            setDraft('');
            setDraftCursor(0);
            setInputError('');
        } catch (error) {
            const message = formatPzipError(error);
            setInputError(message);
            setLastError({message, detail: error?.stack || String(error), kind: 'input'});
        }
    }

    async function runTask(kind) {
        if (taskLock.current) return;
        taskLock.current = true;
        const request = {sourceDirectory, outputPath: outputPath || undefined, config: cloneConfig(config)};
        try {
            const target = validateArchiveTarget(request.sourceDirectory, request.outputPath);
            request.sourceDirectory = target.sourceDirectory;
            request.outputPath = target.requestedArchivePath;
            setActiveTask({kind, sourceDirectory: target.sourceDirectory, outputPath: target.requestedArchivePath});
            setStatus({text: t(kind === 'preview' ? 'tui.status.previewRunning' : 'tui.status.running'), color: COLORS.accent});
            await new Promise(resolve => setTimeout(resolve, 0));
            const result = await archive(request.sourceDirectory, {
                outputPath: request.outputPath, config: request.config, dryRun: kind === 'preview'
            });
            setLastScan(result);
            if (kind === 'preview') {
                setLastPreview(result);
                setStatus({text: t('tui.status.previewComplete'), color: COLORS.success});
                openDetail('preview');
            } else {
                setLastArchive(result);
                setStatus({text: t('tui.status.complete', {path: result.archivePath}), color: COLORS.success});
            }
        } catch (error) {
            const message = formatPzipError(error);
            setLastError({message, detail: error?.stack || String(error)});
            setStatus({text: t('tui.status.failed', {message}), color: COLORS.danger});
            openDetail('error');
        } finally {
            taskLock.current = false;
            setActiveTask(null);
        }
    }

    function toggleSelectedRule() {
        if (selectedItem?.kind !== 'builtIn') return;
        try {
            setConfig(toggleBuiltInRule(selectedItem.name, !selectedItem.enabled));
            setStatus({text: t('tui.status.saved'), color: COLORS.success});
        } catch (error) {
            const message = formatPzipError(error);
            setLastError({message, detail: error?.stack || String(error)});
            openDetail('error');
        }
    }

    function removeSelectedPattern() {
        if (selectedItem?.kind !== 'custom') return;
        try {
            setConfig(removeCustomRule(selectedItem.name));
            setStatus({text: t('tui.status.saved'), color: COLORS.success});
        } catch (error) {
            const message = formatPzipError(error);
            setLastError({message, detail: error?.stack || String(error)});
            openDetail('error');
        }
    }

    const detailText = detailView === 'archive' ? resultLines(lastArchive, 'archive')
        : detailView === 'preview' ? resultLines(lastPreview, 'preview')
            : detailView === 'warnings' ? lastScan?.warnings || []
                : detailView === 'error' ? [lastError?.message, lastError?.detail].filter(Boolean)
                    : detailView === 'pattern' ? [selectedItem?.name || '']
                        : detailView === 'help' ? messages[getLanguage()]?.tui.help || messages.zh.tui.help : [];
    const detailLines = detailText.flatMap(value => String(value).split(/\r?\n/u)
        .flatMap(line => wrapLine(line, Math.max(1, columns - 4))));
    const maxDetailScroll = Math.max(0, detailLines.length - innerRows);
    const visibleDetailScroll = Math.min(detailScroll, maxDetailScroll);

    useInput((input, key) => {
        if (taskLock.current) return;
        if (tooSmall) {
            if (input === 'q') app.exit();
            return;
        }
        if (editing) {
            if (key.escape) {
                setEditing(null);
                setDraft('');
                setDraftCursor(0);
                setInputError('');
            } else if (key.return) {
                commitEdit();
            } else {
                const next = editText({value: draft, cursor: draftCursor}, input, key);
                setDraft(next.value);
                setDraftCursor(next.cursor);
                setInputError('');
            }
            return;
        }
        if (detailView) {
            if (key.escape) setDetailView(null);
            else if (key.upArrow || key.pageUp) {
                setDetailScroll(value => Math.max(0, value - (key.pageUp ? Math.max(1, innerRows - 1) : 1)));
            } else if (key.downArrow || key.pageDown) {
                setDetailScroll(value => Math.min(maxDetailScroll, value + (key.pageDown ? Math.max(1, innerRows - 1) : 1)));
            }
            return;
        }
        if (input === 'q') {
            app.exit();
            return;
        }
        if (input === '?') {
            openDetail('help');
            return;
        }
        if (key.tab) {
            setActiveTab(tab => ['compress', 'filters'][nextTabIndex(['compress', 'filters'].indexOf(tab), 2, key)]);
            return;
        }
        if (key.escape) {
            setActiveTab('compress');
            return;
        }
        if (activeTab === 'compress') {
            if (input === 's') beginEdit('source');
            else if (input === 'o') beginEdit('output');
            else if (input === 'c') {
                setSourceDirectory(process.cwd());
                setOutputPath('');
                setStatus({text: t('tui.status.ready'), color: COLORS.success});
            } else if (input === 'p') void runTask('preview');
            else if (key.return) void runTask('archive');
            else if (input === 'r' && lastArchive) openDetail('archive');
            else if (input === 'v' && lastPreview) openDetail('preview');
            else if (input === 'w' && lastScan?.warnings.length > 0) openDetail('warnings');
            else if (input === 'e' && lastError) openDetail('error');
            return;
        }
        if (key.upArrow || key.pageUp) {
            setSelectedFilterIndex(value => Math.max(0, value - (key.pageUp ? Math.max(1, innerRows - 2) : 1)));
        } else if (key.downArrow || key.pageDown) {
            setSelectedFilterIndex(value => Math.min(filterItems.length - 1, value + (key.pageDown ? Math.max(1, innerRows - 2) : 1)));
        } else if (key.home) setSelectedFilterIndex(0);
        else if (key.end) setSelectedFilterIndex(filterItems.length - 1);
        else if (input === ' ') toggleSelectedRule();
        else if (input === 'a') beginEdit('pattern');
        else if (input === 'd') removeSelectedPattern();
        else if (input === 'v' && selectedItem?.kind === 'custom') openDetail('pattern');
    });

    usePaste(value => {
        if (!editing || taskLock.current) return;
        const next = editText({value: draft, cursor: draftCursor}, value);
        setDraft(next.value);
        setDraftCursor(next.cursor);
        setInputError('');
    });

    const footerKeys = activeTask ? [] : editing ? [t('tui.footer.compactInput')] : detailView ? ['↑↓', 'Pg', 'Esc']
        : activeTab === 'compress'
            ? ['s', 'o', 'c', 'p', `Enter ${t('tui.actions.run')}`, 'Tab', ...(lastArchive ? ['r'] : []), ...(lastPreview ? ['v'] : []),
                ...(lastScan?.warnings.length ? ['w'] : []), ...(lastError ? ['e'] : []), '?', 'q']
            : ['↑↓', 'Pg', 'a', ...(selectedItem?.kind === 'builtIn' ? ['Space'] : []),
                ...(selectedItem?.kind === 'custom' ? ['d', 'v'] : []), 'Tab', '?', 'q'];
    const footer = activeTask
        ? innerRows < 2 ? `${t('tui.labels.output')}: ${activeTask.outputPath}` : t('tui.footer.busy')
        : compact ? footerKeys.join(' ')
        : editing ? t('tui.footer.input') : detailView ? t('tui.footer.detail')
            : `${footerKeys.join(' · ')}  ${t('tui.footer.keyHelp')}`;

    if (tooSmall) return h(Box, {flexDirection: 'column', width: columns, height: rows},
        h(Text, {bold: true, color: COLORS.warning, wrap: 'truncate-end'}, t('tui.resize')),
        rows > 1 ? h(Text, {wrap: 'truncate-end'}, t('tui.resizeHint')) : null,
        rows > 2 ? h(Text, {}, 'q') : null);

    let content;
    if (editing) {
        content = h(Panel, {title: t(`tui.prompt.${editing}`), height: mainHeight, color: inputError ? COLORS.danger : COLORS.accent},
            h(Text, {bold: true}, `› ${editorViewport(draft, draftCursor, Math.max(2, columns - 6))}`),
            inputError ? h(Text, {color: COLORS.danger, wrap: 'truncate-end'}, inputError) : null);
    } else if (detailView) {
        const title = `${t(`tui.panels.${detailView}`)}  ${detailLines.length ? visibleDetailScroll + 1 : 0}/${detailLines.length}`;
        content = h(Panel, {title, height: mainHeight},
            ...detailLines.slice(visibleDetailScroll, visibleDetailScroll + innerRows)
                .map((line, index) => h(Text, {key: visibleDetailScroll + index, wrap: 'truncate-end'}, line)));
    } else if (activeTab === 'compress') {
        const lines = activeTask ? [
            h(Line, {key: 'source', label: t('tui.labels.source'), value: activeTask.sourceDirectory}),
            h(Line, {key: 'output', label: t('tui.labels.output'), value: activeTask.outputPath}),
            h(Line, {key: 'mode', label: t('tui.labels.task'), value: t(`tui.task.${activeTask.kind}`), color: COLORS.accent})
        ] : [
            h(Line, {key: 'source', label: t('tui.labels.source'), value: sourceDirectory}),
            h(Line, {key: 'output', label: t('tui.labels.output'), value: requestedOutput(sourceDirectory, outputPath)}),
            lastArchive ? h(Line, {key: 'archive', label: t('tui.labels.lastArchive'), value: lastArchive.archivePath, color: COLORS.success}) : null,
            lastPreview ? h(Line, {key: 'preview', label: t('tui.labels.lastPreview'), value: t('tui.result.previewSummary', {count: lastPreview.includedFileCount}), color: COLORS.accent}) : null,
            lastScan?.warnings.length ? h(Line, {key: 'warnings', label: t('warningsTitle'), value: String(lastScan.warnings.length), color: COLORS.warning}) : null,
            lastError && lastError.kind !== 'input'
                ? h(Line, {key: 'error', label: t('error'), value: lastError.message, color: COLORS.danger}) : null,
            h(Text, {key: 'hint', dimColor: true, wrap: 'truncate-end'}, t('tui.result.actionHint'))
        ].filter(Boolean);
        content = h(Panel, {title: t('tui.panels.source'), height: mainHeight}, ...lines.slice(0, innerRows));
    } else {
        const showPosition = innerRows >= 2;
        const listRows = Math.max(1, innerRows - (showPosition ? 1 : 0));
        const {start, end} = getRuleWindow(filterItems.length, selectedFilterIndex, listRows);
        content = h(Panel, {title: t('tui.panels.filters'), height: mainHeight},
            showPosition ? h(Text, {dimColor: true, wrap: 'truncate-end'},
                t('tui.labels.rulePosition', {index: selectedFilterIndex + 1, count: filterItems.length})) : null,
            ...filterItems.slice(start, end).map((item, index) => {
                const selected = start + index === selectedFilterIndex;
                const icon = item.kind === 'builtIn' ? item.enabled ? '●' : '○' : '◆';
                return h(Text, {key: `${item.kind}:${item.name}`, color: selected ? COLORS.accent : item.enabled ? COLORS.success : COLORS.muted,
                    bold: selected, wrap: 'truncate-end'}, `${selected ? '›' : ' '} ${icon} ${item.name}`);
            }));
    }

    const tabs = activeTab === 'compress'
        ? `[${t('tui.tabs.compress')}]  ${t('tui.tabs.filters')}`
        : `${t('tui.tabs.compress')}  [${t('tui.tabs.filters')}]`;
    return h(Box, {flexDirection: 'column', height: rows, width: columns, overflow: 'hidden'},
        h(Text, {bold: true, color: COLORS.accent, wrap: 'truncate-end'}, columns >= 55 ? `${tabs}  v${pluginPackage.version}` : tabs),
        h(Text, {color: COLORS.muted, wrap: 'truncate-end'}, '─'.repeat(Math.max(1, columns - 1))),
        content,
        h(Text, {color: status.color, wrap: 'truncate-end'}, `${statusSymbol(activeTask ? 'running' : 'result',
            status.color === COLORS.danger ? 'error' : status.color === COLORS.warning ? 'warn' : 'success')} ${status.text}`),
        h(Text, {dimColor: true, wrap: activeTask && innerRows < 2 ? 'truncate-middle' : 'truncate-end'}, footer));
}

export async function startPzipTui() {
    if (process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION === 'exit') return;
    const ink = render(h(PzipTuiApp, {}), {alternateScreen: true, exitOnCtrlC: true});
    await ink.waitUntilExit();
}
