/**
 * @file OfflineBundleCommand
 * @project SlothTool
 * @module Core CLI / Commands
 * @description 将已安装官方插件连同运行时依赖打包为可在无网络环境安装的本地归档。
 * @logic 1. 解析插件 alias 和输出路径；2. 委托 plugin service 生成含 package/ 根目录的 tgz；3. 输出可复用的离线安装命令。
 * @dependencies Service: ../services/plugin-service.js, I18N: ../i18n.js
 * @index_tags 离线安装, 插件归档, bundle, CLI包装
 * @author holic512
 */

import {t} from '../i18n.js';
import {createCliError, createOfflinePluginBundle} from '../services/plugin-service.js';

export default async function bundle(args) {
    const alias = args[0];
    const outputIndex = args.indexOf('--output');
    const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : '';

    if (!alias || (outputIndex >= 0 && (!outputPath || outputIndex !== 1 || args.length !== 3)) || (outputIndex < 0 && args.length !== 1)) {
        throw createCliError(t('cli.bundleUsage'));
    }

    const result = await createOfflinePluginBundle(alias, outputPath || undefined);
    console.log(t('bundle.created', {path: result.outputPath}));
    console.log(t('bundle.installHint', {alias, path: result.outputPath}));
    return result;
}
