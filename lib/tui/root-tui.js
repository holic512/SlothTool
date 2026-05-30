/**
 * @file SlothToolRootTui
 * @project SlothTool
 * @module Core CLI / TUI
 * @description 提供 SlothTool 默认全屏 Ink 界面，负责页面导航、状态展示和高层交互调度。
 * @logic 1. 使用 alternateScreen 渲染独立全屏页面；2. 通过键盘状态机在页面间切换；3. 退出时返回结构化动作给 CLI 入口继续处理。
 * @dependencies Libraries: react/ink, Services: ../services/plugin-service.js, Settings: ../settings.js, I18N: ../i18n.js
 * @index_tags 根TUI, Ink, 全屏界面, 页面导航, 默认入口
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import rootPackage from '../../package.json' with {type: 'json'};
import settings from '../settings.js';
import {t} from '../i18n.js';
import {
    getOfficialPlugins,
    installPlugin,
    listInstalledPlugins,
    uninstallAllData,
    uninstallPlugin,
    updateAllPlugins,
    updatePlugin,
    updateSelf
} from '../services/plugin-service.js';

const h = React.createElement;
const TAB_ORDER = ['home', 'install', 'plugins', 'run', 'settings', 'danger'];
const RESULT_DISPLAY_MS = 1600;
const SELF_RESTART_DELAY_MS = 700;
const SPINNER_INTERVAL_MS = 120;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];
const HOME_ART = [
    '   _____ __      ____  __  __ _______ ____  ____  __ ',
    '  / ___// /___  / __ \\/ / / //_  __// __ \\/ __ \\/ / ',
    '  \\__ \\/ // _ \\/ / / / /_/ /  / /  / / / / / / / /  ',
    ' ___/ / //  __/ /_/ / __  /  / /  / /_/ / /_/ / /___',
    '/____/_/ \\___/\\____/_/ /_/  /_/   \\____/\\____/_____/'
];

function getContentWidth() {
    return Math.max(24, (process.stdout.columns || 80) - 4);
}

function buildDividerLine() {
    return '─'.repeat(getContentWidth());
}

function getDisplayWidth(text) {
    return Array.from(text).reduce((width, character) => (
        width + (character.codePointAt(0) > 0xFF ? 2 : 1)
    ), 0);
}

function truncateFromLeft(text, maxWidth) {
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(text) <= maxWidth) {
        return text;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(text).reverse()) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result = `${character}${result}`;
        width += characterWidth;
    }

    return `${ellipsis}${result}`;
}

function buildTabText(tabKey, currentTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === currentTab ? `[${label}]` : label;
}

function buildHeaderMetaText(currentTab) {
    const versionText = `v${rootPackage.version}`;
    const tabStripText = TAB_ORDER.map(tabKey => buildTabText(tabKey, currentTab)).join('  ');
    const availableWidth = Math.max(0, getContentWidth() - getDisplayWidth(tabStripText) - 2);

    if (availableWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(versionText) >= availableWidth) {
        return truncateFromLeft(versionText, availableWidth);
    }

    const pathWidth = availableWidth - getDisplayWidth(versionText) - 2;
    const pathText = truncateFromLeft(process.cwd(), pathWidth);
    return pathText ? `${versionText}  ${pathText}` : versionText;
}

function createReporterCollector() {
    let feedback = null;

    return {
        reporter(event) {
            if (event.level === 'success' || event.level === 'warn' || event.level === 'error') {
                feedback = {
                    tone: event.level,
                    message: event.message
                };
            }
        },
        getFeedback() {
            return feedback;
        }
    };
}

function buildInstallItems(language) {
    const installedAliases = new Set(listInstalledPlugins().map(plugin => plugin.alias));
    return getOfficialPlugins()
        .filter(plugin => !installedAliases.has(plugin.alias))
        .map(plugin => ({
            id: plugin.alias,
            title: plugin.alias,
            description: language === 'zh' ? plugin.description : plugin.descriptionEn,
            detail: (language === 'zh' ? plugin.features : plugin.featuresEn).join(', ')
        }));
}

function buildPluginItems() {
    return listInstalledPlugins().map(plugin => ({
        id: plugin.alias,
        title: plugin.alias,
        description: `${plugin.displayName} v${plugin.version}`,
        detail: plugin.sourceLabel
    }));
}

function buildSettingItems(language) {
    return [
        {
            id: 'zh',
            title: '中文 (Chinese)',
            description: language === 'zh' ? t('tui.settings.currentLanguage') : t('tui.settings.switchToChinese'),
            detail: 'zh'
        },
        {
            id: 'en',
            title: 'English',
            description: language === 'en' ? t('tui.settings.currentLanguage') : t('tui.settings.switchToEnglish'),
            detail: 'en'
        }
    ];
}

function buildDangerItems() {
    return [
        {
            id: 'self-update',
            title: t('tui.actions.selfUpdate'),
            description: '@holic512/slothtool',
            detail: 'npm install -g'
        },
        {
            id: 'uninstall-all',
            title: t('tui.actions.uninstallAll'),
            description: '~/.slothtool',
            detail: t('tui.danger.dataOnly')
        }
    ];
}

function countItemsForTab(tabKey, language) {
    if (tabKey === 'install') {
        return buildInstallItems(language).length;
    }

    if (tabKey === 'plugins' || tabKey === 'run') {
        return buildPluginItems().length;
    }

    if (tabKey === 'settings') {
        return buildSettingItems(language).length;
    }

    if (tabKey === 'danger') {
        return buildDangerItems().length;
    }

    return 1;
}

function resolveStatusColor(mode, tone, hasConfirmAction) {
    if (hasConfirmAction) {
        return 'yellow';
    }

    if (mode === 'progress') {
        return 'cyan';
    }

    if (mode === 'result') {
        if (tone === 'error') {
            return 'red';
        }

        if (tone === 'warn') {
            return 'yellow';
        }

        return 'green';
    }

    return 'green';
}

function SelectionList({items, selectedIndex, emptyMessage}) {
    if (items.length === 0) {
        return h(
            Box,
            {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
            h(Text, {dimColor: true}, emptyMessage)
        );
    }

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        ...items.map((item, index) =>
            h(
                Box,
                {key: item.id, marginBottom: index === items.length - 1 ? 0 : 1},
                h(Text, {color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} ${item.title}`),
                h(Text, {dimColor: true}, `  ${item.description}`)
            )
        )
    );
}

function DetailPanel({title, description, detail}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, title),
        h(Text, {dimColor: true}, description || t('tui.noDescription')),
        h(Box, {marginTop: 1}, h(Text, {}, detail || t('tui.noDescription')))
    );
}

function RootTuiApp({onExit}) {
    const app = useApp();
    const [tabIndex, setTabIndex] = useState(0);
    const [selection, setSelection] = useState({
        install: 0,
        plugins: 0,
        run: 0,
        settings: 0,
        danger: 0
    });
    const [confirmAction, setConfirmAction] = useState(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: '',
        label: ''
    });
    const resultTimeoutRef = useRef(null);
    const restartTimeoutRef = useRef(null);

    const currentTab = TAB_ORDER[tabIndex];
    const language = settings.getLanguage();
    const installItems = buildInstallItems(language);
    const pluginItems = buildPluginItems();
    const settingsItems = buildSettingItems(language);
    const dangerItems = buildDangerItems();

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
        clearTimeout(restartTimeoutRef.current);
    }, []);

    function requestExit(action = {type: 'exit'}) {
        onExit(action);
        app.exit();
    }

    function clearPendingStatusTransitions() {
        clearTimeout(resultTimeoutRef.current);
        clearTimeout(restartTimeoutRef.current);
        resultTimeoutRef.current = null;
        restartTimeoutRef.current = null;
    }

    function showResultStatus(tone, message, options = {}) {
        clearPendingStatusTransitions();
        setStatusState({
            mode: 'result',
            tone,
            message,
            label: ''
        });

        if (options.restartOnSuccess) {
            restartTimeoutRef.current = setTimeout(() => {
                requestExit({type: 'restart-self'});
            }, SELF_RESTART_DELAY_MS);
            return;
        }

        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                mode: 'idle',
                tone: 'success',
                message: '',
                label: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    function moveSelection(delta) {
        const itemCount = countItemsForTab(currentTab, language);
        if (itemCount <= 0 || currentTab === 'home') {
            return;
        }

        setSelection(currentSelection => {
            const currentValue = currentSelection[currentTab] || 0;
            const nextValue = (currentValue + delta + itemCount) % itemCount;
            return {
                ...currentSelection,
                [currentTab]: nextValue
            };
        });
    }

    async function runTask(label, task, options = {}) {
        if (statusState.mode === 'progress') {
            return;
        }

        clearPendingStatusTransitions();
        setSpinnerFrameIndex(0);
        setStatusState({
            mode: 'progress',
            tone: 'success',
            message: '',
            label
        });

        const collector = createReporterCollector();

        try {
            const result = await task(collector.reporter);
            const feedback = options.resolveFeedback?.(result, collector.getFeedback()) || collector.getFeedback() || {
                tone: 'success',
                message: label
            };
            showResultStatus(feedback.tone, feedback.message, {
                restartOnSuccess: options.restartOnSuccess
            });
            return result;
        } catch (error) {
            showResultStatus('error', error.message);
            return null;
        }
    }

    function currentInstallItem() {
        return installItems[selection.install] || null;
    }

    function currentPluginItem() {
        return pluginItems[selection.plugins] || null;
    }

    function currentRunItem() {
        return pluginItems[selection.run] || null;
    }

    function currentSettingItem() {
        return settingsItems[selection.settings] || null;
    }

    function currentDangerItem() {
        return dangerItems[selection.danger] || null;
    }

    function executeEnter() {
        if (currentTab === 'home') {
            setTabIndex(1);
            return;
        }

        if (currentTab === 'install') {
            const item = currentInstallItem();
            if (!item) {
                return;
            }

            runTask(item.title, reporter => installPlugin(item.id, {reporter}));
            return;
        }

        if (currentTab === 'plugins') {
            const item = currentPluginItem();
            if (!item) {
                return;
            }

            runTask(item.title, reporter => updatePlugin(item.id, {reporter}));
            return;
        }

        if (currentTab === 'run') {
            const item = currentRunItem();
            if (!item) {
                return;
            }

            requestExit({
                type: 'run-plugin',
                alias: item.id,
                args: []
            });
            return;
        }

        if (currentTab === 'settings') {
            const item = currentSettingItem();
            if (!item) {
                return;
            }

            settings.setLanguage(item.id);
            showResultStatus('success', t('cli.languageSet', {language: item.id}));
            return;
        }

        if (currentTab === 'danger') {
            const item = currentDangerItem();
            if (!item) {
                return;
            }

            setConfirmAction(item);
        }
    }

    function executeConfirm(item) {
        setConfirmAction(null);

        if (!item) {
            return;
        }

        if (typeof item.execute === 'function') {
            runTask(item.title, reporter => item.execute(reporter));
            return;
        }

        if (item.id === 'self-update') {
            runTask(item.title, reporter => Promise.resolve(updateSelf({reporter})), {
                restartOnSuccess: true
            });
            return;
        }

        if (item.id === 'uninstall-all') {
            runTask(item.title, reporter => Promise.resolve(uninstallAllData({reporter})), {
                resolveFeedback(result, feedback) {
                    if (result?.removed) {
                        return feedback || {
                            tone: 'success',
                            message: t('uninstallAll.success')
                        };
                    }

                    return {
                        tone: 'warn',
                        message: t('uninstallAll.alreadyClean')
                    };
                }
            });
        }
    }

    useInput((input, key) => {
        if (confirmAction) {
            if (key.escape) {
                setConfirmAction(null);
                return;
            }

            if (input.toLowerCase() === 'y') {
                executeConfirm(confirmAction);
                return;
            }

            setConfirmAction(null);
            return;
        }

        if (helpOpen) {
            if (key.escape || input === '?') {
                setHelpOpen(false);
            }
            return;
        }

        if (statusState.mode === 'progress') {
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
            return;
        }

        if (input.toLowerCase() === 'q') {
            requestExit();
            return;
        }

        if (key.tab) {
            setTabIndex(currentIndex => (currentIndex + 1) % TAB_ORDER.length);
            return;
        }

        if (key.escape) {
            setTabIndex(0);
            return;
        }

        if (key.upArrow) {
            moveSelection(-1);
            return;
        }

        if (key.downArrow) {
            moveSelection(1);
            return;
        }

        if (key.return) {
            executeEnter();
            return;
        }

        if (currentTab === 'plugins' && input.toLowerCase() === 'u') {
            const item = currentPluginItem();
            if (item) {
                setConfirmAction({
                    id: `uninstall:${item.id}`,
                    title: t('tui.actions.uninstallPlugin', {alias: item.id}),
                    execute: reporter => uninstallPlugin(item.id, {reporter})
                });
            }
            return;
        }

        if (currentTab === 'plugins' && input.toLowerCase() === 'p') {
            const item = currentPluginItem();
            if (item) {
                runTask(item.title, reporter => updatePlugin(item.id, {reporter}));
            }
            return;
        }

        if (currentTab === 'plugins' && input.toLowerCase() === 'a') {
            runTask(t('tui.actions.updateAll'), reporter => updateAllPlugins({reporter}), {
                resolveFeedback(result) {
                    if (!result || result.total === 0) {
                        return {
                            tone: 'warn',
                            message: t('tui.plugins.empty')
                        };
                    }

                    return {
                        tone: result.failed > 0 ? 'warn' : 'success',
                        message: t('update.allSummary', result)
                    };
                }
            });
        }
    });

    let content = h(Box, {}, h(Text, {}, ''));

    if (currentTab === 'home') {
        content = h(
            Box,
            {flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1},
            h(Text, {color: 'gray'}, t('tui.home.eyebrow')),
            ...HOME_ART.map(line => h(Text, {key: line, color: 'magenta', bold: true}, line)),
            h(Box, {marginTop: 1}, h(Text, {dimColor: true}, t('tui.home.prompt')))
        );
    }

    if (currentTab === 'install') {
        const item = currentInstallItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: installItems,
                    selectedIndex: selection.install,
                    emptyMessage: t('tui.install.empty')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.install'),
                    description: item?.description || t('tui.install.action'),
                    detail: item?.detail || t('tui.install.action')
                })
            )
        );
    }

    if (currentTab === 'plugins') {
        const item = currentPluginItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: pluginItems,
                    selectedIndex: selection.plugins,
                    emptyMessage: t('tui.plugins.empty')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.plugins'),
                    description: item?.description || t('tui.plugins.action'),
                    detail: item?.detail || t('tui.plugins.action')
                })
            )
        );
    }

    if (currentTab === 'run') {
        const item = currentRunItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: pluginItems,
                    selectedIndex: selection.run,
                    emptyMessage: t('tui.run.empty')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.run'),
                    description: item?.description || t('tui.run.action'),
                    detail: item?.detail || t('tui.run.action')
                })
            )
        );
    }

    if (currentTab === 'settings') {
        const item = currentSettingItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: settingsItems,
                    selectedIndex: selection.settings,
                    emptyMessage: t('tui.tabs.settings')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.settings'),
                    description: item?.description || t('tui.settings.action'),
                    detail: item?.detail || t('tui.settings.action')
                })
            )
        );
    }

    if (currentTab === 'danger') {
        const item = currentDangerItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: dangerItems,
                    selectedIndex: selection.danger,
                    emptyMessage: t('tui.tabs.danger')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.danger'),
                    description: item?.description || t('tui.danger.action'),
                    detail: item?.detail || t('tui.danger.action')
                })
            )
        );
    }

    const confirmText = confirmAction
        ? t('tui.status.confirm', {label: confirmAction.title})
        : statusState.mode === 'progress'
            ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
            : statusState.mode === 'result'
                ? statusState.message
                : t('tui.status.ready');
    const dividerLine = buildDividerLine();
    const headerMetaText = buildHeaderMetaText(currentTab);
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone, Boolean(confirmAction));

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(
            Box,
            {marginBottom: 1},
            h(
                Box,
                {},
                ...TAB_ORDER.map(tabKey =>
                    h(
                        Box,
                        {key: tabKey, marginRight: 2},
                        h(Text, {color: tabKey === currentTab ? 'cyan' : 'gray'}, buildTabText(tabKey, currentTab))
                    )
                )
            ),
            h(Spacer, {}),
            headerMetaText
                ? h(Text, {dimColor: true}, headerMetaText)
                : null
        ),
        h(Box, {marginBottom: 1}, h(Text, {color: 'gray'}, dividerLine)),
        h(Box, {flexGrow: 1, marginBottom: 1}, content),
        h(
            Box,
            {marginTop: 1},
            h(Text, {color: statusColor}, confirmText),
            h(Spacer, {}),
            h(Text, {dimColor: true}, t('tui.footer.help'))
        ),
        helpOpen
            ? h(
                Box,
                {borderStyle: 'round', paddingX: 1, paddingY: 1, marginTop: 1, flexDirection: 'column'},
                h(Text, {bold: true}, t('tui.help.title')),
                ...t('tui.help.lines').map(line => h(Text, {key: line}, line))
            )
            : null
    );
}

export async function startRootTui() {
    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'exit') {
        return {type: 'exit'};
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'restart-self') {
        return {type: 'restart-self'};
    }

    let exitAction = {type: 'exit'};

    const ink = render(
        h(RootTuiApp, {
            onExit(action) {
                exitAction = action;
            }
        }),
        {
            alternateScreen: true,
            exitOnCtrlC: true
        }
    );

    await ink.waitUntilExit();
    return exitAction;
}
