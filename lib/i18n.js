/**
 * @file SlothToolI18n
 * @project SlothTool
 * @module Core CLI / Internationalization
 * @description 维护 SlothTool 核心命令的中英文文案，包括 GitHub Release 安装更新相关提示。
 * @logic 1. 按语言读取消息字典；2. 支持点路径取值；3. 对动态参数执行模板替换。
 * @dependencies Service: settings
 * @index_tags i18n, 双语文案, GitHub Release, CLI提示
 * @author holic512
 */

const settings = require('./settings');

const messages = {
    zh: {
        // 通用
        pluginManager: '🐌 SlothTool - 插件管理器',

        // 帮助信息
        usage: '用法：',
        examples: '示例：',
        commands: {
            install: '安装插件',
            uninstall: '卸载插件',
            update: '更新插件',
            updateAll: '更新所有插件',
            list: '列出已安装的插件',
            run: '运行插件',
            runShorthand: '运行插件（简写）',
            config: '配置语言设置',
            interactive: '交互式模式',
            uninstallAll: '完全卸载 SlothTool（删除所有数据）',
            selfUpdate: '更新 SlothTool（本体）'
        },

        // 安装
        installing: '正在安装插件：',
        alreadyInstalled: '插件 "{alias}" 已经安装。',
        uninstallFirst: '如果要重新安装，请先运行 "slothtool uninstall {alias}"。',
        installingTo: '安装到：',
        installSuccess: '\n✓ 插件 "{alias}" 安装成功！',
        installRun: '  运行：slothtool {alias} --help',
        installFailed: '\n✗ 安装插件 "{packageName}" 失败：',
        officialPluginOnly: '错误："{alias}" 不是内置官方插件别名。可用插件：{aliases}',
        downloadingAsset: '正在下载发布资产：{assetName}',
        installingDependencies: '正在安装插件运行时依赖...',

        // 卸载
        uninstalling: '正在卸载插件：',
        notInstalled: '插件 "{alias}" 未安装。',
        uninstallSuccess: '✓ 插件 "{alias}" 卸载成功！',
        uninstallFailed: '✗ 卸载插件 "{alias}" 失败：',
        uninstallWillRemove: '\n将删除以下内容：',
        uninstallPluginDir: '  • 插件目录：{dir}',
        uninstallConfigFile: '  • 配置文件：{file}',
        uninstallRegistryEntry: '  • 注册表条目',
        uninstallNoConfig: '  • 无配置文件',

        // 更新
        updating: '正在更新插件：',
        currentVersion: '当前版本：',
        checkingUpdates: '正在检查更新...',
        alreadyLatest: '✓ 插件 "{alias}" 已经是最新版本 {version}',
        updateSuccess: '✓ 插件 "{alias}" 更新成功！{oldVersion} → {newVersion}',
        migrationSuccess: '✓ 插件 "{alias}" 已迁移到 GitHub Release 来源，当前版本 {version}',
        updateFailed: '✗ 更新插件 "{alias}" 失败：',
        specifyPluginToUpdate: '错误：请指定要更新的插件。',
        updateUsage: '用法：slothtool update <插件别名>',

        // 自更新
        selfUpdate: {
            starting: '正在更新 SlothTool...',
            success: '✓ SlothTool 更新完成！',
            failed: '✗ 更新 SlothTool 失败：'
        },

        // 更新所有插件
        updateAll: {
            title: '\n📦 更新所有插件',
            foundPlugins: '找到 {count} 个已安装的插件',
            summary: '\n更新摘要：',
            totalPlugins: '  总插件数：{count}',
            updated: '  ✓ 已更新：{count}',
            alreadyLatest: '  ✓ 已是最新：{count}',
            failed: '  ✗ 更新失败：{count}'
        },

        // 完全卸载
        uninstallAll: {
            title: '\n🗑️  完全卸载 SlothTool',
            warning: '\n⚠️  警告：此操作将删除所有 SlothTool 数据！',
            willRemove: '\n将删除以下内容：',
            slothtoolDir: '  • SlothTool 目录：{dir}',
            allPlugins: '  • 所有已安装的插件 ({count} 个)',
            allConfigs: '  • 所有插件配置文件',
            registry: '  • 插件注册表',
            settings: '  • 用户设置',
            confirm: '\n确认删除所有数据？',
            confirmPrompt: '输入 "yes" 确认：',
            cancelled: '\n操作已取消。',
            removing: '\n正在删除 SlothTool 数据...',
            success: '\n✓ SlothTool 数据已完全删除！',
            nextStep: '\n如需卸载 SlothTool 命令行工具，请运行：',
            npmUninstall: '  npm uninstall -g @holic512/slothtool',
            failed: '\n✗ 删除失败：',
            noData: '\nSlothTool 数据目录不存在：{dir}',
            alreadyClean: '系统已经是干净的状态。'
        },

        // 列表
        installedPlugins: '已安装的插件：',
        noPlugins: '未安装任何插件。',
        installExample: '\n安装官方插件示例：',
        sources: {
            githubRelease: 'GitHub Release',
            npmRegistry: 'npm registry（遗留）'
        },

        // 运行
        specifyPlugin: '错误：请指定要运行的插件。',
        pluginNotFound: '错误：未找到插件 "{pluginAlias}"。',
        seeInstalled: '\n运行 "slothtool list" 查看已安装的插件。',
        orInstall: '或使用以下命令安装官方插件：slothtool install <插件别名>',
        failedToRun: '运行插件 "{pluginAlias}" 失败：',

        // 配置
        currentLanguage: '当前语言：',
        languageSet: '语言已设置为：',
        invalidLanguage: '无效的语言。请使用 "zh" 或 "en"。',
        configUsage: '用法：slothtool config language <zh|en>',

        // 交互式模式
        interactive: {
            mainMenu: '请选择操作：',
            installPlugin: '安装官方插件',
            installOfficial: '安装官方插件',
            uninstallPlugin: '卸载插件',
            updateMenu: '更新',
            updateSelf: '更新 SlothTool',
            updatePlugin: '更新单个插件',
            updateAllPlugins: '更新所有插件',
            listPlugins: '查看已安装的插件',
            runPlugin: '运行插件',
            configLanguage: '配置语言',
            uninstallAll: '完全卸载 SlothTool（删除所有数据）',
            exit: '退出',

            selectPlugin: '选择插件：',
            selectOfficialPlugin: '选择要安装的官方插件：',
            selectPluginToUpdate: '选择要更新的插件：',
            enterPluginAlias: '请输入插件别名：',
            selectLanguage: '选择语言：',

            noPluginsToUninstall: '没有已安装的插件可以卸载。',
            noPluginsToUpdate: '没有已安装的插件可以更新。',
            noPluginsToRun: '没有已安装的插件可以运行。',

            pluginInfo: '插件信息',
            features: '功能特性：',
            author: '作者：',
            version: '版本：',

            confirmInstall: '确认安装 {name}？',
            confirmUninstall: '确认卸载 {alias}？',
            confirmUpdate: '确认更新 {alias}？',
            confirmUpdateAll: '确认更新所有 {count} 个插件？',
            confirmUpdateSelf: '确认更新 SlothTool？',

            runWithArgs: '是否要运行此插件？',
            enterArgs: '请输入运行参数（留空表示无参数）：',

            operationCancelled: '操作已取消。',
            pressEnterToContinue: '\n按回车键继续...'
        }
    },

    en: {
        // Common
        pluginManager: '🐌 SlothTool - Plugin Manager',

        // Help
        usage: 'Usage:',
        examples: 'Examples:',
        commands: {
            install: 'Install a plugin',
            uninstall: 'Uninstall a plugin',
            update: 'Update a plugin',
            updateAll: 'Update all plugins',
            list: 'List installed plugins',
            run: 'Run a plugin',
            runShorthand: 'Run a plugin (shorthand)',
            config: 'Configure language settings',
            interactive: 'Interactive mode',
            uninstallAll: 'Complete uninstall (remove all data)',
            selfUpdate: 'Update SlothTool (self-update)'
        },

        // Install
        installing: 'Installing plugin:',
        alreadyInstalled: 'Plugin "{alias}" is already installed.',
        uninstallFirst: 'Run "slothtool uninstall {alias}" first if you want to reinstall.',
        installingTo: 'Installing to:',
        installSuccess: '\n✓ Plugin "{alias}" installed successfully!',
        installRun: '  Run: slothtool {alias} --help',
        installFailed: '\n✗ Failed to install plugin "{packageName}":',
        officialPluginOnly: 'Error: "{alias}" is not an official plugin alias. Available plugins: {aliases}',
        downloadingAsset: 'Downloading release asset: {assetName}',
        installingDependencies: 'Installing runtime dependencies...',

        // Uninstall
        uninstalling: 'Uninstalling plugin:',
        notInstalled: 'Plugin "{alias}" is not installed.',
        uninstallSuccess: '✓ Plugin "{alias}" uninstalled successfully!',
        uninstallFailed: '✗ Failed to uninstall plugin "{alias}":',
        uninstallWillRemove: '\nThe following will be removed:',
        uninstallPluginDir: '  • Plugin directory: {dir}',
        uninstallConfigFile: '  • Config file: {file}',
        uninstallRegistryEntry: '  • Registry entry',
        uninstallNoConfig: '  • No config file',

        // Update
        updating: 'Updating plugin:',
        currentVersion: 'Current version:',
        checkingUpdates: 'Checking for updates...',
        alreadyLatest: '✓ Plugin "{alias}" is already at the latest version {version}',
        updateSuccess: '✓ Plugin "{alias}" updated successfully! {oldVersion} → {newVersion}',
        migrationSuccess: '✓ Plugin "{alias}" migrated to GitHub Release source at version {version}',
        updateFailed: '✗ Failed to update plugin "{alias}":',
        specifyPluginToUpdate: 'Error: Please specify a plugin to update.',
        updateUsage: 'Usage: slothtool update <plugin-alias>',

        // Self update
        selfUpdate: {
            starting: 'Updating SlothTool...',
            success: '✓ SlothTool updated successfully!',
            failed: '✗ Failed to update SlothTool:'
        },

        // Update all plugins
        updateAll: {
            title: '\n📦 Update All Plugins',
            foundPlugins: 'Found {count} installed plugins',
            summary: '\nUpdate Summary:',
            totalPlugins: '  Total plugins: {count}',
            updated: '  ✓ Updated: {count}',
            alreadyLatest: '  ✓ Already latest: {count}',
            failed: '  ✗ Failed: {count}'
        },

        // Complete uninstall
        uninstallAll: {
            title: '\n🗑️  Complete SlothTool Uninstallation',
            warning: '\n⚠️  Warning: This will delete all SlothTool data!',
            willRemove: '\nThe following will be removed:',
            slothtoolDir: '  • SlothTool directory: {dir}',
            allPlugins: '  • All installed plugins ({count} plugins)',
            allConfigs: '  • All plugin configuration files',
            registry: '  • Plugin registry',
            settings: '  • User settings',
            confirm: '\nConfirm deletion of all data?',
            confirmPrompt: 'Type "yes" to confirm: ',
            cancelled: '\nOperation cancelled.',
            removing: '\nRemoving SlothTool data...',
            success: '\n✓ SlothTool data completely removed!',
            nextStep: '\nTo uninstall the SlothTool CLI tool, run:',
            npmUninstall: '  npm uninstall -g @holic512/slothtool',
            failed: '\n✗ Removal failed:',
            noData: '\nSlothTool data directory does not exist: {dir}',
            alreadyClean: 'System is already clean.'
        },

        // List
        installedPlugins: 'Installed plugins:',
        noPlugins: 'No plugins installed.',
        installExample: '\nInstall an official plugin example:',
        sources: {
            githubRelease: 'GitHub Release',
            npmRegistry: 'npm registry (legacy)'
        },

        // Run
        specifyPlugin: 'Error: Please specify a plugin to run.',
        pluginNotFound: 'Error: Plugin "{pluginAlias}" not found.',
        seeInstalled: '\nRun "slothtool list" to see installed plugins.',
        orInstall: 'Or install an official plugin with: slothtool install <plugin-alias>',
        failedToRun: 'Failed to run plugin "{pluginAlias}":',

        // Config
        currentLanguage: 'Current language:',
        languageSet: 'Language set to:',
        invalidLanguage: 'Invalid language. Please use "zh" or "en".',
        configUsage: 'Usage: slothtool config language <zh|en>',

        // Interactive mode
        interactive: {
            mainMenu: 'Please select an action:',
            installPlugin: 'Install official plugin',
            installOfficial: 'Install official plugin',
            uninstallPlugin: 'Uninstall plugin',
            updateMenu: 'Update',
            updateSelf: 'Update SlothTool',
            updatePlugin: 'Update single plugin',
            updateAllPlugins: 'Update all plugins',
            listPlugins: 'List installed plugins',
            runPlugin: 'Run plugin',
            configLanguage: 'Configure language',
            uninstallAll: 'Complete uninstall (remove all data)',
            exit: 'Exit',

            selectPlugin: 'Select plugin:',
            selectOfficialPlugin: 'Select official plugin to install:',
            selectPluginToUpdate: 'Select plugin to update:',
            enterPluginAlias: 'Enter plugin alias:',
            selectLanguage: 'Select language:',

            noPluginsToUninstall: 'No plugins installed to uninstall.',
            noPluginsToUpdate: 'No plugins installed to update.',
            noPluginsToRun: 'No plugins installed to run.',

            pluginInfo: 'Plugin Information',
            features: 'Features:',
            author: 'Author:',
            version: 'Version:',

            confirmInstall: 'Confirm install {name}?',
            confirmUninstall: 'Confirm uninstall {alias}?',
            confirmUpdate: 'Confirm update {alias}?',
            confirmUpdateAll: 'Confirm update all {count} plugins?',
            confirmUpdateSelf: 'Confirm update SlothTool?',

            runWithArgs: 'Do you want to run this plugin?',
            enterArgs: 'Enter arguments (leave empty for no arguments):',

            operationCancelled: 'Operation cancelled.',
            pressEnterToContinue: '\nPress Enter to continue...'
        }
    }
};

/**
 * 获取当前语言的消息
 * @param {string} key - 消息键（支持点号分隔的嵌套键）
 * @param {Object} params - 替换参数
 * @returns {string} 本地化的消息
 */
function t(key, params = {}) {
    const lang = settings.getLanguage();
    const langMessages = messages[lang] || messages.zh;

    // 支持嵌套键，如 'commands.install'
    const keys = key.split('.');
    let message = langMessages;

    for (const k of keys) {
        message = message[k];
        if (message === undefined) {
            return key; // 如果找不到，返回键本身
        }
    }

    // 替换参数
    if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    return message;
}

module.exports = {
    t,
    messages
};
