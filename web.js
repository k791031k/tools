javascript:(function(){
    if (window.htmlEditorSelector) {
        window.htmlEditorSelector.destroy();
    }
    
    window.htmlEditorSelector = {
        isActive: false,
        selectedElement: null,
        overlay: null,
        notification: null,
        
        init: function() {
            this.isActive = true;
            this.createOverlay();
            this.createNotification();
            this.addEventListeners();
            this.showNotification('🎯 HTML區塊選擇器已啟動<br>移動滑鼠選擇區塊，點擊確認選擇<br>按ESC取消', 'info');
        },
        
        createOverlay: function() {
            this.overlay = document.createElement('div');
            this.overlay.id = 'html-editor-overlay';
            this.overlay.style.cssText = `
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(102, 126, 234, 0.1) !important;
                z-index: 999999 !important;
                pointer-events: none !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            `;
            document.body.appendChild(this.overlay);
            
            this.selectionBox = document.createElement('div');
            this.selectionBox.id = 'html-editor-selection-box';
            this.selectionBox.style.cssText = `
                position: absolute !important;
                border: 2px solid #667eea !important;
                background: rgba(102, 126, 234, 0.2) !important;
                pointer-events: none !important;
                z-index: 1000000 !important;
                display: none !important;
                border-radius: 4px !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
            `;
            this.overlay.appendChild(this.selectionBox);
            
            this.infoLabel = document.createElement('div');
            this.infoLabel.id = 'html-editor-info-label';
            this.infoLabel.style.cssText = `
                position: absolute !important;
                background: #667eea !important;
                color: white !important;
                padding: 4px 8px !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                z-index: 1000001 !important;
                display: none !important;
                max-width: 200px !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
            `;
            this.overlay.appendChild(this.infoLabel);
        },
        
        createNotification: function() {
            this.notification = document.createElement('div');
            this.notification.id = 'html-editor-notification';
            this.notification.style.cssText = `
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                background: white !important;
                border: 1px solid #ddd !important;
                border-radius: 6px !important;
                padding: 15px 20px !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                z-index: 1000002 !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
                max-width: 350px !important;
                transform: translateX(400px) !important;
                transition: transform 0.3s ease !important;
            `;
            document.body.appendChild(this.notification);
        },
        
        showNotification: function(message, type = 'info') {
            const colors = {
                info: '#667eea',
                success: '#48bb78',
                warning: '#ed8936',
                error: '#f56565'
            };
            
            this.notification.innerHTML = message;
            this.notification.style.borderLeftColor = colors[type];
            this.notification.style.borderLeftWidth = '4px';
            this.notification.style.transform = 'translateX(0)';
            
            setTimeout(() => {
                if (this.notification) {
                    this.notification.style.transform = 'translateX(400px)';
                }
            }, type === 'error' ? 5000 : 3000);
        },
        
        addEventListeners: function() {
            this.mouseMoveHandler = this.handleMouseMove.bind(this);
            this.clickHandler = this.handleClick.bind(this);
            this.keyHandler = this.handleKeyPress.bind(this);
            
            document.addEventListener('mousemove', this.mouseMoveHandler);
            document.addEventListener('click', this.clickHandler);
            document.addEventListener('keydown', this.keyHandler);
        },
        
        handleMouseMove: function(e) {
            if (!this.isActive) return;
            
            const element = document.elementFromPoint(e.clientX, e.clientY);
            if (!element || element === this.overlay || element === this.selectionBox || element === this.infoLabel) return;
            
            this.selectedElement = element;
            this.highlightElement(element);
        },
        
        highlightElement: function(element) {
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            this.selectionBox.style.display = 'block';
            this.selectionBox.style.top = (rect.top + scrollTop) + 'px';
            this.selectionBox.style.left = (rect.left + scrollLeft) + 'px';
            this.selectionBox.style.width = rect.width + 'px';
            this.selectionBox.style.height = rect.height + 'px';
            
            let tagInfo = element.tagName.toLowerCase();
            if (element.id) tagInfo += '#' + element.id;
            if (element.className) tagInfo += '.' + element.className.split(' ').slice(0, 2).join('.');
            
            this.infoLabel.textContent = tagInfo;
            this.infoLabel.style.display = 'block';
            this.infoLabel.style.top = (rect.top + scrollTop - 25) + 'px';
            this.infoLabel.style.left = (rect.left + scrollLeft) + 'px';
        },
        
        handleClick: function(e) {
            if (!this.isActive) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            if (this.selectedElement) {
                this.selectElement(this.selectedElement);
            }
        },
        
        selectElement: function(element) {
            this.showNotification('🚀 正在匯入選中的HTML區塊...', 'info');
            
            const htmlContent = element.outerHTML;
            const editorData = {
                html: htmlContent,
                timestamp: new Date().toISOString(),
                source: window.location.href,
                elementInfo: {
                    tagName: element.tagName,
                    id: element.id,
                    className: element.className,
                    textLength: element.textContent.length
                }
            };
            
            localStorage.setItem('htmlEditorData', JSON.stringify(editorData));
            this.openEditor();
            this.destroy();
        },
        
        openEditor: function() {
            const editorHTML = this.getEditorHTML();
            const newWindow = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
            
            if (newWindow) {
                newWindow.document.write(editorHTML);
                newWindow.document.close();
                this.showNotification('✅ 編輯工具已在新視窗開啟', 'success');
            } else {
                this.showNotification('❌ 請允許彈出視窗以開啟編輯工具', 'error');
            }
        },
        
        handleKeyPress: function(e) {
            if (e.key === 'Escape') {
                this.destroy();
            }
        },
        
        destroy: function() {
            this.isActive = false;
            
            if (this.overlay) {
                document.body.removeChild(this.overlay);
                this.overlay = null;
            }
            
            if (this.notification) {
                this.notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (this.notification && this.notification.parentNode) {
                        document.body.removeChild(this.notification);
                    }
                }, 300);
                this.notification = null;
            }
            
            document.removeEventListener('mousemove', this.mouseMoveHandler);
            document.removeEventListener('click', this.clickHandler);
            document.removeEventListener('keydown', this.keyHandler);
        },
        
        getEditorHTML: function() {
            return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>專業HTML編輯工具 - 完整版</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Microsoft JhengHei', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        
        .tool-container {
            max-width: 1600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .tool-header {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            text-align: center;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .tool-header h1 {
            margin: 0;
            font-size: 24px;
        }
        
        .tool-header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            opacity: 0.9;
        }
        
        .tool-content {
            display: flex;
            height: calc(100vh - 120px);
            margin-top: 120px;
        }
        
        .left-panel {
            width: 350px;
            background: #fafafa;
            border-right: 1px solid #ddd;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }
        
        .right-panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }
        
        .input-group {
            margin-bottom: 15px;
        }
        
        .input-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
            font-size: 14px;
        }
        
        .input-group textarea {
            width: 100%;
            height: 120px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: 'Consolas', monospace;
            font-size: 12px;
            resize: vertical;
            transition: border-color 0.3s ease;
        }
        
        .input-group textarea:focus {
            border-color: #667eea;
            outline: none;
        }
        
        .input-group input[type="text"],
        .input-group input[type="number"],
        .input-group input[type="url"],
        .input-group select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.3s ease;
        }
        
        .input-group input:focus,
        .input-group select:focus {
            border-color: #667eea;
            outline: none;
        }
        
        .input-row {
            display: flex;
            gap: 10px;
        }
        
        .input-row .input-group {
            flex: 1;
        }
        
        .btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.3s ease;
            margin-right: 8px;
            margin-bottom: 8px;
        }
        
        .btn:hover {
            background: #5a67d8;
            transform: translateY(-1px);
        }
        
        .btn-success {
            background: #48bb78;
        }
        
        .btn-success:hover {
            background: #38a169;
        }
        
        .btn-warning {
            background: #ed8936;
        }
        
        .btn-warning:hover {
            background: #dd6b20;
        }
        
        .btn-danger {
            background: #f56565;
        }
        
        .btn-danger:hover {
            background: #e53e3e;
        }
        
        .btn-small {
            padding: 6px 12px;
            font-size: 12px;
        }
        
        .btn-full {
            width: 100%;
            margin-right: 0;
        }
        
        .btn-group {
            display: flex;
            gap: 5px;
            margin-bottom: 10px;
        }
        
        #preview {
            border: 1px solid #ddd;
            min-height: 500px;
            padding: 15px;
            background: white;
            border-radius: 4px;
            position: relative;
            overflow: auto;
        }
        
        .selectable-element {
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .selectable-element:hover {
            outline: 2px dashed #667eea;
            outline-offset: 2px;
        }
        
        .selected-element {
            outline: 2px solid #f56565 !important;
            outline-offset: 2px;
            background-color: rgba(245, 101, 101, 0.1) !important;
        }
        
        .dragging {
            opacity: 0.5;
        }
        
        .drop-zone {
            background-color: rgba(102, 126, 234, 0.1);
            border: 2px dashed #667eea;
        }
        
        .element-info {
            background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
            border-left: 4px solid #667eea;
        }
        
        .batch-info {
            background: #fff3cd;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
            font-size: 14px;
            border-left: 4px solid #ffc107;
        }
        
        .divider {
            height: 1px;
            background: #ddd;
            margin: 20px 0;
        }
        
        .color-picker {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .color-picker input[type="color"] {
            width: 40px;
            height: 35px;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .status-message {
            background: #48bb78;
            color: white;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
            font-size: 14px;
        }
        
        .error-message {
            background: #f56565;
            color: white;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
            font-size: 14px;
        }
        
        .import-info {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
            border-left: 4px solid #48bb78;
        }
        
        .history-info {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 12px;
            color: #666;
        }
        
        .quick-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-bottom: 15px;
        }
        
        .element-path {
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            margin-bottom: 15px;
            border: 1px solid #e9ecef;
        }
        
        .shortcuts-info {
            background: #e8f4f8;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 12px;
        }
        
        .shortcuts-info h4 {
            margin: 0 0 10px 0;
            color: #2c5282;
        }
        
        .shortcuts-info ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .shortcuts-info li {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="tool-container">
        <div class="tool-header">
            <h1>專業HTML編輯工具 - 完整版</h1>
            <p>書簽匯入 + 批次操作 + 歷史記錄 + 完整編輯功能</p>
        </div>
        
        <div class="tool-content">
            <div class="left-panel">
                <div class="status-message" id="statusMessage"></div>
                <div class="error-message" id="errorMessage"></div>
                
                <div class="import-info" id="importInfo">
                    <strong>匯入資訊：</strong><br>
                    正在載入書簽匯入的內容...
                </div>
                
                <div class="input-group">
                    <label for="htmlInput">HTML程式碼：</label>
                    <textarea id="htmlInput" placeholder="HTML內容將自動載入..."></textarea>
                    
                    <div class="btn-group">
                        <button class="btn btn-success" onclick="loadHTML()">重新載入</button>
                        <button class="btn btn-warning" onclick="clearAll()">清除全部</button>
                    </div>
                </div>
                
                <div class="divider"></div>
                
                <div class="batch-info" id="batchInfo">已選取 0 個元素</div>
                
                <div class="element-info" id="elementInfo">
                    <strong>選取元素資訊：</strong><br>
                    請點擊預覽區域中的元素來選取並編輯
                </div>
                
                <div class="element-path" id="elementPath">
                    未選取元素
                </div>
                
                <div class="quick-actions">
                    <button class="btn btn-small" onclick="duplicateElement()">複製元素</button>
                    <button class="btn btn-small btn-danger" onclick="deleteElement()">刪除元素</button>
                    <button class="btn btn-small" onclick="moveElementUp()">上移</button>
                    <button class="btn btn-small" onclick="moveElementDown()">下移</button>
                </div>
                
                <div class="input-group">
                    <label for="textContent">文字內容：</label>
                    <textarea id="textContent" placeholder="編輯選取元素的文字內容" rows="3"></textarea>
                </div>
                
                <div class="input-group">
                    <label for="fontFamily">字型：</label>
                    <select id="fontFamily">
                        <option value="">預設字型</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="'Microsoft JhengHei', sans-serif">微軟正黑體</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="'Courier New', monospace">Courier New</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="'Noto Sans TC', sans-serif">Noto Sans TC</option>
                    </select>
                </div>
                
                <div class="input-row">
                    <div class="input-group">
                        <label for="fontSize">字型大小：</label>
                        <input type="number" id="fontSize" min="1" max="100" value="16">
                    </div>
                    <div class="input-group">
                        <label for="fontWeight">字重：</label>
                        <select id="fontWeight">
                            <option value="">預設</option>
                            <option value="normal">normal</option>
                            <option value="bold">bold</option>
                            <option value="lighter">lighter</option>
                            <option value="bolder">bolder</option>
                        </select>
                    </div>
                </div>
                
                <div class="input-group">
                    <label>文字顏色：</label>
                    <div class="color-picker">
                        <input type="color" id="textColor" value="#000000">
                        <input type="text" id="textColorHex" value="#000000" placeholder="#000000">
                    </div>
                </div>
                
                <div class="input-group">
                    <label>背景顏色：</label>
                    <div class="color-picker">
                        <input type="color" id="bgColor" value="#ffffff">
                        <input type="text" id="bgColorHex" value="#ffffff" placeholder="#ffffff">
                    </div>
                </div>
                
                <div class="input-row">
                    <div class="input-group">
                        <label for="width">寬度：</label>
                        <input type="text" id="width" placeholder="100px, 50%, auto">
                    </div>
                    <div class="input-group">
                        <label for="height">高度：</label>
                        <input type="text" id="height" placeholder="100px, 50%, auto">
                    </div>
                </div>
                
                <div class="input-row">
                    <div class="input-group">
                        <label for="padding">內邊距：</label>
                        <input type="number" id="padding" min="0" max="100" value="0">
                    </div>
                    <div class="input-group">
                        <label for="margin">外邊距：</label>
                        <input type="number" id="margin" min="0" max="100" value="0">
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-success" onclick="applyChanges()">套用變更</button>
                    <button class="btn" onclick="resetElement()">重設元素</button>
                </div>
                
                <div class="divider"></div>
                
                <div class="history-info" id="historyInfo">
                    歷史記錄：可復原 0 步，可重做 0 步
                </div>
                
                <div class="btn-group">
                    <button class="btn" onclick="undo()">復原</button>
                    <button class="btn" onclick="redo()">重做</button>
                </div>
                
                <div class="divider"></div>
                
                <div class="btn-group">
                    <button class="btn btn-success" onclick="copyToClipboard()">複製語法</button>
                    <button class="btn" onclick="exportHTML()">匯出HTML</button>
                </div>
                
                <div class="btn-group">
                    <button class="btn" onclick="beautifyHTML()">美化程式碼</button>
                    <button class="btn" onclick="minifyHTML()">壓縮程式碼</button>
                </div>
                
                <div class="shortcuts-info">
                    <h4>快捷鍵：</h4>
                    <ul>
                        <li>Ctrl+Z: 復原</li>
                        <li>Ctrl+Y: 重做</li>
                        <li>Delete: 刪除元素</li>
                        <li>Shift+點擊: 批次選取</li>
                        <li>Ctrl+S: 匯出HTML</li>
                        <li>Ctrl+C: 複製語法</li>
                    </ul>
                </div>
            </div>
            
            <div class="right-panel">
                <h3>即時預覽區域</h3>
                <div id="preview" ondrop="drop(event)" ondragover="allowDrop(event)">
                    <p style="text-align: center; color: #666; padding: 50px;">
                        正在載入書簽匯入的HTML內容...
                    </p>
                </div>
            </div>
        </div>
    </div>

    <script>
        let selectedElements = [];
        let originalStyles = new Map();
        let draggedElement = null;
        let historyStack = [];
        let redoStack = [];
        let isShiftPressed = false;
        
        // 載入匯入的數據
        function loadImportedData() {
            const importedData = localStorage.getItem('htmlEditorData');
            if (importedData) {
                try {
                    const data = JSON.parse(importedData);
                    document.getElementById('htmlInput').value = data.html;
                    
                    // 更新匯入資訊
                    const importInfo = document.getElementById('importInfo');
                    importInfo.innerHTML = \`
                        <strong>匯入資訊：</strong><br>
                        來源頁面：\${data.source}<br>
                        元素類型：\${data.elementInfo.tagName}<br>
                        文字長度：\${data.elementInfo.textLength} 字元<br>
                        匯入時間：\${new Date(data.timestamp).toLocaleString('zh-TW')}
                    \`;
                    
                    // 自動載入預覽
                    setTimeout(() => {
                        loadHTML();
                        localStorage.removeItem('htmlEditorData');
                    }, 500);
                    
                } catch (error) {
                    showError('載入匯入數據失敗：' + error.message);
                }
            } else {
                // 如果沒有匯入數據，提供手動輸入功能
                document.getElementById('importInfo').innerHTML = \`
                    <strong>手動模式：</strong><br>
                    請在上方文字框中輸入HTML程式碼，然後點擊「重新載入」
                \`;
            }
        }
        
        // 載入HTML
        function loadHTML() {
            const input = document.getElementById('htmlInput').value.trim();
            const preview = document.getElementById('preview');
            
            if (!input) {
                showError('沒有HTML內容可載入');
                return;
            }
            
            try {
                pushToHistory(preview.innerHTML);
                preview.innerHTML = input;
                makeElementsInteractive();
                showStatus('HTML載入成功！現在可以點擊元素進行編輯');
                saveDraft();
                updateHistoryInfo();
            } catch (error) {
                showError('HTML載入失敗：' + error.message);
            }
        }
        
        // 使元素可互動
        function makeElementsInteractive() {
            const preview = document.getElementById('preview');
            const elements = preview.querySelectorAll('*');
            
            elements.forEach((element, index) => {
                if (!element.id) {
                    element.id = 'element-' + index;
                }
                
                element.classList.add('selectable-element');
                element.draggable = true;
                
                // 移除舊的事件監聽器
                element.removeEventListener('click', handleElementClick);
                element.removeEventListener('dragstart', handleDragStart);
                element.removeEventListener('dragend', handleDragEnd);
                
                // 添加新的事件監聽器
                element.addEventListener('click', handleElementClick);
                element.addEventListener('dragstart', handleDragStart);
                element.addEventListener('dragend', handleDragEnd);
                
                // 儲存原始樣式
                if (!originalStyles.has(element.id)) {
                    originalStyles.set(element.id, {
                        color: element.style.color || '',
                        backgroundColor: element.style.backgroundColor || '',
                        fontSize: element.style.fontSize || '',
                        fontFamily: element.style.fontFamily || '',
                        fontWeight: element.style.fontWeight || '',
                        width: element.style.width || '',
                        height: element.style.height || '',
                        padding: element.style.padding || '',
                        margin: element.style.margin || ''
                    });
                }
            });
        }
        
        // 處理元素點擊
        function handleElementClick(e) {
            e.stopPropagation();
            const element = e.target;
            
            if (isShiftPressed) {
                // 批次選取
                if (selectedElements.includes(element)) {
                    selectedElements = selectedElements.filter(el => el !== element);
                    element.classList.remove('selected-element');
                } else {
                    selectedElements.push(element);
                    element.classList.add('selected-element');
                }
            } else {
                // 單選
                selectedElements.forEach(el => el.classList.remove('selected-element'));
                selectedElements = [element];
                element.classList.add('selected-element');
            }
            
            updateBatchInfo();
            updateElementInfo();
            updateElementPath();
        }
        
        // 處理拖拽開始
        function handleDragStart(e) {
            draggedElement = e.target;
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.id);
        }
        
        // 處理拖拽結束
        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            draggedElement = null;
        }
        
        // 更新批次資訊
        function updateBatchInfo() {
            const batchInfo = document.getElementById('batchInfo');
            batchInfo.textContent = \`已選取 \${selectedElements.length} 個元素\`;
            batchInfo.style.display = selectedElements.length > 1 ? 'block' : 'none';
        }
        
        // 更新元素資訊
        function updateElementInfo() {
            const info = document.getElementById('elementInfo');
            
            if (selectedElements.length === 0) {
                info.innerHTML = \`
                    <strong>選取元素資訊：</strong><br>
                    請點擊預覽區域中的元素來選取並編輯
                \`;
                return;
            }
            
            if (selectedElements.length === 1) {
                const element = selectedElements[0];
                info.innerHTML = \`
                    <strong>選取元素資訊：</strong><br>
                    標籤：&lt;\${element.tagName.toLowerCase()}&gt;<br>
                    ID：\${element.id || '無'}<br>
                    類別：\${element.className || '無'}<br>
                    文字長度：\${element.textContent ? element.textContent.length : 0} 字元<br>
                    尺寸：\${element.offsetWidth}×\${element.offsetHeight}px
                \`;
                
                // 更新編輯欄位
                updateEditFields(element);
            } else {
                info.innerHTML = \`
                    <strong>批次選取：</strong><br>
                    已選取 \${selectedElements.length} 個元素<br>
                    可以進行批次編輯、刪除或移動操作
                \`;
            }
        }
        
        // 更新元素路徑
        function updateElementPath() {
            const pathElement = document.getElementById('elementPath');
            
            if (selectedElements.length !== 1) {
                pathElement.textContent = selectedElements.length > 1 ? '批次選取模式' : '未選取元素';
                return;
            }
            
            const element = selectedElements[0];
            const path = [];
            let current = element;
            
            while (current && current !== document.getElementById('preview')) {
                let text = current.tagName.toLowerCase();
                if (current.id) text += '#' + current.id;
                if (current.className) text += '.' + current.className.split(' ').join('.');
                path.unshift(text);
                current = current.parentElement;
            }
            
            pathElement.textContent = path.join(' > ');
        }
        
        // 更新編輯欄位
        function updateEditFields(element) {
            const computedStyle = window.getComputedStyle(element);
            
            document.getElementById('textContent').value = element.textContent || '';
            document.getElementById('fontFamily').value = element.style.fontFamily || '';
            document.getElementById('fontSize').value = parseInt(computedStyle.fontSize) || 16;
            document.getElementById('fontWeight').value = element.style.fontWeight || '';
            
            const textColor = rgbToHex(computedStyle.color);
            document.getElementById('textColor').value = textColor;
            document.getElementById('textColorHex').value = textColor;
            
            const bgColor = rgbToHex(computedStyle.backgroundColor);
            document.getElementById('bgColor').value = bgColor;
            document.getElementById('bgColorHex').value = bgColor;
            
            document.getElementById('width').value = element.style.width || '';
            document.getElementById('height').value = element.style.height || '';
            document.getElementById('padding').value = parseInt(computedStyle.padding) || 0;
            document.getElementById('margin').value = parseInt(computedStyle.margin) || 0;
        }
        
        // 套用變更
        function applyChanges() {
            if (selectedElements.length === 0) {
                showError('請先選取元素');
                return;
            }
            
            pushToHistory(document.getElementById('preview').innerHTML);
            
            const textContent = document.getElementById('textContent').value;
            const fontFamily = document.getElementById('fontFamily').value;
            const fontSize = document.getElementById('fontSize').value;
            const fontWeight = document.getElementById('fontWeight').value;
            const textColor = document.getElementById('textColorHex').value;
            const bgColor = document.getElementById('bgColorHex').value;
            const width = document.getElementById('width').value;
            const height = document.getElementById('height').value;
            const padding = document.getElementById('padding').value;
            const margin = document.getElementById('margin').value;
            
            selectedElements.forEach(element => {
                if (textContent !== undefined) element.textContent = textContent;
                if (fontFamily) element.style.fontFamily = fontFamily;
                if (fontSize) element.style.fontSize = fontSize + 'px';
                if (fontWeight) element.style.fontWeight = fontWeight;
                if (textColor) element.style.color = textColor;
                if (bgColor) element.style.backgroundColor = bgColor;
                if (width) element.style.width = width;
                if (height) element.style.height = height;
                if (padding) element.style.padding = padding + 'px';
                if (margin) element.style.margin = margin + 'px';
            });
            
            updateElementInfo();
            saveDraft();
            updateHistoryInfo();
            showStatus(\`已套用變更到 \${selectedElements.length} 個元素\`);
        }
        
        // 重設元素
        function resetElement() {
            if (selectedElements.length === 0) {
                showError('請先選取元素');
                return;
            }
            
            pushToHistory(document.getElementById('preview').innerHTML);
            
            selectedElements.forEach(element => {
                const original = originalStyles.get(element.id);
                if (original) {
                    Object.assign(element.style, original);
                }
            });
            
            if (selectedElements.length === 1) {
                updateEditFields(selectedElements[0]);
            }
            
            updateHistoryInfo();
            saveDraft();
            showStatus(\`已重設 \${selectedElements.length} 個元素\`);
        }
        
        // 複製元素
        function duplicateElement() {
            if (selectedElements.length === 0) {
                showError('請先選取元素');
                return;
            }
            
            pushToHistory(document.getElementById('preview').innerHTML);
            
            selectedElements.forEach(element => {
                const clone = element.cloneNode(true);
                clone.id = 'element-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                
                if (element.parentNode) {
                    element.parentNode.insertBefore(clone, element.nextSibling);
                    makeElementInteractive(clone);
                }
            });
            
            updateHistoryInfo();
            saveDraft();
            showStatus(\`已複製 \${selectedElements.length} 個元素\`);
        }
        
        // 刪除元素
        function deleteElement() {
            if (selectedElements.length === 0) {
                showError('請先選取元素');
                return;
            }
            
            if (confirm(\`確定刪除 \${selectedElements.length} 個元素嗎？\`)) {
                pushToHistory(document.getElementById('preview').innerHTML);
                
                selectedElements.forEach(element => element.remove());
                selectedElements = [];
                
                updateBatchInfo();
                updateElementInfo();
                updateElementPath();
                updateHistoryInfo();
                saveDraft();
                showStatus('元素已刪除');
            }
        }
        
        // 上移元素
        function moveElementUp() {
            if (selectedElements.length !== 1) {
                showError('請選取單一元素');
                return;
            }
            
            const element = selectedElements[0];
            const prevSibling = element.previousElementSibling;
            
            if (prevSibling) {
                pushToHistory(document.getElementById('preview').innerHTML);
                element.parentNode.insertBefore(element, prevSibling);
                updateHistoryInfo();
                saveDraft();
                showStatus('元素已上移');
            } else {
                showError('元素已在最頂端');
            }
        }
        
        // 下移元素
        function moveElementDown() {
            if (selectedElements.length !== 1) {
                showError('請選取單一元素');
                return;
            }
            
            const element = selectedElements[0];
            const nextSibling = element.nextElementSibling;
            
            if (nextSibling) {
                pushToHistory(document.getElementById('preview').innerHTML);
                element.parentNode.insertBefore(nextSibling, element);
                updateHistoryInfo();
                saveDraft();
                showStatus('元素已下移');
            } else {
                showError('元素已在最底端');
            }
        }
        
        // 單獨為元素添加互動功能
        function makeElementInteractive(element) {
            element.classList.add('selectable-element');
            element.draggable = true;
            
            element.addEventListener('click', handleElementClick);
            element.addEventListener('dragstart', handleDragStart);
            element.addEventListener('dragend', handleDragEnd);
            
            if (!originalStyles.has(element.id)) {
                originalStyles.set(element.id, {
                    color: element.style.color || '',
                    backgroundColor: element.style.backgroundColor || '',
                    fontSize: element.style.fontSize || '',
                    fontFamily: element.style.fontFamily || '',
                    fontWeight: element.style.fontWeight || '',
                    width: element.style.width || '',
                    height: element.style.height || '',
                    padding: element.style.padding || '',
                    margin: element.style.margin || ''
                });
            }
        }
        
        // 拖放功能
        function allowDrop(ev) {
            ev.preventDefault();
            ev.target.classList.add('drop-zone');
        }
        
        function drop(ev) {
            ev.preventDefault();
            const target = ev.target;
            target.classList.remove('drop-zone');
            
            if (draggedElement && target !== draggedElement && target.appendChild) {
                try {
                    pushToHistory(document.getElementById('preview').innerHTML);
                    
                    if (selectedElements.length > 1) {
                        selectedElements.forEach(element => {
                            if (element !== target) {
                                target.appendChild(element);
                            }
                        });
                    } else {
                        target.appendChild(draggedElement);
                    }
                    
                    updateHistoryInfo();
                    saveDraft();
                    showStatus('元素移動成功');
                } catch (error) {
                    showError('移動失敗：' + error.message);
                }
            }
        }
        
        // 清除全部
        function clearAll() {
            if (confirm('確定要清除所有內容嗎？')) {
                pushToHistory(document.getElementById('preview').innerHTML);
                
                document.getElementById('htmlInput').value = '';
                document.getElementById('preview').innerHTML = \`
                    <p style="text-align: center; color: #666; padding: 50px;">
                        內容已清除，請重新匯入或輸入HTML
                    </p>
                \`;
                
                selectedElements = [];
                originalStyles.clear();
                updateBatchInfo();
                updateElementInfo();
                updateElementPath();
                updateHistoryInfo();
                
                localStorage.removeItem('draftHTML');
                localStorage.removeItem('draftInput');
                
                showStatus('所有內容已清除');
            }
        }
        
        // 複製到剪貼簿
        function copyToClipboard() {
            const preview = document.getElementById('preview');
            
            if (!preview.innerHTML.trim() || preview.innerHTML.includes('正在載入')) {
                showError('沒有內容可以複製');
                return;
            }
            
            const cleanHTML = createCleanHTML(preview.innerHTML);
            
            navigator.clipboard.writeText(cleanHTML).then(() => {
                showStatus('HTML語法已複製到剪貼簿');
            }).catch(err => {
                showError('複製失敗：' + err.message);
            });
        }
        
        // 匯出HTML
        function exportHTML() {
            const preview = document.getElementById('preview');
            
            if (!preview.innerHTML.trim() || preview.innerHTML.includes('正在載入')) {
                showError('沒有內容可以匯出');
                return;
            }
            
            const cleanHTML = createCleanHTML(preview.innerHTML);
            
            const htmlContent = \`<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>編輯後的HTML</title>
</head>
<body>
\${cleanHTML}
</body>
</html>\`;
            
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'edited-html-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showStatus('HTML檔案已匯出');
        }
        
        // 創建乾淨的HTML
        function createCleanHTML(html) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            
            tempDiv.querySelectorAll('*').forEach(element => {
                element.classList.remove('selectable-element', 'selected-element', 'dragging', 'drop-zone');
                element.draggable = false;
            });
            
            return tempDiv.innerHTML;
        }
        
        // 美化HTML
        function beautifyHTML() {
            const preview = document.getElementById('preview');
            if (!preview.innerHTML.trim() || preview.innerHTML.includes('正在載入')) {
                showError('沒有內容可以美化');
                return;
            }
            
            try {
                const cleanHTML = createCleanHTML(preview.innerHTML);
                const beautified = beautifyHTMLString(cleanHTML);
                document.getElementById('htmlInput').value = beautified;
                showStatus('HTML已美化並更新到輸入框');
            } catch (error) {
                showError('美化失敗：' + error.message);
            }
        }
        
        // 壓縮HTML
        function minifyHTML() {
            const preview = document.getElementById('preview');
            if (!preview.innerHTML.trim() || preview.innerHTML.includes('正在載入')) {
                showError('沒有內容可以壓縮');
                return;
            }
            
            try {
                const cleanHTML = createCleanHTML(preview.innerHTML);
                const minified = cleanHTML.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
                document.getElementById('htmlInput').value = minified;
                showStatus('HTML已壓縮並更新到輸入框');
            } catch (error) {
                showError('壓縮失敗：' + error.message);
            }
        }
        
        // 簡單的HTML美化函數
        function beautifyHTMLString(html) {
            let formatted = '';
            let indent = 0;
            const tab = '  ';
            
            html.split(/(<[^>]*>)/g).forEach(element => {
                if (element.match(/^<\/\w/)) {
                    indent--;
                }
                
                if (element.trim()) {
                    formatted += tab.repeat(indent) + element.trim() + '\n';
                }
                
                if (element.match(/^<\w[^>]*[^\/]>$/)) {
                    indent++;
                }
            });
            
            return formatted.trim();
        }
        
        // 記錄歷史
        function pushToHistory(state) {
            if (state !== historyStack[historyStack.length - 1]) {
                historyStack.push(state);
                if (historyStack.length > 20) {
                    historyStack.shift();
                }
                redoStack = [];
                updateHistoryInfo();
            }
        }
        
        // 復原
        function undo() {
            if (historyStack.length === 0) {
                showError('沒有可復原的操作');
                return;
            }
            
            const currentState = document.getElementById('preview').innerHTML;
            redoStack.push(currentState);
            
            const previousState = historyStack.pop();
            document.getElementById('preview').innerHTML = previousState;
            
            makeElementsInteractive();
            selectedElements = [];
            updateBatchInfo();
            updateElementInfo();
            updateElementPath();
            updateHistoryInfo();
            saveDraft();
            showStatus('已復原');
        }
        
        // 重做
        function redo() {
            if (redoStack.length === 0) {
                showError('沒有可重做的操作');
                return;
            }
            
            const currentState = document.getElementById('preview').innerHTML;
            historyStack.push(currentState);
            
            const nextState = redoStack.pop();
            document.getElementById('preview').innerHTML = nextState;
            
            makeElementsInteractive();
            selectedElements = [];
            updateBatchInfo();
            updateElementInfo();
            updateElementPath();
            updateHistoryInfo();
            saveDraft();
            showStatus('已重做');
        }
        
        // 更新歷史資訊
        function updateHistoryInfo() {
            const info = document.getElementById('historyInfo');
            info.textContent = \`歷史記錄：可復原 \${historyStack.length} 步，可重做 \${redoStack.length} 步\`;
        }
        
        // 自動儲存草稿
        function saveDraft() {
            const previewContent = document.getElementById('preview').innerHTML;
            const inputContent = document.getElementById('htmlInput').value;
            
            if (!previewContent.includes('正在載入')) {
                localStorage.setItem('draftHTML', previewContent);
            }
            
            if (inputContent.trim()) {
                localStorage.setItem('draftInput', inputContent);
            }
        }
        
        // 載入草稿
        function loadDraft() {
            const draftHTML = localStorage.getItem('draftHTML');
            const draftInput = localStorage.getItem('draftInput');
            
            if (draftInput) {
                document.getElementById('htmlInput').value = draftInput;
            }
            
            if (draftHTML) {
                document.getElementById('preview').innerHTML = draftHTML;
                makeElementsInteractive();
                showStatus('已載入上次儲存的草稿');
            }
        }
        
        // 顯示狀態訊息
        function showStatus(message) {
            const statusMsg = document.getElementById('statusMessage');
            const errorMsg = document.getElementById('errorMessage');
            
            statusMsg.textContent = message;
            statusMsg.style.display = 'block';
            errorMsg.style.display = 'none';
            
            setTimeout(() => {
                statusMsg.style.display = 'none';
            }, 3000);
        }
        
        // 顯示錯誤訊息
        function showError(message) {
            const statusMsg = document.getElementById('statusMessage');
            const errorMsg = document.getElementById('errorMessage');
            
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
            statusMsg.style.display = 'none';
            
            setTimeout(() => {
                errorMsg.style.display = 'none';
            }, 5000);
        }
        
        // RGB轉HEX
        function rgbToHex(rgb) {
            if (!rgb || rgb === 'rgba(0, 0, 0, 0)') return '#ffffff';
            
            const match = rgb.match(/\d+/g);
            if (!match) return '#000000';
            
            const hex = match.slice(0, 3).map(x => {
                return parseInt(x).toString(16).padStart(2, '0');
            }).join('');
            
            return '#' + hex;
        }
        
        // 顏色選擇器同步
        document.getElementById('textColor').addEventListener('input', function(e) {
            document.getElementById('textColorHex').value = e.target.value;
        });
        
        document.getElementById('textColorHex').addEventListener('input', function(e) {
            document.getElementById('textColor').value = e.target.value;
        });
        
        document.getElementById('bgColor').addEventListener('input', function(e) {
            document.getElementById('bgColorHex').value = e.target.value;
        });
        
        document.getElementById('bgColorHex').addEventListener('input', function(e) {
            document.getElementById('bgColor').value = e.target.value;
        });
        
        // 鍵盤事件監聽
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Shift') {
                isShiftPressed = true;
            }
            
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                redo();
            }
            
            if (e.key === 'Delete' && selectedElements.length > 0) {
                e.preventDefault();
                deleteElement();
            }
            
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                exportHTML();
            }
            
            if (e.ctrlKey && e.key === 'c' && !window.getSelection().toString()) {
                e.preventDefault();
                copyToClipboard();
            }
        });
        
        document.addEventListener('keyup', function(e) {
            if (e.key === 'Shift') {
                isShiftPressed = false;
            }
        });
        
        // 頁面載入時執行
        window.addEventListener('load', function() {
            loadImportedData();
            updateHistoryInfo();
            
            // 設定自動儲存
            setInterval(saveDraft, 5000);
        });
        
        // 頁面卸載前保存
        window.addEventListener('beforeunload', function() {
            saveDraft();
        });
    </script>
</body>
</html>`;
        }
    };
    
    window.htmlEditorSelector.init();
})();
