/**
 * @file SlothToolRootTui
 * @project SlothTool
 * @module Core CLI / TUI
 * @description 提供 SlothTool 默认全屏 Ink 界面，负责页面导航、更新入口整合与设置页网络配置交互。
 * @logic 1. 使用 alternateScreen 渲染独立全屏页面；2. 通过键盘状态机在首页、运行、安装、更新、设置页间切换；3. 将设置变更与插件生命周期操作统一调度到共享 service。
 * @dependencies Libraries: react/ink, Services: ../services/plugin-service.js, Settings: ../settings.js, I18N: ../i18n.js
 * @index_tags 根TUI, Ink, 全屏界面, 页面导航, 更新页, 代理设置
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
const TAB_ORDER = ['home', 'run', 'install', 'update', 'settings'];
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
        alias: plugin.alias,
        title: plugin.alias,
        description: `${plugin.displayName} v${plugin.version}`,
        detail: plugin.sourceLabel
    }));
}

function getGithubSourceLabel(githubSettings) {
    if (githubSettings.preset === 'official') {
        return t('tui.settings.githubOfficial');
    }

    if (githubSettings.preset === 'custom') {
        return t('config.githubPresets.custom');
    }

    return t('tui.settings.githubProxy');
}

function buildUpdateItems(pluginItems) {
    return [
        {
            id: 'self-update',
            kind: 'self-update',
            title: t('tui.actions.selfUpdate'),
            description: '@holic512/slothtool',
            detail: 'npm install -g'
        },
        {
            id: 'update-all',
            kind: 'update-all',
            title: t('tui.actions.updateAll'),
            description: t('uninstallAll.previewPlugins', {count: pluginItems.length}),
            detail: t('tui.update.action')
        },
        ...pluginItems.map(plugin => ({
            id: `update:${plugin.alias}`,
            kind: 'update-plugin',
            alias: plugin.alias,
            title: t('tui.actions.updatePlugin', {alias: plugin.alias}),
            description: plugin.description,
            detail: plugin.detail
        }))
    ];
}

function buildSettingItems(currentSettings, pluginItems) {
    const proxySettings = currentSettings.network.proxy;
    const githubSettings = currentSettings.network.github;

    return [
        {
            id: 'language:zh',
            kind: 'language',
            value: 'zh',
            title: '中文 (Chinese)',
            description: currentSettings.language === 'zh'
                ? t('tui.settings.currentLanguage')
                : t('tui.settings.switchToChinese'),
            detail: 'zh'
        },
        {
            id: 'language:en',
            kind: 'language',
            value: 'en',
            title: 'English',
            description: currentSettings.language === 'en'
                ? t('tui.settings.currentLanguage')
                : t('tui.settings.switchToEnglish'),
            detail: 'en'
        },
        {
            id: 'proxy:enabled',
            kind: 'proxy-enabled',
            title: t('tui.settings.proxyToggle'),
            description: proxySettings.enabled ? t('tui.settings.proxyEnabled') : t('tui.settings.proxyDisabled'),
            detail: `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`
        },
        {
            id: 'proxy:port',
            kind: 'proxy-port',
            title: t('tui.settings.proxyPortPreset'),
            description: t('tui.settings.proxyPortDetail', {
                host: proxySettings.host,
                port: proxySettings.port
            }),
            detail: '7980 / 7890'
        },
        {
            id: 'github:source',
            kind: 'github-source',
            title: t('tui.settings.githubSource'),
            description: getGithubSourceLabel(githubSettings),
            detail: githubSettings.preset === 'custom' && githubSettings.customBaseUrl
                ? githubSettings.customBaseUrl
                : getGithubSourceLabel(githubSettings)
        },
        ...pluginItems.map(plugin => ({
            id: `uninstall:${plugin.alias}`,
            kind: 'uninstall-plugin',
            alias: plugin.alias,
            title: t('tui.actions.uninstallPlugin', {alias: plugin.alias}),
            description: plugin.description,
            detail: t('tui.settings.uninstallPluginDetail')
        })),
        {
            id: 'uninstall-all',
            kind: 'uninstall-all',
            title: t('tui.settings.uninstallAll'),
            description: '~/.slothtool',
            detail: t('tui.settings.uninstallAllDetail')
        }
    ];
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
        run: 0,
        install: 0,
        update: 0,
        settings: 0
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
    const currentSettings = settings.readSettings();
    const language = currentSettings.language;
    const runItems = buildPluginItems();
    const installItems = buildInstallItems(language);
    const updateItems = buildUpdateItems(runItems);
    const settingsItems = buildSettingItems(currentSettings, runItems);

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

    useEffect(() => {
        const maxIndexes = {
            run: Math.max(0, runItems.length - 1),
            install: Math.max(0, installItems.length - 1),
            update: Math.max(0, updateItems.length - 1),
            settings: Math.max(0, settingsItems.length - 1)
        };

        setSelection(currentSelection => {
            let changed = false;
            const nextSelection = {...currentSelection};

            for (const [key, maxIndex] of Object.entries(maxIndexes)) {
                if ((currentSelection[key] || 0) > maxIndex) {
                    nextSelection[key] = maxIndex;
                    changed = true;
                }
            }

            return changed ? nextSelection : currentSelection;
        });
    }, [installItems.length, runItems.length, settingsItems.length, updateItems.length]);

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

    function getItemCount(tabKey) {
        if (tabKey === 'run') {
            return runItems.length;
        }

        if (tabKey === 'install') {
            return installItems.length;
        }

        if (tabKey === 'update') {
            return updateItems.length;
        }

        if (tabKey === 'settings') {
            return settingsItems.length;
        }

        return 1;
    }

    function moveSelection(delta) {
        const itemCount = getItemCount(currentTab);
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
            return null;
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

    function currentRunItem() {
        return runItems[selection.run] || null;
    }

    function currentUpdateItem() {
        return updateItems[selection.update] || null;
    }

    function currentSettingItem() {
        return settingsItems[selection.settings] || null;
    }

    function buildConfirmAction(item) {
        if (!item) {
            return null;
        }

        if (item.kind === 'uninstall-plugin') {
            return {
                id: item.id,
                title: item.title,
                execute: reporter => uninstallPlugin(item.alias, {reporter})
            };
        }

        if (item.kind === 'uninstall-all') {
            return {
                id: item.id,
                title: item.title,
                execute: reporter => Promise.resolve(uninstallAllData({reporter})),
                taskOptions: {
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
                }
            };
        }

        return null;
    }

    function executeUpdateItem(item) {
        if (!item) {
            return;
        }

        if (item.kind === 'self-update') {
            runTask(item.title, reporter => Promise.resolve(updateSelf({reporter})), {
                restartOnSuccess: true
            });
            return;
        }

        if (item.kind === 'update-all') {
            runTask(item.title, reporter => updateAllPlugins({reporter}), {
                resolveFeedback(result) {
                    if (!result || result.total === 0) {
                        return {
                            tone: 'warn',
                            message: t('tui.update.empty')
                        };
                    }

                    return {
                        tone: result.failed > 0 ? 'warn' : 'success',
                        message: t('update.allSummary', result)
                    };
                }
            });
            return;
        }

        if (item.kind === 'update-plugin') {
            runTask(item.title, reporter => updatePlugin(item.alias, {reporter}));
        }
    }

    function executeSettingItem(item) {
        if (!item) {
            return;
        }

        if (item.kind === 'language') {
            settings.setLanguage(item.value);
            showResultStatus('success', t('cli.languageSet', {language: item.value}));
            return;
        }

        if (item.kind === 'proxy-enabled') {
            const nextEnabled = !settings.getNetworkSettings().proxy.enabled;
            settings.setProxyEnabled(nextEnabled);
            showResultStatus('success', t('config.proxyEnabledSet', {
                status: t(`config.statuses.${nextEnabled ? 'on' : 'off'}`)
            }));
            return;
        }

        if (item.kind === 'proxy-port') {
            const currentPort = settings.getNetworkSettings().proxy.port;
            const nextPort = currentPort === 7980 ? 7890 : 7980;
            settings.setProxyPort(nextPort);
            showResultStatus('success', t('config.proxyPortSet', {port: nextPort}));
            return;
        }

        if (item.kind === 'github-source') {
            const currentPreset = settings.getNetworkSettings().github.preset;
            const nextPreset = currentPreset === 'official' ? 'gh-proxy' : 'official';
            settings.setGithubPreset(nextPreset);
            showResultStatus('success', t('config.githubPresetSet', {
                label: nextPreset === 'official'
                    ? t('config.githubPresets.official')
                    : t('config.githubPresets.ghProxy')
            }));
            return;
        }

        const confirm = buildConfirmAction(item);
        if (confirm) {
            setConfirmAction(confirm);
        }
    }

    function executeEnter() {
        if (currentTab === 'home') {
            setTabIndex(1);
            return;
        }

        if (currentTab === 'run') {
            const item = currentRunItem();
            if (!item) {
                return;
            }

            requestExit({
                type: 'run-plugin',
                alias: item.alias,
                args: []
            });
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

        if (currentTab === 'update') {
            executeUpdateItem(currentUpdateItem());
            return;
        }

        if (currentTab === 'settings') {
            executeSettingItem(currentSettingItem());
        }
    }

    function executeConfirm(item) {
        setConfirmAction(null);

        if (!item?.execute) {
            return;
        }

        runTask(item.title, reporter => item.execute(reporter), item.taskOptions || {});
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

    if (currentTab === 'run') {
        const item = currentRunItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: runItems,
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

    if (currentTab === 'update') {
        const item = currentUpdateItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: updateItems,
                    selectedIndex: selection.update,
                    emptyMessage: t('tui.update.empty')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.update'),
                    description: item?.description || t('tui.update.action'),
                    detail: item?.detail || t('tui.update.action')
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
                    emptyMessage: t('tui.settings.empty')
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
