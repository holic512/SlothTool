const {updatePlugin} = require('../plugin-manager');
const {t} = require('../i18n');

/**
 * 更新插件命令
 * @param {string[]} args - 命令参数
 */
function update(args) {
    const alias = args[0];

    if (!alias) {
        console.error(t('specifyPluginToUpdate'));
        console.log('\n' + t('updateUsage'));
        process.exit(1);
    }

    updatePlugin(alias);
}

module.exports = update;
