// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clock;
mod collection_commands;
mod font_commands;
mod note_commands;
mod preview_commands;
mod shortcut_commands;
mod storage;
mod tray;

use std::sync::Mutex;
use tauri::Manager;
use upmemo::memo_store::MemoStoreRepository;
use upmemo::models::AppState;

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            current_shortcut: Mutex::new(None),
            current_memo_id: Mutex::new(None),
        })
            .manage(preview_commands::PreviewImageState::default())
            .invoke_handler(tauri::generate_handler![
            note_commands::load_note,
            note_commands::save_note,
            note_commands::save_note_to_history,
            collection_commands::get_history,
            collection_commands::load_history_item,
            collection_commands::delete_history_item,
            collection_commands::get_trash,
            collection_commands::restore_from_trash,
            collection_commands::permanently_delete_trash_item,
            collection_commands::empty_trash,
            note_commands::clear_note,
            collection_commands::archive_history_item,
            collection_commands::get_archive,
            collection_commands::restore_from_archive,
            collection_commands::permanently_delete_archive_item,
            shortcut_commands::register_shortcut,
            shortcut_commands::unregister_shortcut,
            font_commands::load_font_config,
            font_commands::save_font_config,
            font_commands::get_system_fonts,
            note_commands::get_current_memo_id,
            note_commands::create_new_memo,
            preview_commands::set_preview_image_data,
            preview_commands::take_preview_image_data
            ])
                .setup(|app| {
                    let app_handle = app.handle();
                    if let Err(error) = storage::migrate_legacy_store(app_handle) {
                    eprintln!("legacy store migration failed: {}", error);
                }

                let memo_store_path = app.path().app_data_dir()?.join("memo_store.json");
                app.manage(MemoStoreRepository::open(memo_store_path)?);

            tray::setup_tray(app)?;
            tray::show_main_window(app.handle());

            let app_handle = app.handle().clone();
            let _ = shortcut_commands::register_shortcut(app_handle, "Ctrl+Down".to_string());

            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("Tauri 應用程式執行失敗: {}", error);
        std::process::exit(1);
    }
}
