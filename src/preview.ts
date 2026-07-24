import { getCurrentWindow } from "@tauri-apps/api/window";
import { takePreviewImageData } from "./api";
import { logError } from "./logger";

const previewImage = requireElement("preview-image", HTMLImageElement);
const loadingSpinner = requireElement("loading-spinner", HTMLDivElement);
const zoomInfo = requireElement("zoom-info", HTMLDivElement);
const previewContainer = requireElement("preview-container", HTMLDivElement);
const currentWindow = getCurrentWindow();

let scale = 1;
const minScale = 0.5;
const maxScale = 5;
const scaleStep = 0.1;

function requireElement<T extends HTMLElement>(
  id: string,
  elementClass: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementClass)) {
    throw new Error(`找不到必要元素: ${id}`);
  }

  return element;
}

async function initializePreview(): Promise<void> {
  try {
    previewImage.onload = () => {
      loadingSpinner.classList.add("hidden");
      previewImage.style.display = "block";
      void showPreviewWindow();
    };

    previewImage.onerror = (error) => {
      logError("圖片載入失敗:", error);
      loadingSpinner.classList.add("hidden");
    };

    previewImage.src = await takePreviewImageData();
  } catch (error) {
    logError("設置預覽視窗失敗:", error);
    loadingSpinner.classList.add("hidden");
  }
}

async function showPreviewWindow(): Promise<void> {
  try {
    await currentWindow.show();
    await currentWindow.setFocus();
  } catch (error) {
    logError("顯示視窗失敗:", error);
  }
}

function updateZoomInfo(): void {
  const percent = Math.round(scale * 100);
  zoomInfo.textContent = `Ctrl + 滾輪縮放 | ${percent}%`;
}

document.addEventListener(
  "wheel",
  (event: WheelEvent) => {
    if (!event.ctrlKey) return;

    event.preventDefault();
    const delta = event.deltaY > 0 ? -scaleStep : scaleStep;
    scale = Math.max(minScale, Math.min(maxScale, scale + delta));
    previewImage.style.transform = `scale(${scale})`;
    updateZoomInfo();
  },
  { passive: false },
);

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    void currentWindow.close();
  }
});

document.body.addEventListener("click", (event: MouseEvent) => {
  if (event.target === document.body || event.target === previewContainer) {
    void currentWindow.close();
  }
});

previewImage.addEventListener("click", (event: MouseEvent) => {
  event.stopPropagation();
});

void initializePreview();
