/**
 * @file InteractiveCommand
 * @project SlothTool
 * @module Core CLI / Interactive Mode
 * @description 提供官方插件安装、更新、运行和配置语言等菜单式交互入口。
 * @logic 1. 基于注册表和官方插件元数据渲染菜单；2. 调用异步安装更新流程；3. 在交互模式中兼容新旧插件来源展示。
 * @dependencies Library: prompts, Service: plugin-manager/registry/settings, Data: official-plugins.json
 * @index_tags 交互模式, 官方插件安装, 菜单更新, 注册表展示
 * @author holic512
 */

const prompts = require('prompts');
const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');
const registry = require('../registry');
const settings = require('../settings');
const {installPlugin, uninstallPlugin, updatePlugin, updateAllPlugins, updateSelf} = require('../plugin-manager');
const uninstallAll = require('./uninstall-all');
const {t} = require('../i18n');

const officialPlugins = require('../official-plugins.json').officialPlugins;

function getPluginDisplayName(pluginInfo) {
    return pluginInfo.packageName || pluginInfo.name;
}

function getPluginSourceLabel(pluginInfo) {
    return pluginInfo.sourceType === 'github-release'
        ? t('sources.githubRelease')
        : t('sources.npmRegistry');
}

/**
 * 交互式模式主函数
 */
async function interactive() {
    console.log('\n' + t('pluginManager') + '\n');

    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('interactive.mainMenu'),
            choices: [
                {title: t('interactive.installPlugin'), value: 'install'},
                {title: t('interactive.uninstallPlugin'), value: 'uninstall'},
                {title: t('interactive.updateMenu'), value: 'updateMenu'},
                {title: t('interactive.listPlugins'), value: 'list'},
                {title: t('interactive.runPlugin'), value: 'run'},
                {title: t('interactive.configLanguage'), value: 'config'},
                {title: t('interactive.uninstallAll'), value: 'uninstallAll'},
                {title: t('interactive.exit'), value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        console.log('');

        try {
            switch (response.action) {
                case 'install':
                    await handleInstall();
                    break;
                case 'uninstall':
                    await handleUninstall();
                    break;
                case 'updateMenu':
                    await handleUpdateMenu();
                    break;
                case 'list':
                    await handleList();
                    break;
                case 'run':
                    await handleRun();
                    break;
                case 'config':
                    await handleConfig();
                    break;
                case 'uninstallAll':
                    await uninstallAll();
                    break;
            }
        } catch (error) {
            if (error.message !== 'cancelled' && !error.handled) {
                console.error(error.message);
            }
        }

        await waitForEnter();
    }
}

/**
 * 处理安装插件
 */
async function handleInstall() {
    await installOfficialPlugin();
}

/**
 * 安装官方插件
 */
async function installOfficialPlugin() {
    const lang = settings.getLanguage();

    const choices = officialPlugins.map(plugin => {
        const description = lang === 'zh' ? plugin.description : plugin.descriptionEn;
        const features = lang === 'zh' ? plugin.features : plugin.featuresEn;

        return {
            title: `${plugin.alias} - ${description}`,
            description: features.join(', '),
            value: plugin
        };
    });

    const response = await prompts({
        type: 'select',
        name: 'plugin',
        message: t('interactive.selectOfficialPlugin'),
        choices: choices
    });

    if (!response.plugin) {
        throw new Error('cancelled');
    }

    const plugin = response.plugin;

    console.log('\n' + t('interactive.pluginInfo') + ':');
    console.log(`  ${plugin.alias}`);
    console.log(`  Package: ${plugin.packageName}`);
    console.log(`  ${t('interactive.author')} ${plugin.author}`);
    console.log(`  ${t('interactive.version')} ${plugin.version}`);
    console.log(`  ${t('interactive.features')}`);
    const features = lang === 'zh' ? plugin.features : plugin.featuresEn;
    features.forEach(f => console.log(`    - ${f}`));

    // 确认安装
    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmInstall', {name: plugin.alias}),
        initial: true
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    await installPlugin(plugin.alias);
}

/**
 * 处理卸载插件
 */
async function handleUninstall() {
    const plugins = registry.getAllPlugins();
    const pluginList = Object.keys(plugins);

    if (pluginList.length === 0) {
        console.log(t('interactive.noPluginsToUninstall'));
        return;
    }

    const choices = pluginList.map(alias => ({
        title: `${alias} (${getPluginDisplayName(plugins[alias])})`,
        value: alias
    }));

    const response = await prompts({
        type: 'select',
        name: 'alias',
        message: t('interactive.selectPlugin'),
        choices: choices
    });

    if (!response.alias) {
        throw new Error('cancelled');
    }

    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmUninstall', {alias: response.alias}),
        initial: false
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    uninstallPlugin(response.alias);
}

/**
 * 处理更新菜单
 */
async function handleUpdateMenu() {
    const response = await prompts({
        type: 'select',
        name: 'action',
        message: t('interactive.updateMenu'),
        choices: [
            {title: t('interactive.updateSelf'), value: 'self'},
            {title: t('interactive.updatePlugin'), value: 'single'},
            {title: t('interactive.updateAllPlugins'), value: 'all'}
        ]
    });

    if (!response.action) {
        throw new Error('cancelled');
    }

    console.log('');

    if (response.action === 'self') {
        await handleUpdateSelf();
        return;
    }

    if (response.action === 'single') {
        await handleUpdate();
        return;
    }

    await handleUpdateAll();
}

/**
 * 处理更新插件
 */
async function handleUpdate() {
    const plugins = registry.getAllPlugins();
    const pluginList = Object.keys(plugins);

    if (pluginList.length === 0) {
        console.log(t('interactive.noPluginsToUpdate'));
        return;
    }

    const choices = pluginList.map(alias => ({
        title: `${alias} (${getPluginDisplayName(plugins[alias])} v${plugins[alias].version})`,
        value: alias
    }));

    const response = await prompts({
        type: 'select',
        name: 'alias',
        message: t('interactive.selectPluginToUpdate'),
        choices: choices
    });

    if (!response.alias) {
        throw new Error('cancelled');
    }

    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmUpdate', {alias: response.alias}),
        initial: true
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    await updatePlugin(response.alias);
}

/**
 * 处理更新所有插件
 */
async function handleUpdateAll() {
    const plugins = registry.getAllPlugins();
    const pluginList = Object.keys(plugins);

    if (pluginList.length === 0) {
        console.log(t('interactive.noPluginsToUpdate'));
        return;
    }

    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmUpdateAll', {count: pluginList.length}),
        initial: true
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    await updateAllPlugins();
}

/**
 * 处理更新 SlothTool
 */
async function handleUpdateSelf() {
    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmUpdateSelf'),
        initial: true
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    updateSelf();
}

/**
 * 处理列出插件
 */
async function handleList() {
    const plugins = registry.getAllPlugins();

    if (Object.keys(plugins).length === 0) {
        console.log(t('noPlugins'));
        console.log(t('installExample'));
        console.log('  slothtool install <plugin-alias>');
        return;
    }

    console.log(t('installedPlugins') + '\n');
    for (const [alias, info] of Object.entries(plugins)) {
        console.log(`  ${alias}`);
        console.log(`    Package: ${getPluginDisplayName(info)}`);
        console.log(`    Version: ${info.version}`);
        console.log(`    Source: ${getPluginSourceLabel(info)}`);
        console.log(`    Installed: ${new Date(info.installedAt).toLocaleString()}`);
        console.log('');
    }
}

/**
 * 处理运行插件
 */
async function handleRun() {
    const plugins = registry.getAllPlugins();
    const pluginList = Object.keys(plugins);

    if (pluginList.length === 0) {
        console.log(t('interactive.noPluginsToRun'));
        return;
    }

    const choices = pluginList.map(alias => ({
        title: `${alias} (${getPluginDisplayName(plugins[alias])})`,
        value: alias
    }));

    const response = await prompts({
        type: 'select',
        name: 'alias',
        message: t('interactive.selectPlugin'),
        choices: choices
    });

    if (!response.alias) {
        throw new Error('cancelled');
    }

    const plugin = plugins[response.alias];

    // 检查插件是否支持交互式模式
    const pluginPackageJsonPath = path.join(
        path.dirname(plugin.binPath),
        '..',
        'package.json'
    );

    let hasInteractiveMode = false;
    let interactiveFlag = '-i';

    if (fs.existsSync(pluginPackageJsonPath)) {
        try {
            const pluginPackage = JSON.parse(fs.readFileSync(pluginPackageJsonPath, 'utf8'));
            if (pluginPackage.slothtool && pluginPackage.slothtool.interactive) {
                hasInteractiveMode = true;
                interactiveFlag = pluginPackage.slothtool.interactiveFlag || '-i';
            }
        } catch (error) {
            // 忽略解析错误
        }
    }

    console.log('');

    // 如果插件支持交互式模式，直接启动交互式模式
    if (hasInteractiveMode) {
        console.log(`Running: ${response.alias} (interactive mode)...`);
        console.log('─'.repeat(50));

        const child = spawn('node', [plugin.binPath, interactiveFlag], {
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            child.on('error', (error) => {
                console.error(t('failedToRun', {pluginAlias: response.alias}), error.message);
                reject(error);
            });

            child.on('exit', (code) => {
                resolve(code);
            });
        });
    } else {
        // 如果插件不支持交互式模式，先显示帮助，然后让用户输入参数
        console.log(`Running: ${response.alias}...`);
        console.log('─'.repeat(50));
        console.log('');

        // 先显示帮助信息
        const helpChild = spawn('node', [plugin.binPath, '--help'], {
            stdio: 'inherit'
        });

        await new Promise((resolve) => {
            helpChild.on('exit', () => resolve());
        });

        console.log('');
        console.log('─'.repeat(50));

        // 询问用户是否要运行插件
        const runResponse = await prompts({
            type: 'confirm',
            name: 'value',
            message: t('interactive.runWithArgs'),
            initial: true
        });

        if (!runResponse.value) {
            return;
        }

        // 让用户输入参数
        const argsResponse = await prompts({
            type: 'text',
            name: 'args',
            message: t('interactive.enterArgs'),
            initial: ''
        });

        if (argsResponse.args === undefined) {
            return;
        }

        console.log('');
        console.log('─'.repeat(50));

        // 解析参数并运行
        const args = argsResponse.args.trim().split(/\s+/).filter(arg => arg.length > 0);
        const child = spawn('node', [plugin.binPath, ...args], {
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            child.on('error', (error) => {
                console.error(t('failedToRun', {pluginAlias: response.alias}), error.message);
                reject(error);
            });

            child.on('exit', (code) => {
                resolve(code);
            });
        });
    }
}

/**
 * 处理配置语言
 */
async function handleConfig() {
    const currentLang = settings.getLanguage();

    const response = await prompts({
        type: 'select',
        name: 'language',
        message: t('interactive.selectLanguage'),
        choices: [
            {title: '中文 (Chinese)', value: 'zh', selected: currentLang === 'zh'},
            {title: 'English', value: 'en', selected: currentLang === 'en'}
        ]
    });

    if (!response.language) {
        throw new Error('cancelled');
    }

    settings.setLanguage(response.language);
    console.log(t('languageSet'), response.language);
    console.log('\n' + t('interactive.pressEnterToContinue').replace('\n', ''));
}

/**
 * 等待用户按回车键
 */
async function waitForEnter() {
    await prompts({
        type: 'text',
        name: 'continue',
        message: t('interactive.pressEnterToContinue'),
        initial: ''
    });
    console.log('');
}

module.exports = interactive;
