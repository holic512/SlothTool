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
            resize: '终端空间不足', resizeHint: '请至少调整到 30 列 × 8 行。',
            tabs: {
                compress: '压缩',
                filters: '过滤规则'
            },
            panels: {
                source: '压缩任务',
                filters: '过滤规则',
                archive: '最近归档',
                preview: '扫描预演',
                warnings: '告警详情',
                error: '完整错误',
                pattern: '完整模式',
                help: '快捷键'
            },
            labels: {
                source: '源目录',
                output: '输出 ZIP',
                task: '当前任务',
                lastArchive: '最近归档',
                lastPreview: '最近预演',
                rulePosition: '规则 {index}/{count}  ↑↓ 或 PgUp/PgDn 选择',
                archive: '归档',
                customPattern: '模式'
            },
            task: {
                preview: '扫描预演',
                archive: '创建 ZIP'
            },
            exclusions: {
                builtIn: '默认规则过滤',
                gitignore: '.gitignore 过滤',
                custom: '自定义规则过滤',
                symlink: '跳过符号链接',
                special: '跳过特殊项'
            },
            errors: {
                sourceEmpty: '源目录不能为空。'
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
                input: '输入/粘贴 | ←→/Home/End 光标 | Delete/Ctrl+U 编辑 | Enter 保存 | Esc 取消',
                compactInput: 'Enter 保存 Esc 取消',
                detail: '↑↓/PgUp/PgDn 滚动 | Esc 返回',
                busy: '任务执行中，请等待…',
                keyHelp: '? 查看完整快捷键'
            },
            prompt: {
                source: '输入目录路径',
                output: '输入 ZIP 输出路径（留空使用默认）',
                pattern: '输入要追加的忽略模式，例如 logs/ 或 *.log'
            },
            status: {
                ready: '就绪：p 扫描预演，Enter 创建 ZIP。',
                previewRunning: '正在扫描预演…',
                running: '正在扫描并创建 ZIP…',
                saved: '过滤规则已保存。',
                previewComplete: '预演完成：未创建 ZIP，候选文件名未保留。',
                complete: '完成：{path}',
                failed: '失败：{message}'
            },
            result: {
                candidate: '候选输出位置',
                notReserved: '预演未创建 ZIP；执行时会重新确定文件名。',
                previewSummary: '纳入 {count} 个文件',
                actionHint: 'p 扫描预演 · Enter 创建 ZIP · r/v/w/e 查看详情'
            },
            help: [
                'Tab/Shift+Tab：正反向切换压缩页与过滤规则页',
                '压缩页：s 源目录，o 输出，c 当前目录，p 扫描预演，Enter 创建 ZIP',
                'r 最近归档，v 最近预演，w 告警，e 完整错误',
                '过滤页：↑↓/PgUp/PgDn 选择，Space 切换默认规则，a 添加，d 删除，v 查看完整模式',
                '输入错误可继续修改草稿，Esc 取消输入；详情页可滚动',
                '根目录和子目录的 .gitignore 都会生效；启用的默认规则优先',
                'q：退出；任务执行期间请等待'
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
            resize: 'Terminal is too small', resizeHint: 'Resize to at least 30 columns × 8 rows.',
            tabs: {
                compress: 'Compress',
                filters: 'Filters'
            },
            hints: {
                toggleRule: 'Space toggles the selected default rule'
            },
            panels: {
                source: 'Archive task',
                filters: 'Filter rules',
                archive: 'Last archive',
                preview: 'Scan preview',
                warnings: 'Warning details',
                error: 'Full error',
                pattern: 'Full pattern',
                help: 'Keyboard help'
            },
            labels: {
                source: 'Source',
                output: 'Output ZIP',
                task: 'Current task',
                lastArchive: 'Last archive',
                lastPreview: 'Last preview',
                rulePosition: 'Rule {index}/{count}  Up/Down or PgUp/PgDn',
                archive: 'Archive',
                customPattern: 'Pattern'
            },
            task: {
                preview: 'Scan preview',
                archive: 'Create ZIP'
            },
            exclusions: {
                builtIn: 'Default rules',
                gitignore: '.gitignore',
                custom: 'Custom rules',
                symlink: 'Skipped symlinks',
                special: 'Skipped special entries'
            },
            errors: {
                sourceEmpty: 'Source directory must not be empty.'
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
                input: 'Type/paste | Left/Right/Home/End cursor | Delete/Ctrl+U edit | Enter save | Esc cancel',
                compactInput: 'Enter save Esc cancel',
                detail: 'Up/Down/PgUp/PgDn scroll | Esc back',
                busy: 'Task running; please wait…',
                keyHelp: '? for keyboard help'
            },
            prompt: {
                source: 'Enter a directory path',
                output: 'Enter a ZIP output path (empty uses the default)',
                pattern: 'Enter an extra ignore pattern, such as logs/ or *.log'
            },
            status: {
                ready: 'Ready: p scans a preview; Enter creates a ZIP.',
                previewRunning: 'Scanning preview…',
                running: 'Scanning and creating ZIP…',
                saved: 'Filter rules saved.',
                previewComplete: 'Preview complete: no ZIP created; candidate name not reserved.',
                complete: 'Complete: {path}',
                failed: 'Failed: {message}'
            },
            result: {
                candidate: 'Candidate output',
                notReserved: 'Preview did not create a ZIP; the name is chosen again when running.',
                previewSummary: '{count} files included',
                actionHint: 'p scan preview · Enter create ZIP · r/v/w/e details'
            },
            help: [
                'Tab/Shift+Tab: switch between Compress and Filters in either direction',
                'Compress: s source, o output, c current dir, p scan preview, Enter create ZIP',
                'r last archive, v last preview, w warnings, e full error',
                'Filters: Up/Down/PgUp/PgDn select, Space toggle a default, a add, d delete, v show full pattern',
                'Fix an input error by editing the draft; Esc cancels. Detail pages scroll.',
                'Root and nested .gitignore files apply; enabled default rules take priority',
                'q: quit; wait while a task is running'
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
