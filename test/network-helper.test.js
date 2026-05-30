/**
 * @file NetworkHelperTest
 * @project SlothTool
 * @module Test / Network Helper
 * @description 验证代理环境变量生成、HTTPS 代理 agent 创建与 GitHub URL 改写规则。
 * @logic 1. 覆盖 GitHub 相关域名识别；2. 校验 official 与 gh-proxy 模式下的 URL 行为；3. 断言启用代理后生成可复用 env 与 agent。
 * @dependencies Node: assert/https/test, Network: ../lib/services/network-helper.js
 * @index_tags 网络测试, proxyEnv, github镜像, network-helper
 * @author holic512
 */

import assert from 'node:assert/strict';
import https from 'node:https';
import test from 'node:test';
import {
    buildProxyAgent,
    buildProxyEnv,
    isGithubRelatedUrl,
    rewriteGithubUrl
} from '../lib/services/network-helper.js';

function buildSettings(overrides = {}) {
    return {
        language: 'zh',
        network: {
            proxy: {
                enabled: false,
                protocol: 'http',
                host: '127.0.0.1',
                port: 7980,
                noProxy: 'localhost,127.0.0.1,::1',
                ...overrides.network?.proxy
            },
            github: {
                preset: 'gh-proxy',
                customBaseUrl: '',
                ...overrides.network?.github
            }
        }
    };
}

test('network helper identifies GitHub-related URLs', () => {
    assert.equal(isGithubRelatedUrl('https://api.github.com/repos/holic512/SlothTool'), true);
    assert.equal(isGithubRelatedUrl('https://github.com/holic512/SlothTool/releases'), true);
    assert.equal(isGithubRelatedUrl('https://example.com/archive.tgz'), false);
});

test('rewriteGithubUrl keeps official mode unchanged', () => {
    const settings = buildSettings({
        network: {
            github: {
                preset: 'official'
            }
        }
    });
    const originalUrl = 'https://api.github.com/repos/holic512/SlothTool/releases';

    assert.equal(rewriteGithubUrl(originalUrl, settings), originalUrl);
});

test('rewriteGithubUrl prefixes gh-proxy for GitHub hosts', () => {
    const settings = buildSettings();
    const originalUrl = 'https://github.com/holic512/SlothTool/releases/download/plugin-loc-v1.0.0/file.tgz';

    assert.equal(
        rewriteGithubUrl(originalUrl, settings),
        `https://gh-proxy.com/${originalUrl}`
    );
});

test('buildProxyEnv and buildProxyAgent reflect enabled proxy settings', () => {
    const settings = buildSettings({
        network: {
            proxy: {
                enabled: true,
                host: '10.0.0.2',
                port: 7890
            }
        }
    });
    const proxyEnv = buildProxyEnv(settings);
    const agent = buildProxyAgent(settings);

    assert.equal(proxyEnv.HTTP_PROXY, 'http://10.0.0.2:7890');
    assert.equal(proxyEnv.HTTPS_PROXY, 'http://10.0.0.2:7890');
    assert.equal(proxyEnv.NODE_USE_ENV_PROXY, '1');
    assert.ok(agent instanceof https.Agent);
});
