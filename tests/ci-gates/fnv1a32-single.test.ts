// A2 · fnv1a32 实现唯一：grep "0x811c9dc5" 全仓仅 1 处（ADR-01 §3 / 控制清单 A 组）
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

describe('CI 闸门 · fnv1a32 唯一实现', () => {
  it('"0x811c9dc5" 在 src 中仅 1 处命中', () => {
    let hits = 0;
    for (const f of walk(join(ROOT, 'src'))) {
      if (readFileSync(f, 'utf8').includes('0x811c9dc5')) hits++;
    }
    expect(hits).toBe(1);
  });
});
