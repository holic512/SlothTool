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

test('the default page manages only Skills without deployment or MCP inspection', async () => {
    const ui = harness({services: services({inspectDeployment: () => assert.fail('No deployment inspection'),
        getDeploymentAvailability: () => assert.fail('No Python detection')})});
    try {
        await ui.settle();
        assert.match(ui.frame(), /SlothVault Skill 管理/u);
        assert.doesNotMatch(ui.frame(), /部署|Nginx|概览|Tab|workspace\.|manager\./u);
        await ui.press('\t'); await ui.press('\u001b[C');
        assert.match(ui.frame(), /SlothVault Skill 管理/u);
        assert.equal(ui.errors(), '');
    } finally {await ui.close();}
});

test('Skill updates retain actions, measured progress and scrollable failures', async () => {
    let finish, emit, calls = 0;
    const ui = harness({services: services({updateSkill: ({onEvent}) => {
        calls++; emit = onEvent; return new Promise(resolve => {finish = resolve;});
    }})});
    try {
        await ui.settle(); await ui.press('n'); await waitFor(() => Boolean(finish), ui);
        emit({type: 'progress', phase: 'download', current: 512, total: 1024, unit: 'bytes'});
        await waitFor(() => /50%/u.test(ui.frame()), ui);
        assert.match(ui.frame(), /查看包状态/u);
        emit({type: 'error', code: 'RELEASE_FAILED', message: 'release unavailable'});
        finish({status: 'error', reason: 'release unavailable', agents: []});
        await waitFor(() => /操作状态：失败/u.test(ui.frame()), ui);
        assert.match(ui.frame(), /release unavailable/u);
        assert.equal(calls, 1);
        await ui.press('v'); await ui.press('\u001b[6~'); await ui.press('\u001b');
        assert.match(ui.frame(), /release unavailable/u);
    } finally {await ui.close();}
});

test('conflicting installation and uninstall require confirmation; local repair preserves custom targets', async () => {
    let installs = 0, removals = 0, repairs = 0;
    const status = {sourceState: 'installed', version: '1.0.0', agents: [{name: 'Codex', detected: true, state: 'conflict', targetPath: '/custom/skill'}]};
    const ui = harness({services: services({getSkillStatus: () => status,
        installSkill: async options => {assert.equal(options.replace, true); installs++; return status;},
        uninstallSkill: () => {removals++; return status;},
        updateSkill: async options => {assert.equal(options.local, true); repairs++; return status;}})});
    try {
        await ui.settle(); await ui.press('i'); await ui.press('n'); assert.equal(installs, 0);
        await ui.press('i'); await ui.press('y'); await waitFor(() => installs === 1, ui);
        await ui.press('u'); await ui.press('\u001b'); assert.equal(removals, 0);
        await ui.press('u'); await ui.press('y'); await waitFor(() => removals === 1, ui);
        await ui.press('l'); await waitFor(() => repairs === 1, ui);
    } finally {await ui.close();}
});

test('completed release notes remain scrollable with the action menu visible', async () => {
    const ui = harness({services: services({checkSkillUpdate: async () => ({status: 'outdated', sourceState: 'installed', agents: [],
        latestVersion: '1.0.1', releaseNotes: Array.from({length: 70}, (_, i) => 'Release note ' + i).join('\n')})})});
    try {
        await ui.settle(); await ui.press('c'); await waitFor(() => /操作状态：完成/u.test(ui.frame()), ui);
        await ui.press('d'); await ui.press('v');
        for (let i = 0; i < 20; i++) await ui.press('\u001b[6~');
        assert.match(ui.frame(), /Release note 69/u);
        assert.match(ui.frame(), /查看包状态/u);
    } finally {await ui.close();}
});

test('Skill layout fits representative terminal sizes', async () => {
    for (const [columns, rows] of [[100, 28], [60, 18], [30, 18]]) {
        const ui = harness({services: services()}, columns, rows);
        try {
            await ui.settle();
            for (const line of ui.frame().split('\n')) assert.ok(getDisplayWidth(line) <= columns, `${columns}: ${line}`);
            assert.equal(ui.errors(), '');
        } finally {await ui.close();}
    }
});


test('terminals below the minimum cannot activate hidden Skill actions', async () => {
    let installs = 0;
    const ui = harness({services: services({installSkill: () => {installs++; return {agents: []};}})}, 28, 12);
    try {
        await ui.settle(); await ui.press('i'); await ui.press('\r');
        assert.match(ui.frame(), /终端过小/u);
        assert.equal(installs, 0);
    } finally {await ui.close();}
});
