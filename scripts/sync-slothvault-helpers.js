/**
 * @file sync-slothvault-helpers.js
 * @project SlothTool
 * @module Standalone SlothVault packaging
 * @description Keeps framework-owned transport and local cleanup utilities in standalone plugin archives.
 * @logic Copy canonical service utilities into the plugin, or compare their bytes in check mode.
 * @dependencies Node fs/path/url
 * @index_tags slothvault,packaging,shared,transport,cleanup
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const name of ['release-client.js', 'network-helper.js', 'slothvault-paths.js', 'slothvault-storage.js']) {
    const source = fs.readFileSync(path.join(root, 'lib/services', name));
    const target = path.join(root, 'plugins/slothvault/lib', name);
    if (process.argv.includes('--check')) {
        if (!fs.existsSync(target) || !fs.readFileSync(target).equals(source)) {console.error(`Out of sync: ${target}`); process.exitCode = 1;}
    } else fs.writeFileSync(target, source);
}
