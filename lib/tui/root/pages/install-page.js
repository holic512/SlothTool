/**
 * @file RootTuiInstallPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 官方插件安装页，通过响应式主从布局展示可安装插件及完整能力信息。
 * @logic 1. 左侧展示可安装官方插件；2. 右侧展示说明、包名、作者和主要能力；3. 无待安装插件时显示明确空态。
 * @dependencies Libraries: react, PluginBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 安装页, 官方插件目录, 插件详情, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {PluginBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function InstallPage({items, selectedIndex, columns}) {
    const viewItems = items.map(item => ({
        ...item,
        badge: t('tui.install.officialBadge'),
        badgeColor: 'yellow',
        fields: [
            {label: t('tui.install.fields.package'), value: item.packageName},
            {label: t('tui.install.fields.author'), value: item.author}
        ],
        featuresLabel: t('tui.install.fields.features'),
        featureCountText: t('tui.pluginBrowser.featureCount', {count: item.features.length})
    }));

    return h(PluginBrowserPage, {
        columns,
        items: viewItems,
        selectedIndex,
        emptyMessage: t('tui.install.empty'),
        listTitle: t('tui.install.listTitle'),
        listSummary: t('tui.install.count', {count: items.length})
    });
}
