// main-levels-gates.test.ts · CI 闸门：主线 24 关入库门禁（E6-1）
// 直接对固化后的 src/content/main-levels.json 跑门禁，防止手工微调 JSON 时把不可解/三星不可达的关带进包。
// 规格来源：design/concept.md §4.2（尺寸/锁深/视野递进）、epic-split E6-1（G1–G3 + G5）。
import { describe, it, expect } from 'vitest';
import { MAIN_LEVELS, getMainLevel, mainLevelCount } from '../../src/content/main-levels';
import { runGates } from '../../src/gen/gates';
import { computeLockDepth } from '../../src/sim/lockkey';
import type { Tier } from '../../src/core/types';

/** 每关的档位（仅 L9–12 参与 G6 长度带；L1–8 为教学小关，长度不在带内属设计意图） */
const TIER_OF: Record<number, Tier> = {
  9: 'mid', 10: 'high', 11: 'mid', 12: 'high',
  13: 'high', 14: 'mid', 15: 'high', 16: 'high', 17: 'mid', 18: 'high',
  19: 'high', 20: 'mid', 21: 'ultra', 22: 'ultra', 23: 'ultra', 24: 'ultra',
};

describe('CI 闸门 · 主线 24 关入库门禁', () => {
  it('共 24 关，id 与顺序为 main-1 … main-24', () => {
    expect(mainLevelCount()).toBe(24);
    MAIN_LEVELS.forEach((lv, i) => {
      expect(lv.id).toBe(`main-${i + 1}`);
      expect(getMainLevel(i + 1)).toBe(lv);
    });
    expect(getMainLevel(0)).toBeNull();
    expect(getMainLevel(25)).toBeNull();
  });

  it('尺寸 / 视野 / 锁深符合教学曲线（concept §4.2）', () => {
    for (const lv of MAIN_LEVELS) {
      const n = Number(/^main-(\d+)$/.exec(lv.id)![1]);
      const size = n <= 3 ? 9 : n <= 8 ? 11 : 13;
      const lock = n <= 3 ? 0 : n <= 8 ? 1 : n <= 20 ? 2 : 3; // L21–24 为 ultra 三锁
      const vision = n <= 8 ? 'full' : 'fog';

      expect(lv.gridSize, `${lv.id} gridSize`).toBe(size);
      expect(lv.visionMode, `${lv.id} visionMode`).toBe(vision);
      expect(lv.meta.lockDepth, `${lv.id} lockDepth`).toBe(lock);
      // 实际依赖深度必须与声明一致（否则出口可绕开门 → 三星可达性失真）
      expect(computeLockDepth(lv), `${lv.id} computeLockDepth`).toBe(lock);
      expect(lv.keys.length, `${lv.id} keys`).toBe(lock);
      expect(lv.doors.length, `${lv.id} doors`).toBe(lock);
    }
  });

  it('每关 G1（可解）/ G2（≤80 步）/ G3（三星可达）/ G5（合规）全过', () => {
    for (const lv of MAIN_LEVELS) {
      const n = Number(/^main-(\d+)$/.exec(lv.id)![1]);
      const gates = runGates(lv, TIER_OF[n] ?? 'mid');
      for (const g of ['G1', 'G2', 'G3', 'G5'] as const) {
        const r = gates.find((x) => x.gate === g);
        expect(r, `${lv.id} 缺少 ${g}`).toBeTruthy();
        expect(r!.pass, `${lv.id} ${g} 失败：${r!.detail}`).toBe(true);
      }
      // expectedSolution 必须非空且不过长
      expect(lv.meta.expectedSolution.length, `${lv.id} solution 为空`).toBeGreaterThan(0);
      expect(lv.meta.expectedSolution.length, `${lv.id} solution 超 80 步`).toBeLessThanOrEqual(80);
      expect(lv.meta.deadEndBranches, `${lv.id} 死路数超 6`).toBeLessThanOrEqual(6);
    }
  });

  it('L9–24 命中档位长度带（G6）：mid ∈ [35,55]、high ∈ [50,80]', () => {
    for (const n of [...Array(16)].map((_, i) => i + 9)) {
      const lv = getMainLevel(n)!;
      const tier = TIER_OF[n];
      const g6 = runGates(lv, tier).find((g) => g.gate === 'G6');
      expect(g6, `main-${n} 缺少 G6`).toBeTruthy();
      expect(g6!.pass, `main-${n} G6 失败：${g6!.detail}`).toBe(true);
    }
  });

  it('关 5/10 为难度高峰、关 6/11 为喘息关（死路数对比）', () => {
    const dead = (n: number) => getMainLevel(n)!.meta.deadEndBranches;
    expect(dead(5)).toBeGreaterThan(dead(6)); // 高峰 5 → 喘息 6
    expect(dead(8)).toBeGreaterThanOrEqual(dead(6));
    const len = (n: number) => getMainLevel(n)!.meta.expectedSolution.length;
    expect(len(10)).toBeGreaterThan(len(9)); // 关 10 高峰长于关 9（关 9 拓扑下调一档）
    expect(len(11)).toBeLessThan(len(10)); // 关 11 喘息
  });
});
