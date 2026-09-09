// tests/ci-gates/dq3-no-math-random.test.ts
// DQ3（控制清单 A 组 [AUTO]）：全仓禁用语言内建随机函数；
// 唯一随机来源 = core/rng.ts（mulberry32 + fnv1a32）。
// 本测试在 src/ 尚不存在时即应绿灯（扫描结果为空 = 0 命中），随业务代码增长持续守护确定性底线。
//
// 关键：自指陷阱（ADR-01 §3.7）——本文件及任何注释/告警文案中不得写出
// 内建随机函数的字面量，否则自检会命中自己。故用字符串拼接构造探测模式，
// 正则与报错信息均不出现连续字面量（代称记作 M·random）。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// 拼接构造内建随机函数的探测模式，源文件中不出现该连续字面量（避免自检自命中）
const PROBE = 'Math' + '.' + 'random';
const PATTERN = new RegExp('\\b' + PROBE + '\\b');

const ROOT = join(__dirname, '..', '..'); // 仓库根
const SCAN_DIRS = ['src', 'tests'].map((d) => join(ROOT, d));
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // src/ 不存在时安全返回空
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.has(name.slice(name.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

describe('DQ3 · 全仓禁用内建随机函数', () => {
  it('src/ 与 tests/ 中内建随机函数命中数必须为 0', () => {
    const hits: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        const src = readFileSync(file, 'utf8');
        if (PATTERN.test(src)) hits.push(file);
      }
    }
    expect(hits, `DQ3 违规：发现内建随机函数 @ ${hits.join(', ')}`).toHaveLength(0);
  });
});
