import type { ShortcutConfig, ColorTheme } from "./types";

// 預設快捷鍵
export const DEFAULT_SHORTCUT: ShortcutConfig = {
  ctrl: true,
  alt: false,
  shift: false,
  key: "ArrowDown"
};

// 配色主題
export const COLOR_THEMES: Record<string, ColorTheme> = {
  yellow: {
    name: "經典黃色",
    bg: "#fefabc",
    headerBg: "linear-gradient(180deg, #f8f0b0 0%, #f5e79e 100%)",
    border: "#e0d080"
  },
  pink: {
    name: "粉紅色",
    bg: "#ffd4e5",
    headerBg: "linear-gradient(180deg, #ffcce0 0%, #ffb3d9 100%)",
    border: "#ffaacc"
  },
  blue: {
    name: "淺藍色",
    bg: "#d4e5ff",
    headerBg: "linear-gradient(180deg, #ccdeff 0%, #b3d4ff 100%)",
    border: "#aaccff"
  },
  green: {
    name: "淺綠色",
    bg: "#d4ffd4",
    headerBg: "linear-gradient(180deg, #ccffcc 0%, #b3ffb3 100%)",
    border: "#aaffaa"
  },
  purple: {
    name: "淺紫色",
    bg: "#e5d4ff",
    headerBg: "linear-gradient(180deg, #deccff 0%, #d4b3ff 100%)",
    border: "#ccaaff"
  },
  white: {
    name: "白色",
    bg: "#ffffff",
    headerBg: "linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)",
    border: "#d0d0d0"
  }
};

// 預設字體大小
export const DEFAULT_FONT_SIZE = 14;

// 預設透明度
export const DEFAULT_OPACITY = 100;

// 預設顏色
export const DEFAULT_COLOR = "yellow";
