/**
 * @file RootTuiRunPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 插件运行页的详细插件列表和精简底部提示。
 * @logic 1. 在列表区展示插件名称、作用、来源、包名和版本；2. 将选中箭头固定在左侧栏；3. 底部仅保留执行 tip。
 * @dependencies Libraries: react/ink, I18N: ../../../i18n.js
 * @index_tags 根TUI, 运行页, 插件详情列表, 精简tip
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';

const h = React.createElement;

export function RunPage({items, selectedIndex}) {
    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1},
        h(RunPluginList, {
            items,
            selectedIndex,
            emptyMessage: t('tui.run.empty')
        }),
        h(RunTipPanel, {
            item: items[selectedIndex]
        })
    );
}

function RunPluginList({items, selectedIndex, emptyMessage}) {
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
            h(RunPluginListItem, {
                key: item.id,
                item,
                selected: index === selectedIndex,
                last: index === items.length - 1
            })
        )
    );
}

function RunPluginListItem({item, selected, last}) {
    return h(
        Box,
        {flexDirection: 'column', marginBottom: last ? 0 : 1},
        h(
            Box,
            {flexDirection: 'row'},
            h(Box, {width: 2}, h(Text, {color: selected ? 'cyan' : undefined}, selected ? '>' : ' ')),
            h(
                Text,
                {color: selected ? 'cyan' : undefined},
                `${t('tui.run.fields.name')}: ${item.title}  ${t('tui.run.fields.version')}: ${item.version}`
            )
        ),
        h(Box, {marginLeft: 2}, h(Text, {}, `${t('tui.run.fields.purpose')}: ${item.purpose}`)),
        h(
            Box,
            {marginLeft: 2},
            h(Text, {dimColor: true}, `${t('tui.run.fields.source')}: ${item.source}  ${t('tui.run.fields.package')}: ${item.packageName}`)
        )
    );
}

function RunTipPanel({item}) {
    const command = item?.alias ? `slothtool ${item.alias}` : 'slothtool <plugin>';

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 0, marginTop: 1},
        h(Text, {color: 'cyan', bold: true}, `${t('tui.tip.label')}: `),
        h(Text, {dimColor: true}, t('tui.run.tip', {command}))
    );
}
