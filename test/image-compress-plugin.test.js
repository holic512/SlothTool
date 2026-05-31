/**
 * @file ImageCompressPluginSmokeTest
 * @project SlothTool
 * @module Test / Image Compress Plugin
 * @description 验证 image-compress 插件的帮助输出、默认 TUI 烟雾路径、拖拽路径解析和后端 CLI 包装是否可用。
 * @logic 1. 通过子进程运行 Node 入口；2. 使用临时 HOME 与临时图片夹具隔离测试；3. 校验帮助、dry-run、JSON 输出和路径解析行为。
 * @dependencies Node: assert/child_process/fs/os/path/test/url, Service: ../plugins/image-compress/lib/service.js
 * @index_tags 图片压缩测试, TUI烟雾测试, CLI包装, 路径解析, Go后端代理
 * @author holic512
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
    getBundledBinaryPath,
    parseDroppedPaths,
    resolveBackendCommand
} from '../plugins/image-compress/lib/service.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const imageCompressBin = path.join(rootDir, 'plugins', 'image-compress', 'bin', 'image-compress.js');
const prepareBundleScript = path.join(rootDir, 'plugins', 'image-compress', 'scripts', 'prepare-release-bundle.mjs');

function createTempHome() {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-home-'));
    const slothDir = path.join(homeDir, '.slothtool');
    fs.mkdirSync(slothDir, {recursive: true});
    fs.writeFileSync(path.join(slothDir, 'settings.json'), JSON.stringify({language: 'zh'}, null, 2));
    return homeDir;
}

function runImageCompress(args = [], env = {}) {
    return execFileSync(process.execPath, [imageCompressBin, ...args], {
        cwd: rootDir,
        encoding: 'utf8',
        env: {
            ...process.env,
            ...env
        }
    });
}

function createJpegFixture(tempDir) {
    const generatorPath = path.join(tempDir, 'generate-fixture.go');
    const outputPath = path.join(tempDir, 'fixture.jpg');
    fs.writeFileSync(generatorPath, `
package main
import (
  "image"
  "image/color"
  "image/jpeg"
  "os"
)
func main() {
  file, err := os.Create(os.Args[1])
  if err != nil { panic(err) }
  defer file.Close()
  img := image.NewNRGBA(image.Rect(0, 0, 320, 200))
  for y := 0; y < 200; y++ {
    for x := 0; x < 320; x++ {
      img.Set(x, y, color.NRGBA{R: uint8((x*5)%255), G: uint8((y*7)%255), B: uint8((x+y)%255), A: 255})
    }
  }
  if err := jpeg.Encode(file, img, &jpeg.Options{Quality: 100}); err != nil { panic(err) }
}
`, 'utf8');
    execFileSync('go', ['run', generatorPath, outputPath], {
        cwd: rootDir,
        stdio: 'ignore'
    });
    return outputPath;
}

test('image-compress help advertises the default TUI entry', () => {
    const output = runImageCompress(['--help'], {HOME: createTempHome()});
    assert.match(output, /image-compress --tui/u);
    assert.match(output, /支持直接拖拽文件或文件夹到终端/u);
});

test('image-compress default entry can exit through the TUI smoke hook', () => {
    assert.doesNotThrow(() => {
        runImageCompress([], {
            HOME: createTempHome(),
            SLOTHTOOL_IMAGE_COMPRESS_TUI_TEST_ACTION: 'exit'
        });
    });
});

test('image-compress CLI wraps the Go backend dry-run path', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-fixture-'));
    const imagePath = createJpegFixture(tempDir);
    const output = runImageCompress(['--dry-run', '--quiet', '--quality', '45', imagePath], {
        HOME: createTempHome()
    });

    assert.match(output, /DRY-RUN/u);
    assert.match(output, /Summary:/u);
});

test('image-compress CLI can forward JSON output from the Go backend', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-json-'));
    const imagePath = createJpegFixture(tempDir);
    const output = runImageCompress(['--dry-run', '--json', imagePath], {
        HOME: createTempHome()
    });

    const parsed = JSON.parse(output);
    assert.equal(parsed.TotalFiles, 1);
    assert.equal(parsed.Results.length, 1);
});

test('image-compress path parsing handles escaped and quoted drop text', () => {
    const parsedPaths = parseDroppedPaths(`'/tmp/Photo One.jpg' /tmp/Photo\\ Two.png\n"/tmp/Three.webp"`);
    assert.deepEqual(parsedPaths, [
        '/tmp/Photo One.jpg',
        '/tmp/Photo Two.png',
        '/tmp/Three.webp'
    ]);
});

test('image-compress service prefers a bundled backend binary when present', () => {
    const tempPluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-binary-'));
    const bundledBinaryPath = getBundledBinaryPath({pluginRoot: tempPluginRoot, platform: process.platform});
    fs.mkdirSync(path.dirname(bundledBinaryPath), {recursive: true});
    fs.writeFileSync(bundledBinaryPath, 'binary', 'utf8');

    const backendCommand = resolveBackendCommand({
        pluginRoot: tempPluginRoot,
        backendDir: path.join(tempPluginRoot, 'backend'),
        platform: process.platform
    });

    assert.equal(backendCommand.mode, 'bundled-binary');
    assert.equal(backendCommand.command, bundledBinaryPath);
});

test('image-compress service falls back to go run when no bundled binary exists', () => {
    const tempPluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-source-'));
    const tempBackendDir = path.join(tempPluginRoot, 'backend');
    fs.mkdirSync(tempBackendDir, {recursive: true});
    fs.writeFileSync(path.join(tempBackendDir, 'go.mod'), 'module example.com/test\n', 'utf8');

    const backendCommand = resolveBackendCommand({
        pluginRoot: tempPluginRoot,
        backendDir: tempBackendDir,
        platform: process.platform
    });

    assert.equal(backendCommand.mode, 'go-run');
    assert.equal(backendCommand.command, 'go');
    assert.deepEqual(backendCommand.args, ['run', './cmd/image-compress']);
});

test('prepare-release-bundle stages the Node wrapper and target binary together', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slothtool-image-compress-bundle-'));
    const binaryPath = path.join(tempDir, process.platform === 'win32' ? 'image-compress-backend.exe' : 'image-compress-backend');
    const stageDir = path.join(tempDir, 'stage');
    fs.writeFileSync(binaryPath, 'binary', 'utf8');

    execFileSync(process.execPath, [
        prepareBundleScript,
        '--target', 'linux-amd64',
        '--goos', 'linux',
        '--goarch', 'amd64',
        '--binary-path', binaryPath,
        '--stage-dir', stageDir
    ], {
        cwd: rootDir,
        stdio: 'ignore'
    });

    assert.ok(fs.existsSync(path.join(stageDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(stageDir, 'bin', 'image-compress.js')));
    assert.ok(fs.existsSync(path.join(stageDir, 'lib', 'service.js')));
    assert.ok(fs.existsSync(path.join(stageDir, 'backend', 'dist', path.basename(binaryPath))));

    const manifest = JSON.parse(fs.readFileSync(path.join(stageDir, 'backend', 'dist', 'bundle-target.json'), 'utf8'));
    assert.equal(manifest.target, 'linux-amd64');
    assert.equal(manifest.binaryName, path.basename(binaryPath));
});
