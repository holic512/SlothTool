/**
 * @file RootTuiHomePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 首页的扫描显现 SlothTool logo 和入口提示。
 * @logic 1. 居中展示填充式 logo；2. 首次进入时斜向扫描显现并最终定格；3. 按 logo 分段上色并显示入口提示。
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
    HOME_LOGO_REVEAL_EDGE_WIDTH
} from '../constants.js';

const h = React.createElement;
const HOME_LOGO_WIDTH = Math.max(...HOME_ART.map(line => line.length));
const HOME_LOGO_FRAME_COUNT = Math.ceil((HOME_LOGO_WIDTH + HOME_ART.length) / HOME_LOGO_ANIMATION_STEP);
const shouldSkipLogoAnimation = () => Boolean(process.env.SLOTHTOOL_TUI_TEST_ACTION);

function getBaseLogoColor(rowIndex) {
    return rowIndex < 5 ? 'magenta' : 'cyan';
}

function getCellStyle({char, columnIndex, rowIndex, scanColumn, isComplete}) {
    if (isComplete) {
        return {
            char,
            color: getBaseLogoColor(rowIndex),
            dimColor: false
        };
    }

    const diagonalColumn = scanColumn - rowIndex;
    const distanceFromEdge = diagonalColumn - columnIndex;

    if (distanceFromEdge < 0) {
        return {
            char: char === ' ' ? ' ' : '░',
            color: getBaseLogoColor(rowIndex),
            dimColor: true
        };
    }

    if (distanceFromEdge < HOME_LOGO_REVEAL_EDGE_WIDTH && char !== ' ') {
        return {
            char,
            color: rowIndex < 5 ? 'yellow' : 'white',
            dimColor: false
        };
    }

    return {
        char,
        color: getBaseLogoColor(rowIndex),
        dimColor: false
    };
}

function createLogoSegments(line, rowIndex, scanColumn, isComplete) {
    const paddedLine = line.padEnd(HOME_LOGO_WIDTH, ' ');
    const segments = [];

    for (const [columnIndex, char] of [...paddedLine].entries()) {
        const cellStyle = getCellStyle({
            char,
            columnIndex,
            rowIndex,
            scanColumn,
            isComplete
        });
        const previousSegment = segments[segments.length - 1];

        if (
            previousSegment &&
            previousSegment.color === cellStyle.color &&
            previousSegment.dimColor === cellStyle.dimColor
        ) {
            previousSegment.text += cellStyle.char;
        } else {
            segments.push({
                text: cellStyle.char,
                color: cellStyle.color,
                dimColor: cellStyle.dimColor
            });
        }
    }

    return segments;
}

export function HomePage() {
    const [animationFrame, setAnimationFrame] = useState(
        shouldSkipLogoAnimation() ? HOME_LOGO_FRAME_COUNT : 0
    );
    const isAnimationComplete = animationFrame >= HOME_LOGO_FRAME_COUNT;
    const scanColumn = animationFrame * HOME_LOGO_ANIMATION_STEP;
    const logoLines = useMemo(
        () => HOME_ART.map((line, rowIndex) => createLogoSegments(
            line,
            rowIndex,
            scanColumn,
            isAnimationComplete
        )),
        [isAnimationComplete, scanColumn]
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

    return h(
        Box,
        {flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1},
        h(
            Box,
            {flexDirection: 'column', marginLeft: 1},
            ...logoLines.map((segments, rowIndex) => h(
                Box,
                {key: `home-art-${rowIndex}`},
                ...segments.map((segment, segmentIndex) => h(
                    Text,
                    {
                        key: `home-art-${rowIndex}-${segmentIndex}`,
                        color: segment.color,
                        bold: true,
                        dimColor: segment.dimColor
                    },
                    segment.text
                ))
            ))
        ),
        h(Box, {marginTop: 1}, h(Text, {dimColor: true}, t('tui.home.prompt')))
    );
}
