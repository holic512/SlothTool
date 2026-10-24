import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));

test('real npm archive includes Skill references and standalone root service resolves its unpacked source', {timeout: 90000}, t => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-skill-pack-'));
    t.after(() => fs.rmSync(temporary, {recursive: true, force: true}));
    const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
        'pack', '--ignore-scripts', '--json', '--pack-destination', temporary, '--cache', path.join(temporary, 'cache')
    ], {cwd: root, encoding: 'utf8', timeout: 60000, env: {...process.env, npm_config_update_notifier: 'false'}});
    const [packed] = JSON.parse(output);
    const files = new Set(packed.files.map(file => file.path));
    for (const required of ['skills/slothtool/SKILL.md', 'skills/slothtool/agents/openai.yaml',
        'lib/services/skill-service.js', 'lib/commands/skill.js', 'bin/slothtool.js']) assert.ok(files.has(required), required);
    const referenceNames = fs.readdirSync(path.join(root, 'skills/slothtool/references'));
    assert.ok(referenceNames.length >= 6);
    for (const name of referenceNames) assert.ok(files.has(`skills/slothtool/references/${name}`), name);
    assert.equal(packed.version, '2.11.0');
    execFileSync('tar', ['-xzf', path.join(temporary, packed.filename), '-C', temporary]);
    const unpacked = path.join(temporary, 'package');
    const packageJson = JSON.parse(fs.readFileSync(path.join(unpacked, 'package.json'), 'utf8'));
    assert.equal(packageJson.scripts.postinstall, undefined);
    const home = path.join(temporary, 'home');
    fs.mkdirSync(path.join(home, '.codex'), {recursive: true});
    const serviceUrl = pathToFileURL(path.join(unpacked, 'lib/services/skill-service.js')).href;
    const script = `import {manageSkill} from ${JSON.stringify(serviceUrl)};
        console.log(JSON.stringify(manageSkill('install', {agent: 'codex'})));`;
    const installed = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: temporary, encoding: 'utf8', env: {...process.env, HOME: home, USERPROFILE: home, PATH: '',
            CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude')}
    }));
    assert.equal(installed.ok, true, JSON.stringify(installed));
    assert.equal(fs.realpathSync(installed.sourcePath), fs.realpathSync(path.join(unpacked, 'skills/slothtool')));
    assert.equal(fs.realpathSync(path.join(home, '.codex/skills/slothtool')), fs.realpathSync(installed.sourcePath));
    assert.equal(fs.existsSync(path.join(home, '.claude')), false);
    // Normal in-place package updates must be visible through the installed link without another install.
    const skillPath = path.join(unpacked, 'skills/slothtool/SKILL.md');
    fs.appendFileSync(skillPath, '\npackage upgrade marker\n');
    assert.match(fs.readFileSync(path.join(home, '.codex/skills/slothtool/SKILL.md'), 'utf8'), /package upgrade marker/u);
});
