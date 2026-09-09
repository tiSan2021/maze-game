// canonical.ts · 规范化 JSON（GDD② X7 / GDD⑤ G4）
// 键排序、逐字节可比：存档与每日种子逐字节可比（DQ1/G4）；Set 等非常规字段由调用方先规整。

/** 返回键排序后的深拷贝（递归），保证序列化逐字节稳定 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortKeys(obj[k]);
    }
    return out;
  }
  return value;
}

/** 规范化 JSON 字符串（键字典序排序） */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
