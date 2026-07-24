import { getSystemFonts, loadFontConfig as loadFontConfigAPI, saveFontConfig as saveFontConfigAPI } from "./api";
import { DEFAULT_FONT_SIZE } from "./constants";
import { chineseFontSelect, englishFontSelect, fontSizeSlider, fontSizeValue, noteDisplay } from "./dom";
import { logError, logInfo } from "./logger";
import { loadFontSize as loadFontSizeFromStorage, saveFontSize as saveFontSizeToStorage } from "./storage";
import type { FontConfig } from "./types";

let currentFontConfig: FontConfig = {
  chinese_font: "Microsoft JhengHei",
  english_font: "Segoe UI"
};

let currentFontSize: number = DEFAULT_FONT_SIZE;

export async function initFontSystem(): Promise<void> {
  try {
    const fonts = await getSystemFonts();
    logInfo(`已載入 ${fonts.length} 個系統字體`);

    if (chineseFontSelect) {
      replaceFontOptions(chineseFontSelect, fonts);
    }
    if (englishFontSelect) {
      replaceFontOptions(englishFontSelect, fonts);
    }

    await loadFontConfig();
    initFontSize();
  } catch (error) {
    logError("載入系統字體失敗:", error);
  }
}

export async function saveFontConfig(): Promise<void> {
  try {
    await saveFontConfigAPI(currentFontConfig.chinese_font, currentFontConfig.english_font);
    logInfo("字體設定儲存成功");
  } catch (error) {
    logError("儲存字體設定失敗:", error);
  }
}

export function applyFontConfig(): void {
  if (!noteDisplay) return;

  document.getElementById("font-style")?.remove();

  const englishFont = cssString(currentFontConfig.english_font);
  const chineseFont = cssString(currentFontConfig.chinese_font);
  const style = document.createElement("style");
  style.id = "font-style";
  style.textContent = `
    .note-display {
      font-family: "${englishFont}", sans-serif;
    }
    @supports (unicode-range: U+4E00-9FFF) {
      @font-face {
        font-family: 'CustomChinese';
        src: local("${chineseFont}");
        unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;
      }
      .note-display {
        font-family: 'CustomChinese', "${englishFont}", sans-serif;
      }
    }
  `;
  document.head.appendChild(style);

  logInfo(`已應用字體 - 中文: ${currentFontConfig.chinese_font}, 英文: ${currentFontConfig.english_font}`);
}

export function updateChineseFont(font: string): void {
  currentFontConfig.chinese_font = font;
}

export function updateEnglishFont(font: string): void {
  currentFontConfig.english_font = font;
}

export function initFontSize(): void {
  currentFontSize = loadFontSizeFromStorage();

  if (fontSizeSlider) {
    fontSizeSlider.value = currentFontSize.toString();
  }
  if (fontSizeValue) {
    fontSizeValue.textContent = `${currentFontSize}px`;
  }

  applyFontSize();
}

export function updateFontSize(size: number): void {
  currentFontSize = size;
  applyFontSize();
  void saveFontSize(size);
}

export function applyFontSize(): void {
  if (!noteDisplay) return;

  noteDisplay.style.fontSize = `${currentFontSize}px`;
  logInfo(`已應用字體大小: ${currentFontSize}px`);
}

export function setupFontListeners(): void {
  chineseFontSelect?.addEventListener("change", async () => {
    if (!chineseFontSelect) return;

    currentFontConfig.chinese_font = chineseFontSelect.value;
    await saveFontConfig();
    applyFontConfig();
  });

  englishFontSelect?.addEventListener("change", async () => {
    if (!englishFontSelect) return;

    currentFontConfig.english_font = englishFontSelect.value;
    await saveFontConfig();
    applyFontConfig();
  });

  fontSizeSlider?.addEventListener("input", () => {
    if (!fontSizeSlider || !fontSizeValue) return;

    const size = Number.parseInt(fontSizeSlider.value, 10);
    currentFontSize = size;
    fontSizeValue.textContent = `${size}px`;
    applyFontSize();
    void saveFontSize(size);
  });
}

async function loadFontConfig(): Promise<void> {
  try {
    const config = await loadFontConfigAPI();
    currentFontConfig = config;

    if (chineseFontSelect) {
      chineseFontSelect.value = config.chinese_font;
    }
    if (englishFontSelect) {
      englishFontSelect.value = config.english_font;
    }

    applyFontConfig();
    logInfo("字體設定載入成功");
  } catch (error) {
    logError("載入字體設定失敗:", error);
  }
}

async function saveFontSize(size: number): Promise<void> {
  try {
    await saveFontSizeToStorage(size);
  } catch (error) {
    logError("儲存字體大小失敗:", error);
  }
}

function replaceFontOptions(select: HTMLSelectElement, fonts: string[]): void {
  const options = fonts.map((font) => new Option(font, font));
  select.replaceChildren(...options);
}

function cssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, " ");
}
