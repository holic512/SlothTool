/**
 * @file GStoreSnapshotService
 * @project SlothTool
 * @module GStore Plugin / Snapshot
 * @description 计算同步目录文件哈希、差异集合，并按文件粒度应用远端或本地变更。
 * @logic 1. 递归扫描普通文件并生成 sha256；2. 基于 baseline 判断 local/remote/conflict；3. 只复制变更文件，避免无关覆盖。
 * @dependencies Node: crypto/fs/path
 * @index_tags gstore快照, 文件哈希, 冲突检测, 目录同步
 * @author holic512
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function toPortablePath(filePath) {
    return filePath.split(path.sep).join('/');
}

function shouldSkip(entryName) {
    return entryName === '.git' || entryName === '.DS_Store';
}

function hashFile(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

export function scanDirectory(rootDir) {
    const snapshot = {};

    if (!fs.existsSync(rootDir)) {
        return snapshot;
    }

    function visit(currentDir) {
        const entries = fs.readdirSync(currentDir, {withFileTypes: true})
            .filter(entry => !shouldSkip(entry.name))
            .sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const currentPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                visit(currentPath);
                continue;
            }

            if (!entry.isFile()) {
                continue;
            }

            const relativePath = toPortablePath(path.relative(rootDir, currentPath));
            snapshot[relativePath] = hashFile(currentPath);
        }
    }

    visit(rootDir);
    return snapshot;
}

export function diffSnapshots(baseline = {}, local = {}, remote = {}) {
    const paths = new Set([
        ...Object.keys(baseline),
        ...Object.keys(local),
        ...Object.keys(remote)
    ]);
    const localChanges = [];
    const remoteChanges = [];
    const conflicts = [];

    for (const currentPath of [...paths].sort()) {
        const baselineHash = baseline[currentPath];
        const localHash = local[currentPath];
        const remoteHash = remote[currentPath];
        const localChanged = localHash !== baselineHash;
        const remoteChanged = remoteHash !== baselineHash;

        if (localChanged) {
            localChanges.push(currentPath);
        }

        if (remoteChanged) {
            remoteChanges.push(currentPath);
        }

        if (localChanged && remoteChanged && localHash !== remoteHash) {
            conflicts.push(currentPath);
        }
    }

    return {
        localChanges,
        remoteChanges,
        conflicts,
        clean: localChanges.length === 0 && remoteChanges.length === 0 && conflicts.length === 0
    };
}

function ensureParentDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
}

function copyFile(sourceRoot, targetRoot, relativePath) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    ensureParentDir(targetPath);
    fs.copyFileSync(sourcePath, targetPath);
}

function removeFile(targetRoot, relativePath) {
    const targetPath = path.join(targetRoot, relativePath);
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, {force: true});
    }
}

function pruneEmptyDirs(rootDir, currentDir = rootDir) {
    if (!fs.existsSync(currentDir)) {
        return;
    }

    for (const entry of fs.readdirSync(currentDir, {withFileTypes: true})) {
        if (entry.isDirectory() && !shouldSkip(entry.name)) {
            pruneEmptyDirs(rootDir, path.join(currentDir, entry.name));
        }
    }

    if (currentDir !== rootDir && fs.readdirSync(currentDir).length === 0) {
        fs.rmdirSync(currentDir);
    }
}

export function applyChangedFiles(sourceRoot, targetRoot, baseline = {}, sourceSnapshot = {}) {
    fs.mkdirSync(targetRoot, {recursive: true});
    const paths = new Set([...Object.keys(baseline), ...Object.keys(sourceSnapshot)]);
    const applied = [];

    for (const currentPath of [...paths].sort()) {
        const baselineHash = baseline[currentPath];
        const sourceHash = sourceSnapshot[currentPath];
        if (sourceHash === baselineHash) {
            continue;
        }

        if (sourceHash === undefined) {
            removeFile(targetRoot, currentPath);
        } else {
            copyFile(sourceRoot, targetRoot, currentPath);
        }

        applied.push(currentPath);
    }

    pruneEmptyDirs(targetRoot);
    return applied;
}

export default {
    applyChangedFiles,
    diffSnapshots,
    scanDirectory
};
