/**
 * @file SlothToolLibraryEntry
 * @project SlothTool
 * @module Core CLI / Library Entry
 * @description 提供 SlothTool 核心模块的统一导出，作为 npm 包的有效 main 入口。
 * @logic 1. 导出命令集合；2. 导出插件管理与基础服务模块；3. 让根包 main 指向有效文件。
 * @dependencies Modules: commands, plugin-manager, registry, settings, utils
 * @index_tags 根入口, npm main, 模块导出, CLI核心
 * @author holic512
 */

module.exports = {
    commands: require('./commands'),
    pluginManager: require('./plugin-manager'),
    registry: require('./registry'),
    settings: require('./settings'),
    utils: require('./utils')
};
