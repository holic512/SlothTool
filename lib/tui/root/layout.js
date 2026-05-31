/**
 * @file RootTuiLayout
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 提供根 TUI 的共享 Ink 布局组件，包括列表、底部提示、页头、页脚和帮助面板。
 * @logic 1. 渲染上方选择列表与底部 tip；2. 渲染顶部 tab 与路径元信息；3. 渲染状态栏和快捷键帮助。
 * @dependencies Libraries: react/ink, Constants: ./constants.js, Format: ./format.js, I18N: ../../i18n.js
 * @index_tags 根TUI, Ink布局, 列表, tip, 页头页脚
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {t} from '../../i18n.js';
import {TAB_ORDER} from './constants.js';
import {buildHeaderMetaText, buildTabText} from './format.js';

const h = React.createElement;

export function SelectionList({items, selectedIndex, emptyMessage}) {
    if (items.length === 0) {
        return h(
            Box,
            {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
            h(Text, {dimColor: true}, emptyMessage)
        );
    }

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        ...items.map((item, index) =>
            h(
                Box,
                {key: item.id, marginBottom: index === items.length - 1 ? 0 : 1},
                h(Text, {color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} ${item.title}`),
                h(Text, {dimColor: true}, `  ${item.description}`)
            )
        )
    );
}

export function TipPanel({title, description, detail}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', marginTop: 1},
        h(Text, {color: 'cyan', bold: true}, t('tui.tip.label')),
        h(Text, {bold: true}, title || t('tui.noDescription')),
        h(Text, {dimColor: true}, description || t('tui.noDescription')),
        h(Box, {marginTop: 1}, h(Text, {}, detail || t('tui.noDescription')))
    );
}

export function StackedSelectionPage({items, selectedIndex, emptyMessage, fallbackTitle, fallbackDescription, fallbackDetail}) {
    const item = items[selectedIndex];

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1},
        h(SelectionList, {
            items,
            selectedIndex,
            emptyMessage
        }),
        h(TipPanel, {
            title: item?.title || fallbackTitle,
            description: item?.description || fallbackDescription,
            detail: item?.detail || fallbackDetail
        })
    );
}

export function RootHeader({currentTab, columns}) {
    const headerMetaText = buildHeaderMetaText(currentTab, columns);

    return h(
        Box,
        {marginBottom: 1},
        h(
            Box,
            {},
            ...TAB_ORDER.map(tabKey =>
                h(
                    Box,
                    {key: tabKey, marginRight: 2},
                    h(Text, {color: tabKey === currentTab ? 'cyan' : 'gray'}, buildTabText(tabKey, currentTab))
                )
            )
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
