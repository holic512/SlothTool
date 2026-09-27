/**
 * @file RootTuiLayout
 * @project SlothTool
 * @module Core CLI / TUI Layout
 * @description 提供根 TUI 固定高度外壳、按阶段变化的底栏和占用内容区的帮助、确认及完整详情视图。
 * @logic 1. 窄屏页头只显示当前页；2. 状态与按键各占一行；3. 详情按内容高度分页，确认明确显示目标与移除范围。
 * @dependencies Libraries: react/ink, Interaction: ./interaction.js, Format: ./format.js, I18N: ../../i18n.js
 * @index_tags 根TUI, 页头, 状态栏, 快捷键, 详情翻阅, 卸载确认
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../i18n.js';
import {ROOT_TUI_COLORS, TAB_ORDER} from './constants.js';
import {buildHeaderMetaText, buildTabText, getContentWidth, getDisplayWidth, HEADER_TAB_SEPARATOR, truncateFromRight} from './format.js';
import {getListWindow, wrapText} from './interaction.js';

const h = React.createElement;

export function RootHeader({currentTab, columns}) {
    const width = getContentWidth(columns);
    const tabStrip = TAB_ORDER.map(tabKey => buildTabText(tabKey, currentTab)).join(HEADER_TAB_SEPARATOR);
    const compact = getDisplayWidth(tabStrip) > width;
    const label = compact
        ? `${buildTabText(currentTab, currentTab)}  ${TAB_ORDER.indexOf(currentTab) + 1}/${TAB_ORDER.length}`
        : tabStrip;
    const meta = compact ? '' : buildHeaderMetaText(currentTab, columns);
    return h(
        Box,
        {height: 1},
        h(Text, {color: ROOT_TUI_COLORS.accent, bold: true}, truncateFromRight(
            meta ? `${label}  ${meta}` : label,
            width
        ))
    );
}

export function RootFooter({statusColor, statusText, keys, columns}) {
    const width = getContentWidth(columns);
    return h(
        Box,
        {flexDirection: 'column', height: 2},
        h(Text, {color: statusColor}, truncateFromRight(statusText.replace(/\s+/gu, ' '), width)),
        h(Text, {dimColor: true}, truncateFromRight(keys, width))
    );
}

export function HelpPanel({height, columns}) {
    const width = getContentWidth(columns);
    const lines = [t('tui.help.title'), ...t('tui.help.lines')];
    return h(
        Box,
        {flexDirection: 'column', height},
        ...lines.slice(0, height).map((line, index) => h(
            Text,
            {key: index, bold: index === 0},
            truncateFromRight(line, width)
        ))
    );
}

export function DetailPanel({title, lines, scroll, height, columns}) {
    const width = Math.max(1, getContentWidth(columns) - 4);
    const wrapped = lines.flatMap(line => wrapText(line, width));
    const capacity = Math.max(1, height - 4);
    const maxScroll = Math.max(0, wrapped.length - capacity);
    const offset = Math.min(Math.max(0, scroll), maxScroll);
    return h(
        Box,
        {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', height},
        h(Text, {bold: true, color: ROOT_TUI_COLORS.accent}, truncateFromRight(title, width)),
        ...wrapped.slice(offset, offset + capacity).map((line, index) => h(
            Text,
            {key: `${offset}-${index}`},
            line
        )),
        h(Text, {dimColor: true}, t('tui.detail.position', {
            from: wrapped.length ? offset + 1 : 0,
            to: Math.min(wrapped.length, offset + capacity),
            total: wrapped.length
        }))
    );
}

export function getDetailScrollLimit(lines, columns, height) {
    const width = Math.max(1, getContentWidth(columns) - 4);
    const count = lines.flatMap(line => wrapText(line, width)).length;
    return Math.max(0, count - Math.max(1, height - 4));
}

export function ConfirmPanel({action, input, height, columns}) {
    const width = getContentWidth(columns);
    const scopeLines = wrapText(`${t('tui.confirm.scope')}: ${action.scope}`, width);
    const lines = [
        t('tui.confirm.title'),
        `${t('tui.confirm.target')}: ${action.target}`,
        ...scopeLines,
        action.kind === 'uninstall-all'
            ? t('tui.confirm.typePrompt', {input: input || '_'})
            : t('tui.confirm.pluginPrompt')
    ];
    return h(
        Box,
        {flexDirection: 'column', height},
        ...lines.slice(0, height).map((line, index) => h(
            Text,
            {key: index, color: index === 0 || action.kind === 'uninstall-all' ? ROOT_TUI_COLORS.warning : 'white', bold: index === 0},
            truncateFromRight(line, width)
        ))
    );
}

export function ResizePanel({columns, rows, busy = false}) {
    const width = Math.max(1, columns - 2);
    return h(
        Box,
        {flexDirection: 'column', height: rows, paddingX: 1},
        h(Text, {color: ROOT_TUI_COLORS.warning}, truncateFromRight(t('tui.resize.title'), width)),
        rows > 1 ? h(Text, {}, truncateFromRight(t('tui.resize.hint'), width)) : null,
        rows > 2 ? h(Text, {dimColor: true}, truncateFromRight(
            busy ? t('tui.footer.busy') : t('tui.footer.quitKey'),
            width
        )) : null
    );
}

export function FeedbackPage({entries, selectedIndex, height, columns}) {
    const width = getContentWidth(columns);
    const count = entries.length;
    const window = getListWindow(count, selectedIndex, Math.max(1, height - 4));
    return h(
        Box,
        {borderStyle: 'round', borderColor: ROOT_TUI_COLORS.border, paddingX: 1, flexDirection: 'column', height},
        h(Text, {bold: true, color: ROOT_TUI_COLORS.accent}, truncateFromRight(t('tui.feedback.title'), width - 4)),
        ...entries.slice(window.start, window.end).map((entry, index) => h(
            Text,
            {key: entry.id, color: window.start + index === window.selected ? ROOT_TUI_COLORS.accent : 'white'},
            truncateFromRight(`${window.start + index === window.selected ? '› ' : '  '}${entry.label} · ${t(`tui.status.phases.${entry.phase}`)}`, width - 4)
        )),
        count
            ? h(Text, {dimColor: true}, t('tui.feedback.position', {current: window.selected + 1, total: count}))
            : h(Text, {dimColor: true}, t('tui.feedback.empty'))
    );
}
