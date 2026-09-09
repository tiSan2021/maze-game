# Phase 6 打磨 · 浏览器 Playtest 计划（quality-lead）

> 适用范围：纯 vanilla TypeScript + Canvas 2D 迷宫游戏，桌面浏览器、纯键盘。
> 自动化边界见 `tests/unit/app-edge.test.ts` / `tests/unit/settings-persist.test.ts` / `tests/integration/render-pipeline.test.ts`。
> **标注 `[浏览器自验]` 的项无法在 Node 下自动化**（依赖真实 DOM/Canvas 渲染、手感、帧率、观感），必须由用户在浏览器中按步骤自验。
> 验证命令：`npx vitest run`（全绿）、`npx tsc --noEmit`（0 错误）。

---

## 第 1 轮 · 功能冒烟（链路通畅）

**目标**：12 关可从选关进入并通关；核心状态链路 MENU→LEVEL_SELECT→PLAYING→PAUSED→SETTLEMENT→下一关 无断点；GATE_DAILY（GDD⑥ D-1）在主线未全清时完全隐藏每日分区，全清后解锁。

**步骤**
1. 启动游戏 → 主菜单（MENU）。
2. 选关页（LEVEL_SELECT）确认 12 个主线关可见，第 2 关起处于锁定态。
3. 逐关进入（PLAYING），用方向键走到出口触发结算（SETTLEMENT）。`[浏览器自验]` 结算面板星级/步数/用时显示合理。
4. 结算页按 `N` 进入下一关；最后一关（第 12 关）`N` 应为空（无下一关）。`[浏览器自验]` 第 12 关结算后无「下一关」按钮。
5. 结算页 `Q` 返回选关（SETTLEMENT→LEVEL_SELECT）。`[浏览器自验]`
6. 游玩中按 `Esc` → 暂停（PAUSED），再 `Esc`/继续 → 回到游玩（PLAYING）。`[浏览器自验]`
7. 未通关任何关时，选关页**不应出现**「每日」分区（GDD⑥ D-1）。`[浏览器自验]`
8. 通关 12 关（每关 ≥1★）后回到选关页，确认「每日 · 中 / 高」分区出现且可进入。`[浏览器自验]`

**通过标准**
- 12 关全部可进入、可通关、可结算、可返回选关。
- 上述整条链路无卡死、无白屏。
- 步骤 7 在主线未全清时每日分区**完全不可见**；步骤 8 全清后可见且可玩。
- （自动化对应：`app-edge.test.ts` 的 `canShowDaily()` 一致性、`enterDaily` 拦截；`main-level-select.test.ts` 的 GATE_DAILY 与 `nextMainLevel()@12=null`。）

---

## 第 2 轮 · 可访问性（设置面板）

**目标**：`S` 打开设置；`F` 关雾后信息完整、星级不受影响；`M` 三档循环；设置持久化；`Esc` 关闭。

**步骤**
1. 在 MENU 或 PAUSED 按 `S` 打开设置面板。`[浏览器自验]` 面板出现。
2. 按 `F` 关闭迷雾（fogOff）→ 迷宫整张可见。`[浏览器自验]` 关后路径/出口/钥匙/门信息**依旧完整**，且通关后星级与开雾时**一致**（fogOff 仅切渲染分支，不改可见性/星级语义）。
3. 按 `M` 循环动效档位：全开 → 半量 → 关闭 → 全开。`[浏览器自验]` 标签随档位变化。
4. 保持某些非默认设置（如 fogOff=true、motionScale=半量），刷新/重新打开页面。`[浏览器自验]` 设置被持久化（`loadSettings` 读回一致）。
5. 按 `Esc` 关闭设置面板，回到原状态（MENU 或 PAUSED）。`[浏览器自验]`

**通过标准**
- `F`/`M`/`S`/`Esc` 行为符合预期；关雾后**无信息丢失**、**星级不变**。
- 重载后设置保持（持久化生效）。
- （自动化对应：`settings-persist.test.ts` 读写一致、两开关字段独立、存储不可用降级；`render-pipeline.test.ts` 的 `fogOff` BAKED 路径与 `renderFrame` 不抛错；`settings.test.ts` 档位循环。）

---

## 第 3 轮 · 手感 / 性能

**目标**：连走节奏、撤销/重开、失焦清栈、13×13 关帧率。

**步骤**
1. 长按某方向键约 0.2s 后开始连走，之后匀速（首段 220ms、续段 110ms）。`[浏览器自验]` 手感顺滑、节奏符合规格。
2. 按 `Z` 撤销上一段滑行（pos/路径回滚；visited 与计时不回滚，属预期）。`[浏览器自验]`
3. 按 `R` 重开本关（steps/elapsed/visited 归零、滞留 PLAYING）。`[浏览器自验]`
4. 游玩中切换到其他窗口（窗口失焦）→ 切回，`[浏览器自验]` 无残留方向误触发（`blur()` 清栈生效）。
5. 进入 13×13 雾关，走动观察。`[浏览器自验]` 主观帧率顺畅、无明显卡顿。

**通过标准**
- 连走节奏、撤销/重开、失焦清栈、13×13 帧率均符合预期。
- （自动化对应：`keyboard-input.test.ts` 的 220/110ms 连走与 `blur()` 清栈；`app-edge.test.ts` 的 `undo()`/`restart()` 安全边界；`render-pipeline.test.ts` 的 13×13 fog 增量上限（lastDirtyCount ≤40 且 ≠169）。）

---

## 第 4 轮（追加）· 边界 / 异常

**目标**：结算后越界操作、选关越界钳制、异常态不崩。

**步骤**
1. 第 12 关结算后按 `N`：应为空（无下一关），不报错、不跳关。`[浏览器自验]`
2. 结算页按 `Q`：返回选关。`[浏览器自验]`
3. 选关页 `←/→` 在首/末关越界时被钳制，不出现空引用或越界索引。`[浏览器自验]`
4. 进入关卡前（未选关）按方向键/ `Z` / `R`：不应崩溃或进入错误状态（安全 no-op）。`[浏览器自验]`
5. 存储不可用（隐私模式/配额满）下游戏仍可运行（设置/进度退化为内存态，不抛错）。`[浏览器自验]`

**通过标准**
- 所有越界/异常操作安全、无崩溃、状态正确。
- （自动化对应：`app-edge.test.ts` 的 `undo()`@MENU、`move()`@无 level、`restart()`@MENU 安全 no-op，`enterDaily` 拦截；`settings-persist.test.ts` 的 brokenStorage 降级；`progress.test.ts` 的存储不可用降级。）

---

## 自动化 vs 浏览器自验 对照

| 关注点 | 自动化覆盖 | 浏览器自验 |
|---|---|---|
| GATE_DAILY 显隐逻辑 | ✅ canShowDaily 一致性 / enterDaily 拦截 | ✅ 实际面板是否隐藏/显示每日分区 |
| 设置读写/持久化/降级 | ✅ settings-persist + settings.test | ✅ 刷新后真机保持 |
| fogOff 渲染分支 | ✅ renderFrame 不抛错、BAKED 路径 | ✅ 关雾后信息完整、星级一致 |
| undo/restart 安全边界 | ✅ app-edge（no-op、归零） | ✅ 手感（Z/R 即时反馈） |
| 连走节奏 / 失焦清栈 | ✅ keyboard-input.test | ✅ 真机手感 |
| 13×13 帧率 | ✅ 增量上限断言 | ✅ 主观流畅度 |
| 星级计算 | ✅ stars.test / settlement.test | — |
| 全链路 UI 跳转 | — | ✅ 第 1 轮全部 `[浏览器自验]` |
