#!/usr/bin/env node

/**
 * @file SlothVaultPluginEntry
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / Entry
 * @description Manages Vault-owned deployment and Skill packages; agents connect to MCP through their native configuration.
 * @logic Dispatch deployment, Skill and cleanup commands; confirm destructive local replacement; reject retired Client commands with native connection guidance.
 * @dependencies Node: readline/process, Deploy Runner, Package/Skill Services, Manager TUI
 * @index_tags slothvault,cli,deploy,skill,native-mcp,tui
 * @author holic512
 */

import process from 'node:process';
import {createInterface} from 'node:readline/promises';
import {runDeployment} from '../lib/deploy-runner.js';
import {checkSkillUpdate, updateSkill, getSkillStatus, installSkill, uninstallSkill} from '../lib/skill-service.js';
import {operatePackage} from '../lib/package-service.js';
import {planSlothVaultCleanup, cleanupSlothVault} from '../lib/slothvault-storage.js';
import {startSlothVaultManagerTui} from '../lib/manager-tui.js';
import {t} from '../lib/i18n.js';

const MCP_EXECUTION_COMMANDS = new Set(['mcp', 'setup', 'profile', 'doctor', 'tools', 'prompts', 'resources', 'history', 'storage']);

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
        console.log(`${key}: ${item && typeof item === 'object' ? JSON.stringify(item, null, 2) : item ?? '-'}`);
    }
}

function printHelp() {
    console.log('SlothVault multifunction plugin\n');
    console.log('  slothtool slothvault');
    console.log('  slothtool slothvault deploy [deployment installer arguments]');
    console.log('  slothtool slothvault deploy package status|install|check|update [--json]');
    console.log('  slothtool slothvault cleanup [--dry-run] [--yes] [--json]');
    console.log('  slothtool slothvault skill status|install|update|uninstall [--check] [--local] [--yes] [--json]');
    console.log('\n' + t('nativeMcpGuidance'));
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

/** Retired MCP commands explain native agent configuration without starting a client or writing credentials. */
function nativeMcpRequiredError() {
    const error = new Error(t('nativeMcpGuidance'));
    error.code = 'SLOTHVAULT_MCP_CLIENT_REMOVED';
    error.category = 'usage';
    error.exitCode = 2;
    return error;
}

async function runSkill(args, json) {
    const action = args[0] || 'status';
    if (action === 'status' || action === 'update') {
        const result = action === 'update' ? await updateSkill({local: hasFlag(args, '--local')})
            : hasFlag(args, '--check') ? await checkSkillUpdate() : getSkillStatus();
        if (json) print(result, true);
        else {
            console.log(t('skillVersion.current', {version: result.version || '-'}));
            if (result.checkState) console.log(t(`skillVersion.${result.checkState}`, {version: result.latestVersion || '-'}));
            for (const agent of result.agents) if (agent.detected) console.log(`${agent.name}: ${agent.version || '-'} (${t(`manager.states.${agent.state}`)})`);
        }
        if (result.status === 'error') process.exitCode = 1;
        return;
    }
    if (action === 'install') {
        const current = getSkillStatus();
        const conflicts = current.agents.filter(agent => agent.detected && agent.state === 'conflict');
        let replace = hasFlag(args, '--yes');
        if (conflicts.length && !replace) {
            if (!interactive()) {
                throw Object.assign(new Error(t('errors.SKILL_INSTALL_CONFIRMATION_REQUIRED')), {code: 'SKILL_INSTALL_CONFIRMATION_REQUIRED', exitCode: 2});
            }
            if (!await confirm(`Skill targets contain unmanaged content:\n${conflicts.map(item => item.targetPath).join('\n')}`)) {
                const error = new Error('Skill installation was cancelled; use --yes for a non-interactive replacement.');
                error.code = 'SKILL_INSTALL_CANCELLED';
                error.category = 'confirmation';
                throw error;
            }
            replace = true;
        }
        return print(await installSkill({replace}), json);
    }
    if (action === 'uninstall') return print(uninstallSkill(), json);
    throw new Error(`Unknown skill command: ${action}`);
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
    if (MCP_EXECUTION_COMMANDS.has(command)) throw nativeMcpRequiredError();
    if (command === 'deploy' && rest[0] === 'package') {
        const result = await operatePackage('deployment', rest[1] || 'status');
        print(result, json);
        if (result.status === 'error') process.exitCode = 1;
        return;
    }
    if (command === 'cleanup') {
        const preview = planSlothVaultCleanup();
        if (hasFlag(rest, '--dry-run')) return print({...preview, status: 'preview'}, json);
        if (!hasFlag(rest, '--yes')) {
            if (json || !interactive() || !await confirm(t('workspace.cleanupWarning') + '\n' + preview.items.map(item => item.path).join('\n'))) {
                throw Object.assign(new Error(t('workspace.cleanupConfirmation')), {code: 'CONFIRMATION_REQUIRED', exitCode: 2});
            }
        }
        const result = cleanupSlothVault();
        print(result, json);
        if (result.errors.length) process.exitCode = 1;
        return;
    }
    if (command === 'deploy') {
        const result = await runDeployment(rest);
        process.exitCode = result.code;
        return;
    }
    if (command === 'skill') return runSkill(rest, json);
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
