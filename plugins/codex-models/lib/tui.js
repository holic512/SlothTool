/**
 * @file CodexModelsTui
 * @project SlothTool
 * @module Codex Models Plugin / TUI
 * @description 提供与 loc/脚手架一致的跨厂商模型库、推理等级切换、目录同步和 Desktop 修复脚本全屏界面。
 * @logic 1. 用顶部 tab、分割线、圆角主从面板和底部状态栏构成统一外壳；2. 上下键选择模型、左右键切换推理等级；3. 写配置前要求确认；4. LevelDB 修改仅通过独立脚本执行。
 * @dependencies Libraries: react, ink; Services: ./service.js; I18N: ./i18n.js
 * @index_tags codex, TUI, model library, model picker, reasoning effort, catalog sync, desktop repair
 * @author holic512
 */

import React, {useCallback, useEffect, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {createDesktopRepairScript, inspectCodexModels, setCodexModel, syncModelCatalog} from './service.js';
import {t} from './i18n.js';

const h = React.createElement;
const TABS = ['models', 'diagnosis'];
const COLORS = {accent: 'cyanBright', secondary: 'magentaBright', success: 'greenBright', warning: 'yellowBright', danger: 'redBright', muted: 'gray', border: 'gray'};

export function resolveCodexModelsTuiLayout(columns = 80, rows = 24) {
    const safeColumns = Math.max(1, Number(columns) || 80);
    const safeRows = Math.max(1, Number(rows) || 24);
    return {
        columns: safeColumns,
        rows: safeRows,
        contentWidth: Math.max(1, safeColumns - 4),
        compact: safeColumns < 82,
        tooSmall: safeColumns < 30 || safeRows < 14,
        listWidth: Math.max(32, Math.min(48, Math.floor((safeColumns - 5) * 0.48))),
        modelLimit: safeRows < 20 ? 5 : 9
    };
}

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

function PanelHeader({title, summary, badge, badgeColor = COLORS.accent}) {
    return h(Box, {}, h(Text, {bold: true, color: COLORS.accent}, title), badge ? h(Text, {bold: true, color: badgeColor}, `  [${badge}]`) : null, h(Spacer, {}), summary ? h(Text, {dimColor: true}, summary) : null);
}

function Header({activeTab}) {
    return h(Box, {},
        h(Box, {}, ...TABS.flatMap((tab, index) => [
            index ? h(Text, {key: `${tab}-separator`, dimColor: true}, ' | ') : null,
            h(Text, {key: tab, bold: tab === activeTab, color: tab === activeTab ? COLORS.accent : COLORS.muted}, tab === activeTab ? `[${t(`tui.tabs.${tab}`)}]` : t(`tui.tabs.${tab}`))
        ]).filter(Boolean)),
        h(Spacer, {}),
        h(Text, {dimColor: true}, `「v${pluginPackage.version}」`)
    );
}

function ModelList({models, selected, start, limit}) {
    return h(Box, {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column'},
        h(PanelHeader, {title: t('tui.panels.models'), summary: `${models.length}`}),
        ...models.slice(start, start + limit).map(model => h(Box, {key: model.id},
            h(Text, {bold: model.id === selected?.id, color: model.id === selected?.id ? COLORS.accent : COLORS.muted}, model.id === selected?.id ? '› ' : '  '),
            h(Text, {bold: model.id === selected?.id, color: model.id === selected?.id ? COLORS.accent : 'white', dimColor: model.id !== selected?.id}, model.displayName),
            h(Spacer, {}),
            h(Text, {color: COLORS.secondary, dimColor: model.id !== selected?.id}, model.vendor)
        ))
    );
}

function ModelDetail({selected, selectedEffort}) {
    return h(Box, {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: selected?.displayName || t('selectedModel'), badge: selectedEffort, badgeColor: COLORS.secondary}),
        selected ? h(React.Fragment, {},
            h(Detail, {label: t('libraryFamily', {value: ''}), value: selected.family}),
            h(Detail, {label: t('libraryContext', {value: ''}), value: formatContext(selected.contextWindow), color: COLORS.accent}),
            h(Detail, {label: t('libraryEfforts', {value: ''}), value: selected.reasoningEfforts.join(' / ')}),
            h(Detail, {label: t('librarySelectedEffort', {value: ''}), value: `← ${selectedEffort} →`, color: COLORS.secondary}),
            h(Detail, {label: t('librarySearch', {value: ''}), value: selected.supportsSearchTool ? t('yes') : t('no'), color: selected.supportsSearchTool ? COLORS.success : COLORS.warning}),
            h(Detail, {label: t('libraryModalities', {value: ''}), value: selected.inputModalities.join(', ')}),
            h(Detail, {label: t('librarySource', {value: ''}), value: selected.metadataSource})
        ) : h(Text, {dimColor: true}, t('tui.empty'))
    );
}

function DiagnosisPanel({result}) {
    return h(Box, {borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(PanelHeader, {title: t('doctorTitle'), badge: result?.activeModelAvailable ? t('yes') : t('no'), badgeColor: result?.activeModelAvailable ? COLORS.success : COLORS.warning}),
        result ? h(React.Fragment, {},
            h(Detail, {label: t('model', {value: ''}), value: result.model}),
            h(Detail, {label: t('reasoningEffort', {value: ''}), value: result.reasoningEffort, color: result.activeReasoningSupported ? COLORS.success : COLORS.warning}),
            h(Detail, {label: t('provider', {value: ''}), value: result.modelProvider}),
            h(Detail, {label: t('baseUrl', {value: ''}), value: result.baseUrl}),
            h(Detail, {label: t('catalog', {value: ''}), value: result.catalogPath || '-'}),
            h(Detail, {label: t('activeAvailable', {value: ''}), value: result.activeModelAvailable ? t('yes') : t('no'), color: result.activeModelAvailable ? COLORS.success : COLORS.warning}),
            h(Detail, {label: t('activeCatalog', {value: ''}), value: result.activeModelInCatalog ? t('yes') : t('no'), color: result.activeModelInCatalog ? COLORS.success : COLORS.warning})
        ) : null
    );
}

export function CodexModelsTuiApp({layoutOverride = null, initialTab = 'models', initialResult = null} = {}) {
    const app = useApp();
    const {columns, rows} = useWindowSize();
    const layout = layoutOverride || resolveCodexModelsTuiLayout(columns, rows);
    const [activeTab, setActiveTab] = useState(TABS.includes(initialTab) ? initialTab : 'models');
    const [result, setResult] = useState(initialResult);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [effortByModel, setEffortByModel] = useState({});
    const [pending, setPending] = useState(null);
    const [status, setStatus] = useState(initialResult ? t('tuiLoaded', {count: initialResult.models.length}) : t('tuiLoading'));
    const [busy, setBusy] = useState(!initialResult);

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
        if (!initialResult) {
            reload();
        }
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
        if (input === 'q') {
            app.exit();
            return;
        }
        if (key.tab) {
            setActiveTab(tab => tab === 'models' ? 'diagnosis' : 'models');
            return;
        }
        if (key.escape) {
            setActiveTab('models');
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
        if (activeTab !== 'models') {
            if (input === 'd') {
                reload();
            }
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
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(layout.modelLimit / 2), Math.max(0, models.length - layout.modelLimit)));
    if (layout.tooSmall) {
        return h(Box, {borderStyle: 'round', borderColor: COLORS.warning, paddingX: 1, flexDirection: 'column'}, h(Text, {bold: true, color: COLORS.warning}, t('tui.resize.title')), h(Text, {}, t('tui.resize.description')));
    }

    const modelList = h(ModelList, {models, selected, start, limit: layout.modelLimit});
    const modelDetail = h(ModelDetail, {selected, selectedEffort});
    const modelsContent = layout.compact
        ? h(Box, {flexDirection: 'column', flexGrow: 1}, h(Box, {marginBottom: 1, flexDirection: 'column'}, modelList), modelDetail)
        : h(Box, {flexDirection: 'row', flexGrow: 1}, h(Box, {width: layout.listWidth, marginRight: 1, flexDirection: 'column'}, modelList), modelDetail);
    const tone = pending || busy ? COLORS.warning : COLORS.success;
    return h(
        Box,
        {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(Header, {activeTab}),
        h(Box, {marginY: 1}, h(Text, {color: COLORS.muted}, '─'.repeat(layout.contentWidth))),
        h(Box, {flexGrow: 1}, activeTab === 'models' ? modelsContent : h(DiagnosisPanel, {result})),
        h(Box, {marginTop: 1}, h(Text, {color: tone}, t('tuiStatus', {value: status})), h(Spacer, {}), h(Text, {dimColor: true}, t(`tui.footer.${activeTab}`)))
    );
}

export async function interactiveMain() {
    if (process.env.SLOTHTOOL_CODEX_MODELS_TUI_TEST_ACTION === 'exit') {
        return;
    }
    const ink = render(h(CodexModelsTuiApp), {alternateScreen: true, exitOnCtrlC: true});
    await ink.waitUntilExit();
}
