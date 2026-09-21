/**
 * @file SlothVaultManagerTui
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / TUI
 * @description Provides the SlothTool-facing full-screen overview for deployment, Skill management, and standalone MCP command registration.
 * @logic 1. Read local deployment, Skill and command-registration state without contacting SlothVault; 2. expose explicit local install/uninstall actions; 3. direct deployment execution to the dedicated CLI handoff.
 * @dependencies React/Ink, Skill Manager, MCP Command Manager
 * @index_tags slothvault,tui,deploy,skill,mcp,registration
 * @author holic512
 */

import React, {createElement as h, useState} from 'react';
import {Box, Text, useApp, useInput, render} from 'ink';
import {getSkillStatus, installSkill, uninstallSkill} from './skill-manager.js';
import {getMcpCommandStatus, registerMcpCommand, unregisterMcpCommand} from './mcp-command-manager.js';
import {t} from './i18n.js';

const TABS = ['overview', 'deploy', 'skill', 'mcp'];

function stateText(value) {
    return t(`manager.states.${value || 'unavailable'}`);
}

function ManagerApp() {
    const {exit} = useApp();
    const [tab, setTab] = useState('overview');
    const [skill, setSkill] = useState(() => getSkillStatus());
    const [mcp, setMcp] = useState(() => getMcpCommandStatus());
    const [message, setMessage] = useState(t('manager.ready'));

    function refresh() {
        try {
            setSkill(getSkillStatus());
            setMcp(getMcpCommandStatus());
            setMessage(t('manager.refreshed'));
        } catch (error) {
            setMessage(t('manager.refreshFailed', {message: error.message}));
        }
    }

    function operateSkill(action) {
        try {
            const result = action === 'install' ? installSkill() : uninstallSkill();
            setSkill(result);
            setMessage(t('manager.skillActionCompleted', {action: stateText(result.action || action)}));
        } catch (error) {
            setMessage(t('manager.skillActionFailed', {message: error.message}));
        }
    }

    function operateMcp(action) {
        try {
            const result = action === 'register' ? registerMcpCommand() : unregisterMcpCommand();
            setMcp(result);
            setMessage(t('manager.mcpActionCompleted', {action: stateText(result.action)}));
        } catch (error) {
            setMessage(t('manager.mcpActionFailed', {message: error.message}));
        }
    }

    useInput((input, key) => {
        if (input === 'q' || (key.ctrl && input === 'c')) {
            exit();
            return;
        }
        if (key.tab || key.rightArrow) {
            setTab(current => TABS[(TABS.indexOf(current) + 1) % TABS.length]);
            return;
        }
        if (key.leftArrow) {
            setTab(current => TABS[(TABS.indexOf(current) - 1 + TABS.length) % TABS.length]);
            return;
        }
        if (input === 'r') {
            refresh();
            return;
        }
        if (tab === 'skill' && input === 'i') operateSkill('install');
        if (tab === 'skill' && input === 'u') operateSkill('uninstall');
        if (tab === 'mcp' && input === 'i') operateMcp('register');
        if (tab === 'mcp' && input === 'u') operateMcp('unregister');
    });

    const tabs = TABS.map(item => {
        const label = t(`manager.tabs.${item}`);
        return item === tab ? `[${label}]` : label;
    }).join('  ');
    let body;
    if (tab === 'deploy') {
        body = [
            t('manager.deployGuide'),
            t('manager.deploySafety'),
            t('manager.deployPrivilege')
        ];
    } else if (tab === 'skill') {
        body = [
            t('manager.skillState', {state: stateText(skill.state)}),
            ...skill.agents.map(agent => t('manager.skillAgent', {
                name: agent.name,
                state: stateText(agent.detected ? agent.state : 'not-detected'),
                target: agent.targetPath
            })),
            t('manager.skillGuide')
        ];
    } else if (tab === 'mcp') {
        body = [
            t('manager.mcpState', {state: stateText(mcp.state)}),
            mcp.targetPath ? t('manager.target', {target: mcp.targetPath}) : t('manager.reason', {reason: mcp.reason || '-'}),
            t('manager.mcpGuideAction')
        ];
    } else {
        body = [
            t('manager.overview'),
            t('manager.statusSummary', {skill: stateText(skill.state), mcp: stateText(mcp.state)}),
            t('manager.mcpGuide')
        ];
    }

    return h(Box, {flexDirection: 'column'},
        h(Text, {bold: true, color: 'cyan'}, t('manager.title')),
        h(Text, {}, tabs),
        h(Text, {dimColor: true}, '─'.repeat(72)),
        ...body.map((line, index) => h(Text, {key: index}, line)),
        h(Text, {color: 'green'}, message),
        h(Text, {inverse: true}, t('manager.footer'))
    );
}

export async function startSlothVaultManagerTui() {
    if (process.env.SLOTHTOOL_SLOTHVAULT_TUI_TEST_ACTION === 'exit') return;
    const instance = render(h(ManagerApp), {alternateScreen: true, exitOnCtrlC: true});
    await instance.waitUntilExit();
}

export default {startSlothVaultManagerTui};
