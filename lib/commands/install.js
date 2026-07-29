/**
 * @file InstallCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理官方插件在线或本地离线归档安装命令，并将输出委托给共享 plugin service。
 * @logic 1. 校验 alias 与 --file 输入；2. 在线调用 release 安装或离线调用本地归档安装；3. 以 CLI reporter 输出安装进度。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags install命令, 官方插件, 离线安装, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, getOfficialPluginAliases, installPlugin, installPluginFromArchive} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default async function install(args) {
    const alias = args[0];
    if (!alias) {
        throw createCliError(`${t('cli.specifyPlugin')}\n${t('cli.installUsage')}\n${getOfficialPluginAliases().join(', ')}`);
    }

    const fileIndex = args.indexOf('--file');
    if (fileIndex < 0) {
        if (args.length > 1) {
            throw createCliError(t('cli.installUsage'));
        }
        return installPlugin(alias, {reporter: printReporterEvent});
    }

    const archivePath = args[fileIndex + 1];
    if (!archivePath || args.length !== 3 || fileIndex !== 1) {
        throw createCliError(t('cli.installUsage'));
    }
    return installPluginFromArchive(alias, archivePath, {reporter: printReporterEvent});
}
