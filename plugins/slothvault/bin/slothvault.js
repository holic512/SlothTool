#!/usr/bin/env node

/**
 * @file SlothVaultPluginEntry
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / Entry
 * @description Exposes SlothTool-managed deployment, coding-agent Skill, and standalone MCP command registration operations.
 * @logic 1. Dispatch local management commands; 2. delegate deployment to the bundled Python runner; 3. require explicit confirmation before destructive local replacement; 4. keep standalone MCP execution in slothvault-mcp.
 * @dependencies Node: readline/process, Deploy Runner, Skill Manager, MCP Command Manager, Manager TUI
 * @index_tags slothvault,cli,deploy,skill,mcp,registration,tui
 * @author holic512
 */

import process from 'node:process';
import {createInterface} from 'node:readline/promises';
import {runDeployment} from '../lib/deploy-runner.js';
import {getSkillStatus, installSkill, uninstallSkill} from '../lib/skill-manager.js';
import {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from '../lib/mcp-command-manager.js';
import {startSlothVaultManagerTui} from '../lib/manager-tui.js';
import {t} from '../lib/i18n.js';

const MCP_EXECUTION_COMMANDS = new Set(['profile', 'doctor', 'tools', 'prompts', 'resources', 'history', 'storage']);

function interactive() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function hasFlag(args, flag) {
    return args.includes(flag);
}

function print(value, json) {
    if (json) {
        console.log(JSON.stringify(value, null, 2));
        return;
    }
    for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item) || (item && typeof item === 'object')) continue;
        console.log(`${key}: ${item ?? '-'}`);
    }
}

function printHelp() {
    console.log('SlothVault multifunction plugin\n');
    console.log('  slothtool slothvault');
    console.log('  slothtool slothvault deploy [deployment installer arguments]');
    console.log('  slothtool slothvault skill status|install|uninstall [--yes] [--json]');
    console.log('  slothtool slothvault mcp status|register|unregister [--replace --yes] [--json]');
    console.log('\nMCP calls use the separately registered slothvault-mcp command.');
}

async function confirm(question) {
    if (!interactive()) return false;
    const reader = createInterface({input: process.stdin, output: process.stdout});
    try {
        const answer = await reader.question(`${question}\nType yes or y to continue: `);
        return ['yes', 'y'].includes(answer.trim().toLowerCase());
    } finally {
        reader.close();
    }
}

/** Keep MCP execution on the separately registered executable without forwarding or local writes. */
function mcpExecutableRequiredError() {
    const error = new Error(t('mcpExecutableRequired'));
    error.code = 'SLOTHVAULT_MCP_COMMAND_REQUIRED';
    error.category = 'usage';
    error.exitCode = 2;
    return error;
}

async function runSkill(args, json) {
    const action = args[0] || 'status';
    if (action === 'status') return print(getSkillStatus(), json);
    if (action === 'install') {
        const current = getSkillStatus();
        const conflicts = current.agents.filter(agent => agent.detected && agent.state === 'conflict');
        let replace = hasFlag(args, '--yes');
        if (conflicts.length && !replace) {
            if (!interactive()) {
                return print(installSkill({replace: false}), json);
            }
            if (!await confirm(`Skill targets contain unmanaged content:\n${conflicts.map(item => item.targetPath).join('\n')}`)) {
                const error = new Error('Skill installation was cancelled; use --yes for a non-interactive replacement.');
                error.code = 'SKILL_INSTALL_CANCELLED';
                error.category = 'confirmation';
                throw error;
            }
            replace = true;
        }
        return print(installSkill({replace}), json);
    }
    if (action === 'uninstall') return print(uninstallSkill(), json);
    throw new Error(`Unknown skill command: ${action}`);
}

async function runMcp(args, json) {
    const action = args[0] || 'status';
    if (action === 'status') return print(getMcpCommandStatus(), json);
    if (action === 'unregister') return print(unregisterMcpCommand(), json);
    if (action !== 'register') throw new Error(`Unknown MCP command: ${action}`);
    const initial = getMcpCommandStatus();
    let replace = hasFlag(args, '--replace');
    if (initial.state === 'conflict') {
        if (!interactive() && !(replace && hasFlag(args, '--yes'))) {
            throw new Error('A conflicting slothvault-mcp command requires --replace --yes outside an interactive terminal.');
        }
        if (interactive() && !await confirm(`Replace the non-managed command at ${initial.targetPath}?`)) {
            throw new Error('MCP command registration was cancelled.');
        }
        replace = true;
    }
    return print(registerMcpCommand({replace}), json);
}

async function main() {
    const args = process.argv.slice(2);
    if (hasFlag(args, '--help') || hasFlag(args, '-h')) return printHelp();
    if (!args.length || hasFlag(args, '--tui') || hasFlag(args, '-i') || hasFlag(args, '--interactive')) {
        if (!interactive() && !process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION) throw new Error('The SlothVault TUI requires an interactive terminal.');
        return startSlothVaultManagerTui();
    }
    const [command, ...rest] = args;
    const json = hasFlag(rest, '--json');
    if (MCP_EXECUTION_COMMANDS.has(command)) throw mcpExecutableRequiredError();
    if (command === 'deploy') {
        const result = await runDeployment(rest);
        process.exitCode = result.code;
        return;
    }
    if (command === 'skill') return runSkill(rest, json);
    if (command === 'mcp') return runMcp(rest, json);
    throw new Error(`Unknown SlothVault command: ${command}`);
}

main().catch(error => {
    if (process.argv.slice(2).includes('--json')) {
        console.log(JSON.stringify({
            ok: false,
            error: {
                code: error.code || 'SLOTHVAULT_COMMAND_ERROR',
                category: error.category || 'usage',
                message: error.message
            }
        }, null, 2));
    } else {
        console.error(`Error: ${error.message}`);
    }
    process.exitCode = Number(error.exitCode || 2);
});
