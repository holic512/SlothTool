/**
 * @file PzipArchiveService
 * @project SlothTool
 * @module PZIP Plugin / Services
 * @description 提供目录扫描、过滤、ZIP 写入、输出命名与配置操作的可复用业务能力。
 * @logic 1. 校验源目录与输出边界；2. 递归建立带过滤原因的归档清单；3. 将清单流式写入临时 ZIP 并无覆盖提交；4. 向 CLI/TUI 暴露配置与执行接口。
 * @dependencies Node: fs/path, Libraries: archiver/ignore, Modules: ./config.js, ./filter.js
 * @index_tags pzip服务, ZIP归档, 递归扫描, gitignore, 安全输出, CLI底层
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {ZipArchive} from 'archiver';
import {
    addCustomExcludePattern,
    readConfig,
    removeCustomExcludePattern,
    resetConfig,
    setBuiltInRule
} from './config.js';
import {
    addGitignoreRules,
    createFilterState,
    getExclusionReason,
    toZipPath
} from './filter.js';

function createServiceError(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}

function formatTimestamp(date = new Date()) {
    const part = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function isPathInside(parentPath, childPath) {
    const relativePath = path.relative(parentPath, childPath);
    return relativePath === '' || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath));
}

function normalizeArchivePath(outputPath) {
    const resolvedPath = path.resolve(outputPath);
    return resolvedPath.toLowerCase().endsWith('.zip') ? resolvedPath : `${resolvedPath}.zip`;
}

function createTimestampedPath(archivePath, attempt = 0) {
    const parsed = path.parse(archivePath);
    const suffix = attempt === 0 ? formatTimestamp() : `${formatTimestamp()}-${attempt + 1}`;
    return path.join(parsed.dir, `${parsed.name}-${suffix}${parsed.ext}`);
}

function findAvailableArchivePath(requestedArchivePath) {
    if (!fs.existsSync(requestedArchivePath)) {
        return requestedArchivePath;
    }

    let attempt = 0;
    while (true) {
        const candidate = createTimestampedPath(requestedArchivePath, attempt);
        if (!fs.existsSync(candidate)) {
            return candidate;
        }
        attempt += 1;
    }
}

function resolveOutputPath(sourceDirectory, outputPath) {
    const defaultOutputPath = path.join(path.dirname(sourceDirectory), `${path.basename(sourceDirectory)}.zip`);
    const requestedArchivePath = normalizeArchivePath(outputPath || defaultOutputPath);
    const outputParent = path.dirname(requestedArchivePath);

    if (!fs.existsSync(outputParent) || !fs.statSync(outputParent).isDirectory()) {
        throw createServiceError('OUTPUT_DIRECTORY_MISSING', `Output directory does not exist: ${outputParent}`, {outputParent});
    }

    if (isPathInside(sourceDirectory, requestedArchivePath)) {
        throw createServiceError('OUTPUT_INSIDE_SOURCE', 'Output archive must be outside the source directory.');
    }

    return {
        requestedArchivePath,
        archivePath: findAvailableArchivePath(requestedArchivePath)
    };
}

function createEmptyExclusionSummary() {
    return {
        builtIn: 0,
        gitignore: 0,
        custom: 0,
        symlink: 0,
        special: 0
    };
}

export function resolveSourceDirectory(sourcePath) {
    const resolvedPath = path.resolve(sourcePath || '.');
    if (!fs.existsSync(resolvedPath)) {
        throw createServiceError('SOURCE_DIRECTORY_MISSING', `Source directory does not exist: ${resolvedPath}`, {sourcePath: resolvedPath});
    }

    const stats = fs.lstatSync(resolvedPath);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw createServiceError('SOURCE_NOT_DIRECTORY', `Source must be a directory: ${resolvedPath}`, {sourcePath: resolvedPath});
    }

    return resolvedPath;
}

export function scanDirectoryForArchive(sourcePath, options = {}) {
    const sourceDirectory = resolveSourceDirectory(sourcePath);
    const config = options.config || readConfig();
    const filterState = createFilterState(config, options.excludePatterns || []);
    const sourceName = path.basename(sourceDirectory);
    const files = [];
    const directories = [{
        absolutePath: sourceDirectory,
        relativePath: '',
        zipPath: `${sourceName}/`
    }];
    const exclusions = createEmptyExclusionSummary();
    const warnings = filterState.warnings;
    let sourceBytes = 0;

    function visit(directoryPath, directoryRelativePath) {
        addGitignoreRules(filterState, directoryPath, directoryRelativePath);
        const entries = fs.readdirSync(directoryPath, {withFileTypes: true})
            .sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const absolutePath = path.join(directoryPath, entry.name);
            const relativePath = toZipPath(path.join(directoryRelativePath, entry.name));

            if (entry.isSymbolicLink()) {
                exclusions.symlink += 1;
                warnings.push(`Skipped symbolic link: ${relativePath}`);
                continue;
            }

            const isDirectory = entry.isDirectory();
            const exclusion = getExclusionReason(filterState, entry.name, relativePath, isDirectory);
            if (exclusion) {
                exclusions[exclusion.kind] += 1;
                continue;
            }

            if (isDirectory) {
                directories.push({
                    absolutePath,
                    relativePath,
                    zipPath: `${sourceName}/${relativePath}/`
                });
                visit(absolutePath, relativePath);
                continue;
            }

            if (!entry.isFile()) {
                exclusions.special += 1;
                warnings.push(`Skipped unsupported file system entry: ${relativePath}`);
                continue;
            }

            const stats = fs.statSync(absolutePath);
            files.push({
                absolutePath,
                relativePath,
                zipPath: `${sourceName}/${relativePath}`,
                mode: stats.mode,
                mtime: stats.mtime,
                size: stats.size
            });
            sourceBytes += stats.size;
        }
    }

    visit(sourceDirectory, '');

    if (files.length === 0) {
        throw createServiceError('NO_ELIGIBLE_FILES', 'No eligible files remain after applying the archive filters.');
    }

    return {
        sourceDirectory,
        sourceName,
        config,
        files,
        directories,
        sourceBytes,
        exclusions,
        warnings
    };
}

function createTemporaryArchivePath(archivePath) {
    const parsed = path.parse(archivePath);
    return path.join(parsed.dir, `.${parsed.name}.pzip-${process.pid}-${Date.now()}.partial`);
}

function writeArchive(manifest, temporaryArchivePath) {
    return new Promise((resolve, reject) => {
        const archive = new ZipArchive({zlib: {level: 9}});
        const output = fs.createWriteStream(temporaryArchivePath, {flags: 'wx'});
        let settled = false;

        function fail(error) {
            if (!settled) {
                settled = true;
                reject(error);
            }
        }

        output.on('close', () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        });
        output.on('error', fail);
        archive.on('error', fail);
        archive.on('warning', fail);
        archive.pipe(output);

        for (const directory of manifest.directories) {
            archive.append(Buffer.alloc(0), {name: directory.zipPath});
        }

        for (const file of manifest.files) {
            archive.file(file.absolutePath, {
                name: file.zipPath,
                mode: file.mode,
                date: file.mtime
            });
        }

        Promise.resolve(archive.finalize()).catch(fail);
    });
}

function commitTemporaryArchive(temporaryArchivePath, requestedArchivePath) {
    let candidate = findAvailableArchivePath(requestedArchivePath);
    while (true) {
        try {
            fs.linkSync(temporaryArchivePath, candidate);
            fs.unlinkSync(temporaryArchivePath);
            return candidate;
        } catch (error) {
            if (error.code === 'EEXIST') {
                candidate = findAvailableArchivePath(requestedArchivePath);
                continue;
            }

            if (error.code !== 'EPERM' && error.code !== 'EXDEV') {
                throw error;
            }

            try {
                fs.copyFileSync(temporaryArchivePath, candidate, fs.constants.COPYFILE_EXCL);
                fs.unlinkSync(temporaryArchivePath);
                return candidate;
            } catch (copyError) {
                if (copyError.code === 'EEXIST') {
                    candidate = findAvailableArchivePath(requestedArchivePath);
                    continue;
                }
                throw copyError;
            }
        }
    }
}

function createResult(manifest, archivePath, dryRun) {
    const excludedFileCount = manifest.exclusions.builtIn
        + manifest.exclusions.gitignore
        + manifest.exclusions.custom;
    return {
        sourceDirectory: manifest.sourceDirectory,
        rootDirectory: manifest.sourceName,
        archivePath,
        dryRun,
        includedFileCount: manifest.files.length,
        includedDirectoryCount: manifest.directories.length,
        excludedFileCount,
        sourceBytes: manifest.sourceBytes,
        archiveBytes: dryRun ? null : fs.statSync(archivePath).size,
        exclusions: manifest.exclusions,
        warnings: manifest.warnings
    };
}

export async function createZipArchive(sourcePath, options = {}) {
    const manifest = scanDirectoryForArchive(sourcePath, options);
    const output = resolveOutputPath(manifest.sourceDirectory, options.outputPath);
    if (options.dryRun === true) {
        return createResult(manifest, output.archivePath, true);
    }

    const temporaryArchivePath = createTemporaryArchivePath(output.archivePath);
    try {
        await writeArchive(manifest, temporaryArchivePath);
        const archivePath = commitTemporaryArchive(temporaryArchivePath, output.requestedArchivePath);
        return createResult(manifest, archivePath, false);
    } catch (error) {
        fs.rmSync(temporaryArchivePath, {force: true});
        throw error;
    }
}

export function getConfigSummary() {
    return readConfig();
}

export function resetPluginConfig() {
    return resetConfig();
}

export function toggleBuiltInRule(ruleName, enabled) {
    return setBuiltInRule(ruleName, enabled);
}

export function addCustomRule(pattern) {
    return addCustomExcludePattern(pattern);
}

export function removeCustomRule(pattern) {
    return removeCustomExcludePattern(pattern);
}

export default {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    removeCustomRule,
    resetPluginConfig,
    resolveSourceDirectory,
    scanDirectoryForArchive,
    toggleBuiltInRule
};
