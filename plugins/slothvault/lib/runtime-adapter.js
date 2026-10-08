/**
 * @file runtime-adapter.js
 * @project SlothTool
 * @module SlothVault UI adapter
 * @description Adapts MCP profile and discovery commands to the independent Python client.
 * @logic Resolve the MCP entry, pass secrets on stdin and decode JSON; component lifecycle and local links remain separate services.
 * @dependencies Node child_process, Vault MCP Client package, local Skill and command managers
 * @index_tags slothvault,adapter,client,skill,profile
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {spawn, spawnSync} from 'node:child_process';
import {getComponentRoot, getComponentVersion} from './slothvault-paths.js';
export {getComponentRoot, getComponentVersion};
export const getRuntimeRoot = options => getComponentRoot('mcp-client', options);

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
    return result;
};

// Compatibility exports; services and pages import their own domain directly.
export {getSkillStatus, installSkill, uninstallSkill, checkSkillUpdate, updateSkill} from './skill-service.js';
export {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from './mcp-command-manager.js';
export {checkMcpClientUpdate, updateMcpClient, checkDeploymentPackageUpdate, updateDeploymentPackage} from './package-service.js';
