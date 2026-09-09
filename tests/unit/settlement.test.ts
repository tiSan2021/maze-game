// settlement.test.ts · 结算面板（E5-3 / GDD④ §2.3 / UX §1.1 S4）
// 断言渲染出的 HTML 字符串（Node 无 DOM，不做"看一眼"式验证）。
import { describe, it, expect } from 'vitest';
import { renderSettlementHtml, renderStars, formatDuration } from '../../src/ui/settlement';
import type { SettlementModel } from '../../src/ui/settlement';

const BASE: SettlementModel = {
  star: 3,
  segmentCount: 3,
  backtrackSegments: 0,
  steps: 42,
  elapsedMs: 65000,
  hasNext: false,
};

describe('settlement · 明细渲染', () => {
  it('三星 + 零回头路：星级、段数、步数、用时齐全', () => {
    const html = renderSettlementHtml(BASE);
    expect(html).toContain('★★★');
    expect(html).toContain('共 3 段');
    expect(html).toContain('零回头路');
    expect(html).toContain('步数 42');
    expect(html).toContain('01:05'); // 65s
  });

  it('有回头路时给出「N 段走了冤枉路」（惩罚可解释）', () => {
    const html = renderSettlementHtml({ ...BASE, star: 1, backtrackSegments: 4 });
    expect(html).toContain('★☆☆');
    expect(html).toContain('4 段走了冤枉路');
    expect(html).not.toContain('零回头路');
  });

  it('hasNext 控制「下一关」按钮是否出现', () => {
    expect(renderSettlementHtml({ ...BASE, hasNext: false })).not.toContain('下一关');
    expect(renderSettlementHtml({ ...BASE, hasNext: true })).toContain('下一关');
  });

  it('历史最佳与刷新纪录文案', () => {
    const first = renderSettlementHtml({ ...BASE, bestStar: null, isNewBest: true });
    expect(first).toContain('首次通关记录已保存');

    const improved = renderSettlementHtml({ ...BASE, star: 3, bestStar: 2, isNewBest: true });
    expect(improved).toContain('刷新历史最佳');
    expect(improved).toContain('★★☆'); // 原最佳

    const kept = renderSettlementHtml({ ...BASE, star: 1, bestStar: 3, isNewBest: false });
    expect(kept).toContain('历史最佳 ★★★');
    expect(kept).toContain('本次未超越');
  });

  it('关卡标签（每日 · 中/高）可显示在面板上', () => {
    expect(renderSettlementHtml({ ...BASE, label: '每日 · 中' })).toContain('每日 · 中');
  });
});

describe('settlement · 纯函数', () => {
  it('renderStars：1–3 星', () => {
    expect(renderStars(1)).toBe('★☆☆');
    expect(renderStars(2)).toBe('★★☆');
    expect(renderStars(3)).toBe('★★★');
  });

  it('formatDuration：mm:ss，负数与不足 1 分钟', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(9_000)).toBe('00:09');
    expect(formatDuration(605_000)).toBe('10:05');
    expect(formatDuration(-100)).toBe('00:00');
  });
});
