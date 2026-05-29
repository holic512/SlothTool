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

import React, {useState} from 'react';
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
const HOME_ART = [
    '   _____ __      ____  __  __ _______ ____  ____  __ ',
    '  / ___// /___  / __ \\/ / / //_  __// __ \\/ __ \\/ / ',
    '  \\__ \\/ // _ \\/ / / / /_/ /  / /  / / / / / / / /  ',
    ' ___/ / //  __/ /_/ / __  /  / /  / /_/ / /_/ / /___',
    '/____/_/ \\___/\\____/_/ /_/  /_/   \\____/\\____/_____/'
];

function createLog(level, message) {
    return {level, message};
}

function appendLog(setLogs, level, message) {
    setLogs(currentLogs => [...currentLogs.slice(-5), createLog(level, message)]);
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
            description: language === 'zh' ? '当前语言' : 'Switch to Chinese',
            detail: 'zh'
        },
        {
            id: 'en',
            title: 'English',
            description: language === 'en' ? 'Current language' : 'Switch to English',
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
            detail: 'rm data only'
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

function LogsPanel({logs}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', minHeight: 8},
        h(Text, {bold: true}, t('tui.logs')),
        ...logs.map((log, index) =>
            h(Text, {
                key: `${index}-${log.message}`,
                color: log.level === 'error' ? 'red' : log.level === 'success' ? 'green' : log.level === 'warn' ? 'yellow' : undefined
            }, log.message)
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
    const [busyLabel, setBusyLabel] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [logs, setLogs] = useState([
        createLog('info', t('tui.home.tip'))
    ]);

    const currentTab = TAB_ORDER[tabIndex];
    const language = settings.getLanguage();
    const installItems = buildInstallItems(language);
    const pluginItems = buildPluginItems();
    const settingsItems = buildSettingItems(language);
    const dangerItems = buildDangerItems();

    function requestExit(action = {type: 'exit'}) {
        onExit(action);
        app.exit();
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

    function runTask(label, task) {
        if (busyLabel) {
            return;
        }

        setBusyLabel(label);
        Promise.resolve()
            .then(task)
            .catch(error => {
                appendLog(setLogs, 'error', error.message);
            })
            .finally(() => {
                setBusyLabel('');
            });
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

            runTask(item.title, async () => {
                await installPlugin(item.id, {
                    reporter: event => appendLog(setLogs, event.level, event.message)
                });
            });
            return;
        }

        if (currentTab === 'plugins') {
            const item = currentPluginItem();
            if (!item) {
                return;
            }

            runTask(item.title, async () => {
                await updatePlugin(item.id, {
                    reporter: event => appendLog(setLogs, event.level, event.message)
                });
            });
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
            appendLog(setLogs, 'success', t('cli.languageSet', {language: item.id}));
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
            runTask(item.title, async () => {
                await item.execute();
            });
            return;
        }

        if (item.id === 'self-update') {
            runTask(item.title, async () => {
                updateSelf({
                    reporter: event => appendLog(setLogs, event.level, event.message)
                });
            });
            return;
        }

        if (item.id === 'uninstall-all') {
            runTask(item.title, async () => {
                uninstallAllData({
                    reporter: event => appendLog(setLogs, event.level, event.message)
                });
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

        if (busyLabel) {
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
                    title: `Uninstall ${item.id}`,
                    execute: () => uninstallPlugin(item.id, {
                        reporter: event => appendLog(setLogs, event.level, event.message)
                    })
                });
            }
            return;
        }

        if (currentTab === 'plugins' && input.toLowerCase() === 'p') {
            const item = currentPluginItem();
            if (item) {
                runTask(item.title, async () => {
                    await updatePlugin(item.id, {
                        reporter: event => appendLog(setLogs, event.level, event.message)
                    });
                });
            }
            return;
        }

        if (currentTab === 'plugins' && input.toLowerCase() === 'a') {
            runTask(t('tui.actions.updateAll'), async () => {
                await updateAllPlugins({
                    reporter: event => appendLog(setLogs, event.level, event.message)
                });
            });
        }
    });

    let leftPane = h(Box, {}, h(Text, {}, ''));
    let rightPane = h(Box, {}, h(Text, {}, ''));

    if (currentTab === 'home') {
        leftPane = h(
            Box,
            {flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1},
            h(Text, {color: 'gray'}, t('tui.home.eyebrow')),
            ...HOME_ART.map(line => h(Text, {key: line, color: 'cyan'}, line)),
            h(Box, {marginTop: 1}, h(Text, {}, t('tui.home.lead'))),
            h(Text, {dimColor: true}, t('tui.home.prompt')),
            h(Box, {marginTop: 1}, h(Text, {color: 'yellow'}, t('tui.home.tip')))
        );

        rightPane = h(LogsPanel, {logs});
    }

    if (currentTab === 'install') {
        const item = currentInstallItem();
        leftPane = h(SelectionList, {
            items: installItems,
            selectedIndex: selection.install,
            emptyMessage: t('tui.install.empty')
        });
        rightPane = h(DetailPanel, {
            title: item?.title || t('tui.tabs.install'),
            description: item?.description || t('tui.install.action'),
            detail: item?.detail || t('tui.install.action')
        });
    }

    if (currentTab === 'plugins') {
        const item = currentPluginItem();
        leftPane = h(SelectionList, {
            items: pluginItems,
            selectedIndex: selection.plugins,
            emptyMessage: t('tui.plugins.empty')
        });
        rightPane = h(DetailPanel, {
            title: item?.title || t('tui.tabs.plugins'),
            description: item?.description || t('tui.plugins.action'),
            detail: item?.detail || t('tui.plugins.action')
        });
    }

    if (currentTab === 'run') {
        const item = currentRunItem();
        leftPane = h(SelectionList, {
            items: pluginItems,
            selectedIndex: selection.run,
            emptyMessage: t('tui.run.empty')
        });
        rightPane = h(DetailPanel, {
            title: item?.title || t('tui.tabs.run'),
            description: item?.description || t('tui.run.action'),
            detail: item?.detail || t('tui.run.action')
        });
    }

    if (currentTab === 'settings') {
        const item = currentSettingItem();
        leftPane = h(SelectionList, {
            items: settingsItems,
            selectedIndex: selection.settings,
            emptyMessage: t('tui.tabs.settings')
        });
        rightPane = h(DetailPanel, {
            title: item?.title || t('tui.tabs.settings'),
            description: item?.description || t('tui.settings.action'),
            detail: item?.detail || t('tui.settings.action')
        });
    }

    if (currentTab === 'danger') {
        const item = currentDangerItem();
        leftPane = h(SelectionList, {
            items: dangerItems,
            selectedIndex: selection.danger,
            emptyMessage: t('tui.tabs.danger')
        });
        rightPane = h(DetailPanel, {
            title: item?.title || t('tui.tabs.danger'),
            description: item?.description || t('tui.danger.action'),
            detail: item?.detail || t('tui.danger.action')
        });
    }

    const statusLabel = busyLabel
        ? `${t('tui.status.busy')}: ${busyLabel}`
        : t('tui.status.ready');

    const confirmText = confirmAction
        ? t('tui.status.confirm', {label: confirmAction.title})
        : statusLabel;

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(
            Box,
            {marginBottom: 1},
            h(Box, {flexDirection: 'column'},
                h(Text, {bold: true}, t('tui.title')),
                h(Text, {dimColor: true}, t('tui.subtitle'))
            ),
            h(Spacer, {}),
            h(Box, {flexDirection: 'column', alignItems: 'flex-end'},
                h(Text, {color: 'gray'}, `v${rootPackage.version}`),
                h(Text, {dimColor: true}, process.cwd())
            )
        ),
        h(
            Box,
            {marginBottom: 1},
            ...TAB_ORDER.map(tabKey =>
                h(
                    Box,
                    {key: tabKey, marginRight: 2},
                    h(Text, {color: tabKey === currentTab ? 'cyan' : 'gray'}, tabKey === currentTab ? `[${t(`tui.tabs.${tabKey}`)}]` : t(`tui.tabs.${tabKey}`))
                )
            )
        ),
        h(
            Box,
            {flexDirection: 'row', flexGrow: 1, marginBottom: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'}, leftPane),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'}, rightPane)
        ),
        currentTab === 'home'
            ? null
            : h(Box, {marginBottom: 1}, h(LogsPanel, {logs})),
        h(
            Box,
            {marginTop: 1},
            h(Text, {color: confirmAction ? 'yellow' : busyLabel ? 'cyan' : 'green'}, confirmText),
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
