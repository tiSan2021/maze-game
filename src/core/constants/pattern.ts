// pattern.ts · 图案间距/线宽/密度（墙斜线/门交叉/笔迹/出口同心圆/钥匙环）
// 仅常量（架构 §7·常量表隔离）；具体取值对齐 asset-spec §1–2 与 art-bible §2②。

/** 墙斜线（A 态与 WALL_MEMORY 同向 45°↘） */
export const WALL_HATCH = {
  spacingPx: 5,
  lineWidth: 2,
} as const;

/** 记忆态墙斜线（同方向，浓度由颜色区分） */
export const WALL_MEMORY_HATCH = {
  spacingPx: 5,
  lineWidth: 2,
} as const;

/** 门·锁定 双向交叉网格（45°↘ + 135°↙） */
export const DOOR_CROSS = {
  spacingPx: 4,
  lineWidth: 1.5,
} as const;

/** 铅笔笔迹（B 态通道足迹） */
export const INK = {
  spacingPx: 8,
  lineWidth: 1,
  alpha: 0.4,
} as const;

/** 出口同心圆纹理（3 圈，径向无方向） */
export const EXIT_CONCENTRIC = {
  rings: 3,
  gapPx: 6,
  lineWidth: 3,
} as const;

/** 三色钥匙形状标记（菱形/三角/六边形）+ 环形镂空 */
export const KEY_GLYPH = {
  ringRadiusPx: 6,
  lineWidth: 2,
} as const;

/** 墨晕预渲染半径（亮底发光替代物，启动时一次烘焙，运行时 drawImage） */
export const HALO = {
  radiusPx: 18,
  rings: 6,
} as const;
