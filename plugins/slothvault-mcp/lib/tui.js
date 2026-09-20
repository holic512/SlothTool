/**
 * @file SlothVaultMcpTui
 * @project SlothTool
 * @module SlothVault MCP Plugin / TUI
 * @description Ink interface for read-only MCP inspection plus local profile and coding-agent Skill management.
 * @logic 1. 展示远端只读发现与脱敏历史；2. 管理不加载原始 Key 的本地 Profile；3. 管理用户级 SlothVault Skill 链接并对覆盖和卸载二次确认。
 * @dependencies React/Ink, Config/History/Service/Skill Manager/I18N
 * @index_tags slothvault,mcp,tui,profile,skill,read-only
 * @author holic512
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Spacer, Text, render, useApp, useInput, useWindowSize} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {
    addProfile,
    getConfigSummary,
    removeProfile,
    updateProfile,
    useProfile
} from './config.js';
import {listHistory} from './history.js';
import {inspectServer} from './service.js';
import {getSkillStatus, installSkill, uninstallSkill} from './skill-manager.js';
import {formatSlothVaultError, t} from './i18n.js';

const h = React.createElement;
const TABS = ['status', 'capabilities', 'history', 'profiles', 'skill'];
const PROFILE_FORM_FIELDS = {
    add: ['name', 'endpoint', 'timeoutMs', 'apiKey', 'makeDefault'],
    edit: ['endpoint', 'timeoutMs', 'apiKey', 'makeDefault']
};
const PROFILE_FIELD_LIMITS = {
    name: 64,
    endpoint: 2048,
    timeoutMs: 9,
    apiKey: 512
};
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

/** Remove control characters from terminal text before appending it to a form value. */
function printableInput(input) {
    return String(input || '').replace(/[\u0000-\u001f\u007f]/gu, '');
}

/** Resolve a localized label for one profile form field. */
function profileFieldLabel(field, mode) {
    const labels = {
        name: 'tui.labels.profile',
        endpoint: 'tui.labels.endpoint',
        timeoutMs: 'tui.labels.timeout',
        apiKey: mode === 'add' ? 'tui.labels.mcpKey' : 'tui.labels.newKey',
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

/** Render the profile add/edit form with secret-safe field values. */
function ProfileFormPage({mode, form, fieldIndex, layout}) {
    const fields = profileFormFields(mode);
    const maxValueWidth = Math.max(12, layout.columns - 28);
    return h(
        Box,
        {flexDirection: 'column'},
        h(
            Panel,
            {title: t(`tui.panels.profile${mode === 'add' ? 'Add' : 'Edit'}`), color: COLORS.accent},
            ...fields.map((field, index) => h(
                Text,
                {key: field, color: index === fieldIndex ? COLORS.accent : undefined},
                `${index === fieldIndex ? '›' : ' '} ${profileFieldLabel(field, mode)}: ${truncate(profileFieldValue(field, form, mode), maxValueWidth)}`
            )),
            mode === 'edit'
                ? h(Text, {dimColor: true}, t('tui.profile.editKeyHint'))
                : null,
            form.endpoint.trim().startsWith('http://')
                ? h(Text, {color: COLORS.warning}, t('httpWarning'))
                : null
        ),
        h(Text, {color: COLORS.warning}, t('plaintextConfigWarning')),
        h(Text, {dimColor: true}, t('tui.profile.formHelp'))
    );
}

/** Render an explicit confirmation before removing a local profile. */
function ProfileDeletePage({profile}) {
    return h(
        Box,
        {flexDirection: 'column'},
        h(
            Panel,
            {title: t('tui.panels.profileDelete'), color: COLORS.danger},
            h(Text, {color: COLORS.danger}, t('tui.profile.deletePrompt', {name: profile?.name || '-'})),
            h(Text, {dimColor: true}, t('tui.profile.deleteHistoryNote'))
        ),
        h(Text, {dimColor: true}, t('tui.profile.deleteHelp'))
    );
}

/** Render stored profile metadata and local management actions with every key masked. */
function ProfilesPage({config, selectedIndex, layout, mode, form, fieldIndex}) {
    const profiles = config.profiles || [];
    const selected = profiles[selectedIndex] || null;
    if ((mode === 'add' || mode === 'edit') && form) {
        return h(ProfileFormPage, {mode, form, fieldIndex, layout});
    }
    if (mode === 'delete') {
        return h(ProfileDeletePage, {profile: selected});
    }

    const visible = listWindow(profiles, selectedIndex, layout.listLimit);
    return h(
        Box,
        {flexDirection: 'column'},
        h(
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
                h(Field, {label: t('tui.labels.default'), value: selected ? selected.isDefault ? t('yes') : t('no') : '-'}),
                selected?.endpoint?.startsWith('http://') ? h(Text, {color: COLORS.warning}, t('httpWarning')) : null
            )
        ),
        h(Text, {color: COLORS.warning}, t('plaintextConfigWarning')),
        h(Text, {dimColor: true}, t('tui.profile.browseHelp'))
    );
}

/** Render local Skill state and explicit replacement/uninstall confirmations. */
function SkillPage({skill, mode, layout}) {
    const confirming = mode === 'replace' || mode === 'uninstall';
    const title = mode === 'replace'
        ? t('tui.panels.skillReplace')
        : mode === 'uninstall'
            ? t('tui.panels.skillUninstall')
            : t('tui.panels.skill');
    const stateColor = skill.state === 'installed'
        ? COLORS.success
        : skill.state === 'conflict'
            ? COLORS.danger
            : COLORS.warning;
    const agentFields = skill.agents.flatMap(agent => {
        const color = !agent.detected
            ? COLORS.muted
            : agent.state === 'installed'
                ? COLORS.success
                : agent.state === 'conflict'
                    ? COLORS.danger
                    : COLORS.warning;
        const detection = agent.detected ? t('skillDetected') : t('skillNotDetected');
        return [
            h(Field, {key: `${agent.id}-agent`, label: t('tui.labels.agent'), value: `${agent.name} [${detection}]`, color}),
            h(Field, {key: `${agent.id}-state`, label: t('tui.labels.status'), value: t(`skillStates.${agent.state}`), color}),
            h(Field, {key: `${agent.id}-target`, label: t('tui.labels.target'), value: truncate(agent.targetPath, layout.columns - 18)})
        ];
    });
    return h(
        Box,
        {flexDirection: 'column'},
        h(
            Panel,
            {title, color: confirming ? COLORS.danger : stateColor},
            h(Field, {label: t('tui.labels.name'), value: skill.name}),
            h(Field, {label: t('tui.labels.status'), value: t(`skillStates.${skill.state}`), color: stateColor}),
            h(Field, {label: t('tui.labels.source'), value: truncate(skill.sourcePath, layout.columns - 18)}),
            ...agentFields,
            skill.state === 'conflict'
                ? h(Text, {color: COLORS.danger}, t('tui.skill.conflictWarning'))
                : null,
            mode === 'replace'
                ? h(Text, {color: COLORS.danger}, t('tui.skill.replacePrompt'))
                : mode === 'uninstall'
                    ? h(Text, {color: COLORS.danger}, t('tui.skill.uninstallPrompt'))
                    : null
        ),
        h(Text, {dimColor: true}, confirming ? t('tui.skill.confirmHelp') : t('tui.skill.browseHelp'))
    );
}

/** Provide read-only remote inspection plus local profile and Skill management state. */
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
    const [statusTone, setStatusTone] = useState('success');
    const [profileMode, setProfileMode] = useState('browse');
    const [profileForm, setProfileForm] = useState(null);
    const [profileFieldIndex, setProfileFieldIndex] = useState(0);
    const [skill, setSkill] = useState(() => getSkillStatus());
    const [skillMode, setSkillMode] = useState('browse');
    const refreshGeneration = useRef(0);

    /** Refresh local display data and perform exactly one remote discovery connection. */
    async function refresh() {
        const generation = ++refreshGeneration.current;

        // Step 0: Enter a visible loading state before reading local snapshots.
        setLoading(true);
        setError('');
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
        setProfileMode('browse');
        setProfileForm(null);
        setProfileFieldIndex(0);
    }

    /** Open a clean form for a new local profile. */
    function startAddingProfile() {
        setProfileMode('add');
        setProfileForm(createProfileForm('add', null, config.profiles.length));
        setProfileFieldIndex(0);
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
        setStatus(t('tui.status.profileEditReady', {name: selected.name}));
        setStatusTone('warning');
    }

    /** Persist the active add/edit form and clear its credential state. */
    function saveProfileForm() {
        if (!profileForm || !['add', 'edit'].includes(profileMode)) {
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
            setProfileForm(current => current ? {...current, apiKey: ''} : null);
            setStatus(t('tui.status.profileOperationFailed', {message: formatSlothVaultError(saveError)}));
            setStatusTone('danger');
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

    /** Refresh only the local Skill link state without contacting the MCP server. */
    function refreshSkill() {
        try {
            setSkill(getSkillStatus());
            setStatus(t('tui.status.skillRefreshed'));
            setStatusTone('success');
        } catch (skillError) {
            setStatus(t('tui.status.skillOperationFailed', {message: formatSlothVaultError(skillError)}));
            setStatusTone('danger');
        }
    }

    /** Install the Skill immediately or enter confirmation for an unmanaged conflict. */
    function requestSkillInstall() {
        try {
            const current = getSkillStatus();
            setSkill(current);
            if (current.state === 'conflict') {
                setSkillMode('replace');
                setStatus(t('tui.status.skillReplaceReady'));
                setStatusTone('warning');
                return;
            }
            performSkillInstall(false);
        } catch (skillError) {
            setStatus(t('tui.status.skillOperationFailed', {message: formatSlothVaultError(skillError)}));
            setStatusTone('danger');
        }
    }

    /** Apply one authorized Skill install and refresh its local status. */
    function performSkillInstall(replace) {
        try {
            const result = installSkill({replace});
            setSkill(result);
            setSkillMode('browse');
            const messageKey = {
                installed: 'tui.status.skillInstalled',
                'already-installed': 'tui.status.skillAlreadyInstalled',
                replaced: 'tui.status.skillReplaced'
            }[result.action];
            setStatus(t(messageKey || 'tui.status.skillInstalled'));
            setStatusTone('success');
        } catch (skillError) {
            setSkillMode('browse');
            setStatus(t('tui.status.skillOperationFailed', {message: formatSlothVaultError(skillError)}));
            setStatusTone('danger');
            try {
                setSkill(getSkillStatus());
            } catch {
                // Retain the last visible status when even inspection is unavailable.
            }
        }
    }

    /** Request confirmation only for a link that belongs to this plugin. */
    function requestSkillUninstall() {
        try {
            const current = getSkillStatus();
            setSkill(current);
            if (current.agents.some(agent => agent.detected && agent.state === 'installed')
                || current.legacyTarget.state === 'installed') {
                setSkillMode('uninstall');
                setStatus(t('tui.status.skillUninstallReady'));
                setStatusTone('warning');
                return;
            }
            performSkillUninstall();
        } catch (skillError) {
            setStatus(t('tui.status.skillOperationFailed', {message: formatSlothVaultError(skillError)}));
            setStatusTone('danger');
        }
    }

    /** Remove the managed Skill link and never delete conflicting content. */
    function performSkillUninstall() {
        try {
            const result = uninstallSkill();
            setSkill(result);
            setSkillMode('browse');
            setStatus(t(result.action === 'uninstalled'
                ? 'tui.status.skillUninstalled'
                : 'tui.status.skillAlreadyAbsent'));
            setStatusTone('success');
        } catch (skillError) {
            setSkillMode('browse');
            setStatus(t('tui.status.skillOperationFailed', {message: formatSlothVaultError(skillError)}));
            setStatusTone('danger');
            try {
                setSkill(getSkillStatus());
            } catch {
                // Retain the last visible status when even inspection is unavailable.
            }
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
        if (key.upArrow || key.downArrow) {
            const delta = key.upArrow ? -1 : 1;
            setProfileFieldIndex(index => (index + delta + fields.length) % fields.length);
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
            }
            return;
        }
        if (key.backspace || key.delete) {
            if (field !== 'makeDefault') {
                setProfileForm(current => ({...current, [field]: current[field].slice(0, -1)}));
            }
            return;
        }
        if (key.ctrl && input.toLowerCase() === 'u' && field !== 'makeDefault') {
            setProfileForm(current => ({...current, [field]: ''}));
            return;
        }
        if (field === 'makeDefault' || key.ctrl || key.meta || key.tab) {
            return;
        }
        const addition = printableInput(input);
        if (addition) {
            setProfileForm(current => ({
                ...current,
                [field]: `${current[field]}${addition}`.slice(0, PROFILE_FIELD_LIMITS[field])
            }));
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
        if (activeTab === 'profiles' && profileMode !== 'browse') {
            if (profileMode === 'delete') {
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
        if (activeTab === 'skill' && skillMode !== 'browse') {
            if (input.toLowerCase() === 'y') {
                if (skillMode === 'replace') {
                    performSkillInstall(true);
                } else {
                    performSkillUninstall();
                }
            } else if (input.toLowerCase() === 'n' || key.escape) {
                setSkillMode('browse');
                setStatus(t('tui.status.skillCancelled'));
                setStatusTone('warning');
            }
            return;
        }
        if (input === 'q') {
            app.exit();
            return;
        }
        if (input === 'r' && !loading) {
            if (activeTab === 'skill') {
                refreshSkill();
            } else {
                void refresh();
            }
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
        if (activeTab === 'skill') {
            if (input === 'i' || key.return) {
                requestSkillInstall();
                return;
            }
            if (input === 'u') {
                requestSkillUninstall();
                return;
            }
        }
        if ((key.upArrow || key.downArrow) && !['status', 'skill'].includes(activeTab)) {
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
                : activeTab === 'profiles'
                    ? h(ProfilesPage, {
                        config,
                        selectedIndex: selectedIndices.profiles,
                        layout,
                        mode: profileMode,
                        form: profileForm,
                        fieldIndex: profileFieldIndex
                    })
                    : h(SkillPage, {skill, mode: skillMode, layout});

    const footerKey = activeTab === 'profiles'
        ? profileMode === 'delete'
            ? 'tui.profile.deleteFooter'
            : profileMode === 'browse'
                ? 'tui.profile.browseFooter'
                : 'tui.profile.formFooter'
        : activeTab === 'skill'
            ? skillMode === 'browse' ? 'tui.skill.browseFooter' : 'tui.skill.confirmFooter'
            : 'tui.footer';

    return h(
        Box,
        {flexDirection: 'column', width: layout.columns},
        h(Box, {}, h(Text, {bold: true, color: COLORS.accent}, `SlothVault MCP ${pluginPackage.version}`), h(Spacer), h(Text, {}, tabText(activeTab))),
        h(Text, {dimColor: true}, '─'.repeat(Math.max(1, layout.columns - 1))),
        content,
        h(Spacer),
        h(Text, {color: COLORS[statusTone] || COLORS.success}, truncate(status, layout.columns - 1)),
        h(Text, {inverse: true}, truncate(t(footerKey), layout.columns - 1))
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
