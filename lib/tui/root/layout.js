/**
 * @file RootTuiLayout
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 提供根 TUI 的共享 Ink 外壳组件，包括页头、页脚和快捷键帮助面板。
 * @logic 1. 渲染顶部 tab 与路径元信息；2. 渲染异步状态与底部快捷键；3. 按需展示快捷键帮助面板。
 * @dependencies Libraries: react/ink, Constants: ./constants.js, Format: ./format.js, I18N: ../../i18n.js
 * @index_tags 根TUI, Ink布局, 页头, 页脚, 快捷键帮助
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {t} from '../../i18n.js';
import {ROOT_TUI_COLORS, TAB_ORDER} from './constants.js';
import {buildHeaderMetaText, buildTabText, HEADER_TAB_SEPARATOR} from './format.js';

const h = React.createElement;

export function RootHeader({currentTab, columns}) {
    const headerMetaText = buildHeaderMetaText(currentTab, columns);
    const tabItems = TAB_ORDER.flatMap((tabKey, index) => [
        index > 0
            ? h(Text, {key: `${tabKey}-separator`, color: ROOT_TUI_COLORS.muted, dimColor: true}, HEADER_TAB_SEPARATOR)
            : null,
        h(
            Text,
            {
                key: tabKey,
                bold: tabKey === currentTab,
                color: tabKey === currentTab ? ROOT_TUI_COLORS.accent : ROOT_TUI_COLORS.muted
            },
            buildTabText(tabKey, currentTab)
        )
    ]).filter(Boolean);

    return h(
        Box,
        {},
        h(
            Box,
            {},
            ...tabItems
        ),
        h(Spacer, {}),
        headerMetaText
            ? h(Text, {dimColor: true}, headerMetaText)
            : null
    );
}

export function RootFooter({statusColor, confirmText}) {
    return h(
        Box,
        {marginTop: 1},
        h(Text, {color: statusColor}, confirmText),
        h(Spacer, {}),
        h(Text, {dimColor: true}, t('tui.footer.help'))
    );
}

export function HelpPanel() {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, marginTop: 1, flexDirection: 'column'},
        h(Text, {bold: true}, t('tui.help.title')),
        ...t('tui.help.lines').map(line => h(Text, {key: line}, line))
    );
}
