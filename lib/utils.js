/**
 * @file SlothToolPathUtils
 * @project SlothTool
 * @module Core CLI / Utilities
 * @description 提供 SlothTool 数据目录、文件路径、终端能力判断与基础文件系统辅助函数。
 * @logic 1. 统一生成用户目录与插件目录路径；2. 提供目录确保与安全删除；3. 判断当前终端是否适合启动 TUI。
 * @dependencies Node: fs/os/path
 * @index_tags 路径工具, 数据目录, TUI终端检测, 文件系统辅助
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

export function getPluginsDir() {
    return path.join(getSlothToolHome(), 'plugins');
}

export function getRegistryPath() {
    return path.join(getSlothToolHome(), 'registry.json');
}

export function getSettingsPath() {
    return path.join(getSlothToolHome(), 'settings.json');
}

export function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

export function getPluginDir(pluginAlias) {
    return path.join(getPluginsDir(), pluginAlias);
}

export function getPluginConfigPath(pluginAlias) {
    return path.join(getPluginConfigsDir(), `${pluginAlias}.json`);
}

export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true});
    }
}

export function removePath(targetPath) {
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, {recursive: true, force: true});
    }
}

export function extractPluginAlias(packageName) {
    const withoutScope = packageName.replace(/^@[^/]+\//u, '');
    return withoutScope.replace(/^plugin-/u, '');
}

export function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
