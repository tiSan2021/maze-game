// fallback.ts · 第三关兜底（GDD⑤ §5 步骤 4 / E4-4）
// 兜底关为『预置的固定手工关卡』：以确定性蛇形路径构造（无 PRNG），保证无空缺日（Q8/DQ6）。
// 每个 tier 一张，预先通过全部 G1–G6（长度命中档位区间、无锁深度 0、无分支 ⇒ D9/计数双过）。
// 不得用内建随机函数（DQ3）；构造纯确定性、可重放。

import type { Dir, GridCell, Level, LevelMeta, Tier, Vec2 } from '../core/types';

const GRID = 13; // 内部 11×11

/** 蛇形路径：rows 行，每行横向贯穿内部宽度，行间向下连接。返回地板格序列与方向序列。 */
function serpentine(rows: number): { grid: GridCell[][]; dirs: Dir[]; start: Vec2; exit: Vec2 } {
  const w = GRID - 2; // 每行横向步数 = w-1
  const grid: GridCell[][] = [];
  for (let y = 0; y < GRID; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < GRID; x++) row.push('wall');
    grid.push(row);
  }
  const dirs: Dir[] = [];
  let x = 1;
  let y = 1;
  grid[y][x] = 'floor';
  const start: Vec2 = { x, y };
  for (let r = 0; r < rows; r++) {
    if (r % 2 === 0) {
      for (let i = 0; i < w - 1; i++) {
        x++;
        grid[y][x] = 'floor';
        dirs.push('right');
      }
    } else {
      for (let i = 0; i < w - 1; i++) {
        x--;
        grid[y][x] = 'floor';
        dirs.push('left');
      }
    }
    if (r < rows - 1) {
      y++;
      grid[y][x] = 'floor';
      dirs.push('down');
    }
  }
  const exit: Vec2 = { x, y };
  return { grid, dirs, start, exit };
}

function buildFallback(tier: Tier): Level {
  // mid: 4 行 ⇒ 长度 4*(11-1)+(4-1)=43 ∈ [35,55]
  // high: 6 行 ⇒ 长度 6*(11-1)+(6-1)=65 ∈ [50,80]
  const rows = tier === 'mid' ? 4 : 6;
  const { grid, dirs, start, exit } = serpentine(rows);
  const meta: LevelMeta = {
    lockDepth: 0,
    keyCount: 0,
    doorCount: 0,
    deadEndBranches: 0,
    expectedSolution: dirs,
  };
  return {
    schemaVersion: 1,
    id: `fallback-${tier}`,
    gridSize: GRID as 9 | 11 | 13,
    grid,
    start,
    exit,
    keys: [],
    doors: [],
    visionMode: 'fog',
    meta,
  };
}

const cache = new Map<Tier, Level>();

/** 取兜底关卡（确定性，按 tier 缓存同引用） */
export function getFallbackLevel(tier: Tier): Level {
  let lvl = cache.get(tier);
  if (!lvl) {
    lvl = buildFallback(tier);
    cache.set(tier, lvl);
  }
  return lvl;
}
