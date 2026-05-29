/**
 * @file LocPluginTui
 * @project SlothTool
 * @module LOC Plugin / TUI
 * @description 提供 loc 插件默认全屏 Ink 界面，支持统计、目录输入和配置切换。
 * @logic 1. 以 alternateScreen 渲染独立页面；2. 在菜单、输入和配置模式间切换；3. 将统计结果与配置状态同步展示。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js
 * @index_tags loc TUI, Ink, 目录输入, 配置切换, 全屏页面
 * @author holic512
 */

import React, {useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getLanguage, t} from './i18n.js';
import {
    countTargetDirectory,
    getConfigSummary,
    resetPluginConfig,
    toggleExcludedDirectory,
    toggleExtension
} from './service.js';

const h = React.createElement;
const MENU_ITEMS = [
    'current',
    'custom',
    'extensions',
    'excludes',
    'reset',
    'exit'
];

function createResultBox(result) {
    if (!result) {
        return {
            title: t('tui.resultTitle'),
            lines: [t('tui.emptyResult')]
        };
    }

    const lines = [
        t('counting', {dir: result.resolvedDir}),
        t('totalFiles', {count: result.fileCount}),
        t('totalLines', {count: result.lineCount})
    ];

    if (result.verbose && result.files.length > 0) {
        for (const file of result.files.slice(0, 8)) {
            lines.push(`${file.path} - ${file.lines} ${t('lines')}`);
        }
    }

    if (result.warnings.length > 0) {
        lines.push(t('warningsTitle'));
        for (const warning of result.warnings.slice(0, 4)) {
            lines.push(warning);
        }
    }

    return {
        title: t('tui.resultTitle'),
        lines
    };
}

function ResultPanel({panel}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, panel.title),
        ...panel.lines.map((line, index) => h(Text, {key: `${index}-${line}`}, line))
    );
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

function ToggleList({items, selectedIndex, hint}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        h(Text, {dimColor: true}, hint),
        ...items.map((item, index) =>
            h(Text, {key: item.name, color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} [${item.enabled ? 'x' : ' '}] ${item.name}`)
        )
    );
}

function LocTuiApp() {
    const app = useApp();
    const [mode, setMode] = useState('menu');
    const [menuIndex, setMenuIndex] = useState(0);
    const [toggleIndex, setToggleIndex] = useState(0);
    const [directoryInput, setDirectoryInput] = useState('.');
    const [status, setStatus] = useState(t('tui.subtitle'));
    const [helpOpen, setHelpOpen] = useState(false);
    const [result, setResult] = useState(null);
    const language = getLanguage();
    const config = getConfigSummary();

    const extensionItems = Object.entries(config.fileExtensions).map(([name, enabled]) => ({name, enabled}));
    const excludeItems = Object.entries(config.excludeDirectories).map(([name, enabled]) => ({name, enabled}));
    const resultPanel = createResultBox(result);

    function exitApp() {
        app.exit();
    }

    function performCount(targetDir) {
        try {
            const nextResult = countTargetDirectory(targetDir, {verbose: true});
            setResult(nextResult);
            setStatus(t('counting', {dir: nextResult.resolvedDir}));
        } catch (error) {
            setStatus(t('invalidDirectory', {dir: error.message}));
        }
    }

    function toggleCurrentConfigItem() {
        try {
            if (mode === 'extensions') {
                const item = extensionItems[toggleIndex];
                if (!item) {
                    return;
                }

                toggleExtension(item.name, !item.enabled);
                setStatus(t('tui.saved'));
                return;
            }

            if (mode === 'excludes') {
                const item = excludeItems[toggleIndex];
                if (!item) {
                    return;
                }

                toggleExcludedDirectory(item.name, !item.enabled);
                setStatus(t('tui.saved'));
            }
        } catch (error) {
            setStatus(error.message);
        }
    }

    useInput((input, key) => {
        if (helpOpen) {
            if (key.escape || input === '?') {
                setHelpOpen(false);
            }
            return;
        }

        if (input === '?') {
            setHelpOpen(true);
            return;
        }

        if (input.toLowerCase() === 'q') {
            exitApp();
            return;
        }

        if (mode === 'input') {
            if (key.escape) {
                setMode('menu');
                return;
            }

            if (key.return) {
                performCount(directoryInput);
                setMode('menu');
                return;
            }

            if (key.backspace || key.delete) {
                setDirectoryInput(currentValue => currentValue.slice(0, -1));
                return;
            }

            if (input && !key.ctrl && !key.meta) {
                setDirectoryInput(currentValue => currentValue + input);
            }

            return;
        }

        if (mode === 'extensions' || mode === 'excludes') {
            const itemCount = mode === 'extensions' ? extensionItems.length : excludeItems.length;

            if (key.escape || key.return) {
                setMode('menu');
                return;
            }

            if (key.upArrow) {
                setToggleIndex(currentValue => (currentValue - 1 + itemCount) % itemCount);
                return;
            }

            if (key.downArrow) {
                setToggleIndex(currentValue => (currentValue + 1) % itemCount);
                return;
            }

            if (input === ' ') {
                toggleCurrentConfigItem();
            }

            return;
        }

        if (key.upArrow) {
            setMenuIndex(currentValue => (currentValue - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
            return;
        }

        if (key.downArrow || key.tab) {
            setMenuIndex(currentValue => (currentValue + 1) % MENU_ITEMS.length);
            return;
        }

        if (key.return) {
            const selectedItem = MENU_ITEMS[menuIndex];

            if (selectedItem === 'current') {
                performCount(process.cwd());
                return;
            }

            if (selectedItem === 'custom') {
                setDirectoryInput('.');
                setMode('input');
                setStatus(t('tui.prompt'));
                return;
            }

            if (selectedItem === 'extensions') {
                setMode('extensions');
                setToggleIndex(0);
                return;
            }

            if (selectedItem === 'excludes') {
                setMode('excludes');
                setToggleIndex(0);
                return;
            }

            if (selectedItem === 'reset') {
                resetPluginConfig();
                setStatus(t('tui.resetDone'));
                return;
            }

            if (selectedItem === 'exit') {
                exitApp();
            }
        }
    });

    const leftPane = mode === 'menu'
        ? h(MenuList, {selectedIndex: menuIndex})
        : mode === 'input'
            ? h(
                Box,
                {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
                h(Text, {bold: true}, t('tui.inputLabel')),
                h(Text, {color: 'cyan'}, directoryInput || '.'),
                h(Text, {dimColor: true}, t('tui.prompt'))
            )
            : h(ToggleList, {
                items: mode === 'extensions' ? extensionItems : excludeItems,
                selectedIndex: toggleIndex,
                hint: t('tui.configHint')
            });

    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(
            Box,
            {marginBottom: 1},
            h(Box, {flexDirection: 'column'},
                h(Text, {bold: true}, t('tui.title')),
                h(Text, {dimColor: true}, t('tui.subtitle'))
            ),
            h(Spacer, {}),
            h(Box, {flexDirection: 'column', alignItems: 'flex-end'},
                h(Text, {color: 'gray'}, `v${pluginPackage.version}`),
                h(Text, {dimColor: true}, language)
            )
        ),
        h(
            Box,
            {flexDirection: 'row', flexGrow: 1, marginBottom: 1},
            h(Box, {flexBasis: 0, flexGrow: 4, paddingRight: 1}, leftPane),
            h(Box, {flexBasis: 0, flexGrow: 5, paddingLeft: 1}, h(ResultPanel, {panel: resultPanel}))
        ),
        h(
            Box,
            {},
            h(Text, {color: 'green'}, status),
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

export async function startLocTui() {
    if (process.env.SLOTHTOOL_LOC_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(LocTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
}
