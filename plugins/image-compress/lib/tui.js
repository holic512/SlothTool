/**
 * @file ImageCompressTui
 * @project SlothTool
 * @module Image Compress Plugin / TUI
 * @description 提供默认全屏 Ink 界面，围绕拖拽文件、参数调节和最近结果展示构建更人性化的压缩体验。
 * @logic 1. 使用运行/选项/历史三页组织交互；2. 通过 usePaste 捕获拖拽或粘贴路径并更新请求；3. 调用 Go 后端并在状态栏与结果面板展示反馈。
 * @dependencies Libraries: react/ink, Services: ./service.js, I18N: ./i18n.js
 * @index_tags 图片压缩TUI, Ink, 拖拽路径, 批量压缩, 人性化界面
 * @author holic512
 */

import React, {useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {t} from './i18n.js';
import {
    dedupePaths,
    parseDroppedPaths,
    runCompressionRequest
} from './service.js';

const h = React.createElement;
const TABS = ['run', 'options', 'history'];
const RUN_MENU_ITEMS = ['compress', 'addCurrentDir', 'editTargets', 'clearTargets', 'openOptions', 'exit'];
const OPTION_ITEMS = ['outputDir', 'quality', 'maxWidth', 'maxHeight', 'recursive', 'overwrite', 'allowLarger', 'dryRun', 'concurrency'];
const RESULT_DISPLAY_MS = 1800;
const SPINNER_INTERVAL_MS = 120;
const SPINNER_FRAMES = ['-', '\\', '|', '/'];

function getContentWidth() {
    return Math.max(32, (process.stdout.columns || 100) - 4);
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

    if (tone === 'error') {
        return 'red';
    }

    if (tone === 'warn') {
        return 'yellow';
    }

    return 'green';
}

function formatBytes(size) {
    if (typeof size !== 'number' || Number.isNaN(size)) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = Math.abs(size);
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const sign = size < 0 ? '-' : '';
    if (unitIndex === 0) {
        return `${sign}${Math.round(value)} ${units[unitIndex]}`;
    }

    return `${sign}${value.toFixed(1)} ${units[unitIndex]}`;
}

function summarizeResult(result) {
    if (!result) {
        return [];
    }

    return [
        `${result.Status || result.status || 'unknown'} - ${truncateFromLeft(result.InputPath || result.inputPath || '', 70)}`,
        result.OutputPath || result.outputPath ? ` -> ${truncateFromLeft(result.OutputPath || result.outputPath, 68)}` : '',
        result.OriginalBytes || result.ResultBytes
            ? ` ${formatBytes(result.OriginalBytes || 0)} -> ${formatBytes(result.ResultBytes || 0)} (${formatBytes(result.BytesSaved || 0)} saved)`
            : '',
        result.Error || result.error || ''
    ].filter(Boolean);
}

function RequestSummaryPanel({requestState}) {
    const lines = [
        requestState.outputDir
            ? t('tui.requestLines.outputDir', {dir: requestState.outputDir})
            : t('tui.requestLines.outputSameDir'),
        t('tui.requestLines.quality', {value: requestState.quality}),
        (requestState.maxWidth > 0 || requestState.maxHeight > 0)
            ? t('tui.requestLines.resize', {
                width: requestState.maxWidth || 'auto',
                height: requestState.maxHeight || 'auto'
            })
            : t('tui.requestLines.resizeOff'),
        requestState.recursive ? t('tui.requestLines.recursionOn') : t('tui.requestLines.recursionOff'),
        requestState.overwrite ? t('tui.requestLines.overwriteOn') : t('tui.requestLines.overwriteOff'),
        requestState.allowLarger ? t('tui.requestLines.largerOn') : t('tui.requestLines.largerOff'),
        requestState.dryRun ? t('tui.requestLines.dryRunOn') : t('tui.requestLines.dryRunOff'),
        requestState.concurrency > 0
            ? t('tui.requestLines.concurrencyFixed', {value: requestState.concurrency})
            : t('tui.requestLines.concurrencyAuto')
    ];

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, t('tui.requestTitle')),
        ...lines.map(line => h(Text, {key: line}, line))
    );
}

function TargetPanel({paths, inputMode, inputValue}) {
    const bodyLines = [];

    if (inputMode) {
        bodyLines.push(inputValue || '');
        bodyLines.push(t('tui.inputHint'));
    } else if (paths.length === 0) {
        bodyLines.push(t('tui.emptyTargets'));
    } else {
        bodyLines.push(...paths.slice(0, 6).map(currentPath => truncateFromLeft(currentPath, getContentWidth() - 12)));
        if (paths.length > 6) {
            bodyLines.push(`... +${paths.length - 6}`);
        }
    }

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, t('tui.dropZoneTitle')),
        h(Text, {dimColor: true}, inputMode ? t('tui.inputHint') : t('tui.dropZoneHint')),
        h(Box, {marginTop: 1}, h(Text, {color: inputMode ? 'cyan' : undefined}, bodyLines[0] || '')),
        ...bodyLines.slice(1).map(line => h(Text, {key: line, dimColor: line === t('tui.inputHint')}, line))
    );
}

function ActionMenu({selectedIndex}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column'},
        ...RUN_MENU_ITEMS.map((item, index) => h(
            Text,
            {key: item, color: index === selectedIndex ? 'cyan' : undefined},
            `${index === selectedIndex ? '>' : ' '} ${t(`tui.menu.${item}`)}`
        ))
    );
}

function ResultPanel({summary}) {
    if (!summary) {
        return h(
            Box,
            {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
            h(Text, {bold: true}, t('tui.history.title')),
            h(Text, {dimColor: true}, t('tui.history.empty'))
        );
    }

    const firstResult = summary.Results?.[0];
    const lines = summarizeResult(firstResult);

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, t('tui.history.summary', {
            success: summary.SuccessCount || 0,
            skipped: summary.SkippedCount || 0,
            failed: summary.FailedCount || 0,
            saved: formatBytes(summary.SavedBytes || 0)
        })),
        ...lines.map(line => h(Text, {key: line}, line))
    );
}

function OptionList({requestState, selectedIndex, outputInputMode, outputInputValue}) {
    const optionLines = OPTION_ITEMS.map(optionKey => describeOptionValue(optionKey, requestState, outputInputMode, outputInputValue));
    const helpText = outputInputMode ? t('tui.outputInputHint') : t('tui.optionHelp.number');

    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, t('tui.tabs.options')),
        h(Text, {dimColor: true}, t('tui.optionHelp.outputDir')),
        h(Text, {dimColor: true}, helpText),
        h(Box, {marginTop: 1}, h(Text, {}, '')),
        ...optionLines.map((line, index) => h(
            Text,
            {key: line.key, color: index === selectedIndex ? 'cyan' : undefined},
            `${index === selectedIndex ? '>' : ' '} ${line.label}: ${line.value}`
        ))
    );
}

function HistoryPanel({historyItems}) {
    return h(
        Box,
        {borderStyle: 'round', paddingX: 1, paddingY: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true}, t('tui.history.title')),
        historyItems.length === 0
            ? h(Text, {dimColor: true}, t('tui.history.empty'))
            : historyItems.slice(0, 8).flatMap(entry => [
                h(Text, {key: `${entry.id}-summary`}, `${entry.label} - ${t('tui.history.summary', {
                    success: entry.summary.SuccessCount || 0,
                    skipped: entry.summary.SkippedCount || 0,
                    failed: entry.summary.FailedCount || 0,
                    saved: formatBytes(entry.summary.SavedBytes || 0)
                })}`),
                ...summarizeResult(entry.summary.Results?.[0]).map(line => h(Text, {key: `${entry.id}-${line}`, dimColor: true}, `  ${line}`))
            ])
    );
}

function ImageCompressTuiApp() {
    const app = useApp();
    const [activeTab, setActiveTab] = useState('run');
    const [runMenuIndex, setRunMenuIndex] = useState(0);
    const [optionIndex, setOptionIndex] = useState(0);
    const [helpOpen, setHelpOpen] = useState(false);
    const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
    const [statusState, setStatusState] = useState({
        mode: 'idle',
        tone: 'success',
        message: t('tui.status.ready'),
        label: ''
    });
    const [sourceInputMode, setSourceInputMode] = useState(false);
    const [sourceInputValue, setSourceInputValue] = useState('');
    const [outputInputMode, setOutputInputMode] = useState(false);
    const [outputInputValue, setOutputInputValue] = useState('');
    const [requestState, setRequestState] = useState({
        sourcePaths: [],
        outputDir: '',
        recursive: true,
        overwrite: false,
        allowLarger: false,
        quality: 82,
        maxWidth: 0,
        maxHeight: 0,
        concurrency: 0,
        dryRun: false
    });
    const [lastSummary, setLastSummary] = useState(null);
    const [historyItems, setHistoryItems] = useState([]);
    const resultTimeoutRef = useRef(null);

    useEffect(() => () => {
        clearTimeout(resultTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (statusState.mode !== 'progress') {
            return undefined;
        }

        const interval = setInterval(() => {
            setSpinnerFrameIndex(currentIndex => (currentIndex + 1) % SPINNER_FRAMES.length);
        }, SPINNER_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [statusState.mode]);

    function captureExternalPathText(text) {
        if (statusState.mode === 'progress') {
            return;
        }

        if (outputInputMode) {
            const parsedPaths = parseDroppedPaths(text);
            const nextOutputDir = parsedPaths[0] || text.trim();
            setOutputInputValue(nextOutputDir);
            setRequestState(currentState => ({
                ...currentState,
                outputDir: nextOutputDir
            }));
            setOutputInputMode(false);
            showResultStatus('success', t('tui.status.outputDirSaved'));
            return;
        }

        const parsedPaths = parseDroppedPaths(text);
        if (parsedPaths.length === 0) {
            showResultStatus('warn', t('tui.status.invalidPaths'));
            return;
        }

        setRequestState(currentState => ({
            ...currentState,
            sourcePaths: dedupePaths([...currentState.sourcePaths, ...parsedPaths])
        }));
        setSourceInputMode(false);
        setSourceInputValue('');
        showResultStatus('success', t('tui.status.captured', {count: parsedPaths.length}));
    }

    usePaste(text => {
        captureExternalPathText(text);
    });

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
                message: t('tui.status.ready'),
                label: ''
            });
        }, RESULT_DISPLAY_MS);
    }

    async function runTask(label, task) {
        clearPendingStatus();
        setSpinnerFrameIndex(0);
        setStatusState({
            mode: 'progress',
            tone: 'success',
            message: '',
            label
        });

        try {
            const result = await task();
            return result;
        } catch (error) {
            showResultStatus('error', error.message);
            return null;
        }
    }

    function resetInputModes(message) {
        setSourceInputMode(false);
        setSourceInputValue('');
        setOutputInputMode(false);
        setOutputInputValue('');
        if (message) {
            showResultStatus('warn', message);
        }
    }

    async function compressCurrentSelection() {
        const selectedPaths = requestState.sourcePaths.length > 0
            ? requestState.sourcePaths
            : [];

        if (selectedPaths.length === 0) {
            showResultStatus('warn', t('tui.status.noTargets'));
            return;
        }

        const nextSummary = await runTask(t('tui.status.busy'), async () => {
            const response = await runCompressionRequest({
                inputPaths: selectedPaths,
                outputDir: requestState.outputDir,
                recursive: requestState.recursive,
                overwrite: requestState.overwrite,
                allowLarger: requestState.allowLarger,
                quality: requestState.quality,
                maxWidth: requestState.maxWidth,
                maxHeight: requestState.maxHeight,
                concurrency: requestState.concurrency,
                dryRun: requestState.dryRun
            });

            if (!response.summary) {
                throw new Error(response.stderr.trim() || 'backend did not return a summary');
            }

            const finishedSummary = response.summary;
            setLastSummary(finishedSummary);
            setHistoryItems(currentHistory => [{
                id: Date.now(),
                label: new Date().toLocaleTimeString(),
                summary: finishedSummary
            }, ...currentHistory].slice(0, 8));

            if (response.exitCode !== 0 && finishedSummary.FailedCount === 0 && finishedSummary.Cancelled !== true) {
                throw new Error(response.stderr.trim() || 'backend command failed');
            }

            return finishedSummary;
        });

        if (!nextSummary) {
            return;
        }

        const hasWarnings = (nextSummary.SkippedCount || 0) > 0 || (nextSummary.FailedCount || 0) > 0;
        showResultStatus(
            hasWarnings ? 'warn' : 'success',
            hasWarnings
                ? t('tui.status.runWarn')
                : t('tui.status.runDone', {
                    success: nextSummary.SuccessCount || 0,
                    skipped: nextSummary.SkippedCount || 0,
                    failed: nextSummary.FailedCount || 0
                })
        );
    }

    function handleRunMenuAction() {
        const selectedItem = RUN_MENU_ITEMS[runMenuIndex];

        if (selectedItem === 'compress') {
            void compressCurrentSelection();
            return;
        }

        if (selectedItem === 'addCurrentDir') {
            setRequestState(currentState => ({
                ...currentState,
                sourcePaths: dedupePaths([...currentState.sourcePaths, process.cwd()])
            }));
            showResultStatus('success', t('tui.status.cwdAdded', {dir: process.cwd()}));
            return;
        }

        if (selectedItem === 'editTargets') {
            setSourceInputMode(true);
            setOutputInputMode(false);
            setSourceInputValue('');
            showResultStatus('success', t('tui.status.inputModeTargets'));
            return;
        }

        if (selectedItem === 'clearTargets') {
            setRequestState(currentState => ({
                ...currentState,
                sourcePaths: []
            }));
            showResultStatus('success', t('tui.status.targetsCleared'));
            return;
        }

        if (selectedItem === 'openOptions') {
            setActiveTab('options');
            return;
        }

        if (selectedItem === 'exit') {
            app.exit();
        }
    }

    function commitSourceInput() {
        const parsedPaths = parseDroppedPaths(sourceInputValue);
        if (parsedPaths.length === 0) {
            showResultStatus('warn', t('tui.status.invalidPaths'));
            return;
        }

        setRequestState(currentState => ({
            ...currentState,
            sourcePaths: dedupePaths([...currentState.sourcePaths, ...parsedPaths])
        }));
        setSourceInputMode(false);
        setSourceInputValue('');
        showResultStatus('success', t('tui.status.inputSaved'));
    }

    function commitOutputInput() {
        const parsedPaths = parseDroppedPaths(outputInputValue);
        const nextOutputDir = parsedPaths[0] || outputInputValue.trim();

        setRequestState(currentState => ({
            ...currentState,
            outputDir: nextOutputDir
        }));
        setOutputInputMode(false);
        setOutputInputValue('');
        showResultStatus(
            nextOutputDir ? 'success' : 'warn',
            nextOutputDir ? t('tui.status.outputDirSaved') : t('tui.status.outputDirCleared')
        );
    }

    function updateNumericOption(optionKey, delta) {
        setRequestState(currentState => {
            const nextState = {...currentState};
            if (optionKey === 'quality') {
                nextState.quality = clamp(currentState.quality + delta * 5, 1, 100);
            } else if (optionKey === 'maxWidth') {
                nextState.maxWidth = Math.max(0, currentState.maxWidth + delta * 100);
            } else if (optionKey === 'maxHeight') {
                nextState.maxHeight = Math.max(0, currentState.maxHeight + delta * 100);
            } else if (optionKey === 'concurrency') {
                nextState.concurrency = Math.max(0, currentState.concurrency + delta);
            }
            return nextState;
        });
        showResultStatus('success', t('tui.status.optionUpdated', {label: t(`tui.options.${optionKey}`)}));
    }

    function toggleBooleanOption(optionKey) {
        setRequestState(currentState => ({
            ...currentState,
            [optionKey]: !currentState[optionKey]
        }));
        showResultStatus('success', t('tui.status.optionUpdated', {label: t(`tui.options.${optionKey}`)}));
    }

    useInput((input, key) => {
        if (helpOpen) {
            if (input === '?' || key.escape) {
                setHelpOpen(false);
            }
            return;
        }

        if (statusState.mode === 'progress') {
            if (input.toLowerCase() === 'q') {
                app.exit();
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

        if (sourceInputMode) {
            if (key.escape) {
                resetInputModes(t('tui.status.cancelledInput'));
                return;
            }
            if (key.return) {
                commitSourceInput();
                return;
            }
            if (key.backspace || key.delete) {
                setSourceInputValue(currentValue => currentValue.slice(0, -1));
                return;
            }
            if (input) {
                setSourceInputValue(currentValue => currentValue + input);
            }
            return;
        }

        if (outputInputMode) {
            if (key.escape) {
                resetInputModes(t('tui.status.cancelledInput'));
                return;
            }
            if (key.return) {
                commitOutputInput();
                return;
            }
            if (key.backspace || key.delete) {
                setOutputInputValue(currentValue => currentValue.slice(0, -1));
                return;
            }
            if (input) {
                setOutputInputValue(currentValue => currentValue + input);
            }
            return;
        }

        if (input && input.length > 1) {
            captureExternalPathText(input);
            return;
        }

        if (key.tab) {
            const currentIndex = TABS.indexOf(activeTab);
            setActiveTab(TABS[(currentIndex + 1) % TABS.length]);
            return;
        }

        if (key.escape) {
            setActiveTab('run');
            return;
        }

        if (activeTab === 'run') {
            if (key.upArrow) {
                setRunMenuIndex(currentIndex => (currentIndex - 1 + RUN_MENU_ITEMS.length) % RUN_MENU_ITEMS.length);
                return;
            }
            if (key.downArrow) {
                setRunMenuIndex(currentIndex => (currentIndex + 1) % RUN_MENU_ITEMS.length);
                return;
            }
            if (key.return) {
                handleRunMenuAction();
                return;
            }
            return;
        }

        if (activeTab === 'options') {
            const optionKey = OPTION_ITEMS[optionIndex];

            if (key.upArrow) {
                setOptionIndex(currentIndex => (currentIndex - 1 + OPTION_ITEMS.length) % OPTION_ITEMS.length);
                return;
            }
            if (key.downArrow) {
                setOptionIndex(currentIndex => (currentIndex + 1) % OPTION_ITEMS.length);
                return;
            }
            if (key.return && optionKey === 'outputDir') {
                setOutputInputMode(true);
                setOutputInputValue(requestState.outputDir);
                showResultStatus('success', t('tui.status.inputModeOutput'));
                return;
            }
            if (input === ' ') {
                if (isBooleanOption(optionKey)) {
                    toggleBooleanOption(optionKey);
                }
                return;
            }
            if (key.leftArrow) {
                if (isBooleanOption(optionKey)) {
                    toggleBooleanOption(optionKey);
                } else if (isNumericOption(optionKey)) {
                    updateNumericOption(optionKey, -1);
                }
                return;
            }
            if (key.rightArrow) {
                if (isBooleanOption(optionKey)) {
                    toggleBooleanOption(optionKey);
                } else if (isNumericOption(optionKey)) {
                    updateNumericOption(optionKey, 1);
                }
                return;
            }
        }
    });

    const statusColor = resolveStatusColor(statusState.mode, statusState.tone);
    const statusText = statusState.mode === 'progress'
        ? `${SPINNER_FRAMES[spinnerFrameIndex]} ${statusState.label}`
        : statusState.message;

    return h(
        Box,
        {flexDirection: 'column'},
        h(
            Box,
            {},
            h(Text, {bold: true}, TABS.map(tabKey => buildTabText(tabKey, activeTab)).join('  ')),
            h(Spacer, {}),
            h(Text, {dimColor: true}, buildHeaderMetaText(activeTab))
        ),
        h(Text, {dimColor: true}, buildDividerLine()),
        activeTab === 'run'
            ? h(
                Box,
                {flexDirection: 'column', gap: 1},
                h(
                    Box,
                    {gap: 1},
                    h(ActionMenu, {selectedIndex: runMenuIndex}),
                    h(TargetPanel, {
                        paths: requestState.sourcePaths,
                        inputMode: sourceInputMode,
                        inputValue: sourceInputValue
                    })
                ),
                h(
                    Box,
                    {gap: 1},
                    h(RequestSummaryPanel, {requestState}),
                    h(ResultPanel, {summary: lastSummary})
                )
            )
            : activeTab === 'options'
                ? h(
                    Box,
                    {gap: 1},
                    h(OptionList, {
                        requestState,
                        selectedIndex: optionIndex,
                        outputInputMode,
                        outputInputValue
                    }),
                    h(RequestSummaryPanel, {requestState})
                )
                : h(HistoryPanel, {historyItems}),
        h(Text, {dimColor: true}, buildDividerLine()),
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

function describeOptionValue(optionKey, requestState, outputInputMode, outputInputValue) {
    if (optionKey === 'outputDir') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: outputInputMode
                ? (outputInputValue || '')
                : (requestState.outputDir || t('tui.optionValue.emptyOutputDir'))
        };
    }

    if (optionKey === 'quality') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: String(requestState.quality)
        };
    }

    if (optionKey === 'maxWidth' || optionKey === 'maxHeight') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: requestState[optionKey] > 0 ? String(requestState[optionKey]) : t('tui.optionValue.off')
        };
    }

    if (optionKey === 'concurrency') {
        return {
            key: optionKey,
            label: t(`tui.options.${optionKey}`),
            value: requestState.concurrency > 0 ? String(requestState.concurrency) : t('tui.optionValue.auto')
        };
    }

    return {
        key: optionKey,
        label: t(`tui.options.${optionKey}`),
        value: requestState[optionKey] ? t('tui.optionValue.on') : t('tui.optionValue.off')
    };
}

function isBooleanOption(optionKey) {
    return ['recursive', 'overwrite', 'allowLarger', 'dryRun'].includes(optionKey);
}

function isNumericOption(optionKey) {
    return ['quality', 'maxWidth', 'maxHeight', 'concurrency'].includes(optionKey);
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export async function startImageCompressTui() {
    if (process.env.SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION === 'exit') {
        return;
    }

    const ink = render(h(ImageCompressTuiApp, {}), {
        alternateScreen: true,
        exitOnCtrlC: true
    });

    await ink.waitUntilExit();
}
