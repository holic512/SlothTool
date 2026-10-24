/**
 * @file RootTuiSettingsPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 以响应式主从布局渲染根 TUI 设置页，在执行前对照展示当前值和下一值。
 * @logic 1. 左侧展示语言、代理、GitHub 源和内置 Skill 操作；2. 右侧展示类别、当前值、执行后值和必要地址；3. 用标签与状态色区分当前选项；4. Skill 卸载复用确认按键与详情容器，不展示插件数据策略。
 * @dependencies React/Ink, SelectionBrowser: ../plugin-browser.js, DetailPanel: ../layout.js, Format: ../format.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 设置页, 代理配置, GitHub源, 响应式布局
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {Box, Text} from 'ink';
import {DetailPanel} from '../layout.js';
import {getContentWidth, truncateFromRight} from '../format.js';
import {SelectionBrowserPage} from '../plugin-browser.js';

const h = React.createElement;

export function SettingsPage({items, selectedIndex, columns, contentHeight}) {
    return h(SelectionBrowserPage, {
        columns,
        contentHeight,
        items,
        selectedIndex,
        emptyMessage: t('tui.settings.empty'),
        listTitle: t('tui.settings.listTitle'),
        listSummary: t('tui.settings.count', {count: items.length})
    });
}

export function SkillConfirmPanel({action, scroll, height, columns}) {
    return h(Box, {flexDirection: 'column', height},
        h(DetailPanel, {
            title: t('tui.confirm.title'),
            lines: action.lines,
            scroll,
            height: Math.max(4, height - 1),
            columns
        }),
        h(Text, {wrap: 'truncate-end'}, truncateFromRight(t('tui.confirm.pluginPrompt'), getContentWidth(columns)))
    );
}
