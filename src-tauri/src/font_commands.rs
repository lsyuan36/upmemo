use upmemo::models::FontConfig;
use crate::storage;
use font_kit::source::SystemSource;

#[tauri::command]
pub fn load_font_config(app_handle: tauri::AppHandle) -> Result<FontConfig, String> {
    storage::read_font_config(&app_handle)
}

#[tauri::command]
pub fn save_font_config(
    app_handle: tauri::AppHandle,
    chinese_font: String,
    english_font: String,
) -> Result<(), String> {
    let config = FontConfig {
        chinese_font,
        english_font,
    };

    storage::write_font_config(&app_handle, &config)
}

#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    let fonts = source
        .all_families()
        .map_err(|error| format!("無法獲取系統字體: {}", error))?;

    let mut font_list: Vec<String> = fonts.into_iter().collect();
    font_list.sort();

    Ok(font_list)
}
