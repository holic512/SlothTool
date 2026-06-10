#!/usr/bin/env node

/**
 * @file TodoPluginEntry
 * @project SlothTool
 * @module Todo Plugin / Entry
 * @description todo 插件命令入口，无参数默认进入 TUI，显式子命令提供 JSON TodoList CLI 和 gstore 手动同步。
 * @logic 1. 解析 add/list/show/edit/status/checklist/note/lists/sync 等命令；2. 将任务业务委托给 service；3. 在终端环境下启动 Ink TUI。
 * @dependencies Services: ../lib/service.js, TUI: ../lib/tui.js, I18N: ../lib/i18n.js
 * @index_tags todo入口, 默认TUI, TodoList CLI, gstore同步
 * @author holic512
 */

import {getTodoConfigPath, getTodoDataDir} from '../lib/storage.js';
import {t} from '../lib/i18n.js';
import {
    addChecklistItem,
    addNote,
    archiveTaskList,
    createTask,
    createTaskList,
    findTaskByPrefix,
    getStats,
    getTaskProjects,
    getTaskTags,
    getTodoSummary,
    initializeTodo,
    listNotes,
    listTaskLists,
    listTasks,
    mutateMany,
    purgeTask,
    removeChecklistItem,
    renameTaskList,
    restoreTask,
    runSyncAction,
    setChecklistItemDone,
    setTaskStatus,
    toTaskOutput,
    updateTask
} from '../lib/service.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  todo');
    console.log('  todo --tui');
    console.log('  todo add <title> [--description text] [--priority medium] [--due date] [--tag tag]');
    console.log('  todo list [--all] [--status todo|done] [--tag tag] [--project name] [--due overdue|today|week|date] [--sort due|priority|created|updated]');
    console.log('  todo show <id-prefix>');
    console.log('  todo edit <id-prefix> [--title text] [--description text] [--priority high] [--due date]');
    console.log('  todo done|reopen|start|block|archive|restore|delete|purge <id-prefix...>');
    console.log('  todo checklist add|done|undone|remove <task> <text-or-item>');
    console.log('  todo note add|list <task> [text]');
    console.log('  todo lists list|add|rename|archive ...');
    console.log('  todo tags|projects|stats');
    console.log('  todo status|pull|push|sync|conflicts|doctor [--json]');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help        ${t('help')}`);
    console.log(`  --tui             ${t('tuiOption')}`);
    console.log(`  --json            ${t('jsonOption')}`);
    console.log(`  --all             ${t('allOption')}`);
    console.log('');
    console.log(t('examples'));
    console.log('  todo add "Buy milk" --tag home --due today');
    console.log('  todo list --due today');
    console.log('  todo done 9f3a2b1c');
    console.log('  todo sync');
}

function hasFlag(args, flag) {
    return args.includes(flag);
}

function parseArgs(args) {
    const flags = new Set();
    const values = {};
    const positionals = [];

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (!arg.startsWith('--') || arg === '--') {
            positionals.push(arg);
            continue;
        }

        const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/su).filter(value => value !== undefined);
        const key = rawKey.replace(/-([a-z])/gu, (match, letter) => letter.toUpperCase());

        if (['json', 'all', 'tui'].includes(key)) {
            flags.add(key);
            continue;
        }

        const value = inlineValue !== undefined ? inlineValue : args[index + 1];
        if (inlineValue === undefined) {
            index += 1;
        }

        if (values[key] === undefined) {
            values[key] = value;
        } else if (Array.isArray(values[key])) {
            values[key].push(value);
        } else {
            values[key] = [values[key], value];
        }
    }

    return {flags, values, positionals};
}

function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}

function taskId(task) {
    return task.id.slice(0, 8);
}

function dueLabel(task) {
    return task.dueAt ? ` due:${task.dueAt}` : '';
}

function printTaskLine(task) {
    const tags = task.tags.length > 0 ? ` #${task.tags.join(' #')}` : '';
    const project = task.project ? ` @${task.project}` : '';
    console.log(`${taskId(task)} [${task.status}] (${task.priority}) ${task.title}${dueLabel(task)}${project}${tags}`);
}

function printTasks(tasks, json) {
    if (json) {
        printJson(tasks.map(toTaskOutput));
        return;
    }

    if (tasks.length === 0) {
        console.log(t('noTasks'));
        return;
    }

    for (const task of tasks) {
        printTaskLine(task);
    }
}

function taskOptions(values) {
    return {
        title: values.title,
        description: values.description,
        priority: values.priority,
        status: values.status,
        dueAt: values.due,
        scheduledAt: values.scheduled,
        startAt: values.start,
        project: values.project,
        area: values.area,
        listId: values.list,
        tags: values.tag,
        contexts: values.context,
        estimateMinutes: values.estimate,
        spentMinutes: values.spent,
        progress: values.progress,
        parentId: values.parent,
        links: values.link
    };
}

function listOptions(parsed) {
    return {
        all: parsed.flags.has('all'),
        status: parsed.values.status,
        tags: parsed.values.tag,
        project: parsed.values.project,
        area: parsed.values.area,
        list: parsed.values.list,
        due: parsed.values.due,
        sort: parsed.values.sort,
        query: parsed.values.query
    };
}

function printOneTask(task, json) {
    if (json) {
        printJson(toTaskOutput(task));
        return;
    }

    console.log(`${task.id}  ${task.title}`);
    console.log(`  status: ${task.status}`);
    console.log(`  priority: ${task.priority}`);
    console.log(`  list: ${task.listId}`);
    if (task.description) {
        console.log(`  description: ${task.description}`);
    }
    if (task.project) {
        console.log(`  project: ${task.project}`);
    }
    if (task.area) {
        console.log(`  area: ${task.area}`);
    }
    if (task.tags.length > 0) {
        console.log(`  tags: ${task.tags.join(', ')}`);
    }
    if (task.contexts.length > 0) {
        console.log(`  contexts: ${task.contexts.join(', ')}`);
    }
    if (task.dueAt) {
        console.log(`  due: ${task.dueAt}`);
    }
    if (task.checklist.length > 0) {
        console.log('  checklist:');
        for (const item of task.checklist) {
            console.log(`    ${item.id.slice(0, 8)} ${item.done ? '[x]' : '[ ]'} ${item.title}`);
        }
    }
    if (task.notes.length > 0) {
        console.log('  notes:');
        for (const note of task.notes) {
            console.log(`    ${note.createdAt} ${note.text}`);
        }
    }
    console.log(`  file: ${toTaskOutput(task).relativePath}`);
}

function printSimpleList(items, json) {
    if (json) {
        printJson(items);
        return;
    }

    if (items.length === 0) {
        console.log(t('noItems'));
        return;
    }

    for (const item of items) {
        if (typeof item === 'string') {
            console.log(item);
        } else {
            console.log(`${item.id}  ${item.title || item.text || ''}`);
        }
    }
}

function printStats(stats, json) {
    if (json) {
        printJson(stats);
        return;
    }

    console.log(t('statsTitle'));
    console.log(`  total: ${stats.total}`);
    console.log(`  open: ${stats.open}`);
    console.log(`  done: ${stats.done}`);
    console.log(`  overdue: ${stats.overdue}`);
    console.log(`  today: ${stats.today}`);
}

function printSyncResult(action, result, json) {
    if (json) {
        printJson(result?.json ?? result);
        return;
    }

    if (action === 'doctor') {
        console.log(`gstore: ${result.available ? 'ok' : 'missing'}`);
        console.log(`binding: ${result.bound ? 'ok' : 'missing'}`);
        console.log(t('dataDir', {dir: result.dataDir}));
        if (result.hint) {
            console.log(result.hint);
        }
        return;
    }

    if (result?.json) {
        printJson(result.json);
        return;
    }

    console.log(t('syncDone', {action}));
}

async function runCli(args) {
    const parsed = parseArgs(args);
    const json = parsed.flags.has('json');
    const [command, subCommand, ...rest] = parsed.positionals;

    initializeTodo();

    if (command === 'add') {
        const title = rest.length > 0 ? [subCommand, ...rest].filter(Boolean).join(' ') : subCommand;
        const task = createTask(title, taskOptions(parsed.values));
        if (json) {
            printJson(toTaskOutput(task));
        } else {
            console.log(t('added', {id: taskId(task), title: task.title}));
        }
        return;
    }

    if (command === 'list' || !command) {
        printTasks(listTasks(listOptions(parsed)), json);
        return;
    }

    if (command === 'show') {
        if (!subCommand) {
            throw new Error(t('taskRequired'));
        }
        printOneTask(findTaskByPrefix(subCommand, {includeDeleted: true}), json);
        return;
    }

    if (command === 'edit') {
        if (!subCommand) {
            throw new Error(t('taskRequired'));
        }
        const task = updateTask(subCommand, taskOptions(parsed.values));
        if (json) {
            printJson(toTaskOutput(task));
        } else {
            console.log(t('updated', {id: taskId(task)}));
        }
        return;
    }

    const statusMap = {
        done: 'done',
        reopen: 'todo',
        start: 'in-progress',
        block: 'blocked',
        archive: 'archived',
        delete: 'deleted'
    };
    if (statusMap[command]) {
        const prefixes = [subCommand, ...rest].filter(Boolean);
        const tasks = mutateMany(prefixes, prefix => setTaskStatus(prefix, statusMap[command]));
        if (json) {
            printJson(tasks.map(toTaskOutput));
        } else {
            for (const task of tasks) {
                console.log(command === 'delete' ? t('deleted', {id: taskId(task)}) : t('updated', {id: taskId(task)}));
            }
        }
        return;
    }

    if (command === 'restore') {
        const prefixes = [subCommand, ...rest].filter(Boolean);
        const tasks = mutateMany(prefixes, restoreTask);
        if (json) {
            printJson(tasks.map(toTaskOutput));
        } else {
            for (const task of tasks) {
                console.log(t('updated', {id: taskId(task)}));
            }
        }
        return;
    }

    if (command === 'purge') {
        const prefixes = [subCommand, ...rest].filter(Boolean);
        const tasks = mutateMany(prefixes, purgeTask);
        if (json) {
            printJson(tasks);
        } else {
            for (const task of tasks) {
                console.log(t('purged', {id: taskId(task)}));
            }
        }
        return;
    }

    if (command === 'checklist') {
        const taskPrefix = rest[0];
        const value = rest.slice(1).join(' ');
        if (!taskPrefix) {
            throw new Error(t('taskRequired'));
        }

        let task;
        if (subCommand === 'add') {
            task = addChecklistItem(taskPrefix, value);
        } else if (subCommand === 'done') {
            task = setChecklistItemDone(taskPrefix, value, true);
        } else if (subCommand === 'undone') {
            task = setChecklistItemDone(taskPrefix, value, false);
        } else if (subCommand === 'remove') {
            task = removeChecklistItem(taskPrefix, value);
        } else {
            throw new Error(t('unknownCommand', {command: `checklist ${subCommand || ''}`.trim()}));
        }

        printOneTask(task, json);
        return;
    }

    if (command === 'note') {
        const taskPrefix = rest[0];
        const text = rest.slice(1).join(' ');
        if (!taskPrefix) {
            throw new Error(t('taskRequired'));
        }

        if (subCommand === 'add') {
            const task = addNote(taskPrefix, text);
            printOneTask(task, json);
            return;
        }

        if (subCommand === 'list') {
            printSimpleList(listNotes(taskPrefix), json);
            return;
        }

        throw new Error(t('unknownCommand', {command: `note ${subCommand || ''}`.trim()}));
    }

    if (command === 'lists') {
        if (subCommand === 'list' || !subCommand) {
            printSimpleList(listTaskLists({all: parsed.flags.has('all')}), json);
            return;
        }

        if (subCommand === 'add') {
            const list = createTaskList(rest.join(' ') || parsed.values.title, {id: parsed.values.id});
            if (json) {
                printJson(list);
            } else {
                console.log(t('listCreated', {id: list.id}));
            }
            return;
        }

        if (subCommand === 'rename') {
            const list = renameTaskList(rest[0], rest.slice(1).join(' ') || parsed.values.title);
            if (json) {
                printJson(list);
            } else {
                console.log(t('listUpdated', {id: list.id}));
            }
            return;
        }

        if (subCommand === 'archive') {
            const list = archiveTaskList(rest[0]);
            if (json) {
                printJson(list);
            } else {
                console.log(t('listArchived', {id: list.id}));
            }
            return;
        }

        throw new Error(t('unknownCommand', {command: `lists ${subCommand}`}));
    }

    if (command === 'tags') {
        printSimpleList(getTaskTags(), json);
        return;
    }

    if (command === 'projects') {
        printSimpleList(getTaskProjects(), json);
        return;
    }

    if (command === 'stats') {
        printStats(getStats(), json);
        return;
    }

    if (['status', 'pull', 'push', 'sync', 'conflicts', 'doctor'].includes(command)) {
        printSyncResult(command, runSyncAction(command), json);
        return;
    }

    if (command === 'summary') {
        const summary = getTodoSummary();
        if (json) {
            printJson(summary);
        } else {
            console.log(t('dataDir', {dir: summary.dataDir}));
            console.log(t('configPath', {path: getTodoConfigPath()}));
            printStats(summary.stats, false);
        }
        return;
    }

    throw new Error(t('unknownCommand', {command}));
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    if (args.length === 0 || args.includes('--tui') || args.includes('-i') || args.includes('--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_TODO_TUI_TEST_ACTION) {
            printHelp();
            return;
        }

        const {startTodoTui} = await import('../lib/tui.js');
        await startTodoTui();
        return;
    }

    await runCli(args);
}

main().catch(error => {
    console.error(error.message);
    if (error.code === 'TODO_GSTORE_MISSING') {
        console.error(t('syncMissing'));
    } else if (error.code === 'TODO_GSTORE_UNBOUND') {
        console.error(t('syncUnbound', {dir: getTodoDataDir()}));
    }
    process.exit(1);
});
