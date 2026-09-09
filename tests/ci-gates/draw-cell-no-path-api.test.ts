// E0-1④ · draw-cell 内 fill(/stroke(/strokeText(/createRadialGradient( 0 命中（单格仅 drawImage）
// 单格绘制只允许 drawImage（tile 预渲染前置的自动化守卫，控制清单 F 组）。
// 本期 render 未实现：draw-cell.ts 缺失时 0 命中 → 绿；实现后违反则失败。
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(__dirname, '..', '..', 'src', 'render', 'draw-cell.ts');
const FORBIDDEN = [/\bfill\(/, /\bstroke\(/, /\bstrokeText\(/, /\bcreateRadialGradient\(/];

describe('CI 闸门 · draw-cell 单格仅 drawImage（无路径 API）', () => {
  it('render/draw-cell.ts 内 fill/stroke/strokeText/createRadialGradient 0 命中', () => {
    if (!existsSync(FILE)) {
      // 本期未实现 render：守卫在文件存在后才生效，缺失即绿
      expect(true).toBe(true);
      return;
    }
    const src = readFileSync(FILE, 'utf8');
    const hits = FORBIDDEN.filter((re) => re.test(src));
    expect(hits, 'draw-cell 出现路径 API，应仅 drawImage').toHaveLength(0);
  });
});
