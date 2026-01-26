const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const registry = require('../registry');
const {t} = require('../i18n');

/**
 * 完全卸载 SlothTool，删除所有数据
 */
async function uninstallAll() {
    const slothtoolDir = path.join(os.homedir(), '.slothtool');

    // 检查目录是否存在
    if (!fs.existsSync(slothtoolDir)) {
        console.log(t('uninstallAll.noData', {dir: slothtoolDir}));
        console.log(t('uninstallAll.alreadyClean'));
        return;
    }

    // 显示标题和警告
    console.log(t('uninstallAll.title'));
    console.log(t('uninstallAll.warning'));

    // 获取已安装插件数量
    const plugins = registry.getAllPlugins();
    const pluginCount = Object.keys(plugins).length;

    // 显示将要删除的内容
    console.log(t('uninstallAll.willRemove'));
    console.log(t('uninstallAll.slothtoolDir', {dir: slothtoolDir}));
    console.log(t('uninstallAll.allPlugins', {count: pluginCount}));
    console.log(t('uninstallAll.allConfigs'));
    console.log(t('uninstallAll.registry'));
    console.log(t('uninstallAll.settings'));

    // 确认删除
    console.log(t('uninstallAll.confirm'));
    const confirmed = await promptConfirmation(t('uninstallAll.confirmPrompt'));

    if (!confirmed) {
        console.log(t('uninstallAll.cancelled'));
        return;
    }

    // 执行删除
    try {
        console.log(t('uninstallAll.removing'));
        fs.rmSync(slothtoolDir, {recursive: true, force: true});
        console.log(t('uninstallAll.success'));
        console.log(t('uninstallAll.nextStep'));
        console.log(t('uninstallAll.npmUninstall'));
    } catch (error) {
        console.error(t('uninstallAll.failed'), error.message);
        process.exit(1);
    }
}

/**
 * 提示用户确认
 * @param {string} prompt - 提示信息
 * @returns {Promise<boolean>} 用户是否确认
 */
function promptConfirmation(prompt) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'yes');
        });
    });
}

module.exports = uninstallAll;
