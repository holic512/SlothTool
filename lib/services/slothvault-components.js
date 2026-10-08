/**
 * @file slothvault-components.js
 * @project SlothTool
 * @module SlothVault explicit compatibility adapter
 * @description Preserves explicit module commands while keeping root plugin management independent of Vault Releases.
 * @logic Reject retired module requests before loading installed code, manage only current components, and clean local ownership without Python.
 * @dependencies Node fs/path/url, SlothVault paths and storage
 * @index_tags slothvault,compatibility,module,cleanup
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getPluginDir} from '../utils.js';
import {cleanupSlothVault} from './slothvault-storage.js';
import {VAULT_COMPONENTS} from './slothvault-paths.js';
export {VAULT_COMPONENTS, componentPaths, installedComponent} from './slothvault-paths.js';
async function service(options = {}, modules = VAULT_COMPONENTS) {
    for (const module of modules) if (!VAULT_COMPONENTS.includes(module)) throw new Error(`Unknown SlothVault component: ${module}`);
    const root = options.pluginDir || getPluginDir('slothvault');
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (meta.name !== '@holic512/plugin-slothvault' || !meta.bin?.slothvault) throw new Error('Update the SlothVault interface before managing components.');
    return import(pathToFileURL(path.join(root, 'lib/component-service.js')).href);
}
export const fetchComponentRelease = async (module, options = {}) => (await service(options, [module])).fetchComponentRelease(module, options);
export const checkComponentUpdate = async (module, options = {}) => (await service(options, [module])).checkComponentUpdate(module, options);
export async function checkAllComponentUpdates(options = {}) {
    const installed = await service(options);
    const components = await Promise.all(VAULT_COMPONENTS.map(module => installed.checkComponentUpdate(module, options)));
    return {components, status: components.some(item => item.status === 'error') ? 'error'
        : components.some(item => item.status === 'outdated') ? 'outdated' : 'latest'};
}
export const installComponents = async (modules = [], options = {}) => (await service(options, modules)).installComponents(modules, options);
export function uninstallComponents(options = {}) {
    const result = cleanupSlothVault({...options, uninstall: true, purgeData: false});
    if (result.errors.length) throw Object.assign(new Error('Some SlothVault runtime files could not be removed.'), {result});
    return {...result, status: 'uninstalled'};
}
