// main-levels.ts · 主线 24 关题库（E6-1）
// 数据源：src/content/main-levels.json（由 scripts/build-main-levels.ts 生成并过门禁后固化）。
// L1–8 手工字符图（教学序列：9×9 无锁 → 11×11 单锁），L9–24 由生成器固定种子产出（13×13 迷雾双锁）。
// 运行时只读，不做生成（启动零开销、内容可评审、可手工微调 JSON）。

import raw from './main-levels.json';
import type { Level } from '../core/types';

export interface MainLevelsFile {
  version: number;
  levels: Level[];
}

const data = raw as unknown as MainLevelsFile;

/** 主线关卡序列（顺序即关号：索引 0 = main-1） */
export const MAIN_LEVELS: Level[] = data.levels;

/** 主线关卡总数（应为 24；GATE_DAILY 依赖全部 ≥1★） */
export function mainLevelCount(): number {
  return MAIN_LEVELS.length;
}

/** 取第 n 关（1-based）；越界返回 null */
export function getMainLevel(n: number): Level | null {
  return MAIN_LEVELS[n - 1] ?? null;
}

/** 由 level.id 反查关号（非主线关返回 0） */
export function mainLevelNumber(id: string): number {
  const m = /^main-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}
