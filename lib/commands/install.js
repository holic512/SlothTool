/**
 * @file InstallCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理官方插件安装命令，并将输出委托给共享 plugin service。
 * @logic 1. 校验 alias 输入；2. 调用 install service；3. 以 CLI reporter 输出安装进度。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags install命令, 官方插件, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, getOfficialPluginAliases, installPlugin} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default async function install(args) {
    const alias = args[0];

    if (!alias) {
        throw createCliError(`${t('cli.specifyPlugin')}\n${t('cli.installUsage')}\n${getOfficialPluginAliases().join(', ')}`);
    }

    return installPlugin(alias, {reporter: printReporterEvent});
}
