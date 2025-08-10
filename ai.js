javascript:(function() {
    /**
     * HAR API 工具 v5.0 - 書籤啟動器
     * 說明：
     * 這段程式碼是一個啟動器 (Loader)。當您點擊書籤時，
     * 它會在當前頁面動態建立並顯示完整的 API 工具 UI。
     * 所有的 HTML 結構、CSS 樣式和主要邏輯都封裝在下面的 `Tool` 物件中。
     */

    // 防止重複執行
    if (document.getElementById('har-api-tool-container-v5')) {
        const existingTool = document.getElementById('har-api-tool-container-v5');
        existingTool.style.display = 'flex';
        return;
    }

    const Tool = {
        // HTML 模板
        getTemplate: function() {
            return `
                <div class="container mx-auto p-4 md:p-8 w-full max-w-6xl h-full flex flex-col">
                    <!-- 頂部流程指示器 -->
                    <div class="card p-4 mb-6 flex-shrink-0">
                        <div class="progress-bar">
                            <div id="progress-indicator" class="progress-indicator"></div>
                            <div id="progress-step-1" class="step"><div class="step-circle">1</div><div class="step-title">匯入</div></div>
                            <div id="progress-step-2" class="step"><div class="step-circle">2</div><div class="step-title">編輯</div></div>
                            <div id="progress-step-3" class="step"><div class="step-circle">3</div><div class="step-title">預覽</div></div>
                            <div id="progress-step-4" class="step"><div class="step-circle">4</div><div class="step-title">結果</div></div>
                        </div>
                    </div>

                    <!-- 主要內容面板 -->
                    <div class="flex-grow overflow-y-auto">
                        <!-- 步驟 1: 匯入 -->
                        <div id="step-1" class="step-panel">
                            <div class="card p-8">
                                <div class="flex justify-between items-center mb-2">
                                    <h2 class="text-2xl font-bold">匯入請求資料</h2>
                                    <div class="flex gap-2">
                                        <button id="paste-btn" class="text-gray-500 hover:text-blue-600"><i class="fas fa-paste mr-1"></i>貼上</button>
                                        <button id="clear-btn" class="text-gray-500 hover:text-red-600"><i class="fas fa-eraser mr-1"></i>清除</button>
                                    </div>
                                </div>
                                <p class="text-gray-500 mb-6">請貼上從開發者工具複製的 cURL/fetch 指令，或直接匯入 .har 檔案。</p>
                                <textarea id="har-input" class="w-full p-3 border rounded-md bg-gray-50 border-gray-300" rows="10" placeholder="在此貼上..."></textarea>
                                <div class="flex items-center justify-between mt-4">
                                    <div class="flex items-center gap-2">
                                       <span class="text-gray-500">或</span>
                                       <input type="file" id="file-input" accept=".har" class="text-sm">
                                    </div>
                                    <button id="parse-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-md"><i class="fas fa-arrow-right mr-2"></i>下一步：編輯</button>
                                </div>
                            </div>
                        </div>

                        <!-- 步驟 2: 編輯 -->
                        <div id="step-2" class="step-panel">
                            <div class="card p-8">
                                <h2 class="text-2xl font-bold mb-6">編輯請求</h2>
                                <div class="flex gap-2 mb-4">
                                    <select id="edit-method" class="p-2 border rounded-md border-gray-300"></select>
                                    <input type="text" id="edit-url" class="w-full p-2 border rounded-md border-gray-300" placeholder="請求 URL">
                                </div>
                                <div class="space-y-4">
                                    <div class="border rounded-md">
                                        <div class="flex justify-between items-center p-4 border-b">
                                            <h3 class="text-lg font-semibold">標頭 (Headers)</h3>
                                            <button id="copy-headers-btn" class="text-gray-500 hover:text-blue-600 text-sm"><i class="fas fa-copy mr-1"></i>複製</button>
                                        </div>
                                        <div class="p-4"><div id="headers-container" class="space-y-2"></div><button id="add-header-btn" class="mt-2 text-sm text-blue-500 hover:underline"><i class="fas fa-plus mr-1"></i>新增標頭</button></div>
                                    </div>
                                    <div class="border rounded-md">
                                        <div class="flex justify-between items-center p-4 border-b">
                                            <h3 class="text-lg font-semibold">主體 (Body)</h3>
                                            <button id="copy-body-btn" class="text-gray-500 hover:text-blue-600 text-sm"><i class="fas fa-copy mr-1"></i>複製</button>
                                        </div>
                                        <div class="p-4">
                                            <div class="flex gap-2 border-b mb-3">
                                                <button id="body-tab-form" class="tab-btn border-b-2 border-transparent px-4 py-2 font-semibold">表單</button>
                                                <button id="body-tab-raw" class="tab-btn border-b-2 border-transparent px-4 py-2 font-semibold">原始資料</button>
                                            </div>
                                            <div id="body-type-raw"><textarea id="edit-body-raw" class="w-full p-2 border rounded-md font-mono text-sm" rows="8"></textarea></div>
                                            <div id="body-type-form">
                                                <div id="form-data-container" class="space-y-2"></div>
                                                <button id="add-form-data-btn" class="mt-2 text-sm text-blue-500 hover:underline"><i class="fas fa-plus mr-1"></i>新增欄位</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-6 flex justify-between">
                                    <button id="back-to-step1-btn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md">返回匯入</button>
                                    <button id="preview-request-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-md"><i class="fas fa-eye mr-2"></i>下一步：預覽</button>
                                </div>
                            </div>
                        </div>

                        <!-- 步驟 3: 預覽 -->
                        <div id="step-3" class="step-panel">
                            <div class="card p-8">
                                <h2 class="text-2xl font-bold mb-6">預覽即將發送的請求</h2>
                                <pre id="preview-details" class="text-sm bg-gray-100 p-4 rounded-md max-h-96 overflow-y-auto"></pre>
                                <div class="mt-6 flex justify-between">
                                    <button id="back-to-step2-btn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md">返回編輯</button>
                                    <button id="confirm-send-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-md"><i class="fas fa-paper-plane mr-2"></i>確認並發送</button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 步驟 4: 結果 -->
                        <div id="step-4" class="step-panel">
                            <div class="card p-8">
                                 <h2 class="text-2xl font-bold mb-6">請求結果</h2>
                                 <div id="result-status" class="mb-4 p-3 rounded-md font-mono text-sm flex items-center gap-4"></div>
                                 <div class="border rounded-md">
                                    <div class="flex justify-between items-center border-b -mb-px">
                                        <div class="flex">
                                           <button id="result-tab-body" class="result-tab-btn p-3 font-semibold border-b-2">回應主體</button>
                                           <button id="result-tab-request" class="result-tab-btn p-3 font-semibold border-b-2 bg-gray-50">送出請求</button>
                                        </div>
                                        <button id="copy-response-btn" class="text-gray-500 hover:text-blue-600 text-sm mr-4"><i class="fas fa-copy mr-1"></i>複製回應</button>
                                    </div>
                                    <div id="result-panel-body" class="p-4"><div id="result-body-container" class="w-full max-h-96 overflow-y-auto"></div></div>
                                    <div id="result-panel-request" class="p-4 hidden"><pre id="sent-request-details" class="text-xs bg-gray-100 p-2 rounded-md overflow-x-auto"></pre></div>
                                </div>
                                <div class="mt-6 flex justify-end gap-4">
                                    <button id="edit-again-btn" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md">返回編輯</button>
                                    <button id="resend-request-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"><i class="fas fa-redo mr-2"></i>重新發送</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },
        // CSS 樣式
        getStyles: function() {
            return `
                #har-api-tool-container-v5 {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.5);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                .step-panel { display: none; }
                .step-panel.active { display: block; }
                .card { background-color: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
                .progress-bar { display: flex; justify-content: space-between; position: relative; margin-bottom: 1rem; }
                .progress-bar::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 2px; background-color: #e5e7eb; transform: translateY(-50%); z-index: 1; }
                .progress-indicator { position: absolute; top: 50%; left: 0; height: 2px; background-color: #3b82f6; transform: translateY(-50%); z-index: 2; transition: width 0.4s ease; }
                .step { position: relative; z-index: 3; text-align: center; }
                .step-circle { width: 2.5rem; height: 2.5rem; border-radius: 50%; background-color: #e5e7eb; color: #6b7280; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; margin: 0 auto 0.25rem; border: 3px solid white; transition: all 0.4s ease; }
                .step-title { font-size: 0.875rem; color: #6b7280; }
                .step.active .step-circle { background-color: #3b82f6; color: white; border-color: #bfdbfe; }
                .step.active .step-title { color: #1f2937; font-weight: 600; }
                .step.completed .step-circle { background-color: #16a34a; color: white; }
                .json-viewer { font-family: monospace; font-size: 14px; }
                .json-viewer .kv-pair { display: flex; align-items: flex-start; padding-left: 20px; position: relative; }
                .json-viewer .key { color: #9333ea; font-weight: bold; min-width: 150px; flex-shrink: 0; }
                .json-viewer .value { color: #16a34a; white-space: pre-wrap; word-break: break-all; }
                .json-viewer .value.string { color: #db2777; }
                .json-viewer .value.null { color: #ef4444; }
                .json-viewer .collapser { cursor: pointer; position: absolute; left: 0; user-select: none; width: 18px; text-align: center; }
                .json-viewer .collapsible-content { display: block; }
                .json-viewer .collapsible-content.collapsed { display: none; }
                .json-viewer .copy-btn { visibility: hidden; margin-left: 10px; cursor: pointer; color: #6b7280; }
                .json-viewer .kv-pair:hover .copy-btn { visibility: visible; }
                .tab-btn.active { border-color: #3b82f6; color: #3b82f6; }
                .result-tab-btn.active { background-color: white; border-bottom-color: white !important; }
            `;
        },
        // 核心邏輯
        run: function() {
            // ... (所有 App 的邏輯函式) ...
        }
    };
    
    // 將所有 App 的邏輯函式填充到 run 方法中
    Tool.run = function(container) {
        const App = {
            state: { request: null, response: null, activeBodyTab: 'raw', currentStep: 1 },
            elements: {
                progressIndicator: container.querySelector('#progress-indicator'),
                progressSteps: { 1: container.querySelector('#progress-step-1'), 2: container.querySelector('#progress-step-2'), 3: container.querySelector('#progress-step-3'), 4: container.querySelector('#progress-step-4') },
                panels: { 1: container.querySelector('#step-1'), 2: container.querySelector('#step-2'), 3: container.querySelector('#step-3'), 4: container.querySelector('#step-4') },
                step1: { harInput: container.querySelector('#har-input'), fileInput: container.querySelector('#file-input'), parseBtn: container.querySelector('#parse-btn'), pasteBtn: container.querySelector('#paste-btn'), clearBtn: container.querySelector('#clear-btn') },
                step2: { method: container.querySelector('#edit-method'), url: container.querySelector('#edit-url'), headersContainer: container.querySelector('#headers-container'), addHeaderBtn: container.querySelector('#add-header-btn'), copyHeadersBtn: container.querySelector('#copy-headers-btn'), bodyTabs: { raw: container.querySelector('#body-tab-raw'), form: container.querySelector('#body-tab-form') }, bodySections: { raw: container.querySelector('#body-type-raw'), form: container.querySelector('#body-type-form') }, bodyRaw: container.querySelector('#edit-body-raw'), formDataContainer: container.querySelector('#form-data-container'), addFormDataBtn: container.querySelector('#add-form-data-btn'), copyBodyBtn: container.querySelector('#copy-body-btn'), backBtn: container.querySelector('#back-to-step1-btn'), previewBtn: container.querySelector('#preview-request-btn') },
                step3: { previewDetails: container.querySelector('#preview-details'), backBtn: container.querySelector('#back-to-step2-btn'), confirmBtn: container.querySelector('#confirm-send-btn') },
                step4: { status: container.querySelector('#result-status'), sentRequestDetails: container.querySelector('#sent-request-details'), bodyContainer: container.querySelector('#result-body-container'), editBtn: container.querySelector('#edit-again-btn'), resendBtn: container.querySelector('#resend-request-btn'), resultTabs: { body: container.querySelector('#result-tab-body'), request: container.querySelector('#result-tab-request') }, resultPanels: { body: container.querySelector('#result-panel-body'), request: container.querySelector('#result-panel-request') }, copyResponseBtn: container.querySelector('#copy-response-btn') },
            },
            init: function() { this.bindEvents(); this.navigateTo(1); },
            bindEvents: function() {
                this.elements.step1.parseBtn.addEventListener('click', () => this.handleParse());
                this.elements.step1.pasteBtn.addEventListener('click', async () => { try { this.elements.step1.harInput.value = await navigator.clipboard.readText(); } catch (e) { alert('無法讀取剪貼簿'); } });
                this.elements.step1.clearBtn.addEventListener('click', () => { this.elements.step1.harInput.value = ''; this.elements.step1.fileInput.value = ''; });
                this.elements.step1.fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => { this.elements.step1.harInput.value = event.target.result; };
                        reader.readAsText(file);
                    }
                });
                this.elements.step2.backBtn.addEventListener('click', () => this.navigateTo(1));
                this.elements.step2.previewBtn.addEventListener('click', () => this.handlePreview());
                this.elements.step2.addHeaderBtn.addEventListener('click', () => this.addKeyValueRow(this.elements.step2.headersContainer));
                this.elements.step2.addFormDataBtn.addEventListener('click', () => this.addKeyValueRow(this.elements.step2.formDataContainer));
                this.elements.step2.bodyTabs.raw.addEventListener('click', () => this.switchBodyTab('raw'));
                this.elements.step2.bodyTabs.form.addEventListener('click', () => this.switchBodyTab('form'));
                this.elements.step2.copyHeadersBtn.addEventListener('click', () => this.copyHeaders());
                this.elements.step2.copyBodyBtn.addEventListener('click', () => this.copyBody());
                this.elements.step3.backBtn.addEventListener('click', () => this.navigateTo(2));
                this.elements.step3.confirmBtn.addEventListener('click', () => this.executeRequest());
                this.elements.step4.editBtn.addEventListener('click', () => this.navigateTo(2));
                this.elements.step4.resendBtn.addEventListener('click', () => this.executeRequest());
                this.elements.step4.resultTabs.body.addEventListener('click', () => this.switchResultTab('body'));
                this.elements.step4.resultTabs.request.addEventListener('click', () => this.switchResultTab('request'));
                this.elements.step4.copyResponseBtn.addEventListener('click', () => this.copyResponse());
            },
            copyHeaders: function() { this.updateRequestFromUI(); const headersText = this.state.request.headers.map(h => `${h.key}: ${h.value}`).join('\n'); navigator.clipboard.writeText(headersText).then(() => alert('標頭已複製！')); },
            copyBody: function() { this.updateRequestFromUI(); navigator.clipboard.writeText(this.state.request.body).then(() => alert('主體已複製！')); },
            copyResponse: function() { if (this.state.response && this.state.response.body) { navigator.clipboard.writeText(this.state.response.body).then(() => alert('回應已複製！')); } else { alert('沒有可複製的回應。'); } },
            navigateTo: function(stepNumber) {
                this.state.currentStep = stepNumber;
                Object.values(this.elements.panels).forEach(panel => panel.classList.remove('active'));
                this.elements.panels[stepNumber].classList.add('active');
                const progressPercentage = ((stepNumber - 1) / 3) * 100;
                this.elements.progressIndicator.style.width = `${progressPercentage}%`;
                Object.values(this.elements.progressSteps).forEach((stepEl, index) => {
                    const currentStepNum = index + 1;
                    stepEl.classList.remove('active', 'completed');
                    if (currentStepNum < stepNumber) {
                        stepEl.classList.add('completed');
                    } else if (currentStepNum === stepNumber) {
                        stepEl.classList.add('active');
                    }
                });
            },
            handleParse: function() {
                let rawContent = this.elements.step1.harInput.value.trim();
                if (!rawContent) return alert('請先輸入或匯入請求內容。');
                const commands = rawContent.split(';').filter(cmd => cmd.trim().startsWith('fetch(') || cmd.trim().startsWith('curl'));
                if (commands.length > 1) { rawContent = commands[0]; alert("偵測到多個指令，目前僅會解析第一個指令。"); }
                try { this.state.request = this.parse(rawContent); this.renderEditStep(); this.navigateTo(2); } catch (error) { alert(`解析失敗: ${error.message}`); console.error("Parse Error:", error); }
            },
            handlePreview: function() {
                this.updateRequestFromUI();
                const { method, url, headers, body } = this.state.request;
                let details = `${method} ${url}\n\n--- 標頭 ---\n`;
                headers.forEach(h => { if (h.key) details += `${h.key}: ${h.value}\n`; });
                if (body) { details += `\n--- 主體 ---\n${body}`; }
                this.elements.step3.previewDetails.textContent = details;
                this.navigateTo(3);
            },
            executeRequest: async function() {
                this.navigateTo(4);
                const { method, url, headers, body } = this.state.request;
                const headersObj = headers.reduce((acc, h) => { if (h.key) acc[h.key] = h.value; return acc; }, {});
                this.elements.step4.sentRequestDetails.textContent = this.elements.step3.previewDetails.textContent;
                this.elements.step4.status.innerHTML = `<span><i class="fas fa-spinner fa-spin mr-2"></i>請求發送中...</span>`;
                this.elements.step4.status.className = 'mb-4 p-3 rounded-md font-mono text-sm flex items-center gap-4 bg-yellow-100 text-yellow-800';
                this.elements.step4.bodyContainer.innerHTML = '';
                try {
                    const response = await fetch(url, { method, headers: headersObj, body: (method !== 'GET' && method !== 'HEAD') ? body : undefined });
                    const responseBody = await response.text();
                    this.state.response = { status: response.status, statusText: response.statusText, body: responseBody };
                    const statusClass = response.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                    this.elements.step4.status.innerHTML = `<span class="font-bold">狀態: ${response.status} ${response.statusText}</span>`;
                    this.elements.step4.status.className = `mb-4 p-3 rounded-md font-mono text-sm flex items-center gap-4 ${statusClass}`;
                    try { const json = JSON.parse(responseBody); this.elements.step4.bodyContainer.innerHTML = ''; this.elements.step4.bodyContainer.appendChild(this.createJsonViewer(json)); } catch { this.elements.step4.bodyContainer.innerHTML = `<pre class="whitespace-pre-wrap break-all">${responseBody}</pre>`; }
                } catch (error) {
                    this.elements.step4.status.innerHTML = `<span class="font-bold">網路錯誤: ${error.message}</span>`;
                    this.elements.step4.status.className = 'mb-4 p-3 rounded-md font-mono text-sm flex items-center gap-4 bg-red-100 text-red-800';
                    this.elements.step4.bodyContainer.innerHTML = `<pre class="text-red-500">${error.stack}</pre>`;
                }
            },
            parse: function(rawContent) {
                rawContent = rawContent.trim();
                try {
                    const har = JSON.parse(rawContent);
                    if (har.log && har.log.entries && har.log.entries.length > 0) { const entry = har.log.entries[0].request; return { method: entry.method, url: entry.url, headers: entry.headers.map(h => ({ key: h.name, value: h.value })), body: entry.postData ? entry.postData.text : '' }; }
                } catch (e) {}
                if (rawContent.startsWith('fetch(')) {
                    const urlMatch = rawContent.match(/fetch\(\s*["']([^"']+)["']/);
                    if (!urlMatch) throw new Error('無法從 fetch 指令中解析 URL。');
                    const optionsMatch = rawContent.match(/,\s*(\{[\s\S]*?\})\s*\);?/s);
                    let method = 'GET', headers = [], body = '';
                    if (optionsMatch) {
                        const optionsStr = optionsMatch[1];
                        const methodMatch = optionsStr.match(/["']?method["']?\s*:\s*["'](\w+)["']/);
                        method = methodMatch ? methodMatch[1].toUpperCase() : 'POST';
                        const headersMatch = optionsStr.match(/["']?headers["']?\s*:\s*(\{[\s\S]*?\})/s);
                        if (headersMatch) {
                            const headerStr = headersMatch[1];
                            const headerPairs = [...headerStr.matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)];
                            headers = headerPairs.map(m => ({ key: m[1], value: m[2] }));
                        }
                        const bodyMatch = optionsStr.match(/["']?body["']?\s*:\s*(".*"|null)/s);
                        if (bodyMatch && bodyMatch[1] !== 'null') {
                            try { body = JSON.parse(bodyMatch[1]); } catch (e) { throw new Error("無法解析 Body 中的 JSON 字串。"); }
                        }
                    }
                    return { method, url: urlMatch[1], headers, body: typeof body === 'object' ? JSON.stringify(body, null, 2) : body };
                }
                if (rawContent.startsWith('curl')) {
                    const urlMatch = rawContent.match(/curl\s+(?:--location\s+)?['"]?([^'"\s]+)['"]?/);
                    if (!urlMatch) throw new Error('無法從 curl 指令中解析 URL。');
                    const methodMatch = rawContent.match(/-X\s+['"]?(\w+)['"]?/);
                    const headers = [...rawContent.matchAll(/-H\s+['"]?([^:]+):\s*([^'"]+)['"]?/g)].map(m => ({ key: m[1].trim(), value: m[2].trim() }));
                    const bodyMatch = rawContent.match(/--data(?:-raw)?\s+['"]([^'"]*)['"]/);
                    return { method: methodMatch ? methodMatch[1].toUpperCase() : (bodyMatch ? 'POST' : 'GET'), url: urlMatch[1], headers, body: bodyMatch ? bodyMatch[1] : '' };
                }
                throw new Error('無法識別的格式。請提供 HAR JSON、curl 或 fetch 指令。');
            },
            renderEditStep: function() {
                const { method, url, headers, body } = this.state.request;
                this.elements.step2.method.value = method;
                this.elements.step2.url.value = url;
                this.elements.step2.headersContainer.innerHTML = '';
                headers.forEach(h => this.addKeyValueRow(this.elements.step2.headersContainer, h.key, h.value));
                this.elements.step2.bodyRaw.value = body;
                const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value || '';
                if (contentType.includes('application/x-www-form-urlencoded')) { this.renderFormData(body); this.switchBodyTab('form', true); } else { this.renderFormData(''); this.switchBodyTab('raw', true); }
            },
            renderFormData: function(body) { this.elements.step2.formDataContainer.innerHTML = ''; if (!body) return; try { new URLSearchParams(body).forEach((value, key) => { this.addKeyValueRow(this.elements.step2.formDataContainer, key, value); }); } catch (e) { console.error("無法解析表單資料:", e); } },
            addKeyValueRow: function(container, key = '', value = '') { const div = document.createElement('div'); div.className = 'flex gap-2 items-center'; div.innerHTML = `<input type="text" placeholder="Key" class="w-1/3 p-2 border rounded-md" value="${key}"><input type="text" placeholder="Value" class="flex-grow p-2 border rounded-md" value="${value}"><button class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>`; div.querySelector('button').addEventListener('click', () => div.remove()); container.appendChild(div); },
            updateRequestFromUI: function() {
                let body = '';
                if (this.state.activeBodyTab === 'raw') { body = this.elements.step2.bodyRaw.value; } else { const params = new URLSearchParams(); this.elements.step2.formDataContainer.querySelectorAll('.flex').forEach(div => { const inputs = div.querySelectorAll('input'); if (inputs[0].value) params.append(inputs[0].value, inputs[1].value); }); body = params.toString(); }
                const headers = [];
                this.elements.step2.headersContainer.querySelectorAll('.flex').forEach(div => { const inputs = div.querySelectorAll('input'); if (inputs[0].value) headers.push({ key: inputs[0].value, value: inputs[1].value }); });
                this.state.request = { method: this.elements.step2.method.value, url: this.elements.step2.url.value, headers, body };
            },
            switchBodyTab: function(tabName, isInitial = false) {
                if (!isInitial) { this.updateRequestFromUI(); }
                this.state.activeBodyTab = tabName;
                Object.values(this.elements.step2.bodyTabs).forEach(b => b.classList.remove('border-blue-500', 'text-blue-600'));
                this.elements.step2.bodyTabs[tabName].classList.add('border-blue-500', 'text-blue-600');
                Object.values(this.elements.step2.bodySections).forEach(s => s.style.display = 'none');
                this.elements.step2.bodySections[tabName].style.display = 'block';
                if (!isInitial) { if (tabName === 'raw') { this.elements.step2.bodyRaw.value = this.state.request.body; } else if (tabName === 'form') { this.renderFormData(this.state.request.body); } }
            },
            switchResultTab: function(tabName) {
                Object.values(this.elements.step4.resultTabs).forEach(b => { b.classList.remove('active'); b.classList.add('bg-gray-50'); });
                this.elements.step4.resultTabs[tabName].classList.remove('bg-gray-50');
                this.elements.step4.resultTabs[tabName].classList.add('active');
                Object.values(this.elements.step4.resultPanels).forEach(p => p.classList.add('hidden'));
                this.elements.step4.resultPanels[tabName].classList.remove('hidden');
            },
            createJsonViewer: function(data) { const container = document.createElement('div'); container.className = 'json-viewer'; this._buildJsonLevel(data, container); return container; },
            _buildJsonLevel: function(data, parentElement) {
                if (data === null || typeof data !== 'object') { const valueEl = document.createElement('span'); valueEl.className = `value ${typeof data === 'string' ? 'string' : ''} ${data === null ? 'null' : ''}`; valueEl.textContent = JSON.stringify(data); parentElement.appendChild(valueEl); return; }
                const isArray = Array.isArray(data);
                const keys = Object.keys(data);
                const bracketOpen = document.createTextNode(isArray ? '[' : '{');
                const bracketClose = document.createTextNode(isArray ? ']' : '}');
                if (keys.length === 0) { parentElement.appendChild(document.createTextNode(isArray ? '[]' : '{}')); return; }
                parentElement.appendChild(bracketOpen);
                const content = document.createElement('div');
                content.className = 'collapsible-content';
                keys.forEach((key, index) => {
                    const pair = document.createElement('div');
                    pair.className = 'kv-pair';
                    const keyEl = document.createElement('span');
                    keyEl.className = 'key';
                    keyEl.textContent = isArray ? '' : `"${key}": `;
                    pair.appendChild(keyEl);
                    const value = data[key];
                    if (value !== null && typeof value === 'object' && Object.keys(value).length > 0) { const collapser = document.createElement('span'); collapser.className = 'collapser'; collapser.textContent = '▼'; collapser.onclick = (e) => { e.stopPropagation(); const nextContent = pair.querySelector('.collapsible-content'); if (nextContent) { nextContent.classList.toggle('collapsed'); collapser.textContent = nextContent.classList.contains('collapsed') ? '►' : '▼'; } }; pair.appendChild(collapser); }
                    this._buildJsonLevel(value, pair);
                    const copyBtn = document.createElement('span');
                    copyBtn.className = 'copy-btn';
                    copyBtn.textContent = '📋';
                    copyBtn.title = '複製此值';
                    copyBtn.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(data[key], null, 2)); alert('已複製！'); };
                    pair.appendChild(copyBtn);
                    if (index < keys.length - 1) { pair.appendChild(document.createTextNode(',')); }
                    content.appendChild(pair);
                });
                parentElement.appendChild(content);
                parentElement.appendChild(bracketClose);
            }
        };
        App.init();
    };

    // 建立並注入 UI
    const container = document.createElement('div');
    container.id = 'har-api-tool-container-v5';
    container.innerHTML = Tool.getTemplate();
    
    const styleTag = document.createElement('style');
    styleTag.textContent = Tool.getStyles();
    document.head.appendChild(styleTag);
    
    // 注入 Tailwind 和 FontAwesome
    if (!document.querySelector('script[src="https://cdn.tailwindcss.com"]')) {
        const tailwindScript = document.createElement('script');
        tailwindScript.src = "https://cdn.tailwindcss.com";
        document.head.appendChild(tailwindScript);
    }
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = "stylesheet";
        fontAwesomeLink.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
        document.head.appendChild(fontAwesomeLink);
    }
    
    document.body.appendChild(container);

    // 執行主程式
    Tool.run(container);

})();
