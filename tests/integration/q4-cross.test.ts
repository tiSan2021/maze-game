// Q4 交叉断言（防漂移总闸）：同 Level 的 expectedSolution 喂 settle 必 3★（GDD⑤ §4.4 / ADR-04 §4）
// 同时覆盖真·管线回路：glide→runstate→segments→stars 对零回头路解也必 3★。
import { describe, it, expect } from 'vitest';
import type { Dir, Level, RunState } from '../../src/core/types';
import { emptyGrid, makeLevel } from '../helpers/build-level';
import { initRunState, applySlide } from '../../src/sim/runstate';
import { onEnterCell } from '../../src/sim/lockkey';
import { neighbor, key } from '../../src/util/grid';
import { settle } from '../../src/sim/stars';

/** 把 expectedSolution 重放为 finished RunState（等同 GDD⑤ replay → settle 路径） */
function replayToRunState(level: Level): RunState {
  const run = initRunState(level);
  let pos = { ...level.start };
  for (const d of level.meta.expectedSolution as Dir[]) {
    const next = neighbor(pos, d);
    const ev = onEnterCell(level, run.keysHeld, run.doorsOpened, next);
    run.path.push({ from: { ...pos }, to: { ...next }, dir: d, progressEvent: ev });
    run.visited.add(key(next));
    run.pos = { ...next };
    run.steps++;
    pos = next;
  }
  if (run.pos.x === level.exit.x && run.pos.y === level.exit.y) run.finished = true;
  return run;
}

describe('integration · Q4 交叉断言', () => {
  it('无锁关：expectedSolution 喂 settle → 3★', () => {
    const dirs: Dir[] = ['right', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'down', 'down', 'down', 'down'];
    const level = makeLevel({
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 7 },
      expectedSolution: dirs,
    });
    const run = replayToRunState(level);
    expect(run.finished).toBe(true);
    expect(settle(run)!.star).toBe(3); // Q4 总闸
  });

  it('真·管线回路：glide 沿 expectedSolution 滑行 → 3★（零回头路解）', () => {
    const gridSize = 9;
    const g = emptyGrid(gridSize);
    for (let x = 1; x <= 7; x++) g[1][x] = 'floor'; // 单行直走廊 (1,1)..(7,1)
    const dirs: Dir[] = ['right', 'right', 'right', 'right', 'right', 'right'];
    const level = makeLevel({
      gridSize,
      grid: g,
      start: { x: 1, y: 1 },
      exit: { x: 7, y: 1 },
      expectedSolution: dirs,
    });
    const state = initRunState(level);
    for (const d of dirs) applySlide(state, d); // 模拟逐键滑行
    expect(state.finished).toBe(true);
    expect(state.path).toHaveLength(6);
    expect(settle(state)!.star).toBe(3);
  });
});
