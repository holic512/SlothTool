/**
 * @file TemplateBasicCliSmokeTest
 * @project SlothTool
 * @module Test / Template Plugin
 * @description 验证模板插件的帮助输出、默认 TUI 烟雾路径和最小 CLI 命令行为。
 * @logic 1. 构造临时 HOME 隔离模板配置；2. 通过子进程运行模板入口；3. 校验默认 TUI 与示例命令输出。
 * @dependencies Node: assert/child_process/fs/os/path/test/url
 * @index_tags 模板插件测试, TUI烟雾测试, scaffold, node:test
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
const templateBin = path.join(rootDir, 'plugins', 'template-basic', 'bin', 'mytool.js');

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-template-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDir;
}

function runTemplate(args = [], env = {}) {
    return execFileSync(process.execPath, [templateBin, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env
        }
    });
}

test('template plugin help advertises the default TUI entry', () => {
    const output = runTemplate(['--help'], {HOME: createTempHome()});
    assert.match(output, /mytool --tui/u);
    assert.match(output, /启动默认全屏 TUI/u);
});

test('template plugin default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runTemplate([], {
            HOME: createTempHome(),
            SLOTHTOOL_TEMPLATE_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('template plugin hello command prints the sample output', () => {
    const output = runTemplate(['hello'], {HOME: createTempHome()});
    assert.match(output, /Hello from template-basic/u);
});
