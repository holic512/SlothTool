/**
 * @file setup-cli.js
 * @project SlothTool
 * @module SlothVault Setup CLI
 * @description Runs Python MCP setup and then manages local SlothTool links.
 * @logic Reject raw command-line Keys, pass setup through inherited streams, and link only verified managed targets.
 * @dependencies Vault MCP Client, SlothTool Skill and command managers, Node child_process
 * @index_tags setup,cli,url,key
 * @author holic512
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {getComponentRoot} from './runtime-adapter.js';
import {installSkill} from './skill-manager.js';
import {registerMcpCommand} from './mcp-command-manager.js';
import {t, formatSlothVaultError} from './i18n.js';

export function setupResultText(result) {
    const lines = [result.connected ? t('setup.connected', {url: result.profile.endpoint})
        : t('setup.savedOffline', {message: formatSlothVaultError(result.error)})];
    if (result.managed?.command?.state !== undefined && result.managed.command.state !== 'registered') lines.push(t('setup.commandPending', {state: result.managed.command.state}));
    const conflicts = result.managed?.skill?.agents?.filter(agent => agent.detected && agent.state === 'conflict') || [];
    if (conflicts.length) lines.push(t('setup.skillConflict', {targets: conflicts.map(agent => agent.name).join(', ')}));
    if (result.managed?.skill?.state === 'error') lines.push(t('setup.skillPending'));
    return lines.join('\n');
}
export async function runSetupCli(args, options = {}) {
    if (args.some(arg => arg === '--key' || arg.startsWith('--key='))) throw Object.assign(new Error(t('directKeyUnsupported')), {code: 'USAGE_ERROR', exitCode: 2});
    const root = getComponentRoot('mcp-client');
    const entry = path.join(root, 'slothvault_mcp.py');
    const python = process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python');
    let status = 1;
    await new Promise((resolve, reject) => {
        const child = spawn(python, [entry, 'setup', ...args], {stdio: 'inherit', env: process.env});
        child.on('error', reject);
        child.on('close', code => {status = code ?? 1; process.exitCode = status; resolve();});
    });
    if (options.managed && [0, 4].includes(status)) {
        try { installSkill({skipConflicts: true}); }
        catch (error) { if (error.code !== 'SKILL_AGENT_NOT_DETECTED') console.error(t('setup.skillPending')); }
        try { registerMcpCommand(); }
        catch { console.error(t('setup.commandPending', {state: 'unavailable'})); }
    }
}
