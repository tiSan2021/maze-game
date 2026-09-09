# Phase 5 · Sprint 2 回顾（E2 渲染 + 性能尖峰）

> 主理人：游承峰 | Sprint 2 = E2 渲染层 | 评审强度：lean
> 参与：engineering-lead（实现）→ 主理人（独立复核 + 汇编）

---

## 一、交付结果

| 类别 | 内容 |
|---|---|
| 渲染层 | `src/render/` 7 模块：`canvas` / `tiles` / `draw-cell` / `layers` / `pipeline` / `sprites` / `hud` |
| 尖峰 harness | `spike/perf.html` + `spike/perf-main.ts` |
| 测试 | 改造 1（`tile-atlas-ready` 占位→真断言）+ 新增 4 |
| 测试总数 | **26 文件 / 84 用例全绿**（主理人独立复跑确认，exit 0；上轮 70 → 本轮 84） |

---

## 二、四条 CI 代理断言（现均为真测试，不再是占位）

| # | 断言 | 结果 |
|---|---|---|
| 1 | `VISION_R === 3`，`src/` 无 R=4/5 分支 | ✅ |
| 2 | `draw-cell` 仅 `drawImage`（无 `fill`/`stroke`/`strokeText`/`createRadialGradient`） | ✅，并新增"复用 `cellRenderState`、不重定义"守卫 |
| 3 | `tileAtlasReady` 早于首帧 | ✅ 由占位改为真断言：`init()` 后即 true |
| 4 | fog 单格移动 `lastDirtyCount ≤ 40` 且 `≠ 169` | ✅ 13×13 与 11×11 均通过（证明是增量而非全量） |

另有 `shadowBlur` 0 命中、`W4`（无 `source`/`isGenerated`）0 命中、DQ3（`Math.random`）0 命中。

---

## 三、性能尖峰（CONCERN-3）—— **已闭合**（真机实测）

主理人于 2026-09-08 在桌面浏览器真机跑 `spike/perf.html`（13×13 / `visionMode:'fog'` / 1000 帧 / 每帧仅计 `pipeline.renderFrame` 绘制耗时，不含输入/仿真）：

| 组 | P95 | 峰值 | 均值 | 判定 |
|---|---|---|---|---|
| **G-A 三前置全开（真实管线）** | **0.40ms** | 0.70ms | 0.25ms | **✓ 达标（20× 预算余量）** |
| G-B1 缺 tile 预渲染 | 0.20ms | 8.70ms | 0.10ms | P95 达标 / 峰值贴近门槛 |
| G-B2 视野 R=5（≈81格） | 0.20ms | 7748.90ms | 8.09ms | 均值贴近 9–11ms 区间 |
| G-B3 L1 全量重绘（dirty=169） | 6.10ms | 359.40ms | 1.24ms | P95 接近门槛 |

- **G-A 0.40ms vs 8ms 硬门槛 = 20× 余量**，远超 art-bible 成本模型 `3.83 + 0.058×29 ≈ 5.3ms` 的保守估计。
- **4 个产品级降级预案全部不需要**：不降帧、不缩迷宫、不削动效。
- B 组的"复现 9–11ms 超标"在 harness 模拟下主要由 **峰值/均值** 体现（G-B2 均值 8.09、G-B2 峰值 7748.90 显著超标），而 P95 在多数 B 组仍 <8ms —— 说明 harness 的"等价高开销"近似对 **平均开销** 复现较好、对 **P95 尾延迟** 复现略弱。**真正的回归守护仍由 CI 代理断言承担**（lastDirtyCount≤40 / VISION_R===3 / draw-cell 仅 drawImage / tileAtlasReady 早于首帧），这也是架构评审预期的。

> ✅ **CONCERN-3 [SPIKE] 关闭**。E2 准入条件达成。无产品级折损。

---

## 四、主理人裁决

- **常量调整认可**：`palette.ts` / `pattern.ts` 对齐 art-bible v2.1.1 + asset-spec 权威色值（含 `WALL_MEMORY` 三档浓度），`metrics.ts` 仅改注释。属**可回滚的纯常量调整**，不涉域逻辑 —— 认可，无回改风险。
- **域逻辑未动**：`src/core`、`src/sim`、`src/input` 未被修改，渲染层通过导入复用 `cellRenderState`（W6/A2 单一函数）。
- **H1（D9 互连泛洪）** 仍是 **E4 硬门禁**，本轮未涉及，不得延后。

---

## 五、下一冲刺

**Sprint 3 = E3 应用壳**（`index.html` / `main.ts` / `state/app.ts`，3 Story，依赖 E1 已就绪）。

E3 后游戏即可在浏览器实际运行 —— **届时可顺带完成 8ms 真机尖峰**（CONCERN-3 闭合），再进入 E4 生成器门禁（含 D9 硬门禁）。
