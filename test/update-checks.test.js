/**
 * @file UpdateChecksTest
 * @project SlothTool
 * @module Test / Root Update Checks
 * @description 验证根管理器的更新检查结果结构，以及 latest/outdated/error 的边界行为。
 * @logic 1. 用 stub fetcher 覆盖本体与插件的最新版本查询；2. 校验官方插件和遗留 npm 插件的状态判断；3. 校验聚合检查在单项失败时仍返回完整列表。
 * @dependencies Service: ../lib/services/plugin-service.js, Node: assert/test
 * @index_tags 更新检查测试, self-update, plugin-update, latest, outdated, error
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    checkAllUpdates,
    checkPluginUpdate,
    checkSelfUpdate
} from '../lib/services/plugin-service.js';

test('self update check reports latest and outdated states', async () => {
    const latest = await checkSelfUpdate({
        currentVersion: '1.1.1',
        registryVersionFetcher: async () => '1.1.1'
    });
    const outdated = await checkSelfUpdate({
        currentVersion: '1.1.1',
        registryVersionFetcher: async () => '1.2.0'
    });

    assert.equal(latest.status, 'latest');
    assert.equal(outdated.status, 'outdated');
    assert.equal(outdated.latestVersion, '1.2.0');
});

test('official plugin update check reports latest and outdated states', async () => {
    const pluginInfo = {
        packageName: '@holic512/plugin-loc',
        version: '1.0.0',
        sourceType: 'github-release'
    };

    const latest = await checkPluginUpdate('loc', {
        pluginInfo,
        officialReleaseFetcher: async () => ({version: '1.0.0'})
    });
    const outdated = await checkPluginUpdate('loc', {
        pluginInfo,
        officialReleaseFetcher: async () => ({version: '1.1.0'})
    });

    assert.equal(latest.status, 'latest');
    assert.equal(outdated.status, 'outdated');
    assert.equal(outdated.latestVersion, '1.1.0');
});

test('legacy npm plugin update check reports latest and outdated states', async () => {
    const pluginInfo = {
        packageName: '@demo/legacy-plugin',
        version: '2.0.0',
        sourceType: 'npm-registry'
    };

    const latest = await checkPluginUpdate('legacy', {
        pluginInfo,
        registryVersionFetcher: async () => '2.0.0'
    });
    const outdated = await checkPluginUpdate('legacy', {
        pluginInfo,
        registryVersionFetcher: async () => '2.1.0'
    });

    assert.equal(latest.status, 'latest');
    assert.equal(outdated.status, 'outdated');
    assert.equal(outdated.latestVersion, '2.1.0');
});

test('checkAllUpdates keeps other results when one target fails', async () => {
    const summary = await checkAllUpdates({
        installedPlugins: [
            {alias: 'loc'},
            {alias: 'legacy'}
        ],
        selfChecker: async () => ({
            targetId: 'self',
            kind: 'self',
            title: 'SlothTool',
            currentVersion: '1.1.1',
            latestVersion: '1.2.0',
            status: 'outdated',
            sourceLabel: 'npm registry',
            reason: ''
        }),
        pluginChecker: async plugin => {
            if (plugin.alias === 'loc') {
                return {
                    targetId: 'loc',
                    kind: 'plugin',
                    title: 'loc',
                    currentVersion: '1.0.0',
                    latestVersion: '1.0.0',
                    status: 'latest',
                    sourceLabel: 'GitHub Release',
                    reason: ''
                };
            }

            return {
                targetId: plugin.alias,
                kind: 'plugin',
                title: plugin.alias,
                currentVersion: '0.9.0',
                latestVersion: '0.9.0',
                status: 'error',
                sourceLabel: 'npm registry',
                reason: 'fetch failed'
            };
        }
    });

    assert.equal(summary.items.length, 3);
    assert.equal(summary.outdatedCount, 1);
    assert.equal(summary.errorCount, 1);
    assert.equal(summary.plugins[1].status, 'error');
    assert.equal(summary.plugins[1].reason, 'fetch failed');
});
