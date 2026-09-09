// hud-wire.test.ts · P5-S3.6-HUDWIRE 接线修复验证
// 证明三字段（undoSegments / starPreview / doorStatus）在状态变化后确实拿到真实值，
// 而非 hud.ts 的默认值（回溯 0 / ☆☆☆ / 无门状态）。
// 可验证路径：驱动 AppMachine → app.buildHudModel() → renderHudHtml(字符串) 断言。
// 诚实约束：本环境无 DOM，无法用浏览器肉眼确认；以下仅断言渲染出的 HTML 字符串。
// 段切分/回头路复用 sim/segments（W1）；星级阈值与 sim/stars.ts:47 同源，未重写。
import { describe, it, expect } from 'vitest';
import { AppMachine } from '../../src/state/app';
import { renderHudHtml } from '../../src/render/hud';
import { makeLevel, emptyGrid, setWall } from '../helpers/build-level';
import type { DoorEntity, KeyEntity } from '../../src/core/types';

/** 直走廊：start(1,1)→exit(7,1)，下方封墙 → 一次「向右」直达出口（单段无回头） */
function straightExitLevel() {
  const grid = emptyGrid(9);
  for (let x = 1; x <= 7; x++) setWall(grid, x, 2);
  return makeLevel({ grid, start: { x: 1, y: 1 }, exit: { x: 7, y: 1 }, visionMode: 'full' });
}

/** 全开 9×9：一次「向右」仅推进一格（(2,1) 处路口停），不抵达出口，便于撤销 */
function openLevel() {
  return makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } });
}

/** 含钥匙 + 同色门的单宽走廊：右滑先拾钥匙(3,1)，再抵门(5,1)自动开启 */
function keyDoorCorridor(): { app: AppMachine; level: ReturnType<typeof makeLevel> } {
  const grid = emptyGrid(9);
  for (let x = 1; x <= 7; x++) setWall(grid, x, 2); // 1-wide 走廊，避免路口提前停
  const keys: KeyEntity[] = [{ id: 'k0', color: 0, pos: { x: 3, y: 1 } }];
  const doors: DoorEntity[] = [{ id: 'd0', color: 0, pos: { x: 5, y: 1 } }];
  const level = makeLevel({ grid, start: { x: 1, y: 1 }, exit: { x: 7, y: 1 }, keys, doors });
  const app = new AppMachine();
  app.enterLevel(level);
  return { app, level };
}

describe('HUD 接线 · undoSegments = 撤销栈真实深度', () => {
  it('(a) 一次滑行后：steps 与撤销栈变化，undoSegments 反映真实栈深（非默认 0）', () => {
    const app = new AppMachine();
    app.enterLevel(openLevel());

    // 进入关卡、尚未移动：栈深 0 → 默认 0
    const before = app.buildHudModel()!;
    expect(before.undoSegments).toBe(0);
    expect(renderHudHtml(before)).toContain('回溯 0');

    app.move('right'); // 一次有效滑行 → 压入 1 个快照
    expect(app.run!.undoStack.length).toBe(1);

    const m = app.buildHudModel()!;
    expect(m.steps).toBe(app.run!.steps);
    expect(m.undoSegments).toBe(1); // 真实栈深，不是默认 0
    expect(renderHudHtml(m)).toContain('回溯 1');

    // 撤销一次 → 栈深回到 0，HUD 同步
    app.undo();
    expect(app.run!.undoStack.length).toBe(0);
    const afterUndo = app.buildHudModel()!;
    expect(afterUndo.undoSegments).toBe(0);
    expect(renderHudHtml(afterUndo)).toContain('回溯 0');
  });

  it('(a-边界) 无锁关卡（默认关）不应出现「门」字样', () => {
    const app = new AppMachine();
    app.enterLevel(straightExitLevel());
    app.move('right');
    expect(renderHudHtml(app.buildHudModel()!)).not.toContain('门');
  });
});

describe('HUD 接线 · doorStatus = 已开/总（无锁传 null）', () => {
  it('(b) 拾钥匙并开门后：doorStatus 显示 opened/total', () => {
    const { app } = keyDoorCorridor();

    // 右滑 1：停于钥匙格(3,1)，拾色 0
    app.move('right');
    expect([...app.run!.keysHeld]).toContain(0);

    // 右滑 2：停于门格(5,1)，持钥匙自动开启
    app.move('right');
    expect(app.run!.doorsOpened.has('d0')).toBe(true);

    const m = app.buildHudModel()!;
    expect(m.doorStatus).not.toBeNull();
    expect(m.doorStatus).toEqual({ opened: 1, total: 1 }); // total 取自 level.doors.length
    expect(renderHudHtml(m)).toContain('门 1/1');
  });
});

describe('HUD 接线 · starPreview = 当前路径实时推算（零回头路=3★）', () => {
  it('(c) 走含回头的路径：starPreview 从 3★ 实时下降到 2★', () => {
    const app = new AppMachine();
    // 全开 9×9：利用路口自然停止逐格推进
    app.enterLevel(makeLevel({ grid: emptyGrid(9), start: { x: 1, y: 1 }, exit: { x: 7, y: 7 } }));

    // 前 3 步（右→下→左）构成一个无回头的局部路径 → 0 回头段 → 3★
    app.move('right'); // →(2,1)
    app.move('down'); //  →(2,2)
    app.move('left'); //  →(1,2)
    const noBack = app.buildHudModel()!;
    expect(noBack.starPreview).toBe(3);
    expect(renderHudHtml(noBack)).toContain('★★★');

    // 第 4 步上：回到起点(1,1)，段内重复访问 → 1 回头段 → 2★（证明实时推算，非静态）
    app.move('up'); //  →(1,1) 回头
    const back = app.buildHudModel()!;
    expect(back.starPreview).toBeLessThan(3);
    expect(back.starPreview).toBe(2);
    expect(renderHudHtml(back)).toContain('★★☆');

    // 撤销回头步 → 回到 3★（再次证明随 path 实时变化）
    app.undo();
    expect(app.buildHudModel()!.starPreview).toBe(3);
  });
});
