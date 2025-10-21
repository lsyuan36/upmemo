import type { MemoEntry } from "./types";
import { getHistory, loadHistoryItem as loadHistoryItemAPI, deleteHistoryItem as deleteHistoryItemAPI, archiveHistoryItem as archiveHistoryItemAPI } from "./api";
import { historyPanel, historyList, historyBtn, closeHistoryBtn, noteDisplay } from "./dom";
import { escapeHtml, formatTimestamp } from "./utils";
import { saveNote } from "./api";
import { linkifyText } from "./linkify";

// 顯示歷史記錄面板
export async function showHistory(): Promise<void> {
  try {
    const history = await getHistory();
    renderHistory(history);
    historyPanel?.classList.remove("hidden");
  } catch (error) {
    console.error("獲取歷史記錄失敗:", error);
  }
}

// 隱藏歷史記錄面板
export function hideHistory(): void {
  historyPanel?.classList.add("hidden");
}

// 渲染歷史記錄列表
function renderHistory(history: MemoEntry[]): void {
  if (!historyList) return;

  if (history.length === 0) {
    historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">沒有歷史記錄</div>';
    return;
  }

  historyList.innerHTML = history
    .map((item) => {
      const timeStr = formatTimestamp(item.timestamp);
      const preview = item.content.substring(0, 60) + (item.content.length > 60 ? "..." : "");

      return `
        <div class="history-item" data-id="${item.id}">
          <button class="history-item-archive" data-id="${item.id}" title="封存">📦</button>
          <button class="history-item-delete" data-id="${item.id}" title="刪除">×</button>
          <div class="history-item-time">${timeStr}</div>
          <div class="history-item-preview">${escapeHtml(preview)}</div>
        </div>
      `;
    })
    .join("");

  // 綁定點擊載入事件
  document.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      // 如果點擊的是封存或刪除按鈕，不載入
      if (target.classList.contains("history-item-archive") || target.classList.contains("history-item-delete")) {
        return;
      }
      const id = (item as HTMLElement).dataset.id;
      if (id) {
        await loadHistoryItem(id);
      }
    });
  });

  // 綁定封存按鈕事件
  document.querySelectorAll(".history-item-archive").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).dataset.id;
      if (id) {
        await archiveHistoryItem(id);
      }
    });
  });

  // 綁定刪除按鈕事件 (移至垃圾桶，不需要確認)
  document.querySelectorAll(".history-item-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).dataset.id;
      if (id) {
        await deleteHistoryItem(id);
      }
    });
  });
}

// 載入歷史記錄項目
async function loadHistoryItem(id: string): Promise<void> {
  try {
    const content = await loadHistoryItemAPI(id);
    if (noteDisplay) {
      const linkedContent = linkifyText(content);
      noteDisplay.innerHTML = linkedContent;
      await saveNote(content);
    }
    hideHistory();
    console.log("已載入歷史記錄");
  } catch (error) {
    console.error("載入歷史記錄失敗:", error);
  }
}

// 刪除歷史記錄項目 (移至垃圾桶)
async function deleteHistoryItem(id: string): Promise<void> {
  try {
    await deleteHistoryItemAPI(id);
    await showHistory();
    console.log("已移至垃圾桶");
  } catch (error) {
    console.error("移至垃圾桶失敗:", error);
  }
}

// 封存歷史記錄項目
async function archiveHistoryItem(id: string): Promise<void> {
  try {
    await archiveHistoryItemAPI(id);
    await showHistory();
    console.log("已封存");
  } catch (error) {
    console.error("封存失敗:", error);
  }
}

// 設置歷史記錄監聽器
export function setupHistoryListeners(): void {
  console.log("設置歷史記錄按鈕監聽器...", historyBtn, closeHistoryBtn);

  historyBtn?.addEventListener("click", async () => {
    console.log("歷史記錄按鈕被點擊");
    await showHistory();
  });

  closeHistoryBtn?.addEventListener("click", () => {
    console.log("關閉歷史記錄按鈕被點擊");
    hideHistory();
  });
}
