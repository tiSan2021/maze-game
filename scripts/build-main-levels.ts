// build-main-levels.ts · 主线 24 关题库生成器（E6-1 交付物）
//
// 职责：
//  - L1–8：脚本内 8 张手工字符图，自写 BFS 求零回头路 expectedSolution，复用既有原语算 meta。
//  - L9–24：调用现有生成器 generate()，seed = fnv1a32('main-'+n+'|v1')，覆盖 id 为 main-N。
//  - 先对每一关运行 runGates() 全部通过（L9–24 含 G6），再写 src/content/main-levels.json。
//  - 任何一关任一门禁未过 → 报错退出并打印是哪一关哪一项。
//
// 约束：
//  - 禁用 Math.random（DQ3）；所有随机性来自 generate 内部的 PRNG。
//  - 不修改 src/ 下任何文件，仅新增 src/content/main-levels.json 与本脚本。
//  - 复用既有原语：computeLockDepth / countDeadEndBranches / replay / runGates / generate / fnv1a32。

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type {
  Dir,
  GridCell,
  KeyEntity,
  DoorEntity,
  Level,
  LevelMeta,
  Tier,
  Vec2,
} from '../src/core/types';
import { ORTHO_DIRS } from '../src/util/grid';
import { computeLockDepth } from '../src/sim/lockkey';
import { countDeadEndBranches } from '../src/sim/deadends';
import { runGates, type GateResult } from '../src/gen/gates';
import { generate } from '../src/gen/generator';
import { fnv1a32 } from '../src/core/rng';

// ---------------------------------------------------------------------------
// 手工字符图（L1–8）。字符：#=墙 . =地板 S=起点 E=出口 a=钥匙(色0) A=门(色0) b=钥匙(色1) B=门(色1)
// 外圈恒为墙（G5 会查）。
// ---------------------------------------------------------------------------

type HandMap = {
  id: string;
  gridSize: 9 | 11 | 13;
  visionMode: 'full' | 'fog';
  rows: string[];
  /** 设计预期锁钥深度：L1–3=0，L4–8=1 */
  expectedLockDepth: 0 | 1;
};

const L1_8: HandMap[] = [
  // 关 1–3：9×9 全览，0 钥匙 0 门（教学：走 + 省）。三关走法各不相同。
  {
    id: 'main-1',
    gridSize: 9,
    visionMode: 'full',
    expectedLockDepth: 0,
    // 经典竖向蛇形：右-左-右 三段折返，起左上、终左下
    rows: [
      '#########',
      '#S......#',
      '#####.###',
      '#.......#',
      '#.#######',
      '#.......#',
      '#####.###',
      '#E......#',
      '#########',
    ],
  },
  {
    id: 'main-2',
    gridSize: 9,
    visionMode: 'full',
    expectedLockDepth: 0,
    // 竖向蛇形但折返顺序相反（左-右-左），终右下，观感不同
    rows: [
      '#########',
      '#S......#',
      '#####.###',
      '#.......#',
      '###.#####',
      '#.......#',
      '#####.###',
      '#......E#',
      '#########',
    ],
  },
  {
    id: 'main-3',
    gridSize: 9,
    visionMode: 'full',
    expectedLockDepth: 0,
    // 带支线的蛇形：中段插入死路支线，路线更碎、与 1/2 区分
    rows: [
      '#########',
      '#S......#',
      '#.#######',
      '#.......#',
      '#######.#',
      '#.......#',
      '#.#######',
      '#E......#',
      '#########',
    ],
  },
  // 关 4–8：11×11 全览，1 钥匙 1 门（lockDepth=1，同色 K2 1:1）。
  // 门 A 一律钉在「上下区域唯一连通走廊」(row7 全开走廊) 上，关 A 时 S 到不了 E → 锁深=1；
  // a 放在起点区(row1)，开门前即可取。五关通过门列 / 钥匙位 / 起终点 / 折返侧 区分。
  {
    id: 'main-4',
    gridSize: 11,
    visionMode: 'full',
    expectedLockDepth: 1,
    rows: [
      '###########',
      '#S.a......#',
      '#######.###',
      '#.........#',
      '#.#########',
      '#.........#',
      '#######.###',
      '#..A......#',
      '#.#########',
      '#......E###',
      '###########',
    ],
  },
  {
    id: 'main-5',
    gridSize: 11,
    visionMode: 'full',
    expectedLockDepth: 1,
    // 门移到 row7 右侧(col7)，终左下，与 main-4 区分
    rows: [
      '###########',
      '#S.a......#',
      '#######.###',
      '#.........#',
      '#.#########',
      '#.........#',
      '#######.###',
      '#......A..#',
      '#.#########',
      '#E........#',
      '###########',
    ],
  },
  {
    id: 'main-6',
    gridSize: 11,
    visionMode: 'full',
    expectedLockDepth: 1,
    // 门居中(col5)，终右下
    rows: [
      '###########',
      '#S.a......#',
      '#######.###',
      '#.........#',
      '#.#########',
      '#.........#',
      '#######.###',
      '#....A....#',
      '#.#########',
      '#........E#',
      '###########',
    ],
  },
  {
    id: 'main-7',
    gridSize: 11,
    visionMode: 'full',
    expectedLockDepth: 1,
    // 门在 row7 左端(col1)，终中下
    rows: [
      '###########',
      '#S.a......#',
      '#######.###',
      '#.........#',
      '#.#########',
      '#.........#',
      '#######.###',
      '#A........#',
      '#.#########',
      '#......E###',
      '###########',
    ],
  },
  {
    id: 'main-8',
    gridSize: 11,
    visionMode: 'full',
    expectedLockDepth: 1,
    // 折返侧改到左侧(col1 连通)，门 col3，终左下，结构与其他 4 关明显不同
    rows: [
      '###########',
      '#S.....a..#',
      '#######.###',
      '#.........#',
      '#.#########',
      '#.........#',
      '#######.###',
      '#...A.....#',
      '#.#########',
      '#........E#',
      '###########',
    ],
  },
];

// ---------------------------------------------------------------------------
// 解析字符图
// ---------------------------------------------------------------------------

function parseCharMap(map: HandMap): {
  grid: GridCell[][];
  start: Vec2;
  exit: Vec2;
  keys: KeyEntity[];
  doors: DoorEntity[];
} {
  const { gridSize, rows } = map;
  if (rows.length !== gridSize) {
    throw new Error(`${map.id}: 行数 ${rows.length} ≠ gridSize ${gridSize}`);
  }
  const grid: GridCell[][] = [];
  let start: Vec2 | null = null;
  let exit: Vec2 | null = null;
  const keys: KeyEntity[] = [];
  const doors: DoorEntity[] = [];

  for (let y = 0; y < gridSize; y++) {
    const line = rows[y];
    if (line.length !== gridSize) {
      throw new Error(`${map.id}: 第 ${y} 行长度 ${line.length} ≠ gridSize ${gridSize} ("${line}")`);
    }
    const row: GridCell[] = [];
    for (let x = 0; x < gridSize; x++) {
      const ch = line[x];
      switch (ch) {
        case '#':
          row.push('wall');
          break;
        case '.':
          row.push('floor');
          break;
        case 'S':
          row.push('floor');
          start = { x, y };
          break;
        case 'E':
          row.push('floor');
          exit = { x, y };
          break;
        case 'a':
          row.push('floor');
          keys.push({ id: 'k0', color: 0, pos: { x, y } });
          break;
        case 'A':
          row.push('floor');
          doors.push({ id: 'd0', color: 0, pos: { x, y } });
          break;
        case 'b':
          row.push('floor');
          keys.push({ id: 'k1', color: 1, pos: { x, y } });
          break;
        case 'B':
          row.push('floor');
          doors.push({ id: 'd1', color: 1, pos: { x, y } });
          break;
        default:
          throw new Error(`${map.id}: 未知字符 '${ch}' at (${x},${y})`);
      }
    }
    grid.push(row);
  }

  if (!start) throw new Error(`${map.id}: 缺少起点 S`);
  if (!exit) throw new Error(`${map.id}: 缺少出口 E`);
  return { grid, start, exit, keys, doors };
}

// ---------------------------------------------------------------------------
// BFS 求 expectedSolution（零回头路：状态 = (x, y, 钥匙集合 bitmask)）
// 门格缺对应钥匙时不可进入；求得先拿钥匙 → 开门 → 到出口的单格方向序列。
// ---------------------------------------------------------------------------

function solveBFS(level: Level): Dir[] {
  const { gridSize, start, exit, keys, doors } = level;
  const keyAt = (x: number, y: number) => keys.find((k) => k.pos.x === x && k.pos.y === y);
  const doorAt = (x: number, y: number) => doors.find((d) => d.pos.x === x && d.pos.y === y);

  const sk = keyAt(start.x, start.y);
  const startMask = sk ? 1 << sk.color : 0;
  const startKey = `${start.x},${start.y},${startMask}`;

  const parent = new Map<string, { pk: string; dir: Dir }>();
  parent.set(startKey, { pk: '', dir: 'up' });

  const queue: Array<{ x: number; y: number; mask: number }> = [
    { x: start.x, y: start.y, mask: startMask },
  ];
  let endKey: string | null = null;

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === exit.x && cur.y === exit.y) {
      endKey = `${cur.x},${cur.y},${cur.mask}`;
      break;
    }
    for (const d of ORTHO_DIRS) {
      const nx = cur.x + (d === 'right' ? 1 : d === 'left' ? -1 : 0);
      const ny = cur.y + (d === 'down' ? 1 : d === 'up' ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      if (level.grid[ny][nx] === 'wall') continue;
      const door = doorAt(nx, ny);
      if (door && !(cur.mask & (1 << door.color))) continue; // 缺钥匙不可进入
      const nk = keyAt(nx, ny);
      const nmask = cur.mask | (nk ? 1 << nk.color : 0);
      const nkey = `${nx},${ny},${nmask}`;
      if (parent.has(nkey)) continue;
      parent.set(nkey, { pk: `${cur.x},${cur.y},${cur.mask}`, dir: d });
      queue.push({ x: nx, y: ny, mask: nmask });
    }
  }

  if (!endKey) throw new Error(`${level.id}: BFS 未找到解`);
  const dirs: Dir[] = [];
  let cur = endKey;
  while (cur !== startKey) {
    const p = parent.get(cur);
    if (!p) throw new Error(`${level.id}: BFS 回溯失败`);
    dirs.push(p.dir);
    cur = p.pk;
  }
  dirs.reverse();
  return dirs;
}

// ---------------------------------------------------------------------------
// 构建手工关（L1–8）
// ---------------------------------------------------------------------------

function buildHandLevel(map: HandMap): Level {
  const { grid, start, exit, keys, doors } = parseCharMap(map);
  const partial: Level = {
    schemaVersion: 1,
    id: map.id,
    gridSize: map.gridSize,
    grid,
    start,
    exit,
    keys,
    doors,
    visionMode: map.visionMode,
    meta: { lockDepth: 0, keyCount: 0, doorCount: 0, deadEndBranches: 0, expectedSolution: [] },
  };
  const expectedSolution = solveBFS(partial);
  partial.meta.expectedSolution = expectedSolution;

  const lockDepth = computeLockDepth(partial);
  const deadEndBranches = countDeadEndBranches(partial);
  const meta: LevelMeta = {
    lockDepth: lockDepth as 0 | 1 | 2,
    keyCount: keys.length,
    doorCount: doors.length,
    deadEndBranches,
    expectedSolution,
  };
  partial.meta = meta;

  if (lockDepth !== map.expectedLockDepth) {
    throw new Error(
      `${map.id}: computeLockDepth=${lockDepth} 与预期 ${map.expectedLockDepth} 不一致（门未真正卡住路线？）`,
    );
  }
  return partial;
}

// ---------------------------------------------------------------------------
// 构建生成关（L9–24）：mid/high 双锁铺排，L21–24 为 ultra 三锁（难度天花板）
// ---------------------------------------------------------------------------

const GEN_TIERS: Record<number, Tier> = {
  9: 'mid',
  10: 'high',
  11: 'mid',
  12: 'high',
  13: 'high',
  14: 'mid',
  15: 'high',
  16: 'high',
  17: 'mid',
  18: 'high',
  19: 'high',
  20: 'mid',
  21: 'ultra',
  22: 'ultra',
  23: 'ultra',
  24: 'ultra',
};

// 注：现有生成器仅拒绝 UNSOLVABLE，不会强制 lockDepth==2；而它内部「优先返回首个门禁全过
// 的 attempt」，首个全过 attempt 多半是 ld=1/0（门未真正卡住路线）。主线 L9–24 硬规格要求
// lockDepth=2（出口只能经两道门到达），因此这里用 seed 后缀重试，直到 generate 真的吐出
// ld=2 的关。这是规格「换 seed 后缀重试」机制的自然延伸（base seed 达不到硬规格时）。
const GEN_SEARCH_CAP = 600;

function buildGeneratedLevel(n: number): { level: Level; seedLabel: string } {
  const tier = GEN_TIERS[n];
  const requiredDepth = tier === 'ultra' ? 3 : 2; // ultra 档要求三锁（L3）
  const baseSeed = fnv1a32(`main-${n}|v1`);

  let lastErr = '';
  for (let attempt = 0; attempt < GEN_SEARCH_CAP; attempt++) {
    const seedLabel = attempt === 0 ? `main-${n}|v1` : `main-${n}|v1|r${attempt}`;
    const seed = attempt === 0 ? baseSeed : fnv1a32(seedLabel);
    const res = generate({ seed, tier, generatorVersion: 1 });

    if (!res.level) {
      lastErr = 'generate 返回 null';
      continue;
    }
    if (res.fallbackUsed) {
      lastErr = 'fallbackUsed=true（兜底关不可当主线关）';
      continue;
    }
    const ld = computeLockDepth(res.level);
    if (ld !== requiredDepth) {
      lastErr = `lockDepth=${ld} ≠ ${requiredDepth}（生成器未真正形成 L${requiredDepth} 依赖）`;
      continue;
    }
    // 覆盖 id 为 main-N；visionMode 保持生成器给的 'fog'
    const level: Level = { ...res.level, id: `main-${n}`, visionMode: 'fog' };
    const gates = runGates(level, tier);
    const failed = gates.filter((g) => !g.pass);
    if (failed.length === 0) {
      return { level, seedLabel };
    }
    lastErr = '门禁未过: ' + failed.map((g) => `${g.gate}(${g.detail})`).join(', ');
  }
  throw new Error(
    `main-${n}: ${GEN_SEARCH_CAP} 次 seed 后缀重试后仍找不到 lockDepth=${requiredDepth} 的关 — ${lastErr}`,
  );
}

// ---------------------------------------------------------------------------
// 主流程：先全部门禁通过，再写 JSON
// ---------------------------------------------------------------------------

interface ReportRow {
  id: string;
  gridSize: number;
  visionMode: string;
  lockDepth: number;
  keyDoor: string;
  deadEndBranches: number;
  solLen: number;
  gates: Record<string, string>;
  seed?: string;
}

function gateToStr(g: GateResult): string {
  return g.pass ? 'PASS' : `FAIL(${g.detail})`;
}

function main() {
  const levels: Level[] = [];
  const report: ReportRow[] = [];

  // L1–8 手工
  for (const map of L1_8) {
    const level = buildHandLevel(map);
    const tier: Tier = 'mid'; // L1–8 的 G6 不作为硬性要求，tier 仅占位
    const gates = runGates(level, tier);
    const gateMap: Record<string, string> = {};
    for (const g of gates) gateMap[g.gate] = gateToStr(g);

    // 硬性要求：G1/G2/G3/G5 必须过；L1–8 不要求 G6
    const required = gates.filter((g) => g.gate !== 'G6');
    const failed = required.filter((g) => !g.pass);
    if (failed.length > 0) {
      throw new Error(
        `${level.id} 门禁未过: ` + failed.map((g) => `${g.gate}(${g.detail})`).join(', '),
      );
    }

    levels.push(level);
    report.push({
      id: level.id,
      gridSize: level.gridSize,
      visionMode: level.visionMode,
      lockDepth: level.meta.lockDepth,
      keyDoor: `${level.meta.keyCount}/${level.meta.doorCount}`,
      deadEndBranches: level.meta.deadEndBranches,
      solLen: level.meta.expectedSolution.length,
      gates: gateMap,
    });
  }

  // L9–24 生成
  for (let n = 9; n <= 24; n++) {
    const { level, seedLabel } = buildGeneratedLevel(n);
    const tier = GEN_TIERS[n];
    const gates = runGates(level, tier);
    const gateMap: Record<string, string> = {};
    for (const g of gates) gateMap[g.gate] = gateToStr(g);

    const failed = gates.filter((g) => !g.pass);
    if (failed.length > 0) {
      throw new Error(
        `${level.id} 门禁未过: ` + failed.map((g) => `${g.gate}(${g.detail})`).join(', '),
      );
    }

    levels.push(level);
    report.push({
      id: level.id,
      gridSize: level.gridSize,
      visionMode: level.visionMode,
      lockDepth: level.meta.lockDepth,
      keyDoor: `${level.meta.keyCount}/${level.meta.doorCount}`,
      deadEndBranches: level.meta.deadEndBranches,
      solLen: level.meta.expectedSolution.length,
      gates: gateMap,
      seed: seedLabel,
    });
  }

  // 全部通过 → 写 JSON
  const out = { version: 1, levels };
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, '../src/content/main-levels.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

  // 打印报告
  console.log('\n=== 主线 24 关题库生成报告 ===');
  console.log(
    [
      'id'.padEnd(8),
      'size'.padEnd(5),
      'vision'.padEnd(6),
      'lk'.padEnd(3),
      'k/d'.padEnd(5),
      'dead'.padEnd(5),
      'len'.padEnd(5),
      'G1'.padEnd(5),
      'G2'.padEnd(5),
      'G3'.padEnd(5),
      'G5'.padEnd(5),
      'G6'.padEnd(5),
      'seed',
    ].join(' '),
  );
  for (const r of report) {
    console.log(
      [
        r.id.padEnd(8),
        String(r.gridSize).padEnd(5),
        r.visionMode.padEnd(6),
        String(r.lockDepth).padEnd(3),
        r.keyDoor.padEnd(5),
        String(r.deadEndBranches).padEnd(5),
        String(r.solLen).padEnd(5),
        r.gates['G1']!.padEnd(5),
        r.gates['G2']!.padEnd(5),
        r.gates['G3']!.padEnd(5),
        r.gates['G5']!.padEnd(5),
        r.gates['G6']!.padEnd(5),
        r.seed ?? '-',
      ].join(' '),
    );
  }
  console.log(`\n已写入: ${outPath}`);
  console.log('所有 24 关 G1/G2/G3/G5 通过；L9–24 G6 通过。');
}

main();
