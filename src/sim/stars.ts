// stars.ts · 运行时星级结算（GDD④ / ADR-04 §4）
// settle 只读调用 sim/segments 的共享原语，禁止重定义（W1/S2）。
// Q4 交叉断言：同 Level 的 expectedSolution 喂 settle 必 3★（由集成测试常驻守护）。

import type { RunState } from '../core/types';
import { countBacktrackSegments, splitSegments } from './segments';

export type Star = 1 | 2 | 3;

export interface StarSegmentDetail {
  index: number;
  cells: string[];
  isBacktrack: boolean; // 段内存在重复访问格
}

export interface StarResult {
  star: Star;
  /** 来自 GDD② 共享原语的唯一输出 */
  backtrackSegments: number;
  segmentCount: number;
  segments: StarSegmentDetail[];
  steps: number;
  elapsedMs: number;
}

function hasRevisit(seg: string[]): boolean {
  const seen = new Set<string>();
  for (const c of seg) {
    if (seen.has(c)) return true;
    seen.add(c);
  }
  return false;
}

/**
 * 结算（GDD④ §4.1）。未通关（finished=false）返回 null（Y1/B4）。
 * 星级严格来自 countBacktrackSegments：0→3★、≤1→2★、否则 1★。
 */
export function settle(run: RunState): StarResult | null {
  if (!run.finished) return null;

  // ↓↓↓ 以下两行必须是 GDD② 的共享实现，本处不得重写（ADR-04） ↓↓↓
  const segments = splitSegments(run.level.start, run.path);
  const backtracks = countBacktrackSegments(segments);
  // ↑↑↑

  const star: Star = backtracks === 0 ? 3 : backtracks <= 1 ? 2 : 1;

  return {
    star,
    backtrackSegments: backtracks,
    segmentCount: segments.length,
    segments: segments.map((cells, index) => ({
      index,
      cells,
      isBacktrack: hasRevisit(cells),
    })),
    steps: run.steps,
    elapsedMs: run.elapsedMs,
  };
}
