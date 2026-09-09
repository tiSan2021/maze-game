# GDD ⑥ · 每日种子

> Phase 2 · 系统设计 | 作者：文策渊（设计策略师）| 状态：待主理人评审
> 上游：`concept.md` v2.1（§4.1 关联感、§5.1 #6、§5.3）｜GDD②（`Level`）｜GDD④（星级）｜GDD⑤（生成器）
> 决策来源：**D8**（每天两张）｜**D10**（mulberry32 + 版本绑定）｜D4/D7

## 1. 目的与范围

**定义**：每日两题的生成与派发规则——日期到种子的映射、PRNG 规范、两张题的档位、解锁门禁、成绩记录与 UI 入口。

**不定义**：生成器算法本身（GDD⑤）｜星级判定（GDD④）｜ `Level` 结构（GDD②）。

**一句话**：用最低的成本给已完成主线的玩家提供"每天一道共同的题"，补 SDT 里最弱的**关联感**一环。

---

## 2. 核心机制

### 2.1 每天两张（D8）

| 题 | 档位 | `expectedSolution` 目标长度 | `visionMode` |
|---|---|---|---|
| 每日 · 中 | mid | 35 – 55 步 | `fog` |
| 每日 · 高 | high | 50 – 80 步 | `fog` |

- 两张**玩家自选**，不是强制连续挑战。每天投入时间可控。
- 难度均对应主线 L9–12 水平 ⇒ **恒为迷雾**（玩家已具备认知地图能力）。
- GDD⑤ 的 G6 据此写为"当天两张分别命中中/高档"。

### 2.2 同一天、同一档 ⇒ 同一张图（D10 核心）

`seed = hash(dateKey, tier, generatorVersion)`。同一 `(dateKey, tier, version)` 在任意机器上产出**逐字节相同**的 `Level`。这是"可分享、可比成绩"的唯一前提。

### 2.3 主线通关后解锁

避免新玩家第一天撞上一张带迷雾 + 双锁的陌生图——那会把 R3「难度断崖」与 R1「迷路挫败感」叠加。

### 2.4 弱关联感，不是社交系统

每日种子提供的是**弱共同话题**（"今天这道题"），**不得**演化为排行榜 / 账号 / 好友（`concept.md` §5.7 #4）。无服务器、无账户，成绩只存本地。

---

## 3. 数据结构 / 状态

```ts
type Tier = 'mid' | 'high';

interface DailySeedKey {
  dateKey: string;            // '2026-09-05'，UTC 日期（见 §4.2）
  tier: Tier;
  generatorVersion: number;   // D10：版本参与种子派生
}

interface DailyRecord {       // localStorage
  dateKey: string;
  tier: Tier;
  generatorVersion: number;   // 记录当时版本，版本变更后不计入连胜序列
  bestStar: 1 | 2 | 3;
  bestStarSteps: number;
  bestStarElapsedMs: number;
  completed: boolean;
}

interface DailySeedState {
  unlocked: boolean;          // 主线 12 关全部 ≥1★ 后为 true
  todayKey: string;
  levels: Record<Tier, GenerateResult>;   // GDD⑤ 产出
}
```

---

## 4. 算法 / 规则

### 4.1 mulberry32（**D10，规范实现**）

```ts
/** 唯一允许的 PRNG。实现短、无依赖、确定性好。禁止 Math.random()。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

> **为什么必须固定到算法名**：只写"使用确定性 PRNG"不足以保证跨浏览器一致——各引擎/各库的默认随机实现不同，"同种子同图"会**静默失效**，而这种 bug 要等到有玩家比对成绩时才暴露，排查成本极高。

### 4.2 日期口径（**本 GDD 新增决策，需主理人知悉**）

**采用 UTC 日期**（`YYYY-MM-DD`，按 UTC 日历取年月日）。

| 方案 | 优点 | 缺点 |
|---|---|---|
| **UTC（选用）** | 全球同一时刻同题，可比性最强；单键 `-` 的"今天"在世界范围内唯一 | 部分时区在**当地非午夜**换题（如 UTC+8 为当地 08:00） |
| 本地日期 | 换题时刻符合各自作息 | 不同时区玩家在边界日拿到不同题，破坏可比性 |

**选择理由**：每日种子的价值锚点是"和别人解同一道题"（SDT 关联感），可比性优先于作息贴合。此决策**可翻转**（改动仅限 `getDateKey()` 一行），但翻转后不可再声称"全球同题"。

### 4.3 种子派生

```
getSeed(key: DailySeedKey): number {
  const s = `${key.dateKey}|${key.tier}|v${key.generatorVersion}`;
  return fnv1a32(s) >>> 0;          // 字符串 → uint32，稳定无依赖
}
```

- `fnv1a32` 需固定实现（32 位 FNV-1a，offset basis `0x811c9dc5`，prime `0x01000193`）；它与 mulberry32 一样是确定性契约的一部分，**不得替换**。
- 若这两个哈希/PRNG 之一被替换，即使仍是"确定性"实现，也会让所有历史种子失效且不可复现。
- **版本参与派生**（D10）：`generatorVersion` 变更 ⇒ 该日及以后所有种子改变。

### 4.4 版本升级的处理（D10）

| 场景 | 处理 |
|---|---|
| 生成器版本 `v1 → v2` | 该日图作废（种子已变），**生成 v2 序列的新图** |
| 历史 `DailyRecord`（v1） | **保留但在 UI 标注为旧版本**，不计入 v2 的连胜统计（避免跨版本比较失真） |
| 玩家当天已打过 v1 | 允许继续完成，成绩标 `generatorVersion=1`；不与 v2 成绩并列 |

### 4.5 每日主流程

```
bootstrapDaily(mainProgress):
  unlocked = mainProgress.allMainCleared          // 主线 12 关 ≥1★
  if !unlocked: return { unlocked: false }

  dateKey = getDateKeyUTC(now)
  for tier of ['mid','high']:
      key   = { dateKey, tier, generatorVersion: CURRENT }
      seed  = getSeed(key)
      res   = generate({ seed, tier, generatorVersion: CURRENT })   // GDD⑤
      levels[tier] = res                          // 含 fallbackUsed 标记
  return { unlocked: true, todayKey: dateKey, levels }
```

**两张题的生成完全在客户端本地完成**（生成器是随包发布的前端代码），无服务器、无网络请求——这意味着玩家离线也能玩当日题，且不存在服务端时间口径分歧。

### 4.6 与题库的 id 约定

`level.id = \`daily-${dateKey}-${tier}\``，作为 GDD④ 存档的键 ⇒ 每日成绩与主线成绩天然隔离。

---

## 5. 与其他系统的接口

| 对端 | 方向 | 内容 |
|---|---|---|
| **GDD⑤ 求解器/生成器** | → | 调用 `generate(GenerateRequest)`，接收 `GenerateResult`（含六门禁结果与 `fallbackUsed`） |
| **GDD② 数据模型** | ← | 生成结果为标准 `Level`，**与手工关卡同类型**，引擎无来源分支 |
| **GDD④ 星级结算** | → | 以 `daily-*` 为键写入 `LevelRecord` |
| **GDD① HUD/UX** | → | 关卡标签显示"每日 · 中/高"；因 `visionMode='fog'` 必显四态图例 |
| **存档层** | ⇌ | `mainProgress.allMainCleared`（解锁门禁）与 `DailyRecord[]` |
| **UI** | → | 关卡选择界面在解锁后出现"每日"分区，含中/高两张入口与今日完成标记 |

---

## 6. 边界与异常

| # | 场景 | 处理 |
|---|---|---|
| **D-1** | 主线未通关 | "每日"分区**不显示**，不预告、不灰显（避免诱惑导致跳过教学） |
| **D-2** | 跨日（玩家打着打着过了 UTC 午夜） | 本局继续按**原 dateKey** 结算并写入；**下次进入**再取新题。禁止局中换题 |
| **D-3** | 生成器失败降级到 `FALLBACK_LEVEL` | 正常给出题目（保证无空缺日），记录告警；UI 不暴露差异 |
| **D-4** | 同一天同一档重复游玩 | 允许多次，`bestStar` 取 `max`（同 GDD④） |
| **D-5** | localStorage 写满 / 不可用 | 降级内存态，会话内可用；历史记录可能丢失，但不影响当日可玩 |
| **D-6** | 系统时间被篡改（玩家改日期刷图） | **不防护**。本作无排行榜、无奖励，作弊无收益；强行防护只会伤害正常用户（如时区漫游） |
| **D-7** | 生成器版本升级当天 | 见 §4.4：新种子 + 历史成绩标注旧版本 |
| **D-8** | 同一天两张图恰好雷同 | 概率极低；可在生成后做一次 JSON 去重比对，相同则对 high 档追加一次重生成（可选，非 MVP） |

---

## 7. 可判定验收口径

| # | 判据 | 方法 |
|---|---|---|
| **DQ1** | **同种子同图（跨浏览器）** | 同一 `(dateKey, tier, version)` 在 Chrome / Firefox / Edge 上产出 `canonicalJSON(level)` **逐字节相同** |
| **DQ2** | 每日两张分别命中档位 | 连续 30 天：mid ∈ [35,55] 步、high ∈ [50,80] 步；且不出现 `fallbackUsed` |
| **DQ3** | 确定性 G4 生效 | 连续两次调用 `generate`，结果全等；代码中 grep `Math.random` 应为 **0 命中** |
| **DQ4** | 版本升级生效 | 把 `generatorVersion` 由 1 改为 2，同一天种子必须改变；历史成绩 UI 标注旧版本且不计入新连胜 |
| **DQ5** | 解锁门禁 | 主线未完成星 Required 时，"每日"分区完全不出现；全部 12 关达 1★ 后出现 |
| **DQ6** | 无空缺日 | 人为让生成器 8 次全失败 ⇒ 必须回退到 `FALLBACK_LEVEL`，UI 仍有题可玩 |
| **DQ7** | 成就隔离 | `daily-*` 记录与 `main-*` 记录键空间互不干扰；打每日不影响主线星级 |
| **DQ8** | 跨日不局中换题 | 模拟穿越午夜：本局结算写入开局时的 `dateKey` |

---

## 8. 风险与缓解

| # | 风险 | 缓解 | 验收 |
|---|---|---|---|
| **DY1** | 各环境默认随机不一致 ⇒ "同种子同图"静默失效 | D10 固定 mulberry32 + 固定 fnv1a32 + 禁 `Math.random()` | DQ1 + DQ3 |
| **DY2** | 生成器版本碎片导致历史成绩不可比 | 版本参与种子派生 + 历史标注 | DQ4 |
| **DY3** | 出现空缺日（玩家可见，体验伤害大） | 三级回退 + 预置兜底关卡 | DQ6 |
| **DY4** | 时区不同 ⇒ 玩家"今天"不是同一题 | UTC 口径（§4.2）；若产品侧希望改本地日期，须同步放弃"全球同题"表述 | DQ1 |
| **DY5** | 每日图太难，成为每日挫败源 | 固定中/高两档（对应 L9–12）+ 已过主线才解锁 + 允许随意放弃不惩罚 | DQ2 + DQ5 |
| **DY6** | 每日种子被逐步做成排行榜 / 社交 | §2.4 明确边界；`concept.md` §5.7 #4 已列为砍掉项 | 评审时确认无 server / 无账号相关接口 |

---

*GDD ⑥ 结束 · 依赖：GDD②④⑤*
