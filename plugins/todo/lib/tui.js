/**
 * @file TodoTui
 * @project SlothTool
 * @module Todo Plugin / TUI
 * @description 提供 todo 全屏 TUI，用于浏览、新增、完成、搜索任务并手动触发 gstore 同步。
 * @logic 1. 维护 Inbox/Today/Upcoming/Projects/Tags/Search/Sync/Settings 页面；2. 通过键盘触发任务写入和同步；3. 所有业务操作复用 service 层。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js, Storage: ./storage.js
 * @index_tags todo TUI, TodoList, 手动同步, 搜索, 任务管理
 * @author holic512
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, render, useApp, useInput, useWindowSize} from 'ink';
import {t} from './i18n.js';
import {
    createTask,
    getTaskProjects,
    getTaskTags,
    getTodoSummary,
    initializeTodo,
    listTasks,
    runSyncAction,
    setTaskStatus
} from './service.js';
import {getTodoConfigPath, getTodoDataDir} from './storage.js';

const h = React.createElement;
const TAB_ORDER = ['inbox', 'today', 'upcoming', 'projects', 'tags', 'search', 'sync', 'settings'];

function clamp(value, max) {
    if (max <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(value, max - 1));
}

function Header({activeTab}) {
    return h(
        Box,
        {gap: 1, marginBottom: 1},
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
        h(Text, {color: status.tone || 'green'}, status.message),
        h(Text, {color: 'gray'}, t('tui.footer'))
    );
}

function TaskLine({task, selected}) {
    const marker = selected ? '>' : ' ';
    const due = task.dueAt ? ` due:${task.dueAt}` : '';
    const tags = task.tags.length > 0 ? ` #${task.tags.join(' #')}` : '';
    const project = task.project ? ` @${task.project}` : '';

    return h(
        Text,
        {color: selected ? 'cyan' : undefined},
        `${marker} ${task.id.slice(0, 8)} [${task.status}] (${task.priority}) ${task.title}${due}${project}${tags}`
    );
}

function TaskList({tasks, selectedIndex}) {
    if (tasks.length === 0) {
        return h(Text, {color: 'yellow'}, t('noTasks'));
    }

    return h(
        Box,
        {flexDirection: 'column'},
        ...tasks.map((task, index) => h(TaskLine, {
            key: task.id,
            task,
            selected: index === selectedIndex
        }))
    );
}

function TextList({items}) {
    if (items.length === 0) {
        return h(Text, {color: 'yellow'}, t('noItems'));
    }

    return h(
        Box,
        {flexDirection: 'column'},
        ...items.map(item => h(Text, {key: item}, item))
    );
}

function SyncPage({summary, syncInfo}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, null, t('dataDir', {dir: summary.dataDir})),
        h(Text, null, `gstore: ${syncInfo.available ? 'ok' : 'missing'}`),
        h(Text, null, `binding: ${syncInfo.bound ? 'ok' : 'missing'}`),
        syncInfo.hint ? h(Text, {color: 'yellow'}, syncInfo.hint) : null
    );
}

function SettingsPage({summary}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(Text, null, t('dataDir', {dir: getTodoDataDir()})),
        h(Text, null, t('configPath', {path: getTodoConfigPath()})),
        h(Text, null, `tasks: ${summary.stats.total}`),
        h(Text, null, `open: ${summary.stats.open}`),
        h(Text, null, `today: ${summary.stats.today}`)
    );
}

function getVisibleTasks(activeTab, searchQuery) {
    if (activeTab === 'today') {
        return listTasks({due: 'today', sort: 'priority'});
    }

    if (activeTab === 'upcoming') {
        return listTasks({due: 'week', sort: 'due'});
    }

    if (activeTab === 'search') {
        return listTasks({query: searchQuery, all: Boolean(searchQuery), sort: 'updated'});
    }

    return listTasks({status: 'todo', sort: 'due'});
}

function TodoTuiApp() {
    const {exit} = useApp();
    const {columns, rows} = useWindowSize();
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [summary, setSummary] = useState(() => getTodoSummary());
    const [tasks, setTasks] = useState(() => listTasks({status: 'todo', sort: 'due'}));
    const [projects, setProjects] = useState(() => getTaskProjects());
    const [tags, setTags] = useState(() => getTaskTags());
    const [syncInfo, setSyncInfo] = useState(() => runSyncAction('doctor'));
    const [status, setStatus] = useState({message: t('tui.status.ready'), tone: 'green'});
    const [inputMode, setInputMode] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const activeTab = TAB_ORDER[activeIndex];

    function refresh(nextActiveTab = activeTab, nextSearchQuery = searchQuery) {
        const nextSummary = getTodoSummary();
        const nextTasks = getVisibleTasks(nextActiveTab, nextSearchQuery);
        setSummary(nextSummary);
        setTasks(nextTasks);
        setProjects(getTaskProjects());
        setTags(getTaskTags());
        setSyncInfo(runSyncAction('doctor'));
        setSelectedIndex(current => clamp(current, nextTasks.length));
        setStatus({message: t('tui.status.refreshed'), tone: 'green'});
    }

    function runAction(action, successMessage = t('tui.status.saved')) {
        try {
            setStatus({message: t('tui.status.loading'), tone: 'yellow'});
            action();
            refresh();
            setStatus({message: successMessage, tone: 'green'});
        } catch (error) {
            setStatus({message: error.message, tone: 'red'});
        }
    }

    function selectedTask() {
        return tasks[selectedIndex] || null;
    }

    useEffect(() => {
        initializeTodo();
        refresh();
    }, []);

    useEffect(() => {
        refresh(activeTab, searchQuery);
    }, [activeTab, searchQuery]);

    useInput((input, key) => {
        if (inputMode) {
            if (key.escape) {
                setInputMode(null);
                setInputValue('');
                setStatus({message: t('tui.status.ready'), tone: 'green'});
                return;
            }

            if (key.return) {
                const value = inputValue.trim();
                if (inputMode === 'new-task' && value) {
                    runAction(() => createTask(value), t('tui.status.saved'));
                }

                if (inputMode === 'search') {
                    setSearchQuery(value);
                    setActiveIndex(TAB_ORDER.indexOf('search'));
                    refresh('search', value);
                }

                setInputMode(null);
                setInputValue('');
                return;
            }

            if (key.backspace || key.delete) {
                setInputValue(current => current.slice(0, -1));
                return;
            }

            if (input) {
                setInputValue(current => `${current}${input}`);
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
            setSelectedIndex(current => clamp(current - 1, tasks.length));
            return;
        }

        if (key.downArrow) {
            setSelectedIndex(current => clamp(current + 1, tasks.length));
            return;
        }

        if (input === 'r') {
            refresh();
            return;
        }

        if (input === 'n') {
            setInputMode('new-task');
            setInputValue('');
            setStatus({message: t('tui.inputTitle'), tone: 'cyan'});
            return;
        }

        if (input === '/') {
            setInputMode('search');
            setInputValue(searchQuery);
            setStatus({message: t('tui.searchHint'), tone: 'cyan'});
            return;
        }

        if (input === 'd') {
            const task = selectedTask();
            if (!task) {
                setStatus({message: t('tui.status.noTask'), tone: 'yellow'});
                return;
            }

            runAction(() => setTaskStatus(task.id, 'done'));
            return;
        }

        if (input === 's') {
            try {
                setStatus({message: t('tui.status.loading'), tone: 'yellow'});
                runSyncAction('sync');
                refresh();
                setStatus({message: t('tui.status.synced'), tone: 'green'});
            } catch (error) {
                setStatus({message: error.message, tone: 'red'});
            }
        }
    });

    const divider = useMemo(() => '-'.repeat(Math.max(10, columns - 2)), [columns]);
    let content = null;

    if (inputMode) {
        content = h(
            Box,
            {flexDirection: 'column'},
            h(Text, {color: 'cyan'}, inputMode === 'new-task' ? t('tui.inputTitle') : t('tui.searchHint')),
            h(Text, null, inputValue)
        );
    } else if (activeTab === 'projects') {
        content = h(TextList, {items: projects});
    } else if (activeTab === 'tags') {
        content = h(TextList, {items: tags});
    } else if (activeTab === 'sync') {
        content = h(SyncPage, {summary, syncInfo});
    } else if (activeTab === 'settings') {
        content = h(SettingsPage, {summary});
    } else {
        content = h(TaskList, {tasks, selectedIndex});
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

export async function startTodoTui() {
    if (process.env.SLOTHTOOL_TODO_TUI_TEST_ACTION === 'exit') {
        return {type: 'exit'};
    }

    const ink = render(h(TodoTuiApp), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
    return {type: 'exit'};
}

export default {
    startTodoTui
};
