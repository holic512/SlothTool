#!/usr/bin/env node

/**
 * @file LocPluginEntry
 * @project SlothTool
 * @module LOC Plugin / Entry
 * @description loc 插件命令入口，无参数默认进入 TUI，显式参数走纯 CLI 统计或配置命令。
 * @logic 1. 解析 help、tui、config 与统计参数；2. 无参数时默认进入 Ink TUI；3. 复用 service 层处理统计与配置。
 * @dependencies Services: ../lib/service.js, TUI: ../lib/tui.js, I18N: ../lib/i18n.js, Storage: ../lib/config.js
 * @index_tags loc入口, 默认TUI, CLI统计, 配置命令
 * @author holic512
 */

import {t} from '../lib/i18n.js';
import {
    countTargetDirectory,
    getConfigSummary,
    resetPluginConfig,
    toggleExcludedDirectory,
    toggleExtension
} from '../lib/service.js';
import {startLocTui} from '../lib/tui.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  loc');
    console.log('  loc [directory]');
    console.log('  loc --tui');
    console.log('  loc --config');
    console.log('  loc config show');
    console.log('  loc config reset');
    console.log('  loc config ext <name> <on|off>');
    console.log('  loc config exclude <name> <on|off>');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help       ${t('help')}`);
    console.log(`  -v, --verbose    ${t('verbose')}`);
    console.log(`  -c, --config     ${t('config')}`);
    console.log(`  --tui            ${t('tuiOption')}`);
    console.log(`  -i, --interactive ${t('tuiOption')}`);
    console.log('');
    console.log(t('examples'));
    console.log(`  loc              ${t('exampleTui')}`);
    console.log(`  loc .            ${t('exampleCurrent')}`);
    console.log(`  loc ./src        ${t('exampleSrc')}`);
    console.log(`  loc -v ./src     ${t('exampleVerbose')}`);
    console.log(`  loc -c           ${t('exampleConfig')}`);
    console.log(`  loc config ext md off  ${t('exampleConfigSet')}`);
}

function printConfigSummary() {
    const config = getConfigSummary();
    console.log(t('configShowTitle'));
    console.log(JSON.stringify(config, null, 2));
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
    const subCommand = args[0] || 'show';

    if (subCommand === 'show') {
        printConfigSummary();
        return;
    }

    if (subCommand === 'reset') {
        resetPluginConfig();
        console.log(t('configReset'));
        return;
    }

    if (subCommand === 'ext') {
        const extension = args[1];
        const enabled = normalizeState(args[2]);
        toggleExtension(extension, enabled);
        console.log(t('configSaved'));
        return;
    }

    if (subCommand === 'exclude') {
        const directoryName = args[1];
        const enabled = normalizeState(args[2]);
        toggleExcludedDirectory(directoryName, enabled);
        console.log(t('configSaved'));
        return;
    }

    throw new Error(t('configUnknownTarget'));
}

function printCountResult(result) {
    console.log(t('counting', {dir: result.resolvedDir}));
    console.log(t('totalFiles', {count: result.fileCount}));
    console.log(t('totalLines', {count: result.lineCount}));

    if (result.verbose && result.files.length > 0) {
        console.log(`\n${t('files')}`);
        for (const file of result.files) {
            console.log(`  ${file.path}: ${file.lines} ${t('lines')}`);
        }
    }

    if (result.warnings.length > 0) {
        console.log(`\n${t('warningsTitle')}`);
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
        if (isInteractiveTerminal() || process.env.SLOTHTOOL_LOC_TUI_TEST_ACTION) {
            await startLocTui();
            return;
        }

        printHelp();
        return;
    }

    if (args.includes('--tui') || args.includes('--interactive') || args.includes('-i')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_LOC_TUI_TEST_ACTION) {
            throw new Error(t('tuiRequiresTerminal'));
        }

        await startLocTui();
        return;
    }

    if (args.includes('--config') || args.includes('-c')) {
        printConfigSummary();
        return;
    }

    if (args[0] === 'config') {
        runConfigCommand(args.slice(1));
        return;
    }

    const verbose = args.includes('--verbose') || args.includes('-v');
    const filteredArgs = args.filter(arg => !arg.startsWith('-'));
    const targetDir = filteredArgs[0] || '.';

    try {
        const result = countTargetDirectory(targetDir, {verbose});
        printCountResult(result);
    } catch (error) {
        throw new Error(t('invalidDirectory', {dir: error.message}));
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
