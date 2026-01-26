#!/usr/bin/env node

const counter = require('../lib/counter');
const path = require('path');

const args = process.argv.slice(2);

// 显示帮助信息
if (args.includes('--help') || args.includes('-h')) {
  console.log('loc - Count lines of code in a directory\n');
  console.log('Usage:');
  console.log('  loc [directory]\n');
  console.log('Options:');
  console.log('  -h, --help     Show this help message');
  console.log('  -v, --verbose  Show detailed file information\n');
  console.log('Examples:');
  console.log('  loc            Count lines in current directory');
  console.log('  loc ./src      Count lines in ./src directory');
  console.log('  loc -v ./src   Show detailed file information');
  process.exit(0);
}

// 检查是否启用详细模式
const verbose = args.includes('--verbose') || args.includes('-v');
const filteredArgs = args.filter(arg => arg !== '--verbose' && arg !== '-v');

// 获取目标目录
const targetDir = filteredArgs[0] || '.';
const resolvedDir = path.resolve(targetDir);

console.log(`Counting lines of code in: ${resolvedDir}\n`);

const result = counter.countLines(resolvedDir);

if (verbose && result.files.length > 0) {
  console.log('Files:\n');
  result.files.forEach(file => {
    console.log(`  ${file.path}: ${file.lines} lines`);
  });
  console.log('');
}

console.log(`Total files: ${result.fileCount}`);
console.log(`Total lines: ${result.lineCount}`);
