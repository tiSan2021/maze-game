// hud.ts · 顶部 32px DOM HUD（E2-6 / GDD① §4.8 / V8）
// HUD 走 DOM、aria-live，不占迷宫区高度（顶栏独立）。renderHudHtml 为纯函数（Node 可测）；
// mountHud 才触碰 DOM，便于测试与可访问性镜像。

import { HUD_H } from '../core/constants/metrics';
import {
  KEY_COLORS,
  PAPER,
  PAPER_WALKED,
  GRID_VIEW,
  GRID_MEMORY,
  GRID_UNKNOWN,
  INK,
  UI_BORDER,
  UI_TEXT,
} from '../core/constants/palette';
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

  // 迷雾四态迷你图例（U4 / ux-spec §2.3 / art-bible v2）：色块直绘实际细胞视觉
  // ——旧版直接套 GRID_* 线色做 ■，与 HUD 底 (#EFEADC) 对比 <1.7:1，几近不可见；
  // 现改为 12×12 CSS 色块，背景用 PAPER/PAPER_WALKED+网格/铅笔痕还原细胞，靠 UI_BORDER 边框区分。
  // 见过：PAPER + GRID_VIEW 网格（=VIEW_UNWALKED 视野内未踩）
  // 走过：PAPER_WALKED + INK 45° 铅笔痕 + GRID_MEMORY 网格（=VIEW_WALKED 已踩 + 笔迹）
  // 未知：PAPER + GRID_UNKNOWN 边框（=UNKNOWN 未探索；背景同 HUD，必须靠边框区分）
  const seenSwatch = `<span style="display:inline-block;width:12px;height:12px;vertical-align:middle;border:1px solid ${UI_BORDER};background:${PAPER};background-image:linear-gradient(to right,${GRID_VIEW} 1px,transparent 1px),linear-gradient(to bottom,${GRID_VIEW} 1px,transparent 1px);background-size:5px 5px"></span>`;
  const walkedSwatch = `<span style="display:inline-block;width:12px;height:12px;vertical-align:middle;border:1px solid ${UI_BORDER};background:${PAPER_WALKED};background-image:repeating-linear-gradient(45deg,transparent 0,transparent 3px,${INK} 3px,${INK} 4px),linear-gradient(to right,${GRID_MEMORY} 1px,transparent 1px),linear-gradient(to bottom,${GRID_MEMORY} 1px,transparent 1px);background-size:auto,5px 5px,5px 5px"></span>`;
  const unknownSwatch = `<span style="display:inline-block;width:12px;height:12px;vertical-align:middle;border:1px solid ${GRID_UNKNOWN};background:${PAPER}"></span>`;
  const legend = m.fog
    ? `<span style="margin-left:12px;font-size:calc(11px * var(--ui-scale));display:inline-flex;align-items:center;gap:3px;">` +
      `<span style="color:${UI_TEXT}">图例</span>` +
      `${seenSwatch}<span style="color:${UI_TEXT}">见过</span>` +
      `${walkedSwatch}<span style="color:${UI_TEXT}">走过</span>` +
      `${unknownSwatch}<span style="color:${UI_TEXT}">未知</span>` +
      `</span>`
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
