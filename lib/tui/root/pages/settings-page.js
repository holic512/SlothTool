/**
 * @file RootTuiSettingsPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 以响应式主从布局渲染根 TUI 设置页，在执行前对照展示当前值和下一值。
 * @logic 1. 左侧展示语言、代理和 GitHub 源配置项；2. 右侧展示类别、当前值、执行后值和必要地址；3. 用标签与状态色区分当前选项和网络状态。
 * @dependencies SelectionBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 设置页, 代理配置, GitHub源, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {SelectionBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function SettingsPage({items, selectedIndex, columns}) {
    return h(SelectionBrowserPage, {
        columns,
        items,
        selectedIndex,
        emptyMessage: t('tui.settings.empty'),
        listTitle: t('tui.settings.listTitle'),
        listSummary: t('tui.settings.count', {count: items.length})
    });
}
