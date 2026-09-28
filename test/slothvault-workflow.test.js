import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {setupConnection} from '../plugins/slothvault/lib/setup.js';
import {readConfig, resolveProfile} from '../plugins/slothvault/lib/config.js';
import {getSkillStatus, getSkillPaths} from '../plugins/slothvault/lib/skill-manager.js';
import {checkSkillUpdate, updateSkill} from '../plugins/slothvault/lib/skill-update.js';
import {createSkillMetadata, verifySkillMetadata} from '../plugins/slothvault/lib/skill-metadata.js';
import {SlothVaultMcpBusinessError} from '../plugins/slothvault/lib/service.js';
import {formatSlothVaultError} from '../plugins/slothvault/lib/i18n.js';
import {checkPluginUpdate} from '../lib/services/plugin-service.js';

const key = `svmcp_${'a'.repeat(24)}.${'b'.repeat(43)}`;
function isolated(t) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-workflow-'));
    t.after(() => fs.rmSync(homeDir, {recursive: true, force: true}));
    return {homeDir, env: {PATH: ''}, detectedAgents: ['codex', 'claude-code']};
}
test('two-field setup reuses normalized URLs and keeps other profiles, saved state and private permissions', async t => {
    const options = isolated(t);
    const checkConnection = async request => ({server: {name: 'slothvault-admin-mcp'}, request});
    const first = await setupConnection({endpoint: 'https://vault.example/', apiKey: key}, {...options, checkConnection});
    assert.equal(first.connected, true);
    assert.equal(first.profile.endpoint, 'https://vault.example/mcp');
    assert.ok(!JSON.stringify(first).includes(key));
    const reused = await setupConnection({endpoint: 'https://vault.example/mcp', apiKey: key}, {...options, checkConnection});
    assert.equal(reused.profile.name, first.profile.name);
    const offline = await setupConnection({endpoint: 'https://other.example', apiKey: key}, {...options, checkConnection: async () => { throw new Error(`fetch failed ${key}`); }});
    assert.equal(offline.saved, true);
    assert.equal(offline.connected, false);
    assert.equal(offline.error.code, 'MCP_NETWORK_ERROR');
    assert.equal(Object.keys(readConfig(options).profiles).length, 2);
    assert.equal(resolveProfile(first.profile.name, options).endpoint, first.profile.endpoint);
    assert.equal(readConfig(options).defaultProfile, offline.profile.name);
    assert.ok(!JSON.stringify(offline).includes(key));
    const configPath = path.join(options.homeDir, '.pipker/slothtool/plugin-configs/slothvault.json');
    if (process.platform !== 'win32') assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
});

test('local skill update repairs old managed and missing links while preserving custom targets', async t => {
    const options = isolated(t);
    const paths = getSkillPaths(options);
    const old = path.join(options.homeDir, '.pipker/slothtool/plugins/slothvault-mcp/skills/slothvault-mcp');
    fs.mkdirSync(path.dirname(paths.agents[0].targetPath), {recursive: true});
    fs.symlinkSync(old, paths.agents[0].targetPath, 'dir');
    fs.mkdirSync(paths.agents[1].targetPath, {recursive: true});
    fs.writeFileSync(path.join(paths.agents[1].targetPath, 'custom.txt'), 'do not replace');
    assert.equal(getSkillStatus(options).agents[0].state, 'outdated');
    const result = await updateSkill({...options, local: true});
    assert.equal(result.version, '1.0.0');
    assert.equal(result.pluginVersion, '2.1.0');
    assert.equal(result.agents[0].state, 'installed');
    assert.equal(result.agents[0].version, '1.0.0');
    assert.equal(result.agents[1].state, 'conflict');
    assert.equal(fs.readFileSync(path.join(paths.agents[1].targetPath, 'custom.txt'), 'utf8'), 'do not replace');
    assert.equal(result.verified, true);
    fs.unlinkSync(paths.agents[0].targetPath);
    assert.equal((await updateSkill({...options, local: true})).agents[0].state, 'installed');
});

test('official update checks distinguish unavailable from current and reenter a fresh process before sync', async t => {
    const options = isolated(t);
    const failed = await checkSkillUpdate({...options, runManager: async () => { throw new Error('offline'); }});
    assert.equal(failed.checkState, 'unavailable');
    assert.equal(failed.latestVersion, null);
    await assert.rejects(updateSkill({...options, runManager: async () => { throw new Error('offline'); }}), {code: 'SKILL_CHECK_UNAVAILABLE'});
    const local = await updateSkill({...options, local: true});
    for (const status of ['latest', 'outdated']) {
        const calls = [];
        const result = await updateSkill({...options, runManager: async args => {
            calls.push(args);
            if (args.includes('--check')) return {status, latestVersion: '2.1.0', skillMetadata: local.metadata};
            if (args[0] === 'update') return {status: 'updated'};
            return local;
        }});
        assert.equal(result.latestVersion, '1.0.0');
        assert.equal(result.pluginUpdated, status === 'outdated');
        assert.deepEqual(calls.at(-1), ['slothvault', 'skill', 'update', '--local', '--json']);
        assert.equal(calls.length, status === 'outdated' ? 3 : 2);
    }
    await assert.rejects(updateSkill({...options, runManager: async args => args.includes('--check')
        ? {status: 'latest', latestVersion: '2.1.0', skillMetadata: {...local.metadata, files: {'SKILL.md': 'invalid'}}} : local}), {code: 'SKILL_VERIFY_FAILED'});
});

test('skill release metadata catches stale or modified files and root updater returns the official metadata', async t => {
    const options = isolated(t);
    const source = getSkillStatus(options).sourcePath;
    const copy = path.join(options.homeDir, 'skill');
    fs.cpSync(source, copy, {recursive: true});
    const metadata = createSkillMetadata(copy, '2.1.0');
    assert.equal(verifySkillMetadata(copy, metadata, '2.1.0').skillVersion, '1.0.0');
    fs.appendFileSync(path.join(copy, 'SKILL.md'), '\nlocal edit\n');
    assert.throws(() => verifySkillMetadata(copy, metadata, '2.1.0'), /does not match/u);
    const check = await checkPluginUpdate('slothvault', {
        pluginInfo: {version: '2.0.6', sourceType: 'github-release'}, includeSkill: true,
        officialReleaseFetcher: async () => ({version: '2.1.0', release: {assets: [{name: 'slothvault-skill.json', browser_download_url: 'https://example.test/metadata'}]}}),
        skillMetadataFetcher: async () => metadata
    });
    assert.equal(check.status, 'outdated');
    assert.deepEqual(check.skillMetadata, metadata);
});

test('business errors expose only bounded reason, entity IDs and validation issues', () => {
    const error = new SlothVaultMcpBusinessError('Business error', {isError: true, structuredContent: {error: {
        status: 409, code: 409, message: `Secret ${key}`, data: {reason: 'TARGET_VERSION_NOT_EMPTY', projectVersionId: '12', apiKey: key, body: 'private document', issues: [{code: 'NOTE_PRIMARY_EMPTY', entity: 'content', entityId: '44', message: `Missing body ${key}`}]}
    }}});
    assert.equal(error.business.reason, 'TARGET_VERSION_NOT_EMPTY');
    assert.equal(error.business.projectVersionId, '12');
    assert.equal(error.business.issues[0].entityId, '44');
    assert.ok(!JSON.stringify(error.business).includes(key));
    assert.ok(!JSON.stringify(error.business).includes('private document'));
    assert.match(formatSlothVaultError(error), /目标草稿已有内容|target draft already contains/u);
});

test('setup CLI saves stdin keys without printing them and reports connection failure as saved', t => {
    const options = isolated(t);
    const result = spawnSync(process.execPath, ['plugins/slothvault/bin/slothvault-mcp.js', 'setup', '--url', 'http://127.0.0.1:1', '--key-stdin', '--json'], {
        input: key, encoding: 'utf8', timeout: 10_000,
        env: {...process.env, HOME: options.homeDir, USERPROFILE: options.homeDir, CODEX_HOME: path.join(options.homeDir, '.codex'), CLAUDE_CONFIG_DIR: path.join(options.homeDir, '.claude')}
    });
    assert.equal(result.status, 4, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.saved, true);
    assert.equal(output.connected, false);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(key));
    assert.equal(readConfig(options).defaultProfile, 'default');
});
