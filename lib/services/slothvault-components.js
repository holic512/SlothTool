/**
 * @file slothvault-components.js
 * @project SlothTool
 * @module SlothVault explicit compatibility adapter
 * @description Preserves explicit module commands while keeping root plugin management independent of Vault Releases.
 * @logic Load the validated installed plugin only for requested component operations; clean local ownership without Python.
 * @dependencies Node fs/path/url, SlothVault paths and storage
 * @index_tags slothvault,compatibility,module,cleanup
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getPluginDir} from '../utils.js';
import {cleanupSlothVault} from './slothvault-storage.js';
export {VAULT_COMPONENTS, componentPaths, installedComponent} from './slothvault-paths.js';
async function service(options = {}) {
    const root = options.pluginDir || getPluginDir('slothvault');
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (meta.name !== '@holic512/plugin-slothvault' || !meta.bin?.slothvault || !meta.bin?.['slothvault-mcp']) throw new Error('Update the SlothVault interface before managing components.');
    return import(pathToFileURL(path.join(root, 'lib/component-service.js')).href);
}
export const fetchComponentRelease = async (module, options = {}) => (await service(options)).fetchComponentRelease(module, options);
export const checkComponentUpdate = async (module, options = {}) => (await service(options)).checkComponentUpdate(module, options);
export const checkAllComponentUpdates = async (options = {}) => (await service(options)).checkAllComponentUpdates(options);
export const installComponents = async (modules = [], options = {}) => (await service(options)).installComponents(modules, options);
export const installPythonDependencies = async (root, options = {}) => (await service(options)).installPythonDependencies(root, options);
export function uninstallComponents(options = {}) {
    const result = cleanupSlothVault({...options, uninstall: true, purgeData: false});
    if (result.errors.length) throw Object.assign(new Error('Some SlothVault runtime files could not be removed.'), {result});
    return {...result, status: 'uninstalled'};
}
