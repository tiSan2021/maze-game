// sfx.test.ts · 音效引擎静音偏好持久化（Phase 6 后续功能）
// Node 无 AudioContext：play 必须静默 no-op 且不抛错；静音偏好经 StorageLike 持久化可独立单测。
import { describe, it, expect } from 'vitest';
import { SfxEngine } from '../../src/audio/sfx';
import { createMemoryStorage } from '../../src/sim/progress';

describe('sfx · 静音偏好持久化（无 AudioContext 环境）', () => {
  it('默认未静音', () => {
    const sfx = new SfxEngine({ storage: createMemoryStorage() });
    expect(sfx.isMuted).toBe(false);
  });

  it('toggleMute 翻转并持久化到存储，新实例可恢复', () => {
    const storage = createMemoryStorage();
    const sfx = new SfxEngine({ storage });
    const after = sfx.toggleMute();
    expect(after).toBe(true);
    expect(sfx.isMuted).toBe(true);
    expect(storage.getItem('maze.audio.muted')).toBe('1');
    const sfx2 = new SfxEngine({ storage });
    expect(sfx2.isMuted).toBe(true);
  });

  it('setMuted(false) 写回 0', () => {
    const storage = createMemoryStorage();
    const sfx = new SfxEngine({ storage });
    sfx.setMuted(true);
    sfx.setMuted(false);
    expect(storage.getItem('maze.audio.muted')).toBe('0');
  });

  it('存储中 "1" → 初始化即静音', () => {
    const storage = createMemoryStorage({ 'maze.audio.muted': '1' });
    const sfx = new SfxEngine({ storage });
    expect(sfx.isMuted).toBe(true);
  });

  it('null 存储 → 退内存态，不抛错、不持久化', () => {
    const sfx = new SfxEngine({ storage: null });
    expect(sfx.isMuted).toBe(false);
    expect(() => sfx.toggleMute()).not.toThrow();
    expect(() => sfx.play('move')).not.toThrow();
  });

  it('无 AudioContext 环境 play 全部事件名不抛错', () => {
    const sfx = new SfxEngine({ storage: createMemoryStorage() });
    expect(() => {
      sfx.play('move');
      sfx.play('pickup');
      sfx.play('door');
      sfx.play('win');
      sfx.play('invalid');
    }).not.toThrow();
  });
});
