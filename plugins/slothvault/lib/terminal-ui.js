/**
 * @file terminal-ui.js
 * @project SlothTool
 * @module SlothVault terminal presentation
 * @description Shared high-contrast frame and measured progress formatting for manager and MCP pages.
 * @logic Follow terminal foreground colors, invert focused selections and constrain every panel to its viewport.
 * @dependencies React/Ink, shared terminal interaction, i18n
 * @index_tags slothvault,tui,contrast,progress,viewport
 * @author holic512
 */
import React from 'react';
import {Box, Text, Spacer} from 'ink';
import {getDetailWindow, getDisplayWidth, truncateFromRight} from './shared-interaction.js';
import {t} from './i18n.js';
const h = React.createElement;
export const COLORS = {accent: undefined, secondary: undefined, border: undefined, muted: undefined, success: 'green', warning: 'yellow', danger: 'red'};
export function TuiHeader({tabs, activeTab, width, meta = ''}) {
    const length = getDisplayWidth(tabs.map(tab => tab.label).join(' | ')) + 2;
    if (length > width) return h(Text, {bold: true, inverse: true, wrap: 'truncate-end'}, truncateFromRight(tabs.find(tab => tab.id === activeTab)?.label || '', width));
    return h(Box, {width, height: 1, flexShrink: 0},
        ...tabs.flatMap((tab, index) => [index ? h(Text, {key: tab.id + '-separator'}, ' | ') : null,
            h(Text, {key: tab.id, bold: tab.id === activeTab, inverse: tab.id === activeTab}, tab.id === activeTab ? `[${tab.label}]` : tab.label)]),
        h(Spacer), length + getDisplayWidth(meta) + 2 <= width ? h(Text, {}, meta) : null);
}
export function TuiFrame({layout, header, children, statusColor}) {
    return h(Box, {width: layout.width, height: layout.height, flexDirection: 'column', paddingX: 1, paddingY: layout.paddingY},
        h(Box, {height: 1, flexShrink: 0}, header),
        h(Box, {height: 1, flexShrink: 0, marginBottom: layout.gap}, h(Text, {}, '─'.repeat(layout.contentWidth))),
        h(Box, {height: layout.contentHeight, flexShrink: 0, flexDirection: 'column', overflow: 'hidden'}, children),
        h(Box, {height: layout.footerRows, marginTop: layout.gap, flexShrink: 0, flexDirection: layout.footerRows === 1 ? 'row' : 'column'},
            h(Text, {color: statusColor, wrap: 'truncate-end'}, truncateFromRight(layout.statusText, layout.footerRows === 1 ? Math.max(1, layout.contentWidth - getDisplayWidth(layout.keyText) - 2) : layout.contentWidth)),
            layout.footerRows === 1 ? h(Spacer) : null,
            h(Text, {inverse: true, wrap: 'truncate-end'}, layout.keyText)));
}
export function TuiDetails({title, lines, scroll = 0, width, height, focused = false}) {
    const view = getDetailWindow(lines, scroll, width, height);
    return h(Box, {width, height, flexShrink: 0, borderStyle: 'round', paddingX: 1, flexDirection: 'column'},
        height >= 4 ? h(Text, {bold: true, inverse: focused, wrap: 'truncate-end'}, truncateFromRight(title, width - 4)) : null,
        ...view.lines.map((line, index) => h(Text, {key: view.offset + index, wrap: 'truncate-end'}, line)),
        h(Spacer), height >= 5 ? h(Text, {wrap: 'truncate-end'}, `${view.total ? view.offset + 1 : 0}–${Math.min(view.total, view.offset + view.capacity)}/${view.total}`) : null);
}
export function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '-';
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    let value = Math.max(0, bytes), index = 0;
    while (value >= 1024 && index < units.length - 1) {value /= 1024; index++;}
    return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
}
export function progressLines(task, now = Date.now()) {
    if (!task) return [];
    const event = task.progress || {};
    const phaseKey = 'workspace.phases.' + event.phase;
    const translated = t(phaseKey);
    const lines = [t('workspace.task', {state: t('workspace.taskStates.' + task.state)}),
        t('workspace.elapsed', {seconds: Math.max(0, Math.floor(((task.finishedAt || now) - task.startedAt) / 1000))})];
    if (event.phase) lines.push(t('workspace.phase', {phase: translated === phaseKey ? event.phase : translated}) +
        (['running', 'completed', 'failed'].includes(event.status) ? ' · ' + t('workspace.taskStates.' + event.status) : '') +
        (task.phaseStartedAt ? ` (${Math.max(0, Math.floor(((task.finishedAt || now) - task.phaseStartedAt) / 1000))}s)` : ''));
    if (event.stageCount > 0 && event.stageIndex >= 0) lines.push(t('workspace.steps', {current: event.stageIndex, total: event.stageCount}));
    if (event.subject) lines.push(event.subject);
    if (Number.isFinite(event.current) && event.current >= 0) {
        const amount = value => event.unit === 'bytes' ? formatBytes(value) : String(value);
        const known = Number.isFinite(event.total) && event.total > 0 && event.current <= event.total;
        lines.push(`${amount(event.current)}${known ? ' / ' + amount(event.total) : ''}${event.unit === 'items' ? ' ' + t('workspace.items') : ''}`);
        if (known) {
            const fraction = event.current / event.total;
            lines.push('[' + '█'.repeat(Math.floor(fraction * 16)) + '░'.repeat(16 - Math.floor(fraction * 16)) + `] ${Math.floor(fraction * 100)}%`);
        }
        if (event.unit === 'bytes' && event.speed > 0) lines.push(formatBytes(event.speed) + '/s');
    }
    if (event.message) lines.push(event.message);
    if (task.error) lines.push('! ' + task.error);
    if (task.result) lines.push(task.result);
    return lines;
}
