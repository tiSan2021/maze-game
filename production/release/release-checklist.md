# 上线清单 · Release Checklist

> 项目：俯视角 2D 网格迷宫（纯 TypeScript + Canvas 2D，桌面浏览器 / 纯键盘）
> 目标版本：**v0.5.0**（自 v0.4.0 升级）
> 生成日期：2026-09-09 · 负责人：release-ops-lead（路远行）

---

## 1. 构建状态（Build）
- [x] **Build green?** — **是（y）**
- 命令：`vite build`（即 `C:/Users/tisan/.workbuddy/binaries/node/versions/22.12.0/node.exe node_modules/vite/bin/vite.js build`）
- 模块数：42
- 产物：
  - `dist/index.html` — 1.85 kB / gzip 1.07 kB
  - `dist/assets/index-*.js` — **81.57 kB / gzip 17.98 kB**
- 结论：构建成功（exit 0），本次版本号变更（0.4.0→0.5.0）后已重跑确认仍绿。

## 2. 测试门禁（Test Gate）
- [x] **Test gate green?** — **是（y）**
- 命令：`vitest run`
- 计数：**47 测试文件 / 227 用例，全部通过**
- 类型检查：`tsc --noEmit` = **0 错误**
- 性能门禁：`tests/ci-gates/perf-budget.test.ts`（main-12 最坏情况：13×13 / fog / 双锁）**绿**（均值 < 16ms 门限，余量充足）。

## 3. 版本号变更（Version Bump）
- [x] **Version bump done?** — **是（y）**
- 旧 → 新：**0.4.0 → 0.5.0**
- 文件：`package.json`（`version` 字段）+ `description` 已从 "Phase 4 预制作" 更新为发布就绪描述。

## 4. 更新日志（Changelog）
- [x] **Changelog done?** — **是（y）**
- 文件：`CHANGELOG.md`（仓库根）已创建，含 v0.5.0 顶栏 + 新增功能 / 修复 / 构建测试 / 已知风险四段。

## 5. 本地化审计（Localization Audit）
- 覆盖 locale：**仅 zh-CN（简体中文）**。游戏无 i18n 框架，所有面向玩家字符串硬编码为中文。
- 审计范围：`src/main.ts`、`src/ui/settlement.ts`、`src/render/hud.ts`、`src/state/app.ts`（`formatLevelLabel`）。
- 审计结论（**无缺失用户可见字符串**；全为一致中文）：
  - 主菜单 / 设置 / 选关 / 暂停 / 结算面板：中文完整（`迷宫闯关`、`可访问性设置`、`关卡选择`、`已暂停`、`通关！` 等）。
  - HUD：中文（`关卡`、`步数`、`钥匙`、`门`、`回溯`、`Z 撤销 · R 重开 · Esc 返回`、迷雾图例）。
  - 关卡标签：`第 N 关` / `每日 · 中` / `每日 · 高`。
- **i18n 缺口（已知，非阻断）**：
  - 无英文或其它 locale 支持（按设计 zh-CN only）。如需出海需引入 i18n 基础设施（本轮不做）。
  - 残留内部阶段标签字符串：主菜单 `演示壳 · P5-S3-E6`（`src/main.ts` `menuHtml`）暴露内部 pipeline 阶段标识，
    建议发布前替换为面向玩家的正式标题（不阻断功能）。

## 6. 性能预算（Performance Budget）
- [x] **Perf budget referenced?** — **是（y）**
- 参考 `tests/ci-gates/perf-budget.test.ts`（CI 闸门，逻辑侧 JS 帧预算 16ms）。本次测试套件全绿，包含该门禁。
- 注意：该门限为逻辑侧（CPU/JS），真机 GPU/栅格化耗时由 DevTools 埋点覆盖，不在本门限内。

## 7. 进度 / 存档一致性（Save / Progress）
- [x] **MAIN_LEVEL_COUNT 一致性确认** — **一致（y）**
- `src/sim/progress.ts`：`MAIN_LEVEL_COUNT = 24`。
- `isMainAllCleared()` 遍历 `1..MAIN_LEVEL_COUNT`，要求全部 `≥1★` 才解锁每日分区（GATE_DAILY）。
- 主线题库 `src/content/main-levels.json` 实测含 `main-1` … `main-24` 共 **24 关**，与 `MAIN_LEVEL_COUNT` 一致。
- 难度曲线（锁深）与 24 关规格对齐：L1-3=0锁 / L4-8=1锁 / L9-20=2锁 / L21-24=3锁。

## 8. 可访问性（Accessibility）
- [ ] **U5 字号三档未实现** — **已知缺口（非阻断项）**
- 现状：可访问性设置仅含 `减少动效(M2) / 迷雾开关(F5) / 音效`；字号三档（小/中/大）尚未实现。
- 其余无障碍基线（图案填充 V2 / 钥匙双编码 V3 / 对比度 V5-V6 / 墙邻感知 F3）不提供开关，属降级底线。
- 结论：记入已知缺口，不影响本轮发布判定。

## 9. 回滚计划（Rollback Plan）
- 性质：纯静态客户端，无后端状态。
- 步骤：保留上一发布版 `dist/` 包（建议按版本归档，如 `dist-v0.4.0/`）。如需回滚：
  1. 停止 serving 当前 `dist/`；
  2. 用上一版 `dist/` 覆盖（或切换静态托管指向旧版本目录）；
  3. 客户端刷新即生效（localStorage 存档 schema 版本不变，向下兼容：v0.5.0 与 v0.4.0 同为 `PROGRESS_SCHEMA_VERSION = 1`）。
- 无数据库迁移 / 无服务端回滚。

## 10. 发布阻断项（Release Blocker）
- [ ] **仓库未初始化 → 无法打 tag** — **阻断（BLOCKER，待用户批准解决）**
- 事实：`D:\workbuddy\games` 下**不存在 `.git`**（全局无 git 仓库）。
- 影响：无法对 v0.5.0 创建提交或 tag，无法走"提交即发布"流程。
- 要求：真实发布前必须由用户（或在其批准后）执行：
  `git init` → 首次提交（含 `dist/` 是否纳入需决议，建议加 `.gitignore` 排除 `node_modules`/`dist` 仅在发布时归档）
  → `git tag v0.5.0`。
- **本轮 release-ops 不执行任何 git 命令**（严格遵守约束）。此 blocker 须在 Go/No-Go 前显式解决。

---

### 汇总
| 项 | 状态 |
|----|------|
| Build 绿 | ✅ |
| Test 门禁绿（227 用例） | ✅ |
| 版本号 0.4.0→0.5.0 | ✅ |
| Changelog | ✅ |
| 本地化（zh-CN 一致，无缺失） | ✅（仅 zh-CN，无 i18n 框架） |
| 性能预算门禁 | ✅ |
| 进度/存档一致性（24 关） | ✅ |
| 可访问性 U5 字号三档 | ⚠️ 已知缺口（非阻断） |
| 回滚方案 | ✅ 已就绪 |
| **仓库 / tag** | ⛔ **阻断（待用户批准 git init + commit + tag）** |
