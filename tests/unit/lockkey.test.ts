// lockkey 单测：onEnterCell 唯一生产者 + computeLockDepth（GDD③ §4.2/§4.3 / K1-K6）
import { describe, it, expect } from 'vitest';
import type { GridCell, KeyColor, Level, Vec2 } from '../../src/core/types';
import { emptyGrid, makeLevel, setFloor } from '../helpers/build-level';
import { onEnterCell, computeLockDepth, UNSOLVABLE } from '../../src/sim/lockkey';

/** 内部全墙、仅 carved 格为地板（单一走廊，门是唯一直达出口的通道） */
function carve(gridSize: number, floors: Vec2[]): GridCell[][] {
  const g = emptyGrid(gridSize);
  for (let y = 1; y <= gridSize - 2; y++)
    for (let x = 1; x <= gridSize - 2; x++) g[y][x] = 'wall';
  for (const p of floors) setFloor(g, p.x, p.y);
  return g;
}

function corridorLevel(opts: {
  gridSize?: number;
  floors: Vec2[];
  keys?: Level['keys'];
  doors?: Level['doors'];
  exit: Vec2;
}): Level {
  return makeLevel({
    gridSize: opts.gridSize ?? 9,
    grid: carve(opts.gridSize ?? 9, opts.floors),
    start: { x: 1, y: 1 },
    exit: opts.exit,
    keys: opts.keys ?? [],
    doors: opts.doors ?? [],
  });
}

describe('sim/lockkey', () => {
  it('onEnterCell 拾钥匙产生 key 事件（X7 重访无事件）', () => {
    const level = makeLevel({
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
    });
    const keysHeld = new Set<KeyColor>();
    const doorsOpened = new Set<string>();
    const ev = onEnterCell(level, keysHeld, doorsOpened, { x: 2, y: 1 });
    expect(ev).toEqual({ kind: 'key', color: 0 });
    expect(keysHeld.has(0)).toBe(true);
    expect(onEnterCell(level, keysHeld, doorsOpened, { x: 2, y: 1 })).toBeNull();
  });

  it('onEnterCell 持钥匙进门产生 door 事件（X6 二次经过无事件，K5 不消耗）', () => {
    const level = makeLevel({
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 4, y: 1 } }],
    });
    const keysHeld = new Set<KeyColor>([0]);
    const doorsOpened = new Set<string>();
    const ev = onEnterCell(level, keysHeld, doorsOpened, { x: 4, y: 1 });
    expect(ev).toEqual({ kind: 'door', doorId: 'd0' });
    expect(doorsOpened.has('d0')).toBe(true);
    expect(keysHeld.has(0)).toBe(true);
    expect(onEnterCell(level, keysHeld, doorsOpened, { x: 4, y: 1 })).toBeNull();
  });

  it('无钥匙撞门 → 不产生事件（L4 零代价）', () => {
    const level = makeLevel({
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } }],
    });
    const keysHeld = new Set<KeyColor>();
    const doorsOpened = new Set<string>();
    expect(onEnterCell(level, keysHeld, doorsOpened, { x: 3, y: 1 })).toBeNull();
  });

  it('computeLockDepth L0 = 0（无门直连）', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 5; x++) floors.push({ x, y: 1 });
    const level = corridorLevel({ floors, exit: { x: 5, y: 1 } });
    expect(computeLockDepth(level)).toBe(0);
  });

  it('computeLockDepth L1 = 1', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 5; x++) floors.push({ x, y: 1 });
    const level = corridorLevel({
      floors,
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } }],
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 4, y: 1 } }],
      exit: { x: 5, y: 1 },
    });
    expect(computeLockDepth(level)).toBe(1);
  });

  it('computeLockDepth L2 = 2', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 6; x++) floors.push({ x, y: 1 });
    const level = corridorLevel({
      floors,
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 4, y: 1 } },
      ],
      doors: [
        { id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'd1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
      ],
      exit: { x: 6, y: 1 },
    });
    expect(computeLockDepth(level)).toBe(2);
  });

  it('computeLockDepth L3 = 3（三锁依赖链）', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 8; x++) floors.push({ x, y: 1 });
    const level = corridorLevel({
      gridSize: 11,
      floors,
      keys: [
        { id: 'k0', color: 0 as KeyColor, pos: { x: 2, y: 1 } },
        { id: 'k1', color: 1 as KeyColor, pos: { x: 4, y: 1 } },
        { id: 'k2', color: 2 as KeyColor, pos: { x: 6, y: 1 } },
      ],
      doors: [
        { id: 'd0', color: 0 as KeyColor, pos: { x: 3, y: 1 } },
        { id: 'd1', color: 1 as KeyColor, pos: { x: 5, y: 1 } },
        { id: 'd2', color: 2 as KeyColor, pos: { x: 7, y: 1 } },
      ],
      exit: { x: 8, y: 1 },
    });
    expect(computeLockDepth(level)).toBe(3);
  });

  it('computeLockDepth 钥匙不可达 → UNSOLVABLE (-1)', () => {
    const floors: Vec2[] = [];
    for (let x = 1; x <= 6; x++) floors.push({ x, y: 1 });
    const level = corridorLevel({
      floors,
      // 门在 (4,1)，钥匙却放在门后 (5,1) → 永远拿不到钥匙
      keys: [{ id: 'k0', color: 0 as KeyColor, pos: { x: 5, y: 1 } }],
      doors: [{ id: 'd0', color: 0 as KeyColor, pos: { x: 4, y: 1 } }],
      exit: { x: 6, y: 1 },
    });
    expect(computeLockDepth(level)).toBe(UNSOLVABLE);
  });
});
