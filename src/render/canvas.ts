// canvas.ts · 渲染层画布抽象（让 render 在浏览器与 Node(测试) 同构）
// 浏览器用真实 Canvas；Node 测试注入 fake 工厂（仅记录调用，不真正绘制）。
// 注意：本文件仅声明接口与 DOM 工厂，不应含任何渲染逻辑，也不含 draw-cell 的禁用 API。

/** 2D 上下文的最小接口（draw-cell 只用 drawImage；tiles/sprites/layers 用其余方法烘焙） */
export interface Ctx2D {
  drawImage(img: CanvasImageSource, dx: number, dy: number): void;
  drawImage(img: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  rotate(angle: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, sa: number, ea: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  clip(): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'bevel' | 'round' | 'miter';
}

/** 离屏画布的最小接口 */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): Ctx2D;
}

/** 工厂：给定逻辑像素尺寸，产出一个离屏画布（浏览器=真实 canvas；测试=fake） */
export type CanvasFactory = (w: number, h: number) => CanvasLike;

/**
 * 浏览器 DOM 工厂（仅浏览器调用，不进 Node 测试主路径）。
 * 真实画布在 CSS 逻辑像素下创建，调用方负责按 dpr 缩放上下文。
 */
export function domCanvasFactory(dpr = 1): CanvasFactory {
  return (w: number, h: number): CanvasLike => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d') as unknown as Ctx2D;
    if (dpr !== 1) ctx.scale(dpr, dpr);
    return c as unknown as CanvasLike;
  };
}
