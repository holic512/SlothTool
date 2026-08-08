/**
 * @file RootTuiUninstallPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 以响应式主从布局渲染根 TUI 卸载页，清楚区分插件卸载与全量数据清理风险。
 * @logic 1. 左侧展示插件卸载和完全卸载入口；2. 右侧展示包版本、来源和移除范围；3. 用黄色确认态与红色高风险态提示不可逆影响。
 * @dependencies SelectionBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 卸载页, 插件卸载, 完全卸载, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {SelectionBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function UninstallPage({items, selectedIndex, columns}) {
    const pluginCount = items.filter(item => item.kind === 'uninstall-plugin').length;

    return h(SelectionBrowserPage, {
        columns,
        items,
        selectedIndex,
        emptyMessage: t('tui.uninstall.empty'),
        listTitle: t('tui.uninstall.listTitle'),
        listSummary: t('tui.uninstall.count', {count: pluginCount})
    });
}
