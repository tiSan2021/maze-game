# Phase 3 技术搭建 · 汇编交付（Synthesis）

> 主理人：游承峰（游戏开发工作室统筹）| 阶段：Phase 3 关闭 / Phase 4 开启
> 评审强度：lean（结论先行）
> 上游：Phase 2 六份 GDD（①-⑥）+ concept.md v2.2 + art-bible v2.1.1 + accessibility 规格
> 下游：Phase 4 预制作（UX 规格 / 资产规格 / Epic·Story 拆分 + 测试脚手架）

---

## 一、Phase 3 交付物清单（主理人核对磁盘）

| 文件 | 归属成员 | 状态 |
|---|---|---|
| `docs/architecture/main-architecture.md` | engineering-lead | ✅ 803 行存活版本（已核对开头/ADR 引用/控制清单引用一致） |
| `docs/architecture/adr/adr-01-deterministic-prng.md` | engineering-lead | ✅ mulberry32 + fnv1a32 + 版本绑定 + UTC |
| `docs/architecture/adr/adr-02-level-data-unified.md` | engineering-lead | ✅ Level 同源，无 isGenerated 分支 |
| `docs/architecture/adr/adr-03-render-layering-fog.md` | engineering-lead | ✅ 关1-8 全烘焙 / 关9+ 三层增量；三必做前置 |
| `docs/architecture/adr/adr-04-undo-segment-coupling.md` | engineering-lead | ✅ 撤销粒度=一次滑行；visited 类型级外置；段切分单点 |
| `docs/architecture/control-checklist.md` | engineering-lead | ✅ 8 组；DQ3/W4/性能三前置为 `[AUTO]`；8ms 为 `[SPIKE]` |
| `docs/architecture/architecture-review.md` | engineering-lead | ✅ **PASS**（4 CONCERNS 闭合 3，余 1 `[SPIKE]`） |
| `design/accessibility/levels.md` | art-director | ✅ Basic 不成立；实际 Standard / Comprehensive 二选一 |
| `design/accessibility/feature-matrix.md` | art-director | ✅ 40 特性 × 3 档；AC-1~AC-5 门禁 |
| `design/art-bible.md` v2.1.1 | art-director | ✅ C 态标注「MVP 不可达」+ §2⑦ 渲染态映射 |

---

## 二、跨成员一致性核对（主理人）

- **段切分单一实现**：grep 确认 `splitSegments` / `countBacktrackSegments` 函数体仅存于 GDD② 第 160/176 行，无第二实现（W1 由 ADR-04 + 清单 D 守护）。
- **cellRenderState 单一函数**：GDD① §4.7；关 9+ 四态、关 1-8 三态；full 模式不产出 `UNKNOWN`，满足 A2（识别率门禁）。
- **门禁命名无撞号**：生成器/求解器 = **G1–G6**（46 处引用，未改名）；可访问性 = **AC-1~AC-5**（避开 G/A/AX 三套历史命名）。
- **确定性闭环**：ADR-01 算法 + 控制清单 DQ3（`grep Math.random` = 0）+ A6（时间源不外泄）。
- **撤销语义一致**：一次滑行粒度；`visited` 在快照外（类型级单调）；段切分单点 + Q4 跨断言（ADR-04）。
- **Phase 1/2 文档未被回改**：时间戳与内容核对一致，仅 Phase 3 成员落新文件。

---

## 三、质量门判定：**PASS**

- 架构评审总判定 PASS，无 FAIL 级阻塞。
- 已闭合：CONCERN-1（关闭迷雾为唯一代码分支，预留 `AccessibilityMode` 挂载点）、CONCERN-2（R=3 全局恒定，原 R=4~5 渐进方案作废）、CONCERN-4（M-1 C 态不实现）。
- 余项：`[SPIKE]` CONCERN-3（8ms 预算未实测），留 Phase 4 **E2 以性能尖峰开场**。
- **本回合新闭合两项**：
  - **M-2（L7）**：`countDeadEndBranches` 已由 design-strategist 正式定义并补入 `GDD⑤ §4.6.1`（定义 + 语言无关伪代码 + 4 契约用例 C-M2-1~4 + 与 D9/G5 关系）。G5 规格缺口闭合，工程可按此实现。
  - **§2⑦ 渲染态映射**（art-director 请求）：已授权并补入 `art-bible.md §2⑦` 一行 A/B/C/D ↔ `VIEW_WALKED`/`VIEW_UNWALKED`/`MEMORY_WALKED`/`UNKNOWN` 映射，C 标「无对应渲染态，切勿据此实现」，防工程误映射。

---

## 四、进入 Phase 4 的已知风险与缓解

| 风险 | 等级 | 缓解（归属） |
|---|---|---|
| CONCERN-3：8ms 预算未实测 | 中 | E2 以性能尖峰开场，跑「三前置全开」vs「缺一对照」两组数据；超标则产品级决策（接受关9+降帧 / 缩小迷宫 / 削减动效），非工程侧可单方面消化（engineering-lead 回报主理人） |
| L8 WALL_MEMORY 浓度取值 | 低 | art-director 资产规格中给定；已给参考（§2② 三色 #9AA8BC / #8092A8 / #6B7A8F 及 CR 值） |
| M-2 实现一致性 | 低 | 工程按 GDD⑤ §4.6.1 实现；单测覆盖 C-M2-1~4（engineering-lead） |
| 关闭迷雾为唯一代码分支 | 低 | 架构已预留 `AccessibilityMode` 挂载点，复用关 1-8 全烘焙路径（engineering-lead） |

---

## 五、Phase 4 预制作交接（主理人编排）

三成员**并行调度、互不依赖**，各自回传主理人：

1. **design-strategist** — UX 规格：`production/ux/ux-spec.md`（顶层状态流 / HUD 顶部条 / 输入映射 / 失败·过关·开门反馈流 / 可访问性开关入口）。
2. **art-director** — 资产规格：`production/art/asset-spec.md`（tile 图集 / 图案填充密度 / WALL_MEMORY 浓度 / 动效时长表 / 三档色盲 + 高对比参数）。
3. **engineering-lead** — Epic/Story 拆分 + 测试脚手架：`production/epics/epic-split.md` + `tests/` 最小脚手架（E0 脚手架→E1 域内核→E2 渲染尖峰→E3 应用壳→E4 生成器门禁→E5 每日种子→E6 内容）。

主理人收齐三份回传后：跨成员一致性检查 → 整合首个冲刺计划 → 输出 `phase4-synthesis.md`。

> 交接简报见 `design/phase4-brief.md`。
