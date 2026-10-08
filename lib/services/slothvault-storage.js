/**
 * @file slothvault-storage.js
 * @project SlothTool
 * @module SlothVault local cleanup
 * @description Previews and removes owned runtime residue, profiles, history and verified links without running Python.
 * @logic Inspect fixed paths without following directory links, protect active payloads, revalidate each deletion, and report partial failures.
 * @dependencies Node fs/os/path, SlothVault component paths
 * @index_tags slothvault,cleanup,uninstall,profiles,history,ownership
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {componentPaths, slothToolHome, VAULT_COMPONENTS, getComponentStatus} from './slothvault-paths.js';

function stats(file) {try {return fs.lstatSync(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}}
function inside(file, root) {const relative = path.relative(root, file); return relative === '' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);}
function referenced(file, targets) {
    let real = file;
    try {real = fs.realpathSync(file);} catch { /* A missing path has only its lexical location. */ }
    return [...targets].some(target => inside(target, file) || inside(target, real));
}
function safePath(file, root) {
    if (!inside(file, root) || file === root) return false;
    for (let parent = path.dirname(file); parent !== root; parent = path.dirname(parent)) {
        if (!inside(parent, root) || stats(parent)?.isSymbolicLink()) return false;
    }
    return true;
}
function size(file) {
    const info = stats(file);
    if (!info) return 0;
    if (info.isSymbolicLink() || !info.isDirectory()) return info.size;
    return fs.readdirSync(file).reduce((bytes, name) => bytes + size(path.join(file, name)), 0);
}
function metadata(file) {try {if (!stats(file)?.isFile()) return null; return JSON.parse(fs.readFileSync(file, 'utf8'));} catch {return null;}}
function ownedRelease(directory, module) {
    const meta = metadata(path.join(directory, 'module.json'));
    if (meta && module && meta.module === module && /^\d+\.\d+\.\d+$/u.test(meta.version || '')) return true;
    return metadata(path.join(directory, 'package.json'))?.name === '@holic512/slothvault-runtime';
}

export function slothVaultDataPaths(options = {}) {
    const root = slothToolHome(options);
    return ['slothvault', 'slothvault-mcp'].flatMap(alias => [path.join(root, 'plugin-configs', alias + '.json'),
        path.join(root, 'data/plugin-configs', alias + '.json'), path.join(root, 'data', alias), path.join(root, 'cache', alias)]);
}

/** Report only file presence; reading Profile content belongs to the MCP page. */
export function getMcpLocalState(options = {}) {
    try {
        const present = slothVaultDataPaths(options).some(file => file.endsWith('.json') && stats(file));
        return {profileState: present ? 'unread' : 'not-configured', connectionState: 'unchecked'};
    } catch {return {profileState: 'unread', connectionState: 'unchecked'};}
}

export function removeOwnedSkillRoot(options = {}) {
    const root = componentPaths('skill', options).root;
    if (!safePath(root, slothToolHome(options))) throw new Error('Unsafe Skill package cleanup path.');
    fs.rmSync(root, {recursive: true, force: true});
}

export function assertComponentStorage(module, options = {}) {
    const paths = componentPaths(module, options);
    if (!safePath(paths.root, slothToolHome(options)) || stats(paths.root)?.isSymbolicLink() || stats(paths.releases)?.isSymbolicLink()) throw new Error('Unsafe component package storage path.');
}

/** Inspect all fixed agent slots so even a custom link can protect its source. */
export function skillLinkReferences(options = {}) {
    const home = options.homeDir || os.homedir(), env = options.env || process.env;
    return [path.join(env.CODEX_HOME || path.join(home, '.codex'), 'skills/slothvault-mcp'),
        path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'skills/slothvault-mcp'),
        path.join(home, '.agents/skills/slothvault-mcp')].flatMap(target => {
        if (!stats(target)?.isSymbolicLink()) return [];
        return [{path: target, source: path.resolve(path.dirname(target), fs.readlinkSync(target)), kind: 'skill-link', external: true}];
    });
}

export function managedSkillLinks(options = {}) {
    const root = slothToolHome(options);
    const sources = [
        path.join(componentPaths('skill', options).current, 'slothvault-mcp'),
        path.join(root, 'runtimes/slothvault/current/skills/slothvault-mcp'),
        ...['slothvault', 'slothvault-mcp'].map(alias => path.join(root, 'plugins', alias, 'skills/slothvault-mcp'))
    ];
    return skillLinkReferences(options).filter(link => sources.includes(link.source));
}

export function managedCommandLinks(options = {}) {
    const env = options.env || process.env;
    const command = options.slothtoolExecutable || (env.SLOTHTOOL_COMMAND_PATH_VERIFIED === '1' ? env.SLOTHTOOL_COMMAND_PATH : '');
    if (!command) return [];
    const root = slothToolHome(options);
    const platform = options.platform || process.platform;
    const target = path.join(path.dirname(command), platform === 'win32' ? 'slothvault-mcp.cmd' : 'slothvault-mcp');
    const entries = [path.join(options.pluginDir || path.join(root, 'plugins/slothvault'), 'bin/slothvault-mcp.js'),
        path.join(root, 'plugins/slothvault-mcp/bin/slothvault-mcp.js'),
        path.join(root, 'runtimes/slothvault/current/bin/slothvault-mcp.js')];
    const info = stats(target);
    if (info?.isSymbolicLink()) {
        const source = path.resolve(path.dirname(target), fs.readlinkSync(target));
        return entries.includes(source) ? [{path: target, source, kind: 'command-link', external: true}] : [];
    }
    if (platform === 'win32' && info?.isFile()) {
        const content = fs.readFileSync(target, 'utf8');
        if (entries.some(entry => content === `:: Managed by SlothVault MCP command registration\r\n@"${process.execPath.replaceAll('"', '""')}" "${entry.replaceAll('"', '""')}" %*\r\n`)) return [{path: target, content, kind: 'command-link', external: true}];
    }
    return [];
}

function migrationPlan(options) {
    const source = path.join(componentPaths('skill', options).current, 'slothvault-mcp');
    const links = getComponentStatus('skill', options).state === 'installed' ? managedSkillLinks(options).filter(link => link.source !== source).map(link => ({...link, targetSource: source})) : [];
    const root = slothToolHome(options), legacy = path.join(root, 'runtimes/slothvault/current');
    const dropLegacy = VAULT_COMPONENTS.every(module => getComponentStatus(module, options).state === 'installed') &&
        !skillLinkReferences(options).some(link => inside(link.source, legacy) && !links.some(item => item.path === link.path)) &&
        !managedCommandLinks(options).some(link => link.source?.startsWith(legacy + path.sep) || link.content?.includes(legacy)) && stats(legacy)?.isSymbolicLink();
    return {links, dropLegacy: Boolean(dropLegacy), legacy};
}
function migrateLegacyLinks(options) {
    const plan = migrationPlan(options), errors = [];
    for (const link of plan.links) {
        const temporary = link.path + `.managed-${process.pid}`;
        try {
            fs.symlinkSync(link.targetSource, temporary, (options.platform || process.platform) === 'win32' ? 'junction' : 'dir');
            if ((options.platform || process.platform) === 'win32') fs.unlinkSync(link.path);
            fs.renameSync(temporary, link.path);
        } catch (error) {
            if (!stats(link.path)) try {fs.symlinkSync(link.source, link.path, (options.platform || process.platform) === 'win32' ? 'junction' : 'dir');} catch { /* Report the original migration failure. */ }
            errors.push({path: link.path, code: error.code || 'MIGRATION_FAILED'});
        } finally {try {fs.unlinkSync(temporary);} catch (error) {if (error.code !== 'ENOENT') errors.push({path: temporary, code: error.code});}}
    }
    if (!errors.length && plan.dropLegacy) try {fs.unlinkSync(plan.legacy);} catch (error) {errors.push({path: plan.legacy, code: error.code});}
    return errors;
}

export function assertSlothVaultIdle(options = {}) {
    if (!options.ignoreCleanupLock && stats(path.join(slothToolHome(options), '.slothvault-cleanup-lock'))) throw Object.assign(new Error('SlothVault local cleanup is running.'), {code: 'COMPONENT_BUSY'});
    for (const module of VAULT_COMPONENTS) {
        const lock = path.join(componentPaths(module, options).root, '.operation-lock');
        if (stats(lock)) throw Object.assign(new Error('A SlothVault component operation is running; retry after it finishes.'), {code: 'COMPONENT_BUSY'});
    }
}

/** Prevent package activation and local removal from racing in separate processes. */
export function withSlothVaultStorageLock(options, operation) {
    const root = slothToolHome(options);
    if (!stats(root)) return operation();
    const lock = path.join(root, '.slothvault-cleanup-lock');
    let descriptor;
    try {descriptor = fs.openSync(lock, 'wx');}
    catch (error) {if (error.code === 'EEXIST') throw Object.assign(new Error('SlothVault local cleanup is running.'), {code: 'COMPONENT_BUSY'}); throw error;}
    try {return operation();}
    finally {fs.closeSync(descriptor); fs.unlinkSync(lock);}
}

export function planSlothVaultCleanup(options = {}) {
    const root = slothToolHome(options), runtime = path.join(root, 'runtimes/slothvault');
    const items = [], kept = [], skipped = [], migration = options.uninstall || options.projectMigrations === false ? {links: [], dropLegacy: false} : migrationPlan(options);
    const add = (file, kind) => {
        if (!stats(file)) return;
        if (!safePath(file, root)) {skipped.push({path: file, reason: 'unsafe-parent'}); return;}
        items.push({path: file, kind, bytes: size(file)});
    };
    if (options.uninstall) {
        items.push(...managedSkillLinks(options), ...managedCommandLinks(options));
        add(runtime, 'runtime');
    } else {
        const protectedPaths = new Set();
        for (const link of [...skillLinkReferences(options), ...managedCommandLinks(options)]) {
            const source = migration.links.find(item => item.path === link.path)?.targetSource || link.source;
            if (source) {protectedPaths.add(source); try {protectedPaths.add(fs.realpathSync(source));} catch { /* Dangling link. */ }}
        }
        for (const module of VAULT_COMPONENTS) {
            const paths = componentPaths(module, options);
            if (!safePath(paths.root, root) || stats(paths.root)?.isSymbolicLink()) {if (stats(paths.root)) skipped.push({path: paths.root, reason: 'unsafe-parent'}); continue;}
            try {protectedPaths.add(fs.realpathSync(paths.current));} catch { /* Missing components are safe. */ }
            kept.push({path: paths.current, reason: 'active-component'});
            if (!stats(paths.releases)?.isSymbolicLink() && stats(paths.releases)?.isDirectory()) {
                for (const item of fs.readdirSync(paths.releases, {withFileTypes: true})) {
                    const file = path.join(paths.releases, item.name);
                    if (referenced(file, protectedPaths)) kept.push({path: file, reason: 'referenced'});
                    else if (item.isDirectory() && ownedRelease(file, module)) add(file, 'old-release');
                    else skipped.push({path: file, reason: 'unverified-content'});
                }
            }
            if (stats(paths.root)?.isDirectory()) for (const item of fs.readdirSync(paths.root, {withFileTypes: true})) {
                const file = path.join(paths.root, item.name);
                if (/^\.(stage|previous|current)-/u.test(item.name)) {
                    if (referenced(file, protectedPaths)) kept.push({path: file, reason: 'referenced'});
                    else add(file, 'temporary');
                }
            }
        }
        const legacy = path.join(runtime, 'releases');
        if (safePath(legacy, root) && !stats(legacy)?.isSymbolicLink() && stats(legacy)?.isDirectory()) for (const item of fs.readdirSync(legacy, {withFileTypes: true})) {
            const file = path.join(legacy, item.name);
            let active = false;
            try {active = fs.realpathSync(path.join(runtime, 'current')) === fs.realpathSync(file);} catch { /* No legacy pointer. */ }
            if (referenced(file, protectedPaths) || active && !migration.dropLegacy) kept.push({path: file, reason: 'referenced'});
            else if (item.isDirectory() && ownedRelease(file)) add(file, 'legacy-release');
            else skipped.push({path: file, reason: 'unverified-content'});
        }
        const legacyPlugin = path.join(root, 'plugins/slothvault-mcp');
        if (safePath(legacyPlugin, root) && !stats(legacyPlugin)?.isSymbolicLink() && metadata(path.join(legacyPlugin, 'package.json'))?.name === '@holic512/plugin-slothvault-mcp') {
            if (referenced(legacyPlugin, protectedPaths)) kept.push({path: legacyPlugin, reason: 'referenced'});
            else add(legacyPlugin, 'legacy-installation');
        }
        if (migration.dropLegacy) add(migration.legacy, 'legacy-pointer');
        if (safePath(runtime, root) && stats(runtime)?.isDirectory()) for (const item of fs.readdirSync(runtime, {withFileTypes: true})) {
            const file = path.join(runtime, item.name);
            if (/^\.(stage|previous|current)-/u.test(item.name)) {
                if (referenced(file, protectedPaths)) kept.push({path: file, reason: 'referenced'});
                else add(file, 'temporary');
            }
        }
    }
    if (options.purgeData !== false) {
        const files = options.uninstall ? slothVaultDataPaths(options) : ['slothvault', 'slothvault-mcp'].flatMap(alias => [
            path.join(root, 'plugin-configs', alias + '.json'), path.join(root, 'data/plugin-configs', alias + '.json'),
            path.join(root, 'data', alias, 'history.json'), path.join(root, 'cache', alias)
        ]);
        for (const file of files) add(file, 'client-data');
    }
    return {items, kept, skipped, migrations: migration.links, count: items.length, bytes: items.reduce((total, item) => total + (item.bytes || 0), 0), clearsProfiles: options.purgeData !== false};
}

export function cleanupSlothVault(options = {}) {
    if (options.dryRun) {assertSlothVaultIdle(options); return {...planSlothVaultCleanup(options), status: 'preview'};}
    return withSlothVaultStorageLock(options, () => executeCleanup(options));
}

function executeCleanup(options) {
    assertSlothVaultIdle({...options, ignoreCleanupLock: true});
    const migrationErrors = !options.uninstall && !options.dryRun ? migrateLegacyLinks(options) : [];
    const preview = planSlothVaultCleanup({...options, projectMigrations: options.dryRun});
    if (options.dryRun) return {...preview, status: 'preview'};
    const removed = [], errors = [...migrationErrors], skipped = [...preview.skipped];
    if (options.uninstall) errors.push(...preview.skipped.map(item => ({...item, code: 'CLEANUP_PATH_UNSAFE'})));
    for (const item of preview.items) {
        try {
            if (item.external) {
                const valid = [...managedSkillLinks(options), ...managedCommandLinks(options)].some(candidate => candidate.path === item.path && candidate.source === item.source && candidate.content === item.content);
                if (!valid) {skipped.push({path: item.path, reason: 'ownership-changed'}); continue;}
                fs.unlinkSync(item.path);
            } else {
                if (options.uninstall && item.kind === 'runtime' && (errors.length || managedSkillLinks(options).length || managedCommandLinks(options).length)) {
                    errors.push({path: item.path, code: 'LINK_CLEANUP_INCOMPLETE'}); continue;
                }
                if (!safePath(item.path, slothToolHome(options))) throw new Error('Unsafe cleanup path.');
                fs.rmSync(item.path, {recursive: true, force: true});
            }
            removed.push(item);
            try {options.onEvent?.({type: 'progress', phase: 'cleanup', current: removed.length, total: preview.count, unit: 'items'});} catch { /* Presentation cannot change cleanup ownership or outcome. */ }
        } catch (error) {errors.push({path: item.path, code: error.code || 'CLEANUP_FAILED'});}
    }
    return {...preview, status: errors.length ? 'partial' : 'completed', removed, errors, skipped};
}
