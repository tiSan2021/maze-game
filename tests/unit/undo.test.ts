// undo 单测：撤销回滚边界（V5/W6 / D11 / GDD① §4.5）
import { describe, it, expect } from 'vitest';
import type { GridCell, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel, setFloor } from '../helpers/build-level';
import { initRunState, applySlide } from '../../src/sim/runstate';
import { popSnapshot } from '../../src/input/undo';

/** 内部全墙、仅走廊 carved 为地板（避免 S3 路口提前停车） */
function corridor(floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(9);
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) g[y][x] = 'wall';
  for (const p of floors) setFloor(g, p.x, p.y);
  return g;
}

describe('input/undo · V5/W6', () => {
  it('走 5 步后撤销：path.length 减、visited.size 不减', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 6; x++) floors.push({ x, y: 1 }); // (1,1)..(6,1)
    const level = makeLevel({ gridSize: 9, grid: corridor(floors), start: { x: 1, y: 1 }, exit: { x: 6, y: 1 } });
    const state = initRunState(level);

    applySlide(state, 'right'); // 单次滑行恰好 5 格（(7,1) 为墙）
    expect(state.steps).toBe(5);
    expect(state.path).toHaveLength(5);
    const visitedBefore = state.visited.size; // start + 5 = 6

    const ok = popSnapshot(state);
    expect(ok).toBe(true);
    expect(state.path).toHaveLength(0); // path 回滚（D5）
    expect(state.steps).toBe(0);
    expect(state.visited.size).toBe(visitedBefore); // visited 单调不回滚（D11/V5/W6）
  });

  it('path 为空时按 Z 无操作（E4）', () => {
    const level = makeLevel();
    const state = initRunState(level);
    expect(popSnapshot(state)).toBe(false);
    expect(state.pos).toEqual(level.start);
  });
});
