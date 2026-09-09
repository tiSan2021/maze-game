// undo.ts · 撤销栈（GDD① §4.5 / ADR-04）
// 粒度 = 一次滑行。Z 回滚 pos/keysHeld/doorsOpened/path/steps；
// visited 与 elapsedMs 不回滚（D11/V5/W6）。RunSnapshot 不含 visited（R-B）。
// 深拷贝防别名：入栈新建 Set、出栈替换实例。

import type { RunState } from '../core/types';

/** 本次滑行前压栈（粒度=一次滑行） */
export function pushSnapshot(state: RunState): void {
  state.undoStack.push({
    pos: { ...state.pos },
    keysHeld: new Set(state.keysHeld), // 深拷贝
    doorsOpened: new Set(state.doorsOpened), // 深拷贝
    pathLength: state.path.length,
    steps: state.steps,
  });
}

/**
 * 撤销一次滑行。成功回滚返回 true；空栈返回 false（path 为空时按 Z 无操作，E4）。
 * visited / elapsedMs 不回滚（认知地图单调；计时是真实时间）。
 */
export function popSnapshot(state: RunState): boolean {
  const snap = state.undoStack.pop();
  if (!snap) return false;
  state.pos = { ...snap.pos }; // 替换实例
  state.keysHeld = new Set(snap.keysHeld); // 替换实例，防别名污染
  state.doorsOpened = new Set(snap.doorsOpened);
  state.path.length = snap.pathLength; // 回滚 path（D5）
  state.steps = snap.steps;
  // 注意：visited 与 elapsedMs 故意不回滚
  return true;
}
