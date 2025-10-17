// 快捷鍵設定
export interface ShortcutConfig {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
}

// 字體設定
export interface FontConfig {
  chinese_font: string;
  english_font: string;
}

// 配色主題
export interface ColorTheme {
  name: string;
  bg: string;
  headerBg: string;
  border: string;
}

// 便條項目
export interface MemoEntry {
  id: string;
  content: string;
  timestamp: number;
}
