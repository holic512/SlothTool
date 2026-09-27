/**
 * @file RootTuiConstants
 * @project SlothTool
 * @module Core CLI / TUI Constants
 * @description 定义根 TUI 页面顺序、亮色高对比调色板、任务渲染节奏和静态 Logo 数据。
 * @logic 固定页面顺序与选中/状态颜色，并提供高度充足时使用的首页字符画。
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
