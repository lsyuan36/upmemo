// 網址自動轉換為超連結功能

// URL 匹配的正則表達式 (支援 http://, https://, www.)
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

/**
 * 將文本中的網址轉換為可點擊的超連結
 * 保留原始換行符和圖片標籤
 */
export function linkifyText(text: string): string {
  // 先提取所有圖片容器和圖片標籤並替換為佔位符
  const images: string[] = [];
  const IMG_PLACEHOLDER_PREFIX = '\uFFF0IMG_'; // 使用 Unicode 私有區字符
  const IMG_PLACEHOLDER_SUFFIX = '_IMG\uFFF1';

  // 使用更精確的方式提取圖片容器
  let textWithPlaceholders = text;

  // 找到所有 image-container 的開始位置
  const containerStartRegex = /<div[^>]*class="[^"]*image-container[^"]*"[^>]*>/gi;
  const matches: Array<{start: number, end: number, content: string}> = [];

  let match;
  while ((match = containerStartRegex.exec(text)) !== null) {
    const startPos = match.index;
    let depth = 1;
    let currentPos = startPos + match[0].length;

    // 找到對應的結束標籤
    while (depth > 0 && currentPos < text.length) {
      // 檢查是否是開始標籤
      if (text.substr(currentPos, 4) === '<div') {
        const nextChar = text.charAt(currentPos + 4);
        if (nextChar === ' ' || nextChar === '>') {
          depth++;
        }
      }
      // 檢查是否是結束標籤
      else if (text.substr(currentPos, 6) === '</div>') {
        depth--;
        if (depth === 0) {
          const endPos = currentPos + 6;
          matches.push({
            start: startPos,
            end: endPos,
            content: text.substring(startPos, endPos)
          });
        }
      }
      currentPos++;
    }
  }

  // 從後往前替換,避免索引偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const index = images.length;
    images.unshift(m.content);
    const placeholder = `${IMG_PLACEHOLDER_PREFIX}${index}${IMG_PLACEHOLDER_SUFFIX}`;
    textWithPlaceholders = textWithPlaceholders.substring(0, m.start) +
                          placeholder +
                          textWithPlaceholders.substring(m.end);
  }

  // 再處理剩餘的單獨圖片標籤
  const imgRegex = /<img[^>]*>/gi;
  textWithPlaceholders = textWithPlaceholders.replace(imgRegex, (match) => {
    const index = images.length;
    images.push(match);
    return `${IMG_PLACEHOLDER_PREFIX}${index}${IMG_PLACEHOLDER_SUFFIX}`;
  });

  // 按行處理
  const lines = textWithPlaceholders.split('\n');

  const processedLines = lines.map(line => {
    // 檢查這一行是否只包含圖片 placeholder
    const placeholderRegex = new RegExp(`^${IMG_PLACEHOLDER_PREFIX}\\d+${IMG_PLACEHOLDER_SUFFIX}$`);
    if (placeholderRegex.test(line.trim())) {
      // 如果整行只有 placeholder，直接返回不處理
      return line;
    }

    // 轉義 HTML 特殊字符
    let escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // 但需要保留 placeholder 不被轉義
    const finalPlaceholderRegex = new RegExp(`&lt;${IMG_PLACEHOLDER_PREFIX.replace(/[\uFFF0\uFFF1]/g, '.')}(\\d+)${IMG_PLACEHOLDER_SUFFIX.replace(/[\uFFF0\uFFF1]/g, '.')}&gt;`, 'g');
    escaped = escaped.replace(finalPlaceholderRegex, (_, index) => {
      return `${IMG_PLACEHOLDER_PREFIX}${index}${IMG_PLACEHOLDER_SUFFIX}`;
    });

    // 替換網址為超連結
    const withLinks = escaped.replace(URL_REGEX, (url) => {
      // 如果是 www. 開頭,自動添加 https://
      const href = url.startsWith('www.') ? `https://${url}` : url;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    return withLinks;
  });

  // 用 <br> 連接各行
  let result = processedLines.join('<br>');

  // 還原圖片標籤
  const finalPlaceholderRegex = new RegExp(`${IMG_PLACEHOLDER_PREFIX}(\\d+)${IMG_PLACEHOLDER_SUFFIX}`, 'g');
  result = result.replace(finalPlaceholderRegex, (_, index) => {
    return images[parseInt(index)] || '';
  });

  return result;
}

/**
 * 從 contenteditable 元素中提取內容(保留圖片標籤)
 */
export function extractPlainText(element: HTMLElement): string {
  let result = '';

  function processNode(node: Node): string {
    // 文字節點：直接返回內容
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    // 元素節點
    if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;

      // 圖片容器：完整保留 HTML（不進入內部），並添加換行標記
      if (elem.classList.contains('image-container')) {
        const clone = elem.cloneNode(true) as HTMLElement;
        clone.classList.remove('selected');
        return clone.outerHTML + '\n';
      }

      // 單獨的圖片標籤
      if (elem.tagName === 'IMG') {
        return elem.outerHTML;
      }

      // BR 標籤：轉換為換行符
      if (elem.tagName === 'BR') {
        return '\n';
      }

      // DIV 標籤：處理換行邏輯（但不處理 image-container）
      if (elem.tagName === 'DIV') {
        let content = '';

        // 處理子節點
        for (let i = 0; i < elem.childNodes.length; i++) {
          content += processNode(elem.childNodes[i]);
        }

        // 如果有內容，在結尾添加換行
        if (content) {
          content += '\n';
        }

        return content;
      }

      // 其他元素（如 <a> 標籤）：只提取文字內容
      let content = '';
      for (let i = 0; i < elem.childNodes.length; i++) {
        content += processNode(elem.childNodes[i]);
      }
      return content;
    }

    return '';
  }

  // 處理所有子節點
  for (let i = 0; i < element.childNodes.length; i++) {
    result += processNode(element.childNodes[i]);
  }

  // 清理多餘的換行符
  result = result.replace(/\n{3,}/g, '\n\n'); // 最多保留兩個換行
  result = result.replace(/^\n+/, ''); // 移除開頭換行
  result = result.replace(/\n+$/, ''); // 移除結尾換行

  return result;
}

/**
 * 設置 contenteditable 元素的內容並保持游標位置
 */
export function setContentWithCursor(element: HTMLDivElement, htmlContent: string) {
  // 保存當前游標位置
  const selection = window.getSelection();
  let cursorOffset = 0;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    cursorOffset = preCaretRange.toString().length;
  }

  // 設置新內容
  element.innerHTML = htmlContent;

  // 恢復游標位置
  if (cursorOffset > 0) {
    restoreCursor(element, cursorOffset);
  }
}

/**
 * 恢復游標位置
 */
function restoreCursor(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  let currentOffset = 0;
  let found = false;

  function traverse(node: Node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      if (currentOffset + textLength >= offset) {
        range.setStart(node, offset - currentOffset);
        range.collapse(true);
        found = true;
        return;
      }
      currentOffset += textLength;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
        if (found) return;
      }
    }
  }

  traverse(element);

  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * 處理連結點擊事件
 */
export function handleLinkClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  if (target.tagName === 'A') {
    event.preventDefault();
    const href = target.getAttribute('href');

    if (href) {
      // 使用 Tauri 的 shell 開啟連結
      import('@tauri-apps/plugin-shell').then(({ open }) => {
        open(href);
      }).catch(err => {
        console.error('無法開啟連結:', err);
        // 降級處理：使用 window.open
        window.open(href, '_blank', 'noopener,noreferrer');
      });
    }
  }
}
