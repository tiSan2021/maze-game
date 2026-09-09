// glide.ts · 走廊滑行状态机 S1–S4（GDD① §4.2 / ADR-04）
// 一次方向键 = 反复单格前进，直到满足任一停止谓词。
// S4 环形走廊保护，防无限绕环；V3：单次滑行终止且 ≤ gridSize² 格。
// 关键不变量（架构 §3.2）：S2 ⇒ 滑行中途格恒为无实体地板格（遇实体即停，不穿过），
// 因此执行期锁钥状态不变，planSlide 一次性算完的序列与逐格执行必然一致。

import type { Dir, KeyColor, Level, RunState, Vec2 } from '../core/types';
import { inBounds, key, neighbor, opposite } from '../util/grid';
import { resolveMove } from '../sim/move';

/** 该格是否有实体（钥匙/门/出口）→ S2 停止 */
function hasEntity(level: Level, c: Vec2): boolean {
  if (c.x === level.exit.x && c.y === level.exit.y) return true;
  if (level.keys.some((k) => k.pos.x === c.x && k.pos.y === c.y)) return true;
  if (level.doors.some((d) => d.pos.x === c.x && d.pos.y === c.y)) return true;
  return false;
}

/**
 * S3 通行路口：存在至少一个"当前可通行"的垂直方向邻格（地板/已开门/持钥匙的锁门），
 * 且排除刚进入的上一格（上一格是反向、非垂直，正常不会命中，安全起见排除）。
 * 当前打不开的门不构成路口（不构成当前决策）。
 */
function isJunction(
  level: Level,
  keysHeld: ReadonlySet<KeyColor>,
  doorsOpened: ReadonlySet<string>,
  c: Vec2,
  dir: Dir,
): boolean {
  const perps: Dir[] = dir === 'left' || dir === 'right' ? ['up', 'down'] : ['left', 'right'];
  const prev = neighbor(c, opposite(dir));
  for (const p of perps) {
    const n = neighbor(c, p);
    if (!inBounds(level.gridSize, n)) continue;
    if (n.x === prev.x && n.y === prev.y) continue;
    if (resolveMove(level, keysHeld, doorsOpened, c, p) !== 'BLOCKED') return true;
  }
  return false;
}

/**
 * 规划单次滑行的格序列（不含起点，依次进入的格）。
 * 每进入新格 C 后按序求值停止谓词：
 *  S1 前方不可通行 → 停当前格（不入下格）
 *  S2 C 上有实体 → 停（C 为终点，不继续穿）
 *  S4 C 在本次滑行已走过 → 停（环形保护）
 *  S3 C 是通行路口 → 停
 * 上限 gridSize² 格（V3 环形不死循环）。
 */
export function planSlide(level: Level, state: RunState, dir: Dir): Vec2[] {
  const result: Vec2[] = [];
  const slideSeen = new Set<string>([key(state.pos)]);
  let cur: Vec2 = { ...state.pos };
  const max = level.gridSize * level.gridSize;

  while (result.length < max) {
    const mv = resolveMove(level, state.keysHeld, state.doorsOpened, cur, dir);
    if (mv === 'BLOCKED') break; // S1：前方不可通行 → 停当前格
    cur = neighbor(cur, dir);
    result.push({ ...cur });
    if (hasEntity(level, cur)) break; // S2：实体格 → 停
    const k = key(cur);
    if (slideSeen.has(k)) break; // S4：本次滑行已走过 → 停（环形保护）
    slideSeen.add(k);
    if (isJunction(level, state.keysHeld, state.doorsOpened, cur, dir)) break; // S3：路口 → 停
  }
  return result;
}
