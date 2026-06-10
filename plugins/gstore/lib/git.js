/**
 * @file GStoreGitService
 * @project SlothTool
 * @module GStore Plugin / Git
 * @description 提供本地数据仓库的 git 初始化、remote、pull、commit、push 和状态检查能力。
 * @logic 1. 固定使用 ~/.slothtool/data 作为工作区；2. 所有 Git 操作委托本机 git 命令；3. 用本地仓库配置避免依赖全局 user.name/user.email。
 * @dependencies Node: fs/path, Runner: ./command-runner.js, Config: ./config.js
 * @index_tags gstore git, 数据仓库, git命令, pull, push
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {commandExists, runCommand, tryRunCommand} from './command-runner.js';
import {ensureDir, getDataDir} from './config.js';

const GIT_USER_NAME = 'SlothTool GStore';
const GIT_USER_EMAIL = 'gstore@slothtool.local';

export function assertGitAvailable(options = {}) {
    if (!commandExists('git', options)) {
        throw new Error('git is not installed or not available in PATH.');
    }
}

export function git(args = [], options = {}) {
    return (options.runner || runCommand)('git', args, {
        cwd: options.cwd || getDataDir(),
        env: options.env
    });
}

export function tryGit(args = [], options = {}) {
    if (options.runner) {
        try {
            return {ok: true, ...options.runner('git', args, {cwd: options.cwd || getDataDir(), env: options.env})};
        } catch (error) {
            return {ok: false, error, stdout: error.stdout || '', stderr: error.stderr || '', exitCode: error.exitCode || 1};
        }
    }

    return tryRunCommand('git', args, {
        cwd: options.cwd || getDataDir(),
        env: options.env
    });
}

export function isDataRepoInitialized(dataDir = getDataDir()) {
    return fs.existsSync(path.join(dataDir, '.git'));
}

export function ensureDataRepo(options = {}) {
    const dataDir = options.dataDir || getDataDir();
    ensureDir(dataDir);
    assertGitAvailable(options);

    if (!isDataRepoInitialized(dataDir)) {
        const initResult = tryGit(['init', '-b', options.defaultBranch || 'main'], {
            ...options,
            cwd: dataDir
        });

        if (!initResult.ok) {
            git(['init'], {...options, cwd: dataDir});
            git(['checkout', '-B', options.defaultBranch || 'main'], {...options, cwd: dataDir});
        }
    }

    git(['config', 'user.name', GIT_USER_NAME], {...options, cwd: dataDir});
    git(['config', 'user.email', GIT_USER_EMAIL], {...options, cwd: dataDir});
    git(['config', 'core.autocrlf', 'false'], {...options, cwd: dataDir});
    return dataDir;
}

export function setRemote(remoteUrl, options = {}) {
    const dataDir = ensureDataRepo(options);
    const existing = tryGit(['remote', 'get-url', 'origin'], {...options, cwd: dataDir});

    if (existing.ok) {
        git(['remote', 'set-url', 'origin', remoteUrl], {...options, cwd: dataDir});
    } else {
        git(['remote', 'add', 'origin', remoteUrl], {...options, cwd: dataDir});
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
    const dataDir = ensureDataRepo(options);
    const remote = getRemote({...options, cwd: dataDir});
    if (!remote) {
        return {status: 'no-remote'};
    }

    const branch = getCurrentBranch({...options, cwd: dataDir});
    const result = tryGit(['pull', '--ff-only', 'origin', branch], {
        ...options,
        cwd: dataDir
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
    const dataDir = ensureDataRepo(options);
    git(['add', '--all'], {...options, cwd: dataDir});

    if (!hasWorktreeChanges({...options, cwd: dataDir})) {
        return {status: 'no-changes', commit: ''};
    }

    git(['commit', '-m', message || 'chore: sync gstore data'], {
        ...options,
        cwd: dataDir
    });
    const commit = git(['rev-parse', '--short', 'HEAD'], {...options, cwd: dataDir}).stdout.trim();
    return {status: 'committed', commit};
}

export function pushDataRepo(options = {}) {
    const dataDir = ensureDataRepo(options);
    const branch = getCurrentBranch({...options, cwd: dataDir});
    git(['push', '-u', 'origin', branch], {
        ...options,
        cwd: dataDir
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
