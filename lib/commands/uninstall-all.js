/**
 * @file UninstallAllCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 按保留或清理数据策略批量卸载，在 CLI 层确认，在 service 层清理受管路径。
 * @logic 解析策略并预览目录内外删除路径；非交互调用要求 yes；复用服务先清理链接再处理程序与数据。
 * @dependencies Node: readline/promises, Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags uninstall-all命令, 删除确认, 数据清理
 * @author holic512
 */

import {t} from '../i18n.js';
import {describeUninstallAll, uninstallAllData} from '../services/plugin-service.js';
import {uninstallOptions, confirmUninstall} from './uninstall-options.js';
import {printReporterEvent} from './shared.js';

export default async function uninstallAll(args = []) {
    const options = uninstallOptions(args, {all: true});
    const preview = describeUninstallAll(options);
    console.log(t('uninstallAll.title'));
    if (!preview.exists && !preview.vault.items.some(item => item.external)) return preview;
    if (!await confirmUninstall(preview, options, {all: true})) return {status: 'cancelled'};
    return uninstallAllData({...options, reporter: printReporterEvent});
}
