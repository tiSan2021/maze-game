// settings-persist.test.ts · Phase 6 边界/回归（quality-lead）
// 聚焦「存储可用/不可用」与「两开关字段相互独立」的组合断言，补齐 settings.test.ts 未覆盖处。
// settings.test.ts 已覆盖：读写一致（含 fogOff/motionScale 同时设值）、null 存储回落、脏数据/旧版本降级、动效档位循环。
import { describe, it, expect } from 'vitest';
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  nextMotionScale,
} from '../../src/state/settings';
import { createMemoryStorage } from '../../src/sim/progress';

/** 会抛错的存储（模拟配额写满 / 隐私模式 getItem 抛异常） */
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

describe('settings · 存储不可用降级', () => {
  it('getItem 抛错 → loadSettings 回落默认，不崩溃', () => {
    expect(() => loadSettings(brokenStorage())).not.toThrow();
    expect(loadSettings(brokenStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('setItem 抛错 → saveSettings 返回 false（调用方退化为内存态）', () => {
    expect(saveSettings(brokenStorage(), DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('settings · 两开关字段相互独立且持久化', () => {
  it('fogOff=true 写入后读回仍为 true，且 motionScale 不被改动', () => {
    const storage = createMemoryStorage();
    const s = { version: SETTINGS_SCHEMA_VERSION, motionScale: 1 as const, fogOff: true };
    expect(saveSettings(storage, s)).toBe(true);
    const back = loadSettings(storage);
    expect(back.fogOff).toBe(true);
    expect(back.motionScale).toBe(1);
  });

  it('独立演进：改 motionScale 后 fogOff 仍保持（互不影响）', () => {
    const storage = createMemoryStorage();
    // 先写入 fogOff=true、motionScale=1
    expect(saveSettings(storage, { version: SETTINGS_SCHEMA_VERSION, motionScale: 1, fogOff: true })).toBe(true);
    // 仅切动效档位后再次写入
    const next = nextMotionScale(loadSettings(storage).motionScale); // 1 → 0.5
    expect(saveSettings(storage, { version: SETTINGS_SCHEMA_VERSION, motionScale: next, fogOff: true })).toBe(true);

    const back = loadSettings(storage);
    expect(back.fogOff).toBe(true); // 雾开关保持
    expect(back.motionScale).toBe(0.5); // 动效档位演进
    expect(back.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)!).fogOff).toBe(true);
  });
});
