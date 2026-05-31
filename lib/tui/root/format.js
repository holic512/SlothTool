/**
 * @file RootTuiFormat
 * @project SlothTool
 * @module Core CLI / TUI Formatting
 * @description 封装根 TUI 宽度计算、顶部元信息和状态颜色等纯格式化逻辑。
 * @logic 1. 根据终端宽度生成分隔线；2. 截断版本和路径元信息；3. 根据任务状态解析状态栏颜色。
 * @dependencies Constants: ./constants.js, I18N: ../../i18n.js
 * @index_tags 根TUI, 格式化, 终端宽度, 状态颜色, header
 * @author holic512
 */

import rootPackage from '../../../package.json' with {type: 'json'};
import {t} from '../../i18n.js';
import {TAB_ORDER} from './constants.js';

export function getContentWidth() {
    return Math.max(24, (process.stdout.columns || 80) - 4);
}

export function buildDividerLine() {
    return '─'.repeat(getContentWidth());
}

export function getDisplayWidth(text) {
    return Array.from(text).reduce((width, character) => (
        width + (character.codePointAt(0) > 0xFF ? 2 : 1)
    ), 0);
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

export function buildTabText(tabKey, currentTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === currentTab ? `[${label}]` : label;
}

export function buildHeaderMetaText(currentTab) {
    const versionText = `v${rootPackage.version}`;
    const tabStripText = TAB_ORDER.map(tabKey => buildTabText(tabKey, currentTab)).join('  ');
    const availableWidth = Math.max(0, getContentWidth() - getDisplayWidth(tabStripText) - 2);

    if (availableWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(versionText) >= availableWidth) {
        return truncateFromLeft(versionText, availableWidth);
    }

    const pathWidth = availableWidth - getDisplayWidth(versionText) - 2;
    const pathText = truncateFromLeft(process.cwd(), pathWidth);
    return pathText ? `${versionText}  ${pathText}` : versionText;
}

export function resolveStatusColor(mode, tone, hasConfirmAction) {
    if (hasConfirmAction) {
        return 'yellow';
    }

    if (mode === 'progress') {
        return 'cyan';
    }

    if (mode === 'result') {
        if (tone === 'error') {
            return 'red';
        }

        if (tone === 'warn') {
            return 'yellow';
        }

        return 'green';
    }

    return 'green';
}
