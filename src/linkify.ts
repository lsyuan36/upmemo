import { findActualImageContainerTokens, replaceActualImageTokens } from "./htmlImageTokens";
import { logError } from "./logger";
import {
  escapeHtmlAttribute,
  normalizeHttpHref,
  sanitizeStoredImageMarkup,
  serializeImageElement,
} from "./safeHtml";

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
const IMG_PLACEHOLDER_PREFIX = "\uFFF0IMG_";
const IMG_PLACEHOLDER_SUFFIX = "_IMG\uFFF1";

export function linkifyText(text: string): string {
  const images: string[] = [];
  let textWithPlaceholders = replaceActualImageContainers(text, images);

  textWithPlaceholders = replaceActualImageTokens(
    textWithPlaceholders,
    (match) => stashImage(match, images),
  );

  const processedLines = textWithPlaceholders.split("\n").map((line) => {
    const escaped = escapeText(line);
    return escaped.replace(URL_REGEX, (url) => {
      const href = normalizeHttpHref(url);
      if (!href) return url;

      return `<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  });

  return processedLines
    .join("<br>")
    .replace(
      new RegExp(`${IMG_PLACEHOLDER_PREFIX}(\\d+)${IMG_PLACEHOLDER_SUFFIX}`, "g"),
      (_, index) => images[Number.parseInt(index, 10)] ?? "",
    );
}

export function extractPlainText(element: HTMLElement): string {
  let result = "";

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    if (!(node instanceof HTMLElement)) {
      return "";
    }

    if (node.classList.contains("image-container")) {
      const img = node.querySelector<HTMLImageElement>("img.inserted-image");
      return img ? `${serializeImageElement(img)}\n` : "";
    }

    if (node instanceof HTMLImageElement) {
      return serializeImageElement(node);
    }

    if (node.tagName === "BR") {
      return "\n";
    }

    let content = "";
    for (const child of Array.from(node.childNodes)) {
      content += processNode(child);
    }

    if (node.tagName === "DIV" && content) {
      return `${content}\n`;
    }

    return content;
  }

  for (const child of Array.from(element.childNodes)) {
    result += processNode(child);
  }

  return result.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

export function setContentWithCursor(
  element: HTMLDivElement,
  htmlContent: string,
): void {
  const selection = window.getSelection();
  let cursorOffset = 0;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    cursorOffset = preCaretRange.toString().length;
  }

  element.innerHTML = htmlContent;

  if (cursorOffset > 0) {
    restoreCursor(element, cursorOffset);
  }
}

export function handleLinkClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;

  const target = event.target.closest("a");
  if (!target) return;

  event.preventDefault();
  const href = target.getAttribute("href");
  if (!href) return;

  const safeHref = normalizeHttpHref(href);
  if (!safeHref) return;

  void (async () => {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(safeHref);
  })().catch((error: unknown) => {
    logError("無法開啟連結:", error);
    window.open(safeHref, "_blank", "noopener,noreferrer");
  });
}

function replaceActualImageContainers(text: string, images: string[]): string {
  const containers = findActualImageContainerTokens(text);
  if (containers.length === 0) return text;

  let result = "";
  let position = 0;
  for (const container of containers) {
    result += text.substring(position, container.start);
    result += stashImage(container.markup, images);
    position = container.end;
  }
  return result + text.substring(position);
}

function stashImage(markup: string, images: string[]): string {
  const safeImageMarkup = sanitizeStoredImageMarkup(markup);
  if (!safeImageMarkup) return "";

  const index = images.length;
  images.push(safeImageMarkup);
  return `${IMG_PLACEHOLDER_PREFIX}${index}${IMG_PLACEHOLDER_SUFFIX}`;
}

function restoreCursor(element: HTMLElement, offset: number): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  let currentOffset = 0;
  let found = false;

  function traverse(node: Node): void {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;
      if (currentOffset + textLength >= offset) {
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        found = true;
        return;
      }

      currentOffset += textLength;
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      traverse(child);
      if (found) return;
    }
  }

  traverse(element);

  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
