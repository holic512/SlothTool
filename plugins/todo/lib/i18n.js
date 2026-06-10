/**
 * @file TodoI18n
 * @project SlothTool
 * @module Todo Plugin / Internationalization
 * @description 提供 todo CLI 与 TUI 的中英文文案，并读取 SlothTool 全局语言设置。
 * @logic 1. 从 ~/.slothtool/settings.json 读取语言；2. 维护任务管理和同步文案字典；3. 支持点路径访问和模板变量替换。
 * @dependencies Node: fs/os/path
 * @index_tags todo i18n, CLI文案, TUI文案, 双语
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
            return settings.language === 'en' ? 'en' : 'zh';
        }
    } catch {
        return 'zh';
    }

    return 'zh';
}

export const messages = {
    zh: {
        title: 'todo - JSON TodoList',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示帮助信息',
        tuiOption: '启动全屏 TUI',
        jsonOption: '输出 JSON',
        allOption: '包含已归档和已删除任务',
        added: '已新增任务：{id} {title}',
        updated: '已更新任务：{id}',
        deleted: '已软删除任务：{id}',
        purged: '已物理删除任务：{id}',
        noTasks: '没有匹配的任务。',
        noItems: '没有项目。',
        taskCount: '任务数：{count}',
        syncDone: 'gstore {action} 完成。',
        syncMissing: 'gstore 不可用，请先执行 slothtool install gstore。',
        syncUnbound: 'todo/default 尚未绑定，请执行：gstore bind todo default {dir}',
        dataDir: '数据目录：{dir}',
        configPath: '配置路径：{path}',
        unknownCommand: '未知命令：{command}',
        taskRequired: '请指定任务 id 前缀。',
        titleRequired: '请指定标题。',
        listCreated: '已创建列表：{id}',
        listUpdated: '已更新列表：{id}',
        listArchived: '已归档列表：{id}',
        statsTitle: '任务统计',
        tui: {
            footer: 'Tab 切页  Up/Down 移动  n 新增  d 完成  r 刷新  s 同步  / 搜索  q 退出',
            inputTitle: '输入任务标题后 Enter 保存，Esc 取消。',
            searchHint: '输入搜索关键字后 Enter 应用，Esc 取消。',
            tabs: {
                inbox: '收件箱',
                today: '今天',
                upcoming: '即将',
                projects: '项目',
                tags: '标签',
                search: '搜索',
                sync: '同步',
                settings: '设置'
            },
            status: {
                ready: '就绪',
                loading: '处理中...',
                refreshed: '已刷新。',
                noTask: '没有可操作任务。',
                saved: '已保存。',
                synced: '同步完成。',
                input: '输入中...'
            }
        }
    },
    en: {
        title: 'todo - JSON TodoList',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        tuiOption: 'Launch the full-screen TUI',
        jsonOption: 'Print JSON',
        allOption: 'Include archived and deleted tasks',
        added: 'Added task: {id} {title}',
        updated: 'Updated task: {id}',
        deleted: 'Soft-deleted task: {id}',
        purged: 'Purged task file: {id}',
        noTasks: 'No matching tasks.',
        noItems: 'No items.',
        taskCount: 'Tasks: {count}',
        syncDone: 'gstore {action} completed.',
        syncMissing: 'gstore is unavailable. Run: slothtool install gstore.',
        syncUnbound: 'todo/default is not bound. Run: gstore bind todo default {dir}',
        dataDir: 'Data directory: {dir}',
        configPath: 'Config path: {path}',
        unknownCommand: 'Unknown command: {command}',
        taskRequired: 'Specify a task id prefix.',
        titleRequired: 'Specify a title.',
        listCreated: 'Created list: {id}',
        listUpdated: 'Updated list: {id}',
        listArchived: 'Archived list: {id}',
        statsTitle: 'Task stats',
        tui: {
            footer: 'Tab page  Up/Down move  n new  d done  r refresh  s sync  / search  q quit',
            inputTitle: 'Type a task title and press Enter. Esc cancels.',
            searchHint: 'Type a search query and press Enter. Esc cancels.',
            tabs: {
                inbox: 'Inbox',
                today: 'Today',
                upcoming: 'Upcoming',
                projects: 'Projects',
                tags: 'Tags',
                search: 'Search',
                sync: 'Sync',
                settings: 'Settings'
            },
            status: {
                ready: 'Ready',
                loading: 'Working...',
                refreshed: 'Refreshed.',
                noTask: 'No task is selected.',
                saved: 'Saved.',
                synced: 'Synced.',
                input: 'Editing...'
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
