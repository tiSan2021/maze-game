// level-grid.test.ts · 选关二维网格导航纯函数单测（UX 改进：↑/↓ 一次跨 5 关）
import { describe, it, expect } from 'vitest';
import { moveSelection, gridRowCount, MAIN_SEL_COLS } from '../../src/ui/level-grid';

const MAX = 24;

describe('选关网格 · 行内移动（left/right ±1）', () => {
  it('left/right 在 1..24 内 ±1', () => {
    for (let n = 1; n <= 24; n++) {
      if (n > 1) expect(moveSelection(n, 'left', MAX)).toBe(n - 1);
      if (n < 24) expect(moveSelection(n, 'right', MAX)).toBe(n + 1);
    }
  });
  it('在 1 处 left 停在 1（钳到下界）', () => {
    expect(moveSelection(1, 'left', MAX)).toBe(1);
  });
  it('在 24 处 right 停在 24（钳到上界）', () => {
    expect(moveSelection(24, 'right', MAX)).toBe(24);
  });
});

describe('选关网格 · 换行移动（up/down 跨 5）', () => {
  it('7 --up--> 2', () => {
    expect(moveSelection(7, 'up', MAX)).toBe(2);
  });
  it('1 --down--> 6', () => {
    expect(moveSelection(1, 'down', MAX)).toBe(6);
  });
  it('20 --down--> 25→24（钳到 maxLevel=24）', () => {
    expect(moveSelection(20, 'down', MAX)).toBe(24);
  });
  it('21 --up--> 16', () => {
    expect(moveSelection(21, 'up', MAX)).toBe(16);
  });
  it('1 --up--> 1（钳到下界）', () => {
    expect(moveSelection(1, 'up', MAX)).toBe(1);
  });
});

describe('选关网格 · maxLevel 小于 24 时钳制', () => {
  it('maxLevel=7 时 3 --down--> 7（3+5=8→钳 7），结果永不 > 7', () => {
    expect(moveSelection(3, 'down', 7)).toBe(7);
    for (let n = 1; n <= 7; n++) {
      expect(moveSelection(n, 'down', 7)).toBeLessThanOrEqual(7);
      expect(moveSelection(n, 'right', 7)).toBeLessThanOrEqual(7);
    }
  });
});

describe('选关网格 · 布局常量', () => {
  it('MAIN_SEL_COLS === 5；24 = 5×4 + 4（最后一行残 4，残缺在底部不夹心）', () => {
    expect(MAIN_SEL_COLS).toBe(5);
    expect(Math.floor(24 / MAIN_SEL_COLS)).toBe(4);
    expect(24 % MAIN_SEL_COLS).toBe(4);
  });
  it('gridRowCount(24) === 5（ceil(24/5)）', () => {
    expect(gridRowCount(24)).toBe(5);
  });
  it('gridRowCount(7, 5) === 2（ceil(7/5)）', () => {
    expect(gridRowCount(7, 5)).toBe(2);
  });
});
