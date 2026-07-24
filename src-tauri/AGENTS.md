# TAURI KNOWLEDGE BASE

## OVERVIEW
`src-tauri/` 是 Rust/Tauri 邊界。手寫來源主要在 `src/*.rs`, `Cargo.toml`, `tauri.conf.json`；`gen/schemas` 是生成物，`icons` 是平台資產。

## STRUCTURE
```
src-tauri/
├── src/main.rs       # Tauri builder 入口；註冊 plugins/state/commands/tray
├── src/*_commands.rs # IPC commands 依責任拆分
├── src/storage.rs    # app_data_dir 與 JSON/文字檔存取
├── tauri.conf.json   # build/dev、window、capabilities、bundle icon
├── Cargo.toml        # Tauri/plugin/font-kit 依賴與 custom-protocol feature
├── build.rs          # Tauri build hook
├── gen/schemas/      # Tauri generated schemas；不要手改
└── icons/            # desktop/mobile/platform icon assets
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| IPC command | `src/*_commands.rs`, `src/main.rs` | command 定義在模組，`invoke_handler` 在 main 註冊 |
| 本機資料路徑 | `src/storage.rs` | `app_data_dir()` + 檔名 helper |
| 筆記資料流 | `src/note_commands.rs` | `load_note`, `save_note`, `save_note_to_history` |
| 歷史/垃圾桶/封存 | `src/collection_commands.rs` | JSON 檔讀寫 helper + command |
| 快捷鍵 | `src/shortcut_commands.rs` | `tauri_plugin_global_shortcut`, `register_shortcut` |
| 圖片預覽 | `src/preview_commands.rs` | `PreviewImageState` 暫存資料，給預覽視窗取用 |
| 系統 tray | `src/tray.rs` | show/quit menu、click show/hide 同步 |
| 視窗權限 | `tauri.conf.json` | `main`, `sticky_*`, `image-preview` capability |
| 依賴/feature | `Cargo.toml` | `tray-icon`, `custom-protocol`, plugins |
| schema 參考 | `gen/schemas/*.json` | 只拿來對照格式，不是來源 |

## CONVENTIONS
- 前端呼叫 Rust 只透過 Tauri `invoke`；command 名稱需與 `src/api.ts` 字串一致。
- command 錯誤多回 `Result<_, String>`；改錯誤文案時要留意前端是否顯示或比對。
- 資料檔以 `app_data_dir()` 派生路徑，JSON 用 `serde_json` 讀寫。
- `AppState` 目前有 `current_shortcut`, `current_memo_id`, `sticky_notes` 三個 Mutex 狀態；圖片預覽另用 `PreviewImageState`。
- `tauri.conf.json` 的 `beforeDevCommand`/`beforeBuildCommand` 會呼叫 npm scripts。
- `main` 視窗預設隱藏、frameless、always-on-top、transparent、skip taskbar。
- `image-preview` 是獨立 capability；圖片資料透過 `set_preview_image_data` / `take_preview_image_data` command 暫存與取出。

## COMMAND GROUPS
| Group | Commands |
|-------|----------|
| 快捷鍵 | `register_shortcut`, `unregister_shortcut` |
| 筆記 | `load_note`, `save_note`, `save_note_to_history`, `create_new_memo`, `get_current_memo_id` |
| 歷史 | `get_history`, `load_history_item`, `delete_history_item`, `archive_history_item` |
| 垃圾桶 | `get_trash`, `restore_from_trash`, `permanently_delete_trash_item`, `empty_trash` |
| 封存 | `get_archive`, `restore_from_archive`, `permanently_delete_archive_item` |
| 字體 | `get_system_fonts`, `load_font_config`, `save_font_config` |
| 圖片預覽 | `set_preview_image_data`, `take_preview_image_data` |
| 保留多視窗 | `create_sticky_note`, `get_all_sticky_notes`, `update_sticky_note`, `close_sticky_note`, `delete_sticky_note`, `toggle_all_sticky_notes` |

## ANTI-PATTERNS
- 不要刪 `main.rs` 第一行 Windows release console guard。
- 不要刪 `Cargo.toml` 的 `custom-protocol` feature 或 `DO NOT REMOVE` 註解。
- 不要手改 `gen/schemas`; 權限來源是 `tauri.conf.json`。
- 不要把已註解的 sticky restore/tray new window 當成啟用路徑；v0.1.2 是單主視窗狀態。
- 不要在持有 `sticky_notes` lock 時加入長時間或可重入的 window 操作。
- 不要把 `security.csp` 改回 `null`；目前已有明確 CSP，若加入遠端內容或更多 HTML 注入，需重新審查。

## VERIFICATION
```bash
npm run build
npm run rust:check
npm run rust:clippy
npm run tauri dev
npm run tauri -- build --bundles msi
```

改 `tauri.conf.json` 後要驗三種 window label：`main`, `sticky_*`, `image-preview`。改 command 後同步檢查 `src/api.ts` 或 `src/stickyNotes.ts` 的呼叫字串。
