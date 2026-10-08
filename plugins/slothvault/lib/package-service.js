/**
 * @file package-service.js
 * @project SlothTool
 * @module SlothVault package operations
 * @description Exposes explicit single-component operations to CLI and TUI callers.
 * @logic Map each package action to local status, its Release check or its independently validated installer.
 * @dependencies Component service and paths
 * @index_tags slothvault,packages,cli,tui,independent
 * @author holic512
 */
import {getComponentStatus} from './slothvault-paths.js';
import {checkComponentUpdate, installComponent} from './component-service.js';
export async function operatePackage(module, action, options = {}) {
    if (action === 'status') return getComponentStatus(module, options);
    if (action === 'check') return checkComponentUpdate(module, options);
    if (action === 'install' || action === 'update') return installComponent(module, options);
    throw new Error(`Unknown package action: ${action}`);
}
export const checkMcpClientUpdate = options => operatePackage('mcp-client', 'check', options);
export const updateMcpClient = options => operatePackage('mcp-client', 'update', options);
export const checkDeploymentPackageUpdate = options => operatePackage('deployment', 'check', options);
export const updateDeploymentPackage = options => operatePackage('deployment', 'update', options);
