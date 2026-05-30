/**
 * @file SettingsConfigTest
 * @project SlothTool
 * @module Test / Settings And Config
 * @description 验证设置模型升级、CLI proxy 配置命令与异常输入校验。
 * @logic 1. 校验旧版 settings 结构可升级为新网络配置；2. 通过根 CLI 写入代理与 GitHub 源设置；3. 覆盖非法端口、预设与 URL 的失败路径。
 * @dependencies Node: assert/child_process/fs/os/path/test/url, Settings: ../lib/settings.js
 * @index_tags 设置测试, config命令, proxy配置, github镜像, settings.json
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import settings from '../lib/settings.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const rootBin = path.join(rootDir, 'bin', 'slothtool.js');

function createTempHome(initialSettings = {language: 'zh'}) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-config-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify(initialSettings, null, 2));
    fs.writeFileSync(path.join(slothDir, 'registry.json'), JSON.stringify({plugins: {}}, null, 2));
    return homeDir;
}

function runCli(args, homeDir) {
    return execFileSync(process.execPath, [rootBin, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            HOME: homeDir
        }
    });
}

function runCliFailure(args, homeDir) {
    try {
        runCli(args, homeDir);
        assert.fail(`Expected command to fail: ${args.join(' ')}`);
    } catch (error) {
        return {
            status: error.status,
            stdout: String(error.stdout || ''),
            stderr: String(error.stderr || '')
        };
    }
}

test('settings normalization upgrades legacy settings shape', () => {
    const normalized = settings.normalizeSettings({language: 'zh'});

    assert.equal(normalized.language, 'zh');
    assert.equal(normalized.network.proxy.enabled, false);
    assert.equal(normalized.network.proxy.host, '127.0.0.1');
    assert.equal(normalized.network.proxy.port, 7980);
    assert.equal(normalized.network.github.preset, 'gh-proxy');
    assert.equal(normalized.network.github.customBaseUrl, '');
});

test('config proxy commands update persisted network settings', () => {
    const homeDir = createTempHome({language: 'zh'});
    const initialOutput = runCli(['config', 'proxy', 'show'], homeDir);

    assert.match(initialOutput, /当前语言：zh/u);
    assert.match(initialOutput, /代理：关闭 \(http:\/\/127\.0\.0\.1:7980\)/u);
    assert.match(initialOutput, /GitHub 源：gh-proxy\.com/u);

    runCli(['config', 'proxy', 'enabled', 'on'], homeDir);
    runCli(['config', 'proxy', 'host', '10.0.0.2'], homeDir);
    runCli(['config', 'proxy', 'port', '7890'], homeDir);
    runCli(['config', 'proxy', 'github', 'official'], homeDir);
    runCli(['config', 'proxy', 'github-url', 'https://proxy.example.com'], homeDir);

    const savedSettings = JSON.parse(
        fs.readFileSync(path.join(homeDir, '.slothtool', 'settings.json'), 'utf8')
    );

    assert.equal(savedSettings.network.proxy.enabled, true);
    assert.equal(savedSettings.network.proxy.host, '10.0.0.2');
    assert.equal(savedSettings.network.proxy.port, 7890);
    assert.equal(savedSettings.network.github.preset, 'custom');
    assert.equal(savedSettings.network.github.customBaseUrl, 'https://proxy.example.com');
});

test('config proxy commands reject invalid values', () => {
    const homeDir = createTempHome({language: 'zh'});

    const invalidPort = runCliFailure(['config', 'proxy', 'port', '70000'], homeDir);
    assert.equal(invalidPort.status, 1);
    assert.match(invalidPort.stderr, /无效端口/u);

    const invalidPreset = runCliFailure(['config', 'proxy', 'github', 'mirror'], homeDir);
    assert.equal(invalidPreset.status, 1);
    assert.match(invalidPreset.stderr, /无效 GitHub 源/u);

    const invalidUrl = runCliFailure(['config', 'proxy', 'github-url', 'ftp://proxy.example.com'], homeDir);
    assert.equal(invalidUrl.status, 1);
    assert.match(invalidUrl.stderr, /无效 GitHub 自定义代理地址/u);
});
