const {execSync, spawn} = require('child_process');
const path = require('path');
const {t} = require('./i18n');

/**
 * 检查当前目录是否为 SVN 工作副本
 * @param {string} dir - 目录路径
 * @returns {boolean} 是否为 SVN 工作副本
 */
function isSvnWorkingCopy(dir = '.') {
    try {
        execSync('svn info', {
            cwd: dir,
            stdio: 'pipe',
            encoding: 'utf8'
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 检查 SVN 是否已安装
 * @returns {boolean} SVN 是否可用
 */
function isSvnInstalled() {
    try {
        execSync('svn --version', {
            stdio: 'pipe',
            encoding: 'utf8'
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 解析 SVN 状态输出
 * @param {string} statusOutput - svn status 命令的输出
 * @returns {Object} 分类后的文件状态
 */
function parseStatus(statusOutput) {
    const lines = statusOutput.trim().split('\n').filter(line => line.trim());

    const status = {
        modified: [],
        added: [],
        deleted: [],
        conflicted: [],
        unversioned: [],
        missing: []
    };

    lines.forEach(line => {
        if (line.length < 8) return;

        const statusCode = line.substring(0, 7).trim();
        const filePath = line.substring(7).trim();

        // 第一列：文件内容状态
        const firstChar = statusCode[0];

        switch (firstChar) {
            case 'M': // Modified
                status.modified.push(filePath);
                break;
            case 'A': // Added
                status.added.push(filePath);
                break;
            case 'D': // Deleted
                status.deleted.push(filePath);
                break;
            case 'C': // Conflicted
                status.conflicted.push(filePath);
                break;
            case '?': // Unversioned
                status.unversioned.push(filePath);
                break;
            case '!': // Missing
                status.missing.push(filePath);
                break;
        }
    });

    return status;
}

/**
 * 获取工作副本状态
 * @param {string} dir - 目录路径
 * @returns {Object} 文件状态对象
 */
function getStatus(dir = '.') {
    try {
        const output = execSync('svn status', {
            cwd: dir,
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return parseStatus(output);
    } catch (error) {
        throw new Error(`Failed to get SVN status: ${error.message}`);
    }
}

/**
 * 获取文件差异
 * @param {string} filePath - 文件路径
 * @param {string} dir - 工作目录
 * @returns {string} 差异内容
 */
function getDiff(filePath, dir = '.') {
    try {
        const output = execSync(`svn diff "${filePath}"`, {
            cwd: dir,
            encoding: 'utf8',
            stdio: 'pipe'
        });

        return output || t('noDiffFiles');
    } catch (error) {
        throw new Error(`Failed to get diff: ${error.message}`);
    }
}

/**
 * 添加文件到版本控制
 * @param {Array<string>} files - 文件路径数组
 * @param {string} dir - 工作目录
 * @returns {boolean} 是否成功
 */
function addFiles(files, dir = '.') {
    try {
        const fileList = files.map(f => `"${f}"`).join(' ');
        execSync(`svn add ${fileList}`, {
            cwd: dir,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return true;
    } catch (error) {
        throw new Error(`Failed to add files: ${error.message}`);
    }
}

/**
 * 撤销文件修改
 * @param {Array<string>} files - 文件路径数组
 * @param {string} dir - 工作目录
 * @returns {boolean} 是否成功
 */
function revertFiles(files, dir = '.') {
    try {
        const fileList = files.map(f => `"${f}"`).join(' ');
        execSync(`svn revert ${fileList}`, {
            cwd: dir,
            encoding: 'utf8',
            stdio: 'pipe'
        });
        return true;
    } catch (error) {
        throw new Error(`Failed to revert files: ${error.message}`);
    }
}

/**
 * 提交文件
 * @param {Array<string>} files - 文件路径数组
 * @param {string} message - 提交说明
 * @param {string} dir - 工作目录
 * @returns {Promise<boolean>} 是否成功
 */
function commitFiles(files, message, dir = '.') {
    return new Promise((resolve, reject) => {
        const fileList = files.map(f => `"${f}"`).join(' ');
        const escapedMessage = message.replace(/"/g, '\\"');

        const svnProcess = spawn('svn', ['commit', '-m', escapedMessage, ...files], {
            cwd: dir,
            stdio: 'inherit'
        });

        svnProcess.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(new Error(`SVN commit failed with code ${code}`));
            }
        });

        svnProcess.on('error', (error) => {
            reject(new Error(`Failed to execute svn commit: ${error.message}`));
        });
    });
}

/**
 * 更新工作副本
 * @param {string} dir - 工作目录
 * @returns {Promise<boolean>} 是否成功
 */
function updateWorkingCopy(dir = '.') {
    return new Promise((resolve, reject) => {
        const svnProcess = spawn('svn', ['update'], {
            cwd: dir,
            stdio: 'inherit'
        });

        svnProcess.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                reject(new Error(`SVN update failed with code ${code}`));
            }
        });

        svnProcess.on('error', (error) => {
            reject(new Error(`Failed to execute svn update: ${error.message}`));
        });
    });
}

/**
 * 格式化显示状态
 * @param {Object} status - 状态对象
 * @returns {string} 格式化的状态文本
 */
function formatStatus(status) {
    const chalk = require('chalk');
    let output = '';

    if (status.conflicted.length > 0) {
        output += chalk.red.bold(`\n${t('conflicted')} (${status.conflicted.length}):\n`);
        status.conflicted.forEach(file => {
            output += chalk.red(`  ⚠️  ${file}\n`);
        });
    }

    if (status.modified.length > 0) {
        output += chalk.yellow.bold(`\n${t('modified')} (${status.modified.length}):\n`);
        status.modified.forEach(file => {
            output += chalk.yellow(`  M  ${file}\n`);
        });
    }

    if (status.added.length > 0) {
        output += chalk.green.bold(`\n${t('added')} (${status.added.length}):\n`);
        status.added.forEach(file => {
            output += chalk.green(`  A  ${file}\n`);
        });
    }

    if (status.deleted.length > 0) {
        output += chalk.red.bold(`\n${t('deleted')} (${status.deleted.length}):\n`);
        status.deleted.forEach(file => {
            output += chalk.red(`  D  ${file}\n`);
        });
    }

    if (status.missing.length > 0) {
        output += chalk.magenta.bold(`\n${t('missing')} (${status.missing.length}):\n`);
        status.missing.forEach(file => {
            output += chalk.magenta(`  !  ${file}\n`);
        });
    }

    if (status.unversioned.length > 0) {
        output += chalk.gray.bold(`\n${t('unversioned')} (${status.unversioned.length}):\n`);
        status.unversioned.forEach(file => {
            output += chalk.gray(`  ?  ${file}\n`);
        });
    }

    if (output === '') {
        output = chalk.green(`\n${t('noChanges')}\n`);
    }

    return output;
}

/**
 * 检查是否有冲突文件
 * @param {Object} status - 状态对象
 * @returns {boolean} 是否有冲突
 */
function hasConflicts(status) {
    return status.conflicted.length > 0;
}

/**
 * 获取可提交的文件列表
 * @param {Object} status - 状态对象
 * @returns {Array<string>} 可提交的文件列表
 */
function getCommittableFiles(status) {
    return [
        ...status.modified,
        ...status.added,
        ...status.deleted
    ];
}

/**
 * 获取可撤销的文件列表
 * @param {Object} status - 状态对象
 * @returns {Array<string>} 可撤销的文件列表
 */
function getRevertableFiles(status) {
    return [
        ...status.modified,
        ...status.added,
        ...status.deleted
    ];
}

module.exports = {
    isSvnWorkingCopy,
    isSvnInstalled,
    getStatus,
    getDiff,
    addFiles,
    revertFiles,
    commitFiles,
    updateWorkingCopy,
    formatStatus,
    hasConflicts,
    getCommittableFiles,
    getRevertableFiles
};
