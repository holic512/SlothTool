/**
 * @file ImageCompressTui
 * @project SlothTool
 * @module Image Compress Plugin / TUI
 * @description 提供面向单图压缩、目录批处理、参数验证和结果复盘的响应式全屏 Ink 工作台。
 * @logic 1. 运行页按操作、输入队列、执行方案和压缩收益组织任务；2. 选项页用动态分页与选中项说明降低配置成本；3. 历史页聚合当前会话任务；4. 根据终端宽高切换双栏、堆叠和精简模式。
 * @dependencies Libraries: react/ink, Services: ./service.js, Model: ./tui-model.js, I18N: ./i18n.js
 * @index_tags 图片压缩TUI, Ink, 拖拽路径, 批量压缩, 结果洞察, 响应式布局, 高对比配色
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
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

const h = React.createElement;
const TABS = ['run', 'options', 'history'];
const RUN_MENU_ITEMS = ['compress', 'addCurrentDir', 'editTargets', 'clearTargets', 'openOptions', 'exit'];
const OPTION_ITEMS = ['outputDir', 'quality', 'maxWidth', 'maxHeight', 'recursive', 'overwrite', 'allowLarger', 'dryRun', 'concurrency'];
const RESULT_DISPLAY_MS = 1800;
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

function PanelHeader({title, summary, badge, badgeColor = IMAGE_COMPRESS_TUI_COLORS.accent}) {
    return h(
        Box,
        {},
        h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent}, title),
        badge ? h(Text, {bold: true, color: badgeColor}, `  [${badge}]`) : null,
        h(Spacer, {}),
        summary ? h(Text, {dimColor: true}, summary) : null
    );
}

function Header({activeTab, columns}) {
    const metaText = buildHeaderMetaText(activeTab, columns);
    const tabItems = TABS.flatMap((tabKey, index) => [
        index > 0
            ? h(Text, {
                key: `${tabKey}-separator`,
                color: IMAGE_COMPRESS_TUI_COLORS.muted,
                dimColor: true
            }, HEADER_SEPARATOR)
            : null,
        h(Text, {
            key: tabKey,
            bold: tabKey === activeTab,
            color: tabKey === activeTab ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.muted
        }, buildTabText(tabKey, activeTab))
    ]).filter(Boolean);

    return h(
        Box,
        {},
        h(Box, {}, ...tabItems),
        h(Spacer, {}),
        metaText ? h(Text, {dimColor: true}, metaText) : null
    );
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

    return h(
        Box,
        {marginTop: compact ? 0 : 1},
        ...items.flatMap(([label, color], index) => [
            index > 0
                ? h(Text, {key: `${label}-separator`, color: IMAGE_COMPRESS_TUI_COLORS.muted, dimColor: true}, ' | ')
                : null,
            h(Text, {key: label, bold: true, color}, label)
        ]).filter(Boolean)
    );
}

function ResultMetrics({insights, compact = false}) {
    const countItems = [
        [t('tui.result.total'), insights.totalFiles, IMAGE_COMPRESS_TUI_COLORS.accent],
        [t('tui.result.success'), insights.successCount, IMAGE_COMPRESS_TUI_COLORS.success],
        [t('tui.result.skipped'), insights.skippedCount, IMAGE_COMPRESS_TUI_COLORS.warning],
        [t('tui.result.failed'), insights.failedCount, IMAGE_COMPRESS_TUI_COLORS.danger]
    ];
    const countRow = h(
        Box,
        {},
        ...countItems.flatMap(([label, value, color], index) => [
            index > 0
                ? h(Text, {key: `${label}-separator`, dimColor: true}, ' | ')
                : null,
            h(Text, {key: label, color: IMAGE_COMPRESS_TUI_COLORS.muted}, `${label} `),
            h(Text, {key: `${label}-value`, bold: true, color}, formatNumber(value))
        ]).filter(Boolean)
    );
    const savedLabel = insights.preview ? t('tui.result.wouldSave') : t('tui.result.saved');
    const savingRow = h(
        Box,
        {},
        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.muted}, `${savedLabel} `),
        h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.secondary}, formatBytes(insights.savedBytes)),
        h(Text, {dimColor: true}, ' | '),
        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.muted}, `${t('tui.result.savingRate')} `),
        h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.success}, formatPercent(insights.savingRate))
    );

    return h(
        Box,
        {flexDirection: compact ? 'column' : 'row', marginTop: compact ? 0 : 1},
        countRow,
        compact ? savingRow : h(React.Fragment, {}, h(Text, {dimColor: true}, ' | '), savingRow)
    );
}

function ActionPanel({selectedIndex, requestState, layout, lastSummary}) {
    const insights = buildCompressionInsights(lastSummary);

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            width: layout.compact ? '100%' : undefined
        },
        h(PanelHeader, {
            title: t('tui.panels.actions'),
            summary: `${selectedIndex + 1}/${RUN_MENU_ITEMS.length}`
        }),
        ...RUN_MENU_ITEMS.map((item, index) => {
            const selected = index === selectedIndex;
            const badgeColor = item === 'exit'
                ? IMAGE_COMPRESS_TUI_COLORS.danger
                : item === 'clearTargets'
                    ? IMAGE_COMPRESS_TUI_COLORS.warning
                    : item === 'compress'
                        ? (requestState.sourcePaths.length > 0
                            ? IMAGE_COMPRESS_TUI_COLORS.success
                            : IMAGE_COMPRESS_TUI_COLORS.warning)
                        : IMAGE_COMPRESS_TUI_COLORS.secondary;

            return h(
                Box,
                {key: item},
                h(Text, {
                    bold: selected,
                    color: selected ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.muted
                }, selected ? '› ' : '  '),
                h(Text, {
                    bold: selected,
                    color: selected ? IMAGE_COMPRESS_TUI_COLORS.accent : 'white',
                    dimColor: !selected
                }, t(`tui.menu.${item}`)),
                h(Spacer, {}),
                h(Text, {color: badgeColor, dimColor: !selected}, t(`tui.menuBadges.${item}`))
            );
        }),
        layout.compact && !layout.showRunResult && insights
            ? h(ResultMetrics, {insights, compact: true})
            : null
    );
}

function TargetPanel({requestState, inputMode, inputValue, layout}) {
    const paths = requestState.sourcePaths;
    const visiblePaths = paths.slice(0, layout.targetLimit);
    const badge = inputMode
        ? t('tui.targets.inputBadge')
        : t('tui.targets.readyBadge', {count: paths.length});

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: inputMode ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {
            title: t('tui.panels.targets'),
            badge,
            badgeColor: inputMode ? IMAGE_COMPRESS_TUI_COLORS.secondary : IMAGE_COMPRESS_TUI_COLORS.success
        }),
        inputMode
            ? h(
                React.Fragment,
                {},
                h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent}, `› ${inputValue || ''}`),
                h(Text, {dimColor: true}, t('tui.inputHint'))
            )
            : paths.length === 0
                ? h(
                    React.Fragment,
                    {},
                    h(Text, {bold: true}, t('tui.targets.emptyTitle')),
                    h(Text, {dimColor: true}, t('tui.targets.emptyDescription'))
                )
                : h(
                    React.Fragment,
                    {},
                    ...visiblePaths.map((currentPath, index) => h(
                        Box,
                        {key: currentPath},
                        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.muted}, `${index + 1}. `),
                        h(Text, {}, truncateFromLeft(currentPath, Math.max(12, layout.detailTextWidth - 4)))
                    )),
                    paths.length > visiblePaths.length
                        ? h(Text, {dimColor: true}, t('tui.targets.more', {count: paths.length - visiblePaths.length}))
                        : null
                ),
        h(PlanStrip, {requestState, compact: layout.compact || layout.short})
    );
}

function ResultPanel({summary, layout}) {
    const insights = buildCompressionInsights(summary);
    const badge = insights
        ? (insights.preview ? t('tui.result.previewBadge') : t('tui.result.completeBadge'))
        : t('tui.result.waitingBadge');
    const badgeColor = insights
        ? (insights.failedCount > 0 ? IMAGE_COMPRESS_TUI_COLORS.danger : IMAGE_COMPRESS_TUI_COLORS.success)
        : IMAGE_COMPRESS_TUI_COLORS.warning;
    const detailItems = insights?.issues.length > 0
        ? insights.issues.slice(0, layout.resultLimit).map(result => ({
            key: `${result.inputPath}-${result.status}`,
            title: t('tui.result.issueLine', {
                name: getPathLabel(result.inputPath),
                status: result.status
            }),
            color: result.status === 'failed' ? IMAGE_COMPRESS_TUI_COLORS.danger : IMAGE_COMPRESS_TUI_COLORS.warning,
            detail: result.error
        }))
        : insights?.topSavings.slice(0, layout.resultLimit).map(result => ({
            key: result.inputPath,
            title: t('tui.result.savedLine', {
                name: getPathLabel(result.inputPath),
                saved: formatBytes(result.bytesSaved)
            }),
            color: IMAGE_COMPRESS_TUI_COLORS.success,
            detail: result.outputPath
        })) || [];

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {title: t('tui.panels.result'), badge, badgeColor}),
        !insights
            ? h(
                React.Fragment,
                {},
                h(Text, {bold: true}, t('tui.result.emptyTitle')),
                h(Text, {dimColor: true}, t('tui.result.emptyDescription'))
            )
            : h(
                React.Fragment,
                {},
                h(ResultMetrics, {insights, compact: layout.compact}),
                insights.cancelled
                    ? h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.warning}, t('tui.result.cancelled'))
                    : null,
                detailItems.length > 0
                    ? h(
                        Box,
                        {flexDirection: 'column', marginTop: layout.compact ? 0 : 1},
                        h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.secondary}, insights.issues.length > 0
                            ? t('tui.result.issues')
                            : t('tui.result.topSavings')),
                        ...detailItems.map(item => h(
                            Box,
                            {key: item.key},
                            h(Text, {bold: true, color: item.color}, truncateFromRight(item.title, layout.detailTextWidth)),
                            !layout.compact && item.detail
                                ? h(React.Fragment, {}, h(Spacer, {}), h(Text, {dimColor: true}, truncateFromLeft(item.detail, 24)))
                                : null
                        ))
                    )
                    : h(Text, {dimColor: true}, t('tui.result.noSavings'))
            )
    );
}

function OptionListPanel({requestState, selectedIndex, outputInputMode, outputInputValue, layout}) {
    const optionLines = OPTION_ITEMS.map(optionKey => describeOptionValue(
        optionKey,
        requestState,
        outputInputMode,
        outputInputValue
    ));
    const page = getVisibleOptionPage(optionLines, selectedIndex, layout.optionPageSize);

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: layout.compact ? 0 : 1
        },
        h(PanelHeader, {
            title: t('tui.panels.optionList'),
            summary: `${page.pageIndex + 1}/${page.pageCount}`
        }),
        ...page.items.map((line, index) => {
            const selected = index === page.localSelectedIndex;
            const booleanValue = isBooleanOption(line.key) ? requestState[line.key] : null;
            const valueColor = booleanValue === true
                ? IMAGE_COMPRESS_TUI_COLORS.success
                : booleanValue === false
                    ? IMAGE_COMPRESS_TUI_COLORS.muted
                    : IMAGE_COMPRESS_TUI_COLORS.secondary;

            return h(
                Box,
                {key: line.key},
                h(Text, {
                    bold: selected,
                    color: selected ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.muted
                }, selected ? '› ' : '  '),
                h(Text, {
                    bold: selected,
                    color: selected ? IMAGE_COMPRESS_TUI_COLORS.accent : 'white',
                    dimColor: !selected
                }, line.label),
                h(Spacer, {}),
                h(Text, {bold: selected, color: valueColor}, truncateFromLeft(line.value, layout.compact ? 22 : 18))
            );
        })
    );
}

function OptionDetailPanel({requestState, selectedOption, outputInputMode, outputInputValue, layout}) {
    const optionLine = describeOptionValue(selectedOption, requestState, outputInputMode, outputInputValue);
    const helpText = selectedOption === 'outputDir'
        ? t('tui.optionHelp.outputDir')
        : isBooleanOption(selectedOption)
            ? t('tui.optionHelp.boolean')
            : t('tui.optionHelp.number');
    const badgeColor = isBooleanOption(selectedOption) && requestState[selectedOption]
        ? IMAGE_COMPRESS_TUI_COLORS.success
        : IMAGE_COMPRESS_TUI_COLORS.secondary;

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: outputInputMode ? IMAGE_COMPRESS_TUI_COLORS.accent : IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {
            title: optionLine.label,
            badge: optionLine.value,
            badgeColor
        }),
        h(Text, {dimColor: true}, t(`tui.optionDetails.${selectedOption}`)),
        outputInputMode
            ? h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent}, `› ${outputInputValue || ''}`)
            : null,
        h(Text, {color: IMAGE_COMPRESS_TUI_COLORS.secondary}, helpText),
        layout.compact ? null : h(PlanStrip, {requestState})
    );
}

function HistoryPanel({historyItems, layout}) {
    const visibleHistory = historyItems.slice(0, layout.historyLimit);

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {
            title: t('tui.panels.history'),
            summary: t('tui.history.count', {count: historyItems.length})
        }),
        h(Text, {dimColor: true}, t('tui.history.sessionOnly')),
        visibleHistory.length === 0
            ? h(Text, {bold: true}, t('tui.history.empty'))
            : visibleHistory.flatMap(entry => {
                const insights = buildCompressionInsights(entry.summary);
                return [
                    h(Text, {
                        key: `${entry.id}-summary`,
                        bold: true,
                        color: insights.failedCount > 0
                            ? IMAGE_COMPRESS_TUI_COLORS.danger
                            : IMAGE_COMPRESS_TUI_COLORS.success
                    }, t('tui.history.task', {
                        time: entry.label,
                        files: insights.totalFiles,
                        saved: formatBytes(insights.savedBytes)
                    })),
                    layout.short
                        ? null
                        : h(Text, {
                            key: `${entry.id}-counts`,
                            dimColor: true
                        }, t('tui.history.summary', {
                            success: insights.successCount,
                            skipped: insights.skippedCount,
                            failed: insights.failedCount,
                            saved: formatBytes(insights.savedBytes)
                        }))
                ].filter(Boolean);
            })
    );
}

function ResponsivePair({left, right, layout, showRight = true}) {
    if (layout.compact) {
        return h(
            Box,
            {flexDirection: 'column', flexGrow: 1},
            h(Box, {flexDirection: 'column', marginBottom: showRight ? 1 : 0}, left),
            showRight ? h(Box, {flexDirection: 'column', flexGrow: 1}, right) : null
        );
    }

    return h(
        Box,
        {flexDirection: 'row', flexGrow: 1},
        h(Box, {
            width: layout.sidebarWidth,
            marginRight: 1,
            flexDirection: 'column'
        }, left),
        showRight ? h(Box, {flexDirection: 'column', flexGrow: 1}, right) : null
    );
}

function RunContent({requestState, runMenuIndex, sourceInputMode, sourceInputValue, lastSummary, layout}) {
    const actions = h(ActionPanel, {
        selectedIndex: runMenuIndex,
        requestState,
        layout,
        lastSummary
    });
    const target = h(TargetPanel, {
        requestState,
        inputMode: sourceInputMode,
        inputValue: sourceInputValue,
        layout
    });
    const result = h(ResultPanel, {summary: lastSummary, layout});

    if (layout.compact) {
        return h(
            Box,
            {flexDirection: 'column', flexGrow: 1},
            h(Box, {marginBottom: 1}, actions),
            h(Box, {flexGrow: 1, flexDirection: 'column'}, target),
            layout.showRunResult
                ? h(Box, {marginTop: 1, flexDirection: 'column'}, result)
                : null
        );
    }

    return h(
        ResponsivePair,
        {
            left: actions,
            right: h(
                Box,
                {flexDirection: 'column', flexGrow: 1},
                h(Box, {flexGrow: 1, flexDirection: 'column'}, target),
                h(Box, {marginTop: 1, flexGrow: 1, flexDirection: 'column'}, result)
            ),
            layout
        }
    );
}

function HelpPanel() {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: IMAGE_COMPRESS_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(Text, {bold: true, color: IMAGE_COMPRESS_TUI_COLORS.accent}, t('tui.help.title')),
        ...t('tui.help.lines').map(line => h(Text, {key: line}, line))
    );
}

function getFooterText(activeTab, inputMode, layout) {
    if (inputMode) {
        return t(`tui.footer.${layout.microFooter ? 'microInput' : 'input'}`);
    }
    if (layout.microFooter) {
        return t(`tui.footer.micro${activeTab[0].toUpperCase()}${activeTab.slice(1)}`);
    }
    if (layout.compactFooter) {
        return t(`tui.footer.compact${activeTab[0].toUpperCase()}${activeTab.slice(1)}`);
    }
    return t(`tui.footer.${activeTab}`);
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
    const layout = layoutOverride || resolveImageCompressTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'run');
    const [runMenuIndex, setRunMenuIndex] = useState(0);
    const [optionIndex, setOptionIndex] = useState(Math.min(
        OPTION_ITEMS.length - 1,
        Math.max(0, Number.parseInt(initialOptionIndex, 10) || 0)
    ));
    const [helpOpen, setHelpOpen] = useState(false);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: t('tui.status.ready'),
        label: ''
    });
    const [sourceInputMode, setSourceInputMode] = useState(false);
    const [sourceInputValue, setSourceInputValue] = useState('');
    const [outputInputMode, setOutputInputMode] = useState(false);
    const [outputInputValue, setOutputInputValue] = useState('');
    const [requestState, setRequestState] = useState({
        ...DEFAULT_REQUEST_STATE,
        sourcePaths: dedupePaths(initialPaths)
    });
    const [lastSummary, setLastSummary] = useState(initialSummary);
    const [historyItems, setHistoryItems] = useState(initialHistory);
    const resultTimeoutRef = useRef(null);

    useEffect(() => () => {
        clearTimeout(resultTimeoutRef.current);
    }, []);

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

    function clearPendingStatus() {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
    }

    function showResultStatus(tone, message) {
        clearPendingStatus();
        setStatusState({mode: 'result', tone, message, label: ''});
        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                mode: 'idle',
                tone: 'success',
                message: t('tui.status.ready'),
                label: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    function captureExternalPathText(text) {
        if (statusState.mode === 'progress') {
            return;
        }

        if (outputInputMode) {
            const parsedPaths = parseDroppedPaths(text);
            const nextOutputDir = parsedPaths[0] || text.trim();
            setOutputInputValue(nextOutputDir);
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

        clearPendingStatus();
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
            showResultStatus('warn', t('tui.status.invalidPaths'));
            return;
        }

        setRequestState(currentState => ({
            ...currentState,
            sourcePaths: dedupePaths([...currentState.sourcePaths, ...parsedPaths])
        }));
        setSourceInputMode(false);
        setSourceInputValue('');
        showResultStatus('success', t('tui.status.inputSaved'));
    }

    function commitOutputInput() {
        const parsedPaths = parseDroppedPaths(outputInputValue);
        const nextOutputDir = parsedPaths[0] || outputInputValue.trim();
        setRequestState(currentState => ({...currentState, outputDir: nextOutputDir}));
        setOutputInputMode(false);
        setOutputInputValue('');
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
        if (helpOpen) {
            if (input === '?' || key.escape) {
                setHelpOpen(false);
            }
            return;
        }

        if (statusState.mode === 'progress') {
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
            if (key.backspace || key.delete) {
                if (sourceInputMode) {
                    setSourceInputValue(currentValue => currentValue.slice(0, -1));
                } else {
                    setOutputInputValue(currentValue => currentValue.slice(0, -1));
                }
                return;
            }
            if (input && !key.ctrl && !key.meta) {
                if (sourceInputMode) {
                    setSourceInputValue(currentValue => currentValue + input);
                } else {
                    setOutputInputValue(currentValue => currentValue + input);
                }
            }
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
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
            setActiveTab(TABS[(currentIndex + 1) % TABS.length]);
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
    if (helpOpen) {
        mainContent = h(HelpPanel);
    } else if (activeTab === 'run') {
        mainContent = h(RunContent, {
            requestState,
            runMenuIndex,
            sourceInputMode,
            sourceInputValue,
            lastSummary,
            layout
        });
    } else if (activeTab === 'options') {
        const selectedOption = OPTION_ITEMS[optionIndex];
        mainContent = h(ResponsivePair, {
            left: h(OptionListPanel, {
                requestState,
                selectedIndex: optionIndex,
                outputInputMode,
                outputInputValue,
                layout
            }),
            right: h(OptionDetailPanel, {
                requestState,
                selectedOption,
                outputInputMode,
                outputInputValue,
                layout
            }),
            layout,
            showRight: layout.showOptionDetail
        });
    } else {
        mainContent = h(HistoryPanel, {historyItems, layout});
    }

    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.message;
    const footerText = getFooterText(activeTab, sourceInputMode || outputInputMode, layout);

    return h(
        Box,
        {
            flexDirection: 'column',
            height: layout.viewportHeight,
            paddingX: 1,
            paddingY: 1
        },
        h(Header, {activeTab, columns: layout.columns}),
        h(Box, {marginBottom: 1}, h(Text, {
            color: IMAGE_COMPRESS_TUI_COLORS.muted,
            dimColor: true
        }, '─'.repeat(layout.contentWidth))),
        h(Box, {flexGrow: 1, marginBottom: 1, flexDirection: 'column'}, mainContent),
        h(
            Box,
            {},
            h(Text, {
                color: resolveStatusColor(statusState.mode, statusState.tone)
            }, truncateFromRight(statusText, Math.max(12, Math.floor(layout.contentWidth * 0.42)))),
            h(Spacer, {}),
            h(Text, {dimColor: true, wrap: 'truncate-end'}, footerText)
        )
    );
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
