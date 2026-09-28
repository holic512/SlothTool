/**
 * @file skill-update.js
 * @project SlothTool
 * @module SlothVault Skill Updates
 * @description Checks official Skill releases through SlothTool and synchronizes managed links without replacing custom content.
 * @logic Check with the root updater, update the plugin if needed, then reenter a fresh plugin process to verify and synchronize its bundled Skill.
 * @dependencies skill-manager, skill-metadata, node:child_process/fs/path
 * @index_tags skill,update,release,offline
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {getSkillStatus, installSkill} from './skill-manager.js';
import {createSkillMetadata} from './skill-metadata.js';

function updateError(code, message) { return Object.assign(new Error(message), {code, category: 'update', exitCode: 1}); }
export async function runManager(args) {
    const entry = process.env.SLOTHTOOL_ENTRY_PATH;
    if (process.env.SLOTHTOOL_COMMAND_PATH_VERIFIED !== '1' || !entry) throw updateError('SKILL_MANAGER_UNAVAILABLE', 'Run this command through an installed SlothTool. Use --local for offline Skill synchronization.');
    const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(entry), '..', 'package.json'), 'utf8'));
    if (pkg.name !== '@holic512/slothtool') throw updateError('SKILL_MANAGER_UNAVAILABLE', 'The SlothTool entry could not be verified.');
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [entry, ...args], {stdio: ['ignore', 'pipe', 'pipe'], env: process.env});
        let stdout = '';
        const timeout = setTimeout(() => child.kill(), 180_000);
        child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-2_000_000); });
        child.stderr.resume();
        child.on('error', error => { clearTimeout(timeout); reject(error); });
        child.on('close', code => {
            clearTimeout(timeout);
            let result;
            try { result = JSON.parse(stdout); } catch { reject(updateError('SKILL_UPDATE_FAILED', 'SlothTool did not return a valid update result.')); return; }
            if (code !== 0 || result.ok === false || result.status === 'error') reject(updateError('SKILL_UPDATE_FAILED', result.error?.message || result.reason || 'Unable to complete the official update.'));
            else resolve(result);
        });
    });
}
export async function checkSkillUpdate(options = {}) {
    const current = getSkillStatus(options);
    try {
        const check = await (options.runManager || runManager)(['update', 'slothvault', '--check', '--json']);
        if (check.status === 'error' || check.ok === false) throw new Error('Official release check failed.');
        return {...current, checkState: 'checked', latestVersion: check.skillMetadata?.skillVersion || null,
            latestPluginVersion: check.latestVersion, pluginUpdateAvailable: check.status === 'outdated',
            skillMetadata: check.skillMetadata || null};
    } catch {
        return {...current, checkState: 'unavailable', latestVersion: null, latestPluginVersion: null};
    }
}
export async function updateSkill(options = {}) {
    if (options.local) {
        const status = getSkillStatus(options);
        const result = status.agents.some(agent => agent.detected) ? installSkill({...options, replace: false, skipConflicts: true}) : status;
        return {...result, checkState: 'local', verified: true, metadata: createSkillMetadata(result.sourcePath, result.pluginVersion), action: result.action || 'no-agents'};
    }
    const check = await checkSkillUpdate(options);
    if (check.checkState !== 'checked') throw updateError('SKILL_CHECK_UNAVAILABLE', 'Unable to check the official release. Use --local to synchronize the installed Skill offline.');
    const invoke = options.runManager || runManager;
    if (check.pluginUpdateAvailable) await invoke(['update', 'slothvault', '--json']);
    // Even unchanged packages are read in a fresh process, so no stale module implementation can synchronize an updated bundle.
    const result = await invoke(['slothvault', 'skill', 'update', '--local', '--json']);
    if (!result.verified || result.agents?.some(agent => agent.detected && !['installed', 'conflict'].includes(agent.state))) throw updateError('SKILL_VERIFY_FAILED', 'Updated Skill installation could not be verified.');
    if (check.skillMetadata && result.pluginVersion === check.latestPluginVersion && JSON.stringify(result.metadata) !== JSON.stringify(check.skillMetadata)) throw updateError('SKILL_VERIFY_FAILED', 'Installed Skill files differ from the official release metadata.');
    return {...result, checkState: 'checked', latestVersion: check.latestVersion, latestPluginVersion: check.latestPluginVersion, pluginUpdated: check.pluginUpdateAvailable};
}
