/**
 * @file manager-tui.js
 * @project SlothTool
 * @module SlothVault workspace UI
 * @description Independent component pages with persistent right-side state, results and measured progress.
 * @logic Enter local Overview, gate only deployment operations on its package, and orchestrate each domain through its own service.
 * @dependencies React/Ink, package/Skill services, deployment bridge, owned local cleanup
 * @index_tags slothvault,tui,overview,packages,progress,cleanup
 * @author holic512
 */
import React, {createElement as h, useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, usePaste, useWindowSize, render} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getShellLayout, getDetailWindow, editText, editorViewport, graphemes, nextTabIndex, truncateFromRight} from './shared-interaction.js';
import {TuiFrame, TuiHeader, TuiDetails, progressLines, formatBytes} from './terminal-ui.js';
import {createDeploymentSession, inspectDeployment, getDeploymentAvailability} from './deploy-runner.js';
import {VAULT_COMPONENTS, getComponentStatus} from './slothvault-paths.js';
import {operatePackage} from './package-service.js';
import {getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill} from './skill-service.js';
import {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from './mcp-command-manager.js';
import {planSlothVaultCleanup, cleanupSlothVault, getMcpLocalState} from './slothvault-storage.js';
import {SlothVaultTuiApp} from './tui.js';
import {t, formatSlothVaultError} from './i18n.js';

const TABS = ['overview', 'deploy', 'skill', 'mcp'];
export const DEPLOY_ACTIONS = ['install', 'status', 'check-update', 'update', 'start', 'stop', 'nginx', 'https', 'renew'];
const NGINX_MODES = ['auto', 'system', 'docker'];
const NGINX_ACTIONS = new Set(['install', 'nginx', 'https', 'renew']);
const ACTIONS = {
    overview: ['summary', 'status', 'root', 'cleanup'],
    deploy: ['package-status', 'package-install', 'package-check', 'package-update', ...DEPLOY_ACTIONS],
    skill: ['package-status', 'package-install', 'package-check', 'package-update', 'skill-uninstall'],
    mcp: ['package-status', 'package-install', 'package-check', 'package-update', 'client', 'command-status', 'register', 'unregister']
};
const defaults = {getComponentStatus, operatePackage, getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill,
    getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand, planSlothVaultCleanup, cleanupSlothVault, getMcpLocalState,
    inspectDeployment, createDeploymentSession, getDeploymentAvailability};

export function resolveSlothVaultManagerLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80), height = Math.max(1, Number(rows) || 24);
    return {width, height, compact: width < 78, short: height < 22, tooSmall: width < 30 || height < 18,
        sidebarWidth: Math.max(25, Math.min(31, Math.floor((width - 5) * 0.35)))};
}
export function buildDeploymentArguments(action, {root = '/data/slothvault', nginxMode = 'auto', nginxContainer = ''} = {}) {
    if (!DEPLOY_ACTIONS.includes(action)) throw new Error(`Unsupported deployment action: ${action}`);
    if (!NGINX_MODES.includes(nginxMode)) throw new Error(`Unsupported Nginx mode: ${nginxMode}`);
    const args = ['--action', action, '--root', root.trim() || '/data/slothvault'];
    if (NGINX_ACTIONS.has(action) && nginxMode !== 'auto') args.push('--nginx-mode', nginxMode);
    if (NGINX_ACTIONS.has(action) && nginxMode === 'docker' && nginxContainer.trim()) args.push('--nginx-container', nginxContainer.trim());
    return args;
}
function label(action, tab) {
    if (tab === 'deploy' && DEPLOY_ACTIONS.includes(action)) return t('manager.actions.' + action);
    return t('workspace.actions.' + action);
}
function localState(value) {
    const key = 'workspace.states.' + value, text = t(key);
    return text === key ? value || '-' : text;
}
function field(key, value) {return `${t(key)}: ${value ?? '-'}`;}
function instanceLines(instance, root) {
    if (!instance) return [field('manager.fields.root', root), t('workspace.instanceUnchecked')];
    const lines = [field('manager.fields.status', t('manager.instanceStates.' + instance.state)), field('manager.fields.root', instance.root || root)];
    for (const [name, key] of Object.entries({appVersion: 'manager.deployedAppVersion', image: 'manager.fields.image', provider: 'manager.fields.provider', port: 'manager.fields.port', dataDir: 'manager.fields.dataDir', databaseDir: 'manager.fields.databaseDir'})) if (instance[name] !== undefined) lines.push(field(key, instance[name]));
    for (const container of instance.containers || []) lines.push(`${container.service || container.name}: ${container.state}${container.health ? ' / ' + container.health : ''}`);
    if (instance.nginx) lines.push(`Nginx: ${instance.nginx.state || '-'} ${instance.nginx.serverName || ''}`, `HTTPS: ${instance.nginx.https ? t('yes') : t('no')}`, field('manager.fields.certificate', instance.nginx.certificate || '-'));
    for (const error of instance.errors || []) lines.push(t('manager.readError', {scope: error.scope, code: error.code}));
    return lines;
}
function releaseLines(update) {
    const releases = update?.newer_application_releases?.length ? update.newer_application_releases : update?.next_application_release ? [update.next_application_release] : [];
    return [update ? t('manager.updateState', {state: update.status}) : '', ...releases.flatMap(release => [`[${release.tag}] ${release.title || ''}`, ...(release.notes || t('manager.noReleaseNotes')).split(/\r?\n/u), release.html_url || ''])].filter(Boolean);
}

export function ManagerApp(props = {}) {return h(ManagerShell, props);}
function ManagerShell({services: overrides = {}, inspect, createSession} = {}) {
    const services = {...defaults, ...overrides, ...(inspect ? {inspectDeployment: inspect} : {}), ...(createSession ? {createDeploymentSession: createSession} : {})};
    const {exit} = useApp();
    const {columns = 80, rows = 24} = useWindowSize();
    const base = resolveSlothVaultManagerLayout(columns, rows);
    const [tab, setTab] = useState('overview');
    const [selections, setSelections] = useState({overview: 0, deploy: 0, skill: 0, mcp: 0});
    const [packages, setPackages] = useState(() => Object.fromEntries(VAULT_COMPONENTS.map(module => [module, services.getComponentStatus(module)])));
    const [skill, setSkill] = useState(() => services.getSkillStatus());
    const [command, setCommand] = useState(() => services.getMcpCommandStatus());
    const [mcpState, setMcpState] = useState(() => services.getMcpLocalState());
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
    const [client, setClient] = useState(false);
    const [clock, setClock] = useState(Date.now());
    const busyRef = useRef(false), sessionRef = useRef(null), abortRef = useRef(null), pendingRef = useRef(null), mounted = useRef(true);
    const action = ACTIONS[tab][selections[tab]];
    const module = tab === 'deploy' ? 'deployment' : tab === 'mcp' ? 'mcp-client' : 'skill';
    const shell = getShellLayout(columns, rows, {inverseFooter: true, status: message,
        keys: prompt || editor ? t('workspace.footerInput') : pending ? t('workspace.footerConfirm') : focused ? t('workspace.footerDetails') : busy ? t('workspace.footerBusy') : t('workspace.footer')});
    const leftHeight = base.compact ? client ? 3 : Math.max(4, Math.min(6, Math.floor(shell.contentHeight / 3))) : shell.contentHeight;
    const rightHeight = base.compact ? shell.contentHeight - leftHeight - 1 : shell.contentHeight;
    const leftWidth = base.compact ? shell.contentWidth : base.sidebarWidth;
    const rightWidth = base.compact ? shell.contentWidth : shell.contentWidth - leftWidth - 1;
    const task = tasks[tab];
    const blocked = tab === 'deploy' && DEPLOY_ACTIONS.includes(action) && (packages.deployment.state !== 'installed' || availability?.available === false);
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
            if (blocked) lines.unshift(t('workspace.deployBlocked', {reason: availability?.reason || localState(packages.deployment.state)}));
            if (action === 'status') lines.push('', ...instanceLines(instance, root));
            if (action === 'check-update' || action === 'update') lines.push('', ...releaseLines(update));
            if (preview && task) {
                lines.push(t('workspace.preview'));
                for (const [name, value] of Object.entries(preview)) {
                    if (['provider', 'composePath', 'dataDir', 'databaseDir', 'port', 'image', 'nginx', 'site', 'upstream', 'loopback', 'domains', 'dns', 'currentVersion', 'targetVersion'].includes(name)) lines.push(`${t('manager.previewFields.' + name)}: ${Array.isArray(value) ? value.join(', ') : value}`);
                }
            }
        }
        if (tab === 'skill') for (const agent of skill.agents || []) lines.push(`${agent.name}: ${localState(agent.detected ? agent.state : 'not-detected')} (${agent.version || '-'})`, agent.targetPath);
        if (tab === 'mcp') lines.push(field('workspace.command', localState(command.state)), command.targetPath || command.reason || '',
            field('workspace.profileState', localState(mcpState.profileState)), field('workspace.connectionState', localState(mcpState.connectionState)), t('workspace.mcpHint'));
        if (component.releaseNotes && action.startsWith('package-')) lines.push('', t('workspace.releaseNotes'), ...component.releaseNotes.split(/\r?\n/u), component.releaseUrl || '');
    }
    // Tasks are kept per page. Put live progress before long state and release data.
    if (task) lines = [...progressLines(task, clock), ...(task.logs || []), ...(task.details || []), '', ...lines];
    if (pending) lines.unshift(t('workspace.confirm', {action: label(pending.action, tab)}));
    if (editor) lines.unshift(t('workspace.input.' + editor.kind), '› ' + editorViewport(editor.value, editor.cursor, Math.max(4, rightWidth - 8), {secret: editor.secret}));
    if (prompt) lines.unshift(prompt.label, '› ' + editorViewport(prompt.value, prompt.cursor, Math.max(4, rightWidth - 8), {secret: prompt.secret}));
    lines = lines.filter(line => line !== undefined).map(line => String(line) ? formatSlothVaultError({message: String(line)}) : '');
    const window = getDetailWindow(lines, scroll, rightWidth, rightHeight);

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
        services.getDeploymentAvailability().then(result => {if (active) setAvailability(result);}).catch(() => {if (active) setAvailability({available: false, reason: t('workspace.pythonUnavailable')});});
        return () => {active = false;};
    }, [tab, packages.deployment.state, packages.deployment.currentVersion]);

    function refreshLocal() {
        setPackages(current => Object.fromEntries(VAULT_COMPONENTS.map(item => [item, {...current[item], ...services.getComponentStatus(item)}])));
        setSkill(services.getSkillStatus()); setCommand(services.getMcpCommandStatus());
    }
    async function taskRun(work) {
        if (busyRef.current) return;
        const owner = tab;
        const controller = new AbortController(); abortRef.current = controller;
        busyRef.current = true; setBusy(true); setScroll(0); setFocused(false);
        setTasks(current => ({...current, [owner]: {state: 'running', startedAt: Date.now(), logs: []}}));
        const patch = value => {if (mounted.current) setTasks(current => ({...current, [owner]: {...current[owner], ...value}}));};
        let eventError = false;
        const onEvent = event => {
            if (!mounted.current) return;
            if (event.type === 'progress') setTasks(current => ({...current, [owner]: {...current[owner], progress: event,
                phaseStartedAt: current[owner].progress?.phase === event.phase ? current[owner].phaseStartedAt : Date.now()}}));
            else if (event.type === 'log') setTasks(current => ({...current, [owner]: {...current[owner], logs: [...current[owner].logs, formatSlothVaultError({message: event.message})]}}));
            else if (event.type === 'prompt') {setScroll(0); setPrompt({...event, value: '', cursor: 0});}
            else if (event.type === 'snapshot') setInstance(event.data);
            else if (event.type === 'update') setUpdate(event.data);
            else if (event.type === 'preview') setPreview(event.data);
            else if (event.type === 'error') {eventError = true; patch({error: formatSlothVaultError({code: event.code, message: event.message})});}
        };
        try {
            const result = await work(onEvent, controller.signal);
            const success = !eventError && !['error', 'partial'].includes(result?.status) && (result?.code === undefined || result.code === 0);
            patch({state: result?.code === 130 ? 'cancelled' : success ? 'completed' : 'failed', finishedAt: Date.now(), result: t(success ? 'workspace.completed' : 'workspace.failed'),
                details: (result?.warnings || []).map(item => `${t('workspace.skipped', {path: item.path, reason: item.code})}`)});
            setMessage(t(success ? 'workspace.completed' : 'workspace.failed'));
        } catch (error) {
            patch({state: controller.signal.aborted ? 'cancelled' : 'failed', finishedAt: Date.now(), error: formatSlothVaultError(error)});
            setMessage(t('workspace.failed'));
        } finally {
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
        if (next === 'summary' || next === 'package-status' || next === 'command-status') {refreshLocal(); setTasks(current => ({...current, [tab]: null})); setMessage(t('manager.refreshed')); return;}
        if (next === 'root') {setEditor({kind: 'root', value: root, cursor: graphemes(root).length}); return;}
        if (next === 'client') {
            if (packages['mcp-client'].state !== 'installed') {setMessage(t('workspace.mcpBlocked')); return;}
            setClient(true); return;
        }
        if (next === 'cleanup') {
            const planned = services.planSlothVaultCleanup(); setCleanupPreview(planned); setCleanupResult(null);
            requestConfirmation('cleanup'); return;
        }
        if (next === 'skill-uninstall' || next === 'unregister') {requestConfirmation(next); return;}
        if (tab === 'deploy' && DEPLOY_ACTIONS.includes(next)) {
            if (packages.deployment.state !== 'installed' || availability?.available === false) {setMessage(t('workspace.deployBlocked', {reason: availability?.reason || localState(packages.deployment.state)})); return;}
            if (next === 'update' && !update?.application_update_available) {setMessage(t('manager.checkFirst')); return;}
            if (!['status', 'check-update'].includes(next)) {requestConfirmation(next); return;}
        }
        if (next === 'register' && command.state === 'conflict' && !replace) {requestConfirmation(next, {replace: true}); return;}
        if (tab === 'skill' && next === 'package-install' && skill.agents?.some(agent => agent.detected && agent.state === 'conflict') && !replace) {requestConfirmation(next, {replace: true}); return;}
        return perform(next, {replace});
    }
    async function perform(next, {replace = false} = {}) {
        return taskRun(async (onEvent, signal) => {
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
            if (next === 'register') {const result = services.registerMcpCommand({replace}); setCommand(result); return result;}
            if (next === 'unregister') {const result = services.unregisterMcpCommand(); setCommand(result); return result;}
            if (next === 'cleanup') {
                const result = services.cleanupSlothVault({onEvent}); setCleanupResult(result); setMcpState(services.getMcpLocalState()); setInstance(null); setUpdate(null); setPreview(null); return result;
            }
            const available = await services.getDeploymentAvailability();
            setAvailability(available);
            if (!available.available) throw new Error(available.reason);
            if (next === 'status') {const snapshot = await services.inspectDeployment(root, {onEvent}); setInstance(snapshot); return snapshot;}
            setPreview(null);
            const session = services.createDeploymentSession(buildDeploymentArguments(next, {root, nginxMode, nginxContainer}), {onEvent});
            sessionRef.current = session;
            const result = await session.result;
            // Preserve the operation result even if the following read fails.
            try {setInstance(await services.inspectDeployment(root));} catch { /* The task retains its own outcome. */ }
            return result;
        });
    }
    function change(value, input, key) {
        const edited = editText({value: value.value, cursor: value.cursor}, input, key, 4096);
        return {...value, value: edited.value, cursor: edited.cursor};
    }
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {abortRef.current?.abort(); sessionRef.current?.stop(); exit(); return;}
        if (base.tooSmall) {if (input === 'q' && !busy) exit(); return;}
        if (prompt) {
            if (key.escape) {sessionRef.current?.cancel(); setPrompt(null);}
            else if (key.return) {sessionRef.current?.respond(prompt.value); setPrompt(null);}
            else setPrompt(current => change(current, input, key));
            return;
        }
        if (editor) {
            if (key.escape) setEditor(null);
            else if (key.return) {
                if (editor.kind === 'root') {setRoot(editor.value.trim() || '/data/slothvault'); setInstance(null); setUpdate(null); setPreview(null);}
                else setNginxContainer(editor.value.trim());
                setEditor(null);
            } else setEditor(current => change(current, input, key));
            return;
        }
        if (pendingRef.current) {
            if (input.toLowerCase() === 'y') {const value = pendingRef.current; pendingRef.current = null; setPending(null); void perform(value.action, value);}
            else if (key.escape || input.toLowerCase() === 'n') {pendingRef.current = null; setPending(null);}
            return;
        }
        if (input === 'v') {setFocused(value => !value); return;}
        if (focused) {
            if (key.escape) setFocused(false);
            else if (input === 'q' && !busy) exit();
            else if (key.upArrow || key.pageUp) setScroll(value => Math.max(0, Math.min(value, window.maxScroll) - (key.pageUp ? window.capacity : 1)));
            else if (key.downArrow || key.pageDown) setScroll(value => Math.min(window.maxScroll, value + (key.pageDown ? window.capacity : 1)));
            return;
        }
        if (busy) return;
        if (input === 'q') {exit(); return;}
        if (key.tab || key.rightArrow || key.leftArrow) {setTab(current => TABS[key.leftArrow ? (TABS.indexOf(current) + TABS.length - 1) % TABS.length : nextTabIndex(TABS.indexOf(current), TABS.length, key)]); setScroll(0); return;}
        if (key.escape) {setTab('overview'); setScroll(0); return;}
        if (key.upArrow || key.downArrow) {setSelections(current => ({...current, [tab]: (current[tab] + (key.upArrow ? -1 : 1) + ACTIONS[tab].length) % ACTIONS[tab].length})); setScroll(0); return;}
        if (input === 'r') {refreshLocal(); setTasks(current => ({...current, [tab]: null})); setMessage(t('manager.refreshed')); return;}
        if (input === 'e' && (tab === 'overview' || tab === 'deploy')) {void run('root'); return;}
        if (tab === 'deploy' && input === 'm') {setNginxMode(mode => NGINX_MODES[(NGINX_MODES.indexOf(mode) + 1) % NGINX_MODES.length]); return;}
        if (tab === 'deploy' && input === 'c' && nginxMode === 'docker') {setEditor({kind: 'container', value: nginxContainer, cursor: graphemes(nginxContainer).length}); return;}
        const shortcut = tab === 'skill' ? {c: 'package-check', n: 'package-update', i: 'package-install', u: 'skill-uninstall'}
            : tab === 'mcp' ? {c: 'package-check', n: 'package-update', i: 'package-install', u: 'unregister'}
                : tab === 'deploy' ? {p: 'package-check', k: 'package-update'} : {};
        if (shortcut[input]) {setSelections(current => ({...current, [tab]: ACTIONS[tab].indexOf(shortcut[input])})); void run(shortcut[input]); return;}
        if (key.return) void run(action);
    }, {isActive: !client});
    usePaste(value => {
        if (prompt) setPrompt(current => change(current, value, {}));
        else if (editor) setEditor(current => change(current, value, {}));
    }, {isActive: !client});

    if (base.tooSmall) return h(Box, {height: rows, width: columns, flexDirection: 'column'}, h(Text, {wrap: 'truncate-end'}, t('manager.resize')), rows > 1 ? h(Text, {}, 'q') : null);
    const capacity = Math.max(1, leftHeight - 3);
    const offset = Math.max(0, Math.min(selections[tab] - Math.floor(capacity / 2), ACTIONS[tab].length - capacity));
    const left = h(Box, {width: leftWidth, height: leftHeight, borderStyle: 'round', paddingX: 1, flexShrink: 0, flexDirection: 'column'},
        h(Text, {bold: true, wrap: 'truncate-end'}, t('workspace.actionsTitle')),
        ...ACTIONS[tab].slice(offset, offset + capacity).map((item, index) => h(Text, {key: item, inverse: selections[tab] === offset + index && !focused, bold: selections[tab] === offset + index, wrap: 'truncate-end'},
            truncateFromRight((selections[tab] === offset + index ? '› ' : '  ') + label(item, tab), leftWidth - 4))));
    const right = client ? h(SlothVaultTuiApp, {embedded: true, layoutOverride: {columns: rightWidth, rows: rightHeight, compact: true, tooSmall: false}, onClose: () => {setClient(false); refreshLocal();}, onState: setMcpState})
        : h(TuiDetails, {title: label(action, tab), lines, scroll, width: rightWidth, height: rightHeight, focused});
    return h(TuiFrame, {layout: shell, header: h(TuiHeader, {tabs: TABS.map(id => ({id, label: t('manager.tabs.' + id)})), activeTab: tab, width: shell.contentWidth, meta: 'v' + pluginPackage.version})},
        h(Box, {height: shell.contentHeight, flexDirection: base.compact ? 'column' : 'row', gap: 1}, left, right));
}
export async function startSlothVaultManagerTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    const instance = render(h(ManagerApp), {alternateScreen: true, exitOnCtrlC: true, patchConsole: false});
    await instance.waitUntilExit();
}
export default {startSlothVaultManagerTui};
