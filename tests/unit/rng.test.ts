// rng 单测：确定性 + fnv1a32 唯一实现（ADR-01）
import { describe, it, expect } from 'vitest';
import { mulberry32, fnv1a32, deriveAttemptSeed, getSeed, getDateKeyUTC } from '../../src/core/rng';

describe('core/rng', () => {
  it('mulberry32 同种子逐字节可重放（DQ1/A2）', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('mulberry32 不同种子产出不同序列', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('fnv1a32 空串返回 offset basis（0x811c9dc5），且 "abc" 向量稳定', () => {
    // 空串不做任何迭代，直接返回 offset basis
    expect(fnv1a32('')).toBe(0x811c9dc5);
    // 与独立参考实现一致（逐字照抄 ADR-01 §3 的算法）
    expect(fnv1a32('abc')).toBe(0x1a47e90b);
  });

  it('deriveAttemptSeed 八条流互不相同且可复现（ADR-01 §3.4 / A7）', () => {
    const seed = 0xdeadbeef >>> 0;
    const streams = Array.from({ length: 8 }, (_, i) => deriveAttemptSeed(seed, i));
    expect(new Set(streams).size).toBe(8);
    expect(deriveAttemptSeed(seed, 0)).toBe(deriveAttemptSeed(seed, 0));
  });

  it('getSeed 版本参与派生，同 (dateKey,tier,version) 稳定（DQ1/D10）', () => {
    const k = { dateKey: '2026-09-07', tier: 'mid' as const, generatorVersion: 1 };
    expect(getSeed(k)).toBe(getSeed(k));
    expect(getSeed({ ...k, generatorVersion: 2 })).not.toBe(getSeed(k));
  });

  it('getDateKeyUTC 返回 UTC YYYY-MM-DD', () => {
    expect(getDateKeyUTC(new Date(Date.UTC(2026, 8, 7, 23, 0, 0)))).toBe('2026-09-07');
  });
});
