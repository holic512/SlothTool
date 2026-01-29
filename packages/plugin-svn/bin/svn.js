#!/usr/bin/env node

const prompts = require('prompts');
const chalk = require('chalk');
const {t} = require('../lib/i18n');
const svnManager = require('../lib/svn-manager');
const interactive = require('../lib/interactive');

const args = process.argv.slice(2);

// 主函数
async function main() {
    // 检查 SVN 是否安装
    if (!svnManager.isSvnInstalled()) {
        console.error(chalk.red(t('svnNotInstalled')));
        process.exit(1);
    }

    // 检查是否为 SVN 工作副本
    if (!svnManager.isSvnWorkingCopy()) {
        console.error(chalk.red(t('notSvnRepo')));
        process.exit(1);
    }

    // 如果没有参数或使用 -i/--interactive，启动交互式模式
    if (args.length === 0 || args.includes('-i') || args.includes('--interactive')) {
        await interactiveMode();
        return;
    }

    // 显示帮助信息
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }

    // 默认启动交互式模式
    await interactiveMode();
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(chalk.bold.cyan(t('title')) + '\n');
    console.log(t('usage'));
    console.log('  svn [options]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -i, --interactive ' + t('interactive') + '\n');
    console.log(t('examples'));
    console.log('  svn               ' + t('exampleInteractive'));
    console.log('  svn -i            ' + t('exampleInteractive'));
    console.log('  svn --help        ' + t('exampleHelp'));
}

/**
 * 交互式模式主循环
 */
async function interactiveMode() {
    console.log(chalk.bold.cyan(`\n${t('title')}\n`));

    // 首次显示状态
    let currentStatus = await interactive.showStatus();

    while (true) {
        // 构建菜单选项
        const menuChoices = [
            {title: t('menuStatus'), value: 'status', description: ''},
            {title: t('menuCommit'), value: 'commit', description: ''},
            {title: t('menuDiff'), value: 'diff', description: ''},
            {title: t('menuAdd'), value: 'add', description: ''},
            {title: t('menuRevert'), value: 'revert', description: ''},
            {title: t('menuUpdate'), value: 'update', description: ''},
            {title: t('menuRefresh'), value: 'refresh', description: ''},
            {title: chalk.gray(t('menuExit')), value: 'exit', description: ''}
        ];

        // 根据当前状态禁用某些选项
        if (currentStatus) {
            const committableFiles = svnManager.getCommittableFiles(currentStatus);
            const hasConflicts = svnManager.hasConflicts(currentStatus);

            // 如果没有可提交的文件，标记提交选项
            if (committableFiles.length === 0) {
                menuChoices[1].title = chalk.gray(t('menuCommit') + ' (无可提交文件)');
                menuChoices[1].disabled = true;
            } else if (hasConflicts) {
                menuChoices[1].title = chalk.red(t('menuCommit') + ' (存在冲突)');
                menuChoices[1].disabled = true;
            }

            // 如果没有可查看差异的文件
            const diffableFiles = [...currentStatus.modified, ...currentStatus.deleted];
            if (diffableFiles.length === 0) {
                menuChoices[2].title = chalk.gray(t('menuDiff') + ' (无差异)');
                menuChoices[2].disabled = true;
            }

            // 如果没有未跟踪的文件
            if (currentStatus.unversioned.length === 0) {
                menuChoices[3].title = chalk.gray(t('menuAdd') + ' (无未跟踪文件)');
                menuChoices[3].disabled = true;
            }

            // 如果没有可撤销的文件
            const revertableFiles = svnManager.getRevertableFiles(currentStatus);
            if (revertableFiles.length === 0) {
                menuChoices[4].title = chalk.gray(t('menuRevert') + ' (无可撤销文件)');
                menuChoices[4].disabled = true;
            }
        }

        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: menuChoices,
            initial: 0
        });

        if (!response.action || response.action === 'exit') {
            console.log(chalk.cyan('\n👋 Goodbye!\n'));
            break;
        }

        console.log(''); // 空行

        switch (response.action) {
            case 'status':
                currentStatus = await interactive.showStatus();
                break;

            case 'commit':
                await interactive.interactiveCommit();
                // 提交后刷新状态
                currentStatus = await interactive.showStatus();
                break;

            case 'diff':
                await interactive.interactiveDiff();
                break;

            case 'add':
                await interactive.interactiveAdd();
                // 添加后刷新状态
                currentStatus = await interactive.showStatus();
                break;

            case 'revert':
                await interactive.interactiveRevert();
                // 撤销后刷新状态
                currentStatus = await interactive.showStatus();
                break;

            case 'update':
                await interactive.interactiveUpdate();
                // 更新后刷新状态
                currentStatus = await interactive.showStatus();
                break;

            case 'refresh':
                currentStatus = await interactive.showStatus();
                break;
        }

        console.log(''); // 空行分隔
    }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
    console.log(chalk.cyan('\n\n👋 Goodbye!\n'));
    process.exit(0);
});

// 运行主函数
main().catch(error => {
    console.error(chalk.red('\n' + t('error') + ': ' + error.message));
    process.exit(1);
});
