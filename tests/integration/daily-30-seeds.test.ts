// 每日种子批量回归（Q2 / DQ2，QA Sprint0/1 指出缺口）
// 连续 30 个 UTC 日期 × {mid,high}，断言 100% 通过 G1–G6 且 fallbackUsed=false。
import { describe, it, expect } from 'vitest';
import type { Tier } from '../../src/core/types';
import { getDateKeyUTC, getSeed } from '../../src/core/rng';
import { generate } from '../../src/gen/generator';
import { runGates } from '../../src/gen/gates';

const DAYS = 30;
const START = Date.UTC(2026, 0, 1); // 2026-01-01

describe('Q2 · 连续 30 个每日种子 100% 过 G1–G6', () => {
  it('30 天 × 两档均生成成功、门禁全过、无兜底', () => {
    let passCount = 0;
    let total = 0;
    for (let i = 0; i < DAYS; i++) {
      const date = new Date(START + i * 86400000);
      const dateKey = getDateKeyUTC(date);
      for (const tier of ['mid', 'high'] as Tier[]) {
        total++;
        const seed = getSeed({ dateKey, tier, generatorVersion: 1 });
        const res = generate({ seed, tier, generatorVersion: 1 });
        if (!res.level) {
          throw new Error(`日期 ${dateKey} ${tier}：未产出关卡`);
        }
        if (res.fallbackUsed) {
          throw new Error(`日期 ${dateKey} ${tier}：触发兜底（fallbackUsed），违反 Q2 无空缺日要求`);
        }
        const gates = runGates(res.level, tier);
        const failed = gates.filter((g) => !g.pass);
        if (failed.length > 0) {
          throw new Error(
            `日期 ${dateKey} ${tier}：门禁失败 -> ${failed.map((g) => `${g.gate}(${g.detail})`).join(', ')}`,
          );
        }
        passCount++;
      }
    }
    expect(total).toBe(60); // 30 × 2
    expect(passCount).toBe(60); // 100% 通过
  });
});
