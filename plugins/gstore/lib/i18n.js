/**
 * @file GStoreI18n
 * @project SlothTool
 * @module GStore Plugin / Internationalization
 * @description 提供 gstore CLI 与 TUI 的中英文文案，并读取 SlothTool 全局语言设置。
 * @logic 1. 从 ~/.slothtool/settings.json 读取语言；2. 维护 CLI/TUI 文案字典；3. 支持点路径访问和模板变量替换。
 * @dependencies Node: fs/os/path
 * @index_tags gstore i18n, 数据同步, GitHub, CLI文案, TUI文案
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
        title: 'gstore - GitHub 个人数据同步',
        usage: '用法：',
        options: '选项：',
        commands: '命令：',
        examples: '示例：',
        authExample: '输出 GitHub 登录地址和一次性代码；不会自动打开浏览器',
        help: '显示帮助信息',
        tuiOption: '启动全屏 TUI',
        jsonOption: '输出 JSON',
        createOption: '创建 GitHub private repo',
        messageOption: '提交消息',
        repoRequired: '请先执行 gstore repo set <OWNER/REPO> 绑定 GitHub 仓库。',
        bindingRequired: '请指定 tool 和 name。',
        localDirRequired: '请指定本地数据目录。',
        unknownCommand: '未知命令：{command}',
        configSaved: '配置已保存。',
        authReady: 'GitHub CLI 已登录。',
        authInstalled: '已完成 GitHub CLI 安装尝试。',
        manualDeviceLogin: '请手动打开 {url}，输入一次性代码 {code}，完成授权后回到终端等待；gstore 不会自动打开浏览器。',
        manualDeviceLoginNoCode: '请按 GitHub CLI 提示手动完成授权；gstore 不会自动打开浏览器，并会继续等待授权结果。',
        manualAuthUrl: '登录地址：{url}',
        manualAuthCode: '一次性代码：{code}',
        manualAuthWaiting: '浏览器授权完成后回到这里等待登录结果。',
        repoSet: '数据仓库已绑定：{repo}',
        bindDone: '已绑定 {tool}/{name} -> {localPath}',
        unbindDone: '已解除绑定：{tool}/{name}',
        noBindings: '尚未绑定任何数据目录。',
        dataDir: '数据仓库目录：{dir}',
        remote: '远端仓库：{remote}',
        noRemote: '未配置远端仓库',
        statusTitle: '同步状态：{tool}/{name}',
        clean: '已同步，无变更。',
        localChanges: '本地变更：{count}',
        remoteChanges: '远端变更：{count}',
        conflicts: '冲突文件：{count}',
        pullDone: 'pull 完成：应用远端变更 {count} 个。',
        pushDone: 'push 完成：提交 {commit}。',
        pushNoChanges: '没有需要 push 的本地变更。',
        syncDone: 'sync 完成。',
        conflictStop: '检测到冲突，操作已停止。',
        remoteChangedStop: '远端已有变更，请先执行 pull 或 sync。',
        doctorTitle: 'gstore 诊断',
        ok: '正常',
        missing: '缺失',
        failed: '失败',
        installed: '已安装',
        notLoggedIn: '未登录',
        networkHint: '网络异常，请检查代理、DNS 或 GitHub 连接。',
        authHint: '认证失败，请执行 gstore auth。',
        rejectedHint: 'push 被拒绝，请先 pull 或 sync。',
        mergeHint: 'Git 合并冲突，请检查数据仓库状态。',
        tui: {
            footer: 'Tab 切页  Up/Down 移动  r 刷新  a 手动登录  l Pull  p Push  s Sync  c 冲突  q 退出',
            inputHint: '输入 OWNER/REPO 后 Enter 保存，Esc 取消。',
            tabs: {
                overview: '概览',
                auth: '登录',
                repository: '仓库',
                bindings: '绑定',
                sync: '同步',
                conflicts: '冲突',
                settings: '设置'
            },
            status: {
                ready: '就绪',
                loading: '处理中...',
                refreshed: '已刷新。',
                noBinding: '没有可操作的绑定。',
                inputRepo: '输入 GitHub 仓库。',
                manualAuth: '请在浏览器完成 GitHub 授权，gstore 正在等待结果。'
            }
        }
    },
    en: {
        title: 'gstore - GitHub personal data sync',
        usage: 'Usage:',
        options: 'Options:',
        commands: 'Commands:',
        examples: 'Examples:',
        authExample: 'prints a GitHub login URL and one-time code; it does not open the browser',
        help: 'Show this help message',
        tuiOption: 'Launch the full-screen TUI',
        jsonOption: 'Print JSON',
        createOption: 'Create a GitHub private repo',
        messageOption: 'Commit message',
        repoRequired: 'Run gstore repo set <OWNER/REPO> before syncing.',
        bindingRequired: 'Specify tool and name.',
        localDirRequired: 'Specify a local data directory.',
        unknownCommand: 'Unknown command: {command}',
        configSaved: 'Configuration saved.',
        authReady: 'GitHub CLI is authenticated.',
        authInstalled: 'GitHub CLI install attempt completed.',
        manualDeviceLogin: 'Open {url} manually, enter one-time code {code}, then return to this terminal and wait; gstore will not open a browser automatically.',
        manualDeviceLoginNoCode: 'Follow the GitHub CLI prompt manually; gstore will not open a browser automatically and has continued waiting for authorization.',
        manualAuthUrl: 'Login URL: {url}',
        manualAuthCode: 'One-time code: {code}',
        manualAuthWaiting: 'Return here after browser authorization and wait for the login result.',
        repoSet: 'Data repository configured: {repo}',
        bindDone: 'Bound {tool}/{name} -> {localPath}',
        unbindDone: 'Unbound {tool}/{name}',
        noBindings: 'No data directories are bound yet.',
        dataDir: 'Data repository directory: {dir}',
        remote: 'Remote repository: {remote}',
        noRemote: 'No remote repository configured',
        statusTitle: 'Sync status: {tool}/{name}',
        clean: 'Synced. No changes.',
        localChanges: 'Local changes: {count}',
        remoteChanges: 'Remote changes: {count}',
        conflicts: 'Conflicting files: {count}',
        pullDone: 'Pull complete: applied {count} remote changes.',
        pushDone: 'Push complete: commit {commit}.',
        pushNoChanges: 'No local changes to push.',
        syncDone: 'Sync complete.',
        conflictStop: 'Conflicts detected; operation stopped.',
        remoteChangedStop: 'Remote has changes. Run pull or sync first.',
        doctorTitle: 'gstore doctor',
        ok: 'OK',
        missing: 'missing',
        failed: 'failed',
        installed: 'installed',
        notLoggedIn: 'not logged in',
        networkHint: 'Network error. Check proxy, DNS, or GitHub connectivity.',
        authHint: 'Authentication failed. Run gstore auth.',
        rejectedHint: 'Push was rejected. Run pull or sync first.',
        mergeHint: 'Git merge conflict. Inspect the data repository.',
        tui: {
            footer: 'Tab page  Up/Down move  r refresh  a manual auth  l Pull  p Push  s Sync  c conflicts  q quit',
            inputHint: 'Type OWNER/REPO and press Enter. Esc cancels.',
            tabs: {
                overview: 'Overview',
                auth: 'Auth',
                repository: 'Repository',
                bindings: 'Bindings',
                sync: 'Sync',
                conflicts: 'Conflicts',
                settings: 'Settings'
            },
            status: {
                ready: 'Ready',
                loading: 'Working...',
                refreshed: 'Refreshed.',
                noBinding: 'No binding is available.',
                inputRepo: 'Type a GitHub repository.',
                manualAuth: 'Complete GitHub authorization in your browser; gstore is waiting for the result.'
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
