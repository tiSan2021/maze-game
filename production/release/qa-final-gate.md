# 最终质量门禁签字 · QA Final Gate Sign-off

> 项目：俯视角 2D 网格迷宫（纯 TypeScript + Canvas 2D · 桌面浏览器 · 纯键盘）
> 目标版本：**v0.5.0**（自 v0.4.0）
> 验证人：quality-lead（严守真） · 日期：2026-09-09
> 性质：Phase 7（发布）最终质量门禁 —— 独立复验，只读验证（本文件为唯一写入产物）
> 环境：Node 22.12.0 · vitest 1.6.1 · vite 5.4.21 · 仓库根 `D:\workbuddy\games`

---

## 一、判定（Verdict）

# ⚠️ CONCERNS

**硬门禁全绿（测试 / 类型 / 构建 / 版本 / 内容一致性 / 约束合规均通过），但存在 1 项发布阻断项：仓库未初始化，v0.5.0 无法打 tag，因此无法完成一次"真实的、可追溯的带 tag 发布"。**

判定不是 `PASS`：因为在 blocker 未解决前，交付物只是"本地已验证的 `dist/` 包"，不构成可追溯的版本化发布。
判定不是 `FAIL`：因为不存在任何硬门禁失败——代码与内容层面已具备发布质量。

---

## 二、证据表（Evidence Table）

所有命令均在 `D:\workbuddy\games` 下由本人重新执行，非引用 release-ops 的结论。

| # | 检查项 | 结果 | 实测值 / 证据 |
|---|--------|------|--------------|
| 1 | 全量测试套件 `vitest run` | ✅ **PASS** | **Test Files 47 passed (47) · Tests 227 passed (227)** · 0 failed / 0 skipped · 耗时 28.40s。达到要求的 47 文件 / 227 用例全绿。 |
| 2 | 类型检查 `tsc --noEmit` | ✅ **PASS** | 退出码 **0**，**0 条错误**，无任何输出。 |
| 3 | 生产构建 `vite build` | ✅ **PASS** | `✓ 42 modules transformed` · `✓ built in 2.35s` · 退出码 0。 |
| 3b | 产物体积（Bundle size） | ✅ **PASS** | `dist/assets/index-oOxi5_Dl.js` = **81.57 kB / gzip 17.98 kB**（磁盘实测 82,258 B）；`dist/index.html` = **1.85 kB / gzip 1.07 kB**（磁盘实测 1,995 B）。产物已落盘确认。 |
| 4 | `package.json` 版本号 | ✅ **PASS** | `version` = **`0.5.0`**（要求 0.5.0）。`description` 亦已同步为 "v0.5.0 发布版（24 关主线 / 三锁难度上限）"。 |
| 5 | 发布文档存在且非空 | ✅ **PASS** | `CHANGELOG.md` 3,752 B · `production/release/release-checklist.md` 5,716 B · `production/release/launch-checklist.md` 2,900 B。三份均存在、非空、内容完整。 |
| 6 | 主线关卡数 = 24 | ✅ **PASS** | 解析 `src/content/main-levels.json`：`version` = 1，**`levels.length` = 24**，id 连续为 `main-1` … `main-24`，无缺号 / 无重复。 |
| 7 | `MAIN_LEVEL_COUNT` = 24 | ✅ **PASS** | `src/sim/progress.ts:14` → `export const MAIN_LEVEL_COUNT = 24;`。与题库 24 关**一致，无 off-by-one**。 |
| 8 | 约束：`src/sim` + `src/gen` 无 `Date.now()` / `new Date()` | ✅ **PASS** | 两个目录全量正则检索（`Date\.now\(\)｜new Date\(`）→ **0 命中**。CI 闸门 `tests/ci-gates/a6-time-source.test.ts` 亦独立通过。 |
| 9 | 约束：`src/**` 无 `Math.random` | ✅ **PASS** | `src/` 递归检索 `Math\.random` → **0 命中**。CI 闸门 `tests/ci-gates/dq3-no-math-random.test.ts` 亦独立通过。 |
| 10 | 三锁难度上限落地 | ✅ **PASS** | L21–24 实测：`gridSize` **13**、`visionMode` **fog**、`meta.lockDepth` **3**、钥匙 **3**（颜色 0/1/2）、门 **3**（颜色 0/1/2）。与需求 "13×13/fog/ld3/3 钥匙+3 门" **完全吻合**。 |
| 11 | 难度曲线一致性（独立复算） | ✅ **PASS** | 锁深分布实测：ld0 → L1–3；ld1 → L4–8；ld2 → L9–20；ld3 → L21–24。24/24 关满足 `lockDepth === keys.length === doors.length`，无一例外。 |
| 12 | 关卡可解性 / 三星可达（G1/G2/G3/G5/G6） | ✅ **PASS** | 单独复跑 `tests/ci-gates/main-levels-gates.test.ts` → 5/5 通过。该门禁对全 24 关断言：运行时 `computeLockDepth(lv)` **等于**声明的 `meta.lockDepth`（即门不可绕过）、G1 可解、G2 ≤80 步、G3 三星可达、G5 合规、G6 命中档位长度带。**0 关不可解**得到独立证实。 |
| 13 | 性能预算门禁 | ✅ **PASS**（见 CONCERNS-4） | 单独复跑 `tests/ci-gates/perf-budget.test.ts` → 4/4 通过。实测 main-12 帧时：**均值 0.4961ms · p95 0.9087ms · 最大 1.4025ms**，预算 16ms，**余量 32.3×**。 |
| 14 | 存档 schema 兼容性 | ✅ **PASS**（见 CONCERNS-3） | `src/sim/progress.ts:10` → `PROGRESS_SCHEMA_VERSION = 1`，v0.4.0/v0.5.0 同为 1，旧存档不会被重置（`progress.ts:83` 仅在版本不等时才清空）。回滚文档的 schema 兼容声明成立。 |
| 15 | 发布文档与事实一致性 | ✅ **PASS** | 逐条核对，见第五节。**未发现任何虚报或数字错误。** |
| 16 | 仓库可打 tag（v0.5.0） | ⛔ **FAIL** | `D:\workbuddy\games\.git` **不存在**；上级 `D:\workbuddy\.git`、`D:\.git` 亦不存在（纯文件系统检查，**全程未执行任何 git 命令**）。→ 见 BLOCKER-1。 |
| 17 | U5 字号三档无障碍选项 | ⚠️ **CONCERN** | 全 `src/` 检索 `fontSize` / `字号` → **0 命中**，功能确认**未实现**。→ 见 CONCERNS-1。 |
| 18 | 菜单遗留阶段标签 | ⚠️ **CONCERN** | `src/main.ts:189` 仍含 `演示壳 · P5-S3-E6`（玩家可见的主菜单串）。→ 见 CONCERNS-2。 |

**硬门禁小结：18 项检查中 16 项 PASS、1 项 FAIL（仓库/tag，非代码质量）、2 项 CONCERN（不阻断）。**

---

## 三、阻断项（Blockers）—— 真实发布前 **必须** 解决

### ⛔ BLOCKER-1：Git 仓库不存在，v0.5.0 无法提交 / 打 tag

- **事实**：`D:\workbuddy\games` 下无 `.git` 目录；向上两级（`D:\workbuddy`、`D:\`）也没有。项目从未纳入版本控制。
- **影响**（这是判定为 CONCERNS 而非 PASS 的**唯一**原因）：
  1. 无法执行 `git tag v0.5.0`，"v0.5.0" 目前仅是 `package.json` 里的一个字符串，**没有不可变的代码快照与之绑定**；
  2. 回滚计划失去技术底座——`release-checklist.md` §9 的回滚依赖"保留上一版 `dist/`"，但 `dist-v0.4.0/` **并不存在**，且无 v0.4.0 的源码快照可重建，**当前实际上不可回滚到 v0.4.0**；
  3. 无变更溯源：CHANGELOG 里"v0.4.0 历史基线，详情见历史提交记录"所指向的提交记录并不存在。
- **解除条件**（须用户显式批准，QA 本轮**不执行任何 git 命令**）：
  `git init` → 添加 `.gitignore`（排除 `node_modules/`、`dist/`）→ 首次提交 → `git tag v0.5.0`。
- **补充建议**：在打 tag 的同时把本次已验证的构建产物归档为 `dist-v0.5.0/`，并明确 v0.4.0 无归档包这一现状（否则回滚承诺无法兑现）。

> 除上述一项外，**无其它阻断项**。代码、内容、测试、构建层面均已达发布质量。

---

## 四、已知缺口 / 需用户确认（Known Gaps / CONCERNS）—— 不阻断，但请知情

### ⚠️ CONCERNS-1：U5 字号三档（小/中/大）未实现
`src/` 内无任何 `fontSize` / 字号相关实现，可访问性设置当前仅有「减少动效 / 迷雾开关 / 音效」三项。低视力用户缺少字号调节手段。属功能缺口，非缺陷，不阻断本轮发布，建议排入 v0.6.0。

### ⚠️ CONCERNS-2：主菜单仍显示内部阶段标签
`src/main.ts:189` 的 menuHtml 输出 `演示壳 · P5-S3-E6`。这是**玩家可见文案**，"演示壳" 与内部 pipeline 阶段号会削弱正式发布观感。修改成本极低（单行字符串），建议在 tag 之前顺手替换为正式标题。QA 未代改（约束：不修改 gameplay/engine 代码）。

### ⚠️ CONCERNS-3：主线 12→24 会使**老玩家的每日模式被重新锁上**（发布文档未提及，本轮新发现）
- **机制**：存档 schema 版本未变（均为 1），旧存档正常加载、进度不丢失；但 `isMainAllCleared()`（`src/sim/progress.ts:143-150`）遍历范围随 `MAIN_LEVEL_COUNT` 由 12 扩到 **24**。
- **后果**：在 v0.4.0 下已通关全部 12 关、**已解锁每日模式**的玩家，升级到 v0.5.0 后，因 L13–24 尚未通关，`GATE_DAILY` 重新判定为未达成 → **每日分区从"已解锁"退回"锁定"**。
- **定性**：这在内容扩展语义下可视为设计意图（新增内容需重新达成"全清"），**但它是一次面向老玩家的可见能力回退**，而 `release-checklist.md` §9 仅声明 "schema 不变、向下兼容"，未覆盖此行为变化。
- **建议**：请用户明确取舍——(a) 接受并在 CHANGELOG 补一句提示；或 (b) 后续版本改为"已解锁一次即永久保留"（记一个 flag）。**不阻断发布。**

### ⚠️ CONCERNS-4：性能门禁仍以 main-12（双锁）为最坏情况，未随难度上限升级
`perf-budget.test.ts` 的用例名与断言对象是 "main-12 最坏情况：13×13 / fog / 双锁"，而 v0.5.0 的真实最坏情况已是 **L21–24（13×13 / fog / 三锁）**。
- **风险评估：低**。L21–24 与 L12 网格尺寸、视野模式完全相同，仅多 1 组钥匙/门（渲染与可见性计算量几乎不变），且当前余量高达 **32.3×**（均值 0.4961ms vs 预算 16ms）。
- **但严格地说**，新的难度天花板未被性能门禁直接覆盖。建议把该门禁的基准关切换到 main-24，使门禁始终对齐最坏情况。**不阻断本轮发布。**

### ⚠️ CONCERNS-5：三锁真机手感未经浏览器试玩确认
Node 环境只能证明 L21–24 **可解、步数达标、三星可达、帧预算充足**，无法判断"3 锁 + 迷雾"的节奏与难度体感是否过硬。这是自动化验证的固有边界，**本轮无法由 QA 消除**。建议放行前由用户在桌面浏览器实际试玩 L21–24 各一遍。

### ℹ️ 备注（提示级，无需处理）
`src/state/placeholder.ts` 的 `PLACEHOLDER_LEVEL`（`id: 'demo-placeholder'`）已不被菜单路径引用（主线走 `main-levels.json`），属早期残留死代码；不影响产物正确性，可在后续版本清理。

---

## 五、发布文档准确性核查（Are the release docs accurate?）

逐条比对 release-ops 的三份文档与我的实测值：

| 文档中的声明 | 实测核对 | 结论 |
|---|---|---|
| 构建绿 · 42 模块 · JS 81.57 kB / gzip 17.98 kB · HTML 1.85 kB / gzip 1.07 kB | 完全一致（并已核对磁盘字节数 82,258 / 1,995） | ✅ 准确 |
| `vitest run` 47 文件 / 227 用例全绿 · `tsc --noEmit` 0 错误 | 完全一致 | ✅ 准确 |
| `package.json` version 0.4.0 → 0.5.0 | 实测 0.5.0 | ✅ 准确 |
| 主线 24 关，L21–24 = 13×13 / fog / ld3 / 3 钥匙 + 3 门 | 逐关实测吻合 | ✅ 准确 |
| 难度曲线 L1-3=0锁 / L4-8=1锁 / L9-20=2锁 / L21-24=3锁 | 逐关实测吻合 | ✅ 准确 |
| `MAIN_LEVEL_COUNT = 24` 且与题库自洽 | `progress.ts:14` 实测一致 | ✅ 准确 |
| 声明锁深与运行时 `computeLockDepth` 全 24 关一致、0 关不可解 | 由 `main-levels-gates.test.ts` 独立复跑证实 | ✅ 准确（非自我声明） |
| 卡点绕过缺陷已在 `findChokePoints()` 修复 | 门禁断言 `computeLockDepth === 声明值` 全过，证明门不可绕 | ✅ 准确 |
| 性能门禁绿、均值远低于 16ms | 实测均值 0.4961ms，余量 32.3× | ✅ 准确 |
| 存档 schema v0.4.0/v0.5.0 同为 1、向下兼容 | `PROGRESS_SCHEMA_VERSION = 1` 实测一致 | ✅ 准确（但见 CONCERNS-3：未覆盖每日门禁回退） |
| 无 `.git`，无法打 tag（自列为 BLOCKER） | 文件系统检查确认无 `.git` | ✅ 准确且诚实 |
| U5 字号三档未实现 | `src/` 内 0 命中 | ✅ 准确 |
| 主菜单残留 `演示壳 · P5-S3-E6` | `src/main.ts:189` 确认 | ✅ 准确 |

**结论：三份发布文档 = 准确、无虚报、无夸大，且主动披露了自身的阻断项与缺口，质量良好。**
唯一不足是**两处覆盖不全**（非错误）：未提及每日门禁对老存档的回退（CONCERNS-3），未提及性能门禁基准关滞后于新难度上限（CONCERNS-4）。

---

## 六、验证范围与约束遵守声明

- ✅ 全程**未执行任何 git 命令**（`.git` 的判断仅用 `ls` 做文件系统检查）。
- ✅ **未修改**任何 gameplay / engine 代码，**未修改**三份发布文档。
- ✅ 唯一写入的文件是本签字文档 `production/release/qa-final-gate.md`。
- ✅ 所有测试 / 类型 / 构建结论均为本人重新执行所得，**未引用** release-ops 的既有结论。
- ⛔ **验证边界**：Node 环境无法评判浏览器真机手感、GPU 栅格化耗时与实际输入延迟（见 CONCERNS-5）。

---

## 七、签字（Sign-off）

> **签字结论：v0.5.0 在代码与内容层面已达可发布质量——测试 47 文件 / 227 用例全绿、`tsc` 0 错误、`vite build` 成功（81.57 kB / gzip 17.98 kB）、版本号 0.5.0、24 关与 `MAIN_LEVEL_COUNT` 完全一致、三锁上限落地且 0 关不可解、无 `Math.random` / 无 `Date.now` 违规；但因仓库未初始化导致无法打 v0.5.0 tag（亦使回滚承诺暂无技术底座），我给出 `CONCERNS` 而非 `PASS`：待用户批准并完成 `git init` + 提交 + `git tag v0.5.0` 后，可放行为正式发布。**

| 角色 | 姓名 | 日期 | 决定 |
|------|------|------|------|
| Release Ops | 路远行 | 2026-09-09 | GO-WITH-KNOWN-GAPS（待仓库 tag 解决） |
| **Quality Lead** | **严守真** | **2026-09-09** | ⚠️ **CONCERNS —— 有条件放行（须先解除 BLOCKER-1）** |
| 用户 / 决策者 | ____ | ____ | ☐ 待决（Go / No-Go） |

**放行前请用户拍板的 3 件事：**
1. 是否批准 `git init` + 首次提交 + `git tag v0.5.0`（**解除唯一阻断项**）；
2. 是否接受 CONCERNS-3（老存档每日模式被重新锁上）这一行为变化；
3. 是否在 tag 前顺手改掉主菜单的 `演示壳 · P5-S3-E6`（一行改动，显著提升正式感）。
