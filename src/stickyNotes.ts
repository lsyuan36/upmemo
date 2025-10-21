// 便利貼 API 封裝
import { invoke } from "@tauri-apps/api/core";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface StickyNote {
  id: string;
  content: string;
  position: Position;
  size: Size;
  color: string;
  opacity: number;
  created_at: number;
  updated_at: number;
  is_visible: boolean;
}

/**
 * 創建新的便利貼視窗
 */
export async function createStickyNote(
  x?: number,
  y?: number,
  color?: string
): Promise<string> {
  return await invoke("create_sticky_note", { x, y, color });
}

/**
 * 獲取所有便利貼
 */
export async function getAllStickyNotes(): Promise<StickyNote[]> {
  return await invoke("get_all_sticky_notes");
}

/**
 * 更新便利貼資料
 */
export async function updateStickyNote(
  noteId: string,
  content?: string,
  position?: Position,
  size?: Size,
  color?: string,
  opacity?: number
): Promise<void> {
  return await invoke("update_sticky_note", {
    noteId,
    content,
    position,
    size,
    color,
    opacity,
  });
}

/**
 * 關閉便利貼視窗（但保留資料）
 */
export async function closeStickyNote(noteId: string): Promise<void> {
  return await invoke("close_sticky_note", { noteId });
}

/**
 * 刪除便利貼（包括資料和視窗）
 */
export async function deleteStickyNote(noteId: string): Promise<void> {
  return await invoke("delete_sticky_note", { noteId });
}

/**
 * 顯示/隱藏所有便利貼
 */
export async function toggleAllStickyNotes(visible: boolean): Promise<void> {
  return await invoke("toggle_all_sticky_notes", { visible });
}

/**
 * 獲取當前視窗的便利貼 ID
 */
export function getCurrentWindowLabel(): string {
  // 透過 window.__TAURI_INTERNALS__ 獲取當前視窗 label
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    return (window as any).__TAURI_INTERNALS__.metadata.currentWindow.label;
  }
  return "main";
}

/**
 * 判斷當前視窗是否為便利貼視窗
 */
export function isStickyNoteWindow(): boolean {
  const label = getCurrentWindowLabel();
  return label.startsWith("sticky_");
}
