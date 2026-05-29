/**
 * @file TemplatePluginTui
 * @project SlothTool
 * @module Plugin Scaffold / TUI
 * @description 提供模板插件的默认全屏 Ink 界面，演示无参数进入 TUI、显式 CLI 命令作为底层能力。
 * @logic 1. 在 alternateScreen 中渲染最小可运行页面；2. 展示菜单选择与帮助覆盖层；3. 切换 sampleOption 作为状态示例。
 * @dependencies Libraries: react/ink, Storage: ./config.js, I18N: ./i18n.js
 * @index_tags 模板TUI, Ink, scaffold, 默认入口
 * @author holic512
 */

import React, {useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {readConfig, toggleSampleOption} from './config.js';
import {t} from './i18n.js';

const h = React.createElement;
const MENU_ITEMS = ['title', 'toggle', 'exit'];

export async function interactiveMain() {
    if (process.env.SLOTHTOOL_TEMPLATE_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(TemplateTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
}

function TemplateTuiApp() {
    const app = useApp();
    const [menuIndex, setMenuIndex] = useState(0);
    const [helpOpen, setHelpOpen] = useState(false);
    const [status, setStatus] = useState(t('title'));
    const config = readConfig('mytool');

    useInput((input, key) => {
        if (helpOpen) {
            if (input === '?' || key.escape) {
                setHelpOpen(false);
            }
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
            return;
        }

        if (input.toLowerCase() === 'q') {
            app.exit();
            return;
        }

        if (key.upArrow) {
            setMenuIndex(currentIndex => (currentIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
            return;
        }

        if (key.downArrow) {
            setMenuIndex(currentIndex => (currentIndex + 1) % MENU_ITEMS.length);
            return;
        }

        if (key.return) {
            const selectedItem = MENU_ITEMS[menuIndex];

            if (selectedItem === 'title') {
                setStatus(t('title'));
                return;
            }

            if (selectedItem === 'toggle') {
                const nextConfig = toggleSampleOption('mytool');
                setStatus(`sampleOption = ${String(nextConfig.sampleOption)}`);
                return;
            }

            app.exit();
        }
    });

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(
            Box,
            {marginBottom: 1},
            h(Box, {flexDirection: 'column'},
                h(Text, {bold: true}, 'mytool'),
                h(Text, {dimColor: true}, 'Scaffolded plugin with default Ink TUI.')
            ),
            h(Spacer, {}),
            h(Text, {color: 'gray'}, `v${pluginPackage.version}`)
        ),
        h(
            Box,
            {flexDirection: 'row', flexGrow: 1},
            h(
                Box,
                {flexBasis: 0, flexGrow: 4, borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
                h(Text, {color: menuIndex === 0 ? 'cyan' : undefined}, `${menuIndex === 0 ? '>' : ' '} ${t('menuShowTitle')}`),
                h(Text, {color: menuIndex === 1 ? 'cyan' : undefined}, `${menuIndex === 1 ? '>' : ' '} ${t('menuToggleSample')}`),
                h(Text, {color: menuIndex === 2 ? 'cyan' : undefined}, `${menuIndex === 2 ? '>' : ' '} ${t('menuExit')}`)
            ),
            h(
                Box,
                {flexBasis: 0, flexGrow: 5, marginLeft: 1, borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
                h(Text, {bold: true}, t('configTitle')),
                h(Text, {}, JSON.stringify(config, null, 2)),
                h(Box, {marginTop: 1}, h(Text, {color: 'green'}, status))
            )
        ),
        h(
            Box,
            {marginTop: 1},
            h(Text, {dimColor: true}, t('footer'))
        ),
        helpOpen
            ? h(
                Box,
                {borderStyle: 'round', paddingX: 1, paddingY: 1, marginTop: 1, flexDirection: 'column'},
                ...t('helpLines').map(line => h(Text, {key: line}, line))
            )
            : null
    );
}
