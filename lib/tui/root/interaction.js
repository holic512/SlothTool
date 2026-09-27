/**
 * @file RootTuiInteraction
 * @project SlothTool
 * @module Core CLI / TUI Interaction
 * @description 为根管理器统一计算终端预算、列表窗口、详情文本和当前可用按键。
 * @logic 1. 从真实终端尺寸扣除固定外壳；2. 让列表窗口始终包含选中项；3. 按视图和任务阶段生成一致的操作提示。
 * @dependencies Format: ./format.js, I18N: ../../i18n.js
 * @index_tags 根TUI, 高度预算, 列表分页, 详情, 快捷键
 * @author holic512
 */

import {t} from '../../i18n.js';
import {editText, getDisplayWidth, graphemes} from '../shared-interaction.js';
export {wrapText} from '../shared-interaction.js';

export const MIN_TERMINAL_COLUMNS = 44;
export const MIN_TERMINAL_ROWS = 11;

export function getViewportBudget(columns, rows) {
    const width = Number.isFinite(columns) && columns > 0 ? Math.floor(columns) : 80;
    const height = Number.isFinite(rows) && rows > 0 ? Math.floor(rows) : 24;
    return {
        width,
        height,
        contentWidth: Math.max(0, width - 2),
        contentHeight: Math.max(0, height - 4),
        tooSmall: width < MIN_TERMINAL_COLUMNS || height < MIN_TERMINAL_ROWS
    };
}

export function getListWindow(length, selectedIndex, capacity) {
    const size = Math.max(0, Math.floor(capacity));
    const count = Math.max(0, length);
    const selected = Math.min(Math.max(0, selectedIndex), Math.max(0, count - 1));
    const start = Math.min(
        Math.max(0, selected - Math.floor((size - 1) / 2)),
        Math.max(0, count - size)
    );
    return {start, end: Math.min(count, start + size), selected, count};
}

export function buildItemDetailLines(item) {
    if (!item) return [];
    const lines = [item.title];
    if (item.description) lines.push('', item.description);
    for (const field of item.fields || []) {
        lines.push(`${field.label}: ${field.value ?? '-'}`);
    }
    const details = item.detailItems || item.features || [];
    if (details.length) {
        lines.push('', item.detailLabel || item.featuresLabel || t('tui.detail.more'));
        lines.push(...details.map(detail => `• ${detail}`));
    } else if (item.detail) {
        lines.push('', item.detail);
    }
    return lines;
}

export function buildFeedbackDetailLines(entry) {
    if (!entry) return [];
    const lines = [entry.label, `${t('tui.feedback.outcome')}: ${t(`tui.status.phases.${entry.phase}`)}`, '', entry.message];
    if (entry.results?.length) {
        lines.push('', t('tui.feedback.targets'));
        for (const result of entry.results) {
            lines.push(`${result.title}: ${t(`tui.feedback.result.${result.status}`)}`);
            if (result.reason) lines.push(`${t('tui.feedback.reason')}: ${result.reason}`);
        }
    }
    if (entry.events?.length) {
        lines.push('', t('tui.feedback.events'));
        lines.push(...entry.events.map(event => event.message));
    }
    return lines;
}

export function getActionLabel(tab, item) {
    if (tab === 'home') return t('tui.footer.openRun');
    if (!item) return '';
    if (tab === 'run') return t('tui.footer.launchPlugin');
    if (tab === 'install') return t('tui.footer.installPlugin');
    if (tab === 'update') {
        if (item.kind === 'check-updates') return t('tui.footer.checkUpdates');
        if (item.kind === 'update-outdated') return item.actionable ? t('tui.footer.updateOutdated') : '';
        if (item.kind === 'checked-target' && item.result?.status === 'outdated') return t('tui.footer.updateTarget');
        return '';
    }
    if (tab === 'uninstall') return t('tui.footer.reviewRemoval');
    if (tab === 'settings') return t('tui.footer.applySetting');
    return '';
}

export function getFooterKeys({tab, item, view, confirmation, phase, feedbackCount = 0, columns}) {
    if (phase === 'preparing' || phase === 'running') return t('tui.footer.busy');
    if (confirmation) {
        return confirmation.kind === 'uninstall-all'
            ? t('tui.footer.confirmAll')
            : t('tui.footer.confirmPlugin');
    }
    if (view === 'help') return t('tui.footer.closeHelp');
    if (view === 'detail') return t('tui.footer.detailKeys');
    if (view === 'feedback') return t('tui.footer.feedbackKeys');
    const keys = [t('tui.footer.switchPage')];
    if (tab !== 'home' && item) keys.push(t('tui.footer.moveSelection'));
    const action = getActionLabel(tab, item);
    if (action) keys.push(`Enter ${action}`);
    if (tab !== 'home' && item) keys.push(t('tui.footer.viewDetails'));
    if (feedbackCount) keys.push(t('tui.footer.viewFeedback'));
    keys.push(t('tui.footer.helpKey'), t('tui.footer.quitKey'));
    const fullText = keys.join('  ·  ');
    const available = columns ? columns - 2 : Infinity;
    if (getDisplayWidth(fullText) <= available) return fullText;
    const compactKeys = [
        action ? `Enter ${action}` : '',
        feedbackCount ? t('tui.footer.shortFeedback') : '',
        tab !== 'home' && item ? t('tui.footer.shortDetails') : '',
        'Tab',
        '?',
        'q'
    ].filter(Boolean);
    const visible = [];
    for (const key of compactKeys) {
        const candidate = [...visible, key].join(' · ');
        if (getDisplayWidth(candidate) <= available) visible.push(key);
    }
    return visible.join(' · ');
}

export function confirmInputTransition(confirmation, currentInput, input, key = {}, currentCursor = graphemes(currentInput).length) {
    if (!confirmation) return {input: '', cursor: 0, effect: 'none'};
    if (key.escape || key.meta || input.toLowerCase() === 'n') return {input: '', cursor: 0, effect: 'cancel'};
    if (confirmation.kind !== 'uninstall-all') {
        return {input: '', cursor: 0, effect: input.toLowerCase() === 'y' ? 'execute' : 'none'};
    }
    if (key.return) {
        return {
            input: currentInput,
            cursor: currentCursor,
            effect: currentInput === 'DELETE ALL' ? 'execute' : 'none'
        };
    }
    if (input && !/^[A-Za-z ]+$/u.test(input)) return {input: currentInput, cursor: currentCursor, effect: 'none'};
    const next = editText({value: currentInput, cursor: currentCursor}, input, key, 10);
    return {input: next.value, cursor: next.cursor, effect: 'none'};
}
