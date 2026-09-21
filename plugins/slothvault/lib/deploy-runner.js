/**
 * @file SlothVaultDeployRunner
 * @project SlothTool
 * @module SlothVault Multifunction Plugin / Deployment Runner
 * @description Starts the bundled standard-library SlothVault deployment program from the Node plugin without shell interpolation.
 * @logic 1. Resolve the packaged Python entrypoint; 2. launch python3 with inherited terminal streams and a plugin-version marker; 3. preserve the deployment process exit status and surface missing-runtime errors clearly.
 * @dependencies Node: child_process/fs/path/url, Plugin: package.json and deploy/install.py
 * @index_tags slothvault,deploy,python,docker,runner,security
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(moduleDirectory, '..');

export class SlothVaultDeployError extends Error {
    constructor(message, options = {}) {
        super(message, options);
        this.name = 'SlothVaultDeployError';
        this.code = options.code || 'DEPLOY_ERROR';
        this.exitCode = options.exitCode || 1;
    }
}

export function getDeploymentPaths(options = {}) {
    const root = path.resolve(options.pluginRoot || pluginRoot);
    return {
        pluginRoot: root,
        entryPath: path.resolve(options.entryPath || path.join(root, 'deploy', 'install.py')),
        packagePath: path.resolve(options.packagePath || path.join(root, 'package.json'))
    };
}

function readPluginVersion(paths) {
    try {
        return String(JSON.parse(fs.readFileSync(paths.packagePath, 'utf8')).version || 'source');
    } catch {
        return 'source';
    }
}

/** Run the bundled deployment program without changing its argument or terminal contract. */
export function runDeployment(deploymentArguments = [], options = {}) {
    const paths = getDeploymentPaths(options);
    const python = options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3';
    if (!fs.existsSync(paths.entryPath)) {
        return Promise.reject(new SlothVaultDeployError(`Bundled SlothVault deployment entrypoint is missing: ${paths.entryPath}`, {
            code: 'DEPLOY_ENTRY_MISSING'
        }));
    }

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
                reject(new SlothVaultDeployError('python3 is required for SlothVault deployment. Install Python 3.8 or newer and retry.', {
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

export default {getDeploymentPaths, runDeployment, SlothVaultDeployError};
