# Epic / Story 拆分 · Phase 4 预制作

> **Task ID**：P4-ENG ｜ **角色**：engineering-lead（程基岩）｜ **优先级**：高
> **上游**：`design/phase4-brief.md`（成员 C）｜`docs/architecture/main-architecture.md`｜`docs/architecture/control-checklist.md`｜`docs/architecture/adr/adr-01~04`｜`docs/architecture/architecture-review.md`
> **测试脚手架**：见 `tests/README.md`（Deliverable 2）
> **本文件范围**：仅做 Epic/Story 拆分 + 测试脚手架说明。**不写 src/ 业务实现代码**，仅引用架构/ADR/GDD 给出的契约与验收口径。

---

## 0. 总览：强制 Epic 顺序（不可调换）

顺序由 `phase4-brief.md` 成员 C 与 `architecture-review.md §五` 共同锁定。前序 Epic 不关闭，后续 Epic 的准入闸门不开。

| 序 | Epic | 性质 | 准入闸门（前序依赖） | 说明 |
|---|---|---|---|---|
| **E0** | 脚手架 | 约束先于业务 | 无 | **约束检查脚本先于业务代码落地**；DQ3 / `VISION_R===2（当前值，上限 3，缩小不在禁止范围）` / tile 图集早于首帧 / `draw-cell` 无路径 API 四条代理断言先可跑 |
| **E1** | 域内核 | TDD（C1-C3 + V2-V6 先行） | E0 | 纯逻辑层，无渲染；段切分/星级/滑行/撤销先行 |
| **E2** | 渲染 | **性能尖峰开场（CONCERN-3 准入）** | E1 | 尖峰数据达标后才展开渲染实现；超标→产品级决策 |
| **E3** | 应用壳 | 装配 | E1 | 启动/主循环/顶层状态机 |
| **E4** | 生成器门禁 | 可并行（与 E2/E3） | E1 | 构造式生成 + G1–G6 + 手工入库屏障 |
| **E5** | 每日种子与结算 | — | E3, E4 | 每日引导 + localStorage + 结算面板 |
| **E6** | 内容 | — | E2, E3, E4 | 12 关手工 JSON + 输入装配 + 可访问性 + 兜底 |

**强制顺序理由**：
- E0 先于一切业务代码——四条 CI 代理断言（DQ3 / `VISION_R===2（当前值，上限 3，缩小不在禁止范围）` / tile 图集早于首帧 / `draw-cell` 无路径 API）必须在 `src/` 出现前就可运行，否则"约束检查脚本先于业务代码"空谈。
- E1 先行于 E2——渲染层消费的 `Level` / `RunState` / `cellRenderState` 输入、`VISION_R` 常量、段切分原语都来自 E1；且 C1-C3（GDD② §4.3）、V2/V3/V5/V6（控制清单 C/D 组 + ADR-04）这些契约必须先被单测钉死，避免渲染期才发现域语义漂移。
- E2 以尖峰开场（非收尾）——CONCERN-3 明确"8ms 是纸面拟合未实测"，它是 E2 的**准入条件**：先拿真机数据，达标才往下做；超标则按 §2 的产品级选项决策，渲染实现随降级结论调整。
- E4 可与 E2/E3 并行——生成器不参与运行时（`gen/` 不进主循环），其门禁（G1–G6）独立可测，不阻塞渲染/应用壳。

---

## 1. 各 Epic 的 Story 拆分

估点单位：人天（pd）。"验收口径"列引用架构/ADR/GDD/控制清单的具体条目，便于 Phase 5 直接落地判定。

### E0 · 脚手架（约束先于业务）

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E0-1** | 约束检查脚本（CI 代理断言） | 4 条脚本可独立运行：① `grep -rE "Math\.random" src/ tests/` = 0（DQ3，注意字面量不自指，见 ADR-01 §3.7）；② `metrics.VISION_R === 2` 常量断言（当前值，上限 3）；③ `renderStats.tileAtlasReady === true` 早于首帧（启动期预渲染，未在管线首帧前为 false 即失败）；④ `render/draw-cell.ts` 内 `fill(`/`stroke(`/`strokeText(`/`createRadialGradient(` 0 命中（单格仅 `drawImage`） | 无 | 1.5 |
| **E0-2** | 测试框架与目录落地 | `vitest` 配置 + `tests/{unit,integration,ci-gates}` 目录 + 1 个示例测试（DQ3 grep=0）通过；CI 在 `src/` 空时即可绿 | E0-1 | 1.0 |
| **E0-3** | 常量表骨架（四件套占位） | `core/constants/{palette,metrics,motion,pattern}.ts` 仅常量值，含 `VISION_R=2`（当前值，上限 3，不得改大）、`CELL_PX=40`、`GRID_SIZES=[9,11,13]`、`HUD_H=32`；无逻辑；`VISION_R` 不可由配置改大（M5） | 无 | 1.5 |

> E0 准出：本地 `npm test` 与约束脚本在 `src/` 尚不存在时即全绿，且 CI 阶段把 E0-1 四条列为**强制闸门**。

### E1 · 域内核（TDD，C1-C3 + V2-V6 先行）

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E1-1** | `core/types.ts` 数据模型 | `Level`/`RunState`/`Step`/`ProgressEvent`/`Vec2`/`Dir`/`KeyColor`/`VisionMode` 单点定义（GDD② §3.1/§3.2）；`Level` 无 `source`/`isGenerated` 字段（W4/B2） | E0-3 | 1.5 |
| **E1-2** | `core/rng.ts` 确定性 PRNG | `mulberry32` + `fnv1a32`（ADR-01 §3，逐字照抄 GDD⑥）；全仓唯一实现（`grep "0x811c9dc5"` 仅 1 处）；`deriveAttemptSeed` 哈希派生（ADR-01 §3.4） | 无 | 1.0 |
| **E1-3** | `sim/move.ts` 通行判定 | `canMove`/`resolveMove` 实现（GDD③ §4.1）；`BLOCKED` 零副作用（不计步、无 Step）→ 支撑 **V2**：撞墙 10 次 `steps===0 && path.length===0` | E1-1 | 1.5 |
| **E1-4** | `sim/lockkey.ts` 进度事件 + 依赖深 | `onEnterCell` 产 `ProgressEvent`（GDD③ §4.2，唯一生产者）；`computeLockDepth`（GDD③ §4.3，≤2 层）；K1-K6 全部满足 | E1-1,E1-3 | 2.0 |
| **E1-5** | `sim/segments.ts` 段切分唯一实现 | `splitSegments`/`countBacktrackSegments` 全仓各仅 1 处函数体（W1）；**C1-C3 用例通过**（GDD② §4.3：C1=0 段→3★、C2=1 段、C3=1 段，C1 必 3★）；复杂度 O(path) | E1-1 | 1.0 |
| **E1-6** | `sim/stars.ts` 运行时星级 | `settle(path)` 调唯一原语；**Q4 交叉断言常驻**：同 `Level` 的 `expectedSolution` 喂 `settle()` 必 3★ | E1-5 | 1.0 |
| **E1-7** | `input/glide.ts` 走廊滑行状态机 | S1-S4 全部实现且单测覆盖（控制清单 C 组）；**V3**：环形关卡单次滑行终止且 ≤ `gridSize²` 格（S4 环形走廊保护，防无限绕环） | E1-1,E1-3 | 2.5 |
| **E1-8** | `input/undo.ts` 撤销栈 | 粒度=一次滑行；Z 回滚 `pos/keysHeld/doorsOpened/path/steps`，**`visited` 与 `elapsedMs` 不回滚**（D11）；**V5/W6**：走 5 步撤销后 `path.length` 减、`visited.size` 不减；`RunSnapshot` 不含 `visited` 字段；快照深拷贝防别名 | E1-1 | 1.5 |
| **E1-9** | `sim/runstate.ts` 推进 | 每次成功前进 `path.push` + `visited.add`；`visited` 单调递增；`finished` 为 true 才 `settle`（GDD② B4）；`V2` 撞墙不入 `path` 由 E1-3 保证 | E1-1,E1-3,E1-8 | 1.5 |
| **E1-10** | `sim/visibility.ts` 视野计算 | `computeVisibility` R=2 切比雪夫 + 墙邻感知（GDD① §4.6；2026-09-09 由 3 缩至 2）；**V7/Q2**：记忆区旁相邻墙必在 `visible`；**V6** 关联 `cellRenderState` 四态；零成本（一次 8 邻域） | E1-1 | 1.5 |
| **E1-11** | `util/grid.ts` 网格纯函数 | `key()`/`neighbor()`/`chebyshev()`/越界判定；core 零依赖 | 无 | 0.5 |
| **E1-12** | `core/canonical.ts` 规范化 JSON | `canonicalJSON`（键排序，逐字节比对）（GDD② X7 / GDD⑤ G4）；供存档与每日种子逐字节可比 | 无 | 0.5 |

> E1 准出：C1-C3 全绿、V2/V3/V5/V6 全绿、Q4 交叉断言常驻。C1-C3 与 V2-V6 是 E1 的"先行契约"，必须在任何渲染/应用装配前钉死。

### E2 · 渲染（性能尖峰开场，CONCERN-3 准入）

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E2-0** | **【准入】性能尖峰测试** | 见 §2：跑「三前置全开」vs「缺一对照」两组，13×13 关 9+ 连续 1000 帧 P95 绘制 <8ms；超标按 §2 产品级决策 | E1 | 2.0 |
| **E2-1** | `render/tiles.ts` tile 预渲染 | 墙/门/笔迹三类图案预渲染为 40×40 精灵（art-bible §3）；`pipeline.ts` 引用之（前置①） | E0-3,E2-0 | 2.0 |
| **E2-2** | `render/draw-cell.ts` 单格绘制 | `cellRenderState` 唯一实现（V6 三态/四态单一函数）；单格**仅 `drawImage`**，`fill/stroke/strokeText/createRadialGradient` 0 命中（E0-1④）；`AccessibilityMode` 挂载点预留（`'fogOff'` 覆盖返回值，复用 BAKED 路径，不改 `visible`/`visited`）（架构 §4.3） | E1-1,E1-10,E2-0 | 2.0 |
| **E2-3** | `render/layers.ts` 离屏分层 + 增量 | L0/L1/L2 离屏；L1 增量更新（跨格仅重绘 `dirtyCells`）；`renderStats.lastDirtyCount <= 40`（全量重绘恒=169 即失败，控制清单 F 组代理①）；D-R1/D-R2/D-R3 | E0-3,E2-0 | 2.0 |
| **E2-4** | `render/pipeline.ts` 双路径装配 | 按 `level.visionMode` 切换（非来源）：`full`→全烘焙 <3ms，`fog`→三层增量 5–6ms（ADR-03）；`tileAtlasReady` 早于首帧 | E2-1,E2-2,E2-3 | 2.0 |
| **E2-5** | `render/sprites.ts` 程序化精灵 | 玩家/钥匙/门/出口 程序化绘制 + 墨晕预渲染；禁 `shadowBlur`（控制清单 F 组） | E0-3 | 2.0 |
| **E2-6** | `render/hud.ts` DOM HUD | 顶部 32px、`aria-live`，不占迷宫区高度（V8：1080p 下 520+32 ≤ 592 不滚动） | E0-3 | 1.5 |
| **E2-7** | `WALL_MEMORY` 态码细化 | 墙邻感知的墙以记忆浓度绘制（M-3），只改墨色浓度不改集合语义；浓度取值待 art-director | E1-10,E2-2 | 1.0 |
| **E2-8** | 降级预案开关 | `renderFlags.l2HalfRes` 等 4 级降级（粒子 60→30 / 常驻动效降频 / 墨晕仅钥匙出口 / L2 半分辨率），实测触顶按序启用（ADR-03 §7） | E2-4 | 1.5 |

> E2 准入：E2-0 尖峰数据必须先行。若三前置全开仍 >8ms，先触发 §2 产品级决策，再据结论调整 E2-1~E2-8 实现（例如启用降级③/④）。关 1–8 全烘焙 <3ms 为独立验收。

### E3 · 应用壳

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E3-1** | `index.html` + canvas + HUD 容器 | 挂载 `<canvas>` + `.hud` 容器，引入 bundle；一屏一关无滚动（W5/H 组） | E0-3 | 0.5 |
| **E3-2** | `main.ts` 启动 + rAF 主循环 | 模块装配；主循环驱动 `input→sim→render` 回路（架构 §3.2） | E1,E2 | 1.5 |
| **E3-3** | `state/app.ts` 顶层状态机 | `title→levelSelect→inLevel→settle`（GDD① §4.8）；失败重开/过关进下一关/每日入口 | E1,E2 | 2.0 |

### E4 · 生成器门禁（可与 E2/E3 并行）

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E4-1** | `gen/generator.ts` 构造式四步 | 自避主干解（G3 天然成立）+ 依赖链 + 死路干扰 + 复验回退（GDD⑤ §5）；命名子流（ADR-01 §3.5） | E1-1,E1-2,E1-4 | 3.0 |
| **E4-2** | `gen/gates.ts` G1–G6 | G3 = `replay→splitSegments→countBacktrackSegments`（O(path)，**非搜索**，SV1/Q3）；**Q4** 交叉断言；G4 不在 `generate()` 内（ADR-01 §3.10） | E1-5,E1-6,E4-1,E4-3 | 2.5 |
| **E4-3** | `gen/replay.ts` 重放 | `replay(Level, Dir[])->Step[]`（GDD② §5.1） | E1-1,E1-3,E1-4 | 1.0 |
| **E4-4** | `gen/fallback.ts` 兜底 | `FALLBACK_LEVEL[mid/high]` 预置，过全 G1–G6；8 次全失败必回退（Q8/DQ6） | E1-1 | 1.0 |
| **E4-5** | `tools/qa-gates.ts` 手工入库屏障 | 手工 12 关入库 CI 跑 G1–G3+G5，任一不过即拦截（Q1） | E4-2 | 1.5 |
| **E4-6** | `countDeadEndBranches` | 按 M-2 默认定义实现（非主干地板极大连通分量数 ≤6，互连检测独立泛洪）（GDD⑤ §4.6.1） | E1-1,E1-11 | 1.0 |

### E5 · 每日种子与结算

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E5-1** | `state/daily.ts` 每日引导 | `bootstrapDaily(mainProgress)`：`getDateKeyUTC` 取 UTC 日期键；`unlocked = allMainCleared`；mid/high 各一张（GDD⑥ §4.5） | E3-3,E4-1 | 1.5 |
| **E5-2** | `state/progress.ts` 存档 | localStorage 按 `level.id` 索引最佳星级（`max` 持久化）；`main-*`/`daily-*` 键空间隔离（DQ7） | E1-1,E1-6 | 1.5 |
| **E5-3** | 结算面板 | 星级明细 + 回头路高亮（GDD④ §2.3）；`finished` 后调用 | E3-3,E1-6 | 1.5 |
| **E5-4** | 跨 UTC 午夜结算 | 本局按原 `dateKey` 结算（D-2） | E5-1 | 1.0 |

### E6 · 内容

| Story | 标题 | 验收口径 | 依赖 | 估点 |
|---|---|---|---|---|
| **E6-1** | 手工主线 12 关 JSON | `levels/main/*.json` 过 G1–G3+G5（CI 拦截，Q1）；含 `expectedSolution`（X4/Z1） | E4-5 | 3.0 |
| **E6-2** | `input/keyboard.ts` 输入装配 | 方向键 + WASD 四向滑行；Z=撤销、R=重开、Esc=暂停；禁用 OS auto-repeat + 220/110ms 节流 + 等上一次滑行结束（M2）；`window.blur` 清空输入栈（E6） | E1-7,E1-8,E3-2 | 1.5 |
| **E6-3** | 可访问性挂载点 | `themes: Record<TierName, Constants>` 运行时 select + `AccessibilityMode` 分支（仅 `'fogOff'`）（AC-1~AC-5，L4）；`motionScale=0` 信息仍可见（AC-4） | E0-3,E2-2,E2-6 | 2.0 |
| **E6-4** | 兜底关卡预置 | `levels/fallback/{mid,high}.json` 过全 G1–G6 | E4-4 | 1.0 |

> **Epic 估点合计**（不含尖峰外的管理开销）：E0=4.0，E1=16.5，E2=16.0（含 E2-0 尖峰 2.0），E3=4.0，E4=10.0，E5=5.5，E6=7.5；**合计 ≈ 63.5 pd**。E4 与 E2/E3 并行，关键路径 ≈ E0→E1→(E2∥E3∥E4)→E5→E6。

---

## 2. E2 性能尖峰测试计划（CONCERN-3 准入条件）

> 来源：`architecture-review.md` CONCERN-3 + `control-checklist.md` F 组 `[SPIKE]` 项。本计划是 E2 的**开场动作**，不是收尾。

### 2.1 测试环境与指标

- **设备**：桌面浏览器（Chrome，DevTools Performance / 自建帧耗时埋点），1920×1280 实际像素（960×640 @dpr2）。
- **关卡**：13×13、`visionMode:'fog'`（关 9+ 代表），玩家逐格移动模拟最快 ~8 次/秒跨格。
- **样本**：连续 **1000 帧**，记录每帧「绘制耗时」（不含输入/仿真逻辑，仅 `pipeline` 合成）；取 **P95** 与峰值。
- **硬门槛**：P95 < 8ms（art-bible §3 定为硬门槛，架构 Phase 1 §5 确认）。

### 2.2 两组对照数据（必须同机同关）

| 组 | 配置 | 预期 | 目的 |
|---|---|---|---|
| **G-A（三前置全开）** | tile 预渲染 ✅ + `VISION_R=2`（当前值，上限 3）✅ + L1 增量 ✅ | P95 5–6ms（R=3 基线），达标（R=2 更省） | 验证基线达标 |
| **G-B1（缺 tile 预渲染）** | tile 预渲染 ❌（直绘线段） | 预期 9–11ms，超标 | 验证「缺一则超标」结论① |
| **G-B2（缺 R≤3）** | `VISION_R=5`（81 格） | 预期 8–9ms，超标 | 验证结论②（R=5 明确超标） |
| **G-B3（缺 L1 增量）** | L1 全量重烘焙（跨格 `lastDirtyCount=169`） | 预期 9–11ms，超标 | 验证结论③（脏格数=169 即代理失败） |

> 控制清单 F 组四条 CI 代理断言即为本尖峰的**自动守门**：G-B3 必然使 `lastDirtyCount<=40` 失败、G-B2 使 `VISION_R===2（当前值，上限 3，缩小不在禁止范围）` 失败、`draw-cell` 路径 API 0 命中守卫 tile 预渲染不被绕过——它们能拦截"有人把增量写成全量""有人绕过 tile 预渲染"类回归，**但不能替代真机实测**。

### 2.3 超标时的产品级决策选项（非工程单方面吸收）

若 G-A 实测 P95 ≥ 8ms（或 G-B 对照未能复现 5–6ms 基线与 9–11ms 超标），按序向主理人回报并选用：

1. **接受关 9+ 降帧**：仅关 9+（fog 路径）将渲染目标从 60fps 降至 30fps（其余关卡维持 60fps）；一屏一关、玩法不受影响，但动效流畅度下降。
2. **缩小迷宫**：关 9+ 由 13×13 降为 11×11（`gridSize=11`，渲染宽 440px），视野内格数显著减少；代价是关 9+ 复杂度下降，需重评档位区间（G6）。
3. **削减动效（启用降级预案 ①②③④）**：关 9+ 粒子 60→30、常驻动效降频（出口脉冲 2.0s→3.0s）、墨晕仅用于钥匙/出口、L2 半分辨率离屏放大；纯视觉降级，不改关卡逻辑。
4. **组合**：上述 1+3 通常即可回到 <8ms，作为首选工程可执行组合，但最终取舍（是否接受降帧）由主理人拍板。

> **回报要求**：尖峰数据（G-A/G-B 各组的 P95、峰值、脏格数）出来后**立即回报主理人**；若超标，附建议选项（默认推荐 1+3 组合）等待产品级裁决，不得在工程侧静默放过（ADR-03 §后果：触及 7.5ms+ 须立即启用降级，但"是否接受降帧/缩迷宫"属产品级决策）。

---

## 3. 测试框架与 CI 闸门（摘要，详情见 `tests/README.md`）

- **选型**：`vitest`（轻量、零配置、原生 TS、与 Vite 生态一致；用例代码即 TS，无需 babel 转译；`expect` 风格、快照、watch 齐备）。理由详见 `tests/README.md §1`。
- **目录**：`tests/unit`（纯函数单测）、`tests/integration`（跨模块回路，如滑行→段切分→星级）、`tests/ci-gates`（控制清单可自动化项映射为强制闸门）。
- **示例测试**：`tests/ci-gates/dq3-no-math-random.test.ts` 验证全仓 `Math.random` 0 命中（DQ3）。
- **CI 强制闸门映射**：

| 控制清单项 | 类型 | CI 实现 |
|---|---|---|
| **DQ3** 禁 `Math.random` | `[AUTO]` | `tests/ci-gates/dq3-*.test.ts` + 构建期 `grep` 脚本（E0-1①） |
| **W4** 无来源分支 | `[AUTO]` | 构建期 `grep isGenerated\|\.source\b\|source ==` = 0（E0-1 扩展） |
| **性能三前置** | `[AUTO]` 代理 | ① `lastDirtyCount<=40`；② `VISION_R===2（当前值，上限 3，缩小不在禁止范围）`；③ `tileAtlasReady` 早于首帧；④ `draw-cell.ts` 无路径 API（E0-1 ③④ + E2 单测） |
| **W1** 段切分单点 | `[AUTO]` | `grep "function splitSegments"/"function countBacktrackSegments"` 各仅 1 处（E1-5） |
| **Q4** 星级=G3 | `[AUTO]` | `tests/integration` 交叉断言（E1-6） |

---

## 附录 A · 术语与上游引用一致性

本拆分严格沿用架构/ADR/GDD 术语，避免漂移：

| 术语 | 出处 | 本文件用法 |
|---|---|---|
| `trunk` | GDD⑤ §4.6.1（= `expectedSolution` 覆盖格集合） | E4-6 死路分支定义、E1-5 段切分基准 |
| `expectedSolution` | GDD② §3.1（必含 `Dir[]`） | E1-5/E1-6/E4-2 的 G3/Q4 输入；X4/Z1 缺失即失败 |
| `D9` 死路禁互连 | GDD③ §2.4 / GDD⑤ §4.6 | E4-1/E4-6 互连检测独立泛洪 |
| `G5` 尺寸/依赖/数量/死路合规 | GDD⑤ §4.6 | E4-2/E4-5/E6-1 入库门禁 |
| `cellRenderState` | GDD① §4.7 / 架构 §4.2 | E2-2 唯一实现（V6），含 `WALL_MEMORY` 细化（M-3） |
| `VISION_R` | 架构 §7 / 控制清单 F 组 | E0-3 常量=3（M5 不可改大）；E2 尖峰 R=5 对照 |
| `Level`（单点定义） | ADR-02 / GDD② §3.1 | E1-1 全局唯一，无来源字段（W4） |
| `VISION_R===2（当前值，上限 3，缩小不在禁止范围）` 常量断言 | 控制清单 F 组 | E0-1② CI 代理 |
| `draw-cell` 无路径 API | 控制清单 F 组 | E0-1④ / E2-2 单格仅 `drawImage` |

> 所有 Story 的"验收口径"均回指具体上游条目编号（W1/W2/W4/W5/W6、V2/V3/V5/V6/V7/V8、Q1–Q4、C1-C3、DQ3/DQ7、D9/D11、M2/M5、ADR-01~04、GDD②/③/④/⑤/⑥），确保 Phase 5 实现与验收可逐条核对，无新增未定义术语。

## 附录 B · 与 `tests/README.md` 的关系

Deliverable 2（测试框架选型、目录、示例测试、CI 闸门映射）的完整说明见 **`D:/workbuddy/games/tests/README.md`**，本文件 §3 为其摘要。两者配套落地：E0-1/E0-2 负责把 `tests/README.md` 描述的脚手架与 CI 闸门变为可运行实体。

---

*文档结束 · v1.0 · 作者：程基岩（engineering-lead）· 对应 `phase4-brief.md` 成员 C / P4-ENG*
