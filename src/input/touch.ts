// touch.ts · 移动端触屏输入（阶段 A+B 之 B）
//
// 目标：让手机能控制角色移动，且**复用既有 KeyboardInput 的连走节奏**（不重复造轮子）。
// 两种控制，都汇入同一个 KeyboardInput 实例：
//   1) 画布滑动手势（swipe）→ 等价于键盘"点按一次"：input.pressDir + 立即 releaseDir，
//      下一帧由主循环 input.update 触发恰好一次 move（不连发）。
//   2) 屏幕虚拟方向键（dpad）→ 按住经 input.pressDir 持续触发连走，松手 releaseDir。
// 桌面（无触屏）下 mountTouchControls 直接返回空清理函数，纯键盘体验不变。
// 仅描述/纯逻辑，不触碰游戏内核（sim/gen/render/levels）。

import type { Dir } from '../core/types';
import { KeyboardInput } from './keyboard';

export interface TouchControlsOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  input: KeyboardInput;
  /** 首次手势回调（用于解锁 AudioContext，浏览器策略要求用户手势内创建） */
  unlock: () => void;
}

/** 滑动判定阈值（client 像素差），小于此视为点按、不移动 */
const SWIPE_THRESHOLD = 24;

function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function mountTouchControls(opts: TouchControlsOptions): () => void {
  if (!isTouchDevice()) return () => {};

  const { canvas, container, input, unlock } = opts;

  // 首次手势解锁音频
  const onFirstTouch = () => {
    unlock();
    window.removeEventListener('touchstart', onFirstTouch);
  };
  window.addEventListener('touchstart', onFirstTouch, { passive: true });

  // 画布滑动 → 一次 move
  let sx = 0;
  let sy = 0;
  let tracking = false;
  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX;
    sy = t.clientY;
    tracking = true;
  };
  const onEnd = (e: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return; // 点按，不移动
    const dir: Dir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    // 等价于键盘"点按一次"：下一帧由主循环触发恰好一次 move，不连发
    input.pressDir(dir);
    input.releaseDir(dir);
  };
  canvas.addEventListener('touchstart', onStart, { passive: true });
  canvas.addEventListener('touchend', onEnd, { passive: true });

  // 虚拟方向键（按住连走，复用 KeyboardInput）
  const dpad = document.createElement('div');
  dpad.className = 'dpad';
  const mk = (label: string, dir: Dir, cls: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dpad-btn ${cls}`;
    b.textContent = label;
    b.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        input.pressDir(dir);
      },
      { passive: false },
    );
    b.addEventListener(
      'touchend',
      (e) => {
        e.preventDefault();
        input.releaseDir(dir);
      },
      { passive: false },
    );
    b.addEventListener('touchcancel', () => input.releaseDir(dir));
    // 桌面调试也可用鼠标
    b.addEventListener('mousedown', () => input.pressDir(dir));
    b.addEventListener('mouseup', () => input.releaseDir(dir));
    b.addEventListener('mouseleave', () => input.releaseDir(dir));
    return b;
  };
  dpad.append(
    mk('▲', 'up', 'up'),
    mk('◀', 'left', 'left'),
    mk('▼', 'down', 'down'),
    mk('▶', 'right', 'right'),
  );
  container.appendChild(dpad);

  return () => {
    window.removeEventListener('touchstart', onFirstTouch);
    canvas.removeEventListener('touchstart', onStart);
    canvas.removeEventListener('touchend', onEnd);
    dpad.remove();
  };
}
