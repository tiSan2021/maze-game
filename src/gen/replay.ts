// replay.ts · 重放 expectedSolution 验证 G1/G3（GDD⑤ §4.1 / GDD② §5.1）
// 重放 = 沿 Dir[] 用注入的确定性规则前进，得到 Step[]（与运行时同一组原语 resolveMove/onEnterCell）。
// 不得重新实现移动/进度逻辑（sim/move、sim/lockkey 为唯一来源）。

import type { Dir, Level, Step, Vec2, KeyColor } from '../core/types';
import { neighbor } from '../util/grid';
import { resolveMove } from '../sim/move';
import { onEnterCell } from '../sim/lockkey';

export interface ReplayResult {
  steps: Step[];
}

/**
 * 重放设计标注的 expectedSolution。
 * - 任一步 BLOCKED ⇒ 抛错（G1 失败：Z3 报第 n 步坐标）。
 * - 终态未抵达 exit ⇒ 抛错（G1 失败：Z2 无法抵达出口）。
 * - 门的开启依赖 keysHeld（由 onEnterCell 在途经钥匙格时累积），与运行时一致。
 */
export function replay(level: Level, dirs: Dir[]): ReplayResult {
  let pos: Vec2 = { ...level.start };
  const keysHeld = new Set<KeyColor>();
  const doorsOpened = new Set<string>();
  const steps: Step[] = [];

  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const r = resolveMove(level, keysHeld, doorsOpened, pos, d);
    if (r === 'BLOCKED') {
      throw new Error(`replay: 第 ${i + 1} 步非法，(${pos.x},${pos.y}) -> ${d} 被拦截`);
    }
    const from: Vec2 = { ...pos };
    pos = neighbor(pos, d);
    const progressEvent = onEnterCell(level, keysHeld, doorsOpened, pos);
    steps.push({ from, to: { ...pos }, dir: d, progressEvent });
  }

  if (pos.x !== level.exit.x || pos.y !== level.exit.y) {
    throw new Error(`replay: 未抵达出口，止于 (${pos.x},${pos.y})`);
  }
  return { steps };
}
