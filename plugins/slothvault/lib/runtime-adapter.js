/**
 * @file runtime-adapter.js
 * @project SlothTool
 * @module SlothVault UI adapter
 * @description Calls the Vault-owned Python MCP Client and manages local Skill and command links.
 * @logic Resolve the active component, pass secrets only on stdin, parse JSON results, and keep local management in SlothTool.
 * @dependencies Node child_process, Vault MCP Client package, local Skill and command managers
 * @index_tags slothvault,adapter,client,skill,profile
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {spawn, spawnSync} from 'node:child_process';
import {getSkillStatus as inspectSkill, installSkill as linkSkill, uninstallSkill as unlinkSkill} from './skill-manager.js';
import {getMcpCommandStatus as inspectCommand, registerMcpCommand as linkCommand, unregisterMcpCommand as unlinkCommand} from './mcp-command-manager.js';

export function getComponentRoot(module, options = {}) {
    return path.resolve(options.runtimeRoot || process.env[`SLOTHTOOL_SLOTHVAULT_${module.toUpperCase().replace('-', '_')}_ROOT`] ||
        path.join(options.homeDir || os.homedir(), '.pipker', 'slothtool', 'runtimes', 'slothvault', 'components', module, 'current'));
}

export function getRuntimeRoot(options = {}) {
    return getComponentRoot('mcp-client', options);
}

export function getComponentVersion(module, options = {}) {
    try {
        const meta = JSON.parse(fs.readFileSync(path.join(getComponentRoot(module, options), 'module.json'), 'utf8'));
        return meta.module === module ? meta.version : null;
    } catch { return null; }
}

function entry(options = {}) {
    const root = getComponentRoot('mcp-client', options);
    const script = path.join(root, 'slothvault_mcp.py');
    const python = process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python');
    if (!fs.existsSync(script) || !fs.existsSync(python)) throw Object.assign(new Error('SlothVault MCP Client is not installed. Run slothtool update slothvault.'), {code: 'SLOTHVAULT_RUNTIME_MISSING'});
    return {python, script};
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
    const {python, script} = entry(options);
    const result = spawnSync(python, [script, ...args], {
        input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, env: process.env
    });
    if (result.error) throw result.error;
    return decode(result.stdout, result.status);
}

export function runRuntime(kind, args, {input = '', ...options} = {}) {
    return new Promise((resolve, reject) => {
        let command;
        try { command = entry(options); } catch (error) {reject(error); return;}
        const child = spawn(command.python, [command.script, ...args], {stdio: ['pipe', 'pipe', 'pipe'], env: process.env});
        let stdout = '';
        child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 4 * 1024 * 1024) child.kill(); });
        child.stderr.resume();
        child.on('error', reject);
        child.on('close', code => { try { resolve(decode(stdout, code)); } catch (error) { reject(error); } });
        child.stdin.end(input);
    });
}

export const getConfigSummary = () => {
    try { return runRuntimeSync('mcp', ['config', '--json']); }
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
export const inspectServer = () => runRuntime('mcp', ['discovery', '--json']);

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
export const setupConnection = async (input, options = {}) => {
    const result = await runRuntime('mcp', ['setup', '--url', input.endpoint, '--key-stdin', '--json'], {input: input.apiKey});
    if (!options.managed) return result;
    const managed = {};
    try { managed.skill = linkSkill({skipConflicts: true}); }
    catch (error) { managed.skill = {state: 'error', code: error.code || 'SKILL_INSTALL_FAILED', agents: []}; }
    try { managed.command = linkCommand(); }
    catch (error) { managed.command = {state: 'unavailable', code: error.code || 'MCP_COMMAND_REGISTER_FAILED'}; }
    return {...result, managed};
};

export const getSkillStatus = () => {
    try { return inspectSkill(); }
    catch (error) { if (error.code === 'SKILL_SOURCE_INVALID') return {state: 'unavailable', agents: [], version: null}; throw error; }
};
export const installSkill = ({replace = false} = {}) => linkSkill({replace});
export const uninstallSkill = () => unlinkSkill({skipConflicts: true});
export const getMcpCommandStatus = () => inspectCommand();
export const registerMcpCommand = ({replace = false} = {}) => linkCommand({replace});
export const unregisterMcpCommand = () => unlinkCommand();

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
    const result = await manager(['update', 'slothvault', '--module', 'skill', '--check']);
    return {...getSkillStatus(), checkState: result.status === 'error' ? 'unavailable' : 'checked', updateStatus: result.status, latestVersion: result.latestVersion || null,
        pluginUpdateAvailable: result.status === 'outdated'};
}
export async function updateSkill({local = false} = {}) {
    if (!local) await manager(['update', 'slothvault', '--module', 'skill']);
    else installSkill();
    return {...getSkillStatus(), checkState: 'checked', updateStatus: 'updated'};
}

export async function checkMcpClientUpdate() { return manager(['update', 'slothvault', '--module', 'mcp-client', '--check']); }
export async function updateMcpClient() { return manager(['update', 'slothvault', '--module', 'mcp-client']); }
export async function checkDeploymentPackageUpdate() { return manager(['update', 'slothvault', '--module', 'deployment', '--check']); }
export async function updateDeploymentPackage() { return manager(['update', 'slothvault', '--module', 'deployment']); }
