// motion.ts · 动效时长表 + motionScale + 缓动（架构 §7）
// A5 口径纠正：移动插值 120ms 受 A5 约束；过场/结算动效不受 A5 约束（不阻塞输入、受 motionScale、不承载必需信息）。

/** 移动插值（受 A5：≤200ms） */
export const MOVE_INTERP_MS = 120;

/** 交互反馈 */
export const HIT_WALL_MS = 80;
export const PICKUP_MS = 200;

/** 过场/结算（不受 A5） */
export const DOOR_OPEN_MS = 280;
export const LEVEL_CLEAR_MS = 400;
export const SCENE_TRANSITION_MS = 250;

/** 失败反馈（art-bible v2.1：250ms / 闪 1 次，AC-5 满足 WCAG 2.3.1 <3Hz） */
export const FAIL_VIGNETTE_MS = 250;
export const FAIL_VIGNETTE_BLINKS = 1;

/** 长按连走（GDD① §4.3 M2）：禁用 OS auto-repeat，自管节奏 */
export const REPEAT_INITIAL_DELAY_MS = 220;
export const REPEAT_INTERVAL_MS = 110;

/** 动效档位：1 = 全开，0.5 = 半量，0 = 关闭（信息仍可见，门状态瞬时切换） */
export type MotionScale = 1 | 0.5 | 0;
export const DEFAULT_MOTION_SCALE: MotionScale = 1;

/** 线性缓动（默认） */
export function easeLinear(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
