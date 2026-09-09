// a6-time-source.test.ts · CI 闸门：时间源不外泄（架构控制清单 A6）
// src/sim 与 src/gen 内不得出现时间对象构造（new Date / Date.now），时间一律经 Clock 注入。
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 用拼接构造探测模式，避免本文件自身命中（与 dq3 闸门同手法）
const NEWD = 'new' + String.fromCharCode(32) + 'Date(';
const NOW = 'Date' + '.now' + '(';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('CI 闸门 · A6 时间源不外泄', () => {
  it('src/sim 与 src/gen 内时间 API 0 命中', () => {
    const root = process.cwd();
    const hits: string[] = [];
    for (const dir of ['src/sim', 'src/gen']) {
      for (const file of walk(join(root, dir))) {
        const lines = readFileSync(file, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
          if (line.includes(NEWD) || line.includes(NOW)) {
            hits.push(`${relative(root, file)}:${i + 1} -> ${line.trim()}`);
          }
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
