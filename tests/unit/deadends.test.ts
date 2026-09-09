// deadends 单测：countDeadEndBranches（GDD⑤ §4.6.1 / M-2 默认实现）
import { describe, it, expect } from 'vitest';
import type { GridCell, Level, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel } from '../helpers/build-level';
import { countDeadEndBranches } from '../../src/sim/deadends';

/** 内部全墙，仅 carved 为地板，再按 expectedSolution 标记 trunk 方向 */
function ringGrid(gridSize: number, floors: Vec2[], solutionDirs: ('up' | 'down' | 'left' | 'right')[]): GridCell[][] {
  const g = emptyGrid(gridSize);
  for (let y = 1; y <= gridSize - 2; y++)
    for (let x = 1; x <= gridSize - 2; x++) g[y][x] = 'wall';
  for (const p of floors) g[p.y][p.x] = 'floor';
  return g;
}

describe('sim/deadends · M-2 契约用例', () => {
  it('C-M2-1 直线无分支 → 0', () => {
    const trunk: Vec2[] = [];
    for (let x = 1; x <= 7; x++) trunk.push({ x, y: 1 });
    const level = makeLevel({
      grid: ringGrid(9, trunk, Array(6).fill('right')),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: Array(6).fill('right') as Level['meta']['expectedSolution'],
    });
    expect(countDeadEndBranches(level)).toBe(0);
  });

  it('C-M2-2 单接入点死胡同 → 1', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 7; x++) cells.push({ x, y: 1 }); // trunk
    cells.push({ x: 4, y: 2 }); // 单格死胡同，接 (4,1)
    const level = makeLevel({
      grid: ringGrid(9, cells, Array(6).fill('right')),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: Array(6).fill('right') as Level['meta']['expectedSolution'],
    });
    expect(countDeadEndBranches(level)).toBe(1);
  });

  it('C-M2-3 Y 形共用 1 接入点 → 1', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 7; x++) cells.push({ x, y: 1 }); // trunk
    cells.push({ x: 4, y: 2 }, { x: 4, y: 3 }); // 同分量 Y 形
    const level = makeLevel({
      grid: ringGrid(9, cells, Array(6).fill('right')),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: Array(6).fill('right') as Level['meta']['expectedSolution'],
    });
    expect(countDeadEndBranches(level)).toBe(1);
  });

  it('C-M2-4 双 trunk 接触点（捷径）→ 不计，返回 0', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 7; x++) cells.push({ x, y: 1 }); // trunk
    cells.push({ x: 4, y: 2 }, { x: 5, y: 2 }); // 两端各接 trunk → touch=2
    const level = makeLevel({
      grid: ringGrid(9, cells, Array(6).fill('right')),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: Array(6).fill('right') as Level['meta']['expectedSolution'],
    });
    expect(countDeadEndBranches(level)).toBe(0);
  });
});
