/**
 * @file RootTuiUpdatePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 以响应式主从布局渲染根 TUI 两阶段更新页，集中展示更新操作、检查状态和版本差异。
 * @logic 1. 左侧展示检查、批量和单项更新入口；2. 右侧展示当前版本、最新版本、来源与失败原因；3. 用状态色区分最新、可更新和检查失败。
 * @dependencies SelectionBrowser: ../plugin-browser.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 更新页, 两阶段更新, 版本差异, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {SelectionBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function UpdatePage({items, selectedIndex, columns}) {
    const checkedItems = items.filter(item => item.kind === 'checked-target');
    const outdatedCount = checkedItems.filter(item => item.result?.status === 'outdated').length;
    const failedCount = checkedItems.filter(item => item.result?.status === 'error').length;
    const listSummary = checkedItems.length > 0
        ? t('tui.update.resultSummary', {outdated: outdatedCount, failed: failedCount})
        : t('tui.update.pendingSummary');

    return h(SelectionBrowserPage, {
        columns,
        items,
        selectedIndex,
        emptyMessage: t('tui.update.empty'),
        listTitle: t('tui.update.listTitle'),
        listSummary
    });
}
