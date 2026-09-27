/**
 * @file RootTuiHomePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 展示当前工作目录、最近插件及安装入口，并按终端尺寸收起大型 Logo。
 * @logic 1. 操作入口始终先于装饰；2. 最近插件最多显示三项；3. 仅在高度和宽度充足时展示完整 Logo。
 * @dependencies Libraries: react/ink, Constants: ../constants.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 首页, 最近插件, 工作目录, Logo
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';
import {HOME_ART, ROOT_TUI_COLORS} from '../constants.js';
import {getDisplayWidth, truncateFromLeft, truncateFromRight} from '../../shared-interaction.js';

const h = React.createElement;

export function HomePage({items = [], selectedIndex = 0, columns = 80, contentHeight = 16, cwd = process.cwd()}) {
    const width = Math.max(1, columns - 2);
    const selected = Math.min(Math.max(0, selectedIndex), Math.max(0, items.length - 1));
    const showArt = contentHeight >= 18 && width >= Math.max(...HOME_ART.map(getDisplayWidth));
    const maxListRows = Math.max(1, contentHeight - (showArt ? HOME_ART.length + 4 : 3));
    const listItems = items.slice(0, maxListRows);
    const directoryLabel = `${t('tui.home.cwd')}: `;
    const directory = truncateFromLeft(cwd, Math.max(1, width - getDisplayWidth(directoryLabel)));

    return h(
        Box,
        {flexDirection: 'column', height: contentHeight},
        showArt
            ? h(Box, {flexDirection: 'column'}, ...HOME_ART.map((line, index) => h(Text, {
                key: index,
                bold: true,
                color: index < 5 ? ROOT_TUI_COLORS.secondary : ROOT_TUI_COLORS.accent
            }, line)))
            : h(Text, {bold: true, color: ROOT_TUI_COLORS.accent}, 'SlothTool'),
        h(Text, {dimColor: true}, truncateFromRight(`${directoryLabel}${directory}`, width)),
        h(Text, {bold: true}, t(items[0]?.kind === 'open-install' ? 'tui.home.emptyTitle' : 'tui.home.recentTitle')),
        ...listItems.map((item, index) => h(Text, {
            key: item.id,
            bold: index === selected,
            color: index === selected ? ROOT_TUI_COLORS.accent : undefined
        }, truncateFromRight(`${index === selected ? '› ' : '  '}${item.title}`, width))),
        h(Text, {dimColor: true}, truncateFromRight(t('tui.home.actionHint'), width))
    );
}
