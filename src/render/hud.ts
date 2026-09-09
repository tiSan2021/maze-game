// hud.ts · 顶部 32px DOM HUD（E2-6 / GDD① §4.8 / V8）
// HUD 走 DOM、aria-live，不占迷宫区高度（顶栏独立）。renderHudHtml 为纯函数（Node 可测）；
// mountHud 才触碰 DOM，便于测试与可访问性镜像。

import { HUD_H } from '../core/constants/metrics';
import { KEY_COLORS } from '../core/constants/palette';
import { formatDuration } from '../ui/format';
import type { KeyColor } from '../core/types';

export interface HudModel {
  levelId: string;
  timeMs: number;
  steps: number;
  keysHeld: ReadonlyArray<KeyColor>;
  totalKeys: number;
  fog: boolean;
  /** 回溯段数（快照栈深度）：当前本局可撤销的滑行次数；撤销 −1、重开清零（ux-spec §2.2） */
  undoSegments?: number;
  /** 星级预览（1–3★，0 = 尚无）：依据当前 path/steps 实时估算的预览，非结算值 */
  starPreview?: 0 | 1 | 2 | 3;
  /** 门状态：已开/总门数；无关卡锁时为 null（该区留空） */
  doorStatus?: { opened: number; total: number } | null;
  /** 展示用关卡标签（"第 7 关" / "每日 · 中"）；缺省退回 levelId（UX §2.2） */
  levelLabel?: string;
}

/** 纯函数：输出 HUD 的 HTML 字符串（含 aria-live，屏幕阅读器可感知） */
export function renderHudHtml(m: HudModel): string {
  const undoSegments = m.undoSegments ?? 0;
  const starPreview = m.starPreview ?? 0;
  const door = m.doorStatus ?? null;

  const swatches = [0, 1, 2]
    .map((i) => {
      const held = m.keysHeld.includes(i as KeyColor);
      const dim = held ? '' : 'opacity:0.3;';
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${KEY_COLORS[i]};${dim}"></span>`;
    })
    .join('');

  // 门状态：仅在有锁关卡显示（已开/总）；无关卡锁时留空（ux-spec §2.2）
  const doorStatus = door && door.total > 0
    ? `<span>门 ${door.opened}/${door.total}</span>`
    : '';

  // 星级预览：★ 实心 / ☆ 空心，随当前路径实时估算（非结算值）
  const stars = '★'.repeat(starPreview) + '☆'.repeat(3 - starPreview);

  // 操作提示常驻（ux-spec §2.1 / §2.2 右(常驻)），次要色复用既有图例色 #A89878
  const hint = `<span style="color:#A89878">Z 撤销 · R 重开 · Esc 返回</span>`;

  const legend = m.fog
    ? `<span style="margin-left:12px;font-size:calc(11px * var(--ui-scale));">图例:` +
      `<span style="color:#A89878">■见过</span> ` +
      `<span style="color:#CFC5B0">■走过</span> ` +
      `<span style="color:#E4DCCE;border:1px solid #999">■未知</span></span>`
    : '';

  return (
    `<div class="hud" role="status" aria-live="polite" aria-label="关卡状态" ` +
    `style="height:${HUD_H}px;display:flex;align-items:center;justify-content:space-between;` +
    `padding:0 12px;background:#EFEADC;border-bottom:1.5px solid #C9BFA9;font-family:system-ui,sans-serif;font-size:calc(13px * var(--ui-scale));color:#2A2419;">` +
    `<span>关卡 ${m.levelLabel ?? m.levelId}</span>` +
    `<span>${formatDuration(m.timeMs)}</span>` +
    `<span>步数 ${m.steps} · 钥匙 ${swatches} (${m.keysHeld.length}/${m.totalKeys})</span>` +
    doorStatus +
    `<span>回溯 ${undoSegments}</span>` +
    `<span aria-label="星级预览">${stars}</span>` +
    hint +
    legend +
    `</div>`
  );
}

/**
 * 挂载到 DOM 容器（仅调用时触碰 DOM）。
 * 增量更新：内容未变则不重写 DOM，避免 aria-live 区域被整体重播造成屏幕阅读器抖动（ux-spec §2.1）。
 */
export function mountHud(container: HTMLElement, model: HudModel): void {
  const html = renderHudHtml(model);
  if (container.innerHTML === html) return;
  container.innerHTML = html;
}
