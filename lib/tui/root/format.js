/**
 * @file RootTuiFormat
 * @project SlothTool
 * @module Core CLI / TUI Formatting
 * @description 封装根 TUI 尺寸计算、顶部元信息和状态颜色等纯格式化逻辑。
 * @logic 1. 根据终端尺寸生成布局约束；2. 截断版本和路径元信息；3. 根据任务状态与实时反馈级别解析状态栏颜色。
 * @dependencies Constants: ./constants.js, I18N: ../../i18n.js
 * @index_tags 根TUI, 格式化, 终端宽度, 状态颜色, header
 * @author holic512
 */

import rootPackage from '../../../package.json' with {type: 'json'};
import {t} from '../../i18n.js';
import {ROOT_TUI_COLORS, TAB_ORDER} from './constants.js';

export const HEADER_TAB_SEPARATOR = ' | ';
const MIN_HEADER_PATH_WIDTH = 8;

export function getContentWidth(columns = process.stdout.columns) {
    return Math.max(0, (columns || 80) - 2);
}

export function getViewportHeight(rows = process.stdout.rows) {
    return rows || 24;
}

export function buildDividerLine(columns) {
    return '─'.repeat(getContentWidth(columns));
}

export function getDisplayWidth(text) {
    return Array.from(text).reduce((width, character) => {
        const code = character.codePointAt(0);
        if (code < 0x20 || (code >= 0x7F && code < 0xA0) || (code >= 0x300 && code <= 0x36F)) {
            return width;
        }
        const fullWidth = code >= 0x1100 && (
            code <= 0x115F
            || (code >= 0x2E80 && code <= 0xA4CF && code !== 0x303F)
            || (code >= 0xAC00 && code <= 0xD7A3)
            || (code >= 0xF900 && code <= 0xFAFF)
            || (code >= 0xFE10 && code <= 0xFE6F)
            || (code >= 0xFF00 && code <= 0xFF60)
            || (code >= 0xFFE0 && code <= 0xFFE6)
            || (code >= 0x1F300 && code <= 0x1FAFF)
        );
        return width + (fullWidth ? 2 : 1);
    }, 0);
}

export function truncateFromLeft(text, maxWidth) {
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(text) <= maxWidth) {
        return text;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(text).reverse()) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result = `${character}${result}`;
        width += characterWidth;
    }

    return `${ellipsis}${result}`;
}

export function truncateFromRight(text, maxWidth) {
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(text) <= maxWidth) {
        return text;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(text)) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result += character;
        width += characterWidth;
    }

    return `${result}${ellipsis}`;
}

export function buildTabText(tabKey, currentTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === currentTab ? `[${label}]` : label;
}

export function buildHeaderMetaText(currentTab, columns) {
    const versionText = `「v${rootPackage.version}」`;
    const tabStripText = TAB_ORDER.map(tabKey => buildTabText(tabKey, currentTab)).join(HEADER_TAB_SEPARATOR);
    const availableWidth = Math.max(0, getContentWidth(columns) - getDisplayWidth(tabStripText) - 2);

    if (availableWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(versionText) > availableWidth) {
        return '';
    }

    const pathWrapperWidth = getDisplayWidth('「」');
    const pathWidth = availableWidth - getDisplayWidth(versionText) - 2 - pathWrapperWidth;
    if (pathWidth < MIN_HEADER_PATH_WIDTH) {
        return versionText;
    }

    const pathText = truncateFromLeft(process.cwd(), pathWidth);
    return pathText ? `${versionText}  「${pathText}」` : versionText;
}

export function resolveStatusColor(mode, tone, hasConfirmAction) {
    if (hasConfirmAction) {
        return ROOT_TUI_COLORS.warning;
    }

    if (mode === 'preparing' || mode === 'running' || mode === 'success' || mode === 'partial' || mode === 'failure') {
        if (mode === 'failure' || tone === 'error') {
            return ROOT_TUI_COLORS.danger;
        }

        if (mode === 'partial' || tone === 'warn') {
            return ROOT_TUI_COLORS.warning;
        }

        return mode === 'preparing' || mode === 'running' ? ROOT_TUI_COLORS.accent : ROOT_TUI_COLORS.success;
    }

    return ROOT_TUI_COLORS.success;
}
