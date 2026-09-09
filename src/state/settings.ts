// settings.ts · 可访问性设置与持久化（E6-3 / UX §5 / AC-4）
// 只做「关闭即不丢信息」的开关：迷雾关闭（F5）、减少动效（M2）。
// 不可关的（图案填充 V2 / 钥匙双编码 V3 / 对比度 V5-V6 / 墙邻感知 F3）不提供开关（levels.md 降级底线）。
// 存储经 StorageLike 注入（浏览器 localStorage / Node 内存替身）；脏数据一律回落默认值，不抛错。

import type { StorageLike } from '../sim/progress';
import { DEFAULT_MOTION_SCALE } from '../core/constants/motion';
import type { MotionScale } from '../core/constants/motion';

export type { MotionScale };

export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'maze.settings';

export interface A11ySettings {
  version: number;
  /** 减少动效（M2 / AC-4）：1 = 全开，0.5 = 半量，0 = 关闭；0 时装饰动效消失但信息仍可见 */
  motionScale: MotionScale;
  /** 关闭迷雾（F5）：复用关 1–8 全烘焙路径；不改 visible/visited/path，不影响星级 */
  fogOff: boolean;
}

export const DEFAULT_SETTINGS: A11ySettings = {
  version: SETTINGS_SCHEMA_VERSION,
  motionScale: DEFAULT_MOTION_SCALE,
  fogOff: false,
};

const MOTION_CYCLE: MotionScale[] = [1, 0.5, 0];

/** 动效档位循环：全开 → 半量 → 关闭 → 全开 */
export function nextMotionScale(cur: MotionScale): MotionScale {
  const i = MOTION_CYCLE.indexOf(cur);
  return MOTION_CYCLE[(i + 1) % MOTION_CYCLE.length];
}

export function motionLabel(s: MotionScale): string {
  return s === 1 ? '全开' : s === 0.5 ? '半量' : '关闭';
}

function isMotionScale(v: unknown): v is MotionScale {
  return v === 1 || v === 0.5 || v === 0;
}

/** 读取设置：JSON 损坏 / 版本不符 / 字段非法 → 回落默认（不崩溃） */
export function loadSettings(storage: StorageLike | null | undefined): A11ySettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  let raw: string | null = null;
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    if (parsed.version !== SETTINGS_SCHEMA_VERSION) return { ...DEFAULT_SETTINGS };
    return {
      version: SETTINGS_SCHEMA_VERSION,
      motionScale: isMotionScale(parsed.motionScale) ? parsed.motionScale : DEFAULT_MOTION_SCALE,
      fogOff: typeof parsed.fogOff === 'boolean' ? parsed.fogOff : false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 写回设置：失败（配额/隐私模式）返回 false，调用方退化为内存态 */
export function saveSettings(storage: StorageLike | null | undefined, s: A11ySettings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
