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
        // ignore errors and fallback
    }
    return 'zh';
}

const messages = {
    zh: {
        title: 'systemd - 服务管理工具',
        usage: '用法：',
        options: '选项：',
        commands: '命令：',
        examples: '示例：',
        help: '显示帮助信息',
        interactive: '交互式模式',
        commandList: '列出服务',
        commandStart: '启动服务',
        commandStop: '停止服务',
        commandRestart: '重启服务',
        commandEnable: '启用服务',
        commandDisable: '禁用服务',
        commandLogs: '查看服务日志',
        commandStatus: '查看服务状态',
        listAll: '包含未运行服务',
        listState: '按状态过滤',
        listPattern: '按关键词过滤',
        logsLines: '显示行数',
        logsFollow: '持续跟随日志',
        logsSince: '起始时间',
        exampleInteractive: '进入交互式模式',
        exampleList: '列出运行中的服务',
        exampleListAll: '列出所有服务',
        exampleStart: '启动服务',
        exampleLogs: '查看服务日志',
        notLinux: '当前系统不支持 systemd（仅支持 Linux）',
        systemctlNotFound: '未找到 systemctl 命令，请确认 systemd 已安装',
        invalidServiceName: '无效的服务名称',
        missingService: '缺少服务名称参数',
        invalidArgs: '参数错误',
        commandFailed: '命令执行失败',
        permissionDenied: '权限不足，无法执行操作',
        suggestion: '可尝试：',
        noServicesFound: '未找到匹配的服务',
        menuTitle: '请选择操作：',
        menuQuickActions: '快速操作（历史记录）',
        menuListChoose: '列表并选择服务',
        menuStart: '启动服务',
        menuStop: '停止服务',
        menuRestart: '重启服务',
        menuEnable: '启用服务',
        menuDisable: '禁用服务',
        menuLogs: '查看日志',
        menuHistory: '历史记录',
        menuSettings: '设置',
        menuExit: '退出',
        menuStatus: '查看服务状态',
        promptSearch: '输入搜索关键词（可选）：',
        promptAction: '选择操作：',
        quickActionRecentActions: '最近操作',
        quickActionRecentService: '最近服务',
        promptState: '选择状态过滤：',
        stateAll: '全部',
        stateActive: '运行中',
        stateInactive: '未运行',
        stateFailed: '失败',
        promptService: '选择服务：',
        promptServiceName: '请输入服务名称：',
        promptConfirmStop: '确定要停止该服务吗？',
        promptConfirmDisable: '确定要禁用该服务吗？',
        promptConfirmRestart: '确定要重启该服务吗？',
        promptLogLines: '日志行数：',
        promptLogFollow: '是否持续跟随日志？',
        promptLogSince: '起始时间（可选）：',
        historyEmpty: '暂无历史记录',
        historyActionsTitle: '最近操作：',
        historyServicesTitle: '最近服务：',
        historySearchesTitle: '最近搜索：',
        historyClearConfirm: '确定清空历史记录吗？',
        historyCleared: '历史记录已清空',
        settingsTitle: '设置',
        settingsLogLines: '默认日志行数：',
        settingsConfirmDangerous: '危险操作确认：',
        settingsHistoryLimits: '历史记录上限：',
        settingsSaved: '设置已保存',
        actionSuccess: '操作成功',
        actionFailed: '操作失败',
        unknownError: '未知错误'
    },
    en: {
        title: 'systemd - Service Management Tool',
        usage: 'Usage:',
        options: 'Options:',
        commands: 'Commands:',
        examples: 'Examples:',
        help: 'Show help message',
        interactive: 'Interactive mode',
        commandList: 'List services',
        commandStart: 'Start service',
        commandStop: 'Stop service',
        commandRestart: 'Restart service',
        commandEnable: 'Enable service',
        commandDisable: 'Disable service',
        commandLogs: 'Show service logs',
        commandStatus: 'Show service status',
        listAll: 'Include inactive services',
        listState: 'Filter by state',
        listPattern: 'Filter by keyword',
        logsLines: 'Number of lines',
        logsFollow: 'Follow logs',
        logsSince: 'Since time',
        exampleInteractive: 'Enter interactive mode',
        exampleList: 'List active services',
        exampleListAll: 'List all services',
        exampleStart: 'Start a service',
        exampleLogs: 'Show service logs',
        notLinux: 'systemd is only supported on Linux',
        systemctlNotFound: 'systemctl not found. Please ensure systemd is installed',
        invalidServiceName: 'Invalid service name',
        missingService: 'Missing service name',
        invalidArgs: 'Invalid arguments',
        commandFailed: 'Command failed',
        permissionDenied: 'Permission denied',
        suggestion: 'Try:',
        noServicesFound: 'No services matched',
        menuTitle: 'Select an action:',
        menuQuickActions: 'Quick actions (history)',
        menuListChoose: 'List and choose service',
        menuStart: 'Start service',
        menuStop: 'Stop service',
        menuRestart: 'Restart service',
        menuEnable: 'Enable service',
        menuDisable: 'Disable service',
        menuLogs: 'View logs',
        menuHistory: 'History',
        menuSettings: 'Settings',
        menuExit: 'Exit',
        menuStatus: 'Show service status',
        promptSearch: 'Search keyword (optional):',
        promptAction: 'Select action:',
        quickActionRecentActions: 'Recent actions',
        quickActionRecentService: 'Recent services',
        promptState: 'Select state filter:',
        stateAll: 'All',
        stateActive: 'Active',
        stateInactive: 'Inactive',
        stateFailed: 'Failed',
        promptService: 'Select service:',
        promptServiceName: 'Enter service name:',
        promptConfirmStop: 'Are you sure you want to stop this service?',
        promptConfirmDisable: 'Are you sure you want to disable this service?',
        promptConfirmRestart: 'Are you sure you want to restart this service?',
        promptLogLines: 'Log lines:',
        promptLogFollow: 'Follow logs?',
        promptLogSince: 'Since time (optional):',
        historyEmpty: 'No history available',
        historyActionsTitle: 'Recent actions:',
        historyServicesTitle: 'Recent services:',
        historySearchesTitle: 'Recent searches:',
        historyClearConfirm: 'Clear history?',
        historyCleared: 'History cleared',
        settingsTitle: 'Settings',
        settingsLogLines: 'Default log lines:',
        settingsConfirmDangerous: 'Confirm dangerous actions:',
        settingsHistoryLimits: 'History limits:',
        settingsSaved: 'Settings saved',
        actionSuccess: 'Action succeeded',
        actionFailed: 'Action failed',
        unknownError: 'Unknown error'
    }
};

function t(key, params = {}) {
    const lang = getLanguage();
    const langMessages = messages[lang] || messages.zh;
    let message = langMessages[key];
    if (message === undefined) {
        return key;
    }
    if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/g, (match, param) => {
            return params[param] !== undefined ? params[param] : match;
        });
    }
    return message;
}

module.exports = {
    t,
    getLanguage
};
