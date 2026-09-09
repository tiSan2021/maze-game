// 控制清单 G 组 / W6 · draw-cell 必须复用 sim/visibility.cellRenderState，不得重复实现
// 单点函数（A2/V6）：全仓仅 visibility.ts 一处定义，渲染层只消费不重定义。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(__dirname, '..', '..', 'src', 'render', 'draw-cell.ts');
const src = readFileSync(FILE, 'utf8');

describe('CI 闸门 · draw-cell 复用 cellRenderState（不重定义）', () => {
  it('draw-cell.ts 从 sim/visibility 导入 cellRenderState', () => {
    expect(src).toMatch(/import\s*\{[^}]*cellRenderState[^}]*\}\s*from\s*['"]\.\.\/sim\/visibility['"]/);
  });

  it('draw-cell.ts 不得重新定义 cellRenderState 函数（W6 单点）', () => {
    expect(src).not.toMatch(/function\s+cellRenderState/);
    expect(src).not.toMatch(/const\s+cellRenderState\s*=/);
    expect(src).not.toMatch(/=>\s*\{[\s\S]*cellRenderState/);
  });

  it('draw-cell.ts 仅用 drawImage 消费渲染态（无可见集合改动）', () => {
    // 单格绘制只负责画，不应触碰 visible/visited/path/steps
    expect(src).not.toMatch(/\.visible\s*[=.]|\.visited\s*[=.]|\.path\s*[=.]|\.steps\s*[=.]/);
  });
});
