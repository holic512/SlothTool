import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {checkBundledSkill} from '../scripts/check-bundled-skill.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = path.join(repositoryRoot, 'scripts', 'check-bundled-skill.js');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-bundled-skill-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: '@holic512/slothtool', version: '2.12.0', type: 'module'
    }));
    const skill = path.join(root, 'skills', 'slothtool');
    fs.mkdirSync(path.dirname(skill), {recursive: true});
    fs.cpSync(path.join(repositoryRoot, 'skills', 'slothtool'), skill, {recursive: true});
    const home = path.join(root, 'isolated-home');
    fs.mkdirSync(home);
    return {
        root, skill, home,
        edit(relative, transform) {
            const file = path.join(skill, relative);
            fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
        },
        run(args = ['--root', root], script = checkerPath) {
            return spawnSync(process.execPath, [script, ...args], {
                cwd: home,
                env: {...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'), CLAUDE_CONFIG_DIR: path.join(home, '.claude')},
                encoding: 'utf8', timeout: 10_000
            });
        }
    };
}

function assertInvalid(root, pattern) {
    const result = checkBundledSkill(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), pattern);
    return result;
}

test('the real bundled content validates against the planned 2.12.0 package without dependencies', t => {
    const {root, home, run} = fixture(t);
    assert.deepEqual(checkBundledSkill(root), {ok: true, version: '2.12.0', errors: []});
    const cli = run();
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /slothtool 2\.12\.0: OK/u);
    assert.deepEqual(fs.readdirSync(home), [], 'validation must not install Skills or create user data');
    assert.equal(fs.existsSync(path.join(root, 'node_modules')), false);
});

test('CLI resolves its default repository from its own location, not cwd', t => {
    const {root, run} = fixture(t);
    fs.mkdirSync(path.join(root, 'scripts'));
    const copiedChecker = path.join(root, 'scripts', 'check-bundled-skill.js');
    fs.copyFileSync(checkerPath, copiedChecker);
    const cli = run([], copiedChecker);
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /2\.12\.0: OK/u);
});

test('version mismatch blocks validation and returns a failing CLI exit code', t => {
    const {root, run} = fixture(t);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: '@holic512/slothtool', version: '2.10.0'}));
    assertInvalid(root, /Skill version 2\.12\.0 does not match root package version 2\.10\.0/u);
    const cli = run();
    assert.equal(cli.status, 1);
    assert.equal(cli.stdout, '');
    assert.match(cli.stderr, /does not match/u);
});

test('version validation compares metadata, not a hard-coded release', t => {
    const {root, edit} = fixture(t);
    edit('SKILL.md', text => text.replace('version: "2.12.0"', 'version: "2.13.0"'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({name: '@holic512/slothtool', version: '2.13.0'}));
    assert.equal(checkBundledSkill(root).ok, true);
});

for (const relative of ['SKILL.md', 'agents/openai.yaml', ...['root-management', 'loc', 'image-compress', 'gstore', 'pzip', 'slothvault'].map(name => `references/${name}.md`)]) {
    test(`requires bundled file ${relative}`, t => {
        const {root, skill} = fixture(t);
        fs.unlinkSync(path.join(skill, relative));
        assertInvalid(root, new RegExp(relative.replaceAll('.', '\\.')));
    });
}

for (const [label, relative, transform, diagnostic] of [
    ['name', 'SKILL.md', text => text.replace('name: slothtool', 'name: other'), /name must be slothtool/u],
    ['description', 'SKILL.md', text => text.replace(/^description:.*$/mu, 'description: ""'), /short Chinese description/u],
    ['metadata version', 'SKILL.md', text => text.replace('  version: "2.12.0"', '  other: "2.12.0"'), /metadata.version/u],
    ['frontmatter', 'SKILL.md', text => text.replace(/^---/u, 'invalid'), /frontmatter/u],
    ['duplicate key', 'SKILL.md', text => text.replace('name: slothtool', 'name: slothtool\nname: another'), /duplicate key/u],
    ['malformed YAML', 'agents/openai.yaml', text => text.replace('  display_name:', '   display_name:'), /unsupported YAML/u],
    ['display name', 'agents/openai.yaml', text => text.replace(/  display_name:.*\n/u, ''), /display_name is required/u],
    ['short UI blurb', 'agents/openai.yaml', text => text.replace(/  short_description:.*/u, '  short_description: "短"'), /25–64/u],
    ['default prompt', 'agents/openai.yaml', text => text.replace('$slothtool', '$other'), /must mention \$slothtool/u],
    ['explicit-only invocation', 'agents/openai.yaml', text => text.replace('allow_implicit_invocation: true', 'allow_implicit_invocation: false'), /must allow implicit invocation/u],
    ['quoted boolean', 'agents/openai.yaml', text => text.replace('allow_implicit_invocation: true', 'allow_implicit_invocation: "true"'), /must allow implicit invocation/u],
    ['invalid policy mapping', 'agents/openai.yaml', text => text.replace(/policy:[\s\S]*/u, 'policy: false\n'), /must allow implicit invocation/u],
    ['empty reference', 'references/loc.md', () => '\n', /empty file/u]
]) {
    test(`rejects invalid ${label}`, t => {
        const {root, edit} = fixture(t);
        edit(relative, transform);
        assertInvalid(root, diagnostic);
    });
}

test('omitted invocation policy retains the default implicit discovery', t => {
    const {root, edit} = fixture(t);
    edit('agents/openai.yaml', text => text.replace(/policy:[\s\S]*/u, ''));
    assert.equal(checkBundledSkill(root).ok, true);
});

test('required references must be discoverable from the entrypoint', t => {
    const {root, edit} = fixture(t);
    edit('SKILL.md', text => text.replace('[loc](references/loc.md)', 'loc'));
    assertInvalid(root, /must link to references\/loc.md/u);
});

test('checks nested local references, fragments and cycles', t => {
    const {root, skill, edit} = fixture(t);
    edit('references/loc.md', text => `${text}\n[Details](extra.md#details)\n`);
    fs.writeFileSync(path.join(skill, 'references/extra.md'), '# Details\n[Back](loc.md)\n[Missing](missing.md)\n');
    assertInvalid(root, /extra.md: broken reference missing.md/u);
    fs.writeFileSync(path.join(skill, 'references/missing.md'), '# Present\n');
    assert.equal(checkBundledSkill(root).ok, true);
});

test('rejects references escaping the bundle even when the target exists', t => {
    const {root, edit} = fixture(t);
    edit('references/loc.md', text => `${text}\n[Outside](../../../package.json)\n`);
    assertInvalid(root, /path escapes Skill bundle/u);
});

test('rejects symlink references outside the bundle', t => {
    const {root, skill, edit} = fixture(t);
    fs.symlinkSync(path.join(root, 'package.json'), path.join(skill, 'references/outside.json'));
    edit('references/loc.md', text => `${text}\n[Outside](outside.json)\n`);
    assertInvalid(root, /path escapes Skill bundle/u);
});

test('rejects directories where a required file should be', t => {
    const {root, skill} = fixture(t);
    const target = path.join(skill, 'references/loc.md');
    fs.unlinkSync(target);
    fs.mkdirSync(target);
    assertInvalid(root, /not a file/u);
});

test('invalid root package and missing bundle return useful diagnostics', t => {
    const {root} = fixture(t);
    fs.writeFileSync(path.join(root, 'package.json'), '{');
    assertInvalid(root, /package.json/u);
    assertInvalid(path.join(root, 'missing'), /skills\/slothtool/u);
});

test('CLI rejects unknown or incomplete options rather than silently checking another root', t => {
    const {run} = fixture(t);
    for (const args of [['--root'], ['--unknown'], ['--root', '.', 'extra']]) {
        const cli = run(args);
        assert.equal(cli.status, 2);
        assert.match(cli.stderr, /Usage:/u);
    }
});
