/**
 * @file BundledSkillService
 * @project SlothTool
 * @module Core / Skill Management
 * @description 检测 Codex/Claude Code，管理主包内置 slothtool Skill 的受管目录链接。
 * @logic 只读检查固定目标；预检并暂存链接；事务式切换及登记，失败回滚；卸载仅移除经再次核验的受管链接。
 * @dependencies Node: fs/os/path/url/crypto, Settings: ../settings.js, I18N: ../i18n.js
 * @index_tags bundled-skill, agents, symlink, rollback, settings
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import settings from '../settings.js';
import {t} from '../i18n.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SKILL_AGENTS = Object.freeze([
    {id: 'codex', name: 'Codex', command: 'codex', environment: 'CODEX_HOME', directory: '.codex'},
    {id: 'claude-code', name: 'Claude Code', command: 'claude', environment: 'CLAUDE_CONFIG_DIR', directory: '.claude'}
]);

function failure(code, params = {}) {
    const error = new Error(t(`skill.errors.${code}`, params));
    error.code = code;
    return error;
}
function samePath(a, b, platform) {
    const normalize = value => {
        const resolved = path.resolve(value).replace(/^\\\\\?\\/u, '');
        return platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return Boolean(a && b) && normalize(a) === normalize(b);
}
function entry(fileSystem, target) {
    try {
        const stat = fileSystem.lstatSync(target);
        return {stat, link: stat.isSymbolicLink() ? fileSystem.readlinkSync(target) : null};
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}
function equalEntry(left, right) {
    return left === right || Boolean(left && right && left.stat.ino === right.stat.ino
        && left.stat.dev === right.stat.dev && left.stat.mtimeMs === right.stat.mtimeMs && left.link === right.link);
}
function directoryExists(fileSystem, target) {
    try { return fileSystem.statSync(target).isDirectory(); }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; }
}
function executableExists(command, context) {
    const {fileSystem, environment, platform} = context;
    const extensions = platform === 'win32' ? (environment.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
    const pathValue = environment.PATH ?? environment.Path;
    const directories = pathValue === undefined ? [] : pathValue.split(platform === 'win32' ? ';' : ':');
    return directories.filter(directory => directory || platform !== 'win32').some(directory =>
        extensions.some(extension => {
            try {
                const candidate = path.join(directory, command + extension);
                if (!fileSystem.statSync(candidate).isFile()) return false;
                fileSystem.accessSync(candidate, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
                return true;
            } catch { return false; }
        }));
}
function skillVersion(fileSystem, sourcePath) {
    const content = fileSystem.readFileSync(path.join(sourcePath, 'SKILL.md'), 'utf8');
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/u)?.[1] || '';
    if (!/^name:\s*slothtool\s*$/mu.test(frontmatter)) throw failure('SOURCE_INVALID');
    const version = frontmatter.match(/^\s+version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/mu)?.[1];
    if (!version) throw failure('SOURCE_INVALID');
    return version;
}
function createContext(options) {
    const context = {
        fileSystem: options.fileSystem || fs,
        store: options.settingsStore || settings,
        environment: options.env || process.env,
        platform: options.platform || process.platform,
        homeDir: path.resolve(options.homeDir || os.homedir()),
        sourcePath: path.resolve(options.sourcePath || path.join(PACKAGE_ROOT, 'skills', 'slothtool')),
        packageVersion: options.packageVersion || JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version
    };
    context.records = context.store.readSettings().skill?.installations || [];
    try {
        context.skillVersion = skillVersion(context.fileSystem, context.sourcePath);
        if (context.skillVersion !== context.packageVersion) throw failure('SOURCE_INVALID');
    } catch {
        context.skillVersion = null;
        context.sourceError = failure('SOURCE_INVALID', {path: context.sourcePath});
    }
    return context;
}
function inspect(context, selection = 'all') {
    const {fileSystem, environment, platform, homeDir, sourcePath, records} = context;
    if (selection !== 'all' && !SKILL_AGENTS.some(agent => agent.id === selection)) throw failure('INVALID_AGENT');
    context.snapshots = new Map();
    const agents = SKILL_AGENTS.filter(agent => selection === 'all' || selection === agent.id).map(agent => {
        const configPath = path.resolve(environment[agent.environment]?.trim() || path.join(homeDir, agent.directory));
        const targetPath = path.join(configPath, 'skills', 'slothtool');
        const detected = directoryExists(fileSystem, configPath) || executableExists(agent.command, context);
        const record = records.find(item => item.agentId === agent.id && samePath(item.targetPath, targetPath, platform));
        const current = entry(fileSystem, targetPath);
        context.snapshots.set(agent.id, current);
        const linkedSource = current?.link == null ? null : path.resolve(path.dirname(targetPath), current.link);
        const managed = Boolean(record && linkedSource && samePath(record.sourcePath, linkedSource, platform));
        let state = detected ? 'missing' : 'not-detected';
        let error = null;
        let version = null;
        if (current) {
            if (!managed) {
                state = 'conflict';
                error = failure('CONFLICT', {path: targetPath});
            } else {
                try { version = skillVersion(fileSystem, linkedSource); } catch { /* Broken managed links remain removable. */ }
                state = !version ? 'broken' : !samePath(linkedSource, sourcePath, platform) ? 'outdated' : 'installed';
            }
        }
        if (context.sourceError && state !== 'conflict') {
            error = context.sourceError;
            if (state === 'installed') state = 'source-invalid';
        }
        return {id: agent.id, name: agent.name, detected, targetPath, sourcePath: linkedSource || sourcePath,
            version, state, managed: managed || (!current && Boolean(record)),
            error: error ? {code: error.code, message: error.message} : null};
    });
    return {ok: !context.sourceError && agents.every(agent => !agent.error), packageVersion: context.packageVersion,
        skillVersion: context.skillVersion, sourcePath, agents};
}

/** Pure inspection: never creates directories, reads credentials, or launches agents. */
export function getSkillStatus(options = {}) {
    return inspect(createContext(options), options.agent);
}

/** Install/update/uninstall a preflighted set of fixed targets; restore links if persistence fails. */
export function manageSkill(action, options = {}) {
    const context = createContext(options);
    const {fileSystem, store, sourcePath, platform} = context;
    const before = inspect(context, options.agent);
    const detected = before.agents.filter(agent => agent.detected);
    const selected = action === 'update' && (!options.agent || options.agent === 'all')
        ? detected.filter(agent => agent.managed || agent.state === 'conflict') : detected;
    const operations = [];
    let targetError = null;
    try {
        if (!['install', 'update', 'uninstall'].includes(action)) throw failure('INVALID_ACTION');
        if (!detected.length) throw failure('NO_AGENTS');
        if (!selected.length) throw failure('NOT_MANAGED', {path: sourcePath});
        if (action !== 'uninstall' && context.sourceError) throw context.sourceError;
        for (const agent of selected) {
            targetError = agent.id;
            if (agent.state === 'conflict') throw failure('CONFLICT', {path: agent.targetPath});
            if (action === 'update' && !agent.managed) throw failure('NOT_MANAGED', {path: agent.targetPath});
            const original = context.snapshots.get(agent.id);
            if (!equalEntry(entry(fileSystem, agent.targetPath), original)) throw failure('TARGET_CHANGED', {path: agent.targetPath});
            if (operations.some(operation => samePath(operation.agent.targetPath, agent.targetPath, platform))) {
                throw failure('DUPLICATE_TARGET', {path: agent.targetPath});
            }
            operations.push({agent, original, backup: null, temporary: null, installed: null,
                change: action === 'uninstall' ? Boolean(original) : agent.state !== 'installed'});
        }
        // Stage every new link before changing any existing target.
        for (const operation of operations.filter(item => item.change && action !== 'uninstall')) {
            targetError = operation.agent.id;
            const directory = path.dirname(operation.agent.targetPath);
            fileSystem.mkdirSync(directory, {recursive: true});
            const temporary = path.join(directory, `.slothtool.${randomUUID()}.new`);
            fileSystem.symlinkSync(sourcePath, temporary, platform === 'win32' ? 'junction' : 'dir');
            operation.temporary = temporary;
            operation.staged = entry(fileSystem, temporary);
        }
        for (const operation of operations.filter(item => item.change)) {
            targetError = operation.agent.id;
            const target = operation.agent.targetPath;
            if (!equalEntry(entry(fileSystem, target), operation.original)) throw failure('TARGET_CHANGED', {path: target});
            if (operation.original) {
                const backup = path.join(path.dirname(target), `.slothtool.${randomUUID()}.old`);
                fileSystem.renameSync(target, backup);
                operation.backup = backup;
            }
            if (operation.temporary) {
                if (entry(fileSystem, target)) throw failure('TARGET_CHANGED', {path: target});
                fileSystem.renameSync(operation.temporary, target);
                operation.temporary = null;
                operation.installed = operation.staged;
            }
        }
        // Settings is the only persistence owner. Re-read to preserve unrelated preferences.
        const currentSettings = store.readSettings();
        const nextRecords = (currentSettings.skill?.installations || []).filter(record =>
            !selected.some(agent => record.agentId === agent.id && samePath(record.targetPath, agent.targetPath, platform)));
        if (action !== 'uninstall') nextRecords.push(...selected.map(agent => ({agentId: agent.id, targetPath: agent.targetPath, sourcePath})));
        store.writeSettings({...currentSettings, skill: {installations: nextRecords}});
    } catch (error) {
        const rollbackErrors = [];
        for (const operation of operations.toReversed()) {
            try {
                const target = operation.agent.targetPath;
                if (operation.installed) {
                    if (!equalEntry(entry(fileSystem, target), operation.installed)) throw failure('TARGET_CHANGED', {path: target});
                    fileSystem.unlinkSync(target);
                }
                if (operation.backup) {
                    if (entry(fileSystem, target)) throw failure('TARGET_CHANGED', {path: target});
                    fileSystem.renameSync(operation.backup, target);
                }
                if (operation.temporary) fileSystem.unlinkSync(operation.temporary);
            } catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
        }
        const detail = {code: error.code || 'OPERATION_FAILED', message: error.message};
        const result = inspect(createContext(options), options.agent);
        result.agents = result.agents.map(agent => ({...agent, error: agent.id === targetError || (!targetError && agent.detected)
            ? detail : agent.error}));
        return {...result, ok: false, action, error: detail, ...(rollbackErrors.length ? {rollbackErrors} : {})};
    }
    const warnings = [];
    // After commit, cleanup cannot invalidate the successfully saved ownership record.
    for (const operation of operations) {
        if (operation.backup) {
            try {
                if (!equalEntry(entry(fileSystem, operation.backup), operation.original)) throw failure('TARGET_CHANGED', {path: operation.backup});
                fileSystem.unlinkSync(operation.backup);
            } catch (error) { warnings.push({path: operation.backup, message: error.message}); }
        }
    }
    const result = inspect(createContext(options), options.agent);
    options.reporter?.({level: warnings.length ? 'warn' : 'success', message: t('skill.complete')});
    return {...result, ok: action === 'uninstall' || result.ok, action, ...(warnings.length ? {warnings} : {})};
}
