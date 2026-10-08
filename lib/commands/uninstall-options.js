/**
 * @file uninstall-options.js
 * @project SlothTool
 * @module Uninstall CLI policy
 * @description Parses explicit data policy and performs deletion confirmation in the CLI layer.
 * @logic Default single uninstall to data retention, preview purge or batch paths, and require yes in noninteractive execution.
 * @dependencies Node readline/process, root i18n
 * @index_tags uninstall,cli,data-policy,confirmation
 * @author holic512
 */
import {createInterface} from 'node:readline/promises';
import {t} from '../i18n.js';
export function uninstallOptions(args, {all = false} = {}) {
    if (args.includes('--keep-data') && args.includes('--purge-data')) throw new Error(t('uninstall.policyConflict'));
    if (args.some(flag => !['--keep-data', '--purge-data', '--yes'].includes(flag))) throw new Error(t('uninstall.invalidOption'));
    return {dataPolicy: args.includes('--keep-data') ? 'keep' : args.includes('--purge-data') || all ? 'purge' : 'keep', yes: args.includes('--yes')};
}
export async function confirmUninstall(preview, options, {all = false} = {}) {
    if (!all && options.dataPolicy === 'keep') return true;
    console.log(t('uninstall.dataPolicy.' + options.dataPolicy));
    for (const file of preview.paths || []) console.log(file);
    if (options.yes) return true;
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error(t('uninstall.confirmRequired'));
    const reader = createInterface({input: process.stdin, output: process.stdout});
    try {return ['yes', 'y'].includes((await reader.question(t('cli.confirmPrompt') + ' ')).trim().toLowerCase());}
    finally {reader.close();}
}
