# ADR-01 · 确定性随机与种子版本绑定

| 项 | 内容 |
|---|---|
| 状态 | **Accepted**（D10 用户/主理人裁决，GDD⑥ 规范实现） |
| 决策人 | 程基岩（engineering-lead） |
| 上游 | Phase 1 §6(4c) / D10 / GDD⑥ §4.1–4.4 / GDD⑤ G4 |
| 影响面 | `prng/*`、`generator/*`、每日种子、手感不可复现风险 |

---

## 1. 结论（先行）

**全仓唯一随机来源 = `mulberry32`（PRNG）+ `fnv1a32`（字符串→uint32 种子派生），种子字符串绑定 `generatorVersion`；全局禁用 `Math.random()`。每日种子采用 UTC 日期口径。**

任何模块需要"随机"时，必须向 `prng/` 申请一个由显式 seed 派生的生成器实例，不得调用语言内建随机函数。

---

## 2. 背景与约束

- **D10**：确定性 PRNG = mulberry32（实现短、无依赖、确定性好）+ 种子绑定生成器版本号。
- **为什么必须固定到算法名**：只写"用确定性 PRNG"不足以保证跨浏览器一致——各引擎/各库默认随机实现不同，"同种子同图"会**静默失效**，且要等玩家比对成绩时才暴露，排查成本极高（GDD⑥ §4.1）。
- **4c**：每日种子要求"同种子同图"可分享、可比成绩，必须指定具体算法。
- **G4 门禁**：同 `(seed, tier, generatorVersion)` 两次产出逐字节相同，失败必须报错，不可用重生成掩盖。

---

## 3. 决策要点

1. **`mulberry32(seed)`**：纯函数 `(seed: number) => () => number`，无闭包外部状态，可重放。实现取 GDD⑥ §4.1 规范代码，逐字照抄，不做"等价改写"。
2. **`fnv1a32(str)`**：32 位 FNV-1a（offset basis `0x811c9dc5`，prime `0x01000193`），字符串→uint32 稳定无依赖。GDD⑥ §4.3 只给了常数、**未给实现**，本 ADR 补齐为全仓唯一实现：

   ```ts
   export function fnv1a32(s: string): number {
     let h = 0x811c9dc5;
     for (let i = 0; i < s.length; i++) {
       h ^= s.charCodeAt(i);
       h = Math.imul(h, 0x01000193);
     }
     return h >>> 0;
   }
   ```
   （用 `Math.imul` 保证 32 位乘法不溢出为双精度，避免跨引擎差异；种子字符串一律 UTF-16 码元遍历。）
3. **种子派生**：`getSeed({dateKey, tier, generatorVersion}) = fnv1a32(\`${dateKey}|${tier}|v${version}\`)`。**版本参与派生**（D10）：版本变更 ⇒ 该日及以后所有种子改变。
4. **重试种子派生（工程侧细化）**：GDD⑤ §5 步骤 4 写作 `construct(seed + attempt, tier)`。本 ADR 改为 `deriveAttemptSeed(seed, attempt) = fnv1a32(\`${seed}|a${attempt}\`)`。
   - 理由：mulberry32 对**相邻**种子的首输出相关性偏高，`seed+1` 有可能产生与 `seed` 高度相似的第一步采样，削弱"换种子重生成"的纠错能力；哈希派生保证各次尝试是相互独立的流。语义仍完全符合 GDD 的"换种子"。
   - 影响面：仅 `gen/generator.ts` 内部，不改变对外契约；30 天门禁 Q2 是回归网。
5. **命名子流（推荐）**：`construct()` 内部为步骤 1（主干）/ 2（锁钥）/ 3（死路）各派生一条独立 RNG 流（`fnv1a32(\`${aSeed}|path\`)` 等）。收益：在步骤 3 多抽一次随机数**不会**改变步骤 1 已生成的关卡，调试与回归定位成本大幅下降；代价约 5 行代码。
6. **日期口径**：`getDateKeyUTC(now)` 返回 UTC 日历 `YYYY-MM-DD`（D13）。全球同刻同题，可比性优先（GDD⑥ §4.2）。
7. **禁用 `Math.random`**：CI/控制清单 `grep -rn "Math\.random" src/ tests/` 必须为 0 命中（DQ3）。
   > **实践提醒（易踩）**：注释、ESLint 提示文案、`console.warn` 里都**不得**写出该函数的字面量，否则自检自己命中自己。文档中用 `M·random` 代称；源码注释写"禁用内建随机函数"。
8. **时间源边界**：`Date` / `performance.now` 只允许出现在 `core/rng.ts` 的 `getDateKeyUTC` 与 `platform/clock.ts`；`sim/` 与 `gen/` 的时间一律经 `Clock` 注入。静态扫描：`sim/`、`gen/` 目录内 `new Date(` / `Date.now(` 0 命中。
9. **不可替换契约**：mulberry32 与 fnv1a32 任一被替换，即使仍"确定性"，也会让所有历史种子失效且不可复现。
10. **G4 的执行位置**：G4（两次生成逐字节相同）**不在 `generate()` 内部执行**——那会让每次生成成本翻倍。`generate()` 内部只跑 G1/G2/G3/G5/G6；G4 与同日两张去重（D-8）由 QA 脚本 `tools/qa-gates.ts` 与 `qa:daily` 在 CI / 构建期执行。

---

## 4. 后果

- **正向**：每日种子跨 Chrome/Firefox/Edge 逐字节相同（DQ1）；生成器 G4 失败即报 bug；可分享成绩、可比连胜。
- **正向**：版本升级有清晰语义（GDD⑥ §4.4）：该日图作废 → 生成 v2 序列；历史 `DailyRecord` 标注旧版本、不计入新连胜。
- **约束**：生成器代码不得引入任何非确定性输入（如 `Date.now()` 进算法、`Math.random`、外部 IO）。时间仅用于"取当天 UTC dateKey"，不进入 PRNG。
- **约束**：`generatorVersion` 作为常量集中到 `metrics.ts`（常量表隔离原则），升级需评审并显式改值。

---

## 5. 可判定验收口径

| # | 判据 | 方法 | 来源 |
|---|---|---|---|
| A1 | 全仓 `Math.random` 命中数 = 0 | `grep -rn "Math.random" src/` → 0 命中 | DQ3 |
| A2 | 同 seed 逐字节相同 | 同 `(dateKey,tier,version)` 调 `generate` 两次，`canonicalJSON(level)` 全等 | DQ1 / G4 |
| A3 | 版本升级种子必变 | `generatorVersion` 1→2，同 `(dateKey,tier)` 两次 `getSeed` 不同 | DQ4 |
| A4 | 跨浏览器一致 | Chrome/Firefox/Edge 跑同一 seed，`canonicalJSON` 逐字节相同 | DQ1 |
| A5 | UTC 口径 | 模拟 UTC+8 当地 08:00，仍按 UTC 日期取题 | D13 / GDD⑥ §4.2 |
| A6 | 日期仅用于取 key | 静态扫描：`sim/` `gen/` 内 `new Date(` / `Date.now(` 0 命中；PRNG 调用链无非确定源进入 seed | 派生审计 |
| A7 | 重试种子独立 | `deriveAttemptSeed(s,0)` … `deriveAttemptSeed(s,7)` 八条流互不相同且可复现（golden 快照） | 本 ADR §3.4 |
| A8 | 禁用字面量不自指 | `grep -rn "Math\.random" src/ tests/` 0 命中**且**注释/文案中无该字面量 | 本 ADR §3.7 |

---

*ADR-01 结束 · 关联：ADR-02（同源 Level 才需确定性）、main-architecture.md §5*
