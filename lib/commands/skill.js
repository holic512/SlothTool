/**
 * @file BundledSkillCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 解析内置 Skill 管理命令并输出人类可读或 JSON 结果。
 * @logic 校验 action/agent 参数，调用共享服务，统一结构化错误和退出码；不启动 TUI 或安装 npm 包。
 * @dependencies Services: ../services/skill-service.js, I18N: ../i18n.js
 * @index_tags skill, cli, json, agent-installation
 * @author holic512
 */
import {getSkillStatus, manageSkill} from '../services/skill-service.js';
import {t} from '../i18n.js';

export default function skill(args = []) {
    const json = args.includes('--json');
    try {
        if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
            console.log(t('skill.description'));
            console.log('slothtool skill status|install|update|uninstall [--agent codex|claude-code|all] [--json]');
            return;
        }
        const action = args[0] || 'status';
        if (!['status', 'install', 'update', 'uninstall'].includes(action)) throw usageError();
        let agent = 'all';
        let agentSeen = false;
        let jsonSeen = false;
        for (let index = 1; index < args.length; index += 1) {
            if (args[index] === '--json' && !jsonSeen) {
                jsonSeen = true;
            } else if (args[index] === '--agent' && !agentSeen) {
                agentSeen = true;
                agent = args[++index];
                if (!['codex', 'claude-code', 'all'].includes(agent)) throw usageError();
            } else throw usageError();
        }
        const result = action === 'status' ? getSkillStatus({agent}) : manageSkill(action, {agent});
        if (json) console.log(JSON.stringify(result, null, 2));
        else {
            console.log(`${t('skill.title')} — ${result.packageVersion} / ${result.skillVersion || '-'}`);
            for (const target of result.agents) {
                console.log(`${target.name}: ${t(`skill.states.${target.state}`)} (${target.version || '-'})`);
                console.log(`  ${t('skill.target')}: ${target.targetPath}`);
                console.log(`  ${t('skill.source')}: ${target.sourcePath}`);
                if (target.error) console.error(`  ${target.error.message}`);
            }
            if (result.error) console.error(result.error.message);
            for (const warning of result.warnings || []) console.error(`${warning.path}: ${warning.message}`);
            for (const message of result.rollbackErrors || []) console.error(message);
            if (action !== 'status' && result.ok) console.log(t('skill.complete'));
            if (action === 'status' && !result.agents.some(target => target.detected)) console.log(t('skill.errors.NO_AGENTS'));
        }
        if (!result.ok) process.exitCode = 1;
        return result;
    } catch (error) {
        const result = {ok: false, error: {code: error.code || 'OPERATION_FAILED', message: error.message}};
        if (json) console.log(JSON.stringify(result));
        else console.error(error.message);
        process.exitCode = error.code === 'INVALID_ARGUMENTS' ? 2 : 1;
        return result;
    }
}

function usageError() {
    const error = new Error(t('skill.errors.INVALID_ARGUMENTS'));
    error.code = 'INVALID_ARGUMENTS';
    return error;
}
