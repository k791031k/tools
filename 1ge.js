/**
 * @fileoverview 最終進化版網頁表格處理工具書籤小工具。
 *
 * 此工具能偵測並列出網頁上的所有表格，包括傳統的 `<table>` 和基於 `<div>` 的偽表格。
 * 提供互動式介面供使用者選擇、設定輸出格式（TSV, CSV, Markdown），
 * 並將表格內容複製到剪貼簿或下載為檔案。
 * 此外，整合了 HTML 編輯器，可直接在預覽圖上即時編輯、同步語法、恢復原始表格語法。
 * 程式碼已高度模組化，易於閱讀和維護。
 */

//=============================================================================
// 模組 1: UI 顯示與互動
// 負責處理所有與使用者介面相關的邏輯，包括設定視窗與 Toast 提示。
//=============================================================================
const UIManager = (function() {
  let autoplayInterval = null;
  let prevIndex = -1;
  let tables = [];

  /**
   * 顯示一個自定義的 Toast 提示訊息。
   * @param {string} message - 要顯示的訊息。
   */
  const showToast = (message) => {
    const existingToast = document.getElementById('bookmarklet-toast');
    if (existingToast) {
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

    document.body.appendChild(toast);
    void toast.offsetWidth;
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 300);
    }, 3000);
  };

  /**
   * 顯示或隱藏高亮顯示。
   * @param {HTMLElement} element - 要高亮的元素。
   * @param {boolean} highlight - 是否高亮顯示。
   */
  const highlightElement = (element, highlight) => {
    if (element) {
      if (highlight) {
        element.style.outline = '3px solid #007bff';
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        element.style.outline = '';
      }
    }
  };

  /**
   * 顯示主設定視窗。
   * @param {Array<HTMLElement>} foundTables - 頁面上找到的表格元素陣列。
   * @param {Function} onConfirm - 當使用者點擊「複製」或「下載」後的回呼函式。
   * @param {Function} onEdit - 當使用者點擊「開啟編輯器」後的回呼函式。
   */
  const showSettingsModal = (foundTables, onConfirm, onEdit) => {
    tables = foundTables; // 儲存表格到模組變數
    const modalId = 'bookmarklet-modal';
    let modal = document.getElementById(modalId);
    if (modal) {
      modal.remove();
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
      position: 'relative',
      backgroundColor: '#fff',
      padding: '20px 30px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '600px',
      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
      fontFamily: 'sans-serif',
    });

    modalContent.innerHTML = `
      <h2 style="margin-top: 0; font-size: 20px;">表格處理工具箱</h2>
      <a href="#" id="close-btn" style="position: absolute; top: 10px; right: 15px; font-size: 24px; text-decoration: none; color: #999;">&times;</a>

      <p style="font-size: 14px;">在頁面上找到 **${tables.length}** 個表格。請選擇一個或全部，並設定輸出格式。</p>

      <div style="display: flex; gap: 15px; margin-bottom: 15px;">
        <div style="flex: 1;">
          <label for="table-select" style="font-weight: bold; display: block; margin-bottom: 5px;">選擇表格:</label>
          <select id="table-select" style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="all">所有表格</option>
            ${tables.map((_, index) => `<option value="${index}">表格 #${index + 1}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <div id="table-preview-container" style="flex-grow: 1; max-height: 200px; overflow-y: auto; border: 1px solid #eee; padding: 10px;">
          <p style="text-align: center; color: #999;">選擇表格以查看預覽</p>
        </div>
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 5px;">
          <button id="prev-btn" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer; font-size: 16px;">⬆︎</button>
          <button id="next-btn" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer; font-size: 16px;">⬇︎</button>
          <button id="autoplay-btn" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer; font-size: 16px;">▶️</button>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <label for="format-select" style="font-weight: bold; display: block; margin-bottom: 5px;">選擇格式:</label>
          <select id="format-select" style="width: 100%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="tsv">TSV (適用於 Excel)</option>
            <option value="csv">CSV (逗號分隔)</option>
            <option value="markdown">Markdown 表格</option>
            <option value="html">HTML</option>
          </select>
        </div>
        <div style="display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 5px;">
            <label style="display: flex; align-items: center;">
              <input type="checkbox" id="include-header" checked style="margin-right: 8px;">
              <span>包含表頭</span>
            </label>
        </div>
      </div>

      <div style="display: flex; gap: 10px;">
        <button id="copy-btn" style="flex: 1; padding: 10px 20px; font-size: 16px; font-weight: bold; border: none; border-radius: 4px; background-color: #007bff; color: white; cursor: pointer;">複製到剪貼簿</button>
        <button id="download-btn" style="flex: 1; padding: 10px 20px; font-size: 16px; font-weight: bold; border: none; border-radius: 4px; background-color: #28a745; color: white; cursor: pointer;">下載為檔案</button>
      </div>
      <div style="text-align: center; margin-top: 10px;">
        <button id="edit-html-btn" style="width: 100%; padding: 8px 16px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">開啟 HTML 編輯器</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const closeBtn = document.getElementById('close-btn');
    closeBtn.onclick = (e) => {
      e.preventDefault();
      const selectedIndex = document.getElementById('table-select').value;
      if (selectedIndex !== 'all' && tables[selectedIndex]) {
        highlightElement(tables[selectedIndex], false);
      }
      modal.remove();
      if (autoplayInterval) {
          clearInterval(autoplayInterval);
      }
    };

    const copyBtn = document.getElementById('copy-btn');
    copyBtn.onclick = () => {
      onConfirm('copy');
      modal.remove();
      if (autoplayInterval) {
          clearInterval(autoplayInterval);
      }
    };

    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.onclick = () => {
      onConfirm('download');
      modal.remove();
      if (autoplayInterval) {
          clearInterval(autoplayInterval);
      }
    };

    const editHtmlBtn = document.getElementById('edit-html-btn');
    editHtmlBtn.onclick = () => {
        const selectedIndex = document.getElementById('table-select').value;
        const selectedTable = tables[selectedIndex];
        if (!selectedTable || selectedIndex === 'all') {
            showToast('請先選擇一個單獨的表格來進行編輯。');
            return;
        }
        
        const originalHtml = selectedTable.outerHTML;
        onEdit(originalHtml);
    };

    const tableSelect = document.getElementById('table-select');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const autoplayBtn = document.getElementById('autoplay-btn');
    const previewContainer = document.getElementById('table-preview-container');
    
    const showPreview = (index) => {
      if (prevIndex !== -1 && tables[prevIndex]) {
        highlightElement(tables[prevIndex], false);
      }
      if (index === 'all') {
        previewContainer.innerHTML = '<p style="text-align: center; color: #999;">已選擇所有表格，無單一預覽</p>';
      } else if (tables[index]) {
        const table = tables[index];
        const previewTable = table.cloneNode(true);
        Object.assign(previewTable.style, {
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
        });
        previewContainer.innerHTML = '';
        previewContainer.appendChild(previewTable);
        highlightElement(tables[index], true);
      } else {
         previewContainer.innerHTML = '<p style="text-align: center; color: #999;">選擇表格以查看預覽</p>';
      }
      prevIndex = index;
    };
    
    if (tables.length > 0) {
      tableSelect.selectedIndex = 1;
      showPreview(0);
    }

    tableSelect.addEventListener('change', (e) => {
      showPreview(e.target.value);
      if (autoplayInterval) {
          clearInterval(autoplayInterval);
          autoplayBtn.textContent = '▶️';
      }
    });
    
    prevBtn.onclick = () => {
        let currentIndex = parseInt(tableSelect.value);
        if (isNaN(currentIndex) || currentIndex === 0) {
            currentIndex = tables.length - 1;
        } else {
            currentIndex--;
        }
        tableSelect.value = currentIndex;
        tableSelect.dispatchEvent(new Event('change'));
    };

    nextBtn.onclick = () => {
        let currentIndex = parseInt(tableSelect.value);
        if (isNaN(currentIndex) || currentIndex === tables.length - 1) {
            currentIndex = 0;
        } else {
            currentIndex++;
        }
        tableSelect.value = currentIndex;
        tableSelect.dispatchEvent(new Event('change'));
    };

    autoplayBtn.onclick = () => {
        if (autoplayInterval) {
            clearInterval(autoplayInterval);
            autoplayInterval = null;
            autoplayBtn.textContent = '▶️';
        } else {
            autoplayBtn.textContent = '⏸️';
            autoplayInterval = setInterval(() => {
                nextBtn.click();
            }, 2000);
        }
    };
  };

  /**
   * 顯示 HTML 編輯器視窗 (整合在主視窗內)。
   * @param {string} originalHtml - 原始表格的 HTML 語法。
   */
  const showHtmlEditor = (originalHtml) => {
    const modalContent = document.querySelector('#bookmarklet-modal > div');
    const originalContent = modalContent.innerHTML;
    
    modalContent.innerHTML = `
      <h2 style="margin-top: 0; font-size: 20px;">HTML 表格編輯器</h2>
      <div style="display: flex; gap: 10px; height: 400px; margin-bottom: 10px;">
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label style="font-weight: bold; margin-bottom: 5px;">編輯語法:</label>
          <textarea id="html-editor" style="flex: 1; width: 100%; font-family: monospace; font-size: 14px; padding: 10px; box-sizing: border-box; border: 1px solid #ccc; resize: none;"></textarea>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column;">
          <label style="font-weight: bold; margin-bottom: 5px;">即時預覽:</label>
          <div id="preview-area" style="flex: 1; border: 1px solid #ccc; padding: 10px; overflow: auto; background-color: #f8f9fa;"></div>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
          <button id="revert-btn" style="padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">恢復原始表格語法</button>
          <button id="copy-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background-color: #007bff; color: white; cursor: pointer;">複製</button>
          <button id="download-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background-color: #28a745; color: white; cursor: pointer;">下載為 HTML 檔案</button>
          <button id="close-editor-btn" style="padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background-color: #f8f9fa; cursor: pointer;">關閉編輯器</button>
      </div>
    `;
    
    const htmlEditor = document.getElementById('html-editor');
    const previewArea = document.getElementById('preview-area');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const revertBtn = document.getElementById('revert-btn');
    const closeEditorBtn = document.getElementById('close-editor-btn');
    
    htmlEditor.value = originalHtml;
    previewArea.innerHTML = originalHtml;

    // 語法編輯 -> 預覽
    htmlEditor.addEventListener('input', () => {
        previewArea.innerHTML = htmlEditor.value;
    });

    // 預覽編輯 -> 語法
    previewArea.contentEditable = true;
    previewArea.addEventListener('input', () => {
        htmlEditor.value = previewArea.innerHTML;
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(htmlEditor.value);
            showToast('已成功複製到剪貼簿！');
        } catch (err) {
            showToast('複製失敗，請檢查權限。');
        }
    });

    downloadBtn.addEventListener('click', () => {
        const content = htmlEditor.value;
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edited_table.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('已下載編輯後的表格檔案。');
    });

    revertBtn.addEventListener('click', () => {
        htmlEditor.value = originalHtml;
        previewArea.innerHTML = originalHtml;
        showToast('已恢復原始表格語法。');
    });

    closeEditorBtn.addEventListener('click', () => {
        modalContent.innerHTML = originalContent;
        // 重新初始化主視窗的事件監聽
        initModalEvents();
    });
    
    // 重新綁定主視窗的事件
    const initModalEvents = () => {
        const closeBtn = document.getElementById('close-btn');
        closeBtn.onclick = (e) => {
          e.preventDefault();
          const selectedIndex = document.getElementById('table-select').value;
          if (selectedIndex !== 'all' && tables[selectedIndex]) {
            highlightElement(tables[selectedIndex], false);
          }
          document.getElementById(modalId).remove();
          if (autoplayInterval) {
              clearInterval(autoplayInterval);
          }
        };

        const copyBtn = document.getElementById('copy-btn');
        copyBtn.onclick = () => { onConfirm('copy'); document.getElementById(modalId).remove(); };
        
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.onclick = () => { onConfirm('download'); document.getElementById(modalId).remove(); };

        const editHtmlBtn = document.getElementById('edit-html-btn');
        editHtmlBtn.onclick = () => {
            const selectedIndex = document.getElementById('table-select').value;
            const selectedTable = tables[selectedIndex];
            if (!selectedTable || selectedIndex === 'all') {
                showToast('請先選擇一個單獨的表格來進行編輯。');
                return;
            }
            const originalHtml = selectedTable.outerHTML;
            showHtmlEditor(originalHtml);
        };
        
        const tableSelect = document.getElementById('table-select');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const autoplayBtn = document.getElementById('autoplay-btn');
        const previewContainer = document.getElementById('table-preview-container');
        
        const showPreview = (index) => {
          if (prevIndex !== -1 && tables[prevIndex]) {
            highlightElement(tables[prevIndex], false);
          }
          if (index === 'all') {
            previewContainer.innerHTML = '<p style="text-align: center; color: #999;">已選擇所有表格，無單一預覽</p>';
          } else if (tables[index]) {
            const table = tables[index];
            const previewTable = table.cloneNode(true);
            Object.assign(previewTable.style, {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            });
            previewContainer.innerHTML = '';
            previewContainer.appendChild(previewTable);
            highlightElement(tables[index], true);
          } else {
             previewContainer.innerHTML = '<p style="text-align: center; color: #999;">選擇表格以查看預覽</p>';
          }
          prevIndex = index;
        };

        if (tables.length > 0) {
            tableSelect.selectedIndex = 1;
            showPreview(0);
        }

        tableSelect.addEventListener('change', (e) => {
          showPreview(e.target.value);
          if (autoplayInterval) {
              clearInterval(autoplayInterval);
              autoplayBtn.textContent = '▶️';
          }
        });

        prevBtn.onclick = () => {
            let currentIndex = parseInt(tableSelect.value);
            if (isNaN(currentIndex) || currentIndex === 0) { currentIndex = tables.length - 1; } else { currentIndex--; }
            tableSelect.value = currentIndex;
            tableSelect.dispatchEvent(new Event('change'));
        };

        nextBtn.onclick = () => {
            let currentIndex = parseInt(tableSelect.value);
            if (isNaN(currentIndex) || currentIndex === tables.length - 1) { currentIndex = 0; } else { currentIndex++; }
            tableSelect.value = currentIndex;
            tableSelect.dispatchEvent(new Event('change'));
        };

        autoplayBtn.onclick = () => {
            if (autoplayInterval) {
                clearInterval(autoplayInterval);
                autoplayInterval = null;
                autoplayBtn.textContent = '▶️';
            } else {
                autoplayBtn.textContent = '⏸️';
                autoplayInterval = setInterval(() => { nextBtn.click(); }, 2000);
            }
        };
    };

    initModalEvents();
  };

  return {
    showToast,
    showSettingsModal,
    showHtmlEditor,
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
      await navigator.clipboard.writeText(text);
      const msg = tableCount > 1 ? `已複製成功！共 ${tableCount} 個表格，總計 ${totalRowCount} 列。` : `已複製成功！表格 (${totalRowCount} 列)`;
      ui.showToast(msg);
    } catch (err) {
      console.error('無法複製到剪貼簿:', err);
      ui.showToast('複製失敗，請檢查瀏覽器權限。');
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
    const blob = new Blob([content], {
      type: mimeType
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const msg = tableCount > 1 ? `已下載檔案: ${filename} (共 ${tableCount} 個表格，總計 ${totalRowCount} 列)` : `已下載檔案: ${filename} (${totalRowCount} 列)`;
    ui.showToast(msg);
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
    return element.textContent.trim().replace(/\s+/g, ' ');
  };

  /**
   * 偵測並解析非標準表格。
   * @param {HTMLElement} tableElement - 可能是偽表格的元素。
   * @returns {Array<Array<string>>|null} - 結構化的表格資料或 null。
   */
  const parsePseudoTable = (tableElement) => {
    const rows = Array.from(tableElement.children);
    if (rows.length < 2) return null;

    const tableData = [];
    const maxCols = Math.max(...rows.map(row => row.children.length));

    for (const row of rows) {
      const cells = Array.from(row.children);
      const rowData = cells.map(getCleanCellText);
      
      while(rowData.length < maxCols) {
        rowData.push('');
      }
      tableData.push(rowData);
    }

    if (tableData.length > 0 && tableData[0].length > 1) {
      return tableData;
    }
    return null;
  };

  /**
   * 將表格內容轉換為指定格式。
   * @param {HTMLElement} tableElement - 要處理的表格元素，可能是 table 或 div。
   * @param {string} format - 輸出格式 ('tsv', 'csv', 'markdown', 'html')。
   * @param {boolean} includeHeader - 是否包含表頭。
   * @returns {{content: string, rowCount: number}} - 格式化後的內容及行列數。
   */
  const formatTableContent = (tableElement, format, includeHeader) => {
    let tableData = [];
    
    if (tableElement.tagName === 'TABLE') {
      const rows = Array.from(tableElement.rows);
      const startRowIndex = includeHeader ? 0 : (tableElement.tHead ? 1 : 0);
      
      for (let i = startRowIndex; i < rows.length; i++) {
        const row = rows[i];
        let rowData = [];
        const cells = row.cells;
        let colIndex = 0;
        
        for (let j = 0; j < cells.length; j++) {
          const cell = cells[j];
          while (tableData[i] && tableData[i][colIndex]) {
            colIndex++;
          }
          const cellText = getCleanCellText(cell);
          const colspan = parseInt(cell.getAttribute('colspan')) || 1;
          const rowspan = parseInt(cell.getAttribute('rowspan')) || 1;
          
          for (let r = 0; r < rowspan; r++) {
            if (!tableData[i + r]) {
              tableData[i + r] = [];
            }
            for (let c = 0; c < colspan; c++) {
              tableData[i + r][colIndex + c] = cellText;
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
    
    if (!tableData) {
        return { content: '', rowCount: 0 };
    }

    const maxCols = Math.max(...tableData.map(row => row.length));
    tableData = tableData.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    switch (format) {
      case 'tsv':
        return {
          content: tableData.map(row => row.join('\t')).join('\n'),
          rowCount: tableData.length
        };
      case 'csv':
        const escapeCSV = (str) => {
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
            colWidths[index] = Math.max(colWidths[index], cell.length);
          });
        });

        let mdContent = '';
        if (includeHeader && tableData.length > 0) {
            const headerRow = tableData[0];
            const dataRows = tableData.slice(1);
            mdContent += '| ' + headerRow.map((cell, i) => cell.padEnd(colWidths[i], ' ')).join(' | ') + ' |\n';
            mdContent += '|-' + colWidths.map(w => '-'.repeat(w)).join('-|-') + '-|\n';
            mdContent += dataRows.map(row => '| ' + row.map((cell, i) => cell.padEnd(colWidths[i], ' ')).join(' | ') + ' |').join('\n');
        } else if (tableData.length > 0) {
            mdContent += tableData.map(row => '| ' + row.map((cell, i) => cell.padEnd(colWidths[i], ' ')).join(' | ') + ' |').join('\n');
        }
        return {
          content: mdContent,
          rowCount: tableData.length
        };
      case 'html':
        return {
          content: tableElement.outerHTML,
          rowCount: tableData.length
        };
      default:
        return {
          content: '',
          rowCount: 0
        };
    }
  };

  /**
   * 尋找並返回頁面上所有可能的表格元素。
   * @returns {Array<HTMLElement>} - 表格元素的陣列。
   */
  const findTables = () => {
    const allTableElements = Array.from(document.querySelectorAll('table, div[class*="table"], div[class*="grid"], div[role="table"]'));
    
    const validTables = allTableElements.filter(table => {
      if (table.tagName === 'TABLE') {
        return table.rows.length > 0;
      }
      
      const children = Array.from(table.children);
      if (children.length > 1) {
          const firstRowCells = Array.from(children[0].children);
          return firstRowCells.length > 1;
      }
      return false;
    });

    return validTables;
  };

  return {
    formatTableContent,
    findTables,
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
    const tables = processor.findTables();
    if (tables.length === 0) {
      ui.showToast('頁面上沒有找到任何表格。');
      return;
    }

    ui.showSettingsModal(tables, (actionType) => {
      const selectedIndex = document.getElementById('table-select').value;
      const selectedFormat = document.getElementById('format-select').value;
      const includeHeader = document.getElementById('include-header').checked;
      
      let finalContent = '';
      let totalRowCount = 0;
      let tableCount = 0;

      if (selectedIndex === 'all') {
        const separator = `\n\n--- 表格分隔線：表格 #${selectedFormat.toUpperCase()} ---\n\n`;
        const allFormattedContents = tables.map((table, index) => {
          const { content, rowCount } = processor.formatTableContent(table, selectedFormat, includeHeader);
          totalRowCount += rowCount;
          return `--- 表格 #${index + 1} ---\n${content}`;
        }).join(separator);
        finalContent = allFormattedContents;
        tableCount = tables.length;
      } else {
        const selectedTable = tables[selectedIndex];
        if (!selectedTable) {
          ui.showToast('錯誤: 未選取表格。');
          return;
        }
        const { content, rowCount } = processor.formatTableContent(selectedTable, selectedFormat, includeHeader);
        finalContent = content;
        totalRowCount = rowCount;
        tableCount = 1;
      }

      if (actionType === 'copy') {
        io.copyToClipboard(finalContent, totalRowCount, tableCount);
      } else {
        const filenamePrefix = tableCount > 1 ? 'all_tables' : `table-${parseInt(selectedIndex)+1}`;
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
        
        io.downloadFile(
          `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}${extensionMap[selectedFormat]}`,
          finalContent,
          mimeTypeMap[selectedFormat],
          totalRowCount,
          tableCount
        );
      }
    }, (originalHtml) => {
        ui.showHtmlEditor(originalHtml);
    });
  };

  return {
    init,
  };
})(UIManager, IOHandler, ContentProcessor);

// 立即執行主應用程式
App.init();
