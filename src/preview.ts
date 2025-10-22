// 圖片預覽視窗腳本
import { getCurrentWindow } from '@tauri-apps/api/window';
import { once } from '@tauri-apps/api/event';

const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const loadingSpinner = document.getElementById('loading-spinner') as HTMLDivElement;
const zoomInfo = document.getElementById('zoom-info') as HTMLDivElement;
const currentWindow = getCurrentWindow();

let scale = 1;
const minScale = 0.5;
const maxScale = 5;
const scaleStep = 0.1;

// 監聽圖片數據事件 (只監聽一次)
console.log('預覽視窗已載入,開始監聽圖片數據事件...');

once<{ data: string }>('preview-image-data', (event) => {
  console.log('收到圖片數據事件!');
  console.log('數據長度:', event.payload.data.length);
  console.log('數據開頭:', event.payload.data.substring(0, 50));

  previewImage.src = event.payload.data;
  console.log('圖片已設置到 img 元素, src:', previewImage.src.substring(0, 50));

  // 監聽圖片加載事件
  previewImage.onload = async () => {
    console.log('圖片載入成功!');
    // 隱藏載入動畫,顯示圖片
    loadingSpinner.classList.add('hidden');
    previewImage.style.display = 'block';

    // 圖片載入完成後顯示視窗,避免閃爍
    try {
      await currentWindow.show();
      await currentWindow.setFocus();
      console.log('視窗已顯示');
    } catch (error) {
      console.error('顯示視窗失敗:', error);
    }
  };

  previewImage.onerror = (err) => {
    console.error('圖片載入失敗:', err);
    // 即使失敗也隱藏載入動畫
    loadingSpinner.classList.add('hidden');
  };
}).then(() => {
  console.log('事件監聽器已設置');
}).catch(error => {
  console.error('設置監聽器失敗:', error);
});

// 更新縮放資訊顯示
function updateZoomInfo() {
  const percent = Math.round(scale * 100);
  zoomInfo.textContent = `Ctrl + 滾輪縮放 | ${percent}%`;
}

// Ctrl + 滾輪縮放
document.addEventListener('wheel', (e: WheelEvent) => {
  if (!e.ctrlKey) return;

  e.preventDefault();

  const delta = e.deltaY > 0 ? -scaleStep : scaleStep;
  scale = Math.max(minScale, Math.min(maxScale, scale + delta));
  previewImage.style.transform = `scale(${scale})`;
  updateZoomInfo();
}, { passive: false });

// ESC 鍵關閉
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    currentWindow.close();
  }
});

// 點擊背景關閉
document.body.addEventListener('click', (e: MouseEvent) => {
  if (e.target === document.body || e.target === document.getElementById('preview-container')) {
    currentWindow.close();
  }
});

// 防止圖片本身的點擊事件冒泡
previewImage.addEventListener('click', (e: MouseEvent) => {
  e.stopPropagation();
});

console.log('圖片預覽視窗已載入');
