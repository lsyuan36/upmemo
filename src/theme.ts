import { COLOR_THEMES, DEFAULT_COLOR } from "./constants";
import { loadColorTheme, saveColorTheme as saveColorThemeToStorage, loadOpacity as loadOpacityFromStorage, saveOpacity as saveOpacityToStorage } from "./storage";
import { opacitySlider, opacityValue } from "./dom";
import { hexToRgba } from "./utils";
import { logError, logInfo } from "./logger";

let currentColor: string = DEFAULT_COLOR;
let currentOpacity: number = 100;

export function getCurrentColor(): string {
  return currentColor;
}

export function getCurrentOpacity(): number {
  return currentOpacity;
}

export function setCurrentOpacity(opacity: number): void {
  currentOpacity = opacity;
}

export function initTheme(): void {
  currentColor = loadColorTheme();
  currentOpacity = loadOpacityFromStorage();

  // 設置透明度滑桿
  if (opacitySlider) {
    opacitySlider.value = currentOpacity.toString();
  }
  if (opacityValue) {
    opacityValue.textContent = `${currentOpacity}%`;
  }

  applyColorTheme(currentColor);
}

export function saveAndApplyColorTheme(color: string): void {
  applyColorTheme(color);
  void saveColorThemeToStorage(color).catch((error: unknown) => {
    logError("儲存配色失敗:", error);
  });
}

export function applyColorTheme(color: string): void {
  const theme = COLOR_THEMES[color];
  if (!theme) return;

  currentColor = color;

  // 更新控制列的背景
  const controlBar = document.querySelector<HTMLElement>(".control-bar");
  if (controlBar) {
    controlBar.style.background = theme.headerBg;
    controlBar.style.borderBottomColor = theme.border;
  }

  // 更新其他面板的背景
  const historyPanel = document.querySelector<HTMLElement>(".history-panel");
  const archivePanel = document.querySelector<HTMLElement>(".archive-panel");
  const trashPanel = document.querySelector<HTMLElement>(".trash-panel");
  const settingsPanel = document.querySelector<HTMLElement>(".settings-panel");

  if (historyPanel) historyPanel.style.backgroundColor = theme.bg;
  if (archivePanel) archivePanel.style.backgroundColor = theme.bg;
  if (trashPanel) trashPanel.style.backgroundColor = theme.bg;
  if (settingsPanel) settingsPanel.style.backgroundColor = theme.bg;

  // 更新標題列
  const headers = document.querySelectorAll<HTMLElement>(".history-header, .archive-header, .trash-header, .settings-header");
  headers.forEach((header) => {
    header.style.background = theme.headerBg;
    header.style.borderBottomColor = theme.border;
  });

  // 更新按鈕的 active 狀態
  document.querySelectorAll<HTMLElement>(".color-option").forEach((btn) => {
    if (btn.dataset["color"] === color) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 應用透明度
  applyOpacity();

  logInfo(`已應用配色: ${theme.name}`);
}

export function applyOpacity(): void {
  const alpha = currentOpacity / 100;
  const theme = COLOR_THEMES[currentColor];
  if (!theme) return;

  const container = document.querySelector<HTMLElement>('.container');
  if (container) {
    container.style.backgroundColor = hexToRgba(theme.bg, alpha);
  }

  logInfo(`已應用透明度: ${currentOpacity}%`);
}

// 設置配色和透明度事件監聽器
export function setupColorListeners(): void {
  // 配色選擇事件
  document.querySelectorAll(".color-option").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const color =
        e.target instanceof HTMLElement ? e.target.dataset["color"] : undefined;
      if (color) {
        saveAndApplyColorTheme(color);
      }
    });
  });

  // 透明度滑桿事件
  opacitySlider?.addEventListener("input", () => {
    if (opacitySlider && opacityValue) {
      const opacity = parseInt(opacitySlider.value);
      currentOpacity = opacity;
      opacityValue.textContent = `${opacity}%`;
      applyOpacity();
      void saveOpacityToStorage(opacity).catch((error: unknown) => {
        logError("儲存透明度失敗:", error);
      });
    }
  });
}
