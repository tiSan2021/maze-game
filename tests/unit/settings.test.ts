// settings.test.ts · 可访问性设置持久化（E6-3 / UX §5 / AC-4）
// 只暴露「关闭即不丢信息」的开关：迷雾关闭（F5）、减少动效（M2）。
// 覆盖：读写一致、脏数据/旧版本/存储不可用降级、动效档位循环、标签映射。
import { describe, it, expect } from 'vitest';
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  nextMotionScale,
  motionLabel,
  nextUiScale,
  uiScaleLabel,
} from '../../src/state/settings';
import { createMemoryStorage } from '../../src/sim/progress';

describe('settings · 读写一致', () => {
  it('默认设置带 version 字段', () => {
    expect(DEFAULT_SETTINGS.version).toBe(SETTINGS_SCHEMA_VERSION);
    expect(DEFAULT_SETTINGS.fogOff).toBe(false);
    expect(DEFAULT_SETTINGS.motionScale).toBe(1);
    expect(DEFAULT_SETTINGS.uiScale).toBe(1);
  });

  it('写入 → 读回一致（含 fogOff / motionScale 两开关）', () => {
    const storage = createMemoryStorage();
    const s = { version: SETTINGS_SCHEMA_VERSION, motionScale: 0.5 as const, fogOff: true, uiScale: 1.25 as const };
    expect(saveSettings(storage, s)).toBe(true);
    expect(loadSettings(storage)).toEqual(s);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toContain('"version":1');
  });

  it('null 存储 → 返回默认（读）；写入返回 false（退化为内存态）', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });
});

describe('settings · 脏数据 / 旧版本降级', () => {
  it('非 JSON / 非对象 / 旧版本 / 字段非法 → 回落默认，不抛错', () => {
    expect(loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: '"a string"' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: '{"version":1}' }))).toEqual(DEFAULT_SETTINGS);
    // 旧版本
    expect(
      loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 0, motionScale: 0, fogOff: true }) })),
    ).toEqual(DEFAULT_SETTINGS);
    // 字段非法（motionScale 取非枚举值、fogOff 取非布尔）→ 回落默认分量
    expect(
      loadSettings(createMemoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, motionScale: 2, fogOff: 'yes' }) })),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

describe('settings · 动效档位循环（M2）', () => {
  it('全开 → 半量 → 关闭 → 全开', () => {
    expect(nextMotionScale(1)).toBe(0.5);
    expect(nextMotionScale(0.5)).toBe(0);
    expect(nextMotionScale(0)).toBe(1);
  });

  it('标签映射：1=全开 / 0.5=半量 / 0=关闭', () => {
    expect(motionLabel(1)).toBe('全开');
    expect(motionLabel(0.5)).toBe('半量');
    expect(motionLabel(0)).toBe('关闭');
  });
});

describe('settings · 字号三档（U5）', () => {
  it('标准 → 大 → 特大 → 标准', () => {
    expect(nextUiScale(1)).toBe(1.25);
    expect(nextUiScale(1.25)).toBe(1.5);
    expect(nextUiScale(1.5)).toBe(1);
  });

  it('标签映射：1=标准 / 1.25=大 / 1.5=特大', () => {
    expect(uiScaleLabel(1)).toBe('标准');
    expect(uiScaleLabel(1.25)).toBe('大');
    expect(uiScaleLabel(1.5)).toBe('特大');
  });

  it('旧存档无 uiScale 字段 → 回落标准档（向后兼容，不重置其它项）', () => {
    const loaded = loadSettings(
      createMemoryStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, motionScale: 0.5, fogOff: true }),
      }),
    );
    expect(loaded.uiScale).toBe(1);
    expect(loaded.fogOff).toBe(true);
    expect(loaded.motionScale).toBe(0.5);
  });

  it('非法 uiScale（如 3）→ 回落标准档', () => {
    const loaded = loadSettings(
      createMemoryStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, motionScale: 1, fogOff: false, uiScale: 3 }),
      }),
    );
    expect(loaded.uiScale).toBe(1);
  });
});
