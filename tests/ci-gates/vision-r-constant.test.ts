// E0-1② · VISION_R === 2 常量断言（性能三前置代理，控制清单 F 组）
// 2026-09-09：由 3 缩至 2。ADR-03 仅禁止把 R 改「大」（4/5 突破预算），缩小不在禁止范围。
import { describe, it, expect } from 'vitest';
import { VISION_R } from '../../src/core/constants/metrics';

describe('CI 闸门 · VISION_R===2（M5 不可改大，但可缩小）', () => {
  it('VISION_R 恒等于 2', () => {
    expect(VISION_R).toBe(2);
  });
});
