import { findActualImageTokens } from "./htmlImageTokens";

const SAFE_IMAGE_DATA_URL =
  /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=]+$/i;
const SAFE_IMAGE_REFERENCE = /^[a-f0-9]{64}\.(?:png|jpg|gif)$/;

const IMAGE_CONTAINER_STYLE =
  "position: relative; display: inline-block; max-width: 100%; margin: 10px 0;";

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeHttpHref(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function buildSafeImageMarkup(src: string, widthPx?: number): string {
  const normalizedSrc = normalizeImageSrc(src);
  if (!normalizedSrc) return "";

  const widthStyle =
    typeof widthPx === "number"
      ? `width: ${widthPx}px; max-width: none;`
      : "width: auto; max-width: 100%;";
  const imageStyle = `${widthStyle} height: auto; display: block;`;

  return [
    `<div class="image-container" contenteditable="false" style="${IMAGE_CONTAINER_STYLE}">`,
    `<img ${normalizedSrc.attribute}="${escapeHtmlAttribute(normalizedSrc.value)}" class="inserted-image resizable" style="${imageStyle}" draggable="false">`,
    '<div class="resize-handle"></div>',
    "</div>",
  ].join("");
}

export function sanitizeStoredImageMarkup(markup: string): string {
  const attributes = readImageAttributes(markup);
  const imageReference = readSingleAttribute(attributes.imageReferences);
  if (imageReference !== undefined) {
    if (imageReference === null) return "";

    const normalizedReference = normalizeImageReference(imageReference);
    return normalizedReference
      ? buildSafeImageMarkup(normalizedReference, readImageWidth(attributes))
      : "";
  }

  const src = readSingleAttribute(attributes.sources);
  if (src === undefined || src === null) return "";
  return buildSafeImageMarkup(src, readImageWidth(attributes));
}

export function serializeImageElement(img: HTMLImageElement): string {
  const imageReference = img.getAttribute("data-upmemo-image");
  return buildSafeImageMarkup(
    imageReference === null ? img.src : imageReference,
    readElementWidth(img),
  );
}

function normalizeImageSrc(src: string): SafeImageSource | null {
  const imageReference = normalizeImageReference(src);
  if (imageReference) {
    return { attribute: "data-upmemo-image", value: imageReference };
  }

  const trimmed = decodeHtmlEntities(src).replace(/\s+/g, "");
  if (!SAFE_IMAGE_DATA_URL.test(trimmed)) return null;

  return { attribute: "src", value: trimmed };
}

type SafeImageSource = {
  readonly attribute: "data-upmemo-image" | "src";
  readonly value: string;
};

type ImageAttributes = {
  readonly imageReferences: readonly string[];
  readonly sources: readonly string[];
  readonly styles: readonly string[];
  readonly widths: readonly string[];
};

function normalizeImageReference(value: string): string | null {
  const decoded = decodeHtmlEntities(value);
  return SAFE_IMAGE_REFERENCE.test(decoded) ? decoded : null;
}

function readElementWidth(img: HTMLImageElement): number | undefined {
  const width = Number.parseInt(img.style.width, 10);
  return sanitizeWidth(width);
}

function readImageWidth(attributes: ImageAttributes): number | undefined {
  const style = readSingleAttribute(attributes.styles);
  if (typeof style === "string") {
    const styleWidth = /(?:^|;)\s*width\s*:\s*(\d{1,4})px\s*(?:;|$)/i.exec(style);
    if (styleWidth?.[1]) {
      const width = sanitizeWidth(Number.parseInt(styleWidth[1], 10));
      if (typeof width === "number") return width;
    }
  }

  const attrWidth = readSingleAttribute(attributes.widths);
  if (typeof attrWidth === "string") {
    return sanitizeWidth(Number.parseInt(attrWidth, 10));
  }

  return undefined;
}

function sanitizeWidth(width: number): number | undefined {
  if (!Number.isFinite(width)) return undefined;
  if (width < 50 || width > 2000) return undefined;
  return Math.round(width);
}

function readImageAttributes(markup: string): ImageAttributes {
  const imageTag = findActualImageTokens(markup)[0];
  const imageReferences: string[] = [];
  const sources: string[] = [];
  const styles: string[] = [];
  const widths: string[] = [];
  const attributes = imageTag?.markup.substring(4, imageTag.markup.length - 1) ?? "";
  const pattern = /(?:^|\s)([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null = pattern.exec(attributes);
  while (match !== null) {
    const name = match[1]?.toLowerCase();
    const value = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
    switch (name) {
      case "data-upmemo-image":
        imageReferences.push(value);
        break;
      case "src":
        sources.push(value);
        break;
      case "style":
        styles.push(value);
        break;
      case "width":
        widths.push(value);
        break;
    }
    match = pattern.exec(attributes);
  }

  return { imageReferences, sources, styles, widths };
}

function readSingleAttribute(values: readonly string[]): string | null | undefined {
  if (values.length === 0) return undefined;
  if (values.length !== 1) return null;
  return values[0] ?? null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}
