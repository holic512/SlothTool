import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {stripVTControlCharacters} from 'node:util';
import test, {after} from 'node:test';
import React from 'react';
import {render} from 'ink';
import {ManagerApp} from '../plugins/slothvault/lib/manager-tui.js';
import {progressLines} from '../plugins/slothvault/lib/terminal-ui.js';
import {getDisplayWidth} from '../lib/tui/shared-interaction.js';
import {getDeploymentAvailability, createDeploymentSession} from '../plugins/slothvault/lib/deploy-runner.js';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-vault-ui-'));
const originalHome = process.env.HOME, originalRuntime = process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT;
process.env.HOME = home;
fs.mkdirSync(path.join(home, '.pipker/slothtool'), {recursive: true});
fs.writeFileSync(path.join(home, '.pipker/slothtool/settings.json'), '{"language":"zh"}');
after(() => {
    process.env.HOME = originalHome;
    if (originalRuntime === undefined) delete process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT;
    else process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = originalRuntime;
    fs.rmSync(home, {recursive: true, force: true});
});
function services(overrides = {}) {
    return {getComponentStatus: module => ({module, state: 'missing', currentVersion: null, path: '/packages/' + module}),
        getSkillStatus: () => ({agents: [], sourceState: 'missing'}),
        getDeploymentAvailability: async () => ({available: false, reason: 'missing'}), ...overrides};
}
function harness(props, columns = 100, rows = 28) {
    const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
    Object.assign(stdin, {isTTY: true, setRawMode() {}, ref() {}, unref() {}});
    Object.assign(stdout, {isTTY: true, columns, rows});
    let frame = '', errors = '';
    stdout.on('data', chunk => {const text = stripVTControlCharacters(chunk.toString()); if (text.trim()) frame = text;});
    stderr.on('data', chunk => errors += chunk);
    const ink = render(React.createElement(ManagerApp, props), {stdin, stdout, stderr, patchConsole: false, alternateScreen: false});
    return {frame: () => frame, errors: () => errors,
        settle: () => ink.waitUntilRenderFlush(),
        async press(key) {stdin.write(key); if (key === '\u001b') await new Promise(resolve => setTimeout(resolve, 45)); await ink.waitUntilRenderFlush();},
        async close() {ink.unmount(); await ink.waitUntilExit();}};
}
async function waitFor(check, ui) {
    for (let i = 0; i < 60; i++) {await ui.settle(); if (check()) return; await new Promise(resolve => setTimeout(resolve, 10));}
    assert.fail('UI did not reach expected state: ' + ui.frame() + ui.errors());
}

test('Overview reads no MCP configuration, even when the installed client has a corrupt Profile', async () => {
    const runtime = path.join(home, 'corrupt-client'), marker = path.join(runtime, 'read.marker');
    fs.mkdirSync(path.join(runtime, '.venv/bin'), {recursive: true});
    fs.symlinkSync(process.execPath, path.join(runtime, '.venv/bin/python'));
    fs.writeFileSync(path.join(runtime, 'module.json'), JSON.stringify({schema: 1, module: 'mcp-client', version: '1.0.0', bridgeApiMajor: 2}));
    fs.writeFileSync(path.join(runtime, 'slothvault_mcp.py'), `require('fs').writeFileSync(${JSON.stringify(marker)}, 'called'); console.log(JSON.stringify({ok:false,error:{code:'CONFIG_INVALID',message:'broken Profile'}})); process.exitCode=2;`);
    process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = runtime;
    const ui = harness({});
    try {
        await ui.settle();
        assert.match(ui.frame(), /组件总览/u); assert.doesNotMatch(ui.frame(), /连接 SlothVault|broken Profile/u);
        assert.equal(fs.existsSync(marker), false);
        await ui.press('\t'); await ui.press('\t');
        assert.equal(fs.existsSync(marker), false);
        await ui.press('\t');
        assert.match(ui.frame(), /组件总览/u);
        assert.doesNotMatch(ui.frame(), /MCP Client|连接和配置|broken Profile/u);
    } finally {await ui.close(); delete process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT;}
});

test('Skill updates only its service, keeps the menu while running and retains a scrollable failure', async () => {
    let finish, emit, calls = 0;
    const ui = harness({services: services({updateSkill: ({onEvent}) => {
        calls++; emit = onEvent; return new Promise(resolve => {finish = resolve;});
    }, operatePackage: () => assert.fail('Skill must not operate an MCP/deployment package')})});
    try {
        await ui.settle(); await ui.press('\t'); await ui.press('\t'); await ui.press('n');
        await waitFor(() => Boolean(finish), ui);
        emit({type: 'progress', phase: 'download', current: 512, total: 1024, unit: 'bytes', speed: 100});
        await waitFor(() => /50%/u.test(ui.frame()), ui); assert.match(ui.frame(), /查看包状态/u);
        await ui.press('v'); await ui.press('\u001b[6~'); await ui.press('\u001b');
        emit({type: 'error', code: 'RELEASE_FAILED', message: 'release unavailable'});
        finish({status: 'error', reason: 'release unavailable', agents: []});
        await waitFor(() => /操作状态：失败/u.test(ui.frame()), ui);
        assert.match(ui.frame(), /release unavailable/u); assert.equal(calls, 1);
        await ui.press('\t'); await ui.press('\u001b[D');
        assert.match(ui.frame(), /release unavailable/u);
    } finally {await ui.close();}
});

test('missing deployment package blocks every application operation without starting Python', async () => {
    let availabilityCalls = 0, sessionCalls = 0;
    const ui = harness({services: services({getDeploymentAvailability: async () => {availabilityCalls++; return {available: false};},
        createDeploymentSession: () => {sessionCalls++; assert.fail('must not start Python');}})});
    try {
        await ui.settle(); await ui.press('\t');
        for (let i = 0; i < 4; i++) await ui.press('\u001b[B');
        for (let i = 0; i < 9; i++) {await ui.press('\r'); assert.match(ui.frame(), /部署操作不可用/u); await ui.press('\u001b[B');}
        assert.equal(availabilityCalls, 0); assert.equal(sessionCalls, 0);
    } finally {await ui.close();}
});

test('package checks keep full Release notes reachable after completion and preserve the left menu', async () => {
    const ui = harness({services: services({operatePackage: async (module, action) => {
        assert.equal(module, 'deployment'); assert.equal(action, 'check');
        return {status: 'outdated', currentVersion: null, latestVersion: '1.0.1', checkedAt: '2026-10-08', releaseNotes: Array.from({length: 70}, (_, i) => 'Release note ' + i).join('\n')};
    }})}, 78, 24);
    try {
        await ui.settle(); await ui.press('\t'); await ui.press('p');
        await waitFor(() => /操作状态：完成/u.test(ui.frame()), ui);
        assert.match(ui.frame(), /查看包状态/u); await ui.press('v');
        for (let i = 0; i < 20; i++) await ui.press('\u001b[6~');
        assert.match(ui.frame(), /Release note 69/u);
    } finally {await ui.close();}
});

test('all three manager pages fit narrow terminals without a Client page', async () => {
    for (const [columns, rows] of [[90, 24], [60, 18], [30, 18]]) {
        const ui = harness({services: services()}, columns, rows);
        try {
            await ui.settle();
            for (let page = 0; page < 3; page++) {
                const lines = ui.frame().replace(/\n$/u, '').split('\n');
                assert.ok(lines.length <= rows, ui.frame());
                assert.ok(lines.every(line => getDisplayWidth(line) <= columns), ui.frame());
                assert.equal((ui.frame().match(/╭/gu) || []).length, (ui.frame().match(/╰/gu) || []).length, ui.frame());
                assert.doesNotMatch(ui.frame(), /MCP Client|连接和配置/u);
                await ui.press('\t');
            }
            assert.match(ui.frame(), /组件总览/u);
            assert.equal(ui.errors(), '');
        } finally {await ui.close();}
    }
});

test('progress shows measured counts and never makes a percentage without a reliable total', () => {
    const task = {state: 'running', startedAt: 0, progress: {phase: 'pull', current: 20, unit: 'bytes'}};
    assert.doesNotMatch(progressLines(task, 1000).join('\n'), /%/u);
    task.progress = {phase: 'pull', stageIndex: 2, stageCount: 4, subject: 'layer-id', current: 10, total: 20, unit: 'items', status: 'running'};
    const text = progressLines(task, 1000).join('\n');
    assert.match(text, /50%/u); assert.match(text, /2\/4/u); assert.match(text, /layer-id/u);
    task.progress.total = 5;
    assert.doesNotMatch(progressLines(task, 1000).join('\n'), /%/u);
});

test('deployment availability avoids Python for invalid packages; the bridge forwards old and enhanced progress fields', async t => {
    let calls = 0;
    assert.equal((await getDeploymentAvailability({runtimeRoot: path.join(home, 'missing'), commandRunner: () => {calls++;}})).available, false);
    assert.equal(calls, 0);
    const root = fs.mkdtempSync(path.join(home, 'bridge-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    fs.writeFileSync(path.join(root, 'module.json'), JSON.stringify({schema: 1, module: 'deployment', version: '1.0.0', bridgeApiMajor: 1}));
    fs.writeFileSync(path.join(root, 'install.py'), `console.log(JSON.stringify({type:'progress',phase:'pull'})); console.log(JSON.stringify({type:'progress',phase:'pull',current:10,total:20,unit:'bytes',subject:'layer',status:'running'})); console.error('raw sensitive stderr'); console.log(JSON.stringify({type:'done',code:1})); process.exitCode=1;`);
    const events = [], session = createDeploymentSession([], {pluginRoot: root, pythonCommand: process.execPath, onEvent: event => events.push(event)});
    assert.equal((await session.result).code, 1); assert.equal(events[0].phase, 'pull');
    assert.equal(events[1].current, 10); assert.equal(events[1].total, 20); assert.equal(events[1].status, 'running');
    assert.doesNotMatch(JSON.stringify(events), /raw sensitive stderr/u);
});
