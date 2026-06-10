/**
 * @file GStoreService
 * @project SlothTool
 * @module GStore Plugin / Services
 * @description 提供 GitHub 数据仓库绑定、状态计算、pull、push、sync、冲突检测和诊断能力。
 * @logic 1. 维护 ~/.slothtool/data Git 工作区；2. 用 binding 映射本地目录与仓库子目录；3. 基于文件哈希检测冲突并调用 git/gh 完成同步。
 * @dependencies Node: fs/path, Config: ./config.js, Git: ./git.js, GitHubCLI: ./gh.js, Snapshot: ./snapshot.js
 * @index_tags gstore服务, GitHub同步, 数据绑定, pull, push, 冲突检测
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {commandExists} from './command-runner.js';
import {
    ensureDir,
    getBindingId,
    getDataDir,
    normalizeRepoPath,
    readConfig,
    writeConfig
} from './config.js';
import {
    commitAll,
    ensureDataRepo,
    getRemote,
    pullDataRepo,
    pushDataRepo,
    setRemote
} from './git.js';
import {createPrivateRepo, ensureGithubAuth, getAuthStatus, isGhAvailable, resolveGhInstaller} from './gh.js';
import {applyChangedFiles, diffSnapshots, scanDirectory} from './snapshot.js';

export class GStoreConflictError extends Error {
    constructor(conflicts, message = 'Conflicts detected.') {
        super(message);
        this.name = 'GStoreConflictError';
        this.conflicts = conflicts;
        this.code = 'GSTORE_CONFLICT';
    }
}

export class GStoreRemoteChangedError extends Error {
    constructor(remoteChanges, message = 'Remote has changes.') {
        super(message);
        this.name = 'GStoreRemoteChangedError';
        this.remoteChanges = remoteChanges;
        this.code = 'GSTORE_REMOTE_CHANGED';
    }
}

export function classifyError(error) {
    const text = `${error?.message || ''}\n${error?.stderr || ''}\n${error?.stdout || ''}`;

    if (/authentication failed|could not read username|not logged in|bad credentials|permission denied/iu.test(text)) {
        return 'auth';
    }

    if (/could not resolve host|failed to connect|connection timed out|network is unreachable|fetch failed|enotfound|econnrefused/iu.test(text)) {
        return 'network';
    }

    if (/non-fast-forward|fetch first|rejected/iu.test(text)) {
        return 'push-rejected';
    }

    if (/merge conflict|automatic merge failed|conflict/iu.test(text)) {
        return 'merge-conflict';
    }

    return 'unknown';
}

export function resolveRemoteUrl(repository) {
    const value = String(repository || '').trim();

    if (!value) {
        throw new Error('repository is required.');
    }

    if (/^(https?:|ssh:|git@|file:)/u.test(value) || path.isAbsolute(value)) {
        return value;
    }

    if (/^[^/\s]+\/[^/\s]+$/u.test(value)) {
        return `https://github.com/${value}.git`;
    }

    return value;
}

function getRepoPath(binding) {
    return path.join(getDataDir(), binding.repoPath);
}

function getLastSync(config, binding) {
    return config.lastSync?.[getBindingId(binding.tool, binding.name)] || {
        commit: '',
        files: {}
    };
}

function setLastSync(config, binding, files, commit = '') {
    const id = getBindingId(binding.tool, binding.name);
    config.lastSync = {
        ...(config.lastSync || {}),
        [id]: {
            commit,
            files,
            syncedAt: new Date().toISOString()
        }
    };
}

export function findBinding(config, tool, name) {
    const id = getBindingId(tool, name);
    return config.bindings.find(binding => getBindingId(binding.tool, binding.name) === id) || null;
}

export function listBindings() {
    return readConfig().bindings;
}

export function bindDataDirectory(tool, name, localDir) {
    const resolvedLocalPath = path.resolve(localDir);
    if (!fs.existsSync(resolvedLocalPath)) {
        fs.mkdirSync(resolvedLocalPath, {recursive: true});
    }

    if (!fs.statSync(resolvedLocalPath).isDirectory()) {
        throw new Error(`Local path is not a directory: ${resolvedLocalPath}`);
    }

    const config = readConfig();
    const id = getBindingId(tool, name);
    const now = new Date().toISOString();
    const repoPath = normalizeRepoPath(tool, name);
    const existingIndex = config.bindings.findIndex(binding => getBindingId(binding.tool, binding.name) === id);
    const nextBinding = {
        tool,
        name,
        localPath: resolvedLocalPath,
        repoPath,
        createdAt: existingIndex >= 0 ? config.bindings[existingIndex].createdAt : now,
        updatedAt: now
    };

    if (existingIndex >= 0) {
        config.bindings[existingIndex] = nextBinding;
    } else {
        config.bindings.push(nextBinding);
    }

    writeConfig(config);
    ensureDir(getRepoPath(nextBinding));
    return nextBinding;
}

export function unbindDataDirectory(tool, name) {
    const config = readConfig();
    const id = getBindingId(tool, name);
    const beforeCount = config.bindings.length;
    config.bindings = config.bindings.filter(binding => getBindingId(binding.tool, binding.name) !== id);

    if (config.bindings.length === beforeCount) {
        throw new Error(`Binding not found: ${id}`);
    }

    delete config.lastSync?.[id];
    writeConfig(config);
    return {tool, name};
}

export function configureRepository(repository, options = {}) {
    const remoteUrl = resolveRemoteUrl(repository);
    const config = readConfig();

    ensureDataRepo({defaultBranch: config.defaultBranch});

    if (options.create) {
        createPrivateRepo(repository, options);
    }

    setRemote(remoteUrl, {defaultBranch: config.defaultBranch});
    config.repository = repository;
    config.remote = remoteUrl;
    writeConfig(config);

    return {
        repository,
        remote: remoteUrl,
        dataDir: getDataDir()
    };
}

function refreshRemote(config, options = {}) {
    if (config.remote || getRemote()) {
        pullDataRepo({defaultBranch: config.defaultBranch, ...options});
    } else {
        ensureDataRepo({defaultBranch: config.defaultBranch, ...options});
    }
}

export function getBindingStatus(tool, name, options = {}) {
    const config = readConfig();
    const binding = findBinding(config, tool, name);
    if (!binding) {
        throw new Error(`Binding not found: ${getBindingId(tool, name)}`);
    }

    if (options.refresh !== false) {
        refreshRemote(config, options);
    } else {
        ensureDataRepo({defaultBranch: config.defaultBranch, ...options});
    }

    const baseline = getLastSync(config, binding).files || {};
    const localSnapshot = scanDirectory(binding.localPath);
    const remoteSnapshot = scanDirectory(getRepoPath(binding));
    const diff = diffSnapshots(baseline, localSnapshot, remoteSnapshot);

    return {
        binding,
        baseline,
        localSnapshot,
        remoteSnapshot,
        ...diff
    };
}

export function getConflicts(tool, name, options = {}) {
    return getBindingStatus(tool, name, options).conflicts;
}

function assertNoConflicts(status) {
    if (status.conflicts.length > 0) {
        throw new GStoreConflictError(status.conflicts);
    }
}

export function pullBinding(tool, name, options = {}) {
    const config = readConfig();
    const binding = findBinding(config, tool, name);
    if (!binding) {
        throw new Error(`Binding not found: ${getBindingId(tool, name)}`);
    }

    const status = getBindingStatus(tool, name, options);
    assertNoConflicts(status);

    const applied = applyChangedFiles(
        getRepoPath(binding),
        binding.localPath,
        status.baseline,
        status.remoteSnapshot
    );
    setLastSync(config, binding, status.remoteSnapshot);
    writeConfig(config);

    return {
        status: 'pulled',
        binding,
        applied,
        conflicts: []
    };
}

export function pushBinding(tool, name, options = {}) {
    const config = readConfig();
    const binding = findBinding(config, tool, name);
    if (!binding) {
        throw new Error(`Binding not found: ${getBindingId(tool, name)}`);
    }

    const status = getBindingStatus(tool, name, options);
    assertNoConflicts(status);

    if (status.remoteChanges.length > 0) {
        throw new GStoreRemoteChangedError(status.remoteChanges);
    }

    const repoPath = getRepoPath(binding);
    const applied = applyChangedFiles(binding.localPath, repoPath, status.baseline, status.localSnapshot);
    const commit = commitAll(options.message || `chore: sync ${binding.tool}/${binding.name}`, {
        defaultBranch: config.defaultBranch
    });

    if (commit.status === 'committed') {
        pushDataRepo({defaultBranch: config.defaultBranch});
    }

    const nextSnapshot = scanDirectory(repoPath);
    setLastSync(config, binding, nextSnapshot, commit.commit);
    writeConfig(config);

    return {
        status: commit.status === 'committed' ? 'pushed' : 'no-changes',
        binding,
        applied,
        commit: commit.commit
    };
}

export function syncBinding(tool, name, options = {}) {
    const status = getBindingStatus(tool, name, options);
    assertNoConflicts(status);

    let pulled = null;
    if (status.remoteChanges.length > 0) {
        pulled = pullBinding(tool, name, options);
    }

    const pushed = pushBinding(tool, name, options);
    return {
        status: 'synced',
        pulled,
        pushed
    };
}

export async function ensureAuth(options = {}) {
    return ensureGithubAuth(options);
}

export function getRepositorySummary() {
    const config = readConfig();
    return {
        dataDir: getDataDir(),
        remote: config.remote || getRemote(),
        repository: config.repository,
        bindings: config.bindings
    };
}

export function runDoctor() {
    const config = readConfig();
    const gitAvailable = commandExists('git');
    const ghAvailable = isGhAvailable();
    const authStatus = ghAvailable ? getAuthStatus() : {authenticated: false, reason: 'gh missing'};
    const installer = ghAvailable ? null : resolveGhInstaller();

    return {
        git: gitAvailable,
        gh: ghAvailable,
        ghInstaller: installer,
        authenticated: authStatus.authenticated,
        authReason: authStatus.reason,
        dataDir: getDataDir(),
        dataRepoInitialized: fs.existsSync(path.join(getDataDir(), '.git')),
        remote: config.remote || getRemote(),
        bindings: config.bindings
    };
}

export default {
    bindDataDirectory,
    classifyError,
    configureRepository,
    ensureAuth,
    getBindingStatus,
    getConflicts,
    getRepositorySummary,
    listBindings,
    pullBinding,
    pushBinding,
    runDoctor,
    syncBinding,
    unbindDataDirectory
};
