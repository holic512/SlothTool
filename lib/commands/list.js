/**
 * @file ListCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 列出当前已安装插件及其版本、来源与安装时间。
 * @logic 1. 查询安装列表；2. 空列表时输出安装提示；3. 非空时输出结构化清单。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js
 * @index_tags list命令, 插件清单, CLI输出
 * @author holic512
 */

import {t} from '../i18n.js';
import {listInstalledPlugins} from '../services/plugin-service.js';

export default function list() {
    const installedPlugins = listInstalledPlugins();

    if (installedPlugins.length === 0) {
        console.log(t('list.empty'));
        console.log(t('list.installExample'));
        return installedPlugins;
    }

    console.log(t('list.installed'));
    console.log('');

    for (const plugin of installedPlugins) {
        console.log(`  ${plugin.alias}`);
        console.log(`    ${t('list.package')}: ${plugin.displayName}`);
        console.log(`    ${t('list.version')}: ${plugin.version}`);
        console.log(`    ${t('list.source')}: ${plugin.sourceLabel}`);
        console.log(`    ${t('list.installedAt')}: ${new Date(plugin.installedAt).toLocaleString()}`);
        console.log('');
    }

    return installedPlugins;
}
