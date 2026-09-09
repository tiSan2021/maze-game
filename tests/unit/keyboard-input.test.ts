// keyboard-input.test.ts · 键盘输入装配（E6-2 / UX §3.1–3.2 / M2）
// 断言连走节奏（220/110ms）、等上一次滑行结束、栈顶方向、blur 清空、OS auto-repeat 丢弃。
import { describe, it, expect } from 'vitest';
import { KeyboardInput, dirOfKey, INITIAL_DELAY_MS, REPEAT_DELAY_MS } from '../../src/input/keyboard';
import type { Dir } from '../../src/core/types';

/** 可控时钟 + 滑行记录器 */
function harness() {
  let t = 1000;
  const slides: Dir[] = [];
  const input = new KeyboardInput({ now: () => t });
  const frame = () => input.update((d) => slides.push(d));
  const done = () => input.notifySlideDone();
  return {
    input,
    slides,
    frame,
    done,
    advance: (ms: number) => void (t += ms),
    now: () => t,
  };
}

describe('keyboard · 按键映射', () => {
  it('方向键与 WASD 四向（含大写）', () => {
    expect(dirOfKey('ArrowUp')).toBe('up');
    expect(dirOfKey('ArrowDown')).toBe('down');
    expect(dirOfKey('ArrowLeft')).toBe('left');
    expect(dirOfKey('ArrowRight')).toBe('right');
    expect(dirOfKey('w')).toBe('up');
    expect(dirOfKey('A')).toBe('left');
    expect(dirOfKey('s')).toBe('down');
    expect(dirOfKey('D')).toBe('right');
    expect(dirOfKey('Enter')).toBeNull();
    expect(dirOfKey('z')).toBeNull();
  });
});

describe('keyboard · 一次按下 = 一次滑行', () => {
  it('按下后下一帧立即滑行一次', () => {
    const h = harness();
    h.input.pressDir('right');
    h.frame();
    expect(h.slides).toEqual(['right']);
  });

  it('未 notifySlideDone 前不再发起第二次（等上一次滑行结束）', () => {
    const h = harness();
    h.input.pressDir('right');
    h.frame();
    h.advance(1000);
    h.frame();
    h.frame();
    expect(h.slides).toEqual(['right']); // 仍在等待
    h.done();
    h.frame();
    expect(h.slides).toEqual(['right', 'right']); // 解除后才继续
  });

  it('快速点按（按下即松开）仍兑现一次滑行', () => {
    const h = harness();
    h.input.pressDir('up');
    h.input.releaseDir('up');
    h.frame();
    expect(h.slides).toEqual(['up']);
  });

  it('OS auto-repeat（repeat=true）被丢弃：不产生额外滑行', () => {
    const h = harness();
    h.input.pressDir('up');
    h.frame();
    h.done();
    expect(h.slides).toEqual(['up']);

    // OS 自动重复的 keydown（e.repeat=true）必须被丢弃：既不兑现立即滑行，也不重置节奏
    expect(h.input.pressDir('up', true)).toBe(false);
    h.frame(); // 不推进时间
    expect(h.slides).toEqual(['up']);
  });
});

describe('keyboard · 连走节奏 220/110ms', () => {
  it('首次 220ms 后才第二次，之后每 110ms 一次', () => {
    const h = harness();
    h.input.pressDir('down');
    h.frame(); // 第 1 次（立即）
    h.done();

    h.advance(INITIAL_DELAY_MS - 1);
    h.frame();
    expect(h.slides.length).toBe(1); // 219ms 还不发

    h.advance(1); // 到 220ms
    h.frame();
    expect(h.slides.length).toBe(2);
    h.done();

    h.advance(REPEAT_DELAY_MS - 1);
    h.frame();
    expect(h.slides.length).toBe(2);

    h.advance(1); // +110ms
    h.frame();
    expect(h.slides.length).toBe(3);

    // 节奏常量本身
    expect(INITIAL_DELAY_MS).toBe(220);
    expect(REPEAT_DELAY_MS).toBe(110);
  });

  it('松开后不再连走', () => {
    const h = harness();
    h.input.pressDir('left');
    h.frame();
    h.done();
    h.input.releaseDir('left');
    h.advance(1000);
    h.frame();
    expect(h.slides).toEqual(['left']);
  });
});

describe('keyboard · 多键以最近按下为准 + blur', () => {
  it('同时多方向：栈顶（最近按下）优先', () => {
    const h = harness();
    h.input.pressDir('right');
    h.input.pressDir('up');
    expect(h.input.top()).toBe('up');
    expect(h.input.depth()).toBe(2);
    h.frame();
    expect(h.slides).toEqual(['up']);

    // 松开栈顶 → 回落到 right
    h.input.releaseDir('up');
    expect(h.input.top()).toBe('right');
    h.done();
    h.advance(1000);
    h.frame();
    expect(h.slides).toEqual(['up', 'right']);
  });

  it('重复按同一方向不出栈两次', () => {
    const h = harness();
    h.input.pressDir('up');
    h.input.pressDir('up');
    expect(h.input.depth()).toBe(1);
  });

  it('blur 清空输入栈：之后不再发起滑行', () => {
    const h = harness();
    h.input.pressDir('right');
    h.input.blur();
    expect(h.input.depth()).toBe(0);
    expect(h.input.top()).toBeNull();
    h.advance(1000);
    h.frame();
    h.frame();
    expect(h.slides).toEqual([]);
  });
});
