/**
 * @file SlothVaultSkillManager
 * @project SlothTool
 * @module SlothVault MCP Plugin / Skill Management
 * @description 管理插件内置 SlothVault Skill 到用户级 Codex Skill 目录的受控链接安装。
 * @logic 1. 校验插件内 Skill 来源与固定用户目标；2. 识别受管链接、未安装和冲突状态；3. 预创建链接后按显式授权替换冲突；4. 卸载时只删除准确指向当前来源的受管链接。
 * @dependencies Node: fs/os/path/crypto/url
 * @index_tags slothvault,mcp,codex,skill,installer,symlink
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const SKILL_NAME = 'slothvault-mcp';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const bundledSkillPath = path.resolve(moduleDirectory, '..', 'skills', SKILL_NAME);

export class SlothVaultSkillError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'SlothVaultSkillError';
        this.code = options.code || 'SKILL_ERROR';
        this.category = options.category || 'internal';
        this.exitCode = options.exitCode ?? (this.category === 'confirmation' || this.category === 'config' ? 2 : 1);
    }
}

/** Resolve the immutable bundled source and fixed user-level Codex Skill target. */
export function getSkillPaths(options = {}) {
    const homeDirectory = path.resolve(options.homeDir || os.homedir());
    const sourcePath = path.resolve(options.sourcePath || bundledSkillPath);
    const skillsDirectory = path.join(homeDirectory, '.agents', 'skills');
    const targetPath = path.join(skillsDirectory, SKILL_NAME);
    return {sourcePath, skillsDirectory, targetPath};
}

/** Compare resolved paths while respecting Windows case-insensitive path semantics. */
function pathsEqual(left, right, platform = process.platform) {
    const normalizeComparable = value => {
        const normalized = path.normalize(path.resolve(value));
        if (platform !== 'win32') {
            return normalized;
        }
        return normalized
            .replace(/^\\\\\?\\UNC\\/iu, '\\\\')
            .replace(/^\\\\\?\\/u, '')
            .toLowerCase();
    };
    const normalizedLeft = normalizeComparable(left);
    const normalizedRight = normalizeComparable(right);
    return normalizedLeft === normalizedRight;
}

/** Ensure the package contains a usable Skill before any user path can change. */
function assertSkillSource(sourcePath, fileSystem = fs) {
    let sourceStats;
    let manifestStats;
    try {
        sourceStats = fileSystem.statSync(sourcePath);
        manifestStats = fileSystem.statSync(path.join(sourcePath, 'SKILL.md'));
    } catch (error) {
        throw new SlothVaultSkillError(`Bundled SlothVault Skill is unavailable: ${sourcePath}`, {
            code: 'SKILL_SOURCE_INVALID',
            cause: error
        });
    }
    if (!sourceStats.isDirectory() || !manifestStats.isFile()) {
        throw new SlothVaultSkillError(`Bundled SlothVault Skill is invalid: ${sourcePath}`, {
            code: 'SKILL_SOURCE_INVALID'
        });
    }
}

/** Reject any accidental attempt to mutate a path outside the fixed Skill slot. */
function assertFixedTarget(paths, homeDir = os.homedir()) {
    const expected = path.join(path.resolve(homeDir), '.agents', 'skills', SKILL_NAME);
    if (!pathsEqual(paths.targetPath, expected)) {
        throw new SlothVaultSkillError(`Invalid SlothVault Skill target: ${paths.targetPath}`, {
            code: 'SKILL_TARGET_INVALID',
            category: 'config'
        });
    }
}

/** Inspect a target without following its final link, including dangling links. */
function inspectTarget(paths, options = {}) {
    const fileSystem = options.fileSystem || fs;
    let stats;
    try {
        stats = fileSystem.lstatSync(paths.targetPath);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return 'not-installed';
        }
        throw error;
    }

    if (!stats.isSymbolicLink()) {
        return 'conflict';
    }

    let linkValue;
    try {
        linkValue = fileSystem.readlinkSync(paths.targetPath);
    } catch {
        return 'conflict';
    }
    const resolvedLink = path.resolve(path.dirname(paths.targetPath), linkValue);
    return pathsEqual(resolvedLink, paths.sourcePath, options.platform) ? 'installed' : 'conflict';
}

/** Convert unexpected filesystem failures into the plugin's stable local error contract. */
function wrapSkillError(error, operation) {
    if (error instanceof SlothVaultSkillError) {
        return error;
    }
    return new SlothVaultSkillError(`${operation}: ${error?.message || String(error)}`, {
        code: 'SKILL_FILESYSTEM_ERROR',
        cause: error
    });
}

/** Return the stable public installation status contract. */
export function getSkillStatus(options = {}) {
    try {
        const paths = getSkillPaths(options);
        assertSkillSource(paths.sourcePath, options.fileSystem || fs);
        assertFixedTarget(paths, options.homeDir || os.homedir());
        return {
            name: SKILL_NAME,
            state: inspectTarget(paths, options),
            sourcePath: paths.sourcePath,
            targetPath: paths.targetPath
        };
    } catch (error) {
        throw wrapSkillError(error, 'Unable to inspect the SlothVault Skill installation');
    }
}

/** Create a platform-appropriate directory link. */
function createDirectoryLink(sourcePath, targetPath, options = {}) {
    const linkType = (options.platform || process.platform) === 'win32' ? 'junction' : 'dir';
    if (options.createLink) {
        options.createLink(sourcePath, targetPath, linkType);
        return;
    }
    const fileSystem = options.fileSystem || fs;
    fileSystem.symlinkSync(sourcePath, targetPath, linkType);
}

/** Remove an existing conflict after the caller has obtained explicit authorization. */
function removeConflictTarget(targetPath, fileSystem = fs) {
    const stats = fileSystem.lstatSync(targetPath);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
        fileSystem.rmSync(targetPath, {recursive: true, force: false});
        return;
    }
    fileSystem.unlinkSync(targetPath);
}

/** Install the bundled Skill link, replacing a conflict only when explicitly authorized. */
export function installSkill(options = {}) {
    try {
        const fileSystem = options.fileSystem || fs;
        const paths = getSkillPaths(options);
        const initial = getSkillStatus(options);
        if (initial.state === 'installed') {
            return {...initial, action: 'already-installed'};
        }
        if (initial.state === 'conflict' && !options.replace) {
            throw new SlothVaultSkillError(`The SlothVault Skill target already exists: ${paths.targetPath}`, {
                code: 'SKILL_INSTALL_CONFIRMATION_REQUIRED',
                category: 'confirmation'
            });
        }

        fileSystem.mkdirSync(paths.skillsDirectory, {recursive: true});
        const temporaryPath = path.join(paths.skillsDirectory, `.${SKILL_NAME}.link.${randomUUID()}`);
        let temporaryCreated = false;
        try {
            createDirectoryLink(paths.sourcePath, temporaryPath, options);
            temporaryCreated = true;

            const temporaryPaths = {...paths, targetPath: temporaryPath};
            if (inspectTarget(temporaryPaths, options) !== 'installed') {
                throw new SlothVaultSkillError('Unable to verify the temporary SlothVault Skill link.', {
                    code: 'SKILL_LINK_INVALID'
                });
            }

            const currentState = inspectTarget(paths, options);
            if (currentState === 'installed') {
                fileSystem.unlinkSync(temporaryPath);
                temporaryCreated = false;
                return {...getSkillStatus(options), action: 'already-installed'};
            }
            if (currentState === 'conflict') {
                if (!options.replace) {
                    throw new SlothVaultSkillError(`The SlothVault Skill target already exists: ${paths.targetPath}`, {
                        code: 'SKILL_INSTALL_CONFIRMATION_REQUIRED',
                        category: 'confirmation'
                    });
                }
                removeConflictTarget(paths.targetPath, fileSystem);
            }

            fileSystem.renameSync(temporaryPath, paths.targetPath);
            temporaryCreated = false;
            const installed = getSkillStatus(options);
            if (installed.state !== 'installed') {
                throw new SlothVaultSkillError('The SlothVault Skill link could not be verified after installation.', {
                    code: 'SKILL_LINK_INVALID'
                });
            }
            return {...installed, action: initial.state === 'conflict' ? 'replaced' : 'installed'};
        } finally {
            if (temporaryCreated) {
                try {
                    fileSystem.unlinkSync(temporaryPath);
                } catch {
                    // Preserve the primary failure while making a best-effort cleanup.
                }
            }
        }
    } catch (error) {
        throw wrapSkillError(error, 'Unable to install the SlothVault Skill');
    }
}

/** Remove only the link managed by this plugin; never delete conflicting content. */
export function uninstallSkill(options = {}) {
    try {
        const fileSystem = options.fileSystem || fs;
        const status = getSkillStatus(options);
        if (status.state === 'not-installed') {
            return {...status, action: 'already-absent'};
        }
        if (status.state !== 'installed') {
            throw new SlothVaultSkillError(`Refusing to remove an unmanaged SlothVault Skill target: ${status.targetPath}`, {
                code: 'SKILL_UNINSTALL_CONFLICT',
                category: 'config'
            });
        }

        fileSystem.unlinkSync(status.targetPath);
        return {...getSkillStatus(options), action: 'uninstalled'};
    } catch (error) {
        throw wrapSkillError(error, 'Unable to uninstall the SlothVault Skill');
    }
}

export default {getSkillPaths, getSkillStatus, installSkill, uninstallSkill};
