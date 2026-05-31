/**
 * @file RootTuiRunPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 插件运行页的插件列表和底部运行提示。
 * @logic 1. 展示可运行插件列表；2. 将选中插件详情输出到底部 tip；3. 无插件时显示空态。
 * @dependencies Layout: ../layout.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 运行页, 插件列表, tip
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {StackedSelectionPage} from '../layout.js';

const h = React.createElement;

export function RunPage({items, selectedIndex}) {
    return h(StackedSelectionPage, {
        items,
        selectedIndex,
        emptyMessage: t('tui.run.empty'),
        fallbackTitle: t('tui.tabs.run'),
        fallbackDescription: t('tui.run.action'),
        fallbackDetail: t('tui.run.action')
    });
}
