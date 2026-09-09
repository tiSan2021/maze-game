# 控制清单 · 上线前逐条勾选（Control Checklist）

> Phase 3 · 技术搭建 | 作者：程基岩 | 配套：`main-architecture.md` + `adr/`
> 用法：Phase 5 实现收尾、Phase 6 打磨前逐项勾选。
> 标记含义：**`[AUTO]`** = CI/脚本强制，不过即构建失败；**`[SPIKE]`** = 需真机/浏览器实测，由指定阶段执行（不可省略，但无法在 CI 判定）；其余为人工 + 单测覆盖。

---

## A. 确定性随机与种子版本绑定（ADR-01 / GDD⑥）

- [ ] **[AUTO] 全仓 `grep Math.random` 必须 0 命中（DQ3）**
      `grep -rE "Math\.random" src/ tests/ || true` 输出为空，否则构建失败。
      ⚠ **自指陷阱**：注释、ESLint 提示、告警文案中**不得**写出该字面量（文档用 `M·random` 代称，源码注释写"禁用内建随机函数"），否则自检自命中。
- [ ] **[AUTO] 时间源不外泄（A6）**：`sim/`、`gen/` 内 `new Date(` / `Date.now(` 0 命中；时间一律经 `Clock` 注入。
- [ ] **[AUTO] 重试种子独立（ADR-01 §3.4）**：`deriveAttemptSeed(s,0..7)` 八条流互不相同且被 golden 快照锁定。
- [ ] **[AUTO] fnv1a32 实现唯一**：GDD⑥ 只给了常数未给实现，实现只在 `core/rng.ts`；`grep -rE "0x811c9dc5" src/` 仅 1 处。
- [ ] **[AUTO] 唯一 RNG 出口**：`grep -rE "mulberry32|fnv1a32" src/ | grep -v "core/rng.ts"` 应仅含 import 引用，算法实现只在 `core/rng.ts`。
- [ ] **[AUTO] 同种子同图（DQ1）**：同 `(dateKey,tier,version)` 在 Chrome/Firefox/Edge 产出 `canonicalJSON(level)` 逐字节相同（脚本批量比对）。
- [ ] **[AUTO] G4 确定性失败即报错**：同 `(seed,tier,version)` 连续两次 `canonicalJSON` 不等时构建/生成器抛错，不允许重生成掩盖。
- [ ] **[AUTO] 版本升级生效（DQ4）**：`generatorVersion` 1→2 同天种子必变；历史 `DailyRecord` UI 标注旧版本且不计入新连胜。
- [ ] 日期口径为 **UTC**（`getDateKeyUTC` 返回 `YYYY-MM-DD`，按 UTC 日历）。

## B. 关卡数据模型同源（ADR-02 / GDD②）

- [ ] **[AUTO] `grep isGenerated` / `source` 必须 0 命中（W4）**
      `grep -rE "isGenerated|\.source\b|source ==" src/ || true` 输出为空。
- [ ] **[AUTO] `Level` 类型单点定义**：`core/types.ts` 唯一；手工 `levels/main/*.json` 与生成器产出共用，无来源字段。
- [ ] **[AUTO] 手工关卡过 G1–G3+G5（Q1）**：`tools/qa-gates.ts` 入库 CI 门禁，任一不过即拦截。
- [ ] **[AUTO] `expectedSolution` 不可缺（X4/Z1）**：缺失即失败非警告。
- [ ] 尺寸口径正确（W5）：13×13 `gridSize===13`、外圈全 `wall`、内部 11×11、渲染宽 520px；9/11/13 三种均校验外圈。

## C. 走廊滑行与撤销语义（GDD① / ADR-04）

- [ ] **[AUTO] 走廊滑行四项停止谓词 S1–S4 全部实现且单测覆盖**
      - S1 前方不可通行即停；S2 当前格有实体即停；S3 垂直可通行邻格即停；**S4 本次滑行已走过即停（环形走廊保护，防无限绕环）**。
- [ ] **[AUTO] 环形走廊不死循环（V3/E1）**：构造环形关卡，单次滑行终止且 ≤ `gridSize²` 格。
- [ ] **[AUTO] 撞墙不产生 step（V2）**：向墙走 10 次，`steps===0` 且 `path.length===0`。
- [ ] **[AUTO] 撤销回滚边界正确（V5/W6）**：走 5 步后撤销，`path.length` 减、**`visited.size` 不减**；`grep -E "visited\s*=\s*snapshot|visited\.delete"` 等回滚写法 0 命中。
- [ ] **[AUTO] `RunSnapshot` 类型中不含 `visited` 字段**（结构性守护 R-B，比 grep 更硬）。
- [ ] **[AUTO] 快照深拷贝**：`keysHeld` / `doorsOpened` 入栈时新建 Set、出栈时**替换实例**而非原地修改（防别名污染）。
- [ ] **[AUTO] 滑行中按 Z（评审 L-5）**：滑行进行到一半按 Z → 剩余格丢弃、`path` 与 `pos` 回到**本次滑行前**状态；`visited` 不变。
- [ ] 长按连走：禁用 OS auto-repeat + 220/110ms 节流 + 必须等上一次滑行结束（M2）；`window.blur` 清空输入栈（E6）。

## D. 段切分与星级一致性（GDD② §4 / ADR-04）

- [ ] **[AUTO] `splitSegments` / `countBacktrackSegments` 各仅一处函数体（W1）**
      `grep -rE "function splitSegments|function countBacktrackSegments" src/` 各仅 1 行。
- [ ] **[AUTO] C1/C2/C3 契约用例通过（W2）**：C1=0 段→3★、C2=1 段、C3=1 段；C1 必须 3★。
- [ ] **[AUTO] G3 复杂度 O(path)（Q3/W3）**：500 步路径判定 < 1ms；代码中**无**对"零回头路解是否存在"的搜索/回溯调用。
- [ ] **[AUTO] Q4 交叉断言常驻（防漂移总闸）**：同 `Level` 的 `expectedSolution` 喂进 `sim/stars.settle()` 必得 3★。

## E. 求解器 / 生成器门禁（GDD⑤）

- [ ] **[AUTO] G3 实现为"验证标注 `expectedSolution` 本身"**（重放→共享原语→计数），非搜索最优解（SV1）。
- [ ] **[AUTO] 连续 30 个每日种子 100% 通过 G1–G6（Q2）** 且无 `fallbackUsed`。
- [ ] **[AUTO] 死路禁互连（D9/Q6）**：生成 100 张随机种子，互连检出率与人工抽查一致，检出后必重生成。
- [ ] **[AUTO] 兜底有效（Q8/DQ6）**：人为让生成器 8 次全失败 → 回退 `FALLBACK_LEVEL[tier]`，当日有题可玩。
- [ ] 三级回退链存在：换种子（≤8）→ 降级（缩长度/减门/降尺寸）→ 预置兜底。
- [ ] **[待裁决 M-2] `countDeadEndBranches` 定义已确认**：GDD⑤ §4.6 引用但全仓无定义。默认 = 非主干地板的极大连通分量数（≤6）；**互连检测必须独立泛洪，不能用计数代替**（两分支相连反而使分量数变少）。
- [ ] **[AUTO] 生成耗时（A7）**：单张 13×13 生成 P95 < 50ms（埋点断言）；两张在关卡选择界面空闲预生成，点击到可玩 <100ms。
- [ ] **[AUTO] 重试次数遥测（A8/Q2）**：连续 30 天 `fallbackUsed=false` 且**平均 attempts ≤ 2**；若 >2 则调整步骤 1 的采样策略（改为带目标长度偏置的 DFS）而非放宽门禁。

## F. 渲染分层与性能预算（ADR-03 / art-bible §3）

- [ ] **[AUTO] 三必做前置已声明为不可省略项**（缺一则关 9+ 9–11ms 超标）：
      1. 墙/门/笔迹三类图案**预渲染为 tile 精灵**（`render/tiles.ts` 存在且被 `pipeline.ts` 引用）。
      2. 视野半径 **R ≤ 3**（`metrics.ts` 中 `VISION_R === 3` 单元断言）。
      3. L1 记忆层**增量更新**（跨格仅重绘 `dirtyCells`，非全量重烘焙）。
- [ ] **[SPIKE·Phase 4 E2] 实测绘制 < 8ms**：1920×1280 实际像素（960×640 @dpr2）、13×13、关 9+ 连续 1000 帧 **P95 < 8ms**。
      art-bible §3 的 `3.83ms + 0.058ms×格数` 是**纸面拟合、未实测**；本项为唯一真实判定。必须同时跑"三前置全开"与"缺一对照"两组，验证 9–11ms 的超标结论。
      若超标，按序启用降级 ①②③④ 并回报主理人（可能需接受关 9+ 降帧或缩小迷宫）。
- [ ] **[AUTO] 性能三前置的 CI 代理断言**（真机实测无法在 CI 判定，故设代理指标拦截回归）：
      1. `renderStats.lastDirtyCount <= 40`（跨格一次；若被写成全量重绘则恒等于 169 → 立即失败）；
      2. `metrics.VISION_R === 3` 常量断言，且代码中无 R=4/5 分支；
      3. `renderStats.tileAtlasReady === true` 早于首帧；
      4. **`render/draw-cell.ts` 内 `fill(` / `stroke(` / `strokeText(` / `createRadialGradient(` 0 命中** —— 单格绘制只允许 `drawImage`（tile 预渲染前置的自动化守卫）。
- [ ] **[AUTO] 禁 `shadowBlur`**：`grep -rE "shadowBlur" src/ || true` 输出为空。
- [ ] **[AUTO] R 恒定为 3**：`VISION_R` 不可由配置改大；R=4/5 不在任何代码路径（M5）。
- [ ] 关 1–8 回退全烘焙（L0+L2 合并单张静态层），每帧 <3ms。
- [ ] HUD 走 DOM（顶部 32px，`aria-live`），1080p 下 520+32 ≤ 592px 不迫使滚动（V8）。
- [ ] 降级预案就绪：关 9+ 粒子 60→30 / 常驻动效降频 / 墨晕仅钥匙出口 / L2 半分辨率（实测触顶按序启用）。

## G. 视野 / 四态与可访问性骨架（GDD① §4.6–4.7 / art-bible §4）

- [ ] **[AUTO] 三态/四态单一函数（V6）**：`cellRenderState` 唯一实现；关 1–8 任意帧不出现 `UNKNOWN`/`MEMORY_WALKED`，关 9+ 可达两态。
- [ ] **[AUTO] 墙邻感知生效（V7/Q2）**：记忆区旁相邻墙必在 `visible`；墙邻感知引入的墙以 **`WALL_MEMORY` 记忆浓度**绘制（M-3 细化，非 `WALL` 全浓度）。
- [ ] **[待裁决 M-1] art-bible §2⑦ C 态「已探索·未走过」是否实现**：GDD① 四态模型下该态不可达。默认**不实现**（需第三个 `seen` 集合 + 第五态，且 C/D 区分度 1.52:1 vs 1.21:1 远低于 3:1）。主理人若裁决实现 → 回改 GDD①，本清单 G 组需增项。
- [ ] 常量表隔离就绪：`palette.ts`/`metrics.ts`/`motion.ts`/`pattern.ts` 承载全部可变参数，绘制/逻辑只引用不硬编码。
- [ ] **可访问性升级绝大多数 = 换常量**：三型色盲色表/高对比/迷雾减淡→`palette.ts`；图案密度→`pattern.ts`；动效→`motion.ts`；字号→`metrics.ts`。`core/constants/` 以 **`themes: Record<TierName, Constants>` 对象导出 + 运行时 select** 落地（非扁平静态 import），绘制/逻辑代码不改。
- [ ] **关闭迷雾 是架构预留的唯一渲染代码分支（AC-4 / L4 解答）**：`render/draw-cell.ts` 的 `cellRenderState` 接受 `AccessibilityMode` 覆盖参数（`'fogOff'` → 全部按状态 A 绘制），**复用关 1–8 全烘焙路径、成本 0.1 人天、不改变 `visible`/`visited` 集合**（符合 GDD① §4.7，W4/Q4 不受影响）。其余可访问性选项（迷雾减淡/色盲色表/高对比）**仅靠切换常量**实现，不引入新渲染代码路径。
- [ ] **A5 口径纠正（仅约束「移动插值 ≤ 200ms」）**：三类动效分治——① **移动插值 120ms** 受 A5 约束；② **交互反馈**（撞墙 80ms / 拾取 200ms）受约束且本就在限内；③ **过场与结算动效不受 A5 约束**（开门 280 / 过关 400 / 切关 250+250ms），其免责前提：不阻塞输入（≤200ms）、受 `motionScale` 控制、不承载"必须被看见才知道"的信息。**唯一例外**：门由「交叉网格→实心」的状态联动在 `motionScale=0` 时**必须以瞬时切换保留**。
- [ ] **失败反馈（art-bible v2.1）**：红褐 vignette **250ms / 闪 1 次**（`FAIL_VIGNETTE_MS=250`、`FAIL_VIGNETTE_BLINKS=1`）；原 320ms/闪 2 次 折算 6.25Hz 超 WCAG 2.3.1 的 3Hz 上限，已纠正（AC-5）。

## H. 尺寸与一屏一关（锚点 5 / A6）

- [ ] **[AUTO] 无摄像机滚动**：所有关卡一屏渲染，最大 13×13×40=520 ≤ 592px 可用高度；引擎无 scroll / camera 模块。
- [ ] 单元格 40px 恒定、不做"变小显示更多"。

---

## I. 可访问性门禁（AC-1…AC-5，原 Phase 1「识别率 G1」改名，避免与 GDD⑤ G1–G6 撞号）

> 改名原因：Phase 1 曾把"识别率门禁"也叫 G1，与 GDD⑤ 的 G1–G6 生成器/求解器门禁撞号（GDD⑤ 中 G1–G6 共 46 处）。**生成器/求解器门禁保留 G1–G6 不变**；可访问性门禁统一用 **AC-1…AC-5**。

- [ ] **[SPIKE·Phase 6 G1] AC-1 六类元素 1 秒可识别性**：3–5 名未参与开发者，关 1 画面闪现 1 秒后指认六类元素（墙/路/玩家/钥匙/门/出口），平均识别率 ≥90% 且单类 ≥80%（不通过则按 art-bible §5 门禁 G1 顺序上调信号色深度）。
- [ ] **[AUTO] AC-2 关 1–8 无 `UNKNOWN`**：`visionMode:'full'` 关卡任意帧 `cellRenderState` 不返回 `UNKNOWN` / `MEMORY_WALKED`（V6/A2）。
- [ ] **[SPIKE·Phase 6] AC-3 对比度实测**：文本 ≥4.5:1（主 ≥7:1）、信息图形识别线 ≥3:1，去色后仍可经形状/图案区分（art-bible §4 落实清单）。
- [ ] **[AUTO] AC-4 `motionScale=0` 信息仍可见**：减动效开关开启时，功能完整——门由「网格→实心」的状态联动以瞬时切换保留；关闭迷雾分支（`AccessibilityMode:'fogOff'`）不改变 `visible`/`visited`/`path`/星级（Q4/W4）。
- [ ] **[AUTO] AC-5 无 ≥3Hz 闪烁**：全局闪动频率 <3Hz（WCAG 2.3.1）；失败反馈 vignette **250ms / 闪 1 次**（见 G 组），原 320ms/2 次（6.25Hz）已纠正。

---

## J. 发布闸门汇总（Phase 5 收口 / Phase 6 入口）

**任一带 `[AUTO]` 项未通过 → 禁止进入发布。** 三条最硬指标：

| 硬指标 | 判据 | 为什么是底线 |
|---|---|---|
| **DQ3** | `grep -rE "Math\.random" src/ tests/` = **0 命中** | 确定性底线；跨浏览器"同种子同图"静默失效不可观测 |
| **W4** | `grep -rE "isGenerated\|\.source\b\|source ==" src/` = **0 命中** | 手工/生成同源底线；来源分支会让每日图绕过门禁 |
| **性能三前置** | tile 预渲染 / R≤3 / L1 增量，三者缺一不可省略 | 缺一 → 关 9+ 由 5–6ms 涨到 9–11ms，击穿 8ms 门槛 |

**`[SPIKE]` 项（只有一项：绘制 <8ms）在 Phase 4 E2 必须完成**，它是唯一无法由 CI 判定、却直接决定"关 9+ 迷雾是否可交付"的指标。CI 只守代理断言，不能替代它。

**上线前仍需人工确认的三条跨文档裁决**（见 `main-architecture.md` §10）：M-1（art-bible C 态是否实现）/ M-2（死路分支计数定义）/ M-3（`WALL_MEMORY` 细化，工程侧已默认吸收）。
