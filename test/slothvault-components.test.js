import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkComponentUpdate, componentPaths, installComponent, installedComponent,
    VAULT_COMPONENTS, getComponentStatus} from '../plugins/slothvault/lib/component-service.js';
import {installSkill, updateSkill} from '../plugins/slothvault/lib/skill-service.js';

const sha = value => createHash('sha256').update(value).digest('hex');

function fixture(root, module, version = '1.0.0') {
    const directory = path.join(root, `${module}-${version}`);
    const packageDir = path.join(directory, 'package');
    fs.mkdirSync(packageDir, {recursive: true});
    const bridgeApiMajor = 1;
    const files = {'module.json': JSON.stringify({schema: 1, module, version, bridgeApiMajor})};
    if (module === 'skill') files['slothvault-mcp/SKILL.md'] = `---\nmetadata:\n  version: "${version}"\n---\n`;
    else files['install.py'] = 'print("ready")\n';
    for (const [relative, content] of Object.entries(files)) {
        const target = path.join(packageDir, relative);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, content);
    }
    const asset = `slothvault-${module}-${version}.tgz`;
    const archive = path.join(directory, asset);
    const tar = spawnSync('tar', ['-czf', archive, '-C', directory, 'package']);
    assert.equal(tar.status, 0, tar.stderr?.toString());
    return {archive, release: {asset: {name: asset, browser_download_url: `file://${archive}`}, version,
        release: {assets: [{name: `slothvault-${module}-manifest.json`, browser_download_url: `manifest:${module}`}]}},
    manifest: {schema: 1, module, version, asset, sha256: sha(fs.readFileSync(archive)), bridgeApiMajor, protocolMajor: bridgeApiMajor,
        ...(module === 'skill' ? {} : {minPython: '3.10'}),
        files: Object.fromEntries(Object.entries(files).map(([name, data]) => [name, sha(data)]))}};
}

test('each package installs independently and a failed update retains only its own old active content', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-components-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const fixtures = Object.fromEntries(['skill', 'deployment'].map(module => [module, fixture(root, module)]));
    const queried = [];
    const options = {
        slothToolHome: path.join(root, 'home'), skipSkillSync: true,
        releaseFetcher: info => {queried.push(info.alias); return fixtures[info.alias].release;},
        manifestFetcher: url => fixtures[url.slice('manifest:'.length)].manifest,
        download: (url, destination) => fs.copyFileSync(new URL(url), destination),
    };
    fixtures.deployment.manifest.sha256 = '0'.repeat(64);
    await assert.rejects(installComponent('deployment', options), /checksum mismatch/u);
    assert.equal(installedComponent('deployment', options), null);
    assert.equal((await installComponent('skill', options)).status, 'updated');
    assert.equal(fs.existsSync(path.join(options.slothToolHome, 'runtimes/slothvault/components/mcp-client')), false);

    fixtures.deployment.manifest.sha256 = sha(fs.readFileSync(fixtures.deployment.archive));
    const installed = await installComponent('deployment', options);
    assert.equal(installed.status, 'updated');
    for (const module of ['skill', 'deployment']) assert.equal(installedComponent(module, options)?.version, '1.0.0');

    fixtures.skill = fixture(root, 'skill', '1.0.1');
    fixtures.skill.manifest.sha256 = '0'.repeat(64);
    await assert.rejects(installComponent('skill', options), /checksum mismatch/u);
    assert.equal(installedComponent('skill', options)?.version, '1.0.0');
    assert.equal(fs.lstatSync(componentPaths('skill', options).current).isSymbolicLink(), false);
    assert.equal(installedComponent('deployment', options)?.version, '1.0.0');
    assert.ok(queried.every(module => module !== 'mcp-client'));
    assert.ok(fs.readdirSync(componentPaths('skill', options).root).every(name => !name.startsWith('.stage-')));
});

test('Skill installation and updates sync Releases, repair links without download and preserve custom targets', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-skill-sync-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    let payload = fixture(root, 'skill'), downloads = 0, checks = 0;
    const options = {homeDir: root, slothToolHome: path.join(root, 'tool'), env: {PATH: ''}, detectedAgents: ['codex'],
        releaseFetcher: () => {checks++; return payload.release;}, manifestFetcher: () => payload.manifest,
        download: (url, destination) => {downloads++; fs.copyFileSync(new URL(url), destination);}};
    const installed = await installSkill(options);
    assert.equal(installed.agents[0].state, 'installed');
    assert.equal(fs.existsSync(path.join(options.slothToolHome, 'runtimes/slothvault/components/mcp-client')), false);
    const paths = componentPaths('skill', options), target = installed.agents[0].targetPath;
    assert.equal(fs.lstatSync(paths.current).isDirectory(), true);
    fs.unlinkSync(target);
    assert.equal((await updateSkill(options)).agents[0].state, 'installed');
    assert.equal(downloads, 1);
    assert.equal(checks, 2);
    fs.unlinkSync(target); fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'custom.txt'), 'keep');
    payload = fixture(root, 'skill', '1.0.1');
    assert.equal((await updateSkill(options)).agents[0].state, 'conflict');
    assert.equal(fs.readFileSync(path.join(target, 'custom.txt'), 'utf8'), 'keep');
    assert.equal((await installSkill({...options, replace: true})).agents[0].state, 'installed');
    assert.equal(fs.existsSync(paths.releases), false);
    assert.ok(fs.readdirSync(paths.root).every(name => !/^\.(stage|previous)-/u.test(name)));
});

test('link failure rolls Skill activation back; a damaged deployment package is repairable at the same version', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-component-rollback-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    let payload = fixture(root, 'skill');
    const options = {homeDir: root, slothToolHome: path.join(root, 'tool'), env: {PATH: ''}, detectedAgents: ['codex'],
        releaseFetcher: () => payload.release, manifestFetcher: () => payload.manifest,
        download: (url, destination) => fs.copyFileSync(new URL(url), destination)};
    const initial = await installSkill(options);
    fs.unlinkSync(initial.agents[0].targetPath);
    payload = fixture(root, 'skill', '1.0.1');
    await assert.rejects(installSkill({...options, createLink: () => {throw new Error('link creation failed');}}), /link creation failed/u);
    assert.equal(installedComponent('skill', options)?.version, '1.0.0');
    payload = fixture(root, 'deployment');
    await installComponent('deployment', options);
    fs.writeFileSync(path.join(componentPaths('deployment', options).current, 'install.py'), 'corrupted');
    assert.equal(getComponentStatus('deployment', options).state, 'invalid');
    await installComponent('deployment', options);
    assert.equal(getComponentStatus('deployment', options).state, 'installed');
    assert.equal(fs.readFileSync(path.join(componentPaths('deployment', options).current, 'install.py'), 'utf8'), 'print("ready")\n');
});

test('unavailable update source is reported without changing an installed component', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-components-check-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const options = {slothToolHome: root, releaseFetcher: async () => {throw new Error('release source unavailable');}};
    const result = await checkComponentUpdate('deployment', options);
    assert.equal(result.status, 'error');
    assert.match(result.reason, /unavailable/u);
    assert.equal(fs.existsSync(path.join(options.slothToolHome, 'runtimes/slothvault/components/mcp-client')), false);
});

test('remaining package types reject unlisted virtual environments and keep their old active content', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-no-client-environment-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    for (const module of ['skill', 'deployment']) {
        let payload = fixture(root, module);
        const options = {slothToolHome: path.join(root, 'tool'), skipSkillSync: true,
            releaseFetcher: () => payload.release, manifestFetcher: () => payload.manifest,
            download: (url, destination) => fs.copyFileSync(new URL(url), destination)};
        await installComponent(module, options);
        payload = fixture(root, module, '1.0.1');
        const directory = path.dirname(payload.archive), extra = path.join(directory, 'package/.venv/bin/python');
        fs.mkdirSync(path.dirname(extra), {recursive: true});
        fs.writeFileSync(extra, 'unlisted executable');
        const tar = spawnSync('tar', ['-czf', payload.archive, '-C', directory, 'package']);
        assert.equal(tar.status, 0, tar.stderr?.toString());
        payload.manifest.sha256 = sha(fs.readFileSync(payload.archive));
        await assert.rejects(installComponent(module, options), /Python environment/u);
        assert.equal(installedComponent(module, options)?.version, '1.0.0');
        assert.equal(fs.existsSync(path.join(componentPaths(module, options).current, '.venv')), false);
    }
});

test('cleanup locks block installation before any Release request, and aborted preparation keeps the active Skill', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-locked-update-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const options = {slothToolHome: path.join(root, 'tool'), skipSkillSync: true};
    fs.mkdirSync(options.slothToolHome);
    const lock = path.join(options.slothToolHome, '.slothvault-cleanup-lock');
    fs.writeFileSync(lock, 'locked');
    await assert.rejects(installComponent('skill', {...options, releaseFetcher: () => assert.fail('No request while cleanup is active')}), {code: 'COMPONENT_BUSY'});
    fs.unlinkSync(lock);
    let payload = fixture(root, 'skill');
    const transport = {releaseFetcher: () => payload.release, manifestFetcher: () => payload.manifest,
        download: (url, destination) => fs.copyFileSync(new URL(url), destination)};
    await installComponent('skill', {...options, ...transport});
    payload = fixture(root, 'skill', '1.0.1');
    const controller = new AbortController();
    await assert.rejects(installComponent('skill', {...options, ...transport, signal: controller.signal,
        download: (url, destination) => {fs.copyFileSync(new URL(url), destination); controller.abort();}}), {name: 'AbortError'});
    assert.equal(installedComponent('skill', options)?.version, '1.0.0');
    assert.ok(fs.readdirSync(componentPaths('skill', options).root).every(name => !/^\.(stage|previous)-/u.test(name)));
});
