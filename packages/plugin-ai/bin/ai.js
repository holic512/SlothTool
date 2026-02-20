#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const prompts = require('prompts');

const args = process.argv.slice(2);

const DEFAULT_MODE = 'low';
const MAX_HISTORY_MESSAGES = 20;

function showHelp() {
  console.log('ai - Claude Code-style AI chat assistant (WIP)\n');
  console.log('Usage:');
  console.log('  ai -i [--mode low|high] [--profile name]');
  console.log('  ai chat <message> [--mode low|high] [--profile name]');
  console.log('  ai <message> [--mode low|high] [--profile name]\n');
  console.log('Options:');
  console.log('  -h, --help        Show help');
  console.log('  -i, --interactive Interactive mode');
  console.log('  --mode            low | high (default: low)');
  console.log('  --profile         llm-base profile name (optional)\n');
  console.log('Notes:');
  console.log('  - This plugin loads llm-base via ~/.slothtool/registry.json');
  console.log('  - llm-base must be installed and configured first');
  console.log('');
}

function getRegistryPath() {
  return path.join(os.homedir(), '.slothtool', 'registry.json');
}

function readRegistry() {
  const registryPath = getRegistryPath();

  if (!fs.existsSync(registryPath)) {
    return { plugins: {} };
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return { plugins: {} };
    if (!parsed.plugins || typeof parsed.plugins !== 'object') return { plugins: {} };
    return parsed;
  } catch (error) {
    return { plugins: {} };
  }
}

function loadLlmBase() {
  const registry = readRegistry();
  const plugin = registry.plugins && registry.plugins['llm-base'] ? registry.plugins['llm-base'] : null;

  if (!plugin || !plugin.binPath) {
    const err = new Error('llm-base not found in registry. Please run: slothtool install @holic512/plugin-llm-base');
    err.code = 'NO_LLM_BASE';
    throw err;
  }

  const moduleRoot = path.resolve(path.dirname(plugin.binPath), '..');
  const entry = path.join(moduleRoot, 'lib', 'index.js');

  if (!fs.existsSync(entry)) {
    const err = new Error('llm-base module entry not found: ' + entry);
    err.code = 'BROKEN_LLM_BASE';
    throw err;
  }

  // eslint-disable-next-line import/no-dynamic-require, global-require
  const llmBase = require(entry);
  if (!llmBase || typeof llmBase.llm_chat !== 'function') {
    const err = new Error('llm-base does not export llm_chat()');
    err.code = 'INVALID_LLM_BASE';
    throw err;
  }

  return llmBase;
}

function buildProtocolSystemPrompt() {
  return [
    'You are an AI CLI assistant.',
    'You must return a JSON object with the following shape:',
    '{"type":"chat","message":"...","data":{}}',
    'For now, always use type="chat". Do not request command execution.',
    'Put the user-facing answer in the "message" field.',
    'Keep "data" as an object ({} is fine).'
  ].join('\n');
}

function extractAssistantMessage(modelJson) {
  if (modelJson && typeof modelJson === 'object' && !Array.isArray(modelJson)) {
    if (typeof modelJson.message === 'string' && modelJson.message.trim()) {
      return modelJson.message.trim();
    }
    if (typeof modelJson.result === 'string' && modelJson.result.trim()) {
      return modelJson.result.trim();
    }
    return JSON.stringify(modelJson, null, 2);
  }

  if (typeof modelJson === 'string') {
    return modelJson.trim();
  }

  return String(modelJson);
}

function takeFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx >= 0 && argv[idx + 1]) {
    const value = argv[idx + 1];
    const next = argv.filter((_, i) => i !== idx && i !== idx + 1);
    return { value, argv: next };
  }
  return { value: null, argv };
}

function stripFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx >= 0) {
    return argv.filter((_, i) => i !== idx);
  }
  return argv;
}

function parseArgs(argv) {
  let out = [...argv];

  const modeRes = takeFlagValue(out, '--mode');
  out = modeRes.argv;

  const profileRes = takeFlagValue(out, '--profile');
  out = profileRes.argv;

  const isInteractive = out.includes('-i') || out.includes('--interactive') || out.length === 0;
  out = stripFlag(stripFlag(out, '-i'), '--interactive');

  const mode = modeRes.value || DEFAULT_MODE;
  const profile = profileRes.value || null;

  return { mode, profile, isInteractive, argv: out };
}

async function runOnce(userText, { mode, profile }) {
  const llmBase = loadLlmBase();
  const messages = [
    { role: 'system', content: buildProtocolSystemPrompt() },
    { role: 'user', content: userText }
  ];

  const result = await llmBase.llm_chat(messages, mode, profile);
  if (!result || !result.success) {
    const code = result && result.error && result.error.code ? result.error.code : 'UNKNOWN_ERROR';
    const msg = result && result.error && result.error.message ? result.error.message : 'Unknown error';
    console.error(`[llm-base:${code}] ${msg}`);
    process.exit(1);
  }

  const assistantText = extractAssistantMessage(result.data);
  process.stdout.write(assistantText + '\n');
}

async function interactiveMode({ mode, profile }) {
  const llmBase = loadLlmBase();

  const history = [];
  const systemMessage = { role: 'system', content: buildProtocolSystemPrompt() };

  console.log('ai (interactive) - type /exit to quit\n');

  while (true) {
    const resp = await prompts({
      type: 'text',
      name: 'text',
      message: 'You'
    });

    if (!resp || resp.text === undefined) {
      break;
    }

    const text = String(resp.text || '').trim();
    if (!text) {
      continue;
    }

    if (text === '/exit' || text === 'exit' || text === 'quit') {
      break;
    }

    history.push({ role: 'user', content: text });

    const trimmedHistory = history.length > MAX_HISTORY_MESSAGES
      ? history.slice(history.length - MAX_HISTORY_MESSAGES)
      : history;

    const result = await llmBase.llm_chat([systemMessage, ...trimmedHistory], mode, profile);

    if (!result || !result.success) {
      const code = result && result.error && result.error.code ? result.error.code : 'UNKNOWN_ERROR';
      const msg = result && result.error && result.error.message ? result.error.message : 'Unknown error';
      console.error(`[llm-base:${code}] ${msg}`);
      continue;
    }

    const assistantText = extractAssistantMessage(result.data);
    console.log('\n' + assistantText + '\n');

    history.push({ role: 'assistant', content: assistantText });
  }
}

async function main() {
  try {
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }

    const parsed = parseArgs(args);

    if (parsed.isInteractive) {
      await interactiveMode({ mode: parsed.mode, profile: parsed.profile });
      return;
    }

    const [sub, ...rest] = parsed.argv;

    if (sub === 'chat') {
      const text = rest.join(' ').trim();
      if (!text) {
        showHelp();
        process.exit(2);
      }
      await runOnce(text, { mode: parsed.mode, profile: parsed.profile });
      return;
    }

    const text = parsed.argv.join(' ').trim();
    if (!text) {
      showHelp();
      process.exit(2);
    }

    await runOnce(text, { mode: parsed.mode, profile: parsed.profile });
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    console.error(msg);
    process.exit(1);
  }
}

main();
