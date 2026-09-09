# GDD ④ · 星级结算

> Phase 2 · 系统设计 | 作者：文策渊（设计策略师）| 状态：待主理人评审
> 上游：`concept.md` v2.1（§5.4 星级定义、D3/D5）｜**GDD② §4 段切分（唯一共享原语）**
> 下游：存档层、结算 UI、GDD⑥（每日种子成绩）

## 1. 目的与范围

**定义**：单局结束时的星级判定、结算数据、明细展示与最佳成绩持久化。

**不定义**：段切分算法本身（**GDD② §4，本系统只调用**）｜输入与移动（GDD①）｜门/钥匙规则（GDD③）。

**红线（D3）**：**不为每关计算最优解。** 星级只由"通关 + 零回头路"决定。

---

## 2. 核心机制

### 2.1 三档判定（冻结口径）

```
1 星 = 通关
2 星 = 通关 且 回头路段数 ≤ 1
3 星 = 通关 且 回头路段数 == 0
```

其中"回头路段数" **严格来自 GDD② 的 `countBacktrackSegments(splitSegments(start, path))`**，本 GDD 不重新定义。

### 2.2 为什么不比对最优解（D3）

- 省下为每关精确计算最优解的关卡设计工时（已转移给生成器，见 `phase1-synthesis` §3.4）。
- 语义更友好：惩罚的是"**走了没收益的冤枉路**"，而不是"没走数学最短路径"。
- 前提保障：**每关必须存在零回头路解**，由 GDD⑤ 的 **G3 门禁**在发布前阻断。否则三星不可达 → 成就者失去锚点（Bartle Achiever，见 `concept.md` §4.3）。

### 2.3 结算明细（**MVP 必须有，不是装饰**）

结算界面必须显示：

| 项 | 内容 |
|---|---|
| 星级 | 1 / 2 / 3 |
| **段数** | 本局共 N 段（= 进度事件数 + 1） |
| **回头路段数** | M 段走了冤枉路 |
| 步数 | 展示用，**不参与判定** |
| 用时 | 展示用 |
| **可选高亮** | 按键切换：在迷宫上高亮那 M 段回头路 |

> **为什么必须有明细**：若只给一个"2★"，玩家无法知道自己哪一步走错了，下一局只能盲试——这会把"省"这个动词变成玄学，直接损害支柱一与 SDT 胜任感。明细把丢星变成一次可学习反馈。
> 这是 R5「锁钥可推理性」在结算层的延伸：**惩罚必须可解释。**

### 2.4 最佳成绩持久化

- 以 `level.id` 为键存 localStorage，取 **`max(历史, 本局)`**。
- 步数与用时各自取**该星级下的最优值**（展示用）。
- 主线：**1 星即解锁下一关**（`concept.md` §6.2），三星纯可选。

---

## 3. 数据结构 / 状态

```ts
interface StarSegmentDetail {
  index: number;
  cells: Vec2[];
  isBacktrack: boolean;      // 段内存在重复访问格
}

interface StarResult {
  star: 1 | 2 | 3;
  /** 回头路段数。**来自 GDD② shared primitive 的唯一输出** */
  backtrackSegments: number;
  segmentCount: number;
  segments: StarSegmentDetail[];   // 用于 §2.3 高亮
  steps: number;
  elapsedMs: number;
}

interface LevelRecord {            // localStorage
  bestStar: 1 | 2 | 3;
  bestStarSteps: number;
  bestStarElapsedMs: number;
}
```

---

## 4. 算法 / 规则

### 4.1 结算主流程（**注意"只调用不自实现"**）

```
settle(runState): StarResult | null
  if !runState.finished: return null                  // 未通关不结算

  // ↓↓↓ 以下两行必须是 GDD② 的共享实现，本处不得重写 ↓↓↓
  segments = splitSegments(runState.level.start, runState.path)
  backtracks = countBacktrackSegments(segments)
  // ↑↑↑

  star = backtracks === 0 ? 3 : (backtracks <= 1 ? 2 : 1)

  return {
    star, backtrackSegments: backtracks,
    segmentCount: segments.length,
    segments: toDetail(segments),                     // 逐段标记 isBacktrack
    steps: runState.steps, elapsedMs: runState.elapsedMs
  }
```

**复杂度**：`O(path.length)`，与 GDD② §4.1 一致。

### 4.2 撤销对结算的影响（**D5，已裁决**）

`path` 可回滚 ⇒ **被撤销掉的冤枉路不计入回头路**。玩家可用耐心"磨"出三星。

- **接受理由**（`concept.md` §5.4 注）：无排行榜、Bartle 无 Killer 定位，三星是个人胜任感而非竞争资本；"用撤销在脑内试错"正是支柱二「想 > 走」鼓励的行为。
- **不影响的部分**：`visited`（认知地图）不回滚，玩家保留探索所得知识。
- ⚠️ 工程侧**不得**实现为"撤销仍记录回头路"。

### 4.3 可访问性开关无关性

美术侧的「迷雾减淡 / 关闭迷雾」只改变渲染态，**不改变 `path` / `visited` / `visible` 的业务集合** ⇒ **不影响星级判定**。玩家看得更清楚是 Accessibility 权利，本作无排行榜故不构成不公平。

---

## 5. 与其他系统的接口

| 对端 | 方向 | 内容 |
|---|---|---|
| **GDD② 共享原语** | ← | **只读调用** `splitSegments` / `countBacktrackSegments`。禁止复制实现 |
| **GDD① 移动与输入** | ← | 在玩家抵达出口时收到 `finished=true` 与 `RunState` |
| **GDD③ 锁钥系统** | ← | 消费 `Step.progressEvent`（段边界来源），**不直接依赖其业务规则** |
| **存档层** | → | 写入 `LevelRecord`（`max` 语义） |
| **结算 UI** | → | `StarResult`（含 `segments` 明细，供高亮） |
| **GDD⑥ 每日种子** | → | 每日题目以 `level.id`（含日期与档位）为键独立记录，不与主线混用 |

---

## 6. 边界与异常

| # | 场景 | 处理 |
|---|---|---|
| **Y1** | 未通关（`finished=false`）调用结算 | 返回 `null`，不写存档 |
| **Y2** | 玩家在结算前按 R 重开 | 本局作废，`path` 清空，**不结算**（等同于 Y1） |
| **Y3** | 无锁关卡（L1–3，零进度事件） | `segments.length === 1`；路径中任何重复访问都构成回头路 → 该关三星要求全程自避 |
| **Y4** | `path` 为空却标记通关（异常数据） | `segments = [[start]]`，0 回头路，但应已有 X1 级别的加载期拦截 |
| **Y5** | 同一关重复通关，本次星级更低 | **存档保留历史最佳**，本次仅用于展示 |
| **Y6** | localStorage 不可用 / 写满 | 降级为内存态并在会话内生效；不影响本局游玩与结算展示 |
| **Y7** | 段数极大（异常长路径） | 由 GDD⑤ G2（≤80 步）在发布前阻断；运行时不做长度限制，仅 `steps` 可异常上升 |

---

## 7. 可判定验收口径

| # | 判据 | 方法 |
|---|---|---|
| **S1** | **三条契约用例**（GDD② §4.3）全部通过 | C1→3★、C2→2★、C3→2★。**任一不符即判定实现错误** |
| **S2** | 复用同一实现 | 全仓库 `countBacktrackSegments` 只有一处函数体；④/⑤ 为调用方（同 W1） |
| **S3** | 不计算最优解 | 结算代码中不含任何最短路径/搜索/BFS 调用；单次结算 `O(path)`，500 步下 < 1ms |
| **S4** | 撤销后结算正确 | 走 10 步含 1 段冤枉路 → 撤销该段 → 结算为 3★（D5） |
| **S5** | 明细与判定一致 | `result.backtrackSegments === result.segments.filter(isBacktrack).length` |
| **S6** | 最佳成绩单调 | 连打同一关：`bestStar` 单调不减；低星重打不覆盖高星 |
| **S7** | 可访问性开关不影响星级 | 开启/关闭迷雾各打同一关同一路线，星级与回头路段数完全相同 |
| **S8** | 1 星即解锁 | 拿到 1 星后下一关可选；主线 12 关全 1★ 即触发每日种子解锁（GDD⑥） |

---

## 8. 风险与缓解

| # | 风险 | 缓解 | 验收 |
|---|---|---|---|
| **SR1** | **与 G3 门禁漂移**：QA 通过 G3 的关卡运行时拿不到三星 | 唯一共享原语 + S1/S2 契约测试（④ 与 ⑤ 用同一组断言） | S1 + S2 |
| **SR2** | 玩家不理解为什么丢星 → "省"动词变玄学 | §2.3 明细 + 回头路高亮，**MVP 必做** | S5；结算界面存在"M 段走了冤枉路"文案 |
| **SR3** | 撤销可"磨"三星导致成就贬值 | 已在 D5 裁决接受；无排行榜故无外部性；`visited` 不回滚保留知识价值 | S4 |
| **SR4** | 某关不存在零回头路解 → 三星永久不可达 | GDD⑤ G3 发布前阻断；手工关卡同样过 G3 | S1 + GDD⑤ G3 |
| **SR5** | 步数被人误当作判定依据 | §2.4 明确"展示用"；UI 上不与星级并列呈现为门槛 | S3 |

---

*GDD ④ 结束 · 依赖：GDD①②③　被依赖：GDD⑥、存档层*
