/**
 * @file RootCliSmokeTest
 * @project SlothTool
 * @module Test / Root CLI
 * @description 验证根命令的帮助输出、默认 TUI 烟雾路径以及插件简写 CLI 路径。
 * @logic 1. 构造临时 HOME 隔离用户数据；2. 通过 Node 子进程执行根入口；3. 校验默认 TUI 与插件简写行为。
 * @dependencies Node: assert/child_process/fs/os/path/test/url
 * @index_tags 根CLI测试, TUI烟雾测试, 插件简写, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {startRootTui} from '../lib/tui/root-tui.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const rootBin = path.join(rootDir, 'bin', 'slothtool.js');
const locBin = path.join(rootDir, 'plugins', 'loc', 'bin', 'loc.js');
const gstoreBin = path.join(rootDir, 'plugins', 'gstore', 'bin', 'gstore.js');
const todoBin = path.join(rootDir, 'plugins', 'todo', 'bin', 'todo.js');

function createTempHome(withLocalLoc = false, withLocalGstore = false, withLocalTodo = false) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));

    const registry = {
        plugins: {}
    };

    if (withLocalLoc) {
        registry.plugins.loc = {
            name: '@holic512/plugin-loc',
            packageName: '@holic512/plugin-loc',
            version: 'workspace',
            binPath: locBin,
            installedAt: '2026-05-30T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalGstore) {
        registry.plugins.gstore = {
            name: '@holic512/plugin-gstore',
            packageName: '@holic512/plugin-gstore',
            version: 'workspace',
            binPath: gstoreBin,
            installedAt: '2026-06-11T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalTodo) {
        registry.plugins.todo = {
            name: '@holic512/plugin-todo',
            packageName: '@holic512/plugin-todo',
            version: 'workspace',
            binPath: todoBin,
            installedAt: '2026-06-11T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    fs.writeFileSync(path.join(slothDir, 'registry.json'), JSON.stringify(registry, null, 2));
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

test('root help advertises the TUI-first entry', () => {
    const output = runNode(rootBin, ['--help'], {HOME: createTempHome(false)});
    assert.match(output, /slothtool tui/u);
    assert.match(output, /slothtool\s+loc/u);
    assert.match(output, /slothtool config proxy show/u);
});

test('root default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('root default entry can render with an empty initial TUI snapshot', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'render-exit'
        });
    });
});

test('root TUI startup tolerates a null options object', async () => {
    const previousAction = process.env.SLOTHTOOL_TUI_TEST_ACTION;
    process.env.SLOTHTOOL_TUI_TEST_ACTION = 'exit';

    try {
        const result = await startRootTui(null);
        assert.deepEqual(result, {type: 'exit'});
    } finally {
        if (previousAction === undefined) {
            delete process.env.SLOTHTOOL_TUI_TEST_ACTION;
        } else {
            process.env.SLOTHTOOL_TUI_TEST_ACTION = previousAction;
        }
    }
});

test('root default entry can restart itself through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'restart-self'
        });
    });
});

test('root self-update style restart does not background-detach the replacement TUI', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'self-update-restart'
        });
    });
});

test('root manager relaunches after plugin exit and restores the TUI snapshot', () => {
    const output = runNode(rootBin, [], {
        HOME: createTempHome(true),
        SLOTHTOOL_TUI_TEST_ACTION: 'run-plugin-return',
        SLOTHTOOL_LOC_TUI_TEST_ACTION: 'exit'
    });

    assert.match(output, /TUI_TEST_RESTORED_STATE:/u);
    assert.match(output, /"activeTab":"run"/u);
    assert.match(output, /"run":0/u);
});

test('root shorthand runs the local loc workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['loc', '.'], {HOME: createTempHome(true)});
    assert.match(output, /总文件数/u);
    assert.match(output, /总行数/u);
});

test('root shorthand runs the local gstore workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['gstore', '--help'], {HOME: createTempHome(false, true)});
    assert.match(output, /gstore repo set/u);
    assert.match(output, /gstore sync/u);
});

test('root shorthand runs the local todo workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['todo', '--help'], {HOME: createTempHome(false, false, true)});
    assert.match(output, /todo add <title>/u);
    assert.match(output, /todo sync/u);
});
