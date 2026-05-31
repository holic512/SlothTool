/**
 * @file OfficialPluginSelectionTest
 * @project SlothTool
 * @module Test / Official Plugin Selection
 * @description 验证官方插件目录与安装流程会根据当前平台架构选择正确的 image-compress 发布资产。
 * @logic 1. 校验 image-compress 已加入官方插件目录；2. 覆盖 macOS/Windows/Linux 目标的资产匹配；3. 校验安装入口会把当前 target 传递给 release 选择器。
 * @dependencies Node: assert/fs/os/path/test, Service: ../lib/services/plugin-service.js
 * @index_tags 官方插件测试, 平台资产选择, image-compress, 安装流程, macos, windows, linux
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    getOfficialPlugin,
    getOfficialPluginAliases,
    installPlugin,
    resolveExtractedPackageRoot,
    selectReleaseAssetForEnvironment
} from '../lib/services/plugin-service.js';

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-official-plugin-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDir;
}

async function withTempHome(run) {
    const originalHome = process.env.HOME;
    process.env.HOME = createTempHome();

    try {
        return await run();
    } finally {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
    }
}

test('official plugin catalog includes image-compress', () => {
    assert.ok(getOfficialPluginAliases().includes('image-compress'));
    assert.equal(getOfficialPlugin('image-compress').packageName, '@holic512/plugin-image-compress');
});

test('platform-target asset selection chooses the matching release bundle', () => {
    const pluginMeta = getOfficialPlugin('image-compress');
    const release = {
        tag_name: 'plugin-image-compress-v0.1.0',
        assets: [
            {name: 'holic512-plugin-image-compress-0.1.0-macos-arm64.tgz'},
            {name: 'holic512-plugin-image-compress-0.1.0-linux-amd64.tgz'},
            {name: 'holic512-plugin-image-compress-0.1.0-windows-amd64.tgz'}
        ]
    };

    const macosAsset = selectReleaseAssetForEnvironment(pluginMeta, release, {
        target: 'macos-arm64'
    });
    const windowsAsset = selectReleaseAssetForEnvironment(pluginMeta, release, {
        target: 'windows-amd64'
    });

    assert.equal(macosAsset.asset.name, 'holic512-plugin-image-compress-0.1.0-macos-arm64.tgz');
    assert.equal(windowsAsset.asset.name, 'holic512-plugin-image-compress-0.1.0-windows-amd64.tgz');
});

test('platform-target asset selection reports unsupported targets clearly', () => {
    const pluginMeta = getOfficialPlugin('image-compress');
    const release = {
        tag_name: 'plugin-image-compress-v0.1.0',
        assets: [
            {name: 'holic512-plugin-image-compress-0.1.0-linux-amd64.tgz'}
        ]
    };

    assert.throws(() => {
        selectReleaseAssetForEnvironment(pluginMeta, release, {
            target: 'windows-amd64'
        });
    }, /windows-amd64/u);
});

test('installPlugin forwards the current system target to the official release fetcher', async () => {
    await withTempHome(async () => {
        let capturedTarget = '';
        let installedAssetName = '';

        const result = await installPlugin('image-compress', {
            systemEnvironment: {target: 'windows-amd64'},
            officialReleaseFetcher: async (pluginMeta, {systemEnvironment}) => {
                capturedTarget = systemEnvironment.target;
                return {
                    asset: {name: 'holic512-plugin-image-compress-0.1.0-windows-amd64.tgz'},
                    release: {tag_name: 'plugin-image-compress-v0.1.0'},
                    version: '0.1.0',
                    target: systemEnvironment.target
                };
            },
            officialReleaseInstaller: async (alias, pluginMeta, releaseInfo) => {
                installedAssetName = releaseInfo.asset.name;
                return {
                    name: pluginMeta.packageName,
                    version: releaseInfo.version,
                    assetName: releaseInfo.asset.name,
                    installTarget: releaseInfo.target
                };
            }
        });

        assert.equal(capturedTarget, 'windows-amd64');
        assert.equal(installedAssetName, 'holic512-plugin-image-compress-0.1.0-windows-amd64.tgz');
        assert.equal(result.status, 'installed');
    });
});

test('release asset package root resolver accepts npm pack and direct archive layouts', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-release-layout-'));

    const npmPackExtractDir = path.join(tempDir, 'npm-pack');
    fs.mkdirSync(path.join(npmPackExtractDir, 'package'), {recursive: true});
    fs.writeFileSync(path.join(npmPackExtractDir, 'package', 'package.json'), '{}', 'utf8');
    assert.equal(
        resolveExtractedPackageRoot(npmPackExtractDir, 'npm-pack.tgz'),
        path.join(npmPackExtractDir, 'package')
    );

    const directExtractDir = path.join(tempDir, 'direct');
    fs.mkdirSync(directExtractDir, {recursive: true});
    fs.writeFileSync(path.join(directExtractDir, 'package.json'), '{}', 'utf8');
    assert.equal(resolveExtractedPackageRoot(directExtractDir, 'direct.tgz'), directExtractDir);

    const singleFolderExtractDir = path.join(tempDir, 'single-folder');
    fs.mkdirSync(path.join(singleFolderExtractDir, 'image-compress'), {recursive: true});
    fs.writeFileSync(path.join(singleFolderExtractDir, 'image-compress', 'package.json'), '{}', 'utf8');
    assert.equal(
        resolveExtractedPackageRoot(singleFolderExtractDir, 'single-folder.tgz'),
        path.join(singleFolderExtractDir, 'image-compress')
    );
});

test('release asset package root resolver reports missing package.json clearly', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-release-layout-missing-'));
    assert.throws(() => {
        resolveExtractedPackageRoot(tempDir, 'broken-asset.tgz');
    }, /package\.json not found in release asset: broken-asset\.tgz/u);
});
