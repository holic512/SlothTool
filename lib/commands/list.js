/**
 * @file ListCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 列出已安装插件及其来源信息，区分新的 GitHub Release 插件和遗留 npm 插件。
 * @logic 1. 读取注册表；2. 规范化包名与来源标签；3. 输出可读的安装清单。
 * @dependencies Service: registry, I18N: t
 * @index_tags list命令, 插件来源, 注册表展示, GitHub Release
 * @author holic512
 */

const registry = require('../registry');
const {t} = require('../i18n');

function getPluginDisplayName(pluginInfo) {
    return pluginInfo.packageName || pluginInfo.name;
}

function getPluginSourceLabel(pluginInfo) {
    return pluginInfo.sourceType === 'github-release'
        ? t('sources.githubRelease')
        : t('sources.npmRegistry');
}

function list() {
    const plugins = registry.getAllPlugins();

    if (Object.keys(plugins).length === 0) {
        console.log(t('noPlugins'));
        console.log(t('installExample'));
        console.log('  slothtool install <plugin-alias>');
        return;
    }

    console.log(t('installedPlugins') + '\n');
    for (const [alias, info] of Object.entries(plugins)) {
        console.log(`  ${alias}`);
        console.log(`    Package: ${getPluginDisplayName(info)}`);
        console.log(`    Version: ${info.version}`);
        console.log(`    Source: ${getPluginSourceLabel(info)}`);
        console.log(`    Installed: ${new Date(info.installedAt).toLocaleString()}`);
        console.log('');
    }
}

module.exports = list;
