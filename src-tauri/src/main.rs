// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, Emitter};
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

// 全域狀態：當前註冊的快捷鍵和當前便條 ID
struct AppState {
    current_shortcut: Mutex<Option<String>>,
    current_memo_id: Mutex<Option<String>>,
}

// 註冊全域快捷鍵
#[tauri::command]
fn register_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    // 先取消之前的快捷鍵
    let state = app.state::<AppState>();
    if let Ok(current) = state.current_shortcut.lock() {
        if let Some(old_shortcut_str) = current.as_ref() {
            if let Ok(old_shortcut) = old_shortcut_str.parse::<Shortcut>() {
                let _ = app.global_shortcut().unregister(old_shortcut);
            }
        }
    }

    // 解析並註冊新的快捷鍵
    let shortcut: Shortcut = shortcut_str.parse().map_err(|e| format!("無效的快捷鍵: {:?}", e))?;

    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut.clone(), move |_app, _shortcut, event| {
            // 只在按鍵釋放時觸發（避免重複觸發）
            if event.state == ShortcutState::Released {
                if let Some(window) = app_clone.get_webview_window("main") {
                    let _ = window.is_visible().map(|visible| {
                        if visible {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    });
                }
            }
        })
        .map_err(|e| format!("無法註冊快捷鍵: {}", e))?;

    // 儲存當前快捷鍵
    if let Ok(mut current) = state.current_shortcut.lock() {
        *current = Some(shortcut_str);
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

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_store::Builder::new().build())
    .manage(AppState {
      current_shortcut: Mutex::new(None),
      current_memo_id: Mutex::new(None),
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
      create_new_memo
    ])
    .setup(|app| {
      // 創建托盤選單
      let show_item = MenuItem::with_id(app, "show", "顯示便條", true, None::<&str>)?;
      let new_memo_item = MenuItem::with_id(app, "new_memo", "新增便條", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

      let menu = Menu::with_items(app, &[&show_item, &new_memo_item, &quit_item])?;

      // 創建系統托盤圖示
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id().as_ref() {
            "show" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.is_visible().map(|visible| {
                  if visible {
                    let _ = window.hide();
                  } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                  }
                });
              }
            }
            "new_memo" => {
              if let Some(window) = app.get_webview_window("main") {
                // 顯示視窗並觸發新增便條
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("tray-new-memo", ());
              }
            }
            "quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          // 左鍵點擊托盤圖示 -> 切換視窗顯示/隱藏
          if let tauri::tray::TrayIconEvent::Click { button, button_state, .. } = event {
            if button == MouseButton::Left && button_state == MouseButtonState::Up {
              let app = tray.app_handle();
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.is_visible().map(|visible| {
                  if visible {
                    let _ = window.hide();
                  } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                  }
                });
              }
            }
          }
        })
        .build(app)?;

      // 顯示視窗
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
