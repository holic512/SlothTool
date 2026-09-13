/**
 * @file PzipPluginTui
 * @project SlothTool
 * @module PZIP Plugin / TUI
 * @description 提供 pzip 的全屏 Ink 压缩工作流和过滤规则编辑界面。
 * @logic 1. 压缩页维护源目录与输出输入并调用 service；2. 过滤页直接编辑持久化规则；3. 根据终端宽度在双栏与纵向面板之间切换。
 * @dependencies Libraries: react/ink, Services: ./service.js, Storage: ./config.js, I18N: ./i18n.js
 * @index_tags pzip TUI, ZIP工作流, 过滤规则, gitignore, 响应式布局
 * @author holic512
 */

import path from 'node:path';
import React, {useEffect, useMemo, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {BUILT_IN_RULE_NAMES} from './config.js';
import {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    removeCustomRule,
    toggleBuiltInRule
} from './service.js';
import {formatPzipError, getLanguage, messages, t} from './i18n.js';

const h = React.createElement;
const TABS = ['compress', 'filters'];
const COLORS = {
    accent: 'cyan',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: 'gray',
    border: 'blue'
};

function formatBytes(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let amount = Number(value);
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
        amount /= 1024;
        unitIndex += 1;
    }
    return `${amount.toLocaleString(undefined, {maximumFractionDigits: 2})} ${units[unitIndex]}`;
}

function truncate(value, maxLength) {
    if (value.length <= maxLength) {
        return value;
    }
    return `…${value.slice(-(maxLength - 1))}`;
}

function Panel({title, children, grow = false, color = COLORS.border}) {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: color,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: grow ? 1 : 0
        },
        h(Text, {bold: true, color: COLORS.accent}, title),
        children
    );
}

function Field({label, value, dim = false, color}) {
    return h(
        Box,
        {},
        h(Text, {color: COLORS.accent}, `${label}: `),
        h(Text, {color, dimColor: dim}, value || '-')
    );
}

function tabText(activeTab) {
    return TABS.map(tab => tab === activeTab ? `[${t(`tui.tabs.${tab}`)}]` : t(`tui.tabs.${tab}`)).join('  ');
}

function deriveDefaultOutput(sourceDirectory) {
    const source = sourceDirectory.trim() || process.cwd();
    const resolved = path.resolve(source);
    return path.join(path.dirname(resolved), `${path.basename(resolved)}.zip`);
}

function ResultPanel({result}) {
    if (!result) {
        return h(Text, {dimColor: true}, t('tui.result.empty'));
    }

    return h(
        Box,
        {flexDirection: 'column'},
        h(Field, {label: t('tui.labels.archive'), value: result.archivePath, color: COLORS.success}),
        h(Field, {label: t('tui.labels.files'), value: `${result.includedFileCount} / ${result.includedDirectoryCount}`}),
        h(Field, {label: t('tui.labels.excluded'), value: String(result.excludedFileCount), color: COLORS.warning}),
        h(Field, {label: t('sourceBytes'), value: formatBytes(result.sourceBytes)}),
        h(Field, {label: t('archiveBytes'), value: formatBytes(result.archiveBytes)}),
        result.warnings.length > 0
            ? h(Text, {color: COLORS.warning}, t('tui.result.warningCount', {count: result.warnings.length}))
            : null
    );
}

function PzipTuiApp() {
    const app = useApp();
    const {columns = 80} = useWindowSize();
    const [activeTab, setActiveTab] = useState('compress');
    const [sourceDirectory, setSourceDirectory] = useState(process.cwd());
    const [outputPath, setOutputPath] = useState('');
    const [config, setConfig] = useState(() => getConfigSummary());
    const [selectedFilterIndex, setSelectedFilterIndex] = useState(0);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');
    const [status, setStatus] = useState({text: t('tui.status.ready'), color: COLORS.success});
    const [result, setResult] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const compact = columns < 76;

    const filterItems = useMemo(() => [
        ...BUILT_IN_RULE_NAMES.map(name => ({kind: 'builtIn', name, enabled: config.builtInRules[name]})),
        ...config.customExcludePatterns.map(name => ({kind: 'custom', name, enabled: true}))
    ], [config]);

    useEffect(() => {
        if (selectedFilterIndex >= filterItems.length) {
            setSelectedFilterIndex(Math.max(0, filterItems.length - 1));
        }
    }, [filterItems.length, selectedFilterIndex]);

    useEffect(() => {
        if (process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION === 'render-exit') {
            app.exit();
        }
    }, [app]);

    function refreshConfig(message = t('tui.status.saved')) {
        setConfig(getConfigSummary());
        setStatus({text: message, color: COLORS.success});
    }

    function beginEdit(type) {
        const initial = type === 'source'
            ? sourceDirectory
            : type === 'output'
                ? outputPath
                : '';
        setEditing(type);
        setDraft(initial);
    }

    function commitEdit() {
        try {
            if (editing === 'source') {
                if (!draft.trim()) {
                    throw new Error('Source directory must not be empty.');
                }
                setSourceDirectory(draft.trim());
            }
            if (editing === 'output') {
                setOutputPath(draft.trim());
            }
            if (editing === 'pattern') {
                addCustomRule(draft);
                refreshConfig();
            }
            setEditing(null);
            setDraft('');
        } catch (error) {
            setStatus({text: t('tui.status.failed', {message: formatPzipError(error)}), color: COLORS.danger});
            setEditing(null);
        }
    }

    async function runArchive() {
        try {
            setStatus({text: t('tui.status.running'), color: COLORS.accent});
            await new Promise(resolve => setTimeout(resolve, 0));
            const nextResult = await createZipArchive(sourceDirectory, {
                outputPath: outputPath || undefined
            });
            setResult(nextResult);
            setStatus({text: t('tui.status.complete', {path: nextResult.archivePath}), color: COLORS.success});
        } catch (error) {
            setStatus({text: t('tui.status.failed', {message: formatPzipError(error)}), color: COLORS.danger});
        }
    }

    function toggleSelectedRule() {
        const item = filterItems[selectedFilterIndex];
        if (!item || item.kind !== 'builtIn') {
            return;
        }
        toggleBuiltInRule(item.name, !item.enabled);
        refreshConfig();
    }

    function removeSelectedPattern() {
        const item = filterItems[selectedFilterIndex];
        if (!item || item.kind !== 'custom') {
            return;
        }
        removeCustomRule(item.name);
        refreshConfig();
    }

    useInput((input, key) => {
        if (editing) {
            if (key.escape) {
                setEditing(null);
                setDraft('');
                return;
            }
            if (key.return) {
                commitEdit();
                return;
            }
            if (key.backspace || key.delete) {
                setDraft(value => value.slice(0, -1));
                return;
            }
            if (input && !key.ctrl && !key.meta) {
                setDraft(value => value + input);
            }
            return;
        }

        if (input === 'q') {
            app.exit();
            return;
        }
        if (showHelp) {
            setShowHelp(false);
            return;
        }
        if (input === '?') {
            setShowHelp(true);
            return;
        }
        if (key.tab) {
            setActiveTab(tab => tab === 'compress' ? 'filters' : 'compress');
            return;
        }
        if (key.escape) {
            setActiveTab('compress');
            return;
        }

        if (activeTab === 'compress') {
            if (input === 's') {
                beginEdit('source');
                return;
            }
            if (input === 'o') {
                beginEdit('output');
                return;
            }
            if (input === 'c') {
                setSourceDirectory(process.cwd());
                setOutputPath('');
                setStatus({text: t('tui.status.ready'), color: COLORS.success});
                return;
            }
            if (key.return) {
                void runArchive();
            }
            return;
        }

        if (key.upArrow) {
            setSelectedFilterIndex(index => Math.max(0, index - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedFilterIndex(index => Math.min(filterItems.length - 1, index + 1));
            return;
        }
        if (input === ' ') {
            toggleSelectedRule();
            return;
        }
        if (input === 'a') {
            beginEdit('pattern');
            return;
        }
        if (input === 'd') {
            removeSelectedPattern();
        }
    });

    const editingPrompt = editing
        ? t(`tui.prompt.${editing}`)
        : '';
    const outputPreview = outputPath || deriveDefaultOutput(sourceDirectory);
    const footer = editing
        ? t('tui.footer.input')
        : showHelp
            ? t('tui.footer.help')
            : t(`tui.footer.${activeTab}`);

    let content;
    if (showHelp) {
        const helpLines = messages[getLanguage()]?.tui.help || messages.zh.tui.help;
        content = h(Panel, {title: t('tui.panels.help'), grow: true},
            ...helpLines.map(line => h(Text, {key: line}, `• ${line}`))
        );
    } else if (editing) {
        content = h(Panel, {title: editingPrompt, grow: true, color: COLORS.accent},
            h(Text, {bold: true, color: COLORS.accent}, `› ${draft}`),
            h(Text, {dimColor: true}, t('tui.footer.input'))
        );
    } else if (activeTab === 'compress') {
        const taskPanel = h(Panel, {title: t('tui.panels.source'), grow: true},
            h(Field, {label: t('tui.labels.source'), value: sourceDirectory, color: COLORS.success}),
            h(Field, {label: t('tui.labels.output'), value: outputPreview, dim: !outputPath, color: outputPath ? COLORS.success : COLORS.muted}),
            h(Text, {dimColor: true}, t('tui.labels.defaultOutput')),
            h(Text, {color: COLORS.warning}, t('tui.labels.gitignore')),
            h(Box, {marginTop: 1, flexDirection: 'column'},
                h(Text, {}, `s  ${t('tui.actions.editSource')}`),
                h(Text, {}, `o  ${t('tui.actions.editOutput')}`),
                h(Text, {}, `c  ${t('tui.actions.useCurrent')}`),
                h(Text, {bold: true, color: COLORS.accent}, `↵  ${t('tui.actions.run')}`)
            )
        );
        const resultPanel = h(Panel, {title: t('tui.panels.result'), grow: true}, h(ResultPanel, {result}));
        content = h(Box, {flexDirection: compact ? 'column' : 'row', gap: 1, flexGrow: 1}, taskPanel, resultPanel);
    } else {
        const rulesPanel = h(Panel, {title: t('tui.panels.rules'), grow: true},
            ...BUILT_IN_RULE_NAMES.map((name, index) => {
                const selected = selectedFilterIndex === index;
                const enabled = config.builtInRules[name];
                return h(
                    Box,
                    {key: name},
                    h(Text, {color: selected ? COLORS.accent : COLORS.muted, bold: selected}, selected ? '› ' : '  '),
                    h(Text, {color: enabled ? COLORS.success : COLORS.muted}, enabled ? '● ' : '○ '),
                    h(Text, {bold: selected}, name)
                );
            }),
            h(Text, {color: COLORS.warning}, t('tui.labels.gitignore')),
            h(Text, {dimColor: true}, t('tui.hints.toggleRule'))
        );
        const customPanel = h(Panel, {title: t('tui.panels.custom'), grow: true},
            config.customExcludePatterns.length === 0
                ? h(Text, {dimColor: true}, '-')
                : config.customExcludePatterns.map((name, index) => {
                    const selected = selectedFilterIndex === BUILT_IN_RULE_NAMES.length + index;
                    return h(
                        Box,
                        {key: name},
                        h(Text, {color: selected ? COLORS.accent : COLORS.muted, bold: selected}, selected ? '› ' : '  '),
                        h(Text, {}, name)
                    );
                }),
            h(Box, {marginTop: 1, flexDirection: 'column'},
                h(Text, {}, `a  ${t('tui.actions.addPattern')}`),
                h(Text, {}, `d  ${t('tui.actions.removePattern')}`)
            )
        );
        content = h(Box, {flexDirection: compact ? 'column' : 'row', gap: 1, flexGrow: 1}, rulesPanel, customPanel);
    }

    return h(
        Box,
        {flexDirection: 'column', height: '100%'},
        h(Box, {},
            h(Text, {bold: true, color: COLORS.accent}, tabText(activeTab)),
            h(Spacer, {}),
            h(Text, {dimColor: true}, `v${pluginPackage.version}  ${truncate(process.cwd(), Math.max(16, Math.floor(columns / 3)))}`)
        ),
        h(Text, {color: COLORS.muted}, '─'.repeat(Math.max(30, columns - 1))),
        h(Box, {flexDirection: 'column', flexGrow: 1, marginY: 1}, content),
        h(Box, {},
            h(Text, {color: status.color}, truncate(status.text, Math.max(20, Math.floor(columns * 0.48)))),
            h(Spacer, {}),
            h(Text, {dimColor: true}, footer)
        )
    );
}

export async function startPzipTui() {
    if (process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(PzipTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });
    await ink.waitUntilExit();
}
