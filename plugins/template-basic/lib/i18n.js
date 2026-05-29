/**
 * @file TemplatePluginI18n
 * @project SlothTool
 * @module Plugin Scaffold / I18N
 * @description 为插件模板提供最小化的中英文文案与语言读取能力。
 * @logic 1. 从 SlothTool 设置文件读取语言；2. 提供键值翻译；3. 支持简单模板参数替换。
 * @dependencies Node: fs/os/path
 * @index_tags 插件模板, i18n, 语言读取, scaffold
 * @author holic512
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

function getSettingsPath() {
    return path.join(os.homedir(), '.slothtool', 'settings.json');
}

function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
            return settings.language || 'zh';
        }
    } catch (error) {
        // ignore errors
    }
    return 'zh';
}

const messages = {
    zh: {
        title: 'mytool - 插件标题',
        usage: '用法：',
        options: '选项：',
        help: '显示帮助信息',
        interactive: '交互式模式',
        interactiveMenu: '请选择操作：',
        showTitle: '显示标题',
        error: '错误',
        exit: '退出'
    },
    en: {
        title: 'mytool - Plugin title',
        usage: 'Usage:',
        options: 'Options:',
        help: 'Show help message',
        interactive: 'Interactive mode',
        interactiveMenu: 'Select an action:',
        showTitle: 'Show title',
        error: 'Error',
        exit: 'Exit'
    }
};

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
