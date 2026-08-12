/**
 * @file GStoreGitService
 * @project SlothTool
 * @module GStore Plugin / Git
 * @description 提供独立缓存仓库的 git 初始化、remote、pull、commit、push 和状态检查能力。
 * @logic 1. 固定使用 ~/.slothtool/cache/gstore/repository 作为 Git 缓存；2. 所有 Git 操作委托本机 git 命令；3. 用 fast-forward-only 拉取和本地仓库身份配置保证同步行为可预测。
 * @dependencies Node: fs/path, Runner: ./command-runner.js, Config: ./config.js
 * @index_tags gstore git, 数据仓库, git命令, pull, push
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {commandExists, runCommand, tryRunCommand} from './command-runner.js';
import {ensureDir, getRepositoryCacheDir} from './config.js';

const GIT_USER_NAME = 'SlothTool GStore';
const GIT_USER_EMAIL = 'gstore@slothtool.local';

export function assertGitAvailable(options = {}) {
    if (!commandExists('git', options)) {
        throw new Error('git is not installed or not available in PATH.');
    }
}

export function git(args = [], options = {}) {
    return (options.runner || runCommand)('git', args, {
        cwd: options.cwd || getRepositoryCacheDir(),
        env: options.env
    });
}

export function tryGit(args = [], options = {}) {
    if (options.runner) {
        try {
            return {ok: true, ...options.runner('git', args, {cwd: options.cwd || getRepositoryCacheDir(), env: options.env})};
        } catch (error) {
            return {ok: false, error, stdout: error.stdout || '', stderr: error.stderr || '', exitCode: error.exitCode || 1};
        }
    }

    return tryRunCommand('git', args, {
        cwd: options.cwd || getRepositoryCacheDir(),
        env: options.env
    });
}

export function isDataRepoInitialized(cacheDir = getRepositoryCacheDir()) {
    return fs.existsSync(path.join(cacheDir, '.git'));
}

export function ensureDataRepo(options = {}) {
    const cacheDir = options.cacheDir || options.dataDir || getRepositoryCacheDir();
    ensureDir(cacheDir);
    assertGitAvailable(options);

    if (!isDataRepoInitialized(cacheDir)) {
        const initResult = tryGit(['init', '-b', options.defaultBranch || 'main'], {
            ...options,
            cwd: cacheDir
        });

        if (!initResult.ok) {
            git(['init'], {...options, cwd: cacheDir});
            git(['checkout', '-B', options.defaultBranch || 'main'], {...options, cwd: cacheDir});
        }
    }

    git(['config', 'user.name', GIT_USER_NAME], {...options, cwd: cacheDir});
    git(['config', 'user.email', GIT_USER_EMAIL], {...options, cwd: cacheDir});
    git(['config', 'core.autocrlf', 'false'], {...options, cwd: cacheDir});
    return cacheDir;
}

export function setRemote(remoteUrl, options = {}) {
    const cacheDir = ensureDataRepo(options);
    const existing = tryGit(['remote', 'get-url', 'origin'], {...options, cwd: cacheDir});

    if (existing.ok) {
        git(['remote', 'set-url', 'origin', remoteUrl], {...options, cwd: cacheDir});
    } else {
        git(['remote', 'add', 'origin', remoteUrl], {...options, cwd: cacheDir});
    }
}

export function getRemote(options = {}) {
    const result = tryGit(['remote', 'get-url', 'origin'], options);
    return result.ok ? result.stdout.trim() : '';
}

export function getCurrentBranch(options = {}) {
    const result = tryGit(['branch', '--show-current'], options);
    const branch = result.ok ? result.stdout.trim() : '';
    return branch || options.defaultBranch || 'main';
}

export function pullDataRepo(options = {}) {
    const cacheDir = ensureDataRepo(options);
    const remote = getRemote({...options, cwd: cacheDir});
    if (!remote) {
        return {status: 'no-remote'};
    }

    const branch = getCurrentBranch({...options, cwd: cacheDir});
    const result = tryGit(['pull', '--ff-only', 'origin', branch], {
        ...options,
        cwd: cacheDir
    });

    if (!result.ok) {
        const message = `${result.stderr}\n${result.stdout}`;
        if (/couldn't find remote ref|not our ref|no such ref|could not read from remote repository/iu.test(message)) {
            return {status: 'empty-remote', reason: result.error.message};
        }

        throw result.error;
    }

    return {status: 'pulled', stdout: result.stdout};
}

export function hasWorktreeChanges(options = {}) {
    const result = git(['status', '--porcelain'], options);
    return result.stdout.trim().length > 0;
}

export function commitAll(message, options = {}) {
    const cacheDir = ensureDataRepo(options);
    git(['add', '--all'], {...options, cwd: cacheDir});

    if (!hasWorktreeChanges({...options, cwd: cacheDir})) {
        return {status: 'no-changes', commit: ''};
    }

    git(['commit', '-m', message || 'chore: sync gstore data'], {
        ...options,
        cwd: cacheDir
    });
    const commit = git(['rev-parse', '--short', 'HEAD'], {...options, cwd: cacheDir}).stdout.trim();
    return {status: 'committed', commit};
}

export function pushDataRepo(options = {}) {
    const cacheDir = ensureDataRepo(options);
    const branch = getCurrentBranch({...options, cwd: cacheDir});
    git(['push', '-u', 'origin', branch], {
        ...options,
        cwd: cacheDir
    });
    return {status: 'pushed', branch};
}

export default {
    commitAll,
    ensureDataRepo,
    getCurrentBranch,
    getRemote,
    isDataRepoInitialized,
    pullDataRepo,
    pushDataRepo,
    setRemote
};
