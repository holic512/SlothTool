/**
 * @file manager-tui.js
 * @project SlothTool
 * @module SlothVault workspace UI
 * @description Independent component pages with persistent right-side state, results and measured progress.
 * @logic Keep local Overview independent, select discovered Nginx sites in the deployment submenu, review writes once, and refresh actual state from final snapshots.
 * @dependencies React/Ink, package/Skill services, deployment bridge, owned local cleanup
 * @index_tags slothvault,tui,overview,packages,progress,cleanup
 * @author holic512
 */
import React, {createElement as h, useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, usePaste, useWindowSize, render} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getShellLayout, editText, editorViewport, graphemes, nextTabIndex, truncateFromRight} from './shared-interaction.js';
import {TuiFrame, TuiHeader, TuiDetails, progressLines, formatBytes, detailWindow, taskColor, COLORS} from './terminal-ui.js';
import {createTask, taskEvent, finishTask} from './task-state.js';
import {createDeploymentSession, inspectDeployment, getDeploymentAvailability} from './deploy-runner.js';
import {VAULT_COMPONENTS, getComponentStatus} from './slothvault-paths.js';
import {operatePackage} from './package-service.js';
import {getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill} from './skill-service.js';
import {planSlothVaultCleanup, cleanupSlothVault} from './slothvault-storage.js';
import {t, formatSlothVaultError} from './i18n.js';

const TABS = ['overview', 'deploy', 'skill'];
export const DEPLOY_ACTIONS = ['install', 'status', 'check-update', 'update', 'start', 'stop', 'nginx', 'https', 'renew', 'nginx-discover', 'nginx-status', 'nginx-update'];
const NGINX_MODES = ['auto', 'system', 'docker'];
const NGINX_ACTIONS = new Set(['install', 'nginx', 'https', 'renew', 'nginx-discover', 'nginx-status', 'nginx-update']);
const ACTIONS = {
    overview: ['summary', 'status', 'root', 'cleanup'],
    deploy: ['status', 'update', 'check-update', 'install', 'start', 'stop', 'nginx-menu', 'packages'],
    skill: ['package-status', 'package-install', 'package-check', 'package-update', 'skill-uninstall']
};
export const NGINX_MENU_ACTIONS = ['nginx-discover', 'nginx-select', 'nginx-status', 'nginx', 'nginx-update', 'https', 'renew', 'back'];
const PACKAGE_ACTIONS = ['package-status', 'package-install', 'package-check', 'package-update', 'back'];
const defaults = {getComponentStatus, operatePackage, getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill,
    planSlothVaultCleanup, cleanupSlothVault,
    inspectDeployment, createDeploymentSession, getDeploymentAvailability};

export function resolveSlothVaultManagerLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80), height = Math.max(1, Number(rows) || 24);
    return {width, height, compact: width < 78, short: height < 22, tooSmall: width < 30 || height < 18,
        sidebarWidth: Math.max(25, Math.min(31, Math.floor((width - 5) * 0.35)))};
}
export function buildDeploymentArguments(action, {root = '/data/slothvault', nginxMode = 'auto', nginxContainer = '', nginxConfig = '', nginxSite = '', nginxServerName = ''} = {}) {
    if (!DEPLOY_ACTIONS.includes(action)) throw new Error(`Unsupported deployment action: ${action}`);
    if (!NGINX_MODES.includes(nginxMode)) throw new Error(`Unsupported Nginx mode: ${nginxMode}`);
    const args = ['--action', action, '--root', root.trim() || '/data/slothvault'];
    if (NGINX_ACTIONS.has(action) && nginxMode !== 'auto') args.push('--nginx-mode', nginxMode);
    if (NGINX_ACTIONS.has(action) && nginxMode === 'docker' && nginxContainer.trim()) args.push('--nginx-container', nginxContainer.trim());
    if (NGINX_ACTIONS.has(action)) for (const [flag, value] of [['--nginx-config', nginxConfig], ['--nginx-site', nginxSite], ['--nginx-server-name', nginxServerName]]) if (value) args.push(flag, value);
    return args;
}
function label(action, tab) {
    if (action === 'nginx-menu' || action === 'nginx-select') return t('manager.actions.' + action);
    if (action === 'packages') return t('workflow.packageManager');
    if (action === 'back') return t('workflow.back');
    if (tab === 'deploy' && DEPLOY_ACTIONS.includes(action)) return t('manager.actions.' + action);
    return t('workspace.actions.' + action);
}
function localState(value) {
    const key = 'workspace.states.' + value, text = t(key);
    return text === key ? value || '-' : text;
}
function field(key, value) {return `${t(key)}: ${value ?? '-'}`;}
export function nginxStatusLines(status) {
    if (!status) return [];
    const lines = [field('manager.nginxFields.state', status.state)];
    for (const item of status.instances || []) {
        lines.push(`${item.mode}: ${item.container || item.mainConfig}`, field('manager.nginxFields.running', t(item.running ? 'yes' : 'no')), field('manager.nginxFields.syntax', item.syntax), item.version || '');
        if (item.container && item.mainConfig) lines.push(item.mainConfig);
        for (const mount of item.mounts || []) lines.push(`${mount.source} → ${mount.destination}`);
        if (item.error) lines.push('! ' + item.error);
    }
    for (const [index, site] of (status.sites || []).entries()) {
        lines.push(`${index + 1}) ${(site.serverNames || []).join(', ')} | ${(site.upstreams || []).join(', ')}`, site.hostConfig || site.siteConfig || '', `HTTPS: ${t(site.https ? 'yes' : 'no')} | ${field('manager.nginxFields.loaded', t(site.loaded ? 'yes' : 'no'))}`);
        for (const policy of site.transfer || []) for (const route of policy.routes || []) lines.push(`${policy.name}: ${route.clientMaxBodySize || '-'} | ${route.requestBuffering || '-'} / ${route.responseBuffering || '-'} | ${route.state}`);
    }
    return lines.filter(Boolean);
}
function instanceLines(instance, root) {
    if (!instance) return [field('manager.fields.root', root), t('workspace.instanceUnchecked')];
    const lines = [field('manager.fields.status', t('manager.instanceStates.' + instance.state)), field('manager.fields.root', instance.root || root)];
    for (const [name, key] of Object.entries({appVersion: 'manager.deployedAppVersion', runtimeImage: 'workflow.runtimeImage', image: 'workflow.configuredImage', provider: 'manager.fields.provider', port: 'manager.fields.port', dataDir: 'manager.fields.dataDir', databaseDir: 'manager.fields.databaseDir'})) if (instance[name] != null) lines.push(field(key, instance[name]));
    for (const container of instance.containers || []) lines.push(`${container.service || container.name}: ${container.state}${container.health ? ' / ' + container.health : ''}`);
    if (instance.nginx) lines.push(`Nginx: ${instance.nginx.state || '-'} ${instance.nginx.serverName || ''}`, `HTTPS: ${instance.nginx.https ? t('yes') : t('no')}`, field('manager.fields.certificate', instance.nginx.certificate || '-'));
    for (const error of instance.errors || []) lines.push(t('manager.readError', {scope: error.scope, code: error.code}));
    return lines;
}
function releaseLines(update, expanded = false) {
    const releases = update?.newer_application_releases?.length ? update.newer_application_releases : update?.next_application_release ? [update.next_application_release] : [];
    const stateKey = 'workflow.updateStates.' + update?.status;
    const state = t(stateKey);
    return [update ? t('manager.updateState', {state: state === stateKey ? update.status : state}) : '',
        update?.latest_published_release ? field('workflow.latest', update.latest_published_release.tag) : '',
        update?.checkedAt ? field('workspace.checkedAt', update.checkedAt) : '',
        update?.error ? '! ' + formatSlothVaultError({code: update.error, message: update.error}) : '',
        releases.length ? t('workflow.notesSummary', {version: update.next_application_release?.tag || '-', count: releases.length}) : '',
        ...(expanded ? releases.flatMap(release => [`[${release.tag}] ${release.title || ''}`, ...(release.notes || t('manager.noReleaseNotes')).split(/\r?\n/u), release.html_url || '']) : [])].filter(Boolean);
}

export function ManagerApp(props = {}) {return h(ManagerShell, props);}
function ManagerShell({services: overrides = {}, inspect, createSession} = {}) {
    const services = {...defaults, ...overrides, ...(inspect ? {inspectDeployment: inspect} : {}), ...(createSession ? {createDeploymentSession: createSession} : {})};
    const {exit} = useApp();
    const {columns = 80, rows = 24} = useWindowSize();
    const base = resolveSlothVaultManagerLayout(columns, rows);
    const [tab, setTab] = useState('overview');
    const [packagePage, setPackagePage] = useState(false);
    const [nginxPage, setNginxPage] = useState(false);
    const [nginxSelection, setNginxSelection] = useState(0);
    const [nginxTarget, setNginxTarget] = useState({});
    const [nginxStatus, setNginxStatus] = useState(null);
    const [packageSelection, setPackageSelection] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [follow, setFollow] = useState(true);
    const [selections, setSelections] = useState({overview: 0, deploy: 0, skill: 0});
    const [packages, setPackages] = useState(() => Object.fromEntries(VAULT_COMPONENTS.map(module => [module, services.getComponentStatus(module)])));
    const [skill, setSkill] = useState(() => services.getSkillStatus());
    const [root, setRoot] = useState('/data/slothvault');
    const [nginxMode, setNginxMode] = useState('auto');
    const [nginxContainer, setNginxContainer] = useState('');
    const [availability, setAvailability] = useState(null);
    const [instance, setInstance] = useState(null);
    const [update, setUpdate] = useState(null);
    const [preview, setPreview] = useState(null);
    const [cleanupPreview, setCleanupPreview] = useState(null);
    const [cleanupResult, setCleanupResult] = useState(null);
    const [tasks, setTasks] = useState({});
    const [message, setMessage] = useState(t('workspace.ready'));
    const [busy, setBusy] = useState(false);
    const [focused, setFocused] = useState(false);
    const [scroll, setScroll] = useState(0);
    const [pending, setPending] = useState(null);
    const [prompt, setPrompt] = useState(null);
    const [editor, setEditor] = useState(null);
    const [clock, setClock] = useState(Date.now());
    const busyRef = useRef(false), sessionRef = useRef(null), abortRef = useRef(null), pendingRef = useRef(null), mounted = useRef(true);
    const taskId = useRef(0), activeTask = useRef(null), refreshId = useRef(0);
    const promptRef = useRef(null);
    const currentActions = tab === 'deploy' && nginxPage ? NGINX_MENU_ACTIONS : tab === 'deploy' && packagePage ? PACKAGE_ACTIONS : ACTIONS[tab];
    const selected = tab === 'deploy' && nginxPage ? nginxSelection : tab === 'deploy' && packagePage ? packageSelection : selections[tab];
    const action = currentActions[selected];
    const module = tab === 'deploy' ? 'deployment' : 'skill';
    const task = tasks[tab];
    const taskStatus = task ? t('workflow.states.' + task.state) : message;
    const shell = getShellLayout(columns, rows, {inverseFooter: true, status: busy ? taskStatus : message,
        keys: prompt?.kind === 'confirm' ? t('workflow.confirm') : prompt ? t(prompt.secret || task?.action !== 'update' ? 'workspace.footerInput' : 'workflow.legacyConfirm') : editor ? t('workspace.footerInput') : pending ? t('workspace.footerConfirm') : focused ? t('workflow.footerDetails') : busy ? t('workspace.footerBusy') : t('workflow.footer')});
    const leftHeight = base.compact ? Math.max(4, Math.min(6, Math.floor(shell.contentHeight / 3))) : shell.contentHeight;
    const rightHeight = base.compact ? shell.contentHeight - leftHeight - 1 : shell.contentHeight;
    const leftWidth = base.compact ? shell.contentWidth : base.sidebarWidth;
    const rightWidth = base.compact ? shell.contentWidth : shell.contentWidth - leftWidth - 1;
    const blocked = tab === 'deploy' && (DEPLOY_ACTIONS.includes(action) || action === 'nginx-menu' || action === 'nginx-select') && (packages.deployment.state !== 'installed' || availability?.available === false);
    const summary = VAULT_COMPONENTS.flatMap(item => [field('workspace.modules.' + item, localState(packages[item].state)), field('manager.fields.version', packages[item].currentVersion || '-')]);
    const component = packages[module];
    let lines = [];
    if (tab === 'overview') {
        lines = [...summary, '', ...instanceLines(instance, root)];
        if (action === 'cleanup') {
            lines = [t('workspace.cleanupWarning'), ...(cleanupPreview ? [t('workspace.cleanupPreview', {count: cleanupPreview.count, bytes: formatBytes(cleanupPreview.bytes)}), ...cleanupPreview.items.map(item => item.path), ...(cleanupPreview.migrations || []).map(item => t('workspace.migration', {path: item.path, source: item.targetSource})), ...cleanupPreview.kept.map(item => t('workspace.kept', {path: item.path})), ...cleanupPreview.skipped.map(item => t('workspace.skipped', {path: item.path, reason: item.reason}))] : [t('workspace.cleanupHint')])];
            if (cleanupResult) lines.push(t('workspace.cleanupResult', {count: cleanupResult.removed.length, failed: cleanupResult.errors.length}), ...cleanupResult.errors.map(item => `${item.path}: ${item.code}`));
        }
    } else {
        lines = [field('workspace.modules.' + module, localState(component.state)), field('manager.fields.version', component.currentVersion || '-'),
            field('manager.latestPackageVersion', component.latestVersion || '-'), field('manager.fields.status', localState(component.status || 'unchecked')), component.path || ''];
        if (component.checkedAt) lines.push(field('workspace.checkedAt', component.checkedAt));
        if (component.reason) lines.push('! ' + component.reason);
        if (tab === 'deploy') {
            lines.push(field('manager.deployedAppVersion', instance?.appVersion || '-'), field('manager.fields.root', root));
            if (NGINX_ACTIONS.has(action)) lines.push(field('manager.fields.nginxMode', t('manager.nginxModes.' + nginxMode)), field('manager.fields.container', nginxContainer || '-'));
            if (nginxPage) lines.push('', ...nginxStatusLines(nginxStatus || instance?.nginx), nginxTarget.nginxSite || '');
            if (blocked) lines.unshift(t('workspace.deployBlocked', {reason: availability?.reason || localState(packages.deployment.state)}));
            if (action === 'status') lines.push('', ...instanceLines(instance, root));
            if (action === 'check-update' || action === 'update') lines.push('', ...releaseLines(update, expanded));
            if (preview && task) {
                lines.push(t('workspace.preview'));
                for (const [name, value] of Object.entries(preview)) {
                    if (['provider', 'composePath', 'dataDir', 'databaseDir', 'port', 'image', 'root', 'nginx', 'site', 'upstream', 'loopback', 'domains', 'dns', 'currentVersion', 'targetVersion'].includes(name)) lines.push(`${t('manager.previewFields.' + name)}: ${Array.isArray(value) ? value.join(', ') : value}`);
                }
                for (const change of preview.changes || []) lines.push(`${change.policy}: ${change.directive} ${change.value};`);
                for (const key of ['mainConfig', 'siteConfig', 'hostConfig']) if (preview[key]) lines.push(preview[key]);
                if (preview.impact === 'restart-application') lines.push(t('workflow.restart'));
            }
        }
        if (tab === 'skill') for (const agent of skill.agents || []) lines.push(`${agent.name}: ${localState(agent.detected ? agent.state : 'not-detected')} (${agent.version || '-'})`, agent.targetPath);
        if (component.releaseNotes && action.startsWith('package-')) lines.push('', t('workspace.releaseNotes'),
            ...(expanded ? component.releaseNotes.split(/\r?\n/u) : [t('workflow.notesSummary', {version: component.latestVersion || '-', count: 1})]), component.releaseUrl || '');
    }
    if (tab === 'deploy' && !packagePage) lines = [field('manager.deployedAppVersion', instance?.appVersion || '-'),
        ...lines.filter(line => !line.startsWith(t('manager.deployedAppVersion') + ':'))];
    let pinned = task ? [progressLines(task, clock)[0], t('workflow.versions', {current: tab === 'deploy' && !task.action.startsWith('package-') ? instance?.appVersion || task.currentVersion || '-' : component.currentVersion || '-', target: task.targetVersion || (task.action.startsWith('package-') ? component.latestVersion : null) || '-'}),
        ...progressLines(task, clock).slice(1, task.state === 'waiting' || task.waitingMs ? 4 : 3)] : [];
    if (task?.error) pinned.unshift('! ' + (task.error === 'VERSION_UNVERIFIED' ? t('workflow.unverified') : task.error));
    if (task?.beforeVersion) lines.unshift(t('workflow.before', {version: task.beforeVersion}));
    if (task?.result?.health === 'not-configured') lines.push(t('workflow.noHealth'));
    if (tab === 'deploy' && !packagePage && task?.action === 'update' && preview) {
        const review = [field('workflow.runtimeImage', instance?.runtimeImage || '-'),
            field('manager.previewFields.image', preview.image), field('manager.fields.root', preview.root || root), t('workflow.restart'),
            ...releaseLines(update, expanded)];
        lines = expanded ? [...review, ...lines] : review;
    }
    lines.unshift('── ' + t(task?.state === 'waiting' ? 'workflow.previewTitle' : 'workflow.details'));
    if (task) {
        lines.push('── ' + t('workflow.logs'), ...(task.logs || []), ...(task.details || []));
        for (const layer of Object.values(task.layers || {})) lines.push(`${t('workflow.layer', {subject: layer.subject})}: ${layer.message || layer.status || ''}${Number.isFinite(layer.current) ? ' ' + formatBytes(layer.current) + (Number.isFinite(layer.total) && layer.total > 0 && layer.current <= layer.total ? ' / ' + formatBytes(layer.total) + ` (${Math.floor(layer.current / layer.total * 100)}%)` : '') : ''}`);
        lines.push(...progressLines(task, clock).slice(2));
    }
    if (task && ['running', 'verifying', 'checking'].includes(task.state) && clock - task.lastProgressAt >= 30_000) pinned.unshift(progressLines(task, clock).at(-1));
    if (pending) pinned.unshift(t('workspace.confirm', {action: label(pending.action, tab)}));
    if (editor) pinned.unshift(t('workspace.input.' + editor.kind), '› ' + editorViewport(editor.value, editor.cursor, Math.max(4, rightWidth - 8), {secret: editor.secret}));
    if (prompt) pinned.unshift(prompt.label, prompt.kind === 'confirm' ? t('workflow.confirm') : '› ' + editorViewport(prompt.value, prompt.cursor, Math.max(4, rightWidth - 8), {secret: prompt.secret}));
    lines = lines.filter(line => line !== undefined).map(line => String(line) ? formatSlothVaultError({message: String(line)}) : '');
    pinned = pinned.map(line => formatSlothVaultError({message: String(line)}));
    const liveFollow = follow && !expanded && Boolean(task) && !prompt && !pending && !editor;
    const window = detailWindow(lines, pinned, scroll, rightWidth, rightHeight, liveFollow);

    useEffect(() => {
        if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'render-exit') exit();
        return () => {mounted.current = false; abortRef.current?.abort(); sessionRef.current?.stop();};
    }, [exit]);
    useEffect(() => {
        if (!busy) return;
        const timer = setInterval(() => setClock(Date.now()), 500);
        return () => clearInterval(timer);
    }, [busy]);
    useEffect(() => {
        if (tab !== 'deploy' || packages.deployment.state !== 'installed') return;
        let active = true;
        const generation = ++refreshId.current;
        services.getDeploymentAvailability().then(async result => {
            if (!active) return;
            setAvailability(result);
            if (result.available && !busyRef.current) {
                try {
                    const snapshot = await services.inspectDeployment(root);
                    if (active && generation === refreshId.current && !busyRef.current) setInstance(snapshot);
                } catch { /* The explicit status action retains actionable errors. */ }
            }
        }).catch(() => {if (active) setAvailability({available: false, reason: t('workspace.pythonUnavailable')});});
        return () => {active = false;};
    }, [tab, root, packages.deployment.state, packages.deployment.currentVersion]);

    function refreshLocal() {
        setPackages(current => Object.fromEntries(VAULT_COMPONENTS.map(item => [item, {...current[item], ...services.getComponentStatus(item)}])));
        setSkill(services.getSkillStatus());
    }
    async function taskRun(next, work) {
        if (busyRef.current) return;
        const owner = tab;
        const id = ++taskId.current;
        ++refreshId.current;
        const controller = new AbortController(); abortRef.current = controller;
        busyRef.current = true; setBusy(true); setScroll(0); setFocused(false); setExpanded(false); setFollow(true);
        setMessage(t('workflow.states.checking'));
        let currentTask = createTask(id, next, Date.now(), {currentVersion: instance?.appVersion});
        const patch = transition => {
            if (!mounted.current || activeTask.current?.id !== id) return;
            currentTask = transition(currentTask);
            setTasks(current => ({...current, [owner]: currentTask}));
        };
        activeTask.current = {id, owner, event: event => patch(current => taskEvent(current, event))};
        setTasks(current => ({...current, [owner]: currentTask}));
        const onEvent = event => {
            if (!mounted.current || activeTask.current?.id !== id) return;
            const safe = ['log', 'error'].includes(event.type) ? {...event, message: formatSlothVaultError(event)} : event;
            patch(current => taskEvent(current, safe));
            if (event.type === 'prompt') {
                const input = {...event, value: '', cursor: 0};
                promptRef.current = input; setScroll(0); setPrompt(input);
            }
            else if (event.type === 'snapshot') {setInstance(event.data); if (event.data.nginx) setNginxStatus(event.data.nginx);}
            else if (event.type === 'update') setUpdate({...event.data, checkedAt: new Date().toISOString()});
            else if (event.type === 'preview') {setPreview(event.data); if (event.data.nginxStatus) setNginxStatus(event.data.nginxStatus);}
        };
        try {
            const result = await work(onEvent, controller.signal);
            patch(current => ({...finishTask(current, result), details: (result?.warnings || []).map(item => t('workspace.skipped', {path: item.path, reason: formatSlothVaultError({code: item.code, message: item.code})}))}));
            if (mounted.current) setMessage(t('workflow.result.' + currentTask.state));
        } catch (error) {
            patch(current => finishTask({...current, error: formatSlothVaultError(error)}, {code: controller.signal.aborted ? 130 : 1}));
            if (mounted.current) setMessage(t('workflow.result.' + currentTask.state));
        } finally {
            activeTask.current = null;
            promptRef.current = null;
            sessionRef.current = null;
            abortRef.current = null;
            setPrompt(null); busyRef.current = false;
            if (mounted.current) {setBusy(false); refreshLocal();}
        }
    }
    function requestConfirmation(next, extra = {}) {
        const value = {action: next, ...extra}; pendingRef.current = value; setPending(value); setScroll(0);
    }
    async function run(next, {replace = false} = {}) {
        if (tab === 'deploy' && next.startsWith('nginx') && (packages.deployment.state !== 'installed' || availability?.available === false)) {setMessage(t('workspace.deployBlocked', {reason: availability?.reason || localState(packages.deployment.state)})); return;}
        if (next === 'nginx-menu') {setNginxPage(true); setPackagePage(false); setScroll(0); return;}
        if (next === 'nginx-select') {setEditor({kind: 'site', value: '', cursor: 0}); return;}
        if (next === 'packages') {setNginxPage(false); setPackagePage(true); setScroll(0); setExpanded(false); return;}
        if (next === 'back') {setNginxPage(false); setPackagePage(false); setScroll(0); return;}
        if (next === 'summary' || next === 'package-status') {refreshLocal(); setTasks(current => ({...current, [tab]: null})); setMessage(t('manager.refreshed')); return;}
        if (next === 'root') {setEditor({kind: 'root', value: root, cursor: graphemes(root).length}); return;}
        if (next === 'cleanup') {
            const planned = services.planSlothVaultCleanup(); setCleanupPreview(planned); setCleanupResult(null);
            requestConfirmation('cleanup'); return;
        }
        if (next === 'skill-uninstall') {requestConfirmation(next); return;}
        if (tab === 'deploy' && DEPLOY_ACTIONS.includes(next)) {
            if (packages.deployment.state !== 'installed' || availability?.available === false) {setMessage(t('workspace.deployBlocked', {reason: availability?.reason || localState(packages.deployment.state)})); return;}
            if (!['status', 'check-update', 'update', 'nginx-discover', 'nginx-status', 'nginx-update', 'nginx', 'https', 'renew'].includes(next)) {requestConfirmation(next); return;}
        }
        if (tab === 'skill' && next === 'package-install' && skill.agents?.some(agent => agent.detected && agent.state === 'conflict') && !replace) {requestConfirmation(next, {replace: true}); return;}
        return perform(next, {replace});
    }
    async function perform(next, {replace = false} = {}) {
        return taskRun(next, async (onEvent, signal) => {
            if (next.startsWith('package-')) {
                const operation = next.slice('package-'.length);
                const result = tab === 'skill'
                    ? await (operation === 'check' ? services.checkSkillUpdate({onEvent, signal}) : operation === 'install' ? services.installSkill({onEvent, signal, replace}) : services.updateSkill({onEvent, signal}))
                    : await services.operatePackage(module, operation, {onEvent, signal});
                setPackages(current => ({...current, [module]: {...current[module], ...result, ...services.getComponentStatus(module), reason: result.reason || null}}));
                if (tab === 'skill') setSkill(result);
                return result;
            }
            if (next === 'skill-uninstall') return services.uninstallSkill();
            if (next === 'cleanup') {
                const result = services.cleanupSlothVault({onEvent}); setCleanupResult(result); setInstance(null); setUpdate(null); setPreview(null); return result;
            }
            const available = await services.getDeploymentAvailability();
            setAvailability(available);
            if (!available.available) throw new Error(available.reason);
            if (next === 'status') {const snapshot = await services.inspectDeployment(root, {onEvent}); setInstance(snapshot); return snapshot;}
            setPreview(null);
            let gotSnapshot = false;
            const session = services.createDeploymentSession(buildDeploymentArguments(next, {root, nginxMode, nginxContainer, ...(next === 'nginx-discover' ? {} : nginxTarget)}), {onEvent(event) {
                if (event.type === 'snapshot') gotSnapshot = true;
                onEvent(event);
            }});
            sessionRef.current = session;
            try {
                return await session.result;
            } finally {
                if (!gotSnapshot && mounted.current) {
                    onEvent({type: 'progress', phase: 'verify', status: 'running'});
                    try {onEvent({type: 'snapshot', data: await services.inspectDeployment(root)});}
                    catch {onEvent({type: 'snapshot', data: {appVersion: null, state: 'unreadable', errors: [{scope: 'snapshot', code: 'READ_FAILED'}]}});}
                }
            }
        });
    }
    function change(value, input, key) {
        const edited = editText({value: value.value, cursor: value.cursor}, input, key, 4096);
        return {...value, value: edited.value, cursor: edited.cursor};
    }
    function answerPrompt(value, cancel = false) {
        const input = promptRef.current;
        if (!input) return;
        promptRef.current = null;
        activeTask.current?.event({type: 'answer', cancelled: cancel || value.toLowerCase() === 'n' && (input.kind === 'confirm' || /\[y\/n\]/iu.test(input.label || ''))});
        if (cancel) sessionRef.current?.cancel();
        else sessionRef.current?.respond(value);
        setPrompt(null);
    }
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {abortRef.current?.abort(); sessionRef.current?.stop(); exit(); return;}
        if (base.tooSmall) {if (input === 'q' && !busy) exit(); return;}
        if (promptRef.current) {
            const current = promptRef.current;
            if (key.escape) answerPrompt('', true);
            else if (current.kind === 'confirm') {
                if (input.toLowerCase() === 'y' || input.toLowerCase() === 'n') answerPrompt(input.toLowerCase());
            } else if (key.return) answerPrompt(current.value);
            else {const edited = change(current, input, key); promptRef.current = edited; setPrompt(edited);}
            return;
        }
        if (editor) {
            if (key.escape) setEditor(null);
            else if (key.return) {
                if (editor.kind === 'root') {++refreshId.current; setRoot(editor.value.trim() || '/data/slothvault'); setNginxTarget({}); setNginxStatus(null); setInstance(null); setUpdate(null); setPreview(null); setTasks(current => ({...current, deploy: null}));}
                else if (editor.kind === 'site') {
                    const sites = (nginxStatus || instance?.nginx)?.sites || [];
                    const site = /^\d+$/u.test(editor.value.trim()) ? sites[Number(editor.value.trim()) - 1] : null;
                    if (!site?.upstreams?.length) {setMessage(t('manager.nginxSelectHint')); return;}
                    const instanceId = (nginxStatus || instance?.nginx)?.instances?.find(item => item.id === site.instanceId);
                    setNginxMode(site.mode); setNginxContainer(site.container || '');
                    setNginxTarget({nginxConfig: instanceId?.mainConfig || '', nginxSite: site.siteConfig, nginxServerName: site.serverName || ''});
                } else {setNginxTarget({}); setNginxContainer(editor.value.trim());}
                setEditor(null);
            } else setEditor(current => change(current, input, key));
            return;
        }
        if (pendingRef.current) {
            if (input.toLowerCase() === 'y') {const value = pendingRef.current; pendingRef.current = null; setPending(null); void perform(value.action, value);}
            else if (key.escape || input.toLowerCase() === 'n') {pendingRef.current = null; setPending(null); setMessage(t('workflow.result.cancelled'));}
            return;
        }
        if (input === 'v') {setFocused(value => !value); return;}
        if (input === 'd') {setExpanded(value => !value); setFollow(false); setScroll(0); return;}
        if (focused) {
            if (key.escape) setFocused(false);
            else if (input === 'q' && !busy) exit();
            else if (key.end || input === 'f') {setFollow(true); setScroll(window.maxScroll);}
            else if (key.upArrow || key.pageUp) {setFollow(false); setScroll(Math.max(0, window.offset - (key.pageUp ? window.capacity : 1)));}
            else if (key.downArrow || key.pageDown) {setFollow(false); setScroll(Math.min(window.maxScroll, window.offset + (key.pageDown ? window.capacity : 1)));}
            return;
        }
        if (busy) return;
        if (input === 'q') {exit(); return;}
        if (key.tab || key.rightArrow || key.leftArrow) {setTab(current => TABS[key.leftArrow ? (TABS.indexOf(current) + TABS.length - 1) % TABS.length : nextTabIndex(TABS.indexOf(current), TABS.length, key)]); setScroll(0); setExpanded(false); return;}
        if (key.escape) {if (tab === 'deploy' && nginxPage) setNginxPage(false); else if (tab === 'deploy' && packagePage) setPackagePage(false); else setTab('overview'); setScroll(0); return;}
        if (key.upArrow || key.downArrow) {
            const delta = key.upArrow ? -1 : 1;
            if (tab === 'deploy' && nginxPage) setNginxSelection(current => (current + delta + NGINX_MENU_ACTIONS.length) % NGINX_MENU_ACTIONS.length);
            else if (tab === 'deploy' && packagePage) setPackageSelection(current => (current + delta + PACKAGE_ACTIONS.length) % PACKAGE_ACTIONS.length);
            else setSelections(current => ({...current, [tab]: (current[tab] + delta + ACTIONS[tab].length) % ACTIONS[tab].length}));
            setScroll(0); setFollow(false); return;
        }
        if (input === 'r') {refreshLocal(); if (tab === 'deploy' && !packagePage && packages.deployment.state === 'installed') void perform('status'); else setMessage(t('manager.refreshed')); return;}
        if (input === 'e' && (tab === 'overview' || tab === 'deploy')) {void run('root'); return;}
        if (tab === 'deploy' && input === 'm') {setNginxTarget({}); setNginxMode(mode => NGINX_MODES[(NGINX_MODES.indexOf(mode) + 1) % NGINX_MODES.length]); return;}
        if (tab === 'deploy' && input === 'c' && nginxMode === 'docker') {setEditor({kind: 'container', value: nginxContainer, cursor: graphemes(nginxContainer).length}); return;}
        const shortcut = tab === 'skill' ? {c: 'package-check', n: 'package-update', i: 'package-install', u: 'skill-uninstall'}
                : tab === 'deploy' ? {p: 'package-check', k: 'package-update'} : {};
        if (shortcut[input]) {
            if (tab === 'deploy') {setNginxPage(false); setPackagePage(true); setPackageSelection(PACKAGE_ACTIONS.indexOf(shortcut[input]));}
            else setSelections(current => ({...current, [tab]: ACTIONS[tab].indexOf(shortcut[input])}));
            void run(shortcut[input]); return;
        }
        if (key.return) void run(action);
    });
    usePaste(value => {
        if (promptRef.current && promptRef.current.kind !== 'confirm') {const edited = change(promptRef.current, value, {}); promptRef.current = edited; setPrompt(edited);}
        else if (editor) setEditor(current => change(current, value, {}));
    });

    if (base.tooSmall) return h(Box, {height: rows, width: columns, flexDirection: 'column'}, h(Text, {wrap: 'truncate-end'}, t('manager.resize')), rows > 1 ? h(Text, {}, 'q') : null);
    const capacity = Math.max(1, leftHeight - 3);
    const offset = Math.max(0, Math.min(selected - Math.floor(capacity / 2), currentActions.length - capacity));
    const left = h(Box, {width: leftWidth, height: leftHeight, borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexShrink: 0, flexDirection: 'column'},
        h(Text, {bold: true, color: COLORS.accent, wrap: 'truncate-end'}, truncateFromRight(nginxPage && tab === 'deploy' ? t('manager.actions.nginx-menu') : packagePage && tab === 'deploy' ? t('workflow.packageManager') : t('workspace.actionsTitle'), leftWidth - 4)),
        ...currentActions.slice(offset, offset + capacity).map((item, index) => h(Text, {key: item, inverse: selected === offset + index && !focused, bold: selected === offset + index, wrap: 'truncate-end'},
            truncateFromRight((selected === offset + index ? '› ' : '  ') + label(item, tab), leftWidth - 4))));
    const right = h(TuiDetails, {title: label(task && busy ? task.action : action, tab), lines, pinned, scroll, width: rightWidth, height: rightHeight, focused, follow: liveFollow, state: task?.state});
    return h(TuiFrame, {layout: shell, statusColor: taskColor(task?.state), header: h(TuiHeader, {tabs: TABS.map(id => ({id, label: t('manager.tabs.' + id)})), activeTab: tab, width: shell.contentWidth, meta: t('workflow.interfaceVersion', {version: pluginPackage.version})})},
        h(Box, {height: shell.contentHeight, flexDirection: base.compact ? 'column' : 'row', gap: 1}, left, right));
}
export async function startSlothVaultManagerTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    const instance = render(h(ManagerApp), {alternateScreen: true, exitOnCtrlC: true, patchConsole: false});
    await instance.waitUntilExit();
}
export default {startSlothVaultManagerTui};
