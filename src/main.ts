// main.ts · E3 应用壳启动装配（E3-2 / 架构 §3.2）
// 启动：预渲染 tile 图集（RenderPipeline.init）→ 绑定键盘 → requestAnimationFrame 主循环。
// 每帧回路：读输入 → planSlide/applySlide（经 AppMachine.move）→ computeVisibility → pipeline.renderFrame → 更新 HUD。
// 仅桌面浏览器，纯键盘；无框架。不修改域内核 / 渲染层逻辑，仅装配。

import { CANVAS_W, CANVAS_H, boardOrigin } from './core/constants/metrics';
import type { Ctx2D } from './render/canvas';
import { domCanvasFactory } from './render/canvas';
import { RenderPipeline } from './render/pipeline';
import { renderHudHtml, mountHud } from './render/hud';
import { computeVisibility } from './sim/visibility';
import type { EntityView } from './render/sprites';
import { key } from './util/grid';
import { KeyboardInput, dirOfKey } from './input/keyboard';
import { type StorageLike, MAIN_LEVEL_COUNT } from './sim/progress';
import { renderSettlementHtml } from './ui/settlement';
import { AppMachine, formatLevelLabel } from './state/app';
import { loadSettings, saveSettings, nextMotionScale, motionLabel } from './state/settings';
import { SfxEngine } from './audio/sfx';

// ── DOM 装配 ──
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const overlayEl = document.getElementById('overlay') as HTMLElement;

const dpr = Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio || 1)));
canvas.width = CANVAS_W * dpr;
canvas.height = CANVAS_H * dpr;
canvas.style.width = `${CANVAS_W}px`;
canvas.style.height = `${CANVAS_H}px`;
const rawCtx = canvas.getContext('2d') as Ctx2D;
rawCtx.scale(dpr, dpr); // 后续绘制均以逻辑像素为单位
const main: Ctx2D = rawCtx;

// 离屏画布工厂：逻辑像素（dpr=1）；主画布已自行按 dpr 缩放
const offscreen = domCanvasFactory(1);

// ── 存档介质探测：localStorage 不可用（隐私模式 / 配额）→ 退化为内存态（D-5） ──
function detectStorage(): StorageLike | null {
  try {
    const k = '__maze_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage as unknown as StorageLike;
  } catch {
    return null;
  }
}

const storage = detectStorage();
const app = new AppMachine({ storage });
// 可访问性设置（E6-3）：迷雾关闭 / 减少动效，持久化同存档介质
let settings = loadSettings(storage);
/** 设置面板是否显示（MENU / PAUSED 内可开，Esc 关闭） */
let showSettings = false;
// 音效引擎（Phase 6 后续功能）：合成短音 + 静音开关，持久化同存档介质
const sfx = new SfxEngine({ storage });
let pipe: RenderPipeline | null = null;

// 载入关卡时（重）建渲染管线（三前置①：tileAtlasReady 在首帧前就绪）
function loadPipeline(): void {
  if (!app.level) return;
  pipe = new RenderPipeline(main, app.level, offscreen, {
    origin: boardOrigin(app.level.gridSize),
    fogOff: settings.fogOff, // F5：关闭迷雾 → 复用 BAKED 路径，不改 visible/visited/星级
  });
  pipe.init();
  pipe.moveTo(app.level.start, new Set([key(app.level.start)]));
}

// ── 输入装配（E6-2）：方向键/WASD 连走节奏由 KeyboardInput 自管 ──
const input = new KeyboardInput({ now: () => performance.now() });
let pendingAction: 'undo' | 'restart' | null = null;

function onKey(e: KeyboardEvent): void {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return; // 禁用 OS 长按自动重复（M2 前置；E6 接管连走节奏）
  sfx.unlock(); // 首个用户手势内创建/恢复 AudioContext（浏览器策略要求）

  // 设置面板优先拦截（仅在 MENU / PAUSED 可开；见下方 S 触发）：F 切迷雾、M 切动效、X 切静音、Esc 关闭
  if (showSettings) {
    if (k === 'f' || k === 'F') {
      settings.fogOff = !settings.fogOff;
      saveSettings(storage, settings); // 失败则退化为内存态（下次启动回落默认）
      loadPipeline(); // 重建管线以套用 fogOff（复用 BAKED 路径，不改 visible/visited/星级）
    } else if (k === 'm' || k === 'M') {
      settings.motionScale = nextMotionScale(settings.motionScale);
      saveSettings(storage, settings);
    } else if (k === 'x' || k === 'X') {
      sfx.toggleMute(); // 静音偏好由 SfxEngine 自行持久化
    } else if (k === 'Escape') {
      showSettings = false;
    }
    e.preventDefault();
    return;
  }

  switch (app.state) {
    case 'MENU':
      if (k === 'Enter') app.goToLevelSelect();
      else if (k === 's' || k === 'S') showSettings = true;
      break;
    case 'LEVEL_SELECT':
      if (k === 'Enter') {
        if (app.enterMainLevel(mainSel)) loadPipeline();
      } else if (k === 'ArrowLeft') {
        clampSel();
        mainSel = Math.max(1, mainSel - 1);
      } else if (k === 'ArrowRight') {
        clampSel();
        mainSel = Math.min(highestUnlockedMain(), mainSel + 1);
      } else if (k === '1' || k === '2') {
        if (app.enterDaily(k === '1' ? 'mid' : 'high')) loadPipeline();
      } else if (k === 'Escape') app.goToMenu();
      break;
    case 'PLAYING': {
      const dir = dirOfKey(k);
      if (dir) {
        input.pressDir(dir, e.repeat); // OS auto-repeat 由模块内部丢弃
      } else if (k === 'z' || k === 'Z') pendingAction = 'undo';
      else if (k === 'r' || k === 'R') pendingAction = 'restart';
      else if (k === 'Escape') app.pause();
      break;
    }
    case 'PAUSED':
      if (k === 'Escape' || k === 'Enter') app.resume();
      else if (k === 'r' || k === 'R') app.restart();
      else if (k === 'q' || k === 'Q') app.goToLevelSelect();
      else if (k === 's' || k === 'S') showSettings = true;
      break;
    case 'SETTLEMENT':
      if (k === 'Enter') app.replay();
      else if (k === 'n' || k === 'N') {
        const nl = app.nextMainLevel();
        if (nl) {
          app.nextLevel(nl);
          loadPipeline();
        }
      } else if (k === 'q' || k === 'Q') app.settleToSelect();
      // 注意：结算态不响应 Esc（UX §3.2）
      break;
  }
}
window.addEventListener('keydown', onKey);
// 松开方向键 → 出栈（多键以最近按下为准）
window.addEventListener('keyup', (e: KeyboardEvent) => {
  const dir = dirOfKey(e.key);
  if (dir) input.releaseDir(dir);
});
// 窗口失焦清空输入栈（UX §3.1）：避免恢复焦点后按残留方向键误触发
window.addEventListener('blur', () => {
  input.blur();
  pendingAction = null;
});

// ── HUD 构建 / 增量更新（仅内容变化才重写 DOM，避免 aria-live 抖动） ──
// buildHudModel 已由 AppMachine 提供（src/state/app.ts）：每次状态变化后实时派生
// undoSegments / starPreview / doorStatus 真实值，main.ts 仅负责渲染与增量更新。
let lastHudHtml = '';

function updateHud(): void {
  const model = app.buildHudModel();
  if (!model) {
    if (lastHudHtml !== '') {
      hudEl.innerHTML = '';
      lastHudHtml = '';
    }
    return;
  }
  const html = renderHudHtml(model);
  if (html !== lastHudHtml) {
    mountHud(hudEl, model);
    lastHudHtml = html;
  }
}

// ── 覆盖层（顶层状态） ──
function showOverlay(html: string): void {
  overlayEl.innerHTML = html;
  overlayEl.style.display = 'flex';
}
function hideOverlay(): void {
  overlayEl.style.display = 'none';
}

function menuHtml(): string {
  const daily = app.canShowDaily() ? '（每日分区已解锁）' : '';
  return `<h1>迷宫闯关</h1><div>迷宫闯关 · v0.5.0${daily}</div><div class="hint">按 <kbd>Enter</kbd> 开始 · <kbd>S</kbd> 设置</div>`;
}
// 可访问性设置面板（E6-3）：只暴露「关闭即不丢信息」的开关，覆盖于 MENU / PAUSED 之上。
// 设计底线：F5 迷雾关→复用 BAKED 路径（不改 visible/visited/星级）；M2 动效关→装饰动效消失但信息仍可见。
// 不可关的（图案填充 V2 / 钥匙双编码 V3 / 对比度 V5-V6 / 墙邻感知 F3）不在此提供开关（levels.md 降级底线）。
function settingsHtml(): string {
  const motion = motionLabel(settings.motionScale);
  const fog = settings.fogOff ? '已关闭' : '开启中';
  const sound = sfx.isMuted ? '静音' : '开启';
  return `<h1>可访问性设置</h1>
    <div style="line-height:1.9;text-align:left;max-width:440px;margin:8px auto">
      <div>减少动效（M2）：<kbd>M</kbd> 切换 · 当前 <b>${motion}</b></div>
      <div>迷雾（F5）：<kbd>F</kbd> 切换 · 当前 <b>${fog}</b></div>
      <div>音效：<kbd>X</kbd> 切换 · 当前 <b>${sound}</b></div>
    </div>
    <div class="hint">两项关闭后信息仍完整可见（图案填充 / 钥匙双编码 / 对比度不依赖它们）。<kbd>Esc</kbd> 返回</div>`;
}
function levelLabel(): string {
  return formatLevelLabel(app.level?.id ?? '');
}

// ── 选关态：当前选中的主线关号（1-based，键盘 ←/→ 移动） ──
let mainSel = 1;

function highestUnlockedMain(): number {
  let n = 1;
  while (n < MAIN_LEVEL_COUNT && app.isMainUnlocked(n + 1)) n++;
  return n;
}

function clampSel(): void {
  const max = highestUnlockedMain();
  if (mainSel < 1) mainSel = 1;
  if (mainSel > max) mainSel = max;
}

function selectHtml(): string {
  clampSel();
  const chips: string[] = [];
  for (let n = 1; n <= MAIN_LEVEL_COUNT; n++) {
    const unlocked = app.isMainUnlocked(n);
    const star = app.bestStarOf(`main-${n}`);
    const mark = !unlocked ? '未解锁' : star > 0 ? '★'.repeat(star) + '☆'.repeat(3 - star) : '未通关';
    const cur = n === mainSel ? 'outline:2px solid #8a7a55;font-weight:600;' : '';
    const dim = unlocked ? '' : 'color:#a39880;';
    chips.push(
      `<span style="display:inline-block;min-width:74px;margin:3px;padding:4px 6px;border:1px solid #c9bfa9;border-radius:6px;${cur}${dim}">${n}. ${mark}</span>`,
    );
  }

  const d = app.daily;
  // GATE_DAILY：未解锁时「每日」分区完全不出现（不显示、不灰显、不预告，GDD⑥ D-1）
  const dailyBlock =
    d && d.unlocked && d.levels
      ? `<div style="margin-top:12px">每日 · 中（按 <kbd>1</kbd>） · 每日 · 高（按 <kbd>2</kbd>）</div>
         <div class="hint">${d.todayKey} · UTC 全球同题</div>`
      : '';

  return `<h1>关卡选择</h1><div style="max-width:600px;line-height:1.2">${chips.join('')}</div>${dailyBlock}<div class="hint"><kbd>←</kbd><kbd>→</kbd> 选关 · <kbd>Enter</kbd> 进入 · <kbd>Esc</kbd> 返回主菜单</div>`;
}
function pauseHtml(): string {
  return `<h1>已暂停</h1><div class="hint"><kbd>Esc</kbd>/<kbd>Enter</kbd> 继续 · <kbd>R</kbd> 重开 · <kbd>Q</kbd> 返回选关</div>`;
}
function settleHtml(): string {
  const r = app.result;
  if (!r) return '';
  return renderSettlementHtml({
    star: r.star,
    segmentCount: r.segmentCount,
    backtrackSegments: r.backtrackSegments,
    steps: r.steps,
    elapsedMs: r.elapsedMs,
    hasNext: app.hasNextLevel(),
    bestStar: app.settlementPrevBest,
    isNewBest: app.settlementImproved,
    label: levelLabel(),
  });
}

// ── 实体视图（精灵呼吸 / 可见集） ──
function buildEntityView(): EntityView {
  const run = app.run!;
  return {
    heldKeys: run.keysHeld,
    openedDoors: run.doorsOpened,
    visible: computeVisibility(app.level!, run.pos, run.visited),
    motionScale: settings.motionScale, // AC-4：0 时装饰动效消失，信息仍可见
    timeMs: run.elapsedMs,
  };
}

// ── 主循环 ──
let last = performance.now();

function frame(now: number): void {
  const dt = now - last;
  last = now;

  if (app.state === 'PLAYING' && app.run) {
    app.run.elapsedMs += dt; // 真实计时；撤销/重开不返还（D11）
    // 连走节奏由 KeyboardInput 自管：220/110ms，且须等上一次滑行结束（E6-2 / UX §3.1）
    input.update((dir) => {
      const outcome = app.move(dir);
      if (outcome.kind === 'blocked') {
        sfx.play('invalid'); // 撞墙：轻提示音
      } else if (outcome.kind === 'moved') {
        sfx.play('move');
        if (outcome.pickedKey) sfx.play('pickup');
        if (outcome.openedDoor) sfx.play('door');
        if (outcome.won) sfx.play('win');
      }
      app.autoRecoverIfStuck(); // 死局且无可撤销 → 自动重开
      input.notifySlideDone(); // applySlide 同步完成；接入滑行动画后改由动画结束回调
    });
  }
  if (pendingAction === 'undo') {
    app.undo();
    pendingAction = null;
  } else if (pendingAction === 'restart') {
    app.restart();
    pendingAction = null;
  }

  updateHud();

  // 设置面板覆盖层优先（MENU / PAUSED 之上）；其下状态照常渲染（PAUSED 仍渲染迷宫做背景）
  if (showSettings) {
    showOverlay(settingsHtml());
    requestAnimationFrame(frame);
    return;
  }

  // 覆盖层（非游玩态显示菜单/选关/暂停/结算）
  if (app.state === 'MENU') {
    rawCtx.clearRect(0, 0, CANVAS_W, CANVAS_H); // 清空迷宫区，避免残留上一关
    showOverlay(menuHtml());
    requestAnimationFrame(frame);
    return;
  }
  if (app.state === 'LEVEL_SELECT') {
    showOverlay(selectHtml());
    requestAnimationFrame(frame);
    return;
  }

  // PLAYING / PAUSED / SETTLEMENT：需要 level + run + pipe
  if (!app.level || !app.run || !pipe) {
    requestAnimationFrame(frame);
    return;
  }
  pipe.moveTo(app.run.pos, app.run.visited);
  pipe.renderFrame(buildEntityView());

  if (app.state === 'PAUSED') showOverlay(pauseHtml());
  else if (app.state === 'SETTLEMENT') showOverlay(settleHtml());
  else hideOverlay();

  requestAnimationFrame(frame);
}

// 启动于 MENU
showOverlay(menuHtml());
requestAnimationFrame(frame);

// 便于调试 / E6 接管：暴露实例
(window as unknown as { __app?: AppMachine }).__app = app;
