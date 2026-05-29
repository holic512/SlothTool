#!/usr/bin/env node

/**
 * @file SlothToolCliEntry
 * @project SlothTool
 * @module Core CLI / Entry
 * @description SlothTool 命令行入口，负责分发同步与异步命令并输出最新帮助信息。
 * @logic 1. 解析命令行参数；2. 分发到命令模块；3. 统一处理异步命令错误与退出码。
 * @dependencies Commands: ../lib/commands, I18N: ../lib/i18n
 * @index_tags CLI入口, 命令分发, 异步命令, 帮助信息
 * @author holic512
 */

const commands = require('../lib/commands');
const {t} = require('../lib/i18n');

function printHelp() {
    console.log(t('pluginManager') + '\n');
    console.log(t('usage'));
    console.log('  slothtool install <alias>        ' + t('commands.install'));
    console.log('  slothtool uninstall <alias>      ' + t('commands.uninstall'));
    console.log('  slothtool update <alias>         ' + t('commands.update'));
    console.log('  slothtool --update-all           ' + t('commands.updateAll'));
    console.log('  slothtool list                   ' + t('commands.list'));
    console.log('  slothtool run <plugin> [args]    ' + t('commands.run'));
    console.log('  slothtool <plugin> [args]        ' + t('commands.runShorthand'));
    console.log('  slothtool config language <lang> ' + t('commands.config'));
    console.log('  slothtool -i, --interactive      ' + t('commands.interactive'));
    console.log('  slothtool --uninstall-all        ' + t('commands.uninstallAll'));
    console.log('  slothtool self-update            ' + t('commands.selfUpdate') + '\n');
    console.log(t('examples'));
    console.log('  slothtool install loc');
    console.log('  slothtool loc ./src');
    console.log('  slothtool update loc');
    console.log('  slothtool --update-all');
    console.log('  slothtool list');
    console.log('  slothtool config language en');
    console.log('  slothtool -i');
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        printHelp();
        process.exit(0);
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
        commands.run(args.slice(1));
        return;
    }

    if (command === 'config') {
        commands.config(args.slice(1));
        return;
    }

    if (command === '-i' || command === '--interactive') {
        await commands.interactive();
        return;
    }

    if (command === '--uninstall-all') {
        commands.uninstallAll();
        return;
    }

    if (command === 'self-update') {
        commands.selfUpdate();
        return;
    }

    if (command === '--help' || command === '-h') {
        printHelp();
        process.exit(0);
    }

    commands.run(args);
}

main().catch(error => {
    if (!error.handled) {
        console.error(error.message);
    }

    process.exit(1);
});
