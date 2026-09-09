// placeholder.ts · E3 占位演示关卡（非 E6 正式内容，E6 会替换）
//
// ⚠ PLACEHOLDER ⚠ 此关卡仅用于让 E3 应用壳可运行、验证「启动 / 主循环 / 帧循环」
// 装配正确。它**不过 G1–G6 入库门禁**，不得作为正式关卡提交，E6 内容阶段整体替换。
// 约束：9×9、钥匙 ≤1（此处 0 钥匙）、visionMode='full'（走 BAKED 渲染路径）。

import type { Dir, GridCell, Level, Vec2 } from '../core/types';

// 9×9 迷宫字符图：# = 墙，. = 地板，S = 起点，E = 出口
const MAP = [
  '#########',
  '#S......#',
  '#.#####.#',
  '#.#...#.#',
  '#.#.#.#.#',
  '#...#...#',
  '#.#####.#',
  '#......E#',
  '#########',
];

function buildGrid(): { grid: GridCell[][]; start: Vec2; exit: Vec2 } {
  const grid: GridCell[][] = [];
  let start: Vec2 = { x: 1, y: 1 };
  let exit: Vec2 = { x: 7, y: 7 };
  for (let y = 0; y < MAP.length; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < MAP[y].length; x++) {
      const c = MAP[y][x];
      if (c === 'S') start = { x, y };
      else if (c === 'E') exit = { x, y };
      row.push(c === '#' ? 'wall' : 'floor');
    }
    grid.push(row);
  }
  return { grid, start, exit };
}

const { grid, start, exit } = buildGrid();

// 一条可行的单格解法标注（仅元数据；占位关不入库，不做 G3 校验）
const expectedSolution: Dir[] = [
  'down', 'down', 'down', 'down', 'down', 'down',
  'right', 'right', 'right', 'right', 'right', 'right',
];

export const PLACEHOLDER_LEVEL: Level = {
  schemaVersion: 1,
  id: 'demo-placeholder',
  gridSize: 9,
  grid,
  start,
  exit,
  keys: [],
  doors: [],
  visionMode: 'full',
  meta: {
    lockDepth: 0,
    keyCount: 0,
    doorCount: 0,
    deadEndBranches: 0,
    expectedSolution,
  },
};
