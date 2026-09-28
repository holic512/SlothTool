/**
 * @file SharedTuiInteraction
 * @project SlothTool
 * @module TUI / Packaged Interaction Primitives
 * @description 根管理器维护的字素显示与单行编辑纯函数，由脚本同步进官方插件发行包。
 * @logic 计算外壳预算与详情窗口；按字素计算单元格宽度；编辑状态以字素光标推进；视窗始终显示光标并保留完整原值。
 * @dependencies Node.js Intl.Segmenter
 * @index_tags TUI, 字素, Unicode, 输入编辑, 独立打包
 * @author holic512
 */

// This is the maintained source. Run `npm run sync:tui-interaction` after changes.
const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});

export function graphemes(value) {
    return Array.from(segmenter.segment(String(value ?? '')), part => part.segment);
}

function isWideCodePoint(code) {
    return code >= 0x1100 && (
        code <= 0x115f || code === 0x2329 || code === 0x232a
        || code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f
        || code >= 0xac00 && code <= 0xd7a3
        || code >= 0xf900 && code <= 0xfaff
        || code >= 0xfe10 && code <= 0xfe6f
        || code >= 0xff01 && code <= 0xff60
        || code >= 0xffe0 && code <= 0xffe6
        || code >= 0x1b000 && code <= 0x1faff
        || code >= 0x20000 && code <= 0x3fffd
    );
}

export function graphemeWidth(grapheme) {
    if (!grapheme) return 0;
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme)) return 2;
    let width = 0;
    for (const character of grapheme) {
        const code = character.codePointAt(0);
        if (code < 0x20 || code >= 0x7f && code < 0xa0 || code === 0x200d
            || /\p{Mark}/u.test(character) || /\p{Emoji_Modifier}/u.test(character)) continue;
        width = Math.max(width, isWideCodePoint(code) ? 2 : 1);
    }
    return width;
}

export function getDisplayWidth(value) {
    return graphemes(value).reduce((width, grapheme) => width + graphemeWidth(grapheme), 0);
}

export function truncateText(value, maxWidth, side = 'right') {
    const text = String(value ?? '');
    const width = Math.max(0, Math.floor(maxWidth));
    if (!width) return '';
    if (getDisplayWidth(text) <= width) return text;
    const dots = '.'.repeat(Math.min(3, width));
    if (width <= 3) return dots;
    const parts = graphemes(text);
    let content = '';
    let used = 3;
    const ordered = side === 'left' ? parts.reverse() : parts;
    for (const part of ordered) {
        const size = graphemeWidth(part);
        if (used + size > width) break;
        content = side === 'left' ? part + content : content + part;
        used += size;
    }
    return side === 'left' ? dots + content : content + dots;
}

export function truncateFromLeft(value, maxWidth) {
    return truncateText(value, maxWidth, 'left');
}

export function truncateFromRight(value, maxWidth) {
    return truncateText(value, maxWidth, 'right');
}

export function wrapText(value, maxWidth) {
    const width = Math.max(1, Math.floor(maxWidth));
    const lines = [];
    for (const source of String(value ?? '').split(/\r?\n/u)) {
        let line = '';
        let used = 0;
        let pushedWide = false;
        for (const part of graphemes(source)) {
            const size = graphemeWidth(part);
            if (size > width) {
                if (line) lines.push(line);
                lines.push('…');
                line = '';
                used = 0;
                pushedWide = true;
                continue;
            }
            if (line && used + size > width) {
                lines.push(line);
                line = '';
                used = 0;
            }
            line += part;
            used += size;
        }
        if (line || !pushedWide) lines.push(line);
    }
    return lines;
}

export function nextTabIndex(index, count, key = {}) {
    if (!count) return 0;
    return (index + (key.shift ? -1 : 1) + count) % count;
}

export function statusSymbol(mode, tone = '') {
    if (mode === 'idle') return '○';
    if (mode === 'preparing' || mode === 'running' || mode === 'progress' || mode === 'busy') return '◌';
    if (mode === 'failure' || tone === 'error' || tone === 'danger') return '✕';
    if (mode === 'partial' || tone === 'warn' || tone === 'warning') return '!';
    if (mode === 'success' || mode === 'result' || tone === 'success') return '✓';
    return '○';
}

export function editText({value = '', cursor = graphemes(value).length}, input, key = {}, maxLength = Infinity) {
    const parts = graphemes(value);
    const at = Math.max(0, Math.min(cursor, parts.length));
    const state = (nextParts, nextCursor, handled = true) => ({
        value: nextParts.join(''), cursor: nextCursor, handled
    });
    if (key.escape || key.return || key.tab || key.upArrow || key.downArrow || key.pageUp || key.pageDown) {
        return state(parts, at, false);
    }
    if (key.ctrl && String(input).toLowerCase() === 'u') return state([], 0);
    if (key.leftArrow) return state(parts, Math.max(0, at - 1));
    if (key.rightArrow) return state(parts, Math.min(parts.length, at + 1));
    if (key.home) return state(parts, 0);
    if (key.end) return state(parts, parts.length);
    if (key.backspace) {
        if (at > 0) parts.splice(at - 1, 1);
        return state(parts, Math.max(0, at - 1));
    }
    if (key.delete) {
        if (at < parts.length) parts.splice(at, 1);
        return state(parts, at);
    }
    if (key.ctrl || key.meta || !input) return state(parts, at, false);
    const addition = graphemes(String(input).replace(/[\r\n\t]/gu, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/gu, ''));
    if (!addition.length) return state(parts, at, false);
    const allowed = addition.slice(0, Math.max(0, maxLength - parts.length));
    parts.splice(at, 0, ...allowed);
    return state(parts, at + allowed.length);
}

export function editorViewport(value, cursor, maxWidth, {secret = false} = {}) {
    const raw = graphemes(value);
    const parts = secret ? raw.map(() => '●') : raw;
    const at = Math.max(0, Math.min(cursor, parts.length));
    const width = Math.max(1, Math.floor(maxWidth));
    let start = 0;
    let before = 0;
    for (let index = 0; index < at; index += 1) before += graphemeWidth(parts[index]);
    while (start < at && before + 1 + (start ? 1 : 0) > width) {
        before -= graphemeWidth(parts[start]);
        start += 1;
    }
    let visible = start && width > 1 ? '…' : '';
    let used = visible ? 1 : 0;
    for (let index = start; index <= parts.length; index += 1) {
        if (index === at) {
            if (used === width) return visible;
            visible += '█';
            used += 1;
        }
        if (index === parts.length) break;
        const size = graphemeWidth(parts[index]);
        if (used + size > width) return used < width ? visible + '…' : visible;
        visible += parts[index];
        used += size;
    }
    return visible;
}

/** Keep complete key names and the final exit/back hint when space is scarce. */
export function fitKeyHints(keys, width) {
    const text = String(keys || '').replace(/[\r\n]+/gu, ' ');
    if (getDisplayWidth(text) <= width) return text;
    const parts = text.replace(/\s+(q|Esc)(?=\s|$)/gu, ' | $1')
        .split(/\s*[|·]\s*|\s{2,}/u).filter(Boolean);
    const compact = parts.map(part => part.trim().split(/\s/u)[0]);
    const joined = compact.join(' · ');
    if (getDisplayWidth(joined) <= width) return joined;
    const exitIndex = compact.findIndex(part => /^(q|Esc)(?:$|\/)/u.test(part));
    const last = exitIndex >= 0 ? compact.splice(exitIndex, 1)[0] : compact.pop() || '';
    const visible = [];
    for (const part of compact) {
        if (getDisplayWidth([...visible, part, last].join(' · ')) <= width) visible.push(part);
    }
    return truncateFromRight([...visible, last].filter(Boolean).join(' · '), width);
}

/** Reserve the same rows for rendering, list pagination, and detail scrolling. */
export function getShellLayout(columns = 80, rows = 24, {status = '', keys = '', inverseFooter = false} = {}) {
    const width = Math.max(1, Math.floor(columns || 80));
    const height = Math.max(1, Math.floor(rows || 24));
    const contentWidth = Math.max(1, width - 2);
    const statusText = String(status).replace(/\s+/gu, ' ');
    const keyText = fitKeyHints(keys, contentWidth);
    const footerRows = inverseFooter || getDisplayWidth(statusText) + getDisplayWidth(keyText) + 2 > contentWidth ? 2 : 1;
    const paddingY = height >= 22 ? 1 : 0;
    const gap = height >= 22 ? 1 : 0;
    return {
        width, height, contentWidth, paddingY, gap, footerRows, statusText, keyText, inverseFooter,
        contentHeight: Math.max(1, height - paddingY * 2 - 2 - gap * 2 - footerRows)
    };
}

export function getDetailWindow(lines, scroll, width, height) {
    const wrapped = (lines || []).flatMap(line => wrapText(line, Math.max(1, width - 4)));
    const capacity = Math.max(1, height - 4);
    const maxScroll = Math.max(0, wrapped.length - capacity);
    const offset = Math.min(Math.max(0, scroll), maxScroll);
    return {lines: wrapped.slice(offset, offset + capacity), offset, capacity, maxScroll, total: wrapped.length};
}
