import type { MemoEntry } from "./types";
import { getArchive, restoreFromArchive as restoreFromArchiveAPI, permanentlyDeleteArchiveItem as permanentlyDeleteArchiveItemAPI } from "./api";
import { archivePanel, archiveList, archiveBtn, closeArchiveBtn } from "./dom";
import { escapeHtml, formatTimestamp } from "./utils";

// 顯示封存面板
export async function showArchive(): Promise<void> {
  try {
    const archive = await getArchive();
    renderArchive(archive);
    archivePanel?.classList.remove("hidden");
  } catch (error) {
    console.error("獲取封存失敗:", error);
  }
}

// 隱藏封存面板
export function hideArchive(): void {
  archivePanel?.classList.add("hidden");
}

// 渲染封存列表
function renderArchive(archive: MemoEntry[]): void {
  if (!archiveList) return;

  if (archive.length === 0) {
    archiveList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">封存是空的</div>';
    return;
  }

  archiveList.innerHTML = archive
    .map((item) => {
      const timeStr = formatTimestamp(item.timestamp);
      const preview = item.content.substring(0, 60) + (item.content.length > 60 ? "..." : "");

      return `
        <div class="archive-item" data-id="${item.id}">
          <div class="archive-item-actions">
            <button class="archive-item-restore" data-id="${item.id}" title="還原">↶</button>
            <button class="archive-item-delete-permanently" data-id="${item.id}" title="永久刪除">×</button>
          </div>
          <div class="archive-item-time">${timeStr}</div>
          <div class="archive-item-preview">${escapeHtml(preview)}</div>
        </div>
      `;
    })
    .join("");

  // 綁定還原按鈕事件
  document.querySelectorAll(".archive-item-restore").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).dataset.id;
      if (id) {
        await restoreFromArchive(id);
      }
    });
  });

  // 綁定永久刪除按鈕事件 - 使用雙擊確認機制
  document.querySelectorAll(".archive-item-delete-permanently").forEach((btn) => {
    let clickCount = 0;
    let clickTimer: number | null = null;

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).dataset.id;
      const target = e.target as HTMLElement;

      if (!id) return;

      clickCount++;

      if (clickCount === 1) {
        // 第一次點擊：改變顏色
        target.style.backgroundColor = "#ff8888";

        // 設定 2 秒後重置
        clickTimer = window.setTimeout(() => {
          clickCount = 0;
          target.style.backgroundColor = "";
        }, 2000);
      } else if (clickCount === 2) {
        // 第二次點擊：執行刪除
        if (clickTimer !== null) {
          clearTimeout(clickTimer);
        }
        clickCount = 0;
        target.style.backgroundColor = "";
        await permanentlyDeleteArchiveItem(id);
      }
    });
  });
}

// 從封存還原
async function restoreFromArchive(id: string): Promise<void> {
  try {
    await restoreFromArchiveAPI(id);
    await showArchive();
    console.log("已還原");
  } catch (error) {
    console.error("還原失敗:", error);
  }
}

// 永久刪除封存項目
async function permanentlyDeleteArchiveItem(id: string): Promise<void> {
  try {
    await permanentlyDeleteArchiveItemAPI(id);
    await showArchive();
    console.log("已永久刪除");
  } catch (error) {
    console.error("永久刪除失敗:", error);
  }
}

// 設置封存監聽器
export function setupArchiveListeners(): void {
  archiveBtn?.addEventListener("click", async () => {
    await showArchive();
  });

  closeArchiveBtn?.addEventListener("click", () => {
    hideArchive();
  });
}
