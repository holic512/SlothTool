/**
 * @file SlothVaultMcpTui
 * @project SlothTool
 * @module SlothVault MCP Plugin / TUI
 * @description Read-only Ink interface for connection state, live capabilities, history, and profiles.
 * @author MengJiaXu
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getConfigSummary} from './config.js';
import {listHistory} from './history.js';
import {inspectServer} from './service.js';
import {formatSlothVaultError, t} from './i18n.js';

const h = React.createElement;
const TABS = ['status', 'capabilities', 'history', 'profiles'];
const COLORS = {
    accent: 'cyan',
    border: 'blue',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: 'gray'
};

/** Resolve stable responsive dimensions for tests and narrow terminals. */
export function resolveSlothVaultTuiLayout(columns = 80, rows = 24) {
    return {
        columns: Math.max(40, Number(columns) || 80),
        rows: Math.max(16, Number(rows) || 24),
        compact: (Number(columns) || 80) < 78,
        listLimit: Math.max(3, Math.min(12, (Number(rows) || 24) - 12))
    };
}

/** Constrain terminal text to the available width without resizing the layout. */
function truncate(value, maxLength) {
    const text = String(value ?? '');
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
}

/** Draw one reusable rounded panel. */
function Panel({title, children, grow = false, color = COLORS.border}) {
    return h(
        Box,
        {borderStyle: 'round', borderColor: color, paddingX: 1, flexDirection: 'column', flexGrow: grow ? 1 : 0},
        h(Text, {bold: true, color: COLORS.accent}, title),
        children
    );
}

/** Draw one compact label/value row. */
function Field({label, value, color, dim = false}) {
    return h(
        Box,
        {},
        h(Text, {color: COLORS.accent}, `${label}: `),
        h(Text, {color, dimColor: dim}, String(value || '-'))
    );
}

/** Build the fixed-width tab strip without changing panel geometry. */
function tabText(activeTab) {
    return TABS.map(tab => tab === activeTab ? `[${t(`tui.tabs.${tab}`)}]` : t(`tui.tabs.${tab}`)).join('  ');
}

/** Flatten discovered capability groups into one selectable read-only list. */
function capabilityItems(discovery) {
    return [
        ...(discovery?.tools || []).map(value => ({kind: 'tool', value})),
        ...(discovery?.prompts || []).map(value => ({kind: 'prompt', value})),
        ...(discovery?.resourceTemplates || []).map(value => ({kind: 'resource', value}))
    ];
}

/** Return a stable display name for one discovered capability. */
function capabilityName(item) {
    return item?.value?.name || item?.value?.uriTemplate || item?.value?.uri || '-';
}

/** Return the live risk classification for one capability item. */
function capabilityRisk(item) {
    if (item?.kind !== 'tool') {
        return '-';
    }
    return item.value.annotations?.readOnlyHint === true ? t('readOnly') : t('write');
}

/** Calculate a moving list window that keeps the selected item visible. */
function listWindow(items, selectedIndex, limit) {
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(limit / 2), Math.max(0, items.length - limit)));
    return {start, items: items.slice(start, start + limit)};
}

/** Render connection status and the active profile without exposing its key. */
function StatusPage({config, discovery, loading, error, width}) {
    const profile = discovery?.profile || config.profiles.find(item => item.isDefault) || null;
    return h(
        Box,
        {flexDirection: 'column'},
        h(
            Panel,
            {title: t('tui.panels.connection'), color: error ? COLORS.danger : discovery ? COLORS.success : COLORS.border},
            h(Field, {label: t('tui.labels.status'), value: loading ? t('tui.status.loading') : error ? t('error') : discovery ? t('ok') : t('tui.status.ready'), color: error ? COLORS.danger : discovery ? COLORS.success : COLORS.warning}),
            h(Field, {label: t('tui.labels.profile'), value: profile?.name || config.defaultProfile || '-'}),
            h(Field, {label: t('tui.labels.endpoint'), value: truncate(profile?.endpoint || '-', width - 16)}),
            h(Field, {label: t('tui.labels.server'), value: discovery?.server?.name || '-'}),
            h(Field, {label: t('tui.labels.version'), value: discovery?.server?.version || '-'}),
            h(Field, {label: t('tui.labels.protocol'), value: discovery?.server?.protocolVersion || discovery?.protocolVersion || '-'})
        ),
        profile?.endpoint?.startsWith('http://')
            ? h(Text, {color: COLORS.warning}, t('httpWarning'))
            : null,
        error ? h(Text, {color: COLORS.danger}, truncate(error, width - 4)) : null,
        h(Text, {dimColor: true}, t('tui.help'))
    );
}

/** Render the combined live capability catalog and selected definition. */
function CapabilitiesPage({discovery, selectedIndex, layout}) {
    const items = capabilityItems(discovery);
    const selected = items[selectedIndex] || null;
    const start = Math.max(0, Math.min(selectedIndex - Math.floor(layout.listLimit / 2), Math.max(0, items.length - layout.listLimit)));
    const visible = items.slice(start, start + layout.listLimit);
    const list = visible.length
        ? visible.map((item, offset) => {
            const absoluteIndex = start + offset;
            const marker = absoluteIndex === selectedIndex ? '›' : ' ';
            return h(Text, {key: `${item.kind}:${capabilityName(item)}`, color: absoluteIndex === selectedIndex ? COLORS.accent : undefined}, `${marker} ${item.kind.padEnd(8)} ${truncate(capabilityName(item), layout.columns - 18)}`);
        })
        : [h(Text, {key: 'empty', dimColor: true}, t('tui.empty'))];
    const detail = selected?.value || null;
    return h(
        Box,
        {flexDirection: layout.compact ? 'column' : 'row'},
        h(Panel, {title: `${t('tui.tabs.capabilities')} (${items.length})`, grow: true}, ...list),
        h(
            Panel,
            {title: t('tui.panels.details'), grow: true},
            h(Field, {label: t('tui.labels.name'), value: truncate(capabilityName(selected), Math.floor(layout.columns / (layout.compact ? 1 : 2)) - 14)}),
            h(Field, {label: t('tui.labels.risk'), value: capabilityRisk(selected), color: capabilityRisk(selected) === t('write') ? COLORS.warning : undefined}),
            h(Field, {label: t('tui.labels.description'), value: truncate(detail?.description || '-', Math.floor(layout.columns / (layout.compact ? 1 : 2)) - 18)}),
            h(Field, {label: t('tui.labels.uri'), value: truncate(detail?.uriTemplate || detail?.uri || '-', Math.floor(layout.columns / (layout.compact ? 1 : 2)) - 10)})
        )
    );
}

/** Render the redacted local history list and selected metadata. */
function HistoryPage({history, selectedIndex, layout}) {
    const selected = history[selectedIndex] || null;
    const visible = listWindow(history, selectedIndex, layout.listLimit);
    return h(
        Box,
        {flexDirection: layout.compact ? 'column' : 'row'},
        h(
            Panel,
            {title: t('tui.panels.recent'), grow: true},
            ...(visible.items.length ? visible.items.map((entry, index) => {
                const absoluteIndex = visible.start + index;
                return h(Text, {key: entry.id, color: absoluteIndex === selectedIndex ? COLORS.accent : undefined}, `${absoluteIndex === selectedIndex ? '›' : ' '} ${entry.success ? 'OK' : 'ERR'} ${truncate(`${entry.operation} ${entry.name || ''}`, layout.columns - 18)}`);
            }) : [h(Text, {key: 'empty', dimColor: true}, t('historyEmpty'))])
        ),
        h(
            Panel,
            {title: t('tui.panels.details'), grow: true},
            h(Field, {label: 'ID', value: selected?.id || '-'}),
            h(Field, {label: t('tui.labels.profile'), value: selected?.profile || '-'}),
            h(Field, {label: t('tui.labels.risk'), value: selected?.risk || '-'}),
            h(Field, {label: t('tui.labels.status'), value: selected ? selected.success ? t('ok') : t('error') : '-'}),
            h(Text, {dimColor: true}, truncate(selected?.summary || '-', Math.floor(layout.columns / (layout.compact ? 1 : 2)) - 6))
        )
    );
}

/** Render stored profile metadata with every key masked. */
function ProfilesPage({config, selectedIndex, layout}) {
    const profiles = config.profiles || [];
    const selected = profiles[selectedIndex] || null;
    const visible = listWindow(profiles, selectedIndex, layout.listLimit);
    return h(
        Box,
        {flexDirection: layout.compact ? 'column' : 'row'},
        h(
            Panel,
            {title: `${t('tui.tabs.profiles')} (${profiles.length})`, grow: true},
            ...(visible.items.length ? visible.items.map((profile, index) => {
                const absoluteIndex = visible.start + index;
                return h(Text, {key: profile.name, color: absoluteIndex === selectedIndex ? COLORS.accent : undefined}, `${absoluteIndex === selectedIndex ? '›' : ' '} ${profile.name}${profile.isDefault ? ' *' : ''}`);
            }) : [h(Text, {key: 'empty', dimColor: true}, t('noProfile'))])
        ),
        h(
            Panel,
            {title: t('tui.panels.profile'), grow: true},
            h(Field, {label: t('tui.labels.profile'), value: selected?.name || '-'}),
            h(Field, {label: t('tui.labels.endpoint'), value: truncate(selected?.endpoint || '-', Math.floor(layout.columns / (layout.compact ? 1 : 2)) - 14)}),
            h(Field, {label: t('tui.labels.key'), value: selected?.apiKey || '-'}),
            h(Field, {label: t('tui.labels.timeout'), value: selected ? `${selected.timeoutMs} ms` : '-'}),
            selected?.endpoint?.startsWith('http://') ? h(Text, {color: COLORS.warning}, t('httpWarning')) : null
        )
    );
}

/** Provide the read-only application state machine and keyboard navigation. */
export function SlothVaultTuiApp({layoutOverride = null, initialDiscovery = null} = {}) {
    const app = useApp();
    const windowSize = useWindowSize();
    const layout = layoutOverride || resolveSlothVaultTuiLayout(windowSize.columns, windowSize.rows);
    const [activeTab, setActiveTab] = useState('status');
    const [selectedIndices, setSelectedIndices] = useState({capabilities: 0, history: 0, profiles: 0});
    const [config, setConfig] = useState(() => getConfigSummary());
    const [history, setHistory] = useState(() => listHistory({limit: 50}));
    const [discovery, setDiscovery] = useState(initialDiscovery);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState(t('tui.status.ready'));

    /** Refresh local display data and perform exactly one remote discovery connection. */
    async function refresh() {
        // Step 0: Refresh local redacted configuration and history snapshots.
        setConfig(getConfigSummary());
        setHistory(listHistory({limit: 50}));
        setLoading(true);
        setError('');
        setStatus(t('tui.status.loading'));

        // Step 1: Discover every remote capability through one initialized MCP client.
        try {
            const result = await inspectServer({recordHistory: false});
            setDiscovery(result);
            setStatus(t('tui.status.refreshed'));
        } catch (refreshError) {
            const message = formatSlothVaultError(refreshError);
            setDiscovery(null);
            setError(message);
            setStatus(t('tui.status.failed', {message}));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (process.env.SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION === 'render-exit') {
            app.exit();
            return;
        }
        if (!initialDiscovery) {
            void refresh();
        }
    }, []);

    const itemCounts = useMemo(() => ({
        capabilities: capabilityItems(discovery).length,
        history: history.length,
        profiles: config.profiles.length
    }), [config.profiles.length, discovery, history.length]);

    useInput((input, key) => {
        if (input === 'q') {
            app.exit();
            return;
        }
        if (input === 'r' && !loading) {
            void refresh();
            return;
        }
        if (key.tab || key.rightArrow) {
            setActiveTab(tab => TABS[(TABS.indexOf(tab) + 1) % TABS.length]);
            return;
        }
        if (key.leftArrow) {
            setActiveTab(tab => TABS[(TABS.indexOf(tab) - 1 + TABS.length) % TABS.length]);
            return;
        }
        if ((key.upArrow || key.downArrow) && activeTab !== 'status') {
            setSelectedIndices(current => {
                const count = itemCounts[activeTab] || 0;
                const delta = key.upArrow ? -1 : 1;
                return {...current, [activeTab]: count ? (current[activeTab] + delta + count) % count : 0};
            });
        }
    });

    const content = activeTab === 'status'
        ? h(StatusPage, {config, discovery, loading, error, width: layout.columns})
        : activeTab === 'capabilities'
            ? h(CapabilitiesPage, {discovery, selectedIndex: selectedIndices.capabilities, layout})
            : activeTab === 'history'
                ? h(HistoryPage, {history, selectedIndex: selectedIndices.history, layout})
                : h(ProfilesPage, {config, selectedIndex: selectedIndices.profiles, layout});

    return h(
        Box,
        {flexDirection: 'column', width: layout.columns},
        h(Box, {}, h(Text, {bold: true, color: COLORS.accent}, `SlothVault MCP ${pluginPackage.version}`), h(Spacer), h(Text, {}, tabText(activeTab))),
        h(Text, {dimColor: true}, '─'.repeat(Math.max(1, layout.columns - 1))),
        content,
        h(Spacer),
        h(Text, {color: error ? COLORS.danger : loading ? COLORS.warning : COLORS.success}, truncate(status, layout.columns - 1)),
        h(Text, {inverse: true}, truncate(t('tui.footer'), layout.columns - 1))
    );
}

/** Render the plugin in an isolated alternate terminal screen. */
export async function startSlothVaultTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION === 'exit') {
        return;
    }
    const instance = render(h(SlothVaultTuiApp), {alternateScreen: true, exitOnCtrlC: true});
    await instance.waitUntilExit();
}

export default {SlothVaultTuiApp, resolveSlothVaultTuiLayout, startSlothVaultTui};
