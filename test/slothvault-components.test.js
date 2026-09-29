import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkComponentUpdate, componentPaths, installComponents, installedComponent,
    installPythonDependencies, VAULT_COMPONENTS} from '../lib/services/slothvault-components.js';

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

test('first install prepares every component before switching pointers and failed update retains the old pointer', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-components-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    const fixtures = Object.fromEntries(VAULT_COMPONENTS.map(module => [module, fixture(root, module)]));
    const options = {
        slothToolHome: path.join(root, 'home'), skipSkillSync: true,
        releaseFetcher: info => fixtures[info.alias].release,
        manifestFetcher: url => fixtures[url.slice('manifest:'.length)].manifest,
        download: (url, destination) => fs.copyFileSync(new URL(url), destination),
        dependencyInstaller: async () => {},
    };
    fixtures.deployment.manifest.sha256 = '0'.repeat(64);
    await assert.rejects(installComponents(undefined, options), /checksum mismatch/u);
    for (const module of VAULT_COMPONENTS) assert.equal(installedComponent(module, options), null);

    fixtures.deployment.manifest.sha256 = sha(fs.readFileSync(fixtures.deployment.archive));
    const installed = await installComponents(undefined, options);
    assert.equal(installed.status, 'updated');
    for (const module of VAULT_COMPONENTS) assert.equal(installedComponent(module, options)?.version, '1.0.0');

    fixtures.skill = fixture(root, 'skill', '1.0.1');
    fixtures.skill.manifest.sha256 = '0'.repeat(64);
    await assert.rejects(installComponents(['skill'], options), /checksum mismatch/u);
    assert.equal(installedComponent('skill', options)?.version, '1.0.0');
    assert.equal(fs.readlinkSync(componentPaths('skill', options).current), path.join(componentPaths('skill', options).releases, '1.0.0'));
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
