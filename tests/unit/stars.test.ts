// stars 单测：settle 调唯一原语，C1→3★（GDD④ §4.1 / S1）
import { describe, it, expect } from 'vitest';
import type { RunState, Step } from '../../src/core/types';
import { makeLevel } from '../helpers/build-level';
import { settle } from '../../src/sim/stars';
import { countBacktrackSegments, splitSegments } from '../../src/sim/segments';

function step(from: [number, number], to: [number, number], dir: Step['dir'], ev: Step['progressEvent']): Step {
  return { from: { x: from[0], y: from[1] }, to: { x: to[0], y: to[1] }, dir, progressEvent: ev };
}

const C1: Step[] = [
  step([0, 0], [1, 0], 'right', null),
  step([1, 0], [2, 0], 'right', null),
  step([2, 0], [3, 0], 'right', { kind: 'key', color: 0 }),
  step([3, 0], [2, 0], 'left', null),
  step([2, 0], [1, 0], 'left', null),
  step([1, 0], [1, 1], 'down', null),
  step([1, 1], [1, 2], 'down', null),
];

function runWith(path: Step[], finished = true): RunState {
  const level = makeLevel();
  return {
    level,
    pos: { x: 1, y: 2 },
    keysHeld: new Set(),
    doorsOpened: new Set(),
    path,
    undoStack: [],
    visited: new Set(),
    steps: path.length,
    elapsedMs: 0,
    finished,
  };
}

describe('sim/stars · settle', () => {
  it('C1 路径 + finished → 3★', () => {
    const r = settle(runWith(C1));
    expect(r).not.toBeNull();
    expect(r!.star).toBe(3);
    expect(r!.backtrackSegments).toBe(0);
  });
  it('未通关 finished=false → 返回 null（B4/Y1）', () => {
    expect(settle(runWith(C1, false))).toBeNull();
  });
  it('settle 内部确实复用共享原语（数字与直接调用一致，S2）', () => {
    const r = settle(runWith(C1))!;
    const direct = countBacktrackSegments(splitSegments({ x: 0, y: 0 }, C1));
    expect(r.backtrackSegments).toBe(direct);
  });
  it('明细与判定一致（S5）', () => {
    const r = settle(runWith(C1))!;
    expect(r.segments.filter((s) => s.isBacktrack).length).toBe(r.backtrackSegments);
  });
});
