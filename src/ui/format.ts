// format.ts · 展示用格式化（单一实现，HUD 与选关页共用）
// 抽出原因：时间格式化若散落两处会各自漂移；本项目对「单点实现」有 CI 闸门传统
// （fnv1a32-single / W1 段切分单一实现等），故统一在此。

/**
 * 毫秒 → `mm:ss`（不足 1 分亦补零为 `00:07`）。
 * 分钟位不取模：≥1 小时时继续累加（如 `60:00`），避免长局被截断回 `00:00` 造成误读。
 */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
