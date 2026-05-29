#!/usr/bin/env node

/**
 * @file SlothToolCliEntry
 * @project SlothTool
 * @module Core CLI / Entry
 * @description SlothTool 命令行入口，默认进入全屏 TUI，并为显式 CLI 子命令提供稳定分发。
 * @logic 1. 无参数时优先进入 TUI；2. 保留显式 CLI 子命令与插件简写；3. 统一处理命令异常和退出码。
 * @dependencies Commands: ../lib/commands/index.js, I18N: ../lib/i18n.js, Utils: ../lib/utils.js
 * @index_tags CLI入口, 默认TUI, 命令分发, 插件简写
 * @author holic512
 */

import * as commands from '../lib/commands/index.js';
import {t} from '../lib/i18n.js';
import {isInteractiveTerminal} from '../lib/utils.js';

function printHelp() {
    console.log(`${t('pluginManager')}\n`);
    console.log(t('cli.defaultTui'));
    console.log('');
    console.log(t('usage'));
    console.log(`  slothtool                       ${t('commands.interactive')}`);
    console.log(`  slothtool tui                   ${t('commands.interactive')}`);
    console.log(`  slothtool install <alias>       ${t('commands.install')}`);
    console.log(`  slothtool uninstall <alias>     ${t('commands.uninstall')}`);
    console.log(`  slothtool update <alias>        ${t('commands.update')}`);
    console.log(`  slothtool --update-all          ${t('commands.updateAll')}`);
    console.log(`  slothtool list                  ${t('commands.list')}`);
    console.log(`  slothtool run <plugin> [args]   ${t('commands.run')}`);
    console.log(`  slothtool <plugin> [args]       ${t('commands.runShorthand')}`);
    console.log(`  slothtool config language <x>   ${t('commands.config')}`);
    console.log(`  slothtool --uninstall-all       ${t('commands.uninstallAll')}`);
    console.log(`  slothtool self-update           ${t('commands.selfUpdate')}`);
    console.log('');
    console.log(t('examples'));
    console.log('  slothtool');
    console.log('  slothtool install loc');
    console.log('  slothtool loc');
    console.log('  slothtool loc ./src');
    console.log('  slothtool config language en');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        if (isInteractiveTerminal() || process.env.SLOTHTOOL_TUI_TEST_ACTION) {
            await commands.interactive();
            return;
        }

        printHelp();
        return;
    }

    if (command === '--help' || command === '-h') {
        printHelp();
        return;
    }

    if (command === 'tui' || command === '-i' || command === '--interactive') {
        await commands.interactive();
        return;
    }

    if (command === 'install') {
        await commands.install(args.slice(1));
        return;
    }

    if (command === 'uninstall') {
        commands.uninstall(args.slice(1));
        return;
    }

    if (command === 'update') {
        await commands.update(args.slice(1));
        return;
    }

    if (command === '--update-all') {
        await commands.updateAll();
        return;
    }

    if (command === 'list') {
        commands.list();
        return;
    }

    if (command === 'run') {
        const result = await commands.run(args.slice(1));
        process.exitCode = result?.code || 0;
        return;
    }

    if (command === 'config') {
        commands.config(args.slice(1));
        return;
    }

    if (command === '--uninstall-all') {
        await commands.uninstallAll();
        return;
    }

    if (command === 'self-update') {
        commands.selfUpdate();
        return;
    }

    const result = await commands.run(args, {shorthand: true});
    process.exitCode = result?.code || 0;
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
