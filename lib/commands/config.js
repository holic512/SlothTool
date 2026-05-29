const settings = require('../settings');
const {t} = require('../i18n');

function config(args) {
    if (args.length === 0) {
        // 显示当前配置
        const language = settings.getLanguage();
        console.log(t('currentLanguage'), language);
        console.log('\n' + t('configUsage'));
        return;
    }

    const subCommand = args[0];

    if (subCommand === 'language') {
        if (args.length < 2) {
            console.log(t('configUsage'));
            return;
        }

        const language = args[1];

        if (language !== 'zh' && language !== 'en') {
            console.error(t('invalidLanguage'));
            return;
        }

        settings.setLanguage(language);
        console.log(t('languageSet'), language);
    } else {
        console.log(t('configUsage'));
    }
}

module.exports = config;
