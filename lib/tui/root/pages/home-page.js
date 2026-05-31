/**
 * @file RootTuiHomePage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 首页的填充式 SlothTool logo 和入口提示。
 * @logic 1. 居中展示首页 eyebrow；2. 按 logo 分段上色；3. 显示页面切换和执行提示。
 * @dependencies Libraries: react/ink, Constants: ../constants.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 首页, logo, Ink页面
 * @author holic512
 */

import React from 'react';
import {Box, Text} from 'ink';
import {t} from '../../../i18n.js';
import {HOME_ART} from '../constants.js';

const h = React.createElement;

export function HomePage() {
    return h(
        Box,
        {flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1},
        h(Text, {color: 'gray'}, t('tui.home.eyebrow')),
        ...HOME_ART.map((line, index) => h(
            Text,
            {key: `home-art-${index}`, color: index < 5 ? 'magenta' : 'cyan', bold: true},
            line
        )),
        h(Box, {marginTop: 1}, h(Text, {dimColor: true}, t('tui.home.prompt')))
    );
}
