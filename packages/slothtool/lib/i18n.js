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
            list: '列出已安装的插件',
            run: '运行插件',
            runShorthand: '运行插件（简写）',
            config: '配置语言设置',
            interactive: '交互式模式'
        },

        // 安装
        installing: '正在安装插件：',
        alreadyInstalled: '插件 "{alias}" 已经安装。',
        uninstallFirst: '如果要重新安装，请先运行 "slothtool uninstall {alias}"。',
        installingTo: '安装到：',
        installSuccess: '\n✓ 插件 "{alias}" 安装成功！',
        installRun: '  运行：slothtool {alias} --help',
        installFailed: '\n✗ 安装插件 "{packageName}" 失败：',

        // 卸载
        uninstalling: '正在卸载插件：',
        notInstalled: '插件 "{alias}" 未安装。',
        uninstallSuccess: '✓ 插件 "{alias}" 卸载成功！',
        uninstallFailed: '✗ 卸载插件 "{alias}" 失败：',

        // 列表
        installedPlugins: '已安装的插件：',
        noPlugins: '未安装任何插件。',
        installExample: '\n安装插件示例：',

        // 运行
        specifyPlugin: '错误：请指定要运行的插件。',
        pluginNotFound: '错误：未找到插件 "{pluginAlias}"。',
        seeInstalled: '\n运行 "slothtool list" 查看已安装的插件。',
        orInstall: '或使用以下命令安装：slothtool install <插件名>',
        failedToRun: '运行插件 "{pluginAlias}" 失败：',

        // 配置
        currentLanguage: '当前语言：',
        languageSet: '语言已设置为：',
        invalidLanguage: '无效的语言。请使用 "zh" 或 "en"。',
        configUsage: '用法：slothtool config language <zh|en>',

        // 交互式模式
        interactive: {
            mainMenu: '请选择操作：',
            installPlugin: '安装插件',
            installOfficial: '安装官方插件',
            installCustom: '安装自定义插件',
            uninstallPlugin: '卸载插件',
            listPlugins: '查看已安装的插件',
            runPlugin: '运行插件',
            configLanguage: '配置语言',
            exit: '退出',

            selectPlugin: '选择插件：',
            selectOfficialPlugin: '选择要安装的官方插件：',
            enterPackageName: '请输入插件包名（如 @scope/plugin-name）：',
            enterPluginAlias: '请输入插件别名：',
            selectLanguage: '选择语言：',

            noPluginsToUninstall: '没有已安装的插件可以卸载。',
            noPluginsToRun: '没有已安装的插件可以运行。',

            pluginInfo: '插件信息',
            features: '功能特性：',
            author: '作者：',
            version: '版本：',

            confirmInstall: '确认安装 {name}？',
            confirmUninstall: '确认卸载 {alias}？',

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
            list: 'List installed plugins',
            run: 'Run a plugin',
            runShorthand: 'Run a plugin (shorthand)',
            config: 'Configure language settings',
            interactive: 'Interactive mode'
        },

        // Install
        installing: 'Installing plugin:',
        alreadyInstalled: 'Plugin "{alias}" is already installed.',
        uninstallFirst: 'Run "slothtool uninstall {alias}" first if you want to reinstall.',
        installingTo: 'Installing to:',
        installSuccess: '\n✓ Plugin "{alias}" installed successfully!',
        installRun: '  Run: slothtool {alias} --help',
        installFailed: '\n✗ Failed to install plugin "{packageName}":',

        // Uninstall
        uninstalling: 'Uninstalling plugin:',
        notInstalled: 'Plugin "{alias}" is not installed.',
        uninstallSuccess: '✓ Plugin "{alias}" uninstalled successfully!',
        uninstallFailed: '✗ Failed to uninstall plugin "{alias}":',

        // List
        installedPlugins: 'Installed plugins:',
        noPlugins: 'No plugins installed.',
        installExample: '\nInstall a plugin example:',

        // Run
        specifyPlugin: 'Error: Please specify a plugin to run.',
        pluginNotFound: 'Error: Plugin "{pluginAlias}" not found.',
        seeInstalled: '\nRun "slothtool list" to see installed plugins.',
        orInstall: 'Or install it with: slothtool install <plugin-name>',
        failedToRun: 'Failed to run plugin "{pluginAlias}":',

        // Config
        currentLanguage: 'Current language:',
        languageSet: 'Language set to:',
        invalidLanguage: 'Invalid language. Please use "zh" or "en".',
        configUsage: 'Usage: slothtool config language <zh|en>',

        // Interactive mode
        interactive: {
            mainMenu: 'Please select an action:',
            installPlugin: 'Install plugin',
            installOfficial: 'Install official plugin',
            installCustom: 'Install custom plugin',
            uninstallPlugin: 'Uninstall plugin',
            listPlugins: 'List installed plugins',
            runPlugin: 'Run plugin',
            configLanguage: 'Configure language',
            exit: 'Exit',

            selectPlugin: 'Select plugin:',
            selectOfficialPlugin: 'Select official plugin to install:',
            enterPackageName: 'Enter plugin package name (e.g., @scope/plugin-name):',
            enterPluginAlias: 'Enter plugin alias:',
            selectLanguage: 'Select language:',

            noPluginsToUninstall: 'No plugins installed to uninstall.',
            noPluginsToRun: 'No plugins installed to run.',

            pluginInfo: 'Plugin Information',
            features: 'Features:',
            author: 'Author:',
            version: 'Version:',

            confirmInstall: 'Confirm install {name}?',
            confirmUninstall: 'Confirm uninstall {alias}?',

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
