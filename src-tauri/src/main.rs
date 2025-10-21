// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use font_kit::source::SystemSource;

#[derive(Serialize, Deserialize, Clone)]
struct MemoEntry {
    id: String,
    content: String,
    timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone)]
struct FontConfig {
    chinese_font: String,
    english_font: String,
}

// 便利貼資料結構
#[derive(Serialize, Deserialize, Clone, Debug)]
struct StickyNote {
    id: String,              // 唯一識別碼
    content: String,         // 便利貼內容
    position: Position,      // 視窗位置
    size: Size,              // 視窗大小
    color: String,           // 配色主題
    opacity: u32,            // 透明度 (0-100)
    created_at: u64,         // 建立時間戳
    updated_at: u64,         // 最後更新時間戳
    is_visible: bool,        // 視窗是否可見
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Position {
    x: i32,
    y: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Size {
    width: u32,
    height: u32,
}

// 全域狀態：當前註冊的快捷鍵、當前便條 ID 和所有便利貼
struct AppState {
    current_shortcut: Mutex<Option<String>>,
    current_memo_id: Mutex<Option<String>>,
    sticky_notes: Mutex<std::collections::HashMap<String, StickyNote>>, // ID -> StickyNote 映射
}

// 註冊全域快捷鍵
#[tauri::command]
fn register_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    // 先取消之前的快捷鍵
    {
        let state = app.state::<AppState>();
        if let Ok(current) = state.current_shortcut.lock() {
            if let Some(old_shortcut_str) = current.as_ref() {
                if let Ok(old_shortcut) = old_shortcut_str.parse::<Shortcut>() {
                    let _ = app.global_shortcut().unregister(old_shortcut);
                }
            }
        };
    }

    // 解析並註冊新的快捷鍵
    let shortcut: Shortcut = shortcut_str.parse().map_err(|e| format!("無效的快捷鍵: {:?}", e))?;

    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
            // 只在按鍵釋放時觸發（避免重複觸發）
            if event.state == ShortcutState::Released {
                // 檢查主視窗的可見狀態作為參考
                let should_hide = if let Some(main_window) = app_clone.get_webview_window("main") {
                    main_window.is_visible().unwrap_or(false)
                } else {
                    false
                };

                // 切換主視窗
                if let Some(main_window) = app_clone.get_webview_window("main") {
                    if should_hide {
                        let _ = main_window.hide();
                    } else {
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                    }
                }

                // 切換所有便利貼視窗
                {
                    let state = app_clone.state::<AppState>();
                    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
                        let note_ids: Vec<String> = sticky_notes.keys().cloned().collect();

                        for note_id in note_ids {
                            if let Some(window) = app_clone.get_webview_window(&note_id) {
                                if should_hide {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                }
                            }

                            // 更新可見狀態
                            if let Some(note) = sticky_notes.get_mut(&note_id) {
                                note.is_visible = !should_hide;
                            }
                        }
                    };
                }

                // 持久化便利貼狀態
                let _ = save_sticky_notes_from_state(&app_clone);
            }
        })
        .map_err(|e| format!("無法註冊快捷鍵: {}", e))?;

    // 儲存當前快捷鍵
    {
        let state = app.state::<AppState>();
        if let Ok(mut current) = state.current_shortcut.lock() {
            *current = Some(shortcut_str);
        };
    }

    Ok(())
}

// 取消註冊快捷鍵
#[tauri::command]
fn unregister_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    if let Ok(mut current) = state.current_shortcut.lock() {
        if let Some(shortcut_str) = current.as_ref() {
            let shortcut: Shortcut = shortcut_str.parse().map_err(|e| format!("無效的快捷鍵: {:?}", e))?;
            app.global_shortcut()
                .unregister(shortcut)
                .map_err(|e| format!("無法取消註冊快捷鍵: {}", e))?;
            *current = None;
        }
    }
    Ok(())
}

// 取得筆記檔案路徑
fn get_note_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    // 確保目錄存在
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("note.txt"))
}

// 取得歷史記錄檔案路徑
fn get_history_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("history.json"))
}

// 取得字體設定檔案路徑
fn get_font_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("font_config.json"))
}

// 取得垃圾桶檔案路徑
fn get_trash_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("trash.json"))
}

// 取得封存檔案路徑
fn get_archive_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("archive.json"))
}

// 取得便利貼資料檔案路徑
fn get_sticky_notes_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法取得應用程式資料目錄: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("無法建立資料目錄: {}", e))?;

    Ok(app_data_dir.join("sticky_notes.json"))
}

// 讀取所有便利貼資料（已停用多視窗功能，保留供未來使用）
#[allow(dead_code)]
fn read_sticky_notes(app_handle: &tauri::AppHandle) -> Result<HashMap<String, StickyNote>, String> {
    let notes_path = get_sticky_notes_path(app_handle)?;

    if notes_path.exists() {
        let content = fs::read_to_string(&notes_path)
            .map_err(|e| format!("無法讀取便利貼資料: {}", e))?;

        let notes: HashMap<String, StickyNote> = serde_json::from_str(&content)
            .unwrap_or_else(|_| HashMap::new());

        Ok(notes)
    } else {
        Ok(HashMap::new())
    }
}

// 寫入所有便利貼資料
fn write_sticky_notes(app_handle: &tauri::AppHandle, notes: &HashMap<String, StickyNote>) -> Result<(), String> {
    let notes_path = get_sticky_notes_path(app_handle)?;

    let json = serde_json::to_string_pretty(notes)
        .map_err(|e| format!("無法序列化便利貼資料: {}", e))?;

    fs::write(&notes_path, json)
        .map_err(|e| format!("無法寫入便利貼資料: {}", e))
}

// 載入所有便利貼到記憶體（已停用多視窗功能，保留供未來使用）
#[allow(dead_code)]
fn load_sticky_notes_to_state(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let notes = read_sticky_notes(app_handle)?;
    let state = app_handle.state::<AppState>();

    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
        *sticky_notes = notes;
    }

    Ok(())
}

// 從記憶體保存所有便利貼到檔案
fn save_sticky_notes_from_state(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<AppState>();

    let notes = if let Ok(sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.clone()
    } else {
        return Err("無法鎖定便利貼狀態".to_string());
    };

    write_sticky_notes(app_handle, &notes)
}

// 讀取歷史記錄
fn read_history(app_handle: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let history_path = get_history_path(app_handle)?;

    if history_path.exists() {
        let content = fs::read_to_string(&history_path)
            .map_err(|e| format!("無法讀取歷史記錄: {}", e))?;

        let entries: Vec<MemoEntry> = serde_json::from_str(&content)
            .unwrap_or_else(|_| Vec::new());

        Ok(entries)
    } else {
        Ok(Vec::new())
    }
}

// 寫入歷史記錄
fn write_history(app_handle: &tauri::AppHandle, entries: &Vec<MemoEntry>) -> Result<(), String> {
    let history_path = get_history_path(app_handle)?;

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("無法序列化歷史記錄: {}", e))?;

    fs::write(&history_path, json)
        .map_err(|e| format!("無法寫入歷史記錄: {}", e))
}

// 獲取當前時間戳
fn get_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

// 載入筆記
#[tauri::command]
fn load_note(app_handle: tauri::AppHandle) -> Result<String, String> {
    let note_path = get_note_path(&app_handle)?;

    if note_path.exists() {
        fs::read_to_string(&note_path)
            .map_err(|e| format!("無法讀取筆記: {}", e))
    } else {
        Ok(String::new())
    }
}

// 儲存筆記 (不自動保存到歷史)
#[tauri::command]
fn save_note(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let note_path = get_note_path(&app_handle)?;

    fs::write(&note_path, &content)
        .map_err(|e| format!("無法儲存筆記: {}", e))?;

    Ok(())
}

// 儲存筆記並保存/更新到歷史 (用於自動儲存)
#[tauri::command]
fn save_note_to_history(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    // 先保存當前筆記
    save_note(app_handle.clone(), content.clone())?;

    // 獲取當前便條 ID
    let state = app_handle.state::<AppState>();
    let current_id = if let Ok(id_lock) = state.current_memo_id.lock() {
        id_lock.clone()
    } else {
        None
    };

    // 如果沒有當前 ID，創建一個新的
    let memo_id = if let Some(id) = current_id {
        id
    } else {
        let new_id = format!("{}", get_timestamp());
        if let Ok(mut id_lock) = state.current_memo_id.lock() {
            *id_lock = Some(new_id.clone());
        }
        new_id
    };

    // 如果內容不為空，更新或保存到歷史記錄
    if !content.trim().is_empty() {
        update_or_save_to_history_with_id(&app_handle, memo_id, content)?;
    }

    Ok(())
}

// 使用指定的 ID 更新或保存到歷史記錄
fn update_or_save_to_history_with_id(app_handle: &tauri::AppHandle, memo_id: String, content: String) -> Result<(), String> {
    let mut entries = read_history(app_handle)?;
    let current_time = get_timestamp();

    // 查找是否已有相同 ID 的記錄
    if let Some(existing_entry) = entries.iter_mut().find(|e| e.id == memo_id) {
        // 更新現有記錄
        existing_entry.content = content;
        existing_entry.timestamp = current_time;
    } else {
        // 創建新的記錄
        let entry = MemoEntry {
            id: memo_id,
            content,
            timestamp: current_time,
        };

        // 添加到列表開頭
        entries.insert(0, entry);
    }

    // 限制最多保存 100 條記錄
    if entries.len() > 100 {
        entries.truncate(100);
    }

    write_history(app_handle, &entries)
}

// 獲取歷史記錄列表
#[tauri::command]
fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_history(&app_handle)
}

// 載入歷史記錄項目
#[tauri::command]
fn load_history_item(app_handle: tauri::AppHandle, id: String) -> Result<String, String> {
    let entries = read_history(&app_handle)?;

    // 找到對應的記錄
    let content = entries
        .iter()
        .find(|e| e.id == id)
        .map(|e| e.content.clone())
        .ok_or_else(|| "找不到該歷史記錄".to_string())?;

    // 更新當前便條 ID
    let state = app_handle.state::<AppState>();
    if let Ok(mut current_id) = state.current_memo_id.lock() {
        *current_id = Some(id);
    }

    Ok(content)
}

// 讀取垃圾桶
fn read_trash(app_handle: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let trash_path = get_trash_path(app_handle)?;

    if trash_path.exists() {
        let content = fs::read_to_string(&trash_path)
            .map_err(|e| format!("無法讀取垃圾桶: {}", e))?;

        let entries: Vec<MemoEntry> = serde_json::from_str(&content)
            .unwrap_or_else(|_| Vec::new());

        Ok(entries)
    } else {
        Ok(Vec::new())
    }
}

// 寫入垃圾桶
fn write_trash(app_handle: &tauri::AppHandle, entries: &Vec<MemoEntry>) -> Result<(), String> {
    let trash_path = get_trash_path(app_handle)?;

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("無法序列化垃圾桶: {}", e))?;

    fs::write(&trash_path, json)
        .map_err(|e| format!("無法寫入垃圾桶: {}", e))
}

// 讀取封存
fn read_archive(app_handle: &tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let archive_path = get_archive_path(app_handle)?;

    if archive_path.exists() {
        let content = fs::read_to_string(&archive_path)
            .map_err(|e| format!("無法讀取封存: {}", e))?;

        let entries: Vec<MemoEntry> = serde_json::from_str(&content)
            .unwrap_or_else(|_| Vec::new());

        Ok(entries)
    } else {
        Ok(Vec::new())
    }
}

// 寫入封存
fn write_archive(app_handle: &tauri::AppHandle, entries: &Vec<MemoEntry>) -> Result<(), String> {
    let archive_path = get_archive_path(app_handle)?;

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("無法序列化封存: {}", e))?;

    fs::write(&archive_path, json)
        .map_err(|e| format!("無法寫入封存: {}", e))
}

// 刪除歷史記錄項目 (移至垃圾桶)
#[tauri::command]
fn delete_history_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut entries = read_history(&app_handle)?;

    // 找到要刪除的項目
    let deleted_item = entries.iter().find(|e| e.id == id).cloned();

    if let Some(item) = deleted_item {
        // 從歷史記錄中移除
        entries.retain(|e| e.id != id);
        write_history(&app_handle, &entries)?;

        // 加入垃圾桶
        let mut trash = read_trash(&app_handle)?;
        trash.insert(0, item);

        // 限制垃圾桶最多 50 條
        if trash.len() > 50 {
            trash.truncate(50);
        }

        write_trash(&app_handle, &trash)?;
    }

    Ok(())
}

// 獲取垃圾桶列表
#[tauri::command]
fn get_trash(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_trash(&app_handle)
}

// 從垃圾桶還原
#[tauri::command]
fn restore_from_trash(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut trash = read_trash(&app_handle)?;

    // 找到要還原的項目
    let restored_item = trash.iter().find(|e| e.id == id).cloned();

    if let Some(item) = restored_item {
        // 從垃圾桶中移除
        trash.retain(|e| e.id != id);
        write_trash(&app_handle, &trash)?;

        // 加回歷史記錄
        let mut history = read_history(&app_handle)?;
        history.insert(0, item);
        write_history(&app_handle, &history)?;
    }

    Ok(())
}

// 永久刪除垃圾桶項目
#[tauri::command]
fn permanently_delete_trash_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut trash = read_trash(&app_handle)?;
    trash.retain(|e| e.id != id);
    write_trash(&app_handle, &trash)
}

// 清空垃圾桶
#[tauri::command]
fn empty_trash(app_handle: tauri::AppHandle) -> Result<(), String> {
    write_trash(&app_handle, &Vec::new())
}

// 清空當前筆記
#[tauri::command]
fn clear_note(app_handle: tauri::AppHandle) -> Result<(), String> {
    let note_path = get_note_path(&app_handle)?;

    fs::write(&note_path, "")
        .map_err(|e| format!("無法清空筆記: {}", e))
}

// 封存歷史記錄項目 (從歷史移至封存)
#[tauri::command]
fn archive_history_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut entries = read_history(&app_handle)?;

    // 找到要封存的項目
    let archived_item = entries.iter().find(|e| e.id == id).cloned();

    if let Some(item) = archived_item {
        // 從歷史記錄中移除
        entries.retain(|e| e.id != id);
        write_history(&app_handle, &entries)?;

        // 加入封存
        let mut archive = read_archive(&app_handle)?;
        archive.insert(0, item);

        write_archive(&app_handle, &archive)?;
    }

    Ok(())
}

// 獲取封存列表
#[tauri::command]
fn get_archive(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    read_archive(&app_handle)
}

// 從封存還原到歷史記錄
#[tauri::command]
fn restore_from_archive(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut archive = read_archive(&app_handle)?;

    // 找到要還原的項目
    let restored_item = archive.iter().find(|e| e.id == id).cloned();

    if let Some(item) = restored_item {
        // 從封存中移除
        archive.retain(|e| e.id != id);
        write_archive(&app_handle, &archive)?;

        // 加回歷史記錄
        let mut history = read_history(&app_handle)?;
        history.insert(0, item);
        write_history(&app_handle, &history)?;
    }

    Ok(())
}

// 從封存中永久刪除
#[tauri::command]
fn permanently_delete_archive_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let mut archive = read_archive(&app_handle)?;
    archive.retain(|e| e.id != id);
    write_archive(&app_handle, &archive)
}

// 載入字體設定
#[tauri::command]
fn load_font_config(app_handle: tauri::AppHandle) -> Result<FontConfig, String> {
    let config_path = get_font_config_path(&app_handle)?;

    if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("無法讀取字體設定: {}", e))?;

        serde_json::from_str(&content)
            .map_err(|e| format!("無法解析字體設定: {}", e))
    } else {
        // 返回預設設定
        Ok(FontConfig {
            chinese_font: "Microsoft JhengHei".to_string(),
            english_font: "Segoe UI".to_string(),
        })
    }
}

// 儲存字體設定
#[tauri::command]
fn save_font_config(app_handle: tauri::AppHandle, chinese_font: String, english_font: String) -> Result<(), String> {
    let config_path = get_font_config_path(&app_handle)?;

    let config = FontConfig {
        chinese_font,
        english_font,
    };

    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("無法序列化字體設定: {}", e))?;

    fs::write(&config_path, json)
        .map_err(|e| format!("無法寫入字體設定: {}", e))
}

// 獲取系統字體列表
#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    let fonts = source.all_families()
        .map_err(|e| format!("無法獲取系統字體: {}", e))?;

    let mut font_list: Vec<String> = fonts.into_iter().collect();
    font_list.sort();

    Ok(font_list)
}

// 獲取當前便條 ID
#[tauri::command]
fn get_current_memo_id(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let state = app.state::<AppState>();
    let result = if let Ok(current_id) = state.current_memo_id.lock() {
        Ok(current_id.clone())
    } else {
        Ok(None)
    };
    result
}

// 創建新便條 (生成新的 ID 並清空當前內容)
#[tauri::command]
fn create_new_memo(app: tauri::AppHandle) -> Result<String, String> {
    // 生成新的 ID
    let new_id = format!("{}", get_timestamp());

    // 更新全域狀態
    let state = app.state::<AppState>();
    if let Ok(mut current_id) = state.current_memo_id.lock() {
        *current_id = Some(new_id.clone());
    }

    // 清空當前筆記
    clear_note(app)?;

    Ok(new_id)
}

// 創建新的便利貼視窗
#[tauri::command]
fn create_sticky_note(
    app: tauri::AppHandle,
    x: Option<i32>,
    y: Option<i32>,
    color: Option<String>,
) -> Result<String, String> {
    // 生成新的 ID
    let note_id = format!("sticky_{}", get_timestamp());
    let current_time = get_timestamp();

    // 計算視窗位置（如果沒有指定，則使用預設位置加上偏移）
    let state = app.state::<AppState>();
    let note_count = if let Ok(sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.len()
    } else {
        0
    };

    let offset = (note_count as i32 * 30) % 300; // 每個新視窗偏移 30px，最多偏移 300px
    let position = Position {
        x: x.unwrap_or(100 + offset),
        y: y.unwrap_or(100 + offset),
    };

    // 建立新的便利貼資料
    let sticky_note = StickyNote {
        id: note_id.clone(),
        content: String::new(),
        position: position.clone(),
        size: Size {
            width: 350,
            height: 250,
        },
        color: color.unwrap_or_else(|| "yellow".to_string()),
        opacity: 100,
        created_at: current_time,
        updated_at: current_time,
        is_visible: true,
    };

    // 儲存到狀態
    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.insert(note_id.clone(), sticky_note.clone());
    }

    // 持久化到檔案
    save_sticky_notes_from_state(&app)?;

    // 創建新視窗
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    let window = WebviewWindowBuilder::new(
        &app,
        note_id.clone(),
        WebviewUrl::App("index.html".into())
    )
    .title(&format!("UpMemo - {}", note_id))
    .inner_size(sticky_note.size.width as f64, sticky_note.size.height as f64)
    .position(sticky_note.position.x as f64, sticky_note.position.y as f64)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .skip_taskbar(true)
    .drag_and_drop(true)
    .build()
    .map_err(|e| format!("無法創建視窗: {}", e))?;

    window.show().map_err(|e| format!("無法顯示視窗: {}", e))?;

    Ok(note_id)
}

// 獲取所有便利貼
#[tauri::command]
fn get_all_sticky_notes(app: tauri::AppHandle) -> Result<Vec<StickyNote>, String> {
    let state = app.state::<AppState>();

    let notes = if let Ok(sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.values().cloned().collect()
    } else {
        Vec::new()
    };

    Ok(notes)
}

// 更新便利貼資料
#[tauri::command]
fn update_sticky_note(
    app: tauri::AppHandle,
    note_id: String,
    content: Option<String>,
    position: Option<Position>,
    size: Option<Size>,
    color: Option<String>,
    opacity: Option<u32>,
) -> Result<(), String> {
    let state = app.state::<AppState>();

    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
        if let Some(note) = sticky_notes.get_mut(&note_id) {
            // 更新欄位
            if let Some(c) = content {
                note.content = c;
            }
            if let Some(p) = position {
                note.position = p;
            }
            if let Some(s) = size {
                note.size = s;
            }
            if let Some(col) = color {
                note.color = col;
            }
            if let Some(op) = opacity {
                note.opacity = op;
            }

            // 更新時間戳
            note.updated_at = get_timestamp();
        } else {
            return Err(format!("找不到便利貼: {}", note_id));
        }
    } else {
        return Err("無法鎖定便利貼狀態".to_string());
    }

    // 持久化到檔案
    save_sticky_notes_from_state(&app)?;

    Ok(())
}

// 關閉便利貼視窗（但保留資料）
#[tauri::command]
fn close_sticky_note(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    // 更新可見狀態
    let state = app.state::<AppState>();
    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
        if let Some(note) = sticky_notes.get_mut(&note_id) {
            note.is_visible = false;
        }
    }

    // 持久化到檔案
    save_sticky_notes_from_state(&app)?;

    // 關閉視窗
    if let Some(window) = app.get_webview_window(&note_id) {
        window.close().map_err(|e| format!("無法關閉視窗: {}", e))?;
    }

    Ok(())
}

// 刪除便利貼（包括資料和視窗）
#[tauri::command]
fn delete_sticky_note(app: tauri::AppHandle, note_id: String) -> Result<(), String> {
    // 從狀態中移除
    let state = app.state::<AppState>();
    if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.remove(&note_id);
    }

    // 持久化到檔案
    save_sticky_notes_from_state(&app)?;

    // 關閉視窗
    if let Some(window) = app.get_webview_window(&note_id) {
        window.close().map_err(|e| format!("無法關閉視窗: {}", e))?;
    }

    Ok(())
}

// 顯示/隱藏所有便利貼
#[tauri::command]
fn toggle_all_sticky_notes(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let state = app.state::<AppState>();

    // 獲取所有便利貼 ID
    let note_ids: Vec<String> = if let Ok(sticky_notes) = state.sticky_notes.lock() {
        sticky_notes.keys().cloned().collect()
    } else {
        return Err("無法鎖定便利貼狀態".to_string());
    };

    // 顯示或隱藏每個視窗
    for note_id in note_ids {
        if let Some(window) = app.get_webview_window(&note_id) {
            if visible {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                let _ = window.hide();
            }
        }

        // 更新可見狀態
        if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
            if let Some(note) = sticky_notes.get_mut(&note_id) {
                note.is_visible = visible;
            }
        }
    }

    // 持久化到檔案
    save_sticky_notes_from_state(&app)?;

    Ok(())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_shell::init())
    .manage(AppState {
      current_shortcut: Mutex::new(None),
      current_memo_id: Mutex::new(None),
      sticky_notes: Mutex::new(HashMap::new()),
    })
    .invoke_handler(tauri::generate_handler![
      load_note,
      save_note,
      save_note_to_history,
      get_history,
      load_history_item,
      delete_history_item,
      get_trash,
      restore_from_trash,
      permanently_delete_trash_item,
      empty_trash,
      clear_note,
      archive_history_item,
      get_archive,
      restore_from_archive,
      permanently_delete_archive_item,
      register_shortcut,
      unregister_shortcut,
      load_font_config,
      save_font_config,
      get_system_fonts,
      get_current_memo_id,
      create_new_memo,
      create_sticky_note,
      get_all_sticky_notes,
      update_sticky_note,
      close_sticky_note,
      delete_sticky_note,
      toggle_all_sticky_notes
    ])
    .setup(|app| {
      // 創建托盤選單
      let show_item = MenuItem::with_id(app, "show", "顯示便條", true, None::<&str>)?;
      // let new_sticky_window_item = MenuItem::with_id(app, "new_sticky_window", "新增便利貼視窗", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

      let menu = Menu::with_items(app, &[&show_item, /* &new_sticky_window_item, */ &quit_item])?;

      // 創建系統托盤圖示
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id().as_ref() {
            "show" => {
              // 檢查主視窗的可見狀態作為參考
              let should_hide = if let Some(main_window) = app.get_webview_window("main") {
                main_window.is_visible().unwrap_or(false)
              } else {
                false
              };

              // 切換主視窗
              if let Some(main_window) = app.get_webview_window("main") {
                if should_hide {
                  let _ = main_window.hide();
                } else {
                  let _ = main_window.show();
                  let _ = main_window.set_focus();
                }
              }

              // 切換所有便利貼視窗
              {
                let state = app.state::<AppState>();
                if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
                  let note_ids: Vec<String> = sticky_notes.keys().cloned().collect();

                  for note_id in note_ids {
                    if let Some(window) = app.get_webview_window(&note_id) {
                      if should_hide {
                        let _ = window.hide();
                      } else {
                        let _ = window.show();
                      }
                    }

                    // 更新可見狀態
                    if let Some(note) = sticky_notes.get_mut(&note_id) {
                      note.is_visible = !should_hide;
                    }
                  }
                };
              }

              // 持久化便利貼狀態
              let _ = save_sticky_notes_from_state(app);
            }
            // "new_sticky_window" => {
            //   if let Some(window) = app.get_webview_window("main") {
            //     // 顯示主視窗並觸發新增便利貼視窗事件
            //     let _ = window.show();
            //     let _ = window.set_focus();
            //     let _ = window.emit("tray-new-sticky-window", ());
            //   }
            // }
            "quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          // 左鍵點擊托盤圖示 -> 切換所有視窗顯示/隱藏
          if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
            if button == MouseButton::Left && button_state == MouseButtonState::Up {
              let app = tray.app_handle();

              // 檢查主視窗的可見狀態作為參考
              let should_hide = if let Some(main_window) = app.get_webview_window("main") {
                main_window.is_visible().unwrap_or(false)
              } else {
                false
              };

              // 切換主視窗
              if let Some(main_window) = app.get_webview_window("main") {
                if should_hide {
                  let _ = main_window.hide();
                } else {
                  let _ = main_window.show();
                  let _ = main_window.set_focus();
                }
              }

              // 切換所有便利貼視窗
              {
                let state = app.state::<AppState>();
                if let Ok(mut sticky_notes) = state.sticky_notes.lock() {
                  let note_ids: Vec<String> = sticky_notes.keys().cloned().collect();

                  for note_id in note_ids {
                    if let Some(window) = app.get_webview_window(&note_id) {
                      if should_hide {
                        let _ = window.hide();
                      } else {
                        let _ = window.show();
                      }
                    }

                    // 更新可見狀態
                    if let Some(note) = sticky_notes.get_mut(&note_id) {
                      note.is_visible = !should_hide;
                    }
                  }
                };
              }

              // 持久化便利貼狀態
              let _ = save_sticky_notes_from_state(app);
            }
          }
        })
        .build(app)?;

      // 載入便利貼資料（已停用多視窗功能）
      // let app_handle = app.handle().clone();
      // if let Err(e) = load_sticky_notes_to_state(&app_handle) {
      //   eprintln!("載入便利貼資料失敗: {}", e);
      // }

      // 恢復所有便利貼視窗（已停用多視窗功能）
      // let state = app_handle.state::<AppState>();
      // let notes_to_restore: Vec<StickyNote> = if let Ok(sticky_notes) = state.sticky_notes.lock() {
      //   sticky_notes.values().filter(|note| note.is_visible).cloned().collect()
      // } else {
      //   Vec::new()
      // };

      // for note in notes_to_restore {
      //   use tauri::WebviewWindowBuilder;
      //   use tauri::WebviewUrl;

      //   let _ = WebviewWindowBuilder::new(
      //     &app_handle,
      //     note.id.clone(),
      //     WebviewUrl::App("index.html".into())
      //   )
      //   .title(&format!("UpMemo - {}", note.id))
      //   .inner_size(note.size.width as f64, note.size.height as f64)
      //   .position(note.position.x as f64, note.position.y as f64)
      //   .decorations(false)
      //   .always_on_top(true)
      //   .transparent(true)
      //   .skip_taskbar(true)
      //   .drag_and_drop(true)
      //   .build()
      //   .and_then(|window| window.show());
      // }

      // 顯示主視窗
      let window = app.get_webview_window("main").unwrap();
      window.show().unwrap();

      // 註冊預設快捷鍵 (Ctrl+Down)
      let app_handle = app.handle().clone();
      let _ = register_shortcut(app_handle, "Ctrl+Down".to_string());

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
