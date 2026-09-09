// level-best.test.ts · 选关页最佳成绩行（步数 / 用时）
// 覆盖：时长格式化边界、无记录返回空串、正常记录拼接、超大值不截断。
import { describe, it, expect } from 'vitest';
import { formatBestLine } from '../../src/ui/level-best';
import { formatDuration } from '../../src/ui/format';
import type { LevelRecord } from '../../src/sim/progress';

const rec = (star: 1 | 2 | 3, steps: number, ms: number): LevelRecord => ({
  bestStar: star,
  bestStarSteps: steps,
  bestStarElapsedMs: ms,
});

describe('format · 时长格式化（HUD 与选关共用）', () => {
  it('0ms → 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('不足 1 分补零：7.9s → 00:07（向下取整，不四舍五入）', () => {
    expect(formatDuration(7_900)).toBe('00:07');
  });

  it('跨分钟：65s → 01:05', () => {
    expect(formatDuration(65_000)).toBe('01:05');
  });

  it('≥1 小时分钟位继续累加，不截断回 00（60 分钟 → 60:00）', () => {
    expect(formatDuration(3_600_000)).toBe('60:00');
  });
});

describe('level-best · 最佳成绩行', () => {
  it('无记录（null / undefined）→ 空串，调用方据此不渲染该行', () => {
    expect(formatBestLine(null)).toBe('');
    expect(formatBestLine(undefined)).toBe('');
  });

  it('有记录 → 「步数 步 · mm:ss」', () => {
    expect(formatBestLine(rec(3, 42, 65_000))).toBe('42 步 · 01:05');
  });

  it('取的是最优步数/用时，与星级无关（同星取更优）', () => {
    expect(formatBestLine(rec(1, 12, 3_000))).toBe('12 步 · 00:03');
    expect(formatBestLine(rec(3, 12, 3_000))).toBe('12 步 · 00:03');
  });
});
