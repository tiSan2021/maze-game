// types.ts · 全局唯一数据模型（GDD② §3 / ADR-02）
// 单点定义：手工关卡与生成关卡共用同一份 Level，引擎零来源分支（W4/B2：Level 不含来源标记字段）。

/** 网格单元 */
export type GridCell = 'floor' | 'wall';

/** 四向 */
export type Dir = 'up' | 'down' | 'left' | 'right';

/** 钥匙/门颜色（K1：0=青 1=紫 2=橙，≤3） */
export type KeyColor = 0 | 1 | 2;

/** 视野模式：'full'=关1-8 三态；'fog'=关9+ / 每日 四态（GDD① §4.5） */
export type VisionMode = 'full' | 'fog';

/** 每日档位（GDD⑥） */
export type Tier = 'mid' | 'high' | 'ultra';

/** Set 的键：`"${x},${y}"` */
export type CellKey = string;

export interface Vec2 {
  x: number;
  y: number;
}

export interface KeyEntity {
  id: string;
  color: KeyColor;
  pos: Vec2;
}

export interface DoorEntity {
  id: string;
  color: KeyColor;
  pos: Vec2;
}

export interface LevelMeta {
  /** 依赖链实际深度（GDD③ computeLockDepth 算出并与声明比对），≤2 */
  lockDepth: 0 | 1 | 2 | 3;
  /** ≤3 */
  keyCount: number;
  /** ≤3 */
  doorCount: number;
  /** ≤6（R4 时长控制） */
  deadEndBranches: number;
  /** 预期解法：从头到尾方向序列。G2/G3 输入，不可省略（X4） */
  expectedSolution: Dir[];
}

export interface Level {
  schemaVersion: number;
  id: string;
  /** 含外墙的外部总尺寸（C4）：9 | 11 | 13；内部可用 = gridSize − 2 */
  gridSize: 9 | 11 | 13;
  /** gridSize × gridSize，grid[y][x]，外圈恒 'wall' */
  grid: GridCell[][];
  start: Vec2;
  exit: Vec2;
  keys: KeyEntity[];
  doors: DoorEntity[];
  visionMode: VisionMode;
  meta: LevelMeta;
}

/** 进度事件：仅 'key' / 'door' 两种，由 GDD③ 唯一生产（GDD② §3.3） */
export type ProgressEvent =
  | { kind: 'key'; color: KeyColor }
  | { kind: 'door'; doorId: string };

export interface Step {
  from: Vec2;
  to: Vec2;
  dir: Dir;
  /** 该步是否产生进度事件；null = 普通移动（含被拦截后不计步的移动） */
  progressEvent: ProgressEvent | null;
}

export interface RunSnapshot {
  pos: Vec2;
  keysHeld: Set<KeyColor>;
  doorsOpened: Set<string>;
  pathLength: number;
  steps: number;
  // 注意：不含 visited（D11/R-B）：visited 单调，撤销不回滚
}

export interface RunState {
  level: Level;
  pos: Vec2;
  keysHeld: Set<KeyColor>;
  doorsOpened: Set<string>;
  /** 实际发生的移动序列。可回滚（D5） */
  path: Step[];
  /** 撤销快照栈，粒度=一次滑行（GDD① §4.5） */
  undoStack: RunSnapshot[];
  /** 走过的地板格。单调递增，撤销不回滚（D11/V5/W6） */
  visited: Set<CellKey>;
  steps: number;
  elapsedMs: number;
  finished: boolean;
}

/** 段与回头路（GDD② §3.3） */
export type Segment = CellKey[];

export interface SegmentReport {
  segments: Segment[];
  /** 回头路段数：段内存在被访问 ≥2 次格子的段数 */
  backtrackSegments: number;
}
