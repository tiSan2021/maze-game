// grid.ts · 网格纯函数（core 零依赖）
// GDD②/①：key()/neighbor()/chebyshev()/越界判定。被 sim/input 共用，不依赖任何上层模块。

import type { Dir, Vec2, CellKey } from '../core/types';

/** `"x,y"` 形式的 Set 键 */
export function key(p: Vec2): CellKey {
  return `${p.x},${p.y}`;
}

/** 显式坐标版的 key */
export function keyXY(x: number, y: number): CellKey {
  return `${x},${y}`;
}

/** 四向邻格 */
export function neighbor(p: Vec2, dir: Dir): Vec2 {
  switch (dir) {
    case 'up':
      return { x: p.x, y: p.y - 1 };
    case 'down':
      return { x: p.x, y: p.y + 1 };
    case 'left':
      return { x: p.x - 1, y: p.y };
    case 'right':
      return { x: p.x + 1, y: p.y };
  }
}

/** 反向方向 */
export function opposite(dir: Dir): Dir {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

/** 切比雪夫距离（视野半径用，max(|dx|,|dy|)） */
export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** 是否落在 [0, gridSize) 内（外圈必为墙，故坐标越界即不可达） */
export function inBounds(gridSize: number, p: Vec2): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < gridSize && p.y < gridSize;
}

/** 四正交方向 */
export const ORTHO_DIRS: Dir[] = ['up', 'down', 'left', 'right'];

/** 八邻域偏移（墙邻感知用，一次 8 邻域查询，零成本） */
export const EIGHT_OFFSETS: ReadonlyArray<Vec2> = [
  { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 0 }, { x: 1, y: 0 },
  { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
];
