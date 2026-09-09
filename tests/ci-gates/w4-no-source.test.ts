// W4 · Level 无来源分支：grep isGenerated / .source / source == 在 src 0 命中（ADR-02 / 控制清单 B 组）
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

const PATTERNS = [/\bisGenerated\b/, /\.source\b/, /source\s*===/, /source\s*==\s*'generated'/];

describe('CI 闸门 · W4 无来源分支', () => {
  it('src 中不得出现 isGenerated / .source / source== 等来源分支字面量', () => {
    const hits: string[] = [];
    for (const f of walk(join(ROOT, 'src'))) {
      const src = readFileSync(f, 'utf8');
      if (PATTERNS.some((re) => re.test(src))) hits.push(f);
    }
    expect(hits, `W4 违规 @ ${hits.join(', ')}`).toHaveLength(0);
  });

  it('core/types.ts 的 Level 不含 source / isGenerated 字段', () => {
    const src = readFileSync(join(ROOT, 'src', 'core', 'types.ts'), 'utf8');
    const levelBlock = src.slice(src.indexOf('export interface Level'));
    expect(/\bisGenerated\b/.test(levelBlock)).toBe(false);
    expect(/\bsource\b/.test(levelBlock)).toBe(false);
  });
});
