/**
 * @file component-service.js
 * @project SlothTool
 * @module SlothVault component lifecycle
 * @description Manages one Vault-owned component at a time without depending on the root manager or MCP state.
 * @logic Resolve a component Release, stream and validate its payload, activate with rollback, and synchronize only its own local links.
 * @dependencies Standalone Release transport, component paths, Python venv/pip, local Skill links
 * @index_tags slothvault,components,release,install,update,rollback
 * @author holic512
 */

import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {buildProxyEnv} from './network-helper.js';
import {downloadFile, extractTarballSafely, fetchLatestOfficialRelease, githubRequestJson, runCommand, readNetworkSettings} from './release-client.js';
import {VAULT_COMPONENTS, BRIDGE_MAJOR, componentPaths, installedComponent, getComponentStatus, slothToolHome} from './slothvault-paths.js';
import {installSkill as linkSkill} from './skill-manager.js';
import {skillLinkReferences, assertComponentStorage} from './slothvault-storage.js';
export {VAULT_COMPONENTS, componentPaths, installedComponent, getComponentStatus};

const REPOSITORY = 'holic512/SlothVault';

function assertComponent(module) {
    if (!VAULT_COMPONENTS.includes(module)) throw new Error(`Unknown SlothVault component: ${module}`);
}

function metadata(module) {
    assertComponent(module);
    return {alias: module, repository: REPOSITORY, releaseTagPrefix: `${module}-v`,
        assetNamePrefix: `slothvault-${module}-`};
}

function json(pathname) {return JSON.parse(fs.readFileSync(pathname, 'utf8'));}

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
    const info = await (options.releaseFetcher || fetchLatestOfficialRelease)(metadata(module), options);
    const assetName = `slothvault-${module}-manifest.json`;
    const asset = info.release?.assets?.find(item => item.name === assetName);
    if (!asset) throw new Error(`${module} manifest asset is missing.`);
    const manifest = await (options.manifestFetcher || githubRequestJson)(asset.browser_download_url, options);
    return {...info, manifest: validateManifest(module, info, manifest)};
}

export async function checkComponentUpdate(module, options = {}) {
    const installed = installedComponent(module, options);
    try {
        const release = await fetchComponentRelease(module, options);
        return {module, currentVersion: installed?.version || null, latestVersion: release.version,
            status: installed?.version === release.version && getComponentStatus(module, options).state === 'installed' ? 'latest' : 'outdated',
            checkedAt: new Date().toISOString(), releaseNotes: release.release?.body || '', releaseUrl: release.release?.html_url || '',
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
            if (directory === root && entry.name === '.venv') continue;
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

async function validateMcpEnvironment(root, options) {
    await (options.commandRunner || runCommand)(pythonExecutable(path.join(root, '.venv')),
        [path.join(root, 'slothvault_mcp.py'), '--version', '--json'], {env: {PYTHONDONTWRITEBYTECODE: '1'}, signal: options.signal});
}

export async function installPythonDependencies(root, options = {}) {
    const command = options.commandRunner || runCommand;
    const systemPython = options.pythonCommand || process.env.SLOTHTOOL_SLOTHVAULT_PYTHON || 'python3';
    const version = await command(systemPython, ['-c', 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'], {signal: options.signal});
    const [major, minor] = version.trim().split('.').map(Number);
    if (!Number.isFinite(major) || !Number.isFinite(minor) || major < 3 || (major === 3 && minor < 10)) throw new Error('SlothVault requires Python 3.10 or newer.');
    const venv = path.join(root, '.venv');
    emit(options, 'environment');
    await command(systemPython, ['-m', 'venv', venv], {signal: options.signal});
    const python = pythonExecutable(venv);
    const network = options.networkSettings || readNetworkSettings(options).network || {};
    const primary = 'https://pypi.org/simple';
    const fallback = process.env.SLOTHTOOL_PYPI_MIRROR || network.pypi?.fallbackUrl || 'https://pypi.tuna.tsinghua.edu.cn/simple';
    const env = {...buildProxyEnv({network}), PIP_CONFIG_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null'};
    const install = index => command(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input',
        '--require-hashes', '--timeout', '12', '--retries', '1', '--index-url', index,
        '-r', path.join(root, 'requirements.lock')], {env, signal: options.signal, maxBuffer: 2 * 1024 * 1024});
    try {
        emit(options, 'dependencies');
        await install(primary);
    } catch (error) {
        if (!/(?:timed? out|name.?resolution|temporary failure|connection|dns|enotfound|network is unreachable)/iu.test(error.message || '')) throw error;
        await install(fallback);
    }
    emit(options, 'runtime-validation');
    await command(python, [path.join(root, 'slothvault_mcp.py'), '--version', '--json'], {
        env: {PYTHONDONTWRITEBYTECODE: '1'}, signal: options.signal
    });
}

async function stageComponent(module, release, options = {}) {
    const paths = componentPaths(module, options);
    fs.mkdirSync(paths.root, {recursive: true});
    const temporary = fs.mkdtempSync(path.join(paths.root, '.stage-'));
    try {
        const archive = path.join(temporary, release.asset.name);
        emit(options, 'download', {subject: release.asset.name});
        await (options.download || downloadFile)(release.asset.browser_download_url, archive, {...options, onProgress: data => emit(options, 'download', data)});
        emit(options, 'validation');
        if (createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== release.manifest.sha256) {
            throw new Error(`${module} archive checksum mismatch.`);
        }
        const extract = path.join(temporary, 'extract');
        fs.mkdirSync(extract);
        emit(options, 'extract');
        await (options.extract || extractTarballSafely)(archive, extract);
        const packageRoot = path.join(extract, 'package');
        if (!fs.statSync(packageRoot).isDirectory()) throw new Error(`${module} package root is missing.`);
        if (fs.existsSync(path.join(packageRoot, '.venv'))) throw new Error('Release archives must not contain a Python environment.');
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
    let exists = false;
    try {fs.lstatSync(paths.current); exists = true;} catch (error) {if (error.code !== 'ENOENT') throw error;}
    const temporary = path.join(paths.root, `.current-${process.pid}-${Date.now()}`);
    const backup = path.join(paths.root, `.previous-${randomUUID()}`);
    fs.symlinkSync(target, temporary, process.platform === 'win32' ? 'junction' : 'dir');
    try {
        if (exists) fs.renameSync(paths.current, backup);
        fs.renameSync(temporary, paths.current);
    } catch (error) {
        fs.rmSync(temporary, {force: true});
        if (exists && !fs.existsSync(paths.current)) fs.renameSync(backup, paths.current);
        throw error;
    }
    return exists ? backup : null;
}

function restorePointer(paths, previous) {
    fs.rmSync(paths.current, {recursive: true, force: true});
    if (previous) fs.renameSync(previous, paths.current);
}

function emit(options, phase, data = {}) {try {options.onEvent?.({type: 'progress', phase, ...data});} catch { /* Presentation cannot change the transaction. */ }}

function syncSkill(options = {}) {
    if (options.skipSkillSync) return {agents: []};
    try {return linkSkill({...options, replace: options.replaceSkill === true, skipConflicts: !options.replaceSkill});}
    catch (error) {if (error.code === 'SKILL_AGENT_NOT_DETECTED') return {state: 'not-detected', agents: []}; throw error;}
}

function removeVerifiedSkillReleases(paths, options) {
    if (!fs.existsSync(paths.releases)) return;
    const references = skillLinkReferences(options).flatMap(link => {
        try {return [link.source, fs.realpathSync(link.source)];} catch {return [link.source];}
    });
    for (const item of fs.readdirSync(paths.releases, {withFileTypes: true})) {
        if (!item.isDirectory() || !/^\d+\.\d+\.\d+$/u.test(item.name)) continue;
        const directory = path.join(paths.releases, item.name);
        const realDirectory = fs.realpathSync(directory);
        if (references.some(source => source === directory || source.startsWith(directory + path.sep) || source === realDirectory || source.startsWith(realDirectory + path.sep))) continue;
        try {
            const meta = json(path.join(directory, 'module.json'));
            if (meta.module === 'skill' && meta.version === item.name) fs.rmSync(directory, {recursive: true});
        } catch { /* Unknown content is not an owned release. */ }
    }
}

export async function installComponent(module, options = {}) {
    if (!VAULT_COMPONENTS.includes(module)) throw new Error(`Unknown SlothVault component: ${module}`);
    assertComponentStorage(module, options);
    const paths = componentPaths(module, options);
    fs.mkdirSync(paths.root, {recursive: true});
    const lock = path.join(paths.root, '.operation-lock');
    let descriptor;
    try {descriptor = fs.openSync(lock, 'wx');} catch (error) {
        if (error.code === 'EEXIST') throw Object.assign(new Error('A component operation is already running.'), {code: 'COMPONENT_BUSY'});
        throw error;
    }
    let staged, backup, releaseBackup, releaseTarget, activated = false, previous;
    const warnings = [];
    const cleanup = file => {if (file) try {fs.rmSync(file, {recursive: true, force: true});} catch (error) {warnings.push({path: file, code: error.code || 'CLEANUP_FAILED'});}};
    try {
        if (fs.existsSync(path.join(slothToolHome(options), '.slothvault-cleanup-lock'))) throw Object.assign(new Error('SlothVault local cleanup is running.'), {code: 'COMPONENT_BUSY'});
        emit(options, 'release');
        const release = await fetchComponentRelease(module, options);
        const releaseSummary = {latestVersion: release.version, checkedAt: new Date().toISOString(), releaseNotes: release.release?.body || '', releaseUrl: release.release?.html_url || ''};
        const current = installedComponent(module, options);
        if (current?.version === release.version && getComponentStatus(module, options).state === 'installed') {
            try {
                verifyFiles(paths.current, module, release.manifest);
                if (module === 'mcp-client') {
                    emit(options, 'runtime-validation');
                    await (options.runtimeValidator || validateMcpEnvironment)(paths.current, options);
                }
                if (module === 'skill') emit(options, 'links');
                const skillSync = module === 'skill' ? syncSkill(options) : null;
                // Convert the historical Skill pointer to a single active directory too.
                if (module !== 'skill' || !fs.lstatSync(paths.current).isSymbolicLink()) {
                    emit(options, 'done', {status: 'completed'});
                    if (module === 'skill') removeVerifiedSkillReleases(paths, options);
                    return {status: 'latest', ...releaseSummary, components: [{module, version: current.version}], skillSync, warnings};
                }
            } catch (error) {if (error.code?.startsWith('SKILL_')) throw error;}
        }
        staged = await stageComponent(module, release, {...options, module});
        options.signal?.throwIfAborted();
        emit(options, 'activate');
        if (module === 'skill') {
            backup = path.join(paths.root, `.previous-${randomUUID()}`);
            try {fs.lstatSync(paths.current); fs.renameSync(paths.current, backup);} catch (error) {if (error.code !== 'ENOENT') throw error; backup = null;}
            fs.renameSync(staged.prepared, paths.current);
            activated = true;
        } else {
            fs.mkdirSync(paths.releases, {recursive: true});
            const target = path.join(paths.releases, release.version);
            if (fs.existsSync(target)) {
                try {
                    verifyFiles(target, module, release.manifest);
                    // Reaching staging means the installed Client/environment
                    // could not be reused. Activate the freshly prepared venv too.
                    if (module === 'mcp-client') throw new Error('Replace the prepared Client environment.');
                }
                catch {
                    releaseBackup = path.join(paths.root, `.previous-${randomUUID()}`);
                    releaseTarget = target;
                    fs.renameSync(target, releaseBackup);
                    fs.renameSync(staged.prepared, target);
                }
            } else fs.renameSync(staged.prepared, target);
            previous = switchPointer(paths, target);
            activated = true;
        }
        emit(options, 'links');
        const skillSync = module === 'skill' ? syncSkill(options) : null;
        fs.writeFileSync(path.join(paths.root, `.verified-${release.version}.json`), JSON.stringify(release.manifest));
        if (module === 'skill') {
            cleanup(backup);
            backup = null;
            try {removeVerifiedSkillReleases(paths, options);} catch (error) {warnings.push({path: paths.releases, code: error.code || 'CLEANUP_FAILED'});}
        }
        cleanup(previous); previous = null;
        cleanup(releaseBackup); releaseBackup = null;
        emit(options, 'done', {status: 'completed'});
        return {status: 'updated', ...releaseSummary, components: [{module, version: release.version}], skillSync, warnings};
    } catch (error) {
        if (activated) {
            if (module === 'skill') {fs.rmSync(paths.current, {recursive: true, force: true}); if (backup) fs.renameSync(backup, paths.current);}
            else restorePointer(paths, previous);
        } else if (backup) fs.renameSync(backup, paths.current);
        if (releaseBackup) {
            fs.rmSync(releaseTarget, {recursive: true, force: true});
            fs.renameSync(releaseBackup, releaseTarget);
        }
        emit(options, 'failed', {status: 'failed'});
        throw error;
    } finally {
        if (staged) cleanup(staged.temporary);
        fs.closeSync(descriptor);
        try {fs.unlinkSync(lock);} catch (error) {warnings.push({path: lock, code: error.code});}
    }
}

// Explicit compatibility only: callers must name their components.
export async function installComponents(modules = [], options = {}) {
    const results = [];
    for (const module of [...new Set(modules)]) results.push(await installComponent(module, options));
    return {status: results.some(result => result.status === 'updated') ? 'updated' : 'latest', components: results.flatMap(result => result.components), skillSync: results.find(result => result.skillSync)?.skillSync || null};
}
