/**
 * @file PzipI18n
 * @project SlothTool
 * @module PZIP Plugin / Internationalization
 * @description 提供 pzip CLI 与全屏 TUI 的中英文文案，并读取 SlothTool 全局语言设置。
 * @logic 1. 从 Pipker SlothTool 设置读取语言；2. 按点路径定位中英文文案；3. 对模板变量进行安全替换。
 * @dependencies Node: fs/os/path
 * @index_tags pzip i18n, 双语文案, ZIP CLI, ZIP TUI
 * @author holic512
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function getSettingsPath() {
    return path.join(os.homedir(), '.pipker', 'slothtool', 'settings.json');
}

export function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8')).language || 'zh';
        }
    } catch {
        return 'zh';
    }

    return 'zh';
}

export const messages = {
    zh: {
        title: 'pzip - 智能 ZIP 目录压缩',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示帮助信息',
        tuiOption: '启动全屏 TUI',
        outputOption: '指定 ZIP 输出路径',
        excludeOption: '本次追加 Git-ignore 风格排除模式，可重复使用',
        dryRunOption: '仅扫描和汇总，不创建 ZIP',
        jsonOption: '以 JSON 输出结果',
        configTitle: '当前 pzip 配置：',
        configSaved: '配置已保存。',
        configReset: '配置已重置为默认规则。',
        configUnknownState: '状态必须是 "on" 或 "off"。',
        compressionSummary: '压缩摘要',
        sourceDirectory: '源目录',
        archivePath: 'ZIP 文件',
        filesIncluded: '纳入文件',
        directoriesIncluded: '纳入目录',
        filesExcluded: '过滤项',
        sourceBytes: '原始大小',
        archiveBytes: 'ZIP 大小',
        dryRun: '试运行',
        yes: '是',
        no: '否',
        exclusionSummary: '过滤统计',
        warningsTitle: '扫描告警',
        error: '错误',
        errors: {
            SOURCE_DIRECTORY_MISSING: '源目录不存在：{sourcePath}',
            SOURCE_NOT_DIRECTORY: '源路径不是可压缩目录：{sourcePath}',
            OUTPUT_DIRECTORY_MISSING: '输出目录不存在：{outputParent}',
            OUTPUT_INSIDE_SOURCE: '输出 ZIP 不能位于源目录内。',
            NO_ELIGIBLE_FILES: '应用过滤规则后没有可压缩文件。',
            CUSTOM_PATTERN_EMPTY: '自定义排除模式不能为空。',
            CUSTOM_PATTERN_NEGATED: '自定义排除模式不能以 "!" 开头。',
            CUSTOM_PATTERN_INVALID: '无效的自定义排除模式：{pattern}',
            UNKNOWN_BUILT_IN_RULE: '未知的内置规则：{ruleName}',
            CONFIG_READ_FAILED: '无法读取 pzip 配置：{configPath}'
        },
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 pzip TUI。',
        tui: {
            tabs: {
                compress: '压缩',
                filters: '过滤规则'
            },
            panels: {
                source: '压缩任务',
                result: '结果',
                rules: '默认规则',
                custom: '自定义模式',
                help: '快捷键'
            },
            labels: {
                source: '源目录',
                output: '输出 ZIP',
                defaultOutput: '默认同级输出',
                gitignore: '自动应用根目录及子目录 .gitignore',
                status: '状态',
                files: '文件',
                excluded: '过滤',
                archive: '归档',
                customPattern: '模式'
            },
            hints: {
                toggleRule: 'Space 切换当前默认规则'
            },
            actions: {
                editSource: '编辑源目录',
                editOutput: '编辑输出路径',
                useCurrent: '使用当前目录',
                run: '创建 ZIP',
                addPattern: '添加模式',
                removePattern: '删除选中模式'
            },
            footer: {
                compress: 'Tab 切页 | s 源目录 | o 输出 | c 当前目录 | Enter 压缩 | ? 帮助 | q 退出',
                filters: 'Tab 切页 | ↑↓ 选择 | Space 开关 | a 添加 | d 删除 | ? 帮助 | q 退出',
                input: '输入或粘贴内容 | Enter 保存 | Esc 取消',
                help: '任意键返回 | q 退出'
            },
            prompt: {
                source: '输入目录路径',
                output: '输入 ZIP 输出路径（留空使用默认）',
                pattern: '输入要追加的忽略模式，例如 logs/ 或 *.log'
            },
            status: {
                ready: '就绪：按 Enter 将当前设置压缩为 ZIP。',
                running: '正在扫描并创建 ZIP…',
                saved: '过滤规则已保存。',
                reset: '配置已重置。',
                complete: '完成：{path}',
                failed: '失败：{message}'
            },
            result: {
                empty: '尚未创建 ZIP。默认规则会在任意子目录层级生效。',
                dryRun: '试运行完成，未创建 ZIP。',
                warningCount: '{count} 条告警'
            },
            help: [
                'Tab：切换压缩页与过滤规则页',
                '压缩页：s 编辑源目录，o 编辑输出，c 使用当前目录，Enter 创建 ZIP',
                '过滤规则页：Space 切换默认规则，a 添加自定义模式，d 删除所选模式',
                '所有目录层级都会读取 .gitignore；启用的默认规则始终优先',
                'q：退出；Esc：取消输入或返回压缩页'
            ]
        }
    },
    en: {
        title: 'pzip - Smart ZIP directory archiver',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        tuiOption: 'Launch the full-screen TUI',
        outputOption: 'Set the ZIP output path',
        excludeOption: 'Add a one-run gitignore-style exclude pattern; repeatable',
        dryRunOption: 'Scan and summarize without creating a ZIP',
        jsonOption: 'Print the result as JSON',
        configTitle: 'Current pzip configuration:',
        configSaved: 'Configuration saved.',
        configReset: 'Configuration reset to the default rules.',
        configUnknownState: 'State must be "on" or "off".',
        compressionSummary: 'Compression summary',
        sourceDirectory: 'Source directory',
        archivePath: 'ZIP archive',
        filesIncluded: 'Included files',
        directoriesIncluded: 'Included directories',
        filesExcluded: 'Excluded entries',
        sourceBytes: 'Source size',
        archiveBytes: 'ZIP size',
        dryRun: 'Dry run',
        yes: 'Yes',
        no: 'No',
        exclusionSummary: 'Exclusion summary',
        warningsTitle: 'Scan warnings',
        error: 'Error',
        errors: {
            SOURCE_DIRECTORY_MISSING: 'Source directory does not exist: {sourcePath}',
            SOURCE_NOT_DIRECTORY: 'Source path is not an archive directory: {sourcePath}',
            OUTPUT_DIRECTORY_MISSING: 'Output directory does not exist: {outputParent}',
            OUTPUT_INSIDE_SOURCE: 'The output ZIP must be outside the source directory.',
            NO_ELIGIBLE_FILES: 'No eligible files remain after applying the archive filters.',
            CUSTOM_PATTERN_EMPTY: 'Custom exclude pattern must not be empty.',
            CUSTOM_PATTERN_NEGATED: 'Custom exclude patterns cannot start with "!".',
            CUSTOM_PATTERN_INVALID: 'Invalid custom exclude pattern: {pattern}',
            UNKNOWN_BUILT_IN_RULE: 'Unknown built-in rule: {ruleName}',
            CONFIG_READ_FAILED: 'Unable to read pzip configuration: {configPath}'
        },
        tuiRequiresTerminal: 'The current terminal is not interactive, so the pzip TUI cannot be launched.',
        tui: {
            tabs: {
                compress: 'Compress',
                filters: 'Filters'
            },
            hints: {
                toggleRule: 'Space toggles the selected default rule'
            },
            panels: {
                source: 'Archive task',
                result: 'Result',
                rules: 'Default rules',
                custom: 'Custom patterns',
                help: 'Keyboard help'
            },
            labels: {
                source: 'Source',
                output: 'Output ZIP',
                defaultOutput: 'Sibling output by default',
                gitignore: 'Root and nested .gitignore files are applied automatically',
                status: 'Status',
                files: 'Files',
                excluded: 'Excluded',
                archive: 'Archive',
                customPattern: 'Pattern'
            },
            actions: {
                editSource: 'Edit source directory',
                editOutput: 'Edit output path',
                useCurrent: 'Use current directory',
                run: 'Create ZIP',
                addPattern: 'Add pattern',
                removePattern: 'Delete selected pattern'
            },
            footer: {
                compress: 'Tab page | s source | o output | c current dir | Enter compress | ? help | q quit',
                filters: 'Tab page | Up/Down select | Space toggle | a add | d delete | ? help | q quit',
                input: 'Type or paste | Enter save | Esc cancel',
                help: 'Any key returns | q quits'
            },
            prompt: {
                source: 'Enter a directory path',
                output: 'Enter a ZIP output path (empty uses the default)',
                pattern: 'Enter an extra ignore pattern, such as logs/ or *.log'
            },
            status: {
                ready: 'Ready: press Enter to create a ZIP from the current settings.',
                running: 'Scanning and creating ZIP…',
                saved: 'Filter rules saved.',
                reset: 'Configuration reset.',
                complete: 'Complete: {path}',
                failed: 'Failed: {message}'
            },
            result: {
                empty: 'No ZIP has been created yet. Default rules apply at every directory depth.',
                dryRun: 'Dry run complete; no ZIP was created.',
                warningCount: '{count} warnings'
            },
            help: [
                'Tab: switch between Compress and Filters',
                'Compress: s edits the source, o edits output, c uses cwd, Enter creates a ZIP',
                'Filters: Space toggles defaults, a adds a custom pattern, d removes the selected pattern',
                'Every directory level reads .gitignore; enabled default rules always win',
                'q: quit; Esc: cancel an input or return to Compress'
            ]
        }
    }
};

export function t(key, params = {}) {
    const source = messages[getLanguage()] || messages.zh;
    const value = key.split('.').reduce((current, part) => current?.[part], source);
    if (typeof value !== 'string') {
        return key;
    }

    return value.replace(/\{(\w+)\}/gu, (_match, name) => String(params[name] ?? ''));
}

export function formatPzipError(error) {
    const errorCode = error?.code;
    const dictionary = messages[getLanguage()] || messages.zh;
    const template = dictionary.errors?.[errorCode];
    if (!template) {
        return error?.message || String(error);
    }

    return template.replace(/\{(\w+)\}/gu, (_match, name) => String(error.details?.[name] ?? ''));
}
