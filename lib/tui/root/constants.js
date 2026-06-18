/**
 * @file RootTuiConstants
 * @project SlothTool
 * @module Core CLI / TUI Constants
 * @description 定义根 TUI 页面顺序、状态计时、首页 logo 动画参数和实心 logo 数据。
 * @logic 1. 固定根 TUI 页面顺序；2. 统一任务状态与首页 logo 动画参数；3. 提供首页填充式 logo 字符画。
 * @dependencies None
 * @index_tags 根TUI, 常量, 页面顺序, logo, spinner
 * @author holic512
 */

export const TAB_ORDER = ['home', 'run', 'install', 'update', 'uninstall', 'settings'];
export const RESULT_DISPLAY_MS = 1600;
export const SELF_RESTART_DELAY_MS = 700;
export const SPINNER_INTERVAL_MS = 120;
export const SPINNER_FRAMES = ['-', '\\', '|', '/'];
export const HOME_LOGO_ANIMATION_INTERVAL_MS = 45;
export const HOME_LOGO_ANIMATION_STEP = 3;
export const HOME_LOGO_REVEAL_EDGE_WIDTH = 5;
export const HOME_ART = [
    '███████ ██      ██████  ████████ ██  ██',
    '██      ██      ██  ██     ██    ██  ██',
    '███████ ██      ██  ██     ██    ██████',
    '     ██ ██      ██  ██     ██    ██  ██',
    '███████ ███████ ██████     ██    ██  ██',
    '████████  ██████   ██████  ██',
    '   ██    ██    ██ ██    ██ ██',
    '   ██    ██    ██ ██    ██ ██',
    '   ██     ██████   ██████  ███████'
];

// 这地方有点bug  不知道为什么 显示出现了 问题
