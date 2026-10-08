import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {cleanupSlothVault, planSlothVaultCleanup, slothVaultDataPaths} from '../lib/services/slothvault-storage.js';
import {componentPaths} from '../lib/services/slothvault-paths.js';
import {describePluginUninstall, uninstallPlugin, uninstallAllData, installPlugin} from '../lib/services/plugin-service.js';
import registry from '../lib/registry.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
function fixture(t, useHome = false) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-storage-'));
    const options = {homeDir, slothToolHome: path.join(homeDir, '.pipker/slothtool'), env: {PATH: ''}};
    const original = process.env.HOME;
    if (useHome) process.env.HOME = homeDir;
    t.after(() => {if (useHome) process.env.HOME = original; fs.rmSync(homeDir, {recursive: true, force: true});});
    return options;
}
function write(file, data = 'sentinel') {fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, data); return file;}
function link(source, target) {fs.mkdirSync(path.dirname(target), {recursive: true}); fs.symlinkSync(source, target, 'dir'); return target;}
function component(module, options, version = '1.0.0', active = true) {
    const paths = componentPaths(module, options);
    const root = active && module === 'skill' ? paths.current : path.join(paths.releases, version);
    write(path.join(root, 'module.json'), JSON.stringify({schema: 1, module, version, bridgeApiMajor: module === 'mcp-client' ? 2 : 1}));
    write(path.join(root, module === 'skill' ? 'slothvault-mcp/SKILL.md' : module === 'deployment' ? 'install.py' : 'slothvault_mcp.py'));
    if (module === 'mcp-client') write(path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));
    if (active && module !== 'skill') link(root, paths.current);
    return root;
}
function register(alias, options) {
    const root = path.join(options.slothToolHome, 'plugins', alias);
    write(path.join(root, 'package.json'), JSON.stringify({name: '@holic512/plugin-' + alias}));
    registry.addPlugin(alias, {packageName: '@holic512/plugin-' + alias, version: '1.0.0', binPath: path.join(root, 'bin/' + alias + '.js')});
    return root;
}

test('cleanup previews do not mutate; execution preserves active/custom references and clears all Profile/history paths', t => {
    const options = fixture(t);
    for (const module of ['skill', 'deployment', 'mcp-client']) component(module, options);
    const old = component('deployment', options, '0.9.0', false);
    const referenced = component('skill', options, '0.9.0', false);
    const custom = link(path.join(referenced, 'slothvault-mcp'), path.join(options.homeDir, '.codex/skills/slothvault-mcp'));
    const scratch = write(path.join(componentPaths('deployment', options).root, '.stage-residue/download.tgz'));
    const profiles = slothVaultDataPaths(options).map(file => file.endsWith('.json') ? write(file, '{}') : write(path.join(file, 'history.json'), '[]'));
    const other = write(path.join(options.slothToolHome, 'data/loc/sentinel'));
    const ownUserFile = write(path.join(options.slothToolHome, 'data/slothvault/user-file.txt'));
    const deployed = write(path.join(options.homeDir, 'deployed/database/sentinel'));
    const preview = cleanupSlothVault({...options, dryRun: true});
    assert.equal(preview.status, 'preview');
    assert.ok(preview.items.some(item => item.path === old));
    assert.ok(preview.kept.some(item => item.path === referenced));
    assert.ok(profiles.every(file => fs.existsSync(file)));
    assert.equal(fs.existsSync(scratch), true);
    const result = cleanupSlothVault(options);
    assert.equal(result.status, 'completed');
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(scratch), false);
    assert.ok(profiles.every(file => !fs.existsSync(file)));
    assert.equal(fs.readlinkSync(custom), path.join(referenced, 'slothvault-mcp'));
    assert.equal(fs.existsSync(referenced), true);
    assert.equal(fs.existsSync(componentPaths('skill', options).current), true);
    assert.equal(fs.existsSync(other), true);
    assert.equal(fs.existsSync(ownUserFile), true);
    assert.equal(fs.existsSync(deployed), true);
});

test('legacy links are previewed and migrated before deleting redundant toolkit releases', t => {
    const options = fixture(t);
    for (const module of ['skill', 'deployment', 'mcp-client']) component(module, options);
    const legacy = path.join(options.slothToolHome, 'runtimes/slothvault/releases/0.8.0');
    write(path.join(legacy, 'package.json'), JSON.stringify({name: '@holic512/slothvault-runtime'}));
    write(path.join(legacy, 'skills/slothvault-mcp/SKILL.md'));
    const pointer = link(legacy, path.join(options.slothToolHome, 'runtimes/slothvault/current'));
    const target = link(path.join(pointer, 'skills/slothvault-mcp'), path.join(options.homeDir, '.codex/skills/slothvault-mcp'));
    const preview = planSlothVaultCleanup(options);
    assert.equal(preview.migrations.length, 1);
    assert.ok(preview.items.some(item => item.path === legacy));
    assert.equal(fs.readlinkSync(target), path.join(pointer, 'skills/slothvault-mcp'));
    const result = cleanupSlothVault(options);
    assert.equal(result.status, 'completed');
    assert.equal(fs.readlinkSync(target), path.join(componentPaths('skill', options).current, 'slothvault-mcp'));
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(fs.existsSync(pointer), false);
});

test('a verified legacy command reference protects its toolkit and active operation locks block cleanup', t => {
    const options = fixture(t);
    for (const module of ['skill', 'deployment', 'mcp-client']) component(module, options);
    const legacy = path.join(options.slothToolHome, 'runtimes/slothvault/releases/0.8.0');
    write(path.join(legacy, 'package.json'), JSON.stringify({name: '@holic512/slothvault-runtime'}));
    const pointer = link(legacy, path.join(options.slothToolHome, 'runtimes/slothvault/current'));
    const command = write(path.join(options.homeDir, 'bin/slothtool'));
    link(path.join(pointer, 'bin/slothvault-mcp.js'), path.join(options.homeDir, 'bin/slothvault-mcp'));
    options.env = {SLOTHTOOL_COMMAND_PATH_VERIFIED: '1', SLOTHTOOL_COMMAND_PATH: command};
    assert.ok(planSlothVaultCleanup(options).kept.some(item => item.path === legacy));
    cleanupSlothVault(options);
    assert.equal(fs.existsSync(legacy), true);
    const lock = write(path.join(componentPaths('skill', options).root, '.operation-lock'));
    assert.throws(() => cleanupSlothVault(options), {code: 'COMPONENT_BUSY'});
    assert.equal(fs.existsSync(lock), true);
});

for (const dataPolicy of ['keep', 'purge']) test(`SlothVault ${dataPolicy} uninstall removes broken runtime links and protects application data`, t => {
    const options = fixture(t, true);
    const plugin = register('slothvault', options);
    const source = path.join(componentPaths('skill', options).current, 'slothvault-mcp');
    const target = link(source, path.join(options.homeDir, '.codex/skills/slothvault-mcp'));
    const custom = write(path.join(options.homeDir, '.claude/skills/slothvault-mcp/custom.txt'));
    const config = write(path.join(options.slothToolHome, 'plugin-configs/slothvault.json'), '{}');
    const history = write(path.join(options.slothToolHome, 'data/slothvault/history.json'), '[]');
    const other = write(path.join(options.slothToolHome, 'data/pzip/sentinel'));
    const deployed = write(path.join(options.homeDir, 'deployed/nginx/certificate.pem'));
    assert.ok(describePluginUninstall('slothvault', {...options, dataPolicy}).paths.includes(target));
    uninstallPlugin('slothvault', {...options, dataPolicy});
    assert.equal(fs.existsSync(plugin), false);
    assert.throws(() => fs.lstatSync(target), {code: 'ENOENT'});
    assert.equal(fs.existsSync(config), dataPolicy === 'keep');
    assert.equal(fs.existsSync(history), dataPolicy === 'keep');
    for (const file of [custom, other, deployed]) assert.equal(fs.existsSync(file), true);
});

test('loc purge removes its actual and legacy configs without deleting the shared data directory', t => {
    const options = fixture(t, true);
    register('loc', options);
    const actual = write(path.join(options.slothToolHome, 'data/plugin-configs/loc.json'), '{}');
    const old = write(path.join(options.slothToolHome, 'plugin-configs/loc.json'), '{}');
    const other = write(path.join(options.slothToolHome, 'data/plugin-configs/pzip.json'), '{}');
    uninstallPlugin('loc', {dataPolicy: 'purge'});
    assert.equal(fs.existsSync(actual), false); assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(other), true);
});

test('unsafe data parents produce partial results and retain the plugin for retry', t => {
    const options = fixture(t, true), plugin = register('loc', options);
    const outside = write(path.join(options.homeDir, 'outside/plugin-configs/loc.json'), '{}');
    link(path.dirname(path.dirname(outside)), path.join(options.slothToolHome, 'data'));
    assert.throws(() => uninstallPlugin('loc', {dataPolicy: 'purge'}), error => Boolean(error.result.errors.length));
    assert.equal(fs.existsSync(outside), true); assert.equal(fs.existsSync(plugin), true);
    assert.ok(registry.getPlugin('loc'));
});

for (const dataPolicy of ['keep', 'purge']) test(`full ${dataPolicy} uninstall handles orphaned packages and outside links`, t => {
    const options = fixture(t, true);
    register('loc', options);
    const orphan = write(path.join(options.slothToolHome, 'plugins/orphan/bin.js'));
    const settings = write(path.join(options.slothToolHome, 'settings.json'), '{"language":"en"}');
    const data = write(path.join(options.slothToolHome, 'data/loc/sentinel'));
    const target = link(path.join(componentPaths('skill', options).current, 'slothvault-mcp'), path.join(options.homeDir, '.codex/skills/slothvault-mcp'));
    uninstallAllData({...options, dataPolicy});
    assert.throws(() => fs.lstatSync(target), {code: 'ENOENT'});
    assert.equal(fs.existsSync(orphan), false);
    assert.equal(fs.existsSync(settings), dataPolicy === 'keep');
    assert.equal(fs.existsSync(data), dataPolicy === 'keep');
});

test('CLI purge/batch require yes outside a terminal and cleanup JSON has only a final result', t => {
    const options = fixture(t, true), plugin = register('loc', options);
    for (const args of [['uninstall', 'loc', '--purge-data'], ['--uninstall-all', '--keep-data']]) {
        const result = spawnSync(process.execPath, [path.join(repo, 'bin/slothtool.js'), ...args], {env: {...process.env, HOME: options.homeDir}, encoding: 'utf8'});
        assert.notEqual(result.status, 0); assert.match(result.stderr, /--yes/u); assert.equal(fs.existsSync(plugin), true);
    }
    const result = spawnSync(process.execPath, [path.join(repo, 'plugins/slothvault/bin/slothvault.js'), 'cleanup', '--dry-run', '--json'], {env: {...process.env, HOME: options.homeDir}, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).status, 'preview');
});

test('online UI installation never invokes the component installer', async t => {
    const options = fixture(t, true);
    let calls = 0;
    const result = await installPlugin('slothvault', {systemEnvironment: {target: 'macos-arm64'},
        officialReleaseFetcher: async () => ({version: '2.0.0'}), officialReleaseInstaller: async () => ({version: '2.0.0'}),
        componentInstaller: async () => {calls++; throw new Error('must not be called');}});
    assert.equal(result.status, 'installed'); assert.equal(calls, 0);
    assert.equal(fs.existsSync(componentPaths('skill', options).root), false);
});
