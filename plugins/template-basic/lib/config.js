/**
 * @file TemplatePluginConfig
 * @project SlothTool
 * @module Plugin Scaffold / Config
 * @description 为模板插件提供简单配置存储，示例化展示 CLI/TUI 共用的数据层。
 * @logic 1. 定位插件配置文件；2. 合并默认配置与已保存配置；3. 暴露 sampleOption 开关能力。
 * @dependencies Node: fs/os/path
 * @index_tags 模板配置, scaffold, sampleOption, plugin-configs
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

function getConfigPath(pluginName) {
    return path.join(getPluginConfigsDir(), `${pluginName}.json`);
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

export function getDefaultConfig() {
    return {
        sampleOption: true
    };
}

export function readConfig(pluginName) {
    ensureDir(getPluginConfigsDir());
    const configPath = getConfigPath(pluginName);

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
        ...getDefaultConfig(),
        ...parsed
    };
}

export function writeConfig(pluginName, config) {
    ensureDir(getPluginConfigsDir());
    fs.writeFileSync(getConfigPath(pluginName), JSON.stringify(config, null, 2), 'utf8');
}

export function toggleSampleOption(pluginName) {
    const nextConfig = readConfig(pluginName);
    nextConfig.sampleOption = !nextConfig.sampleOption;
    writeConfig(pluginName, nextConfig);
    return nextConfig;
}
