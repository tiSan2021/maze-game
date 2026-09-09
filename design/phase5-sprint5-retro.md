# Phase 5 · Sprint 5（E5）完成记录：每日种子与结算

> 主理人：游承峰（编排 + 因成员调度限流改由主理人直落）| 评审强度：lean
> 执行时间：2026-09-08 | 基线：35 文件 / 148 用例 → **39 文件 / 175 用例全绿；tsc 0 错误**

---

## 1. 交付物

| 文件 | 职责 | 状态 |
|---|---|---|
| `src/core/clock.ts` | **新增** · 时间源抽象（A6）：`Clock` / `systemClock` / `fixedClock`。全仓唯一构造 `Date` 处 | ✅ |
| `src/gen/daily.ts` | **新增** · `bootstrapDaily`（UTC 键 → 种子 → mid/high 两条）、`dailyLevelId`、`isDailyStale`、`resolveActiveDateKey` | ✅ |
| `src/sim/progress.ts` | **新增** · 版本化存档（schema v1）、`recordResult`（max 语义）、`isMainAllCleared`、脏数据/旧版本/存储不可用降级 | ✅ |
| `src/ui/settlement.ts` | **新增** · 结算面板纯函数：星级 + 段数 + 回头路段数 + 步数 + 用时 + 历史最佳；按钮 重玩/下一关/返回选关 | ✅ |
| `src/state/app.ts` | 接线：GATE_DAILY 读真实存档、结算落库、`enterDaily` / `refreshDailyOnSelect` / `hasNextLevel`、跨午夜锁定 `activeDailyDateKey` | ✅ |
| `src/main.ts` | 存档介质探测（localStorage 不可用 → 内存态）、结算面板接线、选关「每日」分区（1/2 键）、S4 增 `N` 下一关 | ✅ |

## 2. 验收对照（简报 §5）

| 验收点 | 结果 |
|---|---|
| UTC 日期键（跨时区/跨午夜边界） | ✅ 4 组断言（08 日 23:30Z→`2026-09-08`、09 日 00:00Z→`2026-09-09`、跨年 12-31 23:59Z→`2025-12-31`） |
| 每日两条且 tier 正确、`visionMode='fog'` | ✅ mid/high 各一，id = `daily-{dateKey}-{tier}`，visionMode 强制 fog |
| 解锁门禁 | ✅ 未解锁 `bootstrapDaily` 返回 `levels:null`（不生成、不显示）；全 12 关 ≥1★ 后 `enterDaily` 成功 |
| 进度持久化 | ✅ 写读一致、含 `version`、脏 JSON/结构非法/旧版本/存储抛错均降级不崩 |
| 结算面板 | ✅ HTML 字符串断言：★/☆、段数、`N 段走了冤枉路`、mm:ss、历史最佳与刷新纪录、`hasNext` 控按钮 |
| 跨午夜 | ✅ 局中不换题（`activeDailyDateKey` 锁定）；结算键 = 开局 `dateKey`（DQ8）；回到选关才取新题 |
| A6 闸门 | ✅ 新增 `tests/ci-gates/a6-time-source.test.ts`，扫 `src/sim`+`src/gen` 时间 API 0 命中 |

## 3. 质量门判定

**PASS**（无阻塞项）。硬约束核查：

- DQ3：新增代码无内建随机；既有 `dq3-no-math-random` 闸门仍绿。
- A6：`src/sim` / `src/gen` 内时间 API 0 命中（注：两处注释原写着敏感字面量写法，已改写为"禁止直接构造时间对象"，否则闸门会被注释命中）。
- 复用既有原语：`settle` / `splitSegments` / `countBacktrackSegments` / `generate` / `getSeed` / `getDateKeyUTC` 全部复用，未重写。
- 未改动 `src/core`、`src/input`、`src/render`、`src/gen/{generator,gates,interconnect}.ts` 既有逻辑（仅新增 `clock.ts` / `daily.ts`）。

## 4. 已知限制（不隐瞒）

1. **演示壳内每日分区不可达**：`GATE_DAILY` 已按真实存档判定，但主线 12 关属 E6 内容，当前只有 1 个占位关 ⇒ 正常玩无法解锁每日。验证方式见 §5。
2. **「下一关」按钮当前不出现**：`hasNext` 依赖主线题库（`nextLevelFor()` 恒返回 `null`，待 E6 接入）。每日关按设计恒无下一关。
3. **浏览器未验证**：执行环境为 Node（无 DOM / localStorage）。持久化用注入 fake storage 断言，结算面板用 HTML 字符串断言。**未声称浏览器已验证**。
4. 版本升级（GDD⑥ §4.4「历史成绩标注旧版本」）简化为**存档重置**，未实现跨版本并列展示。

## 5. 如何亲自在浏览器验证

```bash
npx vite          # 打开 http://localhost:5173/
```

默认只能玩占位关。要看到「每日」分区，在 DevTools Console 执行一次后刷新（写入 12 关 1★ 存档）：

```js
const d={version:1,levels:{}};
for(let i=1;i<=12;i++) d.levels['main-'+i]={bestStar:1,bestStarSteps:10,bestStarElapsedMs:1000};
localStorage.setItem('maze.progress',JSON.stringify(d));
location.reload();
```

之后：主菜单 `Enter` → 关卡选择会多出「每日 · 中（按 1）/ 每日 · 高（按 2）」→ 进入后是 13×13 迷雾关；通关看结算面板（Enter 重玩 / Q 返回选关）。

## 6. 下一步

- E6：主线 12 关题库（解锁 `nextLevelFor()`，让「下一关」按钮生效）+ 选关界面。
- Sprint 6 候选：结算「回头路高亮」（GDD④ §2.3 可选高亮）、每日完成标记与连胜统计。
