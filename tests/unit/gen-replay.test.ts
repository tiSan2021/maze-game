// replay 单测（GDD⑤ §4.1 / GDD② §5.1）：重放验证 G1/G3
import { describe, it, expect } from 'vitest';
import type { Dir } from '../../src/core/types';
import { makeLevel } from '../helpers/build-level';
import { replay } from '../../src/gen/replay';
import { generate } from '../../src/gen/generator';

describe('replay 重放', () => {
  it('生成关卡的 expectedSolution 重放成功并返回 Step[]', () => {
    const res = generate({ seed: 99, tier: 'mid', generatorVersion: 1 });
    const { steps } = replay(res.level!, res.level!.meta.expectedSolution);
    expect(steps.length).toBe(res.level!.meta.expectedSolution.length);
    expect(steps[steps.length - 1].to).toEqual(res.level!.exit);
  });

  it('Z3：中途撞墙抛错并报坐标', () => {
    const level = makeLevel({ expectedSolution: ['up'] as Dir[] }); // start(1,1) 上即外墙
    expect(() => replay(level, level.meta.expectedSolution)).toThrow(/第 1 步/);
  });

  it('Z2：空解法无法抵达出口抛错', () => {
    const level = makeLevel({ start: { x: 1, y: 1 }, exit: { x: 5, y: 5 }, expectedSolution: [] });
    expect(() => replay(level, level.meta.expectedSolution)).toThrow(/未抵达出口/);
  });

  it('门按序开启：先拾钥匙后过门', () => {
    // 直线 y=1：s→k0→d0→exit；重放后 doorsOpened 含 d0
    const level = makeLevel({
      gridSize: 9,
      start: { x: 1, y: 1 },
      exit: { x: 5, y: 1 },
      keys: [{ id: 'k0', color: 0, pos: { x: 2, y: 1 } }],
      doors: [{ id: 'd0', color: 0, pos: { x: 3, y: 1 } }],
      expectedSolution: ['right', 'right', 'right', 'right'] as Dir[],
    });
    const { steps } = replay(level, level.meta.expectedSolution);
    const doorEvt = steps.find((s) => s.progressEvent?.kind === 'door');
    expect(doorEvt).toBeDefined();
    expect(doorEvt!.progressEvent).toEqual({ kind: 'door', doorId: 'd0' });
  });
});
