// rng.ts · 确定性随机唯一实现（ADR-01 / GDD⑥ §4）
// 全仓唯一允许产生伪随机数的地方；全仓唯一 fnv1a32 实现（grep "0x811c9dc5" 仅此处 1 处）。
// 禁用内建随机函数（DQ3）。

import type { Tier } from '../core/types';

/**
 * mulberry32（GDD⑥ §4.1 规范实现，逐字照抄）。
 * 纯函数 (seed:number)=>()=>number，无闭包外部状态，可重放。
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 32 位 FNV-1a（offset basis 0x811c9dc5，prime 0x01000193）。
 * 字符串 → uint32，稳定无依赖（GDD⑥ §4.3 只给常数，本 ADR 补齐为全仓唯一实现）。
 * 用 Math.imul 保证 32 位乘法不溢出为双精度，避免跨引擎差异。
 */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 每日种子键（GDD⑥ §4.3 / §4.5） */
export interface DailySeedKey {
  dateKey: string; // 'YYYY-MM-DD'，UTC 日历
  tier: Tier;
  generatorVersion: number;
}

/** 种子派生：版本参与派生（D10）。同 (dateKey,tier,version) 跨机器逐字节相同（DQ1） */
export function getSeed(key: DailySeedKey): number {
  const s = `${key.dateKey}|${key.tier}|v${key.generatorVersion}`;
  return fnv1a32(s) >>> 0;
}

/**
 * 重试种子独立派生（ADR-01 §3.4）：GDD⑤ 原 `construct(seed+attempt)` 改为哈希派生，
 * 保证各次尝试是相互独立的流（mulberry32 对相邻种子首输出相关性偏高）。语义仍符合"换种子"。
 */
export function deriveAttemptSeed(seed: number, attempt: number): number {
  return fnv1a32(`${seed}|a${attempt}`) >>> 0;
}

/** UTC 日期键（GDD⑥ §4.2：全球同刻同题，可比性优先） */
export function getDateKeyUTC(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
