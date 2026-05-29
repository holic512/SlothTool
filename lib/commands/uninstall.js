/**
 * @file UninstallCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理插件卸载命令，复用共享插件服务完成数据清理。
 * @logic 1. 校验插件 alias；2. 调用卸载 service；3. 输出标准 CLI 日志。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags uninstall命令, 插件卸载, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, uninstallPlugin} from '../services/plugin-service.js';
import {printReporterEvent} from './shared.js';

export default function uninstall(args) {
    const alias = args[0];

    if (!alias) {
        throw createCliError(`${t('cli.specifyPlugin')}\n${t('cli.uninstallUsage')}`);
    }

    return uninstallPlugin(alias, {reporter: printReporterEvent});
}
