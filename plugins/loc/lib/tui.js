/**
 * @file LocPluginTui
 * @project SlothTool
 * @module LOC Plugin / TUI
 * @description 提供面向代码规模体检、热点定位和过滤规则调整的响应式 loc 全屏 Ink 界面。
 * @logic 1. 统计页以操作区和扩展名/热点洞察呈现扫描结果；2. 配置页以规则列表和选中项影响详情呈现；3. 根据终端宽高切换双栏、堆叠、动态分页和精简明细。
 * @dependencies Libraries: react/ink, Services: ./service.js, Model: ./tui-model.js, I18N: ./i18n.js, Pagination: ./pagination.js
 * @index_tags loc TUI, 代码规模体检, 热点文件, 过滤规则, 响应式布局, 高对比配色
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getLanguage, t} from './i18n.js';
import {
    createPagedState,
    flipPagedPage,
    getPagedItems,
    movePagedSelection
} from './pagination.js';
import {
    countTargetDirectory,
    getConfigSummary,
    resetPluginConfig,
    toggleExcludedDirectory,
    toggleExtension
} from './service.js';
import {
    buildDistributionBar,
    buildResultInsights,
    getConfigCounts,
    getDisplayWidth,
    getExtensionImpact,
    LOC_TUI_COLORS,
    normalizeDirectoryInput,
    resolveLocTuiLayout,
    truncateFromLeft,
    truncateFromRight
} from './tui-model.js';

const h = React.createElement;
const TABS = ['count', 'extensions', 'excludes'];
const COUNT_MENU_ITEMS = ['current', 'custom', 'reset', 'exit'];
const RESULT_DISPLAY_MS = 1600;
const SPINNER_INTERVAL_MS = 120;
const TASK_START_RENDER_DELAY_MS = 16;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];
const HEADER_SEPARATOR = ' | ';

function formatNumber(value) {
    return new Intl.NumberFormat(getLanguage() === 'en' ? 'en-US' : 'zh-CN').format(Number(value) || 0);
}

function waitForTaskStartRender() {
    return new Promise(resolve => {
        setTimeout(resolve, TASK_START_RENDER_DELAY_MS);
    });
}

function buildTabText(tabKey, activeTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === activeTab ? `[${label}]` : label;
}

function buildHeaderMetaText(activeTab, columns) {
    const contentWidth = resolveLocTuiLayout(columns, 24).contentWidth;
    const versionText = `「v${pluginPackage.version}」`;
    const tabStripText = TABS.map(tabKey => buildTabText(tabKey, activeTab)).join(HEADER_SEPARATOR);
    const availableWidth = Math.max(0, contentWidth - getDisplayWidth(tabStripText) - 2);

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
        return LOC_TUI_COLORS.accent;
    }

    if (mode === 'result' && tone === 'error') {
        return LOC_TUI_COLORS.danger;
    }

    if (mode === 'result' && tone === 'warn') {
        return LOC_TUI_COLORS.warning;
    }

    return LOC_TUI_COLORS.success;
}

function PanelHeader({title, summary, badge, badgeColor = LOC_TUI_COLORS.accent}) {
    return h(
        Box,
        {},
        h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, title),
        badge ? h(Text, {bold: true, color: badgeColor}, `  [${badge}]`) : null,
        h(Spacer, {}),
        summary ? h(Text, {dimColor: true}, summary) : null
    );
}

function Field({label, value, valueColor, dimColor = false}) {
    return h(
        Box,
        {},
        h(Text, {color: LOC_TUI_COLORS.accent}, `${label}  `),
        h(Text, {color: valueColor, dimColor}, value || '-')
    );
}

function CountActionPanel({selectedIndex, result = null, layout = null}) {
    const compactInsights = layout?.short ? buildResultInsights(result) : null;

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column'
        },
        h(PanelHeader, {
            title: t('tui.panels.actions'),
            summary: `${selectedIndex + 1}/${COUNT_MENU_ITEMS.length}`
        }),
        ...COUNT_MENU_ITEMS.map((item, index) => {
            const selected = index === selectedIndex;
            const badgeColor = item === 'exit'
                ? LOC_TUI_COLORS.danger
                : item === 'reset'
                    ? LOC_TUI_COLORS.warning
                    : LOC_TUI_COLORS.secondary;

            return h(
                Box,
                {key: item},
                h(Text, {
                    bold: selected,
                    color: selected ? LOC_TUI_COLORS.accent : LOC_TUI_COLORS.muted
                }, selected ? '› ' : '  '),
                h(Text, {
                    bold: selected,
                    color: selected ? LOC_TUI_COLORS.accent : 'white',
                    dimColor: !selected
                }, t(`tui.menu.${item}`)),
                h(Spacer, {}),
                h(Text, {
                    color: badgeColor,
                    dimColor: !selected
                }, t(`tui.menuBadges.${item}`))
            );
        }),
        layout?.short
            ? compactInsights
                ? h(MetricStrip, {insights: compactInsights, layout})
                : h(Text, {dimColor: true}, t('tui.result.emptyTitle'))
            : null
    );
}

function DirectoryInputPanel({value}) {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.accent,
            paddingX: 1,
            flexDirection: 'column'
        },
        h(PanelHeader, {
            title: t('tui.panels.countInput'),
            badge: t('tui.menuBadges.custom'),
            badgeColor: LOC_TUI_COLORS.secondary
        }),
        h(Box, {marginTop: 1}, h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, `› ${value || '.'}`)),
        h(Text, {dimColor: true}, t('tui.prompt'))
    );
}

function EmptyResultContent({extensionItems, excludeItems, layout}) {
    const extensionCounts = getConfigCounts(extensionItems);
    const excludeCounts = getConfigCounts(excludeItems);

    return h(
        React.Fragment,
        {},
        layout.short || !layout.compact
            ? h(Box, {marginTop: layout.compact ? 0 : 1}, h(Text, {bold: true}, t('tui.result.emptyTitle')))
            : null,
        h(Text, {dimColor: true}, t('tui.result.emptyDescription')),
        layout.short
            ? null
            : h(Box, {flexDirection: 'column', marginTop: layout.compact ? 0 : 1},
                layout.compact
                    ? null
                    : h(Field, {
                        label: t('tui.result.countScope'),
                        value: t('tui.result.countScopeValue')
                    }),
                h(Field, {
                    label: t('tui.result.enabledExtensions'),
                    value: `${extensionCounts.enabled}/${extensionCounts.total}`,
                    valueColor: LOC_TUI_COLORS.success
                }),
                h(Field, {
                    label: t('tui.result.excludedDirectories'),
                    value: String(excludeCounts.enabled),
                    valueColor: LOC_TUI_COLORS.warning
                })
            )
    );
}

function MetricStrip({insights, layout}) {
    const metrics = [
        [t('tui.result.files'), formatNumber(insights.fileCount), LOC_TUI_COLORS.success],
        [t('tui.result.lines'), formatNumber(insights.lineCount), LOC_TUI_COLORS.accent],
        [t('tui.result.average'), formatNumber(insights.averageLines), LOC_TUI_COLORS.secondary]
    ];

    if (insights.warningCount > 0) {
        metrics.push([t('tui.result.warnings'), formatNumber(insights.warningCount), LOC_TUI_COLORS.warning]);
    }

    return h(
        Box,
        {marginTop: layout.compact ? 0 : 1},
        ...metrics.flatMap(([label, value, color], index) => [
            index > 0
                ? h(Text, {key: `${label}-separator`, color: LOC_TUI_COLORS.muted, dimColor: true}, ' | ')
                : null,
            h(Text, {key: label, color: LOC_TUI_COLORS.muted}, `${label} `),
            h(Text, {key: `${label}-value`, bold: true, color}, value)
        ]).filter(Boolean)
    );
}

function ExtensionDistribution({insights, layout}) {
    const extensions = insights.extensions.slice(0, layout.extensionLimit);
    if (extensions.length === 0) {
        return null;
    }

    const maximumLines = extensions[0].lineCount;
    const barWidth = layout.compact ? 6 : 10;

    return h(
        Box,
        {flexDirection: 'column', marginTop: layout.compact ? 0 : 1},
        h(Text, {bold: true, color: LOC_TUI_COLORS.secondary}, t('tui.result.extensionDistribution')),
        ...extensions.map(item => h(
            Box,
            {key: item.extension || 'no-extension'},
            h(Box, {width: 12}, h(Text, {
                bold: true,
                color: LOC_TUI_COLORS.accent
            }, item.extension ? `.${item.extension}` : t('tui.result.noExtension'))),
            h(Text, {color: LOC_TUI_COLORS.accent}, buildDistributionBar(item.lineCount, maximumLines, barWidth)),
            h(Text, {}, `  ${formatNumber(item.lineCount)}`),
            h(Spacer, {}),
            h(Text, {dimColor: true}, t('tui.result.fileUnit', {count: formatNumber(item.fileCount)}))
        ))
    );
}

function HotspotFiles({insights, layout}) {
    const files = insights.topFiles.slice(0, layout.topFileLimit);
    if (files.length === 0) {
        return null;
    }

    const pathWidth = Math.max(12, layout.detailTextWidth - 14);

    return h(
        Box,
        {flexDirection: 'column', marginTop: 1},
        h(Text, {bold: true, color: LOC_TUI_COLORS.secondary}, t('tui.result.topFiles')),
        ...files.map((file, index) => h(
            Box,
            {key: file.path},
            h(Text, {color: LOC_TUI_COLORS.muted}, `${index + 1}. `),
            h(Text, {}, truncateFromRight(file.path, pathWidth)),
            h(Spacer, {}),
            h(Text, {bold: true, color: LOC_TUI_COLORS.warning}, t('tui.result.lineUnit', {
                count: formatNumber(file.lines)
            }))
        ))
    );
}

function CountResultPanel({result, extensionItems, excludeItems, layout}) {
    const insights = buildResultInsights(result);

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {
            title: t('tui.result.title'),
            badge: result ? t('tui.result.completeBadge') : t('tui.result.waitingBadge'),
            badgeColor: result ? LOC_TUI_COLORS.success : LOC_TUI_COLORS.warning
        }),
        result
            ? h(
                React.Fragment,
                {},
                layout.short
                    ? null
                    : h(Field, {
                        label: t('tui.result.target'),
                        value: truncateFromLeft(result.resolvedDir, Math.max(12, layout.detailTextWidth - 8)),
                        dimColor: true
                    }),
                h(MetricStrip, {insights, layout}),
                h(ExtensionDistribution, {insights, layout}),
                h(HotspotFiles, {insights, layout}),
                insights.warningCount > 0
                    ? h(Text, {color: LOC_TUI_COLORS.warning}, t('tui.result.warningSummary', {
                        count: formatNumber(insights.warningCount)
                    }))
                    : null
            )
            : h(EmptyResultContent, {extensionItems, excludeItems, layout})
    );
}

function ToggleListPanel({activeTab, items, page, localSelectedIndex, layout}) {
    const counts = getConfigCounts(items);
    const title = activeTab === 'extensions'
        ? t('tui.panels.extensions')
        : t('tui.panels.excludes');
    const summary = layout.compact
        ? `${t('tui.config.enabledSummary', counts)} · ${t('tui.panels.page', {
            page: page.pageIndex + 1,
            total: page.pageCount
        })}`
        : `${counts.enabled}/${counts.total} · ${page.pageIndex + 1}/${page.pageCount}`;

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: layout.compact ? 0 : 1
        },
        h(PanelHeader, {title, summary}),
        ...page.items.map((item, index) => {
            const selected = index === localSelectedIndex;

            return h(
                Box,
                {key: item.name},
                h(Text, {
                    bold: selected,
                    color: selected ? LOC_TUI_COLORS.accent : LOC_TUI_COLORS.muted
                }, selected ? '› ' : '  '),
                h(Text, {
                    color: item.enabled ? LOC_TUI_COLORS.success : LOC_TUI_COLORS.muted
                }, item.enabled ? '● ' : '○ '),
                h(Text, {
                    bold: selected,
                    color: selected ? LOC_TUI_COLORS.accent : 'white',
                    dimColor: !selected
                }, item.name)
            );
        })
    );
}

function ConfigDetailPanel({activeTab, selectedItem, items, result, layout}) {
    if (!selectedItem) {
        return null;
    }

    const extensionMode = activeTab === 'extensions';
    const counts = getConfigCounts(items);
    const stateLabel = extensionMode
        ? t(`tui.config.${selectedItem.enabled ? 'included' : 'ignored'}`)
        : t(`tui.config.${selectedItem.enabled ? 'excluded' : 'scanned'}`);
    const stateColor = selectedItem.enabled ? LOC_TUI_COLORS.success : LOC_TUI_COLORS.warning;
    const impact = extensionMode ? getExtensionImpact(result, selectedItem.name) : null;

    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {
            title: extensionMode ? `.${selectedItem.name}` : selectedItem.name,
            badge: stateLabel,
            badgeColor: stateColor
        }),
        layout.compact
            ? null
            : h(Text, {dimColor: true}, extensionMode
                ? t('tui.config.extensionsDescription')
                : t('tui.config.excludesDescription')),
        h(Box, {flexDirection: 'column', marginTop: layout.compact ? 0 : 1},
            layout.compact
                ? null
                : h(Field, {
                    label: t('tui.config.type'),
                    value: t(`tui.config.${extensionMode ? 'extensionType' : 'excludeType'}`)
                }),
            h(Field, {
                label: t('tui.config.status'),
                value: stateLabel,
                valueColor: stateColor
            }),
            h(Field, {
                label: t('tui.config.coverage'),
                value: t('tui.config.enabledSummary', counts)
            }),
            layout.compact
                ? null
                : h(Field, {
                    label: t('tui.config.match'),
                    value: extensionMode ? `*.${selectedItem.name}` : selectedItem.name,
                    dimColor: true
                })
        ),
        extensionMode && !layout.compact
            ? h(Box, {marginTop: 1}, h(Text, {
                color: impact ? LOC_TUI_COLORS.secondary : LOC_TUI_COLORS.muted,
                dimColor: !impact
            }, impact
                ? t('tui.config.extensionImpact', {
                    files: formatNumber(impact.fileCount),
                    lines: formatNumber(impact.lineCount)
                })
                : t('tui.config.noResultImpact')))
            : null
    );
}

function ResponsivePanels({left, right, layout, showRight = true}) {
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
        showRight
            ? h(Box, {flexDirection: 'column', flexGrow: 1}, right)
            : null
    );
}

function HelpPanel() {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: LOC_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, t('tui.help.title')),
        ...t('tui.help.lines').map(line => h(Text, {key: line}, line))
    );
}

function Header({activeTab, columns}) {
    const headerMetaText = buildHeaderMetaText(activeTab, columns);
    const tabItems = TABS.flatMap((tabKey, index) => [
        index > 0
            ? h(Text, {
                key: `${tabKey}-separator`,
                color: LOC_TUI_COLORS.muted,
                dimColor: true
            }, HEADER_SEPARATOR)
            : null,
        h(Text, {
            key: tabKey,
            bold: tabKey === activeTab,
            color: tabKey === activeTab ? LOC_TUI_COLORS.accent : LOC_TUI_COLORS.muted
        }, buildTabText(tabKey, activeTab))
    ]).filter(Boolean);

    return h(
        Box,
        {},
        h(Box, {}, ...tabItems),
        h(Spacer, {}),
        headerMetaText ? h(Text, {dimColor: true}, headerMetaText) : null
    );
}

function getFooterText(activeTab, inputMode, layout) {
    if (layout.microFooter) {
        if (inputMode) {
            return t('tui.footer.microInput');
        }

        return t(`tui.footer.${activeTab === 'count' ? 'microCount' : 'microConfig'}`);
    }

    if (inputMode) {
        return t('tui.footer.input');
    }

    if (layout.compactFooter) {
        return t(`tui.footer.${activeTab === 'count' ? 'compactCount' : 'compactConfig'}`);
    }

    return t(`tui.footer.${activeTab === 'count' ? 'count' : 'config'}`);
}

export function LocTuiApp({layoutOverride = null, initialTab = 'count', initialResult = null} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const layout = layoutOverride || resolveLocTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'count');
    const [countMenuIndex, setCountMenuIndex] = useState(0);
    const [pagedSelection, setPagedSelection] = useState({
        extensions: createPagedState(0, 0),
        excludes: createPagedState(0, 0)
    });
    const [directoryInput, setDirectoryInput] = useState('');
    const [inputMode, setInputMode] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [result, setResult] = useState(initialResult);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: '',
        label: ''
    });
    const resultTimeoutRef = useRef(null);

    const config = getConfigSummary();
    const extensionItems = Object.entries(config.fileExtensions).map(([name, enabled]) => ({name, enabled}));
    const excludeItems = Object.entries(config.excludeDirectories).map(([name, enabled]) => ({name, enabled}));
    const extensionPage = getPagedItems(
        extensionItems,
        pagedSelection.extensions.selectedIndex,
        layout.pageSize
    );
    const excludePage = getPagedItems(
        excludeItems,
        pagedSelection.excludes.selectedIndex,
        layout.pageSize
    );

    useEffect(() => {
        if (statusState.mode !== 'progress') {
            return undefined;
        }

        const interval = setInterval(() => {
            setSpinnerFrameIndex(currentIndex => (currentIndex + 1) % SPINNER_FRAMES.length);
        }, SPINNER_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [statusState.mode]);

    useEffect(() => () => {
        clearTimeout(resultTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (process.env.SLOTHTOOL_LOC_TUI_TEST_ACTION === 'render-exit') {
            app.exit();
        }
    }, [app]);

    useEffect(() => {
        setPagedSelection(currentSelection => ({
            extensions: createPagedState(
                currentSelection.extensions.selectedIndex,
                extensionItems.length,
                layout.pageSize
            ),
            excludes: createPagedState(
                currentSelection.excludes.selectedIndex,
                excludeItems.length,
                layout.pageSize
            )
        }));
    }, [extensionItems.length, excludeItems.length, layout.pageSize]);

    function clearPendingStatus() {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
    }

    function showResultStatus(tone, message) {
        clearPendingStatus();
        setStatusState({
            mode: 'result',
            tone,
            message,
            label: ''
        });

        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                mode: 'idle',
                tone: 'success',
                message: '',
                label: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    async function runTask(label, task, options = {}) {
        if (statusState.mode === 'progress') {
            return null;
        }

        clearPendingStatus();

        if (options.useSpinner) {
            setSpinnerFrameIndex(0);
            setStatusState({
                mode: 'progress',
                tone: 'success',
                message: '',
                label
            });
        }

        try {
            const taskResult = await task();
            const feedback = options.resolveFeedback?.(taskResult) || {
                tone: 'success',
                message: label
            };
            showResultStatus(feedback.tone, feedback.message);
            return taskResult;
        } catch (error) {
            showResultStatus('error', error.message);
            return null;
        }
    }

    function setActiveTabSafe(tabKey) {
        setInputMode(false);
        setActiveTab(tabKey);
    }

    function performCount(targetDir) {
        const normalizedTarget = normalizeDirectoryInput(targetDir);

        return runTask(t('tui.status.countingLabel'), async () => {
            try {
                await waitForTaskStartRender();
                const nextResult = countTargetDirectory(normalizedTarget, {verbose: true});
                setResult(nextResult);
                return nextResult;
            } catch (error) {
                throw new Error(t('invalidDirectory', {dir: error.message}));
            }
        }, {
            useSpinner: true,
            resolveFeedback(nextResult) {
                return {
                    tone: nextResult.warnings.length > 0 ? 'warn' : 'success',
                    message: t('tui.status.countDone', {dir: nextResult.resolvedDir})
                };
            }
        });
    }

    function resetConfigState() {
        return runTask(t('tui.status.resetLabel'), async () => {
            resetPluginConfig();
            setResult(null);
            return null;
        }, {
            resolveFeedback() {
                return {
                    tone: 'success',
                    message: t('tui.resetDone')
                };
            }
        });
    }

    function toggleCurrentConfigItem() {
        const itemList = activeTab === 'extensions' ? extensionItems : excludeItems;
        const currentIndex = pagedSelection[activeTab].selectedIndex;
        const currentItem = itemList[currentIndex];

        if (!currentItem) {
            return;
        }

        return runTask(t('tui.saved'), async () => {
            if (activeTab === 'extensions') {
                toggleExtension(currentItem.name, !currentItem.enabled);
            } else {
                toggleExcludedDirectory(currentItem.name, !currentItem.enabled);
            }

            setResult(null);
        }, {
            resolveFeedback() {
                return {
                    tone: 'success',
                    message: t('tui.saved')
                };
            }
        });
    }

    useInput((input, key) => {
        if (helpOpen) {
            if (key.escape || input === '?') {
                setHelpOpen(false);
            }
            return;
        }

        if (statusState.mode === 'progress') {
            return;
        }

        if (inputMode) {
            if (key.escape) {
                setInputMode(false);
                return;
            }

            if (key.return) {
                setInputMode(false);
                performCount(directoryInput);
                return;
            }

            if (key.backspace || key.delete) {
                setDirectoryInput(currentValue => currentValue.slice(0, -1));
                return;
            }

            if (input && !key.ctrl && !key.meta) {
                setDirectoryInput(currentValue => currentValue + input);
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

        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            setActiveTabSafe(TABS[(currentIndex + 1) % TABS.length]);
            return;
        }

        if (key.escape) {
            setActiveTabSafe('count');
            return;
        }

        if (key.upArrow || key.downArrow) {
            const delta = key.upArrow ? -1 : 1;

            if (activeTab === 'count') {
                setCountMenuIndex(currentValue => (
                    currentValue + delta + COUNT_MENU_ITEMS.length
                ) % COUNT_MENU_ITEMS.length);
                return;
            }

            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: movePagedSelection(
                    currentSelection[activeTab].selectedIndex,
                    delta,
                    itemCount,
                    layout.pageSize
                )
            }));
            return;
        }

        if ((input === '[' || input === ']') && activeTab !== 'count') {
            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            const delta = input === '[' ? -1 : 1;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: flipPagedPage(
                    currentSelection[activeTab].selectedIndex,
                    delta,
                    itemCount,
                    layout.pageSize
                )
            }));
            return;
        }

        if (input === ' ' && activeTab !== 'count') {
            toggleCurrentConfigItem();
            return;
        }

        if (!key.return || activeTab !== 'count') {
            return;
        }

        const selectedItem = COUNT_MENU_ITEMS[countMenuIndex];

        if (selectedItem === 'current') {
            performCount(process.cwd());
            return;
        }

        if (selectedItem === 'custom') {
            setDirectoryInput('');
            setInputMode(true);
            return;
        }

        if (selectedItem === 'reset') {
            resetConfigState();
            return;
        }

        if (selectedItem === 'exit') {
            app.exit();
        }
    });

    const activeItems = activeTab === 'extensions' ? extensionItems : excludeItems;
    const activePage = activeTab === 'extensions' ? extensionPage : excludePage;
    const selectedGlobalIndex = activeTab === 'count' ? 0 : pagedSelection[activeTab].selectedIndex;
    const selectedConfigItem = activeItems[selectedGlobalIndex] || null;
    const localSelectedIndex = selectedGlobalIndex - activePage.startIndex;

    if (layout.tooSmall) {
        return h(
            Box,
            {
                flexDirection: 'column',
                height: layout.viewportHeight,
                paddingX: 1,
                paddingY: 1
            },
            h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, 'loc'),
            h(Text, {bold: true, color: LOC_TUI_COLORS.warning}, t('tui.tooSmall')),
            h(Text, {dimColor: true}, t('tui.tooSmallDetail')),
            h(Spacer, {}),
            h(Text, {dimColor: true}, 'q')
        );
    }

    let mainContent;

    if (helpOpen) {
        mainContent = h(HelpPanel);
    } else if (activeTab === 'count') {
        const leftPane = inputMode
            ? h(DirectoryInputPanel, {value: directoryInput})
            : h(CountActionPanel, {
                selectedIndex: countMenuIndex,
                result,
                layout
            });
        const rightPane = h(CountResultPanel, {
            result,
            extensionItems,
            excludeItems,
            layout
        });

        mainContent = h(ResponsivePanels, {
            left: leftPane,
            right: rightPane,
            layout,
            showRight: !layout.short
        });
    } else {
        const leftPane = h(ToggleListPanel, {
            activeTab,
            items: activeItems,
            page: activePage,
            localSelectedIndex,
            layout
        });
        const rightPane = h(ConfigDetailPanel, {
            activeTab,
            selectedItem: selectedConfigItem,
            items: activeItems,
            result,
            layout
        });

        mainContent = h(ResponsivePanels, {
            left: leftPane,
            right: rightPane,
            layout,
            showRight: layout.showConfigDetail
        });
    }

    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.mode === 'result'
            ? statusState.message
            : t('tui.status.ready');
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone);
    const footerText = getFooterText(activeTab, inputMode, layout);

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
            color: LOC_TUI_COLORS.muted,
            dimColor: true
        }, '─'.repeat(layout.contentWidth))),
        h(Box, {flexGrow: 1, marginBottom: 1, flexDirection: 'column'}, mainContent),
        h(
            Box,
            {},
            h(Text, {color: statusColor}, truncateFromRight(statusText, Math.max(12, Math.floor(layout.contentWidth * 0.42)))),
            h(Spacer, {}),
            h(Text, {dimColor: true, wrap: 'truncate-end'}, footerText)
        )
    );
}

export async function startLocTui() {
    if (process.env.SLOTHTOOL_LOC_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(LocTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
}
