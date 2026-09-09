// move 单测：canMove / resolveMove（GDD① §4.1 / GDD③ §4.1 / V2）
import { describe, it, expect } from 'vitest';
import type { KeyColor } from '../../src/core/types';
import { makeLevel, setWall } from '../helpers/build-level';
import { resolveMove, canMove } from '../../src/sim/move';

describe('sim/move', () => {
  it('撞墙 → BLOCKED，零副作用', () => {
    const level = makeLevel();
    setWall(level.grid, 2, 1); // 起点右侧为墙
    const r = resolveMove(level, new Set(), new Set(), { x: 1, y: 1 }, 'right');
    expect(r).toBe('BLOCKED');
    expect(canMove(level, new Set(), new Set(), { x: 1, y: 1 }, 'right')).toBe(false);
  });

  it('未持钥匙的锁门 → BLOCKED', () => {
    const level = makeLevel({
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
    });
    expect(resolveMove(level, new Set(), new Set(), { x: 1, y: 1 }, 'right')).toBe('BLOCKED');
  });

  it('持同色钥匙进门 → OPEN_AND_ENTER（K4）', () => {
    const level = makeLevel({
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
    });
    expect(resolveMove(level, new Set<KeyColor>([0]), new Set(), { x: 1, y: 1 }, 'right')).toBe('OPEN_AND_ENTER');
  });

  it('已开门 → MOVE（X6）', () => {
    const level = makeLevel({
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
    });
    expect(resolveMove(level, new Set(), new Set(['d0']), { x: 1, y: 1 }, 'right')).toBe('MOVE');
  });

  it('越界 → BLOCKED（E9）', () => {
    const level = makeLevel();
    expect(resolveMove(level, new Set(), new Set(), { x: 1, y: 1 }, 'up')).toBe('BLOCKED'); // (1,0) 是外墙
  });
});
