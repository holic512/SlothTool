/**
 * @file SlothToolRootTui
 * @project SlothTool
 * @module Core CLI / TUI
 * @description 提供 SlothTool 默认全屏 Ink 界面，编排六页导航、任务阶段、反馈回看、详情翻阅、卸载确认和插件返回后的状态恢复。
 * @logic 1. 按真实终端尺寸固定页头、内容与双行底栏；2. 统一任务阶段并保留会话反馈；3. 把危险操作置于独立确认视图；4. 退出运行插件时返回 UI 快照给 interactive 命令恢复状态。
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
    SELF_RESTART_DELAY_MS,
    SPINNER_FRAMES,
    SPINNER_INTERVAL_MS,
    TASK_START_RENDER_DELAY_MS,
    TAB_ORDER
} from './root/constants.js';
import {buildDividerLine, resolveStatusColor} from './root/format.js';
import {ConfirmPanel, DetailPanel, FeedbackPage, getDetailScrollLimit, HelpPanel, ResizePanel, RootFooter, RootHeader} from './root/layout.js';
import {buildFeedbackDetailLines, buildItemDetailLines, confirmInputTransition, getFooterKeys, getViewportBudget} from './root/interaction.js';
import {
    buildInstallItems,
    buildPluginItems,
    buildSettingsItems,
    buildUninstallItems,
    buildUpdateItems,
    sortPluginItemsByRecentRun
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
        },
        feedbackEntries: Array.isArray(normalizedSnapshot.feedbackEntries)
            ? normalizedSnapshot.feedbackEntries
            : []
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
    const events = [];

    return {
        reporter(event) {
            if (event?.message) events.push({level: event.level, message: event.message});
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
        },
        getEvents() {
            return events;
        }
    };
}

export function RootTuiApp({onExit, initialState, initialStatus, services = {}}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const snapshotState = normalizeRootTuiStateSnapshot(initialState);
    const [tabIndex, setTabIndex] = useState(normalizeTabIndex(TAB_ORDER.indexOf(snapshotState.activeTab)));
    const [selection, setSelection] = useState(snapshotState.selection);
    const [confirmAction, setConfirmAction] = useState(null);
    const confirmRef = useRef(null);
    const [view, setView] = useState('page');
    const [detailView, setDetailView] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);
    const [feedbackSelection, setFeedbackSelection] = useState(0);
    const [feedbackEntries, setFeedbackEntries] = useState(() => {
        const previous = snapshotState.feedbackEntries;
        if (!initialStatus?.message) return previous;
        return [...previous, {
            id: previous.reduce((max, entry) => Math.max(max, entry.id || 0), 0) + 1,
            label: t('tui.feedback.pluginRun'),
            phase: initialStatus.tone === 'error' ? 'failure' : initialStatus.tone === 'warn' ? 'partial' : 'success',
            message: initialStatus.message,
            events: [],
            results: []
        }];
    });
    const feedbackIdRef = useRef(feedbackEntries.reduce((max, entry) => Math.max(max, entry.id || 0), 0));
    const [confirmInput, setConfirmInput] = useState('');
    const confirmInputRef = useRef('');
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState(initialStatus?.message
        ? {
            mode: initialStatus.tone === 'error' ? 'failure' : initialStatus.tone === 'warn' ? 'partial' : 'success',
            tone: initialStatus.tone || 'success',
            message: initialStatus.message,
            label: t('tui.feedback.pluginRun')
        }
        : {
            mode: 'idle',
            tone: 'success',
            message: '',
            label: ''
        });
    const [updateCheckSummary, setUpdateCheckSummary] = useState(null);
    const [bulkUpdateSummary, setBulkUpdateSummary] = useState(null);
    const busyRef = useRef(false);
    const restartTimeoutRef = useRef(null);
    const viewport = getViewportBudget(columns, rows);

    const currentTab = TAB_ORDER[normalizeTabIndex(tabIndex)];
    const currentSettings = settings.readSettings();
    const language = currentSettings.language;
    const pluginItems = buildPluginItems(language);
    const runItems = sortPluginItemsByRecentRun(pluginItems);
    const installItems = buildInstallItems(language);
    const settingsItems = buildSettingsItems(currentSettings);
    const uninstallItems = buildUninstallItems(pluginItems);
    const updateItems = buildUpdateItems(updateCheckSummary, bulkUpdateSummary);

    useEffect(() => {
        if (statusState.mode !== 'preparing' && statusState.mode !== 'running') {
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
            selection,
            feedbackEntries
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
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
    }

    function showResultStatus(tone, message, options = {}) {
        clearPendingStatusTransitions();
        busyRef.current = false;
        const phase = options.phase || (tone === 'error' ? 'failure' : tone === 'warn' ? 'partial' : 'success');
        const label = options.label || message;
        setStatusState({
            mode: phase,
            tone,
            message,
            label
        });
        const entry = {
            id: ++feedbackIdRef.current,
            label,
            phase,
            message,
            events: options.events || [],
            results: options.results || []
        };
        setFeedbackEntries(current => [...current, entry]);

        if (options.restartOnSuccess) {
            restartTimeoutRef.current = setTimeout(() => {
                requestExit({type: 'restart-self'});
            }, SELF_RESTART_DELAY_MS);
        }
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
        if (busyRef.current) {
            return null;
        }

        clearPendingStatusTransitions();
        busyRef.current = true;
        setSpinnerFrameIndex(0);
        setStatusState({
            mode: 'preparing',
            tone: 'success',
            message: '',
            label
        });

        const collector = createReporterCollector(event => {
            if (!event?.message) {
                return;
            }

            setStatusState(currentStatus => {
                if (currentStatus.mode !== 'preparing' && currentStatus.mode !== 'running') {
                    return currentStatus;
                }

                return {
                    mode: 'running',
                    tone: normalizeReporterTone(event.level),
                    message: '',
                    label: event.message
                };
            });
        });

        try {
            await waitForTaskStartRender();
            setStatusState(currentStatus => ({...currentStatus, mode: 'running'}));
            const result = await task(collector.reporter);
            const feedback = options.resolveFeedback?.(result, collector.getFeedback()) || collector.getFeedback() || {
                tone: 'success',
                message: label
            };
            const restartOnSuccess = options.shouldRestart?.(result, feedback) ?? options.restartOnSuccess;
            showResultStatus(feedback.tone, feedback.message, {
                label,
                events: collector.getEvents(),
                results: feedback.results || result?.results || [],
                restartOnSuccess: restartOnSuccess && feedback.tone === 'success'
            });
            return result;
        } catch (error) {
            showResultStatus('error', error.message, {
                label,
                events: collector.getEvents()
            });
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
                kind: item.kind,
                title: item.title,
                target: `${item.alias} (${item.fields?.[0]?.value || item.alias})`,
                scope: t('tui.uninstall.pluginScope'),
                execute: reporter => (services.uninstallPlugin || uninstallPlugin)(item.alias, {reporter})
            };
        }

        if (item.kind === 'uninstall-all') {
            return {
                id: item.id,
                kind: item.kind,
                title: item.title,
                target: t('tui.uninstall.allTarget'),
                scope: t('tui.uninstall.allScope'),
                execute: reporter => Promise.resolve((services.uninstallAllData || uninstallAllData)({reporter})),
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
            const nextSummary = await (services.checkAllUpdates || checkAllUpdates)();
            setUpdateCheckSummary(nextSummary);
            setBulkUpdateSummary(null);
            return nextSummary;
        }, {
            resolveFeedback(summary) {
                const results = summary.items.map(item => ({
                    title: item.title,
                    status: item.status === 'error' ? 'failed' : item.status,
                    reason: item.reason || ''
                }));
                if (summary.outdatedCount === 0 && summary.errorCount === 0) {
                    return {
                        tone: 'success',
                        message: t('tui.update.latestSummary'),
                        results
                    };
                }

                return {
                    tone: summary.errorCount > 0 ? 'warn' : 'success',
                    message: t('tui.update.checkedSummary', {
                        outdated: summary.outdatedCount,
                        failed: summary.errorCount
                    }),
                    results
                };
            }
        });
    }

    function runSingleCheckedUpdate(result) {
        if (result.status !== 'outdated') {
            return;
        }

        if (result.kind === 'self') {
            runTask(t('tui.actions.selfUpdate'), reporter => (services.updateSelf || updateSelf)({reporter}), {
                restartOnSuccess: true
            });
            return;
        }

        runTask(t('tui.actions.updatePlugin', {alias: result.targetId}), async reporter => {
            const updateResult = await (services.updatePlugin || updatePlugin)(result.targetId, {reporter});
            try {
                const nextSummary = await (services.checkAllUpdates || checkAllUpdates)();
                setUpdateCheckSummary(nextSummary);
                return {updateResult, nextSummary};
            } catch (error) {
                return {updateResult, checkError: error.message};
            }
        }, {
            resolveFeedback(taskResult, feedback) {
                if (!taskResult.checkError) return feedback;
                return {
                    tone: 'warn',
                    message: t('tui.update.updatedRecheckFailed', {
                        label: result.title,
                        reason: taskResult.checkError
                    }),
                    results: [
                        {title: result.title, status: 'updated'},
                        {title: t('tui.actions.recheckUpdates'), status: 'failed', reason: taskResult.checkError}
                    ]
                };
            }
        });
    }

    function runBulkCheckedUpdate() {
        const outdatedItems = updateCheckSummary?.items?.filter(item => item.status === 'outdated') || [];

        if (outdatedItems.length === 0) {
            showResultStatus('success', t('tui.update.noneOutdated'), {label: t('tui.actions.updateOutdated')});
            return;
        }

        const includesSelf = outdatedItems.some(item => item.targetId === 'self');

        runTask(t('tui.actions.updateOutdated'), async reporter => {
            const summary = {
                total: outdatedItems.length,
                updated: 0,
                latest: 0,
                failed: 0,
                restartSelf: false,
                results: []
            };
            const pluginTargets = outdatedItems.filter(item => item.targetId !== 'self');

            for (const item of pluginTargets) {
                try {
                    const result = await (services.updatePlugin || updatePlugin)(item.targetId, {reporter});
                    const status = result?.status === 'latest' ? 'latest' : 'updated';
                    summary[status] += 1;
                    summary.results.push({title: item.title, status});
                } catch (error) {
                    summary.failed += 1;
                    summary.results.push({title: item.title, status: 'failed', reason: error.message});
                    reporter?.({level: 'error', message: error.message});
                }
            }

            if (includesSelf) {
                try {
                    await (services.updateSelf || updateSelf)({reporter});
                    summary.updated += 1;
                    summary.restartSelf = true;
                    summary.results.push({title: outdatedItems.find(item => item.targetId === 'self')?.title || 'SlothTool', status: 'updated'});
                } catch (error) {
                    summary.failed += 1;
                    summary.results.push({title: outdatedItems.find(item => item.targetId === 'self')?.title || 'SlothTool', status: 'failed', reason: error.message});
                    reporter?.({level: 'error', message: error.message});
                }
            }

            if (!summary.restartSelf) {
                try {
                    const nextSummary = await (services.checkAllUpdates || checkAllUpdates)();
                    setUpdateCheckSummary(nextSummary);
                } catch (error) {
                    summary.failed += 1;
                    summary.results.push({title: t('tui.actions.recheckUpdates'), status: 'failed', reason: error.message});
                }
            }

            setBulkUpdateSummary({...summary, results: [...summary.results]});
            setSelection(current => ({
                ...current,
                update: 2 + (updateCheckSummary?.items?.length || 0)
            }));

            return summary;
        }, {
            shouldRestart(summary) {
                return summary.restartSelf === true;
            },
            resolveFeedback(summary) {
                return {
                    tone: summary.failed > 0 ? 'warn' : 'success',
                    message: t('update.allSummary', summary),
                    results: summary.results
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
            if (item.actionable) runBulkCheckedUpdate();
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

            runTask(item.title, reporter => (services.installPlugin || installPlugin)(item.id, {reporter}));
            return;
        }

        if (currentTab === 'update') {
            executeUpdateItem(currentUpdateItem());
            return;
        }

        if (currentTab === 'uninstall') {
            const confirm = buildConfirmAction(currentUninstallItem());
            if (confirm) {
                confirmRef.current = confirm;
                confirmInputRef.current = '';
                setConfirmInput('');
                setConfirmAction(confirm);
            }
            return;
        }

        if (currentTab === 'settings') {
            executeSettingItem(currentSettingItem());
        }
    }

    function executeConfirm(item) {
        confirmRef.current = null;
        confirmInputRef.current = '';
        setConfirmAction(null);
        setConfirmInput('');

        if (!item?.execute) {
            return;
        }

        runTask(item.title, reporter => item.execute(reporter), item.taskOptions || {});
    }

    useInput((input, key) => {
        if (busyRef.current) return;

        if (viewport.tooSmall) {
            if (input.toLowerCase() === 'q') requestExit();
            return;
        }

        if (confirmRef.current) {
            const pendingAction = confirmRef.current;
            const transition = confirmInputTransition(pendingAction, confirmInputRef.current, input, key);
            if (transition.effect === 'cancel') {
                confirmRef.current = null;
                confirmInputRef.current = '';
                setConfirmAction(null);
                setConfirmInput('');
                return;
            }
            if (transition.effect === 'execute') {
                executeConfirm(pendingAction);
                return;
            }
            confirmInputRef.current = transition.input;
            setConfirmInput(transition.input);
            return;
        }

        if (view === 'help') {
            if (key.escape || input === '?') {
                setView('page');
            }
            return;
        }

        if (view === 'detail') {
            if (key.escape) {
                setView(detailView?.source === 'feedback' ? 'feedback' : 'page');
                setDetailView(null);
                setDetailScroll(0);
                return;
            }
            const maxScroll = getDetailScrollLimit(detailView?.lines || [], columns, viewport.contentHeight);
            const pageSize = Math.max(1, viewport.contentHeight - 4);
            if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, value - (key.pageUp ? pageSize : 1)));
            if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(maxScroll, value + (key.pageDown ? pageSize : 1)));
            if (key.home) setDetailScroll(0);
            if (key.end) setDetailScroll(maxScroll);
            return;
        }

        if (view === 'feedback') {
            if (key.escape || input.toLowerCase() === 'f') {
                setView('page');
                return;
            }
            if (key.upArrow) setFeedbackSelection(value => Math.max(0, value - 1));
            if (key.downArrow) setFeedbackSelection(value => Math.min(feedbackEntries.length - 1, value + 1));
            if (key.return && feedbackEntries[feedbackSelection]) {
                const entry = feedbackEntries[feedbackSelection];
                setDetailView({source: 'feedback', title: entry.label, lines: buildFeedbackDetailLines(entry)});
                setDetailScroll(0);
                setView('detail');
            }
            return;
        }

        if (input === '?') {
            setView('help');
            return;
        }

        if (input.toLowerCase() === 'f' && feedbackEntries.length) {
            setFeedbackSelection(feedbackEntries.length - 1);
            setView('feedback');
            return;
        }

        if (input.toLowerCase() === 'v' && currentTab !== 'home') {
            const selectedItem = currentTab === 'run' ? currentRunItem()
                : currentTab === 'install' ? currentInstallItem()
                    : currentTab === 'update' ? currentUpdateItem()
                        : currentTab === 'uninstall' ? currentUninstallItem()
                            : currentSettingItem();
            if (selectedItem) {
                setDetailView({source: 'item', title: selectedItem.title, lines: buildItemDetailLines(selectedItem)});
                setDetailScroll(0);
                setView('detail');
            }
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

    if (viewport.tooSmall) {
        return h(ResizePanel, {
            columns: viewport.width,
            rows: viewport.height,
            busy: statusState.mode === 'preparing' || statusState.mode === 'running'
        });
    }

    let content = h(Box, {height: viewport.contentHeight}, h(Text, {}, ''));

    if (currentTab === 'home') {
        content = h(HomePage, {contentHeight: viewport.contentHeight});
    }

    if (currentTab === 'run') {
        content = h(RunPage, {
            items: runItems,
            selectedIndex: selection.run,
            columns,
            contentHeight: viewport.contentHeight
        });
    }

    if (currentTab === 'install') {
        content = h(InstallPage, {
            items: installItems,
            selectedIndex: selection.install,
            columns,
            contentHeight: viewport.contentHeight
        });
    }

    if (currentTab === 'update') {
        content = h(UpdatePage, {
            items: updateItems,
            selectedIndex: selection.update,
            columns,
            contentHeight: viewport.contentHeight
        });
    }

    if (currentTab === 'uninstall') {
        content = h(UninstallPage, {
            items: uninstallItems,
            selectedIndex: selection.uninstall,
            columns,
            contentHeight: viewport.contentHeight
        });
    }

    if (currentTab === 'settings') {
        content = h(SettingsPage, {
            items: settingsItems,
            selectedIndex: selection.settings,
            columns,
            contentHeight: viewport.contentHeight
        });
    }

    if (view === 'help') content = h(HelpPanel, {height: viewport.contentHeight, columns});
    if (view === 'feedback') content = h(FeedbackPage, {
        entries: feedbackEntries,
        selectedIndex: feedbackSelection,
        height: viewport.contentHeight,
        columns
    });
    if (view === 'detail' && detailView) content = h(DetailPanel, {
        title: detailView.title,
        lines: detailView.lines,
        scroll: detailScroll,
        height: viewport.contentHeight,
        columns
    });
    if (confirmAction) content = h(ConfirmPanel, {
        action: confirmAction,
        input: confirmInput,
        height: viewport.contentHeight,
        columns
    });

    const statusText = confirmAction
        ? `${t('tui.confirm.title')}: ${confirmAction.target}`
        : statusState.mode === 'preparing' || statusState.mode === 'running'
            ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${t(`tui.status.phases.${statusState.mode}`)}: ${statusState.label}`
            : statusState.mode === 'idle'
                ? t('tui.status.ready')
                : `${t(`tui.status.phases.${statusState.mode}`)}: ${statusState.message}`;
    const dividerLine = buildDividerLine(columns);
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone, Boolean(confirmAction));
    const currentItem = currentTab === 'run' ? currentRunItem()
        : currentTab === 'install' ? currentInstallItem()
            : currentTab === 'update' ? currentUpdateItem()
                : currentTab === 'uninstall' ? currentUninstallItem()
                    : currentTab === 'settings' ? currentSettingItem() : null;
    const keys = getFooterKeys({
        tab: currentTab,
        item: currentItem,
        view,
        confirmation: confirmAction,
        phase: statusState.mode,
        feedbackCount: feedbackEntries.length,
        columns
    });

    return h(
        Box,
        {flexDirection: 'column', height: viewport.height, paddingX: 1},
        h(RootHeader, {currentTab, columns}),
        h(Text, {color: 'gray'}, dividerLine),
        content,
        h(RootFooter, {statusColor, statusText, keys, columns})
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
                selection: {
                    ...getDefaultSelection(),
                    run: 1
                }
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
