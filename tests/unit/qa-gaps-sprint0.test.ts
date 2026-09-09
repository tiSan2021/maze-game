// quality-lead (P5-S0S1-QA) · Sprint 0/1 第二层验证补充测试
// 目标：覆盖主理人独立复核后仍暴露的域内核真实缺口（不修改 src/，仅新增测试）。
// 注意：本文件及注释不得写出内建随机函数字面量（DQ3 自指陷阱，参照 dq3-no-math-random.test.ts）。
import { describe, it, expect } from 'vitest';
import type { GridCell, KeyColor, Level, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel, setFloor } from '../helpers/build-level';
import { initRunState, applySlide } from '../../src/sim/runstate';
import { popSnapshot } from '../../src/input/undo';
import { computeLockDepth, UNSOLVABLE } from '../../src/sim/lockkey';
import { settle } from '../../src/sim/stars';
import { computeVisibility } from '../../src/sim/visibility';
import { inBounds } from '../../src/util/grid';

/** 内部全墙、仅 carved 为地板（单一走廊） */
function carve(gridSize: number, floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(gridSize);
  for (let y = 1; y <= gridSize - 2; y++)
    for (let x = 1; x <= gridSize - 2; x++) g[y][x] = 'wall';
  for (const p of floors) setFloor(g, p.x, p.y);
  return g;
}

describe('QA 缺口 · K6 锁钥深度=3 上界', () => {
  it('3 层串联依赖链在上界内 → computeLockDepth 返回 3', () => {
    // 单行直线：s→k0→d0→k1→d1→k2→d2→exit；必须顺序 3 轮解锁才能到出口。
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const floors: Vec2[] = xs.map((x) => ({ x, y: 1 }));
    const level = makeLevel({
      gridSize: 13,
      grid: carve(13, floors),
      start: { x: 1, y: 1 },
      exit: { x: 8, y: 1 },
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 4, y: 1 } },
        { id: 'k2', color: 2 as KeyColor, pos: { x: 6, y: 1 } },
      ],
      doors: [
        { id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'd1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
        { id: 'd2', color: 2 as KeyColor, pos: { x: 7, y: 1 } },
      ],
    });
    // 引擎已扩容：泛洪轮次 2 → 3，故三锁链不再是「超上界」，而是合法的最大深度
    expect(computeLockDepth(level)).toBe(3);
  });

  it('钥匙锁在自家门后 → 仍为 UNSOLVABLE', () => {
    const floors: Vec2[] = [1, 2, 3, 4, 5].map((x) => ({ x, y: 1 }));
    const level = makeLevel({
      gridSize: 13,
      grid: carve(13, floors),
      start: { x: 1, y: 1 },
      exit: { x: 5, y: 1 },
      // k0 位于 d0 之后 ⇒ 永远取不到 k0 ⇒ 出口不可达
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 4, y: 1 } }],
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } }],
    });
    expect(computeLockDepth(level)).toBe(UNSOLVABLE);
  });
});

describe('QA 缺口 · 非 expectedSolution 路径的星级（2 回头路段 → 1★）', () => {
  it('玩家实际路径含 2 个段内回头 → settle 返回 1★', () => {
    const step = (
      from: [number, number],
      to: [number, number],
      dir: 'up' | 'down' | 'left' | 'right',
      ev: null | { kind: 'key'; color: KeyColor } | { kind: 'door'; doorId: string },
    ) => ({ from: { x: from[0], y: from[1] }, to: { x: to[0], y: to[1] }, dir, progressEvent: ev });

    // 段 A: (0,0)→(1,0)→(0,0) 含重复（回头）；事件 key@(0,1)
    // 段 B: (0,1)→(1,1)→(0,1) 含重复（回头）；事件 key@(0,2)
    // 段 C: (0,2)→(1,2)→(2,2) 出口，无重复
    const path = [
      step([0, 0], [1, 0], 'right', null),
      step([1, 0], [0, 0], 'left', null),
      step([0, 0], [0, 1], 'down', { kind: 'key', color: 0 }),
      step([0, 1], [1, 1], 'right', null),
      step([1, 1], [0, 1], 'left', null),
      step([0, 1], [0, 2], 'down', { kind: 'key', color: 1 }),
      step([0, 2], [1, 2], 'right', null),
      step([1, 2], [2, 2], 'right', null),
    ];

    // 注意：路径坐标为 0 基，故 level.start 必须设为 (0,0)，否则 splitSegments 会以 (1,1) 起段，漏算一次段内回头。
    const level = makeLevel({ start: { x: 0, y: 0 } });
    const run = {
      level,
      pos: { x: 2, y: 2 },
      keysHeld: new Set<KeyColor>(),
      doorsOpened: new Set<string>(),
      path,
      undoStack: [],
      visited: new Set<string>(),
      steps: path.length,
      elapsedMs: 0,
      finished: true,
    };
    const r = settle(run);
    expect(r).not.toBeNull();
    expect(r!.backtrackSegments).toBe(2);
    expect(r!.star).toBe(1); // 2 回头路段 → 1★（S1 下限分支，此前未被覆盖）
  });
});

describe('QA 缺口 · 连续多次滑行后撤销（快照深拷贝防别名，R-B）', () => {
  it('两次滑行（各拾 1 钥匙）后撤销一次 → keysHeld 回滚到滑行1末态且不被别名污染', () => {
    // 直线 y=1 走廊 (1..5)，(5,2) 留作路口使滑行1止于 (3,1) 钥匙0 之后、滑行2 止于 (5,1) 钥匙1。
    const floors: Vec2[] = [];
    for (let x = 1; x <= 5; x++) floors.push({ x, y: 1 });
    floors.push({ x: 5, y: 2 }); // 制造 (5,1) 的下方通路 → 路口
    const level = makeLevel({
      gridSize: 9,
      grid: carve(9, floors),
      start: { x: 1, y: 1 },
      exit: { x: 5, y: 2 },
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
      ],
    });
    const state = initRunState(level);
    applySlide(state, 'right'); // 滑行1：拾 key0，止于 (3,1)
    expect(state.keysHeld.has(0)).toBe(true);
    const visitedAfterG1 = state.visited.size;
    applySlide(state, 'right'); // 滑行2：拾 key1，止于 (5,1)
    expect(state.keysHeld.has(0)).toBe(true);
    expect(state.keysHeld.has(1)).toBe(true);
    const visitedAfterG2 = state.visited.size; // 单调，必 ≥ 滑行1 末态
    expect(visitedAfterG2).toBeGreaterThan(visitedAfterG1);

    const ok = popSnapshot(state); // 撤销滑行2
    expect(ok).toBe(true);
    // 关键：keysHeld 必须回到滑行1末态 {0}，若快照与 state 别名（引用同一 Set）则会被滑行2污染为 {0,1}
    expect([...state.keysHeld].sort()).toEqual([0]);
    expect(state.path).toHaveLength(2); // 滑行2 的 2 格被擦除（D5）
    expect(state.visited.size).toBe(visitedAfterG2); // visited 单调不回滚（D11）：撤销后仍为滑行2末态，不因撤销而缩小
  });
});

describe('QA 缺口 · 地图边缘视野（computeVisibility 不越界）', () => {
  it('玩家位于角落 (1,1) 时，visible 集合全部为合法网格坐标（inBounds 守卫）', () => {
    const level: Level = makeLevel({ visionMode: 'fog' }); // 9×9，内部 1..7
    const visited = new Set<string>(['1,1']);
    const visible = computeVisibility(level, { x: 1, y: 1 }, visited);
    expect(visible.size).toBeGreaterThan(0);
    for (const ck of visible) {
      const [x, y] = ck.split(',').map(Number);
      expect(inBounds(level.gridSize, { x, y })).toBe(true); // 不得含越界键
    }
  });
});
