#!/usr/bin/env node

/**
 * @file PzipPluginEntry
 * @project SlothTool
 * @module PZIP Plugin / Entry
 * @description pzip 命令入口：无参数默认进入 TUI，显式目录参数执行可脚本化 ZIP 压缩或配置操作。
 * @logic 1. 解析 TUI、配置与压缩选项；2. 将归档请求委托给 service 层；3. 输出人类可读或 JSON 摘要并统一处理退出码。
 * @dependencies Services: ../lib/service.js, TUI: ../lib/tui.js, I18N: ../lib/i18n.js
 * @index_tags pzip入口, 默认TUI, ZIP命令, 配置命令, JSON输出
 * @author holic512
 */

import {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    removeCustomRule,
    resetPluginConfig,
    toggleBuiltInRule
} from '../lib/service.js';
import {formatPzipError, t} from '../lib/i18n.js';
import {startPzipTui} from '../lib/tui.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function formatBytes(value) {
    if (value === null || value === undefined) {
        return '-';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let amount = Number(value);
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
        amount /= 1024;
        unitIndex += 1;
    }
    return `${amount.toLocaleString(undefined, {maximumFractionDigits: 2})} ${units[unitIndex]}`;
}

function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  pzip');
    console.log('  pzip --tui');
    console.log('  pzip <sourceDir> [--output <archivePath>] [--exclude <pattern>]... [--dry-run] [--json]');
    console.log('  pzip config [show]');
    console.log('  pzip config reset');
    console.log('  pzip config rule <ruleName> <on|off>');
    console.log('  pzip config add <pattern>');
    console.log('  pzip config remove <pattern>');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help          ${t('help')}`);
    console.log(`  --tui, -i           ${t('tuiOption')}`);
    console.log(`  --output <path>     ${t('outputOption')}`);
    console.log(`  --exclude <pattern> ${t('excludeOption')}`);
    console.log(`  --dry-run           ${t('dryRunOption')}`);
    console.log(`  --json              ${t('jsonOption')}`);
    console.log('');
    console.log(t('examples'));
    console.log('  pzip ./my-app');
    console.log('  pzip ./my-app --output ./releases/my-app');
    console.log('  pzip ./my-app --exclude "logs/" --exclude "*.log" --dry-run');
    console.log('  pzip config rule target off');
    console.log('  pzip config add "reports/"');
}

function normalizeState(value) {
    if (value === 'on') {
        return true;
    }
    if (value === 'off') {
        return false;
    }
    throw new Error(t('configUnknownState'));
}

function runConfigCommand(args) {
    const subcommand = args[0] || 'show';
    if (subcommand === 'show') {
        console.log(t('configTitle'));
        console.log(JSON.stringify(getConfigSummary(), null, 2));
        return;
    }
    if (subcommand === 'reset' && args.length === 1) {
        resetPluginConfig();
        console.log(t('configReset'));
        return;
    }
    if (subcommand === 'rule' && args.length === 3) {
        toggleBuiltInRule(args[1], normalizeState(args[2]));
        console.log(t('configSaved'));
        return;
    }
    if (subcommand === 'add' && args.length === 2) {
        addCustomRule(args[1]);
        console.log(t('configSaved'));
        return;
    }
    if (subcommand === 'remove' && args.length === 2) {
        removeCustomRule(args[1]);
        console.log(t('configSaved'));
        return;
    }

    throw new Error('Invalid config command. Run "pzip --help" for usage.');
}

function parseArchiveArguments(args) {
    const options = {excludePatterns: []};
    let sourceDirectory = '';

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--output') {
            const value = args[index + 1];
            if (!value) {
                throw new Error('Missing value for --output.');
            }
            options.outputPath = value;
            index += 1;
            continue;
        }
        if (argument === '--exclude') {
            const value = args[index + 1];
            if (!value) {
                throw new Error('Missing value for --exclude.');
            }
            options.excludePatterns.push(value);
            index += 1;
            continue;
        }
        if (argument === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (argument === '--json') {
            options.json = true;
            continue;
        }
        if (argument.startsWith('-')) {
            throw new Error(`Unknown option: ${argument}`);
        }
        if (sourceDirectory) {
            throw new Error('Only one source directory may be provided.');
        }
        sourceDirectory = argument;
    }

    if (!sourceDirectory) {
        throw new Error('A source directory is required.');
    }

    return {sourceDirectory, options};
}

function printArchiveResult(result) {
    console.log(t('compressionSummary'));
    console.log(`${t('sourceDirectory')}: ${result.sourceDirectory}`);
    console.log(`${t('archivePath')}: ${result.archivePath}`);
    console.log(`${t('dryRun')}: ${result.dryRun ? t('yes') : t('no')}`);
    console.log(`${t('filesIncluded')}: ${result.includedFileCount}`);
    console.log(`${t('directoriesIncluded')}: ${result.includedDirectoryCount}`);
    console.log(`${t('filesExcluded')}: ${result.excludedFileCount}`);
    console.log(`${t('sourceBytes')}: ${formatBytes(result.sourceBytes)}`);
    console.log(`${t('archiveBytes')}: ${formatBytes(result.archiveBytes)}`);
    console.log(`${t('exclusionSummary')}: ${JSON.stringify(result.exclusions)}`);

    if (result.warnings.length > 0) {
        console.log(`\n${t('warningsTitle')}:`);
        for (const warning of result.warnings) {
            console.log(`  ${warning}`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    if (args.length === 0) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION) {
            printHelp();
            return;
        }
        await startPzipTui();
        return;
    }

    if (args.includes('--tui') || args.includes('-i') || args.includes('--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_PZIP_TUI_TEST_ACTION) {
            throw new Error(t('tuiRequiresTerminal'));
        }
        await startPzipTui();
        return;
    }

    if (args[0] === 'config') {
        runConfigCommand(args.slice(1));
        return;
    }

    const {sourceDirectory, options} = parseArchiveArguments(args);
    const result = await createZipArchive(sourceDirectory, options);
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    printArchiveResult(result);
}

main().catch(error => {
    console.error(`${t('error')}: ${formatPzipError(error)}`);
    process.exit(1);
});
