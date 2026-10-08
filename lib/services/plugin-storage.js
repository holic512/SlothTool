/**
 * @file plugin-storage.js
 * @project SlothTool
 * @module Plugin storage ownership
 * @description Centralizes actual and legacy plugin-owned configuration, data and cache paths for uninstall previews.
 * @logic Resolve known aliases to fixed owned paths and reject deletions through symbolic-link parents.
 * @dependencies Node fs/path, SlothTool path utilities
 * @index_tags plugin,storage,ownership,uninstall,data-policy
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {getSlothToolHome} from '../utils.js';

export function pluginDataPaths(alias, root = getSlothToolHome()) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(alias)) throw new Error('Invalid plugin storage alias.');
    const names = alias === 'slothvault' ? ['slothvault', 'slothvault-mcp'] : [alias];
    return names.flatMap(name => [path.join(root, 'plugin-configs', name + '.json'),
        path.join(root, 'data/plugin-configs', name + '.json'), path.join(root, 'data', name), path.join(root, 'cache', name)]);
}
export function removeOwnedPath(file, root) {
    const relative = path.relative(root, file);
    if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new Error('Unsafe plugin cleanup path.');
    for (let parent = path.dirname(file); parent !== root; parent = path.dirname(parent)) {
        try {if (fs.lstatSync(parent).isSymbolicLink()) throw new Error('Plugin cleanup parent is a symbolic link.');}
        catch (error) {if (error.code !== 'ENOENT') throw error;}
    }
    try {fs.lstatSync(file);} catch (error) {if (error.code === 'ENOENT') return false; throw error;}
    fs.rmSync(file, {recursive: true, force: true});
    return true;
}
