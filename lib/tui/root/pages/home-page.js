/**
 * @file RootTuiHomePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 居中展示原版多阶段 Logo 动画、当前目录和最近插件快捷入口。
 * @logic 1. 从中心展开低亮轮廓；2. 以斜向高亮带显现青紫 logo；3. 使用纵向微光完成收束，同一 TUI 会话仅播放一次；4. 小窗口收起 Logo 并对快捷入口开窗。
 * @dependencies Libraries: react/ink, Constants: ../constants.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 首页, logo, Ink页面
 * @author holic512
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';
import {
    HOME_ART,
    HOME_LOGO_ANIMATION_INTERVAL_MS,
    HOME_LOGO_ANIMATION_STEP,
    HOME_LOGO_INTRO_FRAMES,
    HOME_LOGO_REVEAL_EDGE_WIDTH,
    HOME_LOGO_SETTLE_FRAMES
} from '../constants.js';

import {getDisplayWidth, truncateFromLeft, truncateFromRight} from '../../shared-interaction.js';
import {getListWindow} from '../interaction.js';

const h = React.createElement;
const HOME_LOGO_WIDTH = Math.max(...HOME_ART.map(line => line.length));
const HOME_LOGO_SCAN_DISTANCE = HOME_LOGO_WIDTH
    + Math.ceil(HOME_ART.length * 0.75)
    + HOME_LOGO_REVEAL_EDGE_WIDTH;
const HOME_LOGO_SCAN_FRAMES = Math.ceil(HOME_LOGO_SCAN_DISTANCE / HOME_LOGO_ANIMATION_STEP);
const HOME_LOGO_FRAME_COUNT = HOME_LOGO_INTRO_FRAMES
    + HOME_LOGO_SCAN_FRAMES
    + HOME_LOGO_SETTLE_FRAMES;
const shouldSkipLogoAnimation = () => Boolean(process.env.SLOTHTOOL_TUI_TEST_ACTION);
let hasStartedHomeAnimation = false;

function getBaseLogoColor(rowIndex) {
    return rowIndex < 5 ? 'magenta' : 'cyan';
}

function getInitialAnimationFrame() {
    if (shouldSkipLogoAnimation() || hasStartedHomeAnimation) {
        return HOME_LOGO_FRAME_COUNT;
    }

    hasStartedHomeAnimation = true;
    return 0;
}

function getAnimationState(animationFrame) {
    if (animationFrame < HOME_LOGO_INTRO_FRAMES) {
        return {phase: 'intro', frame: animationFrame};
    }

    if (animationFrame < HOME_LOGO_INTRO_FRAMES + HOME_LOGO_SCAN_FRAMES) {
        return {
            phase: 'scan',
            frame: animationFrame - HOME_LOGO_INTRO_FRAMES
        };
    }

    if (animationFrame < HOME_LOGO_FRAME_COUNT) {
        return {
            phase: 'settle',
            frame: animationFrame - HOME_LOGO_INTRO_FRAMES - HOME_LOGO_SCAN_FRAMES
        };
    }

    return {phase: 'complete', frame: HOME_LOGO_SETTLE_FRAMES};
}

function getHighlightColor(rowIndex) {
    return rowIndex < 5 ? 'yellow' : 'white';
}

function getIntroCellStyle({char, columnIndex, rowIndex, phaseFrame}) {
    if (char === ' ') {
        return {char, color: getBaseLogoColor(rowIndex), dimColor: true, bold: false};
    }

    const centerColumn = (HOME_LOGO_WIDTH - 1) / 2;
    const centerRow = (HOME_ART.length - 1) / 2;
    const maxDistance = centerColumn + centerRow * 1.5;
    const revealDistance = maxDistance * ((phaseFrame + 1) / HOME_LOGO_INTRO_FRAMES);
    const cellDistance = Math.abs(columnIndex - centerColumn) + Math.abs(rowIndex - centerRow) * 1.5;
    const distanceFromFront = revealDistance - cellDistance;

    if (distanceFromFront < 0) {
        return {char: ' ', color: getBaseLogoColor(rowIndex), dimColor: true, bold: false};
    }

    const atRevealFront = distanceFromFront < 3;
    return {
        char: atRevealFront ? '▒' : '░',
        color: atRevealFront ? getHighlightColor(rowIndex) : getBaseLogoColor(rowIndex),
        dimColor: !atRevealFront,
        bold: atRevealFront
    };
}

function getScanCellStyle({char, columnIndex, rowIndex, phaseFrame}) {
    if (char === ' ') {
        return {char, color: getBaseLogoColor(rowIndex), dimColor: false, bold: false};
    }

    const scanColumn = (phaseFrame + 1) * HOME_LOGO_ANIMATION_STEP;
    const cellPosition = columnIndex + rowIndex * 0.75;
    const distanceFromFront = scanColumn - cellPosition;

    if (distanceFromFront < 0) {
        return {
            char: '░',
            color: getBaseLogoColor(rowIndex),
            dimColor: true,
            bold: false
        };
    }

    if (distanceFromFront < 2) {
        return {
            char,
            color: getHighlightColor(rowIndex),
            dimColor: false,
            bold: true
        };
    }

    if (distanceFromFront < HOME_LOGO_REVEAL_EDGE_WIDTH) {
        return {
            char,
            color: getBaseLogoColor(rowIndex),
            dimColor: false,
            bold: true
        };
    }

    return {
        char,
        color: getBaseLogoColor(rowIndex),
        dimColor: false,
        bold: false
    };
}

function getSettledCellStyle({char, rowIndex, phaseFrame}) {
    const highlightRow = phaseFrame - 1;
    const highlighted = Math.abs(rowIndex - highlightRow) < 0.75;
    const settled = rowIndex < highlightRow;

    return {
        char,
        color: highlighted && char !== ' ' ? getHighlightColor(rowIndex) : getBaseLogoColor(rowIndex),
        dimColor: false,
        bold: highlighted || settled
    };
}

function getCellStyle({char, columnIndex, rowIndex, animationState}) {
    if (animationState.phase === 'intro') {
        return getIntroCellStyle({
            char,
            columnIndex,
            rowIndex,
            phaseFrame: animationState.frame
        });
    }

    if (animationState.phase === 'scan') {
        return getScanCellStyle({
            char,
            columnIndex,
            rowIndex,
            phaseFrame: animationState.frame
        });
    }

    if (animationState.phase === 'settle') {
        return getSettledCellStyle({char, rowIndex, phaseFrame: animationState.frame});
    }

    return {
        char,
        color: getBaseLogoColor(rowIndex),
        dimColor: false,
        bold: true
    };
}

function createLogoSegments(line, rowIndex, animationState) {
    const paddedLine = line.padEnd(HOME_LOGO_WIDTH, ' ');
    const segments = [];

    for (const [columnIndex, char] of [...paddedLine].entries()) {
        const cellStyle = getCellStyle({
            char,
            columnIndex,
            rowIndex,
            animationState
        });
        const previousSegment = segments[segments.length - 1];

        if (
            previousSegment &&
            previousSegment.color === cellStyle.color &&
            previousSegment.dimColor === cellStyle.dimColor &&
            previousSegment.bold === cellStyle.bold
        ) {
            previousSegment.text += cellStyle.char;
        } else {
            segments.push({
                text: cellStyle.char,
                color: cellStyle.color,
                dimColor: cellStyle.dimColor,
                bold: cellStyle.bold
            });
        }
    }

    return segments;
}

function HomeLogo() {
    const [animationFrame, setAnimationFrame] = useState(getInitialAnimationFrame);
    const isAnimationComplete = animationFrame >= HOME_LOGO_FRAME_COUNT;
    const animationState = getAnimationState(animationFrame);
    const logoLines = useMemo(
        () => HOME_ART.map((line, rowIndex) => createLogoSegments(
            line,
            rowIndex,
            animationState
        )),
        [animationState.frame, animationState.phase]
    );

    useEffect(() => {
        if (isAnimationComplete) {
            return undefined;
        }

        const interval = setInterval(() => {
            setAnimationFrame(currentFrame => Math.min(
                HOME_LOGO_FRAME_COUNT,
                currentFrame + 1
            ));
        }, HOME_LOGO_ANIMATION_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [isAnimationComplete]);

    return h(Box, {flexDirection: 'column'},
        ...logoLines.map((segments, rowIndex) => h(Box, {key: rowIndex},
            ...segments.map((segment, index) => h(Text, {
                key: index, color: segment.color, bold: segment.bold, dimColor: segment.dimColor
            }, segment.text)))));
}

export function getHomeLayout(columns, contentHeight, itemCount, selectedIndex) {
    const width = Math.max(1, columns - 2);
    const showArt = width >= HOME_LOGO_WIDTH && contentHeight >= HOME_ART.length + itemCount + 3;
    const logoHeight = showArt ? HOME_ART.length : 1;
    const gap = contentHeight >= logoHeight + itemCount + 4 ? 1 : 0;
    const capacity = Math.max(1, contentHeight - logoHeight - gap - 2);
    return {width, showArt, gap, window: getListWindow(itemCount, selectedIndex, capacity)};
}

export function HomePage({items = [], selectedIndex = 0, columns = 80, contentHeight = 16, cwd = process.cwd()}) {
    const layout = getHomeLayout(columns, contentHeight, items.length, selectedIndex);
    const directoryLabel = `${t('tui.home.cwd')}: `;
    const blockWidth = Math.min(layout.width, Math.max(HOME_LOGO_WIDTH,
        ...items.map(item => getDisplayWidth(item.title) + 2)));
    return h(Box, {height: contentHeight, flexDirection: 'column', alignItems: 'center', justifyContent: 'center'},
        layout.showArt ? h(HomeLogo) : h(Text, {bold: true, color: 'cyanBright'}, 'SlothTool'),
        h(Box, {marginTop: layout.gap, width: blockWidth, flexDirection: 'column'},
            h(Text, {dimColor: true, wrap: 'truncate-end'}, directoryLabel + truncateFromLeft(cwd,
                Math.max(1, blockWidth - getDisplayWidth(directoryLabel)))),
            ...items.slice(layout.window.start, layout.window.end).map((item, index) => {
                const selected = layout.window.start + index === layout.window.selected;
                return h(Text, {key: item.id, color: selected ? 'cyanBright' : undefined,
                    bold: selected, wrap: 'truncate-end'},
                truncateFromRight(`${selected ? '› ' : '  '}${item.title}`, blockWidth));
            }),
            h(Text, {dimColor: true, wrap: 'truncate-end'}, truncateFromRight(t('tui.home.actionHint'), blockWidth))));
}
