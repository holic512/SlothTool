const prompts = require('prompts');
const {
    getRuntimeContext,
    commandCurrent,
    commandUse,
    commandBackupList,
    commandRollback,
    commandCleanCache,
    commandDoctor
} = require('./index');
const {t} = require('./i18n');

function clearScreen() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1Bc');
    }
}

function divider(char = '=') {
    return char.repeat(64);
}

function renderHeader(title, subtitle) {
    clearScreen();
    console.log(divider('='));
    console.log(title);
    if (subtitle) {
        console.log(subtitle);
    }
    console.log(divider('='));
}

function printKv(label, value) {
    const text = value === undefined || value === null || value === '' ? '-' : String(value);
    console.log(`${label}: ${text}`);
}

function tryJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

async function waitForContinue() {
    await prompts({
        type: 'text',
        name: 'ok',
        message: t('promptContinue'),
        initial: ''
    });
}

function renderCurrentSummary(data) {
    if (!data || !data.current) {
        return;
    }
    const current = data.current;
    printKv(t('selectedPath'), data.selectedPath);
    printKv('provider', current.model_provider);
    printKv('model', current.model);
    printKv('base_url', current.provider && current.provider.base_url);
}

function renderUseSummary(result) {
    if (!result) {
        return;
    }
    printKv('success', !!result.success);
    if (result.cancelled) {
        printKv('cancelled', true);
    }
    if (result.backup && result.backup.id) {
        printKv('backup', result.backup.id);
    }
    if (result.source) {
        printKv('source', result.source);
    }
    if (result.warning) {
        printKv('warning', result.warning);
    }
    if (result.modelChange) {
        printKv('model', result.modelChange);
    }
    if (Array.isArray(result.diff) && result.diff.length > 0) {
        console.log('\n[diff]');
        result.diff.forEach(line => console.log('  - ' + line));
    }
    if (result.current) {
        console.log('\n[current]');
        printKv('provider', result.current.model_provider);
        printKv('model', result.current.model);
        printKv('base_url', result.current.provider && result.current.provider.base_url);
    }
}

function renderDoctorSummary(data) {
    if (!data) {
        return;
    }
    printKv('selectedPath', data.selectedPath);
    if (data.checks) {
        printKv('parse', data.checks.parse);
        printKv('model_provider', data.checks.model_provider);
        printKv('model', data.checks.model);
        printKv('base_url', data.checks.base_url);
        printKv('modesSource', data.checks.modesSource);
        printKv('modesCount', data.checks.modesCount);
        printKv('modelsCount', data.checks.modelsCount);
    }
    if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        console.log('\n[warnings]');
        data.warnings.forEach(item => console.log('  - ' + item));
    }
}

function renderBackupListSummary(data) {
    if (!data) {
        return;
    }
    printKv('total', data.total);
    if (Array.isArray(data.items) && data.items.length > 0) {
        console.log('\n[recent backups]');
        data.items.slice(0, 10).forEach(item => {
            console.log(`  - ${item.id} (${item.mtime})`);
        });
    }
}

function renderCleanSummary(data) {
    if (!data) {
        return;
    }
    printKv('success', data.success);
    printKv('dryRun', data.dryRun);
    printKv('sessionsDays', data.sessionsDays);
    if (data.result) {
        printKv('files', data.result.fileCount);
        printKv('bytes', data.result.totalBytes);
    }
    if (Array.isArray(data.plan) && data.plan.length > 0) {
        console.log('\n[plan]');
        data.plan.forEach(item => {
            console.log(`  - ${item.kind}: ${item.count} entries`);
        });
    }
}

async function interactiveMain() {
    while (true) {
        let ctx = null;
        try {
            ctx = getRuntimeContext();
        } catch (error) {
            ctx = null;
        }

        renderHeader(t('title'), t('menuHint'));
        if (ctx && ctx.summary) {
            renderCurrentSummary({selectedPath: ctx.configPath, current: ctx.summary});
            console.log(divider('-'));
        }

        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: [
                {title: t('menuCurrent'), value: 'current'},
                {title: t('menuUse'), value: 'use'},
                {title: t('menuDoctor'), value: 'doctor'},
                {title: t('menuBackupList'), value: 'backupList'},
                {title: t('menuRollback'), value: 'rollback'},
                {title: t('menuClean'), value: 'clean'},
                {title: t('menuExit'), value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        if (response.action === 'current') {
            renderHeader(t('title'), t('menuCurrent'));
            const text = await commandCurrent({json: true});
            const data = tryJson(text);
            if (data) {
                renderCurrentSummary(data);
            } else {
                console.log(text);
            }
            await waitForContinue();
            continue;
        }

        if (response.action === 'use') {
            renderHeader(t('title'), t('menuUse'));
            const out = await commandUse({interactive: true, json: true});
            const result = tryJson(out);
            if (result) {
                renderUseSummary(result);
            } else {
                console.log(out);
            }
            await waitForContinue();
            continue;
        }

        if (response.action === 'doctor') {
            renderHeader(t('title'), t('menuDoctor'));
            const out = await commandDoctor({json: true});
            const data = tryJson(out);
            if (data) {
                renderDoctorSummary(data);
            } else {
                console.log(out);
            }
            await waitForContinue();
            continue;
        }

        if (response.action === 'backupList') {
            renderHeader(t('title'), t('menuBackupList'));
            const out = await commandBackupList({json: true});
            const data = tryJson(out);
            if (data) {
                renderBackupListSummary(data);
            } else {
                console.log(out);
            }
            await waitForContinue();
            continue;
        }

        if (response.action === 'rollback') {
            renderHeader(t('title'), t('menuRollback'));
            const out = await commandRollback({interactive: true, json: true});
            const data = tryJson(out);
            if (data) {
                renderUseSummary(data);
            } else {
                console.log(out);
            }
            await waitForContinue();
            continue;
        }

        if (response.action === 'clean') {
            renderHeader(t('title'), t('menuClean'));
            const sessionsDaysInput = await prompts({
                type: 'number',
                name: 'value',
                message: t('promptSessionsDays'),
                initial: 7,
                min: 1
            });
            const dryRunInput = await prompts({
                type: 'confirm',
                name: 'value',
                message: 'Dry run first?',
                initial: true
            });

            const out = await commandCleanCache({
                json: true,
                sessionsDays: sessionsDaysInput.value || 7,
                dryRun: !!dryRunInput.value,
                yes: true
            });
            const data = tryJson(out);
            if (data) {
                renderCleanSummary(data);
            } else {
                console.log(out);
            }
            await waitForContinue();
        }
    }
}

module.exports = {
    interactiveMain
};
