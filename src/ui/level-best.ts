// level-best.ts · 选关页「最佳成绩行」（步数 / 用时）
// 纯函数、无 DOM：便于单测，也便于将来复用（如每日关记录展示）。

import type { LevelRecord } from '../sim/progress';
import { formatDuration } from './format';

/**
 * 选关 chip 的第二行：`42 步 · 01:05`。
 * 无记录（未通关 / 未解锁）时返回空串，由调用方决定是否渲染该行。
 * 注意取的是**该星级下的最优**记录（progress 的 max 语义），非最近一次成绩。
 */
export function formatBestLine(rec: LevelRecord | null | undefined): string {
  if (!rec) return '';
  return `${rec.bestStarSteps} 步 · ${formatDuration(rec.bestStarElapsedMs)}`;
}
