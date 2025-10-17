import { settingsPanel, settingsBtn, closeSettingsBtn } from "./dom";

// 顯示設定面板
export function showSettings(): void {
  settingsPanel?.classList.remove("hidden");
}

// 隱藏設定面板
export function hideSettings(): void {
  settingsPanel?.classList.add("hidden");
}

// 設置設定監聽器
export function setupSettingsListeners(): void {
  settingsBtn?.addEventListener("click", () => {
    showSettings();
  });

  closeSettingsBtn?.addEventListener("click", () => {
    hideSettings();
  });
}
