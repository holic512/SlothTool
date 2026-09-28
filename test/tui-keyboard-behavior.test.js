import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import test, {after} from 'node:test';
import React from 'react';
import {render, renderToString} from 'ink';
import {RootTuiApp} from '../lib/tui/root-tui.js';
import {LocTuiApp} from '../plugins/loc/lib/tui.js';
import {ImageCompressTuiApp} from '../plugins/image-compress/lib/tui.js';
import {GStoreTuiApp} from '../plugins/gstore/lib/tui.js';
import {PzipTuiApp} from '../plugins/pzip/lib/tui.js';
import {SlothVaultTuiApp} from '../plugins/slothvault/lib/tui.js';
import {ManagerApp} from '../plugins/slothvault/lib/manager-tui.js';

const originalHome = process.env.HOME;
const originalMaxListeners = process.getMaxListeners();
process.setMaxListeners(Math.max(20, originalMaxListeners));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-tui-keys-'));
process.env.HOME = home;
fs.mkdirSync(path.join(home, '.pipker', 'slothtool'), {recursive: true});
fs.writeFileSync(path.join(home, '.pipker', 'slothtool', 'settings.json'), JSON.stringify({language: 'zh'}));
after(() => {
    process.env.HOME = originalHome;
    process.setMaxListeners(originalMaxListeners);
    fs.rmSync(home, {recursive: true, force: true});
});

function harness(Component, props = {}, {columns = 90, rows = 24} = {}) {
    const stdin = new PassThrough();
    stdin.isTTY = true;
    stdin.setRawMode = () => {};
    stdin.ref = () => {};
    stdin.unref = () => {};
    const stdout = new PassThrough();
    stdout.isTTY = true;
    stdout.columns = columns;
    stdout.rows = rows;
    const stderr = new PassThrough();
    const frames = [];
    stdout.on('data', chunk => frames.push(chunk.toString().replace(/\u001b\[[0-9;?]*[a-zA-Z]/gu, '')));
    const ink = render(React.createElement(Component, props), {
        stdin, stdout, stderr, patchConsole: false, alternateScreen: false
    });
    return {
        frame: () => frames.filter(frame => frame.trim()).at(-1) || '',
        async press(input) {
            stdin.write(input);
            if (input === '\u001b') await new Promise(resolve => setTimeout(resolve, 45));
            await ink.waitUntilRenderFlush();
        },
        async close() {ink.unmount(); await ink.waitUntilExit();}
    };
}

async function waitForFrame(ui, pattern) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (pattern.test(ui.frame())) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.match(ui.frame(), pattern);
}

test('root Shift+Tab reverses pages and nested Esc closes help before returning Home', async () => {
    const ui = harness(RootTuiApp, {onExit() {}});
    try {
        await ui.press('\u001b[Z');
        assert.match(ui.frame(), /\[设置\]/u);
        await ui.press('?');
        assert.match(ui.frame(), /快捷键/u);
        await ui.press('\u001b');
        assert.match(ui.frame(), /\[设置\]/u);
        await ui.press('\u001b');
        assert.match(ui.frame(), /\[首页\]/u);
    } finally {await ui.close();}
});

test('loc and image-compress forms own q, y and Tab until Esc', async () => {
    const loc = harness(LocTuiApp);
    try {
        await loc.press('\u001b[B');
        await loc.press('\r');
        assert.match(loc.frame(), /目录输入/u);
        await loc.press('q');
        await loc.press('y');
        await loc.press('\t');
        assert.match(loc.frame(), /qy/u);
        assert.match(loc.frame(), /目录输入/u);
        await loc.press('\u001b');
        assert.doesNotMatch(loc.frame(), /› qy/u);
        await loc.press('\u001b[Z');
        assert.match(loc.frame(), /\[排除目录\]/u);
    } finally {await loc.close();}

    const image = harness(ImageCompressTuiApp);
    try {
        await image.press('\u001b[B');
        await image.press('\u001b[B');
        await image.press('\r');
        await image.press('q');
        await image.press('y');
        await image.press('\t');
        assert.match(image.frame(), /› qy/u);
        assert.match(image.frame(), /拖拽|路径/u);
        await image.press('\u001b');
        await image.press('\u001b[Z');
        assert.match(image.frame(), /\[历史\]/u);
    } finally {await image.close();}
});

test('image-compress option footer lists only keys available for the selected value', () => {
    const footer = index => renderToString(React.createElement(ImageCompressTuiApp, {
        initialTab: 'options', initialOptionIndex: index
    }), {columns: 120}).split('\n').filter(Boolean).at(-1);
    assert.match(footer(0), /Enter 输出目录/u);
    assert.doesNotMatch(footer(1), /Enter|Space/u);
    assert.match(footer(4), /Space/u);
    assert.doesNotMatch(footer(4), /Enter/u);
});

test('invalid path drafts stay editable with an inline error and a full-text route', async () => {
    const loc = harness(LocTuiApp);
    try {
        await loc.press('\u001b[B');
        await loc.press('\r');
        await loc.press('/this/path/does/not/exist');
        await loc.press('\r');
        await waitForFrame(loc, /目录不存在|无效目录|路径不存在/u);
        assert.match(loc.frame(), /目录输入/u);
        await loc.press('\u001b');
        await loc.press('v');
        assert.match(loc.frame(), /this\/path\/does\/not\/exist/u);
    } finally {await loc.close();}

    const image = harness(ImageCompressTuiApp);
    try {
        await image.press('\u001b[B');
        await image.press('\u001b[B');
        await image.press('\r');
        await image.press('\r');
        assert.match(image.frame(), /无效|路径/u);
        assert.match(image.frame(), /输入队列/u);
    } finally {await image.close();}
});

test('gstore requires y for overwrite and edited repository input isolates page keys', async () => {
    const ui = harness(GStoreTuiApp);
    try {
        for (let index = 0; index < 4; index += 1) await ui.press('\u001b[B');
        await ui.press('\r');
        assert.match(ui.frame(), /确认覆盖冲突文件/u);
        await ui.press('\r');
        assert.match(ui.frame(), /确认覆盖冲突文件/u);
        await ui.press('n');
        await ui.press('y');
        assert.doesNotMatch(ui.frame(), /按 y 明确确认/u);
        await ui.press('\t');
        await ui.press('\r');
        await ui.press('\u0015');
        await ui.press('q');
        await ui.press('y');
        await ui.press('\t');
        assert.match(ui.frame(), /仓库/u);
        assert.match(ui.frame(), /qy/u);
        await ui.press('\u001b');
        await ui.press('\u001b[Z');
        assert.match(ui.frame(), /\[同步\]/u);
    } finally {await ui.close();}
});

test('pzip edit, detail, and reverse tab obey the innermost layer', async () => {
    const ui = harness(PzipTuiApp, {initialSourceDirectory: home}, {columns: 60, rows: 16});
    try {
        await ui.press('s');
        await ui.press('\u0015');
        await ui.press('q');
        await ui.press('y');
        await ui.press('\t');
        assert.match(ui.frame(), /› qy/u);
        await ui.press('\u001b');
        await ui.press('\u001b[Z');
        assert.match(ui.frame(), /\[过滤规则\]/u);
        await ui.press('?');
        assert.match(ui.frame(), /快捷键/u);
        await ui.press('q');
        assert.match(ui.frame(), /快捷键/u);
        await ui.press('\u001b');
        assert.match(ui.frame(), /\[过滤规则\]/u);
    } finally {await ui.close();}
});

test('SlothVault profile form isolates page keys and never renders the typed Key', async () => {
    const ui = harness(SlothVaultTuiApp, {initialDiscovery: {tools: [], prompts: [], resourceTemplates: []}});
    try {
        for (let index = 0; index < 3; index += 1) await ui.press('\t');
        await ui.press('a');
        await ui.press('q');
        await ui.press('y');
        await ui.press('\t');
        assert.match(ui.frame(), /新增配置档案|添加配置档案|Profile/u);
        assert.match(ui.frame(), /qy/u);
        await ui.press('\u001b[B');
        await ui.press('\u001b[B');
        await ui.press('svmcp_sensitive-key');
        assert.doesNotMatch(ui.frame(), /svmcp_sensitive-key/u);
        await ui.press('\u001b');
        assert.match(ui.frame(), /配置档案/u);
    } finally {await ui.close();}
});

test('SlothVault manager requires y for deployment and cancels before later keys', async () => {
    const launched = [];
    const ui = harness(ManagerApp, {initialSetup: false,
        inspect: async root => ({state: 'absent', root, containers: []}),
        createSession(args) {
            launched.push(args);
            return {result: Promise.resolve({code: 0}), stop() {}, cancel() {}, respond() {}};
        }
    });
    try {
        await ui.press('\t');
        assert.match(ui.frame(), /\[部署\]/u);
        await ui.press('\r');
        assert.match(ui.frame(), /确认执行/u);
        await ui.press('\r');
        assert.match(ui.frame(), /确认执行/u);
        await ui.press('\u001b');
        await ui.press('y');
        assert.equal(launched.length, 0);
        await ui.press('e');
        await ui.press('\u0015');
        await ui.press('q');
        await ui.press('y');
        await ui.press('\t');
        assert.match(ui.frame(), /qy/u);
        assert.match(ui.frame(), /\[部署\]/u);
        await ui.press('\u001b');
        await ui.press('\u001b[Z');
        assert.match(ui.frame(), /\[概览\]/u);
        await ui.press('v');
        assert.match(ui.frame(), /详细信息|详情/u);
        await ui.press('\u001b');
        assert.match(ui.frame(), /\[概览\]/u);
    } finally {await ui.close();}
});

test('very small plugin windows show resize guidance without activating hidden pages', async () => {
    const mcp = harness(SlothVaultTuiApp,
        {initialDiscovery: {tools: [], prompts: [], resourceTemplates: []}}, {columns: 30, rows: 10});
    try {
        await mcp.press('\t');
        await mcp.press('a');
        assert.match(mcp.frame(), /终端空间不足/u);
        assert.doesNotMatch(mcp.frame(), /新增配置档案/u);
    } finally {await mcp.close();}
    const pzip = harness(PzipTuiApp, {initialSourceDirectory: home}, {columns: 28, rows: 7});
    try {
        await pzip.press('s');
        assert.match(pzip.frame(), /终端空间不足/u);
        assert.doesNotMatch(pzip.frame(), /输入目录路径/u);
    } finally {await pzip.close();}
});


test('first connection form asks only for URL and key and clears secret input on cancel', async () => {
    const ui = harness(SlothVaultTuiApp, {initialSetup: true});
    try {
        await waitForFrame(ui, /连接 SlothVault/u);
        assert.match(ui.frame(), /服务器地址/u);
        assert.match(ui.frame(), /访问密钥/u);
        assert.doesNotMatch(ui.frame(), /超时|设为默认/u);
        await ui.press('https://vault.example');
        await ui.press('\t');
        await ui.press('private-test-key');
        assert.doesNotMatch(ui.frame(), /private-test-key/u);
        await ui.press('\u001b');
        await ui.press('c');
        assert.doesNotMatch(ui.frame(), /private-test-key|https:\/\/vault.example/u);
    } finally { await ui.close(); }
});
