/**
 * @file SlothToolRootTui
 * @project SlothTool
 * @module Core CLI / TUI
 * @description 提供 SlothTool 默认全屏 Ink 界面，负责页面导航、实时状态栏、两阶段更新、独立卸载页和插件返回后的状态恢复。
 * @logic 1. 使用 alternateScreen 渲染独立全屏页面；2. 在首页、运行、安装、更新、卸载、设置页之间切换；3. 任务 reporter 实时驱动底部状态栏；4. 退出运行插件时返回 UI 快照给 interactive 命令恢复状态。
 * @dependencies Libraries: react/ink, Services: ../services/plugin-service.js, Settings: ../settings.js, RootTuiModules: ./root/*
 * @index_tags 根TUI, Ink, 全屏界面, 页面编排, 更新检查, 状态恢复
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, render, useApp, useInput, useWindowSize} from 'ink';
import settings from '../settings.js';
import {t} from '../i18n.js';
import {
    checkAllUpdates,
    installPlugin,
    uninstallAllData,
    uninstallPlugin,
    updatePlugin,
    updateSelf
} from '../services/plugin-service.js';
import {
    RESULT_DISPLAY_MS,
    SELF_RESTART_DELAY_MS,
    SPINNER_FRAMES,
    SPINNER_INTERVAL_MS,
    TASK_START_RENDER_DELAY_MS,
    TAB_ORDER
} from './root/constants.js';
import {buildDividerLine, getViewportHeight, resolveStatusColor} from './root/format.js';
import {HelpPanel, RootFooter, RootHeader} from './root/layout.js';
import {
    buildInstallItems,
    buildPluginItems,
    buildSettingsItems,
    buildUninstallItems,
    buildUpdateItems
} from './root/items.js';
import {HomePage} from './root/pages/home-page.js';
import {InstallPage} from './root/pages/install-page.js';
import {RunPage} from './root/pages/run-page.js';
import {SettingsPage} from './root/pages/settings-page.js';
import {UninstallPage} from './root/pages/uninstall-page.js';
import {UpdatePage} from './root/pages/update-page.js';

const h = React.createElement;

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

function normalizeTabIndex(tabIndex) {
    return Number.isInteger(tabIndex) && tabIndex >= 0 && tabIndex < TAB_ORDER.length
        ? tabIndex
        : 0;
}

function waitForTaskStartRender() {
    return new Promise(resolve => {
        setTimeout(resolve, TASK_START_RENDER_DELAY_MS);
    });
}

function normalizeReporterTone(level) {
    if (level === 'error' || level === 'warn') {
        return level;
    }

    return 'success';
}

function createReporterCollector(onEvent) {
    let feedback = null;

    return {
        reporter(event) {
            if (event.level === 'success' || event.level === 'warn' || event.level === 'error') {
                feedback = {
                    tone: event.level,
                    message: event.message
                };
            }

            onEvent?.(event);
        },
        getFeedback() {
            return feedback;
        }
    };
}

function RootTuiApp({onExit, initialState, initialStatus}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const snapshotState = normalizeRootTuiStateSnapshot(initialState);
    const [tabIndex, setTabIndex] = useState(normalizeTabIndex(TAB_ORDER.indexOf(snapshotState.activeTab)));
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

    const currentTab = TAB_ORDER[normalizeTabIndex(tabIndex)];
    const currentSettings = settings.readSettings();
    const language = currentSettings.language;
    const runItems = buildPluginItems(language);
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

        const collector = createReporterCollector(event => {
            if (!event?.message) {
                return;
            }

            setStatusState(currentStatus => {
                if (currentStatus.mode !== 'progress') {
                    return currentStatus;
                }

                return {
                    mode: 'progress',
                    tone: normalizeReporterTone(event.level),
                    message: '',
                    label: event.message
                };
            });
        });

        try {
            await waitForTaskStartRender();
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
            runTask(t('tui.actions.selfUpdate'), reporter => updateSelf({reporter}), {
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
                    await updateSelf({reporter});
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
        content = h(HomePage);
    }

    if (currentTab === 'run') {
        content = h(RunPage, {
            items: runItems,
            selectedIndex: selection.run
        });
    }

    if (currentTab === 'install') {
        content = h(InstallPage, {
            items: installItems,
            selectedIndex: selection.install
        });
    }

    if (currentTab === 'update') {
        content = h(UpdatePage, {
            items: updateItems,
            selectedIndex: selection.update
        });
    }

    if (currentTab === 'uninstall') {
        content = h(UninstallPage, {
            items: uninstallItems,
            selectedIndex: selection.uninstall
        });
    }

    if (currentTab === 'settings') {
        content = h(SettingsPage, {
            items: settingsItems,
            selectedIndex: selection.settings
        });
    }

    const confirmText = confirmAction
        ? t('tui.status.confirm', {label: confirmAction.title})
        : statusState.mode === 'progress'
            ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
            : statusState.mode === 'result'
                ? statusState.message
                : t('tui.status.ready');
    const dividerLine = buildDividerLine(columns);
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone, Boolean(confirmAction));

    return h(
        Box,
        {flexDirection: 'column', height: getViewportHeight(rows), paddingX: 1, paddingY: 1},
        h(RootHeader, {currentTab, columns}),
        h(Box, {marginBottom: 1}, h(Text, {color: 'gray'}, dividerLine)),
        h(Box, {flexGrow: 1, marginBottom: 1}, content),
        h(RootFooter, {statusColor, confirmText}),
        helpOpen
            ? h(HelpPanel)
            : null
    );
}

export async function startRootTui(options = {}) {
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const initialState = normalizedOptions.initialState || null;
    const initialStatus = normalizedOptions.initialStatus || null;

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'exit') {
        return {type: 'exit'};
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'restart-self') {
        return {type: 'restart-self'};
    }

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'self-update-restart') {
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
