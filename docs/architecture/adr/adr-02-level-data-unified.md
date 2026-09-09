# ADR-02 · 关卡数据模型手工/生成同源（无来源分支）

| 项 | 内容 |
|---|---|
| 状态 | **Accepted**（Phase 1 §6(4b) / D4 升级为 MVP 硬需求 / GDD② §2.1） |
| 决策人 | 程基岩（engineering-lead） |
| 上游 | Phase 1 §6(4b)、D4、GDD② §2.1/§3.1、GDD⑥ §5 |
| 影响面 | `core/types.ts`、`state/runstate.ts`、`render/*`、生成器 |

---

## 1. 结论（先行）

**单一 TS 类型 `Level` 同时描述手工关卡与程序化生成关卡。引擎的渲染、判定、状态管理逻辑中**

**不得出现 `isGenerated` / `source` / `fromGenerated` 之类的来源分支。** 生成关卡与手工关卡走**完全相同**的 `Level → RunState → renderer` 管线。

---

## 2. 背景与约束

- **4b（D4 升级）**：每日种子要求"同种子同图"，手工关卡量与生成关卡必须走完全相同的管线，故从"未来需求"升级为 MVP 硬需求。
- **GDD② §2.1**：单一类型同时描述两者；引擎不得出现来源分支。
- **为什么重要**：来源分支会在渲染/判定/评分各处分叉，导致生成关卡绕过 G1–G3 校验（P3 风险）、手工与每日成绩语义漂移、回归面翻倍。

---

## 3. 决策要点

1. **`Level` 无来源字段**：`core/types.ts` 的 `Level` 接口不携带 `source`/`isGenerated`/`kind` 等来源标记（GDD② §3.1 已无此类字段，本架构维持）。
2. **一切差异用数据表达，不用分支**：手工关与生成关的区别只体现在 `gridSize`/`keys`/`doors`/`visionMode`/`meta.expectedSolution` 等**数据字段**上。`visionMode` 决定渲染路径（full/fog），这是关卡属性而非来源（见 ADR-03）。
3. **生成关必须携带 `expectedSolution`**：与手工关一样过 G1–G3（GDD② X4：缺失即失败，非警告）。生成器产出即带 `Dir[]`。
4. **管线同源**：`bootstrap.ts` 无论关卡来自手工 yml 还是 `generator.generate()`，都走 `Level → new RunState(level) → scenes.关卡内`。`daily/daily.ts` 仅负责"在解锁后生成 Level 并放进选关列表"，不改变后续管线。

---

## 4. 后果

- **正向**：人工/生成的 QA 门禁（G1–G6）天然共用；W4 验收可物理执行（grep 0 命中）；生成器 bug（如产生不可三星关）在统一门禁下暴露。
- **正向**：存档层 `main-*` / `daily-*` 仅用 id 前缀隔离（GDD⑥ §4.6），无需为来源写分支。
- **约束**：若未来出现"某类关卡需要特殊规则"，必须回到**数据字段**扩展（如新增可选字段并在唯一推导函数中处理），而非在引擎里 `if (level.source === ...)`。
- **约束**：`Level.schemaVersion` 用于数据格式演进；`generatorVersion` 用于种子派生（ADR-01），二者职责不同，不得混用。

---

## 5. 可判定验收口径

| # | 判据 | 方法 | 来源 |
|---|---|---|---|
| B1 | 引擎代码来源分支 = 0 | `grep -rn "isGenerated\|\.source ===\|fromGenerated\|source === 'generated'" src/` → 0 命中 | W4 |
| B2 | `Level` 类型无来源字段 | 静态检查 `core/types.ts` 的 `Level` 接口不含 source/isGenerated | GDD② §3.1 |
| B3 | 生成关携带 expectedSolution | 生成器单测：任意 `GenerateResult.level` 的 `meta.expectedSolution.length > 0` | GDD② X4 |
| B4 | 手工/生成同管线 | 集成测试：以同一 `renderer`+`runstate` 跑一张手工关与一张生成关，行为一致 | 同源约束 |
| B5 | 缺失 expectedSolution 即失败 | 加载期：手工/生成关缺 `expectedSolution` 抛错，不入库 | GDD② X4 |

---

*ADR-02 结束 · 关联：ADR-01（生成关需确定性）、main-architecture.md §1/§2.2*
