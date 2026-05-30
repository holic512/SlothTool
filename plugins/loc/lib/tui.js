/**
 * @file LocPluginTui
 * @project SlothTool
 * @module LOC Plugin / TUI
 * @description 提供 loc 插件默认全屏 Ink 界面，复用统一插件外壳并保留统计、目录输入、配置切换与分页浏览能力。
 * @logic 1. 用顶部 tab 划分统计、扩展名和排除目录页面；2. 用固定页大小管理配置列表；3. 用底部状态栏承载就绪、加载和结果消息。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js, Pagination: ./pagination.js
 * @index_tags loc TUI, Ink, 统一外壳, tab导航, 配置切换, 翻页
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {t} from './i18n.js';
import {
    createPagedState,
    flipPagedPage,
    getPagedItems,
    movePagedSelection
} from './pagination.js';
import {
    countTargetDirectory,
    getConfigSummary,
    resetPluginConfig,
    toggleExcludedDirectory,
    toggleExtension
} from './service.js';

const h = React.createElement;
const TABS = ['count', 'extensions', 'excludes'];
const COUNT_MENU_ITEMS = ['current', 'custom', 'reset', 'exit'];
const RESULT_DISPLAY_MS = 1600;
const SPINNER_INTERVAL_MS = 120;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];

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

function resolveStatusColor(mode, tone) {
    if (mode === 'progress') {
        return 'cyan';
    }

    if (mode === 'result') {
        if (tone === 'error') {
            return 'red';
        }

        if (tone === 'warn') {
            return 'yellow';
        }
    }

    return 'green';
}

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

function CountMenuList({selectedIndex}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        ...COUNT_MENU_ITEMS.map((item, index) =>
            h(Text, {key: item, color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} ${t(`tui.menu.${item}`)}`)
        )
    );
}

function ToggleList({title, items, selectedIndex, hint}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        h(Text, {bold: true}, title),
        h(Text, {dimColor: true}, hint),
        h(Box, {marginTop: 1}, h(Text, {}, '')),
        ...items.map((item, index) =>
            h(Text, {key: item.name, color: index === selectedIndex ? 'cyan' : undefined}, `${index === selectedIndex ? '>' : ' '} [${item.enabled ? 'x' : ' '}] ${item.name}`)
        )
    );
}

function DirectoryInputPanel({value}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        h(Text, {bold: true}, t('tui.panels.countInput')),
        h(Text, {color: 'cyan'}, value || '.'),
        h(Text, {dimColor: true}, t('tui.prompt'))
    );
}

function LocTuiApp() {
    const app = useApp();
    const [activeTab, setActiveTab] = useState('count');
    const [countMenuIndex, setCountMenuIndex] = useState(0);
    const [pagedSelection, setPagedSelection] = useState({
        extensions: createPagedState(0, 0),
        excludes: createPagedState(0, 0)
    });
    const [directoryInput, setDirectoryInput] = useState('.');
    const [inputMode, setInputMode] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [result, setResult] = useState(null);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: '',
        label: ''
    });
    const resultTimeoutRef = useRef(null);

    const config = getConfigSummary();
    const extensionItems = Object.entries(config.fileExtensions).map(([name, enabled]) => ({name, enabled}));
    const excludeItems = Object.entries(config.excludeDirectories).map(([name, enabled]) => ({name, enabled}));
    const extensionPage = getPagedItems(extensionItems, pagedSelection.extensions.selectedIndex);
    const excludePage = getPagedItems(excludeItems, pagedSelection.excludes.selectedIndex);
    const resultPanel = createResultBox(result);

    useEffect(() => {
        if (statusState.mode !== 'progress') {
            return undefined;
        }

        const interval = setInterval(() => {
            setSpinnerFrameIndex(currentIndex => (currentIndex + 1) % SPINNER_FRAMES.length);
        }, SPINNER_INTERVAL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [statusState.mode]);

    useEffect(() => () => {
        clearTimeout(resultTimeoutRef.current);
    }, []);

    useEffect(() => {
        setPagedSelection(currentSelection => ({
            extensions: createPagedState(currentSelection.extensions.selectedIndex, extensionItems.length),
            excludes: createPagedState(currentSelection.excludes.selectedIndex, excludeItems.length)
        }));
    }, [extensionItems.length, excludeItems.length]);

    function exitApp() {
        app.exit();
    }

    function clearPendingStatus() {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
    }

    function showResultStatus(tone, message) {
        clearPendingStatus();
        setStatusState({
            mode: 'result',
            tone,
            message,
            label: ''
        });

        resultTimeoutRef.current = setTimeout(() => {
            setStatusState({
                mode: 'idle',
                tone: 'success',
                message: '',
                label: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    async function runTask(label, task, options = {}) {
        clearPendingStatus();

        if (options.useSpinner) {
            setSpinnerFrameIndex(0);
            setStatusState({
                mode: 'progress',
                tone: 'success',
                message: '',
                label
            });
        }

        try {
            const taskResult = await task();
            const feedback = options.resolveFeedback?.(taskResult) || {
                tone: 'success',
                message: label
            };
            showResultStatus(feedback.tone, feedback.message);
            return taskResult;
        } catch (error) {
            showResultStatus('error', error.message);
            return null;
        }
    }

    function setActiveTabSafe(tabKey) {
        setInputMode(false);
        setActiveTab(tabKey);
    }

    function performCount(targetDir) {
        return runTask(t('tui.status.countingLabel'), async () => {
            try {
                const nextResult = countTargetDirectory(targetDir, {verbose: true});
                setResult(nextResult);
                return nextResult;
            } catch (error) {
                throw new Error(t('invalidDirectory', {dir: error.message}));
            }
        }, {
            useSpinner: true,
            resolveFeedback(nextResult) {
                return {
                    tone: 'success',
                    message: t('tui.status.countDone', {dir: nextResult.resolvedDir})
                };
            }
        });
    }

    function resetConfigState() {
        return runTask(t('tui.status.resetLabel'), async () => {
            resetPluginConfig();
            return null;
        }, {
            resolveFeedback() {
                return {
                    tone: 'success',
                    message: t('tui.resetDone')
                };
            }
        });
    }

    function toggleCurrentConfigItem() {
        const itemList = activeTab === 'extensions' ? extensionItems : excludeItems;
        const currentIndex = pagedSelection[activeTab].selectedIndex;
        const currentItem = itemList[currentIndex];

        if (!currentItem) {
            return;
        }

        return runTask(t('tui.saved'), async () => {
            if (activeTab === 'extensions') {
                toggleExtension(currentItem.name, !currentItem.enabled);
            } else {
                toggleExcludedDirectory(currentItem.name, !currentItem.enabled);
            }
        }, {
            resolveFeedback() {
                return {
                    tone: 'success',
                    message: t('tui.saved')
                };
            }
        });
    }

    useInput((input, key) => {
        if (helpOpen) {
            if (key.escape || input === '?') {
                setHelpOpen(false);
                setInputMode(false);
                setActiveTab('count');
            }
            return;
        }

        if (statusState.mode === 'progress') {
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

        if (inputMode) {
            if (key.escape) {
                setInputMode(false);
                setActiveTab('count');
                return;
            }

            if (key.return) {
                setInputMode(false);
                performCount(directoryInput);
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

        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            const nextTab = TABS[(currentIndex + 1) % TABS.length];
            setActiveTabSafe(nextTab);
            return;
        }

        if (key.escape) {
            setActiveTabSafe('count');
            return;
        }

        if (key.upArrow) {
            if (activeTab === 'count') {
                setCountMenuIndex(currentValue => (currentValue - 1 + COUNT_MENU_ITEMS.length) % COUNT_MENU_ITEMS.length);
                return;
            }

            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: movePagedSelection(currentSelection[activeTab].selectedIndex, -1, itemCount)
            }));
            return;
        }

        if (key.downArrow) {
            if (activeTab === 'count') {
                setCountMenuIndex(currentValue => (currentValue + 1) % COUNT_MENU_ITEMS.length);
                return;
            }

            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: movePagedSelection(currentSelection[activeTab].selectedIndex, 1, itemCount)
            }));
            return;
        }

        if (input === '[' && (activeTab === 'extensions' || activeTab === 'excludes')) {
            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: flipPagedPage(currentSelection[activeTab].selectedIndex, -1, itemCount)
            }));
            return;
        }

        if (input === ']' && (activeTab === 'extensions' || activeTab === 'excludes')) {
            const itemCount = activeTab === 'extensions' ? extensionItems.length : excludeItems.length;
            setPagedSelection(currentSelection => ({
                ...currentSelection,
                [activeTab]: flipPagedPage(currentSelection[activeTab].selectedIndex, 1, itemCount)
            }));
            return;
        }

        if (input === ' ' && (activeTab === 'extensions' || activeTab === 'excludes')) {
            toggleCurrentConfigItem();
            return;
        }

        if (!key.return || activeTab !== 'count') {
            return;
        }

        const selectedItem = COUNT_MENU_ITEMS[countMenuIndex];

        if (selectedItem === 'current') {
            performCount(process.cwd());
            return;
        }

        if (selectedItem === 'custom') {
            setDirectoryInput('.');
            setInputMode(true);
            return;
        }

        if (selectedItem === 'reset') {
            resetConfigState();
            return;
        }

        if (selectedItem === 'exit') {
            exitApp();
        }
    });

    const leftPane = activeTab === 'count'
        ? inputMode
            ? h(DirectoryInputPanel, {value: directoryInput})
            : h(CountMenuList, {selectedIndex: countMenuIndex})
        : h(ToggleList, {
            title: `${activeTab === 'extensions' ? t('tui.panels.extensions') : t('tui.panels.excludes')} · ${t('tui.panels.page', {
                page: (activeTab === 'extensions' ? extensionPage.pageIndex : excludePage.pageIndex) + 1,
                total: activeTab === 'extensions' ? extensionPage.pageCount : excludePage.pageCount
            })}`,
            items: activeTab === 'extensions' ? extensionPage.items : excludePage.items,
            selectedIndex: (activeTab === 'extensions' ? extensionPage.selectedIndex : excludePage.selectedIndex)
                - (activeTab === 'extensions' ? extensionPage.startIndex : excludePage.startIndex),
            hint: t('tui.configHint')
        });

    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.mode === 'result'
            ? statusState.message
            : t('tui.status.ready');
    const dividerLine = buildDividerLine();
    const headerMetaText = buildHeaderMetaText(activeTab);
    const statusColor = resolveStatusColor(statusState.mode, statusState.tone);

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
        h(
            Box,
            {flexDirection: 'row', flexGrow: 1, marginBottom: 1},
            h(Box, {flexBasis: 0, flexGrow: 4, paddingRight: 1}, leftPane),
            h(Box, {flexBasis: 0, flexGrow: 5, paddingLeft: 1}, h(ResultPanel, {panel: resultPanel}))
        ),
        h(
            Box,
            {},
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
