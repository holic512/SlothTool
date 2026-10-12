/**
 * @file sync-storage-manifests.js
 * @project SlothTool
 * @module Storage manifest packaging
 * @description Keeps reviewed official plugin declarations available in the standalone root package.
 * @logic Validate package identity and declaration paths, then copy or compare the bundled manifests.
 * @dependencies Node fs/path/url, storage manifest validator
 * @index_tags storage,manifest,packaging,sync
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateStorageManifest, bundledStorageManifest, STORAGE_ALIASES} from '../lib/services/storage-manifest.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const alias of ['loc', 'image-compress', 'gstore', 'pzip', 'slothvault']) {
    const directory = path.join(root, 'plugins', alias);
    const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (pkg.slothtool?.storageManifest !== 'lib/storage-manifest.json') throw new Error(`Missing storage declaration: ${alias}`);
    const source = fs.readFileSync(path.join(directory, pkg.slothtool.storageManifest));
    const manifest = validateStorageManifest(JSON.parse(source), alias);
    if (pkg.name !== manifest.packageName) throw new Error(`Storage identity mismatch: ${alias}`);
    const target = path.join(root, 'lib/storage-manifests', alias + '.json');
    if (process.argv.includes('--check')) {
        if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target))) {console.error(`Out of sync: ${target}`); process.exitCode = 1;}
    } else fs.writeFileSync(target, source);
}
for (const alias of STORAGE_ALIASES) bundledStorageManifest(alias);
