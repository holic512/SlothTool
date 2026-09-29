/**
 * @file runtime-adapter.js
 * @project SlothTool
 * @module SlothVault UI adapter
 * @description Calls the Vault-owned runtime through its versioned JSON command interface.
 * @logic Resolve the active runtime, pass secrets only on stdin, parse one JSON result, and translate failures for the existing UI.
 * @dependencies Node child_process, Vault slothvault-runtime and slothvault-mcp commands
 * @index_tags slothvault,adapter,client,skill,profile
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {spawn, spawnSync} from 'node:child_process';

export function getRuntimeRoot(options = {}) {
    return path.resolve(options.runtimeRoot || process.env.SLOTHTOOL_SLOTHVAULT_RUNTIME_ROOT ||
        path.join(options.homeDir || os.homedir(), '.pipker', 'slothtool', 'runtimes', 'slothvault', 'current'));
}

function entry(kind, options = {}) {
    const result = path.join(getRuntimeRoot(options), 'bin', kind === 'control' ? 'slothvault-runtime.js' : 'slothvault-mcp.js');
    if (!fs.existsSync(result)) throw Object.assign(new Error('SlothVault runtime is not installed. Run slothtool update slothvault.'), {code: 'SLOTHVAULT_RUNTIME_MISSING'});
    return result;
}

function decode(stdout, code) {
    let result;
    try { result = JSON.parse(String(stdout).trim()); }
    catch { throw Object.assign(new Error('Invalid SlothVault runtime JSON response.'), {code: 'SLOTHVAULT_RUNTIME_PROTOCOL'}); }
    if (result?.ok === false || (code !== 0 && !result?.saved)) {
        const detail = result?.error || {};
        throw Object.assign(new Error(detail.message || 'SlothVault runtime command failed.'), {code: detail.code || 'SLOTHVAULT_RUNTIME_FAILED', category: detail.category});
    }
    return result;
}

export function runRuntimeSync(kind, args, {input = '', ...options} = {}) {
    const result = spawnSync(process.execPath, [entry(kind, options), ...args], {
        input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, env: process.env
    });
    if (result.error) throw result.error;
    return decode(result.stdout, result.status);
}

export function runRuntime(kind, args, {input = '', ...options} = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [entry(kind, options), ...args], {stdio: ['pipe', 'pipe', 'pipe'], env: process.env});
        let stdout = '';
        child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 4 * 1024 * 1024) child.kill(); });
        child.stderr.resume();
        child.on('error', reject);
        child.on('close', code => { try { resolve(decode(stdout, code)); } catch (error) { reject(error); } });
        child.stdin.end(input);
    });
}

export const getConfigSummary = () => {
    try { return runRuntimeSync('control', ['config', '--json']); }
    catch (error) {
        if (error.code !== 'SLOTHVAULT_RUNTIME_MISSING') throw error;
        return {schemaVersion: 1, defaultProfile: null, configPath: null, profiles: []};
    }
};
export const listHistory = ({limit} = {}) => {
    let result;
    try { result = runRuntimeSync('mcp', ['history', 'list', '--json']); }
    catch (error) { if (error.code === 'SLOTHVAULT_RUNTIME_MISSING') return []; throw error; }
    return limit ? result.slice(0, limit) : result;
};
export const inspectServer = () => runRuntime('control', ['discovery', '--json']);

function profileArgs(input = {}) {
    const args = [];
    if (input.endpoint) args.push('--url', input.endpoint);
    if (input.timeoutMs !== undefined) args.push('--timeout', String(input.timeoutMs));
    if (input.makeDefault) args.push('--default');
    if (input.apiKey) args.push('--key-stdin');
    return args;
}
export const addProfile = (name, input) => runRuntimeSync('mcp', ['profile', 'add', name, ...profileArgs(input), '--json'], {input: input.apiKey || ''});
export const updateProfile = (name, input) => runRuntimeSync('mcp', ['profile', 'update', name, ...profileArgs(input), '--json'], {input: input.apiKey || ''});
export const removeProfile = name => runRuntimeSync('mcp', ['profile', 'remove', name, '--json']);
export const useProfile = name => runRuntimeSync('mcp', ['profile', 'use', name, '--json']);
export const setupConnection = (input, options = {}) => runRuntime(options.managed ? 'control' : 'mcp',
    ['setup', '--url', input.endpoint, '--key-stdin', '--json'], {input: input.apiKey});

export const getSkillStatus = () => {
    try { return runRuntimeSync('control', ['skill', 'status', '--json']); }
    catch (error) { if (error.code === 'SLOTHVAULT_RUNTIME_MISSING') return {state: 'unavailable', agents: [], version: null}; throw error; }
};
export const installSkill = ({replace = false} = {}) => runRuntimeSync('control', ['skill', 'install', ...(replace ? ['--replace'] : []), '--json']);
export const uninstallSkill = () => runRuntimeSync('control', ['skill', 'uninstall', '--json']);
export const getMcpCommandStatus = () => {
    try { return runRuntimeSync('control', ['mcp', 'status', '--json']); }
    catch (error) { if (error.code === 'SLOTHVAULT_RUNTIME_MISSING') return {state: 'unavailable'}; throw error; }
};
export const registerMcpCommand = ({replace = false} = {}) => runRuntimeSync('control', ['mcp', 'register', ...(replace ? ['--replace'] : []), '--json']);
export const unregisterMcpCommand = () => runRuntimeSync('control', ['mcp', 'unregister', '--json']);

async function manager(args) {
    const entryPath = process.env.SLOTHTOOL_ENTRY_PATH;
    if (!entryPath || process.env.SLOTHTOOL_COMMAND_PATH_VERIFIED !== '1') throw new Error('Run through an installed SlothTool command.');
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [entryPath, ...args, '--json'], {stdio: ['ignore', 'pipe', 'pipe'], env: process.env});
        let output = '';
        child.stdout.on('data', chunk => {output += chunk;});
        child.stderr.resume();
        child.on('error', reject);
        child.on('close', code => {try {resolve(decode(output, code));} catch (error) {reject(error);}});
    });
}
export async function checkSkillUpdate() {
    const result = await manager(['update', 'slothvault', '--check']);
    return {...getSkillStatus(), checkState: 'checked', latestVersion: result.runtime?.latestSkillVersion || null,
        latestPluginVersion: result.runtime?.latestVersion || null, pluginUpdateAvailable: result.runtime?.status === 'outdated'};
}
export async function updateSkill({local = false} = {}) {
    if (local) return runRuntime('control', ['skill', 'update', '--json']);
    await manager(['update', 'slothvault']);
    return {...getSkillStatus(), checkState: 'checked'};
}
