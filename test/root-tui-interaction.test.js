/**
 * @file RootTuiInteractionTest
 * @project SlothTool
 * @module Test / Root TUI
 * @description 验证根管理器真实高度预算、完整详情、任务反馈、确认取消和批量部分失败的交互。
 * @logic 1. 静态渲染宽窄低窗口与空列表；2. 用隔离 HOME 和可控服务驱动 Ink 按键；3. 验证持续错误、执行键栏、卸载确认及逐目标反馈。
 * @dependencies RootTui: ../lib/tui/root-tui.js, Ink: render/renderToString, Node: assert/fs/os/path/test/stream
 * @index_tags 根TUI测试, 终端高度, 详情翻阅, 卸载确认, 任务反馈, 批量更新
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import test, {after} from 'node:test';
import React from 'react';
import {render, renderToString} from 'ink';
import {RootTuiApp} from '../lib/tui/root-tui.js';
import {getDisplayWidth} from '../lib/tui/root/format.js';
import {getFooterKeys, getViewportBudget} from '../lib/tui/root/interaction.js';
import {DetailPanel, getDetailScrollLimit, ResizePanel} from '../lib/tui/root/layout.js';
import {buildPluginItems} from '../lib/tui/root/items.js';
import {SelectionBrowserPage} from '../lib/tui/root/plugin-browser.js';
import {RunPage} from '../lib/tui/root/pages/run-page.js';

const originalHome = process.env.HOME;
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-root-interaction-'));
process.env.HOME = testHome;
const dataDir = path.join(testHome, '.pipker', 'slothtool');
fs.mkdirSync(dataDir, {recursive: true});
fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify({language: 'zh'}));

after(() => {
    process.env.HOME = originalHome;
    fs.rmSync(testHome, {recursive: true, force: true});
});

function plain(value) {
    return value.replace(/\u001b\[[0-9;?]*[a-zA-Z]/gu, '');
}

function assertWithinViewport(output, columns, rows) {
    const lines = plain(output).split('\n');
    assert.ok(lines.length <= rows, `${lines.length} lines exceed ${rows} rows`);
    for (const line of lines) {
        assert.ok(getDisplayWidth(line) <= columns, `line exceeds ${columns} columns: ${line}`);
    }
}

function writeInstalledPlugin() {
    fs.writeFileSync(path.join(dataDir, 'registry.json'), JSON.stringify({
        plugins: {
            loc: {
                name: '@holic512/plugin-loc',
                packageName: '@holic512/plugin-loc',
                version: '1.0.0',
                binPath: path.join(testHome, 'loc.js'),
                sourceType: 'github-release'
            }
        }
    }));
}

function createHarness({tab = 'home', selection = {}, feedbackEntries = [], initialStatus = null, columns = 90, rows = 18, services = {}} = {}) {
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
    stdout.on('data', chunk => frames.push(plain(chunk.toString())));
    const ink = render(React.createElement(RootTuiApp, {
        initialState: {activeTab: tab, selection, feedbackEntries},
        initialStatus,
        services,
        onExit() {}
    }), {stdin, stdout, stderr, patchConsole: false, alternateScreen: false});
    return {
        frame: () => frames.filter(frame => frame.trim()).at(-1) || '',
        async press(input) {
            stdin.write(input);
            await ink.waitUntilRenderFlush();
        },
        async settle() {
            await ink.waitUntilRenderFlush();
        },
        async close() {
            ink.unmount();
            await ink.waitUntilExit();
        }
    };
}

async function waitFor(check) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Timed out waiting for TUI state');
}

test('wide and narrow lists fit height and keep selected item visible', () => {
    const items = Array.from({length: 30}, (_, index) => ({
        id: String(index),
        title: `Plugin ${index}`,
        description: `Description ${index}`,
        fields: [{label: 'Path', value: `/very/long/path/${index}`}]
    }));
    for (const columns of [110, 56]) {
        const output = renderToString(React.createElement(SelectionBrowserPage, {
            columns,
            contentHeight: 7,
            items,
            selectedIndex: 27,
            emptyMessage: 'Empty',
            listTitle: 'Plugins',
            listSummary: '30 items'
        }), {columns});
        assertWithinViewport(output, columns, 7);
        assert.match(output, /Plugin 27/u);
        assert.match(output, /28\/30/u);
    }
});

test('tiny terminal requests resize and empty lists remain readable', () => {
    const viewport = getViewportBudget(43, 10);
    assert.equal(viewport.tooSmall, true);
    assert.equal(viewport.contentHeight, 6);
    const resize = renderToString(React.createElement(ResizePanel, {columns: 43, rows: 10}), {columns: 43});
    assert.match(resize, /终端窗口过小/u);
    assertWithinViewport(resize, 43, 10);
    const empty = renderToString(React.createElement(SelectionBrowserPage, {
        columns: 56,
        contentHeight: 7,
        items: [],
        selectedIndex: 0,
        emptyMessage: '没有已安装插件。',
        listTitle: '已安装插件'
    }), {columns: 56});
    assert.match(empty, /没有已安装插件/u);
    assertWithinViewport(empty, 56, 7);
});

test('low but supported viewport retains the selected row, status, and key bar', async () => {
    writeInstalledPlugin();
    const ui = createHarness({tab: 'run', columns: 56, rows: 11});
    try {
        await ui.settle();
        assertWithinViewport(ui.frame(), 56, 11);
        assert.match(ui.frame(), /loc/u);
        assert.match(ui.frame(), /就绪/u);
        assert.match(ui.frame(), /Enter 启动插件/u);
    } finally {
        await ui.close();
    }
});

test('key bar changes with page, help, confirmation, input and execution', () => {
    const item = {kind: 'check-updates'};
    assert.match(getFooterKeys({tab: 'update', item, view: 'page', phase: 'idle'}), /Enter 检查更新/u);
    assert.doesNotMatch(getFooterKeys({tab: 'update', item, view: 'page', phase: 'running'}), /Enter/u);
    assert.match(getFooterKeys({tab: 'update', item, view: 'help', phase: 'idle'}), /关闭帮助/u);
    assert.match(getFooterKeys({tab: 'uninstall', item, view: 'page', phase: 'idle', confirmation: {kind: 'uninstall-plugin'}}), /n\/Esc 取消/u);
    assert.match(getFooterKeys({tab: 'uninstall', item, view: 'page', phase: 'idle', confirmation: {kind: 'uninstall-all'}}), /DELETE ALL/u);
    assert.match(getFooterKeys({tab: 'run', item: {id: 'loc'}, view: 'page', phase: 'idle'}), /Enter 启动插件/u);
    const narrowKeys = getFooterKeys({tab: 'run', item: {id: 'loc'}, view: 'page', phase: 'success', feedbackCount: 2, columns: 44});
    assert.match(narrowKeys, /f 反馈/u);
    assert.ok(getDisplayWidth(narrowKeys) <= 42);
});

test('long paths and errors remain reachable through the scrolling detail view', () => {
    const longPath = `/tmp/${'nested/'.repeat(18)}archive.tgz`;
    const longError = `fetch failed: ${'network response interrupted '.repeat(12)}`;
    const lines = ['Plugin', `Path: ${longPath}`, `Source: GitHub Release`, `Reason: ${longError}`];
    const maxScroll = getDetailScrollLimit(lines, 54, 7);
    assert.ok(maxScroll > 0);
    const first = renderToString(React.createElement(DetailPanel, {
        title: 'Plugin', lines, scroll: 0, height: 7, columns: 54
    }), {columns: 54});
    const last = renderToString(React.createElement(DetailPanel, {
        title: 'Plugin', lines, scroll: maxScroll, height: 7, columns: 54
    }), {columns: 54});
    assert.match(first, /Path:/u);
    assert.match(last, /interrupted/u);
    assertWithinViewport(first, 54, 7);
    assertWithinViewport(last, 54, 7);
});

test('installed plugin details include the complete executable path', () => {
    writeInstalledPlugin();
    const item = buildPluginItems('zh').find(plugin => plugin.alias === 'loc');
    const page = RunPage({items: [item], selectedIndex: 0, columns: 56, contentHeight: 7});
    assert.equal(page.props.items[0].fields.at(-1).value, path.join(testHome, 'loc.js'));
});

test('uninstall confirmation cancels on n and Esc and full cleanup requires typed phrase', async () => {
    writeInstalledPlugin();
    let pluginCalls = 0;
    let allCalls = 0;
    const ui = createHarness({
        tab: 'uninstall',
        services: {
            uninstallPlugin() { pluginCalls += 1; return {status: 'uninstalled'}; },
            uninstallAllData() { allCalls += 1; return {removed: true}; }
        }
    });
    try {
        await ui.settle();
        await ui.press('\r');
        assert.match(ui.frame(), /确认卸载/u);
        assert.match(ui.frame(), /loc/u);
        assert.match(ui.frame(), /影响范围/u);
        await ui.press('n');
        await ui.press('y');
        assert.equal(pluginCalls, 0);
        await ui.press('\r');
        await ui.press('\u001b');
        await ui.press('y');
        assert.equal(pluginCalls, 0);
        await ui.press('\u001b[B');
        await ui.press('\r');
        assert.match(ui.frame(), /DELETE ALL/u);
        await ui.press('\r');
        await ui.press('y');
        assert.equal(allCalls, 0);
        await ui.press('n');
        await ui.press('\r');
        assert.match(ui.frame(), /输入 DELETE ALL/u);
        await ui.press('DELETE ALL');
        assert.match(ui.frame(), /Enter：DELETE ALL/u);
        await ui.press('\r');
        await waitFor(() => allCalls === 1);
    } finally {
        await ui.close();
    }
});

test('running keys match available input and batch failures persist with target reasons', async () => {
    writeInstalledPlugin();
    let releaseCheck;
    let checkCalls = 0;
    const summary = {
        outdatedCount: 2,
        errorCount: 0,
        items: [
            {targetId: 'self', kind: 'self', title: 'SlothTool', status: 'latest', currentVersion: '2.5.3', latestVersion: '2.5.3', sourceLabel: 'npm', reason: ''},
            {targetId: 'loc', kind: 'plugin', title: 'loc', status: 'outdated', currentVersion: '1.0.0', latestVersion: '1.1.0', sourceLabel: 'GitHub', reason: ''},
            {targetId: 'pzip', kind: 'plugin', title: 'pzip', status: 'outdated', currentVersion: '1.0.0', latestVersion: '1.1.0', sourceLabel: 'GitHub', reason: ''}
        ]
    };
    const ui = createHarness({
        tab: 'update',
        services: {
            checkAllUpdates() {
                checkCalls += 1;
                if (checkCalls === 1) return new Promise(resolve => { releaseCheck = () => resolve(summary); });
                return summary;
            },
            updatePlugin(alias) {
                if (alias === 'pzip') throw new Error('pzip release checksum mismatch');
                return {status: 'updated'};
            }
        }
    });
    try {
        await ui.settle();
        await ui.press('\r');
        await waitFor(() => Boolean(releaseCheck));
        assert.match(ui.frame(), /任务执行中/u);
        assert.doesNotMatch(ui.frame(), /Enter 检查更新/u);
        await ui.press('q');
        releaseCheck();
        await waitFor(() => /成功: 检查完成/u.test(ui.frame()));
        await ui.press('\u001b[B');
        await ui.press('\r');
        await waitFor(() => /部分失败/u.test(ui.frame()));
        assert.match(ui.frame(), /最近一次批量更新结果/u);
        await new Promise(resolve => setTimeout(resolve, 1700));
        assert.match(ui.frame(), /部分失败/u);
        await ui.press('f');
        assert.match(ui.frame(), /本次会话任务反馈/u);
        await ui.press('\r');
        assert.match(ui.frame(), /pzip/u);
        await ui.press('\u001b[6~');
        assert.match(ui.frame(), /checksum mismatch/u);
    } finally {
        await ui.close();
    }
});

test('an error stays visible beyond the old result timeout and remains in feedback', async () => {
    const ui = createHarness({
        tab: 'update',
        services: {checkAllUpdates() { throw new Error('release endpoint unavailable'); }}
    });
    try {
        await ui.settle();
        await ui.press('\r');
        await waitFor(() => /失败: release endpoint unavailable/u.test(ui.frame()));
        await new Promise(resolve => setTimeout(resolve, 1700));
        assert.match(ui.frame(), /失败: release endpoint unavailable/u);
        await ui.press('f');
        await ui.press('\r');
        assert.match(ui.frame(), /release endpoint unavailable/u);
    } finally {
        await ui.close();
    }
});

test('feedback survives a plugin return to the manager', async () => {
    const ui = createHarness({
        tab: 'run',
        feedbackEntries: [{id: 7, label: '检查更新', phase: 'failure', message: 'fetch failed', events: [], results: []}],
        initialStatus: {tone: 'success', message: '插件 loc 已退出'}
    });
    try {
        await ui.settle();
        await ui.press('f');
        assert.match(ui.frame(), /检查更新/u);
        assert.match(ui.frame(), /插件运行/u);
        assert.match(ui.frame(), /2\/2 条/u);
    } finally {
        await ui.close();
    }
});
