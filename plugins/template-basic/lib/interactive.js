/**
 * @file TemplatePluginInteractive
 * @project SlothTool
 * @module Plugin Scaffold / Interactive
 * @description 提供插件模板的最小交互菜单，作为后续业务扩展的起点。
 * @logic 1. 渲染简单菜单；2. 演示 action 分发；3. 保持模板目录在复制后即可运行。
 * @dependencies Library: prompts, Module: ./i18n
 * @index_tags 插件模板, 交互菜单, prompts, scaffold
 * @author holic512
 */

const prompts = require('prompts');
const {t} = require('./i18n');

async function interactiveMain() {
    while (true) {
        const response = await prompts({
            type: 'select',
            name: 'action',
            message: t('interactiveMenu'),
            choices: [
                {title: t('showTitle'), value: 'title'},
                {title: t('exit') || 'Exit', value: 'exit'}
            ]
        });

        if (!response.action || response.action === 'exit') {
            break;
        }

        if (response.action === 'title') {
            console.log(t('title'));
        }
    }
}

module.exports = {
    interactiveMain
};
