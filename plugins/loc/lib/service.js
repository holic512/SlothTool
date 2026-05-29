/**
 * @file LocService
 * @project SlothTool
 * @module LOC Plugin / Services
 * @description 提供 loc 插件的可复用 CLI/TUI 业务能力，包括目录统计与配置读写。
 * @logic 1. 校验目录输入；2. 基于配置执行统计；3. 暴露配置展示、切换和重置接口给 CLI 与 TUI。
 * @dependencies Node: fs/path, Core: ./counter.js, Storage: ./config.js
 * @index_tags loc服务, 目录统计, 配置切换, CLI底层
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {countLines} from './counter.js';
import {
    readConfig,
    resetConfig,
    setExcludedDirectoryEnabled,
    setExtensionEnabled
} from './config.js';

export function resolveTargetDirectory(targetDir) {
    const resolvedDir = path.resolve(targetDir || '.');
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        throw new Error(resolvedDir);
    }

    return resolvedDir;
}

export function countTargetDirectory(targetDir, options = {}) {
    const resolvedDir = resolveTargetDirectory(targetDir);
    const summary = countLines(resolvedDir, readConfig());

    return {
        resolvedDir,
        verbose: options.verbose === true,
        ...summary
    };
}

export function getConfigSummary() {
    return readConfig();
}

export function resetPluginConfig() {
    return resetConfig();
}

export function toggleExtension(extension, enabled) {
    return setExtensionEnabled(extension, enabled);
}

export function toggleExcludedDirectory(directoryName, enabled) {
    return setExcludedDirectoryEnabled(directoryName, enabled);
}
