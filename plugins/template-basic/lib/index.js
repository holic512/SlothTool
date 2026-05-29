/**
 * @file TemplatePluginLibraryEntry
 * @project SlothTool
 * @module Plugin Scaffold / Entry
 * @description 为模板插件提供有效的库入口，统一导出配置、文案与 TUI 启动函数。
 * @logic 1. 导出模板配置存储；2. 导出 i18n 辅助；3. 导出默认 TUI 入口供复制后直接复用。
 * @dependencies Modules: ./config.js, ./i18n.js, ./interactive.js
 * @index_tags 模板入口, main字段, scaffold导出
 * @author holic512
 */

export * from './config.js';
export * from './i18n.js';
export * from './interactive.js';
