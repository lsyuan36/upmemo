use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone, Eq, PartialEq)]
pub struct MemoEntry {
    pub id: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FontConfig {
    pub chinese_font: String,
    pub english_font: String,
}

pub struct AppState {
    pub current_shortcut: Mutex<Option<String>>,
    pub current_memo_id: Mutex<Option<String>>,
}
