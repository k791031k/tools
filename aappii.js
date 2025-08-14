javascript: (function() {
    'use strict';
    // ===================
    // 模組一：應用程式狀態與設定
    // ===================
    const config = {
        TOOL_ID: 'full-api-collector',
        DEBOUNCE_DELAY: 300,
        ITEMS_PER_PAGE: 10
    };
    const state = {
        isRunning: false,
        logs: [],
        ui: {},
        originals: {
            XMLHttpRequest: window.XMLHttpRequest,
            fetch: window.fetch.bind(window)
        },
        debounceTimer: null,
        currentPage: 1,
        isCollapsed: false,
        isMinimized: false
    };
    // ===================
    // 模組二：通用工具函數
    // ===================
    const Utils = {
        prettyPrintJSON: function(jsonString) {
            try {
                return JSON.stringify(JSON.parse(jsonString), null, 2);
            } catch (e) {
                return jsonString;
            }
        },
        highlightJSON: function(jsonString) {
            if (!jsonString) return '';
            let json = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, function(match) {
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
                return '<span class="fac-hl-' + cls + '">' + match + '</span>';
            });
        },
        generateCurl: function(item) {
            let c = `curl "${item.url}" \\\n`;
            if (item.method && item.method.toUpperCase() !== 'GET') {
                c += `  -X ${item.method.toUpperCase()} \\\n`;
            }
            for (const k in item.requestHeaders) {
                let v = typeof item.requestHeaders.get === 'function' ? item.requestHeaders.get(k) : item.requestHeaders[k];
                if (v) {
                    c += `  -H "${k}: ${String(v).replace(/"/g,'\\"')}" \\\n`;
                }
            }
            if (item.requestBody) {
                let b = typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody);
                c += `  --data-raw $'${b.replace(/'/g,"'\\''")}' \\\n`;
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
        }
    };
    // ===================
    // 模組三：UI 介面管理
    // ===================
    const UIManager = {
        getTemplate: function() {
            return `
                <div class="fac-wrap" id="fac-main-wrap">
                    <div class="fac-header">
                        <div id="fac-title" class="fac-title">API 收集調試工具</div>
                        <div class="fac-actions">
                            <button id="fac-minimize-btn" class="fac-btn fac-window-btn" title="最小化">－</button>
                            <button id="fac-collapse-btn" class="fac-btn fac-window-btn" title="收摺/展開">︿</button>
                            <button id="fac-close-btn" class="fac-btn danger">關閉</button>
                        </div>
                    </div>
                    <div class="fac-body-wrapper">
                        <div class="fac-controls">
                            <button id="fac-start-btn" class="fac-btn primary">開始收集</button>
                            <button id="fac-stop-btn" class="fac-btn">停止收集</button>
                            <button id="fac-clear" class="fac-btn danger">清除日誌</button>
                            <input id="fac-search" type="text" placeholder="搜尋..." class="fac-search"/>
                            <button id="fac-download-btn" class="fac-btn">下載日誌</button>
                        </div>
                        <div id="fac-list" class="fac-list"></div>
                        <div id="fac-pagination" class="fac-pagination"></div>
                    </div>
                </div>
                <div id="fac-minimized-icon" class="fac-minimized-icon" style="display:none;" title="還原視窗">...</div>
                <style>
                    .fac-wrap { position: fixed; top: 10px; right: 10px; width: 520px; background: #fff; color: #333; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.25); font-family: sans-serif; z-index: 999999; display: flex; flex-direction: column; max-height: calc(100vh - 20px); overflow: hidden; border: 1px solid #ccc; }
                    .fac-header { display: flex; justify-content: space-between; align-items: center; background: #f5f5f5; padding: 8px 15px; border-bottom: 1px solid #eee; flex-shrink: 0; cursor: move; } .fac-title { font-weight: bold; } .fac-actions { display: flex; gap: 6px; align-items: center; }
                    .fac-btn { padding: 4px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; font-size: 12px; transition: all 0.2s; } .fac-btn:hover { background: #f0f0f0; border-color: #bbb; } .fac-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }
                    .fac-window-btn { padding: 2px 6px; font-weight: bold; }
                    .primary { background: #4caf50; color: #fff; border-color: #4caf50; } .primary:hover { background: #43a047; }
                    .danger { background: #f44336; color: #fff; border-color: #f44336; } .danger:hover { background: #e53935; }
                    .fac-body-wrapper { display: flex; flex-direction: column; flex: 1; overflow: hidden; transition: all 0.3s ease; }
                    .fac-body-wrapper.collapsed { display: none; }
                    .fac-controls { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid #eee; flex-shrink: 0; } .fac-search { flex: 1; padding: 4px 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 12px; }
                    .fac-list { flex: 1; overflow-y: auto; }
                    .fac-item { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer; } .fac-item:hover { background-color: #f5fafd; }
                    .fac-item-line1 { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                    .fac-item-line1-left { display: flex; align-items: center; overflow: hidden; }
                    .fac-method { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #fff; margin-right: 8px; font-weight: bold; flex-shrink: 0; }
                    .fac-resent-tag { background-color: #673ab7; color: white; font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-right: 8px; flex-shrink: 0; }
                    .GET { background: #4caf50; } .POST { background: #2196f3; } .PUT { background: #ffc107; color: #000; } .DELETE { background: #f44336; }
                    .fac-url { font-size: 13px; word-break: break-all; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } 
                    .fac-timestamp { font-size: 12px; color: #999; flex-shrink: 0; }
                    .fac-status { font-size: 11px; color: #666; }
                    .fac-pagination { display: flex; justify-content: center; align-items: center; padding: 8px; border-top: 1px solid #eee; flex-shrink: 0; gap: 4px; }
                    .fac-page-btn { padding: 4px 8px; font-size: 12px; } .fac-page-btn.active { background: #4caf50; color: white; border-color: #4caf50; }
                    .fac-detail { display: flex; flex-direction: column; height: 100%; }
                    .fac-editor-statusbar { padding: 10px; text-align: center; font-size: 14px; font-weight: bold; color: #fff; display: none; } .fac-editor-statusbar.success { background: #4caf50; } .fac-editor-statusbar.error { background: #f44336; }
                    .fac-detail-label { display: block; margin: 10px 0 4px 0; font-weight: bold; font-size: 13px; }
                    .fac-detail input, .fac-detail textarea, .fac-detail select { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: monospace; }
                    .fac-url-container { display: flex; align-items: center; gap: 4px; } #edit-url { margin-bottom: 0; } #fac-parse-url-btn { padding: 4px 8px; font-size: 12px; height: 30px; flex-shrink: 0; }
                    .fac-detail-main-actions { display: flex; gap: 8px; padding: 8px; background: #f9f9f9; }
                    .fac-send-btn, .fac-copy-btn, .fac-back-btn, .fac-export-btn, #fac-copy-response-btn { background: #2196f3; color: #fff; border:none; padding:10px; border-radius:6px; cursor:pointer; flex:1; font-size: 14px; font-weight: bold; }
                    .fac-copy-btn { background: #607d8b; } .fac-back-btn { background: #757575; } .fac-export-btn, #fac-copy-response-btn { background: #009688; }
                    .fac-editor-tabs { display: flex; background: #f5f5f5; padding: 8px 8px 0 8px; flex-shrink: 0; border-top: 1px solid #eee; }
                    .fac-editor-tab { padding: 8px 12px; cursor: pointer; font-size: 13px; background: #e0e0e0; border: 1px solid #ccc; border-bottom: none; border-radius: 6px 6px 0 0; margin-right: 4px; }
                    .fac-editor-tab.active { background: #fff; border-bottom: 1px solid #fff; margin-bottom: -1px; }
                    .fac-editor-content { flex: 1; padding: 12px; border: 1px solid #ccc; border-top: none; overflow-y: auto; }
                    .fac-tab-panel { display: none; } .fac-tab-panel.active { display: block; animation: fadeIn 0.3s ease; }
                    .fac-body-tabs { display: flex; margin-bottom: 4px; border-bottom: 1px solid #ccc; }
                    .fac-body-tab { padding: 4px 8px; cursor: pointer; font-size: 12px; background: #eee; border-radius: 4px 4px 0 0; border: 1px solid #ccc; border-bottom: none; margin-right: 4px; }
                    .fac-body-tab.active { background: #fff; border-bottom: 1px solid #fff; margin-bottom: -1px; }
                    .fac-kv-editor, .fac-raw-editor { display: none; } .fac-kv-editor.active, .fac-raw-editor.active { display: block; }
                    .fac-kv-row { display: flex; gap: 4px; margin-bottom: 4px; align-items: center; }
                    .fac-kv-key, .fac-kv-value { flex: 1; }
                    .fac-kv-delete, .fac-kv-add { background: #f44336; color: white; border: none; border-radius: 50%; cursor: pointer; font-weight: bold; width: 22px; height: 22px; line-height: 22px; text-align: center; }
                    .fac-kv-add { background: #4caf50; }
                    #edit-response-pre { background: #f9f9f9; padding: 8px; border: 1px solid #eee; border-radius: 4px; font-size: 13px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5; }
                    .fac-hl-string { color: #2a9442; } .fac-hl-number { color: #1c6ad6; } .fac-hl-boolean { color: #c43ad6; } .fac-hl-null { color: #9e0505; } .fac-hl-key { color: #ac620c; font-weight: bold; }
                    .fac-minimized-icon { position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; background: #4caf50; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 999998; }
                </style>
            `;
        },
        create: function() {
            const w = document.createElement('div');
            w.id = config.TOOL_ID;
            w.innerHTML = this.getTemplate();
            document.body.appendChild(w);
        },
        updateTitleAndDownloadBtn: function() {
            const count = state.logs.length;
            if (state.ui.title) state.ui.title.textContent = `API 收集調試工具 (共 ${count} 筆)`;
            if (state.ui.downloadBtn) state.ui.downloadBtn.textContent = `下載日誌 (${count})`;
        },
        render: function() {
            if (!state.ui.list) return;
            state.ui.list.innerHTML = '';
            const f = document.createDocumentFragment();
            const s = state.ui.searchBox.value.toLowerCase();
            const filteredLogs = state.logs.filter(l => l.url.toLowerCase().includes(s) || l.method.toLowerCase().includes(s));
            const totalPages = Math.ceil(filteredLogs.length / config.ITEMS_PER_PAGE);
            if (state.currentPage > totalPages) state.currentPage = totalPages || 1;
            const startIndex = (state.currentPage - 1) * config.ITEMS_PER_PAGE;
            const paginatedLogs = filteredLogs.slice(startIndex, startIndex + config.ITEMS_PER_PAGE);
            paginatedLogs.forEach(l => {
                const d = document.createElement('div');
                d.className = 'fac-item';
                d.dataset.logIndex = state.logs.indexOf(l);
                const resentTag = l.isResent ? '<span class="fac-resent-tag">重送</span>' : '';
                d.innerHTML = `<div class="fac-item-line1"><div class="fac-item-line1-left"><span class="fac-method ${l.method}">${l.method}</span>${resentTag}<span class="fac-url">${l.url}</span></div><span class="fac-timestamp">${l.timestamp.toLocaleTimeString()}</span></div><div class="fac-status">狀態: ${l.status} - ${l.duration}ms</div>`;
                f.appendChild(d);
            });
            state.ui.list.appendChild(f);
            this.updateTitleAndDownloadBtn();
            this.renderPagination(totalPages);
        },
        renderPagination: function(totalPages) {
            if (!state.ui.pagination) return;
            state.ui.pagination.innerHTML = '';
            if (totalPages <= 1) return;
            const createBtn = (text, page, disabled = false, isActive = false) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.className = 'fac-btn fac-page-btn';
                if (isActive) btn.classList.add('active');
                btn.disabled = disabled;
                btn.onclick = () => {
                    state.currentPage = page;
                    UIManager.render();
                };
                return btn;
            };
            if (state.currentPage > 1) state.ui.pagination.appendChild(createBtn('«', 1));
            if (state.currentPage > 1) state.ui.pagination.appendChild(createBtn('‹', state.currentPage - 1));
            let startPage = Math.max(1, state.currentPage - 2),
                endPage = Math.min(totalPages, state.currentPage + 2);
            for (let i = startPage; i <= endPage; i++) {
                state.ui.pagination.appendChild(createBtn(i, i, false, state.currentPage === i))
            }
            if (state.currentPage < totalPages) state.ui.pagination.appendChild(createBtn('›', state.currentPage + 1));
            if (state.currentPage < totalPages) state.ui.pagination.appendChild(createBtn('»', totalPages));
        },
        showEditor: function(item) {
            if (!state.ui.list) return;
            state.ui.list.innerHTML = '';
            const d = document.createElement('div');
            d.className = 'fac-detail';
            const bodyStr = (item.method !== 'GET' && item.requestBody) ? (typeof item.requestBody === 'string' ? item.requestBody : JSON.stringify(item.requestBody)) : '';
            const queryParams = item.url.split('?')[1] || '';
            let kvPairs = (item.method === 'GET') ? Utils.parseQueryString(queryParams) : Utils.parseQueryString(bodyStr);
            const showFormEditor = !!kvPairs;
            const highlightedResponse = Utils.highlightJSON(Utils.prettyPrintJSON(item.response || ''));
            d.innerHTML = `
                <div id="fac-editor-statusbar" class="fac-editor-statusbar"></div>
                <div class="fac-detail-main-actions"><button id="fac-back-btn" class="fac-back-btn">返回列表</button><button id="resend-btn" class="fac-send-btn">重新發送</button><button id="copy-curl-btn" class="fac-copy-btn">複製為 cURL</button></div>
                <div class="fac-editor-tabs"><div class="fac-editor-tab active" data-tab="main">主要</div><div class="fac-editor-tab" data-tab="headers">標頭</div><div class="fac-editor-tab" data-tab="body">Body</div><div class="fac-editor-tab" data-tab="response">回應</div></div>
                <div class="fac-editor-content">
                    <div id="fac-tab-main" class="fac-tab-panel active">
                        <label class="fac-detail-label">Method</label><select id="edit-method">${['GET','POST','PUT','DELETE','PATCH'].map(m=>`<option ${m===item.method?'selected':''}>${m}</option>`).join('')}</select>
                        <label class="fac-detail-label">URL</label><div class="fac-url-container"><input id="edit-url" value="${item.url}"/><button id="fac-parse-url-btn" class="fac-btn" title="解析URL查詢字串並填入Body表單">解析</button></div>
                    </div>
                    <div id="fac-tab-headers" class="fac-tab-panel"><label class="fac-detail-label">Headers (JSON)</label><textarea id="edit-headers" rows="15">${JSON.stringify(item.requestHeaders,null,2)}</textarea></div>
                    <div id="fac-tab-body" class="fac-tab-panel">
                        <div class="fac-body-tabs"><div class="fac-body-tab ${showFormEditor?'active':''}" data-tab="form">表單</div><div class="fac-body-tab ${!showFormEditor?'active':''}" data-tab="raw">原始碼</div></div>
                        <div class="fac-kv-editor ${showFormEditor?'active':''}" id="fac-body-form">${(kvPairs||[]).map(p=>`<div class="fac-kv-row"><input type="text" class="fac-kv-key" value="${p.key.replace(/"/g,'&quot;')}"><input type="text" class="fac-kv-value" value="${String(p.value).replace(/"/g,'&quot;')}"><button class="fac-kv-delete">-</button></div>`).join('')}<button class="fac-kv-add">+</button></div>
                        <div class="fac-raw-editor ${!showFormEditor?'active':''}"><textarea id="edit-body-raw" rows="12">${Utils.prettyPrintJSON(bodyStr)}</textarea></div>
                    </div>
                    <div id="fac-tab-response" class="fac-tab-panel">
                        <div style="display:flex; gap: 8px; margin-bottom: 8px;"><button id="fac-copy-response-btn" style="flex:1;">複製回應</button><button id="fac-export-btn" class="fac-export-btn" style="flex:1;">匯出...</button></div>
                        <pre id="edit-response-pre"><code class="language-json">${highlightedResponse}</code></pre>
                    </div>
                </div>
            `;
            state.ui.list.appendChild(d);
            const responseData = item.response || '';
            d.querySelector('#copy-curl-btn')._logItem = item;
            d.querySelector('#fac-export-btn')._responseData = responseData;
            d.querySelector('#fac-copy-response-btn')._responseData = responseData;
        },
        updateEditorStatus: function(message, isError = false) {
            const statusBar = document.getElementById('fac-editor-statusbar');
            if (!statusBar) return;
            statusBar.textContent = message;
            statusBar.className = 'fac-editor-statusbar';
            statusBar.classList.add(isError ? 'error' : 'success');
            statusBar.style.display = 'block';
        }
    };

    const ApiHooking = {
        addLog: function(logData) {
            if (state.isRunning) EventHandlers.logNewRequest(logData);
        },
        hookXHR: function() {
            window.XMLHttpRequest = function(...a) {
                const x = new state.originals.XMLHttpRequest(...a);
                let m, u, s, h = {};
                const o = x.open;
                x.open = function(M, U, ...r) {
                    m = M ? M.toUpperCase() : 'GET';
                    u = U || '';
                    s = Date.now();
                    return o.apply(this, [M, U, ...r])
                };
                const srh = x.setRequestHeader;
                x.setRequestHeader = function(k, v) {
                    h[k] = v;
                    return srh.apply(this, [k, v])
                };
                let b = null;
                const S = x.send;
                x.send = function(B) {
                    b = B;
                    return S.apply(this, arguments)
                };
                x.addEventListener('load', () => ApiHooking.addLog({
                    method: m,
                    url: u,
                    status: x.status,
                    duration: Date.now() - s,
                    requestHeaders: h,
                    requestBody: b,
                    response: x.responseText
                }));
                return x;
            }
        },
        hookFetch: function() {
            window.fetch = function(i, n = {}) {
                const m = (n.method || 'GET').toUpperCase();
                const u = typeof i === 'string' ? i : (i && i.url ? i.url : '');
                const s = Date.now();
                return state.originals.fetch(i, n).then(r => {
                    if (state.isRunning) {
                        r.clone().text().then(b => ApiHooking.addLog({
                            method: m,
                            url: u,
                            status: r.status,
                            duration: Date.now() - s,
                            requestHeaders: n.headers || {},
                            requestBody: n.body || null,
                            response: b
                        }));
                    }
                    return r;
                }).catch(error => {
                    if (state.isRunning) {
                        ApiHooking.addLog({
                            method: m,
                            url: u,
                            status: 'Error',
                            duration: Date.now() - s,
                            requestHeaders: n.headers || {},
                            requestBody: n.body || null,
                            response: error.message || 'Network Error'
                        });
                    }
                    throw error;
                });
            }
        },
        unhook: function() {
            window.XMLHttpRequest = state.originals.XMLHttpRequest;
            window.fetch = state.originals.fetch;
        }
    };
    const EventHandlers = {
        onStart: function() {
            state.isRunning = true;
            ApiHooking.hookXHR();
            ApiHooking.hookFetch();
            state.ui.startBtn.disabled = true;
            state.ui.stopBtn.disabled = false;
            UIManager.render();
        },
        onStop: function() {
            state.isRunning = false;
            state.ui.startBtn.disabled = false;
            state.ui.stopBtn.disabled = true;
        },
        logNewRequest: function(logData) {
            const h = {};
            if (logData.requestHeaders instanceof Headers) {
                logData.requestHeaders.forEach((v, k) => h[k] = v);
            } else if (logData.requestHeaders) {
                Object.assign(h, logData.requestHeaders);
            }
            logData.requestHeaders = h;
            logData.timestamp = new Date();
            state.logs.unshift(logData);
            UIManager.render();
        },
        onClear: function() {
            state.logs = [];
            state.currentPage = 1;
            UIManager.render();
        },
        onClose: function() {
            ApiHooking.unhook();
            if (state.ui.wrap) state.ui.wrap.remove();
            if (state.ui.minimizedIcon) state.ui.minimizedIcon.remove();
        },
        onDownload: function() {
            const d = JSON.stringify(state.logs, null, 2);
            const b = new Blob([d], {
                type: 'application/json'
            });
            const u = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = u;
            a.download = 'api-logs.json';
            a.click();
            URL.revokeObjectURL(u);
        },
        onSearch: function() {
            state.currentPage = 1;
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => UIManager.render(), config.DEBOUNCE_DELAY);
        },
        onListClick: function(event) {
            const t = event.target;
            const itemEl = t.closest('.fac-item');
            if (itemEl) {
                const i = parseInt(itemEl.dataset.logIndex, 10);
                if (!isNaN(i) && state.logs[i]) {
                    UIManager.showEditor(state.logs[i])
                }
                return
            }
            const handlerMap = {
                'resend-btn': () => EventHandlers.onResend(),
                'copy-curl-btn': () => EventHandlers.onCopyCurl(t._logItem),
                'fac-back-btn': () => UIManager.render(),
                'fac-parse-url-btn': () => EventHandlers.onParseUrl(),
                'fac-export-btn': () => EventHandlers.onExport(t._responseData),
                'fac-copy-response-btn': () => EventHandlers.onCopyResponse(t._responseData)
            };
            if (handlerMap[t.id]) {
                handlerMap[t.id]()
            }
            if (t.classList.contains('fac-editor-tab')) EventHandlers.onEditorTabSwitch(t);
            else if (t.classList.contains('fac-body-tab')) EventHandlers.onBodyTabSwitch(t);
            else if (t.classList.contains('fac-kv-add')) EventHandlers.onAddField();
            else if (t.classList.contains('fac-kv-delete')) EventHandlers.onDeleteField(t);
        },
        onResend: function() {
            const startTime = Date.now();
            UIManager.updateEditorStatus('正在發送請求...', false);
            const method = document.getElementById('edit-method').value;
            let url = document.getElementById('edit-url').value;
            const headersEl = document.getElementById('edit-headers');
            let headers = {};
            try {
                headers = JSON.parse(headersEl.value);
            } catch (e) {
                UIManager.updateEditorStatus('Headers JSON 格式錯誤！', 'error');
                return;
            }
            let body;
            const formEditor = document.getElementById('fac-body-form');
            if (method === 'GET') {
                const b = url.split('?')[0];
                const p = new URLSearchParams();
                formEditor.querySelectorAll('.fac-kv-row').forEach(r => {
                    const k = r.querySelector('.fac-kv-key').value.trim(),
                        v = r.querySelector('.fac-kv-value').value;
                    if (k) p.append(k, v);
                });
                const q = p.toString();
                url = q ? `${b}?${q}` : b;
                document.getElementById('edit-url').value = url;
                body = undefined;
            } else {
                const cT = Object.entries(headers).find(([k, v]) => k.toLowerCase() === 'content-type')?.[1] || '';
                if (formEditor.classList.contains('active')) {
                    if (cT.includes('application/x-www-form-urlencoded')) {
                        const p = new URLSearchParams();
                        formEditor.querySelectorAll('.fac-kv-row').forEach(r => {
                            const k = r.querySelector('.fac-kv-key').value.trim(),
                                v = r.querySelector('.fac-kv-value').value;
                            if (k) p.append(k, v);
                        });
                        body = p.toString();
                    } else {
                        const o = {};
                        formEditor.querySelectorAll('.fac-kv-row').forEach(r => {
                            const k = r.querySelector('.fac-kv-key').value.trim(),
                                v = r.querySelector('.fac-kv-value').value;
                            if (!k) return;
                            if (o.hasOwnProperty(k)) {
                                if (!Array.isArray(o[k])) {
                                    o[k] = [o[k]]
                                }
                                o[k].push(v)
                            } else {
                                o[k] = v
                            }
                        });
                        body = JSON.stringify(o);
                        if (body !== '{}' && !cT.includes('json')) {
                            headers['Content-Type'] = 'application/json;charset=UTF-8';
                            headersEl.value = JSON.stringify(headers, null, 2);
                        }
                    }
                } else {
                    body = document.getElementById('edit-body-raw').value;
                }
            }
            const resPre = document.getElementById('edit-response-pre');
            state.originals.fetch(url, {
                    method: method,
                    headers: headers,
                    body: body,
                    credentials: 'include'
                })
                .then(res => {
                    UIManager.updateEditorStatus(`請求成功 - 狀態: ${res.status}`, false);
                    return res.text().then(b => ({
                        res: res,
                        body: b,
                        rawBody: b
                    }));
                })
                .then(({
                    res,
                    body,
                    rawBody
                }) => {
                    const fullResponseText = `HTTP Status: ${res.status} ${res.statusText}\n\n${Utils.prettyPrintJSON(body)}`;
                    resPre.innerHTML = `<code class="language-json">${Utils.highlightJSON(fullResponseText)}</code>`;
                    const copyBtn = document.getElementById('fac-copy-response-btn');
                    const exportBtn = document.getElementById('fac-export-btn');
                    if (copyBtn) copyBtn._responseData = rawBody;
                    if (exportBtn) exportBtn._responseData = rawBody;
                    EventHandlers.logNewRequest({
                        method: method,
                        url: url,
                        status: res.status,
                        duration: Date.now() - startTime,
                        requestHeaders: headers,
                        requestBody: body,
                        response: rawBody,
                        isResent: true
                    });
                })
                .catch(e => {
                    UIManager.updateEditorStatus(`請求失敗: ${e.message}`, 'error');
                    resPre.innerHTML = `請求失敗: ${e.message}`;
                    EventHandlers.logNewRequest({
                        method: method,
                        url: url,
                        status: 'Error',
                        duration: Date.now() - startTime,
                        requestHeaders: headers,
                        requestBody: body,
                        response: e.message,
                        isResent: true
                    });
                });
        },
        onCopyCurl: function(item) {
            if (!item) return;
            const c = Utils.generateCurl(item);
            navigator.clipboard.writeText(c).then(() => {
                const b = document.getElementById('copy-curl-btn');
                if (b) {
                    b.textContent = '已複製!';
                    setTimeout(() => b.textContent = '複製為 cURL', 2000)
                }
            }, () => {
                if (b) {
                    b.textContent = '複製失敗'
                }
            });
        },
        onEditorTabSwitch: function(tabEl) {
            const p = tabEl.closest('.fac-detail');
            const t = tabEl.dataset.tab;
            p.querySelectorAll('.fac-editor-tab').forEach(e => e.classList.remove('active'));
            tabEl.classList.add('active');
            p.querySelectorAll('.fac-tab-panel').forEach(e => e.classList.remove('active'));
            if (p.querySelector(`#fac-tab-${t}`)) p.querySelector(`#fac-tab-${t}`).classList.add('active');
        },
        onBodyTabSwitch: function(tabEl) {
            const p = tabEl.closest('#fac-tab-body');
            const t = tabEl.dataset.tab;
            p.querySelectorAll('.fac-body-tab').forEach(e => e.classList.remove('active'));
            tabEl.classList.add('active');
            p.querySelectorAll('.fac-kv-editor, .fac-raw-editor').forEach(e => e.classList.remove('active'));
            if (t === 'form') {
                p.querySelector('.fac-kv-editor').classList.add('active')
            } else {
                p.querySelector('.fac-raw-editor').classList.add('active');
            }
        },
        onAddField: function() {
            const c = document.getElementById('fac-body-form');
            const n = document.createElement('div');
            n.className = 'fac-kv-row';
            n.innerHTML = `<input type="text" class="fac-kv-key" placeholder="欄位"><input type="text" class="fac-kv-value" placeholder="值"><button class="fac-kv-delete">-</button>`;
            c.insertBefore(n, c.querySelector('.fac-kv-add'));
        },
        onDeleteField: function(btn) {
            btn.closest('.fac-kv-row').remove();
        },
        onParseUrl: function() {
            const u = document.getElementById('edit-url').value,
                q = u.split('?')[1];
            if (!q) {
                UIManager.updateEditorStatus('URL 中沒有查詢字串', 'error');
                return;
            }
            const kv = Utils.parseQueryString(q);
            if (!kv) {
                UIManager.updateEditorStatus('無法解析查詢字串', 'error');
                return;
            }
            const f = document.getElementById('fac-body-form'),
                a = f.querySelector('.fac-kv-add');
            f.innerHTML = '';
            kv.forEach(p => {
                const n = document.createElement('div');
                n.className = 'fac-kv-row';
                n.innerHTML = `<input type="text" class="fac-kv-key" value="${p.key.replace(/"/g,'&quot;')}"><input type="text" class="fac-kv-value" value="${String(p.value).replace(/"/g,'&quot;')}"><button class="fac-kv-delete">-</button>`;
                f.appendChild(n);
            });
            f.appendChild(a);
            document.querySelector('.fac-body-tab[data-tab="form"]').click();
            UIManager.updateEditorStatus('URL 查詢字串已解析並填入 Body 表單', false);
        },
        onCopyResponse: function(data) {
            if (data === undefined) return;
            navigator.clipboard.writeText(data).then(() => UIManager.updateEditorStatus('回應內容已複製', false), () => UIManager.updateEditorStatus('複製失敗', 'error'));
        },
        onExport: function(data) {
            const f = prompt('請選擇匯出格式: txt 或 csv', 'txt');
            if (!f) return;
            const n = `response-${Date.now()}`;
            if (f.toLowerCase() === 'txt') {
                const b = new Blob([data], {
                    type: 'text/plain;charset=utf-8'
                });
                EventHandlers.triggerDownload(b, `${n}.txt`);
            } else if (f.toLowerCase() === 'csv') {
                try {
                    const j = JSON.parse(data);
                    if (!Array.isArray(j)) throw new Error('資料不是陣列格式');
                    if (j.length === 0) {
                        EventHandlers.triggerDownload(new Blob([''], {
                            type: 'text/csv;charset=utf-8'
                        }), `${n}.csv`);
                        return;
                    }
                    const h = Object.keys(j[0]);
                    let c = h.join(',') + '\n';
                    j.forEach(r => {
                        c += h.map(H => JSON.stringify(r[H])).join(',') + '\n'
                    });
                    const b = new Blob([`\uFEFF${c}`], {
                        type: 'text/csv;charset=utf-8'
                    });
                    EventHandlers.triggerDownload(b, `${n}.csv`);
                } catch (e) {
                    alert(`無法匯出為 CSV: ${e.message}`);
                }
            }
        },
        triggerDownload: function(b, f) {
            const u = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = u;
            a.download = f;
            a.click();
            URL.revokeObjectURL(u);
        },
        onCollapseToggle: function() {
            state.isCollapsed = !state.isCollapsed;
            state.ui.bodyWrapper.classList.toggle('collapsed', state.isCollapsed);
            state.ui.collapseBtn.textContent = state.isCollapsed ? '⌄' : '⌃';
        },
        onMinimizeToggle: function() {
            state.isMinimized = !state.isMinimized;
            state.ui.wrap.style.display = state.isMinimized ? 'none' : 'flex';
            state.ui.minimizedIcon.style.display = state.isMinimized ? 'flex' : 'none';
        },
        initDraggable: function(el, headerSelector) {
            let pos1 = 0,
                pos2 = 0,
                pos3 = 0,
                pos4 = 0;
            const dragTarget = headerSelector ? el.querySelector(headerSelector) : el;
            if (dragTarget) {
                dragTarget.onmousedown = dragMouseDown;
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
                el.style.top = (el.offsetTop - pos2) + "px";
                el.style.left = (el.offsetLeft - pos1) + "px";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
    };

    function init() {
        if (document.getElementById(config.TOOL_ID)) {
            const t = document.getElementById(config.TOOL_ID);
            if (t) t.remove();
            const m = document.getElementById('fac-minimized-icon');
            if (m) m.remove();
            ApiHooking.unhook();
            return;
        }
        UIManager.create();
        state.ui = {
            wrap: document.getElementById('fac-main-wrap'),
            title: document.getElementById('fac-title'),
            startBtn: document.getElementById('fac-start-btn'),
            stopBtn: document.getElementById('fac-stop-btn'),
            searchBox: document.getElementById('fac-search'),
            downloadBtn: document.getElementById('fac-download-btn'),
            list: document.getElementById('fac-list'),
            pagination: document.getElementById('fac-pagination'),
            clearBtn: document.getElementById('fac-clear'),
            closeBtn: document.getElementById('fac-close-btn'),
            collapseBtn: document.getElementById('fac-collapse-btn'),
            minimizeBtn: document.getElementById('fac-minimize-btn'),
            minimizedIcon: document.getElementById('fac-minimized-icon'),
            bodyWrapper: document.querySelector('.fac-body-wrapper')
        };
        state.ui.list.addEventListener('click', EventHandlers.onListClick);
        state.ui.startBtn.addEventListener('click', EventHandlers.onStart);
        state.ui.stopBtn.addEventListener('click', EventHandlers.onStop);
        state.ui.clearBtn.addEventListener('click', EventHandlers.onClear);
        state.ui.closeBtn.addEventListener('click', EventHandlers.onClose);
        state.ui.downloadBtn.addEventListener('click', EventHandlers.onDownload);
        state.ui.searchBox.addEventListener('keyup', EventHandlers.onSearch);
        state.ui.collapseBtn.addEventListener('click', EventHandlers.onCollapseToggle);
        state.ui.minimizeBtn.addEventListener('click', EventHandlers.onMinimizeToggle);
        state.ui.minimizedIcon.addEventListener('click', EventHandlers.onMinimizeToggle);
        EventHandlers.initDraggable(state.ui.wrap, ".fac-header");
        EventHandlers.initDraggable(state.ui.minimizedIcon, null);
        EventHandlers.onStart();
    }
    init();
})();