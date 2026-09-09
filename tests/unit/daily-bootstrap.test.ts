// daily-bootstrap.test.ts · 每日种子引导与跨午夜（E5-1 / E5-4 / GDD⑥）
// 覆盖：UTC 日期键、两条档位、id 约定、fog、确定性、GATE_DAILY 未解锁不生成、跨午夜不局中换题。
import { describe, it, expect } from 'vitest';
import { fixedClock } from '../../src/core/clock';
import { getDateKeyUTC } from '../../src/core/rng';
import { bootstrapDaily, dailyLevelId, isDailyStale } from '../../src/gen/daily';
import { AppMachine } from '../../src/state/app';
import {
  createMemoryStorage,
  emptyProgress,
  saveProgress,
  mainLevelId,
  isMainAllCleared,
  bestOf,
  MAIN_LEVEL_COUNT,
} from '../../src/sim/progress';
import { makeLevel } from '../helpers/build-level';

describe('每日 · UTC 日期键', () => {
  it('按 UTC 日历取键（跨时区、跨午夜边界）', () => {
    expect(getDateKeyUTC(new Date(Date.UTC(2026, 8, 8, 23, 30)))).toBe('2026-09-08');
    expect(getDateKeyUTC(new Date(Date.UTC(2026, 8, 9, 0, 0)))).toBe('2026-09-09');
    expect(getDateKeyUTC(new Date(Date.UTC(2025, 11, 31, 23, 59)))).toBe('2025-12-31');
    expect(getDateKeyUTC(new Date(Date.UTC(2026, 0, 1, 0, 0)))).toBe('2026-01-01');
  });
});

describe('每日 · 引导（bootstrapDaily）', () => {
  const clock = fixedClock(new Date(Date.UTC(2026, 8, 8, 10, 0)));

  it('未解锁（GATE_DAILY）→ unlocked=false 且不生成关卡（D-1）', () => {
    const st = bootstrapDaily({ clock, unlocked: false });
    expect(st.unlocked).toBe(false);
    expect(st.levels).toBeNull();
    expect(st.todayKey).toBe('2026-09-08');
  });

  it('解锁后产出 mid / high 两条，id 与 visionMode 符合约定', () => {
    const st = bootstrapDaily({ clock, unlocked: true });
    expect(st.unlocked).toBe(true);
    expect(st.levels).not.toBeNull();
    const mid = st.levels!.mid;
    const high = st.levels!.high;

    expect(mid.tier).toBe('mid');
    expect(high.tier).toBe('high');
    expect(mid.id).toBe(dailyLevelId('2026-09-08', 'mid'));
    expect(high.id).toBe('daily-2026-09-08-high');
    expect(mid.level.id).toBe(mid.id);
    expect(high.level.id).toBe(high.id);
    expect(mid.level.visionMode).toBe('fog');
    expect(high.level.visionMode).toBe('fog');
    // 无空缺日：正常种子不应触发兜底
    expect(mid.fallbackUsed).toBe(false);
    expect(high.fallbackUsed).toBe(false);
  });

  it('同 (dateKey,tier,version) 同图；换日期换图（DQ1）', () => {
    const a = bootstrapDaily({ clock, unlocked: true });
    const b = bootstrapDaily({ clock, unlocked: true });
    expect(JSON.stringify(a.levels!.mid.level)).toBe(JSON.stringify(b.levels!.mid.level));

    const tomorrow = bootstrapDaily({
      clock: fixedClock(new Date(Date.UTC(2026, 8, 9, 10, 0))),
      unlocked: true,
    });
    expect(tomorrow.todayKey).toBe('2026-09-09');
    expect(JSON.stringify(tomorrow.levels!.mid.level)).not.toBe(
      JSON.stringify(a.levels!.mid.level),
    );
  });

  it('isDailyStale：在途 dateKey 与今天不同即为过期', () => {
    expect(isDailyStale('2026-09-09', '2026-09-08')).toBe(true);
    expect(isDailyStale('2026-09-08', '2026-09-08')).toBe(false);
    expect(isDailyStale('2026-09-08', null)).toBe(false);
  });
});

describe('每日 · 应用状态机接线与跨午夜（E5-4）', () => {
  function seedUnlocked() {
    const storage = createMemoryStorage();
    const data = emptyProgress();
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) {
      data.levels[mainLevelId(i)] = { bestStar: 1, bestStarSteps: 10, bestStarElapsedMs: 1000 };
    }
    saveProgress(storage, data);
    return storage;
  }

  it('主线全清后 GATE_DAILY 打开，可进入每日关并锁定开局 dateKey', () => {
    let t = new Date(Date.UTC(2026, 8, 8, 23, 30));
    const app = new AppMachine({ storage: seedUnlocked(), clock: { now: () => t } });
    expect(app.canShowDaily()).toBe(true);
    expect(isMainAllCleared(app.progress)).toBe(true);

    expect(app.enterDaily('mid')).toBe(true);
    expect(app.level?.id).toBe('daily-2026-09-08-mid');
    expect(app.activeDateKey()).toBe('2026-09-08');

    // 跨过 UTC 午夜：局中不换题（GDD⑥ D-2）
    t = new Date(Date.UTC(2026, 8, 9, 0, 30));
    app.refreshDailyOnSelect();
    expect(app.level?.id).toBe('daily-2026-09-08-mid');
    expect(app.activeDateKey()).toBe('2026-09-08');

    // 放弃本局回到选关 → 按新一天刷新取新题
    app.goToLevelSelect();
    expect(app.daily?.todayKey).toBe('2026-09-09');
    expect(app.enterDaily('high')).toBe(true);
    expect(app.level?.id).toBe('daily-2026-09-09-high');
  });

  it('未解锁时 enterDaily 失败且不生成关卡', () => {
    const app = new AppMachine({
      storage: createMemoryStorage(),
      clock: fixedClock(new Date(Date.UTC(2026, 8, 8, 10, 0))),
    });
    expect(app.canShowDaily()).toBe(false);
    expect(app.enterDaily('mid')).toBe(false);
    expect(app.level).toBeNull();
    expect(app.daily?.levels ?? null).toBeNull();
  });

  it('通关写入的键是开局 dateKey（DQ8：跨午夜不串天）', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    // 用极小关卡模拟「开局日期为 2026-09-08 的每日关」
    app.enterLevel(
      makeLevel({
        id: 'daily-2026-09-08-mid',
        start: { x: 1, y: 1 },
        exit: { x: 1, y: 2 },
      }),
    );
    expect(app.activeDateKey()).toBe('2026-09-08');
    app.move('down'); // 踏入出口
    expect(app.state).toBe('SETTLEMENT');
    expect(app.result).not.toBeNull();
    expect(bestOf(app.progress, 'daily-2026-09-08-mid')).not.toBeNull();
    expect(app.settlementImproved).toBe(true);
    expect(app.settlementPrevBest).toBeNull(); // 首次通关
  });
});
