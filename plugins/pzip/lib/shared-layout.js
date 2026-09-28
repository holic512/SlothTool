/**
 * @file SharedTuiLayout
 * @project SlothTool
 * @module TUI / Packaged Layout Components
 * @description 保持高亮标签、圆角详情与底栏的统一外壳，并为内容保留精确的终端行数。
 * @logic 页头与底栏固定占位；内容按预算分页；详情在窗口变化时重新换行。
 * @dependencies React/Ink, ./shared-interaction.js
 * @index_tags TUI, 布局, 终端边界, 独立打包
 * @author holic512
 */

import React from 'react';
import {Box, Spacer, Text} from 'ink';
import {getDetailWindow, getDisplayWidth, truncateFromRight} from './shared-interaction.js';

const h = React.createElement;

export function TuiRow({left, right = '', width, color, rightColor, bold = false, dimColor = false}) {
    const meta = truncateFromRight(right, Math.floor(width / 2));
    const label = truncateFromRight(left, Math.max(1, width - getDisplayWidth(meta) - (meta ? 1 : 0)));
    const gap = Math.max(0, width - getDisplayWidth(label) - getDisplayWidth(meta));
    return h(Text, {wrap: 'truncate-end'},
        h(Text, {color, bold, dimColor}, label), ' '.repeat(gap),
        h(Text, {color: rightColor, dimColor}, meta));
}

export function TuiPanel({title, summary, badge, badgeColor = 'greenBright', width, height, children,
    accent = 'cyanBright', border = 'gray'}) {
    return h(Box, {width, height, flexShrink: 0, borderStyle: 'round', borderColor: border,
        paddingX: 1, flexDirection: 'column'},
    h(TuiRow, {left: title, right: badge ? `[${badge}]` : summary, width: width - 4,
        color: accent, rightColor: badge ? badgeColor : 'gray', bold: true}),
    h(Box, {height: Math.max(1, height - 3), flexShrink: 0, flexDirection: 'column', overflow: 'hidden'}, children));
}

export function TuiHeader({tabs, activeTab, width, meta = '', accent = 'cyanBright'}) {
    const labels = tabs.map(tab => tab.id === activeTab ? `[${tab.label}]` : tab.label);
    const stripWidth = getDisplayWidth(labels.join(' | '));
    if (stripWidth > width) {
        const index = Math.max(0, tabs.findIndex(tab => tab.id === activeTab));
        return h(Text, {bold: true, color: accent, wrap: 'truncate-end'},
            truncateFromRight(`${labels[index]}  ${index + 1}/${tabs.length}`, width));
    }
    return h(Box, {height: 1, width, flexShrink: 0},
        ...tabs.flatMap((tab, index) => [
            index ? h(Text, {key: `${tab.id}-separator`, color: 'gray'}, ' | ') : null,
            h(Text, {key: tab.id, bold: tab.id === activeTab, color: tab.id === activeTab ? accent : 'gray'}, labels[index])
        ]),
        h(Spacer),
        meta && getDisplayWidth(meta) + stripWidth + 2 <= width
            ? h(Text, {dimColor: true, wrap: 'truncate-end'}, meta) : null);
}

export function TuiFooter({layout, color = 'greenBright'}) {
    const {contentWidth, statusText, keyText, footerRows, inverseFooter} = layout;
    return h(Box, {width: contentWidth, height: footerRows, flexShrink: 0, flexDirection: footerRows === 1 ? 'row' : 'column'},
        h(Text, {color, wrap: 'truncate-end'}, truncateFromRight(statusText, footerRows === 1 ? Math.max(1, contentWidth - getDisplayWidth(keyText) - 2) : contentWidth)),
        footerRows === 1 ? h(Spacer) : null,
        h(Text, {dimColor: !inverseFooter, inverse: inverseFooter, wrap: 'truncate-end'}, keyText));
}

export function TuiFrame({layout, header, statusColor, children}) {
    return h(Box, {
        width: layout.width, height: layout.height, flexDirection: 'column', paddingX: 1,
        paddingY: layout.paddingY
    },
    h(Box, {height: 1, flexShrink: 0}, header),
    h(Box, {height: 1, flexShrink: 0, marginBottom: layout.gap},
        h(Text, {color: 'gray'}, '─'.repeat(layout.contentWidth))),
    h(Box, {height: layout.contentHeight, flexShrink: 0, flexDirection: 'column', overflow: 'hidden'}, children),
    h(Box, {marginTop: layout.gap, flexShrink: 0}, h(TuiFooter, {layout, color: statusColor})));
}

export function TuiDetails({title, lines, scroll = 0, width, height, accent = 'cyanBright', border = 'gray'}) {
    const view = getDetailWindow(lines, scroll, width, height);
    return h(Box, {height, width, flexShrink: 0, borderStyle: 'round', borderColor: border,
        paddingX: 1, flexDirection: 'column'},
    h(Text, {bold: true, color: accent, wrap: 'truncate-end'}, truncateFromRight(title, width - 4)),
    ...view.lines.map((line, index) => h(Text, {key: view.offset + index, wrap: 'truncate-end'}, line)),
    h(Spacer),
    h(Text, {dimColor: true, wrap: 'truncate-end'}, `${view.total ? view.offset + 1 : 0}–${Math.min(view.total, view.offset + view.capacity)}/${view.total}`));
}
