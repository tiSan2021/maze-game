# Phase 4 预制作 · 交接简报（Brief）

> Phase 3 已 PASS 关闭。进入 Phase 4 预制作：三成员并行、互不依赖，各自产出自有文件并回传主理人。
> 评审强度：lean。所有产物落到明确路径，禁止"产出找不到"。

## 〇、总体约束（三成员共享）

- **技术栈（不可推翻）**：原生 HTML5 Canvas 2D + TypeScript，无游戏框架，仅桌面浏览器，键盘方向键/WASD，零外部美术资源。
- **约束来源（必读）**：
  - `docs/architecture/main-architecture.md`（目录结构 / 数据流 / 双路径渲染 / 生成器管线）
  - `docs/architecture/adr/adr-01~04.md`
  - `docs/architecture/control-checklist.md`（DQ3 / W4 / 性能三前置 / 4 条 CI 代理断言）
  - `design/gdd/01~06-*.md`（六份 GDD）
  - `design/art-bible.md` v2.1.1
  - `design/accessibility/levels.md` + `design/accessibility/feature-matrix.md`（AC-1~AC-5）
- **输出根目录**：`D:/workbuddy/games/`，新增 `production/`、`tests/`、`src/` 按架构 §目录结构。
- **不写代码**（design-strategist / art-director）：只产出规格 Markdown；工程实现权属 engineering-lead。

---

## 成员 A · design-strategist — UX 规格

- **Task ID**：P4-UX ｜ **优先级**：高
- **Deliverable**：`D:/workbuddy/games/production/ux/ux-spec.md`
- **内容要求**：
  1. 顶层应用状态流：菜单 → 选关（主线/每日）→ 游玩 → 结算（星级/回溯段数）→ 返回；含失败重开、过关进入下一关、每日种子入口。
  2. HUD 顶部状态条（art-bible §6 Q3 裁决=顶部条）：钥匙持有/门状态/步数/回溯段数/当前星级预览；32px 高度，DOM 实现（非 Canvas）。
  3. 输入映射表：方向键 + WASD（四向滑行）、Z=撤销（滑行中按 Z 语义见架构 L5：丢弃剩余格回滚到本次滑行前快照）、R=重开本关、Esc=暂停/菜单。
  4. 反馈流：失败 vignette（250ms/1 次，单脉冲，非周期 flash，WCAG 2.3.1 合规）、开门 280ms、过关 400ms、切关 250+250ms；移动插值 ≤200ms（A5 唯一约束项）。
  5. 可访问性开关入口：Standard / Comprehensive 两档（Basic 不成立），对应 feature-matrix AC-1~AC-5。
- **约束**：纯规格不写代码；动效不得 ≥3Hz 闪烁；与 GDD① §4.5、art-bible §6 一致。
- **Handoff**：回传主理人要点（状态节点数、HUD 字段、输入键位表、反馈动效时长表），不返回大段文件。

---

## 成员 B · art-director — 资产规格

- **Task ID**：P4-ART ｜ **优先级**：高
- **Deliverable**：`D:/workbuddy/games/production/art/asset-spec.md`
- **内容要求**：
  1. **tile 图集**：13×13 每格 40px，离线预渲染；列出每类 tile（地板/墙/钥匙×N色/门×N色/出口/起点）的绘制图层与尺寸。
  2. **图案填充密度**（第二编码通道）：钥匙/门/出口各自的图案（形状+斜线方向），给出密度/线宽/透明度的可判定参数。
  3. **WALL_MEMORY 浓度取值**（L8 待定值）：复用 art-bible §2② 三色（fill #9AA8BC CR 2.14:1 / 45° hatch #8092A8 CR 3.62:1 / outline #6B7A8F CR 3.87:1），给出"记忆浓度"梯度（如 3 档由淡到浓）与判定口径（方向性 / WALL_MEMORY CR < WALL CR / 可读性底线 outline ≥3:1 / 区分底线同部件 CR 差 ≥1.2:1）。
  4. **动效时长表**：移动插值 ≤200ms；开门 280 / 过关 400 / 切关 250+250；失败 vignette 250ms/1 次。
  5. **三档色盲模式**色表 + **高对比模式**参数（对应 feature-matrix 升级路径）。
- **约束**：纯视觉规格不写代码；与 art-bible v2.1.1、accessibility/feature-matrix.md 的 AC-1~AC-5 一致；C 态不实现（已标不可达）。
- **Handoff**：回传主理人要点（tile 清单、图案参数、WALL_MEMORY 浓度梯度、动效时长表、色盲/高对比参数），不返回大段文件。

---

## 成员 C · engineering-lead — Epic/Story 拆分 + 测试脚手架

- **Task ID**：P4-ENG ｜ **优先级**：高
- **Deliverables**：`D:/workbuddy/games/production/epics/epic-split.md` + `D:/workbuddy/games/tests/` 最小脚手架说明
- **内容要求**：
  1. **Epic 顺序（强制）**：E0 脚手架（**约束检查脚本先于业务代码**：DQ3 grep / VISION_R===3 / tile 图集早于首帧 / draw-cell 无路径 API）→ E1 域内核（TDD，C1-C3 + V2-V6 先行）→ **E2 渲染（性能尖峰开场，CONCERN-3 准入条件）** → E3 应用壳 → E4 生成器门禁（可与 E2/E3 并行）→ E5 每日种子与结算 → E6 内容。
  2. 每个 Epic 拆 Story：标题 / 验收口径 / 依赖 / 估点（人天）。
  3. **E2 尖峰测试计划**：跑「三前置全开」vs「缺一对照」两组数据，输出帧耗时；超标时给出产品级决策选项（降帧/缩迷宫/削动效）。
  4. **测试框架**：选轻量方案（如 vitest），在 `tests/` 建最小脚手架（目录 + 1 个示例测试验证 DQ3/段切分），并将控制清单的可自动化项映射为 CI 强制。
- **约束**：遵循架构 §目录结构；E2 须含 CONCERN-3 尖峰计划；不写业务实现代码（仅拆分 + 脚手架）。
- **Handoff**：回传主理人要点（Epic 列表与顺序、每 Epic 的 Story 数、E2 尖峰方案、测试框架选型），不返回大段文件。

---

## 主理人汇编

三成员回传后，主理人：① 跨成员一致性检查（UX 状态流 ↔ 资产 tile ↔ Epic 拆分对齐）；② 整合首个冲刺计划（Sprint 0/1）；③ 输出 `phase4-synthesis.md`。
