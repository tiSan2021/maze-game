// app-edge.test.ts · Phase 6 边界/回归（quality-lead）
// 聚焦 AppMachine 的「安全 no-op / 拦截 / 一致性」边界，补齐 app-state-machine.test.ts 未覆盖处。
// 全部为纯逻辑（无 DOM/Canvas），可在 Node 下单测。不重复 main-level-select.test.ts 已覆盖的 nextMainLevel@24。
import { describe, it, expect } from 'vitest';
import { AppMachine } from '../../src/state/app';
import { makeLevel, emptyGrid } from '../helpers/build-level';
import {
  createMemoryStorage,
  emptyProgress,
  saveProgress,
  recordResult,
  mainLevelId,
  isMainAllCleared,
  MAIN_LEVEL_COUNT,
} from '../../src/sim/progress';
import type { StarResult } from '../../src/sim/stars';

function result(star: 1 | 2 | 3): StarResult {
  return { star, backtrackSegments: 0, segmentCount: 1, segments: [], steps: 10, elapsedMs: 1000 };
}

describe('AppMachine · 安全 no-op 边界（不抛错、状态不变）', () => {
  it('undo() 在起始态（MENU，无 level/run）为安全 no-op', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(app.state).toBe('MENU');
    expect(app.undo()).toBe(false);
    expect(app.state).toBe('MENU');
    expect(app.run).toBeNull();
  });

  it('undo() 在 PLAYING 但无历史（未移动）时返回 false 且 run 不变', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    app.enterLevel(makeLevel());
    expect(app.run!.undoStack.length).toBe(0);
    expect(app.undo()).toBe(false);
    expect(app.state).toBe('PLAYING');
    expect(app.run!.steps).toBe(0);
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
  });

  it('restart() 在非 PLAYING/PAUSED（如 MENU）为安全 no-op，不抛错', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(() => app.restart()).not.toThrow();
    expect(app.level).toBeNull();
    expect(app.run).toBeNull();
  });

  it('move() 在进入关卡前（无 level）为安全 no-op，不抛错', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(() => app.move('right')).not.toThrow();
    expect(app.state).toBe('MENU');
    expect(app.result).toBeNull();
    expect(app.run).toBeNull();
  });
});

describe('AppMachine · restart() 完整重置 run', () => {
  it('R 重开：steps / elapsedMs / visited 全部归零（visited 仅留起点）', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    app.enterLevel(makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));
    app.move('right'); // 一次有效滑行：steps=1、压入撤销快照
    expect(app.run!.steps).toBe(1);
    // 人为注入非零 elapsed，证明 restart 会把它归零（且 elapsedMs 不随 move 自然增长的部分也应清空）
    app.run!.elapsedMs = 1234;
    expect(app.run!.visited.size).toBeGreaterThan(1);

    app.restart();
    expect(app.state).toBe('PLAYING');
    expect(app.run!.steps).toBe(0);
    expect(app.run!.elapsedMs).toBe(0);
    expect(app.run!.path.length).toBe(0);
    expect(app.run!.undoStack.length).toBe(0);
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
    expect(app.run!.visited.size).toBe(1); // 单调集合重置为仅起点
    expect(app.run!.visited.has('1,1')).toBe(true);
  });
});

describe('AppMachine · GATE_DAILY 拦截（GDD⑥ D-1）', () => {
  it('enterDaily 在主线未全清时被拦截：返回 false、不进入、不抛错', () => {
    const app = new AppMachine({ storage: createMemoryStorage() });
    expect(isMainAllCleared(app.progress)).toBe(false);
    expect(app.canShowDaily()).toBe(false);

    let threw = false;
    let ok = false;
    try {
      ok = app.enterDaily('mid');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(ok).toBe(false);
    expect(app.state).toBe('MENU'); // 未离开主菜单
    expect(app.level).toBeNull();
    expect(app.run).toBeNull();
  });
});

describe('AppMachine · canShowDaily() 与 isMainAllCleared() 一致性', () => {
  it('未全清 / 已全清两种情形下二者始终相等', () => {
    const fresh = new AppMachine({ storage: createMemoryStorage() });
    expect(fresh.canShowDaily()).toBe(isMainAllCleared(fresh.progress));
    expect(fresh.canShowDaily()).toBe(false);

    const storage = createMemoryStorage();
    let data = emptyProgress();
    for (let i = 1; i <= MAIN_LEVEL_COUNT; i++) data = recordResult(data, mainLevelId(i), result(1)).data;
    saveProgress(storage, data);
    const app = new AppMachine({ storage });
    expect(isMainAllCleared(app.progress)).toBe(true);
    expect(app.canShowDaily()).toBe(true);
    expect(app.canShowDaily()).toBe(isMainAllCleared(app.progress));
  });
});
