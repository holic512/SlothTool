/**
 * @file PzipPluginTest
 * @project SlothTool
 * @module Test / PZIP Plugin
 * @description 验证 pzip 的默认过滤、嵌套 .gitignore、ZIP 条目、配置、输出安全性与 CLI/TUI 入口。
 * @logic 1. 构造隔离 HOME 和项目树；2. 创建真实 ZIP 并解析中央目录；3. 覆盖配置、冲突命名和命令行行为。
 * @dependencies Node: assert/child_process/fs/os/path/test/url, Plugin: ../plugins/pzip
 * @index_tags pzip测试, ZIP条目, gitignore, 默认过滤, 配置, CLI, TUI
 * @author holic512
 */

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {render} from 'ink';
import {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    resetPluginConfig,
    toggleBuiltInRule
} from '../plugins/pzip/lib/service.js';
import {getRuleWindow, PzipTuiApp} from '../plugins/pzip/lib/tui.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..');
const pzipBin = path.join(repositoryRoot, 'plugins', 'pzip', 'bin', 'pzip.js');

function createTemporaryHome() {
    const homeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-pzip-home-'));
    const slothDirectory = path.join(homeDirectory, '.pipker', 'slothtool');
    fs.mkdirSync(slothDirectory, {recursive: true});
    fs.writeFileSync(path.join(slothDirectory, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDirectory;
}

async function withTemporaryHome(run) {
    const originalHome = process.env.HOME;
    process.env.HOME = createTemporaryHome();
    try {
        return await run(process.env.HOME);
    } finally {
        if (originalHome === undefined) {
            delete process.env.HOME;
        } else {
            process.env.HOME = originalHome;
        }
    }
}

function writeFile(filePath, content = 'content') {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, content, 'utf8');
}

function createProjectFixture() {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-pzip-project-'));
    const projectDirectory = path.join(fixtureRoot, 'demo-app');

    writeFile(path.join(projectDirectory, 'README.md'), '# demo');
    writeFile(path.join(projectDirectory, 'src', 'index.js'), 'export const ok = true;');
    writeFile(path.join(projectDirectory, 'src', '.DS_Store'), 'mac metadata');
    writeFile(path.join(projectDirectory, '__MACOSX', 'metadata'), 'mac archive metadata');
    writeFile(path.join(projectDirectory, 'dist', 'bundle.js'), 'build output');
    writeFile(path.join(projectDirectory, 'server', 'target', 'classes', 'App.class'), 'java output');
    writeFile(path.join(projectDirectory, 'nested', '.git', 'config'), '[core]');
    writeFile(path.join(projectDirectory, 'skip.rootignore'), 'skip root');
    writeFile(path.join(projectDirectory, 'keep.rootignore'), 'keep root');
    writeFile(path.join(projectDirectory, 'nested', '.gitignore'), '*.tmp\n!keep.tmp\n');
    writeFile(path.join(projectDirectory, 'nested', 'drop.tmp'), 'drop nested');
    writeFile(path.join(projectDirectory, 'nested', 'keep.tmp'), 'keep nested');
    writeFile(path.join(projectDirectory, '.gitignore'), '*.rootignore\n!keep.rootignore\nignored-directory/\n');
    writeFile(path.join(projectDirectory, 'ignored-directory', 'hidden.txt'), 'ignored');
    writeFile(path.join(projectDirectory, 'logs', 'app.log'), 'log');
    fs.mkdirSync(path.join(projectDirectory, 'empty-directory'), {recursive: true});

    return {fixtureRoot, projectDirectory};
}

function readUnsigned32(buffer, offset) {
    return buffer.readUInt32LE(offset);
}

function readZipEntryNames(archivePath) {
    const content = fs.readFileSync(archivePath);
    let endOffset = -1;
    for (let index = content.length - 22; index >= Math.max(0, content.length - 65_557); index -= 1) {
        if (readUnsigned32(content, index) === 0x06054b50) {
            endOffset = index;
            break;
        }
    }
    assert.notEqual(endOffset, -1, 'ZIP end-of-central-directory record should exist');

    const count = content.readUInt16LE(endOffset + 10);
    let offset = readUnsigned32(content, endOffset + 16);
    const names = [];
    for (let index = 0; index < count; index += 1) {
        assert.equal(readUnsigned32(content, offset), 0x02014b50, 'ZIP central-directory signature should exist');
        const nameLength = content.readUInt16LE(offset + 28);
        const extraLength = content.readUInt16LE(offset + 30);
        const commentLength = content.readUInt16LE(offset + 32);
        names.push(content.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return names;
}

function runPzip(args = [], environment = {}) {
    return execFileSync(process.execPath, [pzipBin, ...args], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        env: {...process.env, ...environment}
    });
}

function createTuiHarness({sourceDirectory, archive = createZipArchive, columns = 42, rows = 12}) {
    const stdin = new PassThrough();
    stdin.isTTY = true;
    stdin.setRawMode = () => {};
    stdin.ref = () => {};
    stdin.unref = () => {};
    const stdout = new PassThrough();
    stdout.isTTY = true;
    stdout.columns = columns;
    stdout.rows = rows;
    const stderr = new PassThrough();
    const frames = [];
    stdout.on('data', chunk => {
        const value = chunk.toString();
        if (value.includes('╭')) {
            frames.push(value.replace(/\u001b\[[0-9;?]*[a-zA-Z]/gu, ''));
        }
    });
    const ink = render(React.createElement(PzipTuiApp, {
        archive,
        initialSourceDirectory: sourceDirectory
    }), {stdin, stdout, stderr, patchConsole: false, alternateScreen: false});
    return {
        frame: () => frames.at(-1) || '',
        async press(value) {
            stdin.write(value);
            await ink.waitUntilRenderFlush();
        },
        async close() {
            ink.unmount();
            await ink.waitUntilExit();
        }
    };
}

async function waitFor(check) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Timed out waiting for the TUI state');
}

test('pzip archives the source directory, keeps empty directories, and filters default project noise', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        const result = await createZipArchive(projectDirectory);
        const entries = readZipEntryNames(result.archivePath);

        assert.equal(path.basename(result.archivePath), 'demo-app.zip');
        assert.ok(entries.includes('demo-app/README.md'));
        assert.ok(entries.includes('demo-app/src/index.js'));
        assert.ok(entries.includes('demo-app/empty-directory/'));
        assert.ok(entries.includes('demo-app/keep.rootignore'));
        assert.ok(entries.includes('demo-app/nested/keep.tmp'));
        assert.equal(entries.some(entry => entry.includes('.DS_Store')), false);
        assert.equal(entries.some(entry => entry.includes('__MACOSX')), false);
        assert.equal(entries.some(entry => entry.includes('/dist/')), false);
        assert.equal(entries.some(entry => entry.includes('/target/')), false);
        assert.equal(entries.some(entry => entry.includes('/.git/')), false);
        assert.equal(entries.some(entry => entry.endsWith('skip.rootignore')), false);
        assert.equal(entries.some(entry => entry.endsWith('drop.tmp')), false);
        assert.equal(entries.some(entry => entry.includes('ignored-directory')), false);
        assert.equal(result.exclusions.builtIn, 5);
        assert.ok(result.exclusions.gitignore >= 3);
        assert.ok(result.archiveBytes > 0);
    });
});

test('pzip configuration toggles built-in rules and adds persistent plus one-run exclusions', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        toggleBuiltInRule('target', false);
        addCustomRule('*.log');

        const result = await createZipArchive(projectDirectory, {excludePatterns: ['*.md']});
        const entries = readZipEntryNames(result.archivePath);
        assert.ok(entries.includes('demo-app/server/target/classes/App.class'));
        assert.equal(entries.some(entry => entry.endsWith('app.log')), false);
        assert.equal(entries.some(entry => entry.endsWith('README.md')), false);
        assert.equal(getConfigSummary().builtInRules.target, false);
        assert.deepEqual(getConfigSummary().customExcludePatterns, ['*.log']);

        resetPluginConfig();
        assert.equal(getConfigSummary().builtInRules.target, true);
        assert.deepEqual(getConfigSummary().customExcludePatterns, []);
    });
});

test('pzip dry run leaves no archive and existing archive names receive a timestamp suffix', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        const dryRun = await createZipArchive(projectDirectory, {dryRun: true});
        assert.equal(dryRun.dryRun, true);
        assert.equal(dryRun.archiveBytes, null);
        assert.equal(fs.existsSync(dryRun.archivePath), false);

        const first = await createZipArchive(projectDirectory);
        const second = await createZipArchive(projectDirectory);
        assert.equal(path.basename(first.archivePath), 'demo-app.zip');
        assert.match(path.basename(second.archivePath), /^demo-app-\d{8}-\d{6}(?:-\d+)?\.zip$/u);
        assert.equal(fs.existsSync(first.archivePath), true);
        assert.equal(fs.existsSync(second.archivePath), true);
    });
});

test('pzip rejects an output archive inside the source tree and reports symbolic links without following them', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        const linkPath = path.join(projectDirectory, 'linked-readme');
        fs.symlinkSync(path.join(projectDirectory, 'README.md'), linkPath);

        await assert.rejects(
            createZipArchive(projectDirectory, {outputPath: path.join(projectDirectory, 'inside.zip')}),
            /outside the source directory/u
        );

        const result = await createZipArchive(projectDirectory);
        const entries = readZipEntryNames(result.archivePath);
        assert.equal(entries.some(entry => entry.endsWith('linked-readme')), false);
        assert.equal(result.exclusions.symlink, 1);
        assert.match(result.warnings.join('\n'), /linked-readme/u);
    });
});

test('pzip CLI provides help, JSON dry-run output, configuration commands, and a TUI smoke exit', () => {
    const homeDirectory = createTemporaryHome();
    const {projectDirectory} = createProjectFixture();
    const help = runPzip(['--help'], {HOME: homeDirectory});
    assert.match(help, /pzip <sourceDir>/u);
    assert.match(help, /--dry-run/u);

    const jsonOutput = runPzip([projectDirectory, '--dry-run', '--json'], {HOME: homeDirectory});
    const result = JSON.parse(jsonOutput);
    assert.equal(result.dryRun, true);
    assert.equal(result.archiveBytes, null);

    runPzip(['config', 'rule', 'target', 'off'], {HOME: homeDirectory});
    const configOutput = runPzip(['config', 'show'], {HOME: homeDirectory});
    assert.match(configOutput, /"target": false/u);

    assert.doesNotThrow(() => {
        runPzip([], {HOME: homeDirectory, SLOTHTOOL_PZIP_TUI_TEST_ACTION: 'exit'});
    });

    const renderedTui = runPzip([], {HOME: homeDirectory, SLOTHTOOL_PZIP_TUI_TEST_ACTION: 'render-exit'});
    assert.match(renderedTui, /压缩任务/u);
    assert.match(renderedTui, /过滤规则/u);
});

test('pzip TUI locks a pending archive task on the first Enter and freezes its filter snapshot', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const calls = [];
        const archive = async (source, options) => {
            calls.push({source, options});
            await gate;
            return createZipArchive(source, options);
        };
        const tui = createTuiHarness({sourceDirectory: projectDirectory, archive, columns: 42, rows: 12});
        try {
            await tui.press('\r');
            await tui.press('\r');
            await waitFor(() => calls.length === 1);
            await tui.press('\r');
            assert.equal(calls.length, 1);
            assert.equal(calls[0].source, projectDirectory);
            assert.equal(calls[0].options.dryRun, false);
            assert.deepEqual(calls[0].options.config.customExcludePatterns, []);
            assert.match(tui.frame(), /任务执行中，请等待/u);
            assert.match(tui.frame(), /源目录:/u);
            assert.match(tui.frame(), /输出 ZIP:/u);
            assert.doesNotMatch(tui.frame(), /Enter 保存|↵ Tab/u);
            addCustomRule('*.md');
            assert.deepEqual(calls[0].options.config.customExcludePatterns, []);
            release();
            await waitFor(() => fs.existsSync(path.join(path.dirname(projectDirectory), 'demo-app.zip')));
            assert.ok(readZipEntryNames(path.join(path.dirname(projectDirectory), 'demo-app.zip')).includes('demo-app/README.md'));
        } finally {
            release();
            await tui.close();
        }
    });
});

test('pzip TUI preview creates no ZIP and the later run chooses a fresh non-overwriting name', async () => {
    await withTemporaryHome(async () => {
        const {fixtureRoot, projectDirectory} = createProjectFixture();
        const existing = path.join(fixtureRoot, 'demo-app.zip');
        fs.writeFileSync(existing, 'existing archive');
        fs.symlinkSync(path.join(projectDirectory, 'README.md'), path.join(projectDirectory, 'readme-link'));
        const results = [];
        const archive = async (source, options) => {
            const result = await createZipArchive(source, options);
            results.push(result);
            return result;
        };
        const tui = createTuiHarness({sourceDirectory: projectDirectory, archive, columns: 44, rows: 12});
        try {
            await tui.press('p');
            await waitFor(() => results.length === 1);
            await waitFor(() => tui.frame().includes('候选输出位置'));
            assert.equal(results[0].dryRun, true);
            assert.equal(fs.existsSync(results[0].archivePath), false);
            assert.match(tui.frame(), /候选输出位置/u);
            assert.ok(results[0].includedFileCount > 0);
            await tui.press('\u001b');
            await waitFor(() => tui.frame().includes('压缩任务'));
            await tui.press('w');
            await waitFor(() => tui.frame().includes('告警详情'));
            assert.match(tui.frame(), /Skipped symbolic link/u);
            await tui.press('\u001b');
            await waitFor(() => tui.frame().includes('压缩任务'));
            fs.writeFileSync(results[0].archivePath, 'occupied after preview');
            await tui.press('\r');
            await waitFor(() => results.length === 2);
            assert.equal(results[1].dryRun, false);
            assert.notEqual(results[1].archivePath, existing);
            assert.notEqual(results[1].archivePath, results[0].archivePath);
            assert.equal(fs.readFileSync(existing, 'utf8'), 'existing archive');
            assert.equal(fs.readFileSync(results[0].archivePath, 'utf8'), 'occupied after preview');
            assert.ok(readZipEntryNames(results[1].archivePath).includes('demo-app/README.md'));
        } finally {
            await tui.close();
        }
    });
});

test('pzip TUI keeps invalid output drafts editable until corrected or cancelled', async () => {
    await withTemporaryHome(async () => {
        const {fixtureRoot, projectDirectory} = createProjectFixture();
        const tui = createTuiHarness({sourceDirectory: projectDirectory, columns: 44, rows: 12});
        try {
            await tui.press('o');
            await tui.press(path.join(fixtureRoot, 'fixed.zip', 'draft.zip'));
            await tui.press('\r');
            assert.match(tui.frame(), /输出目录不存在/u);
            assert.match(tui.frame(), /draft.zip/u);
            for (let index = 0; index < '/draft.zip'.length; index += 1) {
                await tui.press('\u007f');
            }
            await tui.press('\r');
            await waitFor(() => tui.frame().includes('压缩任务'));
            assert.match(tui.frame(), /fixed.zip/u);
            await tui.press('o');
            for (let index = 0; index < path.join(fixtureRoot, 'fixed.zip').length; index += 1) {
                await tui.press('\u007f');
            }
            await tui.press(path.join(fixtureRoot, 'missing', 'draft.zip'));
            await tui.press('\r');
            assert.match(tui.frame(), /输出目录不存在/u);
            await tui.press('\u001b');
            await waitFor(() => tui.frame().includes('压缩任务'));
            assert.match(tui.frame(), /fixed.zip/u);
            assert.doesNotMatch(tui.frame(), /输出目录不存在/u);
        } finally {
            await tui.close();
        }
    });
});

test('pzip TUI retains the last archive and makes the full later error scrollable', async () => {
    await withTemporaryHome(async () => {
        const {projectDirectory} = createProjectFixture();
        let calls = 0;
        const archive = async (source, options) => {
            calls += 1;
            if (calls === 1) return createZipArchive(source, options);
            const error = new Error('A complete task failure with a long explanation that should remain available');
            error.stack = `${error.message}\nmore diagnostic context\nFINAL_ERROR_DETAIL`;
            throw error;
        };
        const tui = createTuiHarness({sourceDirectory: projectDirectory, archive, columns: 38, rows: 10});
        try {
            await tui.press('\r');
            await waitFor(() => tui.frame().includes('最近归档'));
            await tui.press('p');
            await waitFor(() => tui.frame().includes('完整错误'));
            const seen = [tui.frame()];
            for (let index = 0; index < 12; index += 1) {
                await tui.press('\u001b[6~');
                seen.push(tui.frame());
            }
            assert.match(seen.join('\n'), /FINAL_ERROR_DETAIL/u);
            await tui.press('\u001b');
            await waitFor(() => tui.frame().includes('压缩任务'));
            assert.match(tui.frame(), /最近归档/u);
            assert.match(tui.frame().split('\n').at(-1), /r.*e/u);
            await tui.press('r');
            assert.match(tui.frame(), /最近归档/u);
        } finally {
            await tui.close();
        }
    });
});

test('pzip TUI keeps 35 custom rules reachable and the footer visible in low, narrow zh and en windows', async () => {
    for (const language of ['zh', 'en']) {
        await withTemporaryHome(async homeDirectory => {
            fs.writeFileSync(path.join(homeDirectory, '.pipker', 'slothtool', 'settings.json'), JSON.stringify({language}));
            for (let index = 0; index < 35; index += 1) {
                addCustomRule(`rule-${String(index).padStart(2, '0')}-${'long'.repeat(12)}`);
            }
            const {projectDirectory} = createProjectFixture();
            const tui = createTuiHarness({sourceDirectory: projectDirectory, columns: 38, rows: 10});
            try {
                await tui.press('\t');
                for (let index = 0; index < 39; index += 1) {
                    await tui.press('\u001b[B');
                    assert.match(tui.frame(), new RegExp(language === 'zh' ? `规则 ${index + 2}/40` : `Rule ${index + 2}/40`, 'u'));
                    assert.match(tui.frame(), /›/u);
                    assert.ok(tui.frame().split('\n').length <= 10);
                }
                assert.match(tui.frame(), /rule-34/u);
                assert.match(tui.frame().split('\n').at(-1), /Tab/u);
                await tui.press('v');
                assert.match(tui.frame(), language === 'zh' ? /完整模式/u : /Full pattern/u);
                assert.match(tui.frame(), /rule-34/u);
                assert.match(tui.frame().split('\n').at(-1), /Esc/u);
                const viewport = getRuleWindow(40, 39, 2);
                assert.ok(viewport.start <= 39 && viewport.end > 39);
            } finally {
                await tui.close();
            }
        });
    }
});
