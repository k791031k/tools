javascript: (function() {
    'use strict';

    /**
     * @fileoverview API 收集調試工具書籤小工具。
     * 此小工具會攔截頁面上的 AJAX (XHR) 和 Fetch API 請求，並將其記錄在可互動的 UI 介面中。
     * 使用者可以查看請求詳情、修改並重新發送請求，以及匯出請求日誌。
     */

    // ===================================
    // 模組一：應用程式設定與狀態管理 (AppConfig)
    // ===================================
    const AppConfig = {
        // 靜態設定
        SETTINGS: {
            TOOL_ID: 'full-api-collector',
            DEBOUNCE_DELAY: 300,
            ITEMS_PER_PAGE: 10,
            MAX_LOG_SIZE: 1000,
            DEFAULT_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            SUMMARY_KEYS: ['planCode', 'currentPage', 'orderBy', 'userId', 'action', 'id', 'type']
        },
        // 應用程式狀態
        state: {
            isRunning: false,
            logs: [],
            uiElements: {}, // 儲存 DOM 元素的參照
            originalAPIs: {
                XMLHttpRequest: window.XMLHttpRequest,
                fetch: window.fetch.bind(window),
                WebSocket: window.WebSocket
            },
            debounceTimer: null,
            currentPage: 1,
            isCollapsed: false,
            isMinimized: false,
            websockets: new Map(),
            activeView: 'list',
            tabs: [],
            activeTabId: null,
            sortKey: 'timestamp',
            sortDirection: 'desc'
        }
    };

    // ===================================
    // 模組二：安全工具函數 (Security)
    // ===================================
    const Security = {
        escapeHtml: function(unsafe) {
            if (typeof unsafe !== 'string') unsafe = String(unsafe);
            return unsafe
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
        setTextContent: function(element, text) {
            if (element && typeof element.textContent !== 'undefined') {
                element.textContent = text;
            }
        },
        validateUrl: function(url) {
            try {
                new URL(url);
                return true;
            } catch (e) {
                return false;
            }
        },
        validateJson: function(jsonString) {
            try {
                JSON.parse(jsonString);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    // ===================================
    // 模組三：資料處理與轉換 (DataHandlers)
    // ===================================
    const DataHandlers = {
        prettyPrintJSON: function(jsonString) {
            try {
                return JSON.stringify(JSON.parse(jsonString), null, 2);
            } catch (e) {
                return jsonString;
            }
        },
        highlightJSON: function(jsonString) {
            if (!jsonString) return '';
            let json = Security.escapeHtml(jsonString);
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\|[^"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
                let cls = 'number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'key';
                    } else {
                        cls = 'string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'boolean';
                } else if (/null/.test(match)) {
                    cls = 'null';
                }
                return `<span class="fac-hl-${cls}">${match}</span>`;
            });
        },
        generateCurl: function(item) {
            let c = `curl "${Security.escapeHtml(item.url)}" \\\n`;
            if (item.method && item.method.toUpperCase() !== 'GET') {
                c += `  -X ${item.method.toUpperCase()} \\\n`;
            }
            for (const k in item.requestHeaders) {
                let v = typeof item.requestHeaders.get === 'function' ? item.requestHeaders.get(k) : item.requestHeaders[k];
                if (v) {
                    c += `  -H "${Security.escapeHtml(k)}: ${Security.escapeHtml(String(v).replace(/"/g,'\\"'))}" \\\n`;
                }
            }
            if (item.requestBody) {
                let b = typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody);
                c += `  --data-raw $'$${Security.escapeHtml(b)}' \\\n`;
            }
            if (c.endsWith(' \\\n')) {
                c = c.slice(0, -4);
            }
            return c;
        },
        parseQueryString: function(str) {
            if (!str) return [];
            try {
                const p = new URLSearchParams(str);
                const a = [];
                p.forEach((v, k) => a.push({
                    key: k,
                    value: v
                }));
                return a.length > 0 ? a : null;
            } catch (e) {
                return null;
            }
        },
        triggerDownload: function(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        },
        formatWebSocketEvent: function(eventType) {
            const eventMap = {
                'open': '🟢 連接建立',
                'message': '💬 訊息',
                'close': '🔴 連接關閉',
                'error': '❌ 錯誤'
            };
            return eventMap[eventType] || eventType;
        },
        limitLogs: function() {
            if (AppConfig.state.logs.length > AppConfig.SETTINGS.MAX_LOG_SIZE) {
                AppConfig.state.logs = AppConfig.state.logs.slice(0, AppConfig.SETTINGS.MAX_LOG_SIZE);
            }
        },
        getSummaryFromLog: function(log, keys) {
            let summary = {};
            try {
                const query = log.url.split('?')[1] || '';
                const params = DataHandlers.parseQueryString(query) || [];
                params.forEach(p => {
                    if (keys.includes(p.key)) summary[p.key] = p.value;
                });
                if (log.requestBody) {
                    let obj = null;
                    if (typeof log.requestBody === 'string') {
                        try {
                            obj = JSON.parse(log.requestBody);
                        } catch (e) {}
                    } else if (typeof log.requestBody === 'object') {
                        obj = log.requestBody;
                    }
                    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                        keys.forEach(key => {
                            if (obj[key] !== undefined) summary[key] = String(obj[key]);
                        });
                    }
                }
            } catch (e) {}
            return summary;
        },
        parseUrl: function(url) {
            try {
                const a = document.createElement('a');
                a.href = url;
                return {
                    domain: a.hostname,
                    path: a.pathname + a.search
                };
            } catch (e) {
                return {
                    domain: url,
                    path: ''
                };
            }
        },
        sortLogs: function(logs, key, direction) {
            const sorted = [...logs].sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                if (key === 'url') {
                    valA = a.url.toLowerCase();
                    valB = b.url.toLowerCase();
                } else if (key === 'status') {
                    valA = parseInt(a.status) || 999;
                    valB = parseInt(b.status) || 999;
                } else if (key === 'timestamp') {
                    valA = a.timestamp.getTime();
                    valB = b.timestamp.getTime();
                }
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
            return sorted;
        },
        jsonToKvPairs: function(data) {
            let obj;
            if (typeof data === 'string') {
                try {
                    obj = JSON.parse(data);
                } catch (e) {
                    return null;
                }
            } else if (typeof data === 'object') {
                obj = data;
            } else {
                return null;
            }
            if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                return Object.entries(obj).map(([key, value]) => ({
                    key: key,
                    value: String(value)
                }));
            }
            return null;
        },
        flattenJson: function(obj, parentKey = '') {
            let result = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const newKey = parentKey ? `${parentKey}.${key}` : key;
                    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                        Object.assign(result, this.flattenJson(obj[key], newKey));
                    } else {
                        result[newKey] = obj[key];
                    }
                }
            }
            return result;
        }
    };

    // ===================================
    // 模組四：API 格式模板定義
    // ===================================
    const API_TEMPLATES = {
        'original': {
            name: '保持原始',
            description: '使用原始請求的格式，不做任何修改。',
            headers: {}
        },
        'json': {
            name: 'JSON',
            description: 'RESTful JSON API 格式。',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Accept': 'application/json'
            },
            formatBody: (data) => {
                if (typeof data === 'object') return JSON.stringify(data, null, 2);
                try {
                    return JSON.stringify(JSON.parse(data), null, 2);
                } catch (e) {
                    return JSON.stringify({
                        data: data
                    }, null, 2);
                }
            }
        },
        'form': {
            name: 'Form',
            description: '表單提交格式 (application/x-www-form-urlencoded)。',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            formatBody: (data) => {
                const params = new URLSearchParams();
                if (typeof data === 'object') {
                    Object.entries(data).forEach(([k, v]) => params.append(k, v));
                } else {
                    params.append('data', data);
                }
                return params.toString();
            }
        },
        'multipart': {
            name: 'Multipart',
            description: '多部分表單格式（檔案上傳）。',
            headers: {},
            formatBody: (data) => {
                const formData = new FormData();
                if (typeof data === 'object') {
                    Object.entries(data).forEach(([k, v]) => formData.append(k, v));
                } else {
                    formData.append('data', data);
                }
                return formData;
            }
        }
    };

    // ===================================
    // 模組五：UI 渲染管理 (UIManager)
    // ===================================
    const UIManager = {
        getTemplate: function() {
            return `
            <div class="fac-wrap" id="fac-main-wrap">
                <div class="fac-header">
                    <div id="fac-title" class="fac-title">API 收集調試工具</div>
                    <div class="fac-actions">
                        <button id="fac-new-api-btn" class="fac-btn primary" title="手動發送新請求">+ 新增 API</button>
                        <button id="fac-minimize-btn" class="fac-btn fac-window-btn" title="最小化">－</button>
                        <button id="fac-collapse-btn" class="fac-btn fac-window-btn" title="收摺/展開">︿</button>
                        <button id="fac-close-btn" class="fac-btn danger">關閉</button>
                    </div>
                </div>
                <div class="fac-status-bar" id="fac-status-bar">就緒</div>
                <div class="fac-body-wrapper">
                    <div class="fac-controls" id="fac-list-controls">
                        <button id="fac-toggle-collect-btn" class="fac-btn primary">開始收集</button>
                        <button id="fac-clear-btn" class="fac-btn danger">清除日誌</button>
                        <select id="fac-filter-select" class="fac-filter">
                            <option value="">所有類型</option>
                            <option value="xhr">XMLHttpRequest</option>
                            <option value="fetch">Fetch</option>
                            <option value="websocket">WebSocket</option>
                        </select>
                        <select id="fac-sort-select" class="fac-filter" title="排序方式">
                            <option value="timestamp_desc">時間 (新->舊)</option>
                            <option value="timestamp_asc">時間 (舊->新)</option>
                            <option value="status_asc">狀態碼 (小->大)</option>
                            <option value="status_desc">狀態碼 (大->小)</option>
                            <option value="url_asc">網址 (A-Z)</option>
                            <option value="url_desc">網址 (Z-A)</option>
                        </select>
                        <input id="fac-search-input" type="text" placeholder="搜尋..." class="fac-search"/>
                        <div class="fac-download-controls">
                            <button id="fac-select-all-btn" class="fac-btn">全選</button>
                            <button id="fac-download-selected-btn" class="fac-btn primary" disabled>下載選取 (0)</button>
                            <button id="fac-download-all-btn" class="fac-btn">下載所有日誌</button>
                        </div>
                    </div>
                    <div id="fac-main-content">
                        <div id="fac-list-container" class="fac-tab-panel active">
                            <div id="fac-list" class="fac-list"></div>
                            <div id="fac-pagination" class="fac-pagination"></div>
                        </div>
                        <div id="fac-tabs-container">
                            <div id="fac-tabs-header"></div>
                            <div id="fac-tabs-content"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="fac-minimized-icon" class="fac-minimized-icon" style="display:none;" title="還原視窗">API</div>
            <style>
                .fac-wrap { position: fixed; top: 10px; right: 10px; width: 520px; background: #fdfdfe; color: #333; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); font-family: sans-serif; z-index: 999999; display: flex; flex-direction: column; max-height: calc(100vh - 20px); min-height: 150px; min-width: 400px; overflow: hidden; border: 1px solid #c0c0c0; resize: both; }
                .fac-header { display: flex; justify-content: space-between; align-items: center; background: #f0f0f0; padding: 8px 15px; border-bottom: 1px solid #dcdcdc; flex-shrink: 0; cursor: move; }
                .fac-title { font-weight: bold; font-size: 14px; color: #444; }
                .fac-actions { display: flex; gap: 6px; align-items: center; }
                .fac-btn { padding: 4px 10px; border: 1px solid #c0c0c0; border-radius: 6px; background: #fff; cursor: pointer; font-size: 12px; transition: all 0.2s; white-space: nowrap; }
                .fac-btn:hover { background: #f0f0f0; border-color: #a0a0a0; }
                .fac-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }
                .primary { background: #5C7AFF; color: #fff; border-color: #5C7AFF; }
                .primary:hover { background: #4762e5; }
                .danger { background: #FF5C5C; color: #fff; border-color: #FF5C5C; }
                .danger:hover { background: #e54747; }
                .warning { background: #FFD700; color: #333; border-color: #FFD700; }
                .warning:hover { background: #e5c000; }
                .fac-status-bar { padding: 8px 15px; font-size: 13px; font-weight: bold; color: #fff; background: #333; flex-shrink: 0; }
                .fac-status-bar.success { background: #4CAF50; }
                .fac-status-bar.error { background: #FF5C5C; }
                .fac-body-wrapper { display: flex; flex-direction: column; flex: 1; overflow: hidden; transition: all 0.3s ease; }
                .fac-body-wrapper.collapsed { display: none; }
                .fac-controls { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid #dcdcdc; flex-shrink: 0; flex-wrap: wrap; }
                .fac-search, .fac-filter { flex: 1; padding: 4px 8px; border: 1px solid #c0c0c0; border-radius: 6px; font-size: 12px; min-width: 120px; }
                .fac-download-controls { display: flex; gap: 6px; flex-wrap: wrap; }

                /* 主要內容區域佈局 */
                #fac-main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                #fac-list-container { flex: 1; display: none; flex-direction: column; overflow: hidden; }
                #fac-list-container.active { display: flex; }
                #fac-tabs-container { flex: 1; display: none; flex-direction: column; overflow: hidden; }
                #fac-tabs-container.active { display: flex; }

                .fac-list { flex: 1; overflow-y: auto; background: #fff; }
                .fac-list-item { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; }
                .fac-list-item:hover { background-color: #f5fafd; }
                .fac-list-item.viewed { background-color: #e8f5e9; }
                .fac-list-item.selected { background-color: #d1e7dd; }
                .fac-list-item input[type="checkbox"] { margin-right: 8px; }
                .fac-list-item-content { flex-grow: 1; overflow: hidden; }

                .fac-item-line1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                .fac-item-line1-left { display: flex; align-items: center; overflow: hidden; }
                .fac-method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #fff; margin-right: 8px; font-weight: bold; flex-shrink: 0; }
                .fac-resent-tag { background-color: #8C52FF; color: white; font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-right: 8px; flex-shrink: 0; }
                .GET { background: #4CAF50; } .POST { background: #5C7AFF; } .PUT { background: #FFC107; color: #000; } .DELETE { background: #FF5C5C; }
                .WEBSOCKET { background: #9c27b0; } .WS-OPEN { background: #4CAF50; } .WS-MESSAGE { background: #5C7AFF; } .WS-CLOSE { background: #FF5C5C; } .WS-ERROR { background: #FFD700; }
                .fac-url-group { display: flex; flex-direction: column; overflow: hidden; }
                .fac-domain-url { font-size: 12px; color: #999; }
                .fac-path-url { font-size: 13px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .fac-summary { font-size: 12px; color: #666; background: #f8f9fa; padding: 2px 6px; border-radius: 3px; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .fac-sub-info { font-size: 11px; color: #666; margin-top: 4px; }
                .fac-timestamp { font-size: 12px; color: #999; flex-shrink: 0; }
                .fac-status { font-size: 11px; color: #666; }
                .fac-pagination { display: flex; justify-content: center; align-items: center; padding: 8px; border-top: 1px solid #dcdcdc; flex-shrink: 0; gap: 4px; }
                .fac-page-btn { padding: 4px 8px; font-size: 12px; } .fac-page-btn.active { background: #5C7AFF; color: white; border-color: #5C7AFF; }

                /* 分頁樣式 */
                #fac-tabs-header { display: flex; background: #e9ecef; border-bottom: 1px solid #c0c0c0; padding: 0 5px; flex-wrap: wrap; max-height: 50px; overflow-y: auto; flex-shrink: 0; }
                .fac-tab-btn { display: flex; align-items: center; padding: 6px 12px; border: 1px solid #c0c0c0; border-bottom: none; background: #f0f0f0; border-radius: 6px 6px 0 0; margin-right: 2px; cursor: pointer; font-size: 13px; max-width: 200px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                .fac-tab-btn.active { background: #fdfdfe; border-bottom-color: #fdfdfe; margin-bottom: -1px; z-index: 1; }
                .fac-tab-btn .close-btn { margin-left: 8px; font-weight: bold; color: #888; }
                .fac-tab-btn .close-btn:hover { color: #333; }
                #fac-tabs-content { flex: 1; overflow-y: auto; }

                /* 編輯器面板樣式 */
                .fac-detail-content { display: none; height: 100%; flex-direction: column; overflow: auto; }
                .fac-detail-content.active { display: flex; }
                .fac-editor-tabs { display: flex; background: #f0f0f0; padding: 0 8px; flex-shrink: 0; border-bottom: 1px solid #dcdcdc; }
                .fac-editor-tab { padding: 8px 12px; cursor: pointer; font-size: 13px; background: #e0e0e0; border: 1px solid #c0c0c0; border-bottom: none; border-radius: 6px 6px 0 0; margin-right: 4px; }
                .fac-editor-tab.active { background: #fdfdfe; border-bottom: 1px solid #fdfdfe; margin-bottom: -1px; }
                .fac-editor-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                .fac-editor-content > .fac-tab-panel { display: none; }
                .fac-editor-content > .fac-tab-panel.active { display: flex; flex-direction: column; flex: 1; overflow-y: auto; padding: 12px; }
                
                .fac-detail-label { display: block; margin: 10px 0 4px 0; font-weight: bold; font-size: 13px; }
                .fac-detail input, .fac-detail textarea, .fac-detail select { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #c0c0c0; border-radius: 4px; font-size: 13px; font-family: monospace; }
                
                #edit-url-container { display: flex; align-items: center; gap: 4px; }
                #edit-url { flex-grow: 1; resize: vertical; }

                .fac-template-info { font-size: 11px; color: #666; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; margin-top: 4px; }
                .fac-body-tabs { display: flex; margin-bottom: 4px; border-bottom: 1px solid #c0c0c0; }
                .fac-body-tab { padding: 4px 8px; cursor: pointer; font-size: 12px; background: #eee; border-radius: 4px 4px 0 0; border: 1px solid #c0c0c0; border-bottom: none; margin-right: 4px; }
                .fac-body-tab.active { background: #fdfdfe; border-bottom: 1px solid #fdfdfe; margin-bottom: -1px; }
                .fac-kv-editor, .fac-raw-editor { display: none; }
                .fac-kv-editor.active, .fac-raw-editor.active { display: block; }
                .fac-kv-row { display: flex; gap: 4px; margin-bottom: 4px; align-items: center; }
                .fac-kv-key, .fac-kv-value { flex: 1; }
                .fac-kv-delete, .fac-kv-add { background: #FF5C5C; color: white; border: none; border-radius: 50%; cursor: pointer; font-weight: bold; width: 22px; height: 22px; line-height: 22px; text-align: center; }
                .fac-kv-add { background: #4CAF50; }

                #fac-tab-response { padding: 0 !important; }
                #fac-response-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 12px; }
                #fac-response-pre { flex-grow: 1; overflow: auto; background: #f9f9f9; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 13px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; }
                #fac-response-filter { margin-bottom: 10px; display: flex; gap: 4px; align-items: center; flex-shrink: 0;}
                #fac-response-filter-input { flex-grow: 1; }

                .fac-hl-string { color: #2a9442; } .fac-hl-number { color: #1c6ad6; } .fac-hl-boolean { color: #c43ad6; } .fac-hl-null { color: #9e0505; } .fac-hl-key { color: #ac620c; font-weight: bold; }
                .fac-minimized-icon { position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; background: #5C7AFF; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 999998; }
                .fac-ws-events { max-height: 200px; overflow-y: auto; border: 1px solid #dcdcdc; border-radius: 4px; padding: 8px; background: #f9f9f9; }
                .fac-ws-event { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 12px; }
                .fac-ws-event:last-child { border-bottom: none; }
            </style>
            `;
        },
        create: function() {
            const w = document.createElement('div');
            w.id = AppConfig.SETTINGS.TOOL_ID;
            w.innerHTML = this.getTemplate();
            document.body.appendChild(w);
        },
        updateTitle: function() {
            const state = AppConfig.state;
            const count = state.logs.length;
            if (state.uiElements.title) {
                Security.setTextContent(state.uiElements.title, `API 收集調試工具 (共 ${count} 筆)`);
            }
        },
        updateStatus: function(message, isError = false) {
            const statusBar = AppConfig.state.uiElements.statusBar;
            if (!statusBar) return;
            Security.setTextContent(statusBar, message);
            statusBar.className = 'fac-status-bar';
            if (isError) {
                statusBar.classList.add('error');
            } else if (message.includes('成功') || message.includes('就緒')) {
                statusBar.classList.add('success');
            }
        },
        render: function() {
            const state = AppConfig.state;
            const {
                listContainer,
                tabsContainer
            } = state.uiElements;

            if (!listContainer || !tabsContainer) return;

            if (state.activeView === 'list') {
                listContainer.classList.add('active');
                tabsContainer.classList.remove('active');
                this.renderList();
            } else {
                listContainer.classList.remove('active');
                tabsContainer.classList.add('active');
                this.renderTabs();
            }
            this.updateTitle();
        },
        renderList: function() {
            const state = AppConfig.state;
            const {
                list,
                searchBox
            } = state.uiElements;

            list.innerHTML = '';
            const fragment = document.createDocumentFragment();
            const searchTerm = searchBox.value.toLowerCase();
            const typeFilter = state.uiElements.filterSelect.value;

            let filteredLogs = state.logs.filter(log => {
                const matchesSearch = (log.url && log.url.toLowerCase().includes(searchTerm)) ||
                    (log.method && log.method.toLowerCase().includes(searchTerm)) ||
                    (log.wsEvent && log.wsEvent.toLowerCase().includes(searchTerm));
                const matchesType = !typeFilter || log.type === typeFilter;
                return matchesSearch && matchesType;
            });

            filteredLogs = DataHandlers.sortLogs(filteredLogs, state.sortKey, state.sortDirection);

            const totalPages = Math.ceil(filteredLogs.length / AppConfig.SETTINGS.ITEMS_PER_PAGE);
            if (state.currentPage > totalPages) state.currentPage = totalPages || 1;
            const startIndex = (state.currentPage - 1) * AppConfig.SETTINGS.ITEMS_PER_PAGE;
            const paginatedLogs = filteredLogs.slice(startIndex, startIndex + AppConfig.SETTINGS.ITEMS_PER_PAGE);

            paginatedLogs.forEach(log => {
                const div = document.createElement('div');
                div.className = 'fac-list-item';
                if (log.viewed) div.classList.add('viewed');
                if (log.selected) div.classList.add('selected');

                const logIndex = state.logs.indexOf(log);
                const summary = DataHandlers.getSummaryFromLog(log, AppConfig.SETTINGS.SUMMARY_KEYS);
                const summaryHtml = Object.keys(summary).length > 0 ?
                    `<div class="fac-summary" title="${Security.escapeHtml(JSON.stringify(summary))}">${Object.entries(summary).map(([k,v]) => `${Security.escapeHtml(k)}: ${Security.escapeHtml(v)}`).join(', ')}</div>` : '';

                div.innerHTML = `
                    <input type="checkbox" class="fac-list-item-checkbox" data-index="${logIndex}" ${log.selected ? 'checked' : ''}>
                    <div class="fac-list-item-content" data-index="${logIndex}">
                        <div class="fac-item-line1">
                            <div class="fac-item-line1-left">
                                <span class="fac-method ${log.method || 'WEBSOCKET'}">${log.method || 'WS'}</span>
                                <div class="fac-url-group">
                                    <div class="fac-path-url" title="${Security.escapeHtml(log.url)}">${Security.escapeHtml(DataHandlers.parseUrl(log.url || '').path)}</div>
                                    <div class="fac-domain-url">${Security.escapeHtml(DataHandlers.parseUrl(log.url || '').domain)}</div>
                                </div>
                            </div>
                            <span class="fac-timestamp">${log.timestamp ? log.timestamp.toLocaleTimeString() : ''}</span>
                        </div>
                        ${summaryHtml}
                        <div class="fac-sub-info">
                             <span class="fac-status">狀態: ${log.status || 'N/A'} - ${log.duration || 0}ms</span>
                        </div>
                    </div>
                `;
                fragment.appendChild(div);
            });

            list.appendChild(fragment);
            this.renderPagination(totalPages, filteredLogs.length);
            EventHandlers.checkDownloadButtonStatus();
        },
        renderPagination: function(totalPages) {
            const state = AppConfig.state;
            const {
                pagination
            } = state.uiElements;
            if (!pagination) return;
            pagination.innerHTML = '';
            if (totalPages <= 1) return;
            const createBtn = (text, page, disabled = false, isActive = false) => {
                const btn = document.createElement('button');
                Security.setTextContent(btn, text);
                btn.className = 'fac-btn fac-page-btn';
                if (isActive) btn.classList.add('active');
                btn.disabled = disabled;
                btn.onclick = () => {
                    state.currentPage = page;
                    UIManager.renderList();
                };
                return btn;
            };
            if (state.currentPage > 1) pagination.appendChild(createBtn('«', 1));
            if (state.currentPage > 1) pagination.appendChild(createBtn('‹', state.currentPage - 1));
            let startPage = Math.max(1, state.currentPage - 2);
            let endPage = Math.min(totalPages, state.currentPage + 2);
            for (let i = startPage; i <= endPage; i++) {
                pagination.appendChild(createBtn(String(i), i, false, state.currentPage === i));
            }
            if (state.currentPage < totalPages) pagination.appendChild(createBtn('›', state.currentPage + 1));
            if (state.currentPage < totalPages) pagination.appendChild(createBtn('»', totalPages));
        },
        renderTabs: function() {
            const state = AppConfig.state;
            const tabsHeader = state.uiElements.tabsHeader;
            const tabsContent = state.uiElements.tabsContent;

            if (!tabsHeader || !tabsContent) return;

            tabsHeader.innerHTML = '';
            tabsContent.innerHTML = '';

            state.tabs.forEach((tab) => {
                const tabBtn = document.createElement('button');
                tabBtn.className = `fac-tab-btn ${state.activeTabId === tab.id ? 'active' : ''}`;
                tabBtn.dataset.tabId = tab.id;

                const title = UIManager.getTabTitle(tab);
                tabBtn.innerHTML = `${Security.escapeHtml(title)} <span class="close-btn" data-action="close-tab" data-tab-id="${tab.id}">×</span>`;

                tabsHeader.appendChild(tabBtn);

                const panel = document.createElement('div');
                panel.className = `fac-detail-content ${state.activeTabId === tab.id ? 'active' : ''}`;
                panel.dataset.tabId = tab.id;

                const logItem = tab.logIndex !== -1 ? state.logs[tab.logIndex] : null;
                if (tab.type === 'new-api') {
                    this.showNewApiPage(panel);
                } else if (tab.type === 'websocket') {
                    this.showWebSocketEditor(logItem, panel);
                } else {
                    this.showHttpEditor(logItem, panel);
                }
                tabsContent.appendChild(panel);
            });

            if (state.tabs.length > 0) {
                state.uiElements.tabsContainer.classList.add('active');
                state.uiElements.listContainer.classList.remove('active');
                state.activeView = 'tab';
            } else {
                state.uiElements.tabsContainer.classList.remove('active');
                state.uiElements.listContainer.classList.add('active');
                state.activeView = 'list';
                this.renderList();
            }
        },
        showHttpEditor: function(item, container) {
            const bodyStr = (item.method !== 'GET' && item.requestBody) ?
                (typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody)) : '';
            const queryParams = item.url ? item.url.split('?')[1] || '' : '';

            // [語法修正] 替換 ?. 語法以提高相容性
            const contentTypeEntry = Object.entries(item.requestHeaders).find(([key, value]) => key.toLowerCase() === 'content-type');
            const contentType = contentTypeEntry ? contentTypeEntry[1] : '';

            const isJsonOrForm = contentType.includes('json') || contentType.includes('form-urlencoded');

            let kvPairs = null;
            if (item.method === 'GET') {
                kvPairs = DataHandlers.parseQueryString(queryParams);
            } else {
                try {
                    const obj = JSON.parse(bodyStr);
                    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
                        kvPairs = Object.entries(obj).map(([key, value]) => ({
                            key: key,
                            value: String(value)
                        }));
                    }
                } catch (e) {
                    kvPairs = DataHandlers.parseQueryString(bodyStr);
                }
            }
            const showFormEditor = (!!kvPairs && isJsonOrForm) || item.method === 'GET';
            const originalResponse = item.response || '';
            const highlightedResponse = DataHandlers.highlightJSON(DataHandlers.prettyPrintJSON(originalResponse));
            const safeUrl = item.url ? Security.escapeHtml(item.url) : '';
            const safeHeaders = item.requestHeaders ? Security.escapeHtml(JSON.stringify(item.requestHeaders, null, 2)) : '{}';
            const safeBodyStr = Security.escapeHtml(DataHandlers.prettyPrintJSON(bodyStr));

            const methodButtons = AppConfig.SETTINGS.DEFAULT_METHODS.map(m =>
                `<button class="fac-btn ${item.method === m ? 'active' : ''}" data-method="${m}">${m}</button>`
            ).join('');
            const formatButtons = Object.entries(API_TEMPLATES).map(([key, template]) =>
                `<button class="fac-btn" data-format="${key}">${template.name}</button>`
            ).join('');

            container.innerHTML = `
                <div class="fac-detail-main-actions" style="padding: 12px 12px 0 12px; flex-shrink:0;">
                    <button id="resend-btn" class="fac-btn primary">重新發送</button>
                    <button id="copy-curl-btn" class="fac-btn">複製為 cURL</button>
                    <button id="fac-download-single-btn" class="fac-btn">下載此筆</button>
                </div>
                <div class="fac-editor-tabs">
                    <div class="fac-editor-tab active" data-tab="main">主要</div>
                    <div class="fac-editor-tab" data-tab="headers">標頭</div>
                    <div class="fac-editor-tab" data-tab="body">Body</div>
                    <div class="fac-editor-tab" data-tab="response">回應</div>
                </div>
                <div class="fac-editor-content">
                    <div id="fac-tab-main" class="fac-tab-panel active">
                        <label class="fac-detail-label">Method</label>
                        <div class="fac-btn-group" id="edit-method">${methodButtons}</div>
                        <label class="fac-detail-label">URL</label>
                        <div id="edit-url-container">
                            <textarea id="edit-url" rows="3">${safeUrl}</textarea>
                            <button id="fac-parse-url-btn" class="fac-btn" title="解析URL查詢字串並填入Body表單">解析</button>
                        </div>
                    </div>
                    <div id="fac-tab-headers" class="fac-tab-panel">
                        <label class="fac-detail-label">Headers (JSON)</label>
                        <textarea id="edit-headers" rows="15">${safeHeaders}</textarea>
                    </div>
                    <div id="fac-tab-body" class="fac-tab-panel">
                        <label class="fac-detail-label">Body 格式</label>
                        <div class="fac-btn-group" id="fac-format-template">${formatButtons}</div>
                        <div class="fac-body-tabs">
                            <div class="fac-body-tab ${showFormEditor ? 'active' : ''}" data-tab="form">表單</div>
                            <div class="fac-body-tab ${!showFormEditor ? 'active' : ''}" data-tab="raw">原始碼</div>
                        </div>
                        <div class="fac-kv-editor ${showFormEditor ? 'active' : ''}" id="fac-body-form">
                            ${(kvPairs || []).map(p => `<div class="fac-kv-row"><input type="text" class="fac-kv-key" value="${Security.escapeHtml(p.key)}"><input type="text" class="fac-kv-value" value="${Security.escapeHtml(String(p.value))}"><button class="fac-kv-delete">-</button></div>`).join('')}
                            <button class="fac-kv-add">+</button>
                        </div>
                        <div class="fac-raw-editor ${!showFormEditor ? 'active' : ''}">
                            <textarea id="edit-body-raw" rows="12">${safeBodyStr}</textarea>
                        </div>
                    </div>
                    <div id="fac-tab-response" class="fac-tab-panel">
                        <div class="fac-detail-main-actions" style="flex-shrink:0;">
                            <button id="fac-copy-response-btn" class="fac-btn">複製回應</button>
                            <button id="fac-convert-to-form-btn" class="fac-btn primary">轉換成表單</button>
                            <button id="fac-flatten-json-btn" class="fac-btn primary">欄位轉置</button>
                            <button id="fac-export-btn" class="fac-btn">匯出...</button>
                        </div>
                        <div id="fac-response-content">
                            <div id="fac-response-filter">
                                <input type="text" id="fac-response-filter-input" placeholder="篩選欄位 (多個以逗號分隔)">
                                <button id="fac-response-filter-btn" class="fac-btn primary">篩選</button>
                                <button id="fac-response-reset-btn" class="fac-btn">重置</button>
                            </div>
                            <pre id="fac-response-pre"><code class="language-json">${highlightedResponse}</code></pre>
                        </div>
                    </div>
                </div>
            `;
            container.querySelector('#copy-curl-btn')._logItem = item;
            container.querySelector('#fac-download-single-btn')._logItem = item;
            container.querySelector('#fac-export-btn')._responseData = originalResponse;
            container.querySelector('#fac-copy-response-btn')._responseData = originalResponse;
            const responsePre = container.querySelector('#fac-response-pre');
            if (responsePre) {
                responsePre._originalData = originalResponse;
            }
        },
        showWebSocketEditor: function(item, container) {
            const eventsHtml = item.wsEvents ? item.wsEvents.map(event =>
                `<div class="fac-ws-event"><strong>[${event.timestamp.toLocaleTimeString()}] ${DataHandlers.formatWebSocketEvent(event.type)}:</strong> ${Security.escapeHtml(event.data || event.reason || '')}</div>`
            ).join('') : '';

            const safeUrl = item.url ? Security.escapeHtml(item.url) : '';
            const safeStatus = item.status ? Security.escapeHtml(String(item.status)) : '';
            const safeTimestamp = item.timestamp ? item.timestamp.toLocaleString() : '';

            container.innerHTML = `
                <div class="fac-detail-main-actions">
                    <button id="fac-send-ws-btn" class="fac-btn primary">發送訊息</button>
                    <button id="copy-curl-btn" class="fac-btn">複製連接資訊</button>
                    <button id="fac-download-single-btn" class="fac-btn">下載此筆</button>
                </div>
                <div class="fac-editor-tabs">
                    <div class="fac-editor-tab active" data-tab="main">連接資訊</div>
                    <div class="fac-editor-tab" data-tab="events">事件記錄</div>
                    <div class="fac-editor-tab" data-tab="send">發送訊息</div>
                </div>
                <div class="fac-editor-content">
                    <div id="fac-tab-main" class="fac-tab-panel active">
                        <label class="fac-detail-label">WebSocket URL</label>
                        <input id="edit-ws-url" value="${safeUrl}" readonly/>
                        <label class="fac-detail-label">連接狀態</label>
                        <input id="edit-ws-status" value="${safeStatus}" readonly/>
                        <label class="fac-detail-label">連接時間</label>
                        <input id="edit-ws-time" value="${safeTimestamp}" readonly/>
                    </div>
                    <div id="fac-tab-events" class="fac-tab-panel">
                        <label class="fac-detail-label">事件記錄</label>
                        <div class="fac-ws-events">${eventsHtml || '尚無事件記錄'}</div>
                    </div>
                    <div id="fac-tab-send" class="fac-tab-panel">
                        <label class="fac-detail-label">發送訊息</label>
                        <textarea id="edit-ws-message" rows="10" placeholder="輸入要發送的訊息..."></textarea>
                        <button id="fac-ws-send-btn" class="fac-btn primary" style="margin-top: 8px;">發送</button>
                    </div>
                </div>
            `;
            container.querySelector('#copy-curl-btn')._logItem = item;
            container.querySelector('#fac-download-single-btn')._logItem = item;
        },
        showNewApiPage: function(container) {
            const methodButtons = AppConfig.SETTINGS.DEFAULT_METHODS.map(m =>
                `<button class="fac-btn ${m === 'POST' ? 'active' : ''}" data-method="${m}">${m}</button>`
            ).join('');
            const formatButtons = Object.entries(API_TEMPLATES).map(([key, template]) =>
                `<button class="fac-btn ${key === 'json' ? 'active' : ''}" data-format="${key}">${template.name}</button>`
            ).join('');

            container.innerHTML = `
                <div class="fac-detail-main-actions">
                    <button id="resend-btn" class="fac-btn primary">發送請求</button>
                </div>
                <div class="fac-editor-tabs">
                    <div class="fac-editor-tab active" data-tab="main">主要</div>
                    <div class="fac-editor-tab" data-tab="headers">標頭</div>
                    <div class="fac-editor-tab" data-tab="body">Body</div>
                </div>
                <div class="fac-editor-content">
                    <div id="fac-tab-main" class="fac-tab-panel active">
                        <label class="fac-detail-label">Method</label>
                        <div class="fac-btn-group" id="edit-method">${methodButtons}</div>
                        <label class="fac-detail-label">URL</label>
                        <div id="edit-url-container">
                            <textarea id="edit-url" rows="3" placeholder="輸入 API 網址"></textarea>
                            <button id="fac-parse-url-btn" class="fac-btn" title="解析URL查詢字串並填入Body表單">解析</button>
                        </div>
                    </div>
                    <div id="fac-tab-headers" class="fac-tab-panel">
                        <label class="fac-detail-label">Headers (JSON)</label>
                        <textarea id="edit-headers" rows="15">{"Content-Type":"application/json;charset=UTF-8","Accept":"application/json"}</textarea>
                    </div>
                    <div id="fac-tab-body" class="fac-tab-panel">
                        <label class="fac-detail-label">Body 格式</label>
                        <div class="fac-btn-group" id="fac-format-template">${formatButtons}</div>
                        <div class="fac-body-tabs">
                            <div class="fac-body-tab active" data-tab="form">表單</div>
                            <div class="fac-body-tab" data-tab="raw">原始碼</div>
                        </div>
                        <div class="fac-kv-editor active" id="fac-body-form">
                            <div class="fac-kv-row"><input type="text" class="fac-kv-key" placeholder="欄位"><input type="text" class="fac-kv-value" placeholder="值"><button class="fac-kv-delete">-</button></div>
                            <button class="fac-kv-add">+</button>
                        </div>
                        <div class="fac-raw-editor">
                            <textarea id="edit-body-raw" rows="12" placeholder="輸入 Body 內容..."></textarea>
                        </div>
                    </div>
                </div>
            `;
        },
        getTabTitle: function(tab) {
            if (tab.type === 'new-api') {
                return '新增 API';
            }
            const log = AppConfig.state.logs[tab.logIndex];
            if (!log) return '日誌錯誤';
            const urlInfo = DataHandlers.parseUrl(log.url);
            const path = urlInfo.path.length > 20 ? urlInfo.path.substring(0, 17) + '...' : urlInfo.path;
            return `${log.method || 'WS'} - ${path}`;
        }
    };

    // ===================================
    // 模組六：API 請求攔截器 (ApiHooking)
    // ===================================
    const ApiHooking = {
        addLog: function(logData) {
            if (AppConfig.state.isRunning) {
                EventHandlers.logNewRequest(logData);
                DataHandlers.limitLogs();
            }
        },
        hookXHR: function() {
            const originalXHR = AppConfig.state.originalAPIs.XMLHttpRequest;
            window.XMLHttpRequest = function(...args) {
                const xhr = new originalXHR(...args);
                let method, url, startTime, headers = {};
                let requestBody = null;
                const originalOpen = xhr.open;
                xhr.open = function(m, u, ...rest) {
                    method = m ? m.toUpperCase() : 'GET';
                    url = u || '';
                    startTime = Date.now();
                    return originalOpen.apply(this, [m, u, ...rest]);
                };
                const originalSetRequestHeader = xhr.setRequestHeader;
                xhr.setRequestHeader = function(key, value) {
                    if (key && value) headers[key] = value;
                    return originalSetRequestHeader.apply(this, [key, value]);
                };
                const originalSend = xhr.send;
                xhr.send = function(body) {
                    requestBody = body;
                    return originalSend.apply(this, arguments);
                };
                xhr.addEventListener('load', () => ApiHooking.addLog({
                    type: 'xhr',
                    method: method,
                    url: url,
                    status: xhr.status,
                    duration: Date.now() - startTime,
                    requestHeaders: headers,
                    requestBody: requestBody,
                    response: xhr.responseText
                }));
                xhr.addEventListener('error', () => ApiHooking.addLog({
                    type: 'xhr',
                    method: method,
                    url: url,
                    status: 'Error',
                    duration: Date.now() - startTime,
                    requestHeaders: headers,
                    requestBody: requestBody,
                    response: 'Network Error'
                }));
                return xhr;
            };
        },
        hookFetch: function() {
            const originalFetch = AppConfig.state.originalAPIs.fetch;
            window.fetch = function(input, options = {}) {
                const method = (options.method || 'GET').toUpperCase();
                const url = typeof input === 'string' ? input : (input.url || '');
                const startTime = Date.now();
                return originalFetch(input, options).then(response => {
                    if (AppConfig.state.isRunning) {
                        const responseClone = response.clone();
                        responseClone.text().then(body => ApiHooking.addLog({
                            type: 'fetch',
                            method: method,
                            url: url,
                            status: response.status,
                            duration: Date.now() - startTime,
                            requestHeaders: options.headers || {},
                            requestBody: options.body || null,
                            response: body
                        })).catch(() => {
                            ApiHooking.addLog({
                                type: 'fetch',
                                method: method,
                                url: url,
                                status: response.status,
                                duration: Date.now() - startTime,
                                requestHeaders: options.headers || {},
                                requestBody: options.body || null,
                                response: 'Unable to read response'
                            });
                        });
                    }
                    return response;
                }).catch(error => {
                    if (AppConfig.state.isRunning) {
                        ApiHooking.addLog({
                            type: 'fetch',
                            method: method,
                            url: url,
                            status: 'Error',
                            duration: Date.now() - startTime,
                            requestHeaders: options.headers || {},
                            requestBody: options.body || null,
                            response: error.message || 'Network Error'
                        });
                    }
                    throw error;
                });
            };
        },
        hookWebSocket: function() {
            const originalWebSocket = AppConfig.state.originalAPIs.WebSocket;
            window.WebSocket = function(url, protocols) {
                const ws = new originalWebSocket(url, protocols);
                const wsId = Math.random().toString(36).substr(2, 9);
                const wsLog = {
                    type: 'websocket',
                    wsId: wsId,
                    url: url || '',
                    status: 'Connecting',
                    timestamp: new Date(),
                    duration: 0,
                    wsEvents: []
                };
                AppConfig.state.websockets.set(wsId, ws);
                const addEvent = (type, data = null, reason = null) => {
                    const event = {
                        type: type,
                        timestamp: new Date(),
                        data: data,
                        reason: reason
                    };
                    wsLog.wsEvents.push(event);
                    wsLog.wsEvent = type;
                    wsLog.duration = Date.now() - wsLog.timestamp.getTime();
                    if (AppConfig.state.isRunning) {
                        const existingLogIndex = AppConfig.state.logs.findIndex(log => log.wsId === wsId);
                        if (existingLogIndex >= 0) {
                            AppConfig.state.logs[existingLogIndex] = {
                                ...wsLog
                            };
                        } else {
                            AppConfig.state.logs.unshift({
                                ...wsLog
                            });
                        }
                        UIManager.renderList();
                    }
                };
                ws.addEventListener('open', () => {
                    wsLog.status = 'Connected';
                    addEvent('open');
                });
                ws.addEventListener('message', event => {
                    addEvent('message', event.data);
                });
                ws.addEventListener('close', event => {
                    wsLog.status = 'Closed';
                    addEvent('close', null, `Code: ${event.code}, Reason: ${event.reason || 'Normal closure'}`);
                    AppConfig.state.websockets.delete(wsId);
                });
                ws.addEventListener('error', () => {
                    wsLog.status = 'Error';
                    addEvent('error', null, 'Connection error');
                });
                if (AppConfig.state.isRunning) {
                    AppConfig.state.logs.unshift({
                        ...wsLog
                    });
                    UIManager.renderList();
                }
                Object.defineProperty(ws, '_wsId', {
                    value: wsId,
                    writable: false
                });
                return ws;
            };
        },
        unhook: function() {
            window.XMLHttpRequest = AppConfig.state.originalAPIs.XMLHttpRequest;
            window.fetch = AppConfig.state.originalAPIs.fetch;
            window.WebSocket = AppConfig.state.originalAPIs.WebSocket;
            AppConfig.state.websockets.clear();
        }
    };

    // ===================================
    // 模組七：事件處理 (EventHandlers)
    // ===================================
    const EventHandlers = {
        onStart: function() {
            AppConfig.state.isRunning = true;
            ApiHooking.hookXHR();
            ApiHooking.hookFetch();
            ApiHooking.hookWebSocket();
            UIManager.updateStatus('正在收集中...', false);
            if (AppConfig.state.uiElements.toggleCollectBtn) Security.setTextContent(AppConfig.state.uiElements.toggleCollectBtn, '停止收集');
        },
        onStop: function() {
            AppConfig.state.isRunning = false;
            UIManager.updateStatus('已停止收集', true);
            if (AppConfig.state.uiElements.toggleCollectBtn) Security.setTextContent(AppConfig.state.uiElements.toggleCollectBtn, '開始收集');
        },
        logNewRequest: function(logData) {
            const headers = {};
            if (logData.requestHeaders instanceof Headers) {
                logData.requestHeaders.forEach((value, key) => headers[key] = value);
            } else if (logData.requestHeaders && typeof logData.requestHeaders === 'object') {
                Object.assign(headers, logData.requestHeaders);
            }
            logData.requestHeaders = headers;
            if (!logData.timestamp) logData.timestamp = new Date();
            logData.viewed = false;
            logData.selected = false;
            AppConfig.state.logs.unshift(logData);
            DataHandlers.limitLogs();
            UIManager.renderList();
        },
        onClear: function() {
            AppConfig.state.logs = [];
            AppConfig.state.currentPage = 1;
            AppConfig.state.websockets.clear();
            AppConfig.state.tabs = [];
            AppConfig.state.activeTabId = null;
            UIManager.render();
            UIManager.updateStatus('日誌已清除', false);
        },
        onClose: function() {
            ApiHooking.unhook();
            const {
                wrap,
                minimizedIcon
            } = AppConfig.state.uiElements;
            if (wrap) wrap.remove();
            if (minimizedIcon) minimizedIcon.remove();
        },
        onDownloadAll: function() {
            const data = JSON.stringify(AppConfig.state.logs, null, 2);
            const blob = new Blob([data], {
                type: 'application/json'
            });
            const date = new Date();
            const filename = `api-logs_${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.json`;
            DataHandlers.triggerDownload(blob, filename);
            UIManager.updateStatus('所有日誌已下載', false);
        },
        onSearch: function() {
            AppConfig.state.currentPage = 1;
            clearTimeout(AppConfig.state.debounceTimer);
            AppConfig.state.debounceTimer = setTimeout(() => UIManager.renderList(), AppConfig.SETTINGS.DEBOUNCE_DELAY);
        },
        onFilterChange: function() {
            AppConfig.state.currentPage = 1;
            UIManager.renderList();
        },
        onSortChange: function(event) {
            const [key, direction] = event.target.value.split('_');
            AppConfig.state.sortKey = key;
            AppConfig.state.sortDirection = direction;
            UIManager.renderList();
        },
        onListClick: function(event) {
            const target = event.target;
            const itemEl = target.closest('.fac-list-item');
            if (!itemEl) return;

            const contentEl = target.closest('.fac-list-item-content');
            if (contentEl) {
                const index = parseInt(contentEl.dataset.index, 10);
                if (!isNaN(index) && AppConfig.state.logs[index]) {
                    const logItem = AppConfig.state.logs[index];
                    logItem.viewed = true;
                    EventHandlers.openLogTab(logItem);
                }
            } else if (target.type === 'checkbox') {
                const index = parseInt(target.dataset.index, 10);
                if (!isNaN(index) && AppConfig.state.logs[index]) {
                    AppConfig.state.logs[index].selected = target.checked;
                    itemEl.classList.toggle('selected', target.checked);
                    EventHandlers.checkDownloadButtonStatus();
                }
            }
        },
        onTabClick: function(event) {
            const target = event.target;
            const tabBtn = target.closest('.fac-tab-btn');
            if (!tabBtn) return;
            const tabId = tabBtn.dataset.tabId;
            const action = target.dataset.action;

            if (action === 'close-tab') {
                EventHandlers.closeTab(tabId);
            } else {
                EventHandlers.switchTab(tabId);
            }
        },
        openLogTab: function(logItem) {
            const state = AppConfig.state;
            const index = state.logs.indexOf(logItem);
            const tabId = `log-${index}`;
            let tab = state.tabs.find(t => t.id === tabId);

            if (!tab) {
                tab = {
                    id: tabId,
                    type: logItem.type,
                    logIndex: index
                };
                state.tabs.push(tab);
            }
            state.activeTabId = tabId;
            UIManager.renderTabs();
        },
        openNewApiTab: function() {
            const state = AppConfig.state;
            const tabId = `new-api-${Date.now()}`;
            const tab = {
                id: tabId,
                type: 'new-api',
                logIndex: -1,
                title: '新增 API'
            };
            state.tabs.push(tab);
            state.activeTabId = tabId;
            UIManager.renderTabs();
        },
        closeTab: function(tabId) {
            const state = AppConfig.state;
            const tabIndex = state.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return;

            state.tabs.splice(tabIndex, 1);

            if (state.activeTabId === tabId) {
                if (state.tabs.length > 0) {
                    const newActiveTab = state.tabs[Math.max(0, tabIndex - 1)];
                    state.activeTabId = newActiveTab.id;
                } else {
                    state.activeTabId = null;
                }
            }
            UIManager.renderTabs();
        },
        switchTab: function(tabId) {
            AppConfig.state.activeTabId = tabId;
            UIManager.renderTabs();
        },
        checkDownloadButtonStatus: function() {
            const selectedLogsCount = AppConfig.state.logs.filter(log => log.selected).length;
            const downloadSelectedBtn = AppConfig.state.uiElements.downloadSelectedBtn;
            if (downloadSelectedBtn) {
                downloadSelectedBtn.disabled = selectedLogsCount === 0;
                Security.setTextContent(downloadSelectedBtn, `下載選取 (${selectedLogsCount})`);
            }
        },
        onSelectAll: function() {
            const allSelected = AppConfig.state.logs.every(log => log.selected);
            AppConfig.state.logs.forEach(log => log.selected = !allSelected);
            UIManager.renderList();
        },
        onDownloadSelected: function() {
            const selectedLogs = AppConfig.state.logs.filter(log => log.selected);
            if (selectedLogs.length === 0) {
                alert('請先選擇要下載的日誌！');
                return;
            }
            const data = JSON.stringify(selectedLogs, null, 2);
            const blob = new Blob([data], {
                type: 'application/json'
            });
            const date = new Date();
            const filename = `selected-api-logs_${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.json`;
            DataHandlers.triggerDownload(blob, filename);
            UIManager.updateStatus(`已下載 ${selectedLogs.length} 筆選取日誌`, false);
        },
        onResend: function(tabId) {
            const startTime = Date.now();
            UIManager.updateStatus('正在發送請求...', false);

            const container = document.querySelector(`.fac-detail-content[data-tab-id="${tabId}"]`);
            if (!container) return;

            const methodBtn = container.querySelector('#edit-method button.active');
            const urlEl = container.querySelector('#edit-url');
            const headersEl = container.querySelector('#edit-headers');
            const formatBtn = container.querySelector('#fac-format-template button.active');
            const selectedTemplateKey = formatBtn ? formatBtn.dataset.format : 'original';

            if (!methodBtn || !urlEl || !headersEl) {
                UIManager.updateStatus('找不到必要的輸入欄位', true);
                return;
            }
            const method = methodBtn.dataset.method;
            let url = urlEl.value.trim();
            if (!url) {
                UIManager.updateStatus('URL 不能為空', true);
                return;
            }
            if (!Security.validateUrl(url)) {
                UIManager.updateStatus('URL 格式不正確', true);
                return;
            }
            let headers = {};
            try {
                const headersText = headersEl.value.trim();
                if (headersText) {
                    if (!Security.validateJson(headersText)) {
                        UIManager.updateStatus('Headers JSON 格式錯誤', true);
                        return;
                    }
                    headers = JSON.parse(headersText);
                }
            } catch (e) {
                UIManager.updateStatus('Headers JSON 格式錯誤', true);
                return;
            }
            let body;
            const formEditor = container.querySelector('#fac-body-form');
            const rawEditor = container.querySelector('#edit-body-raw');

            if (method === 'GET') {
                const baseUrl = url.split('?')[0];
                const params = new URLSearchParams();
                if (formEditor) {
                    formEditor.querySelectorAll('.fac-kv-row').forEach(row => {
                        const keyInput = row.querySelector('.fac-kv-key');
                        const valueInput = row.querySelector('.fac-kv-value');
                        if (keyInput && valueInput && keyInput.value.trim()) {
                            params.append(keyInput.value.trim(), valueInput.value);
                        }
                    });
                }
                const queryString = params.toString();
                url = queryString ? `${baseUrl}?${queryString}` : baseUrl;
                urlEl.value = url;
                body = undefined;
            } else {
                const template = API_TEMPLATES[selectedTemplateKey];
                let rawData;
                if (formEditor && formEditor.classList.contains('active')) {
                    const obj = {};
                    formEditor.querySelectorAll('.fac-kv-row').forEach(row => {
                        const keyInput = row.querySelector('.fac-kv-key');
                        const valueInput = row.querySelector('.fac-kv-value');
                        if (keyInput && valueInput && keyInput.value.trim()) {
                            const key = keyInput.value.trim();
                            const value = valueInput.value;
                            if (obj.hasOwnProperty(key)) {
                                if (!Array.isArray(obj[key])) {
                                    obj[key] = [obj[key]];
                                }
                                obj[key].push(value);
                            } else {
                                obj[key] = value;
                            }
                        }
                    });
                    rawData = obj;
                } else {
                    rawData = rawEditor ? rawEditor.value : '';
                }
                body = template.formatBody ? template.formatBody(rawData) : rawData;
                if (template.headers) {
                    Object.assign(headers, template.headers);
                    headersEl.value = JSON.stringify(headers, null, 2);
                }
            }

            const responsePre = container.querySelector('#fac-response-pre');

            // [語法修正] 替換 ?. 語法以提高相容性
            const template = API_TEMPLATES[selectedTemplateKey];
            const templateName = (template && template.name) || '未知格式';

            AppConfig.state.originalAPIs.fetch(url, {
                    method: method,
                    headers: headers,
                    body: body,
                    credentials: 'include'
                })
                .then(response => {
                    UIManager.updateStatus(`請求成功 (${templateName}) - 狀態: ${response.status}`, false);
                    return response.text().then(responseBody => ({
                        response: response,
                        body: responseBody
                    }));
                })
                .then(({
                    response,
                    body
                }) => {
                    const fullResponseText = `HTTP Status: ${response.status} ${response.statusText}\n\n${DataHandlers.prettyPrintJSON(body)}`;
                    if (responsePre) {
                        responsePre.innerHTML = `<code class="language-json">${DataHandlers.highlightJSON(fullResponseText)}</code>`;
                        responsePre._originalData = body;
                    }
                    const copyBtn = container.querySelector('#fac-copy-response-btn');
                    const exportBtn = container.querySelector('#fac-export-btn');
                    const singleDownloadBtn = container.querySelector('#fac-download-single-btn');
                    if (copyBtn) copyBtn._responseData = body;
                    if (exportBtn) exportBtn._responseData = body;
                    if (singleDownloadBtn) singleDownloadBtn._logItem.response = body;

                    EventHandlers.logNewRequest({
                        type: 'fetch',
                        method: method,
                        url: url,
                        status: response.status,
                        duration: Date.now() - startTime,
                        requestHeaders: headers,
                        requestBody: body,
                        response: body,
                        isResent: true,
                        templateUsed: templateName
                    });
                })
                .catch(error => {
                    UIManager.updateStatus(`請求失敗 (${templateName}): ${error.message}`, true);
                    const errorResponseText = `請求失敗: ${error.message}`;
                    if (responsePre) {
                        Security.setTextContent(responsePre, errorResponseText);
                        responsePre._originalData = errorResponseText;
                    }
                    EventHandlers.logNewRequest({
                        type: 'fetch',
                        method: method,
                        url: url,
                        status: 'Error',
                        duration: Date.now() - startTime,
                        requestHeaders: headers,
                        requestBody: body,
                        response: error.message,
                        isResent: true,
                        templateUsed: templateName
                    });
                });
        },
        onCopyCurl: function(item) {
            if (!item) return;
            let curlText;
            if (item.type === 'websocket') {
                curlText = `# WebSocket Connection Info\nURL: ${item.url}\nStatus: ${item.status}\nTimestamp: ${item.timestamp.toLocaleString()}`;
            } else {
                curlText = DataHandlers.generateCurl(item);
            }
            navigator.clipboard.writeText(curlText).then(() => {
                const button = document.getElementById('copy-curl-btn');
                if (button) {
                    const originalText = Security.escapeHtml(button.textContent);
                    Security.setTextContent(button, '已複製!');
                    setTimeout(() => Security.setTextContent(button, originalText), 2000);
                }
                UIManager.updateStatus('cURL 已複製到剪貼簿', false);
            }).catch(() => {
                UIManager.updateStatus('複製失敗', true);
            });
        },
        onDownloadSingleLog: function(item) {
            if (!item) {
                UIManager.updateStatus('找不到要下載的日誌', true);
                return;
            }
            const logData = JSON.stringify(item, null, 2);
            const blob = new Blob([logData], {
                type: 'application/json'
            });
            const date = new Date();
            const filename = `api-log_${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.json`;
            DataHandlers.triggerDownload(blob, filename);
            UIManager.updateStatus('日誌下載成功！', false);
        },
        onCopyResponse: function(data) {
            if (data === undefined) return;
            navigator.clipboard.writeText(data).then(() => {
                UIManager.updateStatus('回應內容已複製', false);
            }, () => {
                UIManager.updateStatus('複製失敗', true);
            });
        },
        onConvertResponseToForm: function() {
            const container = document.querySelector('.fac-detail-content.active');
            const responsePre = container.querySelector('#fac-response-pre');
            if (!responsePre) return;
            const jsonString = responsePre._originalData;
            const kvPairs = DataHandlers.jsonToKvPairs(jsonString);
            if (!kvPairs) {
                UIManager.updateStatus('回應內容不是有效的 JSON 物件', true);
                return;
            }
            const formHtml = kvPairs.map(p => `<div class="fac-kv-row"><input type="text" class="fac-kv-key" value="${Security.escapeHtml(p.key)}"><input type="text" class="fac-kv-value" value="${Security.escapeHtml(String(p.value))}"><button class="fac-kv-delete">-</button></div>`).join('');

            const currentResponseContent = container.querySelector('#fac-response-content');
            currentResponseContent.innerHTML = `
                <div class="fac-body-tabs" id="fac-response-tabs">
                    <div class="fac-body-tab active" data-tab="form">表單</div>
                    <div class="fac-body-tab" data-tab="raw">原始碼</div>
                </div>
                <div class="fac-kv-editor active" id="fac-response-form">
                    ${formHtml}
                    <button class="fac-kv-add">+</button>
                </div>
                <div class="fac-raw-editor" id="fac-response-raw">
                    <pre id="fac-response-pre"><code class="language-json">${DataHandlers.highlightJSON(DataHandlers.prettyPrintJSON(jsonString))}</code></pre>
                </div>
            `;
            const newResponsePre = currentResponseContent.querySelector('#fac-response-pre');
            if (newResponsePre) newResponsePre._originalData = jsonString;

            UIManager.updateStatus('回應內容已轉換為表單', false);
        },
        onFlattenResponseJson: function() {
            const container = document.querySelector('.fac-detail-content.active');
            const responsePre = container.querySelector('#fac-response-pre');
            if (!responsePre) return;
            const jsonString = responsePre._originalData;
            try {
                const obj = JSON.parse(jsonString);
                const flattened = DataHandlers.flattenJson(obj);
                const flattenedJsonString = JSON.stringify(flattened, null, 2);
                responsePre.innerHTML = `<code class="language-json">${DataHandlers.highlightJSON(flattenedJsonString)}</code>`;
                UIManager.updateStatus('JSON 已扁平化', false);
            } catch (e) {
                UIManager.updateStatus('回應內容不是有效的 JSON 格式，無法扁平化', true);
            }
        },
        onExport: function(data) {
            const format = prompt('請選擇匯出格式: txt 或 csv', 'txt');
            if (!format) return;
            const date = new Date();
            const filename = `response-${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}.${format}`;
            if (format.toLowerCase() === 'txt') {
                const blob = new Blob([data], {
                    type: 'text/plain;charset=utf-8'
                });
                DataHandlers.triggerDownload(blob, filename);
            } else if (format.toLowerCase() === 'csv') {
                try {
                    const jsonData = JSON.parse(data);
                    if (!Array.isArray(jsonData)) throw new Error('資料不是陣列格式');
                    if (jsonData.length === 0) {
                        DataHandlers.triggerDownload(new Blob([''], {
                            type: 'text/csv;charset=utf-8'
                        }), filename);
                        return;
                    }
                    const headers = Object.keys(jsonData[0]);
                    let csvContent = headers.join(',') + '\n';
                    jsonData.forEach(row => {
                        csvContent += headers.map(header => JSON.stringify(row[header] || '')).join(',') + '\n';
                    });
                    const blob = new Blob([`\uFEFF${csvContent}`], {
                        type: 'text/csv;charset=utf-8'
                    });
                    DataHandlers.triggerDownload(blob, filename);
                } catch (e) {
                    alert(`無法匯出為 CSV: ${e.message}`);
                }
            }
        },
        onFilterResponseFields: function() {
            const container = document.querySelector('.fac-detail-content.active');
            const filterInput = container.querySelector('#fac-response-filter-input');
            const responsePre = container.querySelector('#fac-response-pre');
            const originalData = responsePre._originalData;
            if (!filterInput || !responsePre || !originalData) return;

            const filterKeys = filterInput.value.split(',').map(key => key.trim()).filter(key => key);

            if (filterKeys.length === 0) {
                EventHandlers.onResetResponseFilter();
                return;
            }

            try {
                const originalObj = JSON.parse(originalData);
                let filteredObj = {};

                if (Array.isArray(originalObj)) {
                    filteredObj = originalObj.map(item => {
                        const newItem = {};
                        filterKeys.forEach(key => {
                            if (item.hasOwnProperty(key)) {
                                newItem[key] = item[key];
                            }
                        });
                        return newItem;
                    });
                } else {
                    filterKeys.forEach(key => {
                        if (originalObj.hasOwnProperty(key)) {
                            filteredObj[key] = originalObj[key];
                        }
                    });
                }

                const filteredJsonString = JSON.stringify(filteredObj, null, 2);
                responsePre.innerHTML = `<code class="language-json">${DataHandlers.highlightJSON(filteredJsonString)}</code>`;
                UIManager.updateStatus('回應已篩選', false);

            } catch (e) {
                UIManager.updateStatus('篩選失敗，回應內容不是有效的 JSON 格式', true);
            }
        },
        onResetResponseFilter: function() {
            const container = document.querySelector('.fac-detail-content.active');
            const filterInput = container.querySelector('#fac-response-filter-input');
            const responsePre = container.querySelector('#fac-response-pre');
            if (!filterInput || !responsePre || !responsePre._originalData) return;
            filterInput.value = '';
            const originalJson = responsePre._originalData;
            responsePre.innerHTML = `<code class="language-json">${DataHandlers.highlightJSON(DataHandlers.prettyPrintJSON(originalJson))}</code>`;
            UIManager.updateStatus('回應篩選已重置', false);
        },
        onCollapseToggle: function() {
            const state = AppConfig.state;
            state.isCollapsed = !state.isCollapsed;
            if (state.uiElements.bodyWrapper) {
                state.uiElements.bodyWrapper.classList.toggle('collapsed', state.isCollapsed);
            }
            if (state.uiElements.collapseBtn) {
                Security.setTextContent(state.uiElements.collapseBtn, state.isCollapsed ? '∨' : '︿');
            }
        },
        onMinimizeToggle: function() {
            const state = AppConfig.state;
            state.isMinimized = !state.isMinimized;
            if (state.uiElements.wrap) {
                state.uiElements.wrap.style.display = state.isMinimized ? 'none' : 'flex';
            }
            if (state.uiElements.minimizedIcon) {
                state.uiElements.minimizedIcon.style.display = state.isMinimized ? 'flex' : 'none';
            }
        },
        onMethodChange: function(event) {
            const target = event.target;
            if (target.tagName === 'BUTTON' && target.dataset.method) {
                const container = target.closest('.fac-btn-group');
                container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
            }
        },
        onFormatChange: function(event) {
            const target = event.target;
            if (target.tagName === 'BUTTON' && target.dataset.format) {
                const container = target.closest('.fac-btn-group');
                container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
            }
        },
        onToggleCollect: function() {
            if (AppConfig.state.isRunning) {
                EventHandlers.onStop();
            } else {
                EventHandlers.onStart();
            }
        },
        initDraggable: function(element, headerSelector) {
            if (!element) return;
            let pos1 = 0,
                pos2 = 0,
                pos3 = 0,
                pos4 = 0;
            const dragHandle = headerSelector ? element.querySelector(headerSelector) : element;
            if (dragHandle) {
                dragHandle.onmousedown = dragMouseDown;
            }

            function dragMouseDown(e) {
                e = e || window.event;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e = e || window.event;
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + "px";
                element.style.left = (element.offsetLeft - pos1) + "px";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
    };

    // ===================================
    // 模組八：應用程式主入口 (App)
    // ===================================
    const App = {
        init: function() {
            if (document.getElementById(AppConfig.SETTINGS.TOOL_ID)) {
                const existing = document.getElementById(AppConfig.SETTINGS.TOOL_ID);
                if (existing) existing.remove();
                const minimizedIcon = document.getElementById('fac-minimized-icon');
                if (minimizedIcon) minimizedIcon.remove();
                ApiHooking.unhook();
                return;
            }
            UIManager.create();
            AppConfig.state.uiElements = {
                wrap: document.getElementById('fac-main-wrap'),
                title: document.getElementById('fac-title'),
                toggleCollectBtn: document.getElementById('fac-toggle-collect-btn'),
                searchBox: document.getElementById('fac-search-input'),
                list: document.getElementById('fac-list'),
                pagination: document.getElementById('fac-pagination'),
                clearBtn: document.getElementById('fac-clear-btn'),
                closeBtn: document.getElementById('fac-close-btn'),
                collapseBtn: document.getElementById('fac-collapse-btn'),
                minimizeBtn: document.getElementById('fac-minimize-btn'),
                minimizedIcon: document.getElementById('fac-minimized-icon'),
                bodyWrapper: document.querySelector('.fac-body-wrapper'),
                filterSelect: document.getElementById('fac-filter-select'),
                sortSelect: document.getElementById('fac-sort-select'),
                newApiBtn: document.getElementById('fac-new-api-btn'),
                listContainer: document.getElementById('fac-list-container'),
                tabsContainer: document.getElementById('fac-tabs-container'),
                tabsHeader: document.getElementById('fac-tabs-header'),
                tabsContent: document.getElementById('fac-tabs-content'),
                selectAllBtn: document.getElementById('fac-select-all-btn'),
                downloadAllBtn: document.getElementById('fac-download-all-btn'),
                downloadSelectedBtn: document.getElementById('fac-download-selected-btn'),
                statusBar: document.getElementById('fac-status-bar')
            };
            this.bindEvents();
            EventHandlers.onStart();
        },
        bindEvents: function() {
            const ui = AppConfig.state.uiElements;
            ui.list.addEventListener('click', EventHandlers.onListClick);
            ui.toggleCollectBtn.addEventListener('click', EventHandlers.onToggleCollect);
            ui.clearBtn.addEventListener('click', EventHandlers.onClear);
            ui.closeBtn.addEventListener('click', EventHandlers.onClose);
            ui.downloadAllBtn.addEventListener('click', EventHandlers.onDownloadAll);
            ui.searchBox.addEventListener('keyup', EventHandlers.onSearch);
            ui.filterSelect.addEventListener('change', EventHandlers.onFilterChange);
            ui.sortSelect.addEventListener('change', EventHandlers.onSortChange);
            ui.collapseBtn.addEventListener('click', EventHandlers.onCollapseToggle);
            ui.minimizeBtn.addEventListener('click', EventHandlers.onMinimizeToggle);
            ui.minimizedIcon.addEventListener('click', EventHandlers.onMinimizeToggle);
            ui.newApiBtn.addEventListener('click', () => EventHandlers.openNewApiTab());
            ui.tabsHeader.addEventListener('click', EventHandlers.onTabClick);
            ui.selectAllBtn.addEventListener('click', EventHandlers.onSelectAll);
            ui.downloadSelectedBtn.addEventListener('click', EventHandlers.onDownloadSelected);

            ui.tabsContent.addEventListener('click', function(event) {
                const target = event.target;
                const activeTabPanel = ui.tabsContent.querySelector('.fac-detail-content.active');
                if (!activeTabPanel) return;

                const handlerMap = {
                    'resend-btn': () => EventHandlers.onResend(activeTabPanel.dataset.tabId),
                    'copy-curl-btn': () => EventHandlers.onCopyCurl(target._logItem),
                    'fac-download-single-btn': () => EventHandlers.onDownloadSingleLog(target._logItem),
                    'fac-copy-response-btn': () => EventHandlers.onCopyResponse(target._responseData),
                    'fac-convert-to-form-btn': () => EventHandlers.onConvertResponseToForm(),
                    'fac-flatten-json-btn': () => EventHandlers.onFlattenResponseJson(),
                    'fac-export-btn': () => EventHandlers.onExport(target._responseData),
                    'fac-ws-send-btn': () => EventHandlers.onSendWebSocketMessage(),
                    'fac-parse-url-btn': () => EventHandlers.onParseUrl(),
                    'fac-response-filter-btn': () => EventHandlers.onFilterResponseFields(),
                    'fac-response-reset-btn': () => EventHandlers.onResetResponseFilter()
                };
                if (handlerMap[target.id]) {
                    handlerMap[target.id]();
                } else if (target.classList.contains('fac-editor-tab')) {
                    EventHandlers.onEditorTabSwitch(target);
                } else if (target.classList.contains('fac-body-tab')) {
                    EventHandlers.onBodyTabSwitch(target);
                } else if (target.closest('#edit-method') && target.tagName === 'BUTTON') {
                    EventHandlers.onMethodChange(event);
                } else if (target.closest('#fac-format-template') && target.tagName === 'BUTTON') {
                    EventHandlers.onFormatChange(event);
                }
            });

            document.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    EventHandlers.onClose();
                }
            });

            EventHandlers.initDraggable(ui.wrap, ".fac-header");
            EventHandlers.initDraggable(ui.minimizedIcon, null);
        }
    };
    App.init();
})();