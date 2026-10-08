/**
 * @file UpdateCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 处理单插件更新命令，输出统一 reporter 事件。
 * @logic 1. 校验更新目标；2. 调用 update service；3. 输出更新进度与结果。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js, Helper: ./shared.js
 * @index_tags update命令, 插件更新, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {checkPluginUpdate, createCliError, updatePlugin} from '../services/plugin-service.js';
import {VAULT_COMPONENTS, checkComponentUpdate, installComponents} from '../services/slothvault-components.js';
import registry from '../registry.js';
import {printReporterEvent} from './shared.js';

export default async function update(args) {
    const alias = args[0];

    if (!alias) {
        throw createCliError(`${t('cli.specifyPluginToUpdate')}\n${t('cli.updateUsage')}`);
    }

    const json = args.includes('--json');
    const moduleIndex = args.indexOf('--module');
    if (moduleIndex >= 0) {
        const module = args[moduleIndex + 1];
        if (alias !== 'slothvault' && alias !== 'sv' || !VAULT_COMPONENTS.includes(module) ||
            args.some((item, index) => index > 0 && !['--module', module, '--check', '--json'].includes(item))) {
            throw createCliError('Usage: slothtool update slothvault --module skill|deployment [--check] [--json]');
        }
        if (!registry.getPlugin('slothvault')) throw createCliError('SlothVault is not installed. Run slothtool install slothvault.');
        const result = args.includes('--check') ? await checkComponentUpdate(module) : await installComponents([module]);
        if (json) console.log(JSON.stringify(result, null, 2));
        else console.log(`${module}: ${result.currentVersion || '-'} → ${result.latestVersion || result.components?.[0]?.version || '-'} (${result.status})${result.reason ? ` — ${result.reason}` : ''}`);
        if (result.status === 'error') process.exitCode = 1;
        return result;
    }
    const result = args.includes('--check')
        ? await checkPluginUpdate(alias)
        : await updatePlugin(alias, {reporter: json ? undefined : printReporterEvent});
    if (json) console.log(JSON.stringify(result, null, 2));
    else if (args.includes('--check')) {
        console.log(`${result.title}: ${result.currentVersion} → ${result.latestVersion || '-'} (${result.status})${result.reason ? ` — ${result.reason}` : ''}`);
        for (const component of result.components || []) console.log(`  ${component.module}: ${component.currentVersion || '-'} → ${component.latestVersion || '-'} (${component.status})`);
    }
    if (result.status === 'error') process.exitCode = 1;
    return result;
}
