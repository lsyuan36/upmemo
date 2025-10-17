import { chineseFontSelect, englishFontSelect, fontSizeSlider, fontSizeValue, textarea } from "./dom";
import { getSystemFonts, loadFontConfig as loadFontConfigAPI, saveFontConfig as saveFontConfigAPI } from "./api";
import type { FontConfig } from "./types";
import { DEFAULT_FONT_SIZE } from "./constants";
import { loadFontSize as loadFontSizeFromStorage, saveFontSize as saveFontSizeToStorage } from "./storage";

let currentFontConfig: FontConfig = {
  chinese_font: "Microsoft JhengHei",
  english_font: "Segoe UI"
};

let currentFontSize: number = DEFAULT_FONT_SIZE;

export async function initFontSystem(): Promise<void> {
  try {
    const fonts = await getSystemFonts();
    console.log(`已載入 ${fonts.length} 個系統字體`);

    if (chineseFontSelect) {
      chineseFontSelect.innerHTML = fonts.map(font =>
        `<option value="${font}">${font}</option>`
      ).join("");
    }
    if (englishFontSelect) {
      englishFontSelect.innerHTML = fonts.map(font =>
        `<option value="${font}">${font}</option>`
      ).join("");
    }

    await loadFontConfig();

    // 初始化字體大小
    initFontSize();
  } catch (error) {
    console.error("載入系統字體失敗:", error);
  }
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
    console.log("字體設定載入成功");
  } catch (error) {
    console.error("載入字體設定失敗:", error);
  }
}

export async function saveFontConfig(): Promise<void> {
  try {
    await saveFontConfigAPI(currentFontConfig.chinese_font, currentFontConfig.english_font);
    console.log("字體設定儲存成功");
  } catch (error) {
    console.error("儲存字體設定失敗:", error);
  }
}

export function applyFontConfig(): void {
  if (textarea) {
    const oldStyle = document.getElementById('font-style');
    if (oldStyle) {
      oldStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'font-style';
    style.textContent = `
      #note-content {
        font-family: "${currentFontConfig.english_font}", sans-serif;
      }
      #note-content::placeholder {
        font-family: "${currentFontConfig.english_font}", sans-serif;
      }
      @supports (unicode-range: U+4E00-9FFF) {
        @font-face {
          font-family: 'CustomChinese';
          src: local("${currentFontConfig.chinese_font}");
          unicode-range: U+4E00-9FFF, U+3000-303F, U+FF00-FFEF;
        }
        #note-content {
          font-family: 'CustomChinese', "${currentFontConfig.english_font}", sans-serif;
        }
      }
    `;
    document.head.appendChild(style);

    console.log(`已應用字體 - 中文: ${currentFontConfig.chinese_font}, 英文: ${currentFontConfig.english_font}`);
  }
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
  saveFontSizeToStorage(size);
}

export function applyFontSize(): void {
  if (textarea) {
    textarea.style.fontSize = `${currentFontSize}px`;
    console.log(`已應用字體大小: ${currentFontSize}px`);
  }
}

// 設置字體事件監聽器
export function setupFontListeners(): void {
  // 中文字體選擇事件
  chineseFontSelect?.addEventListener("change", async () => {
    if (chineseFontSelect) {
      currentFontConfig.chinese_font = chineseFontSelect.value;
      await saveFontConfig();
      applyFontConfig();
    }
  });

  // 英文字體選擇事件
  englishFontSelect?.addEventListener("change", async () => {
    if (englishFontSelect) {
      currentFontConfig.english_font = englishFontSelect.value;
      await saveFontConfig();
      applyFontConfig();
    }
  });

  // 字體大小滑桿事件
  fontSizeSlider?.addEventListener("input", () => {
    if (fontSizeSlider && fontSizeValue) {
      const size = parseInt(fontSizeSlider.value);
      currentFontSize = size;
      fontSizeValue.textContent = `${size}px`;
      applyFontSize();
      saveFontSizeToStorage(size);
    }
  });
}
