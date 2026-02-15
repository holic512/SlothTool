const prompts = require('prompts');
const {t} = require('./i18n');

async function interactiveMain() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('interactive'),
            choices: [
                {title: t('help'), value: 'help'},
                {title: t('interactive'), value: 'interactive'},
                {title: t('exit') || 'Exit', value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        if (response.action === 'help') {
            console.log(t('title'));
        }
    }
}

module.exports = {
    interactiveMain
};
