#!/usr/bin/env node

/**
 * @file TemplatePluginEntry
 * @project SlothTool
 * @module Plugin Scaffold / Entry
 * @description 模板插件入口，无参数默认进入 TUI，同时保留最小可运行 CLI 子命令。
 * @logic 1. 无参数时优先进入 TUI；2. 支持 hello/config/help 显式 CLI；3. 以模板方式演示默认 TUI 插件结构。
 * @dependencies Modules: ../lib/i18n.js, ../lib/config.js, ../lib/interactive.js
 * @index_tags 模板入口, 默认TUI, CLI子命令, scaffold
 * @author holic512
 */

import {readConfig} from '../lib/config.js';
import {interactiveMain} from '../lib/interactive.js';
import {t} from '../lib/i18n.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function showHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  mytool');
    console.log('  mytool --tui');
    console.log('  mytool hello');
    console.log('  mytool config');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help       ${t('help')}`);
    console.log(`  --tui            ${t('tuiOption')}`);
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }

    if (args.length === 0 || args.includes('--tui') || args.includes('-i') || args.includes('--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_TEMPLATE_TUI_TEST_ACTION) {
            throw new Error(t('tuiRequiresTerminal'));
        }

        await interactiveMain();
        return;
    }

    if (args[0] === 'hello') {
        console.log(t('helloOutput'));
        return;
    }

    if (args[0] === 'config') {
        console.log(t('configTitle'));
        console.log(JSON.stringify(readConfig('mytool'), null, 2));
        return;
    }

    showHelp();
    process.exitCode = 2;
}

main().catch(error => {
    console.error(`${t('error')}: ${error.message}`);
    process.exit(1);
});
