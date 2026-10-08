/**
 * @file skill-service.js
 * @project SlothTool
 * @module SlothVault Skill lifecycle
 * @description Synchronizes Skill content from its Release and manages verified agent links independently of MCP.
 * @logic Inspect targets locally, install or update the active Release, and remove only owned Skill content and links.
 * @dependencies Component service, Skill link manager, local cleanup paths
 * @index_tags slothvault,skill,release,links,lifecycle
 * @author holic512
 */
import {getSkillStatus, installSkill as linkSkill, uninstallSkill as unlinkSkill} from './skill-manager.js';
import {checkComponentUpdate, installComponent} from './component-service.js';
import {assertSlothVaultIdle, withSlothVaultStorageLock, removeOwnedSkillRoot} from './slothvault-storage.js';
export {getSkillStatus};
export async function checkSkillUpdate(options = {}) {
    const result = await checkComponentUpdate('skill', options);
    return {...getSkillStatus(options), ...result, checkState: result.status === 'error' ? 'unavailable' : 'checked', updateStatus: result.status};
}
export async function installSkill(options = {}) {
    const result = await installComponent('skill', {...options, replaceSkill: options.replace === true});
    return {...getSkillStatus(options), latestVersion: result.latestVersion, checkedAt: result.checkedAt, releaseNotes: result.releaseNotes, releaseUrl: result.releaseUrl,
        status: result.status, updateStatus: result.status, checkState: 'checked', action: result.status, warnings: result.warnings};
}
export async function updateSkill({local = false, ...options} = {}) {
    if (local) return withSlothVaultStorageLock(options, () => {
        assertSlothVaultIdle({...options, ignoreCleanupLock: true});
        return {...linkSkill({...options, skipConflicts: true}), checkState: 'local'};
    });
    return installSkill({...options, replace: false});
}
export function uninstallSkill(options = {}) {
    return withSlothVaultStorageLock(options, () => {
        assertSlothVaultIdle({...options, ignoreCleanupLock: true});
        const result = unlinkSkill({...options, skipConflicts: true});
        removeOwnedSkillRoot(options);
        return {...getSkillStatus(options), action: result.action};
    });
}
