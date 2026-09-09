// keyboard.ts · 键盘输入装配（E6-2 / UX §3.1–3.2 / 架构 M2）
// 职责：方向键 / WASD 四向滑行的**节奏控制**——禁用 OS auto-repeat，自管连走节奏
// （首次 220ms、之后每 110ms 一次），且**必须等上一次滑行结束**才发起下一次；
// 同时多方向以**最近按下**（栈顶）为准；window.blur 清空输入栈。
// 纯逻辑、不触碰 DOM：事件绑定在 main.ts，本模块只吃 (key, repeat) 与时钟。
// 时间源经构造参数注入（便于 Node 单测；A6 只约束 sim/gen，但注入更可测）。

import type { Dir } from '../core/types';

/** 连走节奏（UX §3.1：initialDelay=220ms，之后每 110ms 发起一次新滑行） */
export const INITIAL_DELAY_MS = 220;
export const REPEAT_DELAY_MS = 110;

const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

/** 按键 → 方向；非方向键返回 null */
export function dirOfKey(key: string): Dir | null {
  return DIR_KEYS[key] ?? null;
}

export interface KeyboardInputOptions {
  /** 时间源注入（默认 performance.now） */
  now?: () => number;
  initialDelayMs?: number;
  repeatDelayMs?: number;
}

export class KeyboardInput {
  private readonly now: () => number;
  private readonly initialDelayMs: number;
  private readonly repeatDelayMs: number;
  /** 同时按下的方向栈：栈顶 = 最近按下（UX §3.1） */
  private readonly dirStack: Dir[] = [];
  /** 最近按下的方向（快速点按：松手后仍应兑现那一次滑行） */
  private lastDir: Dir | null = null;
  private pendingImmediate = false;
  private nextRepeatAt = 0;
  private awaitingSlide = false;

  constructor(opts: KeyboardInputOptions = {}) {
    this.now = opts.now ?? (() => performance.now());
    this.initialDelayMs = opts.initialDelayMs ?? INITIAL_DELAY_MS;
    this.repeatDelayMs = opts.repeatDelayMs ?? REPEAT_DELAY_MS;
  }

  /** 当前生效方向（栈顶）；无按键时返回 null */
  top(): Dir | null {
    return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null;
  }

  /** 栈深（诊断 / 测试用） */
  depth(): number {
    return this.dirStack.length;
  }

  /**
   * 按下方向键。OS auto-repeat（repeat=true）一律丢弃，节奏由本模块自管。
   * 返回是否识别为方向键。
   */
  pressDir(dir: Dir, repeat = false): boolean {
    if (repeat) return false; // M2：禁用 OS 长按自动重复
    const i = this.dirStack.indexOf(dir);
    if (i >= 0) this.dirStack.splice(i, 1);
    this.dirStack.push(dir);
    this.lastDir = dir;
    this.pendingImmediate = true; // 一次按下 = 一次滑行（UX §3.1）
    this.nextRepeatAt = this.now() + this.initialDelayMs;
    return true;
  }

  /** 松开方向键：出栈；仍有其他方向键按住时重置节奏 */
  releaseDir(dir: Dir): void {
    const i = this.dirStack.indexOf(dir);
    if (i >= 0) this.dirStack.splice(i, 1);
    if (this.dirStack.length > 0) {
      this.lastDir = this.top();
      this.nextRepeatAt = this.now() + this.initialDelayMs;
    }
    // 注意：不清 pendingImmediate —— 快速点按（按下即松开）仍须兑现一次滑行
  }

  /** 窗口失焦：清空输入栈（避免恢复焦点后误触发） */
  blur(): void {
    this.dirStack.length = 0;
    this.lastDir = null;
    this.pendingImmediate = false;
    this.awaitingSlide = false;
    this.nextRepeatAt = 0;
  }

  /**
   * 每帧调用：满足条件时以栈顶方向发起**一次**滑行。
   * - pendingImmediate：首次按下，立即发起
   * - 否则按 220/110ms 节奏发起
   * - awaitingSlide 未解除（上一次滑行未结束）时**不发起**
   */
  update(onSlide: (dir: Dir) => void): void {
    if (this.awaitingSlide) return; // 等上一次滑行结束（UX §3.1）
    if (this.pendingImmediate) {
      this.pendingImmediate = false;
      const dir = this.lastDir ?? this.top();
      if (!dir) return;
      this.awaitingSlide = true;
      onSlide(dir);
      return;
    }
    if (this.dirStack.length === 0) return;
    if (this.now() < this.nextRepeatAt) return;
    this.awaitingSlide = true;
    this.nextRepeatAt = this.now() + this.repeatDelayMs;
    onSlide(this.dirStack[this.dirStack.length - 1]);
  }

  /**
   * 滑行结束回调，解除等待。
   * 当前 applySlide 同步完成 ⇒ main.ts 在 move 后立即调用；
   * 接入滑行动画（Phase 6）后应改由动画结束回调触发，节奏语义不变。
   */
  notifySlideDone(): void {
    this.awaitingSlide = false;
  }
}
