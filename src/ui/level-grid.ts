// level-grid.ts · 选关二维网格导航的纯函数（无 DOM、无副作用，便于单测）
// 24 关 = 6 列 × 4 行，正好整除，无残缺行。

/** 选关网格列数（24 = 6 × 4） */
export const MAIN_SEL_COLS = 6;

/**
 * 在二维网格内移动选中关号。
 * @param current 当前关号（1-based）
 * @param dir     移动方向：left/right 行内 ±1，up/down 跨行 ±cols
 * @param maxLevel 允许的最大关号（已解锁上限），结果钳到 [1, maxLevel]
 * @param cols    网格列数（默认 MAIN_SEL_COLS）
 * @returns 新的关号（整数）
 */
export function moveSelection(
  current: number,
  dir: 'left' | 'right' | 'up' | 'down',
  maxLevel: number,
  cols: number = MAIN_SEL_COLS,
): number {
  let next = current;
  if (dir === 'left') next = current - 1;
  else if (dir === 'right') next = current + 1;
  else if (dir === 'up') next = current - cols;
  else if (dir === 'down') next = current + cols;
  if (next < 1) next = 1;
  if (next > maxLevel) next = maxLevel;
  return Math.trunc(next);
}

/** 给定最大关号与列数，算出网格总行数（向上取整，便于渲染外层循环） */
export function gridRowCount(maxLevel: number, cols: number = MAIN_SEL_COLS): number {
  if (maxLevel <= 0) return 0;
  return Math.ceil(maxLevel / cols);
}
