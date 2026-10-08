import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkPluginUpdate, checkSlothVaultRuntimeUpdate, getSlothVaultRuntimePaths,
    fetchLatestSlothVaultRuntime, installSlothVaultRuntime, uninstallSlothVaultRuntime} from '../lib/services/plugin-service.js';

function release(version = '1.0.0') {
    const asset = {name: `holic512-slothvault-runtime-${version}.tgz`, browser_download_url: 'https://example.test/runtime'};
    return {version, asset, release: {assets: [asset, {name: 'slothvault-toolkit.json', browser_download_url: 'https://example.test/manifest'}]}};
}
function manifest(version = '1.0.0') {
    return {schema: 1, packageName: '@holic512/slothvault-runtime', version,
        asset: `holic512-slothvault-runtime-${version}.tgz`, sha256: 'a'.repeat(64), adapterApiMajor: 1, skillVersion: '1.0.0'};
}
function fixture(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-runtime-release-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    return home;
}
function staged(home, version) {
    const dir = path.join(home, `stage-${version}`);
    fs.mkdirSync(path.join(dir, 'bin'), {recursive: true});
    fs.mkdirSync(path.join(dir, 'deploy'), {recursive: true});
    fs.mkdirSync(path.join(dir, 'skills/slothvault-mcp'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({name: '@holic512/slothvault-runtime', version}));
    fs.writeFileSync(path.join(dir, 'runtime-contract.json'), JSON.stringify({schema: 1, adapterApiMajor: 1}));
    fs.writeFileSync(path.join(dir, 'bin/slothvault-runtime.js'), 'console.log("{}")\n');
    fs.writeFileSync(path.join(dir, 'bin/slothvault-mcp.js'), 'console.log("ok")\n');
    fs.writeFileSync(path.join(dir, 'deploy/install.py'), '# fixture\n');
    const skill = '# skill\n';
    fs.writeFileSync(path.join(dir, 'skills/slothvault-mcp/SKILL.md'), skill);
    fs.writeFileSync(path.join(dir, 'skill-release.json'), JSON.stringify({pluginVersion: version, skillVersion: '1.0.0',
        files: {'SKILL.md': createHash('sha256').update(skill).digest('hex')}}));
    return dir;
}

test('root update check manages only the UI and never queries Vault component Releases', async t => {
    const home = fixture(t);
    const options = {slothToolHome: home, releaseFetcher: async () => release(), manifestFetcher: async () => manifest()};
    const runtime = await checkSlothVaultRuntimeUpdate(options);
    assert.equal(runtime.status, 'outdated');
    const check = await checkPluginUpdate('slothvault', {pluginInfo: {version: '2.2.0', sourceType: 'github-release'},
        officialReleaseFetcher: async () => ({version: '2.2.0', release: {assets: []}}),
        componentChecker: async () => {throw new Error('Root must not query component Releases');}});
    assert.equal(check.status, 'latest');
    assert.equal(check.components, undefined);
});

test('toolkit release rejects a mismatched manifest or adapter protocol', async () => {
    const releaseFetcher = async () => release();
    await assert.rejects(fetchLatestSlothVaultRuntime({releaseFetcher,
        manifestFetcher: async () => ({...manifest(), asset: 'other.tgz'})}), /invalid or incompatible/u);
    await assert.rejects(fetchLatestSlothVaultRuntime({releaseFetcher,
        manifestFetcher: async () => ({...manifest(), adapterApiMajor: 2})}), /invalid or incompatible/u);
});

test('runtime switches only after validation and rolls back a failed Skill sync', async t => {
    const home = fixture(t);
    const options = {slothToolHome: home, release: {...release(), manifest: manifest()},
        stageRelease: async () => ({stagedDir: staged(home, '1.0.0')}), syncSkill: async () => '{}'};
    assert.equal((await installSlothVaultRuntime(options)).status, 'updated');
    const paths = getSlothVaultRuntimePaths(options);
    assert.equal(JSON.parse(fs.readFileSync(path.join(paths.current, 'package.json'))).version, '1.0.0');
    const corrupt = staged(home, '1.0.2');
    fs.writeFileSync(path.join(corrupt, 'skills/slothvault-mcp/SKILL.md'), 'tampered\n');
    await assert.rejects(installSlothVaultRuntime({...options,
        release: {...release('1.0.2'), manifest: manifest('1.0.2')},
        stageRelease: async () => ({stagedDir: corrupt})}), /failed validation/u);
    assert.equal(JSON.parse(fs.readFileSync(path.join(paths.current, 'package.json'))).version, '1.0.0');
    await assert.rejects(installSlothVaultRuntime({...options, release: {...release('1.0.1'), manifest: manifest('1.0.1')},
        stageRelease: async () => ({stagedDir: staged(home, '1.0.1')}), syncSkill: async () => {throw new Error('Skill failed');}}), /Skill failed/u);
    assert.equal(JSON.parse(fs.readFileSync(path.join(paths.current, 'package.json'))).version, '1.0.0');
    const noAgent = await installSlothVaultRuntime({...options,
        release: {...release('1.0.3'), manifest: manifest('1.0.3')},
        stageRelease: async () => ({stagedDir: staged(home, '1.0.3')}),
        syncSkill: async () => {throw new Error(JSON.stringify({ok: false, error: {code: 'SKILL_AGENT_NOT_DETECTED'}}));}});
    assert.equal(noAgent.version, '1.0.3');
});

test('runtime uninstall retains SlothTool Profile data', t => {
    const home = fixture(t);
    const paths = getSlothVaultRuntimePaths({slothToolHome: home});
    fs.mkdirSync(paths.root, {recursive: true});
    const config = path.join(home, 'plugin-configs/slothvault.json');
    fs.mkdirSync(path.dirname(config), {recursive: true});
    fs.writeFileSync(config, '{"profiles":{}}');
    uninstallSlothVaultRuntime({slothToolHome: home});
    assert.equal(fs.existsSync(paths.root), false);
    assert.equal(fs.existsSync(config), true);
});
