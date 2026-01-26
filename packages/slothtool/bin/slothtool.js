#!/usr/bin/env node

const commands = require('../lib/commands');
const {t} = require('../lib/i18n');

const args = process.argv.slice(2);
const command = args[0];

// 如果没有参数，显示帮助信息
if (!command) {
    console.log(t('pluginManager') + '\n');
    console.log(t('usage'));
    console.log('  slothtool install <plugin>       ' + t('commands.install'));
    console.log('  slothtool uninstall <plugin>     ' + t('commands.uninstall'));
    console.log('  slothtool list                   ' + t('commands.list'));
    console.log('  slothtool run <plugin> [args]    ' + t('commands.run'));
    console.log('  slothtool <plugin> [args]        ' + t('commands.runShorthand'));
    console.log('  slothtool config language <lang> ' + t('commands.config'));
    console.log('  slothtool -i, --interactive      ' + t('commands.interactive'));
    console.log('  slothtool --uninstall-all        ' + t('commands.uninstallAll') + '\n');
    console.log(t('examples'));
    console.log('  slothtool install @holic512/plugin-loc');
    console.log('  slothtool loc ./src');
    console.log('  slothtool list');
    console.log('  slothtool config language en');
    console.log('  slothtool -i');
    process.exit(0);
}

// 内置命令
if (command === 'install') {
    commands.install(args.slice(1));
} else if (command === 'uninstall') {
    commands.uninstall(args.slice(1));
} else if (command === 'list') {
    commands.list();
} else if (command === 'run') {
    commands.run(args.slice(1));
} else if (command === 'config') {
    commands.config(args.slice(1));
} else if (command === '-i' || command === '--interactive') {
    commands.interactive();
} else if (command === '--uninstall-all') {
    commands.uninstallAll();
} else if (command === '--help' || command === '-h') {
    console.log(t('pluginManager') + '\n');
    console.log(t('usage'));
    console.log('  slothtool install <plugin>       ' + t('commands.install'));
    console.log('  slothtool uninstall <plugin>     ' + t('commands.uninstall'));
    console.log('  slothtool list                   ' + t('commands.list'));
    console.log('  slothtool run <plugin> [args]    ' + t('commands.run'));
    console.log('  slothtool <plugin> [args]        ' + t('commands.runShorthand'));
    console.log('  slothtool config language <lang> ' + t('commands.config'));
    console.log('  slothtool -i, --interactive      ' + t('commands.interactive'));
    console.log('  slothtool --uninstall-all        ' + t('commands.uninstallAll') + '\n');
    console.log(t('examples'));
    console.log('  slothtool install @holic512/plugin-loc');
    console.log('  slothtool loc ./src');
    console.log('  slothtool list');
    console.log('  slothtool config language en');
    console.log('  slothtool -i');
    process.exit(0);
} else {
    // 简写形式：slothtool <plugin> [...args]
    // 直接将所有参数传递给 run 命令
    commands.run(args);
}
