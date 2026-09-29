/**
 * @file setup-cli.js
 * @project SlothTool
 * @module SlothVault Setup CLI
 * @description Forwards the connection setup flow to the installed Vault runtime.
 * @logic Reject raw command-line Keys, run Vault setup with inherited streams, and preserve its exit status.
 * @dependencies Vault runtime adapter, Node child_process
 * @index_tags setup,cli,url,key
 * @author holic512
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {getRuntimeRoot} from './runtime-adapter.js';
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
    const entry = path.join(getRuntimeRoot(), 'bin', options.managed ? 'slothvault-runtime.js' : 'slothvault-mcp.js');
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [entry, 'setup', ...args], {stdio: 'inherit', env: process.env});
        child.on('error', reject);
        child.on('close', code => {process.exitCode = code ?? 1; resolve();});
    });
}
