/**
 * @file SlothToolI18n
 * @project SlothTool
 * @module Core CLI / Internationalization
 * @description 维护 SlothTool CLI 与默认 TUI 的中英文文案，并提供点路径消息访问能力。
 * @logic 1. 按当前语言读取消息字典；2. 支持嵌套键访问；3. 对模板字符串执行参数替换。
 * @dependencies Settings: ./settings.js
 * @index_tags i18n, TUI文案, CLI文案, 双语
 * @author holic512
 */

import settings from './settings.js';

export const messages = {
    zh: {
        pluginManager: 'SlothTool - 插件管理器',
        usage: '用法：',
        examples: '示例：',
        commands: {
            install: '安装官方插件',
            uninstall: '卸载已安装插件',
            update: '更新单个插件',
            updateAll: '更新所有插件',
            list: '列出已安装插件',
            run: '运行插件',
            runShorthand: '运行插件（简写）',
            config: '配置语言与网络',
            interactive: '启动全屏 TUI',
            uninstallAll: '完全卸载 SlothTool 数据',
            selfUpdate: '更新 SlothTool 本体'
        },
        cli: {
            defaultTui: '无参数时默认进入全屏 TUI。',
            tuiRequiresTerminal: '当前终端不是交互式 TTY，无法启动 TUI。请改用显式 CLI 子命令。',
            installUsage: '用法：slothtool install <plugin-alias>',
            uninstallUsage: '用法：slothtool uninstall <plugin-alias>',
            updateUsage: '用法：slothtool update <plugin-alias>',
            runUsage: '用法：slothtool run <plugin-alias> [args...]',
            configUsage: '用法：slothtool config <language|proxy ...>',
            configHelpLines: [
                'slothtool config language <zh|en>',
                'slothtool config proxy show',
                'slothtool config proxy enabled <on|off>',
                'slothtool config proxy host <host>',
                'slothtool config proxy port <port>',
                'slothtool config proxy github <official|gh-proxy|custom>',
                'slothtool config proxy github-url <https://...>'
            ],
            specifyPlugin: '错误：请指定插件别名。',
            specifyPluginToUpdate: '错误：请指定要更新的插件。',
            specifyPluginToRun: '错误：请指定要运行的插件。',
            languageSet: '语言已设置为：{language}',
            invalidLanguage: '无效语言，请使用 "zh" 或 "en"。',
            confirmPrompt: '输入 "yes" 确认：',
            operationCancelled: '操作已取消。'
        },
        config: {
            summaryLanguage: '当前语言：{language}',
            summaryProxy: '代理：{status} ({protocol}://{host}:{port})',
            summaryGithub: 'GitHub 源：{label}{suffix}',
            customUrlSuffix: ' ({url})',
            statuses: {
                on: '开启',
                off: '关闭'
            },
            githubPresets: {
                official: '官方 GitHub',
                ghProxy: 'gh-proxy.com',
                custom: '自定义'
            },
            proxyEnabledSet: '代理已{status}。',
            proxyHostSet: '代理主机已设置为：{host}',
            proxyPortSet: '代理端口已设置为：{port}',
            githubPresetSet: 'GitHub 源已设置为：{label}',
            githubUrlSet: 'GitHub 自定义代理地址已设置为：{url}',
            customUrlRequired: '请先使用 "slothtool config proxy github-url <https://...>" 设置自定义地址。',
            invalidOnOff: '无效开关，请使用 "on" 或 "off"。',
            invalidPort: '无效端口，请使用 1 到 65535 的整数。',
            invalidGithubPreset: '无效 GitHub 源，请使用 "official"、"gh-proxy" 或 "custom"。',
            invalidGithubUrl: '无效 GitHub 自定义代理地址，请提供 http(s) URL。'
        },
        install: {
            start: '正在安装插件：{alias}',
            alreadyInstalled: '插件 "{alias}" 已安装。',
            uninstallFirst: '如需重装，请先执行 "slothtool uninstall {alias}"。',
            checkingUpdates: '正在检查最新发布版本...',
            installingTo: '安装目录：{dir}',
            downloadingAsset: '正在下载发布资产：{assetName}',
            installingDependencies: '正在安装插件运行时依赖...',
            success: '插件 "{alias}" 安装成功。',
            runHint: '运行：slothtool {alias} --help',
            failed: '安装插件 "{packageName}" 失败：{reason}',
            officialOnly: '"{alias}" 不是官方插件别名。可用插件：{aliases}'
        },
        uninstall: {
            start: '正在卸载插件：{alias}',
            notInstalled: '插件 "{alias}" 未安装。',
            willRemove: '将删除插件目录、配置文件和注册表条目。',
            success: '插件 "{alias}" 卸载成功。',
            failed: '卸载插件 "{alias}" 失败：{reason}'
        },
        update: {
            start: '正在更新插件：{alias}',
            currentVersion: '当前版本：{version}',
            checking: '正在检查更新...',
            latest: '插件 "{alias}" 已是最新版本 {version}。',
            updated: '插件 "{alias}" 更新成功：{oldVersion} -> {newVersion}',
            migrated: '插件 "{alias}" 已迁移到 GitHub Release 来源，版本 {version}。',
            failed: '更新插件 "{alias}" 失败：{reason}',
            allTitle: '批量更新所有插件',
            allSummary: '总数 {total}，更新 {updated}，最新 {latest}，失败 {failed}'
        },
        selfUpdate: {
            start: '正在更新 SlothTool...',
            success: 'SlothTool 更新完成。',
            failed: '更新 SlothTool 失败：{reason}'
        },
        uninstallAll: {
            title: '完全卸载 SlothTool',
            warning: '此操作会删除 ~/.slothtool 下的全部数据。',
            noData: '未发现 SlothTool 数据目录：{dir}',
            alreadyClean: '当前环境已经是干净状态。',
            previewDir: '数据目录：{dir}',
            previewPlugins: '已安装插件：{count} 个',
            success: 'SlothTool 数据已完全删除。',
            failed: '删除失败：{reason}',
            nextStep: '如需卸载全局命令，请执行：npm uninstall -g @holic512/slothtool'
        },
        list: {
            installed: '已安装的插件：',
            empty: '未安装任何插件。',
            installExample: '安装官方插件示例：slothtool install <plugin-alias>',
            package: '包名',
            version: '版本',
            source: '来源',
            installedAt: '安装时间'
        },
        sources: {
            githubRelease: 'GitHub Release',
            npmRegistry: 'npm registry（遗留）',
            officialGithub: '官方 GitHub',
            ghProxy: 'gh-proxy.com',
            customProxy: '自定义代理'
        },
        run: {
            pluginNotFound: '未找到插件 "{pluginAlias}"。',
            failed: '运行插件 "{pluginAlias}" 失败：{reason}'
        },
        tui: {
            testModeExit: 'TUI 测试模式：已自动退出。',
            tabs: {
                home: '首页',
                run: '运行',
                install: '安装',
                update: '更新',
                settings: '设置'
            },
            home: {
                eyebrow: '默认 TUI',
                prompt: '按 Tab 切换页面，Enter 执行当前操作。'
            },
            install: {
                empty: '没有待安装的官方插件。',
                action: 'Enter 安装当前插件'
            },
            plugins: {
                empty: '没有已安装插件。',
                action: 'u 卸载  p 更新  a 更新全部'
            },
            run: {
                empty: '没有可运行的插件。',
                action: 'Enter 退出根 TUI 并启动插件'
            },
            update: {
                empty: '没有可更新的插件。',
                action: 'Enter 执行当前更新操作'
            },
            settings: {
                action: 'Enter 应用当前设置',
                empty: '没有可配置项。',
                currentLanguage: '当前语言',
                switchToChinese: '切换到中文',
                switchToEnglish: '切换到英文',
                proxyToggle: '代理开关',
                proxyEnabled: '启用代理',
                proxyDisabled: '关闭代理',
                proxyPortPreset: '代理端口预设',
                proxyPortDetail: '当前 {host}:{port}',
                githubSource: 'GitHub 源',
                githubOfficial: '官方 GitHub',
                githubProxy: 'gh-proxy.com',
                uninstallAll: '完全卸载 SlothTool',
                uninstallAllDetail: '仅删除 ~/.slothtool 数据',
                uninstallPluginDetail: '删除插件目录、配置与注册表'
            },
            footer: {
                help: 'Tab 切页  Enter 执行  Esc 返回  ? 帮助  q 退出'
            },
            status: {
                ready: '就绪',
                confirm: '确认执行 "{label}"？按 y 确认，其他键取消。'
            },
            help: {
                title: '快捷键',
                lines: [
                    'Tab: 切换页面',
                    '↑/↓: 移动选择',
                    'Enter: 执行当前操作',
                    'Esc: 关闭确认/帮助',
                    'q: 退出 TUI',
                    '?: 打开帮助'
                ]
            },
            actions: {
                updateAll: '更新全部插件',
                selfUpdate: '更新 SlothTool',
                uninstallAll: '完全卸载 SlothTool',
                uninstallPlugin: '卸载插件 {alias}',
                updatePlugin: '更新插件 {alias}'
            },
            noDescription: '暂无附加说明。'
        }
    },
    en: {
        pluginManager: 'SlothTool - Plugin Manager',
        usage: 'Usage:',
        examples: 'Examples:',
        commands: {
            install: 'Install an official plugin',
            uninstall: 'Uninstall an installed plugin',
            update: 'Update a single plugin',
            updateAll: 'Update all plugins',
            list: 'List installed plugins',
            run: 'Run a plugin',
            runShorthand: 'Run a plugin (shorthand)',
            config: 'Configure language and network settings',
            interactive: 'Launch the full-screen TUI',
            uninstallAll: 'Remove all SlothTool data',
            selfUpdate: 'Update SlothTool itself'
        },
        cli: {
            defaultTui: 'The default no-arg entry launches the full-screen TUI.',
            tuiRequiresTerminal: 'The current terminal is not an interactive TTY, so the TUI cannot be launched. Use explicit CLI subcommands instead.',
            installUsage: 'Usage: slothtool install <plugin-alias>',
            uninstallUsage: 'Usage: slothtool uninstall <plugin-alias>',
            updateUsage: 'Usage: slothtool update <plugin-alias>',
            runUsage: 'Usage: slothtool run <plugin-alias> [args...]',
            configUsage: 'Usage: slothtool config <language|proxy ...>',
            configHelpLines: [
                'slothtool config language <zh|en>',
                'slothtool config proxy show',
                'slothtool config proxy enabled <on|off>',
                'slothtool config proxy host <host>',
                'slothtool config proxy port <port>',
                'slothtool config proxy github <official|gh-proxy|custom>',
                'slothtool config proxy github-url <https://...>'
            ],
            specifyPlugin: 'Error: please specify a plugin alias.',
            specifyPluginToUpdate: 'Error: please specify the plugin to update.',
            specifyPluginToRun: 'Error: please specify the plugin to run.',
            languageSet: 'Language set to: {language}',
            invalidLanguage: 'Invalid language. Use "zh" or "en".',
            confirmPrompt: 'Type "yes" to confirm: ',
            operationCancelled: 'Operation cancelled.'
        },
        config: {
            summaryLanguage: 'Current language: {language}',
            summaryProxy: 'Proxy: {status} ({protocol}://{host}:{port})',
            summaryGithub: 'GitHub source: {label}{suffix}',
            customUrlSuffix: ' ({url})',
            statuses: {
                on: 'enabled',
                off: 'disabled'
            },
            githubPresets: {
                official: 'Official GitHub',
                ghProxy: 'gh-proxy.com',
                custom: 'Custom'
            },
            proxyEnabledSet: 'Proxy {status}.',
            proxyHostSet: 'Proxy host set to: {host}',
            proxyPortSet: 'Proxy port set to: {port}',
            githubPresetSet: 'GitHub source set to: {label}',
            githubUrlSet: 'GitHub custom proxy URL set to: {url}',
            customUrlRequired: 'Set a custom URL first with "slothtool config proxy github-url <https://...>".',
            invalidOnOff: 'Invalid toggle. Use "on" or "off".',
            invalidPort: 'Invalid port. Use an integer between 1 and 65535.',
            invalidGithubPreset: 'Invalid GitHub source. Use "official", "gh-proxy", or "custom".',
            invalidGithubUrl: 'Invalid GitHub custom proxy URL. Provide an http(s) URL.'
        },
        install: {
            start: 'Installing plugin: {alias}',
            alreadyInstalled: 'Plugin "{alias}" is already installed.',
            uninstallFirst: 'Run "slothtool uninstall {alias}" before reinstalling.',
            checkingUpdates: 'Checking the latest release...',
            installingTo: 'Install directory: {dir}',
            downloadingAsset: 'Downloading release asset: {assetName}',
            installingDependencies: 'Installing runtime dependencies...',
            success: 'Plugin "{alias}" installed successfully.',
            runHint: 'Run: slothtool {alias} --help',
            failed: 'Failed to install plugin "{packageName}": {reason}',
            officialOnly: '"{alias}" is not an official plugin alias. Available plugins: {aliases}'
        },
        uninstall: {
            start: 'Uninstalling plugin: {alias}',
            notInstalled: 'Plugin "{alias}" is not installed.',
            willRemove: 'Removing the plugin directory, config file, and registry entry.',
            success: 'Plugin "{alias}" uninstalled successfully.',
            failed: 'Failed to uninstall plugin "{alias}": {reason}'
        },
        update: {
            start: 'Updating plugin: {alias}',
            currentVersion: 'Current version: {version}',
            checking: 'Checking for updates...',
            latest: 'Plugin "{alias}" is already at the latest version {version}.',
            updated: 'Plugin "{alias}" updated successfully: {oldVersion} -> {newVersion}',
            migrated: 'Plugin "{alias}" migrated to the GitHub Release source at version {version}.',
            failed: 'Failed to update plugin "{alias}": {reason}',
            allTitle: 'Updating all plugins',
            allSummary: 'Total {total}, updated {updated}, latest {latest}, failed {failed}'
        },
        selfUpdate: {
            start: 'Updating SlothTool...',
            success: 'SlothTool updated successfully.',
            failed: 'Failed to update SlothTool: {reason}'
        },
        uninstallAll: {
            title: 'Complete SlothTool removal',
            warning: 'This removes all data under ~/.slothtool.',
            noData: 'No SlothTool data directory found at: {dir}',
            alreadyClean: 'The environment is already clean.',
            previewDir: 'Data directory: {dir}',
            previewPlugins: 'Installed plugins: {count}',
            success: 'SlothTool data removed successfully.',
            failed: 'Removal failed: {reason}',
            nextStep: 'To remove the global command, run: npm uninstall -g @holic512/slothtool'
        },
        list: {
            installed: 'Installed plugins:',
            empty: 'No plugins installed.',
            installExample: 'Install an official plugin with: slothtool install <plugin-alias>',
            package: 'Package',
            version: 'Version',
            source: 'Source',
            installedAt: 'Installed'
        },
        sources: {
            githubRelease: 'GitHub Release',
            npmRegistry: 'npm registry (legacy)',
            officialGithub: 'Official GitHub',
            ghProxy: 'gh-proxy.com',
            customProxy: 'Custom proxy'
        },
        run: {
            pluginNotFound: 'Plugin "{pluginAlias}" was not found.',
            failed: 'Failed to run plugin "{pluginAlias}": {reason}'
        },
        tui: {
            testModeExit: 'TUI test mode exited automatically.',
            tabs: {
                home: 'Home',
                run: 'Run',
                install: 'Install',
                update: 'Update',
                settings: 'Settings'
            },
            home: {
                eyebrow: 'DEFAULT TUI',
                prompt: 'Use Tab to switch pages and Enter to run the focused action.'
            },
            install: {
                empty: 'No official plugins are waiting to be installed.',
                action: 'Press Enter to install the selected plugin'
            },
            plugins: {
                empty: 'No installed plugins.',
                action: 'u uninstall  p update  a update all'
            },
            run: {
                empty: 'No runnable plugins.',
                action: 'Enter exits the root TUI and starts the plugin'
            },
            update: {
                empty: 'Nothing is available to update.',
                action: 'Press Enter to run the selected update action'
            },
            settings: {
                action: 'Press Enter to apply the selected setting',
                empty: 'No settings are available.',
                currentLanguage: 'Current language',
                switchToChinese: 'Switch to Chinese',
                switchToEnglish: 'Switch to English',
                proxyToggle: 'Proxy toggle',
                proxyEnabled: 'Enable proxy',
                proxyDisabled: 'Disable proxy',
                proxyPortPreset: 'Proxy port preset',
                proxyPortDetail: 'Current {host}:{port}',
                githubSource: 'GitHub source',
                githubOfficial: 'Official GitHub',
                githubProxy: 'gh-proxy.com',
                uninstallAll: 'Remove all SlothTool data',
                uninstallAllDetail: 'Delete only ~/.slothtool data',
                uninstallPluginDetail: 'Delete plugin files, config, and registry entry'
            },
            footer: {
                help: 'Tab page  Enter action  Esc back  ? help  q quit'
            },
            status: {
                ready: 'Ready',
                confirm: 'Confirm "{label}"? Press y to continue, any other key to cancel.'
            },
            help: {
                title: 'Keymap',
                lines: [
                    'Tab: switch page',
                    'Up/Down: move selection',
                    'Enter: run current action',
                    'Esc: close confirm/help',
                    'q: quit the TUI',
                    '?: open help'
                ]
            },
            actions: {
                updateAll: 'Update all plugins',
                selfUpdate: 'Update SlothTool',
                uninstallAll: 'Remove all SlothTool data',
                uninstallPlugin: 'Uninstall plugin {alias}',
                updatePlugin: 'Update plugin {alias}'
            },
            noDescription: 'No additional description.'
        }
    }
};

export function t(key, params = {}) {
    const lang = settings.getLanguage();
    const langMessages = messages[lang] || messages.zh;
    const keys = key.split('.');
    let message = langMessages;

    for (const currentKey of keys) {
        message = message?.[currentKey];
        if (message === undefined) {
            return key;
        }
    }

    if (typeof message === 'string') {
        return message.replace(/\{(\w+)\}/gu, (match, param) => {
            return params[param] !== undefined ? String(params[param]) : match;
        });
    }

    return message;
}

export default {
    messages,
    t
};
