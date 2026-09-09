// sprites.ts · 程序化精灵（玩家/钥匙/门/出口）+ 墨晕预渲染（E2-5 / 控制清单 F 组·禁阴影模糊）
// 墨晕在 tiles 启动期一次烘焙为 drawImage 精灵；本文件每帧用 drawImage + 缩放/透明做呼吸，无径向渐变、无阴影模糊。
// 禁用内建随机函数（DQ3）。

import { CELL_PX } from '../core/constants/metrics';
import { PLAYER, PLAYER_STROKE, EXIT } from '../core/constants/palette';
import type { Level, Vec2, KeyColor, CellKey } from '../core/types';
import type { Ctx2D } from './canvas';
import type { TileAtlas, TileSprite } from './tiles';

export interface EntityView {
  heldKeys: ReadonlySet<KeyColor>;
  openedDoors: ReadonlySet<string>;
  visible: ReadonlySet<CellKey>;
  /** 0..1 动效强度（motionScale） */
  motionScale: number;
  /** 累计毫秒，用于常驻呼吸动画 */
  timeMs: number;
}

/** 以 (cx,cy) 为中心绘制精灵（支持缩放/透明），用于呼吸/墨晕叠层 */
function blit(ctx: Ctx2D, sprite: TileSprite, cx: number, cy: number, scale: number, alpha: number): void {
  const w = sprite.c.width * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite.c as unknown as CanvasImageSource, cx - w / 2, cy - w / 2, w, w);
  ctx.restore();
}

function pulse(timeMs: number, periodMs: number, motionScale: number): number {
  if (motionScale <= 0) return 0; // motionScale=0 → 信息仍可见，无呼吸
  return (1 + Math.sin((timeMs / periodMs) * Math.PI * 2)) / 2;
}

function drawPlayer(ctx: Ctx2D, pos: Vec2): void {
  const cx = pos.x * CELL_PX + CELL_PX / 2;
  const cy = pos.y * CELL_PX + CELL_PX / 2;
  const w = 24;
  ctx.fillStyle = PLAYER;
  ctx.strokeStyle = PLAYER_STROKE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - w / 2, w, w, 6);
  ctx.fill();
  ctx.stroke();
  // 朝向三角（向上）
  ctx.fillStyle = PLAYER_STROKE;
  ctx.beginPath();
  ctx.moveTo(cx, cy - w / 2 - 4);
  ctx.lineTo(cx - 5, cy - w / 2 + 2);
  ctx.lineTo(cx + 5, cy - w / 2 + 2);
  ctx.closePath();
  ctx.fill();
}

/** 绘制所有实体（门恒画；钥匙/出口仅在可见时画，含呼吸墨晕） */
export function drawEntities(
  ctx: Ctx2D,
  atlas: TileAtlas,
  level: Level,
  pos: Vec2,
  view: EntityView,
): void {
  // 门（恒画，状态由 openedDoors 决定）
  for (const d of level.doors) {
    const cx = d.pos.x * CELL_PX + CELL_PX / 2;
    const cy = d.pos.y * CELL_PX + CELL_PX / 2;
    const open = view.openedDoors.has(d.id);
    const tile = open ? atlas.doorOpen[d.color] : atlas.doorLocked[d.color];
    blit(ctx, tile, cx, cy, 1, 1);
    if (open && view.visible.has(`${d.pos.x},${d.pos.y}`)) {
      const p = pulse(view.timeMs, 1200, view.motionScale);
      blit(ctx, atlas.halo[d.color], cx, cy, 1 + 0.15 * p, 0.5 + 0.4 * p);
    }
  }

  // 钥匙（未持有且可见 → 呼吸墨晕 + 字形）
  level.keys.forEach((k, i) => {
    if (view.heldKeys.has(k.color)) return;
    if (!view.visible.has(`${k.pos.x},${k.pos.y}`)) return;
    const cx = k.pos.x * CELL_PX + CELL_PX / 2;
    const cy = k.pos.y * CELL_PX + CELL_PX / 2;
    const p = pulse(view.timeMs, 1600, view.motionScale);
    blit(ctx, atlas.halo[k.color], cx, cy, 1.1 + 0.2 * p, 0.4 + 0.4 * p);
    blit(ctx, atlas.key[k.color], cx, cy, 1, 1);
  });

  // 出口（可见 → 扩散环墨晕 + 同心圆底）
  const ex = level.exit;
  if (view.visible.has(`${ex.x},${ex.y}`)) {
    const cx = ex.x * CELL_PX + CELL_PX / 2;
    const cy = ex.y * CELL_PX + CELL_PX / 2;
    const p = pulse(view.timeMs, 2000, view.motionScale);
    blit(ctx, atlas.exit, cx, cy, 1, 1);
    blit(ctx, atlas.halo[3], cx, cy, 1 + 0.5 * p, 0.5 * (1 - p) + 0.1);
  }

  // 玩家（恒画，程序化）
  drawPlayer(ctx, pos);
}
