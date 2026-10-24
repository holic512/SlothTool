/**
 * @file RootSkillTuiTest
 * @project SlothTool
 * @module Test / Root TUI Skill Settings
 * @description 用隔离 HOME 和注入服务验证内置 Skill 的设置页状态、真实按键操作、确认与持久反馈。
 * @logic 枚举状态权限；驱动 Ink 安装更新与卸载确认；覆盖失败、回滚、清理警告、双语及窄屏详情。
 * @dependencies node:test/assert/fs/os/path/stream, React/Ink, RootTuiApp
 * @index_tags 根TUI, Skill, Agent, 隔离测试, 确认, 反馈
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
import settings from '../lib/settings.js';
import i18n, {t} from '../lib/i18n.js';
import {buildSettingsItems} from '../lib/tui/root/items.js';
import {buildItemDetailLines, getFooterKeys} from '../lib/tui/root/interaction.js';
import {getDisplayWidth} from '../lib/tui/root/format.js';
import {SettingsPage, SkillConfirmPanel} from '../lib/tui/root/pages/settings-page.js';

const originalEnvironment = Object.fromEntries(['HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR'].map(key => [key, process.env[key]]));
const originalMaxListeners = process.getMaxListeners();
process.setMaxListeners(Math.max(30, originalMaxListeners));
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-root-skill-tui-'));
process.env.HOME = home;
process.env.CODEX_HOME = path.join(home, 'codex');
process.env.CLAUDE_CONFIG_DIR = path.join(home, 'claude');
settings.setLanguage('en');
after(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    process.setMaxListeners(originalMaxListeners);
    fs.rmSync(home, {recursive: true, force: true});
});

function status(states = ['missing', 'installed']) {
    return {
        ok: true, packageVersion: '2.11.0', skillVersion: '1.2.0', sourcePath: '/fixture/bundled/slothtool',
        agents: states.map((state, index) => ({
            id: index ? 'claude-code' : 'codex', name: index ? 'Claude Code' : 'Codex',
            detected: state !== 'not-detected', managed: ['installed', 'outdated', 'broken'].includes(state),
            targetPath: path.join('/fixture', index ? 'claude' : 'codex', 'skills', 'slothtool'),
            sourcePath: '/fixture/bundled/slothtool', version: state === 'missing' ? null : '1.1.0', state, error: null
        }))
    };
}
function items(value) { return buildSettingsItems(settings.readSettings(), value); }
function index(value, id) { return items(value).findIndex(item => item.id === id); }
function plain(value) { return value.replace(/\u001b\[[0-9;?]*[a-zA-Z]/gu, ''); }
function assertViewport(output, columns, rows) {
    const lines = plain(output).split('\n');
    assert.ok(lines.length <= rows, `${lines.length} lines exceed ${rows}`);
    for (const line of lines) assert.ok(getDisplayWidth(line) <= columns, `Overflow: ${line}`);
}
async function waitFor(check) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Timed out waiting for Skill TUI state');
}
function harness({value = status(), selected = 'skill:codex:install', tab = 'settings', manage, read,
    columns = 100, rows = 22} = {}) {
    const stdin = new PassThrough();
    Object.assign(stdin, {isTTY: true, setRawMode() {}, ref() {}, unref() {}});
    const stdout = new PassThrough();
    Object.assign(stdout, {isTTY: true, columns, rows});
    const frames = [];
    const calls = [];
    let reads = 0;
    stdout.on('data', chunk => frames.push(plain(chunk.toString())));
    const instance = render(React.createElement(RootTuiApp, {
        onExit() {}, initialState: {activeTab: tab, selection: {settings: index(value, selected)}},
        services: {
            getSkillStatus(options) {
                reads += 1;
                assert.equal(options.agent, 'all');
                return read ? read() : value;
            },
            manageSkill(action, options) {
                calls.push({action, agent: options.agent});
                if (manage) return manage(action, options);
                value = {...value, agents: value.agents.map(agent => agent.id === options.agent
                    ? {...agent, state: action === 'uninstall' ? 'missing' : 'installed',
                        managed: action !== 'uninstall', version: action === 'uninstall' ? null : value.skillVersion}
                    : agent)};
                options.reporter({level: 'success', message: 'service-reporter-marker'});
                return {...value, action, agents: value.agents.filter(agent => agent.id === options.agent)};
            }
        }
    }), {stdin, stdout, stderr: new PassThrough(), patchConsole: false, alternateScreen: false});
    return {
        calls, reads: () => reads,
        frame: () => frames.filter(frame => frame.trim()).at(-1) || '',
        async press(input) {
            stdin.write(input);
            if (input === '\u001b') await new Promise(resolve => setTimeout(resolve, 45));
            await instance.waitUntilRenderFlush();
        },
        async ready() {
            await instance.waitUntilRenderFlush();
            if (tab === 'settings') {
                await waitFor(() => reads > 0);
                await new Promise(resolve => setTimeout(resolve, 25));
                await instance.waitUntilRenderFlush();
            }
        },
        async completed(message = t('skill.complete')) {
            await waitFor(() => this.frame().includes(message));
            await instance.waitUntilRenderFlush();
        },
        async close() { instance.unmount(); await instance.waitUntilExit(); }
    };
}

test('Skill actions reflect detection, conflict and managed paths without changing existing settings', () => {
    const baseline = items(null);
    for (const state of ['installed', 'missing', 'outdated', 'broken', 'conflict', 'not-detected', 'source-invalid']) {
        const value = status([state]);
        const rows = items(value);
        assert.deepEqual(rows.slice(0, baseline.length), baseline);
        const actions = rows.filter(item => item.kind === 'skill-action');
        const enabled = actions.filter(item => item.actionable).map(item => item.action);
        assert.deepEqual(enabled, state === 'missing' ? ['install']
            : ['installed', 'outdated', 'broken'].includes(state) ? ['install', 'update', 'uninstall'] : []);
        for (const action of actions.filter(item => !item.actionable)) {
            assert.doesNotMatch(getFooterKeys({tab: 'settings', item: action, columns: 100}), /Enter/u);
        }
    }
    const registered = status(['missing', 'source-invalid']);
    registered.agents.forEach(agent => { agent.managed = true; });
    assert.equal(items(registered).find(item => item.id === 'skill:codex:update').actionable, true);
    assert.equal(items(registered).find(item => item.id === 'skill:claude-code:uninstall').actionable, true);
    assert.equal(items(registered).find(item => item.id === 'skill:claude-code:update').actionable, false);
});

test('Home does not inspect Skill status; entering Settings loads it', async () => {
    const app = harness({tab: 'home'});
    try {
        await app.ready();
        assert.equal(app.reads(), 0);
        await app.press('\u001b[Z');
        await waitFor(() => app.reads() === 1);
        await waitFor(() => app.frame().includes('Codex'));
        assert.match(app.frame(), /Codex/u);
    } finally { await app.close(); }
});

test('Enter installs only selected agent, preserves other agent, and retains versions and paths in details', async () => {
    const value = status();
    const app = harness({value});
    try {
        await app.ready();
        await app.press('\r');
        await app.completed();
        assert.deepEqual(app.calls, [{action: 'install', agent: 'codex'}]);
        await app.press('v');
        let details = app.frame();
        for (let i = 0; i < 5; i += 1) { await app.press('\u001b[6~'); details += app.frame(); }
        for (const text of ['1.2.0', '2.11.0', value.agents[0].targetPath, value.sourcePath]) assert.ok(details.includes(text), text);
        await app.press('\u001b');
        for (let i = 0; i < 3; i += 1) await app.press('\u001b[B');
        assert.ok(app.frame().includes('Claude Code'));
        await app.press('f');
        await app.press('\r');
        let feedback = app.frame();
        for (let i = 0; i < 6; i += 1) { await app.press('\u001b[6~'); feedback += app.frame(); }
        assert.match(feedback, /service-reporter-marker/u);
        assert.ok(feedback.includes(value.sourcePath));
    } finally { await app.close(); }
});

test('registered missing target updates through the selected agent service', async () => {
    const value = status(['missing']);
    value.agents[0].managed = true;
    const app = harness({value, selected: 'skill:codex:update'});
    try {
        await app.ready(); await app.press('\r'); await app.completed();
        assert.deepEqual(app.calls, [{action: 'update', agent: 'codex'}]);
    } finally { await app.close(); }
});

test('Skill uninstall confirmation cancels, ignores plugin-policy keys, then confirms once', async () => {
    const value = status(['source-invalid']);
    value.agents[0].managed = true;
    const app = harness({value, selected: 'skill:codex:uninstall'});
    try {
        await app.ready(); await app.press('\r');
        assert.ok(app.frame().includes(t('tui.confirm.title')));
        assert.ok(app.frame().replace(/[│\s]/gu, '').includes(t('skill.confirmScope').replace(/\s/gu, '')));
        assert.ok(!app.frame().includes(t('tui.uninstall.policyLabel')));
        assert.doesNotMatch(app.frame(), /←→ policy|←→ 策略/u);
        for (const key of ['\u001b[C', '\u001b[D', ' ', '\r']) await app.press(key);
        assert.equal(app.calls.length, 0);
        assert.ok(app.frame().includes(t('tui.confirm.title')));
        await app.press('n');
        assert.equal(app.calls.length, 0);
        await app.press('\r'); await app.press('\u001b');
        assert.equal(app.calls.length, 0);
        await app.press('\r'); await app.press('y'); await app.completed();
        assert.deepEqual(app.calls, [{action: 'uninstall', agent: 'codex'}]);
        await app.press('y');
        assert.equal(app.calls.length, 1);
    } finally { await app.close(); }
});

test('disabled conflict, undetected and unmanaged update actions never call a service', async () => {
    for (const [state, action] of [['conflict', 'install'], ['not-detected', 'install'], ['missing', 'update'], ['missing', 'uninstall']]) {
        const app = harness({value: status([state]), selected: `skill:codex:${action}`});
        try {
            await app.ready(); await app.press('\r'); await app.press('y');
            assert.equal(app.calls.length, 0);
        } finally { await app.close(); }
    }
});

test('failed result overrides success reporter and keeps top-level, agent and rollback errors in feedback', async () => {
    const value = status(['missing']);
    const app = harness({value, manage(action, options) {
        options.reporter({level: 'success', message: 'misleading-success'});
        return {...value, ok: false, action, error: {code: 'OP_FAILED', message: 'operation failed'},
            rollbackErrors: ['rollback-marker'], agents: [{...value.agents[0], error: {code: 'EACCES', message: 'agent-denied-marker'}}]};
    }});
    try {
        await app.ready(); await app.press('\r'); await app.completed(t('skill.failed'));
        assert.ok(app.frame().includes(t('tui.status.phases.failure')));
        await app.press('\t'); await app.press('f'); await app.press('\r');
        let feedback = app.frame();
        for (let i = 0; i < 12; i += 1) { await app.press('\u001b[6~'); feedback += app.frame(); }
        for (const text of ['OP_FAILED', 'agent-denied-marker', 'rollback-marker']) assert.ok(feedback.includes(text), text);
        await new Promise(resolve => setTimeout(resolve, 40));
        assert.ok(app.frame().includes(t('tui.status.phases.failure')));
    } finally { await app.close(); }
});

test('cleanup warnings remain visible as warning outcomes and persistent detail events', async () => {
    const value = status(['missing']);
    const app = harness({value, manage(action) {
        return {...value, action, warnings: [{path: '/fixture/remnant', message: 'cleanup-remnant-marker'}]};
    }});
    try {
        await app.ready(); await app.press('\r'); await app.completed();
        assert.ok(app.frame().includes(t('tui.status.phases.partial')));
        await app.press('f'); await app.press('\r');
        let feedback = app.frame();
        for (let i = 0; i < 8; i += 1) { await app.press('\u001b[6~'); feedback += app.frame(); }
        assert.ok(feedback.includes('/fixture/remnant: cleanup-remnant-marker'));
    } finally { await app.close(); }
});

test('thrown operation and status errors persist without escaping the Ink app', async () => {
    for (const service of ['read', 'manage']) {
        const app = harness({[service]() { throw new Error(`${service}-error-marker`); }});
        try {
            await app.ready();
            if (service === 'manage') await app.press('\r');
            await app.completed(`${service}-error-marker`);
            await app.press('\t'); await app.press('f'); await app.press('\r');
            assert.ok(app.frame().includes(`${service}-error-marker`));
        } finally { await app.close(); }
    }
});

test('Skill settings, translated states and confirmation fit wide, narrow and short viewports', () => {
    for (const language of ['zh', 'en']) {
        settings.setLanguage(language);
        assert.ok(i18n.messages[language].skill, 'Parent integration must supply skill.* translations');
        const value = status(['outdated', 'not-detected']);
        for (const [columns, height] of [[110, 16], [56, 9], [44, 5]]) {
            const all = items(value);
            const selectedIndex = index(value, 'skill:codex:update');
            const output = renderToString(React.createElement(SettingsPage, {items: all, selectedIndex, columns, contentHeight: height}), {columns});
            assertViewport(output, columns, height);
            assert.doesNotMatch(output, /skill\.(?:title|states|version|target)/u);
            const fullDetails = buildItemDetailLines(all[selectedIndex]).join('\n');
            assert.ok(fullDetails.includes(value.agents[0].targetPath));
            assert.ok(fullDetails.includes(t('skill.states.outdated')));
            const confirmation = renderToString(React.createElement(SkillConfirmPanel, {
                action: {lines: [t('skill.uninstall'), t('skill.confirmScope'), value.agents[0].targetPath]},
                scroll: 0, height, columns
            }), {columns});
            assertViewport(confirmation, columns, height);
            assert.ok(!confirmation.includes(t('tui.uninstall.policyLabel')));
        }
    }
    settings.setLanguage('en');
});
