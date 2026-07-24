import { noteDisplay } from "./dom";
import {
  fileToBase64,
  MAX_DROP_IMAGE_BYTES,
  MAX_PASTE_IMAGE_BYTES,
} from "./imageEncoding";
import { openImagePreview } from "./imagePreview";
import { createResizableImage, rebindAllImageEvents } from "./imageResize";
import { logError } from "./logger";

function insertImageAtCursor(base64: string): void {
  const selection = window.getSelection();
  const imageContainer = createResizableImage(base64);

  if (!selection || selection.rangeCount === 0) {
    noteDisplay.appendChild(imageContainer);
    noteDisplay.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(imageContainer);
  range.setStartAfter(imageContainer);
  range.setEndAfter(imageContainer);
  selection.removeAllRanges();
  selection.addRange(range);

  noteDisplay.dispatchEvent(new Event("input", { bubbles: true }));
}

async function handlePaste(event: ClipboardEvent): Promise<void> {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (!item.type.startsWith("image/")) continue;

    event.preventDefault();
    const file = item.getAsFile();
    if (!file) continue;

    if (file.size > MAX_PASTE_IMAGE_BYTES) {
      alert("圖片大小不能超過 5MB");
      return;
    }

    try {
      insertImageAtCursor(await fileToBase64(file));
    } catch (error) {
      logError("圖片處理失敗:", error);
      alert("圖片處理失敗");
    }

    return;
  }
}

function setupDragAndDrop(): void {
  const onDragEnter = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    noteDisplay.classList.add("dragover");
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.target === noteDisplay) {
      noteDisplay.classList.remove("dragover");
    }
  };

  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    noteDisplay.classList.remove("dragover");

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      if (file.size > MAX_DROP_IMAGE_BYTES) {
        alert("圖片大小超過 10MB，請先壓縮後再嘗試。");
        continue;
      }

      try {
        insertImageAtCursor(await fileToBase64(file));
      } catch (error) {
        logError("拖放圖片處理失敗", error);
        alert("拖放圖片處理失敗");
      }
    }
  };

  noteDisplay.addEventListener("dragenter", onDragEnter);
  noteDisplay.addEventListener("dragover", onDragOver);
  noteDisplay.addEventListener("dragleave", onDragLeave);
  noteDisplay.addEventListener("drop", onDrop);
}

function setupSelectionAndDelete(): void {
  let selected: HTMLElement | null = null;
  let lastClickedContainer: HTMLElement | null = null;
  let lastClickAt = 0;

  const clearSelection = () => {
    if (!selected) return;

    selected.classList.remove("selected");
    selected = null;
  };

  noteDisplay.addEventListener("click", (event) => {
    const now = window.performance.now();

    if (!(event.target instanceof Element)) {
      clearSelection();
      lastClickedContainer = null;
      return;
    }

    const container = event.target.closest(".image-container");
    if (container instanceof HTMLElement) {
      if (lastClickedContainer === container && now - lastClickAt <= 500) {
        openImageFromContainer(container, event);
        lastClickedContainer = null;
        lastClickAt = 0;
        return;
      }

      if (selected && selected !== container) {
        selected.classList.remove("selected");
      }

      selected = container;
      selected.classList.add("selected");
      lastClickedContainer = container;
      lastClickAt = now;
      return;
    }

    clearSelection();
    lastClickedContainer = null;
  });

  noteDisplay.addEventListener("dblclick", (event) => {
    if (!(event.target instanceof Element)) return;

    const img =
      event.target instanceof HTMLImageElement &&
      event.target.classList.contains("inserted-image")
        ? event.target
        : event.target
            .closest(".image-container")
            ?.querySelector<HTMLImageElement>("img.inserted-image");
    if (!(img instanceof HTMLImageElement) || !img.src) return;

    event.preventDefault();
    event.stopPropagation();
    void openImagePreview(img.src);
  });

  noteDisplay.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!selected) return;
    if (event.key === "Enter" || event.key === " ") {
      openImageFromContainer(selected, event);
      return;
    }

    if (event.key !== "Delete" && event.key !== "Backspace") return;

    event.preventDefault();
    const toRemove = selected;
    clearSelection();
    toRemove.remove();
    noteDisplay.dispatchEvent(
      new CustomEvent("input", {
        bubbles: true,
        detail: { skipLinkify: true },
      }),
    );
  });
}

function openImageFromContainer(
  container: Element,
  event: MouseEvent | KeyboardEvent,
): void {
  const img = container.querySelector<HTMLImageElement>("img.inserted-image");
  if (!(img instanceof HTMLImageElement) || !img.src) return;

  event.preventDefault();
  event.stopPropagation();
  void openImagePreview(img.src);
}

export function setupImageListeners(): void {
  noteDisplay.addEventListener("paste", handlePaste);
  rebindAllImageEvents();
  setupDragAndDrop();
  setupSelectionAndDelete();

  let rebindTimeout: number | null = null;
  const debouncedRebind = () => {
    if (rebindTimeout !== null) {
      clearTimeout(rebindTimeout);
    }

    rebindTimeout = window.setTimeout(() => {
      rebindAllImageEvents();
    }, 200);
  };

  const observer = new MutationObserver((mutations) => {
    const hasNewNodes = mutations.some((mutation) => mutation.addedNodes.length > 0);
    if (hasNewNodes) {
      debouncedRebind();
    }
  });

  observer.observe(noteDisplay, {
    childList: true,
    subtree: true,
  });
}
