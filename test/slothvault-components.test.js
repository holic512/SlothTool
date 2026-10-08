import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkComponentUpdate, componentPaths, installComponent, installedComponent,
    installPythonDependencies, getComponentStatus} from '../plugins/slothvault/lib/component-service.js';
import {installSkill, updateSkill} from '../plugins/slothvault/lib/skill-service.js';

const sha = value => createHash('sha256').update(value).digest('hex');

function fixture(root, module, version = '1.0.0') {
    const directory = path.join(root, `${module}-${version}`);
    const packageDir = path.join(directory, 'package');
    fs.mkdirSync(packageDir, {recursive: true});
    const bridgeApiMajor = module === 'mcp-client' ? 2 : 1;
    const files = {'module.json': JSON.stringify({schema: 1, module, version, bridgeApiMajor})};
    if (module === 'mcp-client') Object.assign(files, {'slothvault_mcp.py': 'print("ready")\n', 'requirements.lock': '# locked\n'});
    else if (module === 'skill') files['slothvault-mcp/SKILL.md'] = `---\nmetadata:\n  version: "${version}"\n---\n`;
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
        dependencyInstaller: async () => {},
    };
    fixtures.deployment.manifest.sha256 = '0'.repeat(64);
    await assert.rejects(installComponent('deployment', options), /checksum mismatch/u);
    assert.equal(installedComponent('deployment', options), null);
    assert.equal((await installComponent('skill', options)).status, 'updated');
    assert.equal(installedComponent('mcp-client', options), null);

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
    assert.equal(installedComponent('mcp-client', options), null);
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
    const result = await checkComponentUpdate('mcp-client', options);
    assert.equal(result.status, 'error');
    assert.match(result.reason, /unavailable/u);
    assert.equal(installedComponent('mcp-client', options), null);
});

test('MCP repair replaces a damaged or missing environment at the same Release and failures retain the old Client', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-client-repair-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    let payload = fixture(root, 'mcp-client'), environments = 0;
    const pythonPath = directory => path.join(directory, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const options = {slothToolHome: path.join(root, 'tool'),
        releaseFetcher: () => payload.release, manifestFetcher: () => payload.manifest,
        download: (url, destination) => fs.copyFileSync(new URL(url), destination),
        dependencyInstaller: async directory => {const python = pythonPath(directory); fs.mkdirSync(path.dirname(python), {recursive: true}); fs.writeFileSync(python, 'environment-' + ++environments);}};
    await installComponent('mcp-client', options);
    const current = componentPaths('mcp-client', options).current;
    assert.equal(getComponentStatus('mcp-client', options).state, 'installed');
    await installComponent('mcp-client', {...options, runtimeValidator: async () => {throw new Error('broken dependency');}});
    assert.equal(fs.readFileSync(pythonPath(current), 'utf8'), 'environment-2');
    fs.unlinkSync(pythonPath(current));
    assert.equal(getComponentStatus('mcp-client', options).state, 'invalid');
    await installComponent('mcp-client', options);
    assert.equal(fs.readFileSync(pythonPath(current), 'utf8'), 'environment-3');
    payload = fixture(root, 'mcp-client', '1.0.1');
    await assert.rejects(installComponent('mcp-client', {...options, dependencyInstaller: async () => {throw new Error('pip failed');}}), /pip failed/u);
    assert.equal(installedComponent('mcp-client', options)?.version, '1.0.0');
    assert.equal(fs.readFileSync(pythonPath(current), 'utf8'), 'environment-3');
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

test('Python dependencies retry a mirror only after a connection failure', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-pip-retry-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const calls = [];
    let installAttempts = 0;
    const commandRunner = async (command, args, options) => {
        calls.push({args, options});
        if (args[0] === '-c') return '3.10\n';
        if (args.includes('install') && installAttempts++ === 0) throw new Error('Temporary failure in name resolution');
        return '{}\n';
    };
    await installPythonDependencies(root, {commandRunner, networkSettings: {proxy: {enabled: false}, pypi: {fallbackUrl: 'https://mirror.example/simple'}}});
    const installCalls = calls.filter(({args}) => args.includes('install')).map(({args}) => args);
    assert.equal(installCalls.length, 2);
    assert.equal(installCalls[0][installCalls[0].indexOf('--index-url') + 1], 'https://pypi.org/simple');
    assert.equal(installCalls[1][installCalls[1].indexOf('--index-url') + 1], 'https://mirror.example/simple');
    assert.ok(installCalls.every(args => args.includes('--require-hashes')));
    assert.equal(calls.at(-1).options.env.PYTHONDONTWRITEBYTECODE, '1');

    calls.length = 0;
    installAttempts = 0;
    await assert.rejects(installPythonDependencies(root, {networkSettings: {proxy: {enabled: false}},
        commandRunner: async (command, args) => {
            calls.push({args});
            if (args[0] === '-c') return '3.10';
            if (args.includes('install')) throw new Error('THESE PACKAGES DO NOT MATCH THE HASHES');
            return '';
        }}), /HASHES/u);
    assert.equal(calls.filter(({args}) => args.includes('install')).length, 1);
});
