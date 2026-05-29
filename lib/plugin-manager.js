/**
 * @file SlothToolPluginManagerCompat
 * @project SlothTool
 * @module Core CLI / Compatibility
 * @description 为历史导入路径保留插件管理器导出，内部直接转发到新的 service 层。
 * @logic 1. 兼容旧的 ./plugin-manager.js 引用；2. 将生命周期接口重新导出到新的 plugin service。
 * @dependencies Service: ./services/plugin-service.js
 * @index_tags 兼容层, plugin-manager, service转发
 * @author holic512
 */

export {
    createCliError,
    describeUninstallAll,
    getOfficialPlugin,
    getOfficialPluginAliases,
    getOfficialPlugins,
    installPlugin,
    isOfficialPlugin,
    listInstalledPlugins,
    readInstalledPluginUi,
    resolvePluginLaunch,
    runInstalledPlugin,
    uninstallAllData,
    uninstallPlugin,
    updateAllPlugins,
    updatePlugin,
    updateSelf
} from './services/plugin-service.js';
