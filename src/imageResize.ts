import { noteDisplay } from "./dom";

const resizeBoundContainers = new WeakSet<HTMLElement>();

export function createResizableImage(base64: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "image-container";
  container.contentEditable = "false";
  container.style.position = "relative";
  container.style.display = "inline-block";
  container.style.maxWidth = "100%";
  container.style.margin = "10px 0";

  const img = document.createElement("img");
  img.src = base64;
  img.className = "inserted-image resizable";
  img.style.width = "auto";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.display = "block";
  img.draggable = false;

  const resizeHandle = document.createElement("div");
  resizeHandle.className = "resize-handle";

  container.appendChild(img);
  container.appendChild(resizeHandle);
  bindResizeEvents(container);

  return container;
}

export function rebindAllImageEvents(): void {
  const containers = noteDisplay.querySelectorAll(".image-container");
  containers.forEach((container) => {
    if (container instanceof HTMLElement && !resizeBoundContainers.has(container)) {
      bindResizeEvents(container);
    }
  });
}

function bindResizeEvents(container: HTMLElement): void {
  if (resizeBoundContainers.has(container)) {
    return;
  }

  const img = container.querySelector<HTMLImageElement>(".inserted-image");
  const resizeHandle = container.querySelector<HTMLElement>(".resize-handle");
  if (!img || !resizeHandle) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const handleMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    isResizing = true;
    startX = event.clientX;
    startWidth = img.offsetWidth;

    resizeHandle.style.opacity = "1";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = startWidth + event.clientX - startX;
    if (newWidth >= 50 && newWidth <= noteDisplay.offsetWidth) {
      img.style.width = `${newWidth}px`;
      img.style.maxWidth = "none";
    }
  };

  const handleMouseUp = () => {
    if (!isResizing) return;

    isResizing = false;
    resizeHandle.style.opacity = "0";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    window.setTimeout(() => {
      noteDisplay.dispatchEvent(
        new CustomEvent("input", {
          bubbles: true,
          detail: { skipLinkify: true },
        }),
      );
    }, 100);
  };

  resizeHandle.addEventListener("mousedown", handleMouseDown);
  resizeBoundContainers.add(container);
}
