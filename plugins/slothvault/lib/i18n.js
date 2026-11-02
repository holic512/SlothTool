/**
 * @file SlothVaultI18n
 * @project SlothTool
 * @module SlothVault manager / Internationalization
 * @description Provides bilingual Skill and local cleanup copy with safe error formatting.
 * @logic Read the shared language setting, resolve manager messages and redact credentials from visible errors.
 * @dependencies Node fs/os/path, SlothTool settings.json
 * @index_tags slothvault,i18n,skill,cleanup
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
    "zh": {
        "yes": "是",
        "no": "否",
        "skillVersion": {
            "current": "当前 Skill：{version}",
            "checked": "官方最新 Skill：{version}",
            "unavailable": "未能检查官方版本。",
            "local": "已修复当前 Skill 生效内容的本地链接（离线）。",
            "hint": "c 检查 · n 更新 · i 安装 · u 卸载",
            "checking": "正在检查或更新 Skill…",
            "failed": "Skill 更新未完成：{message}",
            "updated": "Skill 已同步，当前版本 {version}"
        },
        "manager": {
            "title": "SlothVault Skill 管理",
            "tabs": {
                "skill": "技能"
            },
            "latestPackageVersion": "最新包版本",
            "refreshed": "本地状态已刷新。",
            "fields": {
                "version": "包版本",
                "status": "状态"
            },
            "resize": "终端过小，请至少使用 30 列、18 行。",
            "states": {
                "unavailable": "不可用",
                "not-detected": "未检测到",
                "not-installed": "未安装",
                "outdated": "旧受管链接",
                "installed": "已安装",
                "conflict": "存在冲突",
                "replaced": "已替换",
                "already-installed": "已安装"
            }
        },
        "workspace": {
            "actionsTitle": "操作",
            "cleanupConfirmation": "清理旧数据需要确认；非交互调用请使用 --yes。",
            "ready": "就绪。管理 SlothVault Skill 与本地链接。",
            "completed": "✓ 操作完成。",
            "failed": "! 操作未完成，右侧可查看原因。",
            "footer": "↑↓ 选择 | Enter 执行 | v 详情 | d 说明 | r 刷新 | q 退出",
            "footerDetails": "↑↓/PgUp/PgDn 滚动 | v/Esc 返回操作 | q 退出",
            "footerBusy": "正在执行 | v 查看进度 | d 说明 | Ctrl+C 强制退出",
            "footerConfirm": "y 确认 | n/Esc 取消",
            "cleanupWarning": "清理经验证的旧部署脚本包、旧 MCP Client 数据和暂存残留；保留 Skill、自定义来源、原生 MCP 配置与已部署应用。",
            "cleanupHint": "按 Enter 生成清理预览，确认后才执行。",
            "cleanupPreview": "待清理 {count} 项，可释放 {bytes}",
            "cleanupResult": "已清理 {count} 项；失败 {failed} 项。",
            "migration": "迁移链接：{path} → {source}",
            "kept": "保留：{path}",
            "skipped": "跳过：{path}（{reason}）",
            "confirm": "执行“{action}”？y 确认，n/Esc 取消。",
            "checkedAt": "检查时间",
            "releaseNotes": "Release 变更说明",
            "task": "操作状态：{state}",
            "elapsed": "耗时：{seconds} 秒",
            "phase": "当前阶段：{phase}",
            "steps": "步骤：{current}/{total}",
            "items": "项",
            "modules": {
                "skill": "Skill 包"
            },
            "taskStates": {
                "running": "执行中",
                "completed": "完成",
                "failed": "失败",
                "cancelled": "已取消"
            },
            "states": {
                "installed": "已安装",
                "missing": "未安装",
                "invalid": "损坏或不兼容",
                "unchecked": "未检查",
                "latest": "已是最新",
                "outdated": "可安装或更新",
                "updated": "已更新",
                "error": "失败",
                "conflict": "自定义内容冲突",
                "unavailable": "不可用",
                "not-installed": "未安装",
                "not-detected": "未检测到"
            },
            "actions": {
                "package-status": "查看包状态",
                "package-install": "安装或修复包",
                "package-check": "检查包更新",
                "package-update": "更新包",
                "skill-uninstall": "卸载 Skill 与链接",
                "skill-repair": "离线修复 Skill 链接"
            },
            "phases": {
                "release": "查询正式 Release",
                "download": "下载",
                "validation": "校验摘要和文件",
                "extract": "解压",
                "activate": "激活包",
                "links": "检查受管链接",
                "cleanup": "清理文件",
                "done": "完成",
                "failed": "失败"
            }
        },
        "workflow": {
            "interfaceVersion": "界面 {version}",
            "logs": "实时进度与日志",
            "notesSummary": "官方版本 {version}；d 展开说明",
            "footer": "↑↓ 选择 | Enter 执行 | v 详情 | d 说明 | r 刷新 | q 退出",
            "footerDetails": "↑↓/PgUp/PgDn 滚动 | f/End 跟随最新 | d 说明 | v/Esc 返回",
            "execution": "执行耗时：{seconds} 秒",
            "waiting": "等待输入：{seconds} 秒",
            "versions": "实际版本：{current} → 目标：{target}",
            "inactive": "{seconds} 秒没有新业务进度；{activity}",
            "alive": "后台进程仍在运行",
            "unknownActivity": "等待下一项进度",
            "layer": "下载文件 {subject}",
            "states": {
                "checking": "检查中",
                "waiting": "等待确认或输入",
                "running": "执行中",
                "verifying": "核验 Skill",
                "completed": "完成",
                "unchanged": "已是最新／无变更",
                "cancelled": "已取消",
                "failed": "失败",
                "partial": "部分完成／待核验"
            },
            "result": {
                "completed": "✓ 操作完成。",
                "unchanged": "✓ 已是最新／没有变更。",
                "cancelled": "已取消操作。",
                "failed": "! 操作失败，详情中可查看原因。",
                "partial": "! 操作未完全核验，请查看实际状态。"
            }
        },
        "errors": {
            "RELEASE_SOURCE_NOT_FOUND": "未找到官方正式 Release，请稍后重试或检查发行来源。",
            "RELEASE_RATE_LIMITED": "官方版本查询受限，请稍后重试；实际运行版本未改变。",
            "RELEASE_REQUEST_TIMEOUT": "官方版本查询超时，请检查网络后重试；实际运行版本未改变。",
            "RELEASE_CHECK_FAILED": "无法查询官方版本，请重试并检查网络。",
            "SKILL_CUSTOM_TARGET_PRESERVED": "保留了自定义 Skill 内容；该目标尚未使用新版本。",
            "SKILL_SOURCE_INVALID": "SlothVault Skill 生效内容缺失或无效。",
            "SKILL_AGENT_NOT_DETECTED": "未检测到本机 Codex 或 Claude Code，未执行 Skill 安装。",
            "SKILL_TARGET_INVALID": "SlothVault Skill 安装目标无效。",
            "SKILL_INSTALL_CONFIRMATION_REQUIRED": "Skill 安装目标存在冲突，覆盖前必须明确确认。",
            "SKILL_CONFIRMATION_DECLINED": "Skill 冲突覆盖未获确认。",
            "SKILL_UNINSTALL_CONFLICT": "目标不是当前插件管理的 Skill 链接，拒绝删除。",
            "SKILL_LINK_INVALID": "Skill 目录链接创建后无法验证。",
            "SKILL_FILESYSTEM_ERROR": "Skill 文件操作失败。"
        },
        "nativeMcpGuidance": "独立 MCP Client 已移除。请在 Codex 等智能体的原生 MCP 配置中填写 SlothVault 的 /mcp 地址和访问密钥。",
        "deploymentRemoved": "SlothTool 已移除部署支持。请下载 SlothVault 独立 Deployment Release，解压后运行 python3 menu.py，或直接运行 install.py / start.py / stop.py / restart.py / status.py / check_update.py / update.py。"
    },
    "en": {
        "yes": "Yes",
        "no": "No",
        "skillVersion": {
            "current": "Current Skill: {version}",
            "checked": "Latest official Skill: {version}",
            "unavailable": "Unable to check the official version.",
            "local": "Repaired links to the current active Skill offline.",
            "hint": "c Check · n Update · i Install · u Uninstall",
            "checking": "Checking or updating the Skill…",
            "failed": "Skill update did not finish: {message}",
            "updated": "Skill synchronized, current version {version}"
        },
        "manager": {
            "title": "SlothVault Skill manager",
            "tabs": {
                "skill": "Skill"
            },
            "latestPackageVersion": "Latest package",
            "refreshed": "Local state refreshed.",
            "fields": {
                "version": "Package version",
                "status": "Status"
            },
            "resize": "Terminal too small; use at least 30 columns and 18 rows.",
            "states": {
                "unavailable": "unavailable",
                "not-detected": "not detected",
                "not-installed": "not installed",
                "installed": "installed",
                "conflict": "conflict",
                "replaced": "replaced",
                "already-installed": "already installed"
            }
        },
        "workspace": {
            "actionsTitle": "Actions",
            "cleanupConfirmation": "Cleaning legacy data requires confirmation; use --yes outside an interactive terminal.",
            "ready": "Ready. Manage the SlothVault Skill and local links.",
            "completed": "✓ Operation completed.",
            "failed": "! Operation did not complete; see the details.",
            "footer": "↑↓ select | Enter run | v details | d notes | r refresh | q quit",
            "footerDetails": "↑↓/PgUp/PgDn scroll | v/Esc actions | q quit",
            "footerBusy": "Running | v progress | d Notes | Ctrl+C force exit",
            "footerConfirm": "y confirm | n/Esc cancel",
            "cleanupWarning": "Remove verified retired deployment scripts, legacy MCP Client data and temporary residue; preserve Skills, custom sources, native MCP settings and deployed applications.",
            "cleanupHint": "Press Enter to preview; execution requires confirmation.",
            "cleanupPreview": "{count} items to remove, {bytes} reclaimable",
            "cleanupResult": "Removed {count} items; {failed} failed.",
            "migration": "Migrate link: {path} → {source}",
            "kept": "Kept: {path}",
            "skipped": "Skipped: {path} ({reason})",
            "confirm": "Run “{action}”? y confirms, n/Esc cancels.",
            "checkedAt": "Checked at",
            "releaseNotes": "Release notes",
            "task": "Operation: {state}",
            "elapsed": "Elapsed: {seconds} seconds",
            "phase": "Current phase: {phase}",
            "steps": "Step: {current}/{total}",
            "items": "items",
            "modules": {
                "skill": "Skill package"
            },
            "taskStates": {
                "running": "Running",
                "completed": "Completed",
                "failed": "Failed",
                "cancelled": "Cancelled"
            },
            "states": {
                "installed": "Installed",
                "missing": "Not installed",
                "invalid": "Invalid or incompatible",
                "unchecked": "Unchecked",
                "latest": "Latest",
                "outdated": "Install/update available",
                "updated": "Updated",
                "error": "Failed",
                "conflict": "Custom content conflict",
                "unavailable": "Unavailable",
                "not-installed": "Not installed",
                "not-detected": "Not detected"
            },
            "actions": {
                "package-status": "Package status",
                "package-install": "Install or repair package",
                "package-check": "Check package updates",
                "package-update": "Update package",
                "skill-uninstall": "Uninstall Skill and links",
                "skill-repair": "Repair Skill links offline"
            },
            "phases": {
                "release": "Resolve official Release",
                "download": "Download",
                "validation": "Validate hashes and files",
                "extract": "Extract",
                "activate": "Activate package",
                "links": "Check managed links",
                "cleanup": "Remove files",
                "done": "Completed",
                "failed": "Failed"
            }
        },
        "workflow": {
            "interfaceVersion": "UI {version}",
            "logs": "Live progress and logs",
            "notesSummary": "Official version {version}; d expands notes",
            "footer": "↑↓ select | Enter run | v details | d notes | r refresh | q quit",
            "footerDetails": "↑↓/PgUp/PgDn Scroll | f/End Follow latest | d Notes | v/Esc Back",
            "execution": "Execution: {seconds}s",
            "waiting": "Waiting for input: {seconds}s",
            "versions": "Running: {current} → Target: {target}",
            "inactive": "No new progress for {seconds}s; {activity}",
            "alive": "background process is still running",
            "unknownActivity": "Waiting for progress",
            "layer": "Download {subject}",
            "states": {
                "checking": "Checking",
                "waiting": "Waiting for confirmation or input",
                "running": "Running",
                "verifying": "Verifying Skill",
                "completed": "Completed",
                "unchanged": "Latest / unchanged",
                "cancelled": "Cancelled",
                "failed": "Failed",
                "partial": "Partial / unverified"
            },
            "result": {
                "completed": "✓ Operation completed.",
                "unchanged": "✓ Latest / unchanged.",
                "cancelled": "Operation cancelled.",
                "failed": "! Operation failed; see details.",
                "partial": "! Operation was not fully verified; check actual state."
            }
        },
        "errors": {
            "SKILL_SOURCE_INVALID": "The active SlothVault Skill is missing or invalid.",
            "SKILL_AGENT_NOT_DETECTED": "No local Codex or Claude Code installation was detected; the Skill was not installed.",
            "SKILL_TARGET_INVALID": "The SlothVault Skill install target is invalid.",
            "SKILL_INSTALL_CONFIRMATION_REQUIRED": "The Skill target conflicts and requires explicit confirmation before replacement.",
            "SKILL_CONFIRMATION_DECLINED": "Skill conflict replacement was not confirmed.",
            "SKILL_UNINSTALL_CONFLICT": "The target is not a Skill link managed by this plugin and will not be removed.",
            "SKILL_LINK_INVALID": "The Skill directory link could not be verified after creation.",
            "SKILL_FILESYSTEM_ERROR": "The Skill filesystem operation failed."
        },
        "nativeMcpGuidance": "The standalone MCP Client has been removed. Configure the SlothVault /mcp URL and access key in your agent’s native MCP settings.",
        "deploymentRemoved": "Deployment support was removed from SlothTool. Download and extract the standalone SlothVault Deployment Release, then run python3 menu.py or install.py / start.py / stop.py / restart.py / status.py / check_update.py / update.py."
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

/** Format local service errors without exposing credentials in visible output. */
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
