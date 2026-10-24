/**
 * @file check-bundled-skill.js
 * @project SlothTool
 * @module Bundled Skill / Validation
 * @description Validates the shipped Skill metadata, local references and root package version without dependencies or installation.
 * @logic Read the repository-relative bundle, validate its small YAML mapping format and all local Markdown links, then report diagnostics.
 * @dependencies Node fs/path/url/process
 * @index_tags skill,bundle,metadata,version,validation
 * @author holic512
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceFiles = ['root-management', 'loc', 'image-compress', 'gstore', 'pzip', 'slothvault']
    .map(name => `references/${name}.md`);
const requiredFiles = ['SKILL.md', 'agents/openai.yaml', ...referenceFiles];

// The bundle uses a deliberately small YAML subset: two-space nested mappings,
// quoted strings and booleans. Reject unsupported syntax rather than guessing.
function parseMetadata(text, label) {
    const root = Object.create(null);
    const stack = [{indent: -2, value: root}];
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue;
        const match = line.match(/^( *)([a-z][a-z0-9_-]*):(?: +(.*))?$/u);
        if (!match || match[1].length % 2) throw new Error(`${label}:${index + 1}: unsupported YAML mapping`);
        const indent = match[1].length;
        while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
        const parent = stack.at(-1);
        if (indent !== parent.indent + 2) throw new Error(`${label}:${index + 1}: invalid indentation`);
        const key = match[2];
        if (Object.hasOwn(parent.value, key)) throw new Error(`${label}: duplicate key ${key}`);
        const raw = match[3]?.trim();
        let value;
        if (!raw) value = Object.create(null);
        else if (raw === 'true' || raw === 'false') value = raw === 'true';
        else if (raw.startsWith('"')) {
            try {value = JSON.parse(raw);} catch {throw new Error(`${label}: invalid quoted value for ${key}`);}
        } else if (/^'(?:[^']|'')*'$/u.test(raw)) value = raw.slice(1, -1).replaceAll("''", "'");
        else {
            // Plain frontmatter strings are allowed, but not YAML collections,
            // anchors, comments, tags, block scalars or implicit numeric/null values.
            if (/^[\[\]{}&*!>|%@`'"\d+-]|[:#]|^(?:null|~)$/u.test(raw)) {
                throw new Error(`${label}: quote the string value for ${key}`);
            }
            value = raw;
        }
        parent.value[key] = value;
        if (!raw) stack.push({indent, value});
    }
    return root;
}

function inside(root, target) {
    const relative = path.relative(root, target);
    return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/** Read-only validation; rootDirectory also supports isolated package fixtures. */
export function checkBundledSkill(rootDirectory = repositoryRoot) {
    const errors = [];
    const root = path.resolve(rootDirectory);
    const skillRoot = path.join(root, 'skills', 'slothtool');
    const contents = new Map();
    let version = null;
    let realSkillRoot;
    let packageVersion;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        packageVersion = pkg.version;
        if (pkg.name !== '@holic512/slothtool' || !hasText(packageVersion)) {
            errors.push('package.json must name @holic512/slothtool and contain a version');
        }
    } catch (error) {
        errors.push(`package.json: ${error.message}`);
    }
    try {
        realSkillRoot = fs.realpathSync(skillRoot);
        if (!inside(fs.realpathSync(root), realSkillRoot)) throw new Error('bundle escapes repository');
    } catch (error) {
        errors.push(`skills/slothtool: ${error.message}`);
        return {ok: false, version, errors};
    }

    function readFile(relative) {
        if (contents.has(relative)) return contents.get(relative);
        const target = path.resolve(skillRoot, relative);
        if (!inside(skillRoot, target) || !inside(realSkillRoot, fs.realpathSync(target))) {
            throw new Error(`path escapes Skill bundle: ${relative}`);
        }
        if (!fs.statSync(target).isFile()) throw new Error(`not a file: ${relative}`);
        const text = fs.readFileSync(target, 'utf8');
        if (!text.trim()) throw new Error(`empty file: ${relative}`);
        contents.set(relative, text);
        return text;
    }

    for (const relative of requiredFiles) {
        try {readFile(relative);} catch (error) {errors.push(`${relative}: ${error.message}`);}
    }

    const skill = contents.get('SKILL.md');
    if (skill) {
        try {
            const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/u);
            if (!frontmatter || !frontmatter[2].trim()) throw new Error('frontmatter and instruction body are required');
            const meta = parseMetadata(frontmatter[1], 'SKILL.md');
            if (meta.name !== 'slothtool') errors.push('SKILL.md name must be slothtool');
            if (!hasText(meta.description) || !/\p{Script=Han}/u.test(meta.description) || meta.description.length > 240) {
                errors.push('SKILL.md description must be a short Chinese description (1–240 characters)');
            }
            version = meta.metadata?.version ?? null;
            if (!hasText(version) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
                errors.push('SKILL.md metadata.version must be a quoted semantic version');
            }
            if (version !== packageVersion) errors.push(`Skill version ${version} does not match root package version ${packageVersion}`);
        } catch (error) {errors.push(`SKILL.md: ${error.message}`);}
    }

    const agent = contents.get('agents/openai.yaml');
    if (agent) {
        try {
            const meta = parseMetadata(agent, 'agents/openai.yaml');
            for (const key of ['display_name', 'short_description', 'default_prompt']) {
                if (!hasText(meta.interface?.[key])) errors.push(`agents/openai.yaml interface.${key} is required`);
            }
            const description = meta.interface?.short_description;
            if (hasText(description) && ([...description].length < 25 || [...description].length > 64)) {
                errors.push('agents/openai.yaml short_description must contain 25–64 characters');
            }
            if (hasText(meta.interface?.default_prompt) && !/\$slothtool(?![a-z0-9-])/u.test(meta.interface.default_prompt)) {
                errors.push('agents/openai.yaml default_prompt must mention $slothtool');
            }
            if (Object.hasOwn(meta, 'policy') && (typeof meta.policy !== 'object' || meta.policy === null || meta.policy.allow_implicit_invocation !== true)) {
                errors.push('agents/openai.yaml must allow implicit invocation (true or omitted policy)');
            }
        } catch (error) {errors.push(`agents/openai.yaml: ${error.message}`);}
    }

    // Follow local Markdown links recursively so a reference cannot silently rot.
    // External URLs and heading-only links are not filesystem dependencies.
    const entryReferences = new Set();
    const visited = new Set();
    function checkLinks(relative) {
        if (visited.has(relative)) return;
        visited.add(relative);
        const text = readFile(relative);
        for (const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/gu)) {
            const link = match[1].trim();
            if (/^(?:https?:|mailto:|#)/iu.test(link)) continue;
            try {
                const local = decodeURIComponent(link.split('#')[0]);
                if (!local || path.isAbsolute(local) || /^[a-z][a-z0-9+.-]*:/iu.test(local) || local.includes('\\')) {
                    throw new Error('expected a relative bundle path');
                }
                const target = path.resolve(path.dirname(path.join(skillRoot, relative)), local);
                const linked = path.relative(skillRoot, target);
                readFile(linked);
                if (relative === 'SKILL.md') entryReferences.add(linked.split(path.sep).join('/'));
                if (path.extname(linked) === '.md') checkLinks(linked);
            } catch (error) {errors.push(`${relative}: broken reference ${link}: ${error.message}`);}
        }
    }
    for (const relative of ['SKILL.md', ...referenceFiles]) {
        if (!contents.has(relative)) continue;
        try {checkLinks(relative);} catch (error) {errors.push(`${relative}: ${error.message}`);}
    }
    for (const relative of referenceFiles) {
        if (!entryReferences.has(relative)) errors.push(`SKILL.md must link to ${relative}`);
    }
    return {ok: errors.length === 0, version, errors};
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1])) {
        console.error('Usage: node scripts/check-bundled-skill.js [--root <repository>]');
        process.exitCode = 2;
    } else {
        const result = checkBundledSkill(args[1] || repositoryRoot);
        if (result.ok) console.log(`Bundled Skill slothtool ${result.version}: OK`);
        else for (const error of result.errors) console.error(`Bundled Skill: ${error}`);
        process.exitCode = result.ok ? 0 : 1;
    }
}
