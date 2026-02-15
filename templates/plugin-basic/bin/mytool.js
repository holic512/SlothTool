#!/usr/bin/env node

const {t} = require('../lib/i18n');
const {interactiveMain} = require('../lib/interactive');

const args = process.argv.slice(2);

function showHelp() {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  mytool [options]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -i, --interactive ' + t('interactive'));
}

async function main() {
    if (args.length === 0 || args.includes('-i') || args.includes('--interactive')) {
        await interactiveMain();
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    showHelp();
    process.exit(2);
}

process.on('SIGINT', () => {
    process.exit(0);
});

main().catch(error => {
    console.error(t('error') + ': ' + error.message);
    process.exit(1);
});
