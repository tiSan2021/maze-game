// K2 同色 1:1 配对校验（交付项 7 / GDD③ X1-X2，QA Sprint0/1 指出缺口）
// 加载/生成期校验每色钥匙与门恰好 1:1，且 keys/doors ≤3。
import { describe, it, expect } from 'vitest';
import type { KeyColor, Level, Dir } from '../../src/core/types';
import { makeLevel } from '../helpers/build-level';
import { checkColorPairing } from '../../src/gen/gates';
import { generate } from '../../src/gen/generator';

describe('K2 同色 1:1 配对', () => {
  it('通过：2 色各 1 钥匙 1 门', () => {
    const level = makeLevel({
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 4, y: 1 } },
      ],
      doors: [
        { id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'd1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
      ],
    });
    expect(checkColorPairing(level).ok).toBe(true);
  });

  it('失败：同色出现 2 把钥匙（违反 K2 X1）', () => {
    const level = makeLevel({
      keys: [
        { id: 'k0a', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k0b', color: 0 as KeyColor, pos: { x: 2, y: 2 } },
      ],
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } }],
    });
    const r = checkColorPairing(level);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('1:1');
  });

  it('失败：有钥匙无配对门（X2）', () => {
    const level = makeLevel({
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
      doors: [],
    });
    expect(checkColorPairing(level).ok).toBe(false);
  });

  it('失败：钥匙数超过上限 3', () => {
    const level: Level = makeLevel({
      keys: [0, 1, 2].map((c) => ({ id: `k${c}`, color: c as KeyColor, pos: { x: 2, y: 1 + c } })),
      doors: [0, 1, 2].map((c) => ({ id: `d${c}`, color: c as KeyColor, pos: { x: 3, y: 1 + c } })),
    });
    // 再加第 4 把（不同色）越界
    level.keys.push({ id: 'k3', color: 0 as KeyColor, pos: { x: 9, y: 9 } });
    expect(checkColorPairing(level).ok).toBe(false);
  });

  it('生成器产出恒满足 1:1（抽查多个种子）', () => {
    for (let s = 1; s <= 20; s++) {
      const res = generate({ seed: s * 7919, tier: 'high' as const, generatorVersion: 1 });
      expect(res.level).not.toBeNull();
      expect(checkColorPairing(res.level!).ok).toBe(true);
    }
  });
});
