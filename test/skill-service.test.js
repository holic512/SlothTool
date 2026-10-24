import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {getSkillStatus, manageSkill} from '../lib/services/skill-service.js';
import {normalizeSettings} from '../lib/settings.js';

function fixture(t, agents = ['.codex', '.claude']) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-skill-'));
    t.after(() => fs.rmSync(homeDir, {recursive: true, force: true}));
    for (const agent of agents) fs.mkdirSync(path.join(homeDir, agent));
    const sourcePath = path.join(homeDir, 'package', 'skills', 'slothtool');
    fs.mkdirSync(sourcePath, {recursive: true});
    fs.writeFileSync(path.join(sourcePath, 'SKILL.md'), '---\nname: slothtool\nmetadata:\n  version: "2.11.0"\n---\nSkill\n');
    let current = normalizeSettings({language: 'en'});
    const settingsStore = {readSettings: () => structuredClone(current), writeSettings: value => { current = normalizeSettings(value); }};
    const options = {homeDir, sourcePath, packageVersion: '2.11.0', env: {PATH: ''}, settingsStore};
    return {homeDir, sourcePath, options, target: agent => path.join(homeDir, agent || '.codex', 'skills', 'slothtool')};
}

test('inspection is read-only; no detected agents are installed implicitly', t => {
    const f = fixture(t, []);
    assert.equal(getSkillStatus(f.options).agents.every(agent => agent.state === 'not-detected'), true);
    const result = manageSkill('install', f.options);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NO_AGENTS');
    assert.equal(fs.existsSync(path.join(f.homeDir, '.codex')), false);
    assert.equal(fs.existsSync(path.join(f.homeDir, '.claude')), false);
});

test('installation is idempotent, preserves settings and unrelated Skills, and safely uninstalls', t => {
    const f = fixture(t);
    const other = path.join(path.dirname(f.target()), 'slothvault-mcp');
    fs.mkdirSync(other, {recursive: true});
    fs.writeFileSync(path.join(other, 'SKILL.md'), 'preserved');
    assert.equal(manageSkill('install', f.options).ok, true);
    const first = fs.lstatSync(f.target()).ino;
    const repeat = manageSkill('install', f.options);
    assert.equal(repeat.ok, true);
    assert.equal(fs.lstatSync(f.target()).ino, first);
    assert.equal(repeat.agents.every(agent => agent.state === 'installed' && agent.version === '2.11.0'), true);
    assert.equal(f.options.settingsStore.readSettings().language, 'en');
    assert.equal(f.options.settingsStore.readSettings().skill.installations.length, 2);
    const removed = manageSkill('uninstall', f.options);
    assert.equal(removed.ok, true);
    assert.equal(fs.existsSync(f.target()), false);
    assert.equal(fs.readFileSync(path.join(other, 'SKILL.md'), 'utf8'), 'preserved');
    assert.ok(fs.existsSync(f.sourcePath));
    assert.equal(manageSkill('uninstall', f.options).ok, true);
});

test('config environment override and executable detection select only the requested agent', t => {
    const f = fixture(t, []);
    const bin = path.join(f.homeDir, 'bin');
    fs.mkdirSync(bin);
    const command = path.join(bin, process.platform === 'win32' ? 'codex.CMD' : 'codex');
    fs.writeFileSync(command, '');
    fs.chmodSync(command, 0o755);
    const config = path.join(f.homeDir, 'custom codex');
    const options = {...f.options, agent: 'codex', env: {PATH: bin, CODEX_HOME: config}};
    assert.equal(manageSkill('install', options).ok, true);
    assert.ok(fs.lstatSync(path.join(config, 'skills', 'slothtool')).isSymbolicLink());
    assert.equal(fs.existsSync(path.join(f.homeDir, '.codex')), false);
    assert.equal(fs.existsSync(path.join(f.homeDir, '.claude')), false);
});

test('Claude configuration override is honored without new .agents links', t => {
    const f = fixture(t, []);
    const config = path.join(f.homeDir, 'claude custom');
    fs.mkdirSync(config);
    const result = manageSkill('install', {...f.options, env: {PATH: '', CLAUDE_CONFIG_DIR: config}});
    assert.equal(result.ok, true);
    assert.equal(result.agents.find(agent => agent.id === 'claude-code').targetPath, path.join(config, 'skills', 'slothtool'));
    assert.equal(fs.existsSync(path.join(f.homeDir, '.agents')), false);
});

for (const kind of ['directory', 'file', 'link', 'unregistered-source-link']) {
    test(`refuses ${kind} conflicts without installing other targets or overwriting content`, t => {
        const f = fixture(t);
        fs.mkdirSync(path.dirname(f.target()), {recursive: true});
        if (kind === 'directory') fs.mkdirSync(f.target());
        if (kind === 'file') fs.writeFileSync(f.target(), 'mine');
        if (kind === 'link') fs.symlinkSync(path.join(f.homeDir, 'missing-source'), f.target(), 'dir');
        if (kind === 'unregistered-source-link') fs.symlinkSync(f.sourcePath, f.target(), 'dir');
        for (const action of ['install', 'update', 'uninstall']) {
            const result = manageSkill(action, f.options);
            assert.equal(result.ok, false);
            assert.equal(result.error.code, 'CONFLICT');
            assert.ok(fs.lstatSync(f.target()));
            assert.equal(fs.existsSync(f.target('.claude')), false);
        }
    });
}

test('repairs a registered missing or broken link and moves old sources without deleting them', t => {
    const f = fixture(t);
    assert.equal(manageSkill('install', f.options).ok, true);
    const originalSource = f.sourcePath;
    const nextSource = path.join(f.homeDir, 'new package', 'slothtool');
    fs.mkdirSync(path.dirname(nextSource), {recursive: true});
    fs.cpSync(originalSource, nextSource, {recursive: true});
    const next = {...f.options, sourcePath: nextSource};
    assert.equal(getSkillStatus(next).agents[0].state, 'outdated');
    assert.equal(manageSkill('update', next).ok, true);
    assert.equal(fs.realpathSync(f.target()), fs.realpathSync(nextSource));
    assert.ok(fs.existsSync(originalSource));
    fs.unlinkSync(f.target());
    assert.equal(manageSkill('update', {...next, agent: 'codex'}).ok, true);
    fs.rmSync(nextSource, {recursive: true});
    assert.equal(getSkillStatus(f.options).agents[0].state, 'broken');
    assert.equal(manageSkill('update', f.options).ok, true);
    assert.equal(fs.realpathSync(f.target()), fs.realpathSync(originalSource));
});

test('update does not install previously unregistered targets', t => {
    const f = fixture(t);
    assert.equal(manageSkill('update', f.options).error.code, 'NOT_MANAGED');
    assert.equal(fs.existsSync(f.target()), false);
});

test('uninstall works when bundled source has disappeared', t => {
    const f = fixture(t);
    manageSkill('install', f.options);
    fs.rmSync(f.sourcePath, {recursive: true});
    assert.equal(manageSkill('uninstall', f.options).ok, true);
    assert.equal(fs.existsSync(f.target()), false);
    assert.equal(f.options.settingsStore.readSettings().skill.installations.length, 0);
});

test('changing a managed link to an unrelated destination prevents uninstall', t => {
    const f = fixture(t);
    manageSkill('install', f.options);
    fs.unlinkSync(f.target());
    fs.symlinkSync(f.homeDir, f.target(), 'dir');
    assert.equal(manageSkill('uninstall', f.options).error.code, 'CONFLICT');
    assert.equal(fs.realpathSync(f.target()), fs.realpathSync(f.homeDir));
});

test('source version mismatch stops installation before creating targets', t => {
    const f = fixture(t);
    assert.equal(manageSkill('install', {...f.options, packageVersion: '9.0.0'}).error.code, 'SOURCE_INVALID');
    assert.equal(fs.existsSync(f.target()), false);
});

test('failed second link staging cleans the first staged link and does not register anything', t => {
    const f = fixture(t);
    let calls = 0;
    const fileSystem = {...fs, symlinkSync(...args) {
        if (++calls === 2) throw new Error('staging failed');
        fs.symlinkSync(...args);
    }};
    assert.equal(manageSkill('install', {...f.options, fileSystem}).ok, false);
    assert.equal(fs.existsSync(f.target()), false);
    assert.deepEqual(fs.readdirSync(path.dirname(f.target())), []);
    assert.deepEqual(f.options.settingsStore.readSettings().skill.installations, []);
});

for (const action of ['update', 'uninstall']) {
    test(`failed settings write rolls back ${action} and preserves prior links`, t => {
        const f = fixture(t);
        manageSkill('install', f.options);
        const nextSource = path.join(f.homeDir, 'new-source');
        fs.cpSync(f.sourcePath, nextSource, {recursive: true});
        const store = {...f.options.settingsStore, writeSettings() { throw new Error('disk full'); }};
        const result = manageSkill(action, {...f.options, sourcePath: nextSource, settingsStore: store});
        assert.equal(result.ok, false);
        for (const agent of ['.codex', '.claude']) {
            assert.equal(fs.realpathSync(f.target(agent)), fs.realpathSync(f.sourcePath));
            assert.deepEqual(fs.readdirSync(path.dirname(f.target(agent))), ['slothtool']);
        }
        assert.equal(f.options.settingsStore.readSettings().skill.installations[0].sourcePath, f.sourcePath);
    });
}

test('failure during the second target swap rolls the first target back', t => {
    const f = fixture(t);
    manageSkill('install', f.options);
    const nextSource = path.join(f.homeDir, 'new-source');
    fs.cpSync(f.sourcePath, nextSource, {recursive: true});
    const fileSystem = {...fs, renameSync(from, to) {
        if (from.endsWith('.new') && to === f.target('.claude')) throw new Error('swap failed');
        fs.renameSync(from, to);
    }};
    const result = manageSkill('update', {...f.options, sourcePath: nextSource, fileSystem});
    assert.equal(result.ok, false);
    for (const agent of ['.codex', '.claude']) {
        assert.equal(fs.realpathSync(f.target(agent)), fs.realpathSync(f.sourcePath));
        assert.deepEqual(fs.readdirSync(path.dirname(f.target(agent))), ['slothtool']);
    }
});

test('Windows uses a directory junction without falling back to a copied directory', t => {
    const f = fixture(t, ['.codex']);
    const kinds = [];
    const fileSystem = {...fs, symlinkSync(source, target, kind) { kinds.push(kind); fs.symlinkSync(source, target, kind); }};
    assert.equal(manageSkill('install', {...f.options, platform: 'win32', fileSystem}).ok, true);
    assert.deepEqual(kinds, ['junction']);
});

test('a conflict created between inspection and transaction planning is never adopted or removed', t => {
    const f = fixture(t, ['.codex']);
    fs.mkdirSync(path.dirname(f.target()), {recursive: true});
    let calls = 0;
    const fileSystem = {...fs, lstatSync(target, ...args) {
        if (target === f.target() && ++calls === 2) fs.writeFileSync(target, 'unrelated content');
        return fs.lstatSync(target, ...args);
    }};
    const result = manageSkill('install', {...f.options, fileSystem});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'TARGET_CHANGED');
    assert.equal(fs.readFileSync(f.target(), 'utf8'), 'unrelated content');
    assert.deepEqual(f.options.settingsStore.readSettings().skill.installations, []);
});

test('a swap does not depend on a fallible metadata read to register rollback state', t => {
    const f = fixture(t);
    manageSkill('install', f.options);
    const nextSource = path.join(f.homeDir, 'new-source');
    fs.cpSync(f.sourcePath, nextSource, {recursive: true});
    let swapped = false;
    let targetReads = 0;
    const fileSystem = {...fs,
        renameSync(from, to) {
            fs.renameSync(from, to);
            if (from.endsWith('.new') && to === f.target('.claude')) swapped = true;
        },
        lstatSync(target, ...args) {
            if (swapped && target === f.target('.claude')) targetReads += 1;
            return fs.lstatSync(target, ...args);
        }
    };
    const result = manageSkill('update', {...f.options, sourcePath: nextSource, fileSystem});
    assert.equal(result.ok, true);
    assert.equal(targetReads, 1, 'only the final status inspection reads the swapped target');
    assert.equal(fs.realpathSync(f.target('.claude')), fs.realpathSync(nextSource));
});

test('shared agent configuration directories are rejected before writing links', t => {
    const f = fixture(t);
    const shared = path.join(f.homeDir, '.codex');
    const result = manageSkill('install', {...f.options, env: {PATH: '', CODEX_HOME: shared, CLAUDE_CONFIG_DIR: shared}});
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'DUPLICATE_TARGET');
    assert.equal(fs.existsSync(f.target()), false);
});


test('empty POSIX PATH components detect an executable in the current directory', {skip: process.platform === 'win32'}, t => {
    const f = fixture(t, []);
    const previous = process.cwd();
    process.chdir(f.homeDir);
    t.after(() => process.chdir(previous));
    fs.writeFileSync(path.join(f.homeDir, 'codex'), '', {mode: 0o755});
    assert.equal(getSkillStatus({...f.options, env: {PATH: ':/nonexistent-slothtool-bin'}}).agents[0].detected, true);
});

test('default update repairs registered targets without installing newly detected agents', t => {
    const f = fixture(t);
    assert.equal(manageSkill('install', {...f.options, agent: 'codex'}).ok, true);
    fs.unlinkSync(f.target());
    const result = manageSkill('update', f.options);
    assert.equal(result.ok, true);
    assert.equal(result.agents.find(agent => agent.id === 'codex').state, 'installed');
    assert.equal(result.agents.find(agent => agent.id === 'claude-code').state, 'missing');
    assert.equal(fs.existsSync(f.target('.claude')), false);
});
