#!/usr/bin/env node

/**
 * @file TemplatePluginEntry
 * @project SlothTool
 * @module Plugin Scaffold / Entry
 * @description 提供 SlothTool 插件模板的命令行入口，包含帮助信息和交互式模式分发。
 * @logic 1. 解析 help 与 interactive 参数；2. 默认进入交互式主流程；3. 以模板方式暴露最小可运行结构。
 * @dependencies Module: ../lib/i18n, Module: ../lib/interactive
 * @index_tags 插件模板, CLI入口, 交互模式, scaffold
 * @author holic512
 */

const {t} = require('../lib/i18n');
const {interactiveMain} = require('../lib/interactive');

const args = process.argv.slice(2);

function showHelp() {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  mytool [options]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -i, --interactive ' + t('interactive'));
}

async function main() {
    if (args.length === 0 || args.includes('-i') || args.includes('--interactive')) {
        await interactiveMain();
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    showHelp();
    process.exit(2);
}

process.on('SIGINT', () => {
    process.exit(0);
});

main().catch(error => {
    console.error(t('error') + ': ' + error.message);
    process.exit(1);
});
