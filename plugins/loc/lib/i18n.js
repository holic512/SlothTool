/**
 * @file LocI18n
 * @project SlothTool
 * @module LOC Plugin / Internationalization
 * @description 提供 loc 插件 CLI 与默认 TUI 所需的双语文案。
 * @logic 1. 读取 ~/.slothtool/settings.json 的语言设置；2. 输出 loc CLI/TUI 文案；3. 支持模板变量替换。
 * @dependencies Node: fs/os/path
 * @index_tags loc i18n, 双语, TUI文案, CLI文案
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
        title: 'loc - 统计目录中的代码行数',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示帮助信息',
        verbose: '显示详细文件清单',
        config: '显示当前配置',
        tuiOption: '启动全屏 TUI',
        configCommands: '配置命令',
        exampleTui: '进入默认 TUI',
        exampleCurrent: '统计当前目录',
        exampleSrc: '统计 ./src 目录',
        exampleVerbose: '统计并输出详细文件清单',
        exampleConfig: '显示当前配置',
        exampleConfigSet: '禁用 md 扩展统计',
        invalidDirectory: '无效目录：{dir}',
        counting: '正在统计：{dir}',
        totalFiles: '总文件数：{count}',
        totalLines: '总行数：{count}',
        files: '文件明细',
        lines: '行',
        configSaved: '配置已保存。',
        configReset: '配置已重置为默认值。',
        configUnknownTarget: '未知配置目标，请使用 "ext" 或 "exclude"。',
        configUnknownState: '状态必须是 "on" 或 "off"。',
        configShowTitle: '当前 loc 配置：',
        warningsTitle: '扫描告警：',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 loc TUI。',
        tui: {
            tabs: {
                count: '统计',
                extensions: '扩展名',
                excludes: '排除目录'
            },
            menu: {
                current: '统计当前目录',
                custom: '统计指定目录',
                reset: '重置为默认配置',
                exit: '退出'
            },
            footer: 'Tab 切页  Up/Down 移动  Enter 执行  Space 切换  Esc 返回  ? 帮助  q 退出',
            prompt: '输入目录后按 Enter 执行统计，Esc 返回统计页。',
            emptyResult: '尚未执行统计。',
            inputLabel: '目录输入：',
            resultTitle: '结果摘要',
            configHint: 'Space 切换当前项。',
            saved: '配置切换已保存。',
            resetDone: '配置已重置。',
            panels: {
                countInput: '目录输入',
                extensions: '文件扩展名',
                excludes: '排除目录'
            },
            status: {
                ready: '就绪',
                countingLabel: '统计目录',
                resetLabel: '重置配置',
                countDone: '统计完成：{dir}'
            },
            help: {
                title: '快捷键',
                lines: [
                    'Tab: 切换顶部页面',
                    'Up/Down: 移动',
                    'Enter: 执行操作',
                    'Space: 切换配置项',
                    'Esc: 返回统计页',
                    'q: 退出',
                    '?: 打开帮助'
                ]
            }
        }
    },
    en: {
        title: 'loc - Count lines of code in a directory',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        verbose: 'Show the detailed file list',
        config: 'Show the current configuration',
        tuiOption: 'Launch the full-screen TUI',
        configCommands: 'Config commands',
        exampleTui: 'Enter the default TUI',
        exampleCurrent: 'Count the current directory',
        exampleSrc: 'Count ./src',
        exampleVerbose: 'Count and print the file list',
        exampleConfig: 'Show the current config',
        exampleConfigSet: 'Disable md extension counting',
        invalidDirectory: 'Invalid directory: {dir}',
        counting: 'Counting: {dir}',
        totalFiles: 'Total files: {count}',
        totalLines: 'Total lines: {count}',
        files: 'Files',
        lines: 'lines',
        configSaved: 'Configuration saved.',
        configReset: 'Configuration reset to defaults.',
        configUnknownTarget: 'Unknown config target. Use "ext" or "exclude".',
        configUnknownState: 'State must be "on" or "off".',
        configShowTitle: 'Current loc config:',
        warningsTitle: 'Warnings:',
        tuiRequiresTerminal: 'The current terminal is not interactive, so the loc TUI cannot be launched.',
        tui: {
            tabs: {
                count: 'Count',
                extensions: 'Extensions',
                excludes: 'Excludes'
            },
            menu: {
                current: 'Count current directory',
                custom: 'Count custom directory',
                reset: 'Reset to defaults',
                exit: 'Exit'
            },
            footer: 'Tab page  Up/Down move  Enter action  Space toggle  Esc back  ? help  q quit',
            prompt: 'Type a directory path and press Enter. Esc returns to Count.',
            emptyResult: 'No count has been executed yet.',
            inputLabel: 'Directory input:',
            resultTitle: 'Result summary',
            configHint: 'Space toggles the current item.',
            saved: 'Configuration toggle saved.',
            resetDone: 'Configuration reset.',
            panels: {
                countInput: 'Directory input',
                extensions: 'File extensions',
                excludes: 'Excluded directories'
            },
            status: {
                ready: 'Ready',
                countingLabel: 'Count directory',
                resetLabel: 'Reset config',
                countDone: 'Count complete: {dir}'
            },
            help: {
                title: 'Keymap',
                lines: [
                    'Tab: switch top page',
                    'Up/Down: move',
                    'Enter: run action',
                    'Space: toggle config item',
                    'Esc: return to Count',
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

    if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/gu, (match, name) => {
            return params[name] !== undefined ? String(params[name]) : match;
        });
    }

    return message;
}

export default {
    getLanguage,
    t
};
