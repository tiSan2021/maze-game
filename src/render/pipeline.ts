// pipeline.ts · 双渲染路径装配（E2-4 / ADR-03）
// 按 level.visionMode 切换：'full'→全烘焙（<3ms）；'fog'→三层增量（5–6ms）。
// tileAtlasReady 必须在首帧（renderFrame）前为 true（三前置①）。fogOff 复用 BAKED 路径。

import { CELL_PX, CANVAS_W, CANVAS_H } from '../core/constants/metrics';
import { computeVisibility, cellRenderState } from '../sim/visibility';
import { key } from '../util/grid';
import type { Level, Vec2, CellKey, KeyColor } from '../core/types';
import type { CanvasFactory, Ctx2D } from './canvas';
import { prerenderTiles, type TileAtlas } from './tiles';
import { bakeL0, createLayers, updateL1, type RenderStats } from './layers';
import { drawCell } from './draw-cell';
import { drawEntities, type EntityView } from './sprites';

export interface PipelineOptions {
  /** 可访问性：'fogOff' 强制全烘焙（复用 BAKED 路径，不改 visible/visited） */
  fogOff?: boolean;
  /** 迷宫左上角在画布中的原点（居中偏移，逻辑像素）。缺省 {0,0} = 贴左上（测试/spike 行为不变） */
  origin?: { x: number; y: number };
}

type Mode = 'BAKED' | 'LAYERED';

export class RenderPipeline {
  readonly stats: RenderStats = { tileAtlasReady: false, lastDirtyCount: 0 };
  private atlas!: TileAtlas;
  private readonly main: Ctx2D;
  private readonly level: Level;
  private readonly factory: CanvasFactory;
  private readonly a11y: 'fogOff' | null;
  private readonly mode: Mode;
  private readonly origin: { x: number; y: number };

  private l0: ReturnType<CanvasFactory> | null = null;
  private l1: ReturnType<CanvasFactory> | null = null;
  private staticLayer: ReturnType<CanvasFactory> | null = null;
  private prevStates: (string | null)[] = [];

  private pos: Vec2;
  private visited: Set<CellKey>;
  private visible: Set<CellKey>;

  constructor(main: Ctx2D, level: Level, factory: CanvasFactory, opts: PipelineOptions = {}) {
    this.main = main;
    this.level = level;
    this.factory = factory;
    this.a11y = opts.fogOff ? 'fogOff' : null;
    this.mode = this.level.visionMode === 'full' || opts.fogOff ? 'BAKED' : 'LAYERED';
    this.origin = opts.origin ?? { x: 0, y: 0 };
    this.pos = level.start;
    this.visited = new Set<CellKey>([key(level.start)]);
    this.visible = computeVisibility(level, this.pos, this.visited);
    this.prevStates = new Array(level.gridSize * level.gridSize).fill(null);
  }

  /** 启动期预渲染 tile 图集 → tileAtlasReady 置 true（早于首帧） */
  init(): void {
    this.atlas = prerenderTiles(this.factory);
    this.stats.tileAtlasReady = true; // 首帧前必须已就绪（F 组 ③）

    const n = this.level.gridSize * CELL_PX;
    if (this.mode === 'BAKED') {
      this.staticLayer = this.factory(n, n);
      const sctx = this.staticLayer.getContext('2d');
      bakeL0(sctx, this.level);
      // 全烘焙：所有格按 A 态绘制（fogOff 经 a11y 覆盖，复用同一条 BAKED 路径）
      for (let y = 0; y < this.level.gridSize; y++) {
        for (let x = 0; x < this.level.gridSize; x++) {
          const cell = { x, y };
          const st = cellRenderState(this.level, cell, this.pos, this.visited, this.visible, this.a11y);
          if (st === 'UNKNOWN') continue; // 理论上 full/fogOff 不出现
          drawCell(sctx, this.atlas, cell, st, this.pos);
        }
      }
    } else {
      const layers = createLayers(this.factory, this.level);
      this.l0 = layers.l0;
      this.l1 = layers.l1;
      bakeL0(this.l0.getContext('2d'), this.level);
      this.prevStates.fill(null);
      updateL1(this.l1.getContext('2d'), this.level, this.pos, this.visited, this.visible, this.atlas, this.prevStates, this.stats, true);
    }
  }

  /** 跨格/撤销/重开/加载：重算可见集并增量更新 L1 */
  moveTo(pos: Vec2, visited: ReadonlySet<CellKey>): void {
    this.pos = pos;
    this.visited = new Set(visited);
    this.visible = computeVisibility(this.level, this.pos, this.visited);
    if (this.mode === 'LAYERED' && this.l1) {
      updateL1(this.l1.getContext('2d'), this.level, this.pos, this.visited, this.visible, this.atlas, this.prevStates, this.stats, false);
    }
  }

  /** 每帧合成。BAKED：1× drawImage(静态层)+实体；LAYERED：L0+L1+视野内格+实体 */
  renderFrame(view: EntityView): void {
    const n = this.level.gridSize * CELL_PX;
    // 清整块画布（平移前清，避免旧位置残留；菜单态 main.ts 同样按整块清）
    this.main.clearRect(0, 0, CANVAS_W, CANVAS_H);
    this.main.save();
    this.main.translate(this.origin.x, this.origin.y);
    if (this.mode === 'BAKED' && this.staticLayer) {
      this.main.drawImage(this.staticLayer as unknown as CanvasImageSource, 0, 0);
    } else if (this.l0 && this.l1) {
      this.main.drawImage(this.l0 as unknown as CanvasImageSource, 0, 0);
      this.main.drawImage(this.l1 as unknown as CanvasImageSource, 0, 0);
      // L2 动态层：仅视野内 ~29 格
      for (let y = 0; y < this.level.gridSize; y++) {
        for (let x = 0; x < this.level.gridSize; x++) {
          const cell = { x, y };
          const st = cellRenderState(this.level, cell, this.pos, this.visited, this.visible, null);
          if (st === 'WALL' || st === 'VIEW_WALKED' || st === 'VIEW_UNWALKED') {
            drawCell(this.main, this.atlas, cell, st, this.pos);
          }
        }
      }
    }
    drawEntities(this.main, this.atlas, this.level, this.pos, view);
    this.main.restore();
  }
}
