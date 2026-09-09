// 控制清单 F 组 ①（E2 新增真断言）· fog 模式单格移动后 lastDirtyCount ≤ 40 且 ≠ 169
// 169 = 全量重绘（关 9+ 超标根源，ADR-03 D3）；≤40 证明是"只画脏格"的增量更新。
import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../../src/render/pipeline';
import { createFakeCanvasFactory } from '../helpers/fake-canvas';
import { makeLevel } from '../helpers/build-level';
import { key } from '../../src/util/grid';

function runMove(gridSize: number, from: { x: number; y: number }, to: { x: number; y: number }) {
  const factory = createFakeCanvasFactory();
  const level = makeLevel({ gridSize, visionMode: 'fog' });
  const main = factory(gridSize * 40, gridSize * 40).getContext('2d');
  const pipe = new RenderPipeline(main, level, factory);
  pipe.init();

  const visited = new Set<string>([key(from)]);
  pipe.moveTo(from, visited);
  const before = pipe.stats.lastDirtyCount;

  // 单格移动：将 to 加入 visited（模拟走过）
  visited.add(key(to));
  pipe.moveTo(to, visited);
  return { before, after: pipe.stats.lastDirtyCount };
}

describe('CI 闸门 · fog 增量更新（lastDirtyCount ≤ 40 且 ≠ 169）', () => {
  it('13×13 fog：单格移动后脏格数 ≤ 40 且 ≠ 169（证明增量而非全量）', () => {
    const { after } = runMove(13, { x: 1, y: 1 }, { x: 2, y: 1 });
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(40);
    expect(after).not.toBe(169);
  });

  it('11×11 fog：同样满足 ≤ 40 且 ≠ 169', () => {
    const { after } = runMove(11, { x: 1, y: 1 }, { x: 2, y: 1 });
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThanOrEqual(40);
    expect(after).not.toBe(169);
  });

  it('对照组 G-B3：若被写成全量重绘，lastDirtyCount 将恒 = 169 → 此处必须失败（守卫增量不被破坏）', () => {
    // 仅做结构说明性断言：单次移动的上界远低于全格数 169，绝不应等于它
    const { after } = runMove(13, { x: 6, y: 6 }, { x: 7, y: 6 });
    expect(after).toBeLessThan(169);
  });
});
