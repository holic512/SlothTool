/**
 * @file LocPluginTui
 * @project SlothTool
 * @module LOC Plugin / TUI
 * @description 提供面向代码规模体检、热点定位和过滤规则调整的响应式 loc 全屏 Ink 界面。
 * @logic 按共享外壳预算渲染底栏和可重排详情；1. 统计页以操作区和扩展名/热点洞察呈现扫描结果；2. 配置页以规则列表和选中项影响详情呈现；3. 根据终端宽高切换双栏、堆叠、动态分页和精简明细。
 * @dependencies Libraries: react/ink, Services: ./service.js, Model: ./tui-model.js, I18N: ./i18n.js, Pagination: ./pagination.js
 * @index_tags loc TUI, 代码规模体检, 热点文件, 过滤规则, 响应式布局, 高对比配色
 * @author holic512
 */

import React, {useEffect, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {editText, editorViewport, nextTabIndex, statusSymbol, wrapText} from './shared-interaction.js';
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

import {TuiFrame, TuiHeader, TuiDetails, TuiRow} from './shared-layout.js';
import {getShellLayout, getDetailWindow} from './shared-interaction.js';

const h = React.createElement;
const TABS = ['count', 'extensions', 'excludes'];
const COUNT_MENU_ITEMS = ['current', 'custom', 'reset', 'exit'];
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

function PanelHeader({title, summary, badge, width = 60, badgeColor = LOC_TUI_COLORS.accent}) {
    if (summary) return h(TuiRow, {left: title, right: summary, width, color: LOC_TUI_COLORS.accent, rightColor: 'gray', bold: true});
    return h(Text, {wrap: 'truncate-end'}, h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, title),
        badge ? h(Text, {bold: true, color: badgeColor}, `  [${badge}]`) : null);
}

function Field({label, value, valueColor, dimColor = false}) {
    return h(Text, {wrap: 'truncate-end'}, h(Text, {color: LOC_TUI_COLORS.accent}, `${label}  `),
        h(Text, {color: valueColor, dimColor}, String(value || '-')));
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
            width: (layout.compact ? layout.contentWidth : layout.sidebarWidth) - 4,
            summary: `${selectedIndex + 1}/${COUNT_MENU_ITEMS.length}`
        }),
        ...COUNT_MENU_ITEMS.map((item, index) => {
            const selected = index === selectedIndex;
            const badgeColor = item === 'exit'
                ? LOC_TUI_COLORS.danger
                : item === 'reset'
                    ? LOC_TUI_COLORS.warning
                    : LOC_TUI_COLORS.secondary;

            return h(TuiRow, {key: item, width: (layout.compact ? layout.contentWidth : layout.sidebarWidth) - 4,
                left: `${selected ? '› ' : '  '}${t(`tui.menu.${item}`)}`, right: t(`tui.menuBadges.${item}`),
                bold: selected, color: selected ? LOC_TUI_COLORS.accent : 'white', rightColor: badgeColor});
        }),
        layout?.short
            ? compactInsights
                ? h(MetricStrip, {insights: compactInsights, layout})
                : h(Text, {dimColor: true}, t('tui.result.emptyTitle'))
            : null
    );
}

function DirectoryInputPanel({value, cursor, width, error}) {
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
        h(Box, {marginTop: 1, flexShrink: 0}, h(Text, {bold: true, color: LOC_TUI_COLORS.accent}, `› ${editorViewport(value, cursor, width)}`)),
        error ? h(Text, {color: LOC_TUI_COLORS.danger}, truncateFromRight(error, width)) : null,
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

    return h(Text, {wrap: 'truncate-end'}, ...metrics.flatMap(([label, value, color], index) => [
        index ? h(Text, {key: label + '-separator', dimColor: true}, ' | ') : null,
        h(Text, {key: label, color}, `${label} ${value}`)
    ]));
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
        h(PanelHeader, {title, summary, width: (layout.compact ? layout.contentWidth : layout.sidebarWidth) - 4}),
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


function Header({activeTab, columns}) {
    return h(TuiHeader, {tabs: TABS.map(id => ({id, label: t(`tui.tabs.${id}`)})), activeTab,
        width: columns - 2, meta: buildHeaderMetaText(activeTab, columns)});
}

function getFooterText(activeTab, inputMode, layout, action) {
    if (layout.microFooter) {
        if (inputMode) {
            return t('tui.footer.microInput');
        }

        return t(`tui.footer.${activeTab === 'count' ? 'microCount' : 'microConfig'}`, {action});
    }

    if (inputMode) {
        return t('tui.footer.input');
    }

    if (layout.compactFooter) {
        return t(`tui.footer.${activeTab === 'count' ? 'compactCount' : 'compactConfig'}`, {action});
    }

    return t(`tui.footer.${activeTab === 'count' ? 'count' : 'config'}`, {action});
}

export function LocTuiApp({layoutOverride = null, initialTab = 'count', initialResult = null} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const baseLayout = layoutOverride || resolveLocTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'count');
    const [countMenuIndex, setCountMenuIndex] = useState(0);
    const [pagedSelection, setPagedSelection] = useState({
        extensions: createPagedState(0, 0),
        excludes: createPagedState(0, 0)
    });
    const [directoryInput, setDirectoryInput] = useState('');
    const [directoryCursor, setDirectoryCursor] = useState(0);
    const [directoryError, setDirectoryError] = useState('');
    const [inputMode, setInputMode] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [detailLines, setDetailLines] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);
    const [result, setResult] = useState(initialResult);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: '',
        label: ''
    });

    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.mode === 'result'
            ? statusState.message
            : t('tui.status.ready');
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone);
    const footerText = statusState.mode === 'progress' ? t('tui.footer.busy')
        : detailLines ? t('tui.footer.detail') : helpOpen ? t('tui.footer.help')
            : getFooterText(activeTab, inputMode, baseLayout, t('tui.menu.' + COUNT_MENU_ITEMS[countMenuIndex]));

    const shell = getShellLayout(baseLayout.columns, baseLayout.rows, {
        status: `${statusSymbol(statusState.mode, statusState.tone)} ${statusText}`, keys: footerText
    });
    const layout = {...baseLayout, contentWidth: shell.contentWidth, contentHeight: shell.contentHeight};
    const detailWindow = getDetailWindow(detailLines || (helpOpen ? t('tui.help.lines') : []), detailScroll, shell.contentWidth, shell.contentHeight);
    layout.pageSize = Math.min(layout.pageSize, Math.max(1, shell.contentHeight - (layout.compact && layout.showConfigDetail ? 9 : 3)));

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

    function showResultStatus(tone, message) {
        setStatusState({
            mode: 'result',
            tone,
            message,
            label: ''
        });
    }

    async function runTask(label, task, options = {}) {
        if (statusState.mode === 'progress') {
            return null;
        }

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
        setDirectoryError('');

        return runTask(t('tui.status.countingLabel'), async () => {
            try {
                await waitForTaskStartRender();
                const nextResult = countTargetDirectory(normalizedTarget, {verbose: true});
                setResult(nextResult);
                return nextResult;
            } catch (error) {
                const message = t('invalidDirectory', {dir: error.message});
                setDirectoryError(message);
                throw new Error(message);
            }
        }, {
            useSpinner: true,
            resolveFeedback(nextResult) {
                return {
                    tone: nextResult.warnings.length > 0 ? 'warn' : 'success',
                    message: t('tui.status.countDone', {dir: nextResult.resolvedDir})
                };
            }
        }).then(value => {
            if (value) setInputMode(false);
            return value;
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
            if (key.escape || input === '?') {
                setHelpOpen(false);
            }
            if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, Math.min(value, detailWindow.maxScroll) - (key.pageUp ? detailWindow.capacity : 1)));
            if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(detailWindow.maxScroll, value + (key.pageDown ? detailWindow.capacity : 1)));
            return;
        }

        if (inputMode) {
            if (key.escape) {
                setInputMode(false);
                setDirectoryError('');
                return;
            }

            if (key.return) {
                performCount(directoryInput);
                return;
            }

            const next = editText({value: directoryInput, cursor: directoryCursor}, input, key);
            setDirectoryInput(next.value);
            setDirectoryCursor(next.cursor);
            setDirectoryError('');
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
            setDetailScroll(0);
            return;
        }

        if (input === 'v') {
            const lines = [statusState.message || t('tui.status.ready')];
            if (activeTab === 'count') {
                lines.push(`${t('tui.result.target')}: ${result?.resolvedDir || process.cwd()}`,
                    ...(result?.warnings || []), ...(result?.files || []).map(file => `${file.path}: ${file.lines}`));
            } else if (selectedConfigItem) lines.push(selectedConfigItem.name);
            setDetailLines(lines);
            setDetailScroll(0);
            return;
        }

        if (input.toLowerCase() === 'q') {
            app.exit();
            return;
        }

        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            setActiveTabSafe(TABS[nextTabIndex(currentIndex, TABS.length, key)]);
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
            setDirectoryCursor(0);
            setDirectoryError('');
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

    usePaste(value => {
        if (!inputMode || statusState.mode === 'progress') return;
        const next = editText({value: directoryInput, cursor: directoryCursor}, value);
        setDirectoryInput(next.value);
        setDirectoryCursor(next.cursor);
        setDirectoryError('');
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

    if (detailLines) {
        mainContent = h(TuiDetails, {title: t('tui.help.title'), lines: detailLines, scroll: detailScroll, width: shell.contentWidth, height: shell.contentHeight});
    } else if (helpOpen) {
        mainContent = h(TuiDetails, {title: t('tui.help.title'), lines: t('tui.help.lines'), scroll: detailScroll, width: shell.contentWidth, height: shell.contentHeight});
    } else if (activeTab === 'count') {
        const leftPane = inputMode
            ? h(DirectoryInputPanel, {value: directoryInput, cursor: directoryCursor, error: directoryError,
                width: Math.max(4, (layout.compact ? layout.contentWidth : layout.sidebarWidth) - 7)})
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


    return h(TuiFrame, {layout: shell, statusColor: resolveStatusColor(statusState.mode, statusState.tone),
        header: h(Header, {activeTab, columns: layout.columns})}, mainContent);
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
