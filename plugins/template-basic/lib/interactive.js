/**
 * @file TemplatePluginTui
 * @project SlothTool
 * @module Plugin Scaffold / TUI
 * @description 提供模板插件的默认全屏 Ink 界面，演示统一插件外壳中的操作页与配置页布局。
 * @logic 1. 使用顶部 tab 切换操作与配置页面；2. 用底部状态栏反馈最近一次结果消息；3. 让模板成为未来插件 TUI 的参考骨架。
 * @dependencies Libraries: react/ink, Storage: ./config.js, I18N: ./i18n.js
 * @index_tags 模板TUI, scaffold, tab外壳, 状态栏, 插件参考
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {readConfig, toggleSampleOption} from './config.js';
import {t} from './i18n.js';

const h = React.createElement;
const TABS = ['actions', 'config'];
const MENU_ITEMS = ['showTitle', 'toggleSample', 'exit'];
const RESULT_DISPLAY_MS = 1600;

function getContentWidth() {
    return Math.max(24, (process.stdout.columns || 80) - 4);
}

function buildDividerLine() {
    return '─'.repeat(getContentWidth());
}

function getDisplayWidth(text) {
    return Array.from(text).reduce((width, character) => (
        width + (character.codePointAt(0) > 0xFF ? 2 : 1)
    ), 0);
}

function truncateFromLeft(text, maxWidth) {
    if (maxWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(text) <= maxWidth) {
        return text;
    }

    const ellipsis = '...';
    if (maxWidth <= ellipsis.length) {
        return ellipsis.slice(0, maxWidth);
    }

    let result = '';
    let width = 0;

    for (const character of Array.from(text).reverse()) {
        const characterWidth = getDisplayWidth(character);
        if (width + characterWidth + ellipsis.length > maxWidth) {
            break;
        }

        result = `${character}${result}`;
        width += characterWidth;
    }

    return `${ellipsis}${result}`;
}

function buildTabText(tabKey, activeTab) {
    const label = t(`tui.tabs.${tabKey}`);
    return tabKey === activeTab ? `[${label}]` : label;
}

function buildHeaderMetaText(activeTab) {
    const versionText = `v${pluginPackage.version}`;
    const tabStripText = TABS.map(tabKey => buildTabText(tabKey, activeTab)).join('  ');
    const availableWidth = Math.max(0, getContentWidth() - getDisplayWidth(tabStripText) - 2);

    if (availableWidth <= 0) {
        return '';
    }

    if (getDisplayWidth(versionText) >= availableWidth) {
        return truncateFromLeft(versionText, availableWidth);
    }

    const pathWidth = availableWidth - getDisplayWidth(versionText) - 2;
    const pathText = truncateFromLeft(process.cwd(), pathWidth);
    return pathText ? `${versionText}  ${pathText}` : versionText;
}

function resolveStatusColor(tone) {
    if (tone === 'error') {
        return 'red';
    }

    if (tone === 'warn') {
        return 'yellow';
    }

    return 'green';
}

function MenuList({selectedIndex}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        ...MENU_ITEMS.map((item, index) =>
            h(Text, {key: item, color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} ${t(`tui.menu.${item}`)}`)
        )
    );
}

function DetailPanel({title, description, detail}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, title),
        h(Text, {dimColor: true}, description),
        h(Box, {marginTop: 1}, h(Text, {}, detail))
    );
}

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
    const [activeTab, setActiveTab] = useState('actions');
    const [menuIndex, setMenuIndex] = useState(0);
    const [helpOpen, setHelpOpen] = useState(false);
    const [statusState, setStatusState] = useState({
        tone: 'success',
        message: ''
    });
    const resultTimeoutRef = useRef(null);
    const config = readConfig('mytool');

    useEffect(() => () => {
        clearTimeout(resultTimeoutRef.current);
    }, []);

    function clearPendingStatus() {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
    }

    function showResultStatus(tone, message) {
        clearPendingStatus();
        setStatusState({tone, message});
        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                tone: 'success',
                message: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    useInput((input, key) => {
        if (helpOpen) {
            if (input === '?' || key.escape) {
                setHelpOpen(false);
                setActiveTab('actions');
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

        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            setActiveTab(TABS[(currentIndex + 1) % TABS.length]);
            return;
        }

        if (key.escape) {
            setActiveTab('actions');
            return;
        }

        if (activeTab !== 'actions') {
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

        if (!key.return) {
            return;
        }

        const selectedItem = MENU_ITEMS[menuIndex];

        if (selectedItem === 'showTitle') {
            showResultStatus('success', t('tui.status.titleShown'));
            return;
        }

        if (selectedItem === 'toggleSample') {
            const nextConfig = toggleSampleOption('mytool');
            showResultStatus('success', t('tui.status.toggleDone', {
                value: String(nextConfig.sampleOption)
            }));
            return;
        }

        app.exit();
    });

    const actionsContent = h(
        Box,
        {flexDirection: 'row', flexGrow: 1},
        h(Box, {flexBasis: 0, flexGrow: 4, paddingRight: 1}, h(MenuList, {selectedIndex: menuIndex})),
        h(Box, {flexBasis: 0, flexGrow: 5, paddingLeft: 1},
            h(DetailPanel, {
                title: t('tui.panels.actionsTitle'),
                description: t('tui.panels.actionsDescription'),
                detail: JSON.stringify(config, null, 2)
            })
        )
    );

    const configContent = h(
        Box,
        {flexGrow: 1},
        h(DetailPanel, {
            title: t('tui.panels.configTitle'),
            description: t('tui.panels.configDescription'),
            detail: JSON.stringify(config, null, 2)
        })
    );

    const statusText = statusState.message || t('tui.status.ready');
    const statusColor = resolveStatusColor(statusState.tone);
    const dividerLine = buildDividerLine();
    const headerMetaText = buildHeaderMetaText(activeTab);

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(
            Box,
            {marginBottom: 1},
            h(
                Box,
                {},
                ...TABS.map(tabKey =>
                    h(
                        Box,
                        {key: tabKey, marginRight: 2},
                        h(Text, {color: tabKey === activeTab ? 'cyan' : 'gray'}, buildTabText(tabKey, activeTab))
                    )
                )
            ),
            h(Spacer, {}),
            headerMetaText
                ? h(Text, {dimColor: true}, headerMetaText)
                : null
        ),
        h(Box, {marginBottom: 1}, h(Text, {color: 'gray'}, dividerLine)),
        h(Box, {flexGrow: 1, marginBottom: 1}, activeTab === 'actions' ? actionsContent : configContent),
        h(
            Box,
            {marginTop: 1},
            h(Text, {color: statusColor}, statusText),
            h(Spacer, {}),
            h(Text, {dimColor: true}, t('tui.footer'))
        ),
        helpOpen
            ? h(
                Box,
                {borderStyle: 'round', paddingX: 1, paddingY: 1, marginTop: 1, flexDirection: 'column'},
                h(Text, {bold: true}, t('tui.help.title')),
                ...t('tui.help.lines').map(line => h(Text, {key: line}, line))
            )
            : null
    );
}
