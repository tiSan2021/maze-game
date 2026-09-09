# ADR-04 · 撤销栈与段切分共享原语的耦合边界

- **状态**：Accepted
- **主题**：撤销粒度 = 一次滑行（快照栈回滚 `path`/`steps`/`pos`/`keysHeld`/`doorsOpened`），**`visited` 单调递增不回滚**；`splitSegments` / `countBacktrackSegments` 为**全仓库唯一实现**，星级（GDD④）与门禁（GDD⑤ G3）只读调用。
- **作者**：程基岩 | **日期**：2026-09-07
- **关联**：GDD① §4.5（撤销语义表）、GDD② §4.1（共享原语规范）/ §3.2（RunState）/ §4.2（歧义裁决）；验收 W1/W2/W6/V5/C1。

---

## 上下文（Context）

两条"看似局部、实则全局"的语义，若各自实现会漂移：

1. **撤销的回滚边界**：D5 已接受"撤销可磨出三星"，但 D11 进一步裁定 `visited`（认知地图）**不随撤销回滚**——撤销擦掉的是"走的账"，保留的是"学到的知识"。若工程侧把 `visited` 也回滚，玩家撤销后会"忘记去过哪"，关 9+ 迷雾下尤其致命，且与 Q2 墙邻感知正向耦合（探索过的相邻墙永久可见，随 `visited` 单调增长）一同失效。GDD① §4.5 用表格 + 警告显式声明"这不是 bug"。历史教训：工程侧极易误实现成"撤销仍保留回头路记录"。

2. **段切分单一实现**：`splitSegments` / `countBacktrackSegments` 是 GDD④（运行时星算）与 GDD⑤（G3 门禁）的共同底座。Phase 1 已识别的头号一致性风险就是"两套实现漂移"——某关 QA 过了 G3，运行时却拿不到三星（或反之）。必须在**唯一出处**定义，禁止各写各的。C1 用例（`Start→A→B→C[钥匙]→B→A→D→E[出口]` = 0 回头路 = 3★）是跨 GDD 契约测试。

## 决策（Decision）

1. **撤销**：`input/undo.ts` 维护 `RunSnapshot[]`，每次成功滑行**前**压栈 `{pos, keysHeld, doorsOpened, pathLength, steps}`。Z 撤销时回滚上述字段；**`visited`（单调 Set）与 `elapsedMs` 不回滚**（D11）。撤销粒度 = 一次滑行（非单格、非整段回头）。
2. **段切分唯一实现**：`sim/segments.ts` 是 `splitSegments` / `countBacktrackSegments` 的唯一函数体（W1）；`sim/stars.ts`（运行时）与 `gen/gates.ts`（G3）**只读 import 调用**。全仓 grep `function splitSegments` / `function countBacktrackSegments` 必须各仅一处。
3. **G3 复用路径固定**：`gen/gates.ts` G3 = `replay(Level, expectedSolution)` → `splitSegments` → `countBacktrackSegments`，复杂度 O(path)，**不得实现为搜索零回头路解是否存在**（状态空间 ~2^169，SV1/Q3）。
4. **Q4 交叉断言**（防漂移总闸）：同一 `Level` 的 `expectedSolution` 喂进 `sim/stars.settle()` 必须得 3★；CI 中作为契约测试常驻。

## 后果（Consequences）

**正面**：
- 撤销语义防误解：`visited` 单调由类型与快照结构天然保证（快照不含 visited）。
- 漂移风险消除：星级与 G3 数字恒等，C1 用例一处断言即可守护两端。
- G3 不可退化为搜索：明确路径 + Q3 断言（500 步 < 1ms、无搜索调用）。

**负面 / 约束**：
- `RunState` 的 `visited` 与 `path` 回滚策略相反，须在 `sim/runstate.ts` 注释明确"有意设计"。单测 V5/W6 守护：走 5 步 + 撤销，`path.length` 减、`visited.size` 不减。
- 共享原语禁止复制，新增调用方必须走 import，CI 用 W1 grep 守住。

## 验收口径（Acceptance）

| # | 判据 | 方法 |
|---|---|---|
| W1 | 段切分单点定义 | 全仓 `splitSegments`/`countBacktrackSegments` 各仅一处函数体；④/⑤ 为调用方 |
| W2 | C1/C2/C3 用例通过 | 单测：C1=0 段→3★、C2=1 段、C3=1 段 |
| W3/Q3 | G3 复杂度 O(path) | 500 步路径判定 < 1ms；代码中无"零回头路解是否存在"的搜索/回溯 |
| V5/W6 | 撤销回滚边界正确 | 走 5 步后撤销：`path.length` 减、`visited.size` 不小于撤销前 |
| Q4 | 星级与 G3 一致 | 同 `Level` 的 `expectedSolution` 喂 `settle()` 必得 3★（CI 契约测试） |

**可自动化项**：CI grep `function splitSegments` / `function countBacktrackSegments` 各仅 1 处；grep `visited\s*=\s*snapshot` / `visited.delete` 等回滚写法须 0 命中；C1 用例单测常驻。
