use crate::clock::get_timestamp;
use upmemo::models::AppState;
use tauri::Manager;

use upmemo::memo_store::{MemoStoreError, MemoStoreRepository};
use upmemo::models::MemoEntry;

#[tauri::command]
pub fn load_note(app_handle: tauri::AppHandle) -> Result<String, String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .snapshot()
        .map(|store| store.current_content)
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn save_note(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            store.current_content = content.clone();
            Ok(())
        })
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn save_note_to_history(app_handle: tauri::AppHandle, content: String) -> Result<(), String> {
    let state = app_handle.state::<AppState>();
    let memo_id = match state.current_memo_id.lock() {
        Ok(mut current_id) => {
            if let Some(current_id) = current_id.as_ref() {
                current_id.clone()
            } else {
                let new_id = get_timestamp().to_string();
                *current_id = Some(new_id.clone());
                new_id
            }
        }
        Err(_) => return Err("無法鎖定當前便條狀態".to_string()),
    };

    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            store.current_content = content.clone();
            store.current_memo_id = Some(memo_id.clone());

            if !content.trim().is_empty() {
                update_or_save_to_history_with_id(store, memo_id, &content)?;
            }

            Ok(())
        })
        .map_err(map_memo_store_error)?;

    Ok(())
}

#[tauri::command]
pub fn get_current_memo_id(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let state = app.state::<AppState>();
    let result = match state.current_memo_id.lock() {
        Ok(current_id) => Ok(current_id.clone()),
        Err(_) => Err("無法鎖定當前便條狀態".to_string()),
    };

    result
}

#[tauri::command]
pub fn create_new_memo(app: tauri::AppHandle) -> Result<String, String> {
    let new_id = get_timestamp().to_string();
    let repository = app.state::<MemoStoreRepository>();

    let state = app.state::<AppState>();
    match state.current_memo_id.lock() {
        Ok(mut current_id) => {
            *current_id = Some(new_id.clone());
        }
        Err(_) => return Err("無法鎖定當前便條狀態".to_string()),
    }

    repository
        .transact(|store| {
            store.current_memo_id = Some(new_id.clone());
            store.current_content = String::new();
            Ok(())
        })
        .map_err(map_memo_store_error)?;

    Ok(new_id)
}

#[tauri::command]
pub fn clear_note(app_handle: tauri::AppHandle) -> Result<(), String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            store.current_content = String::new();
            Ok(())
        })
        .map_err(map_memo_store_error)
}

fn update_or_save_to_history_with_id(
    store: &mut upmemo::memo_store::MemoStoreV2,
    memo_id: String,
    content: &str,
) -> Result<(), MemoStoreError> {
    let current_time = get_timestamp();
    let content = content.to_string();

    if let Some(existing_entry) = store.history.iter_mut().find(|entry| entry.id == memo_id) {
        existing_entry.content = content.clone();
        existing_entry.timestamp = current_time;
    } else {
        store.history.insert(
            0,
            MemoEntry {
                id: memo_id,
                content,
                timestamp: current_time,
            },
        );
    }

    Ok(())
}

fn map_memo_store_error(error: MemoStoreError) -> String {
    format!("memo_store 操作失敗: {error}")
}
