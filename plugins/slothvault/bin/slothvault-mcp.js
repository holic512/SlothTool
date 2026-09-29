#!/usr/bin/env node

/**
 * @file slothvault-mcp.js
 * @project SlothTool
 * @module SlothVault command adapter
 * @description Preserves the legacy plugin executable while delegating MCP behavior to the Vault runtime.
 * @logic Resolve the installed runtime command and forward arguments and terminal streams.
 * @dependencies Vault runtime entry, Node child_process
 * @index_tags slothvault,mcp,adapter
 * @author holic512
 */
import {spawn} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {getRuntimeRoot} from '../lib/runtime-adapter.js';

const entry = path.join(getRuntimeRoot(), 'bin', 'slothvault-mcp.js');
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {stdio: 'inherit', env: process.env});
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('close', code => {process.exitCode = code ?? 1;});
