// segments 单测：C1/C2/C3 契约用例（GDD② §4.3 / W2）
import { describe, it, expect } from 'vitest';
import type { Step } from '../../src/core/types';
import { splitSegments, countBacktrackSegments } from '../../src/sim/segments';

// 坐标：S(0,0) A(1,0) B(2,0) C(3,0) D(1,1) E(1,2)
function step(from: [number, number], to: [number, number], dir: Step['dir'], ev: Step['progressEvent']): Step {
  return { from: { x: from[0], y: from[1] }, to: { x: to[0], y: to[1] }, dir, progressEvent: ev };
}

// C1：Start→A→B→C[钥匙]→B→A→D→E[出口]，段内各自无重复 → 0 回头路 → 3★
const C1: Step[] = [
  step([0, 0], [1, 0], 'right', null),
  step([1, 0], [2, 0], 'right', null),
  step([2, 0], [3, 0], 'right', { kind: 'key', color: 0 }),
  step([3, 0], [2, 0], 'left', null),
  step([2, 0], [1, 0], 'left', null),
  step([1, 0], [1, 1], 'down', null),
  step([1, 1], [1, 2], 'down', null),
];

// C2：Start→A→B[空死路]→A→C[钥匙]→D→E[出口]，段内 A 重复 → 1 回头路 → 2★
const C2: Step[] = [
  step([0, 0], [1, 0], 'right', null),
  step([1, 0], [2, 0], 'right', null),
  step([2, 0], [1, 0], 'left', null),
  step([1, 0], [1, 1], 'down', { kind: 'key', color: 0 }),
  step([1, 1], [2, 1], 'right', null),
  step([2, 1], [2, 2], 'down', null),
];

// C3：Start→A→B[门锁着]→A→C[蓝钥匙]→…→出口，结构与 C2 相同 → 1 回头路 → 2★
const C3: Step[] = C2;

describe('sim/segments · C1/C2/C3 契约', () => {
  it('C1 = 0 回头路段 → 3★', () => {
    const segs = splitSegments({ x: 0, y: 0 }, C1);
    expect(countBacktrackSegments(segs)).toBe(0);
    expect(segs).toHaveLength(2); // 1 个进度事件 → 2 段
  });
  it('C2 = 1 回头路段 → 2★', () => {
    const segs = splitSegments({ x: 0, y: 0 }, C2);
    expect(countBacktrackSegments(segs)).toBe(1);
  });
  it('C3 = 1 回头路段 → 2★', () => {
    const segs = splitSegments({ x: 0, y: 0 }, C3);
    expect(countBacktrackSegments(segs)).toBe(1);
  });
  it('B2 空路径 = 1 段 0 回头路', () => {
    const segs = splitSegments({ x: 0, y: 0 }, []);
    expect(segs).toHaveLength(1);
    expect(countBacktrackSegments(segs)).toBe(0);
  });
  it('复杂度 O(path)：500 步平均调用 < 3ms', () => {
    const path: Step[] = Array.from({ length: 500 }, (_, i) =>
      step([i, 0], [i + 1, 0], 'right', null),
    );
    // 预热：消除首次 JIT 编译 / GC 抖动
    countBacktrackSegments(splitSegments({ x: 0, y: 0 }, path));
    const ITER = 50;
    const t0 = performance.now();
    for (let i = 0; i < ITER; i++) {
      countBacktrackSegments(splitSegments({ x: 0, y: 0 }, path));
    }
    const avg = (performance.now() - t0) / ITER;
    // 阈值 3ms（原 1ms）：1ms 零余量，CI 并行跑生成器重型用例时 CPU 争用会偶发误判
    // （实测尖峰 1.15–1.65ms）。O(path) 契约仍然有效：退化到 O(n²) 会远超 3ms。
    expect(avg).toBeLessThan(3);
  });
});
