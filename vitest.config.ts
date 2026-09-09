// vitest.config.ts · Phase 4 测试脚手架最小配置
// 纯逻辑/文件扫描类用例在 Node 环境运行；
// 真机渲染帧耗时（[SPIKE] E2 尖峰）不走本框架，由 DevTools/埋点覆盖。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // CI 闸门测试失败即整体失败（不含跳过）
    bail: 0,
  },
});
