// daily.ts · 每日种子与选关（E5-1 / GDD⑥）
// UTC 日期键 → getSeed → generate，产出「每日·中」「每日·高」两条；visionMode 恒 'fog'。
// A6：本文件属 src/gen，禁止直接构造时间对象（时间源不外泄），时间一律经 Clock 注入。
// 同 (dateKey, tier, version) ⇒ 同关卡（DQ1 可分享、可比成绩）。

import type { Level, Tier } from '../core/types';
import type { Clock } from '../core/clock';
import { getDateKeyUTC, getSeed } from '../core/rng';
import { generate, GENERATOR_VERSION } from './generator';

/** 每日两档（GDD⑥ §2.1：每天两张，中 + 高） */
export const DAILY_TIERS: readonly Tier[] = ['mid', 'high'];

/** 每日关卡 id 约定（GDD⑥ §4.6）：与主线 main-* 键空间隔离（DQ7） */
export function dailyLevelId(dateKey: string, tier: Tier): string {
  return `daily-${dateKey}-${tier}`;
}

export interface DailyLevel {
  dateKey: string;
  tier: Tier;
  /** = dailyLevelId(dateKey, tier) */
  id: string;
  level: Level;
  /** 生成器三级回退是否命中兜底（DQ6：无空缺日） */
  fallbackUsed: boolean;
  attempts: number;
}

export interface DailyBootstrap {
  /** GATE_DAILY：主线 24 关未全清时为 false（此时 levels 恒为 null，分区不显示） */
  unlocked: boolean;
  /** 今天的 UTC 日期键（未解锁也返回，便于诊断） */
  todayKey: string;
  levels: { mid: DailyLevel; high: DailyLevel } | null;
}

export interface BootstrapDailyInput {
  clock: Clock;
  /** 主线 24 关是否全部 ≥1★（由 progress 层计算后注入，本模块不读存档） */
  unlocked: boolean;
  generatorVersion?: number;
}

/**
 * 每日引导（GDD⑥ §4.5）。未解锁直接返回 unlocked:false 且不生成关卡（D-1：不显示、不预告）。
 * 关卡 id 覆盖为 daily-{dateKey}-{tier}；visionMode 强制 'fog'（GDD⑥ §2.1）。
 */
export function bootstrapDaily(input: BootstrapDailyInput): DailyBootstrap {
  const version = input.generatorVersion ?? GENERATOR_VERSION;
  const todayKey = getDateKeyUTC(input.clock.now());
  if (!input.unlocked) return { unlocked: false, todayKey, levels: null };

  const build = (tier: Tier): DailyLevel => {
    const seed = getSeed({ dateKey: todayKey, tier, generatorVersion: version });
    let res = generate({ seed, tier, generatorVersion: version });
    if (!res.level) {
      // 生成器已内置三级回退（DQ6）；此处再兜一层，保证「无空缺日」
      res = generate({ seed, tier, generatorVersion: version }, { forceFallback: true });
    }
    const level = res.level as Level; // forceFallback 必产关卡
    return {
      dateKey: todayKey,
      tier,
      id: dailyLevelId(todayKey, tier),
      // 覆盖 id（GDD⑥ §4.6）；visionMode 恒 fog（生成器已为 fog，此处显式锁定）
      level: { ...level, id: dailyLevelId(todayKey, tier), visionMode: 'fog' },
      fallbackUsed: res.fallbackUsed,
      attempts: res.attempts,
    };
  };

  return { unlocked: true, todayKey, levels: { mid: build('mid'), high: build('high') } };
}

/**
 * E5-4 / GDD⑥ D-2 跨午夜口径：局中禁止换题。
 * 有在途局面（activeKey 非空）时继续沿用开局时的 dateKey 结算；否则取今天。
 */
export function resolveActiveDateKey(todayKey: string, activeKey: string | null): string {
  return activeKey ?? todayKey;
}

/** 在途局面的日期键是否已过期（下次回到选关时应刷新取新题） */
export function isDailyStale(todayKey: string, activeKey: string | null): boolean {
  return activeKey !== null && activeKey !== todayKey;
}
