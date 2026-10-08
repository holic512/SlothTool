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
            deployedAppVersion: '已部署应用版本',
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
                version: '运行版本',
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
                nginx: '配置 Nginx',
                https: '配置 HTTPS',
                renew: '证书状态/续约'
            },
            nginxModes: { auto: '自动检测系统级', system: '系统级', docker: 'Docker 官方容器' },
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
            footerBusy: '正在执行 | v 查看进度 | Ctrl+C 强制退出',
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
            input: { root: '部署目录', container: 'Nginx 容器' },
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
        errors: {
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
            deployedAppVersion: 'Deployed app',
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
                version: 'Running version',
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
                nginx: 'Configure Nginx',
                https: 'Configure HTTPS',
                renew: 'Certificate/renewal'
            },
            nginxModes: { auto: 'Auto-detect system', system: 'System', docker: 'Official Docker container' },
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
            footerBusy: 'Running | v progress | Ctrl+C force exit',
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
            input: { root: 'Deployment root', container: 'Nginx container' },
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
        errors: {
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
        .replace(/Bearer\s+[^\s"']+/giu, 'Bearer [redacted]');
}
