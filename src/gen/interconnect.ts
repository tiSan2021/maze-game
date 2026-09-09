// interconnect.ts · D9 死路互连检测（GDD⑤ §4.6 / GDD③ §2.4，H1 硬门禁）
// 独立泛洪：对每个「非 trunk 的极大连通分量」判定是否为捷径。
//  ① 与 trunk 接触点 ≥2 ⇒ 捷径（multi-touch）；② 分量非树状（含环，两条分支彼此连通）⇒ 捷径（cycle）。
// 返回 { pass, violations }。本函数只做互连检测，死路『计数』由 sim/deadends.countDeadEndBranches 负责（二者同时过 G5 才成立）。
// 注意：不得改动 src/sim/deadends.ts（W1/约束）。touchPoints/isTree 为局部小工具，与 countDeadEndBranches 同义但独立实现，不复制该函数体。

import type { Level, Vec2 } from '../core/types';
import { inBounds, key, neighbor, ORTHO_DIRS } from '../util/grid';

export type InterconnectViolationType = 'multi-touch' | 'cycle';

export interface InterconnectViolation {
  type: InterconnectViolationType;
  /** 违例分量（非 trunk 地板格集合） */
  component: string[];
  /** 仅 multi-touch：与 trunk 的接触点数 */
  touchPoints?: number;
}

export interface InterconnectResult {
  pass: boolean;
  violations: InterconnectViolation[];
}

/** 由 expectedSolution（设计标注主解）标记 trunk 集合（GDD⑤ §4.6.1 术语约定） */
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

/** 分量与 trunk 的 4 邻接触点数 */
function touchPointsOf(level: Level, comp: string[], trunk: Set<string>): number {
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

/** 分量是否树状：|V| === |E| + 1（4 连通边）。非树 ⇒ 含环（两条分支彼此连通） */
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

/**
 * D9 互连检测（H1 硬门禁）。
 * 对每一个非 trunk 的极大连通分量（4 连通、跳过 trunk 格）独立判定：
 *   - 接触点 ≥2 ⇒ 违例（multi-touch）：该死路分支把主干两点额外连通，形成绕过主线的捷径。
 *   - 非树状（含环）⇒ 违例（cycle）：两条本应独立的死路分支彼此相连，合并成一个分量。
 * 仅当所有分量均无违例时 pass=true。
 */
export function detectInterconnect(level: Level): InterconnectResult {
  const trunk = markTrunk(level);
  const visited = new Set<string>();
  const violations: InterconnectViolation[] = [];

  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const ck = key({ x, y });
      if (level.grid[y][x] === 'wall') continue;
      if (trunk.has(ck) || visited.has(ck)) continue;

      // 独立泛洪：仅连通非 trunk 地板格
      const comp: string[] = [];
      const stack: Vec2[] = [{ x, y }];
      visited.add(ck);
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

      const touch = touchPointsOf(level, comp, trunk);
      if (touch >= 2) {
        violations.push({ type: 'multi-touch', component: comp, touchPoints: touch });
      } else if (!isTree(comp)) {
        violations.push({ type: 'cycle', component: comp });
      }
    }
  }

  return { pass: violations.length === 0, violations };
}
