# 主架构 · 俯视角 2D 网格迷宫 · 锁钥寻路闯关

> Phase 3 · 技术搭建 | 作者：程基岩（engineering-lead）| 状态：初稿，待主理人评审
> 技术栈（不可推翻）：原生 **HTML5 Canvas 2D + TypeScript**、无游戏框架、仅桌面浏览器、键盘方向键/WASD、零外部美术资源。
> 下游：Phase 4 预制作（Epic/Story 拆分、脚手架）、Phase 5 实现。本文件是实现的**直接技术地基**。

---

## 0. 架构总览（一句话）

**单页、单 Canvas、确定性驱动的回合式网格游戏**：键盘 → 走廊滑行状态机 → 单步推进写入 `RunState` → 每帧渲染管线合成三层离屏。所有"随机"来自一个固定 PRNG；所有关卡都长成一个 `Level`；所有"段切分/星级判定"走同一份共享原语。

四条不可推翻的接口约束（来自 Phase 1 §6 / Phase 2 §6）在本架构中分别落地为：
1. **走廊滑行**是 MVP 硬约束（§3.2 走廊滑行状态机）。
2. **一屏一关**：无摄像机滚动，最大 13×13×40=520px ≤ 592px（§4 渲染管线 + §6 尺寸）。
3. **生成器共用数据结构**：`Level` 同源，引擎零 `isGenerated` 分支（ADR-02）。
4. **确定性随机**：mulberry32 + 种子绑定版本号，禁用 `Math.random`（ADR-01）。
0. **常量表隔离**：`palette.ts`/`metrics.ts`/`motion.ts`/`pattern.ts` 承载全部可变参数（§7）。

---

## 1. 模块划分

按"输入 → 仿真 → 渲染 → 持久化"分层，层间只允许**单向依赖**（上层可依赖下层，下层绝不 import 上层）。`core/` 是零依赖根基，所有模块都依赖它。

```
┌─────────────────────────────────────────────────────────────────┐
│  main.ts  启动 + requestAnimationFrame 主循环 + 模块装配         │
└───────┬───────────┬────────────┬──────────────┬───────────────┘
        ▼           ▼            ▼              ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │ input/  │ │  sim/    │ │ render/  │ │  state/      │
   │ 键盘输入 │ │ 逻辑判定 │ │ 渲染管线 │ │ 应用状态/存档 │
   └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
        │           │            │              │
        └───────────┴─────┬──────┴──────────────┘
                          ▼
                   ┌──────────────┐      ┌──────────────┐
                   │  gen/        │      │  core/        │
                   │  生成器/门禁 │      │  类型/RNG/常量 │
                   └──────┬───────┘      └──────┬───────┘
                          └─────────┬──────────┘
                                    ▼
                              ┌──────────┐
                              │ util/grid│  纯函数：索引/邻格/切比雪夫/key
                              └──────────┘
```

| 模块 | 职责 | 关键依赖 | 硬约束落位 |
|---|---|---|---|
| **core/** | 类型定义、`rng`、`canonicalJSON`、常量表 | 无 | ADR-01/02、§7 |
| **input/** | 键盘监听、走廊滑行状态机、撤销栈 | core, util | GDD① §4.2/§4.3/§4.5 |
| **sim/** | 移动判定、锁钥进度事件、视野计算、段切分、星级、RunState 推进 | core, util | GDD①§4.1/§4.6 GDD②§4 GDD③ GDD④ |
| **gen/** | 构造式生成四步、G1–G6 门禁、兜底、重放 | core, util, sim | GDD⑤ §4/§5 GDD⑥ |
| **render/** | 三层离屏管线、tile 预渲染、单格绘制、精灵、HUD | core, util | art-bible §3、ADR-03 |
| **state/** | 顶层状态机、存档（localStorage）、每日引导 | core, gen | GDD①§4.8 UX 流程 GDD④/⑥ |
| **util/** | 网格纯函数 | core | — |

**关键边界（防漂移）**：
- `sim/segments.ts` 是 `splitSegments` / `countBacktrackSegments` 的**唯一实现**（W1）。`sim/stars.ts`（运行时）与 `gen/gates.ts`（G3 门禁）**只读调用**，禁止各自重定义。
- `core/rng.ts` 是**唯一**允许产生伪随机数的地方；全仓其他模块一律 `import` 它，不得调用 `Math.random`（DQ3）。
- `Level` 类型定义在 `core/types.ts`，**全局唯一**；手工关卡与生成关卡 imports 同一份（W4）。

---

## 2. 目录结构建议（落盘到 Phase 4 脚手架）

```
games/
├── index.html                  # 挂载 <canvas> + HUD 容器 .hud，引入 bundle
├── src/
│   ├── main.ts                 # 启动、主循环、模块装配
│   ├── core/
│   │   ├── types.ts            # Level/RunState/Step/ProgressEvent/Vec2/Dir/KeyColor/VisionMode… (GDD② §3)
│   │   ├── rng.ts              # mulberry32 + fnv1a32 + getSeed + getDateKeyUTC            [ADR-01]
│   │   ├── canonical.ts        # canonicalJSON（键排序，逐字节比对）(GDD② X7 / ⑤ G4)
│   │   └── constants/
│   │       ├── palette.ts      # 全部颜色 HEX（art-bible §2②，含三态/四态全套）
│   │       ├── metrics.ts      # CELL_PX=40, GRID_SIZES=[9,11,13], HUD_H=32, VISION_R=3, CANVAS_W/H
│   │       ├── motion.ts       # 动效时长表 + motionScale(1/0.5/0) + easing
│   │       └── pattern.ts      # 图案间距/线宽/密度（墙斜线/门交叉/笔迹/同心圆）
│   ├── input/
│   │   ├── keyboard.ts         # 键盘监听、dirStack、preventDefault、blur 清空        (GDD① §4.3/§4.4)
│   │   ├── glide.ts            # 走廊滑行状态机：S1–S4 停止谓词 + 长按连走            (GDD① §4.2/§4.3)
│   │   └── undo.ts             # 快照栈、撤销粒度=一次滑行                            (GDD① §4.5)
│   ├── sim/
│   │   ├── move.ts             # canMove / resolveMove                               (GDD① §4.1)
│   │   ├── lockkey.ts          # 进度事件生产 + computeLockDepth                     (GDD③)
│   │   ├── visibility.ts       # computeVisibility（R=3 切比雪夫 + 墙邻感知）         (GDD① §4.6)
│   │   ├── segments.ts         # splitSegments + countBacktrackSegments（唯一实现）  (GDD② §4.1)
│   │   ├── stars.ts            # 运行时星级结算（只读 segments）                     (GDD④)
│   │   └── runstate.ts         # RunState 初始化/推进（写 path/visited，visited 不回滚）
│   ├── gen/
│   │   ├── generator.ts        # 构造式生成四步                                      (GDD⑤ §5)
│   │   ├── gates.ts            # G1–G6 判定（G3 只读 segments）                      (GDD⑤ §4)
│   │   ├── replay.ts           # replay(Level, Dir[]) -> Step[]                     (GDD② §5.1)
│   │   └── fallback.ts         # FALLBACK_LEVEL[mid/high] 预置兜底
│   ├── render/
│   │   ├── pipeline.ts         # 双路径装配 + 每帧合成                               (ADR-03)
│   │   ├── layers.ts           # L0/L1/L2 离屏 canvas 管理
│   │   ├── tiles.ts            # 墙/门/笔迹 tile 预渲染精灵                          (art-bible §3)
│   │   ├── draw-cell.ts        # cellRenderState 派生 + 单格绘制（三态/四态单一函数）(GDD① §4.7)
│   │   ├── sprites.ts          # 玩家/钥匙/门/出口 程序化绘制 + 墨晕预渲染          (art-bible §2⑤)
│   │   └── hud.ts              # DOM HUD（aria-live，顶部 32px）                     (GDD① §4.8)
│   ├── state/
│   │   ├── app.ts              # 顶层状态机：标题→选关→关内→结算                     (GDD① §4.8)
│   │   ├── progress.ts         # localStorage：主线/每日最佳星级（max 持久化）        (GDD④/⑥)
│   │   └── daily.ts            # bootstrapDaily 引导                                 (GDD⑥ §4.5)
│   └── util/
│       └── grid.ts             # key() / neighbor() / chebyshev() / 越界判定
├── levels/
│   ├── main/                   # 手工主线 12 关 *.json（含expectedSolution，过 G1–G3+G5）
│   └── fallback/               # 兜底关卡 mid/high
└── tools/
    └── qa-gates.ts             # 构建期/CI 跑 G1–G6（手工关卡入库门禁）
```

**目录决策要点**：
- 常量表四件套（`palette/metrics/motion/pattern`）独立成 `core/constants/`，与 art-director 的可访问性规格共享同一前提——换色表/换图案/换动效**不改绘制逻辑**，只改常量（art-bible §4、§5 风险 4 已确认）。
- 手工关卡以 **JSON** 入库（`canonicalJSON` 规范），交付时由 `tools/qa-gates.ts` 跑 G1–G3+G5，CI 失败即拦截（Q1）。
- `gen/` 不参与运行时；每日种子在客户端本地生成（GDD⑥ §4.5，无服务器）。生成结果同样以 `Level` 交付，引擎零来源分支。

---

## 3. 数据流

### 3.1 关卡加载（手工 / 生成 同源）

```
levels/main/*.json  ──┐
                       ├─► core/types.Level ─► state/app 初始化 RunState{ level, pos=start, ... }
gen/generator 产出 Level ─┘
```
两者汇入**同一个** `RunState`；引擎后续逻辑对来源无感知（W4 验收：`isGenerated`/`source` 0 命中）。

### 3.2 单步推进主循环（核心回路）

```
键盘 → input/keyboard（dirStack 栈顶 = 当前方向）
     → input/glide（走廊滑行状态机，S1–S4 决定停在哪格）
       每进入新格 C：
         sim/move.canMove(level, pos, dir)
            ├─ BLOCKED        → 滑行终止（S1），不计步、不写 path（V2）
            ├─ OPEN_AND_ENTER → sim/lockkey.onEnterCell() 产 progressEvent('door')
            └─ OK             → 普通前进
         sim/runstate.pushStep({from,to,dir,progressEvent})
         visited.add(key(C))           // 单调，撤销不回滚（D11/V5/W6）
         input/undo.pushSnapshot(...)   // 滑行前压栈（粒度=一次滑行）
         sim/visibility.computeVisibility（跨格时重算 visible）
     → render/pipeline 每帧合成
```

**走廊滑行状态机（MVP 硬约束）**——一次方向键 = 反复单格前进，直到满足任一停止谓词（`input/glide.ts`）：
- **S1** 前方不可通行（墙 / 打不开的门）→ 停当前格。
- **S2** 当前格有实体（钥匙/门/出口）→ 停，交还决策权。
- **S3** 当前格是通行路口：存在至少一个"当前可通行"的垂直方向邻格（地板 / 已开门 / 持钥匙的锁门；**当前打不开的门不计**）→ 停。
- **S4** 当前格在本次滑行中已走过 → 环形走廊保护，防无限绕环（**最易漏，不可省略**，E1/V3）。

**长按连走**：禁用 OS auto-repeat，自管节奏 `initialDelay=220ms`、之后每 `110ms` 一次新滑行，且**必须等上一次滑行结束**（M2）。方向键/WASD `preventDefault`，`window.blur` 清空 `dirStack` + `repeatActive`（E6）。

**两条实现期不变式（写成单测，防回归）**：

1. **S2 ⇒ 滑行中途格恒为无实体地板格**。一次滑行不可能"路过"钥匙或门（遇到即停），因此**执行期锁钥状态不会变化**，`planSlide()` 预计算的格序列与 `SlideRunner` 逐格执行必然一致，无需在执行中重算停止谓词。这是"计划/执行不漂移"的结构性证明，也让滑行可安全地一次性算完。
2. **滑行进行中按下 Z**：立即丢弃剩余格并恢复到**本次滑行前**的快照。这等价于撤销这一整次滑行，与既定粒度一致；比"排队到滑行结束再撤"更可预期（GDD① §4.5 未覆盖此边界，属工程侧补齐，见评审 L-5）。

### 3.3 撤销 / 重开（D5，零惩罚）

- **Z**：`input/undo.popSnapshot()` 回滚 `pos / keysHeld / doorsOpened / path / steps`；**`visited` 与 `elapsedMs` 不回滚**（D11）。
- **R**：整关重置到初始 `RunState`（E7）。
- 二者不计入失败统计、不影响解锁。

### 3.4 结算回路

```
抵达 exit（finished=true）→ sim/stars.settle(path)
   = splitSegments(start, path) → countBacktrackSegments → backtrackSegments
   三星 ⇔ backtrackSegments === 0（与 G3 同一原语，Q4 交叉断言）
→ 结算面板显示星级明细（含回头路高亮，GDD④ §2.3）
→ state/progress 写最佳星级（max 持久化）
```

### 3.5 每日种子流（GDD⑥）

```
state/daily.bootstrapDaily(mainProgress)
   unlocked = allMainCleared
   for tier in ['mid','high']:
       key   = {dateKey:getDateKeyUTC(now), tier, generatorVersion:CURRENT}
       seed  = getSeed(key)              // fnv1a32(dateKey|tier|vN)
       res   = gen/generator.generate({seed, tier, generatorVersion})  // G1–G6 + 兜底
       levels[tier] = res                 // 含 fallbackUsed 标记
   → 关卡选择界面"每日"分区
```
全程客户端本地完成；跨 UTC 午夜本局按原 `dateKey` 结算（D-2）。

---

## 4. 渲染管线（ADR-03，性能预算 < 8ms）

详见 `adr/adr-03-render-layering-fog.md`。要点：

- **离屏画布**：L0 纸底（烘焙一次）、L1 记忆层、L2 动态层。
- **双渲染路径**：
  - **关 1–8（`visionMode:'full'`）回退全烘焙**：所有格恒为状态 A → L1 为空 → L0+L2 合并为单张静态层，每帧一次 `drawImage` + 实体/玩家/特效叠加（<3ms）。
  - **关 9+（`visionMode:'fog'`）走三层增量**：每帧 2× `drawImage(L0,L1)` + 视野内 ~29 格 `drawImage` + 实体（5–6ms）。
- **三必做前置（缺一即 9–11ms，超标）**：
  1. 墙/门/笔迹三类图案**预渲染为 tile 精灵**（`render/tiles.ts`，省 ~85% 线段开销）。
  2. 视野半径 **R ≤ 3**（切比雪夫，约 29–30 格；R=5 明确超标 8–9ms）。
  3. L1 记忆层**增量更新**（跨格仅重绘 `dirtyCells`，非全量重烘焙）。
- **禁用 `shadowBlur`**；墨晕用预渲染精灵 `drawImage` 替代（art-bible §2④/§2⑤）。
- **HUD 走 DOM**（顶部 32px，`aria-live`），不占迷宫区高度（守住 A6 一屏一关）。
- **视野重算时机**：玩家逐格移动，视野只在跨格时变（最快 ~8 次/秒），增量更新即可，非每帧（art-bible §3）。

#### 4.1 三条实现级决策（影响内存与稳定性）

| # | 决策 | 理由 |
|---|---|---|
| **D-R1** | **L0/L1 离屏尺寸 = 迷宫区（`gridSize*40` 逻辑像素），不是整块画布** | 13×13 时各 520×520（dpr=2 → 约 4.3MB/层），比 960×640 整画布离屏省约 55% 显存，且 `drawImage` 更小更快 |
| **D-R2** | **L2 动态层直接绘制到主画布**，不额外开离屏 | 少一次全屏 `drawImage`。降级预案④（L2 半分辨率离屏）保留为 `renderFlags.l2HalfRes` 开关 |
| **D-R3** | **脏格用"全格 diff（169 次整数比较）+ 只画脏格"求得，不靠算视野边界环** | 169 次比较是微秒级，却彻底消除"边界环算漏一格 → 记忆层留残影"这类最难查的 bug。**增量体现在"只画脏格"，不体现在"少算格子"** |

```
onLogicalChange():                       // 跨格 / 撤销 / 重开 / 加载
  newStates = 全格重算（169 × O(1)）
  dirty     = { i | newStates[i] !== lastPainted[i] }
  for i in dirty:
      L1.clearRect(cellRect(i))
      if newStates[i] ∈ {MEMORY_WALKED, WALL_MEMORY}: 绘制记忆态（一次 tile drawImage）
      lastPainted[i] = newStates[i]
  renderStats.lastDirtyCount = dirty.size     // 供自动化验收：跨格一次应 ≤40（全量重绘会等于 169）
```

#### 4.2 渲染态码表（`render/` 唯一消费的输入）

| 码 | 名称 | 出现条件 |
|---|---|---|
| 0 | `UNKNOWN` | 仅 fog；不在 `visible`、未 `visited` |
| 1 | `VIEW_UNWALKED` | 在 `visible`、未 `visited` |
| 2 | `VIEW_WALKED` | 在 `visible`、已 `visited` |
| 3 | `MEMORY_WALKED` | 仅 fog；不在 `visible`、已 `visited` |
| 4 | `WALL` | 墙且在半径视野内 |
| 5 | `WALL_MEMORY` | 墙且**仅**由墙邻感知可见（按记忆浓度绘制） |

> `WALL_MEMORY` 是工程侧对 GDD① §4.7 的**必要细化**：`cellRenderState` 只区分 `WALL` / `UNKNOWN`，但 art-bible §2⑦ 要求"墙邻感知的墙以记忆态绘制"。故在 `cellRenderState` 之上追加一次"是否来自墙邻感知"的判定，**只影响墨色浓度，不改变任何集合语义**。关 1–8 因 `visionMode='full'` 时 `inView` 恒真，结构上不产出码 0/3/5（A2/V6 自动成立）。**具体墨色浓度取值由 art-director 给出**（L8 已确认该细化方向）。

#### 4.3 「关闭迷雾」挂载点（唯一允许的可访问性代码分支）

可访问性的「迷雾减淡 / 关闭迷雾」中，只有**关闭迷雾**需要一处代码分支（0.1 人天），其余升级全部是换常量（§7.2）。挂载点定义如下：

```ts
// 渲染路径选择 —— 注意：不看关卡来源，只看"是否渲染迷雾"
const renderMode =
  (level.visionMode === 'full' || settings.fogPresentation === 'off')
    ? 'BAKED'     // 全烘焙：<3ms，复用关 1–8 路径，无需新增渲染代码
    : 'LAYERED';  // 三层增量：5–6ms

// cellRenderState 的唯一覆盖点（'fogOff' 时强制 inView = true）
cellRenderState(level, c, pos, visited, visible, a11yOverride?: 'fogOff' | 'fogReduced' | null)
```

**三条硬性边界（写成单测）**：
1. `a11yOverride` **只改变返回值**（渲染态），**不改变** `visible` / `visited` / `path` / `steps`；
2. 开/关迷雾打同一张图同一条路线 → **星级与回头路段数完全相同**（GDD④ §4.3）；
3. `fogPresentation='off'` 时**复用 BAKED 路径**，不得出现第三套绘制代码（`WALL_MEMORY` / `MEMORY_WALKED` / `UNKNOWN` 三个态码均不产出）。

> 「迷雾减淡」不在此列：它只是换一组记忆态色常量（`themes` 里多一组 `palette`），零代码分支。

---

## 5. 状态管理

### 5.1 三层状态

| 层 | 载体 | 生命周期 |
|---|---|---|
| 应用态 | `state/app.ts` 有限状态机：`title → levelSelect → inLevel → settle` | 跨关卡 |
| 运行态 | `RunState`（GDD② §3.2），含 `path/visited/undoStack/keysHeld/doorsOpened` | 单关内，R 重置 |
| 输入态 | `InputState`（dirStack / repeatActive），`blur` 清空 | 瞬时 |

### 5.2 RunState 推进规则（防 D11 误解）

`runstate.ts` 是唯一写 `path` / `visited` 的地方：
- 每成功单格前进 → `path.push(step)`、`visited.add(key(to))`。
- `visited` **单调递增**；撤销/重开均不缩减它（V5/W6）。
- 撤销栈存的是 `RunSnapshot`（pos/keysHeld/doorsOpened/pathLength/steps），**不含 visited**（§3.3）。
- `finished` 为 true 才能 `settle`，否则末段止于当前格（GDD② B4）。

### 5.3 持久化

`state/progress.ts`：localStorage 按 `level.id` 索引最佳星级（`main-*` / `daily-*` 键空间隔离，DQ7）。`RunState` **不持久化**（重开即丢，GDD① §5）。`canonicalJSON` 用于存档规范化与每日种子逐字节可比（DQ1/G4）。

---

## 6. 生成器管线（GDD⑤）

`gen/generator.ts` 实现构造式四步（非"随机生成+校验"，命中率高）：

1. **造自避主干解**：内部网格随机 DFS 出 `start→exit` 自避路径；长度拒绝采样命中档位区间（中 35–55 / 高 50–80）。**自避是 G3 天然成立的根因**（§5 注释）。
2. **撒钥匙/门成依赖链**：门放在主干段边界，对应钥匙放在该门**之前**的主干段 → 可解性由构造保证；深度 = 串联门数 ≤ 2。
3. **加死路干扰（D9 禁互连）**：分支 ≤ 6，互连检测（泛洪查 ≥2 接触点 / 两分支相连）→ 失败则回步骤 1。
4. **复验与回退**：`for attempt in 1..8` 跑 G1–G6，全过即出；否则降级（缩长度→减门→降尺寸档）→ 仍失败回退 `FALLBACK_LEVEL[tier]`（**绝不可省略**，DQ6/Q8）。

`gen/gates.ts` 六门禁：G1 可解性、G2 长度 ≤80、G3 三星可达（**重放+共享原语+O(path)**，禁搜索）、G4 确定性（同种子两次 `canonicalJSON` 全等、失败即报错）、G5 尺寸/依赖/数量/死路合规、G6 档位命中。

**四条实现级决策**：
1. **重试种子用哈希派生**：`deriveAttemptSeed(seed, attempt) = fnv1a32(\`${seed}|a${attempt}\`)`，替代 GDD 原文的 `seed + attempt`（mulberry32 对相邻种子首输出相关性偏高）。语义不变，收益是各次重试相互独立（ADR-01 §3.4）。
2. **命名子流**：步骤 1/2/3 各用独立 RNG 流，避免"在步骤 3 加一次抽样就改变步骤 1 的产出"（ADR-01 §3.5）。
3. **G4 不在 `generate()` 内执行**（会使生成成本翻倍）：`generate()` 只跑 G1/G2/G3/G5/G6；G4 与同日两张去重由 `tools/qa-gates.ts` / `qa:daily` 在 CI 执行（ADR-01 §3.10）。
4. **生成耗时**：两张 13×13 图在**关卡选择界面空闲时**预生成，并对单次生成埋点（>50ms 告警）。最坏路径 = 8 次重试 + 降级 + 兜底，需实测；若确认卡顿再引入 Worker（风险 A7）。

**待补定义（已上报，评审 M-2）**：`countDeadEndBranches(level)` 在 GDD⑤ §4.6 被引用但**全仓无定义**。工程侧默认定义（待主理人确认）：
> 以 `expectedSolution` 覆盖的格集合为**主干骨架**；非主干地板的**极大连通分量**数量 = 死路分支数；判据 `≤ 6`。
> 该定义与 D9「死路互连检测」天然协同：若两分支相连则它们同属一个分量，分支数反而变少 —— 故互连检测必须独立做泛洪（≥2 个主干接触点即判失败），不能只靠计数兜底。

**G3 头号警告**：必须"验证标注的 `expectedSolution` 本身是否零回头路"（O(path) 遍历），**不得实现为搜索零回头路解是否存在**（状态空间 ~2^169）。正确路径：重放 `Dir[]` → `Step[]` → 调 GDD② 共享原语 → 计数（SV1/Q3）。

手工主线关卡同样过 G1–G3+G5（CI 拦截，Q1）。

---

## 7. 常量表隔离（跨成员共同前提）

全部可变参数收敛于 `core/constants/` 四件套，绘制/逻辑**只引用常量、不硬编码**：

- `palette.ts`：art-bible §2② 全部 HEX（结构/信号/UI 三层），三态/四态全套色。
- `metrics.ts`：`CELL_PX=40`、`GRID_SIZES=[9,11,13]`、`HUD_H=32`、`VISION_R=3`、`CANVAS_W=960/H=640`、可用区 `944×592`。
- `motion.ts`：动效时长表 + `motionScale(1/0.5/0)` + 缓动函数。
  - **A5 口径纠正（仅约束「移动插值 ≤ 200ms」）**：三类动效分治——① **移动插值 120ms** 受 A5 约束；② **交互反馈**（撞墙 80ms / 拾取 200ms）受约束且本就在限内；③ **过场与结算动效不受 A5 约束**（开门 280 / 过关 400 / 切关 250+250ms）。
    - ③ 的三个免责前提：a) 不阻塞输入（≤200ms）；b) 受 `motionScale` 控制；c) 不承载"必须被看见才知道"的信息。
    - **唯一例外**：门由「交叉网格 → 实心」的状态联动，在 `motionScale=0` 时**必须以瞬时切换保留**（功能不丢）。
  - **失败反馈（art-bible 升 v2.1）**：红褐 vignette **250ms / 闪 1 次**（原 320ms/闪 2 次 折算 6.25Hz，超 WCAG 2.3.1 的 3Hz 上限一倍）。`motion.ts` 中 `FAIL_VIGNETTE_MS=250`、`FAIL_VIGNETTE_BLINKS=1`。
- `pattern.ts`：墙斜线/门交叉/笔迹/出口同心圆的间距、线宽、密度（含≤3 钥匙配对的形状标记密度）。

**与 art-director 一致性（已裁决形态）**：

1. **升级路径绝大多数 = 换常量**：三型色盲色表 / 高对比 / 迷雾减淡 → `palette.ts`；图案密度 → `pattern.ts`；动效 → `motion.ts`；字号 → `metrics.ts`。`core/constants/` 以 **`themes: Record<TierName, Constants>` 对象导出 + 运行时 select** 落地（而非扁平静态 import），绘制/逻辑代码不改（CONCERN-1 / L4 解答）。
2. **唯一需要代码分支的是「关闭迷雾」**：覆盖 `cellRenderState` 返回值、复用关 1–8 全烘焙路径、成本 **0.1 人天**、**不改变 `visible`/`visited` 集合**（符合 GDD① §4.7）。**架构已为这一个分支预留挂载点**：`render/draw-cell.ts` 的 `cellRenderState` 接受 `AccessibilityMode` 覆盖参数（默认 `null` → 原语义；`'fogOff'` → 全部按状态 A 绘制）。该覆盖只改渲染输出，不动下层集合与星级判定（W4/Q4 不受影响）。
3. **分级口径（art-director 论证）**：**Basic 级在本项目结构上不成立**——图案填充是第二编码通道、是识别逻辑的组成部分，关掉它色觉障碍玩家无法区分钥匙与出口（L* 差仅 0.4）。实际为 **Standard / Comprehensive 二选一**，推荐 Standard（约 2.2–2.3 人天）。本架构不定义分级内容（归属 art-director），但保证骨架支撑其常量切换与 `AccessibilityMode` 挂载点。

---

## 8. 可判定验收口径映射（本架构 → 上游验收）

| 上游验收 | 本架构落位 |
|---|---|
| W1 段切分单点实现 | `sim/segments.ts` 唯一函数体；stars/gates 只读调用 |
| W4 / DQ3 零来源分支 / 禁 Math.random | ADR-02 / ADR-01；grep `isGenerated`/`source`/`Math.random` 0 命中 |
| V3/V5/W6 滑行终止 / 撤销回滚 / visited 单调 | `input/glide.ts` S1–S4、`input/undo.ts`、`sim/runstate.ts` |
| Q3/Q4 G3=O(path) 且与运行时一致 | `gen/gates.ts` G3 复用 `segments.ts`；Q4 交叉断言 |
| DQ1/DQ4 确定性 + 版本绑定 | `core/rng.ts` fnv1a32(种子含 vN)、G4 失败即报错 |
| art-bible §3 三必做前置 | `adr/adr-03`；`render/tiles.ts` + `VISION_R=3` + `layers.ts` 增量 |
| W5/A6 尺寸与一屏一关 | `metrics.ts` + 渲染管线无摄像机滚动 |

---

## 9. 风险与遗留（架构层）

| # | 风险 | 本架构缓解 | 待主理人裁决 |
|---|---|---|---|
| A1 | 段切分漂移（头号一致性风险） | `segments.ts` 唯一实现 + Q4 交叉断言 | — |
| A2 | G3 被实现成搜索（2^169） | 重放+共享原语，禁搜索；代码评审 grep 搜索调用（Q3） | — |
| A3 | 关 9+ 性能超标 | 三必做前置声明为不可省略；四级降级预案（art-bible §3） | 若实测仍超，启用降级 ①②③④ |
| A4 | HUD 布局（顶部条 vs 左侧竖栏） | 顶部条（DOM 32px） | **已裁决（Q3，用户 2026-09-04）**：顶部状态条；左侧竖栏方案（+0.3 天）不采纳 |
| A5 | 视野半径 R 取值 | 恒 R=3 | **已裁决（art-bible v2 自解 Q1/Q4）**：R=3 锁定；原「R=4~5 渐进」方案**作废**，改为「关卡复杂度渐进 + 视野半径恒定 R=3」。CONCERN-2 中风险解除，无需重估性能预算 |
| A6 | 墙邻感知是否纳入 | 纳入（`visibility.ts`），零成本 | **已裁决（Q2，用户裁决）**：启用；零成本（一次 8 邻域查询），消除盲撞 |
| **A7** | **客户端同步生成两张 13×13 图造成首屏/切界面卡顿**（最坏 8 次重试 + 降级） | 关卡选择界面空闲预生成；单次生成耗时埋点（>50ms 告警）；必要时 Worker | 点击到可玩 <100ms |
| **A8** | 步骤 1「随机 DFS + 拒绝采样 50 次」在 11×11 内部网格命中高档 50–80 步的比率未知 | 记录 `attempts` 遥测；若平均 >2 次则改为"带目标长度偏置的 DFS" | Q2：30 天 `fallbackUsed=false` 且平均 attempts ≤ 2 |

---

## 10. 跨文档缺口（**已全部裁决，2026-09-07 主理人回执**）

> 本阶段只读 GDD / `concept.md` / `art-bible.md`，**不做任何自行改动**。

**裁决结果（以此为准，后续实现不得再自行假设）**：

| # | 裁决 | 工程侧动作 | 状态 |
|---|---|---|---|
| **M-1** | **不实现 C 态**，维持 GDD① 四态（art-director 独立得出同一结论，已把"看见即记住"列为 AX-1 候选增强、不纳入 MVP）；由 art-director 在 `art-bible.md` §2⑦ 加注「不可达」 | 无需 `seen` 集合、无第五态；`cellRenderState` 保持四态 | ✅ 关闭 |
| **M-2** | 确认为**真实规格缺口**，已转 `design-strategist` 做正式定义并补进 GDD⑤ §4.6 | **正式定义回来前按本架构默认实现**（非主干地板的极大连通分量数 ≤6）；若策略师改动，主理人会通知 | ⏳ 按默认实现 |
| **M-3** | 同意 `WALL_MEMORY` 细化方向（只改墨色浓度、不动集合语义、关 1–8 结构上不产出） | 渲染层追加态码；**具体浓度取值由 art-director 给出** | ✅ 待取值 |

以下为原始缺口记录（保留以备追溯）：

| # | 缺口 | 证据 | 工程侧默认（若无人推翻则按此实现） | 影响面 |
|---|---|---|---|---|
| **M-1** | **art-bible §2⑦ 的 C 态「已探索·未走过」在 GDD① 的四态模型里不可达** | GDD① §4.7 只有 `VIEW_WALKED` / `VIEW_UNWALKED` / `MEMORY_WALKED` / `UNKNOWN`；`visited` = 走过的格（D11）。"看见但没走过"的格一旦移出视野半径即落入 `UNKNOWN`，不存在记忆态。art-bible 的 C 态需要第三个集合 `seen` | **维持 GDD① 四态**，art-bible 的 C 行标注为不可达。理由：① 引入 `seen` 等于"看过即记住"，会削弱迷雾的探索压力，与 D11「记住的是走过的路」相反；② C 态与 D 态（未知）的视觉差异仅靠网格线浓淡 1.52:1 vs 1.21:1，**远低于 3:1 验收线**，收益不抵复杂度 | 若裁决改为支持 C 态：需 GDD① 增 `seen` 集合 + 第五态，art-bible 需给出可达 3:1 的区分手段 → 属 Phase 2 回改 |
| **M-2** | `countDeadEndBranches(level)` **全仓无定义**（仅 GDD⑤ §4.6 引用） | grep 全 `design/` 仅 2 处：GDD② §3.1 字段声明、GDD⑤ §4.6 判据 | 见 §6「待补定义」：非主干地板的极大连通分量数 | 低（G5 判据依赖），但无定义则门禁不可实现 |
| **M-3** | **墙邻感知的墙需要"记忆态浓度"绘制**，但 `cellRenderState` 只产 `WALL` / `UNKNOWN` | art-bible §2⑦「墙邻感知」段 + §2② 记忆态墙色表 | 追加 `WALL_MEMORY` 渲染态码（§4.2），只影响浓度，不改集合语义 | 低；不改动 GDD，属渲染层细化 |

**以上三条均不需要修改 GDD 文本**（M-1 若维持默认则只需 art-bible 加一行"不可达"备注；M-2 补定义；M-3 在渲染层吸收）。

---

*文档结束 · v1.1 · 配套 `adr/adr-01~04`、`architecture-review.md`、`control-checklist.md`*
