const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * 读取 slothtool 全局 settings 路径
 */
function getSettingsPath() {
    return path.join(os.homedir(), '.slothtool', 'settings.json');
}

/**
 * 获取当前语言（默认 zh）
 */
function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
            return settings.language || 'zh';
        }
    } catch (error) {
        // ignore
    }

    return 'zh';
}

// 中英文消息字典
const messages = {
    zh: {
        title: 'llm-base - LLM 基础能力层',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示帮助信息',
        interactive: '交互式配置模式',
        config: '配置管理命令',

        configCreated: '配置已创建',
        configUpdated: '配置已更新',
        configDeleted: '配置已删除',
        defaultSet: '默认配置已设置',
        profileNotFound: '未找到 profile',
        invalidMode: '无效模式，仅支持 low/high',
        noProfile: '默认 profile 不存在或指定 profile 不存在',

        menuTitle: '请选择操作：',
        menuCreate: '创建 profile',
        menuUpdate: '更新 profile',
        menuDelete: '删除 profile',
        menuList: '查看 profile 列表',
        menuSetDefault: '设置默认 profile',
        menuShow: '查看 profile 详情',
        menuExport: '导出配置（脱敏）',
        menuExit: '退出',

        enterProfileName: '请输入 profile 名称：',
        enterBaseUrl: '请输入 base_url：',
        enterApiKey: '请输入 api_key：',
        enterLowModel: '请输入 low_model：',
        enterHighModel: '请输入 high_model：',
        enterTimeout: '请输入 timeout(ms)：'
    },
    en: {
        title: 'llm-base - LLM base capability layer',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show help message',
        interactive: 'Interactive config mode',
        config: 'Configuration commands',

        configCreated: 'Profile created',
        configUpdated: 'Profile updated',
        configDeleted: 'Profile deleted',
        defaultSet: 'Default profile set',
        profileNotFound: 'Profile not found',
        invalidMode: 'Invalid mode, only low/high are allowed',
        noProfile: 'Default profile missing or specified profile missing',

        menuTitle: 'Select an action:',
        menuCreate: 'Create profile',
        menuUpdate: 'Update profile',
        menuDelete: 'Delete profile',
        menuList: 'List profiles',
        menuSetDefault: 'Set default profile',
        menuShow: 'Show profile',
        menuExport: 'Export config (masked)',
        menuExit: 'Exit',

        enterProfileName: 'Enter profile name:',
        enterBaseUrl: 'Enter base_url:',
        enterApiKey: 'Enter api_key:',
        enterLowModel: 'Enter low_model:',
        enterHighModel: 'Enter high_model:',
        enterTimeout: 'Enter timeout(ms):'
    }
};

/**
 * i18n 获取函数，支持 {param} 模板替换
 */
function t(key, params = {}) {
    const lang = getLanguage();
    const langMessages = messages[lang] || messages.zh;

    let message = langMessages[key];
    if (message === undefined) {
        return key;
    }

    if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }

    return message;
}

module.exports = {
    t,
    getLanguage
};
