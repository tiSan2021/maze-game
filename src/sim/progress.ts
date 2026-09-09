// progress.ts · 进度持久化（E5-2 / GDD④ §2.4 · GDD⑥ D-5）
// localStorage 存档：版本化 schema + 每关最佳星级/步数/用时（max 语义）。
// A6：本文件属 src/sim，禁止直接构造时间对象（时间源不外泄）；耗时由调用方传入 elapsedMs。
// 存储经 StorageLike 注入：浏览器传 localStorage，Node 测试传 createMemoryStorage()；
// 存储不可用/写满/脏数据一律降级为空进度，绝不抛错（D-5 / Y6）。

import type { StarResult } from './stars';

/** schema 版本：不匹配的旧存档一律重置（GDD⑥ §4.4 旧版本标注在此简化为重置） */
export const PROGRESS_SCHEMA_VERSION = 1;
export const PROGRESS_STORAGE_KEY = 'maze.progress';

/** 主线关卡数：24 关全部 ≥1★ 才解锁每日（GDD⑥ §2.3） */
export const MAIN_LEVEL_COUNT = 24;

/** 一次性 12→24 迁移种子：在 v0.5.0 之前已通关 v0.4.0 的 12 关主线的玩家，保持每日分区永久解锁。
 *  已知轻微副作用（可接受，仅此一次性扩容）：一个全新的 v0.5.0 玩家若恰好通关前 12 关，也会获得永久每日解锁。 */
export const LEGACY_MAIN_LEVEL_COUNT = 12;

export interface LevelRecord {
  bestStar: 1 | 2 | 3;
  /** 该星级下的最优步数（展示用） */
  bestStarSteps: number;
  bestStarElapsedMs: number;
}

export interface ProgressData {
  version: number;
  /** 键 = level.id（main-N / daily-YYYY-MM-DD-mid） */
  levels: Record<string, LevelRecord>;
  /** 历史上是否曾永久解锁每日分区（解锁一次即永久；仅置 true，绝不置 false/undefined） */
  dailyUnlockedEver?: boolean;
}

/** 最小存储接口（localStorage / 内存替身同构） */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 内存存储：测试用，或 localStorage 不可用时的降级态（会话内有效） */
export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

export function emptyProgress(): ProgressData {
  return { version: PROGRESS_SCHEMA_VERSION, levels: {} };
}

export function mainLevelId(n: number): string {
  return `main-${n}`;
}

function isRecord(v: unknown): v is LevelRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    (r.bestStar === 1 || r.bestStar === 2 || r.bestStar === 3) &&
    typeof r.bestStarSteps === 'number' &&
    Number.isFinite(r.bestStarSteps) &&
    typeof r.bestStarElapsedMs === 'number' &&
    Number.isFinite(r.bestStarElapsedMs)
  );
}

/**
 * 读取存档。JSON 损坏 / 版本不符 / 结构非法 / 存储不可用 ⇒ 返回空进度（不抛错）。
 */
export function loadProgress(storage: StorageLike | null | undefined): ProgressData {
  if (!storage) return emptyProgress();
  let raw: string | null = null;
  try {
    raw = storage.getItem(PROGRESS_STORAGE_KEY);
  } catch {
    return emptyProgress();
  }
  if (!raw) return emptyProgress();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return emptyProgress();
    const data = parsed as Record<string, unknown>;
    if (data.version !== PROGRESS_SCHEMA_VERSION) return emptyProgress(); // 旧版本 → 重置
    if (typeof data.levels !== 'object' || data.levels === null) return emptyProgress();

    const levels: Record<string, LevelRecord> = {};
    for (const [id, rec] of Object.entries(data.levels as Record<string, unknown>)) {
      if (isRecord(rec)) levels[id] = { ...rec }; // 逐项校验，脏条目丢弃
    }
    // 一次性迁移：v0.4.0 已通关前 12 关主线的玩家 → 永久解锁每日分区
    const legacyUnlocked = (() => {
      for (let i = 1; i <= LEGACY_MAIN_LEVEL_COUNT; i++) {
        const r = (data.levels as Record<string, unknown>)[mainLevelId(i)];
        if (!isRecord(r) || r.bestStar < 1) return false;
      }
      return true;
    })();
    const ever = data.dailyUnlockedEver === true || legacyUnlocked;
    return { version: PROGRESS_SCHEMA_VERSION, levels, dailyUnlockedEver: ever ? true : undefined };
  } catch {
    return emptyProgress(); // 脏数据（非 JSON）→ 重置
  }
}

/** 写回存档。失败（配额满 / 隐私模式）返回 false，调用方据此降级内存态。 */
export function saveProgress(storage: StorageLike | null | undefined, data: ProgressData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * 记录一次结算（纯函数）：bestStar 取 max；同星则步数取 min，步数相同取用时 min。
 * 低星重打不覆盖高星（GDD④ S6 / Y5）。
 */
export function recordResult(
  data: ProgressData,
  levelId: string,
  result: StarResult,
): { data: ProgressData; improved: boolean } {
  const prev = data.levels[levelId];
  const next: LevelRecord = {
    bestStar: result.star,
    bestStarSteps: result.steps,
    bestStarElapsedMs: result.elapsedMs,
  };
  let nextData: ProgressData;
  let improved: boolean;
  if (!prev) {
    nextData = { ...data, levels: { ...data.levels, [levelId]: next } };
    improved = true;
  } else if (result.star > prev.bestStar) {
    nextData = { ...data, levels: { ...data.levels, [levelId]: next } };
    improved = true;
  } else if (result.star < prev.bestStar) {
    nextData = data; // 保留历史最佳
    improved = false;
  } else {
    const better =
      result.steps < prev.bestStarSteps ||
      (result.steps === prev.bestStarSteps && result.elapsedMs < prev.bestStarElapsedMs);
    if (!better) {
      nextData = data;
      improved = false;
    } else {
      nextData = { ...data, levels: { ...data.levels, [levelId]: next } };
      improved = true;
    }
  }
  // 解锁一次即永久：仅置 true，绝不置 false/undefined（保持字段缺失语义，便于 round-trip）
  const unlockedEver = data.dailyUnlockedEver === true || isMainAllCleared(nextData);
  if (unlockedEver) nextData = { ...nextData, dailyUnlockedEver: true };
  return { data: nextData, improved };
}

export function bestOf(data: ProgressData, levelId: string): LevelRecord | null {
  const r = data.levels[levelId];
  return r ? { ...r } : null;
}

/** GATE_DAILY 之「当前全清」判定：主线全部 MAIN_LEVEL_COUNT 关 ≥1★。
 *  注意：仅代表「此刻是否全清」，不表示永久解锁状态；永久解锁由 isDailyUnlocked 叠加 dailyUnlockedEver 判定。 */
export function isMainAllCleared(data: ProgressData): boolean {
  for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) {
    const rec = data.levels[mainLevelId(i)];
    if (!rec || rec.bestStar < 1) return false;
  }
  return true;
}

/** GATE_DAILY 判定（解锁一次即永久）：当前全清 或 历史曾全清 */
export function isDailyUnlocked(data: ProgressData): boolean {
  return isMainAllCleared(data) || data.dailyUnlockedEver === true;
}
