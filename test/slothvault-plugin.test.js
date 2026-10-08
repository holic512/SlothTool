import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {getConfigSummary, getRuntimeRoot, runRuntimeSync, addProfile} from '../plugins/slothvault/lib/runtime-adapter.js';
import {getDeploymentPaths} from '../plugins/slothvault/lib/deploy-runner.js';
import {resolveSlothVaultTuiLayout} from '../plugins/slothvault/lib/tui.js';
import {buildDeploymentArguments, DEPLOY_ACTIONS, resolveSlothVaultManagerLayout} from '../plugins/slothvault/lib/manager-tui.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-vault-adapter-'));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const bin = path.join(dir, '.venv', 'bin');
    fs.mkdirSync(bin, {recursive: true});
    fs.symlinkSync(process.execPath, path.join(bin, 'python'));
    fs.writeFileSync(path.join(dir, 'slothvault_mcp.py'), `
      const command = process.argv[2];
      if (command === 'config') console.log(JSON.stringify({profiles: [], defaultProfile: null}));
      else if (command === '--version') console.log(JSON.stringify({version: '1.0.0', bridgeApiMajor: 2}));
      else {
        let input = ''; process.stdin.on('data', part => input += part);
        process.stdin.on('end', () => console.log(JSON.stringify({name: process.argv[4], apiKey: input ? '[redacted]' : null})));
      }
    `);
    return dir;
}

test('UI adapter uses the runtime JSON contract and puts keys only on stdin', t => {
    const dir = fixture(t);
    const old = process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT;
    process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = dir;
    t.after(() => { if (old === undefined) delete process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT; else process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = old; });
    assert.deepEqual(getConfigSummary().profiles, []);
    assert.equal(runRuntimeSync('mcp', ['--version']).bridgeApiMajor, 2);
    const key = 'private-test-key';
    assert.equal(addProfile('work', {endpoint: 'https://vault.example', apiKey: key}).apiKey, '[redacted]');
    assert.equal(getRuntimeRoot(), dir);
});

test('offline UI has a safe missing-runtime state', t => {
    const old = process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT;
    process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = path.join(os.tmpdir(), 'missing-slothtool-vault-runtime');
    t.after(() => { if (old === undefined) delete process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT; else process.env.SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT = old; });
    assert.deepEqual(getConfigSummary().profiles, []);
    assert.throws(() => runRuntimeSync('control', ['status']), {code: 'SLOTHVAULT_RUNTIME_MISSING'});
});

test('UI and deployment runner keep their existing local interaction contract', () => {
    assert.equal(resolveSlothVaultTuiLayout(30, 10).tooSmall, true);
    assert.equal(resolveSlothVaultManagerLayout(60, 24).compact, true);
    assert.ok(DEPLOY_ACTIONS.includes('check-update'));
    assert.deepEqual(buildDeploymentArguments('status', {root: '/data/slothvault'}), ['--action', 'status', '--root', '/data/slothvault']);
    assert.equal(getDeploymentPaths({pluginRoot: '/tmp/slothvault-runtime'}).entryPath, '/tmp/slothvault-runtime/install.py');
});

test('standalone MCP help is available without a Client and missing-runtime JSON uses a stable config exit code', t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-missing-client-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    const env = {...process.env, HOME: home, SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT: path.join(home, 'missing')};
    const command = path.join(root, 'plugins/slothvault/bin/slothvault-mcp.js');
    const help = spawnSync(process.execPath, [command, '--help'], {env, encoding: 'utf8'});
    assert.equal(help.status, 0, help.stderr); assert.match(help.stdout, /mcp package install/u);
    const error = spawnSync(process.execPath, [command, 'doctor', '--json'], {env, encoding: 'utf8'});
    assert.equal(error.status, 2); assert.equal(JSON.parse(error.stdout).error.code, 'SLOTHVAULT_RUNTIME_MISSING');
    assert.equal(error.stderr, '');
});

test('legacy MCP executable forwards to Vault runtime without loading business modules', t => {
    const dir = fixture(t);
    const result = spawnSync(process.execPath, [path.join(root, 'plugins/slothvault/bin/slothvault-mcp.js'), 'profile', 'add', 'work', '--json'], {
        input: 'secret', encoding: 'utf8', env: {...process.env, SLOTHTOOL_SLOTHVAULT_MCP_CLIENT_ROOT: dir}
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).apiKey, '[redacted]');
});
