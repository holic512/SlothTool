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
        error: '错误',
        exit: '退出'
    },
    en: {
        title: 'mytool - Plugin title',
        usage: 'Usage:',
        options: 'Options:',
        help: 'Show help message',
        interactive: 'Interactive mode',
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
