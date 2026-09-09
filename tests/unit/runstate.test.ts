// runstate 单测：推进 / visited 单调 / finished 才结算（GDD② B4 / V2 / V5/W6）
import { describe, it, expect } from 'vitest';
import type { GridCell, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel, setFloor } from '../helpers/build-level';
import { initRunState, applySlide } from '../../src/sim/runstate';
import { popSnapshot } from '../../src/input/undo';
import { key } from '../../src/util/grid';
import { settle } from '../../src/sim/stars';

/** 内部全墙、仅走廊 carved 为地板（避免 S3 路口提前停车） */
function corridor(floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(9);
  for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) g[y][x] = 'wall';
  for (const p of floors) setFloor(g, p.x, p.y);
  return g;
}

describe('sim/runstate', () => {
  it('每次前进 path.push + visited.add，visited 单调', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 3; x++) floors.push({ x, y: 1 });
    const level = makeLevel({ gridSize: 9, grid: corridor(floors), start: { x: 1, y: 1 }, exit: { x: 3, y: 1 } });
    const state = initRunState(level);
    applySlide(state, 'right'); // (2,1),(3,1)
    expect(state.path).toHaveLength(2);
    expect(state.visited.has(key({ x: 1, y: 1 }))).toBe(true);
    expect(state.visited.has(key({ x: 3, y: 1 }))).toBe(true);
    expect(state.visited.size).toBe(3);
  });

  it('抵达 exit → finished=true（仅此后 settle 才结算，B4）', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 3; x++) floors.push({ x, y: 1 });
    const level = makeLevel({ gridSize: 9, grid: corridor(floors), start: { x: 1, y: 1 }, exit: { x: 3, y: 1 } });
    const state = initRunState(level);
    applySlide(state, 'right');
    expect(state.finished).toBe(true);
    expect(state.pos).toEqual({ x: 3, y: 1 });
    const r = settle(state);
    expect(r).not.toBeNull();
    expect(r!.star).toBe(3); // 直线无回头路
  });

  it('V2 撞墙 10 次：steps===0 && path.length===0', () => {
    const gridSize = 9;
    const g = emptyGrid(gridSize);
    g[1][2] = 'wall'; // 起点右侧为墙
    const level = makeLevel({ gridSize, grid: g, start: { x: 1, y: 1 } });
    const state = initRunState(level);
    for (let i = 0; i < 10; i++) applySlide(state, 'right');
    expect(state.steps).toBe(0);
    expect(state.path).toHaveLength(0);
    expect(state.undoStack).toHaveLength(0);
  });

  it('撤销后 visited 仍单调（W6 跨撤销）', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 3; x++) floors.push({ x, y: 1 });
    const level = makeLevel({ gridSize: 9, grid: corridor(floors), start: { x: 1, y: 1 }, exit: { x: 3, y: 1 } });
    const state = initRunState(level);
    applySlide(state, 'right');
    const v = state.visited.size;
    popSnapshot(state);
    expect(state.visited.size).toBe(v); // 不减少
  });
});
