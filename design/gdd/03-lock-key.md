# GDD ③ · 锁钥系统

> Phase 2 · 系统设计 | 作者：文策渊（设计策略师）| 状态：待主理人评审
> 上游：`concept.md` v2.1（§5.1 #7、§8 R5）｜GDD②（`Level` / `ProgressEvent`）
> 下游：GDD④（消费进度事件做段切分）｜GDD⑤（`computeLockDepth` 供 G5）

## 1. 目的与范围

**定义**：钥匙与门的实体规则——配对、显色、拾取、開啟、依赖深度的计算与校验。本系统是**进度事件的唯一生产者**。

**不定义**：移动如何触达（GDD①）｜段切分如何利用事件（GDD②）｜星级如何结算（GDD④）｜生成器怎么撒钥匙（GDD⑤）｜具体色值（美术圣经）。

**一句话**：保证每一把锁的解法都能被玩家一眼看懂——这是支柱一「可推理的公平」的执行层。

---

## 2. 核心机制

### 2.1 五条规则

| # | 规则 | 理由 |
|---|---|---|
| **K1** | **3 色上限**：钥匙颜色 ∈ {0,1,2}（青 / 紫 / 橙） | 色觉可辨与配对直觉；美术已论证第 4 种需引入新图案 |
| **K2** | **1 钥匙 : 1 门，同色配对** | MVP 简洁性。一把钥匙开多扇门会让玩家在遭遇多扇同色门时额外纠结"该先开哪扇"，这与"减少无意义决策"相悖 |
| **K3** | **门面显色**：门格自身显示所需颜色（+ 图案双重编码） | 玩家无需试错即可知道需要哪把钥匙——这是 R5 的头号缓解 |
| **K4** | **持有即自动开启**：走进未开启的同色门格，门自动开启，同一个 step 完成"开门 + 进入" | 无"使用物品"动词；减少输入复杂度 |
| **K5** | **钥匙不消耗**：开启后钥匙保留 | 避免不可逆状态，杜绝死锁导致的重开关卡（支柱一） |
| **K6** | **依赖链深度 ≤ 2 层** | 见 §4.3 |

### 2.2 依赖深度阶梯（`concept.md` §4.2）

| 档 | 含义 | 示例 |
|---|---|---|
| **L0** | 无锁，起点到出口直连 | 主 L1–3 |
| **L1** | 钥匙1 → 门1 → 出口 | 主 L4–8 |
| **L2** | 钥匙1 → 门1 → 钥匙2 → 门2 → 出口 | 主 L9–12、每日种子 |

### 2.3 门数量 ≤ 3 与深度 ≤ 2 的关系（`concept.md` §5.5 G5 澄清）

**两者不矛盾，但第 3 道门必须与前两道之一并列（同层），不得串联成第三层。**

```
✅ 合法（3 门 / 深度 2）        ❌ 非法（3 门 / 深度 3）
   起点区 ─┬─ 钥匙A ─→ 门A ─┐      起点区 ─ 钥匙A → 门A → 钥匙B → 门B → 钥匙C → 门C
          └─ 钥匙C ─→ 门C ─┤                                    （串联三层）
   区域1  ── 钥匙B ─→ 门B ─→ 出口
```

### 2.4 死路与捷径（**D9**）

**死路分支禁止互连**（树状，不得成环），也不得把主干上的两点额外连通而形成绕过主线的捷径。

理由：① 难度完全可控，G2/G6 的长度判定可预测；② 若允许捷径，玩家可能找到远短于 `expectedSolution` 的路线，使档位判定失真。代价是失去"抄近道"惊喜——用户已裁决接受此代价（D9）。

---

## 3. 数据结构 / 状态

```ts
type KeyColor = 0 | 1 | 2;

interface KeyEntity  { id: string; color: KeyColor; pos: Vec2 }
interface DoorEntity { id: string; color: KeyColor; pos: Vec2 }

// 运行时（存于 RunState，见 GDD② §3.2）
keysHeld:  Set<KeyColor>;   // 已拾取的钥匙颜色（不消耗）
doorsOpened: Set<string>;   // 已开启的门 id
```

**同色不变式**：对每种颜色 c，`doors` 中 color === c 的门**恰好 1 扇**，`keys` 中 color === c 的钥匙**恰好 1 把**（K2）。由 X1 校验。

---

## 4. 算法 / 规则

### 4.1 通行判定（供 GDD① `canMove` 调用）

```
resolveMove(state, from, dir):
  next = neighbor(from, dir)
  if 越界 or grid[next] == 'wall':                 return BLOCKED
  door = doors.find(d => d.pos == next)
  if !door:                                        return MOVE            // 普通地板
  if doorsOpened.has(door.id):                     return MOVE            // 已开
  if keysHeld.has(door.color):                     return OPEN_AND_ENTER  // K4
  return BLOCKED                                                          // 无钥匙
```

**`BLOCKED` 无任何副作用**：不计步、不产生 `Step`、不产生进度事件。玩家在这种挫败感上不能累积任何代价。

### 4.2 进入后的结算（产生 `Step.progressEvent`）

```
onEnterCell(state, cell):
  let ev = null
  k = keys.find(k => k.pos == cell && !keysHeld.has(k.color))
  if k: keysHeld.add(k.color);  ev = { kind:'key', color: k.color }        // → 进度事件
  else:
      d = doors.find(d => d.pos == cell && !doorsOpened.has(d.id))
      if d && keysHeld.has(d.color):
          doorsOpened.add(d.id); ev = { kind:'door', doorId: d.id }        // → 进度事件
  return ev
```

> 由于 K2（1:1）与 X3（同格单实体），`k` 与 `d` 不会同时命中，`if/else` 是安全的。

### 4.3 依赖深度计算（静态分析，供 G5 与 `meta.lockDepth` 校验）

```
computeLockDepth(level):
  region = floodFill(level.start, closedDoors = ALL)     // 不穿门，只走地板与已开的门
  if exit ∈ region: return 0                              // L0

  for round in 1..2:
      openable = doors whose keyEntity.pos ∈ region       // 钥匙已可达 ⇒ 这些门可开
      opened  ∪= openable
      region   = floodFill(level.start, opened)          // 用已开门集合重泛洪
      if exit ∈ region: return round                      // round=1 → L1，round=2 → L2

  return UNSOLVABLE                                       // 2 轮内到不了出口 ⇒ G1 失败
```

**语义**：`lockDepth` = 从起点到出口所需**顺序**穿过的门层数（并列门不增加深度）。

**同时用于 G1 可解性**：返回 `UNSOLVABLE` 即等价于 G1 不通过——这是 C1–C3 之外的另一重保障。

### 4.4 与撤销的交互

`keysHeld` / `doorsOpened` 随快照回滚（GDD① §4.5）。

> 示例：开了门后撤销 → 门重新锁上、玩家退回门前。玩家再次前进时会自动重开（钥匙仍在手上），**不会卡死**——因为 K5 钥匙不消耗，重开不需要额外条件。

---

## 5. 与其他系统的接口

| 对端 | 方向 | 内容 |
|---|---|---|
| **GDD① 移动与输入** | → | 提供 `resolveMove`（能否进入）；① 负责写 `path` |
| **GDD② 共享原语** | → | 生产 `ProgressEvent`，写入 `Step.progressEvent`。**本系统是唯一生产者** |
| **GDD④ 星级结算** | → | 间接：经由 `Step.progressEvent` 决定段边界 |
| **GDD⑤ 求解器** | → | 提供 `computeLockDepth`（G5 校验 `meta.lockDepth`）；依赖 areas 也是 G1 的输入 |
| **GDD⑥ 每日种子** | ← | 生成器产出的关卡同样必须满足 K1–K6 |
| **美术侧** | → | 需要提供：≤3 色的钥匙/门视觉、**门面显色**、颜色+图案双重编码 |

---

## 6. 边界与异常

| # | 场景 | 处理 |
|---|---|---|
| **X1** | 同色出现 2 把钥匙或 2 扇门（违反 K2） | 加载期拒绝 |
| **X2** | 门无配对钥匙，或钥匙无配对门 | 加载期拒绝 |
| **X3** | 钥匙与门同格 | 加载期拒绝（GDD② X3） |
| **X4** | 钥匙位于某道门之后，而该门又需要它自己 | **死锁**，由 §4.3 `UNSOLVABLE` 捕获 → G1 失败 |
| **X5** | `meta.lockDepth` 声明值 ≠ `computeLockDepth` 结果 | G5 失败，以**计算值**为准并报错 |
| **X6** | 到达已开启的门 | 视为普通地板，`MOVE`，**不产生进度事件**（门只结算一次） |
| **X7** | 重訪已拾取钥匙的格子 | 无事件（钥匙已被拾取） |
| **X8** | 无钥匙撞门后撤销 | 该移动从未入 `path`，撤销作用于更早的一步；语义确定 |

---

## 7. 可判定验收口径

| # | 判据 | 方法 |
|---|---|---|
| **L1** | 同色配对成立 | 对每张关卡：`keys.length === doors.length ≤ 3`，且颜色集合双射 |
| **L2** | 依赖深度与声明一致 | `computeLockDepth(level) === level.meta.lockDepth`；主线 L1–3 必为 0，L9–12 必为 2 |
| **L3** | 无死锁 | 全部关卡 `computeLockDepth` 不返回 `UNSOLVABLE` |
| **L4** | 无钥匙撞门零代价 | 单测：撞门 10 次后 `steps === 0` 且 `path.length === 0` |
| **L5** | 自动开门产生且仅产生一次进度事件 | 单测：首次进入门格 `progressEvent.kind === 'door'`；二次经过为 `null` |
| **L6** | 钥匙不消耗 | 开门后 `keysHeld.size` 不减少 |
| **L7** | 无捷径（D9） | 生成器与主线关卡：移除所有非主干通路后仍可解，且不存在长度显著短于 `expectedSolution` 的替代路径 |
| **L8** | 一眼可看懂该拿哪把钥匙（R5 主观门） | 每关设计者须能用**一句话**说清解法；说不出的关卡不合格（`concept.md` §8 R5） |

---

## 8. 风险与缓解

| # | 风险 | 缓解 | 验收 |
|---|---|---|---|
| **LK1** | 玩家看不出该先拿哪把钥匙 → 退化为穷举试错（R5，支柱一的反面） | K3 门面显色 + K6 深度 ≤2 + `expectedSolution` 自检 | L2 + L8 |
| **LK2** | 玩家把 key 用在"错误"的门上导致不可逆失败 | K2 (1:1) + K5 (不消耗) ⇒ 不存在"用错"，任何持有状态都不会造成死锁 | L1 + L6 |
| **LK3** | 3 色被滥用为 3 层串联，实际深度超标 | §4.3 用**轮次泛洪**而非"门计数"来定义深度，并列不计数 | L2 |
| **LK4** | 生成关卡出现捷径使档位判定失真 | D9 禁互连 + L7 | L7 |
| **LK5** | 色觉障碍玩家无法配对 | 美术双重编码（颜色+图案）；此处强制 K3「门面同时承载颜色与图案」而非只做钥匙编码 | 美术侧 A4 验收；识别率 ≥90% |

---

*GDD ③ 结束 · 依赖：GDD①②　被依赖：GDD④⑤⑥*
