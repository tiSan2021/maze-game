# 测试脚手架 · 最小说明（Deliverable 2 / P4-ENG）

> 配套 `production/epics/epic-split.md`。本目录是 Phase 4 预制作阶段的**测试最小脚手架**：框架选型、目录结构、1 个示例测试、以及把控制清单可自动化项映射为 CI 强制闸门。
> **范围**：仅脚手架与示例测试，**不含 src/ 业务实现代码**。

---

## 1. 测试框架选型：vitest

**选型**：[vitest](https://vitest.dev/)（Vite 官方测试运行器）。

**理由**（贴合本项目约束）：

1. **原生 TypeScript + 零 babel 转译**：项目为纯 TS + Canvas 2D，vitest 直接跑 `.ts` 用例，无需额外编译链，与工程侧"无游戏框架、轻量"的技术基调一致。
2. **轻量、零配置起步**：`vitest.config.ts` 仅需几行；`expect` 风格 API、快照、watch 模式开箱即用，学习成本低。
3. **与构建期工具同源**：未来构建（Vite）与测试共用一个生态，避免两套转译配置漂移。
4. **Node 环境适配 CI 代理断言**：CI 闸门（DQ3 grep、脏格数、常量断言）多为纯逻辑/文件扫描，vitest 在 Node 环境即可运行，无需真实浏览器；纯渲染帧耗时等 `[SPIKE]` 项（E2 尖峰）走 DevTools/埋点，不在此框架内。
5. **可渐进**：`unit/` 纯函数单测先行（E1 域内核 TDD），`integration/` 在模块装配后补回路测试，`ci-gates/` 常驻控制清单强制项。

> 不选用 jest：配置更重、TS 需 babel/ts-jest 转译，对本项目无额外收益。

---

## 2. 目录结构

```
games/tests/
├── unit/            # 纯函数单测：core/rng, util/grid, sim/segments, sim/stars ...
│   └── *.test.ts
├── integration/     # 跨模块回路：滑行→段切分→星级；Q4 交叉断言；同源管线
│   └── *.test.ts
├── ci-gates/        # 控制清单可自动化项 → 强制闸门（见 §4）
│   ├── dq3-no-math-random.test.ts     # DQ3 示例（已落地）
│   ├── w4-no-source-branch.test.ts    # W4（E0-1 扩展）
│   └── perf-prereq-proxies.test.ts    # 性能三前置代理断言
└── README.md        # 本文件
```

> `src/` 业务文件按架构 §目录结构（`core/input/sim/gen/render/state/util`）在 Phase 5 落地；测试用例按其模块镜像放置于上述三层目录。

---

## 3. 示例测试：DQ3（全仓无内建随机函数）

`tests/ci-gates/dq3-no-math-random.test.ts` —— 验证控制清单 A 组 `[AUTO]` 硬性指标："全仓 `grep M·random` 必须 0 命中（DQ3）"。该测试在 `src/` 尚不存在时即应绿灯（扫描结果为空 = 0 命中），随业务代码增长持续守护确定性底线。

```ts
// tests/ci-gates/dq3-no-math-random.test.ts
// DQ3：全仓禁用语言内建随机函数；唯一随机来源 = core/rng.ts（mulberry32）
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// 拼接构造探测模式，源文件中不出现连续字面量（避免自检自命中，ADR-01 §3.7）
const PROBE = 'Math' + '.' + 'random';
const PATTERN = new RegExp('\\b' + PROBE + '\\b');

const ROOT = join(__dirname, '..', '..');           // 仓库根
const SCAN_DIRS = ['src', 'tests'].map(d => join(ROOT, d));
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }   // src/ 不存在时安全返回
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
```

> **自指陷阱提醒**（ADR-01 §3.7）：本测试与任何注释/告警文案中**不得写出内建随机函数的字面量**——否则自检自命中（本例初版曾在注释中误写该字面量，已被扫描命中）。故用字符串拼接构造 `PROBE`、正则与报错信息均不出现连续字面量；若需文档化，依控制清单约定用 `M·random` 代称。

**第二条示例（引用 GDD②，段切分单一实现 W1）**——落地于 E1-5，以 grep 守护全仓仅一处 `splitSegments` 函数体：

```ts
// 伪代码（E1-5 落地时启用；当前 src/ 不存在，先作脚手架说明）
// grep 全仓 "function splitSegments" / "function countBacktrackSegments" 必须各仅 1 行
// 且 sim/stars.ts 与 gen/gates.ts 仅 import 调用，不得重定义（W1 / ADR-04）
```

---

## 4. 控制清单 → CI 强制闸门映射

控制清单中带 `[AUTO]` 的项必须映射为 CI 强制闸门；`[SPIKE]` 项（仅 E2 绘制 <8ms）无法在 CI 判定，由尖峰实测覆盖（见 epic-split.md §2）。

| 控制清单项 | 标记 | CI 实现位置 | 失败行为 |
|---|---|---|---|
| **DQ3** 禁内建随机函数（M·random） | `[AUTO]` | `tests/ci-gates/dq3-no-math-random.test.ts` + 构建期 `grep -rE "Math\.random" src/ tests/` | 构建失败 |
| **W4** 无来源分支 | `[AUTO]` | `tests/ci-gates/w4-no-source-branch.test.ts` + 构建期 `grep -rE "isGenerated\|\.source\b\|source ==" src/` | 构建失败 |
| **性能三前置·①** `lastDirtyCount<=40` | `[AUTO]` 代理 | `tests/ci-gates/perf-prereq-proxies.test.ts`（E2 单测采集 `renderStats.lastDirtyCount`） | 失败（全量重绘=169 即拦截） |
| **性能三前置·②** `VISION_R===2`（上限 3）且无 R=4/5 分支 | `[AUTO]` 代理 | `tests/ci-gates/perf-prereq-proxies.test.ts`（常量断言） | 失败 |
| **性能三前置·③** `tileAtlasReady` 早于首帧 | `[AUTO]` 代理 | `tests/ci-gates/perf-prereq-proxies.test.ts`（启动期预渲染守卫） | 失败 |
| **性能三前置·④** `draw-cell.ts` 无路径 API | `[AUTO]` 代理 | 构建期 `grep -rE "fill\(|stroke\(|strokeText\(|createRadialGradient\(" src/render/draw-cell.ts` | 失败 |
| **W1** 段切分单点 | `[AUTO]` | 构建期 `grep "function splitSegments"/"function countBacktrackSegments"` 各仅 1 处 | 构建失败 |
| **Q4** 星级=G3 交叉断言 | `[AUTO]` | `tests/integration/star-gate-cross.test.ts`（同 `Level.expectedSolution` 喂 `settle()` 必 3★） | 失败 |
| **禁 `shadowBlur`** | `[AUTO]` | 构建期 `grep -rE "shadowBlur" src/` | 构建失败 |
| **G4 确定性报错** | `[AUTO]` | `tools/qa-gates.ts` / `qa:daily`（同 seed 两次 `canonicalJSON` 不等即报错） | 构建失败 |

**CI 编排原则**（对应 `phase4-brief.md` 成员 C / E0-1）：

1. **约束检查脚本先于业务代码**：E0-1 四条代理断言（DQ3 / `VISION_R===2`（上限 3） / tile 图集早于首帧 / `draw-cell` 无路径 API）在 `src/` 出现前即可运行，作为**流水线第一道闸门**。
2. **任一带 `[AUTO]` 项未通过 → 禁止进入发布**（控制清单 J 组）。三条最硬底线：DQ3 / W4 / 性能三前置。
3. `[SPIKE]` 仅 E2 尖峰一项，CI 只守其四条代理断言，不能替代真机实测。

---

*文档结束 · v1.0 · 作者：程基岩（engineering-lead）· 对应 `production/epics/epic-split.md` Deliverable 2*
