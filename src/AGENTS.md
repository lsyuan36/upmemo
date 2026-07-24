# FRONTEND KNOWLEDGE BASE

## OVERVIEW
`src/` 是 Vite root 與全部前端 source；架構是 TypeScript 原生 DOM 模組，不是 React component tree。

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 主視窗 DOM | `index.html` | `note-display`、控制列、四個 overlay panel |
| 主流程 | `main.ts` | 初始化 store、載入 note、linkify、自動儲存、listener |
| 後端橋接 | `api.ts` | `invoke` wrapper；新增 command 先從這裡接 |
| DOM refs | `dom.ts` | 集中 `getElementById`，多數模組共用 |
| 設定 cache | `storage.ts` | `Store.load("settings.json")` 後寫入模組級 cache |
| 主題/字體 | `theme.ts`, `font.ts` | runtime 改 inline style 或注入 `font-style` |
| 快捷鍵 UI | `shortcut.ts` | 前端字串格式和 Rust `register_shortcut` 對齊 |
| URL/HTML 序列化 | `linkify.ts` | `contenteditable`、換行、圖片 HTML、游標 |
| 圖片流程 | `image.ts` | paste/drop/resize/delete/double-click preview |
| 預覽視窗 | `imagePreview.ts`, `preview.html`, `preview.ts` | 主視窗建立 `image-preview`，圖片資料透過 Rust preview command 暫存/取出 |
| 列表面板 | `history.ts`, `archive.ts`, `trash.ts` | render + button listener 模式相近 |

## CONVENTIONS
- 模組 import 幾乎全用 `./xxx` 相對路徑；目前沒有 path alias。
- `index.html` 的元素 id 變更必須同步 `dom.ts` 與所有 listener 模組。
- `main.ts` 是總調度器；功能模組只輸出 `init*`、`setup*Listeners`、`show/hide` 類函式。
- 自動儲存用 `setTimeout` debounce；linkify 另有 2 秒 debounce。
- 儲存純文字時透過 `extractPlainText(noteDisplay)`，但圖片需保留 HTML/Data URL。
- `theme.ts` 直接操作 `.container`、panel/header inline style；CSS 與 runtime style 需一起查。
- `font.ts` 用 `<style id="font-style">` 覆寫 `.note-display` 字體，避免只改 CSS。
- `preview.ts` 與其他 TS 檔維持 TypeScript strict；目前沒有 formatter 強制統一。
- 圖片預覽支援雙擊、快速連點 fallback，以及選取圖片後 `Enter`/`Space`。

## ANTI-PATTERNS
- 不要把 `stickyNotes.ts` 當作啟用中的主流程；`main.ts` 已註解停用多視窗 import/event。
- 不要在輸入事件中無條件改 `innerHTML`；會破壞換行、游標與輸入體驗。
- 不要把圖片選取框狀態存進內容；`linkify.ts`/image 流程需移除 `selected`。
- 不要新增未封裝的 `invoke(...)` 到各 UI 模組；先補 `api.ts` wrapper。
- 不要假設 `noteDisplay` 一定存在後就可無防護操作；主流程已有缺元素早退。

## CODE MAP
| Symbol | Location | Role |
|--------|----------|------|
| `initializeApp` | `main.ts` | 前端啟動序列 |
| `loadNote/saveNoteToHistory/createNewMemo` | `api.ts` | 主筆記 IPC |
| `initStore` | `storage.ts` | settings cache 載入 |
| `linkifyText` | `linkify.ts` | URL 轉 `<a>` 與換行處理 |
| `setupImageListeners` | `image.ts` | paste/drop/resize/delete/preview |
| `showHistory/showArchive/showTrash` | `history.ts`, `archive.ts`, `trash.ts` | 三個資料面板 |

## VERIFICATION
```bash
npm run test
npm run typecheck
npm run build
```

手動檢查主視窗時，至少驗：輸入自動儲存、URL 2 秒後轉連結、圖片貼上/拖放、圖片預覽（雙擊或選取後 Enter）、history/archive/trash/settings 面板。
