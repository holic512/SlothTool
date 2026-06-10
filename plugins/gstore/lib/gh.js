/**
 * @file GStoreGithubCliService
 * @project SlothTool
 * @module GStore Plugin / GitHub CLI
 * @description 封装 GitHub CLI 检测、自动安装、登录、repo 创建和 git 凭据配置。
 * @logic 1. 检测 gh 是否存在；2. 按平台选择包管理器安装命令；3. 用 gh auth 和 repo 命令完成 GitHub 操作且不保存 token。
 * @dependencies Runner: ./command-runner.js
 * @index_tags gstore gh, GitHub CLI, auth login, repo create, 自动安装
 * @author holic512
 */

import {commandExists, runCommand, tryRunCommand} from './command-runner.js';

export function isGhAvailable(options = {}) {
    return commandExists('gh', options);
}

function hasCommand(command, options = {}) {
    return commandExists(command, options);
}

export function resolveGhInstaller(options = {}) {
    const platform = options.platform || process.platform;

    if (platform === 'darwin') {
        if (hasCommand('brew', options)) {
            return {command: 'brew', args: ['install', 'gh'], label: 'Homebrew'};
        }

        if (hasCommand('port', options)) {
            return {command: 'sudo', args: ['port', 'install', 'gh'], label: 'MacPorts'};
        }
    }

    if (platform === 'win32') {
        if (hasCommand('winget', options)) {
            return {command: 'winget', args: ['install', '--id', 'GitHub.cli', '--source', 'winget'], label: 'WinGet'};
        }

        if (hasCommand('choco', options)) {
            return {command: 'choco', args: ['install', 'gh', '-y'], label: 'Chocolatey'};
        }

        if (hasCommand('scoop', options)) {
            return {command: 'scoop', args: ['install', 'gh'], label: 'Scoop'};
        }
    }

    if (platform === 'linux') {
        if (hasCommand('brew', options)) {
            return {command: 'brew', args: ['install', 'gh'], label: 'Homebrew'};
        }

        if (hasCommand('apt-get', options)) {
            return {
                command: 'sh',
                args: [
                    '-lc',
                    '(type -p wget >/dev/null || (sudo apt-get update && sudo apt-get install wget -y)) && sudo mkdir -p -m 755 /etc/apt/keyrings && out=$(mktemp) && wget -nv -O"$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg && cat "$out" | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && sudo mkdir -p -m 755 /etc/apt/sources.list.d && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null && sudo apt-get update && sudo apt-get install gh -y'
                ],
                label: 'APT official repository'
            };
        }

        if (hasCommand('dnf', options)) {
            return {command: 'sudo', args: ['dnf', 'install', 'gh', '-y'], label: 'DNF'};
        }

        if (hasCommand('yum', options)) {
            return {command: 'sudo', args: ['yum', 'install', 'gh', '-y'], label: 'YUM'};
        }

        if (hasCommand('zypper', options)) {
            return {command: 'sudo', args: ['zypper', 'install', '-y', 'gh'], label: 'Zypper'};
        }

        if (hasCommand('pacman', options)) {
            return {command: 'sudo', args: ['pacman', '-S', '--noconfirm', 'github-cli'], label: 'pacman'};
        }

        if (hasCommand('apk', options)) {
            return {command: 'sudo', args: ['apk', 'add', 'github-cli'], label: 'apk'};
        }
    }

    return null;
}

export function installGh(options = {}) {
    const installer = resolveGhInstaller(options);
    if (!installer) {
        throw new Error('No supported GitHub CLI installer was found on this system.');
    }

    (options.runner || runCommand)(installer.command, installer.args, {
        stdio: options.stdio || 'inherit',
        env: options.env
    });

    return installer;
}

export function ensureGhInstalled(options = {}) {
    if (isGhAvailable(options)) {
        return {status: 'available'};
    }

    const installer = installGh(options);
    return {status: 'installed', installer};
}

export function getAuthStatus(options = {}) {
    const result = tryRunCommand('gh', ['auth', 'status', '--active'], options);
    return {
        authenticated: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
        reason: result.ok ? '' : result.error.message
    };
}

export function ensureGithubAuth(options = {}) {
    ensureGhInstalled(options);
    const currentStatus = getAuthStatus(options);

    if (!currentStatus.authenticated) {
        (options.runner || runCommand)('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
            stdio: options.stdio || 'inherit',
            env: options.env
        });
    }

    (options.runner || runCommand)('gh', ['auth', 'setup-git'], {
        env: options.env
    });

    return getAuthStatus(options);
}

export function createPrivateRepo(repository, options = {}) {
    (options.runner || runCommand)('gh', ['repo', 'create', repository, '--private'], {
        stdio: options.stdio || 'inherit',
        env: options.env
    });

    return repository;
}

export default {
    createPrivateRepo,
    ensureGhInstalled,
    ensureGithubAuth,
    getAuthStatus,
    installGh,
    isGhAvailable,
    resolveGhInstaller
};
