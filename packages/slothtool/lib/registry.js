const fs = require('fs');
const { getRegistryPath, ensureDir, getSlothToolHome } = require('./utils');

/**
 * 读取注册表
 * @returns {Object} 注册表对象
 */
function readRegistry() {
  const registryPath = getRegistryPath();

  // 确保 .slothtool 目录存在
  ensureDir(getSlothToolHome());

  // 如果注册表文件不存在，返回空对象
  if (!fs.existsSync(registryPath)) {
    return { plugins: {} };
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read registry:', error.message);
    return { plugins: {} };
  }
}

/**
 * 写入注册表
 * @param {Object} registry - 注册表对象
 */
function writeRegistry(registry) {
  const registryPath = getRegistryPath();

  // 确保 .slothtool 目录存在
  ensureDir(getSlothToolHome());

  try {
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write registry:', error.message);
    throw error;
  }
}

/**
 * 添加插件到注册表
 * @param {string} alias - 插件别名
 * @param {Object} pluginInfo - 插件信息
 */
function addPlugin(alias, pluginInfo) {
  const registry = readRegistry();
  registry.plugins[alias] = pluginInfo;
  writeRegistry(registry);
}

/**
 * 从注册表移除插件
 * @param {string} alias - 插件别名
 */
function removePlugin(alias) {
  const registry = readRegistry();
  delete registry.plugins[alias];
  writeRegistry(registry);
}

/**
 * 获取插件信息
 * @param {string} alias - 插件别名
 * @returns {Object|null} 插件信息，如果不存在返回 null
 */
function getPlugin(alias) {
  const registry = readRegistry();
  return registry.plugins[alias] || null;
}

/**
 * 获取所有插件
 * @returns {Object} 所有插件的映射
 */
function getAllPlugins() {
  const registry = readRegistry();
  return registry.plugins;
}

/**
 * 检查插件是否已安装
 * @param {string} alias - 插件别名
 * @returns {boolean} 是否已安装
 */
function hasPlugin(alias) {
  const registry = readRegistry();
  return alias in registry.plugins;
}

module.exports = {
  readRegistry,
  writeRegistry,
  addPlugin,
  removePlugin,
  getPlugin,
  getAllPlugins,
  hasPlugin
};
