// deadends.ts · countDeadEndBranches（GDD⑤ §4.6.1 / 架构 §6「待补定义」默认实现，M-2）
// 纯域函数，无随机、无渲染。生成器 G5 门禁调用（E4-6），亦可被 QA 脚本复用。
// 定义：不在 trunk（=expectedSolution 覆盖格集合）上的地板格，按连通性划分的"合格死路分支"分量个数。
//   合格 = (a) 不含 trunk 格；(b) 与 trunk 接触点恰好 1；(c) 内部为死胡同（树状，无环）。
// 互连检测（D9，≥2 接触点或两分支相连）由独立泛洪负责，本函数只数合格分支（G5 二者同时过）。

import type { Level, Vec2 } from '../core/types';
import { EIGHT_OFFSETS, inBounds, key, neighbor, ORTHO_DIRS } from '../util/grid';

/** 由 expectedSolution 标记 trunk 集合（start + 路径覆盖格） */
function markTrunk(level: Level): Set<string> {
  const trunk = new Set<string>();
  let p: Vec2 = { ...level.start };
  trunk.add(key(p));
  for (const d of level.meta.expectedSolution) {
    p = neighbor(p, d);
    trunk.add(key(p));
  }
  return trunk;
}

/** 非 trunk 地板极大连通分量（4 连通，跳过 trunk 格） */
function nonTrunkComponents(level: Level, trunk: Set<string>): string[][] {
  const visited = new Set<string>();
  const comps: string[][] = [];
  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const c = key({ x, y });
      if (level.grid[y][x] === 'wall') continue;
      if (trunk.has(c) || visited.has(c)) continue;
      const comp: string[] = [];
      const stack: Vec2[] = [{ x, y }];
      visited.add(c);
      while (stack.length) {
        const cur = stack.pop() as Vec2;
        comp.push(key(cur));
        for (const dir of ORTHO_DIRS) {
          const n = neighbor(cur, dir);
          if (!inBounds(level.gridSize, n)) continue;
          if (level.grid[n.y][n.x] === 'wall') continue;
          const nk = key(n);
          if (trunk.has(nk) || visited.has(nk)) continue;
          visited.add(nk);
          stack.push(n);
        }
      }
      comps.push(comp);
    }
  }
  return comps;
}

/** 分量是否树状（|V| === |E| + 1，4 连通边） */
function isTree(comp: string[]): boolean {
  const set = new Set(comp);
  let edges = 0;
  for (const ck of comp) {
    const [x, y] = ck.split(',').map(Number);
    for (const dir of ORTHO_DIRS) {
      const n = neighbor({ x, y }, dir);
      if (set.has(key(n))) edges++;
    }
  }
  edges /= 2;
  return comp.length === edges + 1;
}

/** 分量与 trunk 的接触点（接入点）数（4 邻域：分支经正交边接入 trunk） */
function touchPoints(level: Level, comp: string[], trunk: Set<string>): number {
  const touch = new Set<string>();
  for (const ck of comp) {
    const [x, y] = ck.split(',').map(Number);
    for (const dir of ORTHO_DIRS) {
      const n: Vec2 = neighbor({ x, y }, dir);
      if (inBounds(level.gridSize, n) && level.grid[n.y][n.x] !== 'wall' && trunk.has(key(n))) {
        touch.add(key(n));
      }
    }
  }
  return touch.size;
}

/**
 * 死路分支数（GDD⑤ §4.6.1）。返回合格死路分支分量个数，须 ≤6 方满足 G5。
 * C-M2-1 直线无分支→0；C-M2-2 单死胡同→1；C-M2-3 Y 形单接入→1；C-M2-4 双接触点→不计（D9 另判）。
 */
export function countDeadEndBranches(level: Level): number {
  const trunk = markTrunk(level);
  const comps = nonTrunkComponents(level, trunk);
  let count = 0;
  for (const comp of comps) {
    if (touchPoints(level, comp, trunk) !== 1) continue; // 条件 (b)
    if (!isTree(comp)) continue; // 条件 (c)：死胡同结构（无环，无捷径）
    count++; // 条件 (a) 已由泛洪保证（不含 trunk 格）
  }
  return count;
}
