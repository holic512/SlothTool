/**
 * @file GStoreGithubCliService
 * @project SlothTool
 * @module GStore Plugin / GitHub CLI
 * @description 封装 GitHub CLI 检测、自动安装、手动设备登录、repo 创建和 git 凭据配置。
 * @logic 1. 检测 gh 是否存在；2. 按平台选择包管理器安装命令；3. 通过 device code 手动授权并阻止自动唤起浏览器；4. 调用 gh repo 与 auth setup-git。
 * @dependencies Node: child_process, Runner: ./command-runner.js, I18N: ./i18n.js
 * @index_tags gstore gh, GitHub CLI, auth login, repo create, 自动安装
 * @author holic512
 */

import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {commandExists, runCommand, tryRunCommand} from './command-runner.js';
import {t} from './i18n.js';

const DEVICE_LOGIN_URL = 'https://github.com/login/device';
const NOOP_BROWSER_DIR = 'slothtool-gstore';

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

export function parseDeviceLoginOutput(output) {
    const codeMatch = String(output).match(/\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/u);
    const urlMatch = String(output).match(/https:\/\/github\.com\/login\/device/u);

    return {
        code: codeMatch ? codeMatch[1] : '',
        url: urlMatch ? urlMatch[0] : DEVICE_LOGIN_URL
    };
}

export function resolveNoopBrowserCommand(options = {}) {
    if (options.noopBrowserCommand) {
        return options.noopBrowserCommand;
    }

    const platform = options.platform || process.platform;
    const dir = path.join(os.tmpdir(), NOOP_BROWSER_DIR);
    fs.mkdirSync(dir, {recursive: true});

    if (platform === 'win32') {
        const commandPath = path.join(dir, 'noop-browser.cmd');
        if (!fs.existsSync(commandPath)) {
            fs.writeFileSync(commandPath, '@echo off\r\nexit /b 0\r\n');
        }
        return commandPath;
    }

    const commandPath = path.join(dir, 'noop-browser.sh');
    if (!fs.existsSync(commandPath)) {
        fs.writeFileSync(commandPath, '#!/bin/sh\nexit 0\n');
    }
    fs.chmodSync(commandPath, 0o755);
    return commandPath;
}

function buildManualAuthEnv(options = {}) {
    return {
        ...process.env,
        ...options.env,
        GH_BROWSER: resolveNoopBrowserCommand(options)
    };
}

export function isReliableAuthTerminal(options = {}) {
    if (typeof options.reliableTerminal === 'boolean') {
        return options.reliableTerminal;
    }

    if (process.env.SLOTHTOOL_GSTORE_MANUAL_AUTH === '1') {
        return false;
    }

    return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

function runManualDeviceLogin(options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
            env: buildManualAuthEnv(options),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        let output = '';
        let prompted = false;
        let continued = false;

        function maybePrintManualPrompt() {
            if (prompted) {
                return;
            }

            const login = parseDeviceLoginOutput(output);
            if (!login.code && !/Press Enter/iu.test(output)) {
                return;
            }

            prompted = true;
            if (options.onManualLogin) {
                options.onManualLogin(login);
            }

            if (options.silent) {
                return;
            }

            if (login.code) {
                console.error(t('manualDeviceLogin', login));
            } else {
                console.error(t('manualDeviceLoginNoCode'));
            }
        }

        function maybeContinue() {
            if (continued || !/Press Enter/iu.test(output)) {
                return;
            }

            continued = true;
            maybePrintManualPrompt();
            child.stdin.write('\n');
        }

        child.stdout.on('data', chunk => {
            const text = String(chunk);
            output += text;
            if (!options.silent) {
                process.stderr.write(text);
            }
            maybePrintManualPrompt();
            maybeContinue();
        });

        child.stderr.on('data', chunk => {
            const text = String(chunk);
            output += text;
            if (!options.silent) {
                process.stderr.write(text);
            }
            maybePrintManualPrompt();
            maybeContinue();
        });

        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) {
                resolve({stdout: output, stderr: '', exitCode: 0});
                return;
            }

            const error = new Error(output.trim() || `gh auth login exited with code ${code}`);
            error.exitCode = code || 1;
            error.stderr = output;
            reject(error);
        });
    });
}

export async function ensureGithubAuth(options = {}) {
    ensureGhInstalled(options);
    const currentStatus = getAuthStatus(options);

    if (!currentStatus.authenticated) {
        if (options.manualAuth !== false && !options.runner) {
            await runManualDeviceLogin(options);
        } else {
            (options.runner || runCommand)('gh', ['auth', 'login', '--git-protocol', 'https', '--web'], {
                stdio: options.stdio || 'inherit',
                env: options.env
            });
        }
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
    isReliableAuthTerminal,
    isGhAvailable,
    parseDeviceLoginOutput,
    resolveNoopBrowserCommand,
    resolveGhInstaller
};
