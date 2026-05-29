/**
 * @file InstallCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理官方插件安装命令，只接受内置插件 alias 并转交 GitHub Release 安装器。
 * @logic 1. 校验 alias 是否存在；2. 输出官方插件列表提示；3. 调用异步安装流程。
 * @dependencies Service: plugin-manager, Data: official-plugins.json
 * @index_tags install命令, 官方插件, alias安装, GitHub Release
 * @author holic512
 */

const {installPlugin, getOfficialPluginAliases} = require('../plugin-manager');

async function install(args) {
    if (args.length === 0) {
        console.error('Error: Please specify a plugin to install.');
        console.log('Usage: slothtool install <plugin-alias>');
        console.log(`Available official plugins: ${getOfficialPluginAliases().join(', ')}`);
        process.exit(1);
    }

    const alias = args[0];
    await installPlugin(alias);
}

module.exports = install;
