/**
 * @file RootTuiSelectionBrowser
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 为根 TUI 的插件页和管理页提供统一的响应式主从浏览布局，以列表和详情双栏呈现当前选择。
 * @logic 1. 宽终端使用左侧列表和右侧详情；2. 窄终端切换为列表与精简详情共用的单面板；3. 通过页面强调色、状态标签和字段层级突出当前选择。
 * @dependencies Libraries: react/ink, Constants: ./constants.js, Format: ./format.js
 * @index_tags 根TUI, 选择浏览, 主从布局, 响应式终端, 管理页详情
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {ROOT_TUI_COLORS} from './constants.js';
import {getContentWidth, getDisplayWidth, truncateFromRight} from './format.js';

const h = React.createElement;
const STACKED_LAYOUT_WIDTH = 76;

export function SelectionBrowserPage({
    columns,
    items,
    selectedIndex,
    emptyMessage,
    listTitle,
    listSummary,
    accentColor = ROOT_TUI_COLORS.accent
}) {
    const contentWidth = getContentWidth(columns);
    const compact = contentWidth < STACKED_LAYOUT_WIDTH;
    const sidebarWidth = Math.max(30, Math.min(32, Math.floor(contentWidth * 0.4)));
    const detailTextWidth = Math.max(20, contentWidth - sidebarWidth - 5);
    const selectedItem = items[selectedIndex] || items[0];

    if (!selectedItem) {
        return h(EmptySelectionPanel, {title: listTitle, message: emptyMessage, accentColor});
    }

    if (compact) {
        return h(CompactSelectionPanel, {
            items,
            selectedIndex,
            selectedItem,
            listTitle,
            listSummary,
            maxWidth: Math.max(20, contentWidth - 2),
            accentColor
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
                width: sidebarWidth,
                borderColor: ROOT_TUI_COLORS.border
            },
            h(PanelHeader, {title: listTitle, summary: listSummary, accentColor}),
            ...items.map((item, index) => h(SelectionListItem, {
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
                marginLeft: 1,
                borderColor: ROOT_TUI_COLORS.border
            },
            h(SelectionDetails, {item: selectedItem, maxWidth: detailTextWidth, accentColor})
        )
    );
}

export function PluginBrowserPage(props) {
    return h(SelectionBrowserPage, props);
}

function PanelHeader({title, summary, compact = false, accentColor = ROOT_TUI_COLORS.accent}) {
    return h(
        Box,
        {marginBottom: compact ? 0 : 1},
        h(Text, {bold: true, color: accentColor}, title),
        h(Spacer, {}),
        summary ? h(Text, {dimColor: true}, summary) : null
    );
}

function CompactSelectionPanel({
    items,
    selectedIndex,
    selectedItem,
    listTitle,
    listSummary,
    maxWidth,
    accentColor
}) {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: ROOT_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {title: listTitle, summary: listSummary, compact: true, accentColor}),
        ...items.map((item, index) => h(SelectionListItem, {
            key: item.id,
            item,
            selected: index === selectedIndex
        })),
        h(Text, {color: ROOT_TUI_COLORS.muted, dimColor: true}, '─'.repeat(maxWidth)),
        h(
            Box,
            {},
            h(Text, {bold: true, color: accentColor}, selectedItem.title),
            selectedItem.badge
                ? h(Text, {bold: true, color: selectedItem.badgeColor || ROOT_TUI_COLORS.success}, `  [${selectedItem.badge}]`)
                : null
        ),
        h(Text, {}, truncateFromRight(selectedItem.description || '', maxWidth)),
        ...(selectedItem.fields || []).map(field => h(
            Box,
            {key: field.label},
            h(Text, {color: field.labelColor || accentColor}, `${field.label}  `),
            h(Text, {
                color: field.valueColor,
                dimColor: field.dimColor === true
            }, truncateFromRight(field.value || '-', getFieldValueWidth(field.label, maxWidth)))
        )),
        getDetailItems(selectedItem).length
            ? h(
                Box,
                {},
                h(Text, {color: selectedItem.detailColor || ROOT_TUI_COLORS.secondary}, `${getDetailLabel(selectedItem)}  `),
                h(Text, {dimColor: true}, getDetailCountText(selectedItem))
            )
            : null
    );
}

function SelectionListItem({item, selected}) {
    const metaColor = selected
        ? (item.selectedListMetaColor || item.listMetaColor || ROOT_TUI_COLORS.warning)
        : (item.listMetaColor || ROOT_TUI_COLORS.muted);

    return h(
        Box,
        {},
        h(Text, {
            bold: selected,
            color: selected ? ROOT_TUI_COLORS.accent : ROOT_TUI_COLORS.muted
        }, selected ? '› ' : '  '),
        h(Text, {
            bold: selected,
            color: selected ? ROOT_TUI_COLORS.accent : 'white',
            dimColor: !selected
        }, item.listLabel || item.title),
        h(Spacer, {}),
        item.listMeta
            ? h(Text, {
                color: metaColor,
                dimColor: !selected && item.dimListMeta !== false
            }, item.listMeta)
            : null
    );
}

function getDetailItems(item) {
    return item.detailItems || item.features || [];
}

function getDetailLabel(item) {
    return item.detailLabel || item.featuresLabel || '';
}

function getDetailCountText(item) {
    return item.detailCountText || item.featureCountText || String(getDetailItems(item).length);
}

function getFieldValueWidth(label, maxWidth) {
    return Math.max(8, maxWidth - getDisplayWidth(label) - 2);
}

function SelectionDetails({item, maxWidth, accentColor}) {
    const detailItems = getDetailItems(item);

    return h(
        React.Fragment,
        {},
        h(
            Box,
            {},
            h(Text, {bold: true, color: accentColor}, item.title),
            item.badge
                ? h(Text, {bold: true, color: item.badgeColor || ROOT_TUI_COLORS.success}, `  [${item.badge}]`)
                : null
        ),
        h(Text, {}, truncateFromRight(item.description || '', maxWidth)),
        h(
            Box,
            {flexDirection: 'column', marginTop: 1},
            ...(item.fields || []).map(field => h(
                Box,
                {key: field.label},
                h(Text, {color: field.labelColor || accentColor}, `${field.label}  `),
                h(Text, {
                    color: field.valueColor,
                    dimColor: field.dimColor === true
                }, truncateFromRight(field.value || '-', getFieldValueWidth(field.label, maxWidth)))
            ))
        ),
        detailItems.length
            ? h(
                Box,
                {flexDirection: 'column', marginTop: 1},
                h(Text, {bold: true, color: item.detailColor || ROOT_TUI_COLORS.secondary}, getDetailLabel(item)),
                ...detailItems.map((detail, index) => h(
                    Text,
                    {key: `${item.id}-feature-${index}`, color: ROOT_TUI_COLORS.muted},
                    `• ${truncateFromRight(detail, maxWidth - 2)}`
                ))
            )
            : null
    );
}

function EmptySelectionPanel({title, message, accentColor}) {
    return h(
        Box,
        {
            borderStyle: 'round',
            borderColor: ROOT_TUI_COLORS.border,
            paddingX: 1,
            flexDirection: 'column',
            flexGrow: 1
        },
        h(PanelHeader, {title, accentColor}),
        h(
            Box,
            {alignItems: 'center', justifyContent: 'center', flexGrow: 1},
            h(Text, {color: ROOT_TUI_COLORS.warning}, message)
        )
    );
}
