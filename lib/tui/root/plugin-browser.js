/**
 * @file RootTuiPluginBrowser
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 为运行页和安装页提供统一的响应式插件浏览布局，以列表和详情双栏呈现插件信息。
 * @logic 1. 宽终端使用左侧列表和右侧详情；2. 窄终端切换为列表与精简详情共用的单面板；3. 通过状态色、选中标记和信息层级突出当前插件。
 * @dependencies Libraries: react/ink, Format: ./format.js
 * @index_tags 根TUI, 插件浏览, 主从布局, 响应式终端, 插件详情
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {getContentWidth, truncateFromRight} from './format.js';

const h = React.createElement;
const STACKED_LAYOUT_WIDTH = 76;

export function PluginBrowserPage({
    columns,
    items,
    selectedIndex,
    emptyMessage,
    listTitle,
    listSummary
}) {
    const contentWidth = getContentWidth(columns);
    const compact = contentWidth < STACKED_LAYOUT_WIDTH;
    const sidebarWidth = Math.max(30, Math.min(32, Math.floor(contentWidth * 0.4)));
    const detailTextWidth = Math.max(20, contentWidth - sidebarWidth - 5);
    const selectedItem = items[selectedIndex] || items[0];

    if (!selectedItem) {
        return h(EmptyPluginPanel, {title: listTitle, message: emptyMessage});
    }

    if (compact) {
        return h(CompactPluginPanel, {
            items,
            selectedIndex,
            selectedItem,
            listTitle,
            listSummary,
            maxWidth: Math.max(20, contentWidth - 4)
        });
    }

    return h(
        Box,
        {flexDirection: 'row', flexGrow: 1},
        h(
            Box,
            {
                borderStyle: 'round',
                paddingX: 1,
                flexDirection: 'column',
                width: sidebarWidth
            },
            h(PanelHeader, {title: listTitle, summary: listSummary}),
            ...items.map((item, index) => h(PluginListItem, {
                key: item.id,
                item,
                selected: index === selectedIndex
            }))
        ),
        h(
            Box,
            {
                borderStyle: 'round',
                paddingX: 1,
                flexDirection: 'column',
                flexGrow: 1,
                marginLeft: 1
            },
            h(PluginDetails, {item: selectedItem, maxWidth: detailTextWidth})
        )
    );
}

function PanelHeader({title, summary, compact = false}) {
    return h(
        Box,
        {marginBottom: compact ? 0 : 1},
        h(Text, {bold: true, color: 'cyan'}, title),
        h(Spacer, {}),
        summary ? h(Text, {dimColor: true}, summary) : null
    );
}

function CompactPluginPanel({items, selectedIndex, selectedItem, listTitle, listSummary, maxWidth}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: listTitle, summary: listSummary, compact: true}),
        ...items.map((item, index) => h(PluginListItem, {
            key: item.id,
            item,
            selected: index === selectedIndex
        })),
        h(Text, {color: 'gray', dimColor: true}, '─'.repeat(maxWidth)),
        h(
            Box,
            {},
            h(Text, {bold: true, color: 'cyan'}, selectedItem.title),
            selectedItem.badge
                ? h(Text, {bold: true, color: selectedItem.badgeColor || 'green'}, `  [${selectedItem.badge}]`)
                : null
        ),
        h(Text, {}, truncateFromRight(selectedItem.description || '', maxWidth)),
        ...(selectedItem.fields || []).map(field => h(
            Box,
            {key: field.label},
            h(Text, {color: 'cyan'}, `${field.label}  `),
            h(Text, {dimColor: field.dimColor === true}, truncateFromRight(field.value || '-', maxWidth - 8))
        )),
        selectedItem.features?.length
            ? h(
                Box,
                {},
                h(Text, {color: 'magenta'}, `${selectedItem.featuresLabel}  `),
                h(Text, {dimColor: true}, selectedItem.featureCountText)
            )
            : null
    );
}

function PluginListItem({item, selected}) {
    return h(
        Box,
        {},
        h(Text, {bold: selected, color: selected ? 'cyan' : 'gray'}, selected ? '› ' : '  '),
        h(Text, {bold: selected, color: selected ? 'cyan' : undefined}, item.title),
        h(Spacer, {}),
        item.listMeta
            ? h(Text, {color: selected ? 'yellow' : 'gray', dimColor: !selected}, item.listMeta)
            : null
    );
}

function PluginDetails({item, maxWidth}) {
    return h(
        React.Fragment,
        {},
        h(
            Box,
            {},
            h(Text, {bold: true, color: 'cyan'}, item.title),
            item.badge
                ? h(Text, {bold: true, color: item.badgeColor || 'green'}, `  [${item.badge}]`)
                : null
        ),
        h(Text, {}, truncateFromRight(item.description || '', maxWidth)),
        h(
            Box,
            {flexDirection: 'column', marginTop: 1},
            ...(item.fields || []).map(field => h(
                Box,
                {key: field.label},
                h(Text, {color: 'cyan'}, `${field.label}  `),
                h(Text, {dimColor: field.dimColor === true}, truncateFromRight(field.value || '-', maxWidth - 8))
            ))
        ),
        item.features?.length
            ? h(
                Box,
                {flexDirection: 'column', marginTop: 1},
                h(Text, {bold: true, color: 'magenta'}, item.featuresLabel),
                ...item.features.map((feature, index) => h(
                    Text,
                    {key: `${item.id}-feature-${index}`, color: 'gray'},
                    `• ${truncateFromRight(feature, maxWidth - 2)}`
                ))
            )
            : null
    );
}

function EmptyPluginPanel({title, message}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title}),
        h(
            Box,
            {alignItems: 'center', justifyContent: 'center', flexGrow: 1},
            h(Text, {color: 'yellow'}, message)
        )
    );
}
