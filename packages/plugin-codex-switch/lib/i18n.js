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
        // ignore
    }
    return 'zh';
}

const messages = {
    zh: {
        title: 'codex-switch - Codex 配置切换工具',
        usage: '用法：',
        options: '选项：',
        commands: '命令：',
        examples: '示例：',
        help: '显示帮助信息',
        interactive: '交互式模式',
        missingCommand: '缺少命令参数',
        invalidArgs: '参数错误',
        actionCancelled: '已取消',
        writeSuccess: '配置已更新',
        writeFailed: '配置写入失败',
        backupCreated: '已创建备份',
        rollbackDone: '回滚完成',
        confirmWrite: '确认写入配置吗？',
        noBackup: '没有可用备份',
        noConfig: '未找到 Codex 配置文件',
        doctorOk: '诊断通过',
        doctorWarn: '诊断存在警告',
        cleanConfirm: '确认执行缓存清理吗？',
        cleanDone: '清理完成',
        cleanDryRun: '演练完成（未删除）',
        sourceRemote: '远端',
        sourceCache: '缓存',
        sourceManual: '手动',
        menuHint: '使用上下键选择，回车确认',
        menuTitle: '请选择操作：',
        menuCurrent: '查看当前配置',
        menuModes: '查看 modes/models',
        menuUse: '更新模型（自动获取）',
        menuEditConfig: '编辑配置（config/auth）',
        menuBackupList: '查看备份',
        menuRollback: '回滚配置',
        menuClean: '清理缓存',
        menuExit: '退出',
        promptMode: '选择 mode：',
        promptModel: '选择 model：',
        promptProvider: '选择 provider：',
        promptManualModel: '请输入 model（手动模式）：',
        promptSessionsDays: '清理多少天前的 sessions：',
        promptBackup: '选择回滚备份：',
        promptContinue: '按回车返回主菜单',
        configPath: '配置路径',
        selectedPath: '已选路径',
        fallbackToCache: '远端失败，已回退缓存',
        fallbackToManual: '无可用缓存，进入手动模式'
    },
    en: {
        title: 'codex-switch - Codex config switcher',
        usage: 'Usage:',
        options: 'Options:',
        commands: 'Commands:',
        examples: 'Examples:',
        help: 'Show help message',
        interactive: 'Interactive mode',
        missingCommand: 'Missing command arguments',
        invalidArgs: 'Invalid arguments',
        actionCancelled: 'Cancelled',
        writeSuccess: 'Config updated',
        writeFailed: 'Failed to write config',
        backupCreated: 'Backup created',
        rollbackDone: 'Rollback completed',
        confirmWrite: 'Confirm writing config?',
        noBackup: 'No backup available',
        noConfig: 'Codex config file not found',
        doctorOk: 'Doctor check passed',
        doctorWarn: 'Doctor check has warnings',
        cleanConfirm: 'Confirm cache cleanup?',
        cleanDone: 'Cleanup completed',
        cleanDryRun: 'Dry-run completed (no file deleted)',
        sourceRemote: 'remote',
        sourceCache: 'cache',
        sourceManual: 'manual',
        menuHint: 'Use arrow keys and Enter to select',
        menuTitle: 'Select an action:',
        menuCurrent: 'Show current config',
        menuModes: 'Show modes/models',
        menuUse: 'Update model (auto fetch)',
        menuEditConfig: 'Edit config (config/auth)',
        menuBackupList: 'List backups',
        menuRollback: 'Rollback config',
        menuClean: 'Clean cache',
        menuExit: 'Exit',
        promptMode: 'Select mode:',
        promptModel: 'Select model:',
        promptProvider: 'Select provider:',
        promptManualModel: 'Enter model (manual mode):',
        promptSessionsDays: 'Delete sessions older than how many days:',
        promptBackup: 'Select backup to rollback:',
        promptContinue: 'Press Enter to return to menu',
        configPath: 'Config path',
        selectedPath: 'Selected path',
        fallbackToCache: 'Remote failed, using cache',
        fallbackToManual: 'No cache available, switching to manual mode'
    }
};

function t(key, params = {}) {
    const lang = getLanguage();
    const dict = messages[lang] || messages.zh;
    const value = dict[key];
    if (typeof value !== 'string') {
        return key;
    }
    return value.replace(/\{(\w+)\}/g, (m, p) => (params[p] !== undefined ? String(params[p]) : m));
}

module.exports = {
    getLanguage,
    t
};
