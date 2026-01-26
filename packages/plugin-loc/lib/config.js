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
 * 获取插件配置目录
 * @returns {string} ~/.slothtool/plugin-configs
 */
function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

/**
 * 获取 loc 插件配置文件路径
 * @returns {string} ~/.slothtool/plugin-configs/loc.json
 */
function getLocConfigPath() {
    return path.join(getPluginConfigsDir(), 'loc.json');
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dir - 目录路径
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

/**
 * 获取默认配置
 * @returns {Object} 默认配置对象
 */
function getDefaultConfig() {
    return {
        fileExtensions: {
            // 常见代码文件扩展名
            js: true,
            ts: true,
            jsx: true,
            tsx: true,
            py: true,
            java: true,
            c: true,
            cpp: true,
            h: true,
            hpp: true,
            cs: true,
            go: true,
            rs: true,
            php: true,
            rb: true,
            swift: true,
            kt: true,
            scala: true,
            html: true,
            css: true,
            scss: true,
            sass: true,
            less: true,
            vue: true,
            json: true,
            xml: true,
            yaml: true,
            yml: true,
            md: true,
            txt: true,
            sh: true,
            bash: true,
            sql: true
        },
        excludeDirectories: {
            // Node.js
            'node_modules': true,
            // Python
            '.venv': true,
            'venv': true,
            '__pycache__': true,
            '.pytest_cache': true,
            // Build outputs
            'dist': true,
            'build': true,
            'out': true,
            'target': true,
            // Version control
            '.git': true,
            '.svn': true,
            '.hg': true,
            // IDEs
            '.idea': true,
            '.vscode': true,
            '.vs': true,
            // Package managers
            'bower_components': true,
            'vendor': true,
            // Cache
            '.cache': true,
            '.next': true,
            '.nuxt': true,
            // Coverage
            'coverage': true,
            '.nyc_output': true,
            // Logs
            'logs': true,
            // Temp
            'tmp': true,
            'temp': true
        }
    };
}

/**
 * 读取配置
 * @returns {Object} 配置对象
 */
function readConfig() {
    const configPath = getLocConfigPath();

    // 确保配置目录存在
    ensureDir(getPluginConfigsDir());

    // 如果配置文件不存在，返回默认配置
    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(content);

        // 合并默认配置，确保新增的配置项存在
        const defaultConfig = getDefaultConfig();
        return {
            fileExtensions: {...defaultConfig.fileExtensions, ...config.fileExtensions},
            excludeDirectories: {...defaultConfig.excludeDirectories, ...config.excludeDirectories}
        };
    } catch (error) {
        console.error('Failed to read config:', error.message);
        return getDefaultConfig();
    }
}

/**
 * 写入配置
 * @param {Object} config - 配置对象
 */
function writeConfig(config) {
    const configPath = getLocConfigPath();

    // 确保配置目录存在
    ensureDir(getPluginConfigsDir());

    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to write config:', error.message);
        throw error;
    }
}

module.exports = {
    getDefaultConfig,
    readConfig,
    writeConfig
};
