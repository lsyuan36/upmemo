# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-03 10:58 Asia/Taipei
**Commit:** 07c1fd7
**Branch:** main

## OVERVIEW
UpMemo 是 Tauri v2 + Vite/TypeScript 的桌面便利貼。前端不是 React/Vue，而是 `contenteditable` + 原生 DOM 模組；後端已拆成多個 Rust command/storage/tray 模組，負責本機檔案、tray、快捷鍵、視窗與 IPC commands。

## STRUCTURE
```
upmemo/
├── src/              # Vite root；主視窗、圖片預覽視窗、DOM 模組
├── src-tauri/        # Rust/Tauri 邊界；config、commands、icons、schemas
├── change log/       # v0.1.1/v0.1.2 舊命名變更紀錄
├── change_log/       # v0.1.3 新命名變更紀錄
├── vite.config.ts    # root=src、port=1420、main/preview 多頁面 build
├── package.json      # npm scripts；含 test/typecheck/build/Rust/audit gates
└── README.md         # 使用說明、品質檢查、生成檔與多視窗狀態
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 啟動流程 | `src/main.ts`, `src/index.html` | 主視窗 bootstrap、store、linkify、自動儲存、listener |
| 前端 IPC | `src/api.ts` | 所有 `invoke(...)` wrapper 集中處 |
| 設定持久化 | `src/storage.ts`, `src/theme.ts`, `src/font.ts`, `src/shortcut.ts` | `settings.json` cache + Tauri Store |
| 內容/URL 處理 | `src/linkify.ts` | `contenteditable` 文字抽取、URL linkify、游標保留 |
| 圖片插入/預覽 | `src/image.ts`, `src/imagePreview.ts`, `src/preview.html`, `src/preview.ts` | Data URL 內嵌、拖放、縮放、`image-preview` 視窗；預覽資料走 Rust 暫存 command |
| 歷史/封存/垃圾桶 | `src/history.ts`, `src/archive.ts`, `src/trash.ts` | 三個面板模式相近，但 API 不同 |
| Tauri commands | `src-tauri/src/*_commands.rs`, `src-tauri/src/main.rs` | note/history/archive/trash/font/shortcut/sticky/preview commands 分模組註冊 |
| Tauri 權限/視窗 | `src-tauri/tauri.conf.json` | `main`, `sticky_*`, `image-preview` 三組 capability |
| 生成物/資產 | `src-tauri/gen/`, `src-tauri/icons/` | schema 與平台 icon；不要當手寫 source |
| 版本脈絡 | `change log/`, `change_log/` | 命名分裂；v0.1.2 記錄多視窗停用 |

## CODE MAP
LSP/codegraph 工具在本工作階段不可用；Refs 由 `rg`、imports、`invoke_handler` 與入口設定推估。

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `initializeApp` | bootstrap | `src/main.ts` | `index.html` entry | 初始化主視窗、store、內容、事件 |
| `api.ts` exports | IPC facade | `src/api.ts` | 6+ frontend modules | 前端到 Tauri command 的唯一薄層 |
| `initStore` + `load*/save*` | state/cache | `src/storage.ts` | main/theme/font/shortcut | 設定快取與 `@tauri-apps/plugin-store` |
| `linkifyText` / `extractPlainText` | content serializer | `src/linkify.ts` | main/history/image path | URL 轉連結、保留圖片 HTML |
| `setupImageListeners` | image workflow | `src/image.ts` | main | paste/drop/resize/delete/preview window |
| `preview.ts` globals | secondary page | `src/preview.ts` | `preview.html` | `image-preview` 視窗縮放與關閉 |
| `main()` | Tauri entry | `src-tauri/src/main.rs` | Tauri runtime | plugin、state、commands、tray |
| `#[tauri::command]` group | IPC backend | `src-tauri/src/*_commands.rs` | `src/api.ts`, `src/stickyNotes.ts` | note/history/archive/trash/font/shortcut/sticky/preview |
| `capabilities` | security config | `src-tauri/tauri.conf.json` | Tauri CLI | window label 與 permission 對應 |

## CONVENTIONS
- 全部對話、文件、註解脈絡以繁體中文為主；既有 log/錯誤訊息也多為中文。
- `vite.config.ts` 設 `root: "src"`，但 build input 是 `src/index.html` 與 `src/preview.html`；這是刻意的雙頁面配置。
- Dev server 固定 `http://localhost:1420` 且 `strictPort: true`，需與 `tauri.conf.json` 對齊。
- 前端 state 是「模組級變數 + DOM 同步 + Tauri Store」，不是 component state。
- `src/dom.ts` 集中查 DOM id；新增 HTML id 時同步檢查對應 export。
- linkify 延遲是 2 秒，且只有偵測到 URL 才改 `innerHTML`，避免干擾輸入和游標。
- 圖片以 Data URL 存進筆記內容；大量圖片會直接放大儲存字串。
- Rust 端錯誤多回 `Result<_, String>`，前端可能直接看字串。
- 圖片預覽資料由 `preview_commands.rs` 的 `PreviewImageState` 暫存；不要改回跨 webview event 傳圖。

## ANTI-PATTERNS (THIS PROJECT)
- 不要手改 `src-tauri/gen/schemas/*`；以 `tauri.conf.json` 為來源再讓工具生成/同步。
- 不要移除 `src-tauri/src/main.rs:1` 和 `src-tauri/Cargo.toml` 的 `DO NOT REMOVE` 行。
- 不要把 `src/stickyNotes.ts` 或 Rust sticky commands 當成完整啟用功能；v0.1.2 明確記錄多視窗暫停。
- 不要只改 `README.md` 判斷功能狀態；preview 視窗與停用多視窗脈絡在 changelog/code 中。
- 避免新增 `as any`、`@ts-ignore` 或未處理 promise；目前品質門檻會用 `tsc`/clippy/測試擋基本回歸。
- 避免把新 Rust command 直接塞回 `main.rs`；按責任新增或擴充 `*_commands.rs` / `storage.rs`。

## UNIQUE STYLES
- UI 是便條紙風格：`styles.css` + `theme.ts` runtime inline style，沒有 design token 或 UI library。
- Panel 顯示使用 `.hidden`；history/archive/trash/settings 都是 absolute overlay。
- 控制列使用 `data-tauri-drag-region` 與 frameless window 配合。
- `change log/` 與 `change_log/` 都存在；新增紀錄前先確認要不要統一命名。
- `.gitignore` 目前忽略所有 `AGENTS.md` 與根層 `/CLAUDE.md`；若要版本化階層指引需同步調整 ignore。

## COMMANDS
```bash
npm install
npm run test
npm run typecheck
npm run dev
npm run build
npm run rust:check
npm run rust:clippy
npm run check
npm run tauri dev
npm run tauri -- build --bundles msi
```

## NOTES
- `npm run test` 目前跑 `node:test`/`tsx` 回歸測試；`npm run check` 會串測試、前端 build、Rust check/clippy 與 npm audit。
- `npm run build` 是 `tsc && vite build`，只驗前端型別與 bundle；桌面 build 走 Tauri CLI，例如 `npm run tauri -- build --bundles msi`。
- Tauri dev/build 會先跑 `beforeDevCommand` / `beforeBuildCommand`，即回頭執行前端命令。
- `src-tauri/target`, `dist`, `node_modules` 是產物；`src-tauri/icons` 是平台資產集合。
