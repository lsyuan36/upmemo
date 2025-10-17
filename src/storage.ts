import type { ShortcutConfig } from "./types";
import { DEFAULT_SHORTCUT } from "./constants";
import { Store } from "@tauri-apps/plugin-store";

// store 實例
let store: Store;

// 內存緩存
let cache = {
  shortcut: { ...DEFAULT_SHORTCUT },
  colorTheme: "yellow",
  fontSize: 14,
  opacity: 100
};

// 初始化 store 並載入所有設定到緩存
export async function initStore(): Promise<void> {
  // 使用 load 方法創建 Store 實例
  store = await Store.load("settings.json");

  try {
    // 載入所有設定到緩存
    const shortcut = await store.get<ShortcutConfig>("toggleShortcut");
    if (shortcut) cache.shortcut = shortcut;

    const colorTheme = await store.get<string>("colorTheme");
    if (colorTheme) cache.colorTheme = colorTheme;

    const fontSize = await store.get<number>("fontSize");
    if (fontSize) cache.fontSize = fontSize;

    const opacity = await store.get<number>("opacity");
    if (opacity) cache.opacity = opacity;

    console.log("Store 初始化完成，設定已載入");
  } catch (error) {
    console.error("載入設定失敗:", error);
  }
}

// 快捷鍵 - 同步讀取（從緩存）
export function loadShortcutConfig(): ShortcutConfig {
  return { ...cache.shortcut };
}

// 快捷鍵 - 保存（異步）
export async function saveShortcutConfig(config: ShortcutConfig): Promise<void> {
  cache.shortcut = config;
  await store.set("toggleShortcut", config);
  await store.save();
}

// 配色 - 同步讀取（從緩存）
export function loadColorTheme(): string {
  return cache.colorTheme;
}

// 配色 - 保存（異步）
export async function saveColorTheme(color: string): Promise<void> {
  cache.colorTheme = color;
  await store.set("colorTheme", color);
  await store.save();
}

// 字體大小 - 同步讀取（從緩存）
export function loadFontSize(): number {
  return cache.fontSize;
}

// 字體大小 - 保存（異步）
export async function saveFontSize(size: number): Promise<void> {
  cache.fontSize = size;
  await store.set("fontSize", size);
  await store.save();
}

// 透明度 - 同步讀取（從緩存）
export function loadOpacity(): number {
  return cache.opacity;
}

// 透明度 - 保存（異步）
export async function saveOpacity(opacity: number): Promise<void> {
  cache.opacity = opacity;
  await store.set("opacity", opacity);
  await store.save();
}
