/**
 * @file SyncTuiInteraction
 * @project SlothTool
 * @module Build / Official Plugin Packaging
 * @description 将根包维护的无依赖 TUI 交互源码复制到各官方插件，确保独立发行包可运行。
 * @logic 读取单一维护源码；验证模式比较字节；同步模式写入每个插件的 lib 目录。
 * @dependencies Node.js fs/path/url
 * @index_tags TUI, 插件打包, 源码分发
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'lib/tui/shared-interaction.js'));
const plugins = ['loc', 'image-compress', 'gstore', 'pzip', 'slothvault'];
const check = process.argv.includes('--check');
let stale = false;
for (const plugin of plugins) {
    const target = path.join(root, 'plugins', plugin, 'lib/shared-interaction.js');
    if (check) {
        if (!fs.existsSync(target) || !fs.readFileSync(target).equals(source)) {
            console.error(`Out of sync: ${target}`);
            stale = true;
        }
    } else {
        fs.writeFileSync(target, source);
    }
}
if (stale) process.exitCode = 1;
