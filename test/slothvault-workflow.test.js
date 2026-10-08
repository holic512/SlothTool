import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkPluginUpdate} from '../lib/services/plugin-service.js';
import {checkComponentUpdate, checkAllComponentUpdates, fetchComponentRelease, installComponents} from '../lib/services/slothvault-components.js';
import {VAULT_COMPONENTS, installComponent} from '../plugins/slothvault/lib/component-service.js';

function home(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothvault-no-client-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    return root;
}

test('root UI update checks never consult any Vault package Release', async () => {
    const result = await checkPluginUpdate('slothvault', {
        pluginInfo: {version: '2.4.0', sourceType: 'github-release'},
        officialReleaseFetcher: plugin => {
            assert.equal(plugin.repository, 'holic512/SlothTool');
            return {version: '2.4.0', release: {tag_name: 'plugin-slothvault-v2.4.0'}};
        }, componentChecker: () => assert.fail('Root must not check component Releases')
    });
    assert.equal(result.status, 'latest');
    assert.equal(result.components, undefined);
});

test('retired Client installs are rejected before network requests or Python preparation', async t => {
    const slothToolHome = home(t);
    assert.deepEqual(VAULT_COMPONENTS, ['skill', 'deployment']);
    await assert.rejects(installComponent('mcp-client', {slothToolHome,
        releaseFetcher: () => assert.fail('Retired Client cannot query Releases'),
        dependencyInstaller: () => assert.fail('Retired Client cannot prepare Python')}), /Unknown SlothVault component/u);
    assert.deepEqual(fs.readdirSync(slothToolHome), []);
});

test('explicit component compatibility adapter accepts the single-executable plugin', async t => {
    const pluginDir = path.resolve('plugins/slothvault');
    const result = await checkComponentUpdate('deployment', {pluginDir, slothToolHome: home(t),
        releaseFetcher: () => {throw new Error('offline test');}});
    assert.equal(result.status, 'error');
    assert.match(result.reason, /offline test/u);
});

test('root compatibility rejects Client requests even when an older installed interface still supports them', async t => {
    const root = home(t), pluginDir = path.join(root, 'old-interface'), marker = path.join(root, 'imported.marker');
    fs.mkdirSync(path.join(pluginDir, 'lib'), {recursive: true});
    fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({name: '@holic512/plugin-slothvault', type: 'module',
        bin: {slothvault: 'bin/slothvault.js', 'slothvault-mcp': 'bin/slothvault-mcp.js'}}));
    fs.writeFileSync(path.join(pluginDir, 'lib/component-service.js'), `
        import fs from 'node:fs';
        fs.writeFileSync(${JSON.stringify(marker)}, 'imported');
        export async function checkComponentUpdate(module) { return {module, status: 'latest'}; }
        export async function checkAllComponentUpdates() { throw new Error('Old all-module check includes Client'); }
        export async function fetchComponentRelease() { throw new Error('Client Release request'); }
        export async function installComponents() { throw new Error('Client installation'); }
    `);
    const options = {pluginDir, slothToolHome: path.join(root, 'tool')};
    for (const operation of [
        () => fetchComponentRelease('mcp-client', options),
        () => checkComponentUpdate('mcp-client', options),
        () => installComponents(['skill', 'mcp-client'], options)
    ]) await assert.rejects(operation(), /Unknown SlothVault component: mcp-client/u);
    assert.equal(fs.existsSync(marker), false);
    const result = await checkAllComponentUpdates(options);
    assert.equal(result.status, 'latest');
    assert.deepEqual(result.components.map(item => item.module), ['skill', 'deployment']);
    assert.equal(fs.existsSync(options.slothToolHome), false);
});
