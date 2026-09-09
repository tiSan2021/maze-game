# Phase 3 · 技术搭建 · 任务书（Handoff Brief）

> 主理人：游承峰 | 下发对象：`engineering-lead`（程基岩）+ `art-director`（林绘澄）| 状态：待限流恢复后并行 spawn
> 前置：Phase 2 已 PASS（2026-09-07）。6 份 GDD 落盘（design/gdd/01–06）、D1–D14 共 14 项决策冻结、`concept.md` v2.2、`art-bible.md` v2。

---

## 0. 上下文与边界

- **技术栈（不可推翻）**：原生 **HTML5 Canvas 2D + TypeScript、无游戏框架**；仅桌面浏览器（方向键 / WASD）；评审强度 lean。
- **本阶段只产出架构与设计规格文档，不写业务代码**（代码在 Phase 4 预制作起）。
- **只读不写** GDD / `concept.md` / `art-bible.md`；若发现需 Phase 1/2 回改的硬冲突，先报主理人裁决。

---

## 1. 给 `engineering-lead` 的任务

> 角色：主程序 / 架构。产出主架构文档 + ≥3 条基础层 ADR + 架构评审 + 控制清单。

**Deliverables（输出到 `docs/architecture/`）：**

| 文件 | 内容 |
|---|---|
| `main-architecture.md` | 主架构文档：模块划分、数据流、渲染管线、状态管理、生成器管线 |
| `adr/adr-01-*.md` … `adr-03-*.md`（≥3 条） | 基础层架构决策记录 |
| `architecture-review.md` | 架构评审（质量门 PASS/CONCERNS/FAIL） |
| `control-checklist.md` | 控制清单（上线前逐条勾选） |

**必须吸收的 Phase 2 约束（逐条对应，不得遗漏）：**

| 约束 | 来源 | 落位要点 |
|---|---|---|
| 走廊滑行 + 撤销栈 | GDD① §4.2（停止谓词 S1–S4）、§4.5（快照栈 + 回滚行为表：哪些回滚 / 哪些单调） | 实现「一次方向键 → 自动走到下一分叉」；撤销粒度 = 单步回滚 `path`，`visited` 单调递增不回滚 |
| 确定性随机 | GDD⑥ §4.1（mulberry32 + fnv1a32 派生）、§4.4（版本升级矩阵） | **禁用 `Math.random()`**；种子绑定生成器版本号；同一天、全球同题（UTC） |
| 生成器共用数据结构 | GDD② `Level`（手工/生成同类型）、Phase 1 §6(4b) | 引擎不得出现 `isGenerated` 之类来源分支；生成关卡与手工关卡同管线 |
| 求解器 / 生成器规格 | GDD⑤ §5（构造式四步）、G1–G6 门禁 | 生成器产出关卡须过 G1–G6；G3 验证 `expectedSolution` 为零回头路解（O(path)，非搜索） |
| 渲染分层 | `art-bible.md` v2（三层离屏 + L1 增量 + tile 预渲染 + R≤3、禁用 `shadowBlur`、HUD 走 DOM） | 关 1–8 回退全烘焙；关 9+ 双渲染路径；性能预算 <8ms 的三必做前置（tile 预渲染 / R≤3 / L1 增量）缺一即超标 |
| 常量表隔离 | Phase 1 §6(5) | `palette.ts` / `metrics.ts` / `motion.ts` / `pattern.ts` 承载全部可变参数 |
| 尺寸递进 | GDD② §2.2 | 9×9 / 11×11 / 13×13（含外墙）× 40px；一屏一关，无摄像机滚动 |

**建议 ADR 主题（≥3 条基础层）：**
1. 确定性随机与种子版本绑定（mulberry32 + fnv1a32，禁用 `Math.random`）
2. 关卡数据模型手工/生成同源（无来源分支）
3. 渲染分层与迷雾动态更新（关 9+ 静态层假设失效后的双路径方案）
4. （可选）撤销栈与段切分共享原语的耦合边界

**完成判据：**
- 主架构 + ≥3 ADR + 评审 + 清单齐全。
- 控制清单须含可验证项：`grep Math.random` 必须 0 命中（DQ3）、`grep isGenerated` 必须 0 命中（W4）、性能预算 <8ms 的三必做前置已声明。
- 跨成员一致性：与 art-director 的可访问性规格、与 Phase 2 GDD 的接口约束一致。

---

## 2. 给 `art-director` 的任务

> 角色：美术方向 / 技术美术。产出可访问性分级 + 特性矩阵。

**Deliverables（输出到 `design/accessibility/`）：**

| 文件 | 内容 |
|---|---|
| `levels.md` | 可访问性分级（Basic / Standard / Comprehensive）定义 |
| `feature-matrix.md` | 特性矩阵：每项视觉特性在三级下的开关与降级策略 |

**必须吸收的 Phase 1/2 约束（逐条对应）：**

| 约束 | 来源 | 落位要点 |
|---|---|---|
| 暖调纸感蓝图 | `art-bible.md` v2、D1 | 米白纸底 `#F4F1EA` + 深蓝墨线 `#1F3A5F`；亮底适配 |
| 四态迷雾视觉 | GDD① `cellRenderState`、D2 | 关 1–8 三态 / 关 9+ 四态（VIEW_WALKED / VIEW_UNWALKED / MEMORY_WALKED / UNKNOWN）；铅笔笔迹 `#9C8F73` 表「已走过」 |
| 图案填充第二编码通道 | `art-bible.md` v2、Q1 修正 | 亮底下以 **hatching** 承载第二编码，替代亮度阶梯（L* 间隔 6.09 < 阈值 10） |
| 双编码底线 | Phase 1 A4 | 钥匙 ≤3 种（青/紫/橙）+ 颜色 + 符号双重编码 + 与纸底明度差 |
| 墙邻感知视觉 | Q2 | 迷雾下相邻墙轮廓可见（一次 8 邻域查询）的视觉表达 |
| 顶部 32px HUD | Q3 | 顶栏承载钥匙/门/步数/撤销；不迫使滚动 |
| 性能门禁 G1 | Phase 1 R7/A1 | Phase 6 由 `quality-lead` 执行：3–5 人 1 秒闪现指认六类元素，识别率 ≥90% 且单类 ≥80% |

**完成判据：**
- 三级可访问性定义 + 特性矩阵齐全。
- 覆盖 A1–A6（暖调纸感 / 分阶段四态 / 已走过不靠提亮 / 钥匙≤3+双编码 / 动效≤200ms / 一屏一关）与 G1 门禁。
- 明确标注：从 Basic 升到 Comprehensive 时，哪些特性开启、哪些靠常量表切换（呼应 `palette.ts`/`pattern.ts` 隔离）。

---

## 3. 锁定不得推翻的四条接口约束（Phase 1 §6 / Phase 2 §6）

1. **走廊滑行**是 MVP 硬约束，不是锦上添花。
2. **一屏一关**：放不下就改关卡设计，不加摄像机滚动（硬上限 13×13×40=520≤592）。
3. **生成器共用数据结构**（4b）：手工与生成同 `Level` 类型。
4. **确定性随机**（4c）：mulberry32 + 种子绑定版本号；**死路禁互连**（4d）。
5. **常量表隔离**：`palette.ts` / `metrics.ts` / `motion.ts` / `pattern.ts`。

---

## 4. 后续（Phase 4 预制作预告）

并行：`design-strategist`（UX 规格）、`art-director`（资产规格）、`engineering-lead`（Epic/Story 拆分、测试框架脚手架）→ 主理人汇编首个冲刺计划。
