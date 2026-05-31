/**
 * @file SlothToolPluginManagerCompat
 * @project SlothTool
 * @module Core CLI / Compatibility
 * @description 为历史导入路径保留插件管理器导出，内部直接转发生命周期与系统环境探测接口。
 * @logic 1. 兼容旧的 ./plugin-manager.js 引用；2. 将插件生命周期接口转发到 plugin service；3. 将系统环境探测接口转发给后续安装流程复用。
 * @dependencies Service: ./services/plugin-service.js, ./services/system-environment.js
 * @index_tags 兼容层, plugin-manager, service转发, 系统环境探测
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

export {
    getSystemEnvironment,
    normalizeSystemArchitecture,
    normalizeSystemPlatform
} from './services/system-environment.js';
