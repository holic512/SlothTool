#!/usr/bin/env node

const commands = require('../lib/commands');

const args = process.argv.slice(2);
const command = args[0];

// 如果没有参数，显示帮助信息
if (!command) {
  console.log('🐌 SlothTool - A plugin manager for CLI tools\n');
  console.log('Usage:');
  console.log('  slothtool install <plugin>       Install a plugin');
  console.log('  slothtool uninstall <plugin>     Uninstall a plugin');
  console.log('  slothtool list                   List installed plugins');
  console.log('  slothtool run <plugin> [args]    Run a plugin');
  console.log('  slothtool <plugin> [args]        Run a plugin (shorthand)\n');
  console.log('Examples:');
  console.log('  slothtool install @holic512/plugin-loc');
  console.log('  slothtool loc ./src');
  console.log('  slothtool list');
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
} else if (command === '--help' || command === '-h') {
  console.log('🐌 SlothTool - A plugin manager for CLI tools\n');
  console.log('Usage:');
  console.log('  slothtool install <plugin>       Install a plugin');
  console.log('  slothtool uninstall <plugin>     Uninstall a plugin');
  console.log('  slothtool list                   List installed plugins');
  console.log('  slothtool run <plugin> [args]    Run a plugin');
  console.log('  slothtool <plugin> [args]        Run a plugin (shorthand)\n');
  console.log('Examples:');
  console.log('  slothtool install @holic512/plugin-loc');
  console.log('  slothtool loc ./src');
  console.log('  slothtool list');
  process.exit(0);
} else {
  // 简写形式：slothtool <plugin> [...args]
  // 直接将所有参数传递给 run 命令
  commands.run(args);
}
