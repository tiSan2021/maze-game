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
import { mountTouchControls } from './input/touch';
import { type StorageLike, MAIN_LEVEL_COUNT, bestOf, mainLevelId } from './sim/progress';
import { renderSettlementHtml } from './ui/settlement';
import { moveSelection, MAIN_SEL_COLS } from './ui/level-grid';
import { formatBestLine } from './ui/level-best';
import { AppMachine, formatLevelLabel } from './state/app';
import { loadSettings, saveSettings, nextMotionScale, motionLabel, nextUiScale, uiScaleLabel } from './state/settings';
import { SfxEngine } from './audio/sfx';
import { APP_NAME, VERSION_LABEL } from './version';

// ── DOM 装配 ──
const canvas = document.getElementById('game') as HTMLCanvasElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const overlayEl = document.getElementById('overlay') as HTMLElement;
const appEl = document.getElementById('app') as HTMLElement;

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

/** 把字号档位写入 CSS 变量（U5）：作用于 overlay / HUD / 结算面板的 DOM 文本 */
function applyUiScale(): void {
  document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
}
applyUiScale(); // 启动即套用持久化档位
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

// ── 移动端适配（阶段 A+B）──
// A：画布逻辑尺寸固定 960×640，靠 CSS transform 整体缩放适配视口（逻辑坐标不动，内核零改动）。
//    672 = 640 画布 + 32 顶部 HUD；不放大超过 1（避免模糊）。
function fitToViewport(): void {
  const s = Math.min(1, window.innerWidth / 960, window.innerHeight / 672);
  appEl.style.transform = `translate(-50%, -50%) scale(${s})`;
}
window.addEventListener('resize', fitToViewport);
fitToViewport();
// B：触屏输入（仅触屏设备挂载；桌面返回空清理，纯键盘体验不变）
const touchCtl = mountTouchControls({
  canvas,
  container: appEl,
  input,
  unlock: () => sfx.unlock(),
  onPause: () => app.pause(),
});
let pendingAction: 'undo' | 'restart' | null = null;

function onKey(e: KeyboardEvent): void {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return; // 禁用 OS 长按自动重复（M2 前置；E6 接管连走节奏）
  // 覆盖层按钮已聚焦时（触屏点过后），按 Enter/Space 改由按钮自身 click 接管，避免与全局键盘双重触发
  const activeEl = document.activeElement as HTMLElement | null;
  if (activeEl && activeEl.tagName === 'BUTTON' && overlayEl.contains(activeEl)) return;
  sfx.unlock(); // 首个用户手势内创建/恢复 AudioContext（浏览器策略要求）

  // 设置面板优先拦截（仅在 MENU / PAUSED 可开；见下方 S 触发）：F 切迷雾、M 切动效、T 切字号、X 切静音、Esc 关闭
  if (showSettings) {
    if (k === 'f' || k === 'F') {
      settings.fogOff = !settings.fogOff;
      saveSettings(storage, settings); // 失败则退化为内存态（下次启动回落默认）
      loadPipeline(); // 重建管线以套用 fogOff（复用 BAKED 路径，不改 visible/visited/星级）
    } else if (k === 'm' || k === 'M') {
      settings.motionScale = nextMotionScale(settings.motionScale);
      saveSettings(storage, settings);
    } else if (k === 't' || k === 'T') {
      settings.uiScale = nextUiScale(settings.uiScale);
      saveSettings(storage, settings);
      applyUiScale();
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
        mainSel = moveSelection(mainSel, 'left', highestUnlockedMain());
      } else if (k === 'ArrowRight') {
        mainSel = moveSelection(mainSel, 'right', highestUnlockedMain());
      } else if (k === 'ArrowUp') {
        mainSel = moveSelection(mainSel, 'up', highestUnlockedMain());
      } else if (k === 'ArrowDown') {
        mainSel = moveSelection(mainSel, 'down', highestUnlockedMain());
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
// 移动端（阶段 D）：页面切后台 / 锁屏 / 切应用时自动暂停，避免计时与移动在后台继续
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.state === 'PLAYING') app.pause();
});
// 移动端长按不弹系统右键菜单（阶段 D）
appEl.addEventListener('contextmenu', (e: Event) => e.preventDefault());

// ── 覆盖层事件委托（阶段 C）：把可点按钮的点击统一路由到与键盘一致的状态迁移 ──
function handleOverlayAction(action: string | undefined, ds: DOMStringMap): void {
  if (!action) return;
  sfx.unlock();
  switch (action) {
    case 'menu-start':
      app.goToLevelSelect();
      break;
    case 'menu-settings':
      showSettings = true;
      break;
    case 'lvl-select': {
      const n = Number(ds.n);
      if (n && app.enterMainLevel(n)) loadPipeline();
      break;
    }
    case 'lvl-daily': {
      const tier = ds.tier === 'high' ? 'high' : 'mid';
      if (app.enterDaily(tier)) loadPipeline();
      break;
    }
    case 'lvl-back':
      app.goToMenu();
      break;
    case 'set-resume':
      app.resume();
      break;
    case 'set-restart':
      app.restart();
      break;
    case 'set-menu':
      app.goToLevelSelect();
      break;
    case 'set-settings':
      showSettings = true;
      break;
    case 'settle-replay':
      app.replay();
      break;
    case 'settle-next': {
      const nl = app.nextMainLevel();
      if (nl) {
        app.nextLevel(nl);
        loadPipeline();
      }
      break;
    }
    case 'settle-select':
      app.settleToSelect();
      break;
    case 'settings-close':
      showSettings = false;
      break;
    case 'settings-f':
      settings.fogOff = !settings.fogOff;
      saveSettings(storage, settings);
      loadPipeline();
      break;
    case 'settings-m':
      settings.motionScale = nextMotionScale(settings.motionScale);
      saveSettings(storage, settings);
      break;
    case 'settings-t':
      settings.uiScale = nextUiScale(settings.uiScale);
      saveSettings(storage, settings);
      applyUiScale();
      break;
    case 'settings-x':
      sfx.toggleMute();
      break;
  }
}
overlayEl.addEventListener('click', (e: MouseEvent) => {
  const t = e.target as HTMLElement;
  const btn = t.closest('[data-action]') as HTMLElement | null;
  if (!btn) return;
  e.preventDefault();
  handleOverlayAction(btn.dataset.action, btn.dataset);
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

// 覆盖层按需重渲染：仅当「标识」变化时才重写 DOM。
// 既避免每帧重绘开销，也保证触屏点击的目标节点不被下一帧 innerHTML 替换而丢失 click。
let overlayKey = '';
const OVERLAY_HIDDEN = 'HIDDEN';
function syncOverlay(key: string, html: string): void {
  const realKey = html === '' ? OVERLAY_HIDDEN : key;
  if (realKey === overlayKey) return;
  if (html === '') hideOverlay();
  else showOverlay(html);
  overlayKey = realKey;
}

// 触屏控件（dpad + 暂停按钮）仅游玩态显示，避免菜单/选关/暂停/结算时误触
let lastTouchPlaying = false;
function syncTouchPlaying(): void {
  const playing = app.state === 'PLAYING';
  if (playing !== lastTouchPlaying) {
    touchCtl.setPlaying(playing);
    lastTouchPlaying = playing;
  }
}

function menuHtml(): string {
  const daily = app.canShowDaily() ? '（每日分区已解锁）' : '';
  return `<h1>${APP_NAME}</h1><div>${VERSION_LABEL}${daily}</div>
    <div class="hint">按 <kbd>Enter</kbd> 开始 · <kbd>S</kbd> 设置</div>
    <div style="margin-top:14px">
      <button type="button" class="ov-btn" data-action="menu-start">开始游戏</button>
      <button type="button" class="ov-btn alt" data-action="menu-settings">设置</button>
    </div>`;
}
// 可访问性设置面板（E6-3）：只暴露「关闭即不丢信息」的开关，覆盖于 MENU / PAUSED 之上。
// 设计底线：F5 迷雾关→复用 BAKED 路径（不改 visible/visited/星级）；M2 动效关→装饰动效消失但信息仍可见。
// 不可关的（图案填充 V2 / 钥匙双编码 V3 / 对比度 V5-V6 / 墙邻感知 F3）不在此提供开关（levels.md 降级底线）。
function settingsHtml(): string {
  const motion = motionLabel(settings.motionScale);
  const fog = settings.fogOff ? '已关闭' : '开启中';
  const sound = sfx.isMuted ? '静音' : '开启';
  const ui = uiScaleLabel(settings.uiScale);
  return `<h1>可访问性设置</h1>
    <div style="line-height:2.1;text-align:left;max-width:440px;margin:8px auto">
      <div>减少动效（M2）：<button type="button" class="ov-btn alt" data-action="settings-m">切换 · 当前 <b>${motion}</b></button></div>
      <div>迷雾（F5）：<button type="button" class="ov-btn alt" data-action="settings-f">切换 · 当前 <b>${fog}</b></button></div>
      <div>字号（U5）：<button type="button" class="ov-btn alt" data-action="settings-t">切换 · 当前 <b>${ui}</b></button></div>
      <div>音效：<button type="button" class="ov-btn alt" data-action="settings-x">切换 · 当前 <b>${sound}</b></button></div>
    </div>
    <div class="hint">两项关闭后信息仍完整可见（图案填充 / 钥匙双编码 / 对比度不依赖它们）。<kbd>Esc</kbd> 返回</div>
    <button type="button" class="ov-btn" data-action="settings-close" style="margin-top:12px">返回</button>`;
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
  const rows = Math.ceil(MAIN_LEVEL_COUNT / MAIN_SEL_COLS);
  const rowHtml: string[] = [];
  for (let r = 0; r < rows; r++) {
    const chips: string[] = [];
    for (let c = 0; c < MAIN_SEL_COLS; c++) {
      const n = r * MAIN_SEL_COLS + c + 1;
      if (n > MAIN_LEVEL_COUNT) continue; // 无残缺行（24=6×4 整除，正常不触发）
      const unlocked = app.isMainUnlocked(n);
      const star = app.bestStarOf(`main-${n}`);
      const mark = !unlocked ? '未解锁' : star > 0 ? '★'.repeat(star) + '☆'.repeat(3 - star) : '未通关';
      const cur = n === mainSel ? 'outline:2px solid #8a7a55;font-weight:600;' : '';
      const dim = unlocked ? '' : 'color:#a39880;';
      // 最佳成绩行（步数 / 用时）：仅已通关（有记录）时显示，方便刷分
      const bestLine = formatBestLine(bestOf(app.progress, mainLevelId(n)));
      const bestHtml = bestLine
        ? `<span style="display:block;font-size:calc(11px * var(--ui-scale));color:#6b6152;font-weight:400">${bestLine}</span>`
        : '';
      const action = unlocked ? ` data-action="lvl-select" data-n="${n}"` : '';
      chips.push(
        `<button type="button" class="lvl-chip"${action} style="min-width:74px;margin:3px;padding:4px 6px;border:1px solid #c9bfa9;border-radius:6px;background:#f4f1ea;${cur}${dim}">${n}. ${mark}${bestHtml}</button>`,
      );
    }
    rowHtml.push(`<div style="margin:2px 0">${chips.join('')}</div>`);
  }

  const d = app.daily;
  // GATE_DAILY：未解锁时「每日」分区完全不出现（不显示、不灰显、不预告，GDD⑥ D-1）
  const dailyBlock =
    d && d.unlocked && d.levels
      ? `<div style="margin-top:12px">
           <button type="button" class="ov-btn alt" data-action="lvl-daily" data-tier="mid">每日 · 中（按 1）</button>
           <button type="button" class="ov-btn alt" data-action="lvl-daily" data-tier="high">每日 · 高（按 2）</button>
         </div>
         <div class="hint">${d.todayKey} · UTC 全球同题</div>`
      : '';

  return `<h1>关卡选择</h1><div style="max-width:600px;line-height:1.35">${rowHtml.join('')}</div>${dailyBlock}<div class="hint"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> 选关 · <kbd>Enter</kbd> 进入 · <kbd>Esc</kbd> 返回主菜单（也可直接点选关卡）</div>`;
}
function pauseHtml(): string {
  return `<h1>已暂停</h1>
    <div class="hint"><kbd>Esc</kbd>/<kbd>Enter</kbd> 继续 · <kbd>R</kbd> 重开 · <kbd>Q</kbd> 返回选关</div>
    <div style="margin-top:14px">
      <button type="button" class="ov-btn" data-action="set-resume">继续</button>
      <button type="button" class="ov-btn alt" data-action="set-restart">重开</button>
      <button type="button" class="ov-btn alt" data-action="set-menu">返回选关</button>
      <button type="button" class="ov-btn alt" data-action="set-settings">设置</button>
    </div>`;
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
    syncOverlay(
      `SETTINGS:${settings.motionScale}:${settings.fogOff ? 1 : 0}:${settings.uiScale}:${sfx.isMuted ? 1 : 0}`,
      settingsHtml(),
    );
    syncTouchPlaying();
    requestAnimationFrame(frame);
    return;
  }

  // 覆盖层（非游玩态显示菜单/选关/暂停/结算）；syncOverlay 仅在标识变化时重绘
  switch (app.state) {
    case 'MENU':
      rawCtx.clearRect(0, 0, CANVAS_W, CANVAS_H); // 清空迷宫区，避免残留上一关
      syncOverlay('MENU', menuHtml());
      break;
    case 'LEVEL_SELECT':
      syncOverlay(`LV:${mainSel}`, selectHtml());
      break;
    case 'PLAYING':
    case 'PAUSED':
    case 'SETTLEMENT': {
      // 需要 level + run + pipe
      if (!app.level || !app.run || !pipe) {
        syncTouchPlaying();
        requestAnimationFrame(frame);
        return;
      }
      pipe.moveTo(app.run.pos, app.run.visited);
      pipe.renderFrame(buildEntityView());
      if (app.state === 'PAUSED') syncOverlay('PAUSED', pauseHtml());
      else if (app.state === 'SETTLEMENT') syncOverlay('SETTLEMENT', settleHtml());
      else syncOverlay('PLAY', ''); // 游玩中：隐藏覆盖层
      break;
    }
  }

  syncTouchPlaying();
  requestAnimationFrame(frame);
}

// 启动于 MENU
syncOverlay('MENU', menuHtml());
requestAnimationFrame(frame);

// 便于调试 / E6 接管：暴露实例
(window as unknown as { __app?: AppMachine }).__app = app;
