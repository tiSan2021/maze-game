// palette.ts · 全部颜色 HEX（art-bible §2② v2.1.1 + asset-spec §3 WALL_MEMORY 三档）
// 绘制逻辑只引用常量、零硬编码（架构 §7·常量表隔离）。此处为准入色值落点，不得自行改编。

/** 纸面基准（未知区 / 通道基底） */
export const PAPER = '#F4F1EA';

/** 网格线三档墨色浓度（未知 < 记忆 < 当前视野） */
export const GRID_UNKNOWN = '#E4DCCE'; // 1.21:1 极淡
export const GRID_MEMORY = '#CFC5B0'; // 1.52:1 淡
export const GRID_VIEW = '#A89878'; // 2.51:1 浓

/** 已探索通道底（"摸过的纸"）与铅笔笔迹 */
export const PAPER_WALKED = '#EDE7DA';
export const INK = '#9C8F73'; // 铅笔笔迹 45° 细斜线，2.83:1

/** A 态墙：填充 / 斜线 / 主轮廓 / 假投影（暖灰） */
export const WALL_FILL = '#73879F'; // 3.27:1
export const WALL_HATCH = '#3B5674'; // 6.72:1，45°↘ 间距5 线宽2
export const WALL_OUTLINE = '#1F3A5F'; // 10.18:1
export const WALL_SHADOW = '#D5CBB8'; // 假投影 50% 透明

/**
 * WALL_MEMORY 三档浓度（asset-spec §3）：由浓到淡 = 记忆由刚离视野到久远。
 * 索引 0 = L3 最浓（距玩家最近），1 = L2 基准，2 = L1 最淡（最久远）。
 * 复用 art-bible §2② 定值（L2）与 asset-spec §3 拟值（L1/L3），never 自造新色。
 */
export const WALL_MEMORY: ReadonlyArray<{ fill: string; hatch: string; outline: string }> = [
  { fill: '#8597AD', hatch: '#6E8098', outline: '#5C6C82' }, // L3 最浓
  { fill: '#9AA8BC', hatch: '#8092A8', outline: '#6B7A8F' }, // L2 基准（art-bible 定值）
  { fill: '#C2CAD6', hatch: '#A2AEBE', outline: '#808B9B' }, // L1 最淡
];

/** 主结构墨线（所有元素轮廓） */
export const INK_LINE = '#1F3A5F';

/** 信号层：玩家 / 出口 */
export const PLAYER = '#C4382E'; // 4.71:1
export const PLAYER_STROKE = '#8E231B'; // 7.73:1
export const EXIT = '#1B5220'; // 8.18:1
export const EXIT_RING = '#123A16'; // 10.9:1

/** 三型钥匙/门配对色（K1：青/紫/赭；色觉可辨 + 图案双重编码） */
export const KEY_COLORS = ['#0E635A', '#5A3189', '#A85B1E'] as const; // 6.31 / 8.33 / 4.45:1

/** 门·锁定：中性填充 + 交叉网格（最密纹理 = 最不可通行） */
export const DOOR_LOCKED_FILL = '#9E937C'; // 2.97:1
export const DOOR_LOCKED_CROSS = '#6B4E26'; // 6.79:1

/** UI 层（HUD） */
export const UI_PANEL = '#EFEADC';
export const UI_BORDER = '#C9BFA9';
export const UI_TEXT = '#2A2419'; // 12.80:1
export const UI_ACCENT = '#0E635A';
