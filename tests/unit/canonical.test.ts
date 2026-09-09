// canonicalJSON 单测（E1-12 / GDD② X7 / GDD⑤ G4）
import { describe, it, expect } from 'vitest';
import { canonicalJSON } from '../../src/core/canonical';

describe('core/canonical', () => {
  it('键排序后逐字节稳定', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }));
  });
  it('嵌套对象同样键排序', () => {
    const x = { z: { b: 1, a: 2 }, a: 3 };
    const y = { a: 3, z: { a: 2, b: 1 } };
    expect(canonicalJSON(x)).toBe(canonicalJSON(y));
  });
  it('数组顺序保留', () => {
    expect(canonicalJSON([3, 1, 2])).not.toBe(canonicalJSON([1, 2, 3]));
  });
});
