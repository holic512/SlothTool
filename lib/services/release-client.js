/**
 * @file release-client.js
 * @project SlothTool
 * @module Release transport
 * @description Provides standalone release downloads, measured progress and validated archive extraction.
 * @logic Read network preferences, resolve immutable assets, stream downloads, and reject unsafe archive members before extraction.
 * @dependencies Node https/fs/child_process, network-helper
 * @index_tags release,download,progress,archive,standalone
 * @author holic512
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {buildProxyAgent, rewriteGithubUrl} from './network-helper.js';

export function readNetworkSettings(options = {}) {
    if (options.networkSettings) return {network: options.networkSettings};
    try { return JSON.parse(fs.readFileSync(path.join(options.slothToolHome || path.join(os.homedir(), '.pipker', 'slothtool'), 'settings.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Unable to read SlothTool network settings.'); }
}

async function responseFor(url, accept, options = {}, redirects = 0) {
    if (redirects > 5) throw new Error('Too many Release download redirects.');
    const preferences = options.preferences || readNetworkSettings(options);
    const effective = rewriteGithubUrl(url, preferences);
    const response = await new Promise((resolve, reject) => {
        const request = https.get(effective, {headers: {Accept: accept, 'User-Agent': 'SlothTool'}, agent: buildProxyAgent(preferences), signal: options.signal}, resolve);
        request.setTimeout(30_000, () => request.destroy(new Error('Release request timed out.')));
        request.on('error', reject);
    });
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return responseFor(new URL(response.headers.location, effective).href, accept, {...options, preferences}, redirects + 1);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        throw new Error(`Release request failed (${response.statusCode}).`);
    }
    return response;
}

export async function githubRequestJson(url, options = {}) {
    const response = await responseFor(url, 'application/vnd.github+json', options);
    let body = '';
    for await (const chunk of response) {
        body += chunk;
        if (Buffer.byteLength(body) > 8 * 1024 * 1024) {response.destroy(); throw new Error('Release JSON response is too large.');}
    }
    try { return JSON.parse(body); } catch { throw new Error('Invalid Release JSON response.'); }
}

export async function fetchLatestOfficialRelease(metadata, options = {}) {
    for (let page = 1; ; page++) {
        const releases = await githubRequestJson(`https://api.github.com/repos/${metadata.repository}/releases?per_page=50&page=${page}`, options);
        if (!Array.isArray(releases) || !releases.length) throw new Error(`No official Release found for ${metadata.alias}.`);
        const release = releases.find(item => !item.draft && !item.prerelease && typeof item.tag_name === 'string' &&
            new RegExp(`^${metadata.releaseTagPrefix.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\d+\\.\\d+\\.\\d+$`, 'u').test(item.tag_name));
        if (!release) continue;
        const version = release.tag_name.slice(metadata.releaseTagPrefix.length);
        const asset = release.assets?.find(item => item.name === `${metadata.assetNamePrefix}${version}.tgz`);
        if (!asset) throw new Error(`${metadata.alias} Release archive is missing.`);
        return {release, version, asset};
    }
}

export async function downloadFile(url, destination, options = {}) {
    const response = await responseFor(url, 'application/octet-stream', options);
    const length = Number(response.headers['content-length']);
    const total = Number.isSafeInteger(length) && length > 0 ? length : undefined;
    let current = 0, last = 0;
    const started = Date.now();
    const publish = () => options.onProgress?.({current, total, unit: 'bytes', speed: current / Math.max(0.001, (Date.now() - started) / 1000)});
    const meter = new Transform({transform(chunk, encoding, callback) {
        current += chunk.length;
        if (Date.now() - last >= 100) {last = Date.now(); publish();}
        callback(null, chunk);
    }});
    try {
        await pipeline(response, meter, fs.createWriteStream(destination, {flags: 'wx'}), {signal: options.signal});
        publish();
    } catch (error) {fs.rmSync(destination, {force: true}); throw error;}
}

export function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, ...options.env}, signal: options.signal});
        let stdout = '', stderr = '', bytes = 0, overflow = false;
        const capture = (chunk, sink) => {
            bytes += chunk.length;
            if (bytes > (options.maxBuffer || 10 * 1024 * 1024)) {overflow = true; child.kill(); return;}
            sink(chunk.toString());
        };
        child.stdout.on('data', chunk => capture(chunk, text => {stdout += text;}));
        child.stderr.on('data', chunk => capture(chunk, text => {stderr += text;}));
        child.on('error', reject);
        child.on('close', code => code === 0 && !overflow ? resolve(stdout) : reject(new Error(overflow ? 'Command output exceeded the supported size.' : stderr.trim() || stdout.trim() || `Command failed (${code}).`)));
    });
}

export async function extractTarballSafely(archive, destination) {
    const [names, details] = await Promise.all([
        runCommand('tar', ['-tzf', archive], {maxBuffer: 64 * 1024 * 1024}),
        runCommand('tar', ['-tvzf', archive], {maxBuffer: 64 * 1024 * 1024})
    ]);
    const entries = names.trimEnd().split('\n'), types = details.trimEnd().split('\n');
    if (!names.trim() || entries.length !== types.length) throw new Error('Invalid archive listing.');
    for (let index = 0; index < entries.length; index++) {
        const name = entries[index];
        if (name.includes('\\') || name.includes('\0') || name.includes('\r') || name.startsWith('/') || name.includes(':') || name.split('/').includes('..')) throw new Error('Archive contains an unsafe path.');
        if (!['-', 'd'].includes(types[index][0])) throw new Error('Archive contains an unsupported entry type.');
    }
    await runCommand('tar', ['-xzf', archive, '-C', destination]);
    function verify(directory) {
        for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
            if (item.isDirectory()) verify(path.join(directory, item.name));
            else if (!item.isFile()) throw new Error('Archive contains a link or special file.');
        }
    }
    verify(destination);
}
