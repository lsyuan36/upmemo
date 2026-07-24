import { loadNote, saveNote, saveNoteToHistory, createNewMemo } from "./api";
import { noteDisplay, newMemoBtn } from "./dom";
import { initStore } from "./storage";
import { initTheme, setupColorListeners } from "./theme";
import { initFontSystem, setupFontListeners } from "./font";
import { initShortcut } from "./shortcut";
import { setupHistoryListeners } from "./history";
import { setupArchiveListeners } from "./archive";
import { setupTrashListeners } from "./trash";
import { setupSettingsListeners } from "./settings";
import {
  extractPlainText,
  handleLinkClick,
  linkifyText,
  setContentWithCursor,
} from "./linkify";
import { setupImageListeners } from "./image";
import { logError, logInfo } from "./logger";

logInfo("Frontend script loaded!");

// 初始化應用程式
async function initializeApp() {
  logInfo("開始初始化應用程式...");

  // 檢查 noteDisplay 是否存在
  if (!noteDisplay) {
    logError("找不到 note-display 元素");
    return;
  }
  logInfo("Note display 元素找到");

  // 首先初始化 store
  logInfo("初始化 Store...");
  try {
    await initStore();
    logInfo("Store 初始化成功");
  } catch (error) {
    logError("Store 初始化失敗:", error);
  }

  // 載入筆記內容（只有主視窗，已停用多視窗功能）
  try {
    const content = await loadNote();
    const linkedContent = linkifyText(content);
    noteDisplay.innerHTML = linkedContent;
    logInfo("主視窗筆記載入成功");
  } catch (error) {
    logError("載入筆記失敗:", error);
  }

  // 監聽輸入事件，自動轉換網址並儲存
  let saveTimeout: number | null = null;
  let linkifyTimeout: number | null = null;

  async function saveCurrentNote(plainText: string): Promise<void> {
    try {
      logInfo("執行自動儲存，內容長度:", plainText.length);

      // 主視窗：儲存到 note.txt 和歷史
      if (plainText.trim()) {
        await saveNoteToHistory(plainText);
      } else {
        await saveNote(plainText);
      }
    } catch (error) {
      logError("自動儲存失敗:", error);
    }
  }

  noteDisplay.addEventListener("input", (event: Event) => {
    logInfo("偵測到內容變更，準備自動儲存...");

    // 檢查是否應該跳過 linkify (例如圖片調整大小時)
    const skipLinkify =
      event instanceof CustomEvent && event.detail?.skipLinkify === true;

    // 提取純文本內容
    const plainText = extractPlainText(noteDisplay);

    // 延遲轉換網址（避免頻繁更新干擾輸入）
    if (!skipLinkify) {
      if (linkifyTimeout !== null) {
        clearTimeout(linkifyTimeout);
      }
      linkifyTimeout = window.setTimeout(() => {
        // 檢查是否包含網址 (支援 http://, https://, www.)
        const hasUrl = /(https?:\/\/[^\s]+|www\.[^\s]+)/.test(plainText);

        // 只有在包含網址時才進行 linkify 轉換
        if (!hasUrl) {
          return;
        }

        const linkedContent = linkifyText(plainText);

        // 只在內容真的改變時才更新
        if (noteDisplay.innerHTML !== linkedContent) {
          setContentWithCursor(noteDisplay, linkedContent);
        }
      }, 2000); // 延長至 2 秒後才轉換連結,避免干擾正常輸入
    }

    // 延遲儲存
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(() => {
      void saveCurrentNote(plainText);
    }, 500);
  });
  logInfo("已註冊 note display 輸入監聽器");

  // 處理連結點擊事件
  noteDisplay.addEventListener("click", handleLinkClick);

  // 初始化各個子系統
  try {
    logInfo("初始化主題系統...");
    initTheme();
    logInfo("主題系統初始化完成");
  } catch (error) {
    logError("主題系統初始化失敗:", error);
  }

  try {
    logInfo("初始化字體系統...");
    await initFontSystem();
    logInfo("字體系統初始化完成");
  } catch (error) {
    logError("字體系統初始化失敗:", error);
  }

  try {
    logInfo("初始化快捷鍵系統...");
    initShortcut();
    logInfo("快捷鍵系統初始化完成");
  } catch (error) {
    logError("快捷鍵系統初始化失敗:", error);
  }

  // 設置事件監聽器
  try {
    logInfo("設置配色監聽器...");
    setupColorListeners();
    logInfo("配色監聽器設置完成");
  } catch (error) {
    logError("配色監聽器設置失敗:", error);
  }

  try {
    logInfo("設置字體監聽器...");
    setupFontListeners();
    logInfo("字體監聽器設置完成");
  } catch (error) {
    logError("字體監聽器設置失敗:", error);
  }

  try {
    logInfo("設置歷史記錄監聽器...");
    setupHistoryListeners();
    logInfo("歷史記錄監聽器設置完成");
  } catch (error) {
    logError("歷史記錄監聽器設置失敗:", error);
  }

  try {
    logInfo("設置封存監聽器...");
    setupArchiveListeners();
    logInfo("封存監聽器設置完成");
  } catch (error) {
    logError("封存監聽器設置失敗:", error);
  }

  try {
    logInfo("設置垃圾桶監聽器...");
    setupTrashListeners();
    logInfo("垃圾桶監聽器設置完成");
  } catch (error) {
    logError("垃圾桶監聽器設置失敗:", error);
  }

  try {
    logInfo("設置設定監聽器...");
    setupSettingsListeners();
    logInfo("設定監聽器設置完成");
  } catch (error) {
    logError("設定監聽器設置失敗:", error);
  }

  try {
    logInfo("設置圖片插入監聽器...");
    setupImageListeners();
    logInfo("圖片插入監聽器設置完成");
  } catch (error) {
    logError("圖片插入監聽器設置失敗:", error);
  }

  logInfo("所有監聽器設置完成");

  // 新增便條按鈕事件（在主視窗清空並開始新便條）
  newMemoBtn?.addEventListener("click", async () => {
    try {
      // 創建新的便條（清空主視窗內容）
      const newId = await createNewMemo();
      noteDisplay.innerHTML = "";
      logInfo(`已建立新便條，ID: ${newId}`);
    } catch (error) {
      logError("建立新便條失敗:", error);
    }
  });

}

// 啟動應用程式
initializeApp();
