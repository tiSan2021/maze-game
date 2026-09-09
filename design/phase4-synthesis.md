# Phase 4 预制作 · 汇编交付（Synthesis）

> 主理人：游承峰（游戏开发工作室统筹）| 阶段：Phase 4 关闭 / Phase 5 开启
> 评审强度：lean（结论先行）
> 上游：Phase 3 架构（main-architecture + adr/01-04 + control-checklist）+ GDD①-⑥ + art-bible v2.1.1 + accessibility 规格
> 下游：Phase 5 制作（按 epic-split.md 冲刺循环）

---

## 一、Phase 4 交付物清单（主理人核对磁盘）

| 文件 | 归属成员 | 状态 |
|---|---|---|
| `production/ux/ux-spec.md` | design-strategist | ✅ 5 状态节点 + GATE_DAILY + HUD 字段 + 输入映射 + 反馈时长 + 可访问性入口 |
| `production/art/asset-spec.md` | art-director | ✅ T1–T10 tile + 三色配对 + 图案密度(CR) + WALL_MEMORY 3 档 + 动效 + 色盲/高对比 |
| `production/epics/epic-split.md` | engineering-lead | ✅ E0–E6 强制顺序 + 41 Story（≈63.5pd）+ E2 尖峰计划 |
| `tests/README.md` + `tests/ci-gates/dq3-no-math-random.test.ts` + `vitest.config.ts` + `package.json` | engineering-lead | ✅ 最小脚手架；DQ3 测试已避开自指陷阱，`src/` 空时即绿灯 |

---

## 二、跨成员一致性核对（主理人）

- **状态流 ↔ 应用壳**：UX S0–S4 ⇄ epic E3 顶层状态机；`GATE_DAILY`（主线 12 关全 ≥1★ 才显「每日」）⇄ GDD⑥ D-1（避免诱使跳过教学）。✅
- **HUD**：UX 顶部 32px DOM 状态条 ⇄ asset-spec（HUD 无 tile、DOM 实现）⇄ epic E2-6 `hud.ts`（顶部 32px、`aria-live`）。✅
- **撤销 Z**：UX（丢弃剩余格、回滚到本次滑行前快照、`visited` 不回滚）⇄ epic E1-8 `undo.ts`（V5/W6：`path` 减、`visited.size` 不减）。✅
- **反馈动效**：UX 与 asset-spec 时长表一致（移动 120ms≤200 / 开门 280 / 过关 400 / 失败 250 单脉冲 / 切关 250+250）；**A5 口径两文一致**（仅移动插值 ≤200ms，过场/结算不受限）。✅
- **WALL_MEMORY（L8 待定值）**：asset-spec 给出 3 档浓度梯度（L1 最淡 → L2=art-bible 定值 `#9AA8BC`/`#8092A8`/`#6B7A8F` → L3 最浓），epic 渲染层消费。L8 关闭。✅
- **每日两条**：UX（每日·中 / 每日·高各一、主线全清解锁）⇄ epic E5 daily。✅
- **C 态不实现**：asset-spec 明确"本文不含任何 C 态资产"，与 art-bible v2.1.1「MVP 不可达」一致。✅
- **段切分 / 星级**：epic E1-5/E1-6 引用 GDD② 单一实现与 Q4 交叉断言；与 Phase 2/3 守护一致。✅

---

## 三、质量门判定：**PASS（预制作规格齐备，可进入 Phase 5）**

无 FAIL 级冲突。三份规格均对齐已冻结裁决（顶部条 / R=3 / 撤销粒度=一次滑行 / 每日两条 / A5 / 失败单脉冲非周期闪烁）。DQ3 脚手架已可运行，确定性底线从 Phase 5 第一行代码起即被守护。

---

## 四、进入 Phase 5 的已知风险与缓解

| 风险 | 等级 | 缓解（归属） |
|---|---|---|
| **CONCERN-3**：8ms 预算未实测 | 中 | E2-0 尖峰准入：跑「三前置全开」vs「缺一对照」两组，13×13 关9+ 连续 1000 帧 P95<8ms；超标→产品级决策（接受关9+降帧 / 缩小迷宫 / 削减动效 / 组合），**回报主理人**（engineering-lead） |
| WALL_MEMORY fill CR 1.0~1.1 未严格 ≥1.2 | 低 | art-director 声明 fill 仅作纸感底色辅助，浓度主区分交 hatch+outline；待 AC-3 实测校准（L1/L3 拟值） |
| asset-spec 多处拟值待 AC-3 校准 | 低 | 已显式标注"拟值"；Standard 档不依赖色表（由图案+形状承担），不阻塞 MVP |
| M-2 实现一致性 | 低 | 工程按 GDD⑤ §4.6.1 实现；单测覆盖 C-M2-1~4（epic E4-6 已列 `countDeadEndBranches`） |
| 脚手架落了 `package.json`/`vitest.config.ts` | 信息 | 属 engineering-lead 脚手架职权；Phase 5 实现将在此之上生长 |

---

## 五、Phase 5 制作交接（主理人编排）

按 `epic-split.md` 强制顺序进入：

- **Sprint 0/1** = **E0 脚手架**（约束检查脚本先于业务代码落地）→ **E1 域内核**（TDD，C1-C3 + V2-V6 先行）。
- **E2 渲染**以性能尖峰开场（CONCERN-3 准入条件，非收尾）。
- 每冲刺循环：engineering-lead 实现就绪 Story → quality-lead 产 QA 计划 + 烟雾测试 → design-strategist 设计评审 → 主理人回顾。
- E4 生成器门禁可与 E2/E3 并行（不参与运行时）。

> 交接简报见 `design/phase4-brief.md`；Epic/Story 明细见 `production/epics/epic-split.md`。
