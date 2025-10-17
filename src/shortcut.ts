import type { ShortcutConfig } from "./types";
import { DEFAULT_SHORTCUT } from "./constants";
import { loadShortcutConfig, saveShortcutConfig as saveShortcutConfigToStorage } from "./storage";
import { registerShortcut as registerShortcutAPI } from "./api";
import { shortcutInput, resetShortcutBtn, shortcutHint } from "./dom";

let currentShortcut: ShortcutConfig = DEFAULT_SHORTCUT;

// 初始化快捷鍵系統
export function initShortcut(): void {
  currentShortcut = loadShortcutConfig();
  updateShortcutDisplay();
  registerCurrentShortcut();
  setupShortcutListeners();
}

// 設置快捷鍵監聽器
function setupShortcutListeners(): void {
  // 快捷鍵輸入點擊
  shortcutInput?.addEventListener("click", () => {
    if (shortcutInput) {
      shortcutInput.placeholder = "請按下快捷鍵...";
      shortcutInput.classList.add("recording");
    }
  });

  // 快捷鍵輸入鍵盤事件
  shortcutInput?.addEventListener("keydown", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 忽略單獨的修飾鍵
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      return;
    }

    const newShortcut: ShortcutConfig = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      key: e.key
    };

    currentShortcut = newShortcut;
    saveShortcutConfigToStorage(newShortcut);
    updateShortcutDisplay();
    await registerCurrentShortcut();

    if (shortcutInput) {
      shortcutInput.blur();
      shortcutInput.classList.remove("recording");
    }
  });

  // 快捷鍵輸入失去焦點
  shortcutInput?.addEventListener("blur", () => {
    if (shortcutInput) {
      shortcutInput.placeholder = "點擊後按下快捷鍵組合";
      shortcutInput.classList.remove("recording");
    }
  });

  // 重置快捷鍵按鈕
  resetShortcutBtn?.addEventListener("click", async () => {
    currentShortcut = { ...DEFAULT_SHORTCUT };
    saveShortcutConfigToStorage(currentShortcut);
    updateShortcutDisplay();
    await registerCurrentShortcut();
  });
}

// 將快捷鍵配置轉換為顯示字串
export function shortcutToString(config: ShortcutConfig): string {
  const parts: string[] = [];
  if (config.ctrl) parts.push("Ctrl");
  if (config.alt) parts.push("Alt");
  if (config.shift) parts.push("Shift");

  let keyName = config.key;
  if (keyName === "ArrowDown") keyName = "↓";
  else if (keyName === "ArrowUp") keyName = "↑";
  else if (keyName === "ArrowLeft") keyName = "←";
  else if (keyName === "ArrowRight") keyName = "→";
  else keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join("+");
}

// 更新快捷鍵顯示
export function updateShortcutDisplay(): void {
  const shortcutStr = shortcutToString(currentShortcut);
  if (shortcutInput) {
    shortcutInput.value = shortcutStr;
  }
  if (shortcutHint) {
    shortcutHint.textContent = `${shortcutStr} 隱藏/顯示`;
  }
}

// 將前端快捷鍵配置轉換為後端格式
export function shortcutToBackendFormat(config: ShortcutConfig): string {
  const parts: string[] = [];
  if (config.ctrl) parts.push("Ctrl");
  if (config.alt) parts.push("Alt");
  if (config.shift) parts.push("Shift");

  // 轉換特殊按鍵名稱
  let keyName = config.key;
  if (keyName === "ArrowDown") keyName = "Down";
  else if (keyName === "ArrowUp") keyName = "Up";
  else if (keyName === "ArrowLeft") keyName = "Left";
  else if (keyName === "ArrowRight") keyName = "Right";
  else keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join("+");
}

// 註冊當前快捷鍵到後端
export async function registerCurrentShortcut(): Promise<void> {
  try {
    const shortcutStr = shortcutToBackendFormat(currentShortcut);
    await registerShortcutAPI(shortcutStr);
    console.log(`全域快捷鍵已註冊: ${shortcutStr}`);
  } catch (error) {
    console.error("註冊快捷鍵失敗:", error);
  }
}

// 導出當前快捷鍵供其他模組使用
export function getCurrentShortcut(): ShortcutConfig {
  return currentShortcut;
}
