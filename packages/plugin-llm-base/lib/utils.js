const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * 获取 SlothTool 根目录：~/.slothtool
 */
function getSlothToolHome() {
    return path.join(os.homedir(), '.slothtool');
}

/**
 * 获取插件配置目录：~/.slothtool/plugin-configs
 */
function getPluginConfigsDir() {
    return path.join(getSlothToolHome(), 'plugin-configs');
}

/**
 * 获取 llm-base 配置文件路径
 */
function getConfigPath() {
    return path.join(getPluginConfigsDir(), 'llm-base.json');
}

/**
 * 获取 llm-base 调用日志路径
 */
function getCallLogPath() {
    return path.join(getPluginConfigsDir(), 'llm-base.logs.json');
}

/**
 * 确保目录存在，不存在则递归创建
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
}

/**
 * 安全解析 JSON，失败时返回 fallback
 */
function safeParseJson(content, fallback) {
    try {
        return JSON.parse(content);
    } catch (error) {
        return fallback;
    }
}

/**
 * 生成调用 ID（优先 randomUUID）
 */
function generateCallId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'call_' + Date.now() + '_' + Math.random().toString(16).slice(2);
}

/**
 * 规范化 base_url，去除末尾 /
 */
function normalizeBaseUrl(baseUrl) {
    if (!baseUrl || typeof baseUrl !== 'string') {
        return 'https://api.openai.com/v1';
    }
    return baseUrl.replace(/\/+$/, '');
}

/**
 * 拼接最终请求地址
 */
function resolveEndpoint(baseUrl, endpointPath) {
    return normalizeBaseUrl(baseUrl) + endpointPath;
}

module.exports = {
    getSlothToolHome,
    getPluginConfigsDir,
    getConfigPath,
    getCallLogPath,
    ensureDir,
    safeParseJson,
    generateCallId,
    normalizeBaseUrl,
    resolveEndpoint
};
