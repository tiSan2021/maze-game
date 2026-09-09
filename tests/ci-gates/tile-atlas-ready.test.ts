// E0-1③ / 控制清单 F 组 ③ · tileAtlasReady 早于首帧（改为真断言）
// 真实装配 RenderPipeline：init() 必须在任何 renderFrame 之前把 tileAtlasReady 置为 true。
// 同时守护反模式：源代码中不得出现 "tileAtlasReady = false"（首帧后才置 false）。
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RenderPipeline } from '../../src/render/pipeline';
import { createFakeCanvasFactory } from '../helpers/fake-canvas';
import { makeLevel } from '../helpers/build-level';

const ROOT = join(__dirname, '..', '..');
const PROBE = 'tileAtlasReady = false';

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('CI 闸门 · tileAtlasReady 早于首帧（真断言）', () => {
  it('init() 后 renderStats.tileAtlasReady === true（首帧前已就绪）', () => {
    const factory = createFakeCanvasFactory();
    for (const visionMode of ['full', 'fog'] as const) {
      const level = makeLevel({ gridSize: 13, visionMode });
      const main = factory(520, 520).getContext('2d');
      const pipe = new RenderPipeline(main, level, factory);
      // 首帧前：仍为 false
      expect(pipe.stats.tileAtlasReady).toBe(false);
      pipe.init();
      // init 后即就绪（早于 renderFrame）
      expect(pipe.stats.tileAtlasReady).toBe(true);
      // 模拟首帧
      pipe.renderFrame({ heldKeys: new Set(), openedDoors: new Set(), visible: new Set(), motionScale: 1, timeMs: 0 });
      expect(pipe.stats.tileAtlasReady).toBe(true);
    }
  });

  it('src 中不得出现 "tileAtlasReady = false" 反模式', () => {
    const hits: string[] = [];
    for (const f of walk(join(ROOT, 'src'))) {
      if (readFileSync(f, 'utf8').includes(PROBE)) hits.push(f);
    }
    expect(hits, `tileAtlasReady 反模式 @ ${hits.join(', ')}`).toHaveLength(0);
  });
});
