// 测试辅助：Node 下的 fake 画布/上下文（记录 drawImage 调用，不真正绘制）
// 仅用于 CI 代理断言（lastDirtyCount / tileAtlasReady 等逻辑），不测像素输出。
import type { CanvasFactory, CanvasLike, Ctx2D } from '../../src/render/canvas';

export interface FakeCall {
  type: 'drawImage' | 'clearRect' | 'fillRect' | 'translate';
  x: number;
  y: number;
}

export function createFakeCanvasFactory(): CanvasFactory {
  return (w: number, h: number): CanvasLike => {
    const calls: FakeCall[] = [];
    const ctx: Ctx2D = {
      drawImage(img: CanvasImageSource, dx: number, dy: number) {
        calls.push({ type: 'drawImage', x: dx, y: dy });
      },
      clearRect(x: number, y: number) {
        calls.push({ type: 'clearRect', x, y });
      },
      fillRect(x: number, y: number) {
        calls.push({ type: 'fillRect', x, y });
      },
      save() {},
      restore() {},
      translate(x: number, y: number) {
        calls.push({ type: 'translate', x, y });
      },
      scale() {},
      rotate() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      rect() {},
      strokeRect() {},
      roundRect() {},
      fill() {},
      stroke() {},
      fillText() {},
      strokeText() {},
      clip() {},
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
    };
    return {
      width: w,
      height: h,
      getContext: (_type: '2d') => ctx,
      __calls: calls,
    } as CanvasLike & { __calls: FakeCall[] };
  };
}

/** 取 fake 画布的调用记录（测试断言用） */
export function fakeCalls(c: CanvasLike): FakeCall[] {
  return (c as CanvasLike & { __calls: FakeCall[] }).__calls;
}
