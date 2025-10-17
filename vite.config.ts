import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // 設定根目錄為 src
  root: "src",
  // 確保開發伺服器在 port 1420 啟動，符合 tauri.conf.json 的設定
  server: {
    port: 1420,
    strictPort: true,
  },
  // 設定環境變數前綴
  envPrefix: ["VITE_", "TAURI_"],
  // 清除 console 輸出
  clearScreen: false,
  // 建置輸出目錄
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
