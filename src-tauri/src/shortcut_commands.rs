use upmemo::models::AppState;
use crate::tray;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[tauri::command]
pub fn register_shortcut(app: tauri::AppHandle, shortcut_str: String) -> Result<(), String> {
    unregister_current_shortcut(&app);

    let shortcut: Shortcut = shortcut_str
        .parse()
        .map_err(|error| format!("無效的快捷鍵: {:?}", error))?;

    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Released {
                tray::toggle_main_window(&app_clone);
            }
        })
        .map_err(|error| format!("無法註冊快捷鍵: {}", error))?;

    let state = app.state::<AppState>();
    let result = match state.current_shortcut.lock() {
        Ok(mut current) => {
            *current = Some(shortcut_str);
            Ok(())
        }
        Err(_) => Err("無法鎖定快捷鍵狀態".to_string()),
    };

    result
}

#[tauri::command]
pub fn unregister_shortcut(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let result = match state.current_shortcut.lock() {
        Ok(mut current) => {
            if let Some(shortcut_str) = current.as_ref() {
                let shortcut: Shortcut = shortcut_str
                    .parse()
                    .map_err(|error| format!("無效的快捷鍵: {:?}", error))?;
                app.global_shortcut()
                    .unregister(shortcut)
                    .map_err(|error| format!("無法取消註冊快捷鍵: {}", error))?;
                *current = None;
            }

            Ok(())
        }
        Err(_) => Err("無法鎖定快捷鍵狀態".to_string()),
    };

    result
}

fn unregister_current_shortcut(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let shortcut = match state.current_shortcut.lock() {
        Ok(current) => current
            .as_ref()
            .and_then(|shortcut_str| shortcut_str.parse::<Shortcut>().ok()),
        Err(_) => None,
    };

    if let Some(shortcut) = shortcut {
        let _ = app.global_shortcut().unregister(shortcut);
    }
}
