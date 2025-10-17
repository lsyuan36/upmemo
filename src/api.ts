import { invoke } from "@tauri-apps/api/core";
import type { MemoEntry, FontConfig } from "./types";

// 後端 API 調用

// 筆記操作
export async function loadNote(): Promise<string> {
  return await invoke<string>("load_note");
}

export async function saveNote(content: string): Promise<void> {
  await invoke("save_note", { content });
}

export async function saveNoteToHistory(content: string): Promise<void> {
  await invoke("save_note_to_history", { content });
}

export async function createNewMemo(): Promise<string> {
  return await invoke<string>("create_new_memo");
}

// 歷史記錄操作
export async function getHistory(): Promise<MemoEntry[]> {
  return await invoke<MemoEntry[]>("get_history");
}

export async function loadHistoryItem(id: string): Promise<string> {
  return await invoke<string>("load_history_item", { id });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await invoke("delete_history_item", { id });
}

export async function archiveHistoryItem(id: string): Promise<void> {
  await invoke("archive_history_item", { id });
}

// 封存操作
export async function getArchive(): Promise<MemoEntry[]> {
  return await invoke<MemoEntry[]>("get_archive");
}

export async function restoreFromArchive(id: string): Promise<void> {
  await invoke("restore_from_archive", { id });
}

export async function permanentlyDeleteArchiveItem(id: string): Promise<void> {
  await invoke("permanently_delete_archive_item", { id });
}

// 垃圾桶操作
export async function getTrash(): Promise<MemoEntry[]> {
  return await invoke<MemoEntry[]>("get_trash");
}

export async function restoreFromTrash(id: string): Promise<void> {
  await invoke("restore_from_trash", { id });
}

export async function permanentlyDeleteTrashItem(id: string): Promise<void> {
  await invoke("permanently_delete_trash_item", { id });
}

export async function emptyTrash(): Promise<void> {
  await invoke("empty_trash");
}

// 字體操作
export async function getSystemFonts(): Promise<string[]> {
  return await invoke<string[]>("get_system_fonts");
}

export async function loadFontConfig(): Promise<FontConfig> {
  return await invoke<FontConfig>("load_font_config");
}

export async function saveFontConfig(chineseFont: string, englishFont: string): Promise<void> {
  await invoke("save_font_config", { chineseFont, englishFont });
}

// 快捷鍵操作
export async function registerShortcut(shortcutStr: string): Promise<void> {
  await invoke("register_shortcut", { shortcutStr });
}
