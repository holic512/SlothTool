import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('root and every official plugin pack their own interaction runtime', () => {
    const npmCache = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-pack-cache-'));
    const archives = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-packed-tui-'));
    try {
    const targets = [
        ['.', 'bin/slothtool.js', 'SLOTHTOOL_TUI_TEST_ACTION'],
        ['plugins/loc', 'bin/loc.js', 'SLOTHTOOL_LOC_TUI_TEST_ACTION'],
        ['plugins/image-compress', 'bin/image-compress.js', 'SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION'],
        ['plugins/gstore', 'bin/gstore.js', 'SLOTHTOOL_GSTORE_TUI_TEST_ACTION'],
        ['plugins/pzip', 'bin/pzip.js', 'SLOTHTOOL_PZIP_TUI_TEST_ACTION'],
        ['plugins/slothvault', 'bin/slothvault.js', 'SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION']
    ];
    for (const [folder, entry, smokeVariable] of targets) {
        const packageDirectory = path.join(root, folder);
        const result = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', archives], {
            cwd: packageDirectory,
            encoding: 'utf8',
            env: {...process.env, npm_config_offline: 'true', npm_config_cache: npmCache}
        });
        assert.equal(result.status, 0, `${folder}: ${result.stderr}`);
        const [manifest] = JSON.parse(result.stdout);
        const names = new Set(manifest.files.map(file => file.path));
        for (const filename of ['shared-interaction.js', 'shared-layout.js']) {
            assert.ok(names.has(folder === '.' ? `lib/tui/${filename}` : `lib/${filename}`), folder);
        }
        const declared = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
        assert.equal(manifest.version, declared.version, folder);
        for (const bin of Object.values(declared.bin || {})) assert.ok(names.has(bin), `${folder}: ${bin}`);
        const isolated = fs.mkdtempSync(path.join(archives, 'unpacked-'));
        const unpack = spawnSync('tar', ['-xzf', path.join(archives, manifest.filename), '-C', isolated], {encoding: 'utf8'});
        assert.equal(unpack.status, 0, `${folder}: ${unpack.stderr}`);
        const packagedRoot = path.join(isolated, 'package');
        fs.symlinkSync(path.join(root, 'node_modules'), path.join(packagedRoot, 'node_modules'), 'dir');
        const smoke = spawnSync(process.execPath, [entry], {
            cwd: packagedRoot,
            encoding: 'utf8',
            env: {...process.env, [smokeVariable]: 'exit'}
        });
        assert.equal(smoke.status, 0, `${folder}: ${smoke.stderr}`);
        if (folder === 'plugins/slothvault') {
            assert.equal(names.has('skills/slothvault-mcp/SKILL.md'), false);
            assert.equal(names.has('deploy/install.py'), false);
        }
    }
    } finally {
        fs.rmSync(npmCache, {recursive: true, force: true});
        fs.rmSync(archives, {recursive: true, force: true});
    }
});
