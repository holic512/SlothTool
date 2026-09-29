#!/usr/bin/env node

/**
 * @file slothvault-mcp.js
 * @project SlothTool
 * @module SlothVault command adapter
 * @description Dispatches the installed Vault Python MCP Client through its isolated environment.
 * @logic Resolve the MCP Client component and forward arguments and terminal streams without exposing credentials.
 * @dependencies Vault MCP Client package, Node child_process
 * @index_tags slothvault,mcp,adapter
 * @author holic512
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {getComponentRoot} from '../lib/runtime-adapter.js';

const root = getComponentRoot('mcp-client');
const entry = path.join(root, 'slothvault_mcp.py');
const python = process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : path.join(root, '.venv', 'bin', 'python');
const child = spawn(python, [entry, ...process.argv.slice(2)], {stdio: 'inherit', env: process.env});
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('close', code => {process.exitCode = code ?? 1;});
