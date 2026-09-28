/**
 * @file ImageCompressTui
 * @project SlothTool
 * @module Image Compress Plugin / TUI
 * @description 提供面向单图压缩、目录批处理、参数验证和结果复盘的响应式全屏 Ink 工作台。
 * @logic 按内容预算分页操作与参数，输入独占内容区；1. 运行页按操作、输入队列、执行方案和压缩收益组织任务；2. 选项页用动态分页与选中项说明降低配置成本；3. 历史页聚合当前会话任务；4. 根据终端宽高切换双栏、堆叠和精简模式。
 * @dependencies Libraries: react/ink, Services: ./service.js, Model: ./tui-model.js, I18N: ./i18n.js
 * @index_tags 图片压缩TUI, Ink, 拖拽路径, 批量压缩, 结果洞察, 响应式布局, 高对比配色
 * @author holic512
 */

import React, {useEffect, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {editText, editorViewport, graphemes, nextTabIndex, statusSymbol, wrapText} from './shared-interaction.js';
import {getLanguage, t} from './i18n.js';
import {
    dedupePaths,
    parseDroppedPaths,
    runCompressionRequest
} from './service.js';
import {
    buildCompressionInsights,
    formatBytes,
    getPathLabel,
    getVisibleOptionPage,
    getDisplayWidth,
    IMAGE_COMPRESS_TUI_COLORS,
    resolveImageCompressTuiLayout,
    truncateFromLeft,
    truncateFromRight
} from './tui-model.js';

import {TuiFrame, TuiHeader, TuiDetails, TuiRow, TuiPanel} from './shared-layout.js';
import {getShellLayout, getDetailWindow} from './shared-interaction.js';

const h = React.createElement;
const TABS = ['run', 'options', 'history'];
const RUN_MENU_ITEMS = ['compress', 'addCurrentDir', 'editTargets', 'clearTargets', 'openOptions', 'exit'];
const OPTION_ITEMS = ['outputDir', 'quality', 'maxWidth', 'maxHeight', 'recursive', 'overwrite', 'allowLarger', 'dryRun', 'concurrency'];
const SPINNER_INTERVAL_MS = 120;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];
const HEADER_SEPARATOR = ' | ';
const DEFAULT_REQUEST_STATE = Object.freeze({
    sourcePaths: [],
    outputDir: '',
    recursive: true,
    overwrite: false,
    allowLarger: false,
    quality: 82,
    maxWidth: 0,
    maxHeight: 0,
    concurrency: 0,
    dryRun: false
});

function formatNumber(value) {
    return new Intl.NumberFormat(getLanguage() === 'en' ? 'en-US' : 'zh-CN').format(Number(value) || 0);
}

function formatPercent(value) {
    const numericValue = Number(value) || 0;
    return `${Math.max(0, numericValue * 100).toFixed(numericValue > 0 && numericValue < 0.1 ? 1 : 0)}%`;
}

function buildTabText(tabKey, activeTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === activeTab ? `[${label}]` : label;
}

function buildHeaderMetaText(activeTab, columns) {
    const contentWidth = resolveImageCompressTuiLayout(columns, 24).contentWidth;
    const versionText = `「v${pluginPackage.version}」`;
    const tabsText = TABS.map(tabKey => buildTabText(tabKey, activeTab)).join(HEADER_SEPARATOR);
    const availableWidth = Math.max(0, contentWidth - getDisplayWidth(tabsText) - 2);

    if (getDisplayWidth(versionText) > availableWidth) {
        return '';
    }

    const pathWidth = availableWidth - getDisplayWidth(versionText) - getDisplayWidth('  「」');
    if (pathWidth < 8) {
        return versionText;
    }

    const pathText = truncateFromLeft(process.cwd(), pathWidth);
    return pathText ? `${versionText}  「${pathText}」` : versionText;
}

function resolveStatusColor(mode, tone) {
    if (mode === 'progress') {
        return IMAGE_COMPRESS_TUI_COLORS.accent;
    }
    if (tone === 'error') {
        return IMAGE_COMPRESS_TUI_COLORS.danger;
    }
    if (tone === 'warn') {
        return IMAGE_COMPRESS_TUI_COLORS.warning;
    }
    return IMAGE_COMPRESS_TUI_COLORS.success;
}


function Header({activeTab, columns}) {
    return h(TuiHeader, {tabs: TABS.map(id => ({id, label: t(`tui.tabs.${id}`)})), activeTab,
        width: columns - 2, meta: buildHeaderMetaText(activeTab, columns)});
}

function PlanStrip({requestState, compact = false}) {
    const resizeText = requestState.maxWidth > 0 || requestState.maxHeight > 0
        ? t('tui.plan.resize', {
            width: requestState.maxWidth || '∞',
            height: requestState.maxHeight || '∞'
        })
        : t('tui.plan.originalSize');
    const items = [
        [t('tui.plan.quality', {value: requestState.quality}), IMAGE_COMPRESS_TUI_COLORS.secondary],
        [resizeText, IMAGE_COMPRESS_TUI_COLORS.accent],
        [requestState.recursive ? t('tui.plan.recursive') : t('tui.plan.flat'), IMAGE_COMPRESS_TUI_COLORS.success],
        [requestState.dryRun ? t('tui.plan.dryRun') : t('tui.plan.write'), requestState.dryRun
            ? IMAGE_COMPRESS_TUI_COLORS.warning
            : IMAGE_COMPRESS_TUI_COLORS.success]
    ];

    if (!compact) {
        items.push([
            requestState.overwrite ? t('tui.plan.overwrite') : t('tui.plan.protectExisting'),
            requestState.overwrite ? IMAGE_COMPRESS_TUI_COLORS.warning : IMAGE_COMPRESS_TUI_COLORS.success
        ]);
    }

    return h(Text, {wrap: 'truncate-end'}, ...items.flatMap(([label, color], index) => [
        index ? h(Text, {key: `${label}-sep`, dimColor: true}, ' | ') : null,
        h(Text, {key: label, color}, label)
    ]));
}

function ResultMetrics({insights, compact = false}) {
    const countItems = [
        [t('tui.result.total'), insights.totalFiles, IMAGE_COMPRESS_TUI_COLORS.accent],
        [t('tui.result.success'), insights.successCount, IMAGE_COMPRESS_TUI_COLORS.success],
        [t('tui.result.skipped'), insights.skippedCount, IMAGE_COMPRESS_TUI_COLORS.warning],
        [t('tui.result.failed'), insights.failedCount, IMAGE_COMPRESS_TUI_COLORS.danger]
    ];
    return h(Box, {flexDirection: 'column', flexShrink: 0},
        h(Text, {wrap: 'truncate-end'}, ...countItems.flatMap(([label, value, color], index) => [
            index ? h(Text, {key: label + '-sep', dimColor: true}, ' | ') : null,
            h(Text, {key: label, color}, `${label} ${formatNumber(value)}`)
        ])),
        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.secondary, wrap: 'truncate-end'},
            `${t(insights.preview ? 'tui.result.wouldSave' : 'tui.result.saved')} ${formatBytes(insights.savedBytes)} | ${t('tui.result.savingRate')} ${formatPercent(insights.savingRate)}`));
}

function ActionPanel({selectedIndex, requestState, layout, lastSummary, condensed = false}) {
    const insights = buildCompressionInsights(lastSummary);
    const reserve = condensed ? (insights ? 3 : 1) : 0;
    const capacity = Math.max(1, layout.contentHeight - 3 - reserve);
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(capacity / 2), RUN_MENU_ITEMS.length - capacity));
    return h(TuiPanel, {title: t('tui.panels.actions'), summary: `${selectedIndex + 1}/${RUN_MENU_ITEMS.length}`,
        width: layout.contentWidth, height: layout.contentHeight},
        ...RUN_MENU_ITEMS.slice(start, start + capacity).map((item, index) => h(TuiRow, {
            key: item, width: layout.contentWidth - 4,
            left: `${start + index === selectedIndex ? '› ' : '  '}${t('tui.menu.' + item)}`,
            right: layout.contentWidth < 40 ? '' : t('tui.menuBadges.' + item),
            bold: start + index === selectedIndex, color: start + index === selectedIndex ? IMAGE_COMPRESS_TUI_COLORS.accent : 'white',
            rightColor: item === 'exit' ? IMAGE_COMPRESS_TUI_COLORS.danger : IMAGE_COMPRESS_TUI_COLORS.secondary
        })),
        condensed ? h(Text, {dimColor: true, wrap: 'truncate-end'}, `${t('tui.panels.targets')}: ${requestState.sourcePaths.length}`) : null,
        condensed && insights ? h(ResultMetrics, {insights, compact: true}) : null);
}

function TargetPanel({requestState, inputMode, inputValue, inputCursor, inputError, layout}) {
    const paths = requestState.sourcePaths;
    const capacity = Math.max(1, layout.contentHeight - 4);
    return h(TuiPanel, {title: t('tui.panels.targets'), badge: t(inputMode ? 'tui.targets.inputBadge' : 'tui.targets.readyBadge', {count: paths.length}),
        width: layout.contentWidth, height: layout.contentHeight, border: inputMode ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.border},
        inputMode ? h(React.Fragment, {},
            h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent, wrap: 'truncate-end'}, `› ${editorViewport(inputValue, inputCursor, layout.contentWidth - 6)}`),
            inputError ? h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.danger, wrap: 'truncate-end'}, inputError) : null,
            h(Text, {dimColor: true, wrap: 'truncate-end'}, t('tui.inputHint')))
            : paths.length ? paths.slice(0, capacity).map((value, index) => h(Text, {key: value, wrap: 'truncate-end'},
                `${index + 1}. ${truncateFromLeft(value, layout.contentWidth - 7)}`))
                : h(Text, {dimColor: true, wrap: 'truncate-end'}, t('tui.targets.emptyTitle')),
        h(PlanStrip, {requestState, compact: layout.compact || layout.short}));
}

function ResultPanel({summary, layout}) {
    const insights = buildCompressionInsights(summary);
    const issues = insights?.issues || [];
    const details = issues.length ? issues : insights?.topSavings || [];
    return h(TuiPanel, {title: t('tui.panels.result'),
        badge: t(insights ? insights.preview ? 'tui.result.previewBadge' : 'tui.result.completeBadge' : 'tui.result.waitingBadge'),
        width: layout.contentWidth, height: layout.contentHeight},
        insights ? h(React.Fragment, {},
            h(ResultMetrics, {insights, compact: true}),
            h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.secondary, wrap: 'truncate-end'}, t(issues.length ? 'tui.result.issues' : 'tui.result.topSavings')),
            ...details.slice(0, Math.max(0, layout.contentHeight - 6)).map((item, index) => h(Text, {key: index,
                color: issues.length ? IMAGE_COMPRESS_TUI_COLORS.danger : IMAGE_COMPRESS_TUI_COLORS.success, wrap: 'truncate-end'},
                issues.length ? `${getPathLabel(item.inputPath)}: ${item.error || item.status}`
                    : t('tui.result.savedLine', {name: getPathLabel(item.inputPath), saved: formatBytes(item.bytesSaved)}))))
            : h(Text, {dimColor: true, wrap: 'truncate-end'}, t('tui.result.emptyTitle')));
}

function OptionListPanel({requestState, selectedIndex, outputInputMode, outputInputValue, layout}) {
    const optionLines = OPTION_ITEMS.map(optionKey => describeOptionValue(
        optionKey,
        requestState,
        outputInputMode,
        outputInputValue
    ));
    const page = getVisibleOptionPage(optionLines, selectedIndex, layout.optionPageSize);

    return h(TuiPanel, {title: t('tui.panels.optionList'), summary: `${page.pageIndex + 1}/${page.pageCount}`,
        width: layout.contentWidth, height: layout.contentHeight},
        ...page.items.map((line, index) => h(TuiRow, {key: line.key, width: layout.contentWidth - 4,
            left: `${index === page.localSelectedIndex ? '› ' : '  '}${line.label}`, right: line.value,
            bold: index === page.localSelectedIndex, color: index === page.localSelectedIndex ? IMAGE_COMPRESS_TUI_COLORS.accent : 'white',
            rightColor: isBooleanOption(line.key) && requestState[line.key] ? IMAGE_COMPRESS_TUI_COLORS.success : IMAGE_COMPRESS_TUI_COLORS.secondary})));
}

function OptionDetailPanel({requestState, selectedOption, outputInputMode, outputInputValue, outputCursor, layout}) {
    const optionLine = describeOptionValue(selectedOption, requestState, outputInputMode, outputInputValue);
    const helpText = selectedOption === 'outputDir'
        ? t('tui.optionHelp.outputDir')
        : isBooleanOption(selectedOption)
            ? t('tui.optionHelp.boolean')
            : t('tui.optionHelp.number');
    const badgeColor = isBooleanOption(selectedOption) && requestState[selectedOption]
        ? IMAGE_COMPRESS_TUI_COLORS.success
        : IMAGE_COMPRESS_TUI_COLORS.secondary;

    return h(TuiPanel, {title: optionLine.label, badge: outputInputMode ? undefined : optionLine.value, badgeColor,
        width: layout.contentWidth, height: layout.contentHeight},
        outputInputMode ? h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent, wrap: 'truncate-end'},
            `› ${editorViewport(outputInputValue, outputCursor, layout.contentWidth - 6)}`) : null,
        h(Text, {dimColor: true, wrap: 'truncate-end'}, t(`tui.optionDetails.${selectedOption}`)),
        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.secondary, wrap: 'truncate-end'}, helpText),
        layout.compact ? null : h(PlanStrip, {requestState}));
}

function HistoryPanel({historyItems, layout}) {
    const limit = Math.max(1, Math.floor((layout.contentHeight - 4) / 2));
    return h(TuiPanel, {title: t('tui.panels.history'), summary: t('tui.history.count', {count: historyItems.length}),
        width: layout.contentWidth, height: layout.contentHeight},
        h(Text, {dimColor: true, wrap: 'truncate-end'}, t('tui.history.sessionOnly')),
        ...historyItems.slice(0, limit).flatMap(entry => {
            const insights = buildCompressionInsights(entry.summary);
            return [h(Text, {key: `${entry.id}-summary`, bold: true, wrap: 'truncate-end'},
                `${entry.label} · ${t('tui.result.total')} ${insights.totalFiles}`),
            h(Text, {key: `${entry.id}-saved`, color: IMAGE_COMPRESS_TUI_COLORS.secondary, wrap: 'truncate-end'},
                `${t(insights.preview ? 'tui.result.wouldSave' : 'tui.result.saved')} ${formatBytes(insights.savedBytes)}`)];
        }),
        historyItems.length ? null : h(Text, {dimColor: true}, t('tui.history.empty')));
}

function ResponsivePair({left, right, layout, showRight = true}) {
    const leftHeight = layout.compact && showRight ? layout.optionPageSize + 3 : layout.contentHeight;
    const leftWidth = layout.compact || !showRight ? layout.contentWidth : layout.sidebarWidth;
    const rightWidth = layout.compact ? layout.contentWidth : layout.contentWidth - leftWidth - 1;
    return h(Box, {height: layout.contentHeight, flexDirection: layout.compact ? 'column' : 'row', gap: showRight ? 1 : 0},
        React.cloneElement(left, {layout: {...layout, contentWidth: leftWidth, contentHeight: leftHeight}}),
        showRight ? React.cloneElement(right, {layout: {...layout, contentWidth: rightWidth,
            contentHeight: layout.compact ? layout.contentHeight - leftHeight - 1 : layout.contentHeight}}) : null);
}

function RunContent({requestState, runMenuIndex, sourceInputMode, sourceInputValue, sourceCursor, sourceInputError, lastSummary, layout}) {
    const target = nextLayout => h(TargetPanel, {requestState, inputMode: sourceInputMode, inputValue: sourceInputValue,
        inputCursor: sourceCursor, inputError: sourceInputError, layout: nextLayout});
    if (sourceInputMode) return target(layout);
    if (layout.compact) {
        if (layout.contentHeight < 16) return h(ActionPanel, {selectedIndex: runMenuIndex, requestState, layout, lastSummary, condensed: true});
        const targetHeight = 5;
        const actionHeight = layout.contentHeight - targetHeight - 1;
        return h(Box, {height: layout.contentHeight, flexDirection: 'column', gap: 1},
            h(ActionPanel, {selectedIndex: runMenuIndex, requestState, lastSummary, condensed: true,
                layout: {...layout, contentHeight: actionHeight}}),
            target({...layout, contentHeight: targetHeight}));
    }
    const rightWidth = layout.contentWidth - layout.sidebarWidth - 1;
    const targetHeight = Math.max(5, Math.floor((layout.contentHeight - 1) * 0.43));
    return h(Box, {height: layout.contentHeight, gap: 1},
        h(ActionPanel, {selectedIndex: runMenuIndex, requestState, layout: {...layout, contentWidth: layout.sidebarWidth}, lastSummary}),
        h(Box, {height: layout.contentHeight, flexDirection: 'column', gap: 1},
            target({...layout, contentWidth: rightWidth, contentHeight: targetHeight}),
            h(ResultPanel, {summary: lastSummary, layout: {...layout, contentWidth: rightWidth, contentHeight: layout.contentHeight - targetHeight - 1}})));
}

function getFooterText(activeTab, inputMode, layout, action, selectedOption) {
    const params = {action, enter: activeTab === 'options' && selectedOption === 'outputDir'
        ? ` | Enter ${t('tui.options.outputDir')}` : '',
    adjust: activeTab === 'options' && (isBooleanOption(selectedOption) || isNumericOption(selectedOption))
        ? ' | ←→' : '',
    space: activeTab === 'options' && isBooleanOption(selectedOption) ? ' | Space' : ''};
    if (inputMode) {
        return t(`tui.footer.${layout.microFooter ? 'microInput' : 'input'}`);
    }
    if (layout.microFooter) {
        return t(`tui.footer.micro${activeTab[0].toUpperCase()}${activeTab.slice(1)}`, params);
    }
    if (layout.compactFooter) {
        return t(`tui.footer.compact${activeTab[0].toUpperCase()}${activeTab.slice(1)}`, params);
    }
    return t(`tui.footer.${activeTab}`, params);
}

export function ImageCompressTuiApp({
    layoutOverride = null,
    initialTab = 'run',
    initialOptionIndex = 0,
    initialSummary = null,
    initialPaths = [],
    initialHistory = []
} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const baseLayout = layoutOverride || resolveImageCompressTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'run');
    const [runMenuIndex, setRunMenuIndex] = useState(0);
    const [optionIndex, setOptionIndex] = useState(Math.min(
        OPTION_ITEMS.length - 1,
        Math.max(0, Number.parseInt(initialOptionIndex, 10) || 0)
    ));
    const [helpOpen, setHelpOpen] = useState(false);
    const [detailLines, setDetailLines] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: t('tui.status.ready'),
        label: ''
    });
    const [sourceInputMode, setSourceInputMode] = useState(false);
    const [sourceInputValue, setSourceInputValue] = useState('');
    const [sourceCursor, setSourceCursor] = useState(0);
    const [sourceInputError, setSourceInputError] = useState('');
    const [outputInputMode, setOutputInputMode] = useState(false);
    const [outputInputValue, setOutputInputValue] = useState('');
    const [outputCursor, setOutputCursor] = useState(0);
    const [requestState, setRequestState] = useState({
        ...DEFAULT_REQUEST_STATE,
        sourcePaths: dedupePaths(initialPaths)
    });
    const [lastSummary, setLastSummary] = useState(initialSummary);
    const [historyItems, setHistoryItems] = useState(initialHistory);

    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.message;
    const footerText = statusState.mode === 'progress' ? t('tui.footer.busy')
        : detailLines ? t('tui.footer.detail') : helpOpen ? t('tui.footer.help')
            : getFooterText(activeTab, sourceInputMode || outputInputMode, baseLayout,
                t('tui.menu.' + RUN_MENU_ITEMS[runMenuIndex]), OPTION_ITEMS[optionIndex]);

    const shell = getShellLayout(baseLayout.columns, baseLayout.rows, {
        status: `${statusSymbol(statusState.mode, statusState.tone)} ${statusText}`, keys: footerText
    });
    const layout = {...baseLayout, contentWidth: shell.contentWidth, contentHeight: shell.contentHeight};
    const detailWindow = getDetailWindow(detailLines || (helpOpen ? t('tui.help.lines') : []), detailScroll, shell.contentWidth, shell.contentHeight);
    layout.optionPageSize = Math.min(layout.optionPageSize, Math.max(1, shell.contentHeight - (layout.compact && layout.showOptionDetail ? 8 : 3)));

    useEffect(() => {
        if (statusState.mode !== 'progress') {
            return undefined;
        }

        const interval = setInterval(() => {
            setSpinnerFrameIndex(currentIndex => (currentIndex + 1) % SPINNER_FRAMES.length);
        }, SPINNER_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [statusState.mode]);

    useEffect(() => {
        if (process.env.SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION === 'render-exit') {
            app.exit();
        }
    }, [app]);

    function showResultStatus(tone, message) {
        setStatusState({mode: 'result', tone, message, label: ''});
    }

    function captureExternalPathText(text) {
        if (statusState.mode === 'progress') {
            return;
        }

        if (outputInputMode || sourceInputMode) {
            const current = outputInputMode ? outputInputValue : sourceInputValue;
            const cursor = outputInputMode ? outputCursor : sourceCursor;
            const next = editText({value: current, cursor}, text);
            if (outputInputMode) {
                setOutputInputValue(next.value);
                setOutputCursor(next.cursor);
            } else {
                setSourceInputValue(next.value);
                setSourceCursor(next.cursor);
                setSourceInputError('');
            }
            return;
        }

        const parsedPaths = parseDroppedPaths(text);
        if (parsedPaths.length === 0) {
            showResultStatus('warn', t('tui.status.invalidPaths'));
            return;
        }

        setRequestState(currentState => ({
            ...currentState,
            sourcePaths: dedupePaths([...currentState.sourcePaths, ...parsedPaths])
        }));
        setSourceInputMode(false);
        setSourceInputValue('');
        showResultStatus('success', t('tui.status.captured', {count: parsedPaths.length}));
    }

    usePaste(text => {
        captureExternalPathText(text);
    });

    async function runTask(label, task) {
        if (statusState.mode === 'progress') {
            return null;
        }

        setSpinnerFrameIndex(0);
        setStatusState({mode: 'progress', tone: 'success', message: '', label});

        try {
            return await task();
        } catch (error) {
            showResultStatus('error', error.message);
            return null;
        }
    }

    function resetInputModes(message) {
        setSourceInputMode(false);
        setSourceInputValue('');
        setSourceInputError('');
        setOutputInputMode(false);
        setOutputInputValue('');
        if (message) {
            showResultStatus('warn', message);
        }
    }

    async function compressCurrentSelection() {
        const selectedPaths = requestState.sourcePaths;
        if (selectedPaths.length === 0) {
            showResultStatus('warn', t('tui.status.noTargets'));
            return;
        }

        const nextSummary = await runTask(t('tui.status.busy'), async () => {
            const response = await runCompressionRequest({
                inputPaths: selectedPaths,
                outputDir: requestState.outputDir,
                recursive: requestState.recursive,
                overwrite: requestState.overwrite,
                allowLarger: requestState.allowLarger,
                quality: requestState.quality,
                maxWidth: requestState.maxWidth,
                maxHeight: requestState.maxHeight,
                concurrency: requestState.concurrency,
                dryRun: requestState.dryRun
            });

            if (!response.summary) {
                throw new Error(response.stderr.trim() || 'backend did not return a summary');
            }

            const finishedSummary = response.summary;
            setLastSummary(finishedSummary);
            setHistoryItems(currentHistory => [{
                id: Date.now(),
                label: new Date().toLocaleTimeString(),
                summary: finishedSummary
            }, ...currentHistory].slice(0, 8));

            if (response.exitCode !== 0 && finishedSummary.FailedCount === 0 && finishedSummary.Cancelled !== true) {
                throw new Error(response.stderr.trim() || 'backend command failed');
            }

            return finishedSummary;
        });

        if (!nextSummary) {
            return;
        }

        const hasWarnings = (nextSummary.SkippedCount || 0) > 0 || (nextSummary.FailedCount || 0) > 0;
        showResultStatus(
            hasWarnings ? 'warn' : 'success',
            hasWarnings
                ? t('tui.status.runWarn')
                : t('tui.status.runDone', {
                    success: nextSummary.SuccessCount || 0,
                    skipped: nextSummary.SkippedCount || 0,
                    failed: nextSummary.FailedCount || 0
                })
        );
    }

    function handleRunMenuAction() {
        const selectedItem = RUN_MENU_ITEMS[runMenuIndex];

        if (selectedItem === 'compress') {
            void compressCurrentSelection();
            return;
        }
        if (selectedItem === 'addCurrentDir') {
            setRequestState(currentState => ({
                ...currentState,
                sourcePaths: dedupePaths([...currentState.sourcePaths, process.cwd()])
            }));
            showResultStatus('success', t('tui.status.cwdAdded', {dir: process.cwd()}));
            return;
        }
        if (selectedItem === 'editTargets') {
            setSourceInputMode(true);
            setOutputInputMode(false);
            setSourceInputValue('');
            setSourceCursor(0);
            setSourceInputError('');
            showResultStatus('success', t('tui.status.inputModeTargets'));
            return;
        }
        if (selectedItem === 'clearTargets') {
            setRequestState(currentState => ({...currentState, sourcePaths: []}));
            showResultStatus('success', t('tui.status.targetsCleared'));
            return;
        }
        if (selectedItem === 'openOptions') {
            setActiveTab('options');
            return;
        }
        if (selectedItem === 'exit') {
            app.exit();
        }
    }

    function commitSourceInput() {
        const parsedPaths = parseDroppedPaths(sourceInputValue);
        if (parsedPaths.length === 0) {
            setSourceInputError(t('tui.status.invalidPaths'));
            showResultStatus('warn', t('tui.status.invalidPaths'));
            return;
        }

        setRequestState(currentState => ({
            ...currentState,
            sourcePaths: dedupePaths([...currentState.sourcePaths, ...parsedPaths])
        }));
        setSourceInputMode(false);
        setSourceInputValue('');
        setSourceCursor(0);
        setSourceInputError('');
        showResultStatus('success', t('tui.status.inputSaved'));
    }

    function commitOutputInput() {
        const parsedPaths = parseDroppedPaths(outputInputValue);
        const nextOutputDir = parsedPaths[0] || outputInputValue.trim();
        setRequestState(currentState => ({...currentState, outputDir: nextOutputDir}));
        setOutputInputMode(false);
        setOutputInputValue('');
        setOutputCursor(0);
        showResultStatus(
            nextOutputDir ? 'success' : 'warn',
            nextOutputDir ? t('tui.status.outputDirSaved') : t('tui.status.outputDirCleared')
        );
    }

    function updateNumericOption(optionKey, delta) {
        setRequestState(currentState => {
            const nextState = {...currentState};
            if (optionKey === 'quality') {
                nextState.quality = clamp(currentState.quality + delta * 5, 1, 100);
            } else if (optionKey === 'maxWidth') {
                nextState.maxWidth = Math.max(0, currentState.maxWidth + delta * 100);
            } else if (optionKey === 'maxHeight') {
                nextState.maxHeight = Math.max(0, currentState.maxHeight + delta * 100);
            } else if (optionKey === 'concurrency') {
                nextState.concurrency = Math.max(0, currentState.concurrency + delta);
            }
            return nextState;
        });
        showResultStatus('success', t('tui.status.optionUpdated', {label: t(`tui.options.${optionKey}`)}));
    }

    function toggleBooleanOption(optionKey) {
        setRequestState(currentState => ({...currentState, [optionKey]: !currentState[optionKey]}));
        showResultStatus('success', t('tui.status.optionUpdated', {label: t(`tui.options.${optionKey}`)}));
    }

    useInput((input, key) => {
        if (statusState.mode === 'progress') return;
        if (layout.tooSmall) {
            if (input === 'q') app.exit();
            return;
        }
        if (detailLines) {
            if (key.escape) setDetailLines(null);
            else if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, Math.min(value, detailWindow.maxScroll) - (key.pageUp ? detailWindow.capacity : 1)));
            else if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(
                detailWindow.maxScroll, Math.min(value, detailWindow.maxScroll) + (key.pageDown ? detailWindow.capacity : 1)));
            return;
        }
        if (helpOpen) {
            if (input === '?' || key.escape) {
                setHelpOpen(false);
            }
            if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, Math.min(value, detailWindow.maxScroll) - (key.pageUp ? detailWindow.capacity : 1)));
            if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(detailWindow.maxScroll, value + (key.pageDown ? detailWindow.capacity : 1)));
            return;
        }

        if (sourceInputMode || outputInputMode) {
            if (key.escape) {
                resetInputModes(t('tui.status.cancelledInput'));
                return;
            }
            if (key.return) {
                if (sourceInputMode) {
                    commitSourceInput();
                } else {
                    commitOutputInput();
                }
                return;
            }
            const current = sourceInputMode ? sourceInputValue : outputInputValue;
            const cursor = sourceInputMode ? sourceCursor : outputCursor;
            const next = editText({value: current, cursor}, input, key);
            if (sourceInputMode) {
                setSourceInputValue(next.value);
                setSourceCursor(next.cursor);
                setSourceInputError('');
            } else {
                setOutputInputValue(next.value);
                setOutputCursor(next.cursor);
            }
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
            setDetailScroll(0);
            return;
        }
        if (input === 'v') {
            const lines = [statusState.message || t('tui.status.ready')];
            if (activeTab === 'run') lines.push(...requestState.sourcePaths,
                `${t('tui.options.outputDir')}: ${requestState.outputDir || '-'}`,
                ...historyItems.map(item => JSON.stringify(item.summary)));
            else if (activeTab === 'options') lines.push(`${t('tui.options.' + OPTION_ITEMS[optionIndex])}: ${
                describeOptionValue(OPTION_ITEMS[optionIndex], requestState, false, '').value}`);
            else lines.push(...historyItems.map(item => JSON.stringify(item.summary)));
            setDetailLines(lines);
            setDetailScroll(0);
            return;
        }
        if (input.toLowerCase() === 'q') {
            app.exit();
            return;
        }
        if (input && input.length > 1) {
            captureExternalPathText(input);
            return;
        }
        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            setActiveTab(TABS[nextTabIndex(currentIndex, TABS.length, key)]);
            resetInputModes();
            return;
        }
        if (key.escape) {
            setActiveTab('run');
            return;
        }

        if (activeTab === 'run') {
            if (key.upArrow || key.downArrow) {
                const delta = key.upArrow ? -1 : 1;
                setRunMenuIndex(currentIndex => (
                    currentIndex + delta + RUN_MENU_ITEMS.length
                ) % RUN_MENU_ITEMS.length);
                return;
            }
            if (key.return) {
                handleRunMenuAction();
            }
            return;
        }

        if (activeTab === 'options') {
            const optionKey = OPTION_ITEMS[optionIndex];
            if (key.upArrow || key.downArrow) {
                const delta = key.upArrow ? -1 : 1;
                setOptionIndex(currentIndex => (
                    currentIndex + delta + OPTION_ITEMS.length
                ) % OPTION_ITEMS.length);
                return;
            }
            if (key.return && optionKey === 'outputDir') {
                setOutputInputMode(true);
                setOutputInputValue(requestState.outputDir);
                setOutputCursor(graphemes(requestState.outputDir).length);
                showResultStatus('success', t('tui.status.inputModeOutput'));
                return;
            }
            if (input === ' ' && isBooleanOption(optionKey)) {
                toggleBooleanOption(optionKey);
                return;
            }
            if (key.leftArrow || key.rightArrow) {
                if (isBooleanOption(optionKey)) {
                    toggleBooleanOption(optionKey);
                } else if (isNumericOption(optionKey)) {
                    updateNumericOption(optionKey, key.leftArrow ? -1 : 1);
                }
            }
        }
    });

    if (layout.tooSmall) {
        return h(
            Box,
            {flexDirection: 'column', height: layout.viewportHeight, paddingX: 1, paddingY: 1},
            h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent}, 'image-compress'),
            h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.warning}, t('tui.tooSmall')),
            h(Text, {dimColor: true}, t('tui.tooSmallDetail')),
            h(Spacer, {}),
            h(Text, {dimColor: true}, 'q')
        );
    }

    let mainContent;
    if (detailLines) {
        mainContent = h(TuiDetails, {title: t('tui.help.title'), lines: detailLines, scroll: detailScroll, width: shell.contentWidth, height: shell.contentHeight});
    } else if (helpOpen) {
        mainContent = h(TuiDetails, {title: t('tui.help.title'), lines: t('tui.help.lines'), scroll: detailScroll, width: shell.contentWidth, height: shell.contentHeight});
    } else if (activeTab === 'run') {
        mainContent = h(RunContent, {
            requestState,
            runMenuIndex,
            sourceInputMode,
            sourceInputValue,
            sourceCursor,
            sourceInputError,
            lastSummary,
            layout
        });
    } else if (activeTab === 'options' && outputInputMode) {
        mainContent = h(OptionDetailPanel, {requestState, selectedOption: OPTION_ITEMS[optionIndex], outputInputMode, outputInputValue, outputCursor, layout});
    } else if (activeTab === 'options') {
        const selectedOption = OPTION_ITEMS[optionIndex];
        mainContent = h(ResponsivePair, {
            left: h(OptionListPanel, {
                requestState,
                selectedIndex: optionIndex,
                outputInputMode,
                outputInputValue,
                outputCursor,
                layout
            }),
            right: h(OptionDetailPanel, {
                requestState,
                selectedOption,
                outputInputMode,
                outputInputValue,
                outputCursor,
                layout
            }),
            layout,
            showRight: layout.showOptionDetail
        });
    } else {
        mainContent = h(HistoryPanel, {historyItems, layout});
    }


    return h(TuiFrame, {layout: shell, statusColor: resolveStatusColor(statusState.mode, statusState.tone),
        header: h(Header, {activeTab, columns: layout.columns})}, mainContent);
}

function describeOptionValue(optionKey, requestState, outputInputMode, outputInputValue) {
    if (optionKey === 'outputDir') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: outputInputMode
                ? (outputInputValue || '')
                : (requestState.outputDir || t('tui.optionValue.emptyOutputDir'))
        };
    }
    if (optionKey === 'quality') {
        return {key: optionKey, label: t(`tui.options.${optionKey}`), value: String(requestState.quality)};
    }
    if (optionKey === 'maxWidth' || optionKey === 'maxHeight') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: requestState[optionKey] > 0 ? String(requestState[optionKey]) : t('tui.optionValue.off')
        };
    }
    if (optionKey === 'concurrency') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: requestState.concurrency > 0 ? String(requestState.concurrency) : t('tui.optionValue.auto')
        };
    }
    return {
        key: optionKey,
        label: t(`tui.options.${optionKey}`),
        value: requestState[optionKey] ? t('tui.optionValue.on') : t('tui.optionValue.off')
    };
}

function isBooleanOption(optionKey) {
    return ['recursive', 'overwrite', 'allowLarger', 'dryRun'].includes(optionKey);
}

function isNumericOption(optionKey) {
    return ['quality', 'maxWidth', 'maxHeight', 'concurrency'].includes(optionKey);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export async function startImageCompressTui() {
    if (process.env.SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(ImageCompressTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
}
