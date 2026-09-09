# Phase 5 · Sprint 5（E5）交接简报：每日种子与结算

> 主理人：游承峰（编排）| 执行：engineering-lead（程基岩）| 评审强度：lean
> 本简报自包含，执行者无需回溯对话即可开工。
> 配套并行小任务见 **§附：HUD 真实值接线**。

---

## 0. 当前项目状态（主理人已独立验证）

| 项 | 状态 |
|---|---|
| `npm test` | **33 文件 / 140 用例全绿** |
| `npx tsc --noEmit` | **0 错误** |
| DQ3（`Math.random`） | `src/` 与 `tests/` 全仓 **0 命中** |
| 已完成 Epic | E0 常量/脚手架 · E1 域内核 · E2 渲染层 · E3 应用壳 · E4 生成器门禁（含 D9） |
| 可运行 | `npx vite` → `http://localhost:5173/` |

**既有关键模块（复用，勿重写）**：
`src/core/rng.ts`（`mulberry32`/`fnv1a32`/`getDateKeyUTC`/`deriveAttemptSeed`）· `src/gen/generator.ts` · `src/gen/gates.ts`（G1–G6）· `src/gen/interconnect.ts`（D9）· `src/state/app.ts`（S0–S4 + `GATE_DAILY`）· `src/render/hud.ts` · `src/sim/{segments,stars,runstate,visibility,deadends}.ts` · `src/input/{glide,undo}.ts`

---

## 1. 任务范围（E5 = 每日种子与结算，4 个 Story）

| Story | 标题 | 要点 |
|---|---|---|
| **E5-1** | 每日引导 | UTC 日期键 → 派生种子 → 生成**中档 + 高档各一条**；`visionMode` 恒 `'fog'` |
| **E5-2** | 进度持久化 | `localStorage` 存档：**版本化 schema**、每关最佳星级/最佳步数、`mainProgress.allMainCleared` |
| **E5-3** | 结算面板 | 星级 + 回溯段数 + 明细；按钮：重玩本关 / 下一关 / 返回选关 |
| **E5-4** | 跨午夜处理 | UTC 日期键切换时每日关的刷新与在途局面处理 |

---

## 2. 必读上游（先读再动手）

- `design/gdd/06-daily-seed.md` —— 每日**两条/天**（中 + 高各一）、**UTC** 日期、主线通关解锁、**同种子同图**
- `design/gdd/04-star-rating.md` —— 0 回溯段→3★ / ≤1→2★ / 否则 1★；**最佳值持久化**
- `design/gdd/02-level-data-primitives.md` —— `RunState` / `settle`
- `production/ux/ux-spec.md` —— **S4 SETTLEMENT** 字段、`GATE_DAILY`、HUD、输入映射
- `docs/architecture/control-checklist.md` —— **A6 时间源不外泄**（见下，硬闸门）、DQ3
- `docs/architecture/adr/adr-01` —— 确定性与版本绑定

---

## 3. 交付物与输出路径

| 文件 | 职责 |
|---|---|
| `src/gen/daily.ts` | 每日种子与选关：`getDateKeyUTC` + `deriveAttemptSeed` → 生成 mid/high 两关；同 (dateKey, tier, version) ⇒ 同关卡 |
| `src/sim/progress.ts` | `localStorage` 进度：**带 version 字段的 schema**；每关最佳星级/最佳步数；`mainProgress.allMainCleared`；脏数据/旧版本降级不崩溃 |
| `src/ui/settlement.ts` | 结算面板 DOM：星级 + 回溯段数 + 明细；重玩 / 下一关 / 返回选关 |
| `src/state/app.ts` | 接线：S1 每日分区真实生效、S4 结算、`GATE_DAILY` 按真实进度判定 |
| `tests/unit/daily-*.test.ts`、`tests/unit/progress-*.test.ts`、`tests/unit/settlement-*.test.ts` | 新增测试 |

---

## 4. 硬性约束（违反即返工）

1. **DQ3**：全仓禁止 `Math.random`；测试自身也不得写该字面量（用 `'Math'+'.'+'random'` 拼接构造探测，参照 `tests/ci-gates/dq3-no-math-random.test.ts`）。
2. **A6 时间源不外泄（CI 硬闸门）**：`src/sim/` 与 `src/gen/` 内 **`new Date(` / `Date.now(` 必须 0 命中**；时间一律经 **`Clock` 注入**。这条极易踩，务必先读 `control-checklist.md` 的 A 组。
3. **UTC 口径**：每日种子以 **UTC** 日期键为准，**不得**使用本地时区。
4. **每日两条**：中档 + 高档各一；**仅主线 12 关全部 ≥1★ 后解锁**，未解锁时该分区**不显示、不灰显、不预告**（`GATE_DAILY`）。
5. **确定性**：同 `(dateKey, tier, version)` ⇒ 同关卡（同种子同图，可分享）。
6. **复用既有原语**：`countBacktrackSegments` / `settle` / `computeVisibility` / `computeLockDepth` / `countDeadEndBranches` 一律复用，**不得重写**（W1 单一实现）。
7. **不得改动** `src/core`、`src/input`、`src/render`、`src/gen/{generator,gates,interconnect}.ts` 的既有逻辑；若确有阻塞的真实 bug，**修改并在回报中明确列出**（文件 + 原因）。
8. 保持既有 **140 用例全绿** + 新增测试；`npx tsc --noEmit` 保持 **0 错误**。

---

## 5. 验收要点（每条都要有测试）

- UTC 日期键正确（跨时区、跨午夜边界）。
- 每日两条且 tier 正确（mid / high），`visionMode='fog'`。
- 解锁门禁：未全清不显示每日分区；全清后显示。
- 进度持久化：写入→读回一致；含 version 字段；**旧版本/脏数据不崩溃**（降级或重置）。
- 结算：星级与回溯段数正确（与 `settle`/`countBacktrackSegments` 一致）；三个按钮行为正确。
- 跨午夜：日期键切换后每日关正确刷新（在途局面按 ux-spec 语义处理，明确写出你的处理口径）。
- A6 闸门：`src/sim`、`src/gen` 内时间 API 0 命中。

---

## 6. 诚实约束（务必遵守）

执行环境是 **Node，没有 DOM 也没有 localStorage**。
- `localStorage` 需在测试中**注入 fake storage** 来断言持久化行为。
- 结算面板用**渲染出的 HTML 字符串**断言，而非"看一眼"。
- **严禁**声称"已在浏览器验证每日/结算可用"。请明确写出：验证到哪一步、用户如何亲自运行（`npx vite` → `http://localhost:5173/`）。

---

# 附：并行小任务 —— HUD 真实值接线

> 与 E5 **文件集互不重叠**（本任务只动 `src/main.ts` / `src/state/app.ts`，E5 动 `src/gen/daily.ts` / `src/sim/progress.ts` / `src/ui/settlement.ts`），可安全并行。

**问题**：`src/render/hud.ts` 的三个可选字段 `undoSegments?`（回溯段数）、`starPreview?`（星级预览）、`doorStatus?`（门状态）**已能渲染且有单测**，但 `src/main.ts` / `src/state/app.ts` **未传入真实值**，游戏里实际显示默认值（`回溯 0`、`☆☆☆`、无门状态）。回溯段数直接关系核心支柱「零回头路 = 3★」，属必修项。

**要求**：在 HUD 更新处填入真实值——
1. `undoSegments` = **撤销快照栈深度**（ux-spec 定义）。
2. `starPreview` = 由当前路径推算的星级，**复用** `countBacktrackSegments` / `src/sim/stars.ts` 的既有映射（**不得重实现**，W1）。
3. `doorStatus` = `{ opened, total }`，`total` 取自 `level.doors.length`；**无锁（total=0）时传 `null`**（不得出现"门"字样）。

保持：顶部 32px DOM、`role="status"` + `aria-live="polite"`、**增量更新**（内容未变不重写 DOM）。

**测试**（断言真实值而非默认值）：(a) 一次滑行后栈深变化；(b) 拾钥开门后 `doorStatus` 显示 `opened/total`；(c) 走含回头路径后 `starPreview` 从 3★ 下降。

**约束**：DQ3；**不得修改** `src/render/hud.ts`（已定稿）与域内核业务

逻辑；**不得**触碰 `src/gen/**`；保持 140 用例全绿 + tsc 0 错误；不得声称浏览器已验证。
