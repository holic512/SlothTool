#!/usr/bin/env node

/**
 * @file slothvault-mcp.js
 * @project SlothTool
 * @module SlothVault command adapter
 * @description Dispatches the installed Vault Python MCP Client through its isolated environment.
 * @logic Show install guidance when the Client is missing; otherwise forward arguments and terminal streams with stable exit codes.
 * @dependencies Vault MCP Client package, Node child_process
 * @index_tags slothvault,mcp,adapter
 * @author holic512
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {getComponentRoot} from '../lib/slothvault-paths.js';
import {t} from '../lib/i18n.js';

const root = getComponentRoot('mcp-client');
const entry = path.join(root, 'slothvault_mcp.py');
const python = process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python');
const args = process.argv.slice(2);
if (!fs.existsSync(entry) || !fs.existsSync(python)) {
    if (!args.length || args.includes('--help') || args.includes('-h')) {
        console.log('SlothVault MCP\n' + t('workspace.mcpInstallGuidance'));
    } else {
        const error = {code: 'SLOTHVAULT_RUNTIME_MISSING', category: 'config', message: t('workspace.mcpInstallGuidance')};
        if (args.includes('--json')) console.log(JSON.stringify({ok: false, error}, null, 2));
        else console.error(error.message);
        process.exitCode = 2;
    }
} else {
    const child = spawn(python, [entry, ...args], {stdio: 'inherit', env: process.env});
    child.on('error', error => {console.error(error.message); process.exitCode = 1;});
    child.on('close', code => {process.exitCode = code === null || code < 0 ? 1 : code;});
}
