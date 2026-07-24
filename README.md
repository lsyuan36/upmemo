# UpMemo

UpMemo 是一個以 Tauri v2 製作的桌面便條工具。現行版本以單一主視窗為主要工作流，支援本機自動儲存、歷史/封存/垃圾桶、配色與字體設定、全域快捷鍵、圖片插入與全螢幕圖片預覽。

## 目前狀態

- 主應用是 Tauri v2 + Vite + TypeScript，前端使用原生 DOM，不使用 React。
- 多便利貼視窗功能目前仍停用；相關前端封裝、Rust commands 與 `sticky_*` capability 保留作為相容 API 與後續恢復基礎。
- 圖片預覽使用獨立 `image-preview` Tauri 視窗；主視窗先把圖片資料寫入 Rust 記憶體狀態，預覽頁再透過 command 取出，避免跨視窗 event race。
- `src-tauri/gen/schemas/*` 是 Tauri 工具產生的 schema，不要手動編輯；來源是 `src-tauri/tauri.conf.json` 與目前安裝的 Tauri 套件版本。
- `package-lock.json` 與 `src-tauri/Cargo.lock` 應跟版本一起提交，用來鎖定前端與 Rust/Tauri 依賴。

## 功能

- 主視窗便條編輯與自動儲存
- 歷史記錄、封存與垃圾桶
- 配色、透明度、中文字體/英文字體與字體大小設定
- 全域快捷鍵，預設 `Ctrl+Down`
- 系統托盤顯示/隱藏與退出
- 網址自動轉換為連結，支援 `http://`、`https://` 與 `www.`
- 圖片貼上、拖放、縮放、選取、刪除與持久化
- 雙擊圖片開啟全螢幕預覽，支援 `Ctrl + 滾輪` 縮放與 `Esc` 關閉

## 圖片功能

支援從剪貼簿貼上圖片與拖放圖片到編輯區。

- 貼上圖片：在編輯區使用 `Ctrl+V` 或 `Cmd+V`，單張上限 5MB。
- 拖放圖片：從檔案總管拖放 PNG/JPEG/GIF 到編輯區，單檔上限 10MB。
- 壓縮規則：JPEG 品質 0.85；大型 PNG 會保留透明度並縮放最長邊至 1600px；GIF 保留原始資料。
- 圖片縮放：滑到圖片上會顯示右下角縮放點，可拖曳調整寬度。
- 圖片刪除：點選圖片容器後按 `Delete` 或 `Backspace`。
- 圖片預覽：雙擊圖片，或點選圖片後按 `Enter`/`Space`，開啟全螢幕預覽；背景點擊或 `Esc` 關閉。

## 開發環境

- Node.js 20+ 建議
- Rust stable
- Windows / macOS / Linux；目前主要驗證環境是 Windows

安裝依賴：

```bash
npm install
```

啟動前端開發伺服器：

```bash
npm run dev
```

啟動 Tauri 開發模式：

```bash
npm run tauri dev
```

## 品質檢查

| 指令 | 說明 |
| --- | --- |
| `npm run typecheck` | 執行 TypeScript 型別檢查 |
| `npm run build` | 執行 TypeScript 檢查並建置 Vite 前端 |
| `npm run rust:check` | 執行 Rust 編譯檢查 |
| `npm run rust:clippy` | 執行 Rust clippy，warning 會視為錯誤 |
| `npm run format:rust` | 格式化 Rust 程式碼 |
| `npm run check` | 執行測試、前端 build、Rust check、Rust clippy 與 npm audit |

## 維護規則

- `AGENTS.md`、`src/AGENTS.md`、`src-tauri/AGENTS.md` 是專案協作規則檔；更新規則時應讓它們留在版本控管可見範圍內。
- 升級 Tauri 或 capability 設定後，使用 `npm run tauri build` 或 Tauri CLI 流程同步 `src-tauri/gen/schemas/*`，不要直接手改 schema。
- 升級 npm 或 Cargo 依賴時，同步提交 `package-lock.json` 與 `src-tauri/Cargo.lock`。

## 建置

建置完整桌面應用：

```bash
npm run tauri build
```

主要輸出位置：

- `src-tauri/target/release/upmemo.exe`
- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`

`dist/`、`node_modules/` 與 `src-tauri/target/` 是建置輸出或本機依賴目錄，已由 `.gitignore` 忽略。

## 專案結構

```text
upmemo/
├── src/
│   ├── main.ts                # 主視窗初始化與自動儲存流程
│   ├── dom.ts                 # 型別化 DOM 入口
│   ├── image.ts               # 圖片事件協調
│   ├── imageEncoding.ts       # 圖片壓縮與 Data URL 轉換
│   ├── imagePreview.ts        # 建立圖片預覽視窗
│   ├── imageResize.ts         # 圖片縮放 UI
│   ├── preview.ts             # 圖片預覽頁面邏輯
│   ├── linkify.ts             # 網址轉換與游標保留
│   └── logger.ts              # 前端 logging 入口
├── src-tauri/
│   ├── tauri.conf.json        # Tauri window/capability 來源
│   ├── gen/schemas/           # Tauri 產生的 schema，不手動編輯
│   └── src/
│       ├── main.rs            # Tauri builder 入口
│       ├── models.rs          # 共用資料模型
│       ├── storage.rs         # 檔案與 JSON 存取
│       ├── note_commands.rs   # 便條 commands
│       ├── collection_commands.rs
│       ├── font_commands.rs
│       ├── preview_commands.rs # 圖片預覽暫存狀態 commands
│       ├── shortcut_commands.rs
│       ├── sticky_commands.rs # 保留的 sticky API
│       └── tray.rs            # 系統托盤與顯示切換
├── package.json
├── package-lock.json
└── vite.config.ts
```

## 多視窗與 sticky API

v0.1.2 起，多便利貼視窗工作流暫時停用，主流程回到單一主視窗。為了避免破壞既有資料與後續恢復路徑，以下項目仍保留：

- `src/stickyNotes.ts`
- `src-tauri/src/sticky_commands.rs`
- `sticky-note-capability`
- `sticky_*` window label 規則

目前不要把這些保留 API 視為完整啟用的多視窗功能。

## 授權

MIT
