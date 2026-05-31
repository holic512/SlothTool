/**
 * @file RootTuiUninstallPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 卸载页的卸载操作列表和底部风险提示。
 * @logic 1. 展示插件卸载和完全卸载操作；2. 将源信息或风险说明输出到底部 tip；3. 无插件时保留完全卸载入口。
 * @dependencies Layout: ../layout.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 卸载页, 插件卸载, 完全卸载, tip
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {StackedSelectionPage} from '../layout.js';

const h = React.createElement;

export function UninstallPage({items, selectedIndex}) {
    return h(StackedSelectionPage, {
        items,
        selectedIndex,
        emptyMessage: t('tui.uninstall.empty'),
        fallbackTitle: t('tui.tabs.uninstall'),
        fallbackDescription: t('tui.uninstall.action'),
        fallbackDetail: t('tui.uninstall.action')
    });
}
