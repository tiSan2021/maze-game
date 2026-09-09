// layers.ts · L0/L1 离屏 + L1 增量更新（E2-3 / ADR-03 D1/D3 / 控制清单 F 组 ①）
// L0 纸底烘焙一次；L1 记忆层跨格仅重绘 dirtyCells（全量重绘会令 lastDirtyCount=169 → 失败）。
// 增量体现在"只画脏格"，不体现在"少算格子"（D-R3：169 次整数比较 = 微秒级）。

import { CELL_PX } from '../core/constants/metrics';
import { PAPER, GRID_UNKNOWN } from '../core/constants/palette';
import { cellRenderState } from '../sim/visibility';
import type { Level, Vec2, CellKey } from '../core/types';
import type { CanvasFactory, CanvasLike, Ctx2D } from './canvas';
import type { TileAtlas } from './tiles';
import { drawCell } from './draw-cell';

export interface RenderStats {
  /** 三前置①：tile 图集必须在首帧前就绪（控制清单 F 组 ③） */
  tileAtlasReady: boolean;
  /** L1 增量：跨格一次应 ≤40；被写成全量重绘则恒 =169 → 失败（控制清单 F 组 ①） */
  lastDirtyCount: number;
}

/** L0 纸底：纸面 + 极淡网格，烘焙一次，永不失效 */
export function bakeL0(ctx: Ctx2D, level: Level): void {
  const n = level.gridSize * CELL_PX;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = GRID_UNKNOWN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= level.gridSize; i++) {
    const p = i * CELL_PX;
    ctx.moveTo(p, 0); ctx.lineTo(p, n);
    ctx.moveTo(0, p); ctx.lineTo(n, p);
  }
  ctx.stroke();
}

/** 创建 L0/L1 离屏画布（尺寸 = 迷宫区，非整块画布，D-R1） */
export function createLayers(factory: CanvasFactory, level: Level): { l0: CanvasLike; l1: CanvasLike } {
  const n = level.gridSize * CELL_PX;
  return { l0: factory(n, n), l1: factory(n, n) };
}

/**
 * 增量更新 L1 记忆层。仅 MEMORY_WALKED / WALL_MEMORY 落在 L1。
 * 返回脏格数并写入 stats.lastDirtyCount（initial=true 时仍计脏格，但不作断言对象）。
 */
export function updateL1(
  ctx: Ctx2D,
  level: Level,
  pos: Vec2,
  visited: ReadonlySet<CellKey>,
  visible: ReadonlySet<CellKey>,
  atlas: TileAtlas,
  prevStates: (string | null)[],
  stats: RenderStats,
  initial: boolean,
): number {
  const gs = level.gridSize;
  let dirty = 0;
  for (let y = 0; y < gs; y++) {
    for (let x = 0; x < gs; x++) {
      const idx = y * gs + x;
      const cell = { x, y };
      const st = cellRenderState(level, cell, pos, visited, visible, null);
      const inMemory = st === 'MEMORY_WALKED' || st === 'WALL_MEMORY';
      const prev = prevStates[idx];
      if (inMemory) {
        if (prev !== st || initial) {
          ctx.clearRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
          drawCell(ctx, atlas, cell, st, pos);
          prevStates[idx] = st;
          dirty++;
        }
      } else if (prev !== null) {
        // 离开记忆态（如 WALL_MEMORY → UNKNOWN）：清掉残留
        ctx.clearRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
        prevStates[idx] = null;
        dirty++;
      }
    }
  }
  stats.lastDirtyCount = dirty;
  return dirty;
}
