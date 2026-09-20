/**
 * @file SlothVaultMcpI18n
 * @project SlothTool
 * @module SlothVault MCP Plugin / Internationalization
 * @description Provides bilingual CLI and read-only TUI copy for the SlothVault MCP client.
 * @author MengJiaXu
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Locate the shared SlothTool language preference. */
function getSettingsPath() {
    return path.join(os.homedir(), '.pipker', 'slothtool', 'settings.json');
}

/** Read the configured language, falling back to Chinese when settings are unavailable. */
export function getLanguage() {
    try {
        if (fs.existsSync(getSettingsPath())) {
            const language = JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8')).language;
            return language === 'en' ? 'en' : 'zh';
        }
    } catch {
        return 'zh';
    }

    return 'zh';
}

export const messages = {
    zh: {
        title: 'slothvault-mcp - SlothVault MCP 客户端',
        usage: '用法：',
        help: '显示帮助信息',
        tuiOption: '启动只读全屏 TUI',
        jsonOption: '以单个 JSON 文档输出',
        profileOption: '选择连接配置档案',
        yesOption: '确认执行可能修改数据的工具',
        argsOption: '将 JSON 对象作为工具或 Prompt 参数',
        argsFileOption: '从文件或 -（标准输入）读取 JSON 参数',
        outputOption: 'Resource 输出文件（不会覆盖已有文件）',
        timeoutOption: '连接超时（毫秒）',
        keyStdinOption: '从标准输入读取 MCP Key',
        keyEnvOption: '从环境变量读取 MCP Key',
        options: '选项：',
        examples: '示例：',
        error: '错误',
        warning: '警告',
        ok: '正常',
        yes: '是',
        no: '否',
        none: '无',
        unknownCommand: '未知命令：{command}。请运行 slothvault-mcp --help。',
        tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 SlothVault MCP TUI。',
        confirmationRequired: '该工具可能修改远端数据；非交互调用必须使用 --yes。',
        confirmTool: '工具 "{name}" 可能修改远端数据。脱敏参数摘要：{summary}\n输入 yes 或 y 确认，其他输入取消：',
        cancelled: '操作已取消。',
        noProfile: '没有可用的连接配置档案。请先运行 profile add。',
        profileRequired: '需要配置档案名称。',
        profileAdded: '配置档案已添加：{name}',
        profileUpdated: '配置档案已更新：{name}',
        profileUsed: '默认配置档案已切换为：{name}',
        profileRemoved: '配置档案已删除：{name}',
        profileListTitle: 'SlothVault MCP 配置档案',
        profileDefault: '默认',
        profileEndpoint: '端点',
        profileTimeout: '超时',
        profileCreated: '创建时间',
        profileUpdatedAt: '更新时间',
        keyPrompt: '输入 MCP Key（不会回显）：',
        keyStdinEmpty: '标准输入中未读取到 MCP Key。',
        keyEnvEmpty: '环境变量中未读取到 MCP Key：{name}',
        keySourceExclusive: '--key-stdin 和 --key-env 只能使用一个。',
        directKeyUnsupported: '不支持 --key；请使用隐藏输入、--key-stdin 或 --key-env。',
        jsonKeySourceRequired: 'JSON 模式新增配置档案时必须使用 --key-stdin 或 --key-env。',
        endpointRequired: '需要 MCP URL。',
        timeoutInvalid: '超时必须是 1000 到 300000 毫秒之间的整数。',
        argsObject: '参数必须是 JSON object。',
        argsSourceExclusive: '--args、--args-file 和 stdin 参数来源只能使用一个。',
        optionRequired: '必须指定 {option}。',
        optionValueRequired: '{option} 需要一个值。',
        argsValueRequired: '--args 需要一个 JSON 值。',
        argsFileValueRequired: '--args-file 需要文件路径或 -。',
        argsFileRead: '无法读取参数文件：{path}',
        argsJsonInvalid: '参数不是合法的 JSON：{message}',
        toolRequired: '需要工具名称。',
        promptRequired: '需要 Prompt 名称。',
        uriRequired: '需要 Resource URI。',
        outputRequired: '读取 Resource 必须指定 --output。',
        outputExists: '输出文件已存在，为避免覆盖而停止：{path}',
        doctorTitle: 'SlothVault MCP 连接诊断',
        server: '服务端',
        version: '版本',
        endpoint: '端点',
        protocol: '协议版本',
        tools: '工具',
        prompts: 'Prompts',
        resources: 'Resource 模板',
        duration: '耗时',
        risk: '风险',
        readOnly: '只读',
        write: '写入',
        noTools: '服务端未返回工具。',
        noPrompts: '服务端未返回 Prompt。',
        noResources: '服务端未返回 Resource 模板。',
        callSucceeded: '工具调用成功：{name}',
        businessFailed: '工具返回业务错误：{name}',
        promptFetched: 'Prompt 获取成功：{name}',
        resourceSaved: 'Resource 已保存：{path}（{bytes} 字节）',
        historyTitle: '调用历史',
        historyEmpty: '暂无调用历史。',
        historyCleared: '调用历史已清空。',
        historyConfirm: '确定清空调用历史吗？输入 yes 或 y 确认：',
        historyIdRequired: '需要历史记录 ID。',
        invalidId: '无效的历史记录 ID：{id}',
        httpWarning: '当前端点使用 HTTP，Bearer Key 将以明文传输。',
        plaintextConfigWarning: 'MCP Key 将以明文保存在本地 SlothTool 插件配置中。',
        tui: {
            tabs: {status: '状态', capabilities: '能力', history: '历史', profiles: '配置'},
            panels: {connection: '连接状态', tools: '工具', prompts: 'Prompts', resources: 'Resource 模板', details: '详情', recent: '最近调用', profile: '当前配置'},
            labels: {profile: '档案', endpoint: '端点', server: '服务端', version: '版本', protocol: '协议', status: '状态', count: '数量', name: '名称', description: '描述', risk: '风险', uri: 'URI', key: 'Key', timeout: '超时'},
            status: {ready: '就绪。按 r 刷新远端能力，q 退出。', loading: '正在连接并发现能力…', failed: '连接失败：{message}', refreshed: '能力已刷新。'},
            footer: 'Tab 切换页面 | ↑↓ 选择 | r 刷新 | q 退出',
            empty: '暂无数据。',
            help: 'TUI 仅提供状态、能力、历史与配置档案查看，不会执行远程操作。'
        },
        errors: {
            INVALID_PROFILE_NAME: '配置档案名称必须由 1 至 64 个字母、数字、点、下划线或连字符组成。',
            INVALID_API_KEY: 'MCP Key 格式无效。',
            INVALID_TIMEOUT: '超时必须是 1000 到 300000 毫秒之间的整数。',
            INVALID_ENDPOINT: 'MCP endpoint 无效；必须使用 HTTP/HTTPS、不得包含凭据、query 或 fragment，且路径必须以 /mcp 结尾。',
            INVALID_CONFIG: 'SlothVault MCP 配置文件无效或已损坏。',
            UNSUPPORTED_CONFIG_VERSION: '不支持该 SlothVault MCP 配置版本。',
            PROFILE_NOT_FOUND: '找不到指定的连接配置档案。',
            PROFILE_EXISTS: '同名连接配置档案已存在。',
            DEFAULT_PROFILE_NOT_SET: '尚未设置默认 SlothVault MCP 配置档案。',
            MCP_AUTH_FAILED: 'SlothVault MCP 认证失败。',
            MCP_UNAVAILABLE: 'SlothVault MCP 暂不可用。',
            MCP_TIMEOUT: 'SlothVault MCP 请求超时。',
            MCP_NETWORK_ERROR: '无法连接 SlothVault MCP endpoint。',
            MCP_PROTOCOL_ERROR: 'SlothVault MCP 协议响应无效。',
            MCP_BUSINESS_ERROR: 'SlothVault Tool 返回业务错误。',
            UNEXPECTED_SERVER_IDENTITY: 'MCP 服务端身份不是 slothvault-admin-mcp。',
            INVALID_MCP_RESPONSE: 'SlothVault MCP 返回了无效的能力列表。',
            TOOL_NOT_FOUND: '实时能力目录中找不到指定 Tool。',
            INVALID_ARGUMENTS: 'Tool 或 Prompt 参数必须是 JSON object。',
            CONFIRMATION_REQUIRED: '该 Tool 可能写入远端数据，执行前必须确认。',
            CONFIRMATION_DECLINED: 'Tool 调用未获确认。',
            PROMPT_NOT_FOUND: '实时能力目录中找不到指定 Prompt。',
            INVALID_RESOURCE_URI: 'Resource URI 格式或正十进制 ID 无效。',
            UNSUPPORTED_RESOURCE_URI: 'Resource URI 不属于受支持的 SlothVault 受保护命名空间。',
            INVALID_RESOURCE_BLOB: 'Resource blob 不是严格有效的 Base64。',
            RESOURCE_TOO_LARGE: 'Resource 超出允许的大小上限。',
            INVALID_RESOURCE_RESPONSE: 'Resource 响应结构或 URI 不匹配。',
            INVALID_RESOURCE_MIME: 'Resource MIME 类型无效或与资源类型不匹配。',
            INVALID_RESOURCE_NAME: 'Resource 文件名无效。',
            OUTPUT_DIRECTORY_NOT_FOUND: 'Resource 输出目录不存在。',
            OUTPUT_EXISTS: 'Resource 输出文件已存在，拒绝覆盖。',
            OUTPUT_REQUIRED: '读取 Resource 必须指定输出文件。',
            RESOURCE_WRITE_FAILED: 'Resource 文件落盘失败。'
        }
    },
    en: {
        title: 'slothvault-mcp - SlothVault MCP client',
        usage: 'Usage:',
        help: 'Show help',
        tuiOption: 'Launch the read-only full-screen TUI',
        jsonOption: 'Print one JSON document',
        profileOption: 'Select a connection profile',
        yesOption: 'Confirm a tool that may mutate remote data',
        argsOption: 'Pass a JSON object as tool or prompt arguments',
        argsFileOption: 'Read a JSON object from a file or - (stdin)',
        outputOption: 'Resource output file (existing files are never replaced)',
        timeoutOption: 'Connection timeout in milliseconds',
        keyStdinOption: 'Read the MCP key from stdin',
        keyEnvOption: 'Read the MCP key from an environment variable',
        options: 'Options:',
        examples: 'Examples:',
        error: 'Error',
        warning: 'Warning',
        ok: 'OK',
        yes: 'Yes',
        no: 'No',
        none: 'None',
        unknownCommand: 'Unknown command: {command}. Run slothvault-mcp --help.',
        tuiRequiresTerminal: 'The current terminal is not interactive, so the SlothVault MCP TUI cannot start.',
        confirmationRequired: 'This tool may mutate remote data; non-interactive calls require --yes.',
        confirmTool: 'Tool "{name}" may mutate remote data. Redacted argument summary: {summary}\nType yes or y to confirm; anything else cancels: ',
        cancelled: 'Operation cancelled.',
        noProfile: 'No connection profiles exist. Run profile add first.',
        profileRequired: 'A profile name is required.',
        profileAdded: 'Profile added: {name}',
        profileUpdated: 'Profile updated: {name}',
        profileUsed: 'Default profile is now: {name}',
        profileRemoved: 'Profile removed: {name}',
        profileListTitle: 'SlothVault MCP profiles',
        profileDefault: 'default',
        profileEndpoint: 'Endpoint',
        profileTimeout: 'Timeout',
        profileCreated: 'Created',
        profileUpdatedAt: 'Updated',
        keyPrompt: 'Enter the MCP key (input is hidden): ',
        keyStdinEmpty: 'No MCP key was read from stdin.',
        keyEnvEmpty: 'The environment variable is empty: {name}',
        keySourceExclusive: 'Only one of --key-stdin and --key-env may be used.',
        directKeyUnsupported: 'The --key option is not supported. Use hidden input, --key-stdin, or --key-env.',
        jsonKeySourceRequired: 'JSON mode requires --key-stdin or --key-env when adding a profile.',
        endpointRequired: 'An MCP URL is required.',
        timeoutInvalid: 'Timeout must be an integer from 1000 to 300000 milliseconds.',
        argsObject: 'Arguments must be a JSON object.',
        argsSourceExclusive: 'Only one of --args, --args-file, or stdin may provide arguments.',
        optionRequired: '{option} is required.',
        optionValueRequired: '{option} requires a value.',
        argsValueRequired: '--args requires a JSON value.',
        argsFileValueRequired: '--args-file requires a path or -.',
        argsFileRead: 'Unable to read arguments file: {path}',
        argsJsonInvalid: 'Arguments are not valid JSON: {message}',
        toolRequired: 'A tool name is required.',
        promptRequired: 'A prompt name is required.',
        uriRequired: 'A resource URI is required.',
        outputRequired: 'Reading a resource requires --output.',
        outputExists: 'Output file already exists; refusing to overwrite: {path}',
        doctorTitle: 'SlothVault MCP connection diagnostics',
        server: 'Server',
        version: 'Version',
        endpoint: 'Endpoint',
        protocol: 'Protocol',
        tools: 'Tools',
        prompts: 'Prompts',
        resources: 'Resource templates',
        duration: 'Duration',
        risk: 'Risk',
        readOnly: 'read-only',
        write: 'write',
        noTools: 'The server returned no tools.',
        noPrompts: 'The server returned no prompts.',
        noResources: 'The server returned no resource templates.',
        callSucceeded: 'Tool call succeeded: {name}',
        businessFailed: 'Tool returned a business error: {name}',
        promptFetched: 'Prompt fetched: {name}',
        resourceSaved: 'Resource saved to {path} ({bytes} bytes)',
        historyTitle: 'Call history',
        historyEmpty: 'No call history.',
        historyCleared: 'Call history cleared.',
        historyConfirm: 'Clear call history? Type yes or y to confirm: ',
        historyIdRequired: 'A history record ID is required.',
        invalidId: 'Invalid history record ID: {id}',
        httpWarning: 'This endpoint uses HTTP; the Bearer key will be sent in clear text.',
        plaintextConfigWarning: 'The MCP key is stored as plain text in the local SlothTool plugin configuration.',
        tui: {
            tabs: {status: 'Status', capabilities: 'Capabilities', history: 'History', profiles: 'Profiles'},
            panels: {connection: 'Connection', tools: 'Tools', prompts: 'Prompts', resources: 'Resource templates', details: 'Details', recent: 'Recent calls', profile: 'Current profile'},
            labels: {profile: 'Profile', endpoint: 'Endpoint', server: 'Server', version: 'Version', protocol: 'Protocol', status: 'Status', count: 'Count', name: 'Name', description: 'Description', risk: 'Risk', uri: 'URI', key: 'Key', timeout: 'Timeout'},
            status: {ready: 'Ready. Press r to refresh capabilities or q to quit.', loading: 'Connecting and discovering capabilities…', failed: 'Connection failed: {message}', refreshed: 'Capabilities refreshed.'},
            footer: 'Tab switch page | Up/Down select | r refresh | q quit',
            empty: 'No data.',
            help: 'The TUI only displays status, capabilities, history, and profiles; it never performs remote operations.'
        },
        errors: {
            INVALID_PROFILE_NAME: 'Profile names must contain 1-64 letters, numbers, dots, underscores, or hyphens.',
            INVALID_API_KEY: 'The MCP key format is invalid.',
            INVALID_TIMEOUT: 'Timeout must be an integer from 1000 to 300000 milliseconds.',
            INVALID_ENDPOINT: 'The MCP endpoint is invalid; use HTTP/HTTPS without credentials, query, or fragment, and end its path with /mcp.',
            INVALID_CONFIG: 'The SlothVault MCP configuration is invalid or corrupt.',
            UNSUPPORTED_CONFIG_VERSION: 'The SlothVault MCP configuration version is unsupported.',
            PROFILE_NOT_FOUND: 'The requested connection profile was not found.',
            PROFILE_EXISTS: 'A connection profile with that name already exists.',
            DEFAULT_PROFILE_NOT_SET: 'No default SlothVault MCP profile is configured.',
            MCP_AUTH_FAILED: 'SlothVault MCP authentication failed.',
            MCP_UNAVAILABLE: 'SlothVault MCP is unavailable.',
            MCP_TIMEOUT: 'The SlothVault MCP request timed out.',
            MCP_NETWORK_ERROR: 'Unable to reach the SlothVault MCP endpoint.',
            MCP_PROTOCOL_ERROR: 'The SlothVault MCP protocol response is invalid.',
            MCP_BUSINESS_ERROR: 'The SlothVault Tool returned a business error.',
            UNEXPECTED_SERVER_IDENTITY: 'The MCP server identity is not slothvault-admin-mcp.',
            INVALID_MCP_RESPONSE: 'SlothVault MCP returned an invalid capability list.',
            TOOL_NOT_FOUND: 'The requested Tool was not found in the live capability catalog.',
            INVALID_ARGUMENTS: 'Tool or Prompt arguments must be a JSON object.',
            CONFIRMATION_REQUIRED: 'This Tool may mutate remote data and requires confirmation.',
            CONFIRMATION_DECLINED: 'The Tool call was not confirmed.',
            PROMPT_NOT_FOUND: 'The requested Prompt was not found in the live capability catalog.',
            INVALID_RESOURCE_URI: 'The Resource URI format or positive decimal identifier is invalid.',
            UNSUPPORTED_RESOURCE_URI: 'The Resource URI is outside the supported protected SlothVault namespaces.',
            INVALID_RESOURCE_BLOB: 'The Resource blob is not strict valid Base64.',
            RESOURCE_TOO_LARGE: 'The Resource exceeds its size limit.',
            INVALID_RESOURCE_RESPONSE: 'The Resource response shape or URI does not match.',
            INVALID_RESOURCE_MIME: 'The Resource MIME type is invalid or does not match its resource type.',
            INVALID_RESOURCE_NAME: 'The Resource file name is invalid.',
            OUTPUT_DIRECTORY_NOT_FOUND: 'The Resource output directory does not exist.',
            OUTPUT_EXISTS: 'The Resource output file already exists; refusing to overwrite it.',
            OUTPUT_REQUIRED: 'Reading a Resource requires an output file.',
            RESOURCE_WRITE_FAILED: 'Unable to save the Resource file.'
        }
    }
};

/** Resolve a dot-separated translation key and interpolate its named values. */
export function t(key, params = {}) {
    const source = messages[getLanguage()] || messages.zh;
    const value = key.split('.').reduce((current, part) => current?.[part], source);
    if (typeof value !== 'string') {
        return key;
    }
    return value.replace(/\{(\w+)\}/gu, (_match, name) => String(params[name] ?? ''));
}

/** Format service errors without exposing sensitive request or authentication data. */
export function formatSlothVaultError(error) {
    const key = error?.code ? `errors.${error.code}` : '';
    const translated = key ? t(key) : '';
    const message = translated && translated !== key ? translated : error?.message || String(error);
    return String(message)
        .replace(/svmcp_[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}/gu, '[redacted]')
        .replace(/Bearer\s+[^\s"']+/giu, 'Bearer [redacted]');
}
