/**
 * @file manager-tui.js
 * @project SlothTool
 * @module SlothVault Skill manager
 * @description A single Skill page with persistent actions, progress and scrollable results.
 * @logic Read local Skill state, confirm conflicts and uninstall, and delegate lifecycle operations to the Skill service.
 * @dependencies React/Ink, Skill services, shared terminal layout and task state
 * @index_tags slothvault,tui,skill,progress
 * @author holic512
 */
import {createElement as h, useEffect, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useWindowSize, render} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {getShellLayout, truncateFromRight} from './shared-interaction.js';
import {TuiFrame, TuiHeader, TuiDetails, progressLines, detailWindow, taskColor, COLORS} from './terminal-ui.js';
import {createTask, taskEvent, finishTask} from './task-state.js';
import {getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill} from './skill-service.js';
import {t, formatSlothVaultError} from './i18n.js';

const ACTIONS = ['package-status', 'package-install', 'package-check', 'package-update', 'skill-repair', 'skill-uninstall'];
const defaults = {getSkillStatus, checkSkillUpdate, installSkill, updateSkill, uninstallSkill};
const label = action => t('workspace.actions.' + action);
const localState = value => {
    const key = 'workspace.states.' + value, text = t(key);
    return text === key ? value || '-' : text;
};
export function resolveSlothVaultManagerLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80), height = Math.max(1, Number(rows) || 24);
    return {width, height, compact: width < 78, short: height < 22, tooSmall: width < 30 || height < 18,
        sidebarWidth: Math.max(25, Math.min(31, Math.floor((width - 5) * 0.35)))};
}
export function ManagerApp({services: overrides = {}} = {}) {
    const services = {...defaults, ...overrides};
    const {exit} = useApp(), {columns = 80, rows = 24} = useWindowSize();
    const base = resolveSlothVaultManagerLayout(columns, rows);
    const [skill, setSkill] = useState(() => services.getSkillStatus());
    const [selected, setSelected] = useState(0), [task, setTask] = useState(null);
    const [message, setMessage] = useState(t('workspace.ready'));
    const [busy, setBusy] = useState(false), [pending, setPending] = useState(null);
    const [focused, setFocused] = useState(false), [expanded, setExpanded] = useState(false);
    const [follow, setFollow] = useState(false), [scroll, setScroll] = useState(0);
    const [clock, setClock] = useState(Date.now());
    const mounted = useRef(true), busyRef = useRef(false), abortRef = useRef(null), taskId = useRef(0);
    const action = ACTIONS[selected];
    const shell = getShellLayout(columns, rows, {inverseFooter: true, status: busy ? t('workflow.states.' + task?.state) : message,
        keys: pending ? t('workspace.footerConfirm') : focused ? t('workflow.footerDetails') : busy ? t('workspace.footerBusy') : t('workflow.footer')});
    const leftHeight = base.compact ? Math.max(4, Math.min(6, Math.floor(shell.contentHeight / 3))) : shell.contentHeight;
    const rightHeight = base.compact ? shell.contentHeight - leftHeight - 1 : shell.contentHeight;
    const leftWidth = base.compact ? shell.contentWidth : base.sidebarWidth;
    const rightWidth = base.compact ? shell.contentWidth : shell.contentWidth - leftWidth - 1;
    const field = (key, value) => `${t(key)}: ${value ?? '-'}`;
    const lines = [field('workspace.modules.skill', localState(skill.sourceState)), field('manager.fields.version', skill.version),
        field('manager.latestPackageVersion', skill.latestVersion), skill.sourcePath || ''];
    if (skill.checkedAt) lines.push(field('workspace.checkedAt', skill.checkedAt));
    if (skill.checkState) lines.push(t('skillVersion.' + skill.checkState, {version: skill.latestVersion || '-'}));
    for (const agent of skill.agents || []) lines.push(`${agent.name}: ${localState(agent.detected ? agent.state : 'not-detected')} (${agent.version || '-'})`, agent.targetPath);
    if (skill.releaseNotes) lines.push('', t('workspace.releaseNotes'), ...(expanded ? skill.releaseNotes.split(/\r?\n/u) : [t('workflow.notesSummary', {version: skill.latestVersion || '-'})]), skill.releaseUrl || '');
    if (task) lines.push('── ' + t('workflow.logs'), ...task.logs, ...(task.details || []));
    const pinned = task ? progressLines(task, clock) : [];
    if (pending) pinned.unshift(t('workspace.confirm', {action: label(pending.action)}));
    const safeLines = lines.map(line => formatSlothVaultError({message: String(line)}));
    const window = detailWindow(safeLines, pinned, scroll, rightWidth, rightHeight, follow);

    useEffect(() => {
        mounted.current = true;
        if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'render-exit') exit();
        return () => {mounted.current = false; abortRef.current?.abort();};
    }, [exit]);
    useEffect(() => {
        if (!busy) return;
        const timer = setInterval(() => setClock(Date.now()), 500);
        return () => clearInterval(timer);
    }, [busy]);

    async function perform(next, {replace = false} = {}) {
        if (busyRef.current) return;
        if (next === 'package-status') {setSkill(services.getSkillStatus()); setMessage(t('manager.refreshed')); setTask(null); return;}
        busyRef.current = true; setBusy(true); setScroll(0); setFollow(true);
        const controller = new AbortController(); abortRef.current = controller;
        let current = createTask(++taskId.current, next);
        const update = event => {current = taskEvent(current, event); if (mounted.current) setTask(current);};
        setTask(current);
        try {
            const options = {onEvent: update, signal: controller.signal};
            const result = next === 'package-check' ? await services.checkSkillUpdate(options)
                : next === 'package-install' ? await services.installSkill({...options, replace})
                    : next === 'skill-uninstall' ? await services.uninstallSkill()
                        : await services.updateSkill({...options, local: next === 'skill-repair'});
            current = finishTask(current, result);
            current.details = [result.reason, ...(result.warnings || []).map(item => t('workspace.skipped', {path: item.path,
                reason: formatSlothVaultError({code: item.code, message: item.code})}))].filter(Boolean);
            if (mounted.current) setSkill({...services.getSkillStatus(), ...result});
        } catch (error) {
            current = finishTask({...current, error: formatSlothVaultError(error)}, {code: controller.signal.aborted ? 130 : 1});
            if (mounted.current) setSkill(services.getSkillStatus());
        } finally {
            busyRef.current = false; abortRef.current = null;
            if (mounted.current) {setTask(current); setMessage(t('workflow.result.' + current.state)); setBusy(false);}
        }
    }
    function run(next) {
        if (next === 'skill-uninstall' || next === 'package-install' && skill.agents?.some(agent => agent.detected && agent.state === 'conflict')) {
            setPending({action: next, replace: next === 'package-install'}); return;
        }
        void perform(next);
    }
    useInput((input, key) => {
        if (base.tooSmall) {if (input === 'q') exit(); return;}
        if (pending) {
            if (input.toLowerCase() === 'y') {const request = pending; setPending(null); void perform(request.action, request);}
            else if (input.toLowerCase() === 'n' || key.escape) setPending(null);
            return;
        }
        if (input === 'v') {setFocused(value => !value); return;}
        if (input === 'd') {setExpanded(value => !value); setFollow(false); setScroll(0); return;}
        if (focused) {
            if (key.escape) setFocused(false);
            else if (input === 'q' && !busyRef.current) exit();
            else if (key.end || input === 'f') {setFollow(true); setScroll(window.maxScroll);}
            else if (key.upArrow || key.pageUp) {setFollow(false); setScroll(Math.max(0, window.offset - (key.pageUp ? window.capacity : 1)));}
            else if (key.downArrow || key.pageDown) {setFollow(false); setScroll(Math.min(window.maxScroll, window.offset + (key.pageDown ? window.capacity : 1)));}
            return;
        }
        if (busyRef.current) return;
        if (input === 'q') {exit(); return;}
        if (key.upArrow || key.downArrow) {setSelected(current => (current + (key.upArrow ? -1 : 1) + ACTIONS.length) % ACTIONS.length); setScroll(0); setFollow(false); return;}
        if (input === 'r') {setSkill(services.getSkillStatus()); setMessage(t('manager.refreshed')); return;}
        const shortcut = {c: 'package-check', n: 'package-update', i: 'package-install', l: 'skill-repair', u: 'skill-uninstall'}[input];
        if (shortcut) {setSelected(ACTIONS.indexOf(shortcut)); run(shortcut); return;}
        if (key.return) run(action);
    });
    if (base.tooSmall) return h(Box, {height: rows, width: columns, flexDirection: 'column'}, h(Text, {wrap: 'truncate-end'}, t('manager.resize')), h(Text, {}, 'q'));
    const capacity = Math.max(1, leftHeight - 3), offset = Math.max(0, Math.min(selected - Math.floor(capacity / 2), ACTIONS.length - capacity));
    return h(TuiFrame, {layout: shell, statusColor: taskColor(task?.state), header: h(TuiHeader, {tabs: [{id: 'skill', label: t('manager.title')}], activeTab: 'skill', width: shell.contentWidth, meta: t('workflow.interfaceVersion', {version: pluginPackage.version})})},
        h(Box, {height: shell.contentHeight, flexDirection: base.compact ? 'column' : 'row', gap: 1},
            h(Box, {width: leftWidth, height: leftHeight, borderStyle: 'round', borderColor: COLORS.border, paddingX: 1, flexShrink: 0, flexDirection: 'column'},
                h(Text, {bold: true, color: COLORS.accent}, t('workspace.actionsTitle')),
                ...ACTIONS.slice(offset, offset + capacity).map((item, index) => h(Text, {key: item, inverse: selected === offset + index && !focused, wrap: 'truncate-end'}, truncateFromRight((selected === offset + index ? '› ' : '  ') + label(item), leftWidth - 4)))),
            h(TuiDetails, {title: label(busy ? task.action : action), lines: safeLines, pinned, scroll, width: rightWidth, height: rightHeight, focused, follow, state: task?.state})));
}
export async function startSlothVaultManagerTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    const instance = render(h(ManagerApp), {alternateScreen: true, exitOnCtrlC: true, patchConsole: false});
    await instance.waitUntilExit();
}
export default {startSlothVaultManagerTui};
