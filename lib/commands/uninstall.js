/**
 * @file UninstallCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理插件卸载命令，复用共享插件服务完成数据清理。
 * @logic 解析数据策略并展示删除预览；在 CLI 层确认清理；调用共享卸载服务并报告完整结果。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags uninstall命令, 插件卸载, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, describePluginUninstall, uninstallPlugin} from '../services/plugin-service.js';
import {uninstallOptions, confirmUninstall} from './uninstall-options.js';
import {printReporterEvent} from './shared.js';

export default async function uninstall(args) {
    const alias = args[0];

    if (!alias) {
        throw createCliError(`${t('cli.specifyPlugin')}\n${t('cli.uninstallUsage')}`);
    }

    const options = uninstallOptions(args.slice(1));
    const preview = describePluginUninstall(alias, options);
    if (!await confirmUninstall(preview, options)) return {status: 'cancelled'};
    return uninstallPlugin(alias, {...options, reporter: printReporterEvent});
}
