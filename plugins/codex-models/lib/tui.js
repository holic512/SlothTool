/**
 * @file CodexModelsTui
 * @project SlothTool
 * @module Codex Models Plugin / TUI
 * @description 提供跨厂商模型库渲染、模型与推理等级切换、目录同步和 Desktop 离线修复脚本生成的全屏界面。
 * @logic 1. 加载共享诊断与模型元数据；2. 上下键选择模型、左右键切换该模型支持的推理等级；3. 写配置前要求确认；4. 所有 LevelDB 修改仅通过生成的独立脚本执行。
 * @dependencies Libraries: react, ink; Services: ./service.js; I18N: ./i18n.js
 * @index_tags codex, TUI, model library, model picker, reasoning effort, catalog sync, desktop repair
 * @author holic512
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Box, Text, render, useApp, useInput} from 'ink';
import {createDesktopRepairScript, inspectCodexModels, setCodexModel, syncModelCatalog} from './service.js';
import {t} from './i18n.js';

const h = React.createElement;

function clamp(value, length) {
    if (length <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(value, length - 1));
}

function Detail({label, value, color}) {
    return h(Box, {gap: 1}, h(Text, {bold: true}, label), h(Text, {color}, value || '-'));
}

function formatContext(value) {
    return Number(value || 0).toLocaleString('en-US');
}

function App() {
    const app = useApp();
    const [result, setResult] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [effortByModel, setEffortByModel] = useState({});
    const [pending, setPending] = useState(null);
    const [status, setStatus] = useState(t('tuiLoading'));
    const [busy, setBusy] = useState(true);

    const reload = useCallback(async () => {
        setBusy(true);
        setStatus(t('tuiLoading'));
        try {
            const next = await inspectCodexModels();
            setResult(next);
            setSelectedIndex(current => {
                if (!result) {
                    const activeIndex = next.models.findIndex(item => item.id === next.model);
                    return activeIndex >= 0 ? activeIndex : 0;
                }
                return clamp(current, next.models.length);
            });
            setEffortByModel(current => {
                const updated = {...current};
                for (const model of next.models) {
                    if (!model.reasoningEfforts.includes(updated[model.id])) {
                        updated[model.id] = model.id === next.model && model.reasoningEfforts.includes(next.reasoningEffort)
                            ? next.reasoningEffort
                            : model.defaultReasoningEffort;
                    }
                }
                return updated;
            });
            setStatus(t('tuiLoaded', {count: next.models.length}));
        } catch (error) {
            setStatus(error.message);
        } finally {
            setBusy(false);
        }
    }, [result]);

    useEffect(() => {
        reload();
    }, []);

    const runConfirmedAction = useCallback(action => {
        setPending(null);
        setBusy(true);
        if (action.type === 'catalog') {
            syncModelCatalog()
                .then(summary => {
                    setStatus(t('catalogSynced', {count: summary.modelCount, path: summary.catalogPath}));
                    return reload();
                })
                .catch(error => setStatus(error.message))
                .finally(() => setBusy(false));
            return;
        }
        setCodexModel(action.model, {reasoningEffort: action.effort})
            .then(summary => {
                setStatus(t('modelAndReasoningSet', {model: summary.model, effort: summary.reasoningEffort}));
                return reload();
            })
            .catch(error => setStatus(error.message))
            .finally(() => setBusy(false));
    }, [reload]);

    useInput((input, key) => {
        if (input === 'q' || key.escape) {
            app.exit();
            return;
        }
        if (pending) {
            if (input.toLowerCase() === 'y') {
                runConfirmedAction(pending);
            } else {
                setPending(null);
                setStatus(t('tuiCancelled'));
            }
            return;
        }
        if (busy || !result) {
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(current => clamp(current - 1, result.models.length));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(current => clamp(current + 1, result.models.length));
            return;
        }
        const selected = result.models[selectedIndex];
        if (input === 'd') {
            reload();
            return;
        }
        if (input === 'c') {
            const action = {type: 'catalog'};
            setPending(action);
            setStatus(t('tuiConfirmCatalog', {count: result.models.length}));
            return;
        }
        if (!selected) {
            return;
        }
        const selectedEffort = effortByModel[selected.id] || selected.defaultReasoningEffort;
        if (key.leftArrow || key.rightArrow) {
            const currentIndex = Math.max(0, selected.reasoningEfforts.indexOf(selectedEffort));
            const delta = key.leftArrow ? -1 : 1;
            const nextIndex = (currentIndex + delta + selected.reasoningEfforts.length) % selected.reasoningEfforts.length;
            setEffortByModel(current => ({...current, [selected.id]: selected.reasoningEfforts[nextIndex]}));
            return;
        }
        if (key.return) {
            const action = {type: 'model', model: selected.id, effort: selectedEffort};
            setPending(action);
            setStatus(t('tuiConfirmModel', action));
            return;
        }
        if (input === 'r') {
            try {
                const script = createDesktopRepairScript(selected.id);
                setStatus(t('repairCreated', {path: script.outputPath}));
            } catch (error) {
                setStatus(error.message);
            }
        }
    });

    const selected = result?.models[selectedIndex];
    const selectedEffort = selected ? (effortByModel[selected.id] || selected.defaultReasoningEffort) : '';
    const models = result?.models || [];
    const start = Math.max(0, Math.min(selectedIndex - 5, Math.max(0, models.length - 11)));
    return h(
        Box,
        {flexDirection: 'column', paddingX: 1, paddingY: 1},
        h(Text, {bold: true, color: 'cyan'}, t('title')),
        result
            ? h(Box, {flexDirection: 'column', marginTop: 1},
                h(Detail, {label: t('model', {value: ''}), value: result.model}),
                h(Detail, {label: t('reasoningEffort', {value: ''}), value: result.reasoningEffort, color: result.activeReasoningSupported ? 'green' : 'yellow'}),
                h(Detail, {label: t('provider', {value: ''}), value: result.modelProvider}),
                h(Detail, {label: t('baseUrl', {value: ''}), value: result.baseUrl}),
                h(Detail, {label: t('catalog', {value: ''}), value: result.catalogPath || '-'}),
                h(Text, {color: result.activeModelAvailable ? 'green' : 'yellow'}, t('activeAvailable', {value: result.activeModelAvailable ? t('yes') : t('no')})),
                h(Text, {color: result.activeModelInCatalog ? 'green' : 'yellow'}, t('activeCatalog', {value: result.activeModelInCatalog ? t('yes') : t('no')}))
            )
            : null,
        h(Box, {borderStyle: 'round', flexDirection: 'column', marginTop: 1, paddingX: 1},
            h(Text, {bold: true}, t('models', {count: models.length})),
            ...models.slice(start, start + 11).map(model => h(
                Text,
                {key: model.id, color: model.id === selected?.id ? 'cyan' : undefined},
                `${model.id === selected?.id ? '> ' : '  '}${model.displayName} [${model.vendor}] (${model.id})`
            ))
        ),
        selected
            ? h(Box, {borderStyle: 'single', flexDirection: 'column', marginTop: 1, paddingX: 1},
                h(Text, {bold: true, color: 'magenta'}, `${t('selectedModel')}: ${selected.displayName}`),
                h(Detail, {label: t('libraryVendor', {value: ''}), value: selected.vendor}),
                h(Detail, {label: t('libraryFamily', {value: ''}), value: selected.family}),
                h(Detail, {label: t('libraryContext', {value: ''}), value: formatContext(selected.contextWindow)}),
                h(Detail, {label: t('libraryEfforts', {value: ''}), value: selected.reasoningEfforts.join(' / ')}),
                h(Detail, {label: t('librarySelectedEffort', {value: ''}), value: `← ${selectedEffort} →`, color: 'cyan'}),
                h(Detail, {label: t('librarySearch', {value: ''}), value: selected.supportsSearchTool ? t('yes') : t('no')}),
                h(Detail, {label: t('libraryModalities', {value: ''}), value: selected.inputModalities.join(', ')}),
                h(Detail, {label: t('librarySource', {value: ''}), value: selected.metadataSource}),
                h(Detail, {label: t('libraryVerified', {value: ''}), value: selected.metadataVerified ? t('yes') : t('no')})
            )
            : null,
        h(Box, {flexDirection: 'column', marginTop: 1},
            h(Text, {color: pending ? 'yellow' : (busy ? 'yellow' : 'green')}, t('tuiStatus', {value: status})),
            h(Text, {dimColor: true}, t('repairNotice')),
            h(Text, {dimColor: true}, t('tuiFooter'))
        )
    );
}

export async function interactiveMain() {
    if (process.env.SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION === 'exit') {
        return;
    }
    const ink = render(h(App), {alternateScreen: true});
    await ink.waitUntilExit();
}
