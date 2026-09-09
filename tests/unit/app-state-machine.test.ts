// app-state-machine.test.ts · E3 顶层状态机转移覆盖（UX §1 / GDD① §4.8）
// 纯逻辑，无 DOM；全部复用既有 sim/input API，不重写域内核。
import { describe, it, expect } from 'vitest';
import { AppMachine } from '../../src/state/app';
import { makeLevel, emptyGrid, setWall } from '../helpers/build-level';
import { renderHudHtml } from '../../src/render/hud';
import type { Level } from '../../src/core/types';

/** 直走廊：start(1,1) → exit(7,1)，并以墙封住下方，使一次「向右」滑行直达出口 */
function straightExitLevel(): Level {
  const grid = emptyGrid(9);
  for (let x = 1; x <= 7; x++) setWall(grid, x, 2); // 阻断垂直邻格 → 无路口 → 直达出口
  return makeLevel({ grid, start: { x: 1, y: 1 }, exit: { x: 7, y: 1 }, visionMode: 'full' });
}

describe('AppMachine · 顶层状态转移', () => {
  it('初始状态为 MENU', () => {
    const app = new AppMachine();
    expect(app.state).toBe('MENU');
  });

  it('S0 → S1 → S2：主菜单→选关→进入游玩，RunState 已初始化（start 入 visited）', () => {
    const app = new AppMachine();
    app.goToLevelSelect();
    expect(app.state).toBe('LEVEL_SELECT');
    app.enterLevel(makeLevel());
    expect(app.state).toBe('PLAYING');
    expect(app.run).not.toBeNull();
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
    expect(app.run!.visited.has('1,1')).toBe(true);
  });

  it('Esc → S3：游玩中暂停；再 Esc/继续 → S2', () => {
    const app = new AppMachine();
    app.enterLevel(makeLevel());
    app.pause();
    expect(app.state).toBe('PAUSED');
    app.resume();
    expect(app.state).toBe('PLAYING');
  });

  it('抵达出口 → S4：单次滑行达出口即结算，result 非空且含星级', () => {
    const app = new AppMachine();
    app.enterLevel(straightExitLevel());
    app.move('right');
    expect(app.state).toBe('SETTLEMENT');
    expect(app.result).not.toBeNull();
    expect([1, 2, 3]).toContain(app.result!.star);
    expect(app.run!.finished).toBe(true);
  });

  it('R 重开：一次滑行后重开 → 滞留 PLAYING，path/steps/pos/undoStack 全部归零', () => {
    const app = new AppMachine();
    // 空网格：向右滑一行在第一个路口停下（1 格），便于产生一次有效滑行
    app.enterLevel(makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));
    app.move('right');
    expect(app.run!.steps).toBe(1);
    expect(app.run!.undoStack.length).toBe(1);
    app.restart();
    expect(app.state).toBe('PLAYING');
    expect(app.run!.steps).toBe(0);
    expect(app.run!.path.length).toBe(0);
    expect(app.run!.undoStack.length).toBe(0);
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
  });

  it('Z 撤销后 HUD/state 一致：撤销栈 −1、pos 回滚、HUD 步数与持钥同步', () => {
    const app = new AppMachine();
    const lvl = makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } });
    app.enterLevel(lvl);
    app.move('right'); // 一次滑行，1 格
    expect(app.run!.undoStack.length).toBe(1);

    const ok = app.undo();
    expect(ok).toBe(true);
    // 状态一致
    expect(app.run!.undoStack.length).toBe(0);
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
    expect(app.run!.steps).toBe(0);
    // HUD 派生自同一份 run，必然一致
    const hud = renderHudHtml({
      levelId: lvl.id,
      timeMs: app.run!.elapsedMs,
      steps: app.run!.steps,
      keysHeld: [...app.run!.keysHeld],
      totalKeys: lvl.meta.keyCount,
      fog: false,
    });
    expect(hud).toContain('步数 0');
    expect([...app.run!.keysHeld].length).toBe(app.run!.keysHeld.size);
  });

  it('撞墙零副作用（V2）：前方 BLOCKED → 不计入步数 / path / undoStack，状态不变', () => {
    const app = new AppMachine();
    app.enterLevel(makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));
    // (1,1) 向左是外墙 → BLOCKED
    app.move('left');
    expect(app.run!.steps).toBe(0);
    expect(app.run!.path.length).toBe(0);
    expect(app.run!.undoStack.length).toBe(0);
    expect(app.state).toBe('PLAYING');
  });

  it('GATE_DAILY：默认不显示每日分区；主线全通后置 true（E5 接真实存档）', () => {
    const app = new AppMachine();
    expect(app.canShowDaily()).toBe(false);
    app.mainProgress = { allMainCleared: true };
    expect(app.canShowDaily()).toBe(true);
  });

  it('S4 → S1：结算后返回选关（放弃本局，不写进度）', () => {
    const app = new AppMachine();
    app.enterLevel(straightExitLevel());
    app.move('right');
    expect(app.state).toBe('SETTLEMENT');
    app.settleToSelect();
    expect(app.state).toBe('LEVEL_SELECT');
    expect(app.run).toBeNull();
  });

  it('S4 → S2：重玩本关（replay）回到 PLAYING 且重新初始化', () => {
    const app = new AppMachine();
    app.enterLevel(straightExitLevel());
    app.move('right');
    expect(app.state).toBe('SETTLEMENT');
    app.replay();
    expect(app.state).toBe('PLAYING');
    expect(app.run!.steps).toBe(0);
    expect(app.run!.finished).toBe(false);
  });

  it('S2 → S2 失败自动重开：死局且无可撤销 → 重置本关，滞留 PLAYING', () => {
    const app = new AppMachine();
    // 起点四周全墙（仅起点一格可站）→ 死局
    const grid = emptyGrid(9);
    setWall(grid, 2, 1);
    setWall(grid, 1, 2);
    app.enterLevel(makeLevel({ grid, start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));
    const recovered = app.autoRecoverIfStuck();
    expect(recovered).toBe(true);
    expect(app.state).toBe('PLAYING');
    expect(app.run!.pos).toEqual({ x: 1, y: 1 });
  });

  it('autoRecoverIfStuck 在有可走方向时不触发', () => {
    const app = new AppMachine();
    app.enterLevel(makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));
    expect(app.autoRecoverIfStuck()).toBe(false);
  });
});
