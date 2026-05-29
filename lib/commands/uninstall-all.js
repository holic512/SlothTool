/**
 * @file UninstallAllCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理完全卸载命令，在 CLI 层完成确认交互，在 service 层执行实际删除。
 * @logic 1. 展示删除预览；2. 使用 readline/promises 获取 yes 确认；3. 复用 service 删除数据目录。
 * @dependencies Node: readline/promises, Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags uninstall-all命令, 删除确认, 数据清理
 * @author holic512
 */

import {createInterface} from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';
import {t} from '../i18n.js';
import {describeUninstallAll, uninstallAllData} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default async function uninstallAll() {
    const preview = describeUninstallAll();

    console.log(t('uninstallAll.title'));
    console.log(t('uninstallAll.warning'));

    if (!preview.exists) {
        printReporterEvent({level: 'info', message: t('uninstallAll.noData', {dir: preview.slothtoolDir})});
        printReporterEvent({level: 'info', message: t('uninstallAll.alreadyClean')});
        return preview;
    }

    console.log(t('uninstallAll.previewDir', {dir: preview.slothtoolDir}));
    console.log(t('uninstallAll.previewPlugins', {count: preview.pluginCount}));

    const rl = createInterface({input, output});
    const answer = await rl.question(`${t('cli.confirmPrompt')} `);
    rl.close();

    if (answer.trim().toLowerCase() !== 'yes') {
        console.log(t('cli.operationCancelled'));
        return preview;
    }

    return uninstallAllData({reporter: printReporterEvent});
}
