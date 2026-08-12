/**
 * @file GStoreService
 * @project SlothTool
 * @module GStore Plugin / Services
 * @description 提供 SlothTool 设置、插件配置和数据目录的 GitHub 仓库缓存、状态、pull、push、sync、冲突检测和诊断能力。
 * @logic 1. 在独立缓存仓库维护远端副本；2. 自动注册系统设置、插件配置和数据目录并兼容自定义 binding；3. 基于文件哈希检测冲突；4. 全量同步只生成一次提交和一次 push。
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
    getPluginConfigsDir,
    getRepositoryCacheDir,
    getSettingsPath,
    getSlothToolHome,
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
    return path.join(getRepositoryCacheDir(), binding.repoPath);
}

const SYSTEM_BINDING_DEFINITIONS = [
    {
        tool: 'slothtool',
        name: 'settings',
        localPath: getSlothToolHome,
        repoPath: 'system/settings',
        include: ['settings.json'],
        exclude: []
    },
    {
        tool: 'slothtool',
        name: 'plugin-configs',
        localPath: getPluginConfigsDir,
        repoPath: 'system/plugin-configs',
        include: [],
        exclude: ['gstore.json']
    },
    {
        tool: 'slothtool',
        name: 'data',
        localPath: getDataDir,
        repoPath: 'system/data',
        include: [],
        exclude: []
    }
];

function buildSystemBinding(definition, existing = null) {
    const now = new Date().toISOString();
    return {
        tool: definition.tool,
        name: definition.name,
        localPath: definition.localPath(),
        repoPath: definition.repoPath,
        include: definition.include,
        exclude: definition.exclude,
        system: true,
        createdAt: existing?.createdAt || now,
        updatedAt: existing?.updatedAt || now
    };
}

function ensureSystemBindings(config, {persist = true} = {}) {
    let changed = false;

    for (const definition of SYSTEM_BINDING_DEFINITIONS) {
        const id = getBindingId(definition.tool, definition.name);
        const existingIndex = config.bindings.findIndex(binding => getBindingId(binding.tool, binding.name) === id);
        const existing = existingIndex >= 0 ? config.bindings[existingIndex] : null;
        const next = buildSystemBinding(definition, existing);

        if (!existing || JSON.stringify({...existing, updatedAt: next.updatedAt}) !== JSON.stringify(next)) {
            if (existingIndex >= 0) {
                config.bindings[existingIndex] = next;
            } else {
                config.bindings.unshift(next);
            }
            changed = true;
        }
        ensureDir(next.localPath);
        ensureDir(getRepoPath(next));
    }

    if (changed && persist) {
        writeConfig(config);
    }

    return config;
}

function readRuntimeConfig() {
    return ensureSystemBindings(readConfig());
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
    return readRuntimeConfig().bindings;
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
        include: [],
        exclude: [],
        system: false,
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
    const config = readRuntimeConfig();
    const id = getBindingId(tool, name);
    const binding = findBinding(config, tool, name);
    if (binding?.system) {
        throw new Error(`System binding cannot be removed: ${id}`);
    }
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
        cacheDir: getRepositoryCacheDir()
    };
}

function refreshRemote(config, options = {}) {
    ensureDataRepo({defaultBranch: config.defaultBranch, ...options});
    if (config.remote && getRemote() !== config.remote) {
        setRemote(config.remote, {defaultBranch: config.defaultBranch, ...options});
    }

    if (getRemote()) {
        pullDataRepo({defaultBranch: config.defaultBranch, ...options});
    }
}

function assertRepositoryConfigured(config) {
    const remote = config.remote || getRemote();
    if (!remote) {
        throw new Error('Remote repository is not configured. Run gstore repo set <OWNER/REPO>.');
    }
    return remote;
}

function pruneExcludedCacheFiles(binding) {
    const removed = [];
    for (const pattern of binding.exclude || []) {
        if (!pattern || pattern.includes('*') || pattern.includes('..')) {
            continue;
        }
        const targetPath = path.join(getRepoPath(binding), pattern);
        if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            fs.rmSync(targetPath, {force: true});
            removed.push(pattern);
        }
    }
    return removed;
}

export function getBindingStatus(tool, name, options = {}) {
    const config = readRuntimeConfig();
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
    const localSnapshot = scanDirectory(binding.localPath, binding);
    const remoteSnapshot = scanDirectory(getRepoPath(binding), binding);
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
    const config = readRuntimeConfig();
    assertRepositoryConfigured(config);
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
    const config = readRuntimeConfig();
    assertRepositoryConfigured(config);
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

function collectStatuses(config, options = {}) {
    if (options.refresh !== false) {
        refreshRemote(config, options);
    } else {
        ensureDataRepo({defaultBranch: config.defaultBranch, ...options});
    }

    return config.bindings.map(binding => {
        const baseline = getLastSync(config, binding).files || {};
        const localSnapshot = scanDirectory(binding.localPath, binding);
        const remoteSnapshot = scanDirectory(getRepoPath(binding), binding);
        return {
            binding,
            baseline,
            localSnapshot,
            remoteSnapshot,
            ...diffSnapshots(baseline, localSnapshot, remoteSnapshot)
        };
    });
}

function flattenChanges(statuses, key) {
    return statuses.flatMap(status => status[key].map(file => `${status.binding.repoPath}/${file}`));
}

function assertStatusesSafe(statuses, {allowRemote = true, conflictStrategy = ''} = {}) {
    const conflicts = flattenChanges(statuses, 'conflicts');
    if (conflicts.length > 0 && !['local', 'remote'].includes(conflictStrategy)) {
        throw new GStoreConflictError(conflicts);
    }

    if (!allowRemote) {
        const remoteChanges = flattenChanges(statuses, 'remoteChanges');
        if (remoteChanges.length > 0) {
            throw new GStoreRemoteChangedError(remoteChanges);
        }
    }
}

export function getSystemStatus(options = {}) {
    const config = readRuntimeConfig();
    const bindings = collectStatuses(config, options);
    return {
        bindings,
        localChanges: flattenChanges(bindings, 'localChanges'),
        remoteChanges: flattenChanges(bindings, 'remoteChanges'),
        conflicts: flattenChanges(bindings, 'conflicts'),
        clean: bindings.every(binding => binding.clean)
    };
}

export function pullSystem(options = {}) {
    const config = readRuntimeConfig();
    assertRepositoryConfigured(config);
    const statuses = collectStatuses(config, options);
    assertStatusesSafe(statuses, {conflictStrategy: options.conflictStrategy});
    const applied = [];

    for (const status of statuses) {
        const remoteSnapshot = {...status.remoteSnapshot};
        if (options.conflictStrategy === 'local') {
            for (const conflict of status.conflicts) {
                if (status.baseline[conflict] === undefined) {
                    delete remoteSnapshot[conflict];
                } else {
                    remoteSnapshot[conflict] = status.baseline[conflict];
                }
            }
        }
        const changed = applyChangedFiles(
            getRepoPath(status.binding),
            status.binding.localPath,
            status.baseline,
            remoteSnapshot
        );
        applied.push(...changed.map(file => `${status.binding.repoPath}/${file}`));
        setLastSync(config, status.binding, status.remoteSnapshot);
    }
    writeConfig(config);
    return {status: 'pulled', applied, bindings: statuses.length};
}

export function pushSystem(options = {}) {
    const config = readRuntimeConfig();
    assertRepositoryConfigured(config);
    const statuses = collectStatuses(config, options);
    assertStatusesSafe(statuses, {
        allowRemote: options.conflictStrategy === 'local',
        conflictStrategy: options.conflictStrategy
    });
    const applied = [];

    for (const status of statuses) {
        const excluded = pruneExcludedCacheFiles(status.binding);
        applied.push(...excluded.map(file => `${status.binding.repoPath}/${file}`));
        const targetBaseline = options.conflictStrategy === 'local'
            ? status.remoteSnapshot
            : status.baseline;
        const changed = applyChangedFiles(
            status.binding.localPath,
            getRepoPath(status.binding),
            targetBaseline,
            status.localSnapshot
        );
        applied.push(...changed.map(file => `${status.binding.repoPath}/${file}`));
    }

    const commit = commitAll(options.message || 'chore: sync SlothTool configuration', {
        defaultBranch: config.defaultBranch
    });
    if (commit.status === 'committed') {
        pushDataRepo({defaultBranch: config.defaultBranch});
    }

    for (const status of statuses) {
        setLastSync(config, status.binding, scanDirectory(getRepoPath(status.binding), status.binding), commit.commit);
    }
    writeConfig(config);
    return {
        status: commit.status === 'committed' ? 'pushed' : 'no-changes',
        applied,
        commit: commit.commit,
        bindings: statuses.length
    };
}

export function syncSystem(options = {}) {
    const status = getSystemStatus(options);
    if (status.conflicts.length > 0 && !['local', 'remote'].includes(options.conflictStrategy)) {
        throw new GStoreConflictError(status.conflicts);
    }

    const shouldPull = status.remoteChanges.length > 0;
    const pulled = shouldPull
        ? pullSystem({...options, refresh: false, conflictStrategy: options.conflictStrategy})
        : null;
    const pushed = pushSystem({...options, refresh: false, conflictStrategy: options.conflictStrategy});
    return {status: 'synced', pulled, pushed};
}

export async function ensureAuth(options = {}) {
    return ensureGithubAuth(options);
}

export function getRepositorySummary() {
    const config = readRuntimeConfig();
    return {
        dataDir: getDataDir(),
        configDir: getPluginConfigsDir(),
        settingsPath: getSettingsPath(),
        cacheDir: getRepositoryCacheDir(),
        remote: config.remote || getRemote(),
        repository: config.repository,
        bindings: config.bindings
    };
}

export function runDoctor() {
    const config = readRuntimeConfig();
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
        cacheDir: getRepositoryCacheDir(),
        dataRepoInitialized: fs.existsSync(path.join(getRepositoryCacheDir(), '.git')),
        legacyDataRepo: fs.existsSync(path.join(getDataDir(), '.git')),
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
    getSystemStatus,
    listBindings,
    pullBinding,
    pullSystem,
    pushBinding,
    pushSystem,
    runDoctor,
    syncBinding,
    syncSystem,
    unbindDataDirectory
};
