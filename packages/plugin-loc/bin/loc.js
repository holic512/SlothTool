#!/usr/bin/env node

const counter = require('../lib/counter');
const config = require('../lib/config');
const {t} = require('../lib/i18n');
const path = require('path');
const fs = require('fs');
const prompts = require('prompts');

const args = process.argv.slice(2);

// 显示帮助信息
if (args.includes('--help') || args.includes('-h')) {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  loc [directory]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -v, --verbose     ' + t('verbose'));
    console.log('  -c, --config      ' + t('config'));
    console.log('  -i, --interactive ' + t('interactive') + '\n');
    console.log(t('examples'));
    console.log('  loc               ' + t('exampleCurrent'));
    console.log('  loc ./src         ' + t('exampleSrc'));
    console.log('  loc -v ./src      ' + t('exampleVerbose'));
    console.log('  loc -c            ' + t('exampleConfig'));
    console.log('  loc -i            ' + t('exampleInteractive'));
    process.exit(0);
}

// 配置模式
if (args.includes('--config') || args.includes('-c')) {
    configureFileTypes();
    return;
}

// 交互式模式
if (args.includes('--interactive') || args.includes('-i')) {
    interactiveMode();
    return;
}

// 直接统计模式
const verbose = args.includes('--verbose') || args.includes('-v');
const filteredArgs = args.filter(arg => !arg.startsWith('-'));
const targetDir = filteredArgs[0] || '.';
countDirectory(targetDir, verbose);

/**
 * 统计目录代码行数
 */
function countDirectory(targetDir, verbose = false) {
    const resolvedDir = path.resolve(targetDir);

    if (!fs.existsSync(resolvedDir)) {
        console.error(t('invalidDirectory') + ': ' + resolvedDir);
        process.exit(1);
    }

    console.log(t('counting'), resolvedDir + '\n');

    const pluginConfig = config.readConfig();
    const result = counter.countLines(resolvedDir, pluginConfig);

    if (verbose && result.files.length > 0) {
        console.log(t('files') + '\n');
        result.files.forEach(file => {
            console.log(`  ${file.path}: ${file.lines} ${t('lines')}`);
        });
        console.log('');
    }

    console.log(t('totalFiles'), result.fileCount);
    console.log(t('totalLines'), result.lineCount);
}

/**
 * 配置文件类型
 */
async function configureFileTypes() {
    console.log(t('configTitle') + '\n');

    const pluginConfig = config.readConfig();
    const extensions = Object.keys(pluginConfig.fileExtensions);

    const choices = extensions.map(ext => ({
        title: ext,
        value: ext,
        selected: pluginConfig.fileExtensions[ext]
    }));

    const response = await prompts({
        type: 'multiselect',
        name: 'extensions',
        message: t('selectExtensions'),
        choices: choices,
        hint: t('configInstructions')
    });

    if (response.extensions === undefined) {
        // 用户取消了操作
        return;
    }

    // 更新配置
    const newConfig = config.getDefaultConfig();
    Object.keys(newConfig.fileExtensions).forEach(ext => {
        newConfig.fileExtensions[ext] = response.extensions.includes(ext);
    });

    config.writeConfig(newConfig);
    console.log('\n' + t('configSaved'));
}

/**
 * 交互式模式
 */
async function interactiveMode() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: [
                {title: t('menuCountCurrent'), value: 'current'},
                {title: t('menuCountCustom'), value: 'custom'},
                {title: t('menuConfig'), value: 'config'},
                {title: t('menuExit'), value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        if (response.action === 'current') {
            console.log('');
            countDirectory('.', false);
            console.log('');
        } else if (response.action === 'custom') {
            const dirResponse = await prompts({
                type: 'text',
                name: 'directory',
                message: t('enterDirectory'),
                initial: '.'
            });

            if (dirResponse.directory) {
                console.log('');
                countDirectory(dirResponse.directory, false);
                console.log('');
            }
        } else if (response.action === 'config') {
            console.log('');
            await configureFileTypes();
            console.log('');
        }
    }
}
