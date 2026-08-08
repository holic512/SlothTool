/**
 * @file LocTuiModel
 * @project SlothTool
 * @module LOC Plugin / TUI Model
 * @description 为 loc TUI 提供 Ink 无关的响应式布局计算、统计洞察聚合和目录输入规范化能力。
 * @logic 1. 根据终端宽高决定双栏、堆叠、分页与明细密度；2. 按扩展名聚合文件数和行数并选出热点文件；3. 规范化粘贴或拖入的带引号目录路径。
 * @dependencies Node: path
 * @index_tags loc TUI, 响应式布局, 统计洞察, 扩展名分布, 热点文件, 路径输入
 * @author holic512
 */

import path from 'node:path';

export const LOC_TUI_COLORS = Object.freeze({
    accent: 'cyanBright',
    secondary: 'magentaBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    border: 'gray'
});

const COMPACT_WIDTH = 76;
const SHORT_HEIGHT = 22;

function isFullWidthCodePoint(codePoint) {
    return codePoint >= 0x1100 && (
        codePoint <= 0x115F
        || codePoint === 0x2329
        || codePoint === 0x232A
        || (codePoint >= 0x2E80 && codePoint <= 0x303E)
        || (codePoint >= 0x3040 && codePoint <= 0x3247)
        || (codePoint >= 0x3250 && codePoint <= 0x4DBF)
        || (codePoint >= 0x4E00 && codePoint <= 0xA4C6)
        || (codePoint >= 0xA960 && codePoint <= 0xA97C)
        || (codePoint >= 0xAC00 && codePoint <= 0xD7A3)
        || (codePoint >= 0xF900 && codePoint <= 0xFAFF)
        || (codePoint >= 0xFE10 && codePoint <= 0xFE19)
        || (codePoint >= 0xFE30 && codePoint <= 0xFE6B)
        || (codePoint >= 0xFF01 && codePoint <= 0xFF60)
        || (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
        || (codePoint >= 0x1B000 && codePoint <= 0x1B001)
        || (codePoint >= 0x1F200 && codePoint <= 0x1F251)
        || (codePoint >= 0x20000 && codePoint <= 0x3FFFD)
    );
}

function normalizeDimension(value, fallback, minimum) {
    const parsedValue = Number.parseInt(value, 10);
    return Math.max(minimum, Number.isInteger(parsedValue) ? parsedValue : fallback);
}

export function getDisplayWidth(text = '') {
    return Array.from(String(text)).reduce((width, character) => (
        width + (isFullWidthCodePoint(character.codePointAt(0)) ? 2 : 1)
    ), 0);
}

export function truncateFromLeft(text, maxWidth) {
    const normalizedText = String(text || '');
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(normalizedText) <= maxWidth) {
        return normalizedText;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(normalizedText).reverse()) {
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
    const normalizedText = String(text || '');
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(normalizedText) <= maxWidth) {
        return normalizedText;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(normalizedText)) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result += character;
        width += characterWidth;
    }

    return `${result}${ellipsis}`;
}

export function resolveLocTuiLayout(columns = 80, rows = 24) {
    const terminalColumns = normalizeDimension(columns, 80, 24);
    const terminalRows = normalizeDimension(rows, 24, 10);
    const contentWidth = Math.max(20, terminalColumns - 4);
    const compact = contentWidth < COMPACT_WIDTH;
    const short = terminalRows < SHORT_HEIGHT;
    const pageReservedRows = compact ? (short ? 10 : 18) : 12;
    const pageSize = Math.max(3, Math.min(compact ? 8 : 12, terminalRows - pageReservedRows));
    const sidebarWidth = Math.max(30, Math.min(34, Math.floor(contentWidth * 0.38)));

    return {
        columns: terminalColumns,
        rows: terminalRows,
        viewportHeight: terminalRows,
        contentWidth,
        compact,
        short,
        pageSize,
        sidebarWidth,
        detailTextWidth: compact
            ? Math.max(20, contentWidth - 4)
            : Math.max(20, contentWidth - sidebarWidth - 5),
        extensionLimit: short ? 2 : (compact ? 3 : 4),
        topFileLimit: short ? 0 : (compact
            ? (terminalRows >= 30 ? 2 : 0)
            : Math.max(2, Math.min(5, terminalRows - 22))),
        showConfigDetail: !compact || !short,
        compactFooter: contentWidth < 68,
        microFooter: contentWidth < 34,
        tooSmall: terminalColumns < 30 || terminalRows < 14
    };
}

function normalizeExtension(filePath) {
    return path.extname(filePath).slice(1).toLowerCase();
}

export function buildResultInsights(result) {
    if (!result) {
        return null;
    }

    const extensionMap = new Map();
    const files = Array.isArray(result.files) ? result.files : [];

    for (const file of files) {
        const extension = normalizeExtension(file.path);
        const current = extensionMap.get(extension) || {
            extension,
            fileCount: 0,
            lineCount: 0
        };
        current.fileCount += 1;
        current.lineCount += Number(file.lines) || 0;
        extensionMap.set(extension, current);
    }

    const extensions = [...extensionMap.values()].sort((left, right) => (
        right.lineCount - left.lineCount
        || right.fileCount - left.fileCount
        || left.extension.localeCompare(right.extension)
    ));
    const topFiles = files
        .map(file => ({
            path: path.relative(result.resolvedDir, file.path) || path.basename(file.path),
            lines: Number(file.lines) || 0
        }))
        .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));

    return {
        fileCount: Number(result.fileCount) || 0,
        lineCount: Number(result.lineCount) || 0,
        averageLines: result.fileCount > 0 ? Math.round(result.lineCount / result.fileCount) : 0,
        warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
        extensions,
        topFiles
    };
}

export function buildDistributionBar(value, maximum, width = 10) {
    const barWidth = Math.max(3, Number.parseInt(width, 10) || 10);
    const safeMaximum = Math.max(0, Number(maximum) || 0);
    const safeValue = Math.max(0, Number(value) || 0);
    const filledWidth = safeMaximum > 0
        ? Math.max(1, Math.round((safeValue / safeMaximum) * barWidth))
        : 0;

    return `${'█'.repeat(Math.min(barWidth, filledWidth))}${'░'.repeat(Math.max(0, barWidth - filledWidth))}`;
}

export function getConfigCounts(items) {
    const normalizedItems = Array.isArray(items) ? items : [];
    return {
        enabled: normalizedItems.filter(item => item.enabled).length,
        total: normalizedItems.length
    };
}

export function getExtensionImpact(result, extensionName) {
    const insights = buildResultInsights(result);
    if (!insights) {
        return null;
    }

    return insights.extensions.find(item => item.extension === extensionName) || {
        extension: extensionName,
        fileCount: 0,
        lineCount: 0
    };
}

export function normalizeDirectoryInput(input) {
    let normalizedInput = String(input || '').trim();

    if (
        normalizedInput.length >= 2
        && (
            (normalizedInput.startsWith('"') && normalizedInput.endsWith('"'))
            || (normalizedInput.startsWith("'") && normalizedInput.endsWith("'"))
        )
    ) {
        normalizedInput = normalizedInput.slice(1, -1);
    }

    return normalizedInput.replace(/\\ /gu, ' ') || '.';
}
