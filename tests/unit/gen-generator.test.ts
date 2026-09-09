// generator 单测（GDD⑤ §5）：构造式生成 + 门禁集成 + 兜底 + 确定性
import { describe, it, expect } from 'vitest';
import type { Tier } from '../../src/core/types';
import { generate, GENERATOR_VERSION } from '../../src/gen/generator';
import {
  gateG1,
  gateG2,
  gateG3,
  gateG5,
  gateG6,
  gateG4,
  runGates,
} from '../../src/gen/gates';
import { getFallbackLevel } from '../../src/gen/fallback';
import { getSeed } from '../../src/core/rng';

describe('generate 产出满足全部静态门禁', () => {
  for (const tier of ['mid', 'high'] as Tier[]) {
    it(`${tier}：G1/G2/G3/G5/G6 全过且未用兜底`, () => {
      const res = generate({ seed: 0x1234 + (tier === 'mid' ? 0 : 7), tier, generatorVersion: 1 });
      expect(res.level).not.toBeNull();
      expect(res.fallbackUsed).toBe(false);
      const gates = runGates(res.level!, tier);
      for (const g of gates) expect(g.pass, `${g.gate}: ${g.detail}`).toBe(true);
    });
  }
});

describe('generate 确定性（G4 前提）', () => {
  it('同 (seed,tier,version) 两次产出逐字节相同', () => {
    const a = generate({ seed: 555, tier: 'high', generatorVersion: 1 });
    const b = generate({ seed: 555, tier: 'high', generatorVersion: 1 });
    expect(gateG4(a.level!, b.level!).pass).toBe(true);
    expect(a.attempts).toBe(b.attempts);
    expect(a.fallbackUsed).toBe(b.fallbackUsed);
  });
  it('版本参与派生：version 不同 ⇒ 产出不同（DQ4/D10）', () => {
    // 版本经 getSeed 进入种子派生（GDD⑥ §4.3），故 version 不同 ⇒ request.seed 不同 ⇒ 产出不同
    const dateKey = '2026-09-08';
    const sa = getSeed({ dateKey, tier: 'high', generatorVersion: 1 });
    const sb = getSeed({ dateKey, tier: 'high', generatorVersion: 2 });
    const a = generate({ seed: sa, tier: 'high', generatorVersion: 1 }).level!;
    const b = generate({ seed: sb, tier: 'high', generatorVersion: 2 }).level!;
    expect(gateG4(a, b).pass).toBe(false);
  });
});

describe('兜底关卡（Q8/DQ6）', () => {
  it('forceFallback 返回通过全部门禁的关卡', () => {
    for (const tier of ['mid', 'high'] as Tier[]) {
      const res = generate({ seed: 1, tier, generatorVersion: 1 }, { forceFallback: true });
      expect(res.fallbackUsed).toBe(true);
      expect(res.level).not.toBeNull();
      expect(gateG1(res.level!).pass).toBe(true);
      expect(gateG2(res.level!).pass).toBe(true);
      expect(gateG3(res.level!).pass).toBe(true);
      expect(gateG5(res.level!).pass).toBe(true);
      expect(gateG6(res.level!, tier).pass).toBe(true);
    }
  });
  it('getFallbackLevel(mid/high) 长度命中档位区间', () => {
    expect(getFallbackLevel('mid').meta.expectedSolution.length).toBeGreaterThanOrEqual(35);
    expect(getFallbackLevel('mid').meta.expectedSolution.length).toBeLessThanOrEqual(55);
    expect(getFallbackLevel('high').meta.expectedSolution.length).toBeGreaterThanOrEqual(50);
    expect(getFallbackLevel('high').meta.expectedSolution.length).toBeLessThanOrEqual(80);
  });
});

describe('生成器约束', () => {
  it('GENERATOR_VERSION 为 1（D10 绑定）', () => {
    expect(GENERATOR_VERSION).toBe(1);
  });
});
