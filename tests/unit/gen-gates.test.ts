// gates 单测：G1–G6 六门禁各有通过/失败对照（GDD⑤ §4）
// G4 不在 generate() 内（ADR-01 §3.10）：由 gateG4(a,b) 比对两次产出。
import { describe, it, expect } from 'vitest';
import type { Dir, KeyColor, Level, RunState, Tier } from '../../src/core/types';
import { makeLevel } from '../helpers/build-level';
import {
  gateG1,
  gateG2,
  gateG3,
  gateG4,
  gateG5,
  gateG6,
} from '../../src/gen/gates';
import { generate } from '../../src/gen/generator';
import { replay } from '../../src/gen/replay';
import { settle } from '../../src/sim/stars';

const req = (tier: Tier, seed = 0xc0ffee): { seed: number; tier: Tier; generatorVersion: number } => ({
  seed,
  tier,
  generatorVersion: 1,
});

describe('G1 可解性', () => {
  it('通过：生成关卡重放合法且终点为出口', () => {
    const res = generate(req('high'));
    expect(res.level).not.toBeNull();
    expect(gateG1(res.level!).pass).toBe(true);
  });
  it('失败：第 1 步撞墙（向上越界）', () => {
    const level = makeLevel({ expectedSolution: ['up'] as Dir[] }); // start(1,1) 上即外墙
    expect(gateG1(level).pass).toBe(false);
  });
});

describe('G2 长度上限', () => {
  it('通过：生成关卡长度 ≤ 80', () => {
    const res = generate(req('high'));
    expect(gateG2(res.level!).pass).toBe(true);
  });
  it('失败：expectedSolution 长度 81 > 80', () => {
    const level = makeLevel({ expectedSolution: Array(81).fill('right') as Dir[] });
    expect(gateG2(level).pass).toBe(false);
  });
});

describe('G3 三星可达（硬，O(path) 重放）', () => {
  it('通过：生成关卡主干自避 ⇒ 零回头路', () => {
    const res = generate(req('high'));
    expect(gateG3(res.level!).pass).toBe(true);
    expect(gateG3(res.level!).detail).toBe('backtracks=0');
  });
  it('失败：解法内存在回头（右移后折返）', () => {
    // start(1,1), exit(1,1)，走廊 (1,1)-(2,1)，解法 右→左 折返
    const level = makeLevel({
      start: { x: 1, y: 1 },
      exit: { x: 1, y: 1 },
      expectedSolution: ['right', 'left'] as Dir[],
    });
    const r = gateG3(level);
    expect(r.pass).toBe(false);
    expect(r.detail).not.toBe('backtracks=0');
  });
});

describe('G4 确定性', () => {
  it('通过：同请求两次 generate 产出逐字节相同', () => {
    const a = generate(req('mid', 4242)).level!;
    const b = generate(req('mid', 4242)).level!;
    expect(gateG4(a, b).pass).toBe(true);
  });
  it('失败：两张不同关卡 canonicalJSON 不同', () => {
    const a = generate(req('mid', 1)).level!;
    const b = makeLevel({ expectedSolution: ['up'] as Dir[] });
    expect(gateG4(a, b).pass).toBe(false);
  });
});

describe('G5 尺寸与依赖合规', () => {
  it('通过：生成关卡全部子项合规', () => {
    const res = generate(req('high'));
    expect(gateG5(res.level!).pass).toBe(true);
  });
  it('失败：外圈非全墙', () => {
    const level = generate(req('high')).level!;
    level.grid[0][0] = 'floor'; // 破坏外圈
    expect(gateG5(level).pass).toBe(false);
  });
  it('失败：依赖深度声明与计算不符 (X5)', () => {
    // 手工关：2 对门，computeLockDepth=2，但 meta.lockDepth 默认 0（X5 要求一致）
    const level = makeLevel({
      gridSize: 9,
      start: { x: 1, y: 1 },
      exit: { x: 5, y: 1 },
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 4, y: 1 } },
      ],
      doors: [
        { id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'd1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
      ],
      expectedSolution: ['right', 'right', 'right', 'right'] as Dir[],
    });
    expect(gateG5(level).pass).toBe(false); // meta.lockDepth(0) ≠ computeLockDepth(2)
  });
  it('失败：D9 含捷径（多接触点分支）被拦下', () => {
    // 构造一个含 multi-touch 捷径的关卡
    const level = makeLevel({
      gridSize: 9,
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: Array(6).fill('right') as Dir[],
    });
    // 手写网格：trunk + 两个相连分支（2 接触点，合成一个非树/多接触分量）
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) level.grid[y][x] = 'wall';
    for (let x = 1; x <= 7; x++) level.grid[1][x] = 'floor';
    level.grid[2][4] = 'floor';
    level.grid[2][5] = 'floor';
    expect(gateG5(level).pass).toBe(false);
  });
});

describe('G6 档位命中', () => {
  it('通过：mid 长度 ∈ [35,55]', () => {
    const res = generate(req('mid'));
    expect(gateG6(res.level!, 'mid').pass).toBe(true);
  });
  it('通过：high 长度 ∈ [50,80]', () => {
    const res = generate(req('high'));
    expect(gateG6(res.level!, 'high').pass).toBe(true);
  });
  it('失败：mid 关长度 10 落带外', () => {
    const level = makeLevel({ expectedSolution: Array(10).fill('right') as Dir[] });
    expect(gateG6(level, 'mid').pass).toBe(false);
  });
});

describe('Q4 交叉断言 · G3 与运行时星算一致', () => {
  it('生成关卡的 expectedSolution 喂 settle 必得 3★', () => {
    const res = generate(req('high'));
    const level = res.level!;
    const { steps } = replay(level, level.meta.expectedSolution);
    const run: RunState = {
      level,
      pos: { ...level.exit },
      keysHeld: new Set<KeyColor>(),
      doorsOpened: new Set<string>(),
      path: steps,
      undoStack: [],
      visited: new Set<string>(),
      steps: steps.length,
      elapsedMs: 0,
      finished: true,
    };
    const r = settle(run);
    expect(r).not.toBeNull();
    expect(r!.star).toBe(3); // 与 G3 同一组共享原语，必一致
    expect(r!.backtrackSegments).toBe(0);
  });
});
