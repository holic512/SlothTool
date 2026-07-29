/**
 * @file SlothToolCommandIndex
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 汇总 SlothTool CLI 命令模块，包括在线/离线安装与离线归档，供 bin 入口统一分发。
 * @logic 1. 聚合各子命令；2. 暴露 bundle 与 install --file 能力；3. 保持命令分发层简洁并为库入口统一导出。
 * @dependencies Commands: install/bundle/list/run/config/interactive/update/uninstall/self-update/uninstall-all
 * @index_tags 命令索引, CLI分发, 离线安装, bundle, 模块导出
 * @author holic512
 */

import bundle from './bundle.js';
import config from './config.js';
import install from './install.js';
import interactive from './interactive.js';
import list from './list.js';
import run from './run.js';
import selfUpdate from './self-update.js';
import uninstall from './uninstall.js';
import uninstallAll from './uninstall-all.js';
import update from './update.js';
import updateAll from './update-all.js';

export {
    bundle,
    config,
    install,
    interactive,
    list,
    run,
    selfUpdate,
    uninstall,
    uninstallAll,
    update,
    updateAll
};

export default {
    bundle,
    config,
    install,
    interactive,
    list,
    run,
    selfUpdate,
    uninstall,
    uninstallAll,
    update,
    updateAll
};
