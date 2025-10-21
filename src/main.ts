import { listen } from "@tauri-apps/api/event";
import { loadNote, saveNote, saveNoteToHistory } from "./api";
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
import { createStickyNote, isStickyNoteWindow, getCurrentWindowLabel, updateStickyNote, getAllStickyNotes, closeStickyNote } from "./stickyNotes";
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

  // 檢查當前視窗是否為便利貼視窗
  const isSticky = isStickyNoteWindow();
  const currentWindowLabel = getCurrentWindowLabel();

  console.log(`當前視窗 label: ${currentWindowLabel}, 是否為便利貼: ${isSticky}`);

  // 如果是便利貼視窗，在控制列添加關閉按鈕
  if (isSticky) {
    const controlBar = document.querySelector('.control-bar');
    const spacer = document.querySelector('.spacer');

    if (controlBar && spacer) {
      // 創建關閉按鈕
      const closeBtn = document.createElement('button');
      closeBtn.id = 'close-sticky-btn';
      closeBtn.className = 'control-btn close-sticky-btn';
      closeBtn.title = '關閉此便利貼';
      closeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
        </svg>
      `;

      // 插入到 spacer 之前
      controlBar.insertBefore(closeBtn, spacer);

      // 添加點擊事件
      closeBtn.addEventListener('click', async () => {
        try {
          await closeStickyNote(currentWindowLabel);
          console.log(`已關閉便利貼: ${currentWindowLabel}`);
        } catch (error) {
          console.error('關閉便利貼失敗:', error);
        }
      });

      console.log('已添加關閉便利貼按鈕');
    }
  }

  // 載入筆記內容
  if (isSticky) {
    // 便利貼視窗：從便利貼資料載入
    try {
      const allNotes = await getAllStickyNotes();
      const currentNote = allNotes.find(note => note.id === currentWindowLabel);

      if (currentNote) {
        const linkedContent = linkifyText(currentNote.content);
        noteDisplay.innerHTML = linkedContent;
        console.log(`便利貼 ${currentWindowLabel} 資料載入成功`);
      } else {
        console.log(`便利貼 ${currentWindowLabel} 無資料，顯示空白`);
      }
    } catch (error) {
      console.error("載入便利貼資料失敗:", error);
    }
  } else {
    // 主視窗：從 note.txt 載入
    try {
      const content = await loadNote();
      const linkedContent = linkifyText(content);
      noteDisplay.innerHTML = linkedContent;
      console.log("主視窗筆記載入成功");
    } catch (error) {
      console.error("載入筆記失敗:", error);
    }
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
      }, 1000); // 1秒後才轉換連結
    }

    // 延遲儲存
    if (saveTimeout !== null) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(async () => {
      console.log("執行自動儲存，內容長度:", plainText.length);

      // 根據視窗類型儲存
      if (isSticky) {
        // 便利貼視窗：更新便利貼資料
        await updateStickyNote(currentWindowLabel, plainText);
        console.log(`便利貼 ${currentWindowLabel} 資料已更新`);
      } else {
        // 主視窗：儲存到 note.txt 和歷史
        if (plainText.trim()) {
          await saveNoteToHistory(plainText);
        } else {
          await saveNote(plainText);
        }
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

  // 新增便條按鈕事件
  newMemoBtn?.addEventListener("click", async () => {
    try {
      // 創建新的便利貼視窗
      const newId = await createStickyNote();
      console.log(`已建立新便利貼視窗，ID: ${newId}`);
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
