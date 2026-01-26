const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * 获取 slothtool 设置路径
 * @returns {string} ~/.slothtool/settings.json
 */
function getSettingsPath() {
    return path.join(os.homedir(), '.slothtool', 'settings.json');
}

/**
 * 获取当前语言设置
 * @returns {string} 语言代码 ('zh' 或 'en')
 */
function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            const settings = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
            return settings.language || 'zh';
        }
    } catch (error) {
        // 忽略错误，使用默认语言
    }
    return 'zh'; // 默认中文
}

const messages = {
    zh: {
        // 帮助信息
        title: 'loc - 统计目录中的代码行数',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示此帮助信息',
        verbose: '显示详细的文件信息',
        config: '配置文件类型过滤',
        interactive: '交互式模式',

        // 示例
        exampleCurrent: '统计当前目录的代码行数',
        exampleSrc: '统计 ./src 目录的代码行数',
        exampleVerbose: '显示详细的文件信息',
        exampleConfig: '配置文件类型过滤',
        exampleInteractive: '交互式选择目录和配置',

        // 统计信息
        counting: '正在统计代码行数：',
        totalFiles: '总文件数：',
        totalLines: '总行数：',
        files: '文件：',
        lines: '行',

        // 交互式菜单
        menuTitle: '请选择操作：',
        menuCountCurrent: '统计当前目录代码行数',
        menuCountCustom: '统计指定目录代码行数',
        menuConfig: '配置文件类型过滤',
        menuExit: '退出',

        // 输入提示
        enterDirectory: '请输入目录路径：',
        invalidDirectory: '无效的目录路径',

        // 配置
        configTitle: '配置文件类型过滤',
        configInstructions: '使用空格键选择/取消选择，回车键确认',
        configSaved: '配置已保存！',
        allExtensions: '所有文件扩展名：',
        selectExtensions: '选择要统计的文件类型：'
    },

    en: {
        // Help
        title: 'loc - Count lines of code in a directory',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        verbose: 'Show detailed file information',
        config: 'Configure file type filtering',
        interactive: 'Interactive mode',

        // Examples
        exampleCurrent: 'Count lines in current directory',
        exampleSrc: 'Count lines in ./src directory',
        exampleVerbose: 'Show detailed file information',
        exampleConfig: 'Configure file type filtering',
        exampleInteractive: 'Interactive mode to select directory and config',

        // Statistics
        counting: 'Counting lines of code in:',
        totalFiles: 'Total files:',
        totalLines: 'Total lines:',
        files: 'Files:',
        lines: 'lines',

        // Interactive menu
        menuTitle: 'Please select an action:',
        menuCountCurrent: 'Count lines in current directory',
        menuCountCustom: 'Count lines in custom directory',
        menuConfig: 'Configure file type filtering',
        menuExit: 'Exit',

        // Input prompts
        enterDirectory: 'Enter directory path:',
        invalidDirectory: 'Invalid directory path',

        // Config
        configTitle: 'Configure File Type Filtering',
        configInstructions: 'Use space to select/deselect, enter to confirm',
        configSaved: 'Configuration saved!',
        allExtensions: 'All file extensions:',
        selectExtensions: 'Select file types to count:'
    }
};

/**
 * 获取本地化消息
 * @param {string} key - 消息键
 * @param {Object} params - 替换参数
 * @returns {string} 本地化的消息
 */
function t(key, params = {}) {
    const lang = getLanguage();
    const langMessages = messages[lang] || messages.zh;

    let message = langMessages[key];
    if (message === undefined) {
        return key;
    }

    // 替换参数
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
