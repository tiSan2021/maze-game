// app.ts · 顶层状态机（E3-3 / GDD① §4.8 / UX 规格 §1）
// 五态 S0 MENU → S1 LEVEL_SELECT → S2 PLAYING → S3 PAUSED / S4 SETTLEMENT
// 条件门禁 GATE_DAILY（仅当主线全通才显示「每日」分区，本壳用 mainProgress 占位，E5 接真实存档）。
//
// 本文件为纯逻辑（不触碰 DOM / 不构造 RenderPipeline），可在 Node 下单测；
// 渲染、键盘绑定、主循环在 main.ts。所有域内核调用均复用既有 API，未重写 sim/input/core。

import type { Dir, Level, RunState, Tier } from '../core/types';
import type { Clock } from '../core/clock';
import { systemClock } from '../core/clock';
import { getDateKeyUTC } from '../core/rng';
import type { ProgressData, StorageLike } from '../sim/progress';
import {
  loadProgress,
  saveProgress,
  recordResult,
  bestOf,
  isMainAllCleared,
  isDailyUnlocked,
} from '../sim/progress';
import { bootstrapDaily, isDailyStale } from '../gen/daily';
import type { DailyBootstrap } from '../gen/daily';
import { getMainLevel, mainLevelNumber } from '../content/main-levels';
import { initRunState, applySlide } from '../sim/runstate';
import { popSnapshot } from '../input/undo';
import { resolveMove } from '../sim/move';
import { ORTHO_DIRS } from '../util/grid';
import type { StarResult } from '../sim/stars';
import { settle } from '../sim/stars';
import type { HudModel } from '../render/hud';
import { splitSegments, countBacktrackSegments } from '../sim/segments';

/** 顶层应用状态（GDD① §4.8 / UX §1.1） */
export type AppState = 'MENU' | 'LEVEL_SELECT' | 'PLAYING' | 'PAUSED' | 'SETTLEMENT';

/** 一次 move 的结果（供音频/反馈层精确触发音效；撞墙/拾取/开门/通关可被区分） */
export type MoveOutcome =
  | { kind: 'ignored' } // 非游玩态 / 无关卡，未处理
  | { kind: 'blocked' } // 前方 BLOCKED（撞墙），零副作用
  | { kind: 'moved'; pickedKey: boolean; openedDoor: boolean; won: boolean };

/** 主线进度（GATE_DAILY 依赖；E5 接 localStorage 真实存档，本壳仅占位） */
export interface MainProgress {
  /** 每日分区解锁状态：当前全清 或 历史曾全清（解锁一次即永久，GDD⑥ D-1） */
  allMainCleared: boolean;
}

/**
 * 顶层状态机。持有当前 Level / RunState / 结算结果。
 * 转移方法均为同步、无副作用于渲染层；main.ts 监听 state 变化后驱动渲染。
 */
/**
 * 从 level.id 解析每日 dateKey（'daily-2026-09-08-mid' → '2026-09-08'）；非每日关 → null
 */
function parseDailyDateKey(id: string): string | null {
  const m = /^daily-(\d{4}-\d{2}-\d{2})-(mid|high)$/.exec(id);
  return m ? m[1] : null;
}

/** 展示用关卡标签："第 7 关" / "每日 · 中" / 其余回退 id（UX §2.2） */
export function formatLevelLabel(id: string): string {
  const mn = /^main-(\d+)$/.exec(id);
  if (mn) return `第 ${mn[1]} 关`;
  const dm = /^daily-\d{4}-\d{2}-\d{2}-(mid|high)$/.exec(id);
  if (dm) return dm[1] === 'mid' ? '每日 · 中' : '每日 · 高';
  return id;
}

export interface AppMachineOptions {
  /** 存档介质（浏览器传 localStorage；不传 = 会话内内存态，Node 测试安全） */
  storage?: StorageLike | null;
  /** 时间源注入（A6：gen/sim 内不得构造 Date） */
  clock?: Clock;
}

export class AppMachine {
  state: AppState = 'MENU';
  level: Level | null = null;
  run: RunState | null = null;
  result: StarResult | null = null;
  mainProgress: MainProgress = { allMainCleared: false };

  /** 存档（null = 内存态，写操作静默失败但不影响本局，D-5/Y6） */
  readonly storage: StorageLike | null;
  readonly clock: Clock;
  progress: ProgressData;
  /** 每日引导结果（进入 S1 时刷新） */
  daily: DailyBootstrap | null = null;
  /** 在途每日局的开局 dateKey（E5-4：局中不换题） */
  private activeDailyDateKey: string | null = null;
  /** 本次结算前的最佳星级 / 是否刷新纪录（供结算面板展示） */
  settlementPrevBest: 1 | 2 | 3 | null = null;
  settlementImproved = false;

  constructor(opts: AppMachineOptions = {}) {
    this.storage = opts.storage ?? null;
    this.clock = opts.clock ?? systemClock;
    this.progress = loadProgress(this.storage);
    this.mainProgress = { allMainCleared: isDailyUnlocked(this.progress) };
  }

  /** GATE_DAILY（UX §1.1）：仅主线全通才允许显示「每日」分区 */
  canShowDaily(): boolean {
    return this.mainProgress.allMainCleared;
  }

  // ── S0 / S4 / S3 → S1：返回关卡选择（放弃本局，不写进度） ──
  goToLevelSelect(): void {
    this.state = 'LEVEL_SELECT';
    this.level = null;
    this.run = null;
    this.result = null;
    this.refreshDailyOnSelect(); // 每日分区按当天刷新（GATE_DAILY 未满足时不生成）
  }

  // ── S0 → S1 的「返回主菜单」分支（S1 → S0） ──
  goToMenu(): void {
    this.state = 'MENU';
    this.level = null;
    this.run = null;
    this.result = null;
  }

  // ── S1 → S2：选中某关进入游玩 ──
  enterLevel(level: Level): void {
    this.level = level;
    this.run = initRunState(level);
    this.result = null;
    this.settlementPrevBest = null;
    this.settlementImproved = false;
    // 每日关：锁定开局 dateKey（E5-4 / GDD⑥ D-2：跨午夜局中不换题）
    this.activeDailyDateKey = parseDailyDateKey(level.id);
    this.state = 'PLAYING';
  }

  // ── S2 → S3：暂停 ──
  pause(): void {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
  }

  // ── S3 → S2：继续 ──
  resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
  }

  // ── S2 / S3 → S2（R 重开）：重置本关，滞留游玩态，不写进度 / 不影响解锁 ──
  restart(): void {
    if (!this.level) return;
    if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
    this.run = initRunState(this.level);
    this.result = null;
    this.state = 'PLAYING';
  }

  // ── S2：Z 撤销一次滑行（粒度=一次滑行；visited / elapsedMs 不回滚，由 undo.popSnapshot 保证） ──
  undo(): boolean {
    if (this.state !== 'PLAYING' || !this.run) return false;
    // 注意：撤销不改变顶层状态（滞留 PLAYING）
    return popSnapshot(this.run);
  }

  /** S2：执行一次方向滑行；若抵达出口 → 转 SETTLEMENT 并结算。
   *  返回 MoveOutcome，供音频层区分 撞墙 / 拾取 / 开门 / 通关（不重写 sim 语义，仅对 run 状态做前后 diff）。 */
  move(dir: Dir): MoveOutcome {
    if (this.state !== 'PLAYING' || !this.run || !this.level) return { kind: 'ignored' };
    const beforeKeys = this.run.keysHeld.size;
    const beforeDoors = this.run.doorsOpened.size;
    const beforePathLen = this.run.path.length;
    applySlide(this.run, dir);
    if (this.run.path.length === beforePathLen) return { kind: 'blocked' }; // V2：撞墙，零副作用
    const pickedKey = this.run.keysHeld.size > beforeKeys;
    const openedDoor = this.run.doorsOpened.size > beforeDoors;
    const won = this.run.finished;
    if (won) {
      this.result = settle(this.run);
      this.state = 'SETTLEMENT';
      if (this.result) this.commitResult();
    }
    return { kind: 'moved', pickedKey, openedDoor, won };
  }

  /**
   * S2 → S4 落库：以 level.id 为键写最佳成绩（max 语义）。
   * 每日关的 id 含开局 dateKey ⇒ 跨午夜仍写回开局那天（GDD⑥ D-2 / DQ8）。
   * 写盘失败（配额/隐私模式）不影响本局展示，仅退化为内存态（D-5）。
   */
  private commitResult(): void {
    if (!this.level || !this.result) return;
    const id = this.level.id;
    this.settlementPrevBest = bestOf(this.progress, id)?.bestStar ?? null;
    const { data, improved } = recordResult(this.progress, id, this.result);
    this.progress = data;
    this.settlementImproved = improved;
    saveProgress(this.storage, this.progress);
    this.mainProgress = { allMainCleared: isDailyUnlocked(this.progress) };
  }

  // ── 每日分区（E5-1 / E5-4） ──

  /** 计算（必要时刷新）每日引导；未解锁不生成关卡 */
  ensureDaily(force = false): DailyBootstrap {
    const unlocked = this.canShowDaily();
    const todayKey = getDateKeyUTC(this.clock.now());
    if (!force && this.daily && this.daily.unlocked === unlocked && this.daily.todayKey === todayKey) {
      return this.daily;
    }
    this.daily = bootstrapDaily({ clock: this.clock, unlocked });
    return this.daily;
  }

  /** 进入每日某档（GATE_DAILY 未满足则失败） */
  enterDaily(tier: Tier): boolean {
    const st = this.ensureDaily();
    if (!st.unlocked || !st.levels) return false;
    this.enterLevel(st.levels[tier].level);
    return true;
  }

  /** 回到选关时调用：无在途局面则按当天刷新取新题（在途则不换题，见 enterLevel） */
  refreshDailyOnSelect(): void {
    if (this.state === 'PLAYING' && this.activeDailyDateKey) return; // 在途中：禁止换题
    const todayKey = getDateKeyUTC(this.clock.now());
    if (this.daily && isDailyStale(todayKey, this.daily.todayKey) && !this.activeDailyDateKey) {
      this.daily = null;
    }
    this.activeDailyDateKey = null;
    this.ensureDaily();
  }

  /** 在途每日局的开局 dateKey（非每日关为 null） */
  activeDateKey(): string | null {
    return this.activeDailyDateKey;
  }

  // ── 主线关卡（E6-1） ──

  /** 某关历史最佳星级（0 = 未通关） */
  bestStarOf(levelId: string): number {
    return bestOf(this.progress, levelId)?.bestStar ?? 0;
  }

  /** 第 n 关是否解锁：第 1 关恒开；第 n 关需第 n-1 关 ≥1★（UX §1.3） */
  isMainUnlocked(n: number): boolean {
    if (n <= 1) return true;
    return this.bestStarOf(`main-${n - 1}`) >= 1;
  }

  /** 进入主线第 n 关（未解锁则失败） */
  enterMainLevel(n: number): boolean {
    if (!this.isMainUnlocked(n)) return false;
    const lv = getMainLevel(n);
    if (!lv) return false;
    this.enterLevel(lv);
    return true;
  }

  /** 当前关的下一关（主线第 24 关 / 每日关 / 占位关 → null） */
  nextMainLevel(): Level | null {
    const n = this.level ? mainLevelNumber(this.level.id) : 0;
    if (!n) return null;
    return getMainLevel(n + 1);
  }

  /** 是否有下一关（每日关恒 false；主线由 E6 题库提供，占位关无下一关） */
  hasNextLevel(): boolean {
    return this.nextMainLevel() !== null;
  }

  /**
   * S2 → S2 失败自动重开（UX §4.3）：走入死局且无可撤销 → 重置本关。
   * 失败不离开 PLAYING、不进结算、不写进度（与 R 重开语义一致）。
   * 返回是否触发了自动重开。
   */
  autoRecoverIfStuck(): boolean {
    if (this.state !== 'PLAYING' || !this.run || !this.level) return false;
    if (this.run.finished) return false;
    const canMoveAny = ORTHO_DIRS.some(
      (d) =>
        resolveMove(this.level!, this.run!.keysHeld, this.run!.doorsOpened, this.run!.pos, d) !== 'BLOCKED',
    );
    if (canMoveAny) return false;
    if (this.run.undoStack.length > 0) return false; // 仍可撤销 → 不算失败
    this.restart();
    return true;
  }

  // ── S4 → S2（重玩本关） ──
  replay(): void {
    if (this.state !== 'SETTLEMENT' || !this.level) return;
    this.enterLevel(this.level);
  }

  // ── S4 → S2（下一关）：壳内只有占位关，由调用方传入目标关；主线第 24 关无下一关由调用方决定不调用 ──
  nextLevel(level: Level): void {
    if (this.state !== 'SETTLEMENT') return;
    this.enterLevel(level);
  }

  // ── S4 → S1（返回选关，放弃本局） ──
  settleToSelect(): void {
    if (this.state !== 'SETTLEMENT') return;
    this.goToLevelSelect();
  }

  /**
   * 构建 HUD 模型（纯逻辑，Node 可测；不触碰 DOM）。
   * 每次状态变化后由 main.ts::updateHud 复用本方法，实时派生三字段：
   *  - undoSegments = 撤销快照栈深度（ux-spec §2.2：回溯段数 = 快照栈深度）
   *  - starPreview  = 由当前 path 实时推算的星级预览（核心支柱：零回头路 = 3★）
   *  - doorStatus    = { opened, total }，total 取自 level.doors.length；无锁关卡传 null
   * 段切分 / 回头路计数复用 sim/segments 单一实现（W1）；星级阈值与 sim/stars.ts:47 同源。
   */
  buildHudModel(): HudModel | null {
    if (!this.level || !this.run) return null;
    const level = this.level;
    const run = this.run;

    // 复用 W1 单一实现：段切分 + 回头路计数（不在此重写）
    const segments = splitSegments(level.start, run.path);
    const backtracks = countBacktrackSegments(segments);
    // 星级阈值与 sim/stars.ts settle 同源：0→3★、≤1→2★、否则 1★
    const starPreview = (backtracks === 0 ? 3 : backtracks <= 1 ? 2 : 1) as HudModel['starPreview'];

    const doorTotal = level.doors.length;
    return {
      levelId: level.id,
      levelLabel: formatLevelLabel(level.id),
      timeMs: run.elapsedMs,
      steps: run.steps,
      keysHeld: [...run.keysHeld],
      totalKeys: level.meta.keyCount,
      fog: level.visionMode === 'fog',
      undoSegments: run.undoStack.length,
      starPreview,
      doorStatus: doorTotal > 0 ? { opened: run.doorsOpened.size, total: doorTotal } : null,
    };
  }
}
