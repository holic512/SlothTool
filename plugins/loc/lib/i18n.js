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
            menuBadges: {
                current: '当前',
                custom: '路径',
                reset: '重置',
                exit: '退出'
            },
            footer: {
                count: 'Tab 切页 | ↑↓ 选择 | Enter 执行 | Esc 返回 | ? 帮助 | q 退出',
                config: 'Tab 切页 | ↑↓ 选择 | [/] 翻页 | Space 切换 | Esc 返回 | ? 帮助 | q 退出',
                input: '输入或粘贴目录 | Enter 统计 | Esc 取消',
                compactCount: 'Tab | ↑↓ | Enter | ? | q',
                compactConfig: 'Tab | ↑↓ | [/] | Space | ? | q',
                microCount: '↑↓ Enter ? q',
                microConfig: '↑↓ [/] Space q',
                microInput: 'Enter | Esc'
            },
            tooSmall: '终端空间不足',
            tooSmallDetail: '请将终端调整到至少 30 列 × 14 行。',
            prompt: '输入目录后按 Enter 执行统计，Esc 返回统计页。',
            emptyResult: '尚未执行统计。',
            inputLabel: '目录输入：',
            resultTitle: '结果摘要',
            configHint: 'Space 切换当前项。',
            saved: '配置切换已保存。',
            resetDone: '配置已重置。',
            result: {
                title: '统计概览',
                waitingBadge: '待运行',
                completeBadge: '完成',
                emptyTitle: '等待第一次统计',
                emptyDescription: '选择当前目录或输入其他路径，结果会按扩展名和热点文件整理。',
                target: '目标',
                files: '文件',
                lines: '行数',
                average: '平均/文件',
                warnings: '告警',
                extensionDistribution: '扩展名分布',
                topFiles: '热点文件',
                noExtension: '无扩展名',
                fileUnit: '{count} 文件',
                lineUnit: '{count} 行',
                warningSummary: '{count} 条扫描告警',
                enabledExtensions: '已启用扩展名',
                excludedDirectories: '已排除目录',
                countScope: '统计范围',
                countScopeValue: '当前目录或自定义目录'
            },
            config: {
                extensionsDescription: '决定哪些文件类型进入下一次代码行统计。',
                excludesDescription: '决定扫描目录时跳过哪些常见依赖、缓存和构建目录。',
                type: '规则类型',
                extensionType: '文件扩展名',
                excludeType: '目录名称',
                status: '当前状态',
                coverage: '配置概览',
                match: '匹配规则',
                included: '参与统计',
                ignored: '忽略文件',
                excluded: '跳过目录',
                scanned: '进入扫描',
                enabledSummary: '{enabled}/{total} 已启用',
                extensionImpact: '上次结果：{files} 个文件，{lines} 行',
                noResultImpact: '执行一次统计后可查看该扩展名的实际占比。'
            },
            panels: {
                actions: '开始统计',
                countInput: '目录输入',
                extensions: '文件扩展名',
                excludes: '排除目录',
                page: '第 {page}/{total} 页'
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
                    '[/]: 上一页 / 下一页',
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
            menuBadges: {
                current: 'Current',
                custom: 'Path',
                reset: 'Reset',
                exit: 'Exit'
            },
            footer: {
                count: 'Tab page | Up/Down select | Enter run | Esc back | ? help | q quit',
                config: 'Tab page | Up/Down select | [/] page | Space toggle | Esc back | ? help | q quit',
                input: 'Type or paste a directory | Enter count | Esc cancel',
                compactCount: 'Tab | Up/Down | Enter | ? | q',
                compactConfig: 'Tab | Up/Down | [/] | Space | ? | q',
                microCount: 'Up/Down Enter ? q',
                microConfig: 'Up/Down [/] Space q',
                microInput: 'Enter | Esc'
            },
            tooSmall: 'Terminal is too small',
            tooSmallDetail: 'Resize the terminal to at least 30 columns by 14 rows.',
            prompt: 'Type a directory path and press Enter. Esc returns to Count.',
            emptyResult: 'No count has been executed yet.',
            inputLabel: 'Directory input:',
            resultTitle: 'Result summary',
            configHint: 'Space toggles the current item.',
            saved: 'Configuration toggle saved.',
            resetDone: 'Configuration reset.',
            result: {
                title: 'Count overview',
                waitingBadge: 'Waiting',
                completeBadge: 'Complete',
                emptyTitle: 'Ready for the first count',
                emptyDescription: 'Choose the current directory or enter another path. Results are organized by extension and hotspot files.',
                target: 'Target',
                files: 'Files',
                lines: 'Lines',
                average: 'Average/file',
                warnings: 'Warnings',
                extensionDistribution: 'Extension distribution',
                topFiles: 'Hotspot files',
                noExtension: 'No extension',
                fileUnit: '{count} files',
                lineUnit: '{count} lines',
                warningSummary: '{count} scan warnings',
                enabledExtensions: 'Enabled extensions',
                excludedDirectories: 'Excluded directories',
                countScope: 'Count scope',
                countScopeValue: 'Current or custom directory'
            },
            config: {
                extensionsDescription: 'Controls which file types are included in the next line count.',
                excludesDescription: 'Controls which common dependency, cache, and build directories are skipped during scanning.',
                type: 'Rule type',
                extensionType: 'File extension',
                excludeType: 'Directory name',
                status: 'Current state',
                coverage: 'Configuration',
                match: 'Matches',
                included: 'Included',
                ignored: 'Ignored',
                excluded: 'Skipped',
                scanned: 'Scanned',
                enabledSummary: '{enabled}/{total} enabled',
                extensionImpact: 'Last result: {files} files, {lines} lines',
                noResultImpact: 'Run a count to see the actual share for this extension.'
            },
            panels: {
                actions: 'Start counting',
                countInput: 'Directory input',
                extensions: 'File extensions',
                excludes: 'Excluded directories',
                page: 'Page {page}/{total}'
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
                    '[/]: previous / next page',
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
