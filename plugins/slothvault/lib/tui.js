/**
 * @file SlothVaultMcpTui
 * @project SlothTool
 * @module SlothVault UI adapter / MCP page
 * @description Ink interface for read-only MCP inspection and local Profile management through the Vault runtime protocol.
 * @logic 根据共享外壳预算展示列表、表单及可重排详情；1. 展示远端只读发现与脱敏历史；2. 管理不加载原始 Key 的本地 Profile；3. 将 Skill 管理限定在 SlothVault 多功能主入口。
 * @dependencies React/Ink, Runtime Adapter/I18N
 * @index_tags slothvault,mcp,tui,profile,read-only
 * @author holic512
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, usePaste, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {editText, editorViewport, graphemes, nextTabIndex, statusSymbol, truncateFromRight, wrapText} from './shared-interaction.js';
import {
    addProfile,
    getConfigSummary,
    removeProfile,
    updateProfile,
    useProfile,
    listHistory,
    inspectServer,
    setupConnection,
    updateMcpClient,
} from './runtime-adapter.js';
import {setupResultText} from './setup-cli.js';
import {formatSlothVaultError, t} from './i18n.js';

import {TuiFrame, TuiHeader, TuiDetails} from './terminal-ui.js';
import {getShellLayout, getDetailWindow, getDisplayWidth} from './shared-interaction.js';

const h = React.createElement;
const TABS = ['status', 'capabilities', 'history', 'profiles'];
const PROFILE_FORM_FIELDS = {
    setup: ['endpoint', 'apiKey'],
    add: ['name', 'endpoint', 'timeoutMs', 'apiKey', 'makeDefault'],
    edit: ['endpoint', 'timeoutMs', 'apiKey', 'makeDefault']
};
const PROFILE_FIELD_LIMITS = {
    name: 64,
    endpoint: 2048,
    timeoutMs: 9,
    apiKey: 512
};
const COLORS = {accent: undefined, border: undefined, success: 'green', warning: 'yellow', danger: 'red', muted: undefined};

/** Resolve stable responsive dimensions for tests and narrow terminals. */
export function resolveSlothVaultTuiLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80);
    const height = Math.max(1, Number(rows) || 24);
    return {
        columns: width,
        rows: height,
        compact: width < 78,
        tooSmall: width < 40 || height < 16,
        listLimit: Math.max(1, Math.min(12, height - 12))
    };
}

/** Constrain terminal text to the available width without resizing the layout. */
const truncate = truncateFromRight;

/** Draw one reusable rounded panel. */
function Panel({title, children, layout, color = COLORS.border}) {
    return h(Box, {height: layout.contentHeight, width: layout.contentWidth, flexShrink: 0,
        borderStyle: 'round', paddingX: 1, flexDirection: 'column'},
    h(Text, {bold: true, color: COLORS.accent, wrap: 'truncate-end'}, title),
    h(Box, {height: Math.max(1, layout.contentHeight - 3), flexShrink: 0, flexDirection: 'column', overflow: 'hidden'}, children));
}

function Field({label, value, color, dim = false}) {
    return h(Box, {height: 1, flexShrink: 0}, h(Box, {flexShrink: 0}, h(Text, {color: COLORS.accent}, `${label}: `)),
        h(Text, {color, dimColor: false, wrap: 'truncate-end'}, String(value || '-')));
}

function CatalogPair({layout, items, selectedIndex, title, detailTitle, renderItem, details}) {
    if (layout.compact && layout.contentHeight < 9) return h(Panel, {title: detailTitle, layout}, ...details);
    const leftHeight = layout.compact ? Math.max(4, layout.contentHeight - 8) : layout.contentHeight;
    const leftWidth = layout.compact ? layout.contentWidth : Math.floor((layout.contentWidth - 1) / 2);
    const rightHeight = layout.compact ? layout.contentHeight - leftHeight - 1 : layout.contentHeight;
    const rightWidth = layout.compact ? layout.contentWidth : layout.contentWidth - leftWidth - 1;
    const visible = listWindow(items, selectedIndex, Math.max(1, leftHeight - 3));
    return h(Box, {height: layout.contentHeight, gap: 1, flexDirection: layout.compact ? 'column' : 'row'},
        h(Panel, {title: `${title} (${items.length})`, layout: {...layout, contentHeight: leftHeight, contentWidth: leftWidth}},
            ...(visible.items.length ? visible.items.map((item, index) => h(Text, {
                key: visible.start + index, bold: visible.start + index === selectedIndex,
                inverse: visible.start + index === selectedIndex,
                color: visible.start + index === selectedIndex ? COLORS.accent : undefined, wrap: 'truncate-end'
            }, `${visible.start + index === selectedIndex ? '› ' : '  '}${renderItem(item)}`))
                : [h(Text, {key: 'empty', dimColor: false}, t('tui.empty'))])),
        h(Panel, {title: detailTitle, layout: {...layout, contentHeight: rightHeight, contentWidth: rightWidth}}, ...details));
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

/** Build an empty add form or a secret-free edit form from masked profile metadata. */
function createProfileForm(mode, profile = null, profileCount = 0) {
    return {
        name: mode === 'add' ? '' : profile?.name || '',
        endpoint: mode === 'add' ? '' : profile?.endpoint || '',
        timeoutMs: String(profile?.timeoutMs ?? 30_000),
        apiKey: '',
        makeDefault: mode === 'add' && profileCount === 0,
        alreadyDefault: mode === 'edit' && Boolean(profile?.isDefault)
    };
}

/** Return the ordered fields for the active profile form. */
function profileFormFields(mode) {
    return PROFILE_FORM_FIELDS[mode] || [];
}

/** Resolve a localized label for one profile form field. */
function profileFieldLabel(field, mode) {
    const labels = {
        name: 'tui.labels.profile',
        endpoint: mode === 'setup' ? 'setup.urlLabel' : 'tui.labels.endpoint',
        timeoutMs: 'tui.labels.timeout',
        apiKey: mode === 'setup' ? 'setup.keyLabel' : mode === 'add' ? 'tui.labels.mcpKey' : 'tui.labels.newKey',
        makeDefault: 'tui.labels.makeDefault'
    };
    return t(labels[field] || field);
}

/** Render a profile form value without ever revealing typed or persisted credentials. */
function profileFieldValue(field, form, mode) {
    if (field === 'apiKey') {
        if (form.apiKey) {
            return t('tui.profile.keyEntered');
        }
        return mode === 'edit' ? t('tui.profile.keyUnchanged') : t('tui.profile.keyRequired');
    }
    if (field === 'makeDefault') {
        if (form.alreadyDefault) {
            return t('tui.profile.alreadyDefault');
        }
        return form.makeDefault ? '[x]' : '[ ]';
    }
    if (field === 'endpoint' && !form.endpoint) {
        return t('tui.profile.endpointPlaceholder');
    }
    return form[field] || t('tui.profile.emptyValue');
}

/** Render connection status and the active profile without exposing its key. */
function StatusPage({config, discovery, loading, error, compatibilityCode, layout}) {
    const profile = discovery?.profile || config.profiles.find(item => item.isDefault) || null;
    return h(Panel, {title: t('tui.panels.connection'), layout, color: error ? COLORS.danger : discovery ? COLORS.success : COLORS.border},
        h(Field, {label: t('tui.labels.status'), value: loading ? t('tui.status.loading') : error ? t('error') : discovery ? t('ok') : t('tui.status.ready')}),
        h(Field, {label: t('tui.labels.profile'), value: profile?.name || config.defaultProfile || '-'}),
        h(Field, {label: t('tui.labels.endpoint'), value: profile?.endpoint || '-'}),
        h(Field, {label: t('tui.labels.server'), value: discovery?.server?.name || '-'}),
        h(Field, {label: t('tui.labels.version'), value: discovery?.server?.version || '-'}),
        h(Field, {label: t('tui.labels.protocol'), value: discovery?.server?.protocolVersion || discovery?.protocolVersion || '-'}),
        h(Field, {label: t('tui.compatibilityLabel'), value: discovery?.compatibility?.status || '-'}),
        h(Field, {label: t('tui.minimumClientVersion'), value: discovery?.compatibility?.minimumClientVersion || t('tui.minimumUnverified')}),
        profile?.endpoint?.startsWith('http://') ? h(Text, {color: COLORS.warning, wrap: 'truncate-end'}, t('httpWarning')) : null,
        error ? h(Text, {wrap: 'truncate-end'}, '! ' + error) : null,
        compatibilityCode ? h(Text, {color: COLORS.warning}, t('tui.compatibilityUpdateHint')) : null,
        h(Text, {dimColor: false, wrap: 'truncate-end'}, t('tui.help')));
}

function CapabilitiesPage({discovery, selectedIndex, layout}) {
    const items = capabilityItems(discovery);
    const selected = items[selectedIndex];
    return h(CatalogPair, {layout, items, selectedIndex, title: t('tui.tabs.capabilities'), detailTitle: t('tui.panels.details'),
        renderItem: item => `${item.kind.padEnd(8)} ${capabilityName(item)}`, details: [
            h(Field, {key: 'name', label: t('tui.labels.name'), value: capabilityName(selected)}),
            h(Field, {key: 'risk', label: t('tui.labels.risk'), value: capabilityRisk(selected), color: capabilityRisk(selected) === t('write') ? COLORS.warning : undefined}),
            h(Field, {key: 'description', label: t('tui.labels.description'), value: selected?.value?.description}),
            h(Field, {key: 'uri', label: t('tui.labels.uri'), value: selected?.value?.uriTemplate || selected?.value?.uri})
        ]});
}

function HistoryPage({history, selectedIndex, layout}) {
    const selected = history[selectedIndex];
    return h(CatalogPair, {layout, items: history, selectedIndex, title: t('tui.panels.recent'), detailTitle: t('tui.panels.details'),
        renderItem: entry => `${entry.success ? 'OK' : 'ERR'} ${entry.operation} ${entry.name || ''}`, details: [
            h(Field, {key: 'id', label: 'ID', value: selected?.id}),
            h(Field, {key: 'profile', label: t('tui.labels.profile'), value: selected?.profile}),
            h(Field, {key: 'risk', label: t('tui.labels.risk'), value: selected?.risk}),
            h(Field, {key: 'status', label: t('tui.labels.status'), value: selected ? selected.success ? t('ok') : t('error') : '-'}),
            h(Text, {key: 'summary', dimColor: false, wrap: 'truncate-end'}, selected?.summary || '-')
        ]});
}

/** Render the profile add/edit form with secret-safe field values. */
function ProfileFormPage({mode, form, fieldIndex, cursor, inputError, layout}) {
    const fields = profileFormFields(mode);
    const visible = listWindow(fields, fieldIndex, Math.max(1, layout.contentHeight - 4));
    return h(Panel, {title: mode === 'setup' ? t('setup.title') : t(`tui.panels.profile${mode === 'add' ? 'Add' : 'Edit'}`), layout, color: COLORS.accent},
        ...visible.items.map((field, offset) => {
            const index = visible.start + offset;
            const label = `${index === fieldIndex ? '›' : ' '} ${profileFieldLabel(field, mode)}: `;
            const width = Math.max(1, layout.contentWidth - 4 - getDisplayWidth(label));
            const value = index === fieldIndex && field !== 'makeDefault'
                ? editorViewport(form[field], cursor, width, {secret: field === 'apiKey'})
                : truncate(profileFieldValue(field, form, mode), width);
            return h(Text, {key: field, inverse: index === fieldIndex, bold: index === fieldIndex, wrap: 'truncate-end'}, label + value);
        }),
        inputError ? h(Text, {wrap: 'truncate-end'}, '! ' + inputError) : null,
        mode === 'edit' ? h(Text, {dimColor: false, wrap: 'truncate-end'}, t('tui.profile.editKeyHint')) : null,
        h(Text, {dimColor: false, wrap: 'truncate-end'}, t('tui.profile.formHelp')));
}

function ProfilesPage({config, selectedIndex, layout, mode, form, fieldIndex, cursor, inputError}) {
    const profiles = config.profiles || [];
    const selected = profiles[selectedIndex];
    if (['setup', 'add', 'edit'].includes(mode) && form) return h(ProfileFormPage, {mode, form, fieldIndex, cursor, inputError, layout});
    if (mode === 'delete') return h(TuiDetails, {title: t('tui.panels.profileDelete'),
        lines: [t('tui.profile.deletePrompt', {name: selected?.name || '-'}), t('tui.profile.deleteHistoryNote'), t('tui.profile.deleteHelp')],
        width: layout.contentWidth, height: layout.contentHeight, accent: COLORS.danger});
    return h(CatalogPair, {layout, items: profiles, selectedIndex, title: t('tui.tabs.profiles'), detailTitle: t('tui.panels.profile'),
        renderItem: profile => `${profile.name}${profile.isDefault ? ' *' : ''}`, details: [
            h(Field, {key: 'profile', label: t('tui.labels.profile'), value: selected?.name}),
            h(Field, {key: 'endpoint', label: t('tui.labels.endpoint'), value: selected?.endpoint}),
            h(Field, {key: 'key', label: t('tui.labels.key'), value: selected?.apiKey}),
            h(Field, {key: 'timeout', label: t('tui.labels.timeout'), value: selected ? `${selected.timeoutMs} ms` : '-'}),
            h(Field, {key: 'default', label: t('tui.labels.default'), value: selected ? selected.isDefault ? t('yes') : t('no') : '-'}),
            h(Text, {key: 'warning', color: COLORS.warning, wrap: 'truncate-end'}, t('plaintextConfigWarning'))
        ]});
}

/** Provide read-only remote inspection plus local Profile management state. */
export function SlothVaultTuiApp({embedded = false, layoutOverride = null, initialDiscovery = null, initialSetup = false, managedSetup = false, onClose = null, onState = null} = {}) {
    const app = useApp();
    const windowSize = useWindowSize();
    const baseLayout = layoutOverride || resolveSlothVaultTuiLayout(windowSize.columns, windowSize.rows);
    const [activeTab, setActiveTab] = useState(initialSetup ? 'profiles' : 'status');
    const [selectedIndices, setSelectedIndices] = useState({capabilities: 0, history: 0, profiles: 0});
    const [local] = useState(() => {
        try {return {config: getConfigSummary(), history: listHistory({limit: 50}), error: ''};}
        catch (readError) {return {config: {profiles: [], defaultProfile: null, readError: true}, history: [], error: formatSlothVaultError(readError)};}
    });
    const [config, setConfig] = useState(local.config);
    const [history, setHistory] = useState(local.history);
    const [discovery, setDiscovery] = useState(initialDiscovery);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(local.error);
    const [compatibilityCode, setCompatibilityCode] = useState(null);
    const [status, setStatus] = useState(t('tui.status.ready'));
    const [statusTone, setStatusTone] = useState('success');
    const [profileMode, setProfileMode] = useState(initialSetup ? 'setup' : 'browse');
    const deleteProfileRef = useRef(false);
    const [profileForm, setProfileForm] = useState(initialSetup ? createProfileForm('setup') : null);
    const [profileFieldIndex, setProfileFieldIndex] = useState(0);
    const [profileCursor, setProfileCursor] = useState(0);
    const [profileInputError, setProfileInputError] = useState('');
    const [detailLines, setDetailLines] = useState(null);
    const [detailScroll, setDetailScroll] = useState(0);
    const refreshGeneration = useRef(0);
    const footerKey = detailLines ? 'tui.detailFooter' : activeTab === 'profiles'
        ? profileMode === 'delete'
            ? 'tui.profile.deleteFooter'
            : profileMode === 'browse'
                ? 'tui.profile.browseFooter'
                : 'tui.profile.formFooter'
        : 'tui.footer';
    const baseShell = getShellLayout(baseLayout.columns, baseLayout.rows, {
        status: `${statusSymbol(loading ? 'running' : 'result', statusTone)} ${status}`, keys: `${t('setup.hint')} · ${t(footerKey)}`, inverseFooter: true
    });
    const shell = embedded ? {...baseShell, contentWidth: baseLayout.columns, contentHeight: Math.max(3, baseLayout.rows - 2)} : baseShell;
    const layout = {...baseLayout, contentWidth: shell.contentWidth, contentHeight: shell.contentHeight};
    const detailWindow = getDetailWindow(detailLines, detailScroll, shell.contentWidth, shell.contentHeight);


    /** Refresh local display data and perform exactly one remote discovery connection. */
    async function refresh() {
        const generation = ++refreshGeneration.current;

        // Step 0: Enter a visible loading state before reading local snapshots.
        setLoading(true);
        setError('');
        setCompatibilityCode(null);
        setStatus(t('tui.status.loading'));
        setStatusTone('warning');

        // Step 1: Refresh local redacted state, then discover through one MCP client.
        try {
            setConfig(getConfigSummary());
            setHistory(listHistory({limit: 50}));
            const result = await inspectServer({recordHistory: false});
            if (generation !== refreshGeneration.current) {
                return;
            }
            setDiscovery(result);
            setStatus(t('tui.status.refreshed'));
            setStatusTone('success');
        } catch (refreshError) {
            if (generation !== refreshGeneration.current) {
                return;
            }
            const message = formatSlothVaultError(refreshError);
            setDiscovery(null);
            setError(message);
            if (['MCP_CLIENT_OUTDATED', 'MCP_PROTOCOL_INCOMPATIBLE'].includes(refreshError.code)) setCompatibilityCode(refreshError.code);
            setStatus(t('tui.status.failed', {message}));
            setStatusTone('danger');
        } finally {
            if (generation === refreshGeneration.current) {
                setLoading(false);
            }
        }
    }

    /** Cancel an in-flight discovery result and require an explicit refresh. */
    function invalidateDiscovery() {
        refreshGeneration.current += 1;
        setDiscovery(null);
        setError('');
        setCompatibilityCode(null);
        setLoading(false);
    }

    /** Reload masked profile metadata and keep the requested profile selected when possible. */
    function reloadProfiles(selectedName = '') {
        const nextConfig = getConfigSummary();
        const selectedIndex = Math.max(0, nextConfig.profiles.findIndex(profile => profile.name === selectedName));
        setConfig(nextConfig);
        setSelectedIndices(current => ({...current, profiles: selectedIndex}));
        return nextConfig;
    }

    /** Clear every transient form value, including a typed MCP key. */
    function closeProfileInteraction() {
        deleteProfileRef.current = false;
        setProfileMode('browse');
        setProfileForm(null);
        setProfileFieldIndex(0);
        setProfileCursor(0);
        setProfileInputError('');
    }

    /** Open a clean form for a new local profile. */
    function startAddingProfile() {
        setProfileMode('add');
        setProfileForm(createProfileForm('add', null, config.profiles.length));
        setProfileFieldIndex(0);
        setProfileCursor(0);
        setStatus(t('tui.status.profileAddReady'));
        setStatusTone('warning');
    }

    /** Open an edit form populated only with non-secret masked profile metadata. */
    function startEditingProfile() {
        const selected = config.profiles[selectedIndices.profiles];
        if (!selected) {
            return;
        }
        setProfileMode('edit');
        setProfileForm(createProfileForm('edit', selected, config.profiles.length));
        setProfileFieldIndex(0);
        setProfileCursor(graphemes(selected.endpoint || '').length);
        setStatus(t('tui.status.profileEditReady', {name: selected.name}));
        setStatusTone('warning');
    }

    /** Persist the active add/edit form and clear its credential state. */
    async function saveProfileForm() {
        if (!profileForm || !['setup', 'add', 'edit'].includes(profileMode)) {
            return;
        }

        // Step 0: Build the minimal service input without reading a stored raw key.
        const selected = config.profiles[selectedIndices.profiles] || null;
        const patch = {
            endpoint: profileForm.endpoint,
            timeoutMs: profileForm.timeoutMs,
            ...(profileForm.apiKey ? {apiKey: profileForm.apiKey} : {}),
            ...(profileForm.makeDefault ? {makeDefault: true} : {})
        };

        try {
            if (profileMode === 'setup') {
                setLoading(true);
                setProfileForm(current => current ? {...current, apiKey: ''} : null);
                const result = await setupConnection({endpoint: profileForm.endpoint, apiKey: profileForm.apiKey}, {managed: managedSetup});
                invalidateDiscovery();
                reloadProfiles(result.profile.name);
                closeProfileInteraction();
                setStatus(setupResultText(result));
                setStatusTone(result.connected ? 'success' : 'warning');
                return;
            }
            // Step 1: Let the shared config service validate and atomically persist the mutation.
            const saved = profileMode === 'add'
                ? addProfile(profileForm.name, {...patch, apiKey: profileForm.apiKey})
                : updateProfile(profileForm.name, patch);
            const defaultChanged = config.defaultProfile !== (saved.isDefault ? saved.name : config.defaultProfile);
            const connectionChanged = profileMode === 'edit' && selected?.isDefault && (
                saved.endpoint !== selected.endpoint
                || saved.timeoutMs !== selected.timeoutMs
                || Boolean(profileForm.apiKey)
            );

            // Step 2: Reload only masked metadata, invalidate stale discovery, and clear the form.
            reloadProfiles(saved.name);
            if (defaultChanged || connectionChanged) {
                invalidateDiscovery();
            }
            closeProfileInteraction();
            const messageKey = profileMode === 'add' ? 'tui.status.profileAdded' : 'tui.status.profileUpdated';
            const refreshHint = defaultChanged || connectionChanged ? ` ${t('tui.status.refreshRequired')}` : '';
            setStatus(`${t(messageKey, {name: saved.name})}${refreshHint}`);
            setStatusTone('success');
        } catch (saveError) {
            // Step 3: Retain non-secret fields for correction, but immediately discard the typed key.
            const safeError = formatSlothVaultError(saveError).replaceAll(profileForm.apiKey || '\u0000', '[redacted]');
            setProfileForm(current => current ? {...current, apiKey: ''} : null);
            if (profileFormFields(profileMode)[profileFieldIndex] === 'apiKey') setProfileCursor(0);
            setProfileInputError(safeError);
            setStatus(t('tui.status.profileOperationFailed', {message: safeError}));
            setStatusTone('danger');
            setLoading(false);
        }
    }

    /** Select the highlighted profile as default without connecting to the server. */
    function selectDefaultProfile() {
        const selected = config.profiles[selectedIndices.profiles];
        if (!selected || selected.isDefault) {
            return;
        }

        try {
            useProfile(selected.name);
            reloadProfiles(selected.name);
            invalidateDiscovery();
            setStatus(`${t('tui.status.profileUsed', {name: selected.name})} ${t('tui.status.refreshRequired')}`);
            setStatusTone('success');
        } catch (useError) {
            setStatus(t('tui.status.profileOperationFailed', {message: formatSlothVaultError(useError)}));
            setStatusTone('danger');
        }
    }

    /** Enter deletion confirmation for the selected local profile. */
    function requestProfileRemoval() {
        if (!config.profiles[selectedIndices.profiles]) {
            return;
        }
        deleteProfileRef.current = true;
        setProfileMode('delete');
        setProfileForm(null);
        setStatus(t('tui.status.profileDeleteReady'));
        setStatusTone('warning');
    }

    /** Remove the selected profile after explicit confirmation and migrate selection safely. */
    function confirmProfileRemoval() {
        const selected = config.profiles[selectedIndices.profiles];
        if (!selected) {
            closeProfileInteraction();
            return;
        }

        try {
            // Step 0: Persist removal and let the config service migrate the default deterministically.
            const wasDefault = selected.isDefault;
            const remainingProfiles = config.profiles.filter(profile => profile.name !== selected.name);
            const adjacentIndex = Math.min(selectedIndices.profiles, Math.max(0, remainingProfiles.length - 1));
            const adjacentName = remainingProfiles[adjacentIndex]?.name || '';
            const removed = removeProfile(selected.name);

            // Step 1: Reload masked state, invalidate affected discovery, and leave confirmation mode.
            reloadProfiles(wasDefault ? removed.defaultProfile || '' : adjacentName);
            if (wasDefault || discovery?.profile?.name === selected.name) {
                invalidateDiscovery();
            }
            closeProfileInteraction();
            const refreshHint = wasDefault ? ` ${t('tui.status.refreshRequired')}` : '';
            setStatus(`${t('tui.status.profileRemoved', {name: selected.name})}${refreshHint}`);
            setStatusTone('success');
        } catch (removeError) {
            closeProfileInteraction();
            setStatus(t('tui.status.profileOperationFailed', {message: formatSlothVaultError(removeError)}));
            setStatusTone('danger');
        }
    }

    /** Handle navigation and secret-safe editing while a profile form is open. */
    function handleProfileFormInput(input, key) {
        const fields = profileFormFields(profileMode);
        const field = fields[profileFieldIndex];
        if (!profileForm || !field) {
            closeProfileInteraction();
            return;
        }
        if (key.escape) {
            closeProfileInteraction();
            setStatus(t('tui.status.profileCancelled'));
            setStatusTone('warning');
            return;
        }
        if (key.upArrow || key.downArrow || key.tab) {
            const delta = key.upArrow || key.tab && key.shift ? -1 : 1;
            const nextIndex = (profileFieldIndex + delta + fields.length) % fields.length;
            setProfileFieldIndex(nextIndex);
            setProfileCursor(graphemes(profileForm[fields[nextIndex]] || '').length);
            return;
        }
        if (field === 'makeDefault' && input === ' ') {
            if (!profileForm.alreadyDefault) {
                setProfileForm(current => ({...current, makeDefault: !current.makeDefault}));
            }
            return;
        }
        if (key.return) {
            if (profileFieldIndex === fields.length - 1) {
                saveProfileForm();
            } else {
                setProfileFieldIndex(index => index + 1);
                setProfileCursor(graphemes(profileForm[fields[profileFieldIndex + 1]] || '').length);
            }
            return;
        }
        if (field === 'makeDefault') return;
        const next = editText({value: profileForm[field], cursor: profileCursor}, input, key, PROFILE_FIELD_LIMITS[field]);
        setProfileForm(current => ({...current, [field]: next.value}));
        setProfileCursor(next.cursor);
        setProfileInputError('');
    }

    useEffect(() => {
        if ((process.env.SLOTHTOOL_SLOTHVAULT_MCP_TUI_TEST_ACTION === 'render-exit' || process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'render-exit')) {
            app.exit();
            return;
        }
        if (local.error) {
            setStatus(t('tui.status.failed', {message: local.error})); setStatusTone('danger');
        } else if (initialSetup || (!initialDiscovery && !config.profiles.length)) {
            setActiveTab('profiles');
            setProfileMode('setup');
            setProfileForm(createProfileForm('setup'));
            setStatus(t('setup.title'));
        } else if (!initialDiscovery) {
            void refresh();
        }
    }, []);

    const itemCounts = useMemo(() => ({
        capabilities: capabilityItems(discovery).length,
        history: history.length,
        profiles: config.profiles.length
    }), [config.profiles.length, discovery, history.length]);
    useEffect(() => {
        onState?.({profileState: config.readError ? 'error' : config.profiles.length ? 'configured' : 'not-configured',
            profileCount: config.profiles.length, connectionState: error ? 'error' : discovery ? 'connected' : 'unchecked'});
    }, [config, error, discovery]);

    useInput((input, key) => {
        if (loading && profileMode === 'setup') return;
        if (layout.tooSmall) {
            if (input === 'q') onClose ? onClose() : app.exit();
            return;
        }
        if (activeTab === 'profiles' && profileMode !== 'browse') {
            if (profileMode === 'delete') {
                if (!deleteProfileRef.current) return;
                if (input.toLowerCase() === 'y') {
                    confirmProfileRemoval();
                } else if (input.toLowerCase() === 'n' || key.escape) {
                    closeProfileInteraction();
                    setStatus(t('tui.status.profileCancelled'));
                    setStatusTone('warning');
                }
                return;
            }
            handleProfileFormInput(input, key);
            return;
        }
        if (detailLines) {
            if (key.escape) setDetailLines(null);
            else if (key.upArrow || key.pageUp) setDetailScroll(value => Math.max(0, Math.min(value, detailWindow.maxScroll) - (key.pageUp ? detailWindow.capacity : 1)));
            else if (key.downArrow || key.pageDown) setDetailScroll(value => Math.min(
                detailWindow.maxScroll, Math.min(value, detailWindow.maxScroll) + (key.pageDown ? detailWindow.capacity : 1)));
            return;
        }
        if (input === 'c') {
            setActiveTab('profiles'); setProfileMode('setup'); setProfileForm(createProfileForm('setup'));
            setProfileFieldIndex(0); setProfileCursor(0); setProfileInputError(''); return;
        }
        if (activeTab === 'status' && input === 'n' && compatibilityCode && !loading) {
            setLoading(true);
            setStatus(t('tui.compatibilityUpdating'));
            void updateMcpClient().then(() => refresh()).catch(updateError => {
                setStatus(t('tui.status.failed', {message: formatSlothVaultError(updateError)}));
                setStatusTone('danger');
                setLoading(false);
            });
            return;
        }
        if (input === 'v') {
            const lines = [t(`tui.tabs.${activeTab}`), status, ''];
            if (activeTab === 'status') {
                const profile = discovery?.profile || config.profiles.find(item => item.isDefault);
                lines.push(`${t('tui.labels.profile')}: ${profile?.name || '-'}`,
                    `${t('tui.labels.endpoint')}: ${profile?.endpoint || '-'}`,
                    `${t('tui.labels.server')}: ${discovery?.server?.name || '-'}`, error);
            } else if (activeTab === 'capabilities') {
                const item = capabilityItems(discovery)[selectedIndices.capabilities];
                lines.push(`${t('tui.labels.name')}: ${capabilityName(item)}`,
                    `${t('tui.labels.risk')}: ${capabilityRisk(item)}`,
                    `${t('tui.labels.description')}: ${item?.value?.description || '-'}`,
                    `${t('tui.labels.uri')}: ${item?.value?.uriTemplate || item?.value?.uri || '-'}`);
            } else if (activeTab === 'history') {
                const entry = history[selectedIndices.history];
                lines.push(`ID: ${entry?.id || '-'}`, `${t('tui.labels.name')}: ${entry?.name || '-'}`,
                    `${t('tui.labels.risk')}: ${entry?.risk || '-'}`, entry?.summary || '-');
            } else {
                const profile = config.profiles[selectedIndices.profiles];
                lines.push(`${t('tui.labels.profile')}: ${profile?.name || '-'}`,
                    `${t('tui.labels.endpoint')}: ${profile?.endpoint || '-'}`,
                    `${t('tui.labels.timeout')}: ${profile?.timeoutMs || '-'} ms`);
            }
            setDetailLines(lines.filter(Boolean));
            setDetailScroll(0);
            return;
        }
        if (input === 'q') {
            if (onClose) onClose(); else app.exit();
            return;
        }
        if (input === 'r' && !loading) {
            void refresh();
            return;
        }
        if (key.tab || key.rightArrow) {
            setActiveTab(tab => TABS[nextTabIndex(TABS.indexOf(tab), TABS.length, key)]);
            return;
        }
        if (key.leftArrow) {
            setActiveTab(tab => TABS[(TABS.indexOf(tab) - 1 + TABS.length) % TABS.length]);
            return;
        }
        if (key.escape) {if (onClose) onClose(); else setActiveTab('status'); return;}
        if (activeTab === 'profiles') {
            if (input === 'a') {
                startAddingProfile();
                return;
            }
            if (input === 'e' || key.return) {
                startEditingProfile();
                return;
            }
            if (input === 'u') {
                selectDefaultProfile();
                return;
            }
            if (input === 'd') {
                requestProfileRemoval();
                return;
            }
        }
        if ((key.upArrow || key.downArrow) && activeTab !== 'status') {
            setSelectedIndices(current => {
                const count = itemCounts[activeTab] || 0;
                const delta = key.upArrow ? -1 : 1;
                return {...current, [activeTab]: count ? (current[activeTab] + delta + count) % count : 0};
            });
        }
    });

    usePaste(value => {
        if (!['setup', 'add', 'edit'].includes(profileMode) || !profileForm) return;
        const field = profileFormFields(profileMode)[profileFieldIndex];
        if (!field || field === 'makeDefault') return;
        const next = editText({value: profileForm[field], cursor: profileCursor}, value, {}, PROFILE_FIELD_LIMITS[field]);
        setProfileForm(current => ({...current, [field]: next.value}));
        setProfileCursor(next.cursor);
        setProfileInputError('');
    });

    const content = detailLines
        ? h(TuiDetails, {title: t('tui.panels.details'), lines: detailLines, scroll: detailScroll,
            width: shell.contentWidth, height: shell.contentHeight, accent: COLORS.accent, border: COLORS.border})
        : activeTab === 'status'
        ? h(StatusPage, {config, discovery, loading, error, compatibilityCode, layout})
        : activeTab === 'capabilities'
            ? h(CapabilitiesPage, {discovery, selectedIndex: selectedIndices.capabilities, layout})
            : activeTab === 'history'
                ? h(HistoryPage, {history, selectedIndex: selectedIndices.history, layout})
                : h(ProfilesPage, {
                    config,
                    selectedIndex: selectedIndices.profiles,
                    layout,
                    mode: profileMode,
                    form: profileForm,
                    fieldIndex: profileFieldIndex,
                    cursor: profileCursor,
                    inputError: profileInputError
                });


    if (embedded) return h(Box, {height: baseLayout.rows, width: baseLayout.columns, flexDirection: 'column'},
        h(TuiHeader, {tabs: TABS.map(id => ({id, label: t('tui.tabs.' + id)})), activeTab, width: shell.contentWidth}),
        h(Box, {height: shell.contentHeight, flexShrink: 0, flexDirection: 'column'}, content),
        h(Text, {inverse: true, wrap: 'truncate-end'}, t(footerKey)));
    if (layout.tooSmall) return h(Box, {flexDirection: 'column', width: layout.columns,
        height: layout.rows, paddingX: 1},
    h(Text, {bold: true, color: COLORS.warning}, truncate(t('tui.resize'), layout.columns - 2)),
    h(Text, {}, truncate(t('tui.resizeHint'), layout.columns - 2)),
    h(Text, {dimColor: false}, 'q'));

    return h(TuiFrame, {layout: shell, statusColor: COLORS[statusTone] || COLORS.success,
        header: h(TuiHeader, {tabs: TABS.map(id => ({id, label: t('tui.tabs.' + id)})), activeTab,
            width: shell.contentWidth, meta: `SlothVault MCP ${pluginPackage.version}`, accent: COLORS.accent})}, content);
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
