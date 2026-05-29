/**
 * @file UpdateCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理单插件更新命令，支持官方插件 GitHub Release 更新与遗留 npm 插件兼容更新。
 * @logic 1. 校验插件别名输入；2. 调用异步更新流程；3. 由底层统一处理迁移与报错。
 * @dependencies Service: plugin-manager, I18N: t
 * @index_tags update命令, 插件更新, 迁移兼容, GitHub Release
 * @author holic512
 */

const {updatePlugin} = require('../plugin-manager');
const {t} = require('../i18n');

/**
 * 更新插件命令
 * @param {string[]} args - 命令参数
 */
async function update(args) {
    const alias = args[0];

    if (!alias) {
        console.error(t('specifyPluginToUpdate'));
        console.log('\n' + t('updateUsage'));
        process.exit(1);
    }

    await updatePlugin(alias);
}

module.exports = update;
