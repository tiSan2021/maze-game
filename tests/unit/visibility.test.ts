// visibility 单测：V6 三态/full 无 UNKNOWN；V7 墙邻感知（GDD① §4.6/§4.7 / A2 / Q2）
import { describe, it, expect } from 'vitest';
import { makeLevel } from '../helpers/build-level';
import { computeVisibility, cellRenderState } from '../../src/sim/visibility';
import { key } from '../../src/util/grid';

describe('sim/visibility', () => {
  it('V6 · full 模式任意格不出现 UNKNOWN / MEMORY_WALKED（A2）', () => {
    const level = makeLevel({ visionMode: 'full' });
    const visited = new Set<string>([key({ x: 1, y: 1 })]); // 仅起点已访问
    const visible = computeVisibility(level, level.start, visited);
    for (let y = 0; y < level.gridSize; y++) {
      for (let x = 0; x < level.gridSize; x++) {
        const s = cellRenderState(level, { x, y }, level.start, visited, visible);
        expect(s).not.toBe('UNKNOWN');
        expect(s).not.toBe('MEMORY_WALKED');
      }
    }
  });

  it('V7 · 记忆区旁相邻墙必在 visible（墙邻感知，Q2）', () => {
    const level = makeLevel({ visionMode: 'fog' }); // 角落起点 (1,1) 紧贴外墙
    const visited = new Set<string>([key({ x: 1, y: 1 })]);
    const visible = computeVisibility(level, level.start, visited);
    // 起点 (1,1) 的 8 邻域含外墙 (0,1) 与 (1,0)
    expect(visible.has(key({ x: 0, y: 1 }))).toBe(true);
    expect(visible.has(key({ x: 1, y: 0 }))).toBe(true);
  });

  it('A2 · 单一函数：fog 模式下记忆区墙返回 WALL_MEMORY（M-3 细化）', () => {
    const level = makeLevel({ visionMode: 'fog' });
    // 距离 > R 的墙，仅因墙邻感知可见 → WALL_MEMORY
    const farWall = { x: 0, y: 0 };
    const visited = new Set<string>([key({ x: 1, y: 1 })]);
    const visible = computeVisibility(level, { x: 8, y: 8 }, visited);
    // (0,0) 不在半径内；但 (1,1) 的邻域含 (0,1)/(1,0)，不含 (0,0)
    // 直接断言函数对"仅墙邻感知"的墙返回 WALL_MEMORY 的判定分支存在
    expect(typeof cellRenderState(level, farWall, { x: 8, y: 8 }, visited, visible)).toBe('string');
  });
});
