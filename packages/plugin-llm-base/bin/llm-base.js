#!/usr/bin/env node

const prompts = require('prompts');
const config = require('../lib/config');
const client = require('../lib/client');
const {t} = require('../lib/i18n');
const {maskProfile, maskConfig} = require('../lib/security');
const {mapError} = require('../lib/error-mapper');

const args = process.argv.slice(2);

/**
 * CLI 主入口
 */
async function main() {
    try {
        if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
            showHelp();
            return;
        }

        if (args.includes('-i') || args.includes('--interactive') || (args[0] === 'config' && args.includes('-i'))) {
            await interactiveMode();
            return;
        }

        if (args[0] === 'config') {
            await handleConfigCommand(args.slice(1));
            return;
        }

        if (args[0] === 'chat') {
            await handleChatCommand(args.slice(1));
            return;
        }

        if (args[0] === 'raw') {
            await handleRawCommand(args.slice(1));
            return;
        }

        showHelp();
    } catch (error) {
        printError(error);
        process.exit(1);
    }
}

/**
 * 帮助输出
 */
function showHelp() {
    console.log(t('title') + '\n');
    console.log(t('usage'));
    console.log('  llm-base config <subcommand> [args]');
    console.log('  llm-base chat <message> [--mode low|high] [--profile name]');
    console.log('    # chat 返回 data 字段为严格 JSON 对象');
    console.log('  llm-base raw <json-payload> [--profile name]\n');
    console.log(t('options'));
    console.log('  -h, --help        ' + t('help'));
    console.log('  -i, --interactive ' + t('interactive') + '\n');
    console.log(t('examples'));
    console.log('  llm-base -i');
    console.log('  llm-base config create local');
    console.log('  llm-base config list');
    console.log('  llm-base config export');
    console.log('  llm-base chat "请输出任务结果" --mode low');
}

/**
 * config 子命令处理
 */
async function handleConfigCommand(configArgs) {
    const sub = configArgs[0];

    if (sub === 'create') {
        const name = configArgs[1];
        const profile = await collectProfileInput(name);
        const result = config.createProfile(profile.name, profile.value);
        console.log(JSON.stringify(maskConfig(result), null, 2));
        console.log(t('configCreated'));
        return;
    }

    if (sub === 'update') {
        const name = configArgs[1];
        const existing = config.getProfile(name);
        const profile = await collectProfileInput(name, existing.profile);
        const result = config.updateProfile(profile.name, profile.value);
        console.log(JSON.stringify(maskConfig(result), null, 2));
        console.log(t('configUpdated'));
        return;
    }

    if (sub === 'delete') {
        const name = configArgs[1];
        const result = config.deleteProfile(name);
        console.log(JSON.stringify(maskConfig(result), null, 2));
        console.log(t('configDeleted'));
        return;
    }

    if (sub === 'list') {
        const result = config.listProfiles();
        const output = {
            default_profile: result.default_profile,
            profiles: Object.keys(result.profiles)
        };
        console.log(JSON.stringify(output, null, 2));
        return;
    }

    if (sub === 'set-default') {
        const name = configArgs[1];
        const result = config.setDefaultProfile(name);
        console.log(JSON.stringify(maskConfig(result), null, 2));
        console.log(t('defaultSet'));
        return;
    }

    if (sub === 'show') {
        const name = configArgs[1];
        const item = config.getProfile(name);
        console.log(JSON.stringify({
            profile_id: item.profile_id,
            profile: maskProfile(item.profile)
        }, null, 2));
        return;
    }

    if (sub === 'export') {
        const result = config.readConfig();
        console.log(JSON.stringify(maskConfig(result), null, 2));
        return;
    }

    if (sub === '-i' || sub === '--interactive') {
        await interactiveMode();
        return;
    }

    showHelp();
}

/**
 * chat 子命令处理
 */
async function handleChatCommand(chatArgs) {
    const modeIndex = chatArgs.indexOf('--mode');
    const profileIndex = chatArgs.indexOf('--profile');

    let mode = 'low';
    let profile = null;

    if (modeIndex >= 0 && chatArgs[modeIndex + 1]) {
        mode = chatArgs[modeIndex + 1];
    }

    if (profileIndex >= 0 && chatArgs[profileIndex + 1]) {
        profile = chatArgs[profileIndex + 1];
    }

    const cleanArgs = chatArgs.filter((arg, idx) => {
        if (idx === modeIndex || idx === modeIndex + 1) return false;
        if (idx === profileIndex || idx === profileIndex + 1) return false;
        return true;
    });

    const message = cleanArgs.join(' ').trim();
    const messages = message ? [{role: 'user', content: message}] : [];

    if (mode !== 'low' && mode !== 'high') {
        console.log(JSON.stringify({
            success: false,
            error: {
                code: 'PROVIDER_ERROR',
                message: t('invalidMode')
            },
            call_id: null
        }, null, 2));
        return;
    }

    const result = await client.llm_chat(messages, mode, profile);
    console.log(JSON.stringify(result, null, 2));
}

/**
 * raw 子命令处理
 */
async function handleRawCommand(rawArgs) {
    const profileIndex = rawArgs.indexOf('--profile');
    let profile = null;

    if (profileIndex >= 0 && rawArgs[profileIndex + 1]) {
        profile = rawArgs[profileIndex + 1];
    }

    const cleanArgs = rawArgs.filter((arg, idx) => {
        if (idx === profileIndex || idx === profileIndex + 1) return false;
        return true;
    });

    const payloadText = cleanArgs.join(' ').trim();
    let payload = {};

    if (payloadText) {
        payload = JSON.parse(payloadText);
    }

    const result = await client.llm_raw(payload, profile);
    console.log(JSON.stringify(result, null, 2));
}

/**
 * 收集 profile 输入（create/update 共用）
 */
async function collectProfileInput(name, current) {
    const defaults = current || {
        base_url: 'https://api.openai.com/v1',
        api_key: '',
        low_model: 'gpt-4o-mini',
        high_model: 'gpt-4o',
        timeout: 60000
    };

    let profileName = name;
    if (!profileName) {
        const nameResp = await prompts({
            type: 'text',
            name: 'profileName',
            message: t('enterProfileName')
        });
        profileName = nameResp.profileName;
    }

    const response = await prompts([
        {
            type: 'text',
            name: 'base_url',
            message: t('enterBaseUrl'),
            initial: defaults.base_url
        },
        {
            type: 'text',
            name: 'api_key',
            message: t('enterApiKey'),
            initial: defaults.api_key
        },
        {
            type: 'text',
            name: 'low_model',
            message: t('enterLowModel'),
            initial: defaults.low_model
        },
        {
            type: 'text',
            name: 'high_model',
            message: t('enterHighModel'),
            initial: defaults.high_model
        },
        {
            type: 'number',
            name: 'timeout',
            message: t('enterTimeout'),
            initial: defaults.timeout
        }
    ]);

    return {
        name: profileName,
        value: {
            base_url: response.base_url,
            api_key: response.api_key,
            low_model: response.low_model,
            high_model: response.high_model,
            timeout: response.timeout
        }
    };
}

/**
 * 交互式配置菜单
 */
async function interactiveMode() {
    while (true) {
        const result = await prompts({
            type: 'select',
            name: 'action',
            message: t('menuTitle'),
            choices: [
                {title: t('menuCreate'), value: 'create'},
                {title: t('menuUpdate'), value: 'update'},
                {title: t('menuDelete'), value: 'delete'},
                {title: t('menuList'), value: 'list'},
                {title: t('menuSetDefault'), value: 'setDefault'},
                {title: t('menuShow'), value: 'show'},
                {title: t('menuExport'), value: 'export'},
                {title: t('menuExit'), value: 'exit'}
            ]
        });

        if (!result.action || result.action === 'exit') {
            break;
        }

        if (result.action === 'create') {
            const profile = await collectProfileInput();
            const saved = config.createProfile(profile.name, profile.value);
            console.log(JSON.stringify(maskConfig(saved), null, 2));
        } else if (result.action === 'update') {
            const nameResp = await prompts({
                type: 'text',
                name: 'name',
                message: t('enterProfileName')
            });
            const existing = config.getProfile(nameResp.name);
            const profile = await collectProfileInput(nameResp.name, existing.profile);
            const saved = config.updateProfile(profile.name, profile.value);
            console.log(JSON.stringify(maskConfig(saved), null, 2));
        } else if (result.action === 'delete') {
            const nameResp = await prompts({
                type: 'text',
                name: 'name',
                message: t('enterProfileName')
            });
            const saved = config.deleteProfile(nameResp.name);
            console.log(JSON.stringify(maskConfig(saved), null, 2));
        } else if (result.action === 'list') {
            const list = config.listProfiles();
            console.log(JSON.stringify({
                default_profile: list.default_profile,
                profiles: Object.keys(list.profiles)
            }, null, 2));
        } else if (result.action === 'setDefault') {
            const nameResp = await prompts({
                type: 'text',
                name: 'name',
                message: t('enterProfileName')
            });
            const saved = config.setDefaultProfile(nameResp.name);
            console.log(JSON.stringify(maskConfig(saved), null, 2));
        } else if (result.action === 'show') {
            const nameResp = await prompts({
                type: 'text',
                name: 'name',
                message: t('enterProfileName')
            });
            const item = config.getProfile(nameResp.name);
            console.log(JSON.stringify({
                profile_id: item.profile_id,
                profile: maskProfile(item.profile)
            }, null, 2));
        } else if (result.action === 'export') {
            console.log(JSON.stringify(maskConfig(config.readConfig()), null, 2));
        }

        console.log('');
    }
}

/**
 * 输出统一错误结构
 */
function printError(error) {
    const mapped = mapError(error);
    console.error(JSON.stringify({
        success: false,
        error: {
            code: mapped.code,
            message: mapped.message
        },
        call_id: null
    }, null, 2));
}

main();
