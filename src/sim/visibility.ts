// visibility.ts · 视野计算 + 渲染态推导（GDD① §4.6–4.7 / ADR-03 / M-3）
// computeVisibility：R=3 切比雪夫 + 墙邻感知（V7/Q2）。一次 8 邻域，零成本。
// cellRenderState：唯一函数（A2）；full 模式绝不返回 UNKNOWN（V6）。

import type { CellKey, Level, Vec2 } from '../core/types';
import { chebyshev, EIGHT_OFFSETS, inBounds, key } from '../util/grid';
import { VISION_R } from '../core/constants/metrics';

export type CellRenderState =
  | 'UNKNOWN'
  | 'VIEW_UNWALKED'
  | 'VIEW_WALKED'
  | 'MEMORY_WALKED'
  | 'WALL'
  | 'WALL_MEMORY';

/**
 * 计算可见格集合（GDD① §4.6）：
 *  ① 半径内（切比雪夫 ≤3）的地板与墙
 *  ② 墙邻感知：任意已访问地板格或可见格的 8 邻域内墙格 → 加入 visible（Q2/V7）
 * 随 visited 单调增长，记忆区旁相邻墙永久可见。
 */
export function computeVisibility(level: Level, pos: Vec2, visited: ReadonlySet<CellKey>): Set<CellKey> {
  const visible = new Set<CellKey>();
  const R = VISION_R;

  // ① 半径集
  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const c = { x, y };
      if (chebyshev(pos, c) <= R) visible.add(key(c));
    }
  }

  // ② 墙邻感知：以 visited ∪ radiusFloor 为基准，其 8 邻域内墙格加入 visible
  const base = new Set<CellKey>(visited);
  for (const vk of visible) base.add(vk);

  for (const bk of base) {
    const [bx, by] = bk.split(',').map(Number);
    for (const off of EIGHT_OFFSETS) {
      const w = { x: bx + off.x, y: by + off.y };
      if (!inBounds(level.gridSize, w)) continue;
      if (level.grid[w.y][w.x] === 'wall') visible.add(key(w));
    }
  }
  return visible;
}

/**
 * 唯一渲染态推导（GDD① §4.7）。inView = full 模式恒真 || visible 含该格。
 * - 墙：full→WALL；fog 且 inView→ 半径内=WALL / 仅墙邻感知=WALL_MEMORY；否则 UNKNOWN。
 * - 地板：inView 看 walked → VIEW_WALKED/VIEW_UNWALKED；否则 MEMORY_WALKED/UNKNOWN。
 * a11yOverride='fogOff'：强制 inView=true（复用 BAKED 路径，不改变 visible/visited/path/星级）。
 */
export function cellRenderState(
  level: Level,
  c: Vec2,
  pos: Vec2,
  visited: ReadonlySet<CellKey>,
  visible: ReadonlySet<CellKey>,
  a11yOverride: 'fogOff' | null = null,
): CellRenderState {
  const inRadius = chebyshev(pos, c) <= VISION_R;
  const forceView = a11yOverride === 'fogOff';
  const inView = forceView || level.visionMode === 'full' || visible.has(key(c));
  const grid = level.grid[c.y][c.x];

  if (grid === 'wall') {
    if (level.visionMode === 'full') return 'WALL';
    if (!inView) return 'UNKNOWN';
    // 区分半径内（全浓度）与仅墙邻感知（记忆浓度，M-3）
    return inRadius ? 'WALL' : 'WALL_MEMORY';
  }

  const walked = visited.has(key(c));
  if (!inView) return walked ? 'MEMORY_WALKED' : 'UNKNOWN';
  return walked ? 'VIEW_WALKED' : 'VIEW_UNWALKED';
}
