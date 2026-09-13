/**
 * @file PzipFilterEngine
 * @project SlothTool
 * @module PZIP Plugin / Filtering
 * @description 提供内置文件名规则、持久化自定义模式与分层 .gitignore 的统一匹配能力。
 * @logic 1. 先判断启用的内置规则；2. 再应用不可反选的自定义排除模式；3. 按目录层级顺序计算 .gitignore 的忽略与否定规则。
 * @dependencies Library: ignore, Node: fs/path
 * @index_tags pzip过滤, gitignore, .DS_Store, dist, target, .git
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';

const DIRECTORY_RULES = new Set(['__MACOSX', 'dist', 'target', '.git']);

function asPosixPath(value) {
    return value.split(path.sep).join('/').replace(/^\.\//u, '');
}

function matchesWithDirectoryVariant(matcher, relativePath, isDirectory) {
    if (!relativePath) {
        return false;
    }

    const normalized = asPosixPath(relativePath);
    const candidates = isDirectory ? [`${normalized}/`, normalized] : [normalized];
    return candidates.some(candidate => matcher.ignores(candidate));
}

function createMatcher(patterns, label) {
    const matcher = ignore();
    try {
        matcher.add(patterns);
    } catch (error) {
        throw new Error(`Invalid ${label} pattern: ${error.message}`);
    }
    return matcher;
}

function isCommentOrBlank(line) {
    return !line.trim() || (line.startsWith('#') && !line.startsWith('\\#'));
}

function parseGitignoreRules(content, baseRelativePath) {
    const rules = [];
    for (const line of content.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
        if (isCommentOrBlank(line)) {
            continue;
        }

        const negated = line.startsWith('!') && !line.startsWith('\\!');
        const pattern = negated ? line.slice(1) : line;
        if (!pattern) {
            continue;
        }

        rules.push({
            baseRelativePath,
            negated,
            matcher: createMatcher(pattern, '.gitignore')
        });
    }
    return rules;
}

function loadGitignoreRules(directoryPath, directoryRelativePath, warnings) {
    const gitignorePath = path.join(directoryPath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
        return [];
    }

    const stats = fs.lstatSync(gitignorePath);
    if (stats.isSymbolicLink()) {
        warnings.push(`Skipped symbolic link: ${asPosixPath(path.join(directoryRelativePath, '.gitignore')) || '.gitignore'}`);
        return [];
    }

    if (!stats.isFile()) {
        return [];
    }

    return parseGitignoreRules(fs.readFileSync(gitignorePath, 'utf8'), directoryRelativePath);
}

function matchesGitignoreRule(rule, relativePath, isDirectory) {
    const basePath = rule.baseRelativePath;
    if (basePath && relativePath !== basePath && !relativePath.startsWith(`${basePath}/`)) {
        return false;
    }

    const pathWithinRuleDirectory = basePath
        ? relativePath.slice(basePath.length + 1)
        : relativePath;
    return matchesWithDirectoryVariant(rule.matcher, pathWithinRuleDirectory, isDirectory);
}

export function getBuiltInExclusion(entryName, isDirectory, rules) {
    if (entryName === '.DS_Store' && !isDirectory && rules['.DS_Store']) {
        return '.DS_Store';
    }

    if (isDirectory && DIRECTORY_RULES.has(entryName) && rules[entryName]) {
        return entryName;
    }

    return null;
}

export function createFilterState(config, runtimePatterns = []) {
    const customPatterns = [...(config.customExcludePatterns || []), ...runtimePatterns];
    if (customPatterns.some(pattern => String(pattern).trim().startsWith('!'))) {
        const error = new Error('Custom exclude patterns cannot start with "!".');
        error.code = 'CUSTOM_PATTERN_NEGATED';
        throw error;
    }

    return {
        builtInRules: config.builtInRules,
        customMatcher: customPatterns.length > 0 ? createMatcher(customPatterns, 'custom exclude') : null,
        gitignoreRules: [],
        warnings: []
    };
}

export function addGitignoreRules(filterState, directoryPath, directoryRelativePath) {
    filterState.gitignoreRules.push(...loadGitignoreRules(
        directoryPath,
        asPosixPath(directoryRelativePath),
        filterState.warnings
    ));
}

export function getExclusionReason(filterState, entryName, relativePath, isDirectory) {
    const builtInRule = getBuiltInExclusion(entryName, isDirectory, filterState.builtInRules);
    if (builtInRule) {
        return {kind: 'builtIn', rule: builtInRule};
    }

    if (filterState.customMatcher && matchesWithDirectoryVariant(filterState.customMatcher, relativePath, isDirectory)) {
        return {kind: 'custom', rule: 'custom'};
    }

    let ignored = false;
    for (const rule of filterState.gitignoreRules) {
        if (matchesGitignoreRule(rule, relativePath, isDirectory)) {
            ignored = !rule.negated;
        }
    }

    return ignored ? {kind: 'gitignore', rule: '.gitignore'} : null;
}

export function toZipPath(relativePath) {
    return asPosixPath(relativePath);
}
