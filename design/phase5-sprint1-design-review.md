# Phase 5 · Sprint 0/1 域内核设计评审（P5-S0S1-DESIGN）

> 评审角色：design-strategist（文策渊）｜职责：核对 E1 域内核是否忠实于 GDD **设计意图**
> 范围：Sprint 0（E0 脚手架）+ Sprint 1（E1 域内核 TDD）；主理人已独立复核 `npm test`=70/70（QA 补测后），DQ3 干净
> 纯评审，**未修改任何 `src/` 代码**

---

## 评审结论总览

| # | 评审项 | Verdict | 核心证据 |
|---|---|---|---|
| 1 | GDD②/④ 段切分 + 星级 | **PASS** | `segments.ts:13,33` 唯一实现；`stars.ts:47` 三档映射 |
| 2 | GDD① 滑行 S1–S4 | **PASS** | `glide.ts:51-69` 四谓词齐全 + `gridSize²` 上限 |
| 3 | `cellRenderState` 单函数 / full 无 UNKNOWN / fog 四态 | **PASS** | `visibility.ts:56-79`（附 WALL_MEMORY 设计注释） |
| 4 | D11 撤销：visited 单调 / 粒度 / 深拷贝 | **PASS** | `undo.ts:9-33` + `runstate.ts:45` |
| 5 | GDD③ 锁钥 K1–K6 | **PASS** | `lockkey.ts:18,68`（唯一生产者 + ≤2 层） |
| 6 | GDD① §4.6 / Q2 墙邻感知 | **PASS** | `visibility.ts:23-48` + `VISION_R=3`（`metrics.ts:18`） |
| 7 | GDD⑤ §4.6.1 M-2 死路计数 + D9 设计层判断 | **PASS\*** | `deadends.ts:87-97`（函数忠实；D9 检测为 E4 缺口，见 H1） |
| 8 | ADR-01 确定性（无 Math.random / 唯一 PRNG） | **PASS** | grep `Math.random`=0；`rng.ts:11,27` 唯一 |

\* 第 7 项：函数本体严格符合 §4.6.1 定义（**PASS**）；但其**无法检测 D9 互连/捷径**，该检测归属 E4 独立泛洪，目前空缺 → 见「设计层隐患 H1」，并影响 G5 整体门禁完整性（**不判 E1 FAIL**，按背景约定 D9 缺口归 E4）。

**总体门禁：PASS（E1 域内核设计忠实）**，附 1 项高优先级设计层隐患（H1 / D9）须 E4 关闭后方可信任生成关卡，否则 G5 的「防捷径」臂为静默空转。

---

## 逐条结论 + 证据

### 1. GDD②/④ 段切分 + 星级 —— PASS

**W1（单点实现）**：全仓 `splitSegments` 仅 `src/sim/segments.ts:13`，`countBacktrackSegments` 仅 `src/sim/segments.ts:33`；`stars.ts:6` 与（E4 的）`gen/gates.ts` 均为只读 `import` 调用。grep `function (splitSegments|countBacktrackSegments)` 全 `src/` 各 1 处，符合 W1。

**星级映射（GDD④ §2.1）**：`stars.ts:47` `backtracks===0?3 : backtracks<=1?2 : 1`，与「0→3★ / ≤1→2★ / 否则 1★」逐字一致。`settle` 仅在 `run.finished` 时结算（`stars.ts:40`，Y1/B4）。

**参考用例校验（C1 核心契约）**：C1 `Start→A→B→C[钥匙]→B→A→D→E[出口]`。本实现切分：`[start,A,B,C]`（C 为 key 事件段尾）+ `[C,B,A,D,E]`。两段内部格均互异 → `countBacktrackSegments=0` → 3★。关键正确点：**折返经过的 B/A 落在第二段内各自唯一**，未误用「全程去重」，符合 GDD② §4.2「跨段不算、段内算」裁决。C2/C3 同理（1 段回头路 → 2★）。

**Q4 交叉断言常驻**：设计意图由 ADR-04 §3.4 规定为 CI 契约测试（同 `Level` 的 `expectedSolution` 喂 `settle()` 必得 3★）；主理人复核称 E1 契约覆盖完整（70/70）。**评审者未直接打开测试文件**（不在必读清单），故记为「按 QA/ADR 确认」；建议后续补一条显式证据：测试目录中存在断言 `settle(replay(level))===3` 的常驻用例（见隐患 H4）。

### 2. GDD① 滑行 S1–S4 —— PASS

`planSlide`（`glide.ts:51-69`）每进入新格 C 后按序求值四谓词：

- **S1 抵墙/抵不可开门**（`glide.ts:58-59`）：入格前先 `resolveMove`，`BLOCKED` 即 `break` 停于当前格；未开门在前方 → S1 停于门前（契合 GDD① E8）。✓
- **S2 实体**（`glide.ts:62`）：`hasEntity`（`glide.ts:12-17`，含 exit/key/door）= true 即停，不穿过。✓
- **S3 通行路口**（`glide.ts:24-40,66`）：垂直方向存在「当前可通行」邻格（排除刚进入的上格），且「当前打不开的门不构成路口」（`:37` `resolveMove!=='BLOCKED'`）。✓
- **S4 环形保护**（`glide.ts:53,64`）：`slideSeen` 含本滑行已走格，`has(k)` 即 `break`；并设 `while(result.length < max)`、`max=gridSize²`（`glide.ts:55-57`）→ 单次滑行必终止且 ≤`gridSize²` 格（V3/E1）。✓

S2→S4→S3 的求值顺序与 GDD 列表略有差异，但环形走廊中垂直邻格恒为墙（S3 永触发），非环路口 S4 不触发，二者顺序不引入语义冲突。**不变量**（架构 §3.2）成立：S2 保证中途格恒为无实体地板，执行期锁钥态不变，`planSlide` 一次性规划与逐格执行一致。

### 3. `cellRenderState` 单函数 / full 无 UNKNOWN / fog 四态 —— PASS

- **单一函数**：`cellRenderState` 仅 `visibility.ts:56`（grep 全 `src/` 1 处），无 full/fog 分支版本（A2 / M4）。✓
- **full 模式绝不返回 UNKNOWN**（V6/A2）：墙分支 `visibility.ts:70` 直接 `return 'WALL'`；地板分支 `inView` 在 full 下恒真（`visibility.ts:66`），只可能返 `VIEW_WALKED/VIEW_UNWALKED`（`visibility.ts:77-78`）。`MEMORY_WALKED` 需 `!inView && walked`，full 下 `inView` 必真 → 永不出现。**关 1–8 不产出 UNKNOWN/MEMORY_WALKED**，符合 D2。✓
- **fog 四态**：`VIEW_WALKED/VIEW_UNWALKED/MEMORY_WALKED/UNKNOWN` 四玩家态均可达（+ 墙态）。✓

**设计注释（非缺陷）**：实现导出 **6 态**（`UNKNOWN/VIEW_UNWALKED/VIEW_WALKED/MEMORY_WALKED/WALL/WALL_MEMORY`），相较 GDD① §4.7 伪代码的「墙仅 WALL/UNKNOWN」多出一个 `WALL_MEMORY`。这是 ADR-03 §1 L1「记忆层（记忆态墙）」的**有意丰富**：墙邻感知永久可见的墙按「半径内全浓度=WALL / 仅墙邻感知=WALL_MEMORY」区分浓度，服务「认知地图单调增长」意图。玩家侧 UX（四态）未被破坏，属合理增强；但 **GDD① §4.7 伪代码应同步修订**以避免日后漂移（见 H2）。

### 4. D11 撤销：visited 单调 / 粒度 / 深拷贝 —— PASS

- **visited 单调、不回滚**（D11/V5/W6）：`RunSnapshot` 类型不含 `visited`（`types.ts:80-87`）；`popSnapshot`（`undo.ts:23-33`）完全不触碰 `visited`；`runstate.ts:45` `state.visited.add(key(cell))` 仅增。✓
- **粒度 = 一次滑行**（D5）：`pushSnapshot` 在 `applySlide` 进入滑行循环**前**调用一次（`runstate.ts:38`），空滑行（撞墙）不压栈（`runstate.ts:36`）。✓
- **深拷贝防别名**：`pushSnapshot` `keysHeld:new Set(...)`、`doorsOpened:new Set(...)`（`undo.ts:12-13`）；`popSnapshot` 出栈时 `new Set(snap.xxx)` 替换实例（`undo.ts:27-28`），`pos` 用扩展拷贝。无共享引用风险。✓

`path/steps` 随快照回滚、`elapsedMs` 不回滚，与 GDD① §4.5 撤销行为表及 D5「撤销可磨三星」一致。

### 5. GDD③ 锁钥 K1–K6 —— PASS

- **唯一生产者**：`ProgressEvent` 字面量仅出现在 `lockkey.ts:29,36`（grep 全 `src/` 仅此两处）；`move.ts` 只做通行判定、不产事件。`onEnterCell` 为唯一生产者（GDD② §5 / GDD③ §4.2）。✓
- **K2 1:1 同色**：`onEnterCell` `if/else` 结构（`lockkey.ts:24-38`）依赖「每色恰 1 钥匙 1 门」不变式（`:15` 注释「K2 1:1 保证 k/d 不并存」），由 X3 单实体 + X1 同色校验在加载期建立。
- **K4 自动开启**：`resolveMove` 返 `OPEN_AND_ENTER`（`move.ts:29`）→ `onEnterCell` 开门（`lockkey.ts:34-36`）。✓
- **K5 钥匙不消耗**：`keysHeld.add` 后永不删除（`lockkey.ts:28`）。✓
- **K6 / computeLockDepth ≤ 2 层**：`computeLockDepth`（`lockkey.ts:68-84`）轮次泛洪仅 1..2 轮，返回 `0|1|2` 或 `UNSOLVABLE`；**不可能返回 >2**，并列门不增深度（LK3）。✓ 同时兼作 G1 可解性（UNSOLVABLE ⇒ 失败）。

### 6. GDD① §4.6 / Q2 墙邻感知 —— PASS

- **R=3 切比雪夫**：`computeVisibility` 用 `VISION_R`（`visibility.ts:25`），`metrics.ts:18` `export const VISION_R = 3`（const，全仓无改大路径，ADR-03 M5/控制清单 F 组）。✓
- **墙邻感知**（Q2/V7）：`visibility.ts:35-46` 以 `base = visited ∪ visible` 为基准，遍历 8 邻域，墙格必入 `visible`。满足「任意已访问地板格或任意当前可见格的 8 邻域内墙格 → visible」，且随 `visited` 单调、记忆区旁相邻墙**永久可见**（`:21` 注释）。✓

**设计注释（非缺陷）**：GDD① §4.6 的**散文**写「任意当前可见格」、但**伪代码**写 `(radiusSet ∩ 地板)`——二者在「基准是否含半径内墙」上不自洽。实现取**散文口径**（`base` 含完整 `visible`，含半径内墙），故会把「与可见墙相邻的外侧墙」也纳入可见。该丰富有界（仅墙、O(周长)）、且更贴合「永远看得见相邻墙」意图，无害；但 **GDD① §4.6 伪代码与散文需统一**（见 H3）。

### 7. GDD⑤ §4.6.1 M-2 死路计数 + D9 设计层判断 —— PASS\*（函数忠实；D9 检测空缺→H1）

**函数忠实度**（§4.6.1 三条件）：
- (a) 非 trunk：`nonTrunkComponents` 泛洪跳过 trunk 格（`deadends.ts:23-51`）。✓
- (b) 接触点恰 1：`touchPoints` 4 邻域计数（`deadends.ts:69-81`），`!==1` 跳过（`deadends.ts:92`）。✓
- (c) 树状无环：`isTree` 用「|V|===|E|+1（4 连通边）」判定（`deadends.ts:54-66`）。对**单接入点**分量，树⟺「末端格四邻除接入外全为墙」，与 §4.6.1(c) 数学等价；C-M2-1/2/3 用例均正确（Y 形多末端仍按极大连通分量计 1，符合 C-M2-3）。✓

**对 D9 互连缺口的设计层判断（核心）**：
`countDeadEndBranches` **仅数合格分支，不检测互连**——代码头注释已声明「互连检测（D9）由独立泛洪负责，本函数只数合格分支」（`:5`）。因此：

> **仅计数会误判。** 当两死路分支被生成器意外相连（或某分支与主干 ≥2 接触点）时：
> - 若合并后**仍仅 1 个 trunk 接触点且树状** → 被计为 **1** 个合格分支（本应分计 2，且已隐含捷径走廊）；
> - 若合并后 **≥2 个 trunk 接触点** → `touchPoints!==1` 被**跳过**，计为 **0**；
> - 两种情况 `isTree` 对「含环互连」均判 false → 同样被跳过。
>
> 即：**互连 = 捷径（绕过主线的更短通关路径），既被少计/不计，又不会被本函数标为 D9 违例**。该检测职责属 E4 的「主干每个接入点独立泛洪」（GDD⑤ §4.6 末段），目前**未实现**（背景所列 3 处 E4 缺口之一）。

**设计影响**：在 D9 独立泛洪落地前，G5 的「防捷径」臂实质为空转——一个含隐藏捷径的生成关可凭 `countDeadEndBranches ≤ 6` 且 D9 臂缺席而**静默通过 G5**，直接威胁 GDD③ L7（无捷径）、GDD⑤ Q7（无短替代路径）、及 G6 档位长度判定的真实性。属**高优先级设计层隐患 H1**，归 E4，不判 E1 FAIL（按背景约定）。

### 8. ADR-01 确定性 —— PASS

- **无 Math.random**：grep `Math\.random` 于 `src/` → **0 命中**（满足 ADR-01 §3.7/A1、DQ3）。✓
- **唯一 PRNG/哈希**：`mulberry32`（`rng.ts:11`）、`fnv1a32`（`rng.ts:27`）全 `src/` 各 1 处；种子派生 `getSeed`/`deriveAttemptSeed` 均走 `fnv1a32`（`:44,53`），重试种子用哈希派生而非 `seed+1`（ADR-01 §3.4，规避 mulberry32 相邻种子相关性）。✓
- **UTC 口径**：`getDateKeyUTC`（`rng.ts:58-63`）取 UTC 日历，符合 GDD⑥ §4.2。✓

E1 域内核（sim/input/core/util）不引入任何非确定源；确定性契约在 E1 已成立。Q2「30 天全过且无 fallback」属 E4 生成器/Daily 回归网，需 E4 脚本落地方能证明（见下方背景缺口影响）。

---

## 设计层隐患（「测了但语义有风险」）

### H1（高）· D9 互连/捷径检测空缺（第 7 项延伸）
- **风险**：`countDeadEndBranches` 设计上**不负责** D9 检测（见 `deadends.ts:5`），而 E4 的「主干接入点独立泛洪」尚未实现。后果：含隐藏捷径的生成关可静默过 G5，破坏 L7/Q7/G6。
- **为何「测了但有风险」**：域内核单测（70/70）只能证明「函数按 §4.6.1 计数正确」，证明不了「D9 被守住」——因为守护 D9 的代码根本不在 E1。
- **建议**：E4 必须在 `gen/gates.ts` 落地 §4.6 末段独立泛洪（≥2 接触点 / 两分支相连 ⇒ 失败）；并以 GDD⑤ Q6（100 张随机种子检出率与人工抽查一致、检出即重生成）做回归。在此之前，生成关卡 G5 结论不可信。

### H2（低-中）· `cellRenderState` 6 态 vs GDD① §4.6.1 伪代码 2 态
- 实现引入 `WALL_MEMORY`（ADR-03 M-3 记忆层），是合理增强，但 GDD① §4.7 伪代码仍为「墙仅 WALL/UNKNOWN」。
- **建议**：将 GDD① §4.7 修订为 6 态定义（或显式说明 WALL_MEMORY 为记忆浓度分支），避免后续实现者按旧伪代码误解「fog 只有 5 态」。

### H3（低）· GDD① §4.6 散文与伪代码在「墙邻基准」不自洽
- 散文「任意当前可见格」/ 伪代码「radiusSet ∩ 地板」。实现取散文口径（含半径内墙）。
- **建议**：统一伪代码为 `base = visited ∪ visible`（与实现一致），消除内部歧义。

### H4（低）· Q4 交叉断言需补显式证据
- ADR-04 §3.4 要求「同 Level 的 expectedSolution 喂 settle 必得 3★」为 CI 常驻契约；主理人复核称 E1 契约覆盖完整，但评审者未直接审视测试文件。
- **建议**：确认测试套件中存在该常驻断言（防 G3/运行时漂移总闸），并在评审归档中留存用例名。

---

## 背景所列 3 处 E4 缺口的设计层影响确认

1. **K2 同色 1:1 校验（E4 加载期 X1）**：`onEnterCell` 运行时假定「每色恰 1 钥匙 1 门」（`:15` 注释）。该不变式由 E4 加载期 X1 建立；E1 不重校验。若 X1 未布防，运行时会静默取首个匹配（潜在「双钥匙同色重复拾取」）。**不判 E1 FAIL**，但生成器入库前须确保 X1 到位。
2. **Q2 每日种子 30 连测（E4 门禁）**：属生成器/Daily 回归网（GDD⑤ Q2 / DQ2）。E1 确定性契约已成立（无 Math.random、PRNG 唯一），但「30 天全过且无 fallback」需 E4 脚本证明。**不影响 E1 功能正确性**。
3. **M-2 的 D9 互连独立泛洪（E4 缺口）**：即 **H1**，最高优先级，见上。

---

## 总体门禁

# **PASS（E1 域内核设计忠实）**

- 8 项评审中 7 项纯 PASS，第 7 项函数本体 PASS、其缺口（D9 检测）归 E4。
- 域内核在段切分、星级、滑行语义、撤销边界、锁钥唯一生产者与 ≤2 深度、墙邻感知、确定性契约上**均忠实于 GDD 设计意图**，且通过 grep 实证「单点实现 / 无 Math.random / VISION_R=3」等关键不变量。
- **阻塞项**：无 E1 阻塞。但存在 **1 项高优先级跨阶段设计层隐患 H1（D9）**，须 E4 落地独立泛洪后方可信任生成关卡 G5 完整性——**不阻断本次 E1 签字，但为项目级待办**。

**签字建议**：E1 域内核设计评审通过；放行 Sprint 0/1。D9 互连检测列入 E4 验收硬门禁，并在生成器 GA 前关闭。
