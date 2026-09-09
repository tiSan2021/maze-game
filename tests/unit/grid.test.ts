// grid 纯函数单测（E1-11）
import { describe, it, expect } from 'vitest';
import { key, keyXY, neighbor, opposite, chebyshev, inBounds, EIGHT_OFFSETS } from '../../src/util/grid';

describe('util/grid', () => {
  it('key / keyXY 一致', () => {
    expect(key({ x: 3, y: 5 })).toBe('3,5');
    expect(keyXY(3, 5)).toBe('3,5');
  });
  it('neighbor 四向', () => {
    expect(neighbor({ x: 2, y: 2 }, 'right')).toEqual({ x: 3, y: 2 });
    expect(neighbor({ x: 2, y: 2 }, 'up')).toEqual({ x: 2, y: 1 });
  });
  it('opposite 反向', () => {
    expect(opposite('left')).toBe('right');
  });
  it('chebyshev 切比雪夫', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
  });
  it('inBounds 边界', () => {
    expect(inBounds(9, { x: 0, y: 0 })).toBe(true);
    expect(inBounds(9, { x: -1, y: 0 })).toBe(false);
    expect(inBounds(9, { x: 9, y: 0 })).toBe(false);
  });
  it('EIGHT_OFFSETS 为 8 邻域', () => {
    expect(EIGHT_OFFSETS).toHaveLength(8);
  });
});
