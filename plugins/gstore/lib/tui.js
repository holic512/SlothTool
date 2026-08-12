/**
 * @file GStoreTui
 * @project SlothTool
 * @module GStore Plugin / TUI
 * @description 提供与 loc/脚手架一致的响应式全屏 TUI，覆盖仓库配置、系统云同步、自定义绑定、冲突策略和环境诊断。
 * @logic 1. 同步页用操作列表和状态洞察组成主从布局；2. 仓库页完成登录、地址输入和私有仓库创建；3. 绑定与诊断页提供只读核验；4. 危险的冲突覆盖动作要求二次确认。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js
 * @index_tags gstore TUI, Git缓存, 云同步, 冲突策略, 响应式布局, 统一插件外壳
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
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
const RESULT_DISPLAY_MS = 1800;

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

function displayWidth(value) {
    return Array.from(String(value || '')).reduce((width, character) => (
        width + (character.codePointAt(0) > 0xFF ? 2 : 1)
    ), 0);
}

function truncateLeft(value, maxWidth) {
    const text = String(value || '');
    if (displayWidth(text) <= maxWidth) {
        return text;
    }
    let result = '';
    let width = 3;
    for (const character of Array.from(text).reverse()) {
        const characterWidth = displayWidth(character);
        if (width + characterWidth > maxWidth) {
            break;
        }
        result = `${character}${result}`;
        width += characterWidth;
    }
    return `...${result}`;
}

function PanelHeader({title, summary, badge, badgeColor = COLORS.accent}) {
    return h(
        Box,
        {},
        h(Text, {bold: true, color: COLORS.accent}, title),
        badge ? h(Text, {bold: true, color: badgeColor}, `  [${badge}]`) : null,
        h(Spacer, {}),
        summary ? h(Text, {dimColor: true}, summary) : null
    );
}

function Field({label, value, color, dimColor = false}) {
    return h(
        Box,
        {},
        h(Text, {color: COLORS.accent}, `${label}  `),
        h(Text, {color, dimColor}, value || '-')
    );
}

function Header({activeTab, layout}) {
    const tabs = TABS.flatMap((tab, index) => [
        index > 0 ? h(Text, {key: `${tab}-separator`, color: COLORS.muted, dimColor: true}, ' | ') : null,
        h(Text, {
            key: tab,
            bold: tab === activeTab,
            color: tab === activeTab ? COLORS.accent : COLORS.muted
        }, tab === activeTab ? `[${t(`tui.tabs.${tab}`)}]` : t(`tui.tabs.${tab}`))
    ]).filter(Boolean);
    const meta = `「v${pluginPackage.version}」`;

    return h(
        Box,
        {},
        h(Box, {}, ...tabs),
        h(Spacer, {}),
        layout.contentWidth > 58 ? h(Text, {dimColor: true}, `${meta}  「${truncateLeft(process.cwd(), 28)}」`) : null
    );
}

function ActionPanel({selectedIndex, status, layout}) {
    const badges = {
        status: 'SCAN',
        pull: 'REMOTE → LOCAL',
        push: 'LOCAL → REMOTE',
        sync: 'TWO-WAY',
        preferRemote: 'OVERWRITE LOCAL',
        preferLocal: 'OVERWRITE REMOTE',
        exit: 'QUIT'
    };

    return h(
        Box,
        {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column'},
        h(PanelHeader, {title: t('tui.panels.actions'), summary: `${selectedIndex + 1}/${ACTIONS.length}`}),
        ...ACTIONS.map((action, index) => {
            const selected = index === selectedIndex;
            const destructive = action === 'preferLocal' || action === 'preferRemote';
            const badgeColor = action === 'exit'
                ? COLORS.danger
                : destructive
                    ? COLORS.warning
                    : action === 'sync'
                        ? COLORS.success
                        : COLORS.secondary;
            return h(
                Box,
                {key: action},
                h(Text, {bold: selected, color: selected ? COLORS.accent : COLORS.muted}, selected ? '› ' : '  '),
                h(Text, {bold: selected, color: selected ? COLORS.accent : 'white', dimColor: !selected}, t(`tui.actions.${action}`)),
                h(Spacer, {}),
                layout.compact ? null : h(Text, {color: badgeColor, dimColor: !selected}, badges[action])
            );
        }),
        layout.short && status
            ? h(Text, {dimColor: true}, t('tui.status.compactSummary', {
                local: status.localChanges.length,
                remote: status.remoteChanges.length,
                conflicts: status.conflicts.length
            }))
            : null
    );
}

function StatusPanel({status, summary, busy, pending}) {
    const clean = status?.clean;
    const badge = busy
        ? t('tui.status.loading')
        : clean
            ? t('tui.status.clean')
            : t('tui.status.pending');
    const badgeColor = busy ? COLORS.warning : clean ? COLORS.success : COLORS.secondary;

    return h(
        Box,
        {borderStyle: 'round', borderColor: pending ? COLORS.warning : COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: t('tui.panels.status'), badge, badgeColor}),
        h(Field, {label: t('tui.fields.repository'), value: summary.remote || t('noRemote'), dimColor: !summary.remote}),
        h(Field, {label: t('tui.fields.scope'), value: t('bindingsCount', {count: summary.bindings.length}), color: COLORS.secondary}),
        h(Field, {label: t('tui.fields.local'), value: String(status?.localChanges.length || 0), color: status?.localChanges.length ? COLORS.warning : COLORS.success}),
        h(Field, {label: t('tui.fields.remote'), value: String(status?.remoteChanges.length || 0), color: status?.remoteChanges.length ? COLORS.secondary : COLORS.success}),
        h(Field, {label: t('tui.fields.conflicts'), value: String(status?.conflicts.length || 0), color: status?.conflicts.length ? COLORS.danger : COLORS.success}),
        pending
            ? h(Box, {marginTop: 1, flexDirection: 'column'},
                h(Text, {bold: true, color: COLORS.warning}, t('tui.confirm.title')),
                h(Text, {}, t(`tui.confirm.${pending}`)),
                h(Text, {dimColor: true}, t('tui.confirm.footer'))
            )
            : null
    );
}

function ResponsivePanels({left, right, layout}) {
    if (layout.compact) {
        return h(Box, {flexDirection: 'column', flexGrow: 1},
            h(Box, {marginBottom: 1, flexDirection: 'column'}, left),
            h(Box, {flexGrow: 1, flexDirection: 'column'}, right)
        );
    }
    return h(Box, {flexDirection: 'row', flexGrow: 1},
        h(Box, {width: layout.sidebarWidth, marginRight: 1, flexDirection: 'column'}, left),
        h(Box, {flexGrow: 1, flexDirection: 'column'}, right)
    );
}

function RepositoryPage({summary, doctor, editing, repoInput, createPrivate}) {
    return h(
        Box,
        {borderStyle: 'round', borderColor: editing ? COLORS.accent : COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {
            title: t('tui.panels.repository'),
            badge: doctor.authenticated ? t('ok') : t('notLoggedIn'),
            badgeColor: doctor.authenticated ? COLORS.success : COLORS.warning
        }),
        h(Field, {label: t('tui.fields.repository'), value: editing ? repoInput : (summary.repository || t('noRemote')), color: editing ? COLORS.accent : undefined}),
        h(Field, {label: t('tui.fields.remoteUrl'), value: truncateLeft(summary.remote || '-', 72), dimColor: true}),
        h(Field, {label: t('tui.fields.cache'), value: truncateLeft(summary.cacheDir, 72), dimColor: true}),
        h(Field, {label: t('tui.fields.privateRepo'), value: createPrivate ? t('yes') : t('no'), color: createPrivate ? COLORS.warning : COLORS.muted}),
        h(Box, {marginTop: 1, flexDirection: 'column'},
            h(Text, {color: editing ? COLORS.accent : COLORS.muted}, editing ? t('tui.repository.editing') : t('tui.repository.ready')),
            h(Text, {dimColor: true}, t('tui.repository.authHint'))
        )
    );
}

function BindingsPage({bindings, selectedIndex, layout}) {
    const visible = bindings.slice(0, layout.bindingLimit);
    const selected = bindings[selectedIndex] || bindings[0];
    const list = h(
        Box,
        {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column'},
        h(PanelHeader, {title: t('tui.panels.bindings'), summary: String(bindings.length)}),
        ...visible.map((binding, index) => h(
            Box,
            {key: `${binding.tool}/${binding.name}`},
            h(Text, {bold: index === selectedIndex, color: index === selectedIndex ? COLORS.accent : COLORS.muted}, index === selectedIndex ? '› ' : '  '),
            h(Text, {color: binding.system ? COLORS.success : 'white'}, `${binding.tool}/${binding.name}`),
            h(Spacer, {}),
            h(Text, {dimColor: true}, binding.system ? 'SYSTEM' : 'CUSTOM')
        ))
    );
    const detail = h(
        Box,
        {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: selected ? `${selected.tool}/${selected.name}` : t('noBindings')}),
        selected ? h(React.Fragment, {},
            h(Field, {label: t('tui.fields.localPath'), value: truncateLeft(selected.localPath, 72), dimColor: true}),
            h(Field, {label: t('tui.fields.repoPath'), value: selected.repoPath, color: COLORS.secondary}),
            h(Field, {label: t('tui.fields.type'), value: selected.system ? t('tui.binding.system') : t('tui.binding.custom'), color: selected.system ? COLORS.success : COLORS.warning}),
            h(Text, {dimColor: true}, t('tui.binding.hint'))
        ) : null
    );
    return h(ResponsivePanels, {left: list, right: detail, layout});
}

function DoctorPage({doctor, summary}) {
    const checks = [
        ['git', doctor.git, t('tui.doctor.git')],
        ['gh', doctor.gh, t('tui.doctor.gh')],
        ['auth', doctor.authenticated, t('tui.doctor.auth')],
        ['repo', doctor.dataRepoInitialized, t('tui.doctor.cache')],
        ['remote', Boolean(summary.remote), t('tui.doctor.remote')]
    ];
    return h(
        Box,
        {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: t('doctorTitle'), summary: `${checks.filter(([, ok]) => ok).length}/${checks.length}`}),
        ...checks.map(([id, ok, label]) => h(
            Box,
            {key: id},
            h(Text, {bold: true, color: ok ? COLORS.success : COLORS.danger}, ok ? '● ' : '○ '),
            h(Text, {}, label),
            h(Spacer, {}),
            h(Text, {color: ok ? COLORS.success : COLORS.warning}, ok ? t('ok') : t('missing'))
        )),
        doctor.legacyDataRepo
            ? h(Text, {color: COLORS.warning}, t('tui.doctor.legacyRepo'))
            : null
    );
}

export function GStoreTuiApp({layoutOverride = null, initialTab = 'sync'} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const layout = layoutOverride || resolveGStoreTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'sync');
    const [selectedAction, setSelectedAction] = useState(0);
    const [selectedBinding, setSelectedBinding] = useState(0);
    const [summary, setSummary] = useState(() => getRepositorySummary());
    const [doctor, setDoctor] = useState(() => runDoctor());
    const [syncStatus, setSyncStatus] = useState(() => getSystemStatus({refresh: false}));
    const [statusState, setStatusState] = useState({tone: 'success', message: t('tui.status.ready')});
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState('');
    const [editingRepository, setEditingRepository] = useState(false);
    const [repositoryInput, setRepositoryInput] = useState(summary.repository || '');
    const [createPrivate, setCreatePrivate] = useState(false);
    const statusTimer = useRef(null);

    useEffect(() => () => clearTimeout(statusTimer.current), []);

    function refreshLocal(message = t('tui.status.refreshed')) {
        const nextSummary = getRepositorySummary();
        setSummary(nextSummary);
        setDoctor(runDoctor());
        setSyncStatus(getSystemStatus({refresh: false}));
        setSelectedBinding(index => Math.max(0, Math.min(index, nextSummary.bindings.length - 1)));
        setStatusState({tone: 'success', message});
    }

    function showResult(tone, message) {
        clearTimeout(statusTimer.current);
        setStatusState({tone, message});
        statusTimer.current = setTimeout(() => setStatusState({tone: 'success', message: t('tui.status.ready')}), RESULT_DISPLAY_MS);
    }

    async function execute(action) {
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
        if (busy) {
            return;
        }

        if (editingRepository) {
            if (key.escape) {
                setEditingRepository(false);
                setRepositoryInput(summary.repository || '');
            } else if (key.return) {
                try {
                    configureRepository(repositoryInput, {create: createPrivate});
                    setEditingRepository(false);
                    refreshLocal(t('repoSet', {repo: repositoryInput}));
                } catch (error) {
                    showResult('error', error.message);
                }
            } else if (key.backspace || key.delete) {
                setRepositoryInput(value => value.slice(0, -1));
            } else if (input && !key.ctrl && !key.meta) {
                setRepositoryInput(value => value + input);
            }
            return;
        }

        if (pending) {
            if (input.toLowerCase() === 'y' || key.return) {
                execute(pending);
            } else if (input.toLowerCase() === 'n' || key.escape) {
                setPending('');
                showResult('warn', t('tui.status.cancelled'));
            }
            return;
        }

        if (input.toLowerCase() === 'q') {
            app.exit();
            return;
        }
        if (key.tab) {
            const index = TABS.indexOf(activeTab);
            setActiveTab(TABS[(index + 1) % TABS.length]);
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

        if (activeTab === 'repository') {
            if (input.toLowerCase() === 'a') {
                setBusy(true);
                ensureAuth().then(() => refreshLocal(t('authReady'))).catch(error => showResult('error', error.message)).finally(() => setBusy(false));
            } else if (input === ' ') {
                setCreatePrivate(value => !value);
            } else if (key.return) {
                setRepositoryInput(summary.repository || '');
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
                setPending(action);
            } else {
                execute(action);
            }
        }
    });

    if (layout.tooSmall) {
        return h(Box, {borderStyle: 'round', borderColor: COLORS.warning, paddingX: 1, flexDirection: 'column'},
            h(Text, {bold: true, color: COLORS.warning}, t('tui.resize.title')),
            h(Text, {}, t('tui.resize.description'))
        );
    }

    const content = activeTab === 'sync'
        ? h(ResponsivePanels, {
            layout,
            left: h(ActionPanel, {selectedIndex: selectedAction, status: syncStatus, layout}),
            right: h(StatusPanel, {status: syncStatus, summary, busy, pending})
        })
        : activeTab === 'repository'
            ? h(RepositoryPage, {summary, doctor, editing: editingRepository, repoInput: repositoryInput, createPrivate})
            : activeTab === 'bindings'
                ? h(BindingsPage, {bindings: summary.bindings, selectedIndex: selectedBinding, layout})
                : h(DoctorPage, {doctor, summary});
    const toneColor = statusState.tone === 'error' ? COLORS.danger : statusState.tone === 'warn' ? COLORS.warning : COLORS.success;

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(Header, {activeTab, layout}),
        h(Box, {marginY: 1}, h(Text, {color: COLORS.muted}, '─'.repeat(layout.contentWidth))),
        h(Box, {flexGrow: 1}, content),
        h(Box, {marginTop: 1},
            h(Text, {color: toneColor}, statusState.message),
            h(Spacer, {}),
            h(Text, {dimColor: true}, editingRepository ? t('tui.footer.input') : t(`tui.footer.${activeTab}`))
        )
    );
}

export async function startGStoreTui() {
    if (process.env.SLOTHTOOL_GSTORE_TUI_TEST_ACTION === 'exit') {
        return;
    }
    const ink = render(h(GStoreTuiApp), {alternateScreen: true, exitOnCtrlC: true});
    await ink.waitUntilExit();
}

export default {GStoreTuiApp, resolveGStoreTuiLayout, startGStoreTui};
