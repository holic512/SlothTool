/**
 * @file SlothToolLibraryEntry
 * @project SlothTool
 * @module Core CLI / Library Entry
 * @description 提供 SlothTool 根包的统一导出，暴露命令、服务和基础存储模块。
 * @logic 1. 聚合命令模块；2. 导出新的插件 service 与存储层；3. 保持 npm main 指向有效入口。
 * @dependencies Modules: ./commands/index.js, ./plugin-manager.js, ./registry.js, ./settings.js, ./utils.js
 * @index_tags 根入口, ESM导出, service入口
 * @author holic512
 */

import * as commands from './commands/index.js';
import * as pluginManager from './plugin-manager.js';
import registry from './registry.js';
import settings from './settings.js';
import * as utils from './utils.js';

export {
    commands,
    pluginManager,
    registry,
    settings,
    utils
};

export default {
    commands,
    pluginManager,
    registry,
    settings,
    utils
};
