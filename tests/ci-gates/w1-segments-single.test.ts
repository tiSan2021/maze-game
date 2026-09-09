// W1 · 段切分单点实现：splitSegments / countBacktrackSegments 全仓各仅 1 处函数体（GDD② §4 / ADR-04）
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
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

function countFn(src: string, fn: string): number {
  // 仅统计"函数声明"本体（function name 或 const name = ... 或 name( 定义），粗略用 `function ${fn}` + 箭头赋值
  const rx = new RegExp('function\\s+' + fn + '\\b|const\\s+' + fn + '\\s*=');
  return (src.match(rx) || []).length;
}

describe('CI 闸门 · W1 段切分单点', () => {
  const files = walk(join(ROOT, 'src'));
  const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  it('splitSegments 全仓仅 1 处函数体', () => {
    expect(countFn(all, 'splitSegments')).toBe(1);
  });
  it('countBacktrackSegments 全仓仅 1 处函数体', () => {
    expect(countFn(all, 'countBacktrackSegments')).toBe(1);
  });
});
