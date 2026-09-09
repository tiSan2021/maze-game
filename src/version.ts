// version.ts · 版本号单一来源（single source of truth）
//
// 发版时只改本文件 + package.json(version) + CHANGELOG.md；
// 菜单 / HUD 等所有用户可见的版本标签一律从这里 import，禁止再硬编码字面量。
// 历史教训（v0.6.1）：曾因 main.ts 硬编码 "v0.6.0" 导致版本号不同步。

/** 应用名（玩家可见） */
export const APP_NAME = '迷宫闯关';

/** 语义化版本号，不含前缀 "v" */
export const VERSION = '0.6.1';

/** 菜单/HUD 等处的完整版本标签，如「迷宫闯关 · v0.6.1」 */
export const VERSION_LABEL = `${APP_NAME} · v${VERSION}`;
