/**
 * @file storage-manifest.js
 * @project SlothTool
 * @module Storage ownership declarations
 * @description Validates bundled and installed official storage declarations without running plugin code.
 * @logic Restrict identities and resources to reviewed paths; use bundled compatibility declarations for older packages.
 * @dependencies Node fs/os/path, official plugin catalog
 * @index_tags storage,manifest,ownership,compatibility
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const STORAGE_ALIASES = ['slothtool', 'loc', 'image-compress', 'gstore', 'pzip', 'slothvault', 'todo', 'codex-models'];
const manifestDirectory = fileURLToPath(new URL('../storage-manifests/', import.meta.url));
const allowedPaths = {
    slothtool: ['settings.json', 'registry.json', 'data', 'plugins'],
    loc: ['data/plugin-configs/loc.json', 'plugin-configs/loc.json'],
    gstore: ['plugin-configs/gstore.json', 'cache/gstore/repository', 'data/.git'],
    pzip: ['plugin-configs/pzip.json'],
    'image-compress': [],
    slothvault: ['runtimes/slothvault', ...['slothvault', 'slothvault-mcp'].flatMap(alias => [
        `plugin-configs/${alias}.json`, `data/plugin-configs/${alias}.json`, `data/${alias}/history.json`
    ])],
    todo: ['data/plugin-configs/todo.json', 'data/todo'],
    'codex-models': ['data/codex-models/repair-codex-desktop-model-filter.mjs']
};
const fail = () => {throw Object.assign(new Error('Invalid storage ownership manifest.'), {code: 'INVALID_STORAGE_MANIFEST'});};
function fields(value, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail();
}
export function validateStorageManifest(manifest, alias) {
    fields(manifest, ['schemaVersion', 'alias', 'packageName', 'resources', 'retired', 'externalStorage']);
    const packageName = alias === 'slothtool' ? '@holic512/slothtool' : `@holic512/plugin-${alias}`;
    if (!STORAGE_ALIASES.includes(alias) || manifest.schemaVersion !== 1 || manifest.alias !== alias || manifest.packageName !== packageName || !Array.isArray(manifest.resources)) fail();
    if (manifest.retired !== undefined && manifest.retired !== ['todo', 'codex-models'].includes(alias)) fail();
    if (manifest.externalStorage !== undefined && (!Array.isArray(manifest.externalStorage) || manifest.externalStorage.some(value => typeof value !== 'string'))) fail();
    const ids = new Set();
    for (const item of manifest.resources) {
        fields(item, ['id', 'root', 'path', 'kind', 'state', 'cleanup', 'replacement', 'inactiveSince']);
        if (typeof item.id !== 'string' || !/^[a-z0-9-]+$/u.test(item.id) || ids.has(item.id)) fail();
        ids.add(item.id);
        if (!['slothtool', 'legacy-slothtool'].includes(item.root) || typeof item.path !== 'string' ||
            item.path.includes('\\') || item.path.includes(':') || item.path.includes('\0') ||
            item.path.split('/').some(part => !part || part === '.' || part === '..') || !allowedPaths[alias].includes(item.path)) fail();
        if (!['config', 'registry', 'repository', 'runtime', 'history', 'user-data', 'installation', 'generated-script'].includes(item.kind) ||
            !['active', 'legacy', 'user-data'].includes(item.state) || !['never', 'duplicate', 'retired'].includes(item.cleanup)) fail();
        if (item.cleanup !== 'never' && item.state !== 'legacy') fail();
        if (['repository', 'runtime', 'user-data', 'installation'].includes(item.kind) && item.cleanup !== 'never') fail();
        if (item.inactiveSince !== undefined && (alias !== 'slothvault' || item.inactiveSince !== '3.0.0')) fail();
    }
    for (const item of manifest.resources) {
        if (item.cleanup === 'duplicate' && (!item.replacement || !ids.has(item.replacement) || manifest.resources.find(value => value.id === item.replacement)?.cleanup !== 'never')) fail();
        if (item.cleanup !== 'duplicate' && item.replacement !== undefined) fail();
    }
    return manifest;
}
export function storageRoots(options = {}) {
    const home = path.resolve(options.homeDir || os.homedir());
    return {slothtool: path.resolve(options.slothToolHome || path.join(home, '.pipker/slothtool')), 'legacy-slothtool': path.join(home, '.slothtool')};
}
export function storageStats(file) {
    try {return fs.lstatSync(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
export function safeStoragePath(file, root) {
    const relative = path.relative(root, file);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return false;
    if (storageStats(root)?.isSymbolicLink() || storageStats(path.dirname(root))?.isSymbolicLink()) return false;
    for (let parent = path.dirname(file); parent !== root; parent = path.dirname(parent)) {
        if (storageStats(parent)?.isSymbolicLink()) return false;
    }
    return true;
}
export function bundledStorageManifest(alias) {
    return validateStorageManifest(JSON.parse(fs.readFileSync(path.join(manifestDirectory, alias + '.json'), 'utf8')), alias);
}

/** A package may describe storage; it cannot widen the root manager's deletion authority. */
export function checkInstalledManifest(directory, manifest, root) {
    const packageFile = path.join(directory, 'package.json');
    if (!safeStoragePath(packageFile, root) || storageStats(directory)?.isSymbolicLink() || storageStats(packageFile)?.isSymbolicLink()) fail();
    const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    if (pkg.name !== manifest.packageName) fail();
    const declaration = pkg.slothtool?.storageManifest;
    if (declaration === undefined) return {version: pkg.version, source: 'bundled-compatibility'};
    if (declaration !== 'lib/storage-manifest.json') fail();
    const file = path.join(directory, declaration);
    if (!safeStoragePath(file, root) || storageStats(file)?.isSymbolicLink()) fail();
    const installed = validateStorageManifest(JSON.parse(fs.readFileSync(file, 'utf8')), manifest.alias);
    if (JSON.stringify(installed) !== JSON.stringify(manifest)) fail();
    return {version: pkg.version, source: 'installed-manifest'};
}
