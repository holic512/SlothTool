const prompts = require('prompts');
const {
    getRuntimeContext,
    commandCurrent,
    commandModes,
    commandUse,
    commandBackupList,
    commandRollback,
    commandCleanCache,
    commandDoctor
} = require('./index');
const {t} = require('./i18n');
const ConfigPanel = require('./ink/ConfigPanel');
const DiffPanel = require('./ink/DiffPanel');
const {showInkPanel} = require('./ink/show');

async function showCurrentInk() {
    const ctx = getRuntimeContext();
    await showInkPanel(ConfigPanel, {
        title: 'Current Codex Config',
        data: ctx.summary,
        hint: 'Press Enter to continue'
    });
}

function tryJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}

async function interactiveMain() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: [
                {title: t('menuCurrent'), value: 'current'},
                {title: t('menuModes'), value: 'modes'},
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
            await showCurrentInk();
            continue;
        }

        if (response.action === 'modes') {
            const text = await commandModes({json: true});
            const data = tryJson(text);
            if (data) {
                console.log(`source=${data.source}, modes=${data.modes.length}, models=${data.models.length}`);
            } else {
                console.log(text);
            }
            continue;
        }

        if (response.action === 'use') {
            const out = await commandUse({interactive: true, json: true});
            const result = tryJson(out);
            if (result && Array.isArray(result.diff)) {
                await showInkPanel(DiffPanel, {
                    title: 'Change Preview',
                    lines: result.diff,
                    hint: 'Press Enter to continue'
                });
            }
            console.log(out);
            continue;
        }

        if (response.action === 'doctor') {
            console.log(await commandDoctor({json: true}));
            continue;
        }

        if (response.action === 'backupList') {
            console.log(await commandBackupList({json: true}));
            continue;
        }

        if (response.action === 'rollback') {
            console.log(await commandRollback({interactive: true, json: true}));
            continue;
        }

        if (response.action === 'clean') {
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

            console.log(await commandCleanCache({
                json: true,
                sessionsDays: sessionsDaysInput.value || 7,
                dryRun: !!dryRunInput.value,
                yes: true
            }));
        }
    }
}

module.exports = {
    interactiveMain
};
