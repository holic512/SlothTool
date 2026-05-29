/**
 * @file SlothToolCommandIndex
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 汇总 SlothTool CLI 命令模块，供 bin 入口统一分发。
 * @logic 1. 聚合各子命令；2. 保持命令分发层简洁；3. 为库入口提供统一导出。
 * @dependencies Commands: install/list/run/config/interactive/update/uninstall/self-update/uninstall-all
 * @index_tags 命令索引, CLI分发, 模块导出
 * @author holic512
 */

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
