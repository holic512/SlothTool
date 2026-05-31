/**
 * @file ImageCompressI18n
 * @project SlothTool
 * @module Image Compress Plugin / Internationalization
 * @description 提供 image-compress 插件 CLI 与 Ink TUI 所需的中英文文案和模板替换。
 * @logic 1. 读取 ~/.slothtool/settings.json 的语言设置；2. 统一暴露 CLI/TUI 文案；3. 支持动态占位符替换。
 * @dependencies Node: fs/os/path
 * @index_tags 图片压缩, i18n, 双语, TUI文案, CLI文案
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
        title: 'image-compress - 图片压缩工具',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示帮助信息',
        tuiOption: '启动全屏 TUI',
        dragHint: '在 TUI 中支持直接拖拽文件或文件夹到终端。',
        dryRun: '仅预演，不写入文件',
        outputDir: '指定输出目录',
        recursive: '递归扫描目录',
        json: '输出 JSON 汇总',
        quiet: '隐藏 TUI / CLI 进度提示',
        quality: 'JPEG 质量（1-100）',
        maxWidth: '限制输出最大宽度',
        maxHeight: '限制输出最大高度',
        overwrite: '覆盖目标输出路径',
        allowLarger: '即使压缩后更大也写出',
        concurrency: '并发 worker 数量',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 image-compress TUI。',
        cliErrorPrefix: '错误',
        backendUnavailable: 'Go 后端命令执行失败：{message}',
        examplesList: {
            defaultTui: '进入默认 TUI',
            singleFile: '压缩单个图片',
            batch: '递归压缩目录并输出到新目录',
            dryRunJson: '预演并输出 JSON'
        },
        tui: {
            tabs: {
                run: '运行',
                options: '选项',
                history: '历史'
            },
            footer: 'Tab 切页  Up/Down 移动  Left/Right 调整  Enter 执行  Esc 返回  ? 帮助  q 退出',
            dropZoneTitle: '拖拽 / 粘贴源路径',
            dropZoneHint: '把文件或文件夹直接拖进终端，或按 Enter 手动输入路径。',
            emptyTargets: '尚未选择源路径。可拖拽文件，或使用“加入当前目录”。',
            inputHint: '支持空格、引号和多路径粘贴。Enter 确认，Esc 取消。',
            outputInputHint: '为输出目录输入或拖入一个目录路径。留空表示写回源目录旁的 .compressed 文件。',
            requestTitle: '本次请求',
            requestLines: {
                outputSameDir: '输出策略：源目录旁生成 .compressed 文件',
                outputDir: '输出目录：{dir}',
                quality: 'JPEG 质量：{value}',
                resize: '尺寸限制：{width} x {height}',
                resizeOff: '尺寸限制：保持原始尺寸',
                recursionOn: '目录扫描：递归',
                recursionOff: '目录扫描：仅当前层',
                overwriteOn: '覆盖策略：允许覆盖目标路径',
                overwriteOff: '覆盖策略：不覆盖已有文件',
                largerOn: '写出策略：允许更大文件',
                largerOff: '写出策略：仅写更小文件',
                dryRunOn: '写出模式：预演',
                dryRunOff: '写出模式：实际写入',
                concurrencyAuto: '并发：后端自动决定',
                concurrencyFixed: '并发：{value}'
            },
            menu: {
                compress: '开始压缩',
                addCurrentDir: '加入当前目录',
                editTargets: '手动输入 / 拖拽路径',
                clearTargets: '清空源路径',
                openOptions: '打开选项页',
                exit: '退出'
            },
            options: {
                outputDir: '输出目录',
                quality: 'JPEG 质量',
                maxWidth: '最大宽度',
                maxHeight: '最大高度',
                recursive: '递归目录',
                overwrite: '允许覆盖',
                allowLarger: '允许更大文件',
                dryRun: '预演模式',
                concurrency: '并发数'
            },
            optionHelp: {
                outputDir: 'Enter 编辑输出目录，支持拖拽目录。',
                number: 'Left/Right 调整数值，0 表示关闭或使用后端默认值。',
                boolean: 'Space / Left / Right 切换开关。'
            },
            optionValue: {
                auto: '自动',
                off: '关闭',
                on: '开启',
                emptyOutputDir: '跟随源文件目录'
            },
            history: {
                empty: '还没有执行过压缩任务。',
                title: '最近结果',
                summary: '成功 {success} / 跳过 {skipped} / 失败 {failed} / 节省 {saved}'
            },
            help: {
                title: '快捷键',
                lines: [
                    'Tab: 切换顶部页面',
                    'Up/Down: 移动菜单或选项',
                    'Left/Right: 调整数值或开关',
                    'Enter: 执行操作 / 编辑路径',
                    '拖拽文件: 直接把路径放入当前 TUI',
                    'Esc: 退出输入模式或返回运行页',
                    'q: 退出',
                    '?: 打开帮助'
                ]
            },
            status: {
                ready: '就绪，可直接拖拽文件或目录。',
                busy: '正在调用 Go 后端执行压缩…',
                captured: '已捕获 {count} 个路径。',
                cwdAdded: '已加入当前目录：{dir}',
                noTargets: '当前没有可压缩的路径，请先拖拽或输入路径。',
                targetsCleared: '已清空源路径列表。',
                outputDirSaved: '输出目录已更新。',
                runDone: '压缩完成：成功 {success}，跳过 {skipped}，失败 {failed}。',
                runWarn: '任务完成，但存在跳过或失败项。',
                inputSaved: '源路径已加入列表。',
                invalidPaths: '未识别到有效路径文本。',
                outputDirCleared: '输出目录已清空，将写回源目录旁。',
                optionUpdated: '选项已更新：{label}',
                cancelledInput: '已取消输入。',
                inputModeTargets: '输入或拖拽源路径。',
                inputModeOutput: '输入或拖拽输出目录。'
            }
        }
    },
    en: {
        title: 'image-compress - Image compression tool',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        tuiOption: 'Launch the full-screen TUI',
        dragHint: 'The TUI accepts dragged and dropped files or directories directly in the terminal.',
        dryRun: 'Preview without writing files',
        outputDir: 'Write output files into this directory',
        recursive: 'Scan directories recursively',
        json: 'Print the batch summary as JSON',
        quiet: 'Hide TUI / CLI progress hints',
        quality: 'JPEG quality (1-100)',
        maxWidth: 'Limit the output width',
        maxHeight: 'Limit the output height',
        overwrite: 'Overwrite the target output path',
        allowLarger: 'Write output even when it grows',
        concurrency: 'Worker count',
        tuiRequiresTerminal: 'The current terminal is not interactive, so the image-compress TUI cannot be launched.',
        cliErrorPrefix: 'Error',
        backendUnavailable: 'Failed to execute the Go backend command: {message}',
        examplesList: {
            defaultTui: 'Enter the default TUI',
            singleFile: 'Compress a single image',
            batch: 'Recursively compress a directory into a new output directory',
            dryRunJson: 'Preview and print JSON'
        },
        tui: {
            tabs: {
                run: 'Run',
                options: 'Options',
                history: 'History'
            },
            footer: 'Tab page  Up/Down move  Left/Right adjust  Enter action  Esc back  ? help  q quit',
            dropZoneTitle: 'Drop / paste source paths',
            dropZoneHint: 'Drag files or folders into this terminal, or press Enter to type paths manually.',
            emptyTargets: 'No source paths selected yet. Drag files in, or use "Add current directory".',
            inputHint: 'Spaces, quotes, and multi-path paste are supported. Enter confirms, Esc cancels.',
            outputInputHint: 'Type or drag a directory path for the output location. Leave empty to write .compressed files beside the sources.',
            requestTitle: 'Current request',
            requestLines: {
                outputSameDir: 'Output: create .compressed files beside the source',
                outputDir: 'Output directory: {dir}',
                quality: 'JPEG quality: {value}',
                resize: 'Resize limit: {width} x {height}',
                resizeOff: 'Resize limit: keep the original dimensions',
                recursionOn: 'Directory scan: recursive',
                recursionOff: 'Directory scan: current level only',
                overwriteOn: 'Overwrite policy: allowed',
                overwriteOff: 'Overwrite policy: never overwrite existing files',
                largerOn: 'Write policy: allow larger output',
                largerOff: 'Write policy: only save smaller output',
                dryRunOn: 'Write mode: dry run',
                dryRunOff: 'Write mode: write files',
                concurrencyAuto: 'Concurrency: backend managed',
                concurrencyFixed: 'Concurrency: {value}'
            },
            menu: {
                compress: 'Start compression',
                addCurrentDir: 'Add current directory',
                editTargets: 'Type / drop paths',
                clearTargets: 'Clear source paths',
                openOptions: 'Open options page',
                exit: 'Exit'
            },
            options: {
                outputDir: 'Output directory',
                quality: 'JPEG quality',
                maxWidth: 'Maximum width',
                maxHeight: 'Maximum height',
                recursive: 'Recursive directory scan',
                overwrite: 'Allow overwrite',
                allowLarger: 'Allow larger output',
                dryRun: 'Dry-run mode',
                concurrency: 'Concurrency'
            },
            optionHelp: {
                outputDir: 'Press Enter to edit the output directory, and drag a directory in if you want.',
                number: 'Use Left/Right to change the value. 0 disables the limit or uses the backend default.',
                boolean: 'Use Space / Left / Right to toggle the setting.'
            },
            optionValue: {
                auto: 'Auto',
                off: 'Off',
                on: 'On',
                emptyOutputDir: 'Beside the source paths'
            },
            history: {
                empty: 'No compression run has been executed yet.',
                title: 'Recent results',
                summary: 'Success {success} / Skipped {skipped} / Failed {failed} / Saved {saved}'
            },
            help: {
                title: 'Keymap',
                lines: [
                    'Tab: switch top page',
                    'Up/Down: move in menus or options',
                    'Left/Right: adjust numbers or toggles',
                    'Enter: run the action or edit a path',
                    'Drag files: drop their paths directly into this TUI',
                    'Esc: leave input mode or go back to Run',
                    'q: quit',
                    '?: open help'
                ]
            },
            status: {
                ready: 'Ready. You can drag files or directories in right away.',
                busy: 'Calling the Go backend to compress images…',
                captured: 'Captured {count} path(s).',
                cwdAdded: 'Added the current directory: {dir}',
                noTargets: 'There is nothing to compress yet. Drag or type a path first.',
                targetsCleared: 'Cleared the source path list.',
                outputDirSaved: 'Updated the output directory.',
                runDone: 'Compression finished: success {success}, skipped {skipped}, failed {failed}.',
                runWarn: 'The run finished, but some items were skipped or failed.',
                inputSaved: 'Added the source path(s) to the list.',
                invalidPaths: 'No valid path text was detected.',
                outputDirCleared: 'Cleared the output directory; output goes beside the sources.',
                optionUpdated: 'Updated option: {label}',
                cancelledInput: 'Cancelled the current input mode.',
                inputModeTargets: 'Type or drop source paths.',
                inputModeOutput: 'Type or drop the output directory.'
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
        return message.replace(/\{(\w+)\}/gu, (match, name) => (
            params[name] !== undefined ? String(params[name]) : match
        ));
    }

    return message;
}

export default {
    getLanguage,
    t
};
