// interconnect 单测：D9 互连检测（H1 硬门禁）三对照 + 通过对照（GDD⑤ §4.6 / GDD③ §2.4）
// 关键：仅用 countDeadEndBranches 计数会『漏判捷径』（含环/多接触点分量被跳过），
//   detectInterconnect 必须独立泛洪捕获 ⇒ G5 = (D9 通过) AND (计数 ≤6)。
import { describe, it, expect } from 'vitest';
import type { Dir, GridCell, Level, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel } from '../helpers/build-level';
import { detectInterconnect } from '../../src/gen/interconnect';
import { countDeadEndBranches } from '../../src/sim/deadends';
import { gateG5 } from '../../src/gen/gates';

/** 内部全墙，仅 carved 为地板 */
function carve(gridSize: number, floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(gridSize);
  for (let y = 1; y <= gridSize - 2; y++)
    for (let x = 1; x <= gridSize - 2; x++) g[y][x] = 'wall';
  for (const p of floors) g[p.y][p.x] = 'floor';
  return g;
}

const RIGHT = (n: number): Dir[] => Array(n).fill('right') as Dir[];

describe('D9 互连检测 · 通过对照 (a)', () => {
  it('单分支单接触点树状 → pass', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 7; x++) cells.push({ x, y: 1 }); // trunk
    cells.push({ x: 4, y: 2 }); // 单格死胡同，唯一接触点 (4,1)
    const level = makeLevel({
      gridSize: 9,
      grid: carve(9, cells),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: RIGHT(6),
    });
    const r = detectInterconnect(level);
    expect(r.pass).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});

describe('D9 互连检测 · 失败对照 (b)', () => {
  it('某分支与 trunk 有 2 个接触点 → fail (multi-touch)', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 7; x++) cells.push({ x, y: 1 }); // trunk
    cells.push({ x: 4, y: 2 }, { x: 5, y: 2 }); // 两端各接 trunk → touch=2，合成一个分量
    const level = makeLevel({
      gridSize: 9,
      grid: carve(9, cells),
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: RIGHT(6),
    });
    const r = detectInterconnect(level);
    expect(r.pass).toBe(false);
    expect(r.violations.some((v) => v.type === 'multi-touch')).toBe(true);
    // 漏判验证：countDeadEndBranches 会跳过该分量 → 返回 0，但 D9 必须拦下
  });
});

describe('D9 互连检测 · 失败对照 (c)', () => {
  it('两条分支彼此相连（合成含环分量）→ fail (cycle)', () => {
    const cells: Vec2[] = [];
    for (let x = 1; x <= 3; x++) cells.push({ x, y: 1 }); // trunk (1,1)-(3,1)
    // 2x2 环挂在 (3,1) 下：仅 (3,2) 触 trunk，内部含环
    cells.push({ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 2 });
    const level = makeLevel({
      gridSize: 9,
      grid: carve(9, cells),
      start: { x: 1, y: 1 },
      exit: { x: 3, y: 1 },
      expectedSolution: RIGHT(2),
    });
    const r = detectInterconnect(level);
    expect(r.pass).toBe(false);
    expect(r.violations.some((v) => v.type === 'cycle')).toBe(true);
  });
});

describe('D9 与计数组合 · G5 防漏判', () => {
  it('含环分量：countDeadEndBranches 漏判(=0)，但 G5 必须经 D9 拦截', () => {
    // 复用 (c) 的含环图
    const cells: Vec2[] = [];
    for (let x = 1; x <= 3; x++) cells.push({ x, y: 1 });
    cells.push({ x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 2 });
    const level: Level = makeLevel({
      gridSize: 9,
      grid: carve(9, cells),
      start: { x: 1, y: 1 },
      exit: { x: 3, y: 1 },
      expectedSolution: RIGHT(2),
    });
    // 漏判验证：计数认为无死路（=0），但 D9 必拦
    expect(countDeadEndBranches(level)).toBe(0);
    expect(gateG5(level).pass).toBe(false);
  });
});
