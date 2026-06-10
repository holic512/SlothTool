/**
 * @file GStoreTui
 * @project SlothTool
 * @module GStore Plugin / TUI
 * @description 提供 gstore 全屏 TUI，用于查看登录、仓库、绑定、同步和冲突状态并执行手动同步操作。
 * @logic 1. 维护 Overview/Auth/Repository/Bindings/Sync/Conflicts/Settings 页面；2. 通过键盘触发 auth、pull、push、sync、conflict 检查；3. Repository 页支持输入仓库并绑定 remote。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js
 * @index_tags gstore TUI, 手动同步, GitHub登录, 数据仓库, 冲突查看
 * @author holic512
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, render, useApp, useInput, useWindowSize} from 'ink';
import {t} from './i18n.js';
import {
    bindDataDirectory,
    configureRepository,
    ensureAuth,
    getBindingStatus,
    getConflicts,
    getRepositorySummary,
    pullBinding,
    pushBinding,
    runDoctor,
    syncBinding
} from './service.js';

const h = React.createElement;
const TAB_ORDER = ['overview', 'auth', 'repository', 'bindings', 'sync', 'conflicts', 'settings'];

function clamp(value, max) {
    if (max <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(value, max - 1));
}

function Section({title, children}) {
    return h(
        Box,
        {flexDirection: 'column', marginBottom: 1},
        h(Text, {bold: true}, title),
        children
    );
}

function Header({activeTab}) {
    return h(
        Box,
        {gap: 2, marginBottom: 1},
        ...TAB_ORDER.map(tab => h(
            Text,
            {key: tab, inverse: tab === activeTab, color: tab === activeTab ? 'cyan' : undefined},
            ` ${t(`tui.tabs.${tab}`)} `
        ))
    );
}

function Footer({status}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, {color: 'gray'}, t('tui.footer')),
        h(Text, {color: status.tone || 'green'}, status.message)
    );
}

function BindingList({bindings, selectedIndex}) {
    if (bindings.length === 0) {
        return h(Text, {color: 'yellow'}, t('noBindings'));
    }

    return h(
        Box,
        {flexDirection: 'column'},
        ...bindings.map((binding, index) => h(
            Text,
            {key: `${binding.tool}/${binding.name}`, color: index === selectedIndex ? 'cyan' : undefined},
            `${index === selectedIndex ? '>' : ' '} ${binding.tool}/${binding.name}  ${binding.localPath}`
        ))
    );
}

function OverviewPage({summary, doctor}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Section, {title: t('tui.tabs.overview')},
            h(Text, null, t('dataDir', {dir: summary.dataDir})),
            h(Text, null, t('remote', {remote: summary.remote || t('noRemote')})),
            h(Text, null, `bindings: ${summary.bindings.length}`)
        ),
        h(Section, {title: t('doctorTitle')},
            h(Text, null, `git: ${doctor.git ? t('ok') : t('missing')}`),
            h(Text, null, `gh: ${doctor.gh ? t('installed') : t('missing')}`),
            h(Text, null, `auth: ${doctor.authenticated ? t('ok') : t('notLoggedIn')}`)
        )
    );
}

function AuthPage({doctor}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, null, `gh: ${doctor.gh ? t('installed') : t('missing')}`),
        h(Text, null, `auth: ${doctor.authenticated ? t('ok') : t('notLoggedIn')}`),
        h(Text, {color: 'gray'}, 'a: gh auth login')
    );
}

function RepositoryPage({summary, inputMode, repoInput}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, null, t('dataDir', {dir: summary.dataDir})),
        h(Text, null, t('remote', {remote: summary.remote || t('noRemote')})),
        inputMode
            ? h(Text, {color: 'cyan'}, `${t('tui.inputHint')} ${repoInput}`)
            : h(Text, {color: 'gray'}, 'e: set repository  n: create private repository')
    );
}

function SyncPage({bindings, selectedIndex, status}) {
    const selected = bindings[selectedIndex];
    return h(
        Box,
        {flexDirection: 'column'},
        h(BindingList, {bindings, selectedIndex}),
        selected && status
            ? h(Section, {title: t('statusTitle', {tool: selected.tool, name: selected.name})},
                h(Text, null, t('localChanges', {count: status.localChanges.length})),
                h(Text, null, t('remoteChanges', {count: status.remoteChanges.length})),
                h(Text, null, t('conflicts', {count: status.conflicts.length}))
            )
            : null
    );
}

function ConflictsPage({conflicts}) {
    if (conflicts.length === 0) {
        return h(Text, {color: 'green'}, t('conflicts', {count: 0}));
    }

    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, {color: 'red'}, t('conflicts', {count: conflicts.length})),
        ...conflicts.map(filePath => h(Text, {key: filePath}, `  ! ${filePath}`))
    );
}

function SettingsPage() {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, null, '~/.slothtool/data'),
        h(Text, null, '~/.slothtool/plugin-configs/gstore.json'),
        h(Text, {color: 'gray'}, 'CLI: gstore bind <tool> <name> <localDir>')
    );
}

function GStoreTuiApp() {
    const {exit} = useApp();
    const {columns, rows} = useWindowSize();
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [summary, setSummary] = useState(() => getRepositorySummary());
    const [doctor, setDoctor] = useState(() => runDoctor());
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [status, setStatus] = useState({message: t('tui.status.ready'), tone: 'green'});
    const [inputMode, setInputMode] = useState(null);
    const [repoInput, setRepoInput] = useState('');
    const activeTab = TAB_ORDER[activeIndex];
    const selectedBinding = summary.bindings[selectedIndex];

    function refresh() {
        const nextSummary = getRepositorySummary();
        setSummary(nextSummary);
        setDoctor(runDoctor());
        setSelectedIndex(current => clamp(current, nextSummary.bindings.length));
        setStatus({message: t('tui.status.refreshed'), tone: 'green'});
    }

    async function runAction(action) {
        try {
            setStatus({message: t('tui.status.loading'), tone: 'yellow'});
            await Promise.resolve(action());
            refresh();
        } catch (error) {
            setStatus({message: error.message, tone: 'red'});
        }
    }

    function runSelected(action) {
        if (!selectedBinding) {
            setStatus({message: t('tui.status.noBinding'), tone: 'yellow'});
            return;
        }

        runAction(() => action(selectedBinding));
    }

    useEffect(() => {
        refresh();
    }, []);

    useInput((input, key) => {
        if (inputMode) {
            if (key.escape) {
                setInputMode(null);
                setRepoInput('');
                setStatus({message: t('tui.status.ready'), tone: 'green'});
                return;
            }

            if (key.return) {
                const value = repoInput.trim();
                if (!value) {
                    setStatus({message: t('tui.status.inputRepo'), tone: 'yellow'});
                    return;
                }

                const create = inputMode === 'create-repo';
                setInputMode(null);
                setRepoInput('');
                runAction(() => configureRepository(value, {create}));
                return;
            }

            if (key.backspace || key.delete) {
                setRepoInput(current => current.slice(0, -1));
                return;
            }

            if (input) {
                setRepoInput(current => `${current}${input}`);
            }
            return;
        }

        if (input === 'q') {
            exit();
            return;
        }

        if (key.tab) {
            setActiveIndex(current => (current + 1) % TAB_ORDER.length);
            return;
        }

        if (key.upArrow) {
            setSelectedIndex(current => clamp(current - 1, summary.bindings.length));
            return;
        }

        if (key.downArrow) {
            setSelectedIndex(current => clamp(current + 1, summary.bindings.length));
            return;
        }

        if (input === 'r') {
            refresh();
            return;
        }

        if (input === 'a') {
            runAction(() => ensureAuth());
            return;
        }

        if (input === 'e' && activeTab === 'repository') {
            setInputMode('set-repo');
            setStatus({message: t('tui.status.inputRepo'), tone: 'cyan'});
            return;
        }

        if (input === 'n' && activeTab === 'repository') {
            setInputMode('create-repo');
            setStatus({message: t('tui.status.inputRepo'), tone: 'cyan'});
            return;
        }

        if (input === 'l') {
            runSelected(binding => pullBinding(binding.tool, binding.name));
            return;
        }

        if (input === 'p') {
            runSelected(binding => pushBinding(binding.tool, binding.name));
            return;
        }

        if (input === 's') {
            runSelected(binding => syncBinding(binding.tool, binding.name));
            return;
        }

        if (input === 'c') {
            runSelected(binding => {
                const nextConflicts = getConflicts(binding.tool, binding.name);
                setConflicts(nextConflicts);
                setActiveIndex(TAB_ORDER.indexOf('conflicts'));
            });
            return;
        }

        if (input === 'b' && activeTab === 'settings') {
            const defaultPath = `${summary.dataDir}/todo/default`;
            runAction(() => bindDataDirectory('todo', 'default', defaultPath));
        }
    });

    useEffect(() => {
        if (!selectedBinding || activeTab !== 'sync') {
            return;
        }

        try {
            setSelectedStatus(getBindingStatus(selectedBinding.tool, selectedBinding.name));
        } catch (error) {
            setSelectedStatus(null);
            setStatus({message: error.message, tone: 'red'});
        }
    }, [activeTab, selectedBinding?.tool, selectedBinding?.name]);

    const divider = useMemo(() => '─'.repeat(Math.max(10, columns - 2)), [columns]);
    let content = null;

    if (activeTab === 'overview') {
        content = h(OverviewPage, {summary, doctor});
    } else if (activeTab === 'auth') {
        content = h(AuthPage, {doctor});
    } else if (activeTab === 'repository') {
        content = h(RepositoryPage, {summary, inputMode, repoInput});
    } else if (activeTab === 'bindings') {
        content = h(BindingList, {bindings: summary.bindings, selectedIndex});
    } else if (activeTab === 'sync') {
        content = h(SyncPage, {bindings: summary.bindings, selectedIndex, status: selectedStatus});
    } else if (activeTab === 'conflicts') {
        content = h(ConflictsPage, {conflicts});
    } else {
        content = h(SettingsPage);
    }

    return h(
        Box,
        {flexDirection: 'column', height: Math.max(12, rows), paddingX: 1, paddingY: 1},
        h(Header, {activeTab}),
        h(Text, {color: 'gray'}, divider),
        h(Box, {flexGrow: 1, flexDirection: 'column', marginY: 1}, content),
        h(Footer, {status})
    );
}

export async function startGStoreTui() {
    if (process.env.SLOTHTOOL_GSTORE_TUI_TEST_ACTION === 'exit') {
        return {type: 'exit'};
    }

    const ink = render(h(GStoreTuiApp), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
    return {type: 'exit'};
}

export default {
    startGStoreTui
};
