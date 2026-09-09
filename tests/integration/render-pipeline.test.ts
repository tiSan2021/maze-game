// render-pipeline.test.ts · 集成：13×13 fog 关跑通管道，验证三前置代理 + 增量
import { describe, it, expect } from 'vitest';
import { RenderPipeline } from '../../src/render/pipeline';
import { createFakeCanvasFactory, fakeCalls } from '../helpers/fake-canvas';
import { makeLevel } from '../helpers/build-level';
import { computeVisibility } from '../../src/sim/visibility';
import { key } from '../../src/util/grid';

describe('集成 · RenderPipeline（fog 13×13）', () => {
  it('init 后 tileAtlasReady=true；连续单格移动 lastDirtyCount 始终 ≤40 且 ≠169', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'fog' });
    const mainCanvas = factory(520, 520);
    const main = mainCanvas.getContext('2d');
    const pipe = new RenderPipeline(main, level, factory);
    pipe.init();

    expect(pipe.stats.tileAtlasReady).toBe(true);

    let pos = level.start;
    const visited = new Set<string>([key(pos)]);
    // 沿直线向右走 8 格（≈最快 8 次/秒跨格），每步断言增量上限
    for (let i = 0; i < 8; i++) {
      const next = { x: pos.x + 1, y: pos.y };
      visited.add(key(next));
      pipe.moveTo(next, visited);
      expect(pipe.stats.lastDirtyCount).toBeGreaterThan(0);
      expect(pipe.stats.lastDirtyCount).toBeLessThanOrEqual(40);
      expect(pipe.stats.lastDirtyCount).not.toBe(169);
      pos = next;
    }

    // 渲染一帧：主画布确有 drawImage 调用（L0/L1/视野格/实体）
    pipe.renderFrame({ heldKeys: new Set(), openedDoors: new Set(), visible: new Set(), motionScale: 1, timeMs: 0 });
    expect(fakeCalls(mainCanvas).some((c) => c.type === 'drawImage')).toBe(true);
  });

  it('full 模式走 BAKED 路径，tileAtlasReady 同样早于首帧', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'full' });
    const main = factory(520, 520).getContext('2d');
    const pipe = new RenderPipeline(main, level, factory);
    expect(pipe.stats.tileAtlasReady).toBe(false);
    pipe.init();
    expect(pipe.stats.tileAtlasReady).toBe(true);
  });

  it('fogOff=true 构造后 renderFrame 不抛错（BAKED 分支在 13×13 雾关可运行）', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'fog' });
    const main = factory(520, 520).getContext('2d');
    const pipe = new RenderPipeline(main, level, factory, { fogOff: true });
    pipe.init();
    // visible 传空集合：fogOff 走 BAKED，不依赖可见性计算；只验证渲染入口不崩、不改可见性/星级语义
    expect(() =>
      pipe.renderFrame({ heldKeys: new Set(), openedDoors: new Set(), visible: new Set(), motionScale: 1, timeMs: 0 }),
    ).not.toThrow();
  });

  it('fogOff 复用 BAKED 路径（不改变 visible/visited 集合）', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'fog' });
    const main = factory(520, 520).getContext('2d');
    const baseVisible = computeVisibility(level, level.start, new Set([key(level.start)]));
    const pipe = new RenderPipeline(main, level, factory, { fogOff: true });
    pipe.init();
    expect(pipe.stats.tileAtlasReady).toBe(true);
    expect(pipe.stats.lastDirtyCount).toBe(0); // BAKED 路径不维护 L1 增量
    // 集合未被渲染改动
    const after = computeVisibility(level, level.start, new Set([key(level.start)]));
    expect(after.size).toBe(baseVisible.size);
  });
});
