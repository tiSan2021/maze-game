// runstate.ts · 运行时状态初始化与推进（GDD② §3.2 / 架构 §5.2 / GDD① §3.2）
// 每次成功前进 path.push + visited.add；visited 单调递增（撤销/重开均不缩减，V5/W6）。
// finished 为 true 才允许结算（GDD② B4）。V2：撞墙不入 path（由 glide.planSlide 保证）。

import type { Dir, Level, ProgressEvent, RunState, Step } from '../core/types';
import { key } from '../util/grid';
import { onEnterCell } from './lockkey';
import { resolveMove } from './move';
import { planSlide } from '../input/glide';
import { pushSnapshot } from '../input/undo';

/** 初始化 RunState（start 入 visited；其余为空） */
export function initRunState(level: Level): RunState {
  return {
    level,
    pos: { ...level.start },
    keysHeld: new Set(),
    doorsOpened: new Set(),
    path: [],
    undoStack: [],
    visited: new Set([key(level.start)]),
    steps: 0,
    elapsedMs: 0,
    finished: false,
  };
}

/**
 * 执行一次滑行（沿 dir）。planSlide 已用当前锁钥态规划；滑行中途不遇实体故锁钥态不变。
 * - 规划为空（前方 BLOCKED）→ 不产生 Step、不压快照（V2：撞墙 steps===0 && path.length===0）。
 * - 否则先压快照（撤销粒度=一次滑行），逐格写入 Step、visited.add（单调）、推进 pos。
 * - 抵达 exit → finished=true（仅此后 settle 才结算，GDD② B4）。
 */
export function applySlide(state: RunState, dir: Dir): void {
  const cells = planSlide(state.level, state, dir);
  if (cells.length === 0) return; // V2：撞墙，零副作用

  pushSnapshot(state); // 撤销粒度=一次滑行（D5）

  for (const cell of cells) {
    const mv = resolveMove(state.level, state.keysHeld, state.doorsOpened, state.pos, dir);
    const ev: ProgressEvent | null = onEnterCell(state.level, state.keysHeld, state.doorsOpened, cell);
    const step: Step = { from: { ...state.pos }, to: { ...cell }, dir, progressEvent: ev };
    state.path.push(step);
    state.visited.add(key(cell)); // 单调（V5/W6/D11）
    state.pos = { ...cell };
    state.steps++;
    void mv; // 结果在 planSlide 已校验；此处保留以显式表达"每步重新判定"
  }

  if (state.pos.x === state.level.exit.x && state.pos.y === state.level.exit.y) {
    state.finished = true;
  }
}
