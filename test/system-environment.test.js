/**
 * @file SystemEnvironmentTest
 * @project SlothTool
 * @module Test / System Environment
 * @description 验证插件管理器提供的系统环境探测能力，确保平台与架构会被标准化为安装流程可直接使用的标签。
 * @logic 1. 覆盖 darwin/win32/linux 到 macos/windows/linux 的映射；2. 覆盖 x64/arm64 到 amd64/arm64 的映射；3. 校验组合 target 与布尔标记。
 * @dependencies Node: assert/test, Service: ../lib/plugin-manager.js
 * @index_tags 系统环境测试, 平台映射, 架构映射, macos, windows, linux, amd64, arm64
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getSystemEnvironment,
    normalizeSystemArchitecture,
    normalizeSystemPlatform
} from '../lib/plugin-manager.js';

test('system environment normalizes macOS arm64', () => {
    const environment = getSystemEnvironment({
        platform: 'darwin',
        arch: 'arm64',
        release: '24.5.0'
    });

    assert.equal(environment.operatingSystem, 'macos');
    assert.equal(environment.cpuArchitecture, 'arm64');
    assert.equal(environment.target, 'macos-arm64');
    assert.equal(environment.isMacOS, true);
    assert.equal(environment.isArm64, true);
    assert.equal(environment.isAmd64, false);
});

test('system environment normalizes Windows amd64', () => {
    const environment = getSystemEnvironment({
        platform: 'win32',
        arch: 'x64',
        release: '10.0.26100'
    });

    assert.equal(environment.operatingSystem, 'windows');
    assert.equal(environment.cpuArchitecture, 'amd64');
    assert.equal(environment.target, 'windows-amd64');
    assert.equal(environment.isWindows, true);
    assert.equal(environment.isLinux, false);
    assert.equal(environment.isAmd64, true);
});

test('system environment normalizers preserve known linux labels', () => {
    assert.equal(normalizeSystemPlatform('linux'), 'linux');
    assert.equal(normalizeSystemArchitecture('arm64'), 'arm64');
    assert.equal(normalizeSystemArchitecture('ia32'), '386');
});
