/**
 * @file RootTuiHomePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 首页的逐列显现 SlothTool logo 和入口提示。
 * @logic 1. 居中展示填充式 logo；2. 首次进入时逐列显现并最终定格；3. 按 logo 分段上色并显示入口提示。
 * @dependencies Libraries: react/ink, Constants: ../constants.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 首页, logo, Ink页面
 * @author holic512
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';
import {HOME_ART, HOME_LOGO_REVEAL_INTERVAL_MS, HOME_LOGO_REVEAL_STEP} from '../constants.js';

const h = React.createElement;
const HOME_LOGO_WIDTH = Math.max(...HOME_ART.map(line => line.length));
const shouldSkipLogoAnimation = () => Boolean(process.env.SLOTHTOOL_TUI_TEST_ACTION);

function maskLogoLine(line, visibleColumns) {
    const paddedLine = line.padEnd(HOME_LOGO_WIDTH, ' ');
    return paddedLine
        .split('')
        .map((char, index) => (index < visibleColumns ? char : ' '))
        .join('');
}

export function HomePage() {
    const [visibleColumns, setVisibleColumns] = useState(
        shouldSkipLogoAnimation() ? HOME_LOGO_WIDTH : 0
    );
    const logoLines = useMemo(
        () => HOME_ART.map(line => maskLogoLine(line, visibleColumns)),
        [visibleColumns]
    );

    useEffect(() => {
        if (visibleColumns >= HOME_LOGO_WIDTH) {
            return undefined;
        }

        const interval = setInterval(() => {
            setVisibleColumns(currentColumns => Math.min(
                HOME_LOGO_WIDTH,
                currentColumns + HOME_LOGO_REVEAL_STEP
            ));
        }, HOME_LOGO_REVEAL_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [visibleColumns]);

    return h(
        Box,
        {flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1},
        h(
            Box,
            {flexDirection: 'column', marginLeft: 1},
            ...logoLines.map((line, index) => h(
                Text,
                {key: `home-art-${index}`, color: index < 5 ? 'magenta' : 'cyan', bold: true},
                line
            ))
        ),
        h(Box, {marginTop: 1}, h(Text, {dimColor: true}, t('tui.home.prompt')))
    );
}
