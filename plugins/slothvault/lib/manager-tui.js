/**
 * @file SlothVaultManagerTui
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / TUI
 * @description Provides the responsive SlothTool manager for deployment, Skill links, and standalone MCP registration.
 * @logic Show local state and deployment actions in the shared plugin shell; release the alternate screen before passing a selected action to the bundled installer.
 * @dependencies React/Ink, Deploy Runner, Skill Manager, MCP Command Manager, I18N
 * @index_tags slothvault,tui,deploy,skill,mcp,registration
 * @author holic512
 */

import process from 'node:process';
import React, {createElement as h, useEffect, useState} from 'react';
import {Box, Spacer, Text, useApp, useInput, useWindowSize, render} from 'ink';
import pluginPackage from '../package.json' with {type: 'json'};
import {runDeployment} from './deploy-runner.js';
import {getSkillStatus, installSkill, uninstallSkill} from './skill-manager.js';
import {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from './mcp-command-manager.js';
import {t} from './i18n.js';

const TABS = ['overview', 'deploy', 'skill', 'mcp'];
export const DEPLOY_ACTIONS = ['install', 'status', 'check-update', 'update', 'start', 'stop', 'nginx', 'https', 'renew'];
const NGINX_MODES = ['auto', 'system', 'docker'];
const READ_ONLY_ACTIONS = new Set(['status', 'check-update']);
const NGINX_ACTIONS = new Set(['install', 'nginx', 'https', 'renew']);
const COLORS = {accent: 'cyanBright', border: 'gray', success: 'greenBright', warning: 'yellowBright', muted: 'gray'};

export function resolveSlothVaultManagerLayout(columns = 80, rows = 24) {
    const width = Math.max(1, Number(columns) || 80);
    const height = Math.max(1, Number(rows) || 24);
    return {width, height, compact: width < 78, short: height < 22, tooSmall: width < 34 || height < 18,
        sidebarWidth: Math.max(30, Math.min(42, Math.floor((width - 5) * 0.42)))};
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
    const source = String(value ?? '');
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
function Panel({title, children, color = COLORS.border}) {
    return h(Box, {borderStyle: 'round', borderColor: color, paddingX: 1, flexDirection: 'column', flexGrow: 1},
        h(Text, {bold: true, color: COLORS.accent}, title), children);
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
function DeployPage({layout, selectedIndex, root, nginxMode, nginxContainer, editing, pending}) {
    const action = DEPLOY_ACTIONS[selectedIndex];
    const usesNginx = NGINX_ACTIONS.has(action);
    const listLimit = layout.compact ? layout.short ? 2 : 3 : DEPLOY_ACTIONS.length;
    const firstAction = Math.max(0, Math.min(selectedIndex - Math.floor(listLimit / 2), DEPLOY_ACTIONS.length - listLimit));
    const list = h(Panel, {title: `${t('manager.panels.actions')}  ${selectedIndex + 1}/${DEPLOY_ACTIONS.length}`},
        ...DEPLOY_ACTIONS.slice(firstAction, firstAction + listLimit).map((item, offset) => h(Text, {key: item, bold: firstAction + offset === selectedIndex,
            color: firstAction + offset === selectedIndex ? COLORS.accent : undefined, dimColor: firstAction + offset !== selectedIndex},
        `${firstAction + offset === selectedIndex ? '›' : ' '} ${t(`manager.actions.${item}`)}`)));
    const details = h(Panel, {title: t('manager.panels.deployment'), color: pending ? COLORS.warning : COLORS.border},
        h(Text, {bold: true}, t(`manager.actions.${action}`)),
        layout.short ? null : h(Text, {dimColor: true}, t(`manager.actionDetails.${action}`)),
        h(Box, {flexDirection: 'column'},
            h(Field, {label: t('manager.fields.root'), value: clip(root, layout.compact ? layout.width - 13 : layout.width - layout.sidebarWidth - 14), color: editing === 'root' ? COLORS.accent : undefined}),
            usesNginx ? h(Field, {label: t('manager.fields.nginxMode'), value: t(`manager.nginxModes.${nginxMode}`), color: nginxMode === 'docker' ? COLORS.warning : undefined}) : null,
            usesNginx && nginxMode === 'docker' ? h(Field, {label: t('manager.fields.container'), value: clip(nginxContainer || t('manager.containerPrompt'), 35), color: editing === 'container' ? COLORS.accent : undefined}) : null),
        layout.compact && !pending ? null : h(Box, {flexDirection: 'column'},
            pending ? h(Text, {color: COLORS.warning}, t('manager.deployConfirm', {action: t(`manager.actions.${pending}`)}))
                : h(Text, {dimColor: true}, t('manager.deploySafety')),
            layout.compact ? null : h(Text, {dimColor: true}, t('manager.deployPrivilege'))));
    return h(TwoPanels, {left: list, right: details, layout});
}

function ManagerApp({onDeploy}) {
    const {exit} = useApp();
    const {columns = 80, rows = 24} = useWindowSize();
    const layout = resolveSlothVaultManagerLayout(columns, rows);
    const [tab, setTab] = useState('overview');
    const [skill, setSkill] = useState(() => getSkillStatus());
    const [mcp, setMcp] = useState(() => getMcpCommandStatus());
    const [message, setMessage] = useState(t('manager.ready'));
    const [messageColor, setMessageColor] = useState(COLORS.success);
    const [selectedAction, setSelectedAction] = useState(0);
    const [root, setRoot] = useState('/data/slothvault');
    const [nginxMode, setNginxMode] = useState('auto');
    const [nginxContainer, setNginxContainer] = useState('');
    const [editing, setEditing] = useState(null);
    const [pending, setPending] = useState(null);

    useEffect(() => {if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'render-exit') exit();}, [exit]);
    function refresh() {
        try {setSkill(getSkillStatus()); setMcp(getMcpCommandStatus()); setMessage(t('manager.refreshed')); setMessageColor(COLORS.success);}
        catch (error) {setMessage(t('manager.refreshFailed', {message: error.message})); setMessageColor(COLORS.warning);}
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
    function launch(action) {
        onDeploy(action, buildDeploymentArguments(action, {root, nginxMode, nginxContainer}));
        exit();
    }
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {exit(); return;}
        if (editing) {
            if (key.escape || key.return) {setEditing(null); return;}
            const setValue = editing === 'root' ? setRoot : setNginxContainer;
            if (key.ctrl && input === 'u') {setValue(''); return;}
            if (key.backspace || key.delete) {setValue(value => value.slice(0, -1)); return;}
            const printable = input.replace(/[\u0000-\u001f\u007f]/gu, '');
            if (printable) setValue(value => `${value}${printable}`.slice(0, 512));
            return;
        }
        if (pending) {
            if (input.toLowerCase() === 'y') launch(pending);
            else if (input.toLowerCase() === 'n' || key.escape) {setPending(null); setMessage(t('manager.deployCancelled')); setMessageColor(COLORS.warning);}
            return;
        }
        if (input === 'q') {exit(); return;}
        if (key.tab || key.rightArrow) {setTab(current => TABS[(TABS.indexOf(current) + 1) % TABS.length]); return;}
        if (key.leftArrow) {setTab(current => TABS[(TABS.indexOf(current) - 1 + TABS.length) % TABS.length]); return;}
        if (input === 'r') {refresh(); return;}
        if (tab === 'deploy') {
            if (key.upArrow) {setSelectedAction(index => (index - 1 + DEPLOY_ACTIONS.length) % DEPLOY_ACTIONS.length); return;}
            if (key.downArrow) {setSelectedAction(index => (index + 1) % DEPLOY_ACTIONS.length); return;}
            if (input === 'e') {setEditing('root'); return;}
            if (input === 'm' && NGINX_ACTIONS.has(DEPLOY_ACTIONS[selectedAction])) {setNginxMode(mode => NGINX_MODES[(NGINX_MODES.indexOf(mode) + 1) % NGINX_MODES.length]); return;}
            if (input === 'c' && NGINX_ACTIONS.has(DEPLOY_ACTIONS[selectedAction]) && nginxMode === 'docker') {setEditing('container'); return;}
            if (key.return) {
                const action = DEPLOY_ACTIONS[selectedAction];
                if (READ_ONLY_ACTIONS.has(action)) launch(action);
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
        index ? h(Text, {key: `${item}-separator`, color: COLORS.muted}, ' | ') : null,
        h(Text, {key: item, bold: item === tab, color: item === tab ? COLORS.accent : COLORS.muted}, item === tab ? `[${t(`manager.tabs.${item}`)}]` : t(`manager.tabs.${item}`))
    ]).filter(Boolean);
    const detailWidth = layout.compact ? layout.width - 8 : layout.width - layout.sidebarWidth - 12;
    let content;
    if (tab === 'deploy') content = h(DeployPage, {layout, selectedIndex: selectedAction, root, nginxMode, nginxContainer, editing, pending});
    else if (tab === 'skill') content = h(TwoPanels, {layout,
        left: h(Panel, {title: t('manager.panels.skill')}, h(Field, {label: t('manager.fields.status'), value: stateText(skill.state)}), h(Text, {dimColor: true}, t('manager.skillGuide'))),
        right: h(Panel, {title: t('manager.panels.targets')}, ...skill.agents.map(agent => h(Box, {key: agent.id, flexDirection: 'column'},
            h(Text, {color: agent.detected ? COLORS.success : COLORS.muted}, `${agent.name}: ${stateText(agent.detected ? agent.state : 'not-detected')}`),
            h(Text, {dimColor: true}, clip(agent.targetPath, detailWidth)))))
    });
    else if (tab === 'mcp') content = h(TwoPanels, {layout,
        left: h(Panel, {title: t('manager.panels.command')}, h(Field, {label: t('manager.fields.status'), value: stateText(mcp.state)}), h(Text, {dimColor: true}, t('manager.mcpGuideAction'))),
        right: h(Panel, {title: t('manager.panels.details')}, h(Text, {}, mcp.targetPath ? t('manager.target', {target: clip(mcp.targetPath, detailWidth)}) : t('manager.reason', {reason: clip(mcp.reason || '-', detailWidth)})), h(Text, {dimColor: true}, t('manager.mcpGuide')))
    });
    else content = h(TwoPanels, {layout,
        left: h(Panel, {title: t('manager.panels.overview')}, h(Text, {}, t('manager.overview')), h(Text, {dimColor: true}, t('manager.overviewHint'))),
        right: h(Panel, {title: t('manager.panels.localStatus')}, h(Field, {label: t('manager.tabs.skill'), value: stateText(skill.state)}), h(Field, {label: t('manager.tabs.mcp'), value: stateText(mcp.state)}), h(Text, {dimColor: true}, t('manager.mcpGuide')))
    });
    const footer = editing ? t('manager.footers.edit') : pending ? t('manager.footers.confirm') : t(`manager.footers.${tab}`);
    return h(Box, {flexDirection: 'column', flexGrow: 1, paddingX: 1, paddingY: 1},
        h(Box, {}, ...tabs, h(Spacer, {}), layout.width > 65 ? h(Text, {dimColor: true}, `v${pluginPackage.version}`) : null),
        h(Box, {marginY: 1}, h(Text, {color: COLORS.muted}, '─'.repeat(layout.width - 4))),
        h(Box, {flexGrow: 1}, content),
        h(Box, {marginTop: 1}, h(Text, {color: pending ? COLORS.warning : messageColor}, clip(message, layout.width - 4))),
        h(Text, {inverse: true}, clip(footer, layout.width - 4)));
}

/** Release the Ink terminal before handing one selected action to the Python installer. */
export async function startSlothVaultManagerTui(options = {}) {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    let request = null;
    const instance = render(h(ManagerApp, {onDeploy: (action, args) => {request = {action, args};}}),
        {alternateScreen: true, exitOnCtrlC: true, patchConsole: false});
    await instance.waitUntilExit();
    if (!request) return;
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.unref?.();
    const result = await (options.runDeployment || runDeployment)(request.args);
    if (result.code !== 0) process.exitCode = result.code;
    process.stdout.write(`${result.code === 0
        ? t('manager.deployCompleted', {action: t(`manager.actions.${request.action}`)})
        : t('manager.deployFailed', {action: t(`manager.actions.${request.action}`), code: result.code})}\n`);
}

export default {startSlothVaultManagerTui};
