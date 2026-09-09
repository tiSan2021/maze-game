// metrics.ts · 全局尺寸/性能常量（常量表隔离，绘制/逻辑只引用不硬编码）
// ADR-03 F 组：VISION_R 当前值为 2（2026-09-09 由 3 缩至 2，提升难度）；R 上限恒定为 3（M5 不可由配置改大），
// 关 9+ 性能预算 <8ms 的三前置之一。缩小 R（3→2）不在禁止范围，且视野内格数更少、更省。
// 注意：VISION_R 是 `const`，全仓无任何代码路径能把它改大到 4/5（控制清单 F 组 R 上限恒定为 3）。

/** 单格像素（恒定 40，不做"变小显示更多"） */
export const CELL_PX = 40;

/** 三种外部网格尺寸（含外墙）：9×9 / 11×11 / 13×13 */
export const GRID_SIZES = [9, 11, 13] as const;

/** 顶部 HUD 高度（DOM 32px，不占迷宫区高度，V8） */
export const HUD_H = 32;

/**
 * 视野半径（切比雪夫距离）。当前恒定 = 2（D12 纯半径、不做 Bresenham）。
 * 2026-09-09 由 3 缩至 2：玩家试玩反馈难度偏低，R=2 显著提升探索与记忆负担。
 * ADR-03 仅禁止把 R 改「大」（4/5，会突破关 9+ <8ms 预算），缩小 R 不在禁止范围；
 * 缩小后每帧视野内格数更少，绘制量下降，理论上更省，待复测。
 */
export const VISION_R = 2;

/** 生成器版本（ADR-01 §3.4：版本参与种子派生；升级需评审并显式改值） */
export const GENERATOR_VERSION = 1;

/** 画布逻辑尺寸（一屏一关：13×13×40=520 ≤ 592 可用高度，W5/A6） */
export const CANVAS_W = 960;
export const CANVAS_H = 640;

/**
 * 迷宫在画布中的左上角原点（居中偏移，逻辑像素）。
 * 三种网格：9×9→{300,140} · 11×11→{260,100} · 13×13→{220,60}。
 * 居中由渲染管线外层 translate 统一施加，格子局部坐标系不变。
 */
export function boardOrigin(gridSize: number): { x: number; y: number } {
  const n = gridSize * CELL_PX;
  return {
    x: Math.round((CANVAS_W - n) / 2),
    y: Math.round((CANVAS_H - n) / 2),
  };
}
