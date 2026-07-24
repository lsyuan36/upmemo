use upmemo::models::AppState;
use tauri::Manager;

use upmemo::memo_store::{MemoCollection, MemoStoreError, MemoStoreRepository};
use upmemo::models::MemoEntry;

#[tauri::command]
pub fn get_history(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .snapshot()
        .map(|store| store.history)
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn load_history_item(app_handle: tauri::AppHandle, id: String) -> Result<String, String> {
    let repository = app_handle.state::<MemoStoreRepository>();
    let store = repository
        .snapshot()
        .map_err(map_memo_store_error)?;

    let content = store
        .history
        .iter()
        .find(|entry| entry.id == id)
        .map(|entry| entry.content.clone())
        .ok_or_else(|| "找不到該歷史記錄".to_string())?;

    let state = app_handle.state::<AppState>();
    match state.current_memo_id.lock() {
        Ok(mut current_id) => {
            *current_id = Some(id);
        }
        Err(_) => return Err("無法鎖定當前便條狀態".to_string()),
    }

    Ok(content)
}

#[tauri::command]
pub fn delete_history_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    app_handle
        .state::<MemoStoreRepository>()
        .move_entry(&id, MemoCollection::History, MemoCollection::Trash)
        .map(|_| ())
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn archive_history_item(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    app_handle
        .state::<MemoStoreRepository>()
        .move_entry(&id, MemoCollection::History, MemoCollection::Archive)
        .map(|_| ())
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn get_trash(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .snapshot()
        .map(|store| store.trash)
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn restore_from_trash(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    app_handle
        .state::<MemoStoreRepository>()
        .move_entry(&id, MemoCollection::Trash, MemoCollection::History)
        .map(|_| ())
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn permanently_delete_trash_item(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            retain_without_id(&mut store.trash, &id);
            Ok(())
        })
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn empty_trash(app_handle: tauri::AppHandle) -> Result<(), String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            store.trash.clear();
            Ok(())
        })
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn get_archive(app_handle: tauri::AppHandle) -> Result<Vec<MemoEntry>, String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .snapshot()
        .map(|store| store.archive)
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn restore_from_archive(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    app_handle
        .state::<MemoStoreRepository>()
        .move_entry(&id, MemoCollection::Archive, MemoCollection::History)
        .map(|_| ())
        .map_err(map_memo_store_error)
}

#[tauri::command]
pub fn permanently_delete_archive_item(
    app_handle: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let repository = app_handle.state::<MemoStoreRepository>();

    repository
        .transact(|store| {
            retain_without_id(&mut store.archive, &id);
            Ok(())
        })
        .map_err(map_memo_store_error)
}

fn retain_without_id(entries: &mut Vec<MemoEntry>, id: &str) {
    entries.retain(|entry| entry.id != id);
}

fn map_memo_store_error(error: MemoStoreError) -> String {
    format!("memo_store 操作失敗: {error}")
}
