const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * 获取 slothtool 的主目录
 * @returns {string} ~/.slothtool
 */
function getSlothToolHome() {
  return path.join(os.homedir(), '.slothtool');
}

/**
 * 获取插件安装目录
 * @returns {string} ~/.slothtool/plugins
 */
function getPluginsDir() {
  return path.join(getSlothToolHome(), 'plugins');
}

/**
 * 获取注册表文件路径
 * @returns {string} ~/.slothtool/registry.json
 */
function getRegistryPath() {
  return path.join(getSlothToolHome(), 'registry.json');
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dir - 目录路径
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 从完整的包名中提取插件别名
 * 例如: @slothtool/plugin-loc -> loc
 *       plugin-loc -> loc
 * @param {string} packageName - npm 包名
 * @returns {string} 插件别名
 */
function extractPluginAlias(packageName) {
  // 移除 scope (如果有)
  const withoutScope = packageName.replace(/^@[^/]+\//, '');

  // 移除 plugin- 前缀 (如果有)
  const alias = withoutScope.replace(/^plugin-/, '');

  return alias;
}

/**
 * 获取指定插件的安装目录
 * @param {string} pluginAlias - 插件别名
 * @returns {string} 插件安装目录路径
 */
function getPluginDir(pluginAlias) {
  return path.join(getPluginsDir(), pluginAlias);
}

module.exports = {
  getSlothToolHome,
  getPluginsDir,
  getRegistryPath,
  ensureDir,
  extractPluginAlias,
  getPluginDir
};
