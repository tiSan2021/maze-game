# GDD ② · 关卡数据结构与共享原语

> Phase 2 · 系统设计 | 作者：文策渊（设计策略师）| 状态：待主理人评审
> **本 GDD 是所有系统的共同底座。** GDD①/③/④/⑤/⑥ 均向后引用此处，不得另行定义同名概念。

## 1. 目的与范围

**定义**：关卡数据模型 `Level`（手工关卡与程序化生成器**同源**）、运行时状态 `RunState`、移动记录 `Step`、**进度事件**模型、以及**段切分算法**这一单一共享原语。

**不定义**：移动与输入的交互（GDD①）｜开门/配对的业务规则（GDD③）｜星级判定如何使用本原语（GDD④）｜求解器如何调用（GDD⑤）。

---

## 2. 核心机制

### 2.1 数据模型：手工与生成同源（接口约束 4b）

**单一 TS 类型同时描述手工关卡与生成关卡。引擎的渲染与判定逻辑中不得出现 `isGenerated` 之类的来源分支。**

这是 D4 后从"未来需求"升级为 MVP 硬需求的约束：每日种子要求手工关卡量与生成关卡走完全相同的管线。

### 2.2 尺寸口径（C3 / C4 / C5）

| 关卡 | 外部尺寸（`gridSize`） | 内部可用 | 像素 |
|---|---|---|---|
| 主 L1–3 | **9 × 9** | 7 × 7 | 360 × 360 |
| 主 L4–8 | **11 × 11** | 9 × 9 | 440 × 440 |
| 主 L9–12 | **13 × 13** | 11 × 11 | 520 × 520 |

- `gridSize` 为**含外墙的外部总尺寸**（C4）。内部可用 = `gridSize − 2`。
- **绝不可**理解为"内部 13×13 + 一圈外墙"——那需要外部 15×15 = 600×600 > 592px 可用高度，直接违反锚点 5「一屏一关」。
- 外圈（第 0 行/列与最后一行/列）**恒为 `wall`**。

### 2.3 进度事件模型

**进度事件**只两种，均由 GDD③ 生产、由 `Step` 携带：

| 事件 | 触发 |
|---|---|
| `key` | 玩家走进钥匙所在格，拾取该钥匙 |
| `door` | 玩家持同色钥匙进入未开启的门格，门自动开启并被进入 |

**抵达出口是终局事件，不算进度事件。** 这是段切分能成立的前提。

### 2.4 段切分：单一共享原语

> **这是本阶段最重要的一条约束。**
> `splitSegments` 与 `countBacktrackSegments` **在本 GDD 定义一次**。
> **GDD④（运行时星算）与 GDD⑤（求解器 G3）必须调用同一份实现，禁止各写各的。**
> 若出现两套实现并漂移，后果是：某关在 QA 通过了 G3，运行时却拿不到三星（或反之）。这是 Phase 1 已识别的头号一致性风险。

---

## 3. 数据结构 / 状态

### 3.1 静态：关卡数据模型

```ts
type KeyColor = 0 | 1 | 2;                  // 3 色上限（青/紫/橙），见 GDD③
type VisionMode = 'full' | 'fog';           // 关 1–8 = full；关 9+ / 每日 = fog
type Dir = 'up' | 'down' | 'left' | 'right';
type CellKey = string;                      // `${x},${y}`，Set 的键

interface Vec2 { x: number; y: number }

interface KeyEntity  { id: string; color: KeyColor; pos: Vec2 }
interface DoorEntity { id: string; color: KeyColor; pos: Vec2 }

interface LevelMeta {
  lockDepth: 0 | 1 | 2;        // 依赖链实际深度，由 GDD③ 算法算出并与此处声明比对
  keyCount: number;            // ≤ 3
  doorCount: number;           // ≤ 3
  deadEndBranches: number;     // ≤ 6（R4 时长控制）
  /** 预期解法：从头到尾的方向序列。**G2/G3 的输入，不可省略。** */
  expectedSolution: Dir[];
}

interface Level {
  schemaVersion: number;       // 数据格式版本
  id: string;                  // 'main-07' / 'daily-2026-09-05-mid'
  gridSize: 9 | 11 | 13;       // 含外墙
  grid: ('floor' | 'wall')[][]; // gridSize × gridSize，外圈恒 'wall'
  start: Vec2;
  exit: Vec2;
  keys: KeyEntity[];           // ≤ 3
  doors: DoorEntity[];         // ≤ 3
  visionMode: VisionMode;
  meta: LevelMeta;
}
```

**约束（由 GDD⑤ G5 强制）**：同一格最多承载一个实体；`start`/`exit`/`keys`/`doors` 不得落在 `wall` 上。

**为什么 `expectedSolution` 是 `Dir[]` 而不是 `Vec2[]`**：它就是玩家实际会按下的按键序列，可被 GDD⑤ 直接重放校验；长度即步数；且与 start 一起唯一确定整条路径。

### 3.2 运行时状态

```ts
type ProgressEvent = { kind: 'key'; color: KeyColor } | { kind: 'door'; doorId: string };

interface Step {
  from: Vec2;
  to: Vec2;
  dir: Dir;
  /** 该步是否产生了进度事件；null = 普通移动（含被拦截后不计步的移动） */
  progressEvent: ProgressEvent | null;
}

interface RunState {
  level: Level;
  pos: Vec2;
  keysHeld: Set<KeyColor>;
  doorsOpened: Set<string>;
  /** 实际发生的移动序列。**可回滚**（D5） */
  path: Step[];
  /** 撤销快照栈，见 GDD① §4.5 */
  undoStack: RunSnapshot[];
  /** 走过的地板格。**单调递增，撤销不回滚**（GDD① §4.5） */
  visited: Set<CellKey>;
  steps: number;
  elapsedMs: number;
  finished: boolean;
}

interface RunSnapshot {
  pos: Vec2; keysHeld: Set<KeyColor>; doorsOpened: Set<string>;
  pathLength: number; steps: number;
}
```

> `visited` 与 `path` 的**回滚策略相反**（前者单调、后者可回滚），这是有意设计，不是疏漏。理由见 GDD① §4.5。

### 3.3 段与回头路

```ts
type Segment = CellKey[];      // 含首尾格的一个路径切片

interface SegmentReport {
  segments: Segment[];
  /** 回头路段的数量：段内存在被访问 ≥2 次格子的段数 */
  backtrackSegments: number;
}
```

| 术语 | 定义 |
|---|---|
| **进度节点** | 发生进度事件时所处的格子。**起点为第 0 个进度节点** |
| **段 Segment** | 相邻两个进度节点之间的路径（**含起点格与终点格**）。最后一段止于出口格 |
| **回头路** | 某一段**内**存在被访问 ≥ 2 次的格子 |
| **跨段重复** | **合法，不计**。这个是本定义成立的关键 |

---

## 4. 算法 / 规则

### 4.1 段切分（**规范实现**）

```ts
/** 唯一实现。GDD④ 与 GDD⑤ 必须调用此函数。 */
function splitSegments(start: Vec2, path: Step[]): Segment[] {
  const segments: Segment[] = [];
  let cur: CellKey[] = [key(start)];

  for (const s of path) {
    cur.push(key(s.to));
    if (s.progressEvent !== null) {        // 仅 'key' / 'door'
      segments.push(cur);
      cur = [key(s.to)];                   // 新段从事件发生的格子起算
    }
  }
  segments.push(cur);                      // 末段止于出口
  return segments;
}

/** 唯一实现。 */
function countBacktrackSegments(segments: Segment[]): number {
  return segments.filter(seg => {
    const seen = new Set<CellKey>();
    for (const c of seg) {
      if (seen.has(c)) return true;        // 段内重复 ⇒ 回头路
      seen.add(c);
    }
    return false;
  }).length;
}
```

**复杂度**：`O(path.length)`。空间 `O(段长)`。**不可退化为搜索。**

### 4.2 三处歧义的裁决（`concept.md` §5.4 冻结）

| 歧义 | 本算法的判定 |
|---|---|
| 重复走进同一已访问格子，算不算回头路？ | **跨段不算，段内算** |
| 走进死路再原路返回，算不算？ | **算**（该段内无进度事件时）。若死路里有钥匙/门，返回路径归入下一段，不计 |
| 为拿钥匙而折返，算不算？ | **不算**。钥匙在死胡同是合法设计 |

### 4.3 参考用例（**GDD④ 与 GDD⑤ 共用同一组断言**）

| # | 路径 | 期望回头路段数 | 期望星 |
|---|---|---|---|
| **C1** | `Start→A→B→C[钥匙]→B→A→D→E[出口]` | **0** | **3★** |
| **C2** | `Start→A→B[空死路]→A→C[钥匙]→…→出口` | **1** | 2★ |
| **C3** | `Start→A→B[门锁着]→A→C[蓝钥匙]→…→出口` | **1** | 2★ |

**C1 是本定义的核心验证**：钥匙在死胡同里，往返通过 B、A，**但两处分属不同段**，段内各自无重复 → 三星。C1 若不通过，说明实现错用了"全程去重"。

### 4.4 边界情况

| # | 场景 | 规范 |
|---|---|---|
| B1 | 全程无进度事件（L1–3 无锁关卡） | 产出**恰好 1 段**（起点→出口）。路径中任何重复访问都构成回头路 |
| B2 | 路径为空 | 产出 `[ [start] ]`，1 段，0 回头路 |
| B3 | 相邻两步都触发进度事件 | 前一段以事件格结尾，后一段以同一格开头。**两处分属不同段**，各自独立判定 |
| B4 | 未通关时调用（调试/中途结算） | 末段止于当前格。正式结算只在 `finished === true` 时调用 |
| B5 | 起点恰是当前段唯一元素 | 段长 1，无重复，非回头路 |

---

## 5. 与其他系统的接口

| 对端 | 提供 | 说明 |
|---|---|---|
| **GDD① 移动与输入** | `Level` / `RunState` / `Step` 定义 | ① 负责写入 `path`、`visited`；**不**负责段切分 |
| **GDD③ 锁钥系统** | `ProgressEvent` 类型、`Step.progressEvent` 字段 | ③ 是进度事件的**唯一生产者** |
| **GDD④ 星级结算** | `splitSegments` / `countBacktrackSegments` | ④ **只读调用**，禁止重定义 |
| **GDD⑤ 求解器** | 同上 + `Level.meta.expectedSolution` | ⑤ 把 `Dir[]` 重放成 `Step[]` 后调用同一函数做 G3 |
| **GDD⑥ 每日种子** | `Level` 作为生成器输出类型 | 生成关卡与手工关卡**同类型**，无来源字段 |
| **存档层** | `Level.schemaVersion`、关卡 id | localStorage 按 id 索引最佳星级 |

### 5.1 `expectedSolution` → `Step[]` 的重放规则（GDD⑤ 需要）

```
replay(level, expectedSolution: Dir[]): Step[]
  pos = level.start; out = []
  for d of expectedSolution:
      next = neighbor(pos, d)
      assert canMove(pos, d) != BLOCKED          // G1 可解性
      ev = 拾取钥匙 ?? 开门 ?? null               // GDD③
      out.push({ from: pos, to: next, dir: d, progressEvent: ev })
      pos = next
  assert pos == level.exit                        // G1
  return out
```

**重放是求解器把静态 yml `Dir[]` 转成可被共享原语消费的 `Step[]` 的唯一途径。**

---

## 6. 边界与异常

| # | 场景 | 处理 |
|---|---|---|
| X1 | `gridSize` 非 9/11/13 | 加载期拒绝，抛错（对照 G5） |
| X2 | 外圈出现 `floor` | 加载期拒绝 |
| X3 | 两实体同格 | 加载期拒绝（G5） |
| X4 | `expectedSolution` 缺失 | **不是警告，是失败**：该文件不可作为关卡入库 |
| X5 | `meta` 声明与静态分析不符（如声明 lockDepth=1 实为 2） | G5 失败，由 GDD③ 的 `computeLockDepth` 校验 |
| X6 | `visited` 被误回滚 | V3 单测拦截（见 §7） |
| X7 | 序列化后 key 顺序不定导致逐字节比对失败 | 存档/分享用**规范化 JSON**（键排序），GDD⑤ G4 依赖此约定 |

---

## 7. 可判定验收口径

| # | 判据 | 方法 |
|---|---|---|
| **W1** | 段切分单点定义 | 全仓库 `splitSegments` / `countBacktrackSegments` **各仅一处函数体实现**；GDD④/⑤ 为调用方 |
| **W2** | §4.3 三用例通过 | 单测断言 C1=0 段 / C2=1 段 / C3=1 段；**C1 必须得 3★** |
| **W3** | 复杂度为 O(path)，非指数 | `path` 长 500 时 `splitSegments` 耗时 < 1ms；且代码中不含对"零回头路解是否存在"的搜索/回溯 |
| **W4** | 手工与生成同源 | `Level` 无来源字段；引擎代码中 grep `isGenerated` / `source` 应为 0 命中 |
| **W5** | 尺寸口径正确 | 13×13 关卡 `gridSize === 13` 且外圈全 `wall`，内部 11×11；渲染宽 = 520px |
| **W6** | `visited` 单调 | 走 10 步 + 撤销 5 次后，`visited.size` 等于曾到达过的不同格数，不小于撤销前的值 |
| **W7** | 关卡可 JSON 往返 | `JSON.parse(JSON.stringify(level))` 深度相等于原对象（规范化后逐字节相同） |

---

## 8. 风险与缓解

| # | 风险 | 缓解 | 验收 |
|---|---|---|---|
| **P1** | **段切分出现两套实现并漂移**（Phase 1 头号一致性风险） | 本 GDD 定为唯一出处；④/⑤ 明确写"只读调用"；以 C1 用例作为跨 GDD 契约测试 | W1 + W2 |
| **P2** | G3 被实现成"搜索零回头路解是否存在"（状态空间含段内已访问集合，约 2^169 不可行） | §4.1 明确"验证标注解法"路径；重放 + 切分 + 计数是唯一路径 | W3 |
| **P3** | 手工关卡与生成关卡结构分化，生成器绕过校验 | §2.1 同源约束；生成关卡同样必须携带 `expectedSolution` 过 G1–G3 | W4 |
| **P4** | `visited` 被实现成跟随撤销回滚，关 9+ 玩家丢失空间记忆 | §3.2 显式标注"有意相反"；GDD① §4.5 配套说明 | W6 |
| **P5** | `expectedSolution` 被视为可选文档字段而逐渐缺失 | X4 定为失败而非警告；它是 G2/G3 的唯一输入 | W2 + X4 |

---

*GDD ② 结束 · 被依赖：GDD① / ③ / ④ / ⑤ / ⑥*
