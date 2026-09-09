# Phase 5 · Sprint 6（E6-1/2/3）完成记录：主线 12 关 + 选关 + 键盘连走 + 可访问性挂载点

> 主理人：游承峰 | 执行：content-levels（E6-1 关卡数据）+ 主理人（E6-2 输入装配 / E6-3 可访问性挂载点 / 接线 / 验证）| 评审强度：lean
> 基线：39 文件 / 175 用例 → **43 文件 / 203 用例全绿；tsc 0 错误**
> 已交付：**E6-1（主线 12 关 + 选关接线）+ E6-2（键盘输入装配）+ E6-3（可访问性挂载点：fogOff / motionScale 开关 + 持久化）**

---

## 0. 用户拍板的两项决策

1. **关卡来源 = 混合**：L1–8 手工字符图（教学序列）+ L9–12 用现有生成器固定种子。依据 `concept.md:239`「主线是教学序列，不让生成器替代手工关卡」，而现有生成器固定 13×13 + 双锁 + fog，产不出关 1–8。
2. **本次范围 = E6-1 + 选关接线**（不含 E6-2 输入装配、E6-3 可访问性挂载点）。

## 1. 交付物

| 文件 | 职责 |
|---|---|
| `src/content/main-levels.json` | **12 关题库**（45KB），由脚本过门禁后固化；运行时只读，启动零开销 |
| `scripts/build-main-levels.ts` | 构建脚本：字符图 → BFS 求解 `expectedSolution` → 算 meta → 跑门禁 → **全过才写 JSON** |
| `src/content/main-levels.ts` | 加载器：`MAIN_LEVELS` / `mainLevelCount()` / `getMainLevel(n)` / `mainLevelNumber(id)` |
| `src/state/app.ts` | `bestStarOf` / `isMainUnlocked` / `enterMainLevel` / `nextMainLevel` / `hasNextLevel` / `formatLevelLabel` |
| `src/main.ts` | 选关界面（12 关网格 + 星级 + 锁定态，`←/→` 选关、`Enter` 进入）、结算「下一关」真正生效、HUD 标签 |
| `src/render/hud.ts` | 新增可选 `levelLabel`（缺省退回 `levelId`，向后兼容） |
| `tests/ci-gates/main-levels-gates.test.ts` | 入库门禁闸门（5 条） |
| `tests/unit/main-level-select.test.ts` | 解锁递进 / 下一关链路 / HUD 标签（5 条） |

## 2. 12 关实际数据（主理人独立复验，非采信汇报）

| id | 尺寸 | 视野 | 锁深 | 钥匙/门 | 死路 | 解法长度 | G1 | G2 | G3 | G5 | G6 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| main-1 | 9×9 | full | 0 | 0/0 | 0 | 12 | ✓ | ✓ | ✓ | ✓ | — |
| main-2 | 9×9 | full | 0 | 0/0 | 2 | 12 | ✓ | ✓ | ✓ | ✓ | — |
| main-3 | 9×9 | full | 0 | 0/0 | 4 | 12 | ✓ | ✓ | ✓ | ✓ | — |
| main-4 | 11×11 | full | 1 | 1/1 | 4 | 16 | ✓ | ✓ | ✓ | ✓ | — |
| main-5 | 11×11 | full | 1 | 1/1 | 6 | 16 | ✓ | ✓ | ✓ | ✓ | — |
| main-6 | 11×11 | full | 1 | 1/1 | 2 | 16 | ✓ | ✓ | ✓ | ✓ | — |
| main-7 | 11×11 | full | 1 | 1/1 | 4 | 16 | ✓ | ✓ | ✓ | ✓ | — |
| main-8 | 11×11 | full | 1 | 1/1 | 6 | 16 | ✓ | ✓ | ✓ | ✓ | — |
| main-9 | 13×13 | fog | 2 | 2/2 | 2 | 36 | ✓ | ✓ | ✓ | ✓ | ✓ mid |
| main-10 | 13×13 | fog | 2 | 2/2 | 3 | 58 | ✓ | ✓ | ✓ | ✓ | ✓ high |
| main-11 | 13×13 | fog | 2 | 2/2 | 3 | 36 | ✓ | ✓ | ✓ | ✓ | ✓ mid |
| main-12 | 13×13 | fog | 2 | 2/2 | 2 | 56 | ✓ | ✓ | ✓ | ✓ | ✓ high |

节奏符合 `concept.md §4.2`：关 5 死路 6 > 关 6 死路 2（高峰→喘息）；关 10 长度 58 > 关 9 的 36（关 9 拓扑下调一档作跃升补偿）> 关 11 的 36（喘息）。

**G6 对 L1–8 不适用**：长度带 mid ∈[35,55] / high ∈[50,80] 是给每日题的，教学小关 12–16 步是设计意图（E6-1 原文只要求 G1–G3 + G5）。已如实列入上表，未放宽门禁。

## 3. 执行中发现的一个真实冲突（值得记入风险）

**生成器不保证 `lockDepth=2`。** `generate()` 只拒绝 `UNSOLVABLE`，返回首个门禁全过的 attempt，而自避主干常折回形成空间捷径，绕过第二道门 ⇒ 实际依赖深度退化成 1 或 0。成员实测：mid/high 各 400 个 seed 中 `lockDepth=2` 仅占 **3–5%**。

⇒ 直接用 `fnv1a32('main-N|v1')` 出的 L9–12 **全部是 ld=0/1**，等于「出口能绕开门」，会同时违反 D2 教学纪律与三星可达性语义（G3 仍过，但门形同虚设）。

**处理**：启用规格里的换种子重试机制，对 L9–12 用 `main-N|v1|rK` 后缀持续重试直到真的产出 `ld=2` 且门禁全过（最终 r53 / r30 / r11 / r173）。**未更换生成器、未放宽门禁**，且 CI 闸门 `main-levels-gates.test.ts` 会持续用 `computeLockDepth` 复核这一点。

> 遗留建议：这是生成器本身的性质问题，日后若主线要扩到更多 L2 关，应让 `generate()` 支持 `requireLockDepth` 选项，而不是靠外部重试碰运气。

## 4. 偏差记录（与既有约定的不一致，均为主理人裁决）

1. **动了 `src/render/hud.ts`**（E5 简报曾写「不得修改 hud.ts」）：新增**可选** `levelLabel?: string`，渲染 `m.levelLabel ?? m.levelId`。原因：不改造就显示为「关卡 main-3」，违反 UX §2.2 的「第 7 关 / 每日 · 中」。改法是纯加法、向后兼容，既有 HUD 测试未受影响。
2. **题库是单文件 JSON，不是 `levels/main/*.json`**（epic-split 原文）：12 关打包为 `src/content/main-levels.json`，便于加载与整体验证；关卡本身仍是「手工字符图 + 脚本编译」的产物，符合「手工」的实质。

## 5. 已知限制

1. **浏览器未验证**：Node 环境无 DOM/Canvas。选关界面、结算「下一关」、HUD 标签、连走节奏、设置面板均通过纯逻辑与 HTML 字符串断言，**未声称浏览器已跑过**。
2. **E6-3 已接但浏览器未验**：可访问性挂载点（F5 迷雾开关 / M2 减少动效开关 / 持久化）代码已落地、单测与 tsc 全绿，但开关的实际观感（迷雾实时消失 / 动效档位生效）需在浏览器里由用户目视确认。
3. **每日分区仍需主线全清**：现在真的能打通 12 关了（不再需要 console 写存档作弊），但演示一遍仍需通关 12 关；想快速看每日，仍可用 sprint5 记录里的 localStorage 命令。
4. **U5 字号三档（`--ui-scale`）未做**：HUD 固定 32px，放大需美术方向拍板，否则可能破 V8「一屏一关」。与 E6-3 的「信息不丢」开关解耦，单列待办。

## 6. E6-2 键盘输入装配（后补，已完成）

**交付**：新增 `src/input/keyboard.ts`（纯逻辑、不碰 DOM）+ `tests/unit/keyboard-input.test.ts`（10 条）；`src/main.ts` 改为由它驱动滑行。

| UX §3.1 要求 | 实现 |
|---|---|
| 一次按下 = 一次滑行 | `pressDir` 置 `pendingImmediate`，下一帧立即兑现 |
| 禁用 OS auto-repeat | `pressDir(dir, repeat=true)` 直接丢弃（`main.ts` 顶层另有 `e.repeat` 兜底） |
| 220ms 后开始连走，之后每 110ms | `INITIAL_DELAY_MS=220` / `REPEAT_DELAY_MS=110`，`nextRepeatAt` 节流 |
| 连走须等上一次滑行结束 | `awaitingSlide` 闸门，未 `notifySlideDone()` 前不发起下一次 |
| 多方向以最近按下为准 | `dirStack` 栈，栈顶生效；松开回落到次顶 |
| `window.blur` 清空输入栈 | `blur()` 清栈 + 清 pending |
| 快速点按不丢输入 | 松手不清 `pendingImmediate`（按下即松开仍兑现一次滑行） |

时间源经构造参数注入（默认 `performance.now()`），所以连走节奏在 Node 下可用假时钟精确断言。

**一处诚实说明**：`applySlide` 是同步的，滑行没有视觉动画，因此 `notifySlideDone()` 目前在 `app.move()` 之后立即调用 —— 「等上一次滑行结束」当前等价于「等下一帧」，节奏由 220/110ms 定时器真正控制。接入滑行动画（Phase 6）后应改由动画结束回调触发，语义不变，已在代码注释里写明。

## 7. 如何亲自验证

```bash
npx vite     # http://localhost:5173/
```
`Enter` 进入 → 选关界面 12 个格子（`←/→` 选、第 1 关恒开、`Enter` 进）→ 方向键/WASD 滑行（**长按可连走**：按住约 0.2 秒后开始、之后匀速），Z 撤销、R 重开、Esc 暂停 → 通关看结算（`Enter` 重玩 / `N` 下一关 / `Q` 返回选关）。

## 8. 下一步

- **Phase 6 打磨**：≥3 轮 Playtest、性能剖析、资产审计、音频。
- **U5 字号三档**（美术方向待拍板，避免破 V8「一屏一关」）。

---

## 10. Phase 6 代码层打磨（已完成：工程性能 + 质量回归）

> 用户拍板范围：**仅代码层打磨**（不新建音频系统、不动美术大方向）。真实 Playtest（浏览器试玩）与浏览器内帧率由用户自验。
> 工程线与质量线并行；工程 worker 在环境内启动失败，由主理人直接落地。

### 10.1 工程线 · 性能剖析 + 预算门
- **新增** `tests/ci-gates/perf-budget.test.ts`（4 条）：以 `main-12`（13×13 / fog / 双锁）为最坏路径，每帧镜像 `main.ts frame()` 的 PLAYING 分支（`computeVisibility` + `moveTo` + `renderFrame`），预热 60 帧后连跑 200 帧取均值。
- 防护设计：① WALK_PATH 合法性断言（全 floor + 正交相邻 + 起止点对齐），基准不会悄悄失效；② 反自欺门——用记录型 fake 画布证明每帧确有绘制量（drawImage >10）；③ 剖析段归因（computeVisibility / moveTo / renderFrame 分离计时）。
- **实测（JS 逻辑侧，fake 画布无栅格）**：均值 **0.626ms** · p95 0.96ms · 最大 1.68ms，预算 16ms（余量 25.6×）。最热函数为 `moveTo`（0.229ms，含二次 `computeVisibility` + `updateL1` 169 格扫描），`renderFrame` 仅 0.083ms。**均在预算内，无需优化**。
- 预算门性质：守 CPU/算法侧复杂度与每帧分配回归（如 O(169²)、每帧重烘焙）；真实 GPU/栅格耗时为浏览器自验项。

### 10.2 质量线 · Playtest 计划 + 回归测试
- **新增** `design/phase6-playtest-plan.md`：4 轮 Playtest（功能冒烟 / 可访问性 / 手感性能 / 边界异常），每轮列目标、步骤、通过标准，并标注 `[浏览器自验]` 项（UI 跳转观感、关雾后真机确认、刷新持久化、连走手感、主观帧率等）。文末附「自动化 vs 浏览器自验」对照表。
- **新增** `tests/unit/app-edge.test.ts`（7 条）：`undo()` 在 MENU/无历史安全 no-op；`restart()` 完整重置（steps/elapsed/visited 归零）；`restart/move` 非游玩态安全 no-op；`enterDaily` 在主线未全清时被拦截（返回 false、不崩）；`canShowDaily()` ↔ `isMainAllCleared()` 一致。
- **新增** `tests/unit/settings-persist.test.ts`（4 条）：坏存储下 `loadSettings` 回落默认、`saveSettings` 返回 false；`fogOff=true` 读回仍为 true 且 `motionScale` 不变；两开关字段独立演进互不污染。
- **改动** `tests/integration/render-pipeline.test.ts`（+1 条）：`fogOff:true` 构造 `RenderPipeline` 跑 `renderFrame` 不抛错（BAKED 分支在 13×13 雾关可运行，不改可见性/星级语义）。

### 10.3 验证与诚实说明
- 全量 **46 文件 / 219 用例全绿；tsc 0 错误**（基线 203 + 质量 12 + 工程 4）。
- **未做 git commit**（高影响动作待用户批准）。
- **浏览器相关项未自验**：连走手感、关雾后信息完整性/星级一致的真机确认、刷新后设置持久化、13×13 主观帧率——均需用户 `npx vite` 按 `phase6-playtest-plan.md` 第 2/3 轮自验。代码中**未发现真实 bug**，上述边界均按预期安全返回。

---

## 9. E6-3 可访问性挂载点（已完成）

**设计原则（仅「关闭即不丢信息」的开关）**：E6-3 只暴露两个可关项，二者关掉后**信息仍完整可见**，不构成降级：

| 开关 | 键 | 实现 | 为何「关也不丢信息」 |
|---|---|---|---|
| 迷雾关闭（F5） | `F` | 重建渲染管线，`fogOff:true` → 复用 **BAKED** 路径（关 1–8 同款） | 不改 `visible`/`visited`/`path`，不影响星级；仅去掉实时迷雾观感 |
| 减少动效（M2 / AC-4） | `M` | `motionScale` 在 `EntityView` 中传递，循环 全开→半量→关闭 | 0 时装饰动效消失，门/钥匙/路径等**必需信息瞬时可见**，不承载信息 |

**不可关（levels.md 降级底线，E6-3 不提供开关）**：图案填充 V2、钥匙双编码 V3、对比度 V5–V6、墙邻感知 F3 —— 这些是「不丢信息」的硬保障，关掉反而丢信息，故强制常开。

**交付**：

| 文件 | 职责 |
|---|---|
| `src/state/settings.ts`（新） | `A11ySettings` / `loadSettings`（脏数据·旧版本·不可用→回落默认）/ `saveSettings`（失败退内存态）/ `nextMotionScale` 循环 / `motionLabel` |
| `src/main.ts` | `S` 在 MENU/PAUSED 开设置面板；面板内 `F` 切迷雾（→`loadPipeline()` 重建）、`M` 切动效、`Esc` 关；每次切换 `saveSettings` 持久化；`fogOff` 注入 `RenderPipeline`，`motionScale` 注入 `EntityView`（AC-4）；菜单提示「按 S 设置」 |
| `tests/unit/settings.test.ts`（新） | 读写一致 / null 存储 / 脏数据·旧版本·字段非法降级 / 动效档位循环 / 标签映射（6 条） |

**验证**：E6-3 新增 6 条单测，全量 **43 文件 / 203 用例绿，tsc 0 错误**。

**诚实说明**：Node 无 DOM/Canvas，设置面板与两项开关的实际观感（迷雾实时消失、`motionScale` 对精灵呼吸/过场的影响）**未在浏览器目视确认**，需用户在浏览器里按 `S` → `F`/`M` 验证。开关的**逻辑**（持久化、回落默认、管线重建触发）已由单测覆盖。

---

## 11. Phase 6 后续功能：音频系统（已完成）

> 用户拍板范围扩展：「音频系统」——此前代码层打磨明确排除的新功能，现从零搭建。无第三方库、无音频资源文件（纯 WebAudio 合成）。

### 11.1 架构与实现
- **新增** `src/audio/sfx.ts`（`SfxEngine`）：
  - 五种事件音**合成短音**：`move`（方波 220Hz）、`pickup`（三角波 660Hz）、`door`（锯齿波 330Hz）、`win`（523→1047Hz 上行琶音）、`invalid`（方波 110Hz 撞墙提示）。
  - 浏览器策略：AudioContext 必须在用户手势内创建/恢复 → `main.ts` 在首个 `keydown` 调 `sfx.unlock()`（幂等；`suspended` 时 `resume()`）。
  - **静音开关**：`setMuted` / `toggleMute` / `isMuted`；偏好经 `StorageLike` 持久化（key `maze.audio.muted`，与设置/进度同源；失败退内存态）。
  - Node/测试无 AudioContext：`play` 静默 no-op 且不抛错（可独立单测）。
- **`src/state/app.ts`**：`move(dir)` 返回类型由 `void` 改为 `MoveOutcome`（`ignored` / `blocked` / `moved{pickedKey,openedDoor,won}`），通过对 `run` 状态**前后 diff** 区分撞墙/拾取/开门/通关——**不重写 sim 语义**，仅扩展返回信息。所有既有调用方忽略返回值，向后兼容。
- **`src/main.ts` 接线**：
  - 实例化 `const sfx = new SfxEngine({ storage })`；`onKey` 顶部 `sfx.unlock()`。
  - 主循环 `input.update` 回调捕获 `outcome`：撞墙→`invalid`；移动→`move` +（拾取→`pickup`、开门→`door`、通关→`win`）。
  - 设置面板新增 **`X` 静音切换**（与 F5 迷雾、M2 动效并列），`settingsHtml` 显示音效当前状态。

### 11.2 测试与验证
- **新增** `tests/unit/sfx.test.ts`（6 条）：默认未静音、toggleMute 翻转+持久化+新实例恢复、setMuted(false) 写回、存储 "1" 初始化即静音、null 存储退内存态不抛错、无 AudioContext 环境 play 全事件名不抛错。
- 全量 **47 文件 / 225 用例全绿；tsc 0 错误**（219 + 6）。
- **未做 git commit**（高影响动作待用户批准）。

### 11.3 诚实说明
- **音效实际听感无法在 Node 验证**：合成音色/音量/通关琶音是否悦耳、移动音是否过密（连走 110ms 一次），需用户 `npx vite` 用耳朵确认；代码层已确保「不崩、按事件触发、可静音持久化」。
- 无背景音乐（MVP 范围，art-bible 未要求 BGM；如需后续可加低频环境音，属新范围）。


## 12. 主线关卡扩展：12 → 24 关（已完成）

> 用户拍板范围扩展：「扩展至 ~24 关（推荐）」——**零引擎改动**（不碰生成器 gridSize/lockPairs、不改 sim）。所有新增关（L13–24）沿用既有「13×13 / 迷雾 / 双锁（lockDepth=2）」规格，仅增加数量并把难度整体拉向 high。

### 12.1 改动内容
- **`scripts/build-main-levels.ts`**：
  - `GEN_TIERS` 由仅 `9–12` 扩展为 `9–24`，tier 在 mid/high 间铺排、**整体偏 high**（9 mid / 10 high / 11 mid / 12 high / 13 high / 14 mid / 15 high / 16 high / 17 mid / 18 high / 19 high / 20 mid / 21 high / 22 high / 23 mid / 24 high）。
  - 生成主循环 `for (let n = 9; n <= 12; ...)` → `n <= 24`。
  - `GEN_SEARCH_CAP` 200 → 600：为 16 个新 seed 降低「ld=2 重试耗尽」风险（cost 仅体现在失败重试，命中即停）。
  - L1–8 手工图与 9–12 生成逻辑**完全不动**，仅扩数量。
- **`src/sim/progress.ts`**：`MAIN_LEVEL_COUNT = 12` → `24`（GATE_DAILY 现要求 24 关全 ≥1★）。
- **`src/main.ts`**：选关态 `while (n < 12 …)` 与 `for (let n = 1; n <= 12 …)` 改为引用 `MAIN_LEVEL_COUNT`（新增 `import { type StorageLike, MAIN_LEVEL_COUNT }`）。
- **注释同步**：`app.ts` / `settlement.ts` / `daily.ts` / `main-levels.ts` / 各测试中的「第 12 关 / 主线 12 关」→「第 24 关 / 24 关」。
- **测试对齐**：
  - `tests/ci-gates/main-levels-gates.test.ts`：`TIER_OF` 扩至 9–24；`toBe(12)` → `toBe(24)`；`getMainLevel(13)` 越界断言 → `getMainLevel(25)`；G6 长度带校验循环由 `[9,10,11,12]` 扩为 `9..24`。
  - `app-edge` / `daily-bootstrap` / `main-level-select` 三处「全 1★ 解锁每日」循环由硬编码 `i <= 12` 改为 `i <= MAIN_LEVEL_COUNT`；`main-level-select` 的「最后一关无下一关」断言 `enterMainLevel(12)` → `(24)`，`getMainLevel(13)` → `(25)`。

### 12.2 产物与验证
- **重新生成 `src/content/main-levels.json`**：24 关全绿写入。报告摘录——L1–8 手工（G6 按设计豁免，仅 G1/G2/G3/G5 必过）；L9–24 全部 13×13 / fog / lockDepth=2，且 **G1–G6 全 PASS**。生成用 seed 后缀如 `main-13|v1|r29`、`main-24|v1|r68`。
- **难度分布（生成关 expectedSolution 步数）**：high 档多落在 50–58 步、mid 档 36–40 步——整体偏长（high 占多数），呼应「偏简单」诉求。
- **`tsc --noEmit` 0 错误；`vitest run` 47 文件 / 225 用例全绿**（含 CI 闸门 `main-levels-gates` 现已断言 24 关）。

### 12.3 诚实说明与边界
- **难度上限未突破**：本次为「零引擎改动」，单关最高仍是 lockDepth=2 / 13×13 / 迷雾——与旧 L9–12 同级。要进一步加难（三锁、更大网格、更密死路）需改动生成器 `lockPairs`/`gridSize` 与 `computeLockDepth` 轮次，属用户已明确排除的引擎改动范围。
- **实际手感无法在 Node 验证**：新 24 关的「好玩 / 难度曲线是否顺」需用户 `npx vite` 实机试玩确认；代码层已确保「结构合规、门禁全过、数量与解锁链路自洽」。
- **未做 git commit**（高影响动作待用户批准）。


## 13. 难度上限突破：三锁（lockDepth=3）+ 门必须钉在「卡点」上（已完成）

> 用户拍板「真正提升难度上限」。本项**改了引擎内核**，并顺带修掉一个长期潜伏的正确性缺陷。

### 13.1 先测量、别猜：三锁最初失败的真因
- 现象：把 `lockPairs` 提到 3、`computeLockDepth` 泛洪轮次提到 3 后，生成仍稳定得到 `lockDepth=0/1`，600 次换种子也不成功。
- **误判一次**：先怀疑「ultra 长度带 [60,80] 太长、自避路径搜不到 → 生成器降级到 relaxed(lockPairs=1)」，把长度带下调后**依旧失败**。
- **实测定位**（`tmp/diag2.ts`）：自避主干是一条**会自我贴邻的蛇**——单关可达 **50 对非连续主干格网格相邻**。于是泛洪可以从贴邻处**绕过每一道门**：初始可达 70/71 格，**不开任何门即可抵达出口**。门摆在主干固定比例位（33%/66%/85%）上，形同虚设。
- 推论：此前 `lockDepth=2` 并非设计保证，而是**靠换种子筛出来的偶然**——`main-9/10/11/12` 分别重试到第 53/30/11/173 个种子才命中「门恰好堵住」的关。

### 13.2 修法：门钉在卡点上
- **新增** `findChokePoints()`（`src/gen/generator.ts`）：逐个把主干格当墙做一次泛洪，若 start 到不了 exit，则该格是**卡点**。
- **重排 `construct()` 步骤**：原「放门钥 → 铺死路」改为「**铺死路 → 找卡点 → 在卡点上放门**」，门在最终网格（含死路）上判定，且卡点数不足 / 段落放不下钥匙时直接换种子。
- 门在卡点列表上均匀取 `lockPairs` 个（沿主干严格递增）；钥匙置于「上一道门之后、本道门之前」的段落中点 ⇒ **必须先开上一道门才取得到下一把钥匙**，形成真正的串联依赖。
- ultra 档追加硬校验：`lockPairs>=3 && ld!==lockPairs ⇒ return null`（防止门沦为装饰）。

### 13.3 引擎扩容清单
| 位置 | 改动 |
|------|------|
| `src/core/types.ts` | `lockDepth: 0\|1\|2` → `0\|1\|2\|3`；`Tier` 新增 `'ultra'` |
| `src/sim/lockkey.ts` | `LockDepth` 同上；泛洪轮次 `round <= 2` → `<= 3` |
| `src/gen/gates.ts` | `MAX_LOCK_DEPTH` 2 → 3；新增 `ULTRA_LEN_BAND = [50,80]`；G6 按档位取带 |
| `src/gen/generator.ts` | 新增卡点检测；步骤重排；`defaultParams` 中 ultra → `lockPairs: 3` |
| `scripts/build-main-levels.ts` | L21–24 → `ultra`；按档位要求锁深（ultra 要 3，其余要 2） |

### 13.4 结果（显著改善）
- 24 关全部重新生成，**L21–24 = 13×13 / 迷雾 / lockDepth=3 / 3 钥匙 3 门**，解法长度 56–66 步；L9–20 仍为双锁。
- 难度曲线：`0(L1-3) → 1(L4-8) → 2(L9-20) → 3(L21-24)`。
- **每一关都在第一个种子（`main-N|v1`）上成功**，不再需要 `r11/r30/r53/r173` 重试 ⇒ 锁深从「碰运气」变成**确定性保证**。
- 附带收益：门现在处处是真卡点，**双锁关的 lockDepth=2 也是名副其实**（此前可能是偶然）。

### 13.5 测试与验证
- **新增** `lockkey.test.ts` L3 用例（三锁链返回 3）。
- **改写** `qa-gaps-sprint0.test.ts`「上界」用例：由「3 串联门应为 UNSOLVABLE」改为「3 串联门在上界内返回 3」，并补一条「钥匙锁在自家门后仍 UNSOLVABLE」守住不可解判定。
- **修复** `perf-budget.test.ts`：硬编码的 WALK_PATH 在关卡重生成后失效 → 改为**由关卡 `expectedSolution` 派生**（走完整条主干，末格即出口），基准不再随关卡几何变化而腐烂。
- `tsc --noEmit` **0 错误**；`vitest run` **47 文件 / 227 用例全绿**。

### 13.6 诚实说明与边界
- **难度上限现为 3，且这是结构性上限**：`KeyColor = 0|1|2`、`MAX_KEYS/DOORS = 3`，第四层锁需要第 4 种颜色 + 更多泛洪轮次 + 放宽常量，属新范围。
- ultra 与 high 共用长度带 `[50,80]`（长度不是难点，锁链才是）；ultra 的解法长度实测 56–66。
- **实际手感仍需浏览器试玩**（`npx vite`）：三锁在迷雾下是否"难得好玩"而非"繁琐"，Node 无法判断；代码层已保证结构合规、门禁全过、锁深真实。
- **未做 git commit**（高影响动作待用户批准）。
