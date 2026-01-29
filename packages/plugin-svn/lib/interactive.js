const prompts = require('prompts');
const chalk = require('chalk');
const {t} = require('./i18n');
const svnManager = require('./svn-manager');
const diffViewer = require('./diff-viewer');

/**
 * 显示工作区状态
 * @param {string} dir - 工作目录
 */
async function showStatus(dir = '.') {
    console.log(chalk.bold(t('statusTitle')));

    try {
        const status = svnManager.getStatus(dir);
        const formatted = svnManager.formatStatus(status);
        console.log(formatted);

        // 如果有冲突，显示警告
        if (svnManager.hasConflicts(status)) {
            console.log(chalk.red.bold(t('conflictWarning')));
        }

        return status;
    } catch (error) {
        console.error(chalk.red(t('error') + ': ' + error.message));
        return null;
    }
}

/**
 * 交互式提交
 * @param {string} dir - 工作目录
 */
async function interactiveCommit(dir = '.') {
    console.log(chalk.bold(t('commitTitle')));

    try {
        const status = svnManager.getStatus(dir);

        // 检查冲突
        if (svnManager.hasConflicts(status)) {
            console.log(chalk.red.bold(t('cannotCommitWithConflicts')));
            console.log(chalk.red(t('conflictFiles')));
            status.conflicted.forEach(file => {
                console.log(chalk.red(`  ⚠️  ${file}`));
            });
            return;
        }

        const committableFiles = svnManager.getCommittableFiles(status);

        if (committableFiles.length === 0) {
            console.log(chalk.yellow(t('noFilesToCommit')));
            return;
        }

        // 选择要提交的文件
        const fileChoices = committableFiles.map(file => {
            let prefix = '  ';
            if (status.modified.includes(file)) prefix = chalk.yellow('M ');
            if (status.added.includes(file)) prefix = chalk.green('A ');
            if (status.deleted.includes(file)) prefix = chalk.red('D ');

            return {
                title: prefix + file,
                value: file,
                selected: true
            };
        });

        const fileResponse = await prompts({
            type: 'multiselect',
            name: 'files',
            message: t('selectFilesToCommit'),
            choices: fileChoices,
            hint: t('selectInstructions'),
            instructions: false
        });

        if (!fileResponse.files || fileResponse.files.length === 0) {
            console.log(chalk.yellow(t('commitCancelled')));
            return;
        }

        // 显示选中的文件
        console.log(chalk.bold(`\n${t('filesSelected', {count: fileResponse.files.length})}:`));
        fileResponse.files.forEach(file => {
            console.log(chalk.cyan(`  ${file}`));
        });

        // 输入提交说明
        const messageResponse = await prompts({
            type: 'text',
            name: 'message',
            message: t('enterCommitMessage'),
            validate: value => value.trim().length > 0 || t('commitMessageRequired')
        });

        if (!messageResponse.message) {
            console.log(chalk.yellow(t('commitCancelled')));
            return;
        }

        // 最终确认
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: t('confirmCommit'),
            initial: true
        });

        if (!confirmResponse.confirmed) {
            console.log(chalk.yellow(t('commitCancelled')));
            return;
        }

        // 执行提交
        console.log(chalk.cyan('\n' + t('loading')));
        await svnManager.commitFiles(fileResponse.files, messageResponse.message, dir);
        console.log(chalk.green.bold(t('commitSuccess')));

    } catch (error) {
        console.error(chalk.red(t('commitFailed') + ': ' + error.message));
    }
}

/**
 * 交互式查看差异
 * @param {string} dir - 工作目录
 */
async function interactiveDiff(dir = '.') {
    console.log(chalk.bold(t('diffTitle')));

    try {
        const status = svnManager.getStatus(dir);
        const diffableFiles = [...status.modified, ...status.deleted];

        if (diffableFiles.length === 0) {
            console.log(chalk.yellow(t('noDiffFiles')));
            return;
        }

        // 选择要查看差异的文件
        const fileChoices = diffableFiles.map(file => ({
            title: file,
            value: file
        }));

        // 添加"查看所有文件"选项
        fileChoices.unshift({
            title: chalk.bold('--- ' + (t('getLanguage') === 'zh' ? '查看所有文件差异' : 'View all files') + ' ---'),
            value: '__ALL__'
        });

        const fileResponse = await prompts({
            type: 'select',
            name: 'file',
            message: t('selectFileForDiff'),
            choices: fileChoices
        });

        if (!fileResponse.file) {
            return;
        }

        if (fileResponse.file === '__ALL__') {
            // 显示所有文件的差异
            for (const file of diffableFiles) {
                const diff = svnManager.getDiff(file, dir);
                diffViewer.displayDiff(diff, file);
            }
        } else {
            // 显示单个文件的差异
            const diff = svnManager.getDiff(fileResponse.file, dir);
            diffViewer.displayDiff(diff, fileResponse.file);
        }

    } catch (error) {
        console.error(chalk.red(t('error') + ': ' + error.message));
    }
}

/**
 * 交互式添加文件
 * @param {string} dir - 工作目录
 */
async function interactiveAdd(dir = '.') {
    console.log(chalk.bold(t('addTitle')));

    try {
        const status = svnManager.getStatus(dir);

        if (status.unversioned.length === 0) {
            console.log(chalk.yellow(t('noUnversionedFiles')));
            return;
        }

        // 选择要添加的文件
        const fileChoices = status.unversioned.map(file => ({
            title: chalk.gray('? ') + file,
            value: file,
            selected: false
        }));

        const fileResponse = await prompts({
            type: 'multiselect',
            name: 'files',
            message: t('selectFilesToAdd'),
            choices: fileChoices,
            hint: t('selectInstructions'),
            instructions: false
        });

        if (!fileResponse.files || fileResponse.files.length === 0) {
            console.log(chalk.yellow(t('addCancelled')));
            return;
        }

        // 显示选中的文件
        console.log(chalk.bold(`\n${t('filesSelected', {count: fileResponse.files.length})}:`));
        fileResponse.files.forEach(file => {
            console.log(chalk.cyan(`  ${file}`));
        });

        // 确认
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: t('confirmAdd'),
            initial: true
        });

        if (!confirmResponse.confirmed) {
            console.log(chalk.yellow(t('addCancelled')));
            return;
        }

        // 执行添加
        svnManager.addFiles(fileResponse.files, dir);
        console.log(chalk.green.bold(t('addSuccess')));

    } catch (error) {
        console.error(chalk.red(t('addFailed') + ': ' + error.message));
    }
}

/**
 * 交互式撤销修改
 * @param {string} dir - 工作目录
 */
async function interactiveRevert(dir = '.') {
    console.log(chalk.bold(t('revertTitle')));

    try {
        const status = svnManager.getStatus(dir);
        const revertableFiles = svnManager.getRevertableFiles(status);

        if (revertableFiles.length === 0) {
            console.log(chalk.yellow(t('noRevertFiles')));
            return;
        }

        // 选择要撤销的文件
        const fileChoices = revertableFiles.map(file => {
            let prefix = '  ';
            if (status.modified.includes(file)) prefix = chalk.yellow('M ');
            if (status.added.includes(file)) prefix = chalk.green('A ');
            if (status.deleted.includes(file)) prefix = chalk.red('D ');

            return {
                title: prefix + file,
                value: file,
                selected: false
            };
        });

        const fileResponse = await prompts({
            type: 'multiselect',
            name: 'files',
            message: t('selectFilesToRevert'),
            choices: fileChoices,
            hint: t('selectInstructions'),
            instructions: false
        });

        if (!fileResponse.files || fileResponse.files.length === 0) {
            console.log(chalk.yellow(t('revertCancelled')));
            return;
        }

        // 显示选中的文件
        console.log(chalk.bold(`\n${t('filesSelected', {count: fileResponse.files.length})}:`));
        fileResponse.files.forEach(file => {
            console.log(chalk.cyan(`  ${file}`));
        });

        // 警告确认
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: chalk.red(t('confirmRevert')),
            initial: false
        });

        if (!confirmResponse.confirmed) {
            console.log(chalk.yellow(t('revertCancelled')));
            return;
        }

        // 执行撤销
        svnManager.revertFiles(fileResponse.files, dir);
        console.log(chalk.green.bold(t('revertSuccess')));

    } catch (error) {
        console.error(chalk.red(t('revertFailed') + ': ' + error.message));
    }
}

/**
 * 交互式更新工作副本
 * @param {string} dir - 工作目录
 */
async function interactiveUpdate(dir = '.') {
    console.log(chalk.bold(t('updateTitle')));

    try {
        // 确认更新
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: t('confirmUpdate'),
            initial: true
        });

        if (!confirmResponse.confirmed) {
            console.log(chalk.yellow(t('updateCancelled')));
            return;
        }

        // 执行更新
        console.log(chalk.cyan('\n' + t('loading')));
        await svnManager.updateWorkingCopy(dir);
        console.log(chalk.green.bold(t('updateSuccess')));

    } catch (error) {
        console.error(chalk.red(t('updateFailed') + ': ' + error.message));
    }
}

module.exports = {
    showStatus,
    interactiveCommit,
    interactiveDiff,
    interactiveAdd,
    interactiveRevert,
    interactiveUpdate
};
