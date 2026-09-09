// tiles.ts · tile 图集预渲染（E2-1 / 三前置① / ADR-03 D3）
// 墙 / 门 / 笔迹三类图案预渲染为 40×40 离屏精灵；运行时仅 drawImage（省 ~85% 线段开销）。
// 此处允许使用 fill/stroke（烘焙期，非单格绘制路径）；draw-cell 才受限为仅 drawImage。
// 禁用内建随机函数（DQ3）：所有变体确定性生成，无随机笔迹抖动。

import { CELL_PX } from '../core/constants/metrics';
import {
  PAPER, GRID_UNKNOWN, GRID_MEMORY, GRID_VIEW, PAPER_WALKED, INK as INK_COLOR,
  WALL_FILL, WALL_HATCH, WALL_OUTLINE, WALL_SHADOW, WALL_MEMORY,
  EXIT, EXIT_RING, KEY_COLORS, DOOR_LOCKED_FILL, DOOR_LOCKED_CROSS,
} from '../core/constants/palette';
import {
  WALL_HATCH as WALL_HATCH_PAT, WALL_MEMORY_HATCH, DOOR_CROSS, INK as INK_PAT,
  EXIT_CONCENTRIC, KEY_GLYPH, HALO,
} from '../core/constants/pattern';
import type { CanvasFactory, CanvasLike, Ctx2D } from './canvas';

/** 预渲染好的单个 tile 精灵：离屏画布 + 其 2D 上下文（烘焙期使用后即封存，运行时仅 drawImage） */
export type TileSprite = { c: CanvasLike; ctx: Ctx2D };

export interface TileAtlas {
  wall: TileSprite;
  wallMemory: [TileSprite, TileSprite, TileSprite]; // [L3, L2, L1]
  floorView: TileSprite;
  floorWalked: TileSprite;
  doorLocked: [TileSprite, TileSprite, TileSprite];
  doorOpen: [TileSprite, TileSprite, TileSprite];
  exit: TileSprite;
  key: [TileSprite, TileSprite, TileSprite];
  halo: [TileSprite, TileSprite, TileSprite, TileSprite]; // key0/1/2 + exit
}

const S = CELL_PX;

function newTile(factory: CanvasFactory): TileSprite {
  const c = factory(S, S);
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return { c, ctx };
}

/** 45° 斜线填充（dir=1 ↘，dir=-1 ↙），裁剪在 [0,0,S,S] 内 */
function diagonalHatch(
  ctx: Ctx2D, spacing: number, color: string, lineWidth: number, dir: 1 | -1,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S, S);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let o = -S; o <= S; o += spacing) {
    if (dir === 1) {
      ctx.moveTo(o, 0);
      ctx.lineTo(o + S, S);
    } else {
      ctx.moveTo(o, S);
      ctx.lineTo(o + S, 0);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function gridLines(ctx: Ctx2D, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, 0, S, S);
}

function lockHole(ctx: Ctx2D, open: boolean): void {
  const cx = S / 2;
  const cy = S / 2;
  ctx.fillStyle = open ? EXIT : PAPER;
  ctx.beginPath();
  ctx.arc(cx, cy - 2, 3.2, 0, Math.PI * 2);
  ctx.fill();
  if (!open) {
    ctx.strokeStyle = WALL_OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // 可开：锁孔开口（缺口弧）
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 3.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
}

function keyGlyph(ctx: Ctx2D, color: string, i: number): void {
  const cx = S / 2;
  const cy = S / 2;
  const r = KEY_GLYPH.ringRadiusPx;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = KEY_GLYPH.lineWidth;
  // 环形镂空
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // 形状标记（菱形/三角/六边）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  if (i === 0) {
    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
  } else if (i === 1) {
    ctx.moveTo(0, -r); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath();
  } else {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  ctx.stroke();
  ctx.restore();
}

function haloSprite(factory: CanvasFactory, color: string): TileSprite {
  const R = HALO.radiusPx;
  const c = factory(R * 2, R * 2);
  const ctx = c.getContext('2d');
  for (let k = 0; k < HALO.rings; k++) {
    const t = k / (HALO.rings - 1);
    ctx.beginPath();
    ctx.arc(R, R, R * (1 - t * 0.7), 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.28 * (1 - t);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return { c, ctx };
}

/** 预渲染整张 tile 图集（启动期一次；三前置①） */
export function prerenderTiles(factory: CanvasFactory): TileAtlas {
  // —— 墙 A 态（带假投影）——
  const wall = newTile(factory);
  wall.ctx.fillStyle = WALL_SHADOW;
  wall.ctx.globalAlpha = 0.5;
  wall.ctx.fillRect(2, 2, S - 2, S - 2);
  wall.ctx.globalAlpha = 1;
  wall.ctx.fillStyle = WALL_FILL;
  wall.ctx.fillRect(0, 0, S - 2, S - 2);
  diagonalHatch(wall.ctx, WALL_HATCH_PAT.spacingPx, WALL_HATCH, WALL_HATCH_PAT.lineWidth, 1);
  wall.ctx.strokeStyle = WALL_OUTLINE;
  wall.ctx.lineWidth = 2;
  wall.ctx.strokeRect(0, 0, S - 2, S - 2);

  // —— WALL_MEMORY 三档（无假投影）——
  const wallMemory = WALL_MEMORY.map((tier) => {
    const { c, ctx } = newTile(factory);
    ctx.fillStyle = tier.fill;
    ctx.fillRect(0, 0, S, S);
    diagonalHatch(ctx, WALL_MEMORY_HATCH.spacingPx, tier.hatch, WALL_MEMORY_HATCH.lineWidth, 1);
    ctx.strokeStyle = tier.outline;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, S, S);
    return { c, ctx };
  }) as [TileSprite, TileSprite, TileSprite];

  // —— 地板 A 态（当前视野）——
  const floorView = newTile(factory);
  floorView.ctx.fillStyle = PAPER;
  floorView.ctx.fillRect(0, 0, S, S);
  gridLines(floorView.ctx, GRID_VIEW);

  // —— 地板 B 态（已走过 + 铅笔笔迹）——
  const floorWalked = newTile(factory);
  floorWalked.ctx.fillStyle = PAPER_WALKED;
  floorWalked.ctx.fillRect(0, 0, S, S);
  gridLines(floorWalked.ctx, GRID_MEMORY);
  floorWalked.ctx.save();
  floorWalked.ctx.beginPath();
  floorWalked.ctx.rect(0, 0, S, S);
  floorWalked.ctx.clip();
  floorWalked.ctx.strokeStyle = INK_COLOR;
  floorWalked.ctx.globalAlpha = INK_PAT.alpha;
  floorWalked.ctx.lineWidth = INK_PAT.lineWidth;
  floorWalked.ctx.beginPath();
  for (let o = -S; o <= S; o += INK_PAT.spacingPx) {
    floorWalked.ctx.moveTo(o, 0);
    floorWalked.ctx.lineTo(o + S, S);
  }
  floorWalked.ctx.stroke();
  floorWalked.ctx.restore();

  // —— 门（锁定/可开，三色）——
  const doorLocked = KEY_COLORS.map((color, i) => {
    const { c, ctx } = newTile(factory);
    ctx.fillStyle = WALL_SHADOW;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(2, 2, S - 2, S - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = DOOR_LOCKED_FILL;
    ctx.fillRect(0, 0, S - 2, S - 2);
    diagonalHatch(ctx, DOOR_CROSS.spacingPx, DOOR_LOCKED_CROSS, DOOR_CROSS.lineWidth, 1);
    diagonalHatch(ctx, DOOR_CROSS.spacingPx, DOOR_LOCKED_CROSS, DOOR_CROSS.lineWidth, -1);
    ctx.strokeStyle = WALL_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, S - 2, S - 2);
    lockHole(ctx, false);
    return { c, ctx };
  }) as [TileSprite, TileSprite, TileSprite];

  const doorOpen = KEY_COLORS.map((color, i) => {
    const { c, ctx } = newTile(factory);
    ctx.fillStyle = WALL_SHADOW;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(2, 2, S - 2, S - 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, S - 2, S - 2);
    ctx.strokeStyle = WALL_OUTLINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, S - 2, S - 2);
    lockHole(ctx, true);
    return { c, ctx };
  }) as [TileSprite, TileSprite, TileSprite];

  // —— 出口（同心圆 + 向上箭头，扩散环由 sprites 动态叠）——
  const exit = newTile(factory);
  exit.ctx.fillStyle = PAPER;
  exit.ctx.fillRect(0, 0, S, S);
  const cx = S / 2;
  const cy = S / 2;
  for (let k = 0; k < EXIT_CONCENTRIC.rings; k++) {
    exit.ctx.strokeStyle = k % 2 === 0 ? EXIT : EXIT_RING;
    exit.ctx.lineWidth = EXIT_CONCENTRIC.lineWidth;
    exit.ctx.beginPath();
    exit.ctx.arc(cx, cy, 5 + k * EXIT_CONCENTRIC.gapPx, 0, Math.PI * 2);
    exit.ctx.stroke();
  }
  exit.ctx.fillStyle = EXIT;
  exit.ctx.beginPath();
  exit.ctx.moveTo(cx, cy - 10);
  exit.ctx.lineTo(cx - 6, cy + 4);
  exit.ctx.lineTo(cx + 6, cy + 4);
  exit.ctx.closePath();
  exit.ctx.fill();

  // —— 钥匙（三色字形 + 形状标记）——
  const key = KEY_COLORS.map((color, i) => {
    const { c, ctx } = newTile(factory);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, S, S);
    keyGlyph(ctx, color, i);
    return { c, ctx };
  }) as [TileSprite, TileSprite, TileSprite];

  // —— 墨晕（4 色：key0/1/2 + exit），启动时一次烘焙（亮底发光替代物）——
  const halo = [
    haloSprite(factory, KEY_COLORS[0]),
    haloSprite(factory, KEY_COLORS[1]),
    haloSprite(factory, KEY_COLORS[2]),
    haloSprite(factory, EXIT),
  ] as [TileSprite, TileSprite, TileSprite, TileSprite];

  return { wall, wallMemory, floorView, floorWalked, doorLocked, doorOpen, exit, key, halo };
}
