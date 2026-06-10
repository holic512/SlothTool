/**
 * @file TodoCliTest
 * @project SlothTool
 * @module Test / Todo Plugin
 * @description 验证 todo 插件的 CLI、拆分 JSON 存储、TUI 烟雾路径和 gstore 同步桥接。
 * @logic 1. 用临时 HOME 隔离 Todo 数据；2. 通过子进程运行 todo 与 gstore；3. 用本地 bare repo 验证同步和冲突停止行为。
 * @dependencies Node: assert/child_process/fs/os/path/test/url
 * @index_tags todo测试, JSON任务, gstore同步, TUI烟雾测试, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const todoBin = path.join(rootDir, 'plugins', 'todo', 'bin', 'todo.js');
const gstoreBin = path.join(rootDir, 'plugins', 'gstore', 'bin', 'gstore.js');

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-todo-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDir;
}

function runNode(filePath, args = [], env = {}) {
    return execFileSync(process.execPath, [filePath, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env
        }
    });
}

function runTodo(args = [], env = {}) {
    return runNode(todoBin, args, env);
}

function runGstore(args = [], env = {}) {
    return runNode(gstoreBin, args, env);
}

function runGit(args, cwd) {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: process.env
    });
}

function todoDataDir(homeDir) {
    return path.join(homeDir, '.slothtool', 'data', 'todo', 'default');
}

function createBareRemote() {
    const remoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-todo-remote-'));
    const remotePath = path.join(remoteRoot, 'remote.git');
    runGit(['init', '--bare', remotePath], rootDir);
    runGit(['--git-dir', remotePath, 'symbolic-ref', 'HEAD', 'refs/heads/main'], rootDir);
    return remotePath;
}

function configureRemoteClone(remotePath) {
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-todo-clone-'));
    runGit(['clone', remotePath, cloneDir], rootDir);
    runGit(['config', 'user.name', 'Todo Test'], cloneDir);
    runGit(['config', 'user.email', 'todo-test@example.invalid'], cloneDir);
    return cloneDir;
}

function prepareSyncedTodo() {
    const homeDir = createTempHome();
    const remotePath = createBareRemote();
    const task = JSON.parse(runTodo(['add', 'Initial task', '--tag', 'sync', '--json'], {HOME: homeDir}));

    runGstore(['repo', 'set', remotePath], {HOME: homeDir});
    runGstore(['bind', 'todo', 'default', todoDataDir(homeDir)], {HOME: homeDir});
    runTodo(['sync', '--json'], {
        HOME: homeDir,
        SLOTHTOOL_GSTORE_BIN: gstoreBin
    });

    return {homeDir, remotePath, task};
}

test('todo help advertises default TUI and full CLI commands', () => {
    const output = runTodo(['--help'], {HOME: createTempHome()});
    assert.match(output, /todo --tui/u);
    assert.match(output, /todo add <title>/u);
    assert.match(output, /todo checklist/u);
    assert.match(output, /todo status\|pull\|push\|sync\|conflicts\|doctor/u);
});

test('todo default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runTodo([], {
            HOME: createTempHome(),
            SLOTHTOOL_TODO_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('todo add, list, show, edit, and storage layout use split JSON files', () => {
    const homeDir = createTempHome();
    const addOutput = runTodo([
        'add',
        'Buy milk',
        '--description',
        'At the corner shop',
        '--priority',
        'high',
        '--due',
        '2026-06-12',
        '--tag',
        'home',
        '--project',
        'personal',
        '--json'
    ], {HOME: homeDir});
    const task = JSON.parse(addOutput);
    const taskPath = path.join(todoDataDir(homeDir), task.relativePath);

    assert.equal(task.title, 'Buy milk');
    assert.deepEqual(task.tags, ['home']);
    assert.equal(fs.existsSync(taskPath), true);
    assert.equal(fs.existsSync(path.join(todoDataDir(homeDir), 'lists', 'default.json')), true);
    assert.equal(fs.existsSync(path.join(homeDir, '.slothtool', 'data', 'plugin-configs', 'todo.json')), true);
    assert.match(task.relativePath, /^tasks\/\d{4}\/\d{2}\/.+\.json$/u);

    const list = JSON.parse(runTodo(['list', '--project', 'personal', '--json'], {HOME: homeDir}));
    assert.equal(list.length, 1);
    assert.equal(list[0].priority, 'high');

    const edited = JSON.parse(runTodo(['edit', task.id.slice(0, 8), '--priority', 'urgent', '--title', 'Buy oat milk', '--json'], {HOME: homeDir}));
    assert.equal(edited.priority, 'urgent');
    assert.equal(edited.title, 'Buy oat milk');

    const shown = JSON.parse(runTodo(['show', task.id.slice(0, 8), '--json'], {HOME: homeDir}));
    assert.equal(shown.id, task.id);
});

test('todo status flow supports soft delete, restore, archive, and purge', () => {
    const homeDir = createTempHome();
    const task = JSON.parse(runTodo(['add', 'Finish report', '--json'], {HOME: homeDir}));
    const prefix = task.id.slice(0, 8);
    const taskPath = path.join(todoDataDir(homeDir), task.relativePath);

    const done = JSON.parse(runTodo(['done', prefix, '--json'], {HOME: homeDir}));
    assert.equal(done[0].status, 'done');
    assert.equal(done[0].progress, 100);

    const deleted = JSON.parse(runTodo(['delete', prefix, '--json'], {HOME: homeDir}));
    assert.equal(deleted[0].status, 'deleted');
    assert.equal(JSON.parse(runTodo(['list', '--json'], {HOME: homeDir})).length, 0);
    assert.equal(JSON.parse(runTodo(['list', '--all', '--json'], {HOME: homeDir})).length, 1);

    const restored = JSON.parse(runTodo(['restore', prefix, '--json'], {HOME: homeDir}));
    assert.equal(restored[0].status, 'todo');

    const archived = JSON.parse(runTodo(['archive', prefix, '--json'], {HOME: homeDir}));
    assert.equal(archived[0].status, 'archived');

    const purged = JSON.parse(runTodo(['purge', prefix, '--json'], {HOME: homeDir}));
    assert.equal(purged[0].id, task.id);
    assert.equal(fs.existsSync(taskPath), false);
});

test('todo checklist, notes, lists, tags, projects, and stats work from CLI', () => {
    const homeDir = createTempHome();
    const task = JSON.parse(runTodo(['add', 'Plan trip', '--tag', 'travel', '--project', 'vacation', '--json'], {HOME: homeDir}));
    const prefix = task.id.slice(0, 8);

    const withChecklist = JSON.parse(runTodo(['checklist', 'add', prefix, 'Book hotel', '--json'], {HOME: homeDir}));
    assert.equal(withChecklist.checklist.length, 1);

    const checklistPrefix = withChecklist.checklist[0].id.slice(0, 8);
    const checked = JSON.parse(runTodo(['checklist', 'done', prefix, checklistPrefix, '--json'], {HOME: homeDir}));
    assert.equal(checked.checklist[0].done, true);

    const withNote = JSON.parse(runTodo(['note', 'add', prefix, 'Use refundable option', '--json'], {HOME: homeDir}));
    assert.equal(withNote.notes.length, 1);
    assert.equal(JSON.parse(runTodo(['note', 'list', prefix, '--json'], {HOME: homeDir})).length, 1);

    const list = JSON.parse(runTodo(['lists', 'add', 'Errands', '--json'], {HOME: homeDir}));
    assert.equal(list.id, 'errands');
    const renamed = JSON.parse(runTodo(['lists', 'rename', 'errands', 'Quick Errands', '--json'], {HOME: homeDir}));
    assert.equal(renamed.title, 'Quick Errands');
    assert.equal(JSON.parse(runTodo(['lists', 'list', '--json'], {HOME: homeDir})).length, 2);

    assert.deepEqual(JSON.parse(runTodo(['tags', '--json'], {HOME: homeDir})), ['travel']);
    assert.deepEqual(JSON.parse(runTodo(['projects', '--json'], {HOME: homeDir})), ['vacation']);
    const stats = JSON.parse(runTodo(['stats', '--json'], {HOME: homeDir}));
    assert.equal(stats.total, 1);
    assert.equal(stats.open, 1);
});

test('todo sync pushes split JSON task files through gstore', () => {
    const {remotePath, task} = prepareSyncedTodo();
    const cloneDir = configureRemoteClone(remotePath);
    const remoteTaskPath = path.join(cloneDir, 'todo', 'default', task.relativePath);

    assert.equal(fs.existsSync(remoteTaskPath), true);
    assert.equal(JSON.parse(fs.readFileSync(remoteTaskPath, 'utf8')).title, 'Initial task');
});

test('todo sync stops on same-file local and remote conflict without overwriting local task', () => {
    const {homeDir, remotePath, task} = prepareSyncedTodo();
    const cloneDir = configureRemoteClone(remotePath);
    const remoteTaskPath = path.join(cloneDir, 'todo', 'default', task.relativePath);

    const remoteTask = JSON.parse(fs.readFileSync(remoteTaskPath, 'utf8'));
    remoteTask.title = 'Remote title';
    fs.writeFileSync(remoteTaskPath, JSON.stringify(remoteTask, null, 2), 'utf8');
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote todo update'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    runTodo(['edit', task.id.slice(0, 8), '--title', 'Local title'], {HOME: homeDir});

    assert.throws(() => {
        runTodo(['sync', '--json'], {
            HOME: homeDir,
            SLOTHTOOL_GSTORE_BIN: gstoreBin
        });
    }, /conflict|overwrite|overwritten|冲突|覆盖/iu);

    const localTaskPath = path.join(todoDataDir(homeDir), task.relativePath);
    assert.equal(JSON.parse(fs.readFileSync(localTaskPath, 'utf8')).title, 'Local title');
});
