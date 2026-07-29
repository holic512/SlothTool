/**
 * @file OfflinePluginInstallTest
 * @project SlothTool
 * @module Test / Offline Plugin Install
 * @description 验证官方插件离线 tgz 安装、自包含归档生成、包名与归档安全校验，以及 registry 来源记录。
 * @logic 1. 构造 package/ 根布局归档；2. 在临时 HOME 安装并运行 bin；3. 再次打包并校验归档内容；4. 验证离线安装与打包都限制为官方 alias；5. 构造路径穿越和符号链接归档并确认在解包前拒绝。
 * @dependencies Node: assert/child_process/fs/os/path/test; Service: ../lib/services/plugin-service.js
 * @index_tags offline install, plugin bundle, tgz, registry, official plugin, tests
 * @author holic512
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {gzipSync} from 'node:zlib';

import registry from '../lib/registry.js';
import {createOfflinePluginBundle, installPluginFromArchive} from '../lib/services/plugin-service.js';

function createHome() {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-offline-home-'));
    fs.mkdirSync(path.join(home, '.slothtool'), {recursive: true});
    fs.writeFileSync(path.join(home, '.slothtool', 'settings.json'), JSON.stringify({language: 'en'}, null, 2));
    return home;
}

function createArchive(packageName = '@holic512/plugin-codex-models', dependencies = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-offline-archive-'));
    const packageDir = path.join(root, 'package');
    const binDir = path.join(packageDir, 'bin');
    fs.mkdirSync(binDir, {recursive: true});
    fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({
        name: packageName,
        version: '0.1.0-test',
        type: 'module',
        bin: {'codex-models': 'bin/codex-models.js'},
        dependencies
    }, null, 2));
    const binPath = path.join(binDir, 'codex-models.js');
    fs.writeFileSync(binPath, '#!/usr/bin/env node\nconsole.log("OFFLINE_PLUGIN_OK");\n');
    fs.chmodSync(binPath, 0o755);
    const archivePath = path.join(root, 'codex-models-offline.tgz');
    execFileSync('tar', ['-czf', archivePath, '-C', root, 'package']);
    return archivePath;
}

function writeTarOctal(buffer, offset, length, value) {
    const text = `${value.toString(8).padStart(length - 1, '0')}\0`;
    buffer.write(text, offset, length, 'ascii');
}

function createTarHeader(name, {content = Buffer.alloc(0), type = '0', linkName = ''} = {}) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    writeTarOctal(header, 100, 8, type === '5' ? 0o755 : 0o644);
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, type === '0' ? content.length : 0);
    writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
    header.fill(0x20, 148, 156);
    header.write(type, 156, 1, 'ascii');
    header.write(linkName, 157, 100, 'utf8');
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0'), 148, 6, 'ascii');
    header[154] = 0;
    header[155] = 0x20;
    return header;
}

function createCraftedArchive(entries) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-crafted-archive-'));
    const archivePath = path.join(root, 'crafted.tgz');
    const chunks = [];
    for (const entry of entries) {
        const content = Buffer.from(entry.content || '');
        chunks.push(createTarHeader(entry.name, {...entry, content}));
        if ((entry.type || '0') === '0') {
            chunks.push(content);
            const padding = (512 - (content.length % 512)) % 512;
            if (padding) {
                chunks.push(Buffer.alloc(padding));
            }
        }
    }
    chunks.push(Buffer.alloc(1024));
    fs.writeFileSync(archivePath, gzipSync(Buffer.concat(chunks)));
    return archivePath;
}

async function withHome(run) {
    const previousHome = process.env.HOME;
    const home = createHome();
    process.env.HOME = home;
    try {
        return await run(home);
    } finally {
        if (previousHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = previousHome;
        }
    }
}

test('offline archive installs an official plugin and records its source', async () => {
    await withHome(async home => {
        const archivePath = createArchive();
        const result = await installPluginFromArchive('codex-models', archivePath);
        assert.equal(result.status, 'installed');
        assert.equal(result.sourceType, 'offline-archive');

        const installed = registry.getPlugin('codex-models');
        assert.equal(installed.packageName, '@holic512/plugin-codex-models');
        assert.equal(installed.sourceType, 'offline-archive');
        assert.equal(installed.assetName, path.basename(archivePath));
        assert.equal(fs.statSync(installed.binPath).mode & 0o100, 0o100);
        assert.equal(execFileSync(process.execPath, [installed.binPath], {encoding: 'utf8'}).trim(), 'OFFLINE_PLUGIN_OK');
        assert.ok(installed.binPath.startsWith(path.join(home, '.slothtool', 'plugins', 'codex-models')));
    });
});

test('offline bundle contains a package root and can be reinstalled', async () => {
    await withHome(async home => {
        const initialArchive = createArchive();
        await installPluginFromArchive('codex-models', initialArchive);
        const outputPath = path.join(home, 'bundles', 'codex-models-self-contained.tgz');
        const bundle = await createOfflinePluginBundle('codex-models', outputPath);
        assert.equal(bundle.outputPath, outputPath);
        assert.ok(fs.existsSync(outputPath));
        const listing = execFileSync('tar', ['-tzf', outputPath], {encoding: 'utf8'});
        assert.match(listing, /^package\//mu);
        assert.match(listing, /package\/package\.json/u);
        assert.match(listing, /package\/bin\/codex-models\.js/u);
    });
});

test('offline installation remains restricted to official aliases', async () => {
    await withHome(async () => {
        await assert.rejects(
            installPluginFromArchive('not-official', createArchive()),
            /not an official plugin alias/u
        );
    });
});

test('offline bundle remains restricted to official aliases', async () => {
    await withHome(async () => {
        await assert.rejects(
            createOfflinePluginBundle('not-official'),
            /not an official plugin alias/u
        );
    });
});

test('offline archive package name must match the selected official alias', async () => {
    await withHome(async () => {
        await assert.rejects(
            installPluginFromArchive('codex-models', createArchive('@malicious/wrong-plugin')),
            /Archive package mismatch/u
        );
        assert.equal(registry.getPlugin('codex-models'), null);
    });
});

test('offline archive rejects path traversal members before extraction', async () => {
    await withHome(async () => {
        const archivePath = createCraftedArchive([
            {name: '../escaped.txt', content: 'must not escape'}
        ]);
        await assert.rejects(
            installPluginFromArchive('codex-models', archivePath),
            /unsafe path/u
        );
        assert.equal(registry.getPlugin('codex-models'), null);
    });
});

test('offline archive rejects symbolic links before extraction', async () => {
    await withHome(async () => {
        const archivePath = createCraftedArchive([
            {name: 'package/', type: '5'},
            {name: 'package/external-link', type: '2', linkName: '/tmp'}
        ]);
        await assert.rejects(
            installPluginFromArchive('codex-models', archivePath),
            /unsupported entry type/u
        );
        assert.equal(registry.getPlugin('codex-models'), null);
    });
});
