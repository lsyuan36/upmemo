use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct PreviewImageState {
    image_data: Mutex<Option<String>>,
}

#[tauri::command]
pub fn set_preview_image_data(
    data: String,
    state: State<'_, PreviewImageState>,
) -> Result<(), String> {
    let mut image_data = state
        .image_data
        .lock()
        .map_err(|error| format!("無法鎖定預覽圖片資料: {error}"))?;
    image_data.replace(data);
    Ok(())
}

#[tauri::command]
pub fn take_preview_image_data(state: State<'_, PreviewImageState>) -> Result<String, String> {
    let mut image_data = state
        .image_data
        .lock()
        .map_err(|error| format!("無法鎖定預覽圖片資料: {error}"))?;
    image_data
        .take()
        .ok_or_else(|| "沒有可預覽的圖片資料".to_string())
}
