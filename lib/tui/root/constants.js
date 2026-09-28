/**
 * @file RootTuiConstants
 * @project SlothTool
 * @module Core CLI / TUI Constants
 * @description 定义根 TUI 页面顺序、亮色高对比调色板、任务渲染节奏和多阶段 Logo 动画数据。
 * @logic 固定页面顺序与选中/状态颜色，并提供自适应首页字符画和动画节奏。
 * @dependencies None
 * @index_tags 根TUI, 常量, 高对比调色板, 页面顺序, logo, spinner
 * @author holic512
 */

export const TAB_ORDER = ['home', 'run', 'install', 'update', 'uninstall', 'settings'];
export const ROOT_TUI_COLORS = Object.freeze({
    accent: 'cyanBright',
    secondary: 'magentaBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    border: 'gray'
});
export const SELF_RESTART_DELAY_MS = 700;
export const TASK_START_RENDER_DELAY_MS = 16;
export const SPINNER_INTERVAL_MS = 120;
export const SPINNER_FRAMES = ['-', '\\', '|', '/'];
export const HOME_LOGO_ANIMATION_INTERVAL_MS = 60;
export const HOME_LOGO_ANIMATION_STEP = 2;
export const HOME_LOGO_INTRO_FRAMES = 6;
export const HOME_LOGO_REVEAL_EDGE_WIDTH = 6;
export const HOME_LOGO_SETTLE_FRAMES = 11;
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
