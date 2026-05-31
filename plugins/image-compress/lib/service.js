/**
 * @file ImageCompressService
 * @project SlothTool
 * @module Image Compress Plugin / Services
 * @description 负责把 Node CLI/TUI 请求包装成 Go 后端调用，并提供拖拽路径解析与结果格式化辅助。
 * @logic 1. 将结构化请求映射为 Go CLI 参数；2. 以受控环境运行 go run 并收集 stdout/stderr；3. 解析拖拽文本中的多路径与 shell 转义。
 * @dependencies Node: child_process/fs/os/path/url
 * @index_tags 图片压缩服务, go后端调用, 路径解析, CLI包装, JSON结果
 * @author holic512
 */

import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(currentFilePath), '..');
const backendDir = path.join(pluginRoot, 'backend');
const goCacheDir = path.join(os.tmpdir(), 'slothtool-image-compress-go-cache');
const defaultGoPath = process.env.GOPATH || path.join(os.userInfo().homedir, 'go');
const defaultGoModCache = process.env.GOMODCACHE || path.join(defaultGoPath, 'pkg', 'mod');

export function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function getPluginRoot() {
    return pluginRoot;
}

export function getBackendDir() {
    return backendDir;
}

export function getBundledBinaryName(platform = process.platform) {
    return platform === 'win32' ? 'image-compress-backend.exe' : 'image-compress-backend';
}

export function getBundledBinaryPath(options = {}) {
    return path.join(
        options.pluginRoot || pluginRoot,
        'backend',
        'dist',
        getBundledBinaryName(options.platform)
    );
}

export function resolveBackendCommand(options = {}) {
    const environment = options.env || process.env;
    const configuredBinary = environment.SLOTHTOOL_IMAGE_COMPRESS_BACKEND_BIN?.trim();
    if (configuredBinary) {
        return {
            mode: 'configured-binary',
            command: configuredBinary,
            args: [],
            cwd: options.cwd || pluginRoot
        };
    }

    const bundledBinaryPath = getBundledBinaryPath(options);
    if (fs.existsSync(bundledBinaryPath)) {
        return {
            mode: 'bundled-binary',
            command: bundledBinaryPath,
            args: [],
            cwd: options.cwd || pluginRoot
        };
    }

    const backendWorkingDir = options.backendDir || backendDir;
    if (fs.existsSync(path.join(backendWorkingDir, 'go.mod'))) {
        return {
            mode: 'go-run',
            command: 'go',
            args: ['run', './cmd/image-compress'],
            cwd: backendWorkingDir
        };
    }

    throw new Error(
        'No bundled backend binary was found, and the Go backend source is unavailable.'
    );
}

export function createBackendArgs(request = {}, options = {}) {
    const args = [];

    if (request.recursive) {
        args.push('--recursive');
    }
    if (request.outputDir) {
        args.push('--output-dir', request.outputDir);
    }
    if (request.overwrite) {
        args.push('--overwrite');
    }
    if (request.allowLarger) {
        args.push('--allow-larger');
    }
    if (Number.isInteger(request.quality) && request.quality > 0) {
        args.push('--quality', String(request.quality));
    }
    if (Number.isInteger(request.maxWidth) && request.maxWidth > 0) {
        args.push('--max-width', String(request.maxWidth));
    }
    if (Number.isInteger(request.maxHeight) && request.maxHeight > 0) {
        args.push('--max-height', String(request.maxHeight));
    }
    if (Number.isInteger(request.concurrency) && request.concurrency > 0) {
        args.push('--concurrency', String(request.concurrency));
    }
    if (request.dryRun) {
        args.push('--dry-run');
    }
    if (options.json) {
        args.push('--json');
    }
    if (options.quiet) {
        args.push('--quiet');
    }

    for (const inputPath of request.inputPaths || []) {
        if (typeof inputPath === 'string' && inputPath.trim()) {
            args.push(inputPath.trim());
        }
    }

    return args;
}

export async function runBackendCli(args = [], options = {}) {
    return runGoCommand(args, options);
}

export async function runCompressionRequest(request, options = {}) {
    const result = await runGoCommand(createBackendArgs(request, {
        json: true,
        quiet: true
    }), options);

    let summary = null;
    const trimmedStdout = result.stdout.trim();
    if (trimmedStdout) {
        try {
            summary = JSON.parse(trimmedStdout);
        } catch (error) {
            throw new Error(`failed to decode backend JSON: ${error.message}`);
        }
    }

    return {
        ...result,
        summary
    };
}

export function parseDroppedPaths(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return [];
    }

    const tokens = [];
    let current = '';
    let quote = null;
    let escaping = false;

    for (const character of text.trim()) {
        if (escaping) {
            current += character;
            escaping = false;
            continue;
        }

        if (character === '\\') {
            escaping = true;
            continue;
        }

        if (quote) {
            if (character === quote) {
                quote = null;
                continue;
            }
            current += character;
            continue;
        }

        if (character === '"' || character === '\'') {
            quote = character;
            continue;
        }

        if (/\s/u.test(character)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += character;
    }

    if (current) {
        tokens.push(current);
    }

    return dedupePaths(tokens.map(normalizeDroppedToken).filter(Boolean));
}

export function dedupePaths(paths) {
    const orderedPaths = [];
    const seen = new Set();

    for (const currentPath of paths) {
        const normalizedPath = path.normalize(currentPath);
        if (!seen.has(normalizedPath)) {
            seen.add(normalizedPath);
            orderedPaths.push(normalizedPath);
        }
    }

    return orderedPaths;
}

export function formatSummaryLine(summary = {}) {
    return `success=${summary.SuccessCount || 0} skipped=${summary.SkippedCount || 0} failed=${summary.FailedCount || 0} saved=${summary.SavedBytes || 0}`;
}

async function runGoCommand(args, options = {}) {
    const backendCommand = resolveBackendCommand({
        env: options.env,
        platform: options.platform,
        pluginRoot: options.pluginRoot,
        backendDir: options.backendDir
    });

    if (backendCommand.mode === 'go-run') {
        fs.mkdirSync(goCacheDir, {recursive: true});
    }

    return new Promise((resolve, reject) => {
        const child = spawn(backendCommand.command, [...backendCommand.args, ...args], {
            cwd: backendCommand.cwd,
            env: buildBackendEnvironment(backendCommand.mode, options.env),
            signal: options.signal,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', chunk => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });

        child.on('error', error => {
            reject(error);
        });
        child.on('close', code => {
            resolve({
                stdout,
                stderr,
                exitCode: code ?? 1
            });
        });
    });
}

function buildBackendEnvironment(mode, extraEnv = {}) {
    const environment = {
        ...process.env,
        ...extraEnv
    };

    if (mode === 'go-run') {
        environment.GOCACHE = environment.GOCACHE || goCacheDir;
        environment.GOPATH = environment.GOPATH || defaultGoPath;
        environment.GOMODCACHE = environment.GOMODCACHE || defaultGoModCache;
    }

    return environment;
}

function normalizeDroppedToken(token) {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
        return '';
    }

    if (trimmedToken.startsWith('file://')) {
        try {
            return fileURLToPath(trimmedToken);
        } catch {
            try {
                return fileURLToPath(pathToFileURL(trimmedToken));
            } catch {
                return trimmedToken;
            }
        }
    }

    return trimmedToken;
}
