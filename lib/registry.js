/**
 * @file SlothToolRegistryStore
 * @project SlothTool
 * @module Core CLI / Storage
 * @description 负责管理已安装插件注册表，提供读取、私有原子写入和插件条目增删查接口。
 * @logic 1. 缺失 registry.json 时返回空插件映射；2. 写入时保证 Pipker 存储目录存在；3. 通过同目录私有临时文件与原子替换持久化插件条目。
 * @dependencies Node: fs, Utils: ./utils.js
 * @index_tags 插件注册表, registry.json, 已安装插件, 存储层
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ensureDir, getRegistryPath, getSlothToolHome} from './utils.js';

function createEmptyRegistry() {
    return {plugins: {}};
}

export function readRegistry() {
    const registryPath = getRegistryPath();

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
    const registryPath = getRegistryPath();
    const temporaryPath = path.join(
        path.dirname(registryPath),
        `.${path.basename(registryPath)}.${process.pid}.${randomUUID()}.tmp`
    );
    try {
        fs.writeFileSync(temporaryPath, `${JSON.stringify(registry, null, 2)}\n`, {
            encoding: 'utf8',
            flag: 'wx',
            mode: 0o600
        });
        fs.renameSync(temporaryPath, registryPath);
        try {
            fs.chmodSync(registryPath, 0o600);
        } catch {
            // Best effort for file systems without POSIX permissions.
        }
    } catch (error) {
        try {
            fs.rmSync(temporaryPath, {force: true});
        } catch {
            // Preserve the original registry write failure.
        }
        throw error;
    }
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
