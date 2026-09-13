/**
 * @file PzipConfigStore
 * @project SlothTool
 * @module PZIP Plugin / Storage
 * @description 管理 pzip 的内置过滤开关与持久化自定义排除模式。
 * @logic 1. 将配置保存到统一的 plugin-configs 目录；2. 读取时与默认规则合并；3. 校验并维护仅追加的自定义忽略模式。
 * @dependencies Node: fs/os/path
 * @index_tags pzip配置, ZIP过滤, 默认规则, 自定义忽略, plugin-configs
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const BUILT_IN_RULE_NAMES = Object.freeze([
    '.DS_Store',
    '__MACOSX',
    'dist',
    'target',
    '.git'
]);

function createConfigError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function getSlothToolHome() {
    return path.join(os.homedir(), '.pipker', 'slothtool');
}

export function getPzipConfigPath() {
    return path.join(getSlothToolHome(), 'plugin-configs', 'pzip.json');
}

function ensureConfigDirectory() {
    fs.mkdirSync(path.dirname(getPzipConfigPath()), {recursive: true});
}

export function getDefaultConfig() {
    return {
        builtInRules: Object.fromEntries(BUILT_IN_RULE_NAMES.map(name => [name, true])),
        customExcludePatterns: []
    };
}

function normalizePattern(pattern) {
    const normalized = String(pattern || '').trim();
    if (!normalized) {
        throw createConfigError('CUSTOM_PATTERN_EMPTY', 'Custom exclude pattern must not be empty.');
    }

    if (normalized.startsWith('!')) {
        throw createConfigError('CUSTOM_PATTERN_NEGATED', 'Custom exclude patterns cannot start with "!".');
    }

    if (normalized.includes('\0') || path.isAbsolute(normalized)) {
        throw createConfigError('CUSTOM_PATTERN_INVALID', `Invalid custom exclude pattern: ${normalized}`, {pattern: normalized});
    }

    return normalized.replaceAll('\\', '/');
}

function normalizeConfig(value) {
    const defaults = getDefaultConfig();
    const source = value && typeof value === 'object' ? value : {};
    const sourceRules = source.builtInRules && typeof source.builtInRules === 'object'
        ? source.builtInRules
        : {};
    const sourcePatterns = Array.isArray(source.customExcludePatterns)
        ? source.customExcludePatterns
        : [];

    return {
        builtInRules: Object.fromEntries(BUILT_IN_RULE_NAMES.map(name => [
            name,
            typeof sourceRules[name] === 'boolean' ? sourceRules[name] : defaults.builtInRules[name]
        ])),
        customExcludePatterns: [...new Set(sourcePatterns.map(normalizePattern))]
    };
}

export function readConfig() {
    const configPath = getPzipConfigPath();
    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        return normalizeConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
    } catch (error) {
        throw createConfigError('CONFIG_READ_FAILED', `Unable to read pzip configuration at ${configPath}: ${error.message}`, {configPath});
    }
}

export function writeConfig(config) {
    const normalized = normalizeConfig(config);
    ensureConfigDirectory();
    fs.writeFileSync(getPzipConfigPath(), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
}

export function resetConfig() {
    return writeConfig(getDefaultConfig());
}

export function setBuiltInRule(ruleName, enabled) {
    if (!BUILT_IN_RULE_NAMES.includes(ruleName)) {
        throw createConfigError('UNKNOWN_BUILT_IN_RULE', `Unknown built-in rule: ${ruleName}`, {ruleName});
    }

    const next = readConfig();
    next.builtInRules[ruleName] = Boolean(enabled);
    return writeConfig(next);
}

export function addCustomExcludePattern(pattern) {
    const normalizedPattern = normalizePattern(pattern);
    const next = readConfig();
    if (!next.customExcludePatterns.includes(normalizedPattern)) {
        next.customExcludePatterns.push(normalizedPattern);
    }
    return writeConfig(next);
}

export function removeCustomExcludePattern(pattern) {
    const normalizedPattern = normalizePattern(pattern);
    const next = readConfig();
    next.customExcludePatterns = next.customExcludePatterns.filter(item => item !== normalizedPattern);
    return writeConfig(next);
}

export default {
    BUILT_IN_RULE_NAMES,
    addCustomExcludePattern,
    getDefaultConfig,
    getPzipConfigPath,
    readConfig,
    removeCustomExcludePattern,
    resetConfig,
    setBuiltInRule,
    writeConfig
};
