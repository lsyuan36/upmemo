# UpMemo

<div align="center">

一個輕量級的桌面便利貼應用程式

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)

</div>
 
## 圖片功能

支援從剪貼簿貼上圖片與拖放圖片至編輯區（`note-display`）。

- 貼上圖片
  - 在編輯區內按 `Ctrl+V`（或 `Cmd+V`）貼上剪貼簿圖片。
  - 單張貼上大小上限 5MB；超過會提示。
- 拖放插入
  - 從檔案總管拖放 PNG/JPEG/GIF 到編輯區即可插入。
  - 單檔上限 10MB；超過會提示。
- 影像壓縮與縮放
  - 貼上與拖放會自動壓縮以降低儲存大小：
    - JPEG：品質 0.85。
    - PNG：保留透明，最長邊自動縮放至 1600px（若原圖較大）。
    - GIF：保留原始資料避免破壞動畫。
- 圖片縮放
  - 滑到圖片上會顯示右下角圓形縮放點，拖曳可調整寬度（50px 到編輯區寬度）。
- 選取與刪除
  - 點選圖片容器會出現藍色外框表示選取。
  - 按 `Delete` 或 `Backspace` 可刪除選取的圖片。
- 持久化
  - 圖片以 Data URL 內嵌保存，重新開啟或切換視窗後仍可顯示。
- 注意事項
  - 大量圖片會使內容字串增大，可能影響載入/保存效能。
  - 桌面版已啟用視窗拖放（`tauri.conf.json` 的 `dragDropEnabled: true`）。

## 📝 專案簡介

UpMemo 是一個使用 Tauri v2 開發的桌面便利貼應用程式。它提供一個小巧、始終置頂的無邊框視窗，模擬真實便利貼的外觀和使用體驗。

### ✨ 特色功能

- 🎯 **始終置頂** - 永遠顯示在所有視窗最上層
- 🖼️ **無邊框設計** - 簡潔的便利貼外觀
- 💾 **自動儲存** - 即時保存你的筆記內容
- 🎨 **經典黃色** - 模擬真實便利貼的視覺效果
- ⚡ **輕量快速** - 使用 Rust 和 Tauri 打造，性能優異
- 🔒 **隱私優先** - 所有資料儲存在本機

## 🛠️ 技術堆疊

- **前端**: TypeScript + Vite + Vanilla JavaScript
- **後端**: Rust + Tauri v2.0.0-beta
- **UI**: 簡潔的 textarea 介面

## 📦 安裝與使用

### 系統需求

- Node.js 16+
- Rust 1.70+
- 作業系統: Windows / macOS / Linux

### 開發環境設定

1. **克隆專案**
   ```bash
   git clone https://github.com/yourusername/upmemo.git
   cd upmemo
   ```

2. **安裝依賴**
   ```bash
   npm install
   ```

3. **啟動開發模式**
   ```bash
   npm run tauri dev
   ```

### 建置應用程式

建置生產環境版本：

```bash
npm run build
```

建置完成的執行檔將位於 `src-tauri/target/release/bundle/` 目錄下。

## 🎮 使用說明

1. 啟動應用程式後，便利貼視窗會出現在螢幕上
2. 直接在黃色便利貼區域輸入文字
3. 內容會自動儲存，無需手動操作
4. 便利貼始終保持在所有視窗最上層

## 🔧 開發指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動 Vite 開發伺服器 |
| `npm run build` | 建置前端程式碼 |
| `npm run tauri dev` | 啟動 Tauri 開發模式 |
| `npm run tauri build` | 建置完整應用程式 |

## 📁 專案結構

```
upmemo/
├── src/                    # 前端程式碼
│   ├── main.ts            # 主要邏輯
│   ├── index.html         # HTML 模板
│   └── styles.css         # 樣式表
├── src-tauri/             # Tauri 後端程式碼
│   ├── src/
│   │   └── main.rs        # Rust 主程式
│   ├── Cargo.toml         # Rust 依賴配置
│   └── tauri.conf.json    # Tauri 配置檔
├── package.json           # Node.js 依賴配置
└── vite.config.ts         # Vite 配置檔
```

## 🎨 視窗配置

- **尺寸**: 300x250 像素
- **邊框**: 無邊框 (frameless)
- **置頂**: 始終置頂 (alwaysOnTop)
- **透明**: 支援背景透明
- **工作列**: 不顯示在工作列

## 🚀 未來規劃

- [ ] 多便利貼支援
- [ ] 自訂顏色主題
- [ ] 便利貼位置記憶
- [ ] 快捷鍵支援
- [ ] 便利貼分類管理
- [ ] 雲端同步功能
- [ ] 提醒通知功能

## 🤝 貢獻指南

歡迎提交 Issue 和 Pull Request！

1. Fork 本專案
2. 建立你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

## 📄 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 文件

## 👤 作者

**Your Name**

- GitHub: [@lsyuan.36](https://github.com/lsyuan36)

## 🙏 致謝

- [Tauri](https://tauri.app/) - 提供優秀的跨平台應用框架
- [Vite](https://vitejs.dev/) - 快速的前端建置工具

---

<div align="center">
如果這個專案對你有幫助，請給個 ⭐️ 支持一下！
</div>
