#!/usr/bin/env node

/**
 * @file ImageCompressEntry
 * @project SlothTool
 * @module Image Compress Plugin / Entry
 * @description image-compress 插件入口，无参数默认进入 TUI，显式参数则转发到 Go 后端 CLI。
 * @logic 1. 解析 help 与 TUI 启动参数；2. 保持默认 TUI + 显式 CLI 的插件契约；3. 将业务命令委托给 Go 后端并透传输出。
 * @dependencies Services: ../lib/service.js, TUI: ../lib/tui.js, I18N: ../lib/i18n.js
 * @index_tags image-compress入口, 默认TUI, Go后端代理, CLI转发
 * @author holic512
 */

import {t} from '../lib/i18n.js';
import {isInteractiveTerminal, runBackendCli} from '../lib/service.js';

function showHelp() {
    console.log(`${t('title')}\n`);
    console.log(t('usage'));
    console.log('  image-compress');
    console.log('  image-compress --tui');
    console.log('  image-compress ./photo.jpg');
    console.log('  image-compress -r ./album --output-dir ./compressed');
    console.log('  image-compress ./photo.jpg --dry-run --json');
    console.log('');
    console.log(t('options'));
    console.log(`  -h, --help          ${t('help')}`);
    console.log(`  --tui               ${t('tuiOption')}`);
    console.log(`  -i, --interactive   ${t('tuiOption')}`);
    console.log(`  -r, --recursive     ${t('recursive')}`);
    console.log(`  -o, --output-dir    ${t('outputDir')}`);
    console.log(`  --quality           ${t('quality')}`);
    console.log(`  --max-width         ${t('maxWidth')}`);
    console.log(`  --max-height        ${t('maxHeight')}`);
    console.log(`  --overwrite         ${t('overwrite')}`);
    console.log(`  --allow-larger      ${t('allowLarger')}`);
    console.log(`  --concurrency       ${t('concurrency')}`);
    console.log(`  --dry-run           ${t('dryRun')}`);
    console.log(`  --json              ${t('json')}`);
    console.log(`  --quiet             ${t('quiet')}`);
    console.log('');
    console.log(t('examples'));
    console.log(`  image-compress              ${t('examplesList.defaultTui')}`);
    console.log(`  image-compress ./photo.jpg  ${t('examplesList.singleFile')}`);
    console.log(`  image-compress -r ./album --output-dir ./compressed  ${t('examplesList.batch')}`);
    console.log(`  image-compress ./photo.jpg --dry-run --json  ${t('examplesList.dryRunJson')}`);
    console.log('');
    console.log(t('dragHint'));
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }

    if (args.length === 0 || args.includes('--tui') || args.includes('-i') || args.includes('--interactive')) {
        if (!isInteractiveTerminal() && !process.env.SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION) {
            throw new Error(t('tuiRequiresTerminal'));
        }

        const {startImageCompressTui} = await import('../lib/tui.js');
        await startImageCompressTui();
        return;
    }

    const result = await runBackendCli(args);
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }

    if (result.exitCode !== 0) {
        process.exit(result.exitCode);
    }
}

main().catch(error => {
    console.error(`${t('cliErrorPrefix')}: ${error.message}`);
    process.exit(1);
});
