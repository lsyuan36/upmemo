import { currentMonitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { setPreviewImageData } from "./api";
import { logError } from "./logger";

const PREVIEW_WINDOW_LABEL = "image-preview";
const PREVIEW_READY_TIMEOUT_MS = 5000;

export async function openImagePreview(imageSrc: string): Promise<void> {
  try {
    const monitor = await currentMonitor();
    if (!monitor) {
      logError("無法獲取螢幕資訊");
      return;
    }

    await closeExistingPreviewWindow();
    await setPreviewImageData(imageSrc);

    const previewWindow = new WebviewWindow(PREVIEW_WINDOW_LABEL, {
      url: "/preview.html",
      title: "圖片預覽",
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
      visible: false,
    });

    await waitForPreviewWindowCreated(previewWindow);
  } catch (error) {
    logError("創建預覽視窗失敗:", error);
  }
}

async function closeExistingPreviewWindow(): Promise<void> {
  const existingPreview = await WebviewWindow.getByLabel(PREVIEW_WINDOW_LABEL);
  if (!existingPreview) return;

  try {
    await existingPreview.close();
  } catch (error) {
    logError("關閉既有預覽視窗失敗:", error);
  }
}

function waitForPreviewWindowCreated(previewWindow: WebviewWindow): Promise<void> {
  let timeoutId: number | null = null;
  let unlistenCreated: (() => void) | null = null;
  let unlistenError: (() => void) | null = null;
  let settled = false;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      unlistenCreated?.();
      unlistenError?.();
      unlistenCreated = null;
      unlistenError = null;
    };

    const settle = (complete: () => void) => {
      if (settled) return;

      settled = true;
      cleanup();
      complete();
    };

    timeoutId = window.setTimeout(() => {
      settle(() => reject(new Error("等待圖片預覽視窗建立逾時")));
    }, PREVIEW_READY_TIMEOUT_MS);

    void previewWindow
      .once("tauri://created", () => {
        settle(resolve);
      })
      .then((unlisten) => {
        if (settled) {
          unlisten();
          return;
        }

        unlistenCreated = unlisten;
      })
      .catch((error: unknown) => {
        settle(() =>
          reject(error instanceof Error ? error : new Error(String(error))),
        );
      });

    void previewWindow
      .once("tauri://error", (event) => {
        settle(() =>
          reject(new Error(`預覽視窗創建失敗: ${String(event.payload)}`)),
        );
      })
      .then((unlisten) => {
        if (settled) {
          unlisten();
          return;
        }

        unlistenError = unlisten;
      })
      .catch((error: unknown) => {
        settle(() =>
          reject(error instanceof Error ? error : new Error(String(error))),
        );
      });
  });
}
