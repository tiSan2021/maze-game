// hud.test.ts · 顶部 32px DOM HUD 的纯字符串核心（aria-live，V8 不占迷宫区高度）
import { describe, it, expect } from 'vitest';
import { renderHudHtml } from '../../src/render/hud';
import { HUD_H } from '../../src/core/constants/metrics';

describe('HUD · DOM aria-live 与结构', () => {
  it('输出含 role=status 与 aria-live=polite（屏幕阅读器可感知）', () => {
    const html = renderHudHtml({ levelId: '03', timeMs: 42000, steps: 128, keysHeld: [], totalKeys: 2, fog: false });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('高度为 HUD_H（32px），不侵占迷宫区', () => {
    const html = renderHudHtml({ levelId: '09', timeMs: 1000, steps: 1, keysHeld: [0], totalKeys: 1, fog: true });
    expect(html).toContain(`height:${HUD_H}px`);
  });

  it('fog 关卡附四态迷你图例', () => {
    const html = renderHudHtml({ levelId: '09', timeMs: 1000, steps: 1, keysHeld: [], totalKeys: 1, fog: true });
    expect(html).toContain('图例');
  });

  it('full 关卡无图例；含关卡/时间/步数', () => {
    const html = renderHudHtml({ levelId: '03', timeMs: 42000, steps: 128, keysHeld: [], totalKeys: 0, fog: false });
    expect(html).not.toContain('图例');
    expect(html).toContain('关卡 03');
    expect(html).toContain('00:42');
    expect(html).toContain('步数 128');
  });
});

describe('HUD · ux-spec 补齐字段（P5-S3.5-DEBT）', () => {
  it('undoSegments 展示回溯段数（快照栈深度）', () => {
    const html = renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, undoSegments: 5 });
    expect(html).toContain('回溯 5');
  });

  it('undoSegments 缺省为 0（重开/无历史）', () => {
    const html = renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false });
    expect(html).toContain('回溯 0');
  });

  it('starPreview 用 ★/☆ 表达 1–3★ 预览', () => {
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, starPreview: 1 })).toContain('★☆☆');
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, starPreview: 2 })).toContain('★★☆');
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, starPreview: 3 })).toContain('★★★');
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false })).toContain('☆☆☆');
  });

  it('doorStatus 仅在有关卡锁时展示 已开/总', () => {
    const html = renderHudHtml({ levelId: '05', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, doorStatus: { opened: 2, total: 3 } });
    expect(html).toContain('门 2/3');
  });

  it('doorStatus 为 null 或 total=0 时留空（无锁关卡）', () => {
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, doorStatus: null })).not.toContain('门');
    expect(renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false, doorStatus: { opened: 0, total: 0 } })).not.toContain('门');
  });

  it('操作提示常驻 Z 撤销 · R 重开 · Esc 返回', () => {
    const html = renderHudHtml({ levelId: '03', timeMs: 0, steps: 0, keysHeld: [], totalKeys: 0, fog: false });
    expect(html).toContain('Z 撤销 · R 重开 · Esc 返回');
  });

  it('三字段同屏共存（含钥匙/图例/时间/步数）', () => {
    const html = renderHudHtml({ levelId: '09', timeMs: 65000, steps: 12, keysHeld: [0, 2], totalKeys: 3, fog: true, undoSegments: 3, starPreview: 2, doorStatus: { opened: 1, total: 2 } });
    expect(html).toContain('关卡 09');
    expect(html).toContain('01:05');
    expect(html).toContain('步数 12');
    expect(html).toContain('回溯 3');
    expect(html).toContain('★★☆');
    expect(html).toContain('门 1/2');
    expect(html).toContain('图例');
  });
});
