/**
 * @file GStoreConfigStore
 * @project SlothTool
 * @module GStore Plugin / Storage
 * @description 管理 gstore 本机配置、数据仓库路径和 SlothTool 网络代理环境。
 * @logic 1. 固定 ~/.slothtool/data 为 Git 工作区；2. 将 gstore 状态保存到 plugin-configs/gstore.json；3. 读取网络代理配置并生成子进程环境变量。
 * @dependencies Node: fs/os/path
 * @index_tags gstore配置, 数据仓库, plugin-configs, proxyEnv, GitHub同步
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

export function getDataDir() {
    return path.join(getSlothToolHome(), 'data');
}

export function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

export function getGStoreConfigPath() {
    return path.join(getPluginConfigsDir(), 'gstore.json');
}

export function getSettingsPath() {
    return path.join(getSlothToolHome(), 'settings.json');
}

export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

export function getDefaultConfig() {
    return {
        remote: '',
        repository: '',
        defaultBranch: 'main',
        bindings: [],
        lastSync: {}
    };
}

function normalizeToolName(value) {
    return String(value || '').trim().replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '');
}

export function normalizeRepoPath(tool, name) {
    const normalizedTool = normalizeToolName(tool);
    const normalizedName = normalizeToolName(name);

    if (!normalizedTool || !normalizedName || normalizedTool.includes('..') || normalizedName.includes('..')) {
        throw new Error('tool and name must be non-empty safe path segments.');
    }

    return `${normalizedTool}/${normalizedName}`;
}

export function getBindingId(tool, name) {
    return normalizeRepoPath(tool, name);
}

function normalizeBinding(binding = {}) {
    const repoPath = binding.repoPath || normalizeRepoPath(binding.tool, binding.name);

    return {
        tool: String(binding.tool || '').trim(),
        name: String(binding.name || '').trim(),
        localPath: String(binding.localPath || '').trim(),
        repoPath,
        createdAt: binding.createdAt || new Date().toISOString(),
        updatedAt: binding.updatedAt || binding.createdAt || new Date().toISOString()
    };
}

export function normalizeConfig(input = {}) {
    const defaults = getDefaultConfig();
    const bindings = Array.isArray(input.bindings) ? input.bindings.map(normalizeBinding) : defaults.bindings;

    return {
        remote: typeof input.remote === 'string' ? input.remote.trim() : defaults.remote,
        repository: typeof input.repository === 'string' ? input.repository.trim() : defaults.repository,
        defaultBranch: typeof input.defaultBranch === 'string' && input.defaultBranch.trim()
            ? input.defaultBranch.trim()
            : defaults.defaultBranch,
        bindings,
        lastSync: input.lastSync && typeof input.lastSync === 'object' ? input.lastSync : defaults.lastSync
    };
}

export function readConfig() {
    ensureDir(getPluginConfigsDir());
    const configPath = getGStoreConfigPath();

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    return normalizeConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
}

export function writeConfig(config) {
    ensureDir(getPluginConfigsDir());
    const normalized = normalizeConfig(config);
    fs.writeFileSync(getGStoreConfigPath(), JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

export function readSlothToolSettings() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
        }
    } catch {
        return {};
    }

    return {};
}

export function buildProxyEnv(settings = readSlothToolSettings()) {
    const proxySettings = settings?.network?.proxy;

    if (!proxySettings?.enabled) {
        return {};
    }

    const protocol = proxySettings.protocol === 'https' ? 'https' : 'http';
    const host = proxySettings.host || '127.0.0.1';
    const port = proxySettings.port || 7980;
    const noProxy = proxySettings.noProxy || 'localhost,127.0.0.1,::1';
    const proxyUrl = `${protocol}://${host}:${port}`;

    return {
        HTTP_PROXY: proxyUrl,
        HTTPS_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        https_proxy: proxyUrl,
        NO_PROXY: noProxy,
        no_proxy: noProxy
    };
}

export function getCommandEnv(extraEnv = {}) {
    return {
        ...process.env,
        ...buildProxyEnv(),
        ...extraEnv
    };
}

export default {
    buildProxyEnv,
    ensureDir,
    getBindingId,
    getCommandEnv,
    getDataDir,
    getDefaultConfig,
    getGStoreConfigPath,
    normalizeConfig,
    normalizeRepoPath,
    readConfig,
    writeConfig
};
