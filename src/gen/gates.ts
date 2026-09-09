// gates.ts · G1–G6 六道发布前门禁（GDD⑤ §4）
// 每道均为纯函数，输入 Level（+ 必要上下文），输出 GateResult{pass,detail}。
// 复用（不得重实现）：countDeadEndBranches(sim/deadends)、computeLockDepth(sim/lockkey)、
//   splitSegments/countBacktrackSegments(sim/segments)、replay(./replay)、detectInterconnect(./interconnect)。
//
// 重要（ADR-01 §3.10）：G4 确定性门禁『不在 generate() 内』——它是对同一 (seed,tier,version)
//   两次产出的逐字节可比性，由调用方（每日引导 / QA）通过 gateG4(a,b) 比对两次 generate 结果来判定。
//   因此 runGates() 仅跑 G1/G2/G3/G5/G6；G4 单独提供。

import type { KeyColor, Level, Tier } from '../core/types';
import { countDeadEndBranches } from '../sim/deadends';
import { computeLockDepth, UNSOLVABLE } from '../sim/lockkey';
import { splitSegments, countBacktrackSegments } from '../sim/segments';
import { replay } from './replay';
import { detectInterconnect } from './interconnect';
import { canonicalJSON } from '../core/canonical';

export type Gate = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export interface GateResult {
  gate: Gate;
  pass: boolean;
  detail: string;
}

// 常量（GDD⑤ §3 常量表）
export const MAX_STEPS = 80;
export const MAX_KEYS = 3;
export const MAX_DOORS = 3;
export const MAX_DEAD_ENDS = 6;
export const MAX_LOCK_DEPTH = 3;

export const MID_LEN_BAND: [number, number] = [35, 55];
export const HIGH_LEN_BAND: [number, number] = [50, 80];
export const ULTRA_LEN_BAND: [number, number] = [50, 80];
export const GRID_SIZES = [9, 11, 13] as const;

/** G1 可解性：重放合法 + 终点为出口 + computeLockDepth 非 UNSOLVABLE */
export function gateG1(level: Level): GateResult {
  try {
    replay(level, level.meta.expectedSolution);
  } catch (e) {
    return { gate: 'G1', pass: false, detail: `replay 失败: ${(e as Error).message}` };
  }
  if (computeLockDepth(level) === UNSOLVABLE) {
    return { gate: 'G1', pass: false, detail: 'computeLockDepth=UNSOLVABLE' };
  }
  return { gate: 'G1', pass: true, detail: 'reachable' };
}

/** G2 长度上限：expectedSolution.length ≤ MAX_STEPS */
export function gateG2(level: Level): GateResult {
  const len = level.meta.expectedSolution.length;
  return { gate: 'G2', pass: len <= MAX_STEPS, detail: `len=${len}` };
}

/** G3 三星可达（硬）：重放 → splitSegments → countBacktrackSegments === 0（O(path)，非搜索） */
export function gateG3(level: Level): GateResult {
  let steps;
  try {
    steps = replay(level, level.meta.expectedSolution).steps;
  } catch (e) {
    return { gate: 'G3', pass: false, detail: `replay 失败: ${(e as Error).message}` };
  }
  const segs = splitSegments(level.start, steps);
  const bt = countBacktrackSegments(segs);
  return { gate: 'G3', pass: bt === 0, detail: `backtracks=${bt}` };
}

/** G4 确定性：两次产出 canonicalJSON 逐字节相同（调用方分别 generate 两次后传入） */
export function gateG4(a: Level, b: Level): GateResult {
  const pass = canonicalJSON(a) === canonicalJSON(b);
  return { gate: 'G4', pass, detail: pass ? 'byte-identical' : 'canonicalJSON differs' };
}

/** K2 同色 1:1 配对校验（交付项 7 / GDD③ X1-X2）：每色恰好 1 钥匙 1 门，且 keys/doors ≤3 */
export function checkColorPairing(level: Level): { ok: boolean; detail: string } {
  const keyByColor = new Map<number, number>();
  for (const k of level.keys) keyByColor.set(k.color, (keyByColor.get(k.color) ?? 0) + 1);
  const doorByColor = new Map<number, number>();
  for (const d of level.doors) doorByColor.set(d.color, (doorByColor.get(d.color) ?? 0) + 1);

  const colors = new Set<KeyColor>([
    ...level.keys.map((k) => k.color),
    ...level.doors.map((d) => d.color),
  ]);
  for (const c of colors) {
    const kc = keyByColor.get(c) ?? 0;
    const dc = doorByColor.get(c) ?? 0;
    if (kc !== 1 || dc !== 1) {
      return { ok: false, detail: `color ${c}: keys=${kc} doors=${dc}（K2 要求 1:1）` };
    }
  }
  if (level.keys.length > MAX_KEYS) return { ok: false, detail: `keys=${level.keys.length}>${MAX_KEYS}` };
  if (level.doors.length > MAX_DOORS) return { ok: false, detail: `doors=${level.doors.length}>${MAX_DOORS}` };
  return { ok: true, detail: '1:1 配对成立' };
}

/** G5 尺寸与依赖合规：尺寸/外圈 + 依赖深度 ≤3 且与 meta 一致 + 数量/K2 + 死路计数 ≤6 + D9 互连通过 */
export function gateG5(level: Level): GateResult {
  const fails: string[] = [];

  // 尺寸
  if (!(GRID_SIZES as readonly number[]).includes(level.gridSize)) {
    fails.push(`gridSize=${level.gridSize} 不在 {9,11,13}`);
  }
  // 外圈全墙
  let ringOk = true;
  for (let i = 0; i < level.gridSize; i++) {
    if (
      level.grid[0][i] !== 'wall' ||
      level.grid[level.gridSize - 1][i] !== 'wall' ||
      level.grid[i][0] !== 'wall' ||
      level.grid[i][level.gridSize - 1] !== 'wall'
    ) {
      ringOk = false;
      break;
    }
  }
  if (!ringOk) fails.push('外圈未全为 wall');

  // 依赖深度
  const ld = computeLockDepth(level);
  if (ld === UNSOLVABLE) {
    fails.push('UNSOLVABLE');
  } else {
    if (ld !== level.meta.lockDepth) fails.push(`lockDepth=${ld} 与 meta=${level.meta.lockDepth} 不一致 (X5)`);
    if (ld > MAX_LOCK_DEPTH) fails.push(`lockDepth=${ld}>${MAX_LOCK_DEPTH}`);
  }

  // 数量 + K2 1:1
  const pair = checkColorPairing(level);
  if (!pair.ok) fails.push(pair.detail);

  // 死路分支计数 ≤6
  const deb = countDeadEndBranches(level);
  if (deb > MAX_DEAD_ENDS) fails.push(`deadEndBranches=${deb}>${MAX_DEAD_ENDS}`);

  // D9 互连检测（H1）
  const ic = detectInterconnect(level);
  if (!ic.pass) fails.push(`D9 违例=${ic.violations.length}（捷径：含隐藏捷径的关卡会静默通过计数，必须拦下）`);

  return { gate: 'G5', pass: fails.length === 0, detail: fails.length ? fails.join('; ') : 'ok' };
}

/** G6 档位命中：expectedSolution.length 落在该 tier 目标区间 */
export function gateG6(level: Level, tier: Tier): GateResult {
  const len = level.meta.expectedSolution.length;
  const [lo, hi] =
    tier === 'mid' ? MID_LEN_BAND : tier === 'high' ? HIGH_LEN_BAND : ULTRA_LEN_BAND;
  const pass = len >= lo && len <= hi;
  return { gate: 'G6', pass, detail: `len=${len} 区间=[${lo},${hi}]` };
}

/**
 * 生成器内部使用的逐关静态门禁集合（G1/G2/G3/G5/G6）。
 * G4 故意排除（ADR-01 §3.10）——确定性由调用方两次 generate 比对。
 */
export function runGates(level: Level, tier: Tier): GateResult[] {
  return [gateG1(level), gateG2(level), gateG3(level), gateG5(level), gateG6(level, tier)];
}
