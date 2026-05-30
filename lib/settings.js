/**
 * @file SlothToolSettingsStore
 * @project SlothTool
 * @module Core CLI / Storage
 * @description 负责读取和写入 SlothTool 的全局设置，统一管理语言、代理与 GitHub 源配置。
 * @logic 1. 提供可升级的默认设置；2. 读取 settings.json 后执行显式 normalize；3. 对外暴露语言与网络配置的读写接口。
 * @dependencies Node: fs, Utils: ./utils.js
 * @index_tags 设置存储, language, proxy, github镜像, settings.json
 * @author holic512
 */

import fs from 'node:fs';
import {ensureDir, getSettingsPath, getSlothToolHome} from './utils.js';

export function getDefaultSettings() {
    return {
        language: 'zh',
        network: {
            proxy: {
                enabled: false,
                protocol: 'http',
                host: '127.0.0.1',
                port: 7980,
                noProxy: 'localhost,127.0.0.1,::1'
            },
            github: {
                preset: 'gh-proxy',
                customBaseUrl: ''
            }
        }
    };
}

function normalizeProxySettings(proxy = {}) {
    const defaults = getDefaultSettings().network.proxy;
    const normalizedPort = Number.parseInt(proxy.port, 10);

    return {
        enabled: typeof proxy.enabled === 'boolean' ? proxy.enabled : defaults.enabled,
        protocol: proxy.protocol === 'https' ? 'https' : defaults.protocol,
        host: typeof proxy.host === 'string' && proxy.host.trim() ? proxy.host.trim() : defaults.host,
        port: Number.isInteger(normalizedPort) && normalizedPort > 0 ? normalizedPort : defaults.port,
        noProxy: typeof proxy.noProxy === 'string' && proxy.noProxy.trim() ? proxy.noProxy.trim() : defaults.noProxy
    };
}

function normalizeGithubSettings(github = {}) {
    const defaults = getDefaultSettings().network.github;
    const allowedPresets = new Set(['official', 'gh-proxy', 'custom']);

    return {
        preset: allowedPresets.has(github.preset) ? github.preset : defaults.preset,
        customBaseUrl: typeof github.customBaseUrl === 'string' ? github.customBaseUrl.trim() : defaults.customBaseUrl
    };
}

export function normalizeSettings(input = {}) {
    const defaults = getDefaultSettings();

    return {
        language: ['zh', 'en'].includes(input.language) ? input.language : defaults.language,
        network: {
            proxy: normalizeProxySettings(input.network?.proxy),
            github: normalizeGithubSettings(input.network?.github)
        }
    };
}

export function readSettings() {
    const settingsPath = getSettingsPath();
    ensureDir(getSlothToolHome());

    if (!fs.existsSync(settingsPath)) {
        return getDefaultSettings();
    }

    const content = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(content);
    return normalizeSettings(parsed);
}

export function writeSettings(settings) {
    ensureDir(getSlothToolHome());
    const normalized = normalizeSettings(settings);
    fs.writeFileSync(getSettingsPath(), JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

export function updateSettings(updater) {
    const currentSettings = readSettings();
    const nextSettings = typeof updater === 'function'
        ? updater(structuredClone(currentSettings))
        : updater;

    return writeSettings(nextSettings);
}

export function getLanguage() {
    return readSettings().language || 'zh';
}

export function setLanguage(language) {
    if (!['zh', 'en'].includes(language)) {
        throw new Error('Language must be "zh" or "en".');
    }

    const settings = readSettings();
    settings.language = language;
    writeSettings(settings);
    return settings.language;
}

export function getNetworkSettings() {
    return readSettings().network;
}

export function setProxyEnabled(enabled) {
    return updateSettings(currentSettings => {
        currentSettings.network.proxy.enabled = enabled;
        return currentSettings;
    }).network.proxy.enabled;
}

export function setProxyHost(host) {
    if (typeof host !== 'string' || !host.trim()) {
        throw new Error('Proxy host must be a non-empty string.');
    }

    return updateSettings(currentSettings => {
        currentSettings.network.proxy.host = host.trim();
        return currentSettings;
    }).network.proxy.host;
}

export function setProxyPort(port) {
    const normalizedPort = Number.parseInt(port, 10);
    if (!Number.isInteger(normalizedPort) || normalizedPort <= 0 || normalizedPort > 65535) {
        throw new Error('Proxy port must be an integer between 1 and 65535.');
    }

    return updateSettings(currentSettings => {
        currentSettings.network.proxy.port = normalizedPort;
        return currentSettings;
    }).network.proxy.port;
}

export function setGithubPreset(preset) {
    if (!['official', 'gh-proxy', 'custom'].includes(preset)) {
        throw new Error('GitHub preset must be "official", "gh-proxy", or "custom".');
    }

    return updateSettings(currentSettings => {
        currentSettings.network.github.preset = preset;
        return currentSettings;
    }).network.github.preset;
}

export function setGithubCustomBaseUrl(customBaseUrl) {
    let parsedUrl;

    try {
        parsedUrl = new URL(customBaseUrl);
    } catch {
        throw new Error('GitHub custom proxy URL must be a valid URL.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('GitHub custom proxy URL must use http or https.');
    }

    const normalizedUrl = parsedUrl.href.replace(/\/$/u, '');
    return updateSettings(currentSettings => {
        currentSettings.network.github.customBaseUrl = normalizedUrl;
        currentSettings.network.github.preset = 'custom';
        return currentSettings;
    }).network.github.customBaseUrl;
}

export default {
    getDefaultSettings,
    normalizeSettings,
    readSettings,
    writeSettings,
    updateSettings,
    getLanguage,
    setLanguage,
    getNetworkSettings,
    setProxyEnabled,
    setProxyHost,
    setProxyPort,
    setGithubPreset,
    setGithubCustomBaseUrl
};
