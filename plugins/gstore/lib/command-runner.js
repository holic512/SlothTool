/**
 * @file GStoreCommandRunner
 * @project SlothTool
 * @module GStore Plugin / Process
 * @description 封装 git、gh 和包管理器子进程调用，统一返回 stdout、stderr、退出码和错误分类输入。
 * @logic 1. 通过 spawnSync 执行命令；2. 支持继承 stdio 的交互命令；3. 将失败命令转换为带输出上下文的异常。
 * @dependencies Node: child_process
 * @index_tags gstore命令执行, git子进程, gh子进程, spawnSync
 * @author holic512
 */

import {spawnSync} from 'node:child_process';
import {getCommandEnv} from './config.js';

export function createCommandError(command, args, result) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    const reason = stderr || stdout || result.error?.message || `command exited with code ${result.status}`;
    const error = new Error(reason);
    error.command = command;
    error.args = args;
    error.exitCode = result.status ?? 1;
    error.stdout = stdout;
    error.stderr = stderr;
    return error;
}

export function runCommand(command, args = [], options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd,
        input: options.input,
        encoding: options.encoding || 'utf8',
        stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
        env: {
            ...getCommandEnv(options.env),
            ...options.env
        },
        shell: options.shell === true,
        maxBuffer: 10 * 1024 * 1024
    });

    if (result.error || result.status !== 0) {
        throw createCommandError(command, args, result);
    }

    return {
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        exitCode: result.status || 0
    };
}

export function tryRunCommand(command, args = [], options = {}) {
    try {
        return {
            ok: true,
            ...runCommand(command, args, options)
        };
    } catch (error) {
        return {
            ok: false,
            error,
            stdout: error.stdout || '',
            stderr: error.stderr || '',
            exitCode: error.exitCode || 1
        };
    }
}

export function commandExists(command, options = {}) {
    if (typeof options.commandExists === 'function') {
        return options.commandExists(command);
    }

    const probeArgs = process.platform === 'win32'
        ? ['/d', '/s', '/c', `where ${command}`]
        : ['-lc', `command -v ${command}`];
    const probeCommand = process.platform === 'win32' ? 'cmd.exe' : 'sh';
    const result = tryRunCommand(probeCommand, probeArgs, options);
    return result.ok;
}

export default {
    commandExists,
    runCommand,
    tryRunCommand
};
