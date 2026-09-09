# GDD ⑤ · 求解器与 QA 门禁

> Phase 2 · 系统设计 | 作者：文策渊（设计策略师）| 状态：待主理人评审
> 上游：`concept.md` v2.1（§5.5）｜GDD②（共享原语、`expectedSolution`）｜GDD③（`computeLockDepth`）
> 下游：GDD⑥（每日种子调用生成器）
> **本系统是构建期工具，不参与运行时。** 运行时星算见 GDD④。

> # ⚠️ 给工程侧的头号警告
> **G3 必须实现为"验证设计标注的 `expectedSolution` 本身是否为零回头路解"（O(path) 遍历），不得实现为"搜索是否存在零回头路解"。**
> 后者的搜索状态必须包含"本段已访问格集合"，状态空间约 **2^169**，不可行。
> 正确路径只有一条：**重放 `Dir[]` → 得到 `Step[]` → 调用 GDD② 的共享原语 → 计数**。

## 1. 目的与范围

**定义**：六条发布前阻断门禁（G1–G6）的逐条判定与失败处理；构造式生成器的四步算法规格与重试/兜底策略。

**适用对象**：手工主线 12 关 **与** 生成关卡，走**同一套**门禁，无例外。

**不定义**：段切分算法（GDD②）｜依赖深度算法（GDD③）｜PRNG 实现（GDD⑥）。

---

## 2. 核心机制

### 2.1 六门禁一览

| 门禁 | 判据 | 不通过时 |
|---|---|---|
| **G1 可解性** | `expectedSolution` 重放后合法且止于出口 | 手工：**报错**，让设计者改关卡；生成：**阻断**（是生成器 bug） |
| **G2 长度上限** | 长度 ≤ 80 步 | 手工：报错；生成：**换种子重生成**（≤8 次） |
| **G3 三星可达（硬）** | `expectedSolution` **本身**回头路段数 = 0 | 手工：报错；生成：重生成 |
| **G4 确定性** | 同 (seed, tier, version) 两次产出逐字节相同 | **阻断并报错**（不可用重生成掩盖） |
| **G5 尺寸与依赖合规** | 尺寸/数量/深度/死路数合规 | 手工：报错；生成：重生成 |
| **G6 档位命中** | 长度落入该档目标区间 | 生成：重生成 → 降级 → 兜底 |

### 2.2 为什么是"验证标注解法"而不是"算最优解"

- D3 已裁决**不为每关计算最优解**做星级依据。
- 但把同一套 O(path) 遍历用作**发布前 QA 工具**不违背 D3——D3 禁止的是**星级依赖最优步数**，不禁止求解器作为质量门。
- 成本约等于零：`O(path.length)`。

### 2.3 构造式生成（非"随机生成 + 校验"）

采用构造式的核心理由：**随机迷宫 + 随机锁钥同时满足 G1/G3/G6 的命中率极低**，大量空转；而构造式生成对 G3 是 **100% 命中**（见下）。

> **G3 天然成立的关键性质**：
> 若主干解是一条**自避（self-avoiding）路径**，则按进度事件切分后，每一段都是该路径的子序列，**子序列同样自避** ⇒ 每段内无重复格 ⇒ **G3 自动通过**。
> 这不是巧合，这是刻意选择自避主干的原因。

---

## 3. 数据结构 / 状态

```ts
type Tier = 'mid' | 'high';

interface GateResult {
  gate: 'G1'|'G2'|'G3'|'G4'|'G5'|'G6';
  pass: boolean;
  detail: string;             // 失败原因，需可直接定位
}

interface GenerateRequest {
  seed: number;               // 由 GDD⑥ 的 mulberry32 种子派生规则给出
  tier: Tier;
  generatorVersion: number;
}

interface GenerateResult {
  level: Level | null;
  gates: GateResult[];        // 全部六条的执行结果
  attempts: number;           // 实际重生成次数
  fallbackUsed: boolean;      // 是否回退到预置兜底关卡
}
```

**常量表**：

| 常量 | 值 |
|---|---|
| `MAX_STEPS` | 80（G2） |
| `MAX_ATTEMPTS` | 8（换种子重生成上限） |
| `MAX_KEYS` / `MAX_DOORS` | 3 / 3（G5） |
| `MAX_DEAD_ENDS` | 6（G5、R4） |
| `MAX_LOCK_DEPTH` | 2（G5） |
| 中档长度区间 | 35 – 55 步 |
| 高档长度区间 | 50 – 80 步 |

---

## 4. 算法 / 规则

### 4.1 重放（所有门禁的共同前置）

```
replay(level, dirs): { steps: Step[] } | ERROR
  pos = level.start; out = []
  for d in dirs:
      r = resolveMove(state, pos, d)                    // GDD③
      if r == BLOCKED: return ERROR('第 ' + i + ' 步非法')    // G1 失败
      pos = neighbor(pos, d)
      out.push({ from, to: pos, dir: d, progressEvent: onEnterCell(state, pos) })
  if pos != level.exit: return ERROR('未抵达出口')        // G1 失败
  return { steps: out }
```

### 4.2 G1 可解性

- 输入：`Level`（含 `expectedSolution`）
- 判定：`replay` 不返回 ERROR
- **隐含另一重保障**：GDD③ `computeLockDepth` 返回 `UNSOLVABLE` 亦判失败

### 4.3 G2 长度上限

- 判定：`expectedSolution.length ≤ MAX_STEPS`
- 手工关卡超限 → 设计者要么简化关卡，要么承认该关不适配"一关一谜"（参见 R4）

### 4.4 G3 三星可达（**硬门禁**）

```ts
function gateG3(level: Level): GateResult {
  const { steps } = replay(level, level.meta.expectedSolution);   // ① 重放
  const segments = splitSegments(level.start, steps);             // ② GDD② 共享原语
  const backtracks = countBacktrackSegments(segments);            // ③ GDD② 共享原语
  return { gate: 'G3', pass: backtracks === 0, detail: `backtracks=${backtracks}` };
}
```

**复杂度 O(path.length)。** 与 GDD④ 运行时结算**调用同一组函数**——两者必须产生同一个数字，否则就是 Phase 1 已识别的头号漂移风险。

> **为什么 G3 是硬门禁**：三星锚定在"零回头路"上，则任何**不存在**零回头路解的关卡都会让三星不可达，成就者（Bartle 主定位）失去锚点，SDT 胜任感直接崩塌。手工关卡同样必须过 G3。

### 4.5 G4 确定性

- 判定：同一 `(seed, tier, generatorVersion)` 连续调用两次，`canonicalJSON(level)` **逐字节相同**。
- 前置：生成器禁用 `Math.random()`；PRNG 固定为 **mulberry32**（算法规格见 GDD⑥ §4.1）。
- 规范化 JSON 约定：对象键按字典序排序（GDD② X7）。
- **失败必须报错，不允许靠"重生成一次碰巧通过"绕过**——确定性失败永远是 bug。

### 4.6 G5 尺寸与依赖合规

逐项静态检查，全部字段检查为 O(格子数)：

| 项 | 判据 |
|---|---|
| 尺寸 | `gridSize ∈ {9,11,13}` 且 ≤ 13；外圈全 `wall` |
| 依赖深度 | `computeLockDepth(level) === meta.lockDepth`（GDD③ §4.3），且 ≤ 2 |
| 数量 | `keys.length ≤ 3`、`doors.length ≤ 3`、每色恰好 1:1（GDD③ K2） |
| 死路分支 | `countDeadEndBranches(level) ≤ 6`，且**互连检测通过**（D9，见下） |
| 元数据一致性 | X1–X3、X5 全部通过 |

**死路互连检测（D9）**：从主干路径上每个分支接入点做泛洪，任何一条死路分支若与主干存在 **≥ 2 个**接触点，或两条分支彼此连通 ⇒ 判定捷径 ⇒ 失败。

#### 4.6.1 countDeadEndBranches 定义

**定义**：`countDeadEndBranches(level)` = 不在 trunk 上的地板格，按其到 trunk 的连通性划分成的"死路分支"分量个数。其中分量判定为死路分支的充要条件是：

- (a) 该分量不含任何 `trunk` 格；
- (b) 该分量与 `trunk` 的接触点（接入点）恰好为 **1** 个；
- (c) 该分量内部为死胡同结构（末端格的四邻，除接入方向外全为 `wall`）。

> 术语约定（与 Phase 2 冻结决策一致）：`trunk` = `expectedSolution` 主解路径覆盖的格子集合；`dead-end branch` = 不在 trunk 上、仅通过单一接入点连到 trunk 的死胡同子图。

**算法伪代码**（语言无关）：

```
function countDeadEndBranches(level):
    # 1. 标记 trunk 集合
    trunk := set()
    for cell in level.expectedSolution:
        trunk.add(cell)

    # 2. 对全图地板格做泛洪，跳过 trunk 格，得到极大连通分量
    visited := set()
    components := []                       # 每个元素是一个地板格集合
    for cell in level.floorCells:
        if cell in trunk or cell in visited:
            continue
        # 独立泛洪：仅连通非 trunk 地板格
        comp := floodFill(cell, where: neighbor is floor AND neighbor not in trunk)
        for c in comp: visited.add(c)
        components.append(comp)

    # 3. 对每个分量判定是否为合格死路分支
    count := 0
    for comp in components:
        # 接触点 = 分量边界上邻接 trunk 的地板格数
        touchPoints := { c in comp : exists neighbor(c) in trunk }
        if |touchPoints| == 1:             # 条件 (b)
            if isDeadEndStructure(comp):   # 条件 (c)：末端全墙
                count += 1                  # 条件 (a) 已由泛洪保证
    return count
```

**返回语义**：返回整数 = 合格死路分支分量（`touchPoints==1` 且内部死胡同）的个数；该值须 **≤ 6** 方满足 G5 门禁。

**契约用例**（仿 GDD② C1/C2/C3 风格）：

- **C-M2-1**：直线无分支迷宫（仅 `trunk`，无任何非 trunk 地板格）→ 返回 **0**。
- **C-M2-2**：`trunk` 旁挂 **1 条**单接入点死胡同（1 个极大连通分量）→ 返回 **1**。
- **C-M2-3**：两条死胡同共用 **1 个**接入点（呈 Y 形，仍属 1 个极大连通分量）→ 返回 **1**（按"极大连通分量"计，非按末端数计）。
- **C-M2-4**：某"死路"实际有 **2 个** `trunk` 接触点 → **不计**为死路分支（`touchPoints==2` 不满足 (b)），属 D9 互连违例，由 D9 单独判失败，不在本函数计数内。

**与 D9 / G5 的关系**：本函数只数"合格死路分支"（互连检测由 D9 独立进行）；两者**同时**通过，G5 才成立。

### 4.7 G6 档位命中

- 中档：`35 ≤ expectedSolution.length ≤ 55`
- 高档：`50 ≤ expectedSolution.length ≤ 80`
- 每日种子每天产出**两张**，分别命中两个区间（D8）。

---

## 5. 构造式生成四步（详细规格）

> 输入：`GenerateRequest`。输出：`GenerateResult`。四步循环直到通过或触发兜底。

### 步骤 1 · 造零回头路主干解

1. 在内部网格 `(gridSize − 2)²` 上，随机选 `start` 与 `exit`（曼哈顿距离需 ≥ 目标长度的合理下界）。
2. 用 PRNG 引导的**随机 DFS** 生成一条从 `start` 到 `exit` 的**自避路径**。
   - 自避是硬要求：**这一步决定了 G3 天然成立**（§2.3）。
3. **长度控制：拒绝采样**。生成后测长：
   - 落在目标区间 → 进入步骤 2；
   - 否则重试，本步最多 **50 次**；
   - 50 次仍不命中 → 放宽区间 ±5 步再试一轮；仍失败则**降级**（见 §5.5）。

### 步骤 2 · 撒钥匙与门形成依赖链

**规则：门放在主干的段边界；其对应钥匙必须放在该门【之前】的主干段上。** 这样"必定先经过钥匙才遇门"，可解性由构造保证。

| 目标 | 做法 |
|---|---|
| **L1** | 在干路上取 1 个切分点放门 D1；钥匙 K1 放在 `start → D1` 段上 |
| **L2** | 再取第 2 个切分点（D1 之后）放门 D2；钥匙 K2 放在 `D1 → D2` 段上 |
| **第 3 对（可选）** | 必须与 K1 或 K2 **并列**（放在同一段），对应门也在同一层，**不得串联到第三层**（GDD③ §2.3） |

深度 = 串联门数 ⇒ 天然 ≤ 2。放置后运行 GDD③ `computeLockDepth` 复核。

### 步骤 3 · 加死路干扰（**D9 禁互连**）

1. 在未使用的内部空格上，从**主干的某个非边界点**生长分支。
2. 分支数量 ≤ `MAX_DEAD_ENDS`（6）。
3. **禁止互连**：完成后运行 §4.6 的互连检测；任何分支若有 ≥2 个主干接触点、或两分支相连 ⇒ **丢弃本次生成，回到步骤 1**。
4. 已通行：此步只**增加**路径选项，绝不改变主干解本身 ⇒ `expectedSolution` 保持有效。

### 步骤 4 · 复验与回退

```
for attempt in 1..MAX_ATTEMPTS:
    level = construct(seed + attempt, tier)          // 步骤 1–3
    gates = [G1..G6].map(g => run g)
    if gates.every(pass): return { level, gates, attempts: attempt, fallbackUsed: false }

// 降级：缩短目标长度 → 减门数 → 降尺寸档
level = constructWithRelaxedParams(...)
if all gates pass: return { ..., attempts: MAX_ATTEMPTS }

// 最终兜底
return { level: FALLBACK_LEVEL[tier], ..., fallbackUsed: true }
```

> **兜底不可省略**：每日种子**绝不能有空缺日**——缺一天对玩家极其显眼。降级后仍失败时，回退到 `FALLBACK_LEVEL[tier]`（预置的固定手工关卡，已预先通过全部 G1–G6）。

---

## 6. 与其他系统的接口

| 对端 | 方向 | 内容 |
|---|---|---|
| **GDD② 共享原语** | ← | `splitSegments` / `countBacktrackSegments`——**只读调用**，不得复制 |
| **GDD③ 锁钥系统** | ← | `computeLockDepth`（G5）、`resolveMove` / `onEnterCell`（重放） |
| **GDD④ 星级结算** | ⇌ | **必须与本 GDD 的 G3 产出同一个数字**（同一原语 + 同一组断言） |
| **GDD⑥ 每日种子** | → | 提供 `generate(GenerateRequest): GenerateResult`；PRNG 与版本绑定由 ⑥ 定义 |
| **关卡编辑器/CI** | ← | 手工关卡入库前跑 G1–G3 + G5；CI 失败即拦截 |

---

## 7. 边界与异常

| # | 场景 | 处理 |
|---|---|---|
| **Z1** | `expectedSolution` 缺失 | 立即失败，**不是警告**（GDD② X4） |
| **Z2** | `expectedSolution` 长度为 0 | G1 失败（无法抵达出口） |
| **Z3** | 重放中途越界/撞墙 | G1 失败，报出第 n 步的坐标 |
| **Z4** | 生成 8 次全失败 | 降级流程 → 兜底关卡（§5.5），并记录告警便于调参 |
| **Z5** | 降级后长度低于档位下界 | G6 失败 → 兜底 |
| **Z6** | 内部网格过小（`gridSize=9`，内部 7×7）装不下两对锁 | 该尺寸只用于 L1–3（无锁档）；生成器固定使用 `gridSize=13` |
| **Z7** | 门放在起点或出口格上 | 步骤 2 禁止；由 X2/X3 兜底校验 |
| **Z8** | 同 tier 当天两张图恰好相同 | 概率极低且可接受；若需避免可在 §5.5 对两张做一次去重比对 |

---

## 8. 可判定验收口径

| # | 判据 | 方法 |
|---|---|---|
| **Q1** | 全部手工 12 关通过 G1–G3 + G5 | CI 门禁；任一不过即拦截入库 |
| **Q2** | **连续 30 个每日种子 100% 通过 G1–G6** | 脚本批量验证；同时确认无 `fallbackUsed` |
| **Q3** | **G3 复杂度为 O(path)** | 500 步长路径判定耗时 < 1ms；代码中**不存在**对"零回头路解是否存在"的搜索/回溯调用 |
| **Q4** | G3 与运行时星算一致 | 对同一 `Level`：把 `expectedSolution` 喂进 GDD④ `settle`，必须得 **3★**。这条断言是防漂移的总闸 |
| **Q5** | 确定性（G4） | 同 seed 两次 `canonicalJSON` 全等；跨浏览器（Chrome/Firefox/Edge）结果一致 |
| **Q6** | 死路禁互连（D9） | 生成 100 张随机种子，互连检测检出率必须与人工抽查一致；检出后必定重生成而非放行 |
| **Q7** | 无捷径 | 高端 datagram：不存在长度 < 0.8 × `expectedSolution.length` 的替代通关路径 |
| **Q8** | 兜底有效 | 人为让生成器 8 次全失败，必须产出 `FALLBACK_LEVEL` 且当日有题可玩 |
| **Q9** | 主观质量 | 人工抽检 5 张生成图；若 ≥2 张被判"无趣"（无有效诱导死路 / 主干过于直白）→ 调整生成器参数（`concept.md` §8 R6） |

---

## 9. 风险与缓解

| # | 风险 | 缓解 | 验收 |
|---|---|---|---|
| **SV1** | **G3 被实现成搜索**（2^169 状态空间） | 文档顶部醒目光警告 + §4.4 给出规范实现 + Q3 断言 | Q3 |
| **SV2** | G3 与运行时星算漂移 | 唯一共享原语 + **Q4 交叉断言**（门禁侧喂给运行时必须 3★） | Q4 |
| **SV3** | 生成器静默产出不可三星关卡 | G3 硬阻断 + Q1/Q2 100% 通过率 | Q1 + Q2 |
| **SV4** | 误用 `Math.random()` 污染确定性（跨浏览器不一致） | 固定 mulberry32（GDD⑥）+ 禁 `Math.random()` + G4 报错而非重试 | Q5 |
| **SV5** | 每日种子出现空缺日 | 三级回退：换种子 → 降级 → 预置兜底 | Q8 |
| **SV6** | 生成关卡单调/无趣 | 明确"诱导死路数量"为生成器可调参数（建议 ≥2 条有效诱导）；Q9 人工抽检兜底 | Q9 |
| **SV7** | 捷径绕过使 G2/G6 判定失真 | D9 禁互连 + Q7 | Q7 |

---

*GDD ⑤ 结束 · 依赖：GDD②③④　被依赖：GDD⑥*
