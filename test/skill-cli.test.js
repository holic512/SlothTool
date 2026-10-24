import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-skill-cli-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    return {home, run(args) {
        return spawnSync(process.execPath, [path.join(root, 'bin/slothtool.js'), ...args], {
            cwd: home, encoding: 'utf8', timeout: 15000,
            env: {...process.env, HOME: home, USERPROFILE: home, PATH: '', CODEX_HOME: path.join(home, '.codex'),
                CLAUDE_CONFIG_DIR: path.join(home, '.claude'), SLOTHTOOL_TUI_TEST_ACTION: ''}
        });
    }};
}

test('help documents root Skill without replacing plugin installation or default help', t => {
    const f = fixture(t);
    for (const args of [['--help'], []]) {
        const result = f.run(args);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /slothtool skill/u);
        assert.match(result.stdout, /slothtool install <alias>/u);
    }
    const help = f.run(['skill', '--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--agent codex\|claude-code\|all/u);
});

test('status is read-only and installation errors are structured on stdout', t => {
    const f = fixture(t);
    const status = f.run(['skill', 'status', '--json']);
    assert.equal(status.status, 0, status.stderr);
    const value = JSON.parse(status.stdout);
    assert.equal(value.packageVersion, '2.11.0');
    assert.equal(value.skillVersion, value.packageVersion);
    assert.equal(value.agents.every(agent => agent.state === 'not-detected'), true);
    assert.equal(fs.existsSync(path.join(f.home, '.pipker')), false);
    const install = f.run(['skill', 'install', '--json']);
    assert.equal(install.status, 1);
    assert.equal(JSON.parse(install.stdout).error.code, 'NO_AGENTS');
    assert.equal(install.stderr, '');
});

test('CLI installation, update and uninstall preserve agent config and another Skill', t => {
    const f = fixture(t);
    const config = path.join(f.home, '.codex');
    fs.mkdirSync(path.join(config, 'skills', 'slothvault-mcp'), {recursive: true});
    fs.writeFileSync(path.join(config, 'config.toml'), '# native config');
    for (const action of ['install', 'update', 'uninstall']) {
        const result = f.run(['skill', action, '--agent', 'codex', '--json']);
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const data = JSON.parse(result.stdout);
        assert.equal(data.ok, true);
        assert.equal(data.agents.length, 1);
        assert.equal(data.agents[0].state, action === 'uninstall' ? 'missing' : 'installed');
    }
    assert.equal(fs.readFileSync(path.join(config, 'config.toml'), 'utf8'), '# native config');
    assert.equal(fs.existsSync(path.join(config, 'skills', 'slothvault-mcp')), true);
    assert.equal(fs.existsSync(path.join(f.home, '.claude')), false);
});

for (const args of [
    ['remove'], ['status', '--agent'], ['status', '--agent', 'cursor'], ['install', '--force'],
    ['status', '--agent', 'codex', '--agent', 'claude-code'], ['status', 'extra'], ['status', '--json', '--json']
]) {
    test(`rejects invalid arguments: ${args.join(' ')}`, t => {
        const f = fixture(t);
        const result = f.run(['skill', ...args, ...(args.includes('--json') ? [] : ['--json'])]);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(JSON.parse(result.stdout).error.code, 'INVALID_ARGUMENTS');
    });
}

test('CLI conflicts return a failing exit code and preserve user content', t => {
    const f = fixture(t);
    const conflict = path.join(f.home, '.codex', 'skills', 'slothtool');
    fs.mkdirSync(conflict, {recursive: true});
    fs.writeFileSync(path.join(conflict, 'SKILL.md'), 'user skill');
    const result = f.run(['skill', 'install', '--json']);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).error.code, 'CONFLICT');
    assert.equal(fs.readFileSync(path.join(conflict, 'SKILL.md'), 'utf8'), 'user skill');
});
