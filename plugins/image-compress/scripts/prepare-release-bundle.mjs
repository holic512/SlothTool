#!/usr/bin/env node

/**
 * @file PrepareImageCompressReleaseBundle
 * @project SlothTool
 * @module Image Compress Plugin / Release
 * @description 为 image-compress 生成单平台发布目录，把 Node 包装层与预编译 Go 后端打成同一插件结构。
 * @logic 1. 解析目标平台与二进制输入参数；2. 复制插件运行时所需文件到 staging 目录；3. 写入平台清单并放置 backend/dist 二进制。
 * @dependencies Node: fs/path/url
 * @index_tags release-bundle, staging, 预编译二进制, 多平台, 插件打包
 * @author holic512
 */

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const pluginRoot = path.resolve(path.dirname(currentFilePath), '..');

function main() {
    const options = parseArgs(process.argv.slice(2));
    const stageDir = path.resolve(options.stageDir);
    const binaryPath = path.resolve(options.binaryPath);
    const binaryName = options.binaryName || path.basename(binaryPath);

    if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary path does not exist: ${binaryPath}`);
    }

    fs.rmSync(stageDir, {recursive: true, force: true});
    fs.mkdirSync(stageDir, {recursive: true});

    copyRuntimeFile('package.json', stageDir);
    copyRuntimeFile('README.md', stageDir);
    copyRuntimeFile('bin', stageDir);
    copyRuntimeFile('lib', stageDir);

    const distDir = path.join(stageDir, 'backend', 'dist');
    fs.mkdirSync(distDir, {recursive: true});

    const stagedBinaryPath = path.join(distDir, binaryName);
    fs.copyFileSync(binaryPath, stagedBinaryPath);
    if (!binaryName.endsWith('.exe')) {
        fs.chmodSync(stagedBinaryPath, 0o755);
    }

    const manifest = {
        target: options.target,
        goos: options.goos,
        goarch: options.goarch,
        binaryName
    };
    fs.writeFileSync(
        path.join(distDir, 'bundle-target.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
    );
}

function copyRuntimeFile(relativePath, stageDir) {
    const sourcePath = path.join(pluginRoot, relativePath);
    const destinationPath = path.join(stageDir, relativePath);
    fs.cpSync(sourcePath, destinationPath, {recursive: true});
}

function parseArgs(argv) {
    const options = {};

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            throw new Error(`Unknown argument: ${token}`);
        }

        const name = token.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for argument: --${name}`);
        }
        options[name] = value;
        index += 1;
    }

    for (const requiredName of ['target', 'goos', 'goarch', 'binary-path', 'stage-dir']) {
        if (!options[requiredName]) {
            throw new Error(`Missing required argument: --${requiredName}`);
        }
    }

    return {
        target: options.target,
        goos: options.goos,
        goarch: options.goarch,
        binaryPath: options['binary-path'],
        binaryName: options['binary-name'],
        stageDir: options['stage-dir']
    };
}

main();
