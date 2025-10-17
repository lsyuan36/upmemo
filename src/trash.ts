import type { MemoEntry } from "./types";
import { getTrash, restoreFromTrash as restoreFromTrashAPI, permanentlyDeleteTrashItem as permanentlyDeleteTrashItemAPI, emptyTrash as emptyTrashAPI } from "./api";
import { trashPanel, trashList, trashBtn, closeTrashBtn, emptyTrashBtn } from "./dom";
import { escapeHtml, formatTimestamp } from "./utils";

// 顯示垃圾桶面板
export async function showTrash(): Promise<void> {
  try {
    const trash = await getTrash();
    renderTrash(trash);
    trashPanel?.classList.remove("hidden");
  } catch (error) {
    console.error("獲取垃圾桶失敗:", error);
  }
}

// 隱藏垃圾桶面板
export function hideTrash(): void {
  trashPanel?.classList.add("hidden");
}

// 渲染垃圾桶列表
function renderTrash(trash: MemoEntry[]): void {
  if (!trashList) return;

  if (trash.length === 0) {
    trashList.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">垃圾桶是空的</div>';
    return;
  }

  trashList.innerHTML = trash
    .map((item) => {
      const timeStr = formatTimestamp(item.timestamp);
      const preview = item.content.substring(0, 60) + (item.content.length > 60 ? "..." : "");

      return `
        <div class="trash-item" data-id="${item.id}">
          <div class="trash-item-actions">
            <button class="trash-item-restore" data-id="${item.id}" title="還原">↶</button>
            <button class="trash-item-delete-permanently" data-id="${item.id}" title="永久刪除">×</button>
          </div>
          <div class="trash-item-time">${timeStr}</div>
          <div class="trash-item-preview">${escapeHtml(preview)}</div>
        </div>
      `;
    })
    .join("");

  // 綁定還原按鈕事件
  document.querySelectorAll(".trash-item-restore").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = (e.target as HTMLElement).dataset.id;
      if (id) {
        await restoreFromTrash(id);
      }
    });
  });

  // 綁定永久刪除按鈕事件 - 使用雙擊確認機制
  document.querySelectorAll(".trash-item-delete-permanently").forEach((btn) => {
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
        await permanentlyDeleteTrashItem(id);
      }
    });
  });
}

// 從垃圾桶還原
async function restoreFromTrash(id: string): Promise<void> {
  try {
    await restoreFromTrashAPI(id);
    await showTrash();
    console.log("已還原");
  } catch (error) {
    console.error("還原失敗:", error);
  }
}

// 永久刪除垃圾桶項目
async function permanentlyDeleteTrashItem(id: string): Promise<void> {
  try {
    await permanentlyDeleteTrashItemAPI(id);
    await showTrash();
    console.log("已永久刪除");
  } catch (error) {
    console.error("永久刪除失敗:", error);
  }
}

// 清空垃圾桶
async function emptyTrash(): Promise<void> {
  try {
    await emptyTrashAPI();
    await showTrash();
    console.log("垃圾桶已清空");
  } catch (error) {
    console.error("清空垃圾桶失敗:", error);
  }
}

// 設置垃圾桶監聽器
export function setupTrashListeners(): void {
  trashBtn?.addEventListener("click", async () => {
    await showTrash();
  });

  closeTrashBtn?.addEventListener("click", () => {
    hideTrash();
  });

  // 清空垃圾桶按鈕 - 雙擊清空
  let emptyTrashClickCount = 0;
  let emptyTrashTimer: number | null = null;

  emptyTrashBtn?.addEventListener("click", async () => {
    emptyTrashClickCount++;

    if (emptyTrashClickCount === 1) {
      // 第一次點擊：顯示提示並啟動計時器
      if (emptyTrashBtn) {
        emptyTrashBtn.textContent = "再按一次";
        emptyTrashBtn.style.backgroundColor = "#ff8888";
      }

      // 設定 2 秒後重置
      emptyTrashTimer = window.setTimeout(() => {
        emptyTrashClickCount = 0;
        if (emptyTrashBtn) {
          emptyTrashBtn.textContent = "清空";
          emptyTrashBtn.style.backgroundColor = "";
        }
      }, 2000);
    } else if (emptyTrashClickCount === 2) {
      // 第二次點擊：執行清空
      if (emptyTrashTimer !== null) {
        clearTimeout(emptyTrashTimer);
      }
      emptyTrashClickCount = 0;
      if (emptyTrashBtn) {
        emptyTrashBtn.textContent = "清空";
        emptyTrashBtn.style.backgroundColor = "";
      }
      await emptyTrash();
    }
  });
}
