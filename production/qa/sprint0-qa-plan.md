# Sprint 0 / Sprint 1 · QA 计划与第二层验证报告

> **任务 ID**：P5-S0S1-QA ｜ **角色**：quality-lead（严守真）｜ **优先级**：高
> **范围**：E0 脚手架 + E1 域内核（TDD）。本文件为**第二层验证**（主理人独立复核之后的独立冒烟 + 缺口分析）。
> **项目根**：`D:/workbuddy/games`
> **复核基准**：主理人独立复核 `npm test` = 21 文件 / 66 用例全绿，`Math.random` 全仓 0 命中。

---

## 0. 结论摘要（先给结论）

- **冒烟闸门**：`npm test`（vitest）**全绿** → **22 文件 / 70 用例**通过（本 QA 新增 1 文件 / 4 用例，未改 `src/`）。
- **覆盖映射结论**：GDD 契约 **C1-C3 / V2 / V3 / V5 / V6 / Q4 / D11 / K1 / K4 / K5 / K6 / W1 / W4 / A2 / M-2 / DQ3** 在 Sprint 0/1 内**已覆盖**；**真实缺口 3 处**（均属 E4 生成器/加载器范围，非 E1 域内核缺陷）：
  1. **K2 同色 1:1 配对**（加载期校验，E4）
  2. **Q2 的"连续 30 每日种子 100% 过 G1-G6"** 批量门禁（生成器未建，E4）
  3. **M-2 的"互连检测独立泛洪（D9）"** 本身未实现（E1 仅有 `countDeadEndBranches` 计数，互连检测在 E4-6）
- **本 QA 补测后关闭的边界缺口**：锁钥深度=2 上界、连续多次滑行后撤销的快照深拷贝防别名、地图边缘视野越界守卫、非 `expectedSolution` 路径（2 回头路 → 1★）星级判定。
- **Bug 严重级 rubric**：见 §4（S1–S4）。
- **回归闸门建议**：见 §5（DQ3 / W4 / VISION_R / fnv1a32-single / W1 / Q4 强制 CI）。

---

## 1. 测试覆盖映射表

> 状态图例：**已覆盖** = 有对应测试文件/用例直接断言；**部分** = 仅覆盖契约子集（注明缺哪部分）；**缺口** = Sprint 0/1 内无测试，且注明为何是缺口（多为 E4 范围）。
> 测试定位格式：`目录/文件 · 用例描述`。

| GDD 契约 | 语义 | 对应测试 | 状态 |
|---|---|---|---|
| **C1** | 0 回头路段 → 3★ | `unit/segments.test.ts` C1=0；`unit/stars.test.ts` C1→3★ | 已覆盖 |
| **C2** | 1 回头路段 → 2★ | `unit/segments.test.ts` C2=1（段内计数）；2★ 映射由 `settle` 公式 `≤1?2` 给出（已通过 C1=3★ + 新增 1★ 用例间接锁死公式两端） | 已覆盖 |
| **C3** | 1 回头路段（门变体）→ 2★ | `unit/segments.test.ts` C3=1 | 已覆盖 |
| **V2** | 撞墙不产生 step | `unit/runstate.test.ts` 撞墙10次 steps=0&&path=0；`unit/move.test.ts` 撞墙→BLOCKED | 已覆盖 |
| **V3** | 环形走廊单次滑行终止 ≤ gridSize² | `unit/glide.test.ts` 环形关 + 全开格防御上限 | 已覆盖（见 §3 风险：S4 分支在单轴滑行下不可达，终止由上限 + S1 保证） |
| **V5** | 撤销回滚 path/steps，visited 不回滚 | `unit/undo.test.ts` 走5步撤销；`unit/runstate.test.ts` 撤销后 visited 仍单调 | 已覆盖（已补"连续多次滑行+深拷贝"用例，见 §3） |
| **V6** | full 模式绝不出现 UNKNOWN/MEMORY_WALKED | `unit/visibility.test.ts` V6 full 全格扫描 | 已覆盖 |
| **V7 / Q2(可见性部分)** | 墙邻感知：记忆区旁相邻墙在 visible | `unit/visibility.test.ts` V7 角落相邻外墙 | 已覆盖（角落特例；中部通用路径未单独测，机制同构） |
| **Q4** | G3 与运行时星算一致（expectedSolution 喂 settle 必 3★） | `integration/q4-cross.test.ts` 无锁关 + 真·管线回路 | 已覆盖 |
| **Q2(批量部分)** | 连续 30 每日种子 100% 过 G1-G6 且无 fallback | — | **部分**：仅"墙邻感知"子项在 E1 覆盖；**30 种子批量门禁依赖生成器（E4），本冲刺未建** |
| **D11** | visited 单调递增、撤销不回滚 | `unit/undo.test.ts` + `unit/runstate.test.ts` | 已覆盖 |
| **K1** | 3 色上限（0/1/2） | `src/core/types.ts` `KeyColor = 0|1|2`（类型层强制） | 已覆盖（类型约束，无运行时单测但类型即不变量） |
| **K2** | 同色 1:1 配对（每色恰 1 钥匙 1 门） | — | **缺口**：无测试。属加载期/生成期校验（G5/X1/X2，E4），E1 域内核未提供该校验入口 |
| **K3** | 门面显色（美术侧） | — | 不适用（美术圣经范畴，非域内核） |
| **K4** | 持同色钥匙进门自动开启 | `unit/move.test.ts` 持钥进门→OPEN_AND_ENTER | 已覆盖 |
| **K5** | 钥匙不消耗 | `unit/lockkey.test.ts` 二次经过无事件、K5 不消耗 | 已覆盖 |
| **K6** | 依赖链深度 ≤ 2 | `unit/lockkey.test.ts` L2=2；**新增** 3 串联门→UNSOLVABLE（上界） | 已覆盖（已补上界边界） |
| **W1** | 段切分单点实现 | `ci-gates/w1-segments-single.test.ts` | 已覆盖 |
| **W4** | 无来源分支 | `ci-gates/w4-no-source.test.ts` | 已覆盖 |
| **A2** | fnv1a32 唯一实现 | `ci-gates/fnv1a32-single.test.ts`（`0x811c9dc5` 仅1处） | 已覆盖 |
| **M-2（计数）** | countDeadEndBranches 定义（直线/Y形/双接触点） | `unit/deadends.test.ts` C-M2-1..4 | 已覆盖 |
| **M-2（互连 D9）** | 互连检测独立泛洪（不能用计数代替） | — | **部分**：`countDeadEndBranches` 计数已覆盖；**独立互连泛洪（D9）本身未实现**（E4-6 范围） |
| **DQ3** | 全仓禁用内建随机函数 | `ci-gates/dq3-no-math-random.test.ts` + grep 0 命中 | 已覆盖 |

---

## 2. 冒烟测试定义（Sprint 0/1 冒烟闸门）

- **命令**：`npm test`（等价 `vitest run`）。
- **守护的不变量（冒烟即守这些底线）**：
  1. **确定性底线 DQ3**：`src/` + `tests/` 内 `Math.random` 字面量 0 命中（自指防护已用 `'Math'+'.'+'random'` 拼接，新增测试同样不写该字面量）。
  2. **同源底线 W4**：`Level` 无来源分支（`isGenerated`/`.source`/`source==` 0 命中）。
  3. **性能三前置代理**：`VISION_R===2（当前值，上限 3，缩小不在禁止范围）`；`fnv1a32` 唯一实现；`draw-cell.ts` 无路径 API（render 缺失时占位绿）；`tileAtlasReady` 无反模式。
  4. **共享原语单点 W1**：`splitSegments`/`countBacktrackSegments` 全仓各仅 1 处函数体。
  5. **契约例常驻**：C1→3★、Q4 交叉断言（expectedSolution→settle 3★）、锁钥 L0/L1/L2 深度、deadends 直线/Y/双接触点。
  6. **行为不变量**：撞墙 0 step（V2）、撤销不回滚 visited（V5/D11）、走廊滑行终止（V3）。
- **CI 合并前必须全绿**；任一红灯即阻断合并（对应控制清单 J 组三条最硬底线 + 各 `[AUTO]` 项）。

---

## 3. 边界 / 风险分析

### 3.1 已确认覆盖（任务点名的 6 个边界中 4 个已由本 QA 补测关闭，2 个原已覆盖）

| 任务点名边界 | 状态 | 说明 |
|---|---|---|
| S4 环形走廊单次滑行终止性 | 已覆盖（含风险注记） | 单轴滑行下，玩家每次只沿一个方向移动，坐标在该轴上单调，**S4（slideSeen 命中）在正常 `planSlide` 路径下实际不可达**；终止性由 `result.length < gridSize²` 上限 + S1（撞墙）双重保证。`unit/glide.test.ts` 已用环形关 + 全开格验证"有限且 ≤ 上限"。**风险**：S4 分支当前为防御性死代码，建议后续补一条"构造滑动序列"级单测或显式标注其为防御上限，避免误以为已被触发测试覆盖。 |
| 连续多次滑行后撤销 | **本 QA 补测**（新增用例） | 验证两次滑行各拾 1 钥匙后撤销一次：pos/path/keysHeld 回滚到滑行1末态，**快照深拷贝防别名（R-B）**被显式验证——若 `pushSnapshot` 与 `state` 共享同一 `Set` 实例，滑行2 的拾钥会污染滑行1 快照，撤销后 `keysHeld` 误含第 2 把钥匙，用例会失败。 |
| 锁钥深度=2 边界 | **本 QA 补测**（新增用例） | `computeLockDepth` 原覆盖 L0/L1/L2 与"钥匙不可达→UNSOLVABLE"，**缺 K6 上界**：3 层串联门（需 3 轮解锁）应判 UNSOLVABLE。已补。 |
| 地图边缘视野 | **本 QA 补测**（新增用例） | `computeVisibility` 在玩家位于角落 (1,1) 时，其 8 邻域墙判定有 `inBounds` 守卫；新增用例断言 `visible` 集合**全部为合法网格坐标**，防止越界键泄漏。 |
| countDeadEndBranches 的 Y 形 / 双接触点 | 已覆盖 | `unit/deadends.test.ts` C-M2-3（Y 形共用1接入点→1）、C-M2-4（双接触点→不计，属 D9 另判）已断言。 |
| 非 expectedSolution 路径的星级判定 | **本 QA 补测**（新增用例） | 原 `stars.test.ts` 仅测 C1（3★）；Q4 仅测 expectedSolution 路径。`settle` 对**玩家实际路径**（含 2 个段内回头）应得 **1★** 此前无直接断言，已补（S1 下限分支锁死）。 |

### 3.2 仍属真实缺口（非 E1 缺陷，列入后续 Epic）

1. **K2 同色 1:1 配对校验**（缺口）：GDD③ K2 / X1-X2 要求每色恰 1 钥匙 1 门，属加载期或生成期校验（G5），E1 域内核未暴露该入口，**无测试**。建议 E4 加载器补 `assertOneToOneColorMapping(level)` 单测。
2. **Q2 批量门禁**（部分）："连续 30 每日种子 100% 过 G1-G6 且无 fallbackUsed"依赖生成器，本冲刺未建。**建议** E4 完成后加 `tools/qa-gates.ts` 批量脚本 + CI。
3. **D9 互连独立泛洪**（部分）：M-2 明确"互连检测必须独立泛洪，不能用 `countDeadEndBranches` 计数代替"。E1 仅有计数函数，**互连检测本身未实现/未测**（E4-6）。**风险**：若仅靠计数，两分支相连（分量数变少）会被误判合规 → 必须 E4 补独立泛洪 + 对照测试。

### 3.3 轻微/观察项（非阻塞）

- `VISION_R` 为 `const` 且 `cellRenderState` 对 `fog` 路径区分 `WALL`/`WALL_MEMORY`，但 `unit/visibility.test.ts` 仅断言返回值为字符串，未断言"仅墙邻感知墙→WALL_MEMORY"分支的精确语义（M-3 细化）。建议补 1 例断言 `WALL_MEMORY` 判定。
- "滑行中按 Z 取消本次滑行"（控制清单 C 组）在域内核层不存在——`applySlide` 是一次性原子推进，取消语义属输入层（E6）。域内核无需测，但 E6 需补该交互用例。

---

## 4. Bug 严重级 Rubric（S1–S4）

| 级 | 名称 | 判定标准（域内核视角） | 处置 |
|---|---|---|---|
| **S1 Critical** | 确定性/同源/数据底线被破坏 | `Math.random` 泄漏（DQ3 违规）；引入来源分支（W4 违规）；`VISION_R` 被改大或现 R=4/5 分支；`fnv1a32` 出现第二实现；`expectedSolution` 喂 `settle` 非 3★（Q4 漂移）；`visited` 被错误回滚；崩溃/数据损坏 | **合并阻断**，必须修复并补回归闸 |
| **S2 High** | GDD 契约在已覆盖域被违反 | C1≠3★；撞墙产生 step（V2 破）；滑行不死循环（V3 破）；撤销回滚 visited（V5/D11 破）；K5 钥匙被消耗；`splitSegments`/`countBacktrackSegments` 出现第二实现（W1 破）；`computeLockDepth` 对 L0/L1/L2 算错；`countDeadEndBranches` 对直线/Y/双接触点计数错（M-2 破）；快照未深拷贝导致别名污染 | 发布阻断，修复并入回归闸 |
| **S3 Medium** | 边界/特定地图下的域内核缺陷 | 锁钥深度上界（>2）误判；地图边缘视野越界键；连续多次滑行撤销别名；非预期解法路径星级错（1★/2★ 分支）；死路 Y 形/双接触点误计；墙邻感知漏判 | 应修复，按风险排期，非强制阻塞 |
| **S4 Low** | 类型/文档/未来范围项 | K2 1:1 配对（E4 范围）；D9 互连泛洪（E4 范围）；Q2 批量门禁（E4 范围）；"滑行中按 Z"（E6 范围）；`WALL_MEMORY` 分支语义断言缺失等 | 跟踪至对应 Epic，不阻塞本冲刺 |

---

## 5. 回归闸门建议（须 CI 强制）

**硬底线（任一失败即阻断合并，对应控制清单 J 组 + 各 `[AUTO]`）：**

| 闸门 | 当前落地 | 建议 |
|---|---|---|
| **DQ3** | `ci-gates/dq3-no-math-random.test.ts` + 构建期 grep（扫 `src/`+`tests/`） | **强制**。注意自指防护：测试与注释不写 `Math.random` 字面量（用拼接）。本 QA 新增测试已确认 0 命中。 |
| **W4** | `ci-gates/w4-no-source.test.ts` + 构建期 grep | **强制**。 |
| **VISION_R===2（当前值，上限 3，缩小不在禁止范围）** | `ci-gates/vision-r-constant.test.ts` | **强制**，且扩展断言"无 R=4/5 分支"（grep `VISION_R` 仅常量引用）。 |
| **fnv1a32-single** | `ci-gates/fnv1a32-single.test.ts` | **强制**（`0x811c9dc5` 全仓仅 1 处）。 |
| **W1** | `ci-gates/w1-segments-single.test.ts` | **强制**（`splitSegments`/`countBacktrackSegments` 各仅 1 函数体）。 |
| **Q4 交叉断言** | `integration/q4-cross.test.ts` | **强制**（防 G3/运行时漂移总闸，已常驻）。 |
| **结构性守卫（R-B）** | 类型层 `RunSnapshot` 不含 `visited` 字段；`grep` 无 `visited = snapshot` / `visited.delete` 类回滚写法 | **建议升级为结构化断言**（已在 `types.ts` 注释固化 `RunSnapshot` 不含 `visited`；快照深拷贝由本 QA 新增用例行为验证）。 |
| **draw-cell 无路径 API / tileAtlasReady** | `ci-gates/draw-cell-no-path-api.test.ts`（占位绿）、`tile-atlas-ready.test.ts`（占位绿） | render 实现后由占位转真断言；当前绿即放行。 |

**非阻塞（跟踪项，转 E4/E6）：** K2 配对校验、D9 独立泛洪、Q2 批量门禁、滑行中按 Z、WALL_MEMORY 语义断言。

---

## 6. 本 QA 新增测试清单（不修改 src/）

文件：`tests/unit/qa-gaps-sprint0.test.ts`（4 用例，DQ3 合规）

1. `K6 锁钥深度=2 上界`：3 层串联门 → `computeLockDepth` 返回 `UNSOLVABLE`。
2. `非 expectedSolution 路径星级`：玩家实际路径含 2 个段内回头 → `settle` 返回 `1★`（S1 下限分支）。
3. `连续多次滑行后撤销（深拷贝防别名）`：两滑行各拾 1 钥匙 → 撤销一次 → `keysHeld` 回到 `{0}`（若快照别名则误含第 2 把）；`visited` 单调不回缩。
4. `地图边缘视野越界守卫`：角落玩家 → `visible` 全为 `inBounds` 合法坐标。

> 复跑结果：`npm test` → **Test Files 22 passed (22) / Tests 70 passed (70)**，全绿。

---

*文档结束 · v1.0 · 作者：严守真（quality-lead）· 对应 P5-S0S1-QA*
