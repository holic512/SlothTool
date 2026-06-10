/**
 * @file LocCliSmokeTest
 * @project SlothTool
 * @module Test / LOC Plugin
 * @description 验证 loc 插件的配置命令、默认 TUI 烟雾路径和显式 CLI 统计输出。
 * @logic 1. 构造独立 HOME 保存 loc 配置；2. 通过子进程运行插件入口；3. 校验配置落盘与统计摘要输出。
 * @dependencies Node: assert/child_process/fs/os/path/test/url
 * @index_tags loc测试, 配置命令, TUI烟雾测试, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const locBin = path.join(rootDir, 'plugins', 'loc', 'bin', 'loc.js');

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-loc-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDir;
}

function runLoc(args = [], env = {}) {
    return execFileSync(process.execPath, [locBin, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env
        }
    });
}

test('loc config commands update the saved config state', () => {
    const homeDir = createTempHome();
    runLoc(['config', 'ext', 'md', 'off'], {HOME: homeDir});
    const output = runLoc(['--config'], {HOME: homeDir});
    const migratedConfigPath = path.join(homeDir, '.slothtool', 'data', 'plugin-configs', 'loc.json');
    assert.match(output, /"md": false/u);
    assert.equal(fs.existsSync(migratedConfigPath), true);
});

test('loc config migrates the legacy plugin-configs path into data', () => {
    const homeDir = createTempHome();
    const legacyConfigDir = path.join(homeDir, '.slothtool', 'plugin-configs');
    const legacyConfigPath = path.join(legacyConfigDir, 'loc.json');
    const migratedConfigPath = path.join(homeDir, '.slothtool', 'data', 'plugin-configs', 'loc.json');

    fs.mkdirSync(legacyConfigDir, {recursive: true});
    fs.writeFileSync(legacyConfigPath, JSON.stringify({
        fileExtensions: {md: false},
        excludeDirectories: {}
    }, null, 2));

    const output = runLoc(['--config'], {HOME: homeDir});
    assert.match(output, /"md": false/u);
    assert.equal(fs.existsSync(migratedConfigPath), true);
    assert.equal(fs.existsSync(legacyConfigPath), false);
});

test('loc default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runLoc([], {
            HOME: createTempHome(),
            SLOTHTOOL_LOC_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('loc help advertises the default TUI entry', () => {
    const output = runLoc(['--help'], {HOME: createTempHome()});
    assert.match(output, /loc --tui/u);
    assert.match(output, /loc\s+进入默认 TUI/u);
});

test('loc CLI count prints the structured summary', () => {
    const output = runLoc(['.'], {HOME: createTempHome()});
    assert.match(output, /总文件数/u);
    assert.match(output, /总行数/u);
});
