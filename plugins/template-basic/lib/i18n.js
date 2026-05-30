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

export const messages = {
    zh: {
        title: 'mytool - 模板插件',
        usage: '用法：',
        options: '选项：',
        help: '显示帮助信息',
        tuiOption: '启动默认全屏 TUI',
        hello: '输出模板问候语',
        config: '显示模板配置',
        error: '错误',
        configTitle: '当前模板配置：',
        helloOutput: 'Hello from template-basic',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动模板 TUI。',
        tui: {
            tabs: {
                actions: '操作',
                config: '配置'
            },
            menu: {
                showTitle: '显示标题',
                toggleSample: '切换 sampleOption',
                exit: '退出'
            },
            footer: 'Tab 切页  Up/Down 移动  Enter 执行  Esc 返回  ? 帮助  q 退出',
            panels: {
                actionsTitle: '示例操作',
                actionsDescription: '该页面演示插件如何在统一外壳中承载操作菜单。',
                configTitle: '当前模板配置',
                configDescription: '该页面演示只读配置或详情面板的默认布局。'
            },
            status: {
                ready: '就绪',
                titleShown: '已显示模板标题。',
                toggleDone: 'sampleOption = {value}'
            },
            help: {
                title: '快捷键',
                lines: [
                    'Tab: 切换顶部页面',
                    'Up/Down: 移动',
                    'Enter: 执行动作',
                    'Esc: 返回操作页',
                    'q: 退出',
                    '?: 打开帮助'
                ]
            }
        }
    },
    en: {
        title: 'mytool - Template plugin',
        usage: 'Usage:',
        options: 'Options:',
        help: 'Show help',
        tuiOption: 'Launch the default full-screen TUI',
        hello: 'Print a sample greeting',
        config: 'Show the template config',
        error: 'Error',
        configTitle: 'Current template config:',
        helloOutput: 'Hello from template-basic',
        tuiRequiresTerminal: 'The current terminal is not interactive, so the template TUI cannot be launched.',
        tui: {
            tabs: {
                actions: 'Actions',
                config: 'Config'
            },
            menu: {
                showTitle: 'Show title',
                toggleSample: 'Toggle sampleOption',
                exit: 'Exit'
            },
            footer: 'Tab page  Up/Down move  Enter action  Esc back  ? help  q quit',
            panels: {
                actionsTitle: 'Sample actions',
                actionsDescription: 'This page shows how a plugin can host its action menu inside the standard shell.',
                configTitle: 'Current template config',
                configDescription: 'This page shows the default layout for read-only config and detail panels.'
            },
            status: {
                ready: 'Ready',
                titleShown: 'Template title shown.',
                toggleDone: 'sampleOption = {value}'
            },
            help: {
                title: 'Keymap',
                lines: [
                    'Tab: switch top page',
                    'Up/Down: move',
                    'Enter: run action',
                    'Esc: return to Actions',
                    'q: quit',
                    '?: open help'
                ]
            }
        }
    }
};

export function t(key, params = {}) {
    const language = getLanguage();
    const currentMessages = messages[language] || messages.zh;
    const keys = key.split('.');
    let message = currentMessages;

    for (const currentKey of keys) {
        message = message?.[currentKey];
        if (message === undefined) {
            return key;
        }
    }

    if (typeof message !== 'string') {
        return message ?? key;
    }

    return message.replace(/\{(\w+)\}/gu, (match, name) => {
        return params[name] !== undefined ? String(params[name]) : match;
    });
}
