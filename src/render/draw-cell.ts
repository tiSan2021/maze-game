// draw-cell.ts · 单格绘制（E2-2 / 控制清单 F 组 ④）
// 消费 sim/visibility.cellRenderState（唯一实现，不得重定义）；单格仅 ctx.drawImage。
// 单格仅 ctx.drawImage；fill/stroke/strokeText/createRadialGradient 类路径 API 由 CI 闸门自动守卫，此处不得出现。
// 'fogOff' 覆盖点：调用方传入 a11yOverride，经 cellRenderState 改变返回值，
//   复用 BAKED 路径，不改变 visible/visited/path/星级。

import { cellRenderState, type CellRenderState } from '../sim/visibility';
import { chebyshev } from '../util/grid';
import { VISION_R } from '../core/constants/metrics';
import { CELL_PX } from '../core/constants/metrics';
import type { Level, Vec2, CellKey } from '../core/types';
import type { Ctx2D } from './canvas';
import type { TileAtlas } from './tiles';

/**
 * 选择 WALL_MEMORY 浓度档（asset-spec §3）：
 * 距玩家越近 = 记忆越新 = 越浓（索引 0=L3 最浓）。仅当不在半径内时进入 WALL_MEMORY。
 */
function memoryConcentration(pos: Vec2, cell: Vec2): 0 | 1 | 2 {
  const off = chebyshev(pos, cell) - VISION_R;
  if (off <= 1) return 0;
  if (off <= 3) return 1;
  return 2;
}

/** 按渲染态把对应 tile 用单次 drawImage 画到 (cell.x, cell.y) 的逻辑像素位置 */
export function drawCell(
  ctx: Ctx2D,
  atlas: TileAtlas,
  cell: Vec2,
  state: CellRenderState,
  pos: Vec2,
): void {
  const px = cell.x * CELL_PX;
  const py = cell.y * CELL_PX;
  switch (state) {
    case 'WALL':
      ctx.drawImage(atlas.wall.c as unknown as CanvasImageSource, px, py);
      return;
    case 'WALL_MEMORY': {
      const idx = memoryConcentration(pos, cell);
      ctx.drawImage(atlas.wallMemory[idx].c as unknown as CanvasImageSource, px, py);
      return;
    }
    case 'MEMORY_WALKED':
      ctx.drawImage(atlas.floorWalked.c as unknown as CanvasImageSource, px, py);
      return;
    case 'VIEW_WALKED':
    case 'VIEW_UNWALKED':
      ctx.drawImage(atlas.floorView.c as unknown as CanvasImageSource, px, py);
      return;
    case 'UNKNOWN':
      // 未探索 = 未落笔：不绘制，透出底层 L0 纸面
      return;
  }
}

/**
 * 消费 cellRenderState 后绘单格（唯一状态来源，避免重复推导）。
 * 调用方负责传入 a11yOverride；'fogOff' 经此处透传给 cellRenderState。
 */
export function paintCell(
  ctx: Ctx2D,
  atlas: TileAtlas,
  level: Level,
  cell: Vec2,
  pos: Vec2,
  visited: ReadonlySet<CellKey>,
  visible: ReadonlySet<CellKey>,
  a11yOverride: 'fogOff' | null = null,
): void {
  const state = cellRenderState(level, cell, pos, visited, visible, a11yOverride);
  drawCell(ctx, atlas, cell, state, pos);
}
