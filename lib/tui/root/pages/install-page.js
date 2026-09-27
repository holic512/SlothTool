/**
 * @file RootTuiInstallPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 官方插件目录与安装成功后的直接启动入口。
 * @logic 1. 官方目录复用响应式插件浏览布局；2. 安装成功时独立显示启动和返回目录操作。
 * @dependencies Libraries: react/ink, Constants: ../constants.js, PluginBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 安装页, 官方插件目录, 插件详情, 响应式布局
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';
import {ROOT_TUI_COLORS} from '../constants.js';
import {getContentWidth, truncateFromRight} from '../format.js';
import {PluginBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function InstallPage({items, selectedIndex, columns, contentHeight}) {
    const viewItems = items.map(item => ({
        ...item,
        badge: t('tui.install.officialBadge'),
        badgeColor: ROOT_TUI_COLORS.warning,
        fields: [
            {label: t('tui.install.fields.package'), value: item.packageName},
            {label: t('tui.install.fields.author'), value: item.author}
        ],
        featuresLabel: t('tui.install.fields.features'),
        featureCountText: t('tui.pluginBrowser.featureCount', {count: item.features.length})
    }));

    return h(PluginBrowserPage, {
        columns,
        contentHeight,
        items: viewItems,
        selectedIndex,
        emptyMessage: t('tui.install.empty'),
        listTitle: t('tui.install.listTitle'),
        listSummary: t('tui.install.count', {count: items.length})
    });
}

export function InstallSuccessPage({alias, columns, contentHeight}) {
    const width = Math.max(1, getContentWidth(columns) - 4);
    return h(
        Box,
        {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.success, paddingX: 1, flexDirection: 'column', height: contentHeight},
        h(Text, {bold: true, color: ROOT_TUI_COLORS.success}, truncateFromRight(t('tui.install.success', {alias}), width)),
        h(Text, {color: ROOT_TUI_COLORS.accent}, truncateFromRight(t('tui.install.launchNow', {alias}), width)),
        h(Text, {dimColor: true}, truncateFromRight(t('tui.install.backToCatalog'), width))
    );
}
