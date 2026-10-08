import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {getDeploymentPaths} from '../plugins/slothvault/lib/deploy-runner.js';
import {buildDeploymentArguments, DEPLOY_ACTIONS, resolveSlothVaultManagerLayout} from '../plugins/slothvault/lib/manager-tui.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = path.join(root, 'plugins/slothvault/bin/slothvault.js');
function environment(t, language = 'zh') {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-native-mcp-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    fs.mkdirSync(path.join(home, '.pipker/slothtool'), {recursive: true});
    fs.writeFileSync(path.join(home, '.pipker/slothtool/settings.json'), JSON.stringify({language}));
    return {...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude')};
}

test('manager and deployment keep their local interaction contract without a Client', () => {
    assert.equal(resolveSlothVaultManagerLayout(30, 10).tooSmall, true);
    assert.equal(resolveSlothVaultManagerLayout(60, 24).compact, true);
    assert.ok(DEPLOY_ACTIONS.includes('check-update'));
    assert.deepEqual(buildDeploymentArguments('status', {root: '/data/slothvault'}), ['--action', 'status', '--root', '/data/slothvault']);
    assert.equal(getDeploymentPaths({pluginRoot: '/tmp/slothvault-deployment'}).entryPath, '/tmp/slothvault-deployment/install.py');
});

test('help and local package/Skill status work with no Python, Profile or MCP Client', t => {
    const env = {...environment(t), PATH: ''};
    for (const args of [['--help'], ['deploy', 'package', 'status', '--json'], ['skill', 'status', '--json']]) {
        const result = spawnSync(process.execPath, [entry, ...args], {env, encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr);
        if (args[0] === '--help') {
            assert.match(result.stdout, /原生 MCP/u);
            assert.doesNotMatch(result.stdout, /mcp package|mcp register|slothvault setup/u);
        } else JSON.parse(result.stdout);
    }
    const smoke = spawnSync(process.execPath, [entry], {env: {...env, SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION: 'exit'}, encoding: 'utf8'});
    assert.equal(smoke.status, 0, smoke.stderr);
});

test('retired Client commands return native guidance without executing a legacy Client or changing configuration', t => {
    const env = environment(t);
    const client = path.join(env.HOME, 'old-client'), marker = path.join(client, 'executed');
    fs.mkdirSync(path.join(client, '.venv/bin'), {recursive: true});
    fs.symlinkSync(process.execPath, path.join(client, '.venv/bin/python'));
    fs.writeFileSync(path.join(client, 'slothvault_mcp.py'), `require('fs').writeFileSync(${JSON.stringify(marker)}, 'called');`);
    env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = client;
    const config = path.join(env.HOME, '.pipker/slothtool/plugin-configs/slothvault.json');
    fs.mkdirSync(path.dirname(config));
    fs.writeFileSync(config, '{"profiles":{"old":{"apiKey":"private-test-key"}}}');
    const before = fs.readFileSync(config, 'utf8');
    for (const args of [['mcp', 'register'], ['mcp', 'package', 'install'], ['setup'], ['doctor'], ['tools', 'list'], ['profile', 'list']]) {
        const result = spawnSync(process.execPath, [entry, ...args, '--json'], {env, encoding: 'utf8'});
        assert.equal(result.status, 2, result.stderr);
        const response = JSON.parse(result.stdout);
        assert.equal(response.error.code, 'SLOTHVAULT_MCP_CLIENT_REMOVED');
        assert.match(response.error.message, /原生 MCP/u);
        assert.doesNotMatch(result.stdout + result.stderr, /private-test-key/u);
    }
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(config, 'utf8'), before);
});

test('native guidance is available in both manager languages', t => {
    const env = environment(t, 'en');
    const result = spawnSync(process.execPath, [entry, 'mcp', 'status', '--json'], {env, encoding: 'utf8'});
    assert.equal(result.status, 2);
    assert.match(JSON.parse(result.stdout).error.message, /native MCP settings/u);
});
