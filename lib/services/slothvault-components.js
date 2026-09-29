/**
 * @file slothvault-components.js
 * @project SlothTool
 * @module SlothVault component lifecycle
 * @description Independently installs and updates the Vault-owned MCP Client, Skill, and deployment packages.
 * @logic Validate immutable manifests and file hashes, stage all required payloads, then switch component pointers with rollback.
 * @dependencies GitHub Release helpers, Python venv/pip, registry, SlothVault plugin Skill manager
 * @index_tags slothvault,components,release,install,update,rollback
 * @author holic512
 */

import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import settings from '../settings.js';
import {getPluginDir, getSlothToolHome} from '../utils.js';
import {buildProxyEnv} from './network-helper.js';
import {downloadFile, extractTarballSafely, fetchLatestOfficialRelease, githubRequestJson, runCommand} from './plugin-service.js';

export const VAULT_COMPONENTS = Object.freeze(['mcp-client', 'skill', 'deployment']);
const BRIDGE_MAJOR = Object.freeze({'mcp-client': 2, skill: 1, deployment: 1});
const REPOSITORY = 'holic512/SlothVault';

function assertComponent(module) {
    if (!VAULT_COMPONENTS.includes(module)) throw new Error(`Unknown SlothVault component: ${module}`);
}

function metadata(module) {
    assertComponent(module);
    return {alias: module, repository: REPOSITORY, releaseTagPrefix: `${module}-v`,
        assetNamePrefix: `slothvault-${module}-`};
}

export function componentPaths(module, options = {}) {
    assertComponent(module);
    const root = path.join(options.slothToolHome || getSlothToolHome(), 'runtimes', 'slothvault', 'components', module);
    return {root, releases: path.join(root, 'releases'), current: path.join(root, 'current')};
}

function json(pathname) {
    return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

export function installedComponent(module, options = {}) {
    const paths = componentPaths(module, options);
    try {
        const installed = json(path.join(paths.current, 'module.json'));
        return installed.module === module ? {module, version: installed.version, bridgeApiMajor: installed.bridgeApiMajor,
            path: paths.current} : null;
    } catch { return null; }
}

function validateManifest(module, release, manifest) {
    if (manifest?.schema !== 1 || manifest.module !== module || !/^\d+\.\d+\.\d+$/u.test(release.version) ||
        manifest.version !== release.version || manifest.asset !== `slothvault-${module}-${release.version}.tgz` ||
        manifest.asset !== release.asset.name || manifest.bridgeApiMajor !== BRIDGE_MAJOR[module] ||
        manifest.protocolMajor !== BRIDGE_MAJOR[module] ||
        !/^[a-f0-9]{64}$/u.test(manifest.sha256 || '') ||
        !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) || !Object.keys(manifest.files).length) {
        throw new Error(`Invalid or incompatible ${module} release manifest.`);
    }
    if (module !== 'skill' && manifest.minPython !== '3.10') throw new Error(`Invalid ${module} Python requirement.`);
    return manifest;
}

export async function fetchComponentRelease(module, options = {}) {
    const info = await (options.releaseFetcher || fetchLatestOfficialRelease)(metadata(module));
    const assetName = `slothvault-${module}-manifest.json`;
    const asset = info.release?.assets?.find(item => item.name === assetName);
    if (!asset) throw new Error(`${module} manifest asset is missing.`);
    const manifest = await (options.manifestFetcher || githubRequestJson)(asset.browser_download_url);
    return {...info, manifest: validateManifest(module, info, manifest)};
}

export async function checkComponentUpdate(module, options = {}) {
    const installed = installedComponent(module, options);
    try {
        const release = await fetchComponentRelease(module, options);
        return {module, currentVersion: installed?.version || null, latestVersion: release.version,
            status: installed?.version === release.version ? 'latest' : 'outdated',
            bridgeApiMajor: release.manifest.bridgeApiMajor};
    } catch (error) {
        return {module, currentVersion: installed?.version || null, latestVersion: null,
            status: 'error', reason: error.message};
    }
}

export async function checkAllComponentUpdates(options = {}) {
    const components = await Promise.all(VAULT_COMPONENTS.map(module => checkComponentUpdate(module, options)));
    return {components, status: components.some(item => item.status === 'error') ? 'error'
        : components.some(item => item.status === 'outdated') ? 'outdated' : 'latest'};
}

function verifyFiles(root, module, manifest) {
    const installed = json(path.join(root, 'module.json'));
    if (installed.schema !== 1 || installed.module !== module ||
        installed.version !== manifest.version || installed.bridgeApiMajor !== BRIDGE_MAJOR[module]) {
        throw new Error(`${module} payload metadata does not match its release.`);
    }
    for (const [relative, expected] of Object.entries(manifest.files)) {
        if (!/^[a-f0-9]{64}$/u.test(expected) || path.isAbsolute(relative) || relative.includes('\\') ||
            relative.startsWith('/') || relative.split('/').some(part => !part || part === '.' || part === '..') ||
            relative.includes(':')) {
            throw new Error(`${module} manifest contains an unsafe file path.`);
        }
        const file = path.join(root, relative);
        if (!fs.statSync(file).isFile()) throw new Error(`${module} payload file is missing: ${relative}`);
        const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        if (digest !== expected) throw new Error(`${module} payload file failed validation: ${relative}`);
    }
    const actual = [];
    function visit(directory) {
        for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
            if (entry.name === '.venv') continue;
            const file = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) throw new Error(`${module} payload contains a symbolic link.`);
            if (entry.isDirectory()) visit(file);
            else if (entry.isFile()) actual.push(path.relative(root, file).split(path.sep).join('/'));
            else throw new Error(`${module} payload contains a special file.`);
        }
    }
    visit(root);
    if (actual.length !== Object.keys(manifest.files).length || actual.some(file => !manifest.files[file])) {
        throw new Error(`${module} payload contains unlisted files.`);
    }
    const required = module === 'mcp-client' ? ['slothvault_mcp.py', 'requirements.lock']
        : module === 'skill' ? ['slothvault-mcp/SKILL.md'] : ['install.py'];
    for (const file of required) if (!manifest.files[file]) throw new Error(`${module} release is missing ${file}.`);
}

function pythonExecutable(venv) {
    return process.platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
}

export async function installPythonDependencies(root, options = {}) {
    const command = options.commandRunner || runCommand;
    const systemPython = options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3';
    const version = await command(systemPython, ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")']);
    const [major, minor] = version.trim().split('.').map(Number);
    if (major < 3 || (major === 3 && minor < 10)) throw new Error('SlothVault requires Python 3.10 or newer.');
    const venv = path.join(root, '.venv');
    await command(systemPython, ['-m', 'venv', venv]);
    const python = pythonExecutable(venv);
    const network = options.networkSettings || settings.getNetworkSettings();
    const primary = 'https://pypi.org/simple';
    const fallback = process.env.SLOTHTOOL_PYPI_MIRROR || network.pypi?.fallbackUrl || 'https://pypi.tuna.tsinghua.edu.cn/simple';
    const env = {...buildProxyEnv({network}), PIP_CONFIG_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null'};
    const install = index => command(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
        '--require-hashes', '--timeout', '12', '--retries', '1', '--index-url', index,
        '-r', path.join(root, 'requirements.lock')], {env, maxBuffer: 2 * 1024 * 1024});
    try {
        await install(primary);
    } catch (error) {
        if (!/(?:timed? out|name.?resolution|temporary failure|connection|dns|enotfound|network is unreachable)/iu.test(error.message || '')) throw error;
        await install(fallback);
    }
    await command(python, [path.join(root, 'slothvault_mcp.py'), '--version', '--json'], {
        env: {PYTHONDONTWRITEBYTECODE: '1'}
    });
}

async function stageComponent(module, release, options = {}) {
    const paths = componentPaths(module, options);
    fs.mkdirSync(paths.root, {recursive: true});
    const temporary = fs.mkdtempSync(path.join(paths.root, '.stage-'));
    try {
        const archive = path.join(temporary, release.asset.name);
        await (options.download || downloadFile)(release.asset.browser_download_url, archive);
        if (createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== release.manifest.sha256) {
            throw new Error(`${module} archive checksum mismatch.`);
        }
        const extract = path.join(temporary, 'extract');
        fs.mkdirSync(extract);
        await (options.extract || extractTarballSafely)(archive, extract);
        const packageRoot = path.join(extract, 'package');
        if (!fs.statSync(packageRoot).isDirectory()) throw new Error(`${module} package root is missing.`);
        verifyFiles(packageRoot, module, release.manifest);
        const prepared = path.join(temporary, 'prepared');
        fs.cpSync(packageRoot, prepared, {recursive: true});
        if (module === 'mcp-client') await (options.dependencyInstaller || installPythonDependencies)(prepared, options);
        verifyFiles(prepared, module, release.manifest);
        return {module, release, paths, temporary, prepared};
    } catch (error) {
        fs.rmSync(temporary, {recursive: true, force: true});
        throw error;
    }
}

function switchPointer(paths, target) {
    fs.mkdirSync(paths.root, {recursive: true});
    const previous = fs.existsSync(paths.current) ? fs.readlinkSync(paths.current) : null;
    const temporary = path.join(paths.root, `.current-${process.pid}-${Date.now()}`);
    const backup = path.join(paths.root, `.previous-${process.pid}-${Date.now()}`);
    fs.symlinkSync(target, temporary, process.platform === 'win32' ? 'junction' : 'dir');
    try {
        if (previous) fs.renameSync(paths.current, backup);
        fs.renameSync(temporary, paths.current);
    } catch (error) {
        fs.rmSync(temporary, {force: true});
        if (previous && fs.existsSync(backup) && !fs.existsSync(paths.current)) fs.renameSync(backup, paths.current);
        throw error;
    }
    // Backup cleanup is not part of committing the pointer. If it fails, the
    // verified current version must still be reported as installed.
    if (previous) {
        try { fs.rmSync(backup, {force: true}); }
        catch { /* A stale backup link is safe and can be removed later. */ }
    }
    return previous;
}

function restorePointer(paths, previous) {
    if (fs.existsSync(paths.current)) fs.unlinkSync(paths.current);
    if (previous) fs.symlinkSync(previous, paths.current, process.platform === 'win32' ? 'junction' : 'dir');
}

async function syncSkill(options = {}) {
    if (options.skipSkillSync) return {agents: []};
    const entry = path.join(options.pluginDir || getPluginDir('slothvault'), 'lib', 'skill-manager.js');
    const skill = await import(pathToFileURL(entry).href);
    try { return skill.installSkill({skipConflicts: true, slothToolHome: options.slothToolHome}); }
    catch (error) {
        if (error.code === 'SKILL_AGENT_NOT_DETECTED') return {state: 'not-detected', agents: []};
        throw error;
    }
}

export async function installComponents(modules = VAULT_COMPONENTS, options = {}) {
    const selected = [...new Set(modules)];
    selected.forEach(assertComponent);
    const prepared = [];
    const switched = [];
    try {
        for (const module of selected) {
            const release = await fetchComponentRelease(module, options);
            if (installedComponent(module, options)?.version === release.version) continue;
            prepared.push(await stageComponent(module, release, options));
        }
        for (const item of prepared) {
            fs.mkdirSync(item.paths.releases, {recursive: true});
            const target = path.join(item.paths.releases, item.release.version);
            if (fs.existsSync(target)) {
                verifyFiles(target, item.module, item.release.manifest);
            } else {
                fs.renameSync(item.prepared, target);
            }
            const previous = switchPointer(item.paths, target);
            switched.push({paths: item.paths, previous});
        }
        let skillSync = null;
        if (selected.includes('skill')) {
            try { skillSync = await syncSkill(options); }
            catch (error) { skillSync = {state: 'error', code: error.code || 'SKILL_SYNC_FAILED'}; }
        }
        return {status: prepared.length ? 'updated' : 'latest',
            components: selected.map(module => ({module, version: installedComponent(module, options)?.version || null})), skillSync};
    } catch (error) {
        for (const item of switched.reverse()) restorePointer(item.paths, item.previous);
        throw error;
    } finally {
        for (const item of prepared) fs.rmSync(item.temporary, {recursive: true, force: true});
    }
}

export function uninstallComponents(options = {}) {
    const home = options.homeDir || os.homedir();
    const env = options.env || process.env;
    const roots = [
        path.join(componentPaths('skill', options).current, 'slothvault-mcp'),
        path.join(options.slothToolHome || getSlothToolHome(), 'runtimes', 'slothvault', 'current', 'skills', 'slothvault-mcp'),
    ];
    for (const config of [env.CODEX_HOME || path.join(home, '.codex'), env.CLAUDE_CONFIG_DIR || path.join(home, '.claude')]) {
        const target = path.join(config, 'skills', 'slothvault-mcp');
        try {
            if (!fs.lstatSync(target).isSymbolicLink()) continue;
            const linked = path.resolve(path.dirname(target), fs.readlinkSync(target));
            if (roots.some(root => path.resolve(root) === linked)) fs.unlinkSync(target);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const root = path.join(options.slothToolHome || getSlothToolHome(), 'runtimes', 'slothvault', 'components');
    fs.rmSync(root, {recursive: true, force: true});
    return {status: 'uninstalled'};
}
