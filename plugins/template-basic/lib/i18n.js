/**
 * @file TemplatePluginI18n
 * @project SlothTool
 * @module Plugin Scaffold / I18N
 * @description 为模板插件提供默认 TUI 和显式 CLI 子命令所需的中英文文案。
 * @logic 1. 读取 SlothTool 全局语言设置；2. 输出模板帮助与 TUI 文案；3. 支持简单模板变量替换。
 * @dependencies Node: fs/os/path
 * @index_tags 模板插件, i18n, 默认TUI, scaffold
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getSettingsPath() {
    return path.join(os.homedir(), '.slothtool', 'settings.json');
}

export function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
            return settings.language || 'zh';
        }
    } catch {
        return 'zh';
    }

    return 'zh';
}

const messages = {
    zh: {
        title: 'mytool - 模板插件',
        usage: '用法：',
        options: '选项：',
        help: '显示帮助信息',
        tui: '启动默认全屏 TUI',
        hello: '输出模板问候语',
        config: '显示模板配置',
        error: '错误',
        configTitle: '当前模板配置：',
        helloOutput: 'Hello from template-basic',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动模板 TUI。',
        footer: 'Enter action  q quit  ? help',
        menuShowTitle: '显示标题',
        menuToggleSample: '切换 sampleOption',
        menuExit: '退出',
        helpLines: [
            'Enter: 执行动作',
            'Up/Down: 切换菜单',
            'q: 退出',
            '?: 显示帮助'
        ]
    },
    en: {
        title: 'mytool - Template plugin',
        usage: 'Usage:',
        options: 'Options:',
        help: 'Show help',
        tui: 'Launch the default full-screen TUI',
        hello: 'Print a sample greeting',
        config: 'Show the template config',
        error: 'Error',
        configTitle: 'Current template config:',
        helloOutput: 'Hello from template-basic',
        tuiRequiresTerminal: 'The current terminal is not interactive, so the template TUI cannot be launched.',
        footer: 'Enter action  q quit  ? help',
        menuShowTitle: 'Show title',
        menuToggleSample: 'Toggle sampleOption',
        menuExit: 'Exit',
        helpLines: [
            'Enter: run action',
            'Up/Down: move',
            'q: quit',
            '?: show help'
        ]
    }
};

export function t(key, params = {}) {
    const language = getLanguage();
    const currentMessages = messages[language] || messages.zh;
    const message = currentMessages[key];

    if (typeof message !== 'string') {
        return message ?? key;
    }

    return message.replace(/\{(\w+)\}/gu, (match, name) => {
        return params[name] !== undefined ? String(params[name]) : match;
    });
}
