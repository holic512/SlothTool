/**
 * @file RootTuiUpdatePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 两阶段更新页的更新操作列表和底部检查结果提示。
 * @logic 1. 展示检查更新、批量更新和单项更新操作；2. 将版本详情输出到底部 tip；3. 无更新项时显示空态。
 * @dependencies Layout: ../layout.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 更新页, 两阶段更新, 版本详情, tip
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {StackedSelectionPage} from '../layout.js';

const h = React.createElement;

export function UpdatePage({items, selectedIndex}) {
    return h(StackedSelectionPage, {
        items,
        selectedIndex,
        emptyMessage: t('tui.update.empty'),
        fallbackTitle: t('tui.tabs.update'),
        fallbackDescription: t('tui.update.action'),
        fallbackDetail: t('tui.update.checkDetail')
    });
}
