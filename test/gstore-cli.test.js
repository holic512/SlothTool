/**
 * @file GStoreCliTest
 * @project SlothTool
 * @module Test / GStore Plugin
 * @description 验证 gstore 插件的 CLI、TUI 烟雾路径、本地 Git 同步和冲突检测。
 * @logic 1. 用临时 HOME 和 bare git repo 隔离同步环境；2. 通过子进程运行 gstore CLI；3. 覆盖 gh 安装选择与网络错误分类。
 * @dependencies Node: assert/child_process/fs/os/path/test/url, Service: ../plugins/gstore/lib/service.js, GH: ../plugins/gstore/lib/gh.js
 * @index_tags gstore测试, GitHub同步, bare repo, 冲突检测, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {resolveGhInstaller} from '../plugins/gstore/lib/gh.js';
import {classifyError} from '../plugins/gstore/lib/service.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const gstoreBin = path.join(rootDir, 'plugins', 'gstore', 'bin', 'gstore.js');

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-gstore-home-'));
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

function createBareRemote() {
    const remoteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-gstore-remote-'));
    const remotePath = path.join(remoteRoot, 'remote.git');
    runGit(['init', '--bare', remotePath], rootDir);
    runGit(['--git-dir', remotePath, 'symbolic-ref', 'HEAD', 'refs/heads/main'], rootDir);
    return remotePath;
}

function configureRemoteClone(remotePath) {
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-gstore-clone-'));
    runGit(['clone', remotePath, cloneDir], rootDir);
    runGit(['config', 'user.name', 'GStore Test'], cloneDir);
    runGit(['config', 'user.email', 'gstore-test@example.invalid'], cloneDir);
    return cloneDir;
}

function prepareBoundRepo() {
    const homeDir = createTempHome();
    const remotePath = createBareRemote();
    const localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-gstore-local-'));
    fs.writeFileSync(path.join(localDir, 'item.json'), JSON.stringify({title: 'v1'}, null, 2));

    runGstore(['repo', 'set', remotePath], {HOME: homeDir});
    runGstore(['bind', 'todo', 'default', localDir], {HOME: homeDir});

    return {homeDir, remotePath, localDir};
}

test('gstore help advertises CLI commands and default TUI', () => {
    const output = runGstore(['--help'], {HOME: createTempHome()});
    assert.match(output, /gstore --tui/u);
    assert.match(output, /gstore repo set/u);
    assert.match(output, /gstore sync/u);
});

test('gstore default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runGstore([], {
            HOME: createTempHome(),
            SLOTHTOOL_GSTORE_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('gstore repo set, bind, list, and status work with a local bare remote', () => {
    const {homeDir, localDir} = prepareBoundRepo();
    const listOutput = runGstore(['list', '--json'], {HOME: homeDir});
    const bindings = JSON.parse(listOutput);

    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].tool, 'todo');
    assert.equal(bindings[0].name, 'default');
    assert.equal(bindings[0].localPath, localDir);

    const statusOutput = runGstore(['status', 'todo', 'default', '--json'], {HOME: homeDir});
    const status = JSON.parse(statusOutput);
    assert.deepEqual(status.localChanges, ['item.json']);
    assert.deepEqual(status.remoteChanges, []);
    assert.deepEqual(status.conflicts, []);
});

test('gstore push and pull synchronize JSON files through git', () => {
    const {homeDir, remotePath, localDir} = prepareBoundRepo();

    const pushOutput = runGstore(['push', 'todo', 'default', '-m', 'sync test', '--json'], {HOME: homeDir});
    const pushResult = JSON.parse(pushOutput);
    assert.equal(pushResult.status, 'pushed');
    assert.ok(pushResult.commit);

    const cloneDir = configureRemoteClone(remotePath);
    const remoteFile = path.join(cloneDir, 'todo', 'default', 'item.json');
    fs.writeFileSync(remoteFile, JSON.stringify({title: 'v2'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote update'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    const pullOutput = runGstore(['pull', 'todo', 'default', '--json'], {HOME: homeDir});
    const pullResult = JSON.parse(pullOutput);
    assert.equal(pullResult.status, 'pulled');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(localDir, 'item.json'), 'utf8')), {title: 'v2'});
});

test('gstore detects same-file local and remote conflicts without overwriting local data', () => {
    const {homeDir, remotePath, localDir} = prepareBoundRepo();
    runGstore(['push', 'todo', 'default', '-m', 'initial'], {HOME: homeDir});

    const cloneDir = configureRemoteClone(remotePath);
    const remoteFile = path.join(cloneDir, 'todo', 'default', 'item.json');
    fs.writeFileSync(remoteFile, JSON.stringify({title: 'remote'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote conflict'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    const localFile = path.join(localDir, 'item.json');
    fs.writeFileSync(localFile, JSON.stringify({title: 'local'}, null, 2));

    const statusOutput = runGstore(['status', 'todo', 'default', '--json'], {HOME: homeDir});
    const status = JSON.parse(statusOutput);
    assert.deepEqual(status.conflicts, ['item.json']);
    assert.deepEqual(JSON.parse(fs.readFileSync(localFile, 'utf8')), {title: 'local'});
});

test('gstore gh installer selection and error classification are deterministic', () => {
    const macInstaller = resolveGhInstaller({
        platform: 'darwin',
        commandExists: command => command === 'brew'
    });
    const windowsInstaller = resolveGhInstaller({
        platform: 'win32',
        commandExists: command => command === 'winget'
    });

    assert.equal(macInstaller.command, 'brew');
    assert.equal(windowsInstaller.command, 'winget');
    assert.equal(classifyError(new Error('Could not resolve host: github.com')), 'network');
    assert.equal(classifyError(new Error('Authentication failed')), 'auth');
    assert.equal(classifyError(new Error('Updates were rejected because the remote contains work')), 'push-rejected');
});
