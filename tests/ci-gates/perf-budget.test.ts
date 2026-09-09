// perf-budget.test.ts · CI 闸门：最坏情况关（main-24，13×13 fog 三锁）帧预算
//
// 门限性质：这是**逻辑侧（CPU/JS）帧预算门**，不是真机像素栅格化预算。
//   vitest.config.ts 的 environment='node'，仓库未装 node-canvas，
//   因此 Node 下不存在真实 CanvasRenderingContext2D（domCanvasFactory 依赖 document，不可用）。
//   本测试注入 no-op 画布上下文，度量的是每帧的 JS 成本：
//     computeVisibility + cellRenderState×169×2 + drawCell 派发 + drawEntities 派发 + 集合拷贝。
//   真机 GPU/栅格化耗时由 DevTools 埋点覆盖（见 vitest.config.ts 注释），不在本门限内。
//   即便如此，这条门限能守住最容易失控的部分：可见性/渲染态推导的算法复杂度与每帧分配。
//
// 度量口径：预热后连跑 200 帧取**均值**（非 p99），阈值留足余量 → 有意义但不 flaky。
// 帧内工作严格镜像 src/main.ts:275 frame() 的 PLAYING 分支：
//   ① buildEntityView() → computeVisibility（main.ts:266）
//   ② pipe.moveTo(pos, visited)（main.ts:323，注意：每帧都调，内部再算一次 computeVisibility）
//   ③ pipe.renderFrame(view)（main.ts:324）
// 不调用 app.move —— 只压渲染/可见性路径，位置沿一条由关卡派生的合法路径推进，语义不变。

import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../../src/render/pipeline';
import { createFakeCanvasFactory, fakeCalls } from '../helpers/fake-canvas';
import { computeVisibility, cellRenderState } from '../../src/sim/visibility';
import { getMainLevel } from '../../src/content/main-levels';
import { boardOrigin } from '../../src/core/constants/metrics';
import { key, neighbor } from '../../src/util/grid';
import type { CanvasFactory, CanvasLike, Ctx2D } from '../../src/render/canvas';
import type { EntityView } from '../../src/render/sprites';
import type { CellKey, Level, Vec2 } from '../../src/core/types';

// ── 预算常量（易调）─────────────────────────────────────────────────
/**
 * CI 帧预算（毫秒，预热后 200 帧均值）。
 * 60fps 的整帧时间是 16.6ms；这里取 16 作为门限，且是**整帧 JS 逻辑**的上限。
 * 实测均值远低于此（见测试输出），刻意保留数十倍余量：
 * CI 机器负载抖动、GC 停顿、冷 JIT 都不应把这条门限弄红。
 * 它的作用是**捕获数量级退化**（例如把 O(169) 的渲染态扫描写成 O(169²)、
 * 或在帧内新增全图 BFS/重复烘焙），而不是做微基准回归。
 */
const FRAME_BUDGET_MS = 16;

/** 单帧最大耗时的宽松上限：允许单次 GC/调度抖动，仍拦住"某几帧灾难性卡顿"。 */
const FRAME_MAX_BUDGET_MS = 100;

const WARMUP_FRAMES = 60;
const MEASURE_FRAMES = 200;
/** 每 7 帧跨一格 ≈ 连走 8 格/秒 @60fps（KeyboardInput 连走节奏 110ms 的同量级）。 */
const FRAMES_PER_CELL = 7;

// ── Node 下的 no-op 画布（不记录调用，避免数组无限增长引入 GC 噪声）──
// tests/helpers/fake-canvas.ts 会把每次 drawImage push 进数组；
// 260 帧 × ~200 次调用 ≈ 5 万条记录，会污染计时。此处只做纯 no-op。
function createNullCanvasFactory(): CanvasFactory {
  return (w: number, h: number): CanvasLike => {
    const ctx: Ctx2D = {
      drawImage() {},
      clearRect() {},
      fillRect() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      rotate() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      rect() {},
      strokeRect() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillText() {},
      strokeText() {},
      clip() {},
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
    };
    return { width: w, height: h, getContext: () => ctx };
  };
}

/**
 * 合法行走路径**由关卡自身派生**：沿 main-24 的 expectedSolution 主干推进。
 * 2026-09-09：基准由 main-12（双锁 2门2钥匙）改为 main-24（三锁 3门3钥匙）——
 * 难度上限提升后，最坏情况应是内容天花板那一档，否则门禁覆盖不到真正最重的帧。
 * 不再硬编码坐标——关卡重新生成（几何变化）后本基准不会悄悄失效；
 * 下面的 it 仍会逐格断言合法性（正交相邻 + 全部落在 floor）。
 */
function buildWalkPath(level: Level): Vec2[] {
  const path: Vec2[] = [{ ...level.start }];
  let cur = { ...level.start };
  for (const d of level.meta.expectedSolution) {
    cur = neighbor(cur, d);
    path.push({ ...cur });
  }
  return path;
}

function worstCaseLevel(): Level {
  const level = getMainLevel(24);
  if (!level) throw new Error('main-24 缺失：src/content/main-levels.json 应含 24 关');
  return level;
}

const WALK_PATH: readonly Vec2[] = buildWalkPath(worstCaseLevel());

interface Harness {
  pipe: RenderPipeline;
  level: Level;
  /** 跑一帧（镜像 main.ts frame() 的 PLAYING 分支）；返回该帧末的可见集大小，防 DCE */
  runFrame: (frameIdx: number) => number;
}

function makeHarness(): Harness {
  const level = worstCaseLevel();
  const factory = createNullCanvasFactory();
  const main = factory(960, 640).getContext('2d');
  const pipe = new RenderPipeline(main, level, factory, { origin: boardOrigin(level.gridSize) });
  pipe.init();

  const visited = new Set<CellKey>([key(WALK_PATH[0])]);
  // 门/钥匙状态固定（不调 app.move，不改语义）：三锁关最重的一档 —— 门未开、钥匙都在场，
  // 于是 drawEntities 每帧都要画 3 门 + 3 钥匙墨晕 + 出口。
  const heldKeys = new Set<0 | 1 | 2>();
  const openedDoors = new Set<string>();

  const runFrame = (frameIdx: number): number => {
    const pos = WALK_PATH[Math.min(Math.floor(frameIdx / FRAMES_PER_CELL), WALK_PATH.length - 1)];
    visited.add(key(pos));
    // ① 实体视图的可见集（main.ts:266）
    const visible = computeVisibility(level, pos, visited);
    const view: EntityView = {
      heldKeys,
      openedDoors,
      visible,
      motionScale: 1,
      timeMs: frameIdx * 16.6,
    };
    // ② 每帧 moveTo（main.ts:323）—— 内部再算一次 computeVisibility + updateL1 增量
    pipe.moveTo(pos, visited);
    // ③ 合成（main.ts:324）
    pipe.renderFrame(view);
    return visible.size;
  };

  return { pipe, level, runFrame };
}

function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

function percentile(xs: readonly number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

describe('CI 闸门 · 性能预算（main-24 最坏情况：13×13 / fog / 三锁）', () => {
  it('WALK_PATH 是一条合法行走路径（全 floor + 正交相邻），基准才有意义', () => {
    const level = worstCaseLevel();
    expect(level.gridSize).toBe(13);
    expect(level.visionMode).toBe('fog');
    expect(level.keys).toHaveLength(3);
    expect(level.doors).toHaveLength(3);
    expect(WALK_PATH[0]).toEqual(level.start);
    expect(WALK_PATH[WALK_PATH.length - 1]).toEqual(level.exit);

    const illegal: string[] = [];
    WALK_PATH.forEach((p, i) => {
      if (level.grid[p.y][p.x] !== 'floor') illegal.push(`#${i} (${p.x},${p.y}) 不是 floor`);
      if (i === 0) return;
      const q = WALK_PATH[i - 1];
      const d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
      if (d !== 1) illegal.push(`#${i} (${p.x},${p.y}) 与前一格 (${q.x},${q.y}) 非正交相邻`);
    });
    expect(illegal).toEqual([]);
  });

  // 反自欺门：若哪天 harness 退化成"空跑"（管线没装配好 / 提前 return），
  // 帧时会漂亮地趋近 0 而预算门依旧绿灯。这里用记录型 fake 画布证明每帧确有实际绘制量。
  it('harness 真的压在渲染路径上：每帧 drawImage 量级合理，且 fog 走 LAYERED 增量', () => {
    const level = worstCaseLevel();
    const factory = createFakeCanvasFactory();
    const mainCanvas = factory(960, 640);
    const pipe = new RenderPipeline(mainCanvas.getContext('2d'), level, factory, {
      origin: boardOrigin(level.gridSize),
    });
    pipe.init();

    const visited = new Set<CellKey>([key(WALK_PATH[0])]);
    // 走到第 12 格附近：视野内格 + 记忆墙都已成规模
    for (let i = 0; i <= 12; i++) {
      visited.add(key(WALK_PATH[i]));
      pipe.moveTo(WALK_PATH[i], visited);
    }
    // fog 关必须走 LAYERED 增量路径（BAKED 时 lastDirtyCount 恒 0）
    expect(pipe.stats.tileAtlasReady).toBe(true);
    expect(pipe.stats.lastDirtyCount).toBeGreaterThan(0);

    const before = fakeCalls(mainCanvas).length;
    pipe.renderFrame({
      heldKeys: new Set(),
      openedDoors: new Set(),
      visible: computeVisibility(level, WALK_PATH[12], visited),
      motionScale: 1,
      timeMs: 0,
    });
    const drawn = fakeCalls(mainCanvas).slice(before);
    const drawImages = drawn.filter((c) => c.type === 'drawImage').length;

    // 单帧构成：L0 + L1 各 1 次 + 视野内/墙格若干 + 实体（3 门 + 3 钥匙×2 + 出口×2 + 玩家程序化）
    // 下界取 10 足够宽松（不做像素级回归），但能拦住"一次都没画"。
    expect(drawImages).toBeGreaterThan(10);
    expect(drawn.some((c) => c.type === 'clearRect')).toBe(true);
  });

  it(`预热 ${WARMUP_FRAMES} 帧后连跑 ${MEASURE_FRAMES} 帧，平均帧时 < ${FRAME_BUDGET_MS}ms`, () => {
    const h = makeHarness();

    // 预热：让 JIT 把 computeVisibility / cellRenderState / drawCell 编译到稳定层级
    let sink = 0;
    for (let i = 0; i < WARMUP_FRAMES; i++) sink += h.runFrame(i);
    expect(sink).toBeGreaterThan(0); // 防止预热被优化掉

    const samples: number[] = new Array(MEASURE_FRAMES);
    for (let i = 0; i < MEASURE_FRAMES; i++) {
      const t0 = performance.now();
      sink += h.runFrame(WARMUP_FRAMES + i);
      samples[i] = performance.now() - t0;
    }

    const avg = mean(samples);
    const max = Math.max(...samples);
    const p95 = percentile(samples, 0.95);
    const headroom = FRAME_BUDGET_MS / avg;

    console.log(
      `[perf-budget] main-24 帧时（JS 逻辑侧，n=${MEASURE_FRAMES}）：` +
        `均值 ${avg.toFixed(4)}ms · p95 ${p95.toFixed(4)}ms · 最大 ${max.toFixed(4)}ms · ` +
        `预算 ${FRAME_BUDGET_MS}ms · 余量 ${headroom.toFixed(1)}×`,
    );

    expect(avg).toBeLessThan(FRAME_BUDGET_MS);
    expect(max).toBeLessThan(FRAME_MAX_BUDGET_MS);
  });

  it('剖析：分段耗时归因（computeVisibility vs moveTo vs renderFrame）', () => {
    const level = worstCaseLevel();
    const factory = createNullCanvasFactory();
    const main = factory(960, 640).getContext('2d');
    const pipe = new RenderPipeline(main, level, factory, { origin: boardOrigin(level.gridSize) });
    pipe.init();

    const visited = new Set<CellKey>([key(WALK_PATH[0])]);
    const heldKeys = new Set<0 | 1 | 2>();
    const openedDoors = new Set<string>();
    const posAt = (i: number): Vec2 =>
      WALK_PATH[Math.min(Math.floor(i / FRAMES_PER_CELL), WALK_PATH.length - 1)];

    // 预热
    for (let i = 0; i < WARMUP_FRAMES; i++) {
      const pos = posAt(i);
      visited.add(key(pos));
      const visible = computeVisibility(level, pos, visited);
      pipe.moveTo(pos, visited);
      pipe.renderFrame({ heldKeys, openedDoors, visible, motionScale: 1, timeMs: i * 16.6 });
    }

    let tVis = 0;
    let tMove = 0;
    let tRender = 0;
    let tStateScan = 0;
    let sink = 0;

    for (let i = 0; i < MEASURE_FRAMES; i++) {
      const fi = WARMUP_FRAMES + i;
      const pos = posAt(fi);
      visited.add(key(pos));

      let t = performance.now();
      const visible = computeVisibility(level, pos, visited);
      tVis += performance.now() - t;

      t = performance.now();
      pipe.moveTo(pos, visited);
      tMove += performance.now() - t;

      t = performance.now();
      pipe.renderFrame({ heldKeys, openedDoors, visible, motionScale: 1, timeMs: fi * 16.6 });
      tRender += performance.now() - t;

      // 单独度量"169 格渲染态推导"这一项（renderFrame 与 updateL1 各跑一遍）
      t = performance.now();
      for (let y = 0; y < level.gridSize; y++) {
        for (let x = 0; x < level.gridSize; x++) {
          if (cellRenderState(level, { x, y }, pos, visited, visible, null) === 'WALL') sink++;
        }
      }
      tStateScan += performance.now() - t;
    }

    const n = MEASURE_FRAMES;
    const per = (total: number): string => (total / n).toFixed(4);
    console.log(
      `[perf-profile] 每帧均值：computeVisibility ${per(tVis)}ms · ` +
        `moveTo ${per(tMove)}ms（含第 2 次 computeVisibility + updateL1 169 格扫描）· ` +
        `renderFrame ${per(tRender)}ms · 其中 cellRenderState×169 单独计 ${per(tStateScan)}ms`,
    );

    expect(sink).toBeGreaterThan(0);
    // 三段都应被真实执行（非 0 且有限），否则说明 harness 没压到路径上
    expect(tVis).toBeGreaterThan(0);
    expect(tMove).toBeGreaterThan(0);
    expect(tRender).toBeGreaterThan(0);
  });
});
