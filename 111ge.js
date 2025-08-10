/**
 * @fileoverview 網頁表格處理工具書籤小工具 v7.0
 *
 * v7.0 版本 - 【全能工作台】
 * 1.  **實現【雙向同步編輯】**：現在，直接在預覽區的儲存格中修改文字，會即時更新下方的HTML程式碼；反之，修改HTML程式碼也會立即刷新預覽區。兩者完美同步。
 * 2.  **恢復【即時互動編輯】**：使用者可以再次直接點擊預覽表格的儲存格來修改內容，享受所見即所得的便利。
 * 3.  **新增【框架資料讀取】（實驗性）**：新增一個按鈕，嘗試探測並讀取由 Vue/React 等現代框架動態生成的表格背後的原始JSON資料。
 * 4.  **融合所有優點**：本版本集先前所有版本的優點於一身：高保真預覽、即時互動編輯、整合式語法編輯、預覽縮放/截圖、以及強大的匯出與覆蓋網頁功能。
 */

//=============================================================================
// 模組 1: UI 管理器 (UIManager)
//=============================================================================
const UIManager = (function() {
    let state = {
        tables: [],
        originalCallbacks: {},
        lastSelectedIndex: -1,
        previewZoom: 1.0,
        syncTimeout: null // 用於 debounce
    };

    // ... 此處省略 showToast, highlightElement, closeModal, updatePreviewZoom, capturePreviewAsImage 等輔助函式 ...
    const showToast = (message) => {
        const existingToast = document.getElementById('bkm-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.id = 'bkm-toast';
        toast.textContent = message;
        Object.assign(toast.style, { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(0, 0, 0, 0.85)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: '10001', fontSize: '15px', fontFamily: 'system-ui, sans-serif', transition: 'opacity 0.3s ease, bottom 0.3s ease', opacity: '0', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', textAlign: 'center' });
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; toast.style.bottom = '30px'; }, 10);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.bottom = '20px'; setTimeout(() => toast.remove(), 300); }, 4000);
    };
    const highlightElement = (element, highlight) => {
        if (!element) return;
        if (highlight) { element.style.outline = '3px solid #007bff'; element.style.outlineOffset = '2px'; element.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else { element.style.outline = ''; }
    };
    const closeModal = () => {
        const modal = document.getElementById('bkm-modal');
        if (state.lastSelectedIndex > -1 && state.tables[state.lastSelectedIndex]) { highlightElement(state.tables[state.lastSelectedIndex], false); }
        if (modal) modal.remove();
    };
    const updatePreviewZoom = () => {
        const previewContent = document.querySelector('#bkm-preview-area > *');
        const zoomDisplay = document.getElementById('bkm-zoom-display');
        if (previewContent) { previewContent.style.transform = `scale(${state.previewZoom})`; previewContent.style.transformOrigin = 'top left'; }
        if (zoomDisplay) zoomDisplay.textContent = `${Math.round(state.previewZoom * 100)}%`;
    };
    const capturePreviewAsImage = () => {
        const node = document.getElementById('bkm-preview-area');
        const btn = document.getElementById('bkm-capture-btn');
        const originalText = btn.textContent;
        btn.textContent = '處理中...'; btn.disabled = true;
        const performCapture = () => {
            html2canvas(node, { useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `table-preview.png`; a.click();
            }).catch(err => showToast("截圖失敗：可能因網站安全限制(CORS)。")).finally(() => { btn.textContent = originalText; btn.disabled = false; });
        };
        if (typeof html2canvas === 'undefined') {
            showToast("首次使用，正在載入截圖函式庫...");
            const script = document.createElement('script'); script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = performCapture;
            script.onerror = () => { showToast("錯誤：無法載入截圖函式庫。"); btn.textContent = originalText; btn.disabled = false; };
            document.head.appendChild(script);
        } else { performCapture(); }
    };
    
    /**
     * 【核心】從預覽區的 DOM 變動，同步回 HTML 語法編輯器。
     * 使用 debounce 防止過於頻繁的更新導致效能問題。
     */
    const syncPreviewToCode = () => {
        clearTimeout(state.syncTimeout);
        state.syncTimeout = setTimeout(() => {
            const previewArea = document.getElementById('bkm-preview-area');
            const htmlEditor = document.getElementById('bkm-html-editor');
            if (previewArea && htmlEditor && previewArea.shadowRoot) {
                // 從 Shadow DOM 中獲取 table 的 outerHTML
                const tableInShadow = previewArea.shadowRoot.querySelector('table, div[role="table"]');
                if (tableInShadow) {
                    htmlEditor.value = tableInShadow.outerHTML;
                }
            }
        }, 300); // 延遲 300 毫秒觸發同步
    };
    
    /**
     * 【核心】從 HTML 和 CSS 語法編輯器的內容，更新預覽區。
     */
    const syncCodeToPreview = () => {
        const htmlEditor = document.getElementById('bkm-html-editor');
        const cssEditor = document.getElementById('bkm-css-editor');
        const previewArea = document.getElementById('bkm-preview-area');

        if (!htmlEditor || !cssEditor || !previewArea) return;
        
        let shadowRoot = previewArea.shadowRoot || previewArea.attachShadow({ mode: 'open' });
        
        shadowRoot.innerHTML = `
            <style>
                :host { all: initial; } /* CSS Reset for Shadow DOM */
                ${cssEditor.value}
                /* 基本樣式確保可見性 */
                table { border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 4px; }
            </style>
            ${htmlEditor.value}
        `;
        
        // 讓預覽區內的儲存格可以編輯
        shadowRoot.querySelectorAll('td, th').forEach(cell => {
            cell.setAttribute('contenteditable', 'true');
        });
        updatePreviewZoom();
    };

    /**
     * 顯示高保真預覽並填充編輯器。
     */
    const showPreview = (indexStr) => {
        if (state.lastSelectedIndex > -1 && state.tables[state.lastSelectedIndex]) {
            highlightElement(state.tables[state.lastSelectedIndex], false);
        }
        
        state.previewZoom = 1.0;
        const index = indexStr === 'all' ? 'all' : parseInt(indexStr, 10);
        state.lastSelectedIndex = index;
        
        const editorWrapper = document.getElementById('bkm-editor-wrapper');
        const htmlEditor = document.getElementById('bkm-html-editor');
        const cssEditor = document.getElementById('bkm-css-editor');
        const previewArea = document.getElementById('bkm-preview-area');

        if (index === 'all') {
            highlightElement(null, false);
            editorWrapper.style.display = 'none';
            if (previewArea.shadowRoot) previewArea.shadowRoot.innerHTML = '';
            previewArea.innerHTML = '<p style="text-align:center; color:#999; margin: 20px 0;">合併模式下無預覽或編輯功能</p>';
            htmlEditor.value = '';
            cssEditor.value = '';
        } else if (state.tables[index]) {
            editorWrapper.style.display = '';
            const tableElement = state.tables[index];
            highlightElement(tableElement, true);
            
            htmlEditor.value = tableElement.outerHTML;
            cssEditor.value = '';
            
            syncCodeToPreview();
        }
    };

    const attachMainViewEventListeners = (modalContent) => {
        modalContent.querySelector('#bkm-close-btn').onclick = closeModal;
        modalContent.querySelector('#bkm-table-select').onchange = (e) => showPreview(e.target.value);
        
        // ... 此處省略 prev/next/zoom/capture 按鈕事件綁定 ...
        modalContent.querySelector('#bkm-prev-btn').onclick = () => { let ci=parseInt(modalContent.querySelector('#bkm-table-select').value,10); modalContent.querySelector('#bkm-table-select').value=isNaN(ci)||ci<=0?state.tables.length-1:ci-1; modalContent.querySelector('#bkm-table-select').dispatchEvent(new Event('change')); };
        modalContent.querySelector('#bkm-next-btn').onclick = () => { let ci=parseInt(modalContent.querySelector('#bkm-table-select').value,10); modalContent.querySelector('#bkm-table-select').value=isNaN(ci)||ci>=state.tables.length-1?0:ci+1; modalContent.querySelector('#bkm-table-select').dispatchEvent(new Event('change')); };
        modalContent.querySelector('#bkm-zoom-in-btn').onclick = () => { state.previewZoom = parseFloat((state.previewZoom + 0.1).toFixed(2)); updatePreviewZoom(); };
        modalContent.querySelector('#bkm-zoom-out-btn').onclick = () => { state.previewZoom = parseFloat(Math.max(0.2, state.previewZoom - 0.1).toFixed(2)); updatePreviewZoom(); };
        modalContent.querySelector('#bkm-zoom-display').onclick = () => { state.previewZoom = 1.0; updatePreviewZoom(); };
        modalContent.querySelector('#bkm-capture-btn').onclick = capturePreviewAsImage;
        
        // 【核心】雙向同步事件綁定
        document.getElementById('bkm-html-editor').addEventListener('input', syncCodeToPreview);
        document.getElementById('bkm-css-editor').addEventListener('input', syncCodeToPreview);
        document.getElementById('bkm-preview-area').addEventListener('input', syncPreviewToCode);
        
        // 編輯器展開/收合
        const editorToggle = document.getElementById('bkm-editor-toggle');
        const editorPanel = document.getElementById('bkm-editor-panel');
        editorToggle.onclick = () => {
            const isHidden = editorPanel.style.display === 'none';
            editorPanel.style.display = isHidden ? 'flex' : 'none';
            editorToggle.textContent = isHidden ? '[-] 收合語法編輯器' : '[+] 展開語法編輯器';
        };

        // 主要操作按鈕
        modalContent.querySelector('#bkm-copy-btn').onclick = () => state.originalCallbacks.onConfirm('copy');
        modalContent.querySelector('#bkm-download-btn').onclick = () => state.originalCallbacks.onConfirm('download');
        modalContent.querySelector('#bkm-apply-to-page-btn').onclick = () => state.originalCallbacks.onApply();
        // 新增：實驗性功能按鈕
        modalContent.querySelector('#bkm-framework-btn').onclick = () => state.originalCallbacks.onReadFramework();
    };

    const showSettingsModal = (foundTables, callbacks) => {
        closeModal();
        state.tables = foundTables;
        state.originalCallbacks = callbacks;

        const modalHtml = `
            <div id="bkm-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:10000; display:flex; align-items:center; justify-content:center; font-family:system-ui, sans-serif;">
                <div id="bkm-modal-content" style="background:#f8f9fa; width:90%; max-width:800px; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.2); display:flex; flex-direction:column; max-height:90vh;">
                    <header style="padding:15px 25px; border-bottom:1px solid #dee2e6; display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="font-size:20px; margin:0; color:#333;">網頁表格處理工具 v7.0</h2>
                        <button id="bkm-close-btn" class="bkm-ctrl-btn">&times;</button>
                    </header>
                    <main style="padding:20px 25px; overflow-y:auto; flex-grow:1;">
                        <div style="display:flex; gap:10px; align-items:center; margin-bottom:15px;">
                            <label style="font-weight:600; flex-shrink:0;">選擇表格:</label>
                            <select id="bkm-table-select" style="flex-grow:1; padding:8px; font-size:14px; border:1px solid #ccc; border-radius:6px;">
                                 ${state.tables.length > 0 ? `<option value="all">所有表格合併 (僅導出)</option>` + state.tables.map((_, i) => `<option value="${i}">表格 #${i + 1}</option>`).join('') : '<option>未找到表格</option>'}
                            </select>
                            <div style="display:flex; gap:5px;"><button id="bkm-prev-btn" title="上一個" class="bkm-nav-btn">⬆︎</button><button id="bkm-next-btn" title="下一個" class="bkm-nav-btn">⬇︎</button></div>
                        </div>
                        <div class="bkm-card">
                             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:0 5px;">
                                <span style="font-weight:600; font-size:15px;">雙向同步預覽</span>
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <button id="bkm-zoom-out-btn" title="縮小" class="bkm-ctrl-btn">-</button>
                                    <button id="bkm-zoom-display" title="重設縮放" class="bkm-ctrl-btn" style="min-width:45px;">100%</button>
                                    <button id="bkm-zoom-in-btn" title="放大" class="bkm-ctrl-btn">+</button>
                                    <button id="bkm-capture-btn" title="截圖" class="bkm-ctrl-btn">截圖</button>
                                </div>
                            </div>
                            <div id="bkm-preview-area" style="height:250px; overflow:auto; border:1px solid #ddd; padding:10px; background:#fff; border-radius:6px; resize:vertical;"></div>
                        </div>
                         <div id="bkm-editor-wrapper" class="bkm-card" style="margin-top:15px;">
                             <button id="bkm-editor-toggle" style="width:100%; text-align:left; padding:8px; font-weight:bold; border:1px solid #ccc; border-radius:6px; background-color:#e9ecef; cursor:pointer;">[+] 展開語法編輯器</button>
                             <div id="bkm-editor-panel" style="display:none; margin-top:10px; display:flex; gap:15px; height: 200px;">
                                <div style="flex:1; display:flex; flex-direction:column;">
                                    <label style="font-weight:500; margin-bottom:5px;">HTML</label>
                                    <textarea id="bkm-html-editor" style="flex:1; width:100%; font-family:monospace; font-size:14px; padding:10px; border:1px solid #ccc; border-radius:6px; resize:none;"></textarea>
                                </div>
                                <div style="flex:1; display:flex; flex-direction:column;">
                                    <label style="font-weight:500; margin-bottom:5px;">CSS</label>
                                    <textarea id="bkm-css-editor" placeholder="例如：td { color: red; }" style="flex:1; width:100%; font-family:monospace; font-size:14px; padding:10px; border:1px solid #ccc; border-radius:6px; resize:none;"></textarea>
                                </div>
                             </div>
                         </div>
                        <div class="bkm-card" style="margin-top:20px;">
                            <div style="display:flex; gap:15px; align-items:flex-end;">
                                <div style="flex-grow:1;">
                                    <label style="font-weight:500; display:block; margin-bottom:5px; font-size:14px;">匯出格式:</label>
                                    <select id="bkm-format-select" style="width:100%; padding:8px; font-size:14px; border:1px solid #ccc; border-radius:6px;"><option value="tsv">TSV (Excel)</option><option value="csv">CSV</option><option value="markdown">Markdown</option><option value="json">JSON</option><option value="html">HTML (編輯後)</option></select>
                                </div>
                                <label style="display:flex; align-items:center; padding-bottom:8px; cursor:pointer;"><input type="checkbox" id="bkm-include-header" checked style="margin-right:8px; transform:scale(1.2);"><span>包含表頭(適用TSV/CSV/MD)</span></label>
                            </div>
                        </div>
                    </main>
                    <footer style="padding:15px 25px; border-top:1px solid #dee2e6; background:#f1f3f5; display:flex; gap:15px; border-radius: 0 0 12px 12px; align-items:center;">
                        <button id="bkm-framework-btn" class="bkm-action-btn" style="flex:0.8; background-color:#17a2b8; color:white;" title="實驗性功能，嘗試讀取Vue/React等框架背後的原始數據">讀取框架資料</button>
                        <div style="flex: 0.2;"></div>
                        <button id="bkm-copy-btn" class="bkm-action-btn bkm-btn-primary">複製</button>
                        <button id="bkm-download-btn" class="bkm-action-btn bkm-btn-success">下載</button>
                        <button id="bkm-apply-to-page-btn" class="bkm-action-btn bkm-btn-danger">套用回網頁</button>
                    </footer>
                </div>
            </div>
            <style>
                .bkm-nav-btn { padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; background-color: #fff; cursor: pointer; font-size: 16px; }
                .bkm-ctrl-btn { padding: 6px 12px; border: 1px solid #ccc; border-radius: 5px; background-color: #fff; cursor: pointer; font-size: 13px; font-weight:500; }
                .bkm-ctrl-btn:hover, .bkm-nav-btn:hover { background-color: #e9ecef; }
                .bkm-action-btn { flex: 1; padding: 12px 20px; font-size: 16px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align:center;}
                .bkm-btn-primary { background-color: #007bff; color: white; } .bkm-btn-primary:hover { background-color: #0056b3; transform: translateY(-2px); }
                .bkm-btn-success { background-color: #28a745; color: white; } .bkm-btn-success:hover { background-color: #1e7e34; transform: translateY(-2px); }
                .bkm-btn-danger { background-color: #dc3545; color: white; } .bkm-btn-danger:hover { background-color: #c82333; transform: translateY(-2px); }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        attachMainViewEventListeners(document.getElementById('bkm-modal-content'));
        
        const tableSelect = document.getElementById('bkm-table-select');
        if (state.tables.length > 0) { tableSelect.value = 0; showPreview(0); }
    };
    
    return { state, showSettingsModal, closeModal, showToast };
})();

//=============================================================================
// 模組 2: 內容處理器 (ContentProcessor)
//=============================================================================
const ContentProcessor = (function() {
    const getCleanCellText = (cell) => (cell.textContent || '').trim().replace(/\s+/g, ' ');
    const parseFromElement = (tableElement) => {
        if (!tableElement || typeof tableElement.querySelectorAll !== 'function') return [];
        const data = []; const rows = Array.from(tableElement.querySelectorAll('tr'));
        let maxCols = 0;
        rows.forEach(row => maxCols = Math.max(maxCols, row.cells.length));
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]; let dataCol = 0;
            for (let j = 0; j < row.cells.length; j++) {
                const cell = row.cells[j]; const text = getCleanCellText(cell);
                const rs = cell.rowSpan || 1; const cs = cell.colSpan || 1;
                while (data[i] && data[i][dataCol]) { dataCol++; }
                for (let r = 0; r < rs; r++) {
                    const tr = i + r; if (!data[tr]) data[tr] = [];
                    for (let c = 0; c < cs; c++) { data[tr][dataCol + c] = text; }
                }
                dataCol += cs;
            }
        }
        return data;
    };
    const findTables = () => Array.from(document.querySelectorAll('table, div[role="table"]')).filter(el => !el.closest('#bkm-modal'));
    const formatData = (tableData, options) => {
        let data = tableData.map(row => [...row]);
        if (!options.includeHeader) { data.shift(); }
        const rowCount = data.length;
        if (rowCount === 0) return { content: '', rowCount: 0 };
        switch (options.format) {
            case 'tsv': return { content: data.map(r => r.join('\t')).join('\n'), rowCount };
            case 'csv': return { content: data.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n'), rowCount };
            case 'markdown':
                if(data.length === 0) return { content: '', rowCount: 0 };
                const widths = data[0].map((_, i) => Math.max(...data.map(row => (row[i] || '').length)));
                const formatRow = (r) => '| ' + r.map((c, i) => (c || '').padEnd(widths[i])).join(' | ') + ' |';
                let md = formatRow(data[0]) + '\n|-' + widths.map(w => '-'.repeat(w)).join('-|-') + '-|\n' + data.slice(1).map(formatRow).join('\n');
                return { content: md, rowCount };
            case 'json':
                const keys = options.includeHeader ? data.shift() : [];
                const jsonData = data.map(r => keys.reduce((o, k, i) => ({ ...o, [k]: r[i] || null }), {}));
                return { content: JSON.stringify(jsonData, null, 2), rowCount: data.length };
            default: return { content: '', rowCount: 0 };
        }
    };
    return { findTables, parseFromElement, formatData };
})();

//=============================================================================
// 模組 3: 主應用程式 (App)
//=============================================================================
const App = (function(ui, processor) {
    const init = () => {
        const tables = processor.findTables();
        if (tables.length === 0) { ui.showToast('此頁面未找到任何有效的表格。'); return; }

        ui.showSettingsModal(tables, {
            onConfirm: (actionType) => {
                const state = ui.state;
                const html = document.getElementById('bkm-html-editor').value;
                const css = document.getElementById('bkm-css-editor').value;
                const format = document.getElementById('bkm-format-select').value;

                if (format === 'html') {
                    const finalHtml = `<style>${css}</style>\n${html}`;
                    if (actionType === 'copy') navigator.clipboard.writeText(finalHtml).then(() => ui.showToast('已複製HTML+CSS。'));
                    else {
                        const blob = new Blob([finalHtml], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = 'edited_table.html'; a.click();
                        URL.revokeObjectURL(url); ui.showToast('已下載HTML檔案。');
                    }
                    return;
                }

                const tempDiv = document.createElement('div'); tempDiv.innerHTML = html;
                const editedEl = tempDiv.querySelector('table, div[role="table"]');
                if (!editedEl) { ui.showToast("錯誤：在編輯器中找不到表格。"); return; }
                
                const data = processor.parseFromElement(editedEl);
                const options = { format, includeHeader: document.getElementById('bkm-include-header').checked };
                const { content, rowCount } = processor.formatData(data, options);
                
                if (!content.trim()) { ui.showToast('沒有資料可供匯出。'); return; }

                if (actionType === 'copy') navigator.clipboard.writeText(content).then(() => ui.showToast(`已複製 ${rowCount} 列資料。`));
                else {
                    const mime = { tsv: 'text/tab-separated-values', csv: 'text/csv', markdown: 'text/plain', json: 'application/json' };
                    const ext = { tsv: 'tsv', csv: 'csv', markdown: 'md', json: 'json' };
                    const blob = new Blob([content], { type: mime[format] });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `table.${ext[format]}`; a.click();
                    URL.revokeObjectURL(url); ui.showToast('已下載檔案。');
                }
            },
            onApply: () => {
                const state = ui.state;
                if (state.lastSelectedIndex < 0) return;
                if (confirm("【高風險操作】\n\n這將會用編輯器中的程式碼直接修改當前網頁，此操作無法復原。\n您確定嗎？")) {
                    const html = document.getElementById('bkm-html-editor').value;
                    const css = document.getElementById('bkm-css-editor').value;
                    const finalHtml = `<style>${css}</style>${html}`;
                    const originalEl = state.tables[state.lastSelectedIndex];
                    if (originalEl && originalEl.parentElement) {
                        originalEl.outerHTML = finalHtml;
                        ui.showToast('已成功將修改套用至網頁！');
                        ui.closeModal();
                    } else { ui.showToast('套用失敗：找不到原始元素。'); }
                }
            },
            onReadFramework: () => {
                const state = ui.state;
                if (state.lastSelectedIndex < 0) { ui.showToast("請先選擇一個表格進行探測。"); return; }
                const el = state.tables[state.lastSelectedIndex];
                let vueInst = null;
                let elPath = [];
                let current = el;
                while (current && !vueInst) {
                    elPath.push(current.tagName);
                    vueInst = current.__vue__;
                    current = current.parentElement;
                }
                
                if (vueInst) {
                    let bestGuess = null;
                    let maxLen = 0;
                    for (const key in vueInst) {
                        const prop = vueInst[key];
                        if (Array.isArray(prop) && prop.length > maxLen && prop.every(item => typeof item === 'object' && item !== null)) {
                            maxLen = prop.length;
                            bestGuess = prop;
                        }
                    }
                    if(bestGuess){
                        const jsonData = JSON.stringify(bestGuess, null, 2);
                        navigator.clipboard.writeText(jsonData).then(() => {
                           ui.showToast(`成功! 在 ${elPath.reverse().join(' > ')} 找到一個 ${maxLen} 列的資料陣列並已複製到剪貼簿。`);
                        });
                    } else {
                        ui.showToast("找到了Vue實例，但未能自動猜測出主要的資料陣列。");
                    }
                } else {
                    ui.showToast("探測失敗，未在選定表格的父層級中找到 Vue.js 實例。");
                }
            }
        });
    };
    return { init };
})(UIManager, ContentProcessor);

// 立即執行主應用程式
App.init();
