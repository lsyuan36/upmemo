// import { listen } from "@tauri-apps/api/event"; // 已停用多視窗功能
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
import { linkifyText, extractPlainText, handleLinkClick } from "./linkify";
// import { createStickyNote, isStickyNoteWindow, getCurrentWindowLabel, updateStickyNote, getAllStickyNotes, closeStickyNote } from "./stickyNotes"; // 已停用多視窗功能
import { setupImageListeners } from "./image";

console.log("Frontend script loaded!");

// 初始化應用程式
async function initializeApp() {
  console.log("開始初始化應用程式...");

  // 檢查 noteDisplay 是否存在
  if (!noteDisplay) {
    console.error("找不到 note-display 元素");
    return;
  }
  console.log("Note display 元素找到");

  // 首先初始化 store
  console.log("初始化 Store...");
  try {
    await initStore();
    console.log("Store 初始化成功");
  } catch (error) {
    console.error("Store 初始化失敗:", error);
  }

  // 載入筆記內容（只有主視窗，已停用多視窗功能）
  try {
    const content = await loadNote();
    const linkedContent = linkifyText(content);
    noteDisplay.innerHTML = linkedContent;
    console.log("主視窗筆記載入成功");
  } catch (error) {
    console.error("載入筆記失敗:", error);
  }

  // 監聽輸入事件，自動轉換網址並儲存
  let saveTimeout: number | null = null;
  let linkifyTimeout: number | null = null;

  noteDisplay.addEventListener("input", (event: Event) => {
    console.log("偵測到內容變更，準備自動儲存...");

    // 檢查是否應該跳過 linkify (例如圖片調整大小時)
    const skipLinkify = (event as CustomEvent).detail?.skipLinkify;

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
          // 保存游標位置
          const selection = window.getSelection();
          let cursorOffset = 0;

          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(noteDisplay);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorOffset = preCaretRange.toString().length;
          }

          // 更新內容
          noteDisplay.innerHTML = linkedContent;

          // 恢復游標位置
          if (cursorOffset > 0) {
            restoreCursorPosition(noteDisplay, cursorOffset);
          }
        }
      }, 2000); // 延長至 2 秒後才轉換連結,避免干擾正常輸入
    }

    // 延遲儲存
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(async () => {
      console.log("執行自動儲存，內容長度:", plainText.length);

      // 主視窗：儲存到 note.txt 和歷史
      if (plainText.trim()) {
        await saveNoteToHistory(plainText);
      } else {
        await saveNote(plainText);
      }
    }, 500);
  });
  console.log("已註冊 note display 輸入監聽器");

  // 游標位置恢復函數
  function restoreCursorPosition(element: HTMLElement, offset: number) {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    let currentOffset = 0;
    let found = false;

    function traverse(node: Node): void {
      if (found) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (currentOffset + textLength >= offset) {
          range.setStart(node, offset - currentOffset);
          range.collapse(true);
          found = true;
          return;
        }
        currentOffset += textLength;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
          if (found) return;
        }
      }
    }

    traverse(element);

    if (found) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // 處理連結點擊事件
  noteDisplay.addEventListener("click", handleLinkClick);

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

  try {
    console.log("設置圖片插入監聽器...");
    setupImageListeners();
    console.log("圖片插入監聽器設置完成");
  } catch (error) {
    console.error("圖片插入監聽器設置失敗:", error);
  }

  console.log("✅ 所有監聽器設置完成!");

  // 新增便條按鈕事件（在主視窗清空並開始新便條）
  newMemoBtn?.addEventListener("click", async () => {
    try {
      // 創建新的便條（清空主視窗內容）
      const newId = await createNewMemo();
      noteDisplay.innerHTML = "";
      console.log(`已建立新便條，ID: ${newId}`);
    } catch (error) {
      console.error("建立新便條失敗:", error);
    }
  });

  // 監聽系統托盤的新增便利貼視窗事件（已停用）
  // listen("tray-new-sticky-window", async () => {
  //   console.log("收到系統托盤新增便利貼視窗事件");
  //   try {
  //     const newId = await createStickyNote();
  //     console.log(`已從系統托盤建立新便利貼視窗，ID: ${newId}`);
  //   } catch (error) {
  //     console.error("建立新便利貼視窗失敗:", error);
  //   }
  // });
}

// 啟動應用程式
initializeApp();
