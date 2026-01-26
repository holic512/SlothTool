const prompts = require('prompts');
const {spawn} = require('child_process');
const path = require('path');
const registry = require('../registry');
const settings = require('../settings');
const {installPlugin, uninstallPlugin} = require('../plugin-manager');
const {t} = require('../i18n');

// 读取官方插件配置
const officialPlugins = require('../official-plugins.json').officialPlugins;

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
                {title: t('interactive.listPlugins'), value: 'list'},
                {title: t('interactive.runPlugin'), value: 'run'},
                {title: t('interactive.configLanguage'), value: 'config'},
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
                case 'list':
                    await handleList();
                    break;
                case 'run':
                    await handleRun();
                    break;
                case 'config':
                    await handleConfig();
                    break;
            }
        } catch (error) {
            if (error.message !== 'cancelled') {
                console.error('Error:', error.message);
            }
        }

        await waitForEnter();
    }
}

/**
 * 处理安装插件
 */
async function handleInstall() {
    const installType = await prompts({
        type: 'select',
        name: 'type',
        message: t('interactive.installPlugin'),
        choices: [
            {title: t('interactive.installOfficial'), value: 'official'},
            {title: t('interactive.installCustom'), value: 'custom'}
        ]
    });

    if (!installType.type) {
        throw new Error('cancelled');
    }

    if (installType.type === 'official') {
        await installOfficialPlugin();
    } else {
        await installCustomPlugin();
    }
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

    // 显示插件详细信息
    console.log('\n' + t('interactive.pluginInfo') + ':');
    console.log(`  ${plugin.name}`);
    console.log(`  ${t('interactive.author')} ${plugin.author}`);
    console.log(`  ${t('interactive.version')} ${plugin.version}`);
    console.log(`  ${t('interactive.features')}`);
    const features = lang === 'zh' ? plugin.features : plugin.featuresEn;
    features.forEach(f => console.log(`    - ${f}`));

    // 确认安装
    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: t('interactive.confirmInstall', {name: plugin.name}),
        initial: true
    });

    if (!confirm.value) {
        console.log(t('interactive.operationCancelled'));
        return;
    }

    console.log('');
    installPlugin(plugin.name);
}

/**
 * 安装自定义插件
 */
async function installCustomPlugin() {
    const response = await prompts({
        type: 'text',
        name: 'packageName',
        message: t('interactive.enterPackageName'),
        validate: value => value.length > 0 ? true : 'Package name is required'
    });

    if (!response.packageName) {
        throw new Error('cancelled');
    }

    console.log('');
    installPlugin(response.packageName);
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
        title: `${alias} (${plugins[alias].name})`,
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

    // 确认卸载
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
 * 处理列出插件
 */
async function handleList() {
    const plugins = registry.getAllPlugins();

    if (Object.keys(plugins).length === 0) {
        console.log(t('noPlugins'));
        console.log(t('installExample'));
        console.log('  slothtool install <plugin-name>');
        return;
    }

    console.log(t('installedPlugins') + '\n');
    for (const [alias, info] of Object.entries(plugins)) {
        console.log(`  ${alias}`);
        console.log(`    Package: ${info.name}`);
        console.log(`    Version: ${info.version}`);
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
        title: `${alias} (${plugins[alias].name})`,
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

    console.log('');
    console.log(`Running: ${response.alias}...`);
    console.log('─'.repeat(50));

    // 运行插件
    const child = spawn('node', [plugin.binPath], {
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
