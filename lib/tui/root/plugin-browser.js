/**
 * @file RootTuiSelectionBrowser
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 以统一高度预算渲染根 TUI 列表与详情，保证选中项、分页信息和详情入口始终可见。
 * @logic 1. 宽屏双栏、窄屏单栏；2. 两种布局都按内容高度切出包含选中项的列表窗口；3. 截断预览并指向可翻阅完整详情。
 * @dependencies Libraries: react/ink, Interaction: ./interaction.js, Format: ./format.js
 * @index_tags 根TUI, 选择浏览, 高度预算, 列表分页, 详情预览
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../i18n.js';
import {ROOT_TUI_COLORS} from './constants.js';
import {getContentWidth, truncateFromRight} from './format.js';
import {buildItemDetailLines, getListWindow, wrapText} from './interaction.js';

const h = React.createElement;
const STACKED_LAYOUT_WIDTH = 76;

function panelHeader(title, summary, width, color) {
    return h(Text, {bold: true, color}, truncateFromRight(
        summary ? `${title} · ${summary}` : title,
        width
    ));
}

function listRows(items, selectedIndex, capacity, width) {
    const window = getListWindow(items.length, selectedIndex, capacity);
    const rows = items.slice(window.start, window.end).map((item, localIndex) => {
        const selected = window.start + localIndex === window.selected;
        const label = `${selected ? '› ' : '  '}${item.listLabel || item.title}`;
        const meta = item.listMeta ? `  ${item.listMeta}` : '';
        return h(Text, {
            key: item.id,
            color: selected ? ROOT_TUI_COLORS.accent : undefined,
            bold: selected,
            dimColor: !selected
        }, truncateFromRight(label + meta, width));
    });
    return {rows, window};
}

function previewRows(item, width, capacity) {
    const lines = buildItemDetailLines(item).flatMap(line => wrapText(line, width));
    return lines.slice(0, Math.max(0, capacity)).map((line, index) => h(
        Text,
        {key: `preview-${index}`, color: index === 0 ? ROOT_TUI_COLORS.accent : undefined, bold: index === 0},
        truncateFromRight(line, width)
    ));
}

function panelIndicator(window, width, showDetailHint = false) {
    const page = window.count ? `${window.selected + 1}/${window.count}` : '0/0';
    const hint = showDetailHint ? ` · ${t('tui.detail.openHint')}` : '';
    return h(Text, {dimColor: true}, truncateFromRight(`${page}${hint}`, width));
}

export function SelectionBrowserPage({
    columns,
    contentHeight = 16,
    items,
    selectedIndex,
    emptyMessage,
    listTitle,
    listSummary,
    accentColor = ROOT_TUI_COLORS.accent
}) {
    const contentWidth = getContentWidth(columns);
    const compact = contentWidth < STACKED_LAYOUT_WIDTH;
    const safeSelectedIndex = Math.min(
        Math.max(0, Number.isInteger(selectedIndex) ? selectedIndex : 0),
        Math.max(0, items.length - 1)
    );
    const selectedItem = items[safeSelectedIndex];
    const height = Math.max(4, contentHeight);

    if (!selectedItem) {
        return h(
            Box,
            {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', height},
            panelHeader(listTitle, '', Math.max(1, contentWidth - 4), accentColor),
            h(Text, {color: ROOT_TUI_COLORS.warning}, truncateFromRight(emptyMessage, Math.max(1, contentWidth - 4)))
        );
    }

    if (compact) {
        const innerHeight = height - 2;
        const innerWidth = Math.max(1, contentWidth - 4);
        const listCapacity = Math.max(1, Math.min(items.length, Math.ceil((innerHeight - 2) * 0.58)));
        const previewCapacity = Math.max(0, innerHeight - listCapacity - 2);
        const list = listRows(items, safeSelectedIndex, listCapacity, innerWidth);
        return h(
            Box,
            {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', height},
            panelHeader(listTitle, listSummary, innerWidth, accentColor),
            ...list.rows,
            ...previewRows(selectedItem, innerWidth, previewCapacity),
            panelIndicator(list.window, innerWidth, true)
        );
    }

    const sidebarWidth = Math.max(30, Math.min(34, Math.floor(contentWidth * 0.4)));
    const sidebarInnerWidth = sidebarWidth - 4;
    const detailWidth = contentWidth - sidebarWidth - 1;
    const detailInnerWidth = Math.max(1, detailWidth - 4);
    const list = listRows(items, safeSelectedIndex, height - 4, sidebarInnerWidth);

    return h(
        Box,
        {flexDirection: 'row', height},
        h(
            Box,
            {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', width: sidebarWidth, height},
            panelHeader(listTitle, listSummary, sidebarInnerWidth, accentColor),
            ...list.rows,
            panelIndicator(list.window, sidebarInnerWidth)
        ),
        h(
            Box,
            {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', marginLeft: 1, width: detailWidth, height},
            ...previewRows(selectedItem, detailInnerWidth, height - 3),
            h(Text, {dimColor: true}, truncateFromRight(t('tui.detail.openHint'), detailInnerWidth))
        )
    );
}

export function PluginBrowserPage(props) {
    return h(SelectionBrowserPage, props);
}
