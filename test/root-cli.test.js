/**
 * @file RootCliSmokeTest
 * @project SlothTool
 * @module Test / Root CLI
 * @description 验证根命令的帮助输出、默认 TUI 烟雾路径、官方插件简写和 SlothVault 别名迁移路径。
 * @logic 1. 构造临时 HOME 隔离用户数据；2. 通过 Node 子进程执行根入口；3. 校验默认 TUI、插件简写、别名迁移和受验证的 MCP 命令注册行为。
 * @dependencies Node: assert/child_process/fs/os/path/test/url, SlothVault multifunction plugin
 * @index_tags 根CLI测试, TUI烟雾测试, 插件简写, slothvault, 别名迁移, node:test
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {startRootTui} from '../lib/tui/root-tui.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const rootBin = path.join(rootDir, 'bin', 'slothtool.js');
const locBin = path.join(rootDir, 'plugins', 'loc', 'bin', 'loc.js');
const gstoreBin = path.join(rootDir, 'plugins', 'gstore', 'bin', 'gstore.js');
const codexModelsBin = path.join(rootDir, 'plugins', 'codex-models', 'bin', 'codex-models.js');
const slothVaultBin = path.join(rootDir, 'plugins', 'slothvault', 'bin', 'slothvault.js');
const slothVaultMcpBin = path.join(rootDir, 'plugins', 'slothvault', 'bin', 'slothvault-mcp.js');

function createTempHome(
    withLocalLoc = false,
    withLocalGstore = false,
    withLocalCodexModels = false,
    withLocalSlothVaultMcp = false,
    withLocalSlothVault = false
) {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-home-'));
    const slothDir = path.join(homeDir, '.pipker', 'slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));

    const registry = {
        plugins: {}
    };

    if (withLocalLoc) {
        registry.plugins.loc = {
            name: '@holic512/plugin-loc',
            packageName: '@holic512/plugin-loc',
            version: 'workspace',
            binPath: locBin,
            installedAt: '2026-05-30T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalGstore) {
        registry.plugins.gstore = {
            name: '@holic512/plugin-gstore',
            packageName: '@holic512/plugin-gstore',
            version: 'workspace',
            binPath: gstoreBin,
            installedAt: '2026-06-11T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalCodexModels) {
        registry.plugins['codex-models'] = {
            name: '@holic512/plugin-codex-models',
            packageName: '@holic512/plugin-codex-models',
            version: 'workspace',
            binPath: codexModelsBin,
            installedAt: '2026-07-29T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalSlothVaultMcp) {
        registry.plugins['slothvault-mcp'] = {
            name: '@holic512/plugin-slothvault-mcp',
            packageName: '@holic512/plugin-slothvault-mcp',
            version: 'workspace',
            binPath: slothVaultMcpBin,
            installedAt: '2026-09-20T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    if (withLocalSlothVault) {
        registry.plugins.slothvault = {
            name: '@holic512/plugin-slothvault',
            packageName: '@holic512/plugin-slothvault',
            version: 'workspace',
            binPath: slothVaultBin,
            installedAt: '2026-09-21T00:00:00.000Z',
            sourceType: 'github-release'
        };
    }

    fs.writeFileSync(path.join(slothDir, 'registry.json'), JSON.stringify(registry, null, 2));
    return homeDir;
}

function runNode(filePath, args = [], env = {}) {
    return execFileSync(process.execPath, [filePath, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env,
            ...(env.HOME && !env.USERPROFILE ? {USERPROFILE: env.HOME} : {})
        }
    });
}

function addLegacySlothVaultInstall(homeDir) {
    const slothToolDirectory = path.join(homeDir, '.pipker', 'slothtool');
    const pluginDirectory = path.join(slothToolDirectory, 'plugins', 'slothvault-mcp');
    const binPath = path.join(pluginDirectory, 'bin', 'slothvault.js');
    const registryPath = path.join(slothToolDirectory, 'registry.json');
    fs.mkdirSync(path.dirname(binPath), {recursive: true});
    fs.writeFileSync(path.join(pluginDirectory, 'package.json'), JSON.stringify({
        name: '@holic512/plugin-slothvault-mcp',
        version: '1.0.0',
        type: 'module',
        bin: {slothvault: 'bin/slothvault.js'}
    }, null, 2));
    fs.writeFileSync(binPath, 'console.log("LEGACY_SLOTHVAULT_MIGRATED");\n');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    registry.plugins['slothvault-mcp'] = {
        name: '@holic512/plugin-slothvault-mcp',
        packageName: '@holic512/plugin-slothvault-mcp',
        version: '1.0.0',
        binPath,
        installedAt: '2026-09-20T00:00:00.000Z',
        sourceType: 'github-release'
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    return {pluginDirectory, binPath, registryPath};
}

test('root help advertises the TUI-first entry', () => {
    const output = runNode(rootBin, ['--help'], {HOME: createTempHome(false)});
    assert.match(output, /slothtool tui/u);
    assert.match(output, /slothtool\s+loc/u);
    assert.match(output, /slothtool config proxy show/u);
});

test('root default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('root default entry can render with an empty initial TUI snapshot', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'render-exit'
        });
    });
});

test('root TUI startup tolerates a null options object', async () => {
    const previousAction = process.env.SLOTHTOOL_TUI_TEST_ACTION;
    process.env.SLOTHTOOL_TUI_TEST_ACTION = 'exit';

    try {
        const result = await startRootTui(null);
        assert.deepEqual(result, {type: 'exit'});
    } finally {
        if (previousAction === undefined) {
            delete process.env.SLOTHTOOL_TUI_TEST_ACTION;
        } else {
            process.env.SLOTHTOOL_TUI_TEST_ACTION = previousAction;
        }
    }
});

test('root default entry can restart itself through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'restart-self'
        });
    });
});

test('root self-update style restart does not background-detach the replacement TUI', () => {
    assert.doesNotThrow(() => {
        runNode(rootBin, [], {
            HOME: createTempHome(false),
            SLOTHTOOL_TUI_TEST_ACTION: 'self-update-restart'
        });
    });
});

test('root manager records the run and focuses the recent plugin after returning', () => {
    const homeDir = createTempHome(true, true, true);
    const output = runNode(rootBin, [], {
        HOME: homeDir,
        SLOTHTOOL_TUI_TEST_ACTION: 'run-plugin-return',
        SLOTHTOOL_LOC_TUI_TEST_ACTION: 'exit'
    });
    const persistedRegistry = JSON.parse(fs.readFileSync(
        path.join(homeDir, '.pipker', 'slothtool', 'registry.json'),
        'utf8'
    ));

    assert.match(output, /TUI_TEST_RESTORED_STATE:/u);
    assert.match(output, /"activeTab":"run"/u);
    assert.match(output, /"run":0/u);
    assert.match(persistedRegistry.plugins.loc.lastRunAt, /^\d{4}-\d{2}-\d{2}T/u);
});

test('root shorthand runs the local loc workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['loc', '.'], {HOME: createTempHome(true)});
    assert.match(output, /总文件数/u);
    assert.match(output, /总行数/u);
});

test('root shorthand runs the local gstore workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['gstore', '--help'], {HOME: createTempHome(false, true)});
    assert.match(output, /gstore repo set/u);
    assert.match(output, /gstore sync/u);
});

test('root shorthand runs the local codex-models workspace plugin in CLI mode', () => {
    const output = runNode(rootBin, ['codex-models', '--help'], {HOME: createTempHome(false, false, true)});
    assert.match(output, /codex-models doctor/u);
    assert.match(output, /reasoning set <effort>/u);
});

test('root shorthand runs the canonical SlothVault multifunction workspace entry', () => {
    const output = runNode(rootBin, ['slothvault', '--help'], {
        HOME: createTempHome(false, false, false, false, true)
    });
    assert.match(output, /SlothVault multifunction plugin/u);
    assert.match(output, /slothvault deploy/u);
});

test('deprecated root shorthand routes MCP calls to the secondary executable', () => {
    const output = runNode(rootBin, ['slothvault-mcp', '--help'], {
        HOME: createTempHome(false, false, false, true)
    });
    assert.match(output, /slothvault-mcp doctor/u);
    assert.match(output, /slothvault-mcp tools list/u);
    assert.match(output, /slothvault-mcp resources list/u);
});

test('deprecated root Skill shorthand forwards to the multifunction entry', () => {
    const output = runNode(rootBin, ['slothvault-mcp', 'skill', 'status', '--json'], {
        HOME: createTempHome(false, false, false, true)
    });
    assert.equal(JSON.parse(output).name, 'slothvault-mcp');
});

test('canonical SlothVault launch upgrades a registry-only legacy entry to the main executable', () => {
    const homeDir = createTempHome(false, false, false, true);
    const output = runNode(rootBin, ['slothvault', '--help'], {HOME: homeDir});
    const registryPath = path.join(homeDir, '.pipker', 'slothtool', 'registry.json');
    const persistedRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    assert.match(output, /SlothVault multifunction plugin/u);
    assert.equal(persistedRegistry.plugins['slothvault-mcp'], undefined);
    assert.equal(persistedRegistry.plugins.slothvault.packageName, '@holic512/plugin-slothvault');
    assert.equal(persistedRegistry.plugins.slothvault.binPath, slothVaultBin);
});

test('canonical SlothVault launch atomically migrates the legacy installed directory and registry entry', () => {
    const homeDir = createTempHome();
    const legacy = addLegacySlothVaultInstall(homeDir);
    const output = runNode(rootBin, ['slothvault'], {HOME: homeDir});
    const canonicalDirectory = path.join(homeDir, '.pipker', 'slothtool', 'plugins', 'slothvault');
    const persistedRegistry = JSON.parse(fs.readFileSync(legacy.registryPath, 'utf8'));

    assert.match(output, /LEGACY_SLOTHVAULT_MIGRATED/u);
    assert.equal(fs.existsSync(legacy.pluginDirectory), false);
    assert.equal(fs.existsSync(canonicalDirectory), true);
    assert.equal(persistedRegistry.plugins['slothvault-mcp'], undefined);
    assert.equal(persistedRegistry.plugins.slothvault.binPath, path.join(canonicalDirectory, 'bin', 'slothvault.js'));
    assert.equal(persistedRegistry.plugins.slothvault.packageName, '@holic512/plugin-slothvault');
});

test('canonical SlothVault commands stop on an existing legacy/canonical migration conflict without changing either install', () => {
    const homeDir = createTempHome();
    const legacy = addLegacySlothVaultInstall(homeDir);
    const canonicalDirectory = path.join(homeDir, '.pipker', 'slothtool', 'plugins', 'slothvault');
    fs.mkdirSync(canonicalDirectory, {recursive: true});
    fs.writeFileSync(path.join(canonicalDirectory, 'keep.txt'), 'canonical install');

    assert.throws(() => runNode(rootBin, ['slothvault', '--help'], {HOME: homeDir}), error => {
        assert.match(String(error.stderr || ''), /旧版 SlothVault 数据与新位置同时存在/u);
        return true;
    });
    const persistedRegistry = JSON.parse(fs.readFileSync(legacy.registryPath, 'utf8'));
    assert.equal(fs.existsSync(legacy.pluginDirectory), true);
    assert.equal(fs.readFileSync(path.join(canonicalDirectory, 'keep.txt'), 'utf8'), 'canonical install');
    assert.ok(persistedRegistry.plugins['slothvault-mcp']);
    assert.equal(persistedRegistry.plugins.slothvault, undefined);
});

test('source-root dispatch refuses MCP command registration without a verified SlothTool bin directory', () => {
    assert.throws(() => runNode(rootBin, ['slothvault', 'mcp', 'register', '--json'], {
        HOME: createTempHome(false, false, false, false, true)
    }), error => {
        const output = String(error.stdout || '');
        const response = JSON.parse(output);
        assert.equal(response.ok, false);
        assert.equal(response.error.code, 'MCP_COMMAND_SLOTHTOOL_PATH_UNAVAILABLE');
        return true;
    });
});

test('a PATH-resolved SlothTool command registers the standalone MCP executable beside itself', () => {
    const commandBin = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-command-bin-'));
    const commandPath = path.join(commandBin, 'slothtool');
    const homeDir = createTempHome(false, false, false, false, true);
    fs.symlinkSync(rootBin, commandPath);

    const output = runNode(commandPath, ['slothvault', 'mcp', 'register', '--json'], {
        HOME: homeDir,
        PATH: `${commandBin}${path.delimiter}${process.env.PATH}`
    });
    const response = JSON.parse(output);
    const registeredPath = path.join(commandBin, 'slothvault-mcp');

    assert.equal(response.state, 'registered');
    assert.equal(response.targetPath, registeredPath);
    assert.equal(fs.lstatSync(registeredPath).isSymbolicLink(), true);
    assert.equal(
        path.resolve(path.dirname(registeredPath), fs.readlinkSync(registeredPath)),
        slothVaultMcpBin
    );
});
