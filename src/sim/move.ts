// move.ts · 通行判定（GDD① §4.1 / GDD③ §4.1）
// canMove / resolveMove。BLOCKED 零副作用（不计步、无 Step、无进度事件）→ 支撑 V2。

import type { Dir, KeyColor, Level, Vec2 } from '../core/types';
import { inBounds, neighbor } from '../util/grid';

export type MoveResult = 'BLOCKED' | 'MOVE' | 'OPEN_AND_ENTER';

/**
 * 判定从 from 沿 dir 前进的结果（GDD③ §4.1）：
 * - BLOCKED：越界 / 墙 / 未持有钥匙的锁门 → 零副作用
 * - MOVE：普通地板或已开启的门
 * - OPEN_AND_ENTER：持同色钥匙进入未开启的门（K4 自动开启）
 */
export function resolveMove(
  level: Level,
  keysHeld: ReadonlySet<KeyColor>,
  doorsOpened: ReadonlySet<string>,
  from: Vec2,
  dir: Dir,
): MoveResult {
  const next = neighbor(from, dir);
  if (!inBounds(level.gridSize, next) || level.grid[next.y][next.x] === 'wall') {
    return 'BLOCKED';
  }
  const door = level.doors.find((d) => d.pos.x === next.x && d.pos.y === next.y);
  if (!door) return 'MOVE';
  if (doorsOpened.has(door.id)) return 'MOVE'; // 已开 → 普通地板（X6）
  if (keysHeld.has(door.color)) return 'OPEN_AND_ENTER'; // K4
  return 'BLOCKED'; // 无钥匙
}

/** 是否可前进（非 BLOCKED）。供滑行 S1 停止谓词使用 */
export function canMove(
  level: Level,
  keysHeld: ReadonlySet<KeyColor>,
  doorsOpened: ReadonlySet<string>,
  from: Vec2,
  dir: Dir,
): boolean {
  return resolveMove(level, keysHeld, doorsOpened, from, dir) !== 'BLOCKED';
}
