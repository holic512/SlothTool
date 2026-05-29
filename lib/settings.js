const fs = require('fs');
const {getSettingsPath, ensureDir, getSlothToolHome} = require('./utils');

/**
 * 读取设置
 * @returns {Object} 设置对象
 */
function readSettings() {
    const settingsPath = getSettingsPath();

    // 确保 .slothtool 目录存在
    ensureDir(getSlothToolHome());

    // 如果设置文件不存在，返回默认设置
    if (!fs.existsSync(settingsPath)) {
        return getDefaultSettings();
    }

    try {
        const content = fs.readFileSync(settingsPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to read settings:', error.message);
        return getDefaultSettings();
    }
}

/**
 * 写入设置
 * @param {Object} settings - 设置对象
 */
function writeSettings(settings) {
    const settingsPath = getSettingsPath();

    // 确保 .slothtool 目录存在
    ensureDir(getSlothToolHome());

    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to write settings:', error.message);
        throw error;
    }
}

/**
 * 获取默认设置
 * @returns {Object} 默认设置对象
 */
function getDefaultSettings() {
    return {
        language: 'zh' // 默认中文，可选 'zh' 或 'en'
    };
}

/**
 * 获取当前语言设置
 * @returns {string} 语言代码 ('zh' 或 'en')
 */
function getLanguage() {
    const settings = readSettings();
    return settings.language || 'zh';
}

/**
 * 设置语言
 * @param {string} language - 语言代码 ('zh' 或 'en')
 */
function setLanguage(language) {
    if (language !== 'zh' && language !== 'en') {
        throw new Error('Language must be "zh" or "en"');
    }

    const settings = readSettings();
    settings.language = language;
    writeSettings(settings);
}

module.exports = {
    readSettings,
    writeSettings,
    getDefaultSettings,
    getLanguage,
    setLanguage
};
