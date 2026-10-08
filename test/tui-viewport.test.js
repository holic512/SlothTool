import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {stripVTControlCharacters} from 'node:util';
import test, {after} from 'node:test';
import React from 'react';
import {render, renderToString} from 'ink';
import {RootTuiApp} from '../lib/tui/root-tui.js';
import {HomePage, getHomeLayout} from '../lib/tui/root/pages/home-page.js';
import {LocTuiApp} from '../plugins/loc/lib/tui.js';
import {ImageCompressTuiApp} from '../plugins/image-compress/lib/tui.js';
import {GStoreTuiApp} from '../plugins/gstore/lib/tui.js';
import {PzipTuiApp} from '../plugins/pzip/lib/tui.js';
import {ManagerApp} from '../plugins/slothvault/lib/manager-tui.js';
import {getDisplayWidth, getShellLayout, getDetailWindow} from '../lib/tui/shared-interaction.js';
import {TuiHeader, TuiRow} from '../lib/tui/shared-layout.js';

const originalHome = process.env.HOME;
const originalAction = process.env.SLOTHTOOL_TUI_TEST_ACTION;
const originalMaxListeners = process.getMaxListeners();
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-viewport-'));
const data = path.join(home, '.pipker', 'slothtool');
process.env.HOME = home;
process.env.SLOTHTOOL_TUI_TEST_ACTION = 'render';
process.setMaxListeners(Math.max(100, originalMaxListeners));
fs.mkdirSync(data, {recursive: true});
after(() => {
    process.env.HOME = originalHome;
    if (originalAction === undefined) delete process.env.SLOTHTOOL_TUI_TEST_ACTION;
    else process.env.SLOTHTOOL_TUI_TEST_ACTION = originalAction;
    process.setMaxListeners(originalMaxListeners);
    fs.rmSync(home, {recursive: true, force: true});
});

function harness(Component, props, columns, rows) {
    const stdin = new PassThrough();
    Object.assign(stdin, {isTTY: true, setRawMode() {}, ref() {}, unref() {}});
    const stdout = new PassThrough();
    Object.assign(stdout, {isTTY: true, columns, rows});
    const stderr = new PassThrough();
    let frame = '';
    stdout.on('data', chunk => {
        const text = stripVTControlCharacters(chunk.toString());
        if (text.trim()) frame = text;
    });
    const ink = render(React.createElement(Component, props), {stdin, stdout, stderr,
        patchConsole: false, alternateScreen: false});
    return {
        frame: () => frame,
        async settle() {await ink.waitUntilRenderFlush();},
        async press(key) {
            stdin.write(key);
            if (key === '\u001b') await new Promise(resolve => setTimeout(resolve, 45));
            await ink.waitUntilRenderFlush();
        },
        async resize(nextColumns, nextRows) {
            stdout.columns = nextColumns;
            stdout.rows = nextRows;
            stdout.emit('resize');
            await new Promise(resolve => setImmediate(resolve));
            await ink.waitUntilRenderFlush();
        },
        async close() {ink.unmount(); await ink.waitUntilExit();}
    };
}

function assertFrame(frame, columns, rows, label) {
    const lines = frame.replace(/\n$/u, '').split('\n');
    assert.ok(lines.length <= rows, `${label}: ${lines.length} > ${rows}\n${frame}`);
    for (const line of lines) assert.ok(getDisplayWidth(line) <= columns, `${label}: wide line ${line}`);
    assert.equal((frame.match(/╭/gu) || []).length, (frame.match(/╰/gu) || []).length, `${label}: panel bottom was clipped\n${frame}`);
    assert.match(lines.filter(line => line.trim()).at(-1), /q|Esc|退出|返回|扩大|resize/iu, `${label}: footer missing\n${frame}`);
    assert.doesNotMatch(frame, /(?:tui|manager)\.[a-z]+\.[a-z]+/u, `${label}: untranslated key`);
}

const surfaces = [
    ['root', RootTuiApp, {onExit() {}}, 6, [44, 11]],
    ['loc', LocTuiApp, {}, 3, [30, 14]],
    ['image', ImageCompressTuiApp, {}, 3, [30, 14]],
    ['gstore', GStoreTuiApp, {}, 4, [30, 14]],
    ['pzip', PzipTuiApp, {initialSourceDirectory: home}, 2, [30, 8]],
    ['manager', ManagerApp, {initialSetup: false, inspect: async root => ({state: 'absent', root, containers: []})}, 3, [30, 18]]
];

for (const language of ['zh', 'en']) {
    test(`all TUI pages fit wide, narrow and minimum ${language} terminals`, async () => {
        fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify({language}));
        for (const [name, Component, props, pageCount, minimum] of surfaces) {
            for (const [columns, rows] of [[120, 32], [90, 24], [80, 24], [60, 18], minimum]) {
                const ui = harness(Component, props, columns, rows);
                try {
                    await ui.settle();
                    for (let page = 0; page < pageCount; page += 1) {
                        if (page) await ui.press('\t');
                        assertFrame(ui.frame(), columns, rows, `${name}/${language}/${page}/${columns}×${rows}`);
                    }
                    if (name !== 'pzip') {
                        await ui.press('v');
                        assertFrame(ui.frame(), columns, rows, `${name}/details`);
                    }
                } finally {await ui.close();}
            }
        }
    });
}

test('narrow image action rows never overlap and every selected action remains visible', async () => {
    fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify({language: 'zh'}));
    const ui = harness(ImageCompressTuiApp, {}, 40, 16);
    try {
        await ui.settle();
        for (const label of ['开始压缩', '加入当前目录', '手动输入', '清空源路径', '打开选项页', '退出']) {
            assert.match(ui.frame(), new RegExp(`› ${label}`, 'u'));
            assertFrame(ui.frame(), 40, 16, label);
            await ui.press('\u001b[B');
        }
        await ui.press('\t');
        await ui.press('\r');
        await ui.press('/tmp/很长的目录/👩🏽‍💻/'.repeat(8));
        assert.match(ui.frame(), /█/u);
        await ui.resize(30, 14);
        assertFrame(ui.frame(), 30, 14, 'output editor');
        assert.match(ui.frame(), /█/u);
    } finally {await ui.close();}
});

test('details reflow after resize and can reach the end of long original lines', async () => {
    const longPath = '/packages/' + '中👩🏽‍💻'.repeat(80) + '/FINAL_DESCRIPTION';
    const ui = harness(ManagerApp, {services: {getComponentStatus: module => ({module, state: 'missing', path: longPath, currentVersion: null})}}, 90, 24);
    try {
        await ui.settle();
        await ui.press('\t');
        await ui.press('v');
        await ui.resize(40, 18);
        let all = ui.frame();
        for (let index = 0; index < 35; index += 1) {
            await ui.press('\u001b[6~');
            assertFrame(ui.frame(), 40, 18, 'resized details');
            all += ui.frame();
        }
        assert.match(all.replace(/[│\s]/gu, ''), /FINAL_DESCRIPTION/u);
        await ui.resize(120, 32);
        assertFrame(ui.frame(), 120, 32, 'expanded details');
        assert.match(ui.frame().replace(/[│\s]/gu, ''), /FINAL_DESCRIPTION/u);
    } finally {await ui.close();}
});

test('home keeps the selected shortcut in view and centers logo and actions together', () => {
    const items = Array.from({length: 4}, (_, index) => ({id: String(index), title: `Plugin ${index}`}));
    const small = getHomeLayout(44, 6, items.length, 3);
    assert.equal(small.showArt, false);
    assert.ok(small.window.start <= 3 && small.window.end > 3);
    const frame = renderToString(React.createElement(HomePage, {items, selectedIndex: 3, columns: 120, contentHeight: 24}), {columns: 120});
    assert.match(frame, /› Plugin 3/u);
    const logoLine = frame.split('\n').find(line => line.includes('███████'));
    assert.ok(logoLine);
    const leading = logoLine.length - logoLine.trimStart().length;
    assert.ok(Math.abs(leading - (120 - getDisplayWidth(logoLine.trim())) / 2) <= 1);
});

test('shared shell budgets rows and retains distinct tab and metadata styling', () => {
    const single = getShellLayout(120, 32, {status: 'Ready', keys: 'Tab/Shift+Tab · Enter · q'});
    const double = getShellLayout(60, 18, {status: 'Failure '.repeat(15), keys: 'Enter retry | v details | q quit'});
    assert.equal(single.footerRows, 1);
    assert.equal(double.footerRows, 2);
    for (const shell of [single, double]) {
        assert.equal(shell.paddingY * 2 + 2 + shell.gap * 2 + shell.contentHeight + shell.footerRows, shell.height);
    }
    const header = TuiHeader({tabs: [{id: 'home', label: 'Home'}, {id: 'run', label: 'Run'}], activeTab: 'run', width: 80, meta: 'v2.5.6'});
    const nodes = React.Children.toArray(header.props.children);
    assert.equal(nodes.find(node => node.props?.children === '[Run]').props.color, 'cyanBright');
    assert.equal(nodes.find(node => node.props?.children === 'Home').props.color, 'gray');
    const row = renderToString(React.createElement(TuiRow, {left: '› 中文标题', right: 'READY', width: 24}), {columns: 24});
    assert.ok(getDisplayWidth(row) <= 24);
    assert.match(row, /READY$/u);
    const detail = getDetailWindow(['word '.repeat(200) + 'FINAL'], 999, 44, 11);
    assert.match(detail.lines.join(''), /FINAL/u);
});
