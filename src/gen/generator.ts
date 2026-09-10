// generator.ts · 构造式关卡生成器（GDD⑤ §5 四步）
// 全程使用注入的 PRNG（src/core/rng.mulberry32 / deriveAttemptSeed）；禁用内建随机函数（DQ3）。
// 复用：countDeadEndBranches(sim/deadends)、computeLockDepth(sim/lockkey)、detectInterconnect(./interconnect)。
// 不改动 src/core、src/sim、src/input、src/render、src/main.ts、src/state（本文件仅新增于 src/gen）。

import type { Dir, GridCell, Level, LevelMeta, Tier, Vec2, KeyColor } from '../core/types';
import { mulberry32, deriveAttemptSeed } from '../core/rng';
import { inBounds, key, neighbor, ORTHO_DIRS, chebyshev } from '../util/grid';
import { computeLockDepth, UNSOLVABLE } from '../sim/lockkey';
import { countDeadEndBranches } from '../sim/deadends';
import { replay } from './replay';
import { detectInterconnect } from './interconnect';
import { runGates, MID_LEN_BAND, HIGH_LEN_BAND, ULTRA_LEN_BAND } from './gates';
import { getFallbackLevel } from './fallback';

/** 生成器版本（D10：参与种子派生，升级即全序列换新图） */
export const GENERATOR_VERSION = 1;

export const MAX_ATTEMPTS = 8;

export interface GenerateRequest {
  seed: number; // 由 GDD⑥ getSeed 派生
  tier: Tier;
  generatorVersion: number;
}

export interface GenerateResult {
  level: Level | null;
  /** 全部执行的静态门禁（G1/G2/G3/G5/G6；G4 由调用方逐字节比对，不在此列） */
  gates: import('./gates').GateResult[];
  attempts: number;
  fallbackUsed: boolean;
}

interface ConstructParams {
  gridSize: number;
  minLen: number;
  maxLen: number;
  lockPairs: number; // 门钥对数（深度 = lockPairs，≤3）
  minBranches: number;
  maxBranches: number;
}

function defaultParams(tier: Tier): ConstructParams {
  return {
    gridSize: 13, // Z6：生成器固定 gridSize=13
    minLen: tier === 'mid' ? MID_LEN_BAND[0] : tier === 'high' ? HIGH_LEN_BAND[0] : ULTRA_LEN_BAND[0],
    maxLen: tier === 'mid' ? MID_LEN_BAND[1] : tier === 'high' ? HIGH_LEN_BAND[1] : ULTRA_LEN_BAND[1],
    lockPairs: tier === 'ultra' ? 3 : 2, // ultra（主线 L21-24）= L3 三锁；mid/high 仍为 L2
    minBranches: 3, // SV6/Q9：≥3 条有效诱导死路（难度提升：2~4 → 3~6）
    maxBranches: 6,
  };
}

function allWalls(gridSize: number): GridCell[][] {
  const g: GridCell[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < gridSize; x++) row.push('wall');
    g.push(row);
  }
  return g;
}

/**
 * 随机自避（self-avoiding）主干解：从 start 到 exit 的 DFS（回溯），要求长度落在 [minLen,maxLen]。
 * 自避是 G3 天然成立的关键（子序列同样自避 ⇒ 零回头路）。
 * 返回方向序列，或预算耗尽返回 null（调用方换种子重生成）。
 */
function randomSelfAvoidingPath(
  rng: () => number,
  gridSize: number,
  start: Vec2,
  exit: Vec2,
  minLen: number,
  maxLen: number,
): Dir[] | null {
  const interior = gridSize - 2;
  const visited = new Set<string>();
  const path: Vec2[] = [{ ...start }];
  visited.add(key(start));
  let budget = 250_000;

  const dfs = (): Dir[] | null => {
    if (budget-- <= 0) return null;
    const cur = path[path.length - 1];
    if (cur.x === exit.x && cur.y === exit.y) {
      const len = path.length - 1;
      if (len >= minLen && len <= maxLen) {
        const dirs: Dir[] = [];
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1];
          const b = path[i];
          if (b.x === a.x + 1) dirs.push('right');
          else if (b.x === a.x - 1) dirs.push('left');
          else if (b.y === a.y + 1) dirs.push('down');
          else dirs.push('up');
        }
        return dirs;
      }
      return null; // 抵达 exit 但长度不符 ⇒ 回溯
    }
    // 随机邻格顺序（PRNG 引导）
    const order = [...ORTHO_DIRS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]] as [Dir, Dir];
    }
    for (const d of order) {
      const n = neighbor(cur, d);
      if (n.x < 1 || n.y < 1 || n.x > interior || n.y > interior) continue; // 仅内部格
      if (visited.has(key(n))) continue;
      // 禁止在长度达标前过早结束于 exit（避免反复在短路径处终止导致回溯耗尽预算）
      if (n.x === exit.x && n.y === exit.y && path.length < minLen) continue;
      path.push(n);
      visited.add(key(n));
      const res = dfs();
      if (res) return res;
      path.pop();
      visited.delete(key(n));
    }
    return null;
  };

  return dfs();
}

// ---------------------------------------------------------------------------
// 主干「卡点」检测：门必须落在卡点上，否则主干自邻接会让门形同虚设
// ---------------------------------------------------------------------------

/**
 * 返回主干上的卡点下标：移除该格后 start 无法到达 exit。
 * 自避主干是一条会自我贴邻的蛇（实测单关可达 50 处非连续格相邻），
 * 若不把门钉在卡点上，玩家可直接从贴邻处绕过去 ⇒ 未开任何门即抵达出口（lockDepth=0）。
 */
function findChokePoints(
  grid: GridCell[][],
  gridSize: number,
  start: Vec2,
  exit: Vec2,
  cells: Vec2[],
): number[] {
  const chokes: number[] = [];
  for (let i = 1; i < cells.length - 1; i++) {
    const blocked = cells[i];
    const seen = new Set<string>();
    const stack: Vec2[] = [{ ...start }];
    seen.add(key(start));
    let reached = false;
    while (stack.length) {
      const c = stack.pop() as Vec2;
      if (c.x === exit.x && c.y === exit.y) {
        reached = true;
        break;
      }
      for (const d of ORTHO_DIRS) {
        const n = neighbor(c, d);
        if (n.x === blocked.x && n.y === blocked.y) continue;
        if (n.x < 0 || n.y < 0 || n.x >= gridSize || n.y >= gridSize) continue;
        if (grid[n.y][n.x] === 'wall') continue;
        const nk = key(n);
        if (seen.has(nk)) continue;
        seen.add(nk);
        stack.push(n);
      }
    }
    if (!reached) chokes.push(i);
  }
  return chokes;
}

/**
 * 随机出口（迷雾关需求：出口不再钉死在底部右角）。在内部格中随机选一个作为出口：
 *  - 排除起点 (1,1)、底部左角 (1,gridSize-2)、底部右角 (gridSize-2,gridSize-2)；
 *  - 距起点最小切比雪夫距离 ≥4，保证迷宫有意义且 DFS 易命中长度档位（过近会让回头路退化）；
 *  - 全程走注入 PRNG（DQ3），确定性：同 (seed,tier,version) 出口固定，且不影响 G4 逐字节可比。
 */
function randomExit(rng: () => number, gridSize: number, start: Vec2): Vec2 {
  const interior = gridSize - 2;
  const minDist = 4;
  const forbidden = new Set<string>([
    `${start.x},${start.y}`, // 起点
    `1,${interior}`, // 底部左角
    `${interior},${interior}`, // 底部右角
  ]);
  const candidates: Vec2[] = [];
  for (let y = 1; y <= interior; y++) {
    for (let x = 1; x <= interior; x++) {
      const k = `${x},${y}`;
      if (forbidden.has(k)) continue;
      if (chebyshev(start, { x, y }) < minDist) continue;
      candidates.push({ x, y });
    }
  }
  // gridSize≥9 时内部 7×7 起，排除后仍恒有大量候选；兜底取最远角防 rng 异常
  const pick = candidates[Math.floor(rng() * candidates.length)] ?? { x: interior, y: 1 };
  return { ...pick };
}

/** 构造单关（步骤 1-3）。任一内部违例返回 null（步骤 4 外层负责换种子/降级/兜底）。 */
function construct(rng: () => number, params: ConstructParams, request: GenerateRequest): Level | null {
  const { gridSize } = params;
  const start: Vec2 = { x: 1, y: 1 };
  // 出口随机（迷雾关需求），排除底部左右两角、起点，且离起点足够远
  const exit = randomExit(rng, gridSize, start);

  // 步骤 1：构造自避主干（DFS 可能单发失败，内部重试若干次以稳产，避免频繁回退兜底）
  let dirs: Dir[] | null = null;
  for (let t = 0; t < 6 && !dirs; t++) {
    dirs = randomSelfAvoidingPath(rng, gridSize, start, exit, params.minLen, params.maxLen);
  }
  if (!dirs) return null;

  // 主干格序列
  const cells: Vec2[] = [{ ...start }];
  let p = { ...start };
  for (const d of dirs) {
    p = neighbor(p, d);
    cells.push({ ...p });
  }
  const L = cells.length; // = dirs.length + 1

  // 网格：全墙起步，雕出主干
  const grid = allWalls(gridSize);
  const trunkSet = new Set<string>();
  for (const c of cells) {
    grid[c.y][c.x] = 'floor';
    trunkSet.add(key(c));
  }

  // 步骤 2：加死路干扰（保守：单格死胡同，唯一 trunk 接触点，且不与其它分支相邻 ⇒ D9 必过）
  const branchCount =
    params.minBranches + Math.floor(rng() * (params.maxBranches - params.minBranches + 1));
  const branchCells = new Set<string>();
  let placed = 0;
  let tries = 0;
  while (placed < branchCount && tries < 300) {
    tries++;
    const ti = 1 + Math.floor(rng() * (L - 2)); // 1..L-2（非起点/出口）
    const tc = cells[ti];
    const d = ORTHO_DIRS[Math.floor(rng() * 4)];
    const n = neighbor(tc, d);
    if (!inBounds(gridSize, n)) continue;
    if (n.x <= 0 || n.y <= 0 || n.x >= gridSize - 1 || n.y >= gridSize - 1) continue; // 外圈必须恒为墙
    if (grid[n.y][n.x] !== 'wall') continue; // 已为地板（主干/其它分支）
    if (branchCells.has(key(n))) continue;
    // 必须与 trunk 恰好 1 个接触点（即其父 tc），否则可能构成捷径
    let trunkTouches = 0;
    for (const dd of ORTHO_DIRS) {
      const nn = neighbor(n, dd);
      if (trunkSet.has(key(nn))) trunkTouches++;
    }
    if (trunkTouches !== 1) continue;
    // 不得与已有分支相邻（避免两分支彼此相连成环）
    let branchAdj = false;
    for (const dd of ORTHO_DIRS) {
      if (branchCells.has(key(neighbor(n, dd)))) branchAdj = true;
    }
    if (branchAdj) continue;
    grid[n.y][n.x] = 'floor';
    branchCells.add(key(n));
    placed++;
  }

  // 步骤 3：门钥依赖链 —— 门钉在卡点上（移除该格后 start 到不了 exit）。
  const chokes = findChokePoints(grid, gridSize, start, exit, cells);
  if (chokes.length < params.lockPairs) return null; // 卡点不足 ⇒ 换种子

  const keys: Level['keys'] = [];
  const doors: Level['doors'] = [];
  const doorIdx: number[] = [];
  for (let i = 0; i < params.lockPairs; i++) {
    // 在卡点列表上均匀取 lockPairs 个 ⇒ 沿主干严格递增
    doorIdx.push(chokes[Math.floor(((i + 1) * chokes.length) / (params.lockPairs + 1))]);
  }
  for (let i = 0; i < params.lockPairs; i++) {
    const di = doorIdx[i];
    const prev = i === 0 ? 0 : doorIdx[i - 1];
    if (di - prev < 2) return null; // 段落太短，容不下独立钥匙格 ⇒ 换种子
    // 钥匙置于「上一道门之后、本道门之前」的段落中点 ⇒ 必先开上一道门才取得到
    const ki = prev + Math.floor((di - prev) / 2);
    keys.push({ id: `k${i}`, color: i as KeyColor, pos: { ...cells[ki] } });
    doors.push({ id: `d${i}`, color: i as KeyColor, pos: { ...cells[di] } });
  }

  // 组装 Level
  const meta: LevelMeta = {
    lockDepth: 0,
    keyCount: keys.length,
    doorCount: doors.length,
    deadEndBranches: 0,
    expectedSolution: dirs,
  };
  const level: Level = {
    schemaVersion: 1,
    id: `gen-${request.tier}-${(request.seed >>> 0).toString(16)}`,
    gridSize: gridSize as 9 | 11 | 13,
    grid,
    start,
    exit,
    keys,
    doors,
    visionMode: 'fog', // 每日种子恒为迷雾（GDD⑥）
    meta,
  };

  // 依赖深度（以计算值回填 meta，保证 X5 一致；UNSOLVABLE ⇒ 本关无效）
  const ld = computeLockDepth(level);
  if (ld === UNSOLVABLE) return null;
  // ultra（三锁）必须真实形成 3 层依赖，否则换种子（防止门沦为装饰）
  if (params.lockPairs >= 3 && ld !== params.lockPairs) return null;
  level.meta.lockDepth = ld as 0 | 1 | 2 | 3;

  // D9 互连检测（H1 硬门禁）：任何捷径 ⇒ 丢弃本次生成（回到步骤 1）
  if (!detectInterconnect(level).pass) return null;

  level.meta.deadEndBranches = countDeadEndBranches(level);
  return level;
}

/**
 * 生成入口（GDD⑤ §5 步骤 4）。
 * 循环 MAX_ATTEMPTS 次换种子重生成 → 降级（放宽长度 / 减门数）→ 预置兜底（FALLBACK_LEVEL）。
 * 纯函数：同 (seed,tier,version) 必产逐字节相同 Level（G4 前提）。
 */
export function generate(
  request: GenerateRequest,
  opts?: { forceFallback?: boolean },
): GenerateResult {
  const tier = request.tier;

  if (opts?.forceFallback) {
    const level = getFallbackLevel(tier);
    return { level, gates: runGates(level, tier), attempts: 0, fallbackUsed: true };
  }

  const params = defaultParams(tier);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(deriveAttemptSeed(request.seed, attempt));
    const level = construct(rng, params, request);
    if (!level) continue;
    const gates = runGates(level, tier);
    if (gates.every((g) => g.pass)) {
      return { level, gates, attempts: attempt, fallbackUsed: false };
    }
  }

  // 降级：放宽长度区间 ±5，并减门数为 1（深度≤1 更易命中）
  const relaxed: ConstructParams = {
    ...params,
    minLen: params.minLen - 5,
    maxLen: params.maxLen + 5,
    lockPairs: Math.min(params.lockPairs, 1),
  };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(deriveAttemptSeed(request.seed ^ 0x9e3779b9, attempt));
    const level = construct(rng, relaxed, request);
    if (!level) continue;
    const gates = runGates(level, tier);
    if (gates.every((g) => g.pass)) {
      return { level, gates, attempts: MAX_ATTEMPTS, fallbackUsed: false };
    }
  }

  // 最终兜底：保证无空缺日（Q8/DQ6）
  const level = getFallbackLevel(tier);
  return { level, gates: runGates(level, tier), attempts: MAX_ATTEMPTS, fallbackUsed: true };
}
