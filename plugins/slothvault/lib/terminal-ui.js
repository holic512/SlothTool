/**
 * @file terminal-ui.js
 * @project SlothTool
 * @module SlothVault terminal presentation
 * @description Shared high-contrast frame and measured progress formatting for the Deployment and Skill manager.
 * @logic Pin task state above scrollable output, distinguish labels and sections, and format only measured progress.
 * @dependencies React/Ink, shared terminal interaction, i18n
 * @index_tags slothvault,tui,contrast,progress,viewport
 * @author holic512
 */
import React from 'react';
import {Box, Text, Spacer} from 'ink';
import {getDetailWindow, getDisplayWidth, truncateFromRight} from './shared-interaction.js';
import {t} from './i18n.js';
import {taskTimes} from './task-state.js';
const h = React.createElement;
export const COLORS = {accent: 'cyanBright', secondary: 'magentaBright', border: 'gray', muted: 'gray', success: 'greenBright', warning: 'yellowBright', danger: 'redBright'};
export function taskColor(state) {
    return state === 'failed' ? COLORS.danger : ['waiting', 'partial', 'cancelled'].includes(state) ? COLORS.warning
        : ['completed', 'unchanged'].includes(state) ? COLORS.success : COLORS.accent;
}
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
export function detailWindow(lines, pinned, scroll, width, height, follow = false) {
    const count = Math.min(pinned.length, Math.max(0, height - 6));
    const remaining = height - count - (count ? 1 : 0);
    const view = getDetailWindow(lines, follow ? Number.MAX_SAFE_INTEGER : scroll, width, remaining);
    return {...view, pinned: pinned.slice(0, count)};
}
function styledLine(line, key, width, color) {
    const text = truncateFromRight(line, width);
    const match = /^([^:：]{1,28})([:：]\s*)(.*)$/u.exec(text);
    const section = text.startsWith('──');
    return h(Text, {key, color: section ? COLORS.secondary : text.startsWith('!') ? COLORS.danger : match ? undefined : color,
        bold: section, wrap: 'truncate-end'}, match
        ? [h(Text, {key: 'label', color: COLORS.accent}, `${match[1]}${match[2]}`), h(Text, {key: 'value', color: text.startsWith(t('workspace.task', {state: ''})) ? color : undefined}, match[3])] : text);
}
export function TuiDetails({title, lines, pinned = [], scroll = 0, width, height, focused = false, follow = false, state}) {
    const view = detailWindow(lines, pinned, scroll, width, height, follow);
    return h(Box, {width, height, flexShrink: 0, borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column'},
        height >= 4 ? h(Text, {bold: true, color: COLORS.accent, inverse: focused, wrap: 'truncate-end'}, truncateFromRight(title, width - 4)) : null,
        ...view.pinned.map((line, index) => styledLine(line, 'pinned-' + index, width - 4, taskColor(state))),
        view.pinned.length ? h(Text, {color: COLORS.border}, '─'.repeat(Math.max(1, width - 4))) : null,
        ...view.lines.map((line, index) => styledLine(line, view.offset + index, width - 4)),
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
    const enhanced = t('workflow.phases.' + event.phase);
    const translated = enhanced === 'workflow.phases.' + event.phase ? t(phaseKey) : enhanced;
    const times = task.activeSince !== undefined ? taskTimes(task, now) : {executionMs: (task.finishedAt ?? now) - task.startedAt, waitingMs: 0, phaseMs: task.phaseStartedAt ? (task.finishedAt ?? now) - task.phaseStartedAt : 0};
    const lines = [t('workspace.task', {state: t('workflow.states.' + task.state)}),
        t('workflow.execution', {seconds: Math.max(0, Math.floor(times.executionMs / 1000))})];
    if (times.waitingMs || task.state === 'waiting') lines.push(t('workflow.waiting', {seconds: Math.floor(times.waitingMs / 1000)}));
    if (event.phase) lines.push(t('workspace.phase', {phase: translated === phaseKey ? event.phase : translated}) +
        (['running', 'completed', 'failed'].includes(event.status) ? ' · ' + t('workspace.taskStates.' + event.status) : '') +
        ` (${Math.max(0, Math.floor(times.phaseMs / 1000))}s)`);
    if (event.stageCount > 0 && event.stageIndex >= 0) lines.push(t('workspace.steps', {current: event.stageIndex, total: event.stageCount}));
    if (event.subject) lines.push(t('workflow.layer', {subject: event.subject}));
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
    if (['running', 'verifying', 'checking'].includes(task.state) && now - task.lastProgressAt >= 30_000) lines.push(t('workflow.inactive', {
        seconds: Math.floor((now - task.lastProgressAt) / 1000), activity: t(task.lastHeartbeatAt ? 'workflow.alive' : 'workflow.unknownActivity')}));
    return lines;
}
