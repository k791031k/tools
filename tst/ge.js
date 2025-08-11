/**
 * @fileoverview 最終進化版網頁表格處理工具書籤小工具 - 完整修正版
 *
 * 此工具能偵測並列出網頁上的所有表格，包括傳統的 `<table>` 和基於 `<div>` 的偽表格。
 * 提供互動式介面供使用者選擇、設定輸出格式（TSV, CSV, Markdown），
 * 並將表格內容複製到剪貼簿或下載為檔案。
 * 程式碼已高度模組化，易於閱讀和維護。
 */

//=============================================================================
// 模組 1: UI 顯示與互動
// 負責處理所有與使用者介面相關的邏輯，包括設定視窗與 Toast 提示。
//=============================================================================
const UIManager = (function() {
  // 全域變數放在模組作用域內
  let globalAutoplayInterval = null;
  let currentHighlightedElements = [];

  /**
   * 顯示一個自定義的 Toast 提示訊息。
   * @param {string} message - 要顯示的訊息。
   */
  const showToast = (message) => {
    // 輸入驗證
    if (typeof message !== 'string') {
      console.warn('showToast: message 必須是字串類型');
      message = String(message || '');
    }

    const existingToast = document.getElementById('bookmarklet-toast');
    if (existingToast && existingToast.parentNode) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'bookmarklet-toast';
    toast.textContent = message;

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '5px',
      zIndex: '9999',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      transition: 'opacity 0.3s ease-in-out',
      opacity: '0',
    });

    try {
      document.body.appendChild(toast);
      // 強制重繪
      void toast.offsetWidth;
      toast.style.opacity = '1';

      setTimeout(() => {
        if (toast && toast.style) {
          toast.style.opacity = '0';
        }
        setTimeout(() => {
          if (toast && toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.error('顯示 Toast 時發生錯誤:', error);
    }
  };

  /**
   * 顯示或隱藏高亮顯示。
   * @param {HTMLElement} element - 要高亮的元素。
   * @param {boolean} highlight - 是否高亮顯示。
   */
  const highlightElement = (element, highlight) => {
    try {
      if (!element || !element.style) {
        console.warn('highlightElement: 無效的元素');
        return;
      }

      if (typeof highlight !== 'boolean') {
        console.warn('highlightElement: highlight 必須是布林值');
        highlight = Boolean(highlight);
      }

      if (highlight) {
        element.style.outline = '3px solid #007bff';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 記錄高亮的元素
        if (!currentHighlightedElements.includes(element)) {
          currentHighlightedElements.push(element);
        }
      } else {
        element.style.outline = '';
        
        // 從記錄中移除
        const index = currentHighlightedElements.indexOf(element);
        if (index > -1) {
          currentHighlightedElements.splice(index, 1);
        }
      }
    } catch (error) {
      console.error('高亮元素時發生錯誤:', error);
    }
  };

  /**
   * 清理所有資源
   */
  const cleanup = () => {
    try {
      // 停止自動播放
      if (globalAutoplayInterval) {
        clearInterval(globalAutoplayInterval);
        globalAutoplayInterval = null;
      }
      
      // 移除所有高亮
      currentHighlightedElements.forEach(element => {
        if (element && element.style) {
          element.style.outline = '';
        }
      });
      currentHighlightedElements = [];
      
      // 移除模態框
      const modal = document.getElementById('bookmarklet-modal');
      if (modal && modal.parentNode) {
        modal.remove();
      }
    } catch (error) {
      console.error('清理資源時發生錯誤:', error);
    }
  };

  /**
   * 創建並顯示設定視窗。
   * @param {Array<HTMLElement>} tables - 頁面上找到的表格元素陣列。
   * @param {Function} onConfirm - 當使用者點擊「複製」或「下載」後的回呼函式。
   */
  const showSettingsModal = (tables, onConfirm) => {
    try {
      // 輸入驗證
      if (!Array.isArray(tables)) {
        console.error('showSettingsModal: tables 必須是陣列');
        return;
      }
      
      if (typeof onConfirm !== 'function') {
        console.error('showSettingsModal: onConfirm 必須是函式');
        return;
      }

      const modalId = 'bookmarklet-modal';
      let modal = document.getElementById(modalId);
      if (modal) {
        cleanup();
      }

      modal = document.createElement('div');
      modal.id = modalId;
      Object.assign(modal.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: '10000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      });

      const modalContent = document.createElement('div');
      Object.assign(modalContent.style, {
        backgroundColor: '#fff',
        padding: '20px 30px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '600px',
        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
        fontFamily: 'sans-serif',
      });

      modalContent.innerHTML = `
        <h2 style="margin-top: 0;">表格處理工具箱</h2>
        <p>在頁面上找到 **${tables.length}** 個表格。請選擇一個或全部，並設定輸出格式。</p>

        <div style="margin-bottom: 15px;">
          <label for="table-select" style="font-weight: bold; display: block; margin-bottom: 5px;">選擇表格:</label>
          <div style="display: flex; align-items: center; gap: 5px;">
            <button id="prev-btn" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">&#9664;</button>
            <select id="table-select" style="flex-grow: 1; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="all">所有表格</option>
              ${tables.map((_, index) => `<option value="${index}">表格 #${index + 1}</option>`).join('')}
            </select>
            <button id="next-btn" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">&#9654;</button>
            <button id="autoplay-btn" style="padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">▶</button>
          </div>
        </div>

        <div id="table-preview-container" style="max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 10px; margin-bottom: 15px;">
          <p style="text-align: center; color: #999;">選擇表格以查看預覽</p>
        </div>

        <div style="margin-bottom: 15px;">
          <label for="format-select" style="font-weight: bold; display: block; margin-bottom: 5px;">選擇格式:</label>
          <select id="format-select" style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="tsv">TSV (適用於 Excel)</option>
            <option value="csv">CSV (逗號分隔)</option>
            <option value="markdown">Markdown 表格</option>
            <option value="html">HTML</option>
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center;">
            <input type="checkbox" id="include-header" checked style="margin-right: 8px;">
            <span>包含表頭</span>
          </label>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="copy-btn" style="flex: 1; padding: 10px 20px; font-size: 16px; font-weight: bold; border: none; border-radius: 4px; background-color: #007bff; color: white; cursor: pointer;">複製到剪貼簿</button>
          <button id="download-btn" style="flex: 1; padding: 10px 20px; font-size: 16px; font-weight: bold; border: none; border-radius: 4px; background-color: #28a745; color: white; cursor: pointer;">下載為檔案</button>
        </div>
        <button id="close-btn" style="width: 100%; margin-top: 10px; padding: 10px 20px; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; color: #333; cursor: pointer;">關閉</button>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);

      // 綁定事件處理器
      const closeBtn = document.getElementById('close-btn');
      const copyBtn = document.getElementById('copy-btn');
      const downloadBtn = document.getElementById('download-btn');
      const tableSelect = document.getElementById('table-select');
      const prevBtn = document.getElementById('prev-btn');
      const nextBtn = document.getElementById('next-btn');
      const autoplayBtn = document.getElementById('autoplay-btn');
      const previewContainer = document.getElementById('table-preview-container');

      if (!closeBtn || !copyBtn || !downloadBtn || !tableSelect || !prevBtn || !nextBtn || !autoplayBtn || !previewContainer) {
        console.error('無法找到必要的 UI 元素');
        return;
      }

      let prevIndex = -1;

      const showPreview = (index) => {
        try {
          // 清除之前的高亮
          if (prevIndex !== -1 && tables[prevIndex]) {
            highlightElement(tables[prevIndex], false);
          }
          
          if (index === 'all') {
            previewContainer.innerHTML = '<p style="text-align: center; color: #999;">已選擇所有表格，無單一預覽</p>';
          } else {
            const tableIndex = parseInt(index);
            if (isNaN(tableIndex) || !tables[tableIndex]) {
              previewContainer.innerHTML = '<p style="text-align: center; color: #999;">選擇表格以查看預覽</p>';
              return;
            }
            
            const table = tables[tableIndex];
            const previewTable = table.cloneNode(true);
            Object.assign(previewTable.style, {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            });
            previewContainer.innerHTML = '';
            previewContainer.appendChild(previewTable);
            highlightElement(table, true);
            prevIndex = tableIndex;
          }
        } catch (error) {
          console.error('顯示預覽時發生錯誤:', error);
          previewContainer.innerHTML = '<p style="text-align: center; color: #999;">預覽載入失敗</p>';
        }
      };
      
      // 初始化時顯示第一個表格
      if (tables.length > 0) {
        tableSelect.selectedIndex = 1; // 選中第一個表格
        showPreview(0);
      }

      // 事件監聽器
      closeBtn.onclick = cleanup;

      copyBtn.onclick = () => {
        try {
          onConfirm('copy');
          cleanup();
        } catch (error) {
          console.error('複製操作失敗:', error);
          showToast('複製操作失敗');
        }
      };

      downloadBtn.onclick = () => {
        try {
          onConfirm('download');
          cleanup();
        } catch (error) {
          console.error('下載操作失敗:', error);
          showToast('下載操作失敗');
        }
      };

      tableSelect.addEventListener('change', (e) => {
        showPreview(e.target.value);
        if (globalAutoplayInterval) {
          clearInterval(globalAutoplayInterval);
          globalAutoplayInterval = null;
          autoplayBtn.textContent = '▶';
        }
      });
      
      prevBtn.onclick = () => {
        try {
          let currentIndex = parseInt(tableSelect.value);
          if (isNaN(currentIndex) || currentIndex === 0) {
            currentIndex = tables.length - 1;
          } else {
            currentIndex--;
          }
          tableSelect.value = currentIndex;
          tableSelect.dispatchEvent(new Event('change'));
        } catch (error) {
          console.error('切換到上一個表格時發生錯誤:', error);
        }
      };

      nextBtn.onclick = () => {
        try {
          let currentIndex = parseInt(tableSelect.value);
          if (isNaN(currentIndex) || currentIndex === tables.length - 1) {
            currentIndex = 0;
          } else {
            currentIndex++;
          }
          tableSelect.value = currentIndex;
          tableSelect.dispatchEvent(new Event('change'));
        } catch (error) {
          console.error('切換到下一個表格時發生錯誤:', error);
        }
      };

      autoplayBtn.onclick = () => {
        try {
          if (globalAutoplayInterval) {
            clearInterval(globalAutoplayInterval);
            globalAutoplayInterval = null;
            autoplayBtn.textContent = '▶';
          } else {
            autoplayBtn.textContent = '■';
            globalAutoplayInterval = setInterval(() => {
              nextBtn.click();
            }, 2000); // 每 2 秒切換一次
          }
        } catch (error) {
          console.error('自動播放切換時發生錯誤:', error);
        }
      };

    } catch (error) {
      console.error('顯示設定視窗時發生錯誤:', error);
      showToast('無法顯示設定視窗');
    }
  };

  return {
    showToast,
    showSettingsModal,
    cleanup,
  };
})();

//=============================================================================
// 模組 2: 剪貼簿與檔案操作
// 負責處理將資料複製到剪貼簿或下載檔案的邏輯。
//=============================================================================
const IOHandler = (function(ui) {
  /**
   * 複製文字內容到剪貼簿。
   * @param {string} text - 要複製的文字。
   * @param {number} totalRowCount - 所有表格的總列數。
   * @param {number} tableCount - 表格總數。
   */
  const copyToClipboard = async (text, totalRowCount, tableCount) => {
    try {
      // 輸入驗證
      if (typeof text !== 'string') {
        console.warn('copyToClipboard: text 必須是字串類型');
        text = String(text || '');
      }
      
      if (typeof totalRowCount !== 'number' || totalRowCount < 0) {
        console.warn('copyToClipboard: totalRowCount 必須是非負數');
        totalRowCount = 0;
      }
      
      if (typeof tableCount !== 'number' || tableCount < 0) {
        console.warn('copyToClipboard: tableCount 必須是非負數');
        tableCount = 0;
      }

      // 檢查剪貼簿 API 是否可用
      if (!navigator.clipboard) {
        throw new Error('瀏覽器不支援剪貼簿 API');
      }

      await navigator.clipboard.writeText(text);
      const msg = tableCount > 1 
        ? `已複製成功！共 ${tableCount} 個表格，總計 ${totalRowCount} 列。` 
        : `已複製成功！表格 (${totalRowCount} 列)`;
      ui.showToast(msg);
    } catch (err) {
      console.error('無法複製到剪貼簿:', err);
      
      // 後備方案：使用傳統的複製方法
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        const msg = tableCount > 1 
          ? `已複製成功（後備方案）！共 ${tableCount} 個表格，總計 ${totalRowCount} 列。` 
          : `已複製成功（後備方案）！表格 (${totalRowCount} 列)`;
        ui.showToast(msg);
      } catch (fallbackErr) {
        console.error('後備複製方法也失敗:', fallbackErr);
        ui.showToast('複製失敗，請檢查瀏覽器權限或手動選擇文字複製。');
      }
    }
  };

  /**
   * 下載文字內容為檔案。
   * @param {string} filename - 檔案名稱。
   * @param {string} content - 檔案內容。
   * @param {string} mimeType - 檔案的 MIME 類型。
   * @param {number} totalRowCount - 所有表格的總列數。
   * @param {number} tableCount - 表格總數。
   */
  const downloadFile = (filename, content, mimeType, totalRowCount, tableCount) => {
    try {
      // 輸入驗證
      if (typeof filename !== 'string' || !filename.trim()) {
        console.warn('downloadFile: filename 必須是非空字串');
        filename = 'table_data.txt';
      }
      
      if (typeof content !== 'string') {
        console.warn('downloadFile: content 必須是字串類型');
        content = String(content || '');
      }
      
      if (typeof mimeType !== 'string') {
        console.warn('downloadFile: mimeType 必須是字串類型');
        mimeType = 'text/plain';
      }
      
      if (typeof totalRowCount !== 'number' || totalRowCount < 0) {
        console.warn('downloadFile: totalRowCount 必須是非負數');
        totalRowCount = 0;
      }
      
      if (typeof tableCount !== 'number' || tableCount < 0) {
        console.warn('downloadFile: tableCount 必須是非負數');
        tableCount = 0;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 清理 URL 對象
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      const msg = tableCount > 1 
        ? `已下載檔案: ${filename} (共 ${tableCount} 個表格，總計 ${totalRowCount} 列)` 
        : `已下載檔案: ${filename} (${totalRowCount} 列)`;
      ui.showToast(msg);
    } catch (error) {
      console.error('下載檔案時發生錯誤:', error);
      ui.showToast('下載失敗，請稍後再試。');
    }
  };

  return {
    copyToClipboard,
    downloadFile,
  };
})(UIManager);

//=============================================================================
// 模組 3: 網頁內容提取與格式化
// 負責從網頁上抓取資料並轉換成不同格式。
//=============================================================================
const ContentProcessor = (function() {
  /**
   * 檢查並返回一個有效的儲存格文字。
   * @param {HTMLElement} element - 儲存格元素。
   * @returns {string} - 清理後的文字。
   */
  const getCleanCellText = (element) => {
    try {
      if (!element) {
        return '';
      }
      
      const text = element.textContent || element.innerText || '';
      return text.trim().replace(/\s+/g, ' ');
    } catch (error) {
      console.error('提取儲存格文字時發生錯誤:', error);
      return '';
    }
  };

  /**
   * 偵測並解析非標準表格。
   * @param {HTMLElement} tableElement - 可能是偽表格的元素。
   * @returns {Array<Array<string>>|null} - 結構化的表格資料或 null。
   */
  const parsePseudoTable = (tableElement) => {
    try {
      if (!tableElement || !tableElement.children) {
        return null;
      }
      
      const rows = Array.from(tableElement.children);
      if (rows.length < 2) return null;

      const tableData = [];
      const maxCols = Math.max(...rows.map(row => {
        return row && row.children ? row.children.length : 0;
      }));

      if (maxCols === 0) return null;

      for (const row of rows) {
        if (!row || !row.children) continue;
        
        const cells = Array.from(row.children);
        const rowData = cells.map(getCleanCellText);
        
        // 補齊缺少的欄位
        while(rowData.length < maxCols) {
          rowData.push('');
        }
        tableData.push(rowData);
      }

      if (tableData.length > 0 && tableData[0].length > 1) {
        return tableData;
      }
      return null;
    } catch (error) {
      console.error('解析偽表格時發生錯誤:', error);
      return null;
    }
  };

  /**
   * 將表格內容轉換為指定格式。
   * @param {HTMLElement} tableElement - 要處理的表格元素，可能是 table 或 div。
   * @param {string} format - 輸出格式 ('tsv', 'csv', 'markdown', 'html')。
   * @param {boolean} includeHeader - 是否包含表頭。
   * @returns {{content: string, rowCount: number}} - 格式化後的內容及行列數。
   */
  const formatTableContent = (tableElement, format, includeHeader) => {
    try {
      // 輸入驗證
      if (!tableElement) {
        console.warn('formatTableContent: tableElement 是必需的參數');
        return { content: '', rowCount: 0 };
      }
      
      if (typeof format !== 'string') {
        console.warn('formatTableContent: format 必須是字串類型');
        format = 'tsv';
      }
      
      if (typeof includeHeader !== 'boolean') {
        console.warn('formatTableContent: includeHeader 必須是布林值');
        includeHeader = true;
      }

      let tableData = [];
      
      if (tableElement.tagName === 'TABLE') {
        const rows = Array.from(tableElement.rows);
        if (rows.length === 0) {
          return { content: '', rowCount: 0 };
        }

        const startRowIndex = includeHeader ? 0 : (tableElement.tHead ? 1 : 0);
        
        for (let i = startRowIndex; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row.cells) continue;
          
          const cells = row.cells;
          let colIndex = 0;
          
          // 確保 tableData[i] 存在
          if (!tableData[i]) {
            tableData[i] = [];
          }
          
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];
            if (!cell) continue;
            
            // 尋找下一個可用的欄位
            while (tableData[i] && tableData[i][colIndex]) {
              colIndex++;
            }
            
            const cellText = getCleanCellText(cell);
            const colspan = Math.max(1, parseInt(cell.getAttribute('colspan')) || 1);
            const rowspan = Math.max(1, parseInt(cell.getAttribute('rowspan')) || 1);
            
            // 處理跨欄和跨列
            for (let r = 0; r < rowspan && (i + r) < rows.length; r++) {
              if (!tableData[i + r]) {
                tableData[i + r] = [];
              }
              for (let c = 0; c < colspan; c++) {
                if (colIndex + c >= 0) {
                  tableData[i + r][colIndex + c] = cellText;
                }
              }
            }
            colIndex += colspan;
          }
        }
      } else {
        tableData = parsePseudoTable(tableElement);
        if (!includeHeader && tableData && tableData.length > 1) {
          tableData = tableData.slice(1);
        }
      }
      
      if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
        return { content: '', rowCount: 0 };
      }

      // 確保所有行都有相同的欄位數
      const maxCols = Math.max(...tableData.map(row => row ? row.length : 0));
      tableData = tableData.map(row => {
        if (!Array.isArray(row)) {
          row = [];
        }
        while (row.length < maxCols) {
          row.push('');
        }
        return row;
      });

      // 格式化輸出
      switch (format.toLowerCase()) {
        case 'tsv':
          return {
            content: tableData.map(row => row.join('\t')).join('\n'),
            rowCount: tableData.length
          };
          
        case 'csv':
          const escapeCSV = (str) => {
            if (typeof str !== 'string') {
              str = String(str || '');
            }
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };
          return {
            content: tableData.map(row => row.map(escapeCSV).join(',')).join('\n'),
            rowCount: tableData.length
          };
          
        case 'markdown':
          const colWidths = Array(maxCols).fill(0);
          tableData.forEach(row => {
            row.forEach((cell, index) => {
              const cellStr = String(cell || '');
              colWidths[index] = Math.max(colWidths[index], cellStr.length);
            });
          });

          let mdContent = '';
          if (includeHeader && tableData.length > 0) {
            const headerRow = tableData[0];
            const dataRows = tableData.slice(1);
            mdContent += '| ' + headerRow.map((cell, i) => String(cell || '').padEnd(colWidths[i], ' ')).join(' | ') + ' |\n';
            mdContent += '|-' + colWidths.map(w => '-'.repeat(w)).join('-|-') + '-|\n';
            mdContent += dataRows.map(row => '| ' + row.map((cell, i) => String(cell || '').padEnd(colWidths[i], ' ')).join(' | ') + ' |').join('\n');
          } else if (tableData.length > 0) {
            mdContent += tableData.map(row => '| ' + row.map((cell, i) => String(cell || '').padEnd(colWidths[i], ' ')).join(' | ') + ' |').join('\n');
          }
          return {
            content: mdContent,
            rowCount: tableData.length
          };
          
        case 'html':
          return {
            content: tableElement.outerHTML || '',
            rowCount: tableData.length
          };
          
        default:
          console.warn(`不支援的格式: ${format}，使用 TSV 格式`);
          return {
            content: tableData.map(row => row.join('\t')).join('\n'),
            rowCount: tableData.length
          };
      }
    } catch (error) {
      console.error('格式化表格內容時發生錯誤:', error);
      return { content: '', rowCount: 0 };
    }
  };

  /**
   * 尋找並返回頁面上所有可能的表格元素。
   * @returns {Array<HTMLElement>} - 表格元素的陣列。
   */
  const findTables = () => {
    try {
      // 尋找所有可能的表格元素
      const selectors = [
        'table',
        'div[class*="table"]',
        'div[class*="grid"]',
        'div[role="table"]',
        'div[class*="data"]',
        '[class*="table"]'
      ];
      
      const allTableElements = [];
      selectors.forEach(selector => {
        try {
          const elements = Array.from(document.querySelectorAll(selector));
          allTableElements.push(...elements);
        } catch (error) {
          console.warn(`查詢選擇器 ${selector} 時發生錯誤:`, error);
        }
      });
      
      // 去重（使用 Set）
      const uniqueElements = [...new Set(allTableElements)];
      
      const validTables = uniqueElements.filter(table => {
        try {
          if (!table) return false;
          
          if (table.tagName === 'TABLE') {
            return table.rows && table.rows.length > 0;
          }
          
          // 檢查是否為偽表格
          if (!table.children) return false;
          
          const children = Array.from(table.children);
          if (children.length > 1) {
            const firstRowCells = children[0].children ? Array.from(children[0].children) : [];
            return firstRowCells.length > 1;
          }
          return false;
        } catch (error) {
          console.warn('驗證表格時發生錯誤:', error);
          return false;
        }
      });

      return validTables;
    } catch (error) {
      console.error('尋找表格時發生錯誤:', error);
      return [];
    }
  };

  return {
    formatTableContent,
    findTables,
    getCleanCellText,
    parsePseudoTable,
  };
})();

//=============================================================================
// 模組 4: 主應用程式邏輯
// 協調上述所有模組，處理主要的業務邏輯和事件監聽。
//=============================================================================
const App = (function(ui, io, processor) {
  /**
   * 初始化應用程式，顯示設定視窗。
   */
  const init = () => {
    try {
      const tables = processor.findTables();
      if (!Array.isArray(tables) || tables.length === 0) {
        ui.showToast('頁面上沒有找到任何表格。');
        return;
      }

      ui.showSettingsModal(tables, (actionType) => {
        try {
          const tableSelectElement = document.getElementById('table-select');
          const formatSelectElement = document.getElementById('format-select');
          const includeHeaderElement = document.getElementById('include-header');
          
          if (!tableSelectElement || !formatSelectElement || !includeHeaderElement) {
            ui.showToast('錯誤: 無法取得設定值。');
            return;
          }

          const selectedIndex = tableSelectElement.value;
          const selectedFormat = formatSelectElement.value;
          const includeHeader = includeHeaderElement.checked;
          
          let finalContent = '';
          let totalRowCount = 0;
          let tableCount = 0;

          if (selectedIndex === 'all') {
            const separator = `\n\n--- 表格分隔線：表格 #${selectedFormat.toUpperCase()} ---\n\n`;
            const allFormattedContents = tables.map((table, index) => {
              const { content, rowCount } = processor.formatTableContent(table, selectedFormat, includeHeader);
              totalRowCount += rowCount;
              return `--- 表格 #${index + 1} ---\n${content}`;
            }).filter(content => content.trim() !== '--- 表格 #1 ---\n'); // 過濾空內容
            
            finalContent = allFormattedContents.join(separator);
            tableCount = tables.length;
          } else {
            const tableIndex = parseInt(selectedIndex);
            if (isNaN(tableIndex) || !tables[tableIndex]) {
              ui.showToast('錯誤: 未選取有效的表格。');
              return;
            }
            
            const selectedTable = tables[tableIndex];
            const { content, rowCount } = processor.formatTableContent(selectedTable, selectedFormat, includeHeader);
            finalContent = content;
            totalRowCount = rowCount;
            tableCount = 1;
          }

          if (!finalContent.trim()) {
            ui.showToast('警告: 表格內容為空。');
            return;
          }

          if (actionType === 'copy') {
            io.copyToClipboard(finalContent, totalRowCount, tableCount);
          } else if (actionType === 'download') {
            const filenamePrefix = tableCount > 1 ? 'all_tables' : `table-${parseInt(selectedIndex) + 1}`;
            const extensionMap = {
              tsv: '.tsv',
              csv: '.csv',
              markdown: '.md',
              html: '.html'
            };
            const mimeTypeMap = {
              tsv: 'text/tab-separated-values',
              csv: 'text/csv',
              markdown: 'text/plain',
              html: 'text/html'
            };
            
            const extension = extensionMap[selectedFormat] || '.txt';
            const mimeType = mimeTypeMap[selectedFormat] || 'text/plain';
            const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}${extension}`;
            
            io.downloadFile(filename, finalContent, mimeType, totalRowCount, tableCount);
          } else {
            ui.showToast('錯誤: 未知的操作類型。');
          }
        } catch (error) {
          console.error('處理確認操作時發生錯誤:', error);
          ui.showToast('操作失敗，請稍後再試。');
        }
      });
    } catch (error) {
      console.error('初始化應用程式時發生錯誤:', error);
      ui.showToast('應用程式初始化失敗。');
    }
  };

  return {
    init,
  };
})(UIManager, IOHandler, ContentProcessor);

// 全域錯誤處理
window.addEventListener('error', (event) => {
  console.error('全域錯誤:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未處理的 Promise 拒絕:', event.reason);
});

// 立即執行主應用程式
try {
  App.init();
} catch (error) {
  console.error('執行主應用程式時發生嚴重錯誤:', error);
  if (typeof UIManager !== 'undefined' && UIManager.showToast) {
    UIManager.showToast('應用程式啟動失敗，請重新整理頁面後再試。');
  } else {
    alert('應用程式啟動失敗，請重新整理頁面後再試。');
  }
}
