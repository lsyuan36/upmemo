export const MAX_PASTE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DROP_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fileToBase64(file: File): Promise<string> {
  if (file.type === "image/gif") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("無法讀取檔案"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("影像載入失敗"));
      image.src = objectUrl;
    });

    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const newWidth = Math.max(1, Math.round(img.width * scale));
    const newHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("無法建立繪圖內容");

    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    if (/jpe?g/i.test(file.type)) {
      return canvas.toDataURL("image/jpeg", 0.85);
    }

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
