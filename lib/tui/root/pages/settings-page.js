/**
 * @file RootTuiSettingsPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 设置页的配置项列表和底部当前值提示。
 * @logic 1. 展示语言、代理和 GitHub 源配置项；2. 将当前值输出到底部 tip；3. 无配置项时显示空态。
 * @dependencies Layout: ../layout.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 设置页, 代理配置, GitHub源, tip
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {StackedSelectionPage} from '../layout.js';

const h = React.createElement;

export function SettingsPage({items, selectedIndex}) {
    return h(StackedSelectionPage, {
        items,
        selectedIndex,
        emptyMessage: t('tui.settings.empty'),
        fallbackTitle: t('tui.tabs.settings'),
        fallbackDescription: t('tui.settings.action'),
        fallbackDetail: t('tui.settings.action')
    });
}
