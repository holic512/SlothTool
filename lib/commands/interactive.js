/**
 * @file InteractiveCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 启动默认全屏 Ink TUI，并在退出后处理需要落回 shell 的插件启动动作。
 * @logic 1. 在交互式终端中启动根 TUI；2. 接收 TUI 退出动作；3. 对 run-plugin 动作调用底层运行 service。
 * @dependencies TUI: ../tui/root-tui.js, Service: ../services/plugin-service.js, Utils: ../utils.js, I18N: ../i18n.js
 * @index_tags interactive命令, 默认TUI, Ink入口
 * @author holic512
 */

import {t} from '../i18n.js';
import {spawn} from 'node:child_process';
import {runInstalledPlugin} from '../services/plugin-service.js';
import {isInteractiveTerminal} from '../utils.js';
import {startRootTui} from '../tui/root-tui.js';

function relaunchRootCommand({waitForChildExit = false} = {}) {
    const childEnv = {
        ...process.env
    };

    if (process.env.SLOTHTOOL_TUI_TEST_ACTION === 'restart-self') {
        childEnv.SLOTHTOOL_TUI_TEST_ACTION = 'exit';
    }

    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [process.argv[1]], {
            cwd: process.cwd(),
            env: childEnv,
            stdio: 'inherit'
        });

        child.on('error', reject);

        if (waitForChildExit) {
            child.on('exit', code => {
                resolve({
                    type: 'restart-self',
                    code: code || 0
                });
            });
            return;
        }

        child.on('spawn', () => {
            child.unref();
            resolve({type: 'restart-self'});
        });
    });
}

export default async function interactive() {
    const testMode = Boolean(process.env.SLOTHTOOL_TUI_TEST_ACTION);

    if (!isInteractiveTerminal() && !testMode) {
        throw new Error(t('cli.tuiRequiresTerminal'));
    }

    let nextTuiState = null;
    let nextTuiStatus = null;

    while (true) {
        const exitAction = await startRootTui({
            initialState: nextTuiState,
            initialStatus: nextTuiStatus
        });
        nextTuiStatus = null;

        if (exitAction?.type === 'run-plugin' && exitAction.alias) {
            nextTuiState = exitAction.uiState || null;

            try {
                const result = await runInstalledPlugin(exitAction.alias, exitAction.args || [], {
                    preferTui: true
                });

                nextTuiStatus = result?.code
                    ? {
                        tone: 'warn',
                        message: t('tui.status.pluginReturnedWithCode', {
                            alias: exitAction.alias,
                            code: result.code
                        })
                    }
                    : {
                        tone: 'success',
                        message: t('tui.status.pluginReturned', {
                            alias: exitAction.alias
                        })
                    };
            } catch (error) {
                nextTuiStatus = {
                    tone: 'error',
                    message: error.message
                };
            }

            continue;
        }

        if (exitAction?.type === 'restart-self') {
            return relaunchRootCommand({
                waitForChildExit: process.env.SLOTHTOOL_TUI_TEST_ACTION === 'restart-self'
            });
        }

        return exitAction;
    }
}
