/**
 * @file UpdateAllCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 批量更新所有已安装插件，统一汇总官方插件与遗留 npm 插件的更新结果。
 * @logic 1. 枚举注册表插件；2. 逐个执行更新策略；3. 输出批量更新摘要。
 * @dependencies Service: plugin-manager
 * @index_tags 批量更新, update-all, GitHub Release, npm兼容
 * @author holic512
 */

const {updateAllPlugins} = require('../plugin-manager');

/**
 * 更新所有插件命令
 */
async function updateAll() {
    await updateAllPlugins();
}

module.exports = updateAll;
