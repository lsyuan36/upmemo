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
  console.log("開始初始化應用程式...");

  // 檢查 textarea 是否存在
  if (!textarea) {
    console.error("找不到 textarea 元素");
    return;
  }
  console.log("Textarea 元素找到");

  // 首先初始化 store
  console.log("初始化 Store...");
  try {
    await initStore();
    console.log("Store 初始化成功");
  } catch (error) {
    console.error("Store 初始化失敗:", error);
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
  try {
    console.log("初始化主題系統...");
    initTheme();
    console.log("主題系統初始化完成");
  } catch (error) {
    console.error("主題系統初始化失敗:", error);
  }

  try {
    console.log("初始化字體系統...");
    await initFontSystem();
    console.log("字體系統初始化完成");
  } catch (error) {
    console.error("字體系統初始化失敗:", error);
  }

  try {
    console.log("初始化快捷鍵系統...");
    initShortcut();
    console.log("快捷鍵系統初始化完成");
  } catch (error) {
    console.error("快捷鍵系統初始化失敗:", error);
  }

  // 設置事件監聽器
  try {
    console.log("設置配色監聽器...");
    setupColorListeners();
    console.log("配色監聽器設置完成");
  } catch (error) {
    console.error("配色監聽器設置失敗:", error);
  }

  try {
    console.log("設置字體監聽器...");
    setupFontListeners();
    console.log("字體監聽器設置完成");
  } catch (error) {
    console.error("字體監聽器設置失敗:", error);
  }

  try {
    console.log("設置歷史記錄監聽器...");
    setupHistoryListeners();
    console.log("歷史記錄監聽器設置完成");
  } catch (error) {
    console.error("歷史記錄監聽器設置失敗:", error);
  }

  try {
    console.log("設置封存監聽器...");
    setupArchiveListeners();
    console.log("封存監聽器設置完成");
  } catch (error) {
    console.error("封存監聽器設置失敗:", error);
  }

  try {
    console.log("設置垃圾桶監聽器...");
    setupTrashListeners();
    console.log("垃圾桶監聽器設置完成");
  } catch (error) {
    console.error("垃圾桶監聽器設置失敗:", error);
  }

  try {
    console.log("設置設定監聽器...");
    setupSettingsListeners();
    console.log("設定監聽器設置完成");
  } catch (error) {
    console.error("設定監聽器設置失敗:", error);
  }

  console.log("✅ 所有監聽器設置完成!");

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
