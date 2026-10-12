/**
 * @file SlothVaultI18n
 * @project SlothTool
 * @module SlothVault manager / Internationalization
 * @description Provides bilingual deployment, Skill and local cleanup copy with safe error formatting.
 * @logic Read the shared language setting, resolve manager messages and redact credentials from visible errors.
 * @dependencies Node fs/os/path, SlothTool settings.json
 * @index_tags slothvault,i18n,deploy,skill,cleanup
 * @author holic512
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
        yes: '是',
        no: '否',
        skillVersion: {
            current: '当前 Skill：{version}',
            checked: '官方最新 Skill：{version}',
            unavailable: '未能检查官方版本。',
            local: '已修复当前 Skill 生效内容的本地链接（离线）。',
            hint: 'c 检查 · n 更新 · i 安装 · u 卸载',
            checking: '正在检查或更新 Skill…',
            failed: 'Skill 更新未完成：{message}',
            updated: 'Skill 已同步，当前版本 {version}'
        },
        manager: {
            title: 'SlothVault 部署与 Skill',
            tabs: { overview: '概览', deploy: '部署', skill: '技能' },
            deployedAppVersion: '实际运行应用版本',
            latestPackageVersion: '最新包版本',
            refreshed: '本地状态已刷新。',
            fields: {
                root: '部署目录',
                nginxMode: 'Nginx',
                hostNginx: '宿主机 Nginx',
                container: '容器',
                containers: '运行容器',
                provider: '数据库',
                port: 'HTTP 端口',
                image: '应用镜像',
                root: '部署目录',
                version: '包版本',
                certificate: '证书文件',
                dataDir: '应用数据',
                databaseDir: '数据库数据',
                network: '端口绑定',
                status: '状态'
            },
            instanceStates: { loading: '读取中', absent: '未部署', managed: '已受管', unmanaged: '非受管', unreadable: '无法读取', unknown: '未知' },
            readError: '{scope} 状态无法读取（{code}）',
            noReleaseNotes: '该版本未提供提交日志。',
            previewFields: {
                provider: '数据库',
                composePath: 'Compose 文件',
                dataDir: '应用数据',
                databaseDir: '数据库数据',
                port: '端口',
                image: '应用镜像',
                root: '部署目录',
                nginx: 'Nginx 站点',
                site: '站点',
                upstream: '代理目标',
                loopback: '仅本机绑定',
                domains: '证书域名',
                dns: 'DNS 解析',
                currentVersion: '当前应用版本',
                targetVersion: '目标应用版本'
            },
            updateState: '更新状态：{state}',
            checkFirst: '请先执行“检查更新”，确认最新目标版本。',
            actions: {
                install: '安装新实例',
                status: '查看状态',
                'check-update': '检查应用更新',
                update: '更新应用',
                start: '启动实例',
                stop: '停止实例',
                'nginx-menu': 'Nginx 管理',
                'nginx-select': '选择已发现站点',
                'nginx-discover': '发现本机 / Docker 站点',
                'nginx-status': '查看 Nginx 状态',
                'nginx-update': '更新站点传输配置',
                nginx: '基础反向代理配置',
                https: '配置 HTTPS',
                renew: '证书状态/续约'
            },
            nginxSelectHint: '先发现站点，再输入代理站点的编号。',
            nginxFields: {state: 'Nginx 状态', loaded: '已加载', running: '运行中', syntax: '配置检查'},
            nginxModes: { auto: '自动发现本机 / Docker', system: '系统级', docker: 'Docker 容器' },
            resize: '终端过小，请至少使用 30 列、18 行。',
            states: {
                unavailable: '不可用',
                'not-detected': '未检测到',
                'not-installed': '未安装',
                outdated: '旧受管链接',
                installed: '已安装',
                conflict: '存在冲突',
                replaced: '已替换',
                'already-installed': '已安装'
            }
        },
        workspace: {
            actionsTitle: '操作',
            cleanupConfirmation: '清理旧数据需要确认；非交互调用请使用 --yes。',
            ready: '就绪。各页面独立管理自己的包。',
            completed: '✓ 操作完成。',
            failed: '! 操作未完成，右侧可查看原因。',
            footer: '↑↓ 选择 | Enter 执行 | v 详情 | r 刷新 | Tab 切页 | q 退出',
            footerDetails: '↑↓/PgUp/PgDn 滚动 | v/Esc 返回操作 | q 退出',
            footerBusy: '正在执行 | v 查看进度 | d 说明 | Ctrl+C 强制退出',
            footerInput: '输入/粘贴 | ←→ 移光标 | Enter 提交 | Esc 取消',
            footerConfirm: 'y 确认 | n/Esc 取消',
            instanceUnchecked: '尚未读取实例状态；选择“查看状态”检查。',
            deployBlocked: '部署操作不可用：{reason}。请安装或修复部署脚本包。',
            pythonUnavailable: '需要 Python 3.10 或更高版本。',
            cleanupWarning: '清理旧包与暂存残留，以及旧 MCP Client 配置、历史和受管命令。保留有效部署与 Skill，以及智能体的原生 MCP 配置。',
            cleanupHint: '按 Enter 生成清理预览，确认后才执行。',
            cleanupPreview: '待清理 {count} 项，可释放 {bytes}',
            cleanupResult: '已清理 {count} 项；失败 {failed} 项。',
            migration: '迁移链接：{path} → {source}',
            kept: '保留：{path}',
            skipped: '跳过：{path}（{reason}）',
            confirm: '执行“{action}”？y 确认，n/Esc 取消。',
            checkedAt: '检查时间',
            releaseNotes: 'Release 变更说明',
            task: '操作状态：{state}',
            elapsed: '耗时：{seconds} 秒',
            phase: '当前阶段：{phase}',
            steps: '步骤：{current}/{total}',
            items: '项',
            preview: '操作预览',
            modules: { skill: 'Skill 包', deployment: '部署脚本包' },
            input: { root: '部署目录', container: 'Nginx 容器', site: '输入已发现代理站点的编号' },
            taskStates: { running: '执行中', completed: '完成', failed: '失败', cancelled: '已取消' },
            states: {
                installed: '已安装',
                missing: '未安装',
                invalid: '损坏或不兼容',
                unchecked: '未检查',
                latest: '已是最新',
                outdated: '可安装或更新',
                updated: '已更新',
                error: '失败',
                conflict: '自定义内容冲突',
                unavailable: '不可用',
                'not-installed': '未安装',
                'not-detected': '未检测到'
            },
            actions: {
                summary: '组件总览',
                status: '查看实例状态',
                root: '修改部署目录',
                cleanup: '清理旧数据',
                'package-status': '查看包状态',
                'package-install': '安装或修复包',
                'package-check': '检查包更新',
                'package-update': '更新包',
                'skill-uninstall': '卸载 Skill 与链接'
            },
            phases: {
                release: '查询正式 Release',
                download: '下载',
                validation: '校验摘要和文件',
                extract: '解压',
                activate: '激活包',
                links: '检查受管链接',
                cleanup: '清理文件',
                done: '完成',
                failed: '失败'
            }
        },
        workflow: {
            interfaceVersion: '界面 {version}', packageManager: '管理部署脚本包', back: '返回应用操作',
            previewTitle: '确认本次更新目标', status: '当前操作', logs: '实时进度与日志', details: '版本与部署信息', notes: '完整更新说明',
            notesSummary: '更新目标 {version}，跨越 {count} 个版本；d 展开说明',
            footer: '↑↓ 选择 | Enter 执行 | v 日志 | d 说明 | r 刷新 | Tab 切页 | q 退出',
            footerDetails: '↑↓/PgUp/PgDn 滚动 | f/End 跟随最新 | d 说明 | v/Esc 返回',
            legacyConfirm: '输入 y 后 Enter 确认；Esc 取消', confirm: 'y 确认更新 | n/Esc 取消',
            execution: '执行耗时：{seconds} 秒', waiting: '等待输入：{seconds} 秒',
            versions: '实际版本：{current} → 目标：{target}', before: '更新前版本：{version}',
            runtimeImage: '实际运行镜像', configuredImage: '配置中的镜像', latest: '官方最新应用版本',
            inactive: '{seconds} 秒没有新业务进度；{activity}', alive: '后台进程仍在运行', unknownActivity: '等待后端活动信息',
            layer: '镜像层 {subject}', noHealth: '未配置应用健康检查',
            states: {checking: '检查中', waiting: '等待确认或输入', running: '执行中', verifying: '核验运行版本',
                completed: '完成', unchanged: '已是最新／无变更', cancelled: '已取消', failed: '失败', partial: '部分完成／待核验'},
            result: {completed: '✓ 操作完成。', unchanged: '✓ 已是最新／没有变更。', cancelled: '已取消操作。',
                failed: '! 操作失败，详情中可查看原因。', partial: '! 操作未完全核验，请查看实际状态。'},
            unverified: '实际运行版本未通过核验；请刷新应用状态并检查容器。',
            restart: '将重建并重启受管应用，持久化数据保留。',
            updateStates: {APPLICATION_UPDATE_AVAILABLE: '可更新', UP_TO_DATE: '已是最新', CHECK_FAILED: '查询失败',
                CUSTOM_IMAGE: '自定义镜像', UNVERIFIABLE: '版本无法确认', LOCAL_NEWER: '本地版本较新'},
            phases: {pull: '拉取目标应用镜像', recreate: '重建应用容器', verify: '核验实际版本与健康状态',
                'docker compose check': '检查 Docker Compose', 'docker compose config': '校验 Compose 配置',
                'docker compose pull': '拉取镜像', 'docker compose up': '启动应用', 'docker compose ps': '读取容器状态'}
        },
        errors: {
            DEPLOY_PACKAGE_INCOMPATIBLE: '已安装的部署脚本包不支持此命令或参数；请先运行 slothtool slothvault deploy package update 更新脚本包。',
            DEPLOY_CAPABILITIES_UNAVAILABLE: '无法确认部署脚本包支持的命令与参数，请检查或修复脚本包后重试。',
            RELEASE_SOURCE_NOT_FOUND: '未找到官方正式 Release，请稍后重试或检查发行来源。',
            RELEASE_RATE_LIMITED: '官方版本查询受限，请稍后重试；实际运行版本未改变。',
            RELEASE_REQUEST_TIMEOUT: '官方版本查询超时，请检查网络后重试；实际运行版本未改变。',
            RELEASE_CHECK_FAILED: '无法查询官方版本，请重试并检查网络。',
            SKILL_CUSTOM_TARGET_PRESERVED: '保留了自定义 Skill 内容；该目标尚未使用新版本。',
            SKILL_SOURCE_INVALID: 'SlothVault Skill 生效内容缺失或无效。',
            SKILL_AGENT_NOT_DETECTED: '未检测到本机 Codex 或 Claude Code，未执行 Skill 安装。',
            SKILL_TARGET_INVALID: 'SlothVault Skill 安装目标无效。',
            SKILL_INSTALL_CONFIRMATION_REQUIRED: 'Skill 安装目标存在冲突，覆盖前必须明确确认。',
            SKILL_CONFIRMATION_DECLINED: 'Skill 冲突覆盖未获确认。',
            SKILL_UNINSTALL_CONFLICT: '目标不是当前插件管理的 Skill 链接，拒绝删除。',
            SKILL_LINK_INVALID: 'Skill 目录链接创建后无法验证。',
            SKILL_FILESYSTEM_ERROR: 'Skill 文件操作失败。'
        },
        nativeMcpGuidance: '独立 MCP Client 已移除。请在 Codex 等智能体的原生 MCP 配置中填写 SlothVault 的 /mcp 地址和访问密钥。'
    },
    en: {
        yes: 'Yes',
        no: 'No',
        skillVersion: {
            current: 'Current Skill: {version}',
            checked: 'Latest official Skill: {version}',
            unavailable: 'Unable to check the official version.',
            local: 'Repaired links to the current active Skill offline.',
            hint: 'c Check · n Update · i Install · u Uninstall',
            checking: 'Checking or updating the Skill…',
            failed: 'Skill update did not finish: {message}',
            updated: 'Skill synchronized, current version {version}'
        },
        manager: {
            title: 'SlothVault Deployment and Skill',
            tabs: { overview: 'Overview', deploy: 'Deploy', skill: 'Skill' },
            deployedAppVersion: 'Running application version',
            latestPackageVersion: 'Latest package',
            refreshed: 'Local state refreshed.',
            fields: {
                root: 'Deploy root',
                nginxMode: 'Nginx',
                hostNginx: 'Host Nginx',
                container: 'Container',
                containers: 'Running',
                provider: 'Database',
                port: 'HTTP port',
                image: 'App image',
                version: 'Package version',
                certificate: 'Certificate file',
                dataDir: 'App data',
                databaseDir: 'Database data',
                network: 'Port binding',
                status: 'Status'
            },
            instanceStates: {
                loading: 'Loading',
                absent: 'Not deployed',
                managed: 'Managed',
                unmanaged: 'Unmanaged',
                unreadable: 'Unreadable',
                unknown: 'Unknown'
            },
            readError: '{scope} status unavailable ({code})',
            noReleaseNotes: 'This release has no commit log.',
            previewFields: {
                provider: 'Database',
                composePath: 'Compose file',
                dataDir: 'App data',
                databaseDir: 'Database data',
                port: 'Port',
                image: 'App image',
                nginx: 'Nginx site',
                site: 'Site',
                upstream: 'Upstream',
                loopback: 'Loopback only',
                domains: 'Certificate domains',
                dns: 'DNS lookup',
                currentVersion: 'Current application version',
                targetVersion: 'Target application version'
            },
            updateState: 'Update status: {state}',
            checkFirst: 'Check updates first to identify the latest target release.',
            actions: {
                install: 'Install instance',
                status: 'View status',
                'check-update': 'Check app updates',
                update: 'Update application',
                start: 'Start instance',
                stop: 'Stop instance',
                'nginx-menu': 'Nginx management',
                'nginx-select': 'Select discovered site',
                'nginx-discover': 'Discover host / Docker sites',
                'nginx-status': 'View Nginx status',
                'nginx-update': 'Update site transfer settings',
                nginx: 'Configure basic reverse proxy',
                https: 'Configure HTTPS',
                renew: 'Certificate/renewal'
            },
            nginxSelectHint: 'Discover sites first, then enter the proxy site number.',
            nginxFields: {state: 'Nginx status', loaded: 'Loaded', running: 'Running', syntax: 'Configuration check'},
            nginxModes: { auto: 'Discover host / Docker', system: 'System', docker: 'Docker container' },
            resize: 'Terminal too small; use at least 30 columns and 18 rows.',
            states: {
                unavailable: 'unavailable',
                'not-detected': 'not detected',
                'not-installed': 'not installed',
                installed: 'installed',
                conflict: 'conflict',
                replaced: 'replaced',
                'already-installed': 'already installed'
            }
        },
        workspace: {
            actionsTitle: 'Actions',
            cleanupConfirmation: 'Cleaning legacy data requires confirmation; use --yes outside an interactive terminal.',
            ready: 'Ready. Each page manages its own package.',
            completed: '✓ Operation completed.',
            failed: '! Operation did not complete; see the details.',
            footer: '↑↓ select | Enter run | v details | r refresh | Tab page | q quit',
            footerDetails: '↑↓/PgUp/PgDn scroll | v/Esc actions | q quit',
            footerBusy: 'Running | v progress | d Notes | Ctrl+C force exit',
            footerInput: 'Type/paste | ←→ cursor | Enter submit | Esc cancel',
            footerConfirm: 'y confirm | n/Esc cancel',
            instanceUnchecked: 'Instance state is unchecked; choose View status to inspect.',
            deployBlocked: 'Deployment unavailable: {reason}. Install or repair the deployment package.',
            pythonUnavailable: 'Python 3.10 or newer is required.',
            cleanupWarning: 'Remove obsolete packages, temporary residue and legacy MCP Client profiles, history and managed commands. Keep active Deployment and Skill packages and native agent MCP configuration.',
            cleanupHint: 'Press Enter to preview; execution requires confirmation.',
            cleanupPreview: '{count} items to remove, {bytes} reclaimable',
            cleanupResult: 'Removed {count} items; {failed} failed.',
            migration: 'Migrate link: {path} → {source}',
            kept: 'Kept: {path}',
            skipped: 'Skipped: {path} ({reason})',
            confirm: 'Run “{action}”? y confirms, n/Esc cancels.',
            checkedAt: 'Checked at',
            releaseNotes: 'Release notes',
            task: 'Operation: {state}',
            elapsed: 'Elapsed: {seconds} seconds',
            phase: 'Current phase: {phase}',
            steps: 'Step: {current}/{total}',
            items: 'items',
            preview: 'Operation preview',
            modules: { skill: 'Skill package', deployment: 'Deployment package' },
            input: { root: 'Deployment root', container: 'Nginx container', site: 'Enter the discovered proxy site number' },
            taskStates: { running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' },
            states: {
                installed: 'Installed',
                missing: 'Not installed',
                invalid: 'Invalid or incompatible',
                unchecked: 'Unchecked',
                latest: 'Latest',
                outdated: 'Install/update available',
                updated: 'Updated',
                error: 'Failed',
                conflict: 'Custom content conflict',
                unavailable: 'Unavailable',
                'not-installed': 'Not installed',
                'not-detected': 'Not detected'
            },
            actions: {
                summary: 'Component overview',
                status: 'View instance status',
                root: 'Change deployment root',
                cleanup: 'Clean old data',
                'package-status': 'Package status',
                'package-install': 'Install or repair package',
                'package-check': 'Check package updates',
                'package-update': 'Update package',
                'skill-uninstall': 'Uninstall Skill and links'
            },
            phases: {
                release: 'Resolve official Release',
                download: 'Download',
                validation: 'Validate hashes and files',
                extract: 'Extract',
                activate: 'Activate package',
                links: 'Check managed links',
                cleanup: 'Remove files',
                done: 'Completed',
                failed: 'Failed'
            }
        },
        workflow: {
            interfaceVersion: 'UI {version}', packageManager: 'Manage deployment package', back: 'Back to application',
            previewTitle: 'Review this update target', status: 'Current operation', logs: 'Live progress and logs', details: 'Versions and deployment', notes: 'Full release notes',
            notesSummary: 'Target {version}, across {count} releases; d to expand notes',
            footer: '↑↓ Select | Enter Run | v Logs | d Notes | r Refresh | Tab Pages | q Quit',
            footerDetails: '↑↓/PgUp/PgDn Scroll | f/End Follow latest | d Notes | v/Esc Back',
            legacyConfirm: 'Type y then Enter to confirm; Esc cancels', confirm: 'y Confirm update | n/Esc Cancel',
            execution: 'Execution: {seconds}s', waiting: 'Waiting for input: {seconds}s',
            versions: 'Running: {current} → Target: {target}', before: 'Before update: {version}',
            runtimeImage: 'Running image', configuredImage: 'Configured image', latest: 'Latest official application',
            inactive: 'No new progress for {seconds}s; {activity}', alive: 'background process is still running', unknownActivity: 'waiting for backend activity',
            layer: 'Image layer {subject}', noHealth: 'Application health check is not configured',
            states: {checking: 'Checking', waiting: 'Waiting for confirmation or input', running: 'Running', verifying: 'Verifying runtime version',
                completed: 'Completed', unchanged: 'Latest / unchanged', cancelled: 'Cancelled', failed: 'Failed', partial: 'Partial / unverified'},
            result: {completed: '✓ Operation completed.', unchanged: '✓ Latest / unchanged.', cancelled: 'Operation cancelled.',
                failed: '! Operation failed; see details.', partial: '! Operation was not fully verified; check actual state.'},
            unverified: 'Running version could not be verified; refresh application state and inspect the container.',
            restart: 'The managed application will be recreated and restarted; persistent data is retained.',
            updateStates: {APPLICATION_UPDATE_AVAILABLE: 'Update available', UP_TO_DATE: 'Latest', CHECK_FAILED: 'Check failed',
                CUSTOM_IMAGE: 'Custom image', UNVERIFIABLE: 'Version unverifiable', LOCAL_NEWER: 'Local version is newer'},
            phases: {pull: 'Pull target application image', recreate: 'Recreate application container', verify: 'Verify runtime version and health',
                'docker compose check': 'Check Docker Compose', 'docker compose config': 'Validate Compose configuration',
                'docker compose pull': 'Pull images', 'docker compose up': 'Start application', 'docker compose ps': 'Inspect containers'}
        },
        errors: {
            DEPLOY_PACKAGE_INCOMPATIBLE: 'The installed deployment package does not support this command or option. Run slothtool slothvault deploy package update first.',
            DEPLOY_CAPABILITIES_UNAVAILABLE: 'Unable to verify the deployment package commands and options. Inspect or repair its package before retrying.',
            SKILL_SOURCE_INVALID: 'The active SlothVault Skill is missing or invalid.',
            SKILL_AGENT_NOT_DETECTED: 'No local Codex or Claude Code installation was detected; the Skill was not installed.',
            SKILL_TARGET_INVALID: 'The SlothVault Skill install target is invalid.',
            SKILL_INSTALL_CONFIRMATION_REQUIRED: 'The Skill target conflicts and requires explicit confirmation before replacement.',
            SKILL_CONFIRMATION_DECLINED: 'Skill conflict replacement was not confirmed.',
            SKILL_UNINSTALL_CONFLICT: 'The target is not a Skill link managed by this plugin and will not be removed.',
            SKILL_LINK_INVALID: 'The Skill directory link could not be verified after creation.',
            SKILL_FILESYSTEM_ERROR: 'The Skill filesystem operation failed.'
        },
        nativeMcpGuidance: 'The standalone MCP Client has been removed. Configure the SlothVault /mcp URL and access key in your agent’s native MCP settings.'
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

/** Format local service errors without exposing credentials in bridge output. */
export function formatSlothVaultError(error) {
    const key = error?.code ? `errors.${error.code}` : '';
    const translated = key ? t(key) : '';
    const message = translated && translated !== key ? translated : error?.message || String(error);
    return String(message)
        .replace(/svmcp_[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}/gu, '[redacted]')
        .replace(/Bearer\s+[^\s"']+/giu, 'Bearer [redacted]')
        .replace(/((?:password|token|secret|api[_-]?key|encryption_key)\s*[:=]\s*)[^\s,;]+/giu, '$1[redacted]')
        .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/giu, '$1[redacted]@');
}
