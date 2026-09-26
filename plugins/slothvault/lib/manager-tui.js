/**
 * @file SlothVaultManagerTui
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / TUI
 * @description Provides the responsive SlothTool manager for deployment, Skill links, and standalone MCP registration.
 * @logic Inspect a managed deployment through the Python service, render its structured state, and keep prompts and action progress inside Ink.
 * @dependencies React/Ink, Deploy Runner, Skill Manager, MCP Command Manager, I18N
 * @index_tags slothvault,tui,deploy,skill,mcp,registration
 * @author holic512
 */

import process from 'node:process';
import React, {createElement as h, useEffect, useRef, useState} from 'react';
import {Box, Spacer, Text, useApp, useInput, useWindowSize, render} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {createDeploymentSession, inspectDeployment} from './deploy-runner.js';
import {getSkillStatus, installSkill, uninstallSkill} from './skill-manager.js';
import {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from './mcp-command-manager.js';
import {t} from './i18n.js';

const TABS = ['overview', 'deploy', 'skill', 'mcp'];
export const DEPLOY_ACTIONS = ['install', 'status', 'check-update', 'update', 'start', 'stop', 'nginx', 'https', 'renew'];
const NGINX_MODES = ['auto', 'system', 'docker'];
const READ_ONLY_ACTIONS = new Set(['status', 'check-update']);
const NGINX_ACTIONS = new Set(['install', 'nginx', 'https', 'renew']);
const COLORS = {accent: 'cyanBright', secondary: 'magentaBright', border: 'gray', success: 'greenBright', warning: 'yellowBright', danger: 'redBright', muted: 'gray'};

export function resolveSlothVaultManagerLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80);
    const height = Math.max(1, Number(rows) || 24);
    return {width, height, compact: width < 78, short: height < 22, tooSmall: width < 30 || height < 18,
        sidebarWidth: Math.max(30, Math.min(35, Math.floor((width - 5) * 0.40)))};
}

/** Build only supported installer options; Python retains configuration prompts and validation. */
export function buildDeploymentArguments(action, {root = '/data/slothvault', nginxMode = 'auto', nginxContainer = ''} = {}) {
    if (!DEPLOY_ACTIONS.includes(action)) throw new Error(`Unsupported deployment action: ${action}`);
    if (!NGINX_MODES.includes(nginxMode)) throw new Error(`Unsupported Nginx mode: ${nginxMode}`);
    const args = ['--action', action, '--root', root.trim() || '/data/slothvault'];
    if (NGINX_ACTIONS.has(action) && nginxMode !== 'auto') args.push('--nginx-mode', nginxMode);
    if (NGINX_ACTIONS.has(action) && nginxMode === 'docker' && nginxContainer.trim()) {
        args.push('--nginx-container', nginxContainer.trim());
    }
    return args;
}

function stateText(value) {return t(`manager.states.${value || 'unavailable'}`);}
function clip(value, width) {
    const limit = Math.max(4, width);
    const source = String(value ?? '').replace(/\x1b\[[0-9;]*[A-Za-z]/gu, '').replace(/[\r\n\t]/gu, ' ');
    const cells = character => character.codePointAt(0) > 0xFF ? 2 : 1;
    if (Array.from(source).reduce((total, character) => total + cells(character), 0) <= limit) return source;
    let result = '';
    let used = 0;
    for (const character of source) {
        if (used + cells(character) > limit - 1) break;
        result += character;
        used += cells(character);
    }
    return `${result}…`;
}
function Panel({title, children, color = COLORS.border, badge = null}) {
    return h(Box, {borderStyle: 'round', borderColor: color, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(Box, {}, h(Text, {bold: true, color: COLORS.accent}, title),
            badge ? h(Text, {bold: true, color: COLORS.secondary}, '  [' + badge + ']') : null),
        children);
}
function Field({label, value, color}) {
    return h(Box, {}, h(Text, {color: COLORS.accent}, `${label}  `), h(Text, {color}, String(value || '-')));
}
function TwoPanels({left, right, layout}) {
    return h(Box, {flexDirection: layout.compact ? 'column' : 'row', flexGrow: 1},
        h(Box, {width: layout.compact ? undefined : layout.sidebarWidth, marginRight: layout.compact ? 0 : 1,
            marginBottom: layout.compact ? 1 : 0, flexDirection: 'column'}, left),
        h(Box, {flexGrow: 1, flexDirection: 'column'}, right));
}
function statusColor(value) {
    if (value === 'running' || value === 'healthy' || value === 'configured') return COLORS.success;
    if (value === 'absent' || value === 'exited' || value === 'stopped') return COLORS.warning;
    if (value === 'unmanaged' || value === 'unreadable' || value === 'unhealthy') return COLORS.danger;
    return COLORS.muted;
}
function InstanceSummary({instance, layout}) {
    const state = instance?.state || 'loading';
    const containers = instance?.containers || [];
    const running = containers.filter(item => item.state === 'running').length;
    return h(Panel, {title: t('manager.panels.instance'), badge: t('manager.instanceStates.' + state)},
        h(Text, {bold: true, color: statusColor(state)}, t('manager.instanceStates.' + state)),
        h(Field, {label: t('manager.fields.root'), value: clip(instance?.root || '/data/slothvault', layout.sidebarWidth - 13)}),
        h(Field, {label: t('manager.fields.containers'), value: running + '/' + containers.length, color: running ? COLORS.success : COLORS.warning}),
        h(Field, {label: t('manager.fields.provider'), value: instance?.provider || '-'}),
        h(Field, {label: t('manager.fields.port'), value: instance?.port ? String(instance.port) : '-'}),
        instance?.errors?.length ? h(Text, {color: COLORS.warning}, t('manager.partialState')) : null);
}
function InstanceDetails({instance, layout}) {
    const max = layout.compact ? layout.width - 12 : layout.width - layout.sidebarWidth - 15;
    if (!instance || instance.state === 'absent') return h(Panel, {title: t('manager.panels.details')},
        h(Text, {bold: true}, t('manager.emptyInstance')),
        h(Text, {dimColor: true}, t('manager.emptyInstanceHint')));
    if (instance.state !== 'managed') return h(Panel, {title: t('manager.panels.details'), color: COLORS.warning},
        h(Text, {bold: true, color: COLORS.warning}, t('manager.instanceStates.' + instance.state)),
        h(Text, {dimColor: true}, t('manager.unmanagedHint')),
        h(Field, {label: t('manager.fields.root'), value: clip(instance.root, max)}));
    const containers = instance.containers || [];
    const visible = containers.slice(0, layout.short ? 2 : 5);
    return h(Panel, {title: t('manager.panels.details'), badge: String(containers.length)},
        h(Field, {label: t('manager.fields.image'), value: clip(instance.image || '-', max)}),
        h(Field, {label: t('manager.fields.version'), value: clip(instance.appVersion || '-', max)}),
        h(Field, {label: t('manager.fields.dataDir'), value: clip(instance.dataDir || '-', max)}),
        instance.databaseDir ? h(Field, {label: t('manager.fields.databaseDir'), value: clip(instance.databaseDir, max)}) : null,
        h(Field, {label: t('manager.fields.network'), value: instance.loopback ? t('manager.loopback') : t('manager.publicPort')}),
        ...visible.map(item => h(Box, {key: item.name || item.service},
            h(Text, {color: statusColor(item.state)}, '● '),
            h(Text, {bold: true}, clip(item.service, 14) + '  '),
            h(Text, {color: statusColor(item.state)}, item.state + (item.health ? ' / ' + item.health : '')))),
        h(Field, {label: t('manager.fields.hostNginx'), value: instance.nginx?.state === 'configured'
            ? (instance.nginx.serverName || t('manager.states.installed')) + (instance.nginx.https ? ' HTTPS' : ' HTTP')
            : t('manager.instanceStates.unknown')}),
        instance.nginx?.https ? h(Field, {label: t('manager.fields.certificate'),
            value: t('manager.certificateStates.' + instance.nginx.certificate),
            color: instance.nginx.certificate === 'present' ? COLORS.success : COLORS.warning}) : null,
        ...(instance.errors || []).slice(0, 2).map((item, index) => h(Text, {key: index, color: COLORS.warning},
            t('manager.readError', {scope: item.scope, code: item.code}))));
}
function updateReleaseLines(update) {
    const releases = Array.isArray(update?.newer_application_releases) && update.newer_application_releases.length
        ? update.newer_application_releases
        : update?.next_application_release ? [update.next_application_release] : [];
    return releases.flatMap(release => [
        `[${release.tag}] ${release.title || release.tag}`,
        ...(release.notes ? release.notes.split(/\r?\n/gu) : [t('manager.noReleaseNotes')]),
        release.html_url
    ].filter(Boolean));
}

function DeployPage({layout, selectedIndex, root, nginxMode, nginxContainer, editing, draft, pending, instance, update, preview, noteOffset, logs, prompt, promptValue, busy}) {
    const action = DEPLOY_ACTIONS[selectedIndex];
    const usesNginx = NGINX_ACTIONS.has(action);
    const listLimit = layout.compact ? layout.short ? 3 : 5 : DEPLOY_ACTIONS.length;
    const firstAction = Math.max(0, Math.min(selectedIndex - Math.floor(listLimit / 2), DEPLOY_ACTIONS.length - listLimit));
    const list = h(Panel, {title: t('manager.panels.actions') + '  ' + (selectedIndex + 1) + '/' + DEPLOY_ACTIONS.length},
        ...DEPLOY_ACTIONS.slice(firstAction, firstAction + listLimit).map((item, offset) => h(Box, {key: item},
            h(Text, {bold: firstAction + offset === selectedIndex, color: firstAction + offset === selectedIndex ? COLORS.accent : COLORS.muted},
                (firstAction + offset === selectedIndex ? '› ' : '  ') + t('manager.actions.' + item)),
            h(Spacer, {}),
            h(Text, {color: READ_ONLY_ACTIONS.has(item) ? COLORS.secondary : COLORS.warning, dimColor: true},
                t('manager.actionKinds.' + (READ_ONLY_ACTIONS.has(item) ? 'read' : 'change'))))));
    const release = preview ? null : update?.next_application_release;
    const releaseLines = preview ? [] : updateReleaseLines(update);
    const shownNotes = releaseLines.slice(noteOffset, noteOffset + (layout.short ? 1 : 3));
    const previewEntries = preview ? Object.entries(preview).filter(([key, value]) =>
        key !== 'kind' && value !== null && value !== undefined && value !== '') : [];
    const shownPreview = previewEntries.slice(noteOffset, noteOffset + (layout.short ? 1 : 4));
    const details = h(Panel, {title: t('manager.panels.deployment'), color: pending ? COLORS.warning : COLORS.border,
        badge: busy ? t('manager.running') : null},
        h(Text, {bold: true}, t('manager.actions.' + action)),
        layout.short ? null : h(Text, {dimColor: true}, t('manager.actionDetails.' + action)),
        h(Box, {flexDirection: 'column'},
            h(Field, {label: t('manager.fields.root'), value: clip(editing === 'root' ? draft + '█' : root, layout.compact ? layout.width - 13 : layout.width - layout.sidebarWidth - 14), color: editing === 'root' ? COLORS.accent : undefined}),
            usesNginx ? h(Field, {label: t('manager.fields.nginxMode'), value: t('manager.nginxModes.' + nginxMode), color: nginxMode === 'docker' ? COLORS.warning : undefined}) : null,
            usesNginx && nginxMode === 'docker' ? h(Field, {label: t('manager.fields.container'), value: clip(editing === 'container' ? draft + '█' : nginxContainer || t('manager.containerPrompt'), 35), color: editing === 'container' ? COLORS.accent : undefined}) : null),
        prompt ? h(Box, {flexDirection: 'column', marginTop: 1},
            h(Text, {bold: true, color: COLORS.warning}, clip(prompt.label, layout.compact ? layout.width - 10 : 50)),
            h(Text, {color: COLORS.accent}, '› ' + clip(prompt.secret ? '●'.repeat(promptValue.length) : promptValue,
                layout.compact ? layout.width - 14 : layout.width - layout.sidebarWidth - 14) + '█')) : null,
        pending ? h(Text, {color: COLORS.warning}, t('manager.deployConfirm', {action: t('manager.actions.' + pending)})) : null,
        preview ? h(Box, {flexDirection: 'column', marginTop: 1},
            h(Text, {bold: true, color: COLORS.secondary}, t('manager.previewKinds.' + preview.kind)),
            ...shownPreview.map(([key, value]) => h(Field, {key, label: t('manager.previewFields.' + key),
                value: clip(typeof value === 'boolean' ? t(value ? 'yes' : 'no') : value,
                    layout.compact ? layout.width - 22 : layout.width - layout.sidebarWidth - 22)})),
            previewEntries.length > shownPreview.length ? h(Text, {color: COLORS.secondary},
                t('manager.previewPage', {current: Math.min(noteOffset + shownPreview.length, previewEntries.length), total: previewEntries.length})) : null) : null,
        update?.latest_published_release ? h(Text, {color: COLORS.secondary},
            t('manager.latestRelease', {tag: update.latest_published_release.tag})) : null,
        release ? h(Box, {flexDirection: 'column', marginTop: 1},
            h(Text, {color: COLORS.success}, t('manager.targetRelease', {tag: release.tag})),
            ...shownNotes.map((line, index) => h(Text, {key: index, dimColor: true},
                clip(line, layout.compact ? layout.width - 12 : layout.width - layout.sidebarWidth - 12))),
            releaseLines.length > shownNotes.length ? h(Text, {color: COLORS.secondary},
                t('manager.notesPage', {current: Math.min(noteOffset + shownNotes.length, releaseLines.length), total: releaseLines.length})) : null) : null,
        update && !release ? h(Text, {color: COLORS.warning}, t('manager.updateState', {state: update.status})) : null,
        instance && !layout.short ? h(Text, {dimColor: true},
            t('manager.currentState', {state: t('manager.instanceStates.' + instance.state)})) : null,
        ...logs.slice(-(layout.short || preview ? 1 : 3)).map((line, index) => h(Text, {key: index, dimColor: true},
            clip(line, layout.compact ? layout.width - 10 : layout.width - layout.sidebarWidth - 10))));
    return h(TwoPanels, {left: list, right: details, layout});
}

function ManagerApp() {
    const {exit} = useApp();
    const {columns = 80, rows = 24} = useWindowSize();
    const layout = resolveSlothVaultManagerLayout(columns, rows);
    const [tab, setTab] = useState('overview');
    const [skill, setSkill] = useState(() => getSkillStatus());
    const [mcp, setMcp] = useState(() => getMcpCommandStatus());
    const [instance, setInstance] = useState(null);
    const [update, setUpdate] = useState(null);
    const [preview, setPreview] = useState(null);
    const [noteOffset, setNoteOffset] = useState(0);
    const [message, setMessage] = useState(t('manager.ready'));
    const [messageColor, setMessageColor] = useState(COLORS.success);
    const [selectedAction, setSelectedAction] = useState(0);
    const [root, setRoot] = useState('/data/slothvault');
    const [nginxMode, setNginxMode] = useState('auto');
    const [nginxContainer, setNginxContainer] = useState('');
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState('');
    const [pending, setPending] = useState(null);
    const [prompt, setPrompt] = useState(null);
    const [promptValue, setPromptValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState([]);
    const sessionRef = useRef(null);
    const inspectionIdRef = useRef(0);

    useEffect(() => {
        if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'render-exit') {exit(); return;}
        let active = true;
        const id = ++inspectionIdRef.current;
        inspectDeployment(root).then(value => {if (active && id === inspectionIdRef.current) setInstance(value);})
            .catch(error => {if (active && id === inspectionIdRef.current) {setMessage(error.message); setMessageColor(COLORS.warning);}});
        return () => {active = false; inspectionIdRef.current++; sessionRef.current?.stop();};
    }, [exit]);

    async function refreshInstance(nextRoot = root) {
        const id = ++inspectionIdRef.current;
        try {
            const value = await inspectDeployment(nextRoot);
            if (id === inspectionIdRef.current) setInstance(value);
            return id === inspectionIdRef.current ? value : null;
        } catch (error) {
            if (id === inspectionIdRef.current) {
                setMessage(t('manager.refreshFailed', {message: error.message}));
                setMessageColor(COLORS.danger);
            }
            return null;
        }
    }
    function refresh() {
        try {
            setSkill(getSkillStatus());
            setMcp(getMcpCommandStatus());
            setMessage(t('manager.refreshed'));
            setMessageColor(COLORS.success);
        } catch (error) {
            setMessage(t('manager.refreshFailed', {message: error.message}));
            setMessageColor(COLORS.warning);
        }
        refreshInstance();
    }
    function operateSkill(action) {
        try {
            const result = action === 'install' ? installSkill() : uninstallSkill();
            setSkill(result);
            setMessage(t('manager.skillActionCompleted', {action: stateText(result.action || action)}));
            setMessageColor(COLORS.success);
        } catch (error) {setMessage(t('manager.skillActionFailed', {message: error.message})); setMessageColor(COLORS.warning);}
    }
    function operateMcp(action) {
        try {
            const result = action === 'register' ? registerMcpCommand() : unregisterMcpCommand();
            setMcp(result);
            setMessage(t('manager.mcpActionCompleted', {action: stateText(result.action)}));
            setMessageColor(COLORS.success);
        } catch (error) {setMessage(t('manager.mcpActionFailed', {message: error.message})); setMessageColor(COLORS.warning);}
    }
    async function runAction(action) {
        setPending(null);
        if (action === 'status') {
            setMessage(t('manager.loadingInstance'));
            if (await refreshInstance()) setMessage(t('manager.refreshed'));
            return;
        }
        setBusy(true);
        setPreview(null);
        setNoteOffset(0);
        if (action !== 'check-update' && action !== 'update') setUpdate(null);
        setLogs([]);
        setMessage(t('manager.runningAction', {action: t('manager.actions.' + action)}));
        setMessageColor(COLORS.accent);
        try {
            let actionError = null;
            const session = createDeploymentSession(buildDeploymentArguments(action, {root, nginxMode, nginxContainer}), {
                onEvent(event) {
                    if (event.type === 'prompt') {setPrompt(event); setPromptValue('');}
                    if (event.type === 'snapshot') setInstance(event.data);
                    if (event.type === 'update') {setUpdate(event.data); setNoteOffset(0);}
                    if (event.type === 'preview') {setPreview(event.data); setNoteOffset(0);}
                    if (event.type === 'progress') setMessage(t('manager.phase', {phase: event.phase}));
                    if (event.type === 'log') setLogs(current => [...current, event.message].slice(-30));
                    if (event.type === 'error') {actionError = event.message; setMessage(event.message); setMessageColor(COLORS.danger);}
                }
            });
            sessionRef.current = session;
            const result = await session.result;
            if (action === 'update') setUpdate(null);
            setMessage(actionError || t(result.code === 0 ? 'manager.deployCompleted' : 'manager.deployFailed',
                {action: t('manager.actions.' + action), code: result.code}));
            setMessageColor(result.code === 0 ? COLORS.success : COLORS.danger);
        } catch (error) {
            setMessage(t('manager.deployStartFailed', {message: error.message}));
            setMessageColor(COLORS.danger);
        } finally {
            sessionRef.current = null;
            setBusy(false);
            setPrompt(null);
            setPromptValue('');
            await refreshInstance();
        }
    }
    function changeInput(input, key, value, setter) {
        if (key.ctrl && input === 'u') {setter(''); return;}
        if (key.backspace || key.delete) {setter(value.slice(0, -1)); return;}
        const printable = input.replace(/[\u0000-\u001f\u007f]/gu, '');
        if (printable && !key.ctrl && !key.meta) setter((value + printable).slice(0, 512));
    }
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {sessionRef.current?.stop(); exit(); return;}
        if (prompt) {
            if (key.escape) {sessionRef.current?.cancel(); setPrompt(null); setPromptValue(''); return;}
            if (key.return) {sessionRef.current?.respond(promptValue); setPrompt(null); setPromptValue(''); return;}
            if (key.upArrow || key.downArrow) {
                const length = preview
                    ? Object.entries(preview).filter(([name, value]) => name !== 'kind' && value !== null && value !== undefined && value !== '').length
                    : updateReleaseLines(update).length;
                setNoteOffset(index => key.upArrow ? Math.max(0, index - 3) : Math.min(Math.max(0, length - 1), index + 3));
                return;
            }
            changeInput(input, key, promptValue, setPromptValue);
            return;
        }
        if (busy) return;
        if (editing) {
            if (key.escape) {setEditing(null); setDraft(''); return;}
            if (key.return) {
                if (editing === 'root') {
                    const nextRoot = draft.trim() || '/data/slothvault';
                    setRoot(nextRoot);
                    setInstance(null);
                    setUpdate(null);
                    setPreview(null);
                    refreshInstance(nextRoot);
                } else setNginxContainer(draft.trim());
                setEditing(null);
                setDraft('');
                return;
            }
            changeInput(input, key, draft, setDraft);
            return;
        }
        if (pending) {
            if (input.toLowerCase() === 'y') runAction(pending);
            else if (input.toLowerCase() === 'n' || key.escape) {setPending(null); setMessage(t('manager.deployCancelled')); setMessageColor(COLORS.warning);}
            return;
        }
        if (input === 'q') {exit(); return;}
        if (key.tab || key.rightArrow) {setTab(current => TABS[(TABS.indexOf(current) + 1) % TABS.length]); return;}
        if (key.leftArrow) {setTab(current => TABS[(TABS.indexOf(current) - 1 + TABS.length) % TABS.length]); return;}
        if (input === 'r') {refresh(); return;}
        if (tab === 'deploy' || tab === 'overview') {
            if (input === 'e') {setTab('deploy'); setEditing('root'); setDraft(root); return;}
        }
        if (tab === 'deploy') {
            if (input === '[') {setNoteOffset(index => Math.max(0, index - 3)); return;}
            if (input === ']') {
                const length = preview
                    ? Object.entries(preview).filter(([key, value]) => key !== 'kind' && value !== null && value !== undefined && value !== '').length
                    : updateReleaseLines(update).length;
                setNoteOffset(index => Math.min(Math.max(0, length - 1), index + 3));
                return;
            }
            if (key.upArrow) {setPreview(null); setSelectedAction(index => (index - 1 + DEPLOY_ACTIONS.length) % DEPLOY_ACTIONS.length); return;}
            if (key.downArrow) {setPreview(null); setSelectedAction(index => (index + 1) % DEPLOY_ACTIONS.length); return;}
            if (input === 'm' && NGINX_ACTIONS.has(DEPLOY_ACTIONS[selectedAction])) {setNginxMode(mode => NGINX_MODES[(NGINX_MODES.indexOf(mode) + 1) % NGINX_MODES.length]); return;}
            if (input === 'c' && NGINX_ACTIONS.has(DEPLOY_ACTIONS[selectedAction]) && nginxMode === 'docker') {setEditing('container'); setDraft(nginxContainer); return;}
            if (key.return) {
                const action = DEPLOY_ACTIONS[selectedAction];
                if (action === 'update' && !update?.application_update_available) {
                    setMessage(t('manager.checkFirst'));
                    setMessageColor(COLORS.warning);
                } else if (READ_ONLY_ACTIONS.has(action)) runAction(action);
                else setPending(action);
                return;
            }
        }
        if (tab === 'skill' && input === 'i') operateSkill('install');
        if (tab === 'skill' && input === 'u') operateSkill('uninstall');
        if (tab === 'mcp' && input === 'i') operateMcp('register');
        if (tab === 'mcp' && input === 'u') operateMcp('unregister');
    });

    if (layout.tooSmall) return h(Panel, {title: t('manager.title'), color: COLORS.warning}, h(Text, {}, t('manager.resize')));
    const tabs = TABS.flatMap((item, index) => [
        index ? h(Text, {key: item + '-separator', color: COLORS.muted}, ' | ') : null,
        h(Text, {key: item, bold: item === tab, color: item === tab ? COLORS.accent : COLORS.muted},
            item === tab ? '[' + t('manager.tabs.' + item) + ']' : t('manager.tabs.' + item))
    ]).filter(Boolean);
    const detailWidth = layout.compact ? layout.width - 8 : layout.width - layout.sidebarWidth - 12;
    let content;
    if (tab === 'deploy') content = h(DeployPage, {layout, selectedIndex: selectedAction, root, nginxMode, nginxContainer, editing, draft,
        pending, instance, update, preview, noteOffset, logs, prompt, promptValue, busy});
    else if (tab === 'skill') content = h(TwoPanels, {layout,
        left: h(Panel, {title: t('manager.panels.skill')}, h(Field, {label: t('manager.fields.status'), value: stateText(skill.state)}), h(Text, {dimColor: true}, t('manager.skillGuide'))),
        right: h(Panel, {title: t('manager.panels.targets')}, ...skill.agents.map(agent => h(Box, {key: agent.id, flexDirection: 'column'},
            h(Text, {color: agent.detected ? COLORS.success : COLORS.muted}, agent.name + ': ' + stateText(agent.detected ? agent.state : 'not-detected')),
            h(Text, {dimColor: true}, clip(agent.targetPath, detailWidth)))))
    });
    else if (tab === 'mcp') content = h(TwoPanels, {layout,
        left: h(Panel, {title: t('manager.panels.command')}, h(Field, {label: t('manager.fields.status'), value: stateText(mcp.state)}), h(Text, {dimColor: true}, t('manager.mcpGuideAction'))),
        right: h(Panel, {title: t('manager.panels.details')}, h(Text, {}, mcp.targetPath ? t('manager.target', {target: clip(mcp.targetPath, detailWidth)}) : t('manager.reason', {reason: clip(mcp.reason || '-', detailWidth)})), h(Text, {dimColor: true}, t('manager.mcpGuide')))
    });
    else content = layout.compact && layout.short
        ? h(Box, {flexDirection: 'column'}, h(InstanceSummary, {instance, layout}),
            h(Text, {dimColor: true}, t('manager.shortHint')))
        : h(TwoPanels, {layout,
        left: h(InstanceSummary, {instance, layout}),
        right: h(InstanceDetails, {instance, layout})
    });
    const footer = prompt ? t('manager.footers.prompt') : editing ? t('manager.footers.edit') : pending
        ? t('manager.footers.confirm') : busy ? t('manager.footers.busy') : t('manager.footers.' + tab);
    return h(Box, {flexDirection: 'column', height: layout.height, paddingX: 1, paddingY: 1},
        h(Box, {}, ...tabs, h(Spacer, {}), layout.width > 65 ? h(Text, {dimColor: true}, 'v' + pluginPackage.version) : null),
        h(Box, {marginBottom: 1}, h(Text, {color: COLORS.muted}, '─'.repeat(layout.width - 4))),
        h(Box, {flexGrow: 1, flexDirection: 'column'}, content),
        h(Box, {marginTop: 1}, h(Text, {color: pending ? COLORS.warning : messageColor}, clip(message, layout.width - 4))),
        h(Text, {inverse: true}, clip(footer, layout.width - 4)));
}

export async function startSlothVaultManagerTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    const instance = render(h(ManagerApp), {alternateScreen: true, exitOnCtrlC: true, patchConsole: false});
    await instance.waitUntilExit();
}

export default {startSlothVaultManagerTui};
