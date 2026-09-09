// sfx.ts · 最小 WebAudio 音效子系统（Phase 6 后续功能 · 无第三方库）
// 仅合成短音（移动 / 拾取 / 开门 / 通关 / 无效），无音频资源文件，契合 vanilla / no-asset 路线。
// 浏览器要求 AudioContext 在用户手势内创建/恢复 → main.ts 在首个 keydown 调 unlock()。
// Node / 测试无 AudioContext：所有 play 静默 no-op；静音偏好经 StorageLike 持久化，可独立单测。

import type { StorageLike } from '../sim/progress';

const MUTE_KEY = 'maze.audio.muted';

export type SfxName = 'move' | 'pickup' | 'door' | 'win' | 'invalid';

export interface SfxEngineOptions {
  /** 存档介质（与设置/进度同源；null = 内存态，静音偏好不持久化） */
  storage?: StorageLike | null;
}

export class SfxEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean;
  private readonly storage: StorageLike | null;

  constructor(opts: SfxEngineOptions = {}) {
    this.storage = opts.storage ?? null;
    this.muted = this.loadMuted();
  }

  /** 在用户手势（keydown）内调用：创建 / 恢复 AudioContext。无 WebAudio 环境静默跳过。 */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      (window.AudioContext as typeof AudioContext | undefined) ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return; // 测试 / 无 WebAudio 环境
    try {
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.saveMuted();
  }

  /** 切换静音；返回切换后的静音状态 */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 触发一个事件音；muted 或 无 ctx 时静默 */
  play(name: SfxName): void {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case 'move':
        this.blip(220, 0.04, 'square', 0.05);
        break;
      case 'pickup':
        this.blip(660, 0.09, 'triangle', 0.11);
        break;
      case 'door':
        this.blip(330, 0.12, 'sawtooth', 0.11);
        break;
      case 'win':
        this.arp([523, 659, 784, 1047], 0.1, 0.13);
        break;
      case 'invalid':
        this.blip(110, 0.08, 'square', 0.07);
        break;
    }
  }

  // ── 合成原语 ──
  private blip(freq: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private arp(freqs: number[], step: number, gain: number): void {
    const ctx = this.ctx!;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + step + 0.02);
    });
  }

  private loadMuted(): boolean {
    if (!this.storage) return false;
    try {
      return this.storage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  private saveMuted(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* 配额 / 隐私模式：退内存态 */
    }
  }
}
