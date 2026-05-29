/**
 * @file LocConfigStore
 * @project SlothTool
 * @module LOC Plugin / Storage
 * @description 管理 loc 插件配置，包括文件扩展名过滤与排除目录规则。
 * @logic 1. 统一定位 ~/.slothtool/plugin-configs/loc.json；2. 读取时合并默认配置；3. 提供切换与重置辅助方法。
 * @dependencies Node: fs/os/path
 * @index_tags loc配置, 文件扩展名, 排除目录, plugin-configs
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

function getLocConfigPath() {
    return path.join(getPluginConfigsDir(), 'loc.json');
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

export function getDefaultConfig() {
    return {
        fileExtensions: {
            js: true,
            ts: true,
            jsx: true,
            tsx: true,
            py: true,
            java: true,
            c: true,
            cpp: true,
            h: true,
            hpp: true,
            cs: true,
            go: true,
            rs: true,
            php: true,
            rb: true,
            swift: true,
            kt: true,
            scala: true,
            html: true,
            css: true,
            scss: true,
            sass: true,
            less: true,
            vue: true,
            json: true,
            xml: true,
            yaml: true,
            yml: true,
            md: true,
            txt: true,
            sh: true,
            bash: true,
            sql: true
        },
        excludeDirectories: {
            node_modules: true,
            '.venv': true,
            venv: true,
            __pycache__: true,
            '.pytest_cache': true,
            dist: true,
            build: true,
            out: true,
            target: true,
            '.git': true,
            '.svn': true,
            '.hg': true,
            '.idea': true,
            '.vscode': true,
            '.vs': true,
            bower_components: true,
            vendor: true,
            '.cache': true,
            '.next': true,
            '.nuxt': true,
            coverage: true,
            '.nyc_output': true,
            logs: true,
            tmp: true,
            temp: true
        }
    };
}

export function readConfig() {
    ensureDir(getPluginConfigsDir());
    const configPath = getLocConfigPath();

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    const defaults = getDefaultConfig();

    return {
        fileExtensions: {
            ...defaults.fileExtensions,
            ...(parsed.fileExtensions || {})
        },
        excludeDirectories: {
            ...defaults.excludeDirectories,
            ...(parsed.excludeDirectories || {})
        }
    };
}

export function writeConfig(config) {
    ensureDir(getPluginConfigsDir());
    fs.writeFileSync(getLocConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

export function resetConfig() {
    const nextConfig = getDefaultConfig();
    writeConfig(nextConfig);
    return nextConfig;
}

export function setExtensionEnabled(extension, enabled) {
    const nextConfig = readConfig();
    nextConfig.fileExtensions[extension] = enabled;
    writeConfig(nextConfig);
    return nextConfig;
}

export function setExcludedDirectoryEnabled(directoryName, enabled) {
    const nextConfig = readConfig();
    nextConfig.excludeDirectories[directoryName] = enabled;
    writeConfig(nextConfig);
    return nextConfig;
}

export default {
    getDefaultConfig,
    readConfig,
    resetConfig,
    setExcludedDirectoryEnabled,
    setExtensionEnabled,
    writeConfig
};
