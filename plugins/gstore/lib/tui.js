/**
 * @file GStoreTui
 * @project SlothTool
 * @module GStore Plugin / TUI
 * @description 提供与 loc/脚手架一致的响应式全屏 TUI，覆盖仓库配置、系统云同步、自定义绑定、冲突策略和环境诊断。
 * @logic 1. 同步页按内容预算渲染操作列表和状态洞察，窄屏保留摘要；2. 仓库页完成登录、地址输入和私有仓库创建；3. 绑定与诊断页提供只读核验；4. 危险的冲突覆盖动作要求二次确认。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js
 * @index_tags gstore TUI, Git缓存, 云同步, 冲突策略, 响应式布局, 统一插件外壳
 * @author holic512
 */

import React, {useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {editText, editorViewport, graphemes, nextTabIndex, statusSymbol, truncateFromLeft as truncateLeft, wrapText} from './shared-interaction.js';
import {t} from './i18n.js';
import {
    configureRepository,
    ensureAuth,
    getRepositorySummary,
    getSystemStatus,
    pullSystem,
    pushSystem,
    runDoctor,
    syncSystem
} from './service.js';

import {TuiFrame, TuiHeader, TuiDetails} from './shared-layout.js';
import {getShellLayout, getDetailWindow, truncateFromRight, getDisplayWidth} from './shared-interaction.js';

const h = React.createElement;
const TABS = ['sync', 'repository', 'bindings', 'doctor'];
const ACTIONS = ['status', 'pull', 'push', 'sync', 'preferRemote', 'preferLocal', 'exit'];
const COLORS = {
    accent: 'cyanBright',
    secondary: 'magentaBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    border: 'gray'
};

export function resolveGStoreTuiLayout(columns = 80, rows = 24) {
    const safeColumns = Math.max(1, Number(columns) || 80);
    const safeRows = Math.max(1, Number(rows) || 24);
    return {
        columns: safeColumns,
        rows: safeRows,
        contentWidth: Math.max(1, safeColumns - 4),
        compact: safeColumns < 78,
        short: safeRows < 20,
        tooSmall: safeColumns < 30 || safeRows < 14,
        sidebarWidth: Math.max(30, Math.min(42, Math.floor((safeColumns - 5) * 0.42))),
        bindingLimit: safeRows < 20 ? 4 : 8
    };
}

function Panel({title, summary, badge, badgeColor = COLORS.accent, layout, children}) {
    const width = layout.panelWidth || layout.contentWidth;
    return h(Box, {height: layout.contentHeight, width, flexShrink: 0, borderStyle: 'round',
        borderColor: COLORS.border, paddingX: 1, flexDirection: 'column'},
    h(Box, {height: 1, flexShrink: 0},
        h(Text, {bold: true, color: COLORS.accent, wrap: 'truncate-end'}, title),
        badge ? h(Text, {bold: true, color: badgeColor, wrap: 'truncate-end'}, ` [${badge}]`) : null,
        h(Spacer), summary ? h(Text, {dimColor: true}, summary) : null),
    h(Box, {height: Math.max(1, layout.contentHeight - 3), flexDirection: 'column', overflow: 'hidden'}, children));
}

function Field({label, value, color, dimColor = false}) {
    return h(Box, {height: 1, flexShrink: 0}, h(Box, {flexShrink: 0}, h(Text, {color: COLORS.accent}, `${label}  `)),
        h(Text, {color, dimColor, wrap: 'truncate-end'}, String(value || '-')));
}

function Header({activeTab, layout}) {
    return h(TuiHeader, {tabs: TABS.map(id => ({id, label: t(`tui.tabs.${id}`)})), activeTab,
        width: layout.contentWidth, meta: `「v${pluginPackage.version}」  「${truncateLeft(process.cwd(), 28)}」`});
}

function listStart(count, selected, limit) {
    return Math.max(0, Math.min(selected - Math.floor(limit / 2), count - limit));
}

function ActionPanel({selectedIndex, status, summary, layout}) {
    const compactSummary = layout.compact;
    const limit = Math.max(1, layout.contentHeight - (compactSummary ? 5 : 3));
    const start = listStart(ACTIONS.length, selectedIndex, limit);
    const badges = ['SCAN', 'REMOTE → LOCAL', 'LOCAL → REMOTE', 'TWO-WAY', 'OVERWRITE LOCAL', 'OVERWRITE REMOTE', 'QUIT'];
    return h(Panel, {title: t('tui.panels.actions'), summary: `${selectedIndex + 1}/${ACTIONS.length}`, layout},
        ...ACTIONS.slice(start, start + limit).map((action, index) => {
            const selected = start + index === selectedIndex;
            const width = (layout.panelWidth || layout.contentWidth) - 4;
            const badge = layout.compact ? '' : badges[start + index];
            return h(Box, {key: action, height: 1, flexShrink: 0},
                h(Text, {bold: selected, color: selected ? COLORS.accent : 'white', dimColor: !selected},
                    truncateFromRight(`${selected ? '› ' : '  '}${t(`tui.actions.${action}`)}`, width - getDisplayWidth(badge) - (badge ? 1 : 0))),
                h(Spacer), badge ? h(Text, {color: action.startsWith('prefer') ? COLORS.warning : COLORS.secondary}, badge) : null);
        }),
        compactSummary ? h(Text, {dimColor: true, wrap: 'truncate-end'}, t('tui.status.compactSummary', {
            local: status?.localChanges.length || 0, remote: status?.remoteChanges.length || 0, conflicts: status?.conflicts.length || 0
        })) : null,
        compactSummary ? h(Text, {color: COLORS.secondary, wrap: 'truncate-end'}, t('bindingsCount', {count: summary.bindings.length})) : null);
}

function StatusPanel({status, summary, busy, layout}) {
    return h(Panel, {title: t('tui.panels.status'), badge: t(busy ? 'tui.status.loading' : status?.clean ? 'tui.status.clean' : 'tui.status.pending'),
        badgeColor: busy ? COLORS.warning : COLORS.success, layout},
        h(Field, {label: t('tui.fields.repository'), value: summary.remote || t('noRemote')}),
        h(Field, {label: t('tui.fields.scope'), value: t('bindingsCount', {count: summary.bindings.length}), color: COLORS.secondary}),
        ...['local', 'remote', 'conflicts'].map((key, index) => h(Field, {key, label: t('tui.fields.' + key),
            value: String(status?.[['localChanges', 'remoteChanges', 'conflicts'][index]].length || 0), color: COLORS.success})));
}

function ResponsivePanels({left, right, layout, compactPrimary = false}) {
    if (layout.compact && compactPrimary && layout.contentHeight < 20) return React.cloneElement(left, {layout});
    const firstHeight = layout.compact ? Math.max(4, layout.contentHeight - 8) : layout.contentHeight;
    const leftLayout = {...layout, panelWidth: layout.compact ? layout.contentWidth : layout.sidebarWidth, contentHeight: firstHeight};
    const rightLayout = {...layout, panelWidth: layout.compact ? layout.contentWidth : layout.contentWidth - layout.sidebarWidth - 1,
        contentHeight: layout.compact ? layout.contentHeight - firstHeight - 1 : layout.contentHeight};
    return h(Box, {height: layout.contentHeight, gap: 1, flexDirection: layout.compact ? 'column' : 'row'},
        React.cloneElement(left, {layout: leftLayout}), React.cloneElement(right, {layout: rightLayout}));
}

function RepositoryPage({summary, doctor, editing, repoInput, repoCursor, inputError, createPrivate, layout}) {
    return h(Panel, {title: t('tui.panels.repository'), badge: doctor.authenticated ? t('ok') : t('notLoggedIn'), layout},
        h(Field, {label: t('tui.fields.repository'), value: editing
            ? editorViewport(repoInput, repoCursor, Math.max(4, layout.contentWidth - 22)) : summary.repository || t('noRemote'), color: editing ? COLORS.accent : undefined}),
        h(Field, {label: t('tui.fields.remoteUrl'), value: truncateLeft(summary.remote || '-', layout.contentWidth - 20)}),
        h(Field, {label: t('tui.fields.cache'), value: truncateLeft(summary.cacheDir, layout.contentWidth - 20), dimColor: true}),
        h(Field, {label: t('tui.fields.privateRepo'), value: createPrivate ? t('yes') : t('no'), color: COLORS.warning}),
        inputError ? h(Text, {color: COLORS.danger, wrap: 'truncate-end'}, inputError) : null,
        h(Text, {dimColor: true, wrap: 'truncate-end'}, t(editing ? 'tui.repository.editing' : 'tui.repository.ready')),
        h(Text, {dimColor: true, wrap: 'truncate-end'}, t('authHint')));
}

function BindingList({bindings, selectedIndex, layout}) {
    const limit = Math.max(1, layout.contentHeight - 3);
    const start = listStart(bindings.length, selectedIndex, limit);
    return h(Panel, {title: t('tui.panels.bindings'), summary: `${bindings.length ? selectedIndex + 1 : 0}/${bindings.length}`, layout},
        ...bindings.slice(start, start + limit).map((binding, index) => h(Text, {
            key: `${binding.tool}/${binding.name}`, color: start + index === selectedIndex ? COLORS.accent : undefined,
            bold: start + index === selectedIndex, wrap: 'truncate-end'
        }, `${start + index === selectedIndex ? '› ' : '  '}${binding.tool}/${binding.name}`)));
}

function BindingDetail({selected, layout}) {
    return h(Panel, {title: selected ? `${selected.tool}/${selected.name}` : t('noBindings'), layout},
        selected ? h(React.Fragment, {},
            h(Field, {label: t('tui.fields.localPath'), value: truncateLeft(selected.localPath, (layout.panelWidth || layout.contentWidth) - 18)}),
            h(Field, {label: t('tui.fields.repoPath'), value: selected.repoPath, color: COLORS.secondary}),
            h(Field, {label: t('tui.fields.type'), value: t(selected.system ? 'tui.binding.system' : 'tui.binding.custom')})) : null);
}

function BindingsPage({bindings, selectedIndex, layout}) {
    return h(ResponsivePanels, {layout, left: h(BindingList, {bindings, selectedIndex}),
        right: h(BindingDetail, {selected: bindings[selectedIndex]})});
}

function DoctorPage({doctor, summary, layout}) {
    const checks = [['git', doctor.git], ['gh', doctor.gh], ['auth', doctor.authenticated], ['cache', doctor.dataRepoInitialized], ['remote', Boolean(summary.remote)]];
    return h(Panel, {title: t('doctorTitle'), layout}, ...checks.map(([id, ok]) => h(Box, {key: id, height: 1, flexShrink: 0},
        h(Text, {color: ok ? COLORS.success : COLORS.danger}, ok ? '● ' : '○ '),
        h(Text, {wrap: 'truncate-end'}, t('tui.doctor.' + id)), h(Spacer),
        h(Text, {color: ok ? COLORS.success : COLORS.warning}, ok ? t('ok') : t('missing')))),
    doctor.legacyDataRepo ? h(Text, {color: COLORS.warning, wrap: 'truncate-end'}, t('tui.doctor.legacyRepo')) : null);
}

export function GStoreTuiApp({layoutOverride = null, initialTab = 'sync'} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const baseLayout = layoutOverride || resolveGStoreTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'sync');
    const [selectedAction, setSelectedAction] = useState(0);
    const [selectedBinding, setSelectedBinding] = useState(0);
    const [summary, setSummary] = useState(() => getRepositorySummary());
    const [doctor, setDoctor] = useState(() => runDoctor());
    const [syncStatus, setSyncStatus] = useState(() => getSystemStatus({refresh: false}));
    const [statusState, setStatusState] = useState({tone: 'success', message: t('tui.status.ready')});
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState('');
    const pendingRef = useRef('');
    const [editingRepository, setEditingRepository] = useState(false);
    const [repositoryInput, setRepositoryInput] = useState(summary.repository || '');
    const [repositoryCursor, setRepositoryCursor] = useState(graphemes(summary.repository || '').length);
    const [repositoryError, setRepositoryError] = useState('');
    const [createPrivate, setCreatePrivate] = useState(false);
    const [detailLines, setDetailLines] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);

    const footer = busy ? t('tui.footer.busy') : editingRepository ? t('tui.footer.input')
        : pending ? t('tui.confirm.footer') : detailLines ? t('tui.footer.detail')
            : t(`tui.footer.${activeTab}`, activeTab === 'sync' ? {action: t(`tui.actions.${ACTIONS[selectedAction]}`)} : {});
    const shell = getShellLayout(baseLayout.columns, baseLayout.rows, {
        status: `${statusSymbol(busy ? 'running' : 'result', statusState.tone)} ${statusState.message}`, keys: footer
    });
    const layout = {...baseLayout, contentWidth: shell.contentWidth, contentHeight: shell.contentHeight};
    const detailWindow = getDetailWindow(detailLines, detailScroll, shell.contentWidth, shell.contentHeight);

    function refreshLocal(message = t('tui.status.refreshed')) {
        const nextSummary = getRepositorySummary();
        setSummary(nextSummary);
        setDoctor(runDoctor());
        setSyncStatus(getSystemStatus({refresh: false}));
        setSelectedBinding(index => Math.max(0, Math.min(index, nextSummary.bindings.length - 1)));
        setStatusState({tone: 'success', message});
    }

    function showResult(tone, message) {
        setStatusState({tone, message});
    }

    async function execute(action) {
        pendingRef.current = '';
        setPending('');
        setBusy(true);
        setStatusState({tone: 'warn', message: t('tui.status.loading')});
        try {
            await new Promise(resolve => setTimeout(resolve, 16));
            if (action === 'status') {
                setSyncStatus(getSystemStatus());
            } else if (action === 'pull') {
                pullSystem();
            } else if (action === 'push') {
                pushSystem();
            } else if (action === 'sync') {
                syncSystem();
            } else if (action === 'preferRemote') {
                syncSystem({conflictStrategy: 'remote'});
            } else if (action === 'preferLocal') {
                syncSystem({conflictStrategy: 'local'});
            }
            refreshLocal(t(`tui.status.${action}Done`));
        } catch (error) {
            showResult('error', error.message);
        } finally {
            setBusy(false);
            setPending('');
        }
    }

    useInput((input, key) => {
        if (busy) return;
        if (layout.tooSmall) {
            if (input === 'q') app.exit();
            return;
        }

        if (editingRepository) {
            if (key.escape) {
                setEditingRepository(false);
                setRepositoryError('');
                setRepositoryInput(summary.repository || '');
                setRepositoryCursor(graphemes(summary.repository || '').length);
            } else if (key.return) {
                try {
                    configureRepository(repositoryInput, {create: createPrivate});
                    setEditingRepository(false);
                    setRepositoryError('');
                    refreshLocal(t('repoSet', {repo: repositoryInput}));
                } catch (error) {
                    setRepositoryError(error.message);
                    showResult('error', error.message);
                }
            } else {
                const next = editText({value: repositoryInput, cursor: repositoryCursor}, input, key);
                setRepositoryInput(next.value);
                setRepositoryCursor(next.cursor);
                setRepositoryError('');
            }
            return;
        }

        if (pendingRef.current) {
            if (input.toLowerCase() === 'y') {
                execute(pendingRef.current);
            } else if (input.toLowerCase() === 'n' || key.escape) {
                pendingRef.current = '';
                setPending('');
                showResult('warn', t('tui.status.cancelled'));
            }
            return;
        }

        if (detailLines) {
            if (key.escape) setDetailLines(null);
            else if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, Math.min(value, detailWindow.maxScroll) - (key.pageUp ? detailWindow.capacity : 1)));
            else if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(
                detailWindow.maxScroll, Math.min(value, detailWindow.maxScroll) + (key.pageDown ? detailWindow.capacity : 1)));
            return;
        }

        if (input.toLowerCase() === 'q') {
            app.exit();
            return;
        }
        if (key.tab) {
            const index = TABS.indexOf(activeTab);
            setActiveTab(TABS[nextTabIndex(index, TABS.length, key)]);
            return;
        }
        if (key.escape) {
            setActiveTab('sync');
            return;
        }
        if (input.toLowerCase() === 'r') {
            refreshLocal();
            return;
        }
        if (input.toLowerCase() === 'v') {
            const binding = summary.bindings[selectedBinding];
            const lines = [t(`tui.tabs.${activeTab}`), statusState.message, ''];
            if (activeTab === 'bindings' && binding) lines.push(
                `${t('tui.fields.localPath')}: ${binding.localPath}`,
                `${t('tui.fields.repoPath')}: ${binding.repoPath}`);
            else lines.push(
                `${t('tui.fields.repository')}: ${summary.repository || '-'}`,
                `${t('tui.fields.remoteUrl')}: ${summary.remote || '-'}`,
                `${t('tui.fields.cache')}: ${summary.cacheDir || '-'}`);
            lines.push(t('bindingsCount', {count: summary.bindings.length}),
                ...['localChanges', 'remoteChanges', 'conflicts'].map(key => `${key}: ${syncStatus?.[key]?.length || 0}`),
                ...Object.entries(doctor).map(([key, value]) => `${key}: ${value}`));
            setDetailLines(lines);
            setDetailScroll(0);
            return;
        }

        if (activeTab === 'repository') {
            if (input.toLowerCase() === 'a') {
                setBusy(true);
                ensureAuth().then(() => refreshLocal(t('authReady'))).catch(error => showResult('error', error.message)).finally(() => setBusy(false));
            } else if (input === ' ') {
                setCreatePrivate(value => !value);
            } else if (key.return) {
                setRepositoryInput(summary.repository || '');
                setRepositoryCursor(graphemes(summary.repository || '').length);
                setRepositoryError('');
                setEditingRepository(true);
            }
            return;
        }

        if (activeTab === 'bindings') {
            if (key.upArrow) {
                setSelectedBinding(index => (index - 1 + summary.bindings.length) % Math.max(1, summary.bindings.length));
            } else if (key.downArrow) {
                setSelectedBinding(index => (index + 1) % Math.max(1, summary.bindings.length));
            }
            return;
        }

        if (activeTab !== 'sync') {
            return;
        }
        if (key.upArrow) {
            setSelectedAction(index => (index - 1 + ACTIONS.length) % ACTIONS.length);
        } else if (key.downArrow) {
            setSelectedAction(index => (index + 1) % ACTIONS.length);
        } else if (key.return) {
            const action = ACTIONS[selectedAction];
            if (action === 'exit') {
                app.exit();
            } else if (action === 'preferLocal' || action === 'preferRemote') {
                pendingRef.current = action;
                setPending(action);
            } else {
                execute(action);
            }
        }
    });

    usePaste(value => {
        if (!editingRepository || busy) return;
        const next = editText({value: repositoryInput, cursor: repositoryCursor}, value);
        setRepositoryInput(next.value);
        setRepositoryCursor(next.cursor);
        setRepositoryError('');
    });

    if (layout.tooSmall) {
        return h(Box, {borderStyle: 'round', borderColor: COLORS.warning, paddingX: 1, flexDirection: 'column'},
            h(Text, {bold: true, color: COLORS.warning}, t('tui.resize.title')),
            h(Text, {}, t('tui.resize.description'))
        );
    }

    const content = pending
        ? h(TuiDetails, {title: t('tui.confirm.title'), lines: [t(`tui.confirm.${pending}`), t('tui.confirm.footer')],
            width: shell.contentWidth, height: shell.contentHeight, accent: COLORS.warning})
        : detailLines
        ? h(TuiDetails, {title: t('tui.panels.details'), lines: detailLines, scroll: detailScroll, width: shell.contentWidth, height: shell.contentHeight})
        : activeTab === 'sync'
        ? h(ResponsivePanels, {
            layout,
            compactPrimary: true,
            left: h(ActionPanel, {selectedIndex: selectedAction, status: syncStatus, summary, layout}),
            right: h(StatusPanel, {status: syncStatus, summary, busy, pending})
        })
        : activeTab === 'repository'
            ? h(RepositoryPage, {summary, doctor, editing: editingRepository, repoInput: repositoryInput,
                repoCursor: repositoryCursor, inputError: repositoryError, createPrivate, layout})
            : activeTab === 'bindings'
                ? h(BindingsPage, {bindings: summary.bindings, selectedIndex: selectedBinding, layout})
                : h(DoctorPage, {doctor, summary, layout});
    const toneColor = statusState.tone === 'error' ? COLORS.danger : statusState.tone === 'warn' ? COLORS.warning : COLORS.success;

    return h(TuiFrame, {layout: shell, statusColor: toneColor, header: h(Header, {activeTab, layout})}, content);
}

export async function startGStoreTui() {
    if (process.env.SLOTHTOOL_GSTORE_TUI_TEST_ACTION === 'exit') {
        return;
    }
    const ink = render(h(GStoreTuiApp), {alternateScreen: true, exitOnCtrlC: true});
    await ink.waitUntilExit();
}

export default {GStoreTuiApp, resolveGStoreTuiLayout, startGStoreTui};
