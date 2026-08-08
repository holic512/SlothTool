/**
 * @file RootHomeAnimationTest
 * @project SlothTool
 * @module Test / Root TUI
 * @description 验证首页 Logo 动画具备可读的多阶段节奏，并限制总体播放时长。
 * @logic 1. 根据字符画宽度计算扫描帧数；2. 校验轮廓和收束阶段长度；3. 保证总时长不会重新变得过快或拖沓。
 * @dependencies Constants: ../lib/tui/root/constants.js, Node: assert/test
 * @index_tags 根TUI测试, 首页动画, Logo, 动画时长
 * @author holic512
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    HOME_ART,
    HOME_LOGO_ANIMATION_INTERVAL_MS,
    HOME_LOGO_ANIMATION_STEP,
    HOME_LOGO_INTRO_FRAMES,
    HOME_LOGO_REVEAL_EDGE_WIDTH,
    HOME_LOGO_SETTLE_FRAMES
} from '../lib/tui/root/constants.js';

test('home logo animation keeps a readable multi-stage duration', () => {
    const logoWidth = Math.max(...HOME_ART.map(line => line.length));
    const scanDistance = logoWidth
        + Math.ceil(HOME_ART.length * 0.75)
        + HOME_LOGO_REVEAL_EDGE_WIDTH;
    const scanFrames = Math.ceil(scanDistance / HOME_LOGO_ANIMATION_STEP);
    const totalFrames = HOME_LOGO_INTRO_FRAMES + scanFrames + HOME_LOGO_SETTLE_FRAMES;
    const totalDurationMs = totalFrames * HOME_LOGO_ANIMATION_INTERVAL_MS;

    assert.ok(HOME_LOGO_INTRO_FRAMES >= 5);
    assert.ok(HOME_LOGO_SETTLE_FRAMES >= HOME_ART.length);
    assert.ok(totalDurationMs >= 2200);
    assert.ok(totalDurationMs <= 3200);
});
