/**
 * @file UpdateCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理单插件更新命令，输出统一 reporter 事件。
 * @logic 1. 校验更新目标；2. 调用 update service；3. 输出更新进度与结果。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags update命令, 插件更新, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, updatePlugin} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default async function update(args) {
    const alias = args[0];

    if (!alias) {
        throw createCliError(`${t('cli.specifyPluginToUpdate')}\n${t('cli.updateUsage')}`);
    }

    return updatePlugin(alias, {reporter: printReporterEvent});
}
