// clock.ts · 时间源抽象（架构控制清单 A6：时间源不外泄）
// A6：src/sim 与 src/gen 内禁止出现 new Date( / Date.now(，时间一律经 Clock 注入。
// 本文件（src/core）是全仓唯一构造 Date 的地方；业务层只依赖 Clock 接口，便于 Node 下固定时间。

export interface Clock {
  now(): Date;
}

/** 系统时钟（浏览器 / 真实运行） */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** 固定时钟（测试 / 回放）：始终返回注入的那一刻 */
export function fixedClock(date: Date): Clock {
  return { now: () => date };
}
