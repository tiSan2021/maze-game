// settlement.ts · 结算面板（E5-3 / GDD④ §2.3 / UX §1.1 S4）
// 纯函数产出 HTML 字符串（Node 可断言，不依赖 DOM），由 main.ts 挂到覆盖层。
// 明细必须有：星级 + 段数 + 回头路段数 + 步数 + 用时（GDD④ §2.3：惩罚必须可解释）。

export interface SettlementModel {
  star: 1 | 2 | 3;
  /** 本局总段数（= 进度事件数 + 1） */
  segmentCount: number;
  /** 走了冤枉路的段数 */
  backtrackSegments: number;
  steps: number;
  elapsedMs: number;
  /** 是否有下一关（主线第 24 关 / 每日题为 false） */
  hasNext: boolean;
  /** 历史最佳星级（null = 首次通关） */
  bestStar?: 1 | 2 | 3 | null;
  /** 本次是否刷新历史最佳 */
  isNewBest?: boolean;
  /** 关卡标签，如「第 7 关」「每日 · 中」 */
  label?: string;
}

/** mm:ss（展示用；不参与判定） */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function renderStars(star: 1 | 2 | 3): string {
  return '★'.repeat(star) + '☆'.repeat(3 - star);
}

export function renderSettlementHtml(m: SettlementModel): string {
  const stars = renderStars(m.star);
  const backtrackText =
    m.backtrackSegments === 0
      ? '零回头路 · 无冤枉路'
      : `${m.backtrackSegments} 段走了冤枉路`;
  const bestText =
    m.bestStar == null
      ? (m.isNewBest ? '首次通关记录已保存' : '')
      : m.isNewBest
        ? `刷新历史最佳（原 ${renderStars(m.bestStar)}）`
        : `历史最佳 ${renderStars(m.bestStar)}（本次未超越）`;
  const label = m.label ? `<div class="hint">${m.label}</div>` : '';
  const nextHint = m.hasNext ? ' · <kbd>N</kbd> 下一关' : '';

  return [
    '<h1>通关！</h1>',
    label,
    `<div style="font-size:calc(28px * var(--ui-scale));letter-spacing:4px">${stars}</div>`,
    `<div class="hint">共 ${m.segmentCount} 段 · ${backtrackText}</div>`,
    `<div class="hint">步数 ${m.steps} · 用时 ${formatDuration(m.elapsedMs)}</div>`,
    bestText ? `<div class="hint">${bestText}</div>` : '',
    `<div class="hint"><kbd>Enter</kbd> 重玩本关${nextHint} · <kbd>Q</kbd> 返回选关</div>`,
  ]
    .filter(Boolean)
    .join('');
}
