#!/usr/bin/env node

const {
    commandCurrent,
    commandModes,
    commandUse,
    commandBackupList,
    commandRollback,
    commandCleanCache,
    commandDoctor
} = require('../lib/index');
const {interactiveMain} = require('../lib/interactive');
const {t} = require('../lib/i18n');

const args = process.argv.slice(2);

function hasFlag(name) {
    return args.includes(name);
}

function getFlagValue(flag) {
    const idx = args.indexOf(flag);
    if (idx >= 0 && args[idx + 1]) {
        return args[idx + 1];
    }
    return null;
}

function showHelp() {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  codex-switch -i');
    console.log('  codex-switch current [--json]');
    console.log('  codex-switch modes [--refresh] [--json] [--provider <id>] [--mode <id>]');
    console.log('  codex-switch use');
    console.log('  codex-switch use --mode <mode> --model <model> [--provider <id>] [--yes] [--json]');
    console.log('  codex-switch backup list [--json]');
    console.log('  codex-switch rollback [--id <backupId>] [--yes] [--json]');
    console.log('  codex-switch clean cache [--dry-run] [--sessions-days <n>] [--yes] [--json]');
    console.log('  codex-switch doctor [--json]\n');
    console.log(t('options'));
    console.log('  -h, --help         ' + t('help'));
    console.log('  -i, --interactive  ' + t('interactive') + '\n');
    console.log(t('examples'));
    console.log('  codex-switch current');
    console.log('  codex-switch modes --refresh');
    console.log('  codex-switch use --mode code --model gpt-5.3-codex --yes');
    console.log('  codex-switch rollback --id 2026-02-20T10-00-00-000Z-deadbeef --yes');
    console.log('  codex-switch clean cache --dry-run');
    console.log('  codex-switch doctor --json');
}

function parseCommonOptions() {
    return {
        json: hasFlag('--json'),
        yes: hasFlag('--yes')
    };
}

async function main() {
    try {
        if (args.length === 0 || hasFlag('-i') || hasFlag('--interactive')) {
            await interactiveMain();
            return;
        }

        if (hasFlag('-h') || hasFlag('--help')) {
            showHelp();
            return;
        }

        const command = args[0];
        const common = parseCommonOptions();

        if (command === 'current') {
            console.log(await commandCurrent(common));
            return;
        }

        if (command === 'modes') {
            console.log(await commandModes({
                ...common,
                refresh: hasFlag('--refresh'),
                provider: getFlagValue('--provider'),
                mode: getFlagValue('--mode')
            }));
            return;
        }

        if (command === 'use') {
            const model = getFlagValue('--model');
            const mode = getFlagValue('--mode');
            const provider = getFlagValue('--provider');

            if (!mode && !model) {
                console.log(await commandUse({...common, interactive: true}));
                return;
            }

            console.log(await commandUse({
                ...common,
                interactive: false,
                mode,
                model,
                provider
            }));
            return;
        }

        if (command === 'backup' && args[1] === 'list') {
            console.log(await commandBackupList(common));
            return;
        }

        if (command === 'rollback') {
            console.log(await commandRollback({
                ...common,
                id: getFlagValue('--id'),
                interactive: false
            }));
            return;
        }

        if (command === 'clean' && args[1] === 'cache') {
            console.log(await commandCleanCache({
                ...common,
                dryRun: hasFlag('--dry-run'),
                sessionsDays: getFlagValue('--sessions-days')
            }));
            return;
        }

        if (command === 'doctor') {
            console.log(await commandDoctor(common));
            return;
        }

        console.error(t('invalidArgs'));
        showHelp();
        process.exit(2);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    process.exit(0);
});

main();
