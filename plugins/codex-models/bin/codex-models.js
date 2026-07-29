#!/usr/bin/env node

/**
 * @file CodexModelsPluginEntry
 * @project SlothTool
 * @module Codex Models Plugin / Entry
 * @description Codex 自定义模型、多厂商模型库、推理等级与 Desktop 筛选修复插件入口，无参数默认进入 TUI。
 * @logic 1. 解析 doctor/catalog/model/reasoning/library/repair CLI；2. 业务操作全部委托共享 service；3. TUI 仅负责编排和交互。
 * @dependencies Services: ../lib/service.js; TUI: ../lib/tui.js; I18N: ../lib/i18n.js
 * @index_tags codex, model catalog, model library, reasoning effort, desktop repair, CLI, TUI
 * @author holic512
 */

import {
    createDesktopRepairScript,
    inspectCodexModels,
    setCodexModel,
    setCodexReasoningEffort,
    syncModelCatalog
} from '../lib/service.js';
import {t} from '../lib/i18n.js';
import {interactiveMain} from '../lib/tui.js';

function isInteractiveTerminal() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function hasFlag(args, flag) {
    return args.includes(flag);
}

function readOption(args, option) {
    const index = args.indexOf(option);
    return index >= 0 ? args[index + 1] || '' : '';
}

function printHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    for (const line of t('help')) {
        console.log(line);
    }
}

function printDoctor(result, json) {
    if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(t('doctorTitle'));
    console.log(t('model', {value: result.model || '-'}));
    console.log(t('reasoningEffort', {value: result.reasoningEffort || '-'}));
    console.log(t('provider', {value: result.modelProvider}));
    console.log(t('baseUrl', {value: result.baseUrl || '-'}));
    console.log(t('credential', {value: result.credential}));
    console.log(t('catalog', {value: result.catalogPath || '-'}));
    console.log(t('models', {count: result.models.length}));
    console.log(t('activeAvailable', {value: result.activeModelAvailable ? t('yes') : t('no')}));
    console.log(t('activeCatalog', {value: result.activeModelInCatalog ? t('yes') : t('no')}));
    console.log(t('activeReasoningSupported', {value: result.activeReasoningSupported ? t('yes') : t('no')}));
    for (const item of result.models) {
        console.log(`  ${item.id} | ${item.vendor} | ${item.contextWindow} | ${item.reasoningEfforts.join('/')}`);
    }
}

function printValue(value, json, text) {
    if (json) {
        console.log(JSON.stringify(value, null, 2));
        return;
    }
    console.log(text);
}

function libraryItemText(item) {
    return `${item.id}\n  ${t('libraryVendor', {value: item.vendor})}\n  ${t('libraryFamily', {value: item.family})}\n  ${t('libraryContext', {value: item.contextWindow})}\n  ${t('libraryEfforts', {value: item.reasoningEfforts.join(', ')})}\n  ${t('libraryDefaultEffort', {value: item.defaultReasoningEffort})}\n  ${t('librarySearch', {value: item.supportsSearchTool ? t('yes') : t('no')})}\n  ${t('librarySource', {value: item.metadataSource})}`;
}

async function runCli(args) {
    if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
        printHelp();
        return;
    }
    const json = hasFlag(args, '--json');
    const commandArgs = args.filter(arg => arg !== '--json');
    const command = commandArgs[0];

    if (command === 'doctor') {
        printDoctor(await inspectCodexModels(), json);
        return;
    }
    if (command === 'catalog' && commandArgs[1] === 'sync') {
        const outputPath = readOption(commandArgs, '--output');
        const result = await syncModelCatalog({outputPath: outputPath || undefined});
        printValue(result, json, t('catalogSynced', {count: result.modelCount, path: result.catalogPath}));
        return;
    }
    if (command === 'model' && commandArgs[1] === 'set') {
        const reasoningEffort = readOption(commandArgs, '--reasoning');
        const result = await setCodexModel(commandArgs[2], {reasoningEffort: reasoningEffort || undefined});
        printValue(result, json, t('modelAndReasoningSet', {model: result.model, effort: result.reasoningEffort}));
        return;
    }
    if (command === 'reasoning' && commandArgs[1] === 'set') {
        const result = await setCodexReasoningEffort(commandArgs[2]);
        printValue(result, json, t('reasoningSet', {model: result.model, effort: result.reasoningEffort}));
        return;
    }
    if (command === 'library' && commandArgs[1] === 'list') {
        const result = await inspectCodexModels();
        printValue(result.models, json, result.models.map(libraryItemText).join('\n'));
        return;
    }
    if (command === 'library' && commandArgs[1] === 'show') {
        const result = await inspectCodexModels();
        const item = result.models.find(model => model.id === commandArgs[2]);
        if (!item) {
            throw new Error(`The provider does not expose model "${commandArgs[2] || ''}".`);
        }
        printValue(item, json, libraryItemText(item));
        return;
    }
    if (command === 'repair' && commandArgs[1] === 'create') {
        const outputDir = readOption(commandArgs, '--output');
        const result = createDesktopRepairScript(commandArgs[2], {outputDir: outputDir || undefined});
        printValue(result, json, `${t('repairCreated', {path: result.outputPath})}\n${t('repairNotice')}\n\n${result.command}\n${result.repairCommand}\n${result.rollbackCommand}`);
        return;
    }

    printHelp();
    process.exitCode = 2;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || hasFlag(args, '--tui') || hasFlag(args, '-i') || hasFlag(args, '--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION) {
            throw new Error(t('tuiRequiresTerminal'));
        }
        await interactiveMain();
        return;
    }
    await runCli(args);
}

main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});
