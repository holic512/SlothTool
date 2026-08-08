/**
 * @file ImageCompressTuiModel
 * @project SlothTool
 * @module Image Compress Plugin / TUI Model
 * @description 为 image-compress TUI 提供 Ink 无关的响应式布局、批处理洞察、分页和终端文本宽度能力。
 * @logic 1. 根据终端宽高决定双栏、堆叠、详情密度与分页大小；2. 从 Go 批处理结果聚合实际或预演节省量、问题项和高收益文件；3. 提供中英文宽字符安全截断。
 * @dependencies Node: path
 * @index_tags 图片压缩TUI, 响应式布局, 批处理洞察, 节省空间, 终端宽度, 选项分页
 * @author holic512
 */

import path from 'node:path';

export const IMAGE_COMPRESS_TUI_COLORS = Object.freeze({
    accent: 'cyanBright',
    secondary: 'magentaBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    border: 'gray'
});

const COMPACT_WIDTH = 82;
const SHORT_HEIGHT = 20;

function normalizeDimension(value, fallback, minimum) {
    const parsedValue = Number.parseInt(value, 10);
    return Math.max(minimum, Number.isInteger(parsedValue) ? parsedValue : fallback);
}

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

export function getDisplayWidth(text = '') {
    return Array.from(String(text)).reduce((width, character) => (
        width + (isFullWidthCodePoint(character.codePointAt(0)) ? 2 : 1)
    ), 0);
}

function truncateText(text, maxWidth, fromLeft) {
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

    const characters = Array.from(normalizedText);
    const orderedCharacters = fromLeft ? characters.reverse() : characters;
    let result = '';
    let width = 0;

    for (const character of orderedCharacters) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result = fromLeft ? `${character}${result}` : `${result}${character}`;
        width += characterWidth;
    }

    return fromLeft ? `${ellipsis}${result}` : `${result}${ellipsis}`;
}

export function truncateFromLeft(text, maxWidth) {
    return truncateText(text, maxWidth, true);
}

export function truncateFromRight(text, maxWidth) {
    return truncateText(text, maxWidth, false);
}

export function resolveImageCompressTuiLayout(columns = 100, rows = 24) {
    const terminalColumns = normalizeDimension(columns, 100, 24);
    const terminalRows = normalizeDimension(rows, 24, 10);
    const contentWidth = Math.max(20, terminalColumns - 4);
    const compact = contentWidth < COMPACT_WIDTH;
    const short = terminalRows < SHORT_HEIGHT;
    const optionPageSize = compact
        ? (short ? 4 : 5)
        : Math.max(5, Math.min(9, terminalRows - 12));
    const sidebarWidth = Math.max(30, Math.min(36, Math.floor(contentWidth * 0.35)));
    const showRunResult = !compact || terminalRows >= 28;

    return {
        columns: terminalColumns,
        rows: terminalRows,
        viewportHeight: terminalRows,
        contentWidth,
        compact,
        short,
        sidebarWidth,
        detailTextWidth: compact
            ? Math.max(18, contentWidth - 6)
            : Math.max(24, contentWidth - sidebarWidth - 7),
        targetLimit: short ? 2 : (compact ? 3 : 5),
        resultLimit: short ? 0 : (compact ? 1 : 3),
        historyLimit: short ? 2 : Math.max(3, Math.min(6, terminalRows - 16)),
        optionPageSize,
        showRunResult,
        showOptionDetail: !short,
        compactFooter: contentWidth < COMPACT_WIDTH,
        microFooter: contentWidth < 38,
        tooSmall: terminalColumns < 30 || terminalRows < 14
    };
}

function numberValue(source, key) {
    const value = Number(source?.[key] ?? source?.[`${key[0].toLowerCase()}${key.slice(1)}`]);
    return Number.isFinite(value) ? value : 0;
}

function stringValue(source, key) {
    return String(source?.[key] ?? source?.[`${key[0].toLowerCase()}${key.slice(1)}`] ?? '');
}

export function buildCompressionInsights(summary) {
    if (!summary) {
        return null;
    }

    const results = Array.isArray(summary.Results)
        ? summary.Results
        : (Array.isArray(summary.results) ? summary.results : []);
    const normalizedResults = results.map(result => ({
        inputPath: stringValue(result, 'InputPath'),
        outputPath: stringValue(result, 'OutputPath'),
        status: stringValue(result, 'Status') || 'unknown',
        error: stringValue(result, 'Error'),
        originalBytes: numberValue(result, 'OriginalBytes'),
        resultBytes: numberValue(result, 'ResultBytes'),
        bytesSaved: numberValue(result, 'BytesSaved'),
        compressionRatio: numberValue(result, 'CompressionRatio'),
        format: stringValue(result, 'Format'),
        width: numberValue(result, 'Width'),
        height: numberValue(result, 'Height'),
        outputWidth: numberValue(result, 'OutputWidth'),
        outputHeight: numberValue(result, 'OutputHeight')
    }));
    const preview = normalizedResults.some(result => result.status === 'dry_run');
    const originalBytes = normalizedResults.reduce((total, result) => total + Math.max(0, result.originalBytes), 0);
    const resultBytes = normalizedResults.reduce((total, result) => total + Math.max(0, result.resultBytes), 0);
    const estimatedSavedBytes = normalizedResults.reduce((total, result) => total + Math.max(0, result.bytesSaved), 0);
    const persistedSavedBytes = numberValue(summary, 'SavedBytes');
    const savedBytes = preview ? estimatedSavedBytes : Math.max(persistedSavedBytes, estimatedSavedBytes);
    const savingRate = originalBytes > 0 ? savedBytes / originalBytes : 0;
    const topSavings = normalizedResults
        .filter(result => result.bytesSaved > 0)
        .sort((left, right) => right.bytesSaved - left.bytesSaved || left.inputPath.localeCompare(right.inputPath));
    const issues = normalizedResults.filter(result => (
        result.status !== 'success'
        && result.status !== 'dry_run'
        && (result.error || result.status !== 'unknown')
    ));

    return {
        totalFiles: numberValue(summary, 'TotalFiles') || normalizedResults.length,
        successCount: numberValue(summary, 'SuccessCount'),
        skippedCount: numberValue(summary, 'SkippedCount'),
        failedCount: numberValue(summary, 'FailedCount'),
        savedBytes,
        originalBytes,
        resultBytes,
        savingRate,
        preview,
        cancelled: Boolean(summary.Cancelled ?? summary.cancelled),
        results: normalizedResults,
        topSavings,
        issues
    };
}

export function getVisibleOptionPage(items, selectedIndex, pageSize) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedPageSize = Math.max(1, Number.parseInt(pageSize, 10) || 1);
    const maximumIndex = Math.max(0, normalizedItems.length - 1);
    const safeSelectedIndex = Math.min(maximumIndex, Math.max(0, Number.parseInt(selectedIndex, 10) || 0));
    const pageCount = Math.max(1, Math.ceil(normalizedItems.length / normalizedPageSize));
    const pageIndex = Math.floor(safeSelectedIndex / normalizedPageSize);
    const startIndex = pageIndex * normalizedPageSize;

    return {
        items: normalizedItems.slice(startIndex, startIndex + normalizedPageSize),
        selectedIndex: safeSelectedIndex,
        localSelectedIndex: safeSelectedIndex - startIndex,
        pageIndex,
        pageCount,
        startIndex
    };
}

export function formatBytes(size) {
    const numericSize = Number(size);
    if (!Number.isFinite(numericSize)) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Math.abs(numericSize);
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const sign = numericSize < 0 ? '-' : '';
    return unitIndex === 0
        ? `${sign}${Math.round(value)} ${units[unitIndex]}`
        : `${sign}${value.toFixed(1)} ${units[unitIndex]}`;
}

export function getPathLabel(filePath) {
    return path.basename(filePath || '') || filePath || '-';
}
