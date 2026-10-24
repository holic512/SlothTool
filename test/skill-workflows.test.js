import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-skill-workflow-'));
    t.after(() => fs.rmSync(home, {recursive: true, force: true}));
    const project = path.join(home, 'sample');
    const data = path.join(home, '.pipker/slothtool');
    fs.mkdirSync(data, {recursive: true});
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify({language: 'en'}));
    fs.writeFileSync(path.join(data, 'registry.json'), JSON.stringify({plugins: Object.fromEntries(['loc', 'pzip'].map(alias => [alias, {
        name: `@holic512/plugin-${alias}`, packageName: `@holic512/plugin-${alias}`, version: 'workspace',
        binPath: path.join(root, 'plugins', alias, 'bin', `${alias}.js`), sourceType: 'github-release'
    }]))}));
    return {home, project, run(args) {
        const result = spawnSync(process.execPath, [path.join(root, 'bin/slothtool.js'), ...args], {
            cwd: home, encoding: 'utf8', timeout: 15000,
            env: {...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'),
                CLAUDE_CONFIG_DIR: path.join(home, '.claude'), SLOTHTOOL_TUI_TEST_ACTION: ''}
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        return result.stdout;
    }};
}

test('Skill loc command reports physical text lines including comments, blanks, empty files and trailing newline', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.project, 'source.js'), '// comment\n\nconst x = 1;\n');
    fs.writeFileSync(path.join(f.project, 'empty.js'), '');
    fs.mkdirSync(path.join(f.project, 'node_modules'));
    fs.writeFileSync(path.join(f.project, 'node_modules/dependency.js'), 'ignored\n');
    const output = f.run(['loc', f.project]);
    assert.match(output, /Total files:\s*2/u);
    assert.match(output, /Total lines:\s*5/u);
});

test('Skill pzip preview and execute preserve filters and respect nested .gitignore', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.project, 'source.js'), 'code');
    for (const name of ['dist', 'target', '.git', '__MACOSX']) {
        fs.mkdirSync(path.join(f.project, name));
        fs.writeFileSync(path.join(f.project, name, 'ignored.txt'), 'filtered');
    }
    fs.writeFileSync(path.join(f.project, '.DS_Store'), 'filtered');
    fs.mkdirSync(path.join(f.project, 'nested'));
    fs.writeFileSync(path.join(f.project, 'nested/.gitignore'), '*.tmp\n');
    fs.writeFileSync(path.join(f.project, 'nested/drop.tmp'), 'filtered');
    fs.writeFileSync(path.join(f.project, 'nested/keep.txt'), 'kept');
    const output = path.join(f.home, 'sample.zip');
    const args = ['pzip', f.project, '--output', output, '--json'];
    const preview = JSON.parse(f.run([...args, '--dry-run']));
    assert.equal(fs.existsSync(output), false);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.exclusions.builtIn, 5);
    assert.ok(preview.exclusions.gitignore >= 1);
    const result = JSON.parse(f.run(args));
    assert.equal(result.dryRun, false);
    assert.equal(result.archivePath, output);
    assert.ok(fs.statSync(output).size > 0);
    assert.deepEqual(result.exclusions, preview.exclusions);
    assert.equal(fs.existsSync(path.join(f.home, '.pipker/slothtool/plugin-configs/pzip.json')), false);
});
