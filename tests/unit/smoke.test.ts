// E0-2 示例测试：src/ 空时即绿，存在时仍通过
import { describe, it, expect } from 'vitest';

describe('E0-2 · 脚手架示例测试', () => {
  it('基础不变量：1+1=2（占位示例，CI 在 src/ 空时即绿）', () => {
    expect(1 + 1).toBe(2);
  });
});
