/**
 * @file ConfigCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理全局配置命令，目前负责语言设置的读取和写入。
 * @logic 1. 无参数时展示当前语言；2. 校验 language 子命令；3. 写入 settings.json 并反馈结果。
 * @dependencies Settings: ../settings.js, I18N: ../i18n.js, Service: ../services/plugin-service.js
 * @index_tags config命令, language, settings.json
 * @author holic512
 */

import settings from '../settings.js';
import {t} from '../i18n.js';
import {createCliError} from '../services/plugin-service.js';

export default function config(args) {
    if (args.length === 0) {
        console.log(t('cli.currentLanguage', {language: settings.getLanguage()}));
        console.log(t('cli.configUsage'));
        return settings.getLanguage();
    }

    const subCommand = args[0];

    if (subCommand !== 'language') {
        throw createCliError(t('cli.configUsage'));
    }

    const language = args[1];
    if (!language) {
        throw createCliError(t('cli.configUsage'));
    }

    if (!['zh', 'en'].includes(language)) {
        throw createCliError(t('cli.invalidLanguage'));
    }

    settings.setLanguage(language);
    console.log(t('cli.languageSet', {language}));
    return language;
}
