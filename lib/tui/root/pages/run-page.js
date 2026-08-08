/**
 * @file RootTuiRunPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 插件运行页，通过响应式主从布局展示已安装插件及选中插件详情。
 * @logic 1. 左侧展示已安装插件和版本；2. 右侧展示用途、包名、来源和主要能力；3. 复用统一插件浏览布局并突出选中项。
 * @dependencies Libraries: react, PluginBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 运行页, 插件浏览, 插件详情, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {PluginBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function RunPage({items, selectedIndex, columns}) {
    const viewItems = items.map(item => ({
        ...item,
        listMeta: `v${item.version}`,
        badge: t('tui.run.installedBadge'),
        badgeColor: 'green',
        description: item.purpose,
        fields: [
            {label: t('tui.run.fields.version'), value: item.version},
            {label: t('tui.run.fields.package'), value: item.packageName},
            {label: t('tui.run.fields.source'), value: item.source, dimColor: true}
        ],
        featuresLabel: t('tui.run.fields.features'),
        featureCountText: t('tui.pluginBrowser.featureCount', {count: item.features.length})
    }));

    return h(PluginBrowserPage, {
        columns,
        items: viewItems,
        selectedIndex,
        emptyMessage: t('tui.run.empty'),
        listTitle: t('tui.run.listTitle'),
        listSummary: t('tui.run.count', {count: items.length})
    });
}
