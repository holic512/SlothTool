/**
 * @file RootTuiConstants
 * @project SlothTool
 * @module Core CLI / TUI Constants
 * @description 定义根 TUI 页面顺序、亮色高对比调色板、状态计时、任务渲染延迟和首页多阶段 logo 动画数据。
 * @logic 1. 固定页面顺序与选中/状态颜色；2. 统一任务状态与首页轮廓、扫描、收束动画节奏；3. 提供首页填充式 logo 字符画。
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
export const RESULT_DISPLAY_MS = 1600;
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
