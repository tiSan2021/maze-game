// progress.test.ts · 进度持久化（E5-2 / GDD④ §2.4 · GDD⑥ D-5）
// 覆盖：schema 版本、写入读回一致、脏数据/旧版本降级、max 语义、GATE_DAILY 判定、存储不可用。
import { describe, it, expect } from 'vitest';
import type { StarResult } from '../../src/sim/stars';
import {
  PROGRESS_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  MAIN_LEVEL_COUNT,
  type LevelRecord,
  type ProgressData,
  createMemoryStorage,
  emptyProgress,
  loadProgress,
  saveProgress,
  recordResult,
  bestOf,
  isMainAllCleared,
  isDailyUnlocked,
  mainLevelId,
} from '../../src/sim/progress';

function result(star: 1 | 2 | 3, steps: number, ms: number): StarResult {
  return { star, backtrackSegments: star === 3 ? 0 : 1, segmentCount: 2, segments: [], steps, elapsedMs: ms };
}

/** 会抛错的存储（模拟配额写满 / 隐私模式） */
function brokenStorage() {
  return {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {},
  };
}

describe('progress · schema 与读写', () => {
  it('空进度带 version 字段', () => {
    const p = emptyProgress();
    expect(p.version).toBe(PROGRESS_SCHEMA_VERSION);
    expect(p.levels).toEqual({});
  });

  it('写入 → 读回一致', () => {
    const storage = createMemoryStorage();
    const data = recordResult(emptyProgress(), 'main-1', result(3, 20, 5000)).data;
    expect(saveProgress(storage, data)).toBe(true);
    expect(loadProgress(storage)).toEqual(data);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toContain('"version":1');
  });

  it('脏数据（非 JSON / 结构非法）→ 降级为空进度，不抛错', () => {
    expect(loadProgress(createMemoryStorage({ [PROGRESS_STORAGE_KEY]: '{not json' }))).toEqual(emptyProgress());
    expect(loadProgress(createMemoryStorage({ [PROGRESS_STORAGE_KEY]: '"a string"' }))).toEqual(emptyProgress());
    expect(loadProgress(createMemoryStorage({ [PROGRESS_STORAGE_KEY]: '{"version":1}' }))).toEqual(emptyProgress());
    // 条目非法则丢弃，合法则保留
    const mixed = loadProgress(
      createMemoryStorage({
        [PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 1, levels: { 'main-1': { bestStar: 9 }, 'main-2': { bestStar: 2, bestStarSteps: 3, bestStarElapsedMs: 4 } } }),
      }),
    );
    expect(mixed.levels['main-1']).toBeUndefined();
    expect(mixed.levels['main-2']).toEqual({ bestStar: 2, bestStarSteps: 3, bestStarElapsedMs: 4 });
  });

  it('旧版本存档 → 重置（不崩溃、不混用）', () => {
    const storage = createMemoryStorage({
      [PROGRESS_STORAGE_KEY]: JSON.stringify({ version: 0, levels: { 'main-1': { bestStar: 3, bestStarSteps: 1, bestStarElapsedMs: 1 } } }),
    });
    expect(loadProgress(storage)).toEqual(emptyProgress());
  });

  it('存储不可用 → 读空进度、写返回 false（降级内存态）', () => {
    expect(loadProgress(brokenStorage())).toEqual(emptyProgress());
    expect(saveProgress(brokenStorage(), emptyProgress())).toBe(false);
    expect(loadProgress(null)).toEqual(emptyProgress());
  });
});

describe('progress · 最佳成绩 max 语义（GDD④ S6）', () => {
  it('首次记录即写入', () => {
    const { data, improved } = recordResult(emptyProgress(), 'main-1', result(2, 30, 9000));
    expect(improved).toBe(true);
    expect(bestOf(data, 'main-1')).toEqual({ bestStar: 2, bestStarSteps: 30, bestStarElapsedMs: 9000 });
  });

  it('低星重打不覆盖高星', () => {
    const first = recordResult(emptyProgress(), 'main-1', result(3, 20, 5000)).data;
    const second = recordResult(first, 'main-1', result(1, 10, 1000));
    expect(second.improved).toBe(false);
    expect(bestOf(second.data, 'main-1')?.bestStar).toBe(3);
    expect(bestOf(second.data, 'main-1')?.bestStarSteps).toBe(20);
  });

  it('更高星覆盖；同星则步数/用时取更优', () => {
    const a = recordResult(emptyProgress(), 'main-1', result(2, 30, 9000)).data;
    const b = recordResult(a, 'main-1', result(3, 40, 9000)).data;
    expect(bestOf(b, 'main-1')).toEqual({ bestStar: 3, bestStarSteps: 40, bestStarElapsedMs: 9000 });
    const c = recordResult(b, 'main-1', result(3, 25, 9000)).data;
    expect(bestOf(c, 'main-1')?.bestStarSteps).toBe(25);
    const d = recordResult(c, 'main-1', result(3, 25, 4000)).data;
    expect(bestOf(d, 'main-1')?.bestStarElapsedMs).toBe(4000);
    const e = recordResult(d, 'main-1', result(3, 26, 9000));
    expect(e.improved).toBe(false); // 更差 → 保留
  });

  it('每日键与主线键互不干扰（DQ7）', () => {
    let data = recordResult(emptyProgress(), 'main-1', result(3, 10, 100)).data;
    data = recordResult(data, 'daily-2026-09-08-mid', result(1, 99, 999)).data;
    expect(bestOf(data, 'main-1')?.bestStar).toBe(3);
    expect(bestOf(data, 'daily-2026-09-08-mid')?.bestStar).toBe(1);
  });
});

describe('progress · GATE_DAILY 判定', () => {
  it('未全清为 false；24 关全 ≥1★ 为 true', () => {
    let data = emptyProgress();
    expect(isMainAllCleared(data)).toBe(false);
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) {
      data = recordResult(data, mainLevelId(i), result(1, 5, 100)).data;
    }
    expect(isMainAllCleared(data)).toBe(true);
  });

  it('缺一关即不解锁', () => {
    let data = emptyProgress();
    for (let i = 1; i < MAIN_LEVEL_COUNT; i++) {
      data = recordResult(data, mainLevelId(i), result(1, 5, 100)).data;
    }
    expect(isMainAllCleared(data)).toBe(false);
  });
});

describe('progress · isDailyUnlocked（解锁一次即永久）', () => {
  it('dailyUnlockedEver === true 时，即便只通关 main-1 也算解锁', () => {
    const rec: LevelRecord = { bestStar: 1, bestStarSteps: 5, bestStarElapsedMs: 100 };
    const data: ProgressData = { version: PROGRESS_SCHEMA_VERSION, levels: { 'main-1': rec }, dailyUnlockedEver: true };
    expect(isMainAllCleared(data)).toBe(false); // 当前未全清
    expect(isDailyUnlocked(data)).toBe(true); // 但历史曾全清 → 永久解锁
  });

  it('24 关全清后 isDailyUnlocked 为 true 且返回数据携 dailyUnlockedEver=true', () => {
    let data = emptyProgress();
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) {
      data = recordResult(data, mainLevelId(i), result(1, 5, 100)).data;
    }
    expect(isDailyUnlocked(data)).toBe(true);
    expect(data.dailyUnlockedEver).toBe(true);
    // 再打一次不丢失该标记
    const after = recordResult(data, mainLevelId(1), result(3, 4, 80)).data;
    expect(after.dailyUnlockedEver).toBe(true);
  });

  it('全新玩家只通关 1 关：未解锁且返回数据无 dailyUnlockedEver 字段', () => {
    const data = recordResult(emptyProgress(), 'main-1', result(1, 5, 100)).data;
    expect(isDailyUnlocked(data)).toBe(false);
    expect(data.dailyUnlockedEver).toBeUndefined();
  });

  it('遗留存档（v1，main-1..main-12 各 ≥1★，无 dailyUnlockedEver）→ loadProgress 后永久解锁', () => {
    const levels: Record<string, unknown> = {};
    for (let i = 1; i <= 12; i++) {
      levels[`main-${i}`] = { bestStar: 1, bestStarSteps: 5, bestStarElapsedMs: 100 };
    }
    const saved = JSON.stringify({ version: PROGRESS_SCHEMA_VERSION, levels });
    const loaded = loadProgress(createMemoryStorage({ [PROGRESS_STORAGE_KEY]: saved }));
    expect(isDailyUnlocked(loaded)).toBe(true);
    expect(loaded.dailyUnlockedEver).toBe(true);
  });

  it('进度回写读回一致（round-trip）', () => {
    const storage = createMemoryStorage();
    const data = recordResult(emptyProgress(), 'main-1', result(3, 20, 5000)).data;
    expect(saveProgress(storage, data)).toBe(true);
    expect(loadProgress(storage)).toEqual(data);
  });
});
