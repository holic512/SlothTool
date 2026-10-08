/**
 * @file SlothVaultDeployRunner
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / Deployment Runner
 * @description Bridges the SlothTool UI to Vault's independently released Python deployment program.
 * @logic Resolve the active deployment component, launch its Python entry, and exchange JSON-line events.
 * @dependencies Node child_process/fs/path/readline, Vault deployment module.json and install.py
 * @index_tags slothvault,deploy,python,docker,runner,security
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {getComponentRoot, getComponentStatus} from './slothvault-paths.js';
import {runCommand} from './release-client.js';

export class SlothVaultDeployError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'SlothVaultDeployError';
        this.code = options.code || 'DEPLOY_ERROR';
        this.exitCode = options.exitCode || 1;
    }
}

export function getDeploymentPaths(options = {}) {
    const root = path.resolve(options.pluginRoot || getComponentRoot('deployment', options));
    return {
        pluginRoot: root,
        entryPath: path.resolve(options.entryPath || path.join(root, 'install.py')),
        packagePath: path.resolve(options.packagePath || path.join(root, 'module.json'))
    };
}

export async function getDeploymentAvailability(options = {}) {
    const component = getComponentStatus('deployment', options);
    if (component.state !== 'installed') return {available: false, reason: component.state, component};
    try {
        const value = await (options.commandRunner || runCommand)(options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3',
            ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")']);
        const [major, minor] = value.trim().split('.').map(Number);
        if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 3 || major === 3 && minor < 10) return {available: false, reason: 'Python 3.10+', component};
        return {available: true, component};
    } catch {return {available: false, reason: 'Python 3.10+', component};}
}

function readPluginVersion(paths) {
    try {
        return String(JSON.parse(fs.readFileSync(paths.packagePath, 'utf8')).version || 'source');
    } catch {
        return 'source';
    }
}

/** Run the bundled deployment program without changing its argument or terminal contract. */
export async function runDeployment(deploymentArguments = [], options = {}) {
    const paths = getDeploymentPaths(options);
    const python = options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3';
    if (!fs.existsSync(paths.entryPath)) {
        return Promise.reject(new SlothVaultDeployError(`Bundled SlothVault deployment entrypoint is missing: ${paths.entryPath}`, {
            code: 'DEPLOY_ENTRY_MISSING'
        }));
    }
    const availability = await getDeploymentAvailability({...options, runtimeRoot: paths.pluginRoot});
    if (!availability.available) throw new SlothVaultDeployError(`Deployment package unavailable: ${availability.reason}`, {code: 'DEPLOY_PACKAGE_UNAVAILABLE'});

    return new Promise((resolve, reject) => {
        const child = spawn(python, [paths.entryPath, ...deploymentArguments], {
            cwd: options.cwd || process.cwd(),
            stdio: options.stdio || 'inherit',
            env: {
                ...process.env,
                ...(options.env || {}),
                SLOTHTOOL_SLOTHVAULT_PLUGIN_VERSION: readPluginVersion(paths)
            }
        });
        child.on('error', error => {
            if (error?.code === 'ENOENT') {
                reject(new SlothVaultDeployError('python3 is required for SlothVault deployment. Install Python 3.10 or newer and retry.', {
                    code: 'DEPLOY_PYTHON_UNAVAILABLE',
                    cause: error
                }));
                return;
            }
            reject(new SlothVaultDeployError(`Unable to start SlothVault deployment: ${error.message}`, {
                code: 'DEPLOY_START_FAILED',
                cause: error
            }));
        });
        child.on('exit', (code, signal) => resolve({code: code ?? 1, signal: signal || null}));
    });
}

/** Open the private JSON-line channel used by the TUI; CLI stdio remains unchanged. */
export function createDeploymentSession(deploymentArguments = [], options = {}) {
    const paths = getDeploymentPaths(options);
    if (!fs.existsSync(paths.entryPath)) throw new SlothVaultDeployError(`Bundled SlothVault deployment entrypoint is missing: ${paths.entryPath}`, {code: 'DEPLOY_ENTRY_MISSING'});
    if (getComponentStatus('deployment', {...options, runtimeRoot: paths.pluginRoot}).state !== 'installed') throw new SlothVaultDeployError('The deployment package is damaged. Reinstall its package first.', {code: 'DEPLOY_PACKAGE_UNAVAILABLE'});
    const python = options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3';
    const child = spawn(python, [paths.entryPath, '--bridge', ...deploymentArguments], {
        cwd: options.cwd || process.cwd(), stdio: ['pipe', 'pipe', 'pipe'],
        env: {...process.env, ...(options.env || {}), SLOTHTOOL_SLOTHVAULT_PLUGIN_VERSION: readPluginVersion(paths)}
    });
    let settled = false;
    let protocolError = null;
    const result = new Promise((resolve, reject) => {
        child.on('error', error => {
            if (settled) return;
            settled = true;
            reject(new SlothVaultDeployError(error.code === 'ENOENT'
                ? 'python3 is required for SlothVault deployment. Install Python 3.10 or newer and retry.'
                : `Unable to start SlothVault deployment: ${error.message}`,
            {code: error.code === 'ENOENT' ? 'DEPLOY_PYTHON_UNAVAILABLE' : 'DEPLOY_START_FAILED', cause: error}));
        });
        child.on('close', (code, signal) => {
            if (settled) return;
            settled = true;
            if (protocolError) reject(protocolError);
            else resolve({code: code ?? 1, signal: signal || null});
        });
    });
    const lines = readline.createInterface({input: child.stdout});
    lines.on('line', line => {
        if (line.length > 1_000_000) {
            protocolError = new SlothVaultDeployError('Deployment response exceeded the supported size.', {code: 'DEPLOY_PROTOCOL_ERROR'});
            child.kill();
            return;
        }
        try {
            const event = JSON.parse(line);
            if (event && typeof event.type === 'string') options.onEvent?.(event);
            else throw new Error('Missing event type');
        } catch {
            protocolError = new SlothVaultDeployError('Invalid deployment response from Python.', {code: 'DEPLOY_PROTOCOL_ERROR'});
            child.kill();
        }
    });
    // Python reports safe errors on the JSON channel. Its raw stderr is never rendered.
    child.stderr.resume();
    return {
        result,
        respond(value) {if (!child.stdin.destroyed) child.stdin.write(`${JSON.stringify({type: 'answer', value: String(value)})}\n`);},
        cancel() {if (!child.stdin.destroyed) child.stdin.write('{"type":"cancel"}\n');},
        stop() {child.kill();}
    };
}

export async function inspectDeployment(root = '/data/slothvault', options = {}) {
    let snapshot = null;
    const session = createDeploymentSession(['--action', 'status', '--root', root], {
        ...options, onEvent(event) {if (event.type === 'snapshot') snapshot = event.data; options.onEvent?.(event);}
    });
    const outcome = await session.result;
    if (outcome.code !== 0 || !snapshot) throw new SlothVaultDeployError('Unable to inspect the selected deployment.', {code: 'DEPLOY_INSPECT_FAILED'});
    return snapshot;
}

export default {getDeploymentPaths, runDeployment, createDeploymentSession, inspectDeployment, SlothVaultDeployError};
