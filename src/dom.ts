function getRequiredElement<T extends HTMLElement>(
  id: string,
  elementClass: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementClass)) {
    throw new Error(`找不到必要元素: ${id}`);
  }

  return element;
}

function getOptionalElement<T extends HTMLElement>(
  id: string,
  elementClass: { new (): T },
): T | null {
  const element = document.getElementById(id);
  if (element === null) return null;
  if (!(element instanceof elementClass)) {
    throw new Error(`元素型別不符合預期: ${id}`);
  }

  return element;
}

export const noteDisplay = getRequiredElement("note-display", HTMLDivElement);
export const newMemoBtn = getOptionalElement("new-memo-btn", HTMLButtonElement);
export const historyBtn = getOptionalElement("history-btn", HTMLButtonElement);
export const archiveBtn = getOptionalElement("archive-btn", HTMLButtonElement);
export const trashBtn = getOptionalElement("trash-btn", HTMLButtonElement);
export const settingsBtn = getOptionalElement("settings-btn", HTMLButtonElement);
export const historyPanel = getOptionalElement("history-panel", HTMLDivElement);
export const archivePanel = getOptionalElement("archive-panel", HTMLDivElement);
export const trashPanel = getOptionalElement("trash-panel", HTMLDivElement);
export const settingsPanel = getOptionalElement("settings-panel", HTMLDivElement);
export const closeHistoryBtn = getOptionalElement("close-history-btn", HTMLButtonElement);
export const closeArchiveBtn = getOptionalElement("close-archive-btn", HTMLButtonElement);
export const closeTrashBtn = getOptionalElement("close-trash-btn", HTMLButtonElement);
export const closeSettingsBtn = getOptionalElement("close-settings-btn", HTMLButtonElement);
export const historyList = getOptionalElement("history-list", HTMLDivElement);
export const archiveList = getOptionalElement("archive-list", HTMLDivElement);
export const trashList = getOptionalElement("trash-list", HTMLDivElement);
export const emptyTrashBtn = getOptionalElement("empty-trash-btn", HTMLButtonElement);
export const shortcutInput = getOptionalElement("toggle-shortcut", HTMLInputElement);
export const resetShortcutBtn = getOptionalElement("reset-toggle-shortcut", HTMLButtonElement);
export const shortcutHint = getOptionalElement("shortcut-hint", HTMLSpanElement);
export const chineseFontSelect = getOptionalElement("chinese-font", HTMLSelectElement);
export const englishFontSelect = getOptionalElement("english-font", HTMLSelectElement);
export const fontSizeSlider = getOptionalElement("font-size", HTMLInputElement);
export const fontSizeValue = getOptionalElement("font-size-value", HTMLSpanElement);
export const opacitySlider = getOptionalElement("opacity", HTMLInputElement);
export const opacityValue = getOptionalElement("opacity-value", HTMLSpanElement);
