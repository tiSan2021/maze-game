// glide 单测：S1–S4 停止谓词 + V3 环形不死循环（GDD① §4.2 / ADR-04）
import { describe, it, expect } from 'vitest';
import type { GridCell, Level, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel, setFloor, setWall } from '../helpers/build-level';
import { initRunState } from '../../src/sim/runstate';
import { planSlide } from '../../src/input/glide';

/** 内部全墙、仅 carved 格为地板的网格（便于构造 1 宽走廊/环） */
function carveGrid(gridSize: number, floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(gridSize);
  for (let y = 1; y <= gridSize - 2; y++)
    for (let x = 1; x <= gridSize - 2; x++) g[y][x] = 'wall';
  for (const p of floors) setFloor(g, p.x, p.y);
  return g;
}

describe('input/glide · S1–S4', () => {
  it('S1 前方不可通行 → 停当前格（不入下格）', () => {
    const level = makeLevel({ grid: carveGrid(9, [{ x: 1, y: 1 }]) }); // 右侧为墙
    const state = initRunState(level);
    expect(planSlide(level, state, 'right')).toEqual([]);
  });

  it('S2 当前格有实体（钥匙）→ 停在实体格，不穿过', () => {
    const level = makeLevel({
      grid: carveGrid(9, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]),
      keys: [{ id: 'k0', color: 0, pos: { x: 3, y: 1 } }],
    });
    const state = initRunState(level);
    expect(planSlide(level, state, 'right')).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);
  });

  it('S3 当前格是通行路口（垂直可通行邻格）→ 停', () => {
    const level = makeLevel({
      grid: carveGrid(9, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]),
    });
    const state = initRunState(level);
    expect(planSlide(level, state, 'right')).toEqual([{ x: 2, y: 1 }]);
  });
});

describe('input/glide · V3 环形不死循环', () => {
  it('环形关卡单次滑行终止且 ≤ gridSize² 格', () => {
    // 方形环：x,y ∈ {2..6} 边界为地板，其余内部墙
    const loop: Vec2[] = [];
    for (let x = 2; x <= 6; x++) { loop.push({ x, y: 2 }); loop.push({ x, y: 6 }); }
    for (let y = 2; y <= 6; y++) { loop.push({ x: 2, y }); loop.push({ x: 6, y }); }
    const gridSize = 9;
    const level = makeLevel({ gridSize, grid: carveGrid(gridSize, loop), start: { x: 2, y: 2 }, exit: { x: 6, y: 6 } });
    const state = initRunState(level);
    const result = planSlide(level, state, 'right');
    expect(result.length).toBeLessThanOrEqual(gridSize * gridSize); // 上限保证不死循环
    expect(result.length).toBeGreaterThan(0);
  });

  it('S4 兜底：即便构造自交路径也不会超过 gridSize²（防御性上限）', () => {
    const gridSize = 9;
    const open = emptyGrid(gridSize); // 全开内部
    const level = makeLevel({ gridSize, grid: open });
    const state = initRunState(level);
    const result = planSlide(level, state, 'right');
    expect(result.length).toBeLessThanOrEqual(gridSize * gridSize);
  });
});
