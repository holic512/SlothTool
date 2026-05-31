/**
 * @file SlothToolRootTui
 * @project SlothTool
 * @module Core CLI / TUI
 * @description 提供 SlothTool 默认全屏 Ink 界面，负责页面导航、两阶段更新、独立卸载页和插件返回后的状态恢复。
 * @logic 1. 使用 alternateScreen 渲染独立全屏页面；2. 在首页、运行、安装、更新、卸载、设置页之间切换；3. 退出运行插件时返回 UI 快照给 interactive 命令恢复状态。
 * @dependencies Libraries: react/ink, Services: ../services/plugin-service.js, Settings: ../settings.js, I18N: ../i18n.js
 * @index_tags 根TUI, Ink, 全屏界面, 更新检查, 卸载页, 状态恢复
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import rootPackage from '../../package.json' with {type: 'json'};
import settings from '../settings.js';
import {t} from '../i18n.js';
import {
    checkAllUpdates,
    getOfficialPlugins,
    installPlugin,
    listInstalledPlugins,
    uninstallAllData,
    uninstallPlugin,
    updatePlugin,
    updateSelf
} from '../services/plugin-service.js';

const h = React.createElement;
const TAB_ORDER = ['home', 'run', 'install', 'update', 'uninstall', 'settings'];
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

function getDefaultSelection() {
    return {
        run: 0,
        install: 0,
        update: 0,
        uninstall: 0,
        settings: 0
    };
}

function normalizeRootTuiStateSnapshot(snapshot) {
    const normalizedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const activeTab = TAB_ORDER.includes(normalizedSnapshot.activeTab) ? normalizedSnapshot.activeTab : 'home';
    return {
        activeTab,
        selection: {
            ...getDefaultSelection(),
            ...(normalizedSnapshot.selection || {})
        }
    };
}

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

function buildSettingsItems(currentSettings) {
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
        }
    ];
}

function buildUninstallItems(pluginItems) {
    return [
        ...pluginItems.map(plugin => ({
            id: `uninstall:${plugin.alias}`,
            kind: 'uninstall-plugin',
            alias: plugin.alias,
            title: t('tui.actions.uninstallPlugin', {alias: plugin.alias}),
            description: plugin.description,
            detail: plugin.detail
        })),
        {
            id: 'uninstall-all',
            kind: 'uninstall-all',
            title: t('tui.actions.uninstallAll'),
            description: '~/.slothtool',
            detail: t('uninstallAll.warning')
        }
    ];
}

function buildUpdateDetailLines(result) {
    const lines = [
        t('tui.update.detailCurrent', {version: result.currentVersion || '-'}),
        t('tui.update.detailLatest', {version: result.latestVersion || '-'}),
        t('tui.update.detailSource', {source: result.sourceLabel})
    ];

    if (result.reason) {
        lines.push(t('tui.update.detailReason', {reason: result.reason}));
    }

    return lines.join('\n');
}

function buildUpdateItems(updateCheckSummary) {
    if (!updateCheckSummary) {
        return [
            {
                id: 'check-updates',
                kind: 'check-updates',
                title: t('tui.actions.checkUpdates'),
                description: t('tui.update.checkDescription'),
                detail: t('tui.update.detailReady')
            }
        ];
    }

    return [
        {
            id: 'recheck-updates',
            kind: 'check-updates',
            title: t('tui.actions.recheckUpdates'),
            description: t('tui.update.checkedSummary', {
                outdated: updateCheckSummary.outdatedCount,
                failed: updateCheckSummary.errorCount
            }),
            detail: updateCheckSummary.outdatedCount === 0 && updateCheckSummary.errorCount === 0
                ? t('tui.update.latestSummary')
                : t('tui.update.checkDescription')
        },
        {
            id: 'update-outdated',
            kind: 'update-outdated',
            title: t('tui.actions.updateOutdated'),
            description: updateCheckSummary.outdatedCount > 0
                ? t('tui.update.checkedSummary', {
                    outdated: updateCheckSummary.outdatedCount,
                    failed: updateCheckSummary.errorCount
                })
                : t('tui.update.noneOutdated'),
            detail: t('tui.update.checkDescription')
        },
        ...updateCheckSummary.items.map(result => ({
            id: `checked:${result.targetId}`,
            kind: 'checked-target',
            result,
            title: result.title,
            description: t(`tui.update.statusLabels.${result.status}`),
            detail: buildUpdateDetailLines(result)
        }))
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

function RootTuiApp({onExit, initialState, initialStatus}) {
    const app = useApp();
    const snapshotState = normalizeRootTuiStateSnapshot(initialState);
    const [tabIndex, setTabIndex] = useState(TAB_ORDER.indexOf(snapshotState.activeTab));
    const [selection, setSelection] = useState(snapshotState.selection);
    const [confirmAction, setConfirmAction] = useState(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState(initialStatus?.message
        ? {
            mode: 'result',
            tone: initialStatus.tone || 'success',
            message: initialStatus.message,
            label: ''
        }
        : {
            mode: 'idle',
            tone: 'success',
            message: '',
            label: ''
        });
    const [updateCheckSummary, setUpdateCheckSummary] = useState(null);
    const resultTimeoutRef = useRef(null);
    const restartTimeoutRef = useRef(null);

    const currentTab = TAB_ORDER[tabIndex];
    const currentSettings = settings.readSettings();
    const language = currentSettings.language;
    const runItems = buildPluginItems();
    const installItems = buildInstallItems(language);
    const settingsItems = buildSettingsItems(currentSettings);
    const uninstallItems = buildUninstallItems(runItems);
    const updateItems = buildUpdateItems(updateCheckSummary);

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
        if (process.env.SLOTHTOOL_TUI_TEST_ACTION !== 'render-exit') {
            return undefined;
        }

        app.exit();
        return undefined;
    }, [app]);

    useEffect(() => {
        if (!initialStatus?.message) {
            return undefined;
        }

        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                mode: 'idle',
                tone: 'success',
                message: '',
                label: ''
            });
        }, RESULT_DISPLAY_MS);

        return () => {
            clearTimeout(resultTimeoutRef.current);
        };
    }, [initialStatus]);

    useEffect(() => {
        const maxIndexes = {
            run: Math.max(0, runItems.length - 1),
            install: Math.max(0, installItems.length - 1),
            update: Math.max(0, updateItems.length - 1),
            uninstall: Math.max(0, uninstallItems.length - 1),
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
    }, [installItems.length, runItems.length, settingsItems.length, uninstallItems.length, updateItems.length]);

    function getUiStateSnapshot() {
        return normalizeRootTuiStateSnapshot({
            activeTab: currentTab,
            selection
        });
    }

    function requestExit(action = {type: 'exit'}) {
        const finalAction = action.type === 'run-plugin'
            ? {
                ...action,
                uiState: getUiStateSnapshot()
            }
            : action;

        onExit(finalAction);
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

        if (tabKey === 'uninstall') {
            return uninstallItems.length;
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
            const restartOnSuccess = options.shouldRestart?.(result, feedback) ?? options.restartOnSuccess;
            showResultStatus(feedback.tone, feedback.message, {
                restartOnSuccess
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

    function currentUninstallItem() {
        return uninstallItems[selection.uninstall] || null;
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

    function runUpdateCheck() {
        return runTask(t('tui.actions.checkUpdates'), async () => {
            const nextSummary = await checkAllUpdates();
            setUpdateCheckSummary(nextSummary);
            return nextSummary;
        }, {
            resolveFeedback(summary) {
                if (summary.outdatedCount === 0 && summary.errorCount === 0) {
                    return {
                        tone: 'success',
                        message: t('tui.update.latestSummary')
                    };
                }

                return {
                    tone: summary.errorCount > 0 ? 'warn' : 'success',
                    message: t('tui.update.checkedSummary', {
                        outdated: summary.outdatedCount,
                        failed: summary.errorCount
                    })
                };
            }
        });
    }

    function runSingleCheckedUpdate(result) {
        if (result.status === 'latest') {
            showResultStatus('success', t('tui.update.latestNotice', {label: result.title}));
            return;
        }

        if (result.status === 'error') {
            showResultStatus('warn', t('tui.update.errorNotice', {
                label: result.title,
                reason: result.reason || t('tui.update.statusLabels.error')
            }));
            return;
        }

        if (result.kind === 'self') {
            runTask(t('tui.actions.selfUpdate'), reporter => Promise.resolve(updateSelf({reporter})), {
                restartOnSuccess: true
            });
            return;
        }

        runTask(t('tui.actions.updatePlugin', {alias: result.targetId}), async reporter => {
            const updateResult = await updatePlugin(result.targetId, {reporter});
            const nextSummary = await checkAllUpdates();
            setUpdateCheckSummary(nextSummary);
            return {updateResult, nextSummary};
        });
    }

    function runBulkCheckedUpdate() {
        const outdatedItems = updateCheckSummary?.items?.filter(item => item.status === 'outdated') || [];

        if (outdatedItems.length === 0) {
            showResultStatus('success', t('tui.update.noneOutdated'));
            return;
        }

        const includesSelf = outdatedItems.some(item => item.targetId === 'self');

        runTask(t('tui.actions.updateOutdated'), async reporter => {
            const summary = {
                total: outdatedItems.length,
                updated: 0,
                latest: 0,
                failed: 0,
                restartSelf: false
            };
            const pluginTargets = outdatedItems.filter(item => item.targetId !== 'self');

            for (const item of pluginTargets) {
                try {
                    await updatePlugin(item.targetId, {reporter});
                    summary.updated += 1;
                } catch (error) {
                    summary.failed += 1;
                    reporter?.({level: 'error', message: error.message});
                }
            }

            if (includesSelf) {
                try {
                    updateSelf({reporter});
                    summary.updated += 1;
                    summary.restartSelf = true;
                } catch (error) {
                    summary.failed += 1;
                    reporter?.({level: 'error', message: error.message});
                }
            } else {
                const nextSummary = await checkAllUpdates();
                setUpdateCheckSummary(nextSummary);
            }

            return summary;
        }, {
            shouldRestart(summary) {
                return summary.restartSelf === true;
            },
            resolveFeedback(summary) {
                return {
                    tone: summary.failed > 0 ? 'warn' : 'success',
                    message: t('update.allSummary', summary)
                };
            }
        });
    }

    function executeUpdateItem(item) {
        if (!item) {
            return;
        }

        if (item.kind === 'check-updates') {
            runUpdateCheck();
            return;
        }

        if (item.kind === 'update-outdated') {
            runBulkCheckedUpdate();
            return;
        }

        if (item.kind === 'checked-target') {
            runSingleCheckedUpdate(item.result);
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

        if (currentTab === 'uninstall') {
            const confirm = buildConfirmAction(currentUninstallItem());
            if (confirm) {
                setConfirmAction(confirm);
            }
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
                    detail: item?.detail || t('tui.update.checkDetail')
                })
            )
        );
    }

    if (currentTab === 'uninstall') {
        const item = currentUninstallItem();
        content = h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(Box, {flexBasis: 0, flexGrow: 1, paddingRight: 1, flexDirection: 'column'},
                h(SelectionList, {
                    items: uninstallItems,
                    selectedIndex: selection.uninstall,
                    emptyMessage: t('tui.uninstall.empty')
                })
            ),
            h(Box, {flexBasis: 0, flexGrow: 1, paddingLeft: 1, flexDirection: 'column'},
                h(DetailPanel, {
                    title: item?.title || t('tui.tabs.uninstall'),
                    description: item?.description || t('tui.uninstall.action'),
                    detail: item?.detail || t('tui.uninstall.action')
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

export async function startRootTui(options = {}) {
    const initialState = options.initialState || null;
    const initialStatus = options.initialStatus || null;

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'exit') {
        return {type: 'exit'};
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'restart-self') {
        return {type: 'restart-self'};
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'run-plugin-return') {
        process.env.SLOTHTOOL_TUI_TEST_ACTION = 'assert-restored-state';
        return {
            type: 'run-plugin',
            alias: 'loc',
            args: [],
            uiState: normalizeRootTuiStateSnapshot({
                activeTab: 'run',
                selection: getDefaultSelection()
            })
        };
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'assert-restored-state') {
        const restoredState = normalizeRootTuiStateSnapshot(initialState);
        console.log(`TUI_TEST_RESTORED_STATE:${JSON.stringify(restoredState)}`);
        return {type: 'exit'};
    }

    let exitAction = {type: 'exit'};

    const ink = render(
        h(RootTuiApp, {
            initialState,
            initialStatus,
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
