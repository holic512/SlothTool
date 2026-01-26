const {updateAllPlugins} = require('../plugin-manager');

/**
 * 更新所有插件命令
 */
function updateAll() {
    updateAllPlugins();
}

module.exports = updateAll;
