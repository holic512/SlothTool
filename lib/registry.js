/**
 * @file SlothToolRegistryStore
 * @project SlothTool
 * @module Core CLI / Storage
 * @description 负责管理已安装插件注册表，提供读取、写入和插件条目增删查接口。
 * @logic 1. 保证 registry.json 所在目录存在；2. 缺失时返回空插件映射；3. 对插件条目执行原子式读改写。
 * @dependencies Node: fs, Utils: ./utils.js
 * @index_tags 插件注册表, registry.json, 已安装插件, 存储层
 * @author holic512
 */

import fs from 'node:fs';
import {ensureDir, getRegistryPath, getSlothToolHome} from './utils.js';

function createEmptyRegistry() {
    return {plugins: {}};
}

export function readRegistry() {
    const registryPath = getRegistryPath();
    ensureDir(getSlothToolHome());

    if (!fs.existsSync(registryPath)) {
        return createEmptyRegistry();
    }

    const content = fs.readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(content);

    return {
        plugins: {
            ...createEmptyRegistry().plugins,
            ...(parsed.plugins || {})
        }
    };
}

export function writeRegistry(registry) {
    ensureDir(getSlothToolHome());
    fs.writeFileSync(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf8');
}

export function addPlugin(alias, pluginInfo) {
    const registry = readRegistry();
    registry.plugins[alias] = pluginInfo;
    writeRegistry(registry);
}

export function removePlugin(alias) {
    const registry = readRegistry();
    delete registry.plugins[alias];
    writeRegistry(registry);
}

export function getPlugin(alias) {
    return readRegistry().plugins[alias] || null;
}

export function getAllPlugins() {
    return readRegistry().plugins;
}

export function hasPlugin(alias) {
    return Object.prototype.hasOwnProperty.call(readRegistry().plugins, alias);
}

export default {
    readRegistry,
    writeRegistry,
    addPlugin,
    removePlugin,
    getPlugin,
    getAllPlugins,
    hasPlugin
};
