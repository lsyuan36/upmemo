// 圖片處理模組
import { noteDisplay } from "./dom";

/**
 * 將檔案轉換為 base64 字串
 */
async function fileToBase64(file: File): Promise<string> {
  // GIF 保持原始避免破壞動畫
  if (file.type === "image/gif") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("無法讀取檔案"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // 其他格式以 Canvas 壓縮/縮放
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("影像載入失敗"));
      i.src = objectUrl;
    });

    const maxDim = 1600;
    let { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const newW = Math.max(1, Math.round(width * scale));
    const newH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法建立繪圖內容");
    ctx.drawImage(img, 0, 0, newW, newH);

    const isJpeg = /jpe?g/i.test(file.type);
    const mime = isJpeg ? "image/jpeg" : "image/png";
    const quality = isJpeg ? 0.85 : undefined;
    return canvas.toDataURL(mime, quality as any);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 創建可調整大小的圖片容器
 */
function createResizableImage(base64: string): HTMLElement {
  // 創建容器
  const container = document.createElement("div");
  container.className = "image-container";
  container.contentEditable = "false"; // 防止編輯
  container.style.position = "relative";
  container.style.display = "inline-block";
  container.style.maxWidth = "100%";
  container.style.margin = "10px 0";

  // 創建圖片
  const img = document.createElement("img");
  img.src = base64;
  img.className = "inserted-image resizable";
  img.style.width = "auto";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.display = "block";
  img.draggable = false;

  // 創建調整大小的控制點
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "resize-handle";

  container.appendChild(img);
  container.appendChild(resizeHandle);

  // 使用統一的事件綁定函數
  setTimeout(() => {
    bindResizeEvents(container);
  }, 0);

  return container;
}

/**
 * 插入圖片到游標位置
 */
function insertImageAtCursor(base64: string) {
  const selection = window.getSelection();
  const imageContainer = createResizableImage(base64);

  if (!selection || selection.rangeCount === 0) {
    // 如果沒有選區，在最後插入
    noteDisplay.appendChild(imageContainer);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(imageContainer);

  // 將游標移到圖片後面
  range.setStartAfter(imageContainer);
  range.setEndAfter(imageContainer);
  selection.removeAllRanges();
  selection.addRange(range);

  // 觸發 input 事件以儲存內容
  noteDisplay.dispatchEvent(new Event("input", { bubbles: true }));
}


/**
 * 為圖片容器綁定調整大小事件
 */
function bindResizeEvents(container: HTMLElement) {
  // 檢查是否已經綁定過
  if ((container as any)._resizeBound) {
    return;
  }

  const img = container.querySelector('.inserted-image') as HTMLImageElement;
  const resizeHandle = container.querySelector('.resize-handle') as HTMLElement;

  if (!img || !resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing = true;
    startX = e.clientX;
    startWidth = img.offsetWidth;

    resizeHandle.style.opacity = "1";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = startWidth + deltaX;

    // 限制最小和最大寬度
    if (newWidth >= 50 && newWidth <= noteDisplay.offsetWidth) {
      img.style.width = newWidth + "px";
      img.style.maxWidth = "none";
    }
  };

  const handleMouseUp = () => {
    if (isResizing) {
      isResizing = false;
      resizeHandle.style.opacity = "0";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // 使用自定義事件標記這是圖片調整大小觸發的
      setTimeout(() => {
        const event = new CustomEvent("input", {
          bubbles: true,
          detail: { skipLinkify: true }
        });
        noteDisplay.dispatchEvent(event);
      }, 100);
    }
  };

  // 綁定事件
  resizeHandle.addEventListener("mousedown", handleMouseDown);

  // 標記已綁定
  (container as any)._resizeBound = true;

  // 儲存事件處理器引用,以便後續清理
  (container as any)._resizeCleanup = () => {
    resizeHandle.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    (container as any)._resizeBound = false;
  };
}

/**
 * 為所有現有圖片容器重新綁定事件
 */
function rebindAllImageEvents() {
  const containers = noteDisplay.querySelectorAll('.image-container');
  containers.forEach((container) => {
    // 只綁定尚未綁定的容器
    if (!(container as any)._resizeBound) {
      bindResizeEvents(container as HTMLElement);
    }
  });
}

/**
 * 處理複製貼上圖片
 */
async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 檢查是否為圖片
    if (item.type.startsWith("image/")) {
      event.preventDefault();

      const file = item.getAsFile();
      if (!file) continue;

      // 檢查檔案大小 (限制 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("圖片大小不能超過 5MB");
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        insertImageAtCursor(base64);
        console.log("貼上圖片成功");
      } catch (error) {
        console.error("圖片處理失敗:", error);
        alert("圖片處理失敗");
      }

      break; // 只處理第一張圖片
    }
  }
}

/**
 * 設置圖片插入監聽器
 */
// 拖放處理 - dragenter/dragover/dragleave/drop
function setupDragAndDrop() {
  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    noteDisplay.classList.add("dragover");
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === noteDisplay) {
      noteDisplay.classList.remove("dragover");
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    noteDisplay.classList.remove("dragover");

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        alert("圖片大小超過 10MB，請先壓縮後再嘗試。");
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        insertImageAtCursor(base64);
      } catch (err) {
        console.error("拖放圖片處理失敗", err);
        alert("拖放圖片處理失敗");
      }
    }
  }

  noteDisplay.addEventListener("dragenter", onDragEnter);
  noteDisplay.addEventListener("dragover", onDragOver);
  noteDisplay.addEventListener("dragleave", onDragLeave);
  noteDisplay.addEventListener("drop", onDrop);
}

/**
 * 創建圖片預覽視窗 (使用 Tauri 全螢幕視窗)
 */
async function createImagePreview(imageSrc: string) {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
    const { emit } = await import('@tauri-apps/api/event');

    // 獲取當前螢幕資訊
    const monitor = await currentMonitor();
    if (!monitor) {
      console.error('無法獲取螢幕資訊');
      return;
    }

    console.log('準備創建預覽視窗,圖片數據長度:', imageSrc.length);

    // 創建全螢幕預覽視窗 (初始隱藏以避免閃爍)
    const previewWindow = new WebviewWindow('image-preview', {
      url: '/preview.html',
      title: '圖片預覽',
      width: monitor.size.width,
      height: monitor.size.height,
      x: monitor.position.x,
      y: monitor.position.y,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: true,
      resizable: false,
      fullscreen: true,
      focus: true,
      visible: false,  // 初始隱藏
    });

    // 監聽視窗載入完成後發送圖片數據
    previewWindow.once('tauri://created', async () => {
      console.log('預覽視窗已創建,準備發送圖片數據');
      // 等待較長時間確保視窗完全初始化並載入 JavaScript
      setTimeout(async () => {
        try {
          console.log('開始發送圖片數據事件...');
          await emit('preview-image-data', { data: imageSrc });
          console.log('圖片數據已發送!事件名稱: preview-image-data');
        } catch (error) {
          console.error('發送圖片數據失敗:', error);
        }
      }, 500);
    });

    previewWindow.once('tauri://error', (e) => {
      console.error('預覽視窗創建失敗:', e);
    });

  } catch (error) {
    console.error('創建預覽視窗失敗:', error);
  }
}

// 點選圖片容器以選取 + Delete/Backspace 刪除 + 雙擊預覽
function setupSelectionAndDelete() {
  let selected: HTMLElement | null = null;

  function clearSelection() {
    if (selected) {
      selected.classList.remove("selected");
      selected = null;
    }
  }

  // 單擊選取
  noteDisplay.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const container = target.closest('.image-container') as HTMLElement | null;
    if (container) {
      if (selected && selected !== container) selected.classList.remove("selected");
      selected = container;
      selected.classList.add("selected");
    } else {
      clearSelection();
    }
  });

  // 雙擊圖片顯示預覽
  noteDisplay.addEventListener("dblclick", (e) => {
    const target = e.target as HTMLElement;
    const img = target.closest('.inserted-image') as HTMLImageElement | null;
    if (img && img.src) {
      e.preventDefault();
      e.stopPropagation();
      createImagePreview(img.src);
    }
  });

  // 刪除選中的圖片
  noteDisplay.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!selected) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const toRemove = selected;
      clearSelection();
      toRemove.remove();
      const event = new CustomEvent("input", { bubbles: true, detail: { skipLinkify: true } });
      noteDisplay.dispatchEvent(event);
    }
  });
}

export function setupImageListeners() {
  // 監聽貼上事件
  noteDisplay?.addEventListener("paste", handlePaste);

  // 為現有圖片綁定事件
  rebindAllImageEvents();
  // 啟用拖放支援與選取刪除
  setupDragAndDrop();
  setupSelectionAndDelete();

  // 使用防抖來避免頻繁重新綁定
  let rebindTimeout: number | null = null;
  const debouncedRebind = () => {
    if (rebindTimeout) {
      clearTimeout(rebindTimeout);
    }
    rebindTimeout = window.setTimeout(() => {
      rebindAllImageEvents();
    }, 200);
  };

  // 監聽內容變化,重新綁定事件
  const observer = new MutationObserver((mutations) => {
    // 只在添加新節點時重新綁定
    const hasNewNodes = mutations.some(mutation =>
      mutation.addedNodes.length > 0
    );

    if (hasNewNodes) {
      debouncedRebind();
    }
  });

  observer.observe(noteDisplay, {
    childList: true,
    subtree: true,
  });

  console.log("圖片插入監聽器設置完成");
}
