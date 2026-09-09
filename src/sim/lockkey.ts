// lockkey.ts · 进度事件生产 + 依赖深度（GDD③）
// onEnterCell 是 ProgressEvent 的唯一生产者（GDD② §3.3 / GDD③ §4.2）。
// computeLockDepth（≤3 层）供 G5 与 meta.lockDepth 校验（GDD③ §4.3）。

import type { KeyColor, Level, ProgressEvent, Vec2 } from '../core/types';
import { inBounds, key, neighbor, ORTHO_DIRS } from '../util/grid';
import { resolveMove } from './move';

export type LockDepth = 0 | 1 | 2 | 3;
/** 返回 -1 表示 UNSOLVABLE（GDD③ §4.3，等价 G1 失败） */
export const UNSOLVABLE = -1;

/**
 * 进入格子后的结算，产生并写入进度事件（GDD③ §4.2）。
 * 唯一生产者：key 仅在未持有时拾取；door 仅在持同色钥匙且未开启时结算（K2 1:1 保证 k/d 不并存）。
 * 直接 mutate 传入的 keysHeld / doorsOpened（K5 钥匙不消耗，永不删除）。
 */
export function onEnterCell(
  level: Level,
  keysHeld: Set<KeyColor>,
  doorsOpened: Set<string>,
  cell: Vec2,
): ProgressEvent | null {
  const k = level.keys.find(
    (k) => k.pos.x === cell.x && k.pos.y === cell.y && !keysHeld.has(k.color),
  );
  if (k) {
    keysHeld.add(k.color); // K5：保留
    return { kind: 'key', color: k.color };
  }
  const d = level.doors.find(
    (d) => d.pos.x === cell.x && d.pos.y === cell.y && !doorsOpened.has(d.id),
  );
  if (d && keysHeld.has(d.color)) {
    doorsOpened.add(d.id);
    return { kind: 'door', doorId: d.id };
  }
  return null;
}

/** 从 start 泛洪可达地板格（门需 opened 才可通过） */
function floodFill(level: Level, opened: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const stack: Vec2[] = [{ ...level.start }];
  seen.add(key(level.start));
  while (stack.length) {
    const c = stack.pop() as Vec2;
    for (const dir of ORTHO_DIRS) {
      const n = neighbor(c, dir);
      if (!inBounds(level.gridSize, n)) continue;
      if (level.grid[n.y][n.x] === 'wall') continue;
      const nk = key(n);
      if (seen.has(nk)) continue;
      const door = level.doors.find((d) => d.pos.x === n.x && d.pos.y === n.y);
      if (door && !opened.has(door.id)) continue; // 未开门阻断
      seen.add(nk);
      stack.push(n);
    }
  }
  return seen;
}

/**
 * 依赖深度（GDD③ §4.3）：从 start 到 exit 需顺序穿过的门层数（并列门不增加深度）。
 * 0=无锁(L0) / 1(L1) / 2(L2) / 3(L3) / -1=不可解。
 * 同时用于 G1 可解性：返回 UNSOLVABLE 即 G1 失败。
 */
export function computeLockDepth(level: Level): LockDepth | typeof UNSOLVABLE {
  let region = floodFill(level, new Set());
  if (region.has(key(level.exit))) return 0;

  let opened = new Set<string>();
  for (let round = 1; round <= 3; round++) {
    // 钥匙已可达 ⇒ 对应门可开
    const openable = level.doors.filter((d) => {
      const k = level.keys.find((k) => k.color === d.color);
      return k ? region.has(key(k.pos)) : false;
    });
    for (const d of openable) opened.add(d.id);
    region = floodFill(level, opened);
    if (region.has(key(level.exit))) return round as LockDepth;
  }
  return UNSOLVABLE;
}
