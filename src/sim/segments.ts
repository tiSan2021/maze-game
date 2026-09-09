// segments.ts · 段切分唯一实现（GDD② §4.1 / ADR-04）
// 全仓唯一 splitSegments / countBacktrackSegments 函数体（W1）。
// GDD④（运行时星级）与 GDD⑤（G3 门禁）只读 import 调用，禁止重定义。

import type { Segment, Step, Vec2 } from '../core/types';
import { key } from '../util/grid';

/**
 * 按进度事件切分路径为段（GDD② §4.1 规范实现）。
 * 相邻两个进度节点之间的路径为一段（含首尾格），末段止于出口格。
 * 复杂度 O(path.length)，空间 O(段长)，不可退化为搜索。
 */
export function splitSegments(start: Vec2, path: Step[]): Segment[] {
  const segments: Segment[] = [];
  let cur: string[] = [key(start)];

  for (const s of path) {
    cur.push(key(s.to));
    if (s.progressEvent !== null) {
      // 仅 'key' / 'door'：段在此结束，新段从事件格起算
      segments.push(cur);
      cur = [key(s.to)];
    }
  }
  segments.push(cur); // 末段止于出口
  return segments;
}

/**
 * 回头路段数：段内存在被访问 ≥2 次格子的段数（GDD② §4.1）。
 * 跨段重复合法、不计（关键）。O(path.length)。
 */
export function countBacktrackSegments(segments: Segment[]): number {
  return segments.filter((seg) => {
    const seen = new Set<string>();
    for (const c of seg) {
      if (seen.has(c)) return true; // 段内重复 ⇒ 回头路
      seen.add(c);
    }
    return false;
  }).length;
}
