import { listen } from "@tauri-apps/api/event";
import { loadNote, saveNote, saveNoteToHistory, createNewMemo } from "./api";
import { textarea, newMemoBtn } from "./dom";
import { initStore } from "./storage";
import { initTheme, setupColorListeners } from "./theme";
import { initFontSystem, setupFontListeners } from "./font";
import { initShortcut } from "./shortcut";
import { setupHistoryListeners } from "./history";
import { setupArchiveListeners } from "./archive";
import { setupTrashListeners } from "./trash";
import { setupSettingsListeners } from "./settings";

console.log("Frontend script loaded!");

// 初始化應用程式
async function initializeApp() {
  // 首先初始化 store
  await initStore();
  // 檢查 textarea 是否存在
  if (!textarea) {
    console.error("找不到 textarea 元素");
    return;
  }

  // 載入筆記內容
  try {
    const content = await loadNote();
    textarea.value = content;
    console.log("筆記載入成功");
  } catch (error) {
    console.error("載入筆記失敗:", error);
  }

  // 監聽輸入事件，自動儲存到歷史
  let saveTimeout: number | null = null;
  textarea.addEventListener("input", () => {
    console.log("偵測到內容變更，準備自動儲存...");
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(async () => {
      const content = textarea.value;
      console.log("執行自動儲存到歷史，內容長度:", content.length);

      // 輸入時自動儲存到歷史記錄
      if (content.trim()) {
        await saveNoteToHistory(content);
      } else {
        // 如果內容為空，只儲存到當前便條
        await saveNote(content);
      }
    }, 500);
  });
  console.log("已註冊 textarea 輸入監聽器");

  // 初始化各個子系統
  initTheme();
  await initFontSystem();
  initShortcut();

  // 設置事件監聽器
  setupColorListeners();
  setupFontListeners();
  setupHistoryListeners();
  setupArchiveListeners();
  setupTrashListeners();
  setupSettingsListeners();

  // 新增便條按鈕事件
  newMemoBtn?.addEventListener("click", async () => {
    try {
      const newId = await createNewMemo();
      if (textarea) {
        textarea.value = "";
      }
      console.log(`已建立新便利貼，ID: ${newId}`);
    } catch (error) {
      console.error("建立新便利貼失敗:", error);
    }
  });

  // 監聽系統托盤的新增便條事件
  listen("tray-new-memo", async () => {
    console.log("收到系統托盤新增便條事件");
    newMemoBtn?.click();
  });
}

// 啟動應用程式
initializeApp();
