import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {getSkillStatus, installSkill} from '../plugins/slothvault/lib/skill-manager.js';
import {uninstallComponents} from '../lib/services/slothvault-components.js';

test('only verified legacy Skill links move to the independent package; custom content stays intact', t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-vault-skill-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    const toolHome = path.join(home, '.pipker', 'slothtool');
    const codex = path.join(home, '.codex');
    const target = path.join(codex, 'skills', 'slothvault-mcp');
    const source = path.join(toolHome, 'runtimes', 'slothvault', 'components', 'skill', 'current', 'slothvault-mcp');
    const old = path.join(toolHome, 'runtimes', 'slothvault', 'current', 'skills', 'slothvault-mcp');
    const skill = '---\nmetadata:\n  version: "1.0.0"\n---\n';
    for (const directory of [source, old]) {
        fs.mkdirSync(directory, {recursive: true});
        fs.writeFileSync(path.join(directory, 'SKILL.md'), skill);
    }
    fs.writeFileSync(path.join(path.dirname(source), 'module.json'), JSON.stringify({module: 'skill', version: '1.0.0'}));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.symlinkSync(old, target, 'dir');
    const options = {homeDir: home, slothToolHome: toolHome, sourcePath: source,
        detectedAgents: ['codex'], env: {CODEX_HOME: codex, PATH: ''}};
    assert.equal(getSkillStatus(options).agents[0].state, 'outdated');
    assert.equal(installSkill(options).agents[0].state, 'installed');
    assert.equal(fs.readlinkSync(target), source);

    fs.unlinkSync(target);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'custom.txt'), 'custom');
    const preserved = installSkill({...options, skipConflicts: true});
    assert.equal(preserved.agents[0].state, 'conflict');
    assert.equal(fs.readFileSync(path.join(target, 'custom.txt'), 'utf8'), 'custom');

    const claude = path.join(home, '.claude');
    const managed = path.join(claude, 'skills', 'slothvault-mcp');
    fs.mkdirSync(path.dirname(managed), {recursive: true});
    fs.symlinkSync(source, managed, 'dir');
    const config = path.join(toolHome, 'plugin-configs', 'slothvault.json');
    fs.mkdirSync(path.dirname(config), {recursive: true});
    fs.writeFileSync(config, '{"profiles":{}}');
    const history = path.join(toolHome, 'data', 'slothvault', 'history.json');
    fs.mkdirSync(path.dirname(history), {recursive: true});
    fs.writeFileSync(history, '{"entries":[]}');
    uninstallComponents({slothToolHome: toolHome, homeDir: home, env: {CODEX_HOME: codex, CLAUDE_CONFIG_DIR: claude}});
    assert.equal(fs.existsSync(managed), false);
    assert.equal(fs.readFileSync(path.join(target, 'custom.txt'), 'utf8'), 'custom');
    assert.equal(fs.existsSync(config), true);
    assert.equal(fs.existsSync(history), true);
    assert.equal(fs.existsSync(old), true);
});
