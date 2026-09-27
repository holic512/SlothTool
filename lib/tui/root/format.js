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
import {getDisplayWidth, truncateFromLeft, truncateFromRight} from '../shared-interaction.js';
export {getDisplayWidth, truncateFromLeft, truncateFromRight} from '../shared-interaction.js';

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
