/**
 * @file slothvault-paths.js
 * @project SlothTool
 * @module SlothVault component paths
 * @description Resolves independent component locations without importing MCP or UI services.
 * @logic Resolve fixed managed paths, inspect module metadata and required entrypoints, and report missing or invalid components locally.
 * @dependencies Node fs/os/path
 * @index_tags slothvault,components,paths,status
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const VAULT_COMPONENTS = Object.freeze(['mcp-client', 'skill', 'deployment']);
export const BRIDGE_MAJOR = Object.freeze({'mcp-client': 2, skill: 1, deployment: 1});
export function slothToolHome(options = {}) {return path.resolve(options.slothToolHome || path.join(options.homeDir || os.homedir(), '.pipker', 'slothtool'));}
export function componentPaths(module, options = {}) {
    if (!VAULT_COMPONENTS.includes(module)) throw new Error(`Unknown SlothVault component: ${module}`);
    const root = path.join(slothToolHome(options), 'runtimes', 'slothvault', 'components', module);
    return {root, releases: path.join(root, 'releases'), current: path.join(root, 'current')};
}
export function getComponentRoot(module, options = {}) {
    const environment = options.env || process.env;
    return path.resolve(options.runtimeRoot || environment[`SLOTHTOOL_SLOTHVAULT_${module.toUpperCase().replace('-', '_')}_ROOT`] || componentPaths(module, options).current);
}
export function getComponentStatus(module, options = {}) {
    const root = getComponentRoot(module, options);
    let meta;
    try {meta = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));}
    catch (error) {return {module, path: root, currentVersion: null, state: error.code === 'ENOENT' && !fs.existsSync(root) ? 'missing' : 'invalid'};}
    const required = module === 'skill' ? ['slothvault-mcp/SKILL.md'] : module === 'deployment' ? ['install.py']
        : ['slothvault_mcp.py', '.venv/' + (process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')];
    let valid = meta.schema === 1 && meta.module === module && /^\d+\.\d+\.\d+$/u.test(meta.version || '') && meta.bridgeApiMajor === BRIDGE_MAJOR[module] && required.every(file => fs.existsSync(path.join(root, file)));
    const receipt = path.join(componentPaths(module, options).root, `.verified-${meta.version}.json`);
    if (valid && fs.existsSync(receipt)) try {
        const manifest = JSON.parse(fs.readFileSync(receipt, 'utf8'));
        valid = manifest.module === module && manifest.version === meta.version && Object.entries(manifest.files).every(([file, digest]) =>
            !path.isAbsolute(file) && !file.includes('\\') && !file.includes(':') && file.split('/').every(part => part && part !== '..' && part !== '.') &&
            createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') === digest);
    } catch {valid = false;}
    return {module, path: root, currentVersion: meta.module === module ? meta.version : null, bridgeApiMajor: meta.bridgeApiMajor, state: valid ? 'installed' : 'invalid'};
}
export function getComponentVersion(module, options = {}) {return getComponentStatus(module, options).currentVersion;}
export function installedComponent(module, options = {}) {
    const item = getComponentStatus(module, options);
    return item.currentVersion ? {...item, version: item.currentVersion} : null;
}
