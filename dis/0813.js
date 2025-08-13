javascript: (function() {
    if (document.getElementById('full-api-collector')) {
        document.getElementById('full-api-collector').remove();
        return;
    }

    const MAX_LOGS = 500;
    let running = false;
    let logs = [];
    let origXHR = window.XMLHttpRequest;
    let origFetch = window.fetch;

    // 建立 UI
    const wrap = document.createElement('div');
    wrap.id = 'full-api-collector';
    wrap.innerHTML = `
<div class="fac-wrap">
  <div class="fac-header">
    <div class="fac-title">API 收集調試工具</div>
    <div class="fac-actions">
      <button id="fac-clear" class="fac-btn">清除</button>
      <button id="fac-close" class="fac-btn danger">關閉</button>
    </div>
  </div>
  <div class="fac-controls">
    <button id="fac-start" class="fac-btn primary">開始收集</button>
    <button id="fac-stop" class="fac-btn" disabled>停止收集</button>
    <input id="fac-search" type="text" placeholder="搜尋..." class="fac-search"/>
    <label style="font-size:12px;">
      <input type="checkbox" id="fac-filter-error"/> 只顯示錯誤
    </label>
    <button id="fac-download" class="fac-btn">下載</button>
  </div>
  <div id="fac-list" class="fac-list"></div>
</div>
<style>
  .fac-wrap{position:fixed;top:20px;right:20px;width:450px;background:#fff;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.1);font-family:sans-serif;z-index:999999;display:flex;flex-direction:column;max-height:90vh;overflow:hidden;}
  .fac-header{display:flex;justify-content:space-between;align-items:center;background:#f5f5f5;padding:8px 12px;border-bottom:1px solid #eee;}
  .fac-title{font-weight:bold;}
  .fac-actions{display:flex;gap:6px;}
  .fac-btn{padding:4px 10px;border:none;border-radius:6px;background:#ddd;cursor:pointer;font-size:12px;transition:all 0.2s;}
  .fac-btn:hover{background:#ccc;}
  .primary{background:#4caf50;color:#fff;}
  .primary:hover{background:#43a047;}
  .danger{background:#f44336;color:#fff;}
  .danger:hover{background:#e53935;}
  .fac-controls{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-bottom:1px solid #eee;align-items:center;}
  .fac-search{flex:1;padding:4px 8px;border:1px solid #ccc;border-radius:6px;font-size:12px;}
  .fac-list{flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;background:#fdfdfd;}
  .fac-item{background:#fafafa;border-radius:8px;padding:6px 8px;box-shadow:0 2px 4px rgba(0,0,0,0.05);transition:all 0.2s;cursor:pointer;}
  .fac-item:hover{transform:translateY(-2px) scale(1.01);box-shadow:0 4px 8px rgba(0,0,0,0.1);}
  .fac-method{display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;color:#fff;margin-right:6px;font-weight:bold;}
  .GET{background:#4caf50;}
  .POST{background:#2196f3;}
  .PUT{background:#ffc107;color:#000;}
  .DELETE{background:#f44336;}
  .fac-url{font-size:12px;color:#222;word-break:break-all;}
  .fac-status{font-size:11px;color:#666;}
  .fac-detail{padding:10px;font-size:12px;}
  .fac-detail pre{white-space:pre-wrap;word-break:break-all;background:#eee;padding:5px;border-radius:4px;max-height:200px;overflow:auto;}
</style>`;
    document.body.appendChild(wrap);

    // 綁定 UI 元素
    const startBtn = document.getElementById('fac-start');
    const stopBtn = document.getElementById('fac-stop');
    const searchBox = document.getElementById('fac-search');
    const list = document.getElementById('fac-list');
    const errorFilter = document.getElementById('fac-filter-error');

    startBtn.onclick = () => {
        running = true;
        logs = [];
        hookXHR();
        hookFetch();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        render();
    };

    stopBtn.onclick = () => {
        running = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
    };

    document.getElementById('fac-close').onclick = () => {
        wrap.remove();
        window.XMLHttpRequest = origXHR;
        window.fetch = origFetch;
        logs = [];
    };

    document.getElementById('fac-clear').onclick = () => {
        logs = [];
        render();
    };

    document.getElementById('fac-download').onclick = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'api-logs.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    searchBox.oninput = render;
    errorFilter.onchange = render;

    function hookXHR() {
        window.XMLHttpRequest = function() {
            const req = new origXHR();
            let method, url, start = 0,
                reqHeaders = {};
            const open = req.open;
            req.open = function(m, u, ...rest) {
                method = m;
                url = u;
                start = Date.now();
                return open.apply(this, [m, u, ...rest]);
            };
            req.setRequestHeader = function(k, v) {
                reqHeaders[k] = v;
                return origXHR.prototype.setRequestHeader.apply(req, [k, v]);
            };
            req.addEventListener('load', () => {
                if (running) {
                    pushLog({
                        method,
                        url,
                        status: req.status,
                        duration: Date.now() - start,
                        timestamp: new Date().toLocaleTimeString(),
                        requestHeaders: reqHeaders,
                        requestBody: null,
                        response: req.responseText
                    });
                }
            });
            return req;
        };
    }

    function hookFetch() {
        window.fetch = function(input, init = {}) {
            const method = init.method || 'GET';
            const url = typeof input === 'string' ? input : input.url;
            const start = Date.now();
            return origFetch(input, init).then(res => {
                if (running) {
                    res.clone().text().then(body => {
                        pushLog({
                            method,
                            url,
                            status: res.status,
                            duration: Date.now() - start,
                            timestamp: new Date().toLocaleTimeString(),
                            requestHeaders: init.headers || {},
                            requestBody: init.body || null,
                            response: body
                        });
                    });
                }
                return res;
            });
        };
    }

    function pushLog(entry) {
        logs.unshift(entry);
        if (logs.length > MAX_LOGS) {
            logs.pop();
        }
        render();
    }

    function render() {
        list.innerHTML = '';
        const keyword = searchBox.value.toLowerCase();
        const filterError = errorFilter.checked;
        logs.filter(log => {
            const matchText = log.url.toLowerCase().includes(keyword) || log.method.toLowerCase().includes(keyword);
            const matchError = !filterError || log.status >= 400;
            return matchText && matchError;
        }).forEach((log) => {
            const item = document.createElement('div');
            item.className = 'fac-item';
            item.innerHTML = `
        <span class="fac-method ${log.method}">${log.method}</span>
        <span class="fac-url">${log.url}</span>
        <div class="fac-status">狀態: ${log.status} - ${log.duration}ms (${log.timestamp})</div>
      `;
            item.onclick = () => {
                const detail = document.createElement('div');
                detail.className = 'fac-detail';
                detail.innerHTML = `
          <strong>Request Headers:</strong><pre>${JSON.stringify(log.requestHeaders, null, 2)}</pre>
          <strong>Request Body:</strong><pre>${log.requestBody ? log.requestBody : '(空)'}</pre>
          <strong>Response:</strong><pre>${log.response}</pre>
        `;
                item.appendChild(detail);
            };
            list.appendChild(item);
        });
    }

})();