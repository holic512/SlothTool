/**
 * @file RunCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理显式 run 子命令和插件简写调用，统一复用插件运行 service。
 * @logic 1. 解析 run 与 shorthand 的参数语义；2. 无额外参数时根据模式决定是否偏向 TUI；3. 返回插件进程退出码。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js
 * @index_tags run命令, 插件简写, TUI默认入口
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, runInstalledPlugin} from '../services/plugin-service.js';

export default async function run(args, options = {}) {
    const shorthand = options.shorthand === true;
    const pluginAlias = args[0];
    const pluginArgs = args.slice(1);

    if (!pluginAlias) {
        throw createCliError(shorthand ? t('cli.specifyPlugin') : `${t('cli.specifyPluginToRun')}\n${t('cli.runUsage')}`);
    }

    return runInstalledPlugin(pluginAlias, pluginArgs, {
        preferTui: shorthand && pluginArgs.length === 0
    });
}
