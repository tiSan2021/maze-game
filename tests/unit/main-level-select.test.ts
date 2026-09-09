// main-level-select.test.ts · 主线选关与解锁（E6-1 接线）
// 覆盖：1★ 解锁下一关、进入/下一关取关、HUD 关卡标签、24 关全清后 GATE_DAILY 打开。
import { describe, it, expect } from 'vitest';
import { AppMachine, formatLevelLabel } from '../../src/state/app';
import { getMainLevel, mainLevelNumber, MAIN_LEVELS } from '../../src/content/main-levels';
import { createMemoryStorage, emptyProgress, saveProgress, recordResult, mainLevelId, MAIN_LEVEL_COUNT } from '../../src/sim/progress';

function result(star: 1 | 2 | 3) {
  return { star, backtrackSegments: 0, segmentCount: 1, segments: [], steps: 10, elapsedMs: 1000 };
}

describe('主线 · 解锁与进入', () => {
  it('初始只解锁第 1 关', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(app.isMainUnlocked(1)).toBe(true);
    expect(app.isMainUnlocked(2)).toBe(false);
    expect(app.enterMainLevel(2)).toBe(false);
    expect(app.level).toBeNull();
    expect(app.enterMainLevel(1)).toBe(true);
    expect(app.level?.id).toBe('main-1');
  });

  it('前一关 ≥1★ 才解锁下一关（1★ 即解锁）', () => {
    const storage = createMemoryStorage();
    let data = recordResult(emptyProgress(), mainLevelId(1), result(1)).data;
    saveProgress(storage, data);
    const app = new AppMachine({ storage });
    expect(app.bestStarOf(mainLevelId(1))).toBe(1);
    expect(app.isMainUnlocked(2)).toBe(true);
    expect(app.isMainUnlocked(3)).toBe(false);
    expect(app.enterMainLevel(2)).toBe(true);
    expect(app.level?.id).toBe('main-2');
  });

  it('24 关全 1★ → GATE_DAILY 打开（主线通关解锁每日）', () => {
    const storage = createMemoryStorage();
    let data = emptyProgress();
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) data = recordResult(data, mainLevelId(i), result(1)).data;
    saveProgress(storage, data);
    const app = new AppMachine({ storage });
    expect(app.canShowDaily()).toBe(true);
    for (let n = 1; n <= MAIN_LEVEL_COUNT; n++) expect(app.isMainUnlocked(n)).toBe(true);
  });

  it('越界关号返回 null，不进入', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(getMainLevel(0)).toBeNull();
    expect(getMainLevel(25)).toBeNull();
    expect(app.enterMainLevel(99)).toBe(false);
  });
});

describe('主线 · 下一关链路', () => {
  it('第 n 关的下一关是 main-(n+1)；第 24 关与每日关为 null', () => {
    const storage = createMemoryStorage();
    let data = emptyProgress();
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) data = recordResult(data, mainLevelId(i), result(1)).data;
    saveProgress(storage, data);

    const app = new AppMachine({ storage });
    app.enterMainLevel(3);
    expect(mainLevelNumber(app.level!.id)).toBe(3);
    expect(app.nextMainLevel()?.id).toBe('main-4');
    expect(app.hasNextLevel()).toBe(true);

    app.enterMainLevel(24);
    expect(app.nextMainLevel()).toBeNull();
    expect(app.hasNextLevel()).toBe(false);

    // 每日关恒无下一关
    app.enterLevel({ ...MAIN_LEVELS[0], id: 'daily-2026-09-08-mid' });
    expect(app.nextMainLevel()).toBeNull();
    expect(app.hasNextLevel()).toBe(false);
  });
});

describe('主线 · HUD 关卡标签（UX §2.2）', () => {
  it('formatLevelLabel：第 N 关 / 每日 · 中 / 高 / 回退 id', () => {
    expect(formatLevelLabel('main-7')).toBe('第 7 关');
    expect(formatLevelLabel('daily-2026-09-08-mid')).toBe('每日 · 中');
    expect(formatLevelLabel('daily-2026-09-08-high')).toBe('每日 · 高');
    expect(formatLevelLabel('whatever')).toBe('whatever');
  });

  it('buildHudModel 带 levelLabel，不再把 main-N 直接显示给玩家', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    app.enterMainLevel(1);
    const m = app.buildHudModel()!;
    expect(m.levelLabel).toBe('第 1 关');
    expect(m.levelId).toBe('main-1'); // 身份字段保持原样
  });
});
