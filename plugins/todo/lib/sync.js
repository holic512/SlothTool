/**
 * @file TodoGStoreBridge
 * @project SlothTool
 * @module Todo Plugin / Sync
 * @description 通过已安装的 gstore 命令桥接 todo/default 数据绑定的状态、pull、push、sync 和冲突检测。
 * @logic 1. 从环境变量、SlothTool registry 或 PATH 查找 gstore；2. 校验 todo/default 绑定；3. 委托 gstore 子命令执行同步并返回结构化结果。
 * @dependencies Node: child_process/fs/os/path, Storage: ./storage.js
 * @index_tags todo同步, gstore桥接, 手动同步, 冲突检测
 * @author holic512
 */

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ensureTodoStorage, getTodoDataDir} from './storage.js';

export class TodoSyncError extends Error {
    constructor(message, code = 'TODO_SYNC_ERROR', details = {}) {
        super(message);
        this.name = 'TodoSyncError';
        this.code = code;
        this.details = details;
    }
}

function getRegistryPath() {
    return path.join(os.homedir(), '.slothtool', 'registry.json');
}

function readRegistry() {
    try {
        if (fs.existsSync(getRegistryPath())) {
            return JSON.parse(fs.readFileSync(getRegistryPath(), 'utf8'));
        }
    } catch {
        return {plugins: {}};
    }

    return {plugins: {}};
}

function isExecutableFile(filePath) {
    try {
        return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function findInPath(command) {
    const pathValue = process.env.PATH || '';
    const extensions = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];

    for (const dirPath of pathValue.split(path.delimiter).filter(Boolean)) {
        for (const extension of extensions) {
            const candidate = path.join(dirPath, `${command}${extension}`);
            if (isExecutableFile(candidate)) {
                return candidate;
            }
        }
    }

    return '';
}

export function resolveGStoreInvocation(env = process.env) {
    const envBin = env.SLOTHTOOL_GSTORE_BIN;
    if (envBin) {
        return {
            command: envBin.endsWith('.js') ? process.execPath : envBin,
            argsPrefix: envBin.endsWith('.js') ? [envBin] : [],
            source: 'env',
            binPath: envBin
        };
    }

    const registryBin = readRegistry().plugins?.gstore?.binPath;
    if (registryBin && isExecutableFile(registryBin)) {
        return {
            command: registryBin.endsWith('.js') ? process.execPath : registryBin,
            argsPrefix: registryBin.endsWith('.js') ? [registryBin] : [],
            source: 'registry',
            binPath: registryBin
        };
    }

    const pathBin = findInPath('gstore');
    if (pathBin) {
        return {
            command: pathBin,
            argsPrefix: [],
            source: 'path',
            binPath: pathBin
        };
    }

    return null;
}

function runInvocation(invocation, args) {
    try {
        return execFileSync(invocation.command, [...invocation.argsPrefix, ...args], {
            encoding: 'utf8',
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (error) {
        const stderr = String(error.stderr || '').trim();
        const stdout = String(error.stdout || '').trim();
        throw new TodoSyncError(stderr || stdout || error.message, 'TODO_GSTORE_FAILED', {
            stderr,
            stdout,
            status: error.status
        });
    }
}

function parseJsonOutput(output, fallback = null) {
    try {
        return JSON.parse(output);
    } catch {
        return fallback;
    }
}

export function getGStoreDoctor() {
    const invocation = resolveGStoreInvocation();
    const dataDir = getTodoDataDir();

    if (!invocation) {
        return {
            available: false,
            bound: false,
            source: '',
            binPath: '',
            dataDir,
            hint: `Install gstore and run: gstore bind todo default ${dataDir}`
        };
    }

    const bindings = parseJsonOutput(runInvocation(invocation, ['list', '--json']), []);
    const binding = Array.isArray(bindings)
        ? bindings.find(item => item.tool === 'todo' && item.name === 'default')
        : null;

    return {
        available: true,
        bound: Boolean(binding),
        binding: binding || null,
        source: invocation.source,
        binPath: invocation.binPath,
        dataDir,
        hint: binding ? '' : `Run: gstore bind todo default ${dataDir}`
    };
}

export function ensureGStoreBinding() {
    ensureTodoStorage();
    const doctor = getGStoreDoctor();

    if (!doctor.available) {
        throw new TodoSyncError(
            `gstore is not installed or not in PATH. Run: slothtool install gstore`,
            'TODO_GSTORE_MISSING',
            doctor
        );
    }

    if (!doctor.bound) {
        throw new TodoSyncError(
            `todo/default is not bound in gstore. Run: gstore bind todo default ${doctor.dataDir}`,
            'TODO_GSTORE_UNBOUND',
            doctor
        );
    }

    return doctor;
}

export function runGStoreAction(action) {
    ensureGStoreBinding();
    const invocation = resolveGStoreInvocation();
    const output = runInvocation(invocation, [action, 'todo', 'default', '--json']);

    return {
        action,
        output,
        json: parseJsonOutput(output, null)
    };
}

export default {
    ensureGStoreBinding,
    getGStoreDoctor,
    resolveGStoreInvocation,
    runGStoreAction
};
