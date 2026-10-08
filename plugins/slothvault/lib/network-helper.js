/**
 * @file SlothToolNetworkHelper
 * @project SlothTool
 * @module Core CLI / Services
 * @description 统一封装代理环境变量、HTTPS 代理 agent 与 GitHub 链接改写逻辑。
 * @logic 1. 根据 settings.network 生成 npm/Node 可复用的代理环境变量；2. 为 HTTPS 请求按需创建代理 agent；3. 对 GitHub 相关 URL 应用镜像前缀改写。
 * @dependencies Node: https
 * @index_tags 代理配置, GitHub镜像, proxyEnv, https.Agent, 网络辅助
 * @author holic512
 */

import https from 'node:https';

const GITHUB_HOSTS = [
    'github.com',
    'raw.githubusercontent.com',
    'gist.github.com',
    'gist.githubusercontent.com',
    'api.github.com'
];

function getGithubProxyBaseUrl(settings) {
    const githubSettings = settings?.network?.github;

    if (githubSettings?.preset === 'gh-proxy') {
        return 'https://gh-proxy.com';
    }

    if (githubSettings?.preset === 'custom' && githubSettings.customBaseUrl) {
        return githubSettings.customBaseUrl.replace(/\/$/u, '');
    }

    return '';
}

export function isGithubRelatedUrl(url) {
    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        return false;
    }

    return GITHUB_HOSTS.some(hostname =>
        parsedUrl.hostname === hostname || parsedUrl.hostname.endsWith(`.${hostname}`)
    );
}

export function rewriteGithubUrl(url, settings) {
    if (!isGithubRelatedUrl(url)) {
        return url;
    }

    const baseUrl = getGithubProxyBaseUrl(settings);
    if (!baseUrl) {
        return url;
    }

    if (url.startsWith(`${baseUrl}/`)) {
        return url;
    }

    return `${baseUrl}/${url}`;
}

export function buildProxyEnv(settings) {
    const proxySettings = settings?.network?.proxy;

    if (!proxySettings?.enabled) {
        return {};
    }

    const proxyUrl = `${proxySettings.protocol}://${proxySettings.host}:${proxySettings.port}`;
    const noProxy = proxySettings.noProxy || '';

    return {
        HTTP_PROXY: proxyUrl,
        HTTPS_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        https_proxy: proxyUrl,
        NO_PROXY: noProxy,
        no_proxy: noProxy,
        NODE_USE_ENV_PROXY: '1'
    };
}

export function buildProxyAgent(settings) {
    const proxyEnv = buildProxyEnv(settings);

    if (!proxyEnv.HTTP_PROXY) {
        return undefined;
    }

    return new https.Agent({proxyEnv});
}

export default {
    buildProxyAgent,
    buildProxyEnv,
    isGithubRelatedUrl,
    rewriteGithubUrl
};
