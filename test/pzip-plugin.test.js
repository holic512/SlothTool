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
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
    addCustomRule,
    createZipArchive,
    getConfigSummary,
    resetPluginConfig,
    toggleBuiltInRule
} from '../plugins/pzip/lib/service.js';

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
