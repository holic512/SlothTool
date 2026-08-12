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
import {
    isReliableAuthTerminal,
    parseDeviceLoginOutput,
    resolveGhInstaller,
    resolveNoopBrowserCommand
} from '../plugins/gstore/lib/gh.js';
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
    runGstore(['bind', 'sample', 'default', localDir], {HOME: homeDir});

    return {homeDir, remotePath, localDir};
}

test('gstore help advertises CLI commands and default TUI', () => {
    const output = runGstore(['--help'], {HOME: createTempHome()});
    assert.match(output, /gstore --tui/u);
    assert.match(output, /gstore auth.*一次性代码/u);
    assert.match(output, /gstore repo set/u);
    assert.match(output, /gstore sync/u);
});

test('gstore refuses data transfer until a remote repository is configured', () => {
    const homeDir = createTempHome();
    assert.throws(() => runGstore(['pull'], {HOME: homeDir}), /Remote repository is not configured/u);
    assert.throws(() => runGstore(['push'], {HOME: homeDir}), /Remote repository is not configured/u);
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

    assert.equal(bindings.length, 4);
    assert.deepEqual(bindings.filter(binding => binding.system).map(binding => `${binding.tool}/${binding.name}`).sort(), [
        'slothtool/data',
        'slothtool/plugin-configs',
        'slothtool/settings'
    ]);
    const customBinding = bindings.find(binding => binding.tool === 'sample');
    assert.equal(customBinding.name, 'default');
    assert.equal(customBinding.localPath, localDir);

    const statusOutput = runGstore(['status', 'sample', 'default', '--json'], {HOME: homeDir});
    const status = JSON.parse(statusOutput);
    assert.deepEqual(status.localChanges, ['item.json']);
    assert.deepEqual(status.remoteChanges, []);
    assert.deepEqual(status.conflicts, []);
});

test('gstore push and pull synchronize JSON files through git', () => {
    const {homeDir, remotePath, localDir} = prepareBoundRepo();

    const pushOutput = runGstore(['push', 'sample', 'default', '-m', 'sync test', '--json'], {HOME: homeDir});
    const pushResult = JSON.parse(pushOutput);
    assert.equal(pushResult.status, 'pushed');
    assert.ok(pushResult.commit);

    const cloneDir = configureRemoteClone(remotePath);
    const remoteFile = path.join(cloneDir, 'sample', 'default', 'item.json');
    fs.writeFileSync(remoteFile, JSON.stringify({title: 'v2'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote update'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    const pullOutput = runGstore(['pull', 'sample', 'default', '--json'], {HOME: homeDir});
    const pullResult = JSON.parse(pullOutput);
    assert.equal(pullResult.status, 'pulled');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(localDir, 'item.json'), 'utf8')), {title: 'v2'});
});

test('gstore detects same-file local and remote conflicts without overwriting local data', () => {
    const {homeDir, remotePath, localDir} = prepareBoundRepo();
    runGstore(['push', 'sample', 'default', '-m', 'initial'], {HOME: homeDir});

    const cloneDir = configureRemoteClone(remotePath);
    const remoteFile = path.join(cloneDir, 'sample', 'default', 'item.json');
    fs.writeFileSync(remoteFile, JSON.stringify({title: 'remote'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote conflict'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    const localFile = path.join(localDir, 'item.json');
    fs.writeFileSync(localFile, JSON.stringify({title: 'local'}, null, 2));

    const statusOutput = runGstore(['status', 'sample', 'default', '--json'], {HOME: homeDir});
    const status = JSON.parse(statusOutput);
    assert.deepEqual(status.conflicts, ['item.json']);
    assert.deepEqual(JSON.parse(fs.readFileSync(localFile, 'utf8')), {title: 'local'});
});

test('gstore system sync caches settings, plugin configs, and data without leaking gstore state', () => {
    const homeDir = createTempHome();
    const remotePath = createBareRemote();
    const slothDir = path.join(homeDir, '.slothtool');
    const pluginConfigsDir = path.join(slothDir, 'plugin-configs');
    const dataDir = path.join(slothDir, 'data', 'sample');
    fs.mkdirSync(pluginConfigsDir, {recursive: true});
    fs.mkdirSync(dataDir, {recursive: true});
    fs.writeFileSync(path.join(pluginConfigsDir, 'loc.json'), JSON.stringify({verbose: true}, null, 2));
    fs.writeFileSync(path.join(dataDir, 'item.json'), JSON.stringify({value: 1}, null, 2));

    runGstore(['repo', 'set', remotePath], {HOME: homeDir});
    const result = JSON.parse(runGstore(['sync', '--json'], {HOME: homeDir}));
    assert.equal(result.status, 'synced');
    assert.equal(result.pushed.status, 'pushed');

    const cloneDir = configureRemoteClone(remotePath);
    assert.equal(fs.existsSync(path.join(cloneDir, 'system', 'settings', 'settings.json')), true);
    assert.equal(fs.existsSync(path.join(cloneDir, 'system', 'plugin-configs', 'loc.json')), true);
    assert.equal(fs.existsSync(path.join(cloneDir, 'system', 'data', 'sample', 'item.json')), true);
    assert.equal(fs.existsSync(path.join(cloneDir, 'system', 'plugin-configs', 'gstore.json')), false);
    assert.equal(fs.existsSync(path.join(slothDir, 'data', '.git')), false);
    assert.equal(fs.existsSync(path.join(slothDir, 'cache', 'gstore', 'repository', '.git')), true);
});

test('gstore system sync requires an explicit strategy before resolving conflicts', () => {
    const homeDir = createTempHome();
    const remotePath = createBareRemote();
    const settingsPath = path.join(homeDir, '.slothtool', 'settings.json');
    runGstore(['repo', 'set', remotePath], {HOME: homeDir});
    runGstore(['sync'], {HOME: homeDir});

    const cloneDir = configureRemoteClone(remotePath);
    fs.writeFileSync(path.join(cloneDir, 'system', 'settings', 'settings.json'), JSON.stringify({language: 'en'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote settings'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);
    fs.writeFileSync(settingsPath, JSON.stringify({language: 'zh', marker: 'local'}, null, 2));

    assert.throws(() => runGstore(['sync'], {HOME: homeDir}), /Conflicts detected/u);
    const resolved = JSON.parse(runGstore(['sync', '--prefer-remote', '--json'], {HOME: homeDir}));
    assert.equal(resolved.status, 'synced');
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {language: 'en'});
});

test('prefer-local resolves conflicts without discarding unrelated remote changes', () => {
    const homeDir = createTempHome();
    const remotePath = createBareRemote();
    const slothDir = path.join(homeDir, '.slothtool');
    const settingsPath = path.join(slothDir, 'settings.json');
    const localDataPath = path.join(slothDir, 'data', 'remote-only.json');
    runGstore(['repo', 'set', remotePath], {HOME: homeDir});
    runGstore(['sync'], {HOME: homeDir});

    const cloneDir = configureRemoteClone(remotePath);
    fs.writeFileSync(path.join(cloneDir, 'system', 'settings', 'settings.json'), JSON.stringify({language: 'en'}, null, 2));
    fs.mkdirSync(path.join(cloneDir, 'system', 'data'), {recursive: true});
    fs.writeFileSync(path.join(cloneDir, 'system', 'data', 'remote-only.json'), JSON.stringify({remote: true}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'remote conflict and independent data'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);
    fs.writeFileSync(settingsPath, JSON.stringify({language: 'zh', marker: 'keep-local'}, null, 2));

    runGstore(['sync', '--prefer-local'], {HOME: homeDir});
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {language: 'zh', marker: 'keep-local'});
    assert.deepEqual(JSON.parse(fs.readFileSync(localDataPath, 'utf8')), {remote: true});

    const verificationClone = configureRemoteClone(remotePath);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(verificationClone, 'system', 'settings', 'settings.json'), 'utf8')), {language: 'zh', marker: 'keep-local'});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(verificationClone, 'system', 'data', 'remote-only.json'), 'utf8')), {remote: true});
});

test('gstore restores system configuration into a fresh second device', () => {
    const sourceHome = createTempHome();
    const remotePath = createBareRemote();
    const sourceSlothDir = path.join(sourceHome, '.slothtool');
    fs.mkdirSync(path.join(sourceSlothDir, 'plugin-configs'), {recursive: true});
    fs.mkdirSync(path.join(sourceSlothDir, 'data', 'sample'), {recursive: true});
    fs.writeFileSync(path.join(sourceSlothDir, 'settings.json'), JSON.stringify({language: 'en'}, null, 2));
    fs.writeFileSync(path.join(sourceSlothDir, 'plugin-configs', 'loc.json'), JSON.stringify({verbose: true}, null, 2));
    fs.writeFileSync(path.join(sourceSlothDir, 'data', 'sample', 'state.json'), JSON.stringify({synced: true}, null, 2));
    runGstore(['repo', 'set', remotePath], {HOME: sourceHome});
    runGstore(['sync'], {HOME: sourceHome});

    const targetHome = createTempHome();
    runGstore(['repo', 'set', remotePath], {HOME: targetHome});
    const pull = JSON.parse(runGstore(['pull', '--prefer-remote', '--json'], {HOME: targetHome}));
    assert.equal(pull.status, 'pulled');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetHome, '.slothtool', 'settings.json'), 'utf8')), {language: 'en'});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetHome, '.slothtool', 'plugin-configs', 'loc.json'), 'utf8')), {verbose: true});
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(targetHome, '.slothtool', 'data', 'sample', 'state.json'), 'utf8')), {synced: true});
});

test('gstore never restores its own machine-specific state from a remote archive', () => {
    const sourceHome = createTempHome();
    const remotePath = createBareRemote();
    runGstore(['repo', 'set', remotePath], {HOME: sourceHome});
    runGstore(['sync'], {HOME: sourceHome});

    const cloneDir = configureRemoteClone(remotePath);
    const leakedState = path.join(cloneDir, 'system', 'plugin-configs', 'gstore.json');
    fs.mkdirSync(path.dirname(leakedState), {recursive: true});
    fs.writeFileSync(leakedState, JSON.stringify({remote: 'https://untrusted.example/repo.git'}, null, 2));
    runGit(['add', '--all'], cloneDir);
    runGit(['commit', '-m', 'legacy leaked state'], cloneDir);
    runGit(['push', 'origin', 'main'], cloneDir);

    const targetHome = createTempHome();
    runGstore(['repo', 'set', remotePath], {HOME: targetHome});
    runGstore(['pull', '--prefer-remote'], {HOME: targetHome});
    const localState = JSON.parse(fs.readFileSync(path.join(targetHome, '.slothtool', 'plugin-configs', 'gstore.json'), 'utf8'));
    assert.equal(localState.remote, remotePath);
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

test('gstore parses GitHub CLI device login output for manual auth guidance', () => {
    const login = parseDeviceLoginOutput('! First copy your one-time code: A3F2-0DBE\nPress Enter to open https://github.com/login/device in your browser...');
    const noopBrowser = resolveNoopBrowserCommand();

    assert.equal(login.code, 'A3F2-0DBE');
    assert.equal(login.url, 'https://github.com/login/device');
    assert.ok(fs.existsSync(noopBrowser));
    assert.equal(isReliableAuthTerminal({reliableTerminal: false}), false);
    assert.equal(isReliableAuthTerminal({reliableTerminal: true}), true);
});
