/**
 * @file RootTuiInstallPage
 * @project SlothTool
 * @module Core CLI / TUI Pages
 * @description 渲染根 TUI 官方插件安装页的插件列表和底部安装提示。
 * @logic 1. 展示未安装官方插件；2. 将插件功能摘要输出到底部 tip；3. 无待安装插件时显示空态。
 * @dependencies Layout: ../layout.js, I18N: ../../../i18n.js
 * @index_tags 根TUI, 安装页, 官方插件, tip
 * @author holic512
 */

import React from 'react';
import {t} from '../../../i18n.js';
import {StackedSelectionPage} from '../layout.js';

const h = React.createElement;

export function InstallPage({items, selectedIndex}) {
    return h(StackedSelectionPage, {
        items,
        selectedIndex,
        emptyMessage: t('tui.install.empty'),
        fallbackTitle: t('tui.tabs.install'),
        fallbackDescription: t('tui.install.action'),
        fallbackDetail: t('tui.install.action')
    });
}
