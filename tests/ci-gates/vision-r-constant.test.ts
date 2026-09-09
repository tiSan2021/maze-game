// E0-1② · VISION_R === 3 常量断言（性能三前置代理，控制清单 F 组）
import { describe, it, expect } from 'vitest';
import { VISION_R } from '../../src/core/constants/metrics';

describe('CI 闸门 · VISION_R===3（M5 不可改大）', () => {
  it('VISION_R 恒等于 3', () => {
    expect(VISION_R).toBe(3);
  });
});
