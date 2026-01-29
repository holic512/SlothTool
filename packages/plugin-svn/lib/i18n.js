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
        // 标题和帮助
        title: 'SVN 交互式管理工具',
        usage: '用法：',
        options: '选项：',
        examples: '示例：',
        help: '显示此帮助信息',
        interactive: '交互式模式（推荐）',

        // 示例
        exampleHelp: '显示帮助信息',
        exampleInteractive: '启动交互式 SVN 管理界面',

        // 主菜单
        menuTitle: '请选择操作：',
        menuStatus: '查看工作区状态',
        menuCommit: '提交变更',
        menuDiff: '查看文件差异',
        menuAdd: '添加未跟踪文件',
        menuRevert: '撤销本地修改',
        menuUpdate: '更新工作副本',
        menuRefresh: '刷新状态',
        menuExit: '退出',

        // 状态信息
        statusTitle: '\n=== 工作区状态 ===\n',
        notSvnRepo: '错误：当前目录不是 SVN 工作副本',
        noChanges: '工作区干净，没有变更',
        modified: '已修改',
        added: '已添加',
        deleted: '已删除',
        conflicted: '冲突',
        unversioned: '未跟踪',
        missing: '缺失',

        // 提交
        commitTitle: '\n=== 提交变更 ===\n',
        selectFilesToCommit: '选择要提交的文件：',
        noFilesToCommit: '没有可提交的文件',
        enterCommitMessage: '请输入提交说明：',
        commitMessageRequired: '提交说明不能为空',
        confirmCommit: '确认提交以下文件？',
        commitSuccess: '✓ 提交成功！',
        commitFailed: '✗ 提交失败',
        commitCancelled: '提交已取消',

        // Diff
        diffTitle: '\n=== 文件差异 ===\n',
        selectFileForDiff: '选择要查看差异的文件：',
        noDiffFiles: '没有可查看差异的文件',
        diffFor: '文件差异：',

        // 添加文件
        addTitle: '\n=== 添加文件到版本控制 ===\n',
        selectFilesToAdd: '选择要添加的文件：',
        noUnversionedFiles: '没有未跟踪的文件',
        confirmAdd: '确认添加以下文件？',
        addSuccess: '✓ 文件已添加',
        addFailed: '✗ 添加失败',
        addCancelled: '操作已取消',

        // 撤销
        revertTitle: '\n=== 撤销本地修改 ===\n',
        selectFilesToRevert: '选择要撤销的文件：',
        noRevertFiles: '没有可撤销的文件',
        confirmRevert: '⚠️  警告：此操作将丢失本地修改！\n确认撤销以下文件？',
        revertSuccess: '✓ 已撤销修改',
        revertFailed: '✗ 撤销失败',
        revertCancelled: '操作已取消',

        // 更新
        updateTitle: '\n=== 更新工作副本 ===\n',
        confirmUpdate: '确认更新工作副本？',
        updateSuccess: '✓ 更新成功',
        updateFailed: '✗ 更新失败',
        updateCancelled: '更新已取消',

        // 冲突
        conflictWarning: '⚠️  警告：存在冲突文件，请先解决冲突',
        conflictFiles: '冲突文件：',
        cannotCommitWithConflicts: '无法提交：存在未解决的冲突',

        // 通用
        yes: '是',
        no: '否',
        confirm: '确认',
        cancel: '取消',
        back: '返回',
        loading: '加载中...',
        pressAnyKey: '按任意键继续...',
        selectInstructions: '使用空格键选择/取消选择，回车键确认',

        // 错误
        error: '错误',
        svnNotInstalled: 'SVN 未安装或不在 PATH 中',
        operationFailed: '操作失败',
        invalidDirectory: '无效的目录',

        // 文件计数
        filesSelected: '已选择 {count} 个文件',
        totalFiles: '共 {count} 个文件'
    },

    en: {
        // Title and help
        title: 'SVN Interactive Management Tool',
        usage: 'Usage:',
        options: 'Options:',
        examples: 'Examples:',
        help: 'Show this help message',
        interactive: 'Interactive mode (recommended)',

        // Examples
        exampleHelp: 'Show help message',
        exampleInteractive: 'Launch interactive SVN management interface',

        // Main menu
        menuTitle: 'Please select an action:',
        menuStatus: 'View working copy status',
        menuCommit: 'Commit changes',
        menuDiff: 'View file differences',
        menuAdd: 'Add untracked files',
        menuRevert: 'Revert local changes',
        menuUpdate: 'Update working copy',
        menuRefresh: 'Refresh status',
        menuExit: 'Exit',

        // Status
        statusTitle: '\n=== Working Copy Status ===\n',
        notSvnRepo: 'Error: Current directory is not an SVN working copy',
        noChanges: 'Working copy is clean, no changes',
        modified: 'Modified',
        added: 'Added',
        deleted: 'Deleted',
        conflicted: 'Conflicted',
        unversioned: 'Unversioned',
        missing: 'Missing',

        // Commit
        commitTitle: '\n=== Commit Changes ===\n',
        selectFilesToCommit: 'Select files to commit:',
        noFilesToCommit: 'No files to commit',
        enterCommitMessage: 'Enter commit message:',
        commitMessageRequired: 'Commit message cannot be empty',
        confirmCommit: 'Confirm commit for the following files?',
        commitSuccess: '✓ Commit successful!',
        commitFailed: '✗ Commit failed',
        commitCancelled: 'Commit cancelled',

        // Diff
        diffTitle: '\n=== File Differences ===\n',
        selectFileForDiff: 'Select file to view diff:',
        noDiffFiles: 'No files with differences',
        diffFor: 'Diff for:',

        // Add
        addTitle: '\n=== Add Files to Version Control ===\n',
        selectFilesToAdd: 'Select files to add:',
        noUnversionedFiles: 'No unversioned files',
        confirmAdd: 'Confirm adding the following files?',
        addSuccess: '✓ Files added',
        addFailed: '✗ Add failed',
        addCancelled: 'Operation cancelled',

        // Revert
        revertTitle: '\n=== Revert Local Changes ===\n',
        selectFilesToRevert: 'Select files to revert:',
        noRevertFiles: 'No files to revert',
        confirmRevert: '⚠️  Warning: This will discard local changes!\nConfirm reverting the following files?',
        revertSuccess: '✓ Changes reverted',
        revertFailed: '✗ Revert failed',
        revertCancelled: 'Operation cancelled',

        // Update
        updateTitle: '\n=== Update Working Copy ===\n',
        confirmUpdate: 'Confirm updating working copy?',
        updateSuccess: '✓ Update successful',
        updateFailed: '✗ Update failed',
        updateCancelled: 'Update cancelled',

        // Conflicts
        conflictWarning: '⚠️  Warning: Conflicted files exist, please resolve conflicts first',
        conflictFiles: 'Conflicted files:',
        cannotCommitWithConflicts: 'Cannot commit: unresolved conflicts exist',

        // Common
        yes: 'Yes',
        no: 'No',
        confirm: 'Confirm',
        cancel: 'Cancel',
        back: 'Back',
        loading: 'Loading...',
        pressAnyKey: 'Press any key to continue...',
        selectInstructions: 'Use space to select/deselect, enter to confirm',

        // Errors
        error: 'Error',
        svnNotInstalled: 'SVN is not installed or not in PATH',
        operationFailed: 'Operation failed',
        invalidDirectory: 'Invalid directory',

        // File count
        filesSelected: '{count} file(s) selected',
        totalFiles: 'Total {count} file(s)'
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
