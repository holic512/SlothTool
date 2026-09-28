/**
 * @file RootTuiSelectionBrowser
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 恢复根管理器的圆角主从布局、状态徽标与字段配色，同时按真实内容高度分页。
 * @logic 宽屏左右分栏；窄屏以分隔线区分列表和摘要；保留选中项与完整详情入口。
 * @dependencies React/Ink, ./interaction.js, ./format.js, ../../i18n.js
 * @index_tags 根TUI, 主从布局, 状态徽标, 终端边界
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {t} from '../../i18n.js';
import {ROOT_TUI_COLORS as colors} from './constants.js';
import {getContentWidth, getDisplayWidth, truncateFromRight as clip} from './format.js';
import {getListWindow} from './interaction.js';

const h = React.createElement;
const STACKED_LAYOUT_WIDTH = 76;

function panelHeader(title, summary, width, color) {
    const meta = clip(summary || '', Math.floor(width / 2));
    return h(Box, {height: 1, flexShrink: 0},
        h(Text, {bold: true, color}, clip(title, width - getDisplayWidth(meta) - (meta ? 1 : 0))),
        h(Spacer), meta ? h(Text, {dimColor: true}, meta) : null);
}

function listRows(items, selectedIndex, capacity, width) {
    const window = getListWindow(items.length, selectedIndex, capacity);
    const rows = items.slice(window.start, window.end).map((item, index) => {
        const selected = window.start + index === window.selected;
        const meta = clip(item.listMeta || '', Math.floor(width / 2));
        return h(Box, {key: item.id, height: 1, flexShrink: 0},
            h(Text, {color: selected ? colors.accent : 'white', bold: selected, dimColor: !selected},
                clip(`${selected ? '› ' : '  '}${item.listLabel || item.title}`, width - getDisplayWidth(meta) - (meta ? 1 : 0))),
            h(Spacer),
            meta ? h(Text, {
                color: selected ? item.selectedListMetaColor || item.listMetaColor || colors.warning : item.listMetaColor || colors.muted,
                dimColor: !selected && item.dimListMeta !== false
            }, meta) : null);
    });
    return {rows, window};
}

function previewRows(item, width, capacity, accentColor) {
    const badge = item.badge ? clip(`[${item.badge}]`, Math.floor(width / 2)) : '';
    const rows = [h(Box, {key: 'title', height: 1, flexShrink: 0},
        h(Text, {bold: true, color: accentColor}, clip(item.title, width - getDisplayWidth(badge) - (badge ? 2 : 0))),
        badge ? h(Text, {bold: true, color: item.badgeColor || colors.success}, `  ${badge}`) : null)];
    if (item.description) rows.push(h(Text, {key: 'description', wrap: 'truncate-end'}, clip(item.description, width)));
    if (capacity >= 8) rows.push(h(Text, {key: 'gap'}, ''));
    for (const [index, field] of (item.fields || []).entries()) {
        const label = clip(field.label, Math.floor(width / 2));
        rows.push(h(Box, {key: `field-${index}`, height: 1, flexShrink: 0},
            h(Text, {color: field.labelColor || accentColor}, `${label}  `),
            h(Text, {color: field.valueColor, dimColor: field.dimColor === true},
                clip(String(field.value ?? '-'), Math.max(1, width - getDisplayWidth(label) - 2)))));
    }
    const details = item.detailItems || item.features || (item.detail ? [item.detail] : []);
    if (details.length) {
        if (capacity >= rows.length + 3) rows.push(h(Text, {key: 'detail-gap'}, ''));
        const label = item.detailLabel || item.featuresLabel;
        if (label) rows.push(h(Text, {key: 'detail-title', color: item.detailColor || colors.secondary, bold: true}, clip(label, width)));
        rows.push(...details.map((line, index) => h(Text, {key: `detail-${index}`, dimColor: true, wrap: 'truncate-end'}, `• ${clip(line, width - 2)}`)));
    }
    return rows.slice(0, Math.max(0, capacity));
}

function indicator(window, width, details = false) {
    return h(Text, {dimColor: true}, clip(`${window.count ? window.selected + 1 : 0}/${window.count}${details ? ` · ${t('tui.detail.openHint')}` : ''}`, width));
}

export function SelectionBrowserPage({columns, contentHeight = 16, items, selectedIndex,
    emptyMessage, emptyAction, listTitle, listSummary, accentColor = colors.accent}) {
    const contentWidth = getContentWidth(columns);
    const compact = contentWidth < STACKED_LAYOUT_WIDTH;
    const height = Math.max(4, contentHeight);
    const selected = Math.min(Math.max(0, Number.isInteger(selectedIndex) ? selectedIndex : 0), Math.max(0, items.length - 1));
    const item = items[selected];
    const panel = {borderStyle: 'round', borderColor: colors.border, paddingX: 1,
        flexDirection: 'column', height, flexShrink: 0};
    if (!item) return h(Box, panel,
        panelHeader(listTitle, '', contentWidth - 4, accentColor),
        h(Box, {flexGrow: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center'},
            h(Text, {color: colors.warning, wrap: 'truncate-end'}, clip(emptyMessage, contentWidth - 4)),
            emptyAction ? h(Text, {color: colors.accent, wrap: 'truncate-end'}, clip(emptyAction, contentWidth - 4)) : null));
    if (compact) {
        const width = Math.max(1, contentWidth - 4);
        const capacity = Math.max(1, Math.min(items.length, Math.ceil((height - 6) / 2)));
        const list = listRows(items, selected, capacity, width);
        const preview = Math.max(0, height - 5 - list.rows.length);
        return h(Box, panel,
            panelHeader(listTitle, listSummary, width, accentColor), ...list.rows,
            preview ? h(Text, {color: colors.muted}, '─'.repeat(width)) : null,
            ...previewRows(item, width, preview, accentColor),
            h(Spacer), indicator(list.window, width, true));
    }
    const sidebarWidth = Math.max(30, Math.min(32, Math.floor(contentWidth * 0.4)));
    const detailWidth = contentWidth - sidebarWidth - 1;
    const gap = height >= 10 ? 1 : 0;
    const list = listRows(items, selected, height - 4 - gap, sidebarWidth - 4);
    return h(Box, {flexDirection: 'row', height},
        h(Box, {...panel, width: sidebarWidth},
            h(Box, {marginBottom: gap}, panelHeader(listTitle, listSummary, sidebarWidth - 4, accentColor)),
            ...list.rows, h(Spacer), indicator(list.window, sidebarWidth - 4)),
        h(Box, {...panel, marginLeft: 1, width: detailWidth},
            ...previewRows(item, detailWidth - 4, height - 3, accentColor), h(Spacer),
            h(Text, {dimColor: true}, clip(t('tui.detail.openHint'), detailWidth - 4))));
}

export function PluginBrowserPage(props) {
    return h(SelectionBrowserPage, props);
}
