// board-origin.test.ts · 迷宫居中偏移（常量 + 渲染管线施加）
// 目的：迷宫由"贴左上"改为在 960×640 画布中居中；居中只由外层 translate 施加，
// 格子局部坐标系（draw-cell / sprites）不得改变。缺省 origin 时行为与改动前完全一致。
import { describe, it, expect } from 'vitest';
import { boardOrigin, CANVAS_W, CANVAS_H, CELL_PX } from '../../src/core/constants/metrics';
import { RenderPipeline } from '../../src/render/pipeline';
import { createFakeCanvasFactory, fakeCalls } from '../helpers/fake-canvas';
import { makeLevel } from '../helpers/build-level';
import type { EntityView } from '../../src/render/sprites';
import type { CellKey, KeyColor } from '../../src/core/types';

const VIEW: EntityView = {
  heldKeys: new Set<KeyColor>(),
  openedDoors: new Set<string>(),
  visible: new Set<CellKey>(),
  motionScale: 1,
  timeMs: 0,
};

describe('常量 · boardOrigin（迷宫居中偏移）', () => {
  it('三种网格均水平+垂直居中', () => {
    expect(boardOrigin(13)).toEqual({ x: 220, y: 60 });
    expect(boardOrigin(11)).toEqual({ x: 260, y: 100 });
    expect(boardOrigin(9)).toEqual({ x: 300, y: 140 });
  });

  it('偏移后迷宫完整落在画布内（不裁切、不溢出）', () => {
    for (const g of [9, 11, 13] as const) {
      const o = boardOrigin(g);
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.x * 2 + g * CELL_PX).toBeLessThanOrEqual(CANVAS_W);
      expect(o.y * 2 + g * CELL_PX).toBeLessThanOrEqual(CANVAS_H);
    }
  });
});

describe('RenderPipeline · 居中偏移施加', () => {
  it('缺省 origin：不偏移（测试 / 性能尖峰 harness 行为不变）', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'full' });
    const mainCanvas = factory(520, 520);
    const pipe = new RenderPipeline(mainCanvas.getContext('2d'), level, factory);
    pipe.init();
    pipe.renderFrame(VIEW);
    expect(fakeCalls(mainCanvas).filter((c) => c.type === 'translate')).toEqual([
      { type: 'translate', x: 0, y: 0 },
    ]);
  });

  it('传入 origin：整体平移到居中位置，且层绘制仍用迷宫局部坐标 (0,0)', () => {
    const factory = createFakeCanvasFactory();
    const level = makeLevel({ gridSize: 13, visionMode: 'full' });
    const mainCanvas = factory(520, 520);
    const origin = boardOrigin(level.gridSize);
    const pipe = new RenderPipeline(mainCanvas.getContext('2d'), level, factory, { origin });
    pipe.init();
    pipe.renderFrame(VIEW);
    const calls = fakeCalls(mainCanvas);
    expect(calls.filter((c) => c.type === 'translate')).toEqual([
      { type: 'translate', x: 220, y: 60 },
    ]);
    // 静态层仍以 (0,0) 绘制 —— 居中由 translate 承担，不是改格子坐标
    expect(calls.some((c) => c.type === 'drawImage' && c.x === 0 && c.y === 0)).toBe(true);
  });
});
