// 测试辅助：快速构造 Level（不进 vitest 收集，因非 *.test.ts）
import type { Dir, DoorEntity, KeyColor, KeyEntity, Level, Vec2, VisionMode } from '../../src/core/types';

export type GridCell = 'floor' | 'wall';

/** 外圈墙、内部全地板的空网格 */
export function emptyGrid(gridSize: number): GridCell[][] {
  const g: GridCell[][] = [];
  for (let y = 0; y < gridSize; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < gridSize; x++) {
      row.push(x === 0 || y === 0 || x === gridSize - 1 || y === gridSize - 1 ? 'wall' : 'floor');
    }
    g.push(row);
  }
  return g;
}

export interface MakeLevelOpts {
  gridSize?: number;
  id?: string;
  grid?: GridCell[][];
  start?: Vec2;
  exit?: Vec2;
  keys?: KeyEntity[];
  doors?: DoorEntity[];
  visionMode?: VisionMode;
  expectedSolution?: Dir[];
}

/** 构造测试用 Level（默认值：9×9、全开内部、start(1,1)/exit(7,7)、full、无锁、空解法） */
export function makeLevel(opts: MakeLevelOpts = {}): Level {
  const gridSize = opts.gridSize ?? 9;
  const grid = opts.grid ?? emptyGrid(gridSize);
  const expectedSolution = opts.expectedSolution ?? [];
  return {
    schemaVersion: 1,
    id: opts.id ?? 'test-level',
    gridSize: gridSize as 9 | 11 | 13,
    grid,
    start: opts.start ?? { x: 1, y: 1 },
    exit: opts.exit ?? { x: gridSize - 2, y: gridSize - 2 },
    keys: opts.keys ?? [],
    doors: opts.doors ?? [],
    visionMode: opts.visionMode ?? 'full',
    meta: {
      lockDepth: 0,
      keyCount: opts.keys?.length ?? 0,
      doorCount: opts.doors?.length ?? 0,
      deadEndBranches: 0,
      expectedSolution,
    },
  };
}

/** 在网格上放置墙（就地修改） */
export function setWall(grid: GridCell[][], x: number, y: number): void {
  grid[y][x] = 'wall';
}

/** 在网格上放置地板（就地修改） */
export function setFloor(grid: GridCell[][], x: number, y: number): void {
  grid[y][x] = 'floor';
}

export function key(color: KeyColor): KeyEntity {
  return { id: `k${color}`, color, pos: { x: 0, y: 0 } };
}
