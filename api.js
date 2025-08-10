(function() {
    // --- 步驟 1: 定義最終版的 HTML 和 CSS ---

    const toolCSS = `
        /* === CSS Reset & Scoping (更強力) === */
        #api-tool-shell, #api-tool-shell * , #api-tool-shell *::before, #api-tool-shell *::after {
            all: revert; /* 撤銷所有繼承的樣式，回歸瀏覽器預設 */
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        #api-tool-shell {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 2147483647; /* Max z-index */
            background-color: rgba(40, 40, 40, 0.2);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            opacity: 0;
            animation: fadeIn 0.3s ease-out forwards;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes scaleOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.95); opacity: 0; } }

        /* === 主題變數 (純淺色) === */
        #api-tool-shell {
            --bg-color: #f8fafc;
            --card-bg-color: #ffffff;
            --text-color: #1f2937;
            --text-muted-color: #6b7280;
            --border-color: #e5e7eb;
            --primary-color: #2563eb;
            --primary-hover-color: #1d4ed8;
            --primary-text-color: #ffffff;
            --success-color: #059669;
            --error-color: #dc2626;
            --code-bg-color: #f1f5f9; /* 淺色 Code 背景 */
            --code-text-color: #374151; /* 深色 Code 文字 */
        }

        /* === 主容器 & 佈局 === */
        #api-tool-container {
            width: 90%;
            max-width: 900px;
            height: 85vh;
            max-height: 800px;
            background-color: var(--card-bg-color);
            color: var(--text-color);
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transform: scale(0.95);
            opacity: 0;
            animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.1s;
        }
        
        #api-tool-shell header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        #api-tool-shell header h1 { font-size: 1.125rem; font-weight: 600; color: var(--text-color); }
        #api-tool-shell main { padding: 1.5rem; flex-grow: 1; overflow-y: auto; background-color: var(--bg-color); }
        #api-tool-shell footer { padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.75rem; background-color: var(--card-bg-color); flex-shrink: 0; }

        /* === 步驟指示器 === */
        #stepper { display: flex; align-items: center; gap: 0.5rem; }
        .step { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted-color); }
        .step-circle { width: 1.5rem; height: 1.5rem; border-radius: 9999px; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.875rem; transition: all 0.3s; }
        .step-label { font-weight: 500; font-size: 0.875rem; }
        .step-line { width: 3rem; height: 2px; background-color: var(--border-color); transition: all 0.3s; }
        .step.active .step-circle { border-color: var(--primary-color); background-color: var(--primary-color); color: var(--primary-text-color); }
        .step.active .step-label { color: var(--primary-color); }
        .step.done .step-circle { border-color: var(--success-color); background-color: var(--success-color); color: var(--primary-text-color); }
        .step.done .step-label { color: var(--text-color); }
        .step.done + .step-line { background-color: var(--success-color); }

        /* === 按鈕穩定性修正 === */
        #api-tool-shell button {
            font-family: inherit;
            font-size: 0.875rem;
            line-height: 1.25rem;
            cursor: pointer;
            appearance: none;
            background-color: transparent;
            border-width: 1px;
            border-style: solid;
            border-color: transparent;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .btn { padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; transition: all 0.2s; }
        .btn-primary { background-color: var(--primary-color); color: var(--primary-text-color); border-color: var(--primary-color); }
        .btn-primary:hover { background-color: var(--primary-hover-color); border-color: var(--primary-hover-color); }
        .btn-secondary { background-color: var(--card-bg-color); border-color: var(--border-color); color: var(--text-color); }
        .btn-secondary:hover { background-color: var(--bg-color); }
        #shell-close-btn { font-size: 1.5rem; color: #a0aec0; border: none; transition: color 0.2s; }
        #shell-close-btn:hover { color: var(--text-color); }
        
        /* === 輸入框 & 選擇器 === */
        #api-tool-shell input[type="text"], #api-tool-shell select, #api-tool-shell textarea {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background-color: var(--card-bg-color);
            color: var(--text-color);
            font-size: 0.875rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        #api-tool-shell input[type="text"]:focus, #api-tool-shell select:focus, #api-tool-shell textarea:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }

        /* === 全新淺色 Code Editor 樣式 === */
        #api-tool-shell .code-editor, #api-tool-shell pre.code-editor {
            background-color: var(--code-bg-color);
            color: var(--code-text-color);
            border-radius: 6px;
            padding: 1rem;
            font-family: 'SF Mono', 'Fira Code', 'Menlo', monospace;
            line-height: 1.6;
            border: 1px solid var(--border-color);
        }
        /* JSON 語法高亮 (淺色版) */
        #api-tool-shell .json-viewer .key { color: #9B2C2C; } /* Dark Red */
        #api-tool-shell .json-viewer .value.string { color: #2C5282; } /* Dark Blue */
        #api-tool-shell .json-viewer .value.number { color: #276749; } /* Dark Green */
        #api-tool-shell .json-viewer .value.boolean { color: #B83280; } /* Dark Pink */
        #api-tool-shell .json-viewer .value.null { color: var(--text-muted-color); }

        /* --- 其他元件 --- */
        .section-card { background-color: var(--card-bg-color); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 1.5rem; }
        .section-card h4 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
        #add-header-btn, #add-form-data-btn { margin-top: 0.75rem; color: var(--primary-color); font-weight: 500; }
        
        #result-status { padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-weight: 600;}
        #result-status.success { background-color: #c6f6d5; color: #22543d; }
        #result-status.error { background-color: #fed7d7; color: #822727; }
        .tabs { border-bottom: 1px solid var(--border-color); margin-bottom: 1rem; }
        .tab-btn { padding: 0.5rem 1rem; color: var(--text-muted-color); font-weight: 500; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: var(--primary-color); border-color: var(--primary-color); }
    `;

    // HTML 結構字串
    const toolHTML = `
        <div id="api-tool-container">
            <header>
                <h1>API 工具</h1>
                <div id="stepper"></div>
                <button id="shell-close-btn" title="關閉">&times;</button>
            </header>
            <main>
                <div id="step-1" class="step-section">
                    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">匯入請求</h3>
                    <p style="color: var(--text-muted-color); margin-bottom: 1rem;">請貼上從開發者工具複製的 cURL 或 Fetch 指令。</p>
                    <textarea id="har-input" class="w-full code-editor" rows="12" placeholder="在此貼上 cURL, Fetch 指令或 HAR JSON..."></textarea>
                </div>
                <div id="step-2" class="step-section">
                    <div class="section-card">
                         <div style="display: flex; gap: 1rem;">
                             <div style="width: 25%;"><select id="edit-method"></select></div>
                             <div style="width: 75%;"><input type="text" id="edit-url" placeholder="請求 URL"></div>
                         </div>
                    </div>
                    <div class="section-card">
                         <h4>標頭 (Headers)</h4>
                         <div id="headers-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                         <button id="add-header-btn" style="margin-top: 0.75rem;">+ 新增標頭</button>
                    </div>
                    <div class="section-card">
                         <h4>主體 (Body)</h4>
                         <div class="tabs">
                             <button id="body-tab-form" class="tab-btn">表單 (Form)</button>
                             <button id="body-tab-raw" class="tab-btn">原始 (Raw)</button>
                         </div>
                         <div id="body-type-raw" class="body-type-section"><textarea id="edit-body-raw" class="w-full code-editor" rows="6"></textarea></div>
                         <div id="body-type-form" class="body-type-section">
                             <div id="form-data-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                             <button id="add-form-data-btn" style="margin-top: 0.75rem;">+ 新增欄位</button>
                         </div>
                    </div>
                </div>
                <div id="step-3" class="step-section">
                     <div id="result-status" style="margin-bottom: 1rem;"></div>
                     <div class="section-card" style="height: 400px; display: flex; flex-direction: column;">
                        <div class="tabs" style="flex-shrink: 0;">
                            <button data-tab="response-body" class="tab-btn">回應主體 (Body)</button>
                            <button data-tab="response-headers" class="tab-btn">回應標頭 (Headers)</button>
                        </div>
                        <div id="response-body" class="result-tab-content" style="flex-grow: 1; overflow-y: auto;"></div>
                        <pre id="response-headers" class="result-tab-content code-editor" style="flex-grow: 1; overflow-y: auto;"></pre>
                     </div>
                </div>
            </main>
            <footer>
                <div id="footer-step-1" style="display: none;">
                     <button id="parse-btn" class="btn btn-primary">下一步 →</button>
                </div>
                <div id="footer-step-2" style="width: 100%; display: none; justify-content: space-between;">
                    <button id="back-to-step1-btn" class="btn btn-secondary">← 上一步</button>
                    <button id="send-request-btn" class="btn btn-primary" style="background-color: var(--success-color);">發送請求</button>
                </div>
                <div id="footer-step-3" style="width: 100%; display: none; justify-content: space-between;">
                    <button id="back-to-step2-btn" class="btn btn-secondary">← 返回編輯</button>
                    <div style="display: flex; gap: 0.75rem;">
                         <button id="generate-code-btn" class="btn btn-secondary">產生程式碼</button>
                         <button id="resend-request-btn" class="btn btn-primary">重新發送</button>
                    </div>
                </div>
            </footer>
        </div>
        <div id="toast-container" style="position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 50; display: flex; flex-direction: column; gap: 0.5rem;"></div>
    `;


    // --- 步驟 2: 定義精簡後的 App 物件 (邏輯不變，僅為符合新 UI) ---
    const App = {
        state: { request: null, activeBodyTab: 'raw' },
        init() {
            this.cacheElements(); this.bindEvents(); this.navigateTo('step-1');
        },
        cacheElements() {
            const shell = document.getElementById('api-tool-shell');
            this.elements = {
                shell,
                shellCloseBtn: shell.querySelector('#shell-close-btn'),
                stepper: shell.querySelector('#stepper'),
                steps: shell.querySelectorAll('.step-section'),
                footers: { 'step-1': shell.querySelector('#footer-step-1'), 'step-2': shell.querySelector('#footer-step-2'), 'step-3': shell.querySelector('#footer-step-3'), },
                harInput: shell.querySelector('#har-input'), parseBtn: shell.querySelector('#parse-btn'),
                methodSelect: shell.querySelector('#edit-method'), urlInput: shell.querySelector('#edit-url'),
                headersContainer: shell.querySelector('#headers-container'), addHeaderBtn: shell.querySelector('#add-header-btn'),
                bodyTabs: shell.querySelectorAll('#step-2 .tab-btn'), bodySections: shell.querySelectorAll('.body-type-section'),
                bodyRaw: shell.querySelector('#edit-body-raw'), formDataContainer: shell.querySelector('#form-data-container'), addFormDataBtn: shell.querySelector('#add-form-data-btn'),
                backToStep1Btn: shell.querySelector('#back-to-step1-btn'), sendRequestBtn: shell.querySelector('#send-request-btn'),
                resultStatus: shell.querySelector('#result-status'),
                resultTabs: shell.querySelectorAll('#step-3 .tab-btn'), resultTabContents: shell.querySelectorAll('.result-tab-content'),
                backToStep2Btn: shell.querySelector('#back-to-step2-btn'), generateCodeBtn: shell.querySelector('#generate-code-btn'), resendRequestBtn: shell.querySelector('#resend-request-btn'),
            };
        },
        bindEvents() {
            this.elements.shellCloseBtn.addEventListener('click', () => {
                this.elements.shell.style.animation = 'fadeOut 0.3s ease-in forwards';
                this.elements.shell.querySelector('#api-tool-container').style.animation = 'scaleOut 0.3s ease-in forwards';
                setTimeout(() => { this.elements.shell.remove(); document.getElementById('api-tool-styles')?.remove(); }, 300);
            });
            this.elements.parseBtn.addEventListener('click', () => this.handleParse());
            this.elements.backToStep1Btn.addEventListener('click', () => this.navigateTo('step-1'));
            this.elements.sendRequestBtn.addEventListener('click', () => this.handleSendRequest());
            this.elements.addHeaderBtn.addEventListener('click', () => this.ui.addKeyValueRow(this.elements.headersContainer));
            this.elements.addFormDataBtn.addEventListener('click', () => this.ui.addKeyValueRow(this.elements.formDataContainer));
            this.elements.bodyTabs.forEach(tab => tab.addEventListener('click', (e) => this.ui.switchBodyTab(e.currentTarget.id)));
            this.elements.resultTabs.forEach(tab => tab.addEventListener('click', (e) => this.ui.switchResultTab(e.currentTarget.dataset.tab)));
            this.elements.backToStep2Btn.addEventListener('click', () => this.navigateTo('step-2'));
            this.elements.resendRequestBtn.addEventListener('click', () => this.handleSendRequest());
        },
        navigateTo(stepId) {
            this.elements.steps.forEach(s => s.classList.toggle('active', s.id === stepId));
            const stepNumber = parseInt(stepId.split('-')[1]);
            this.ui.renderStepper(stepNumber);
            Object.values(this.elements.footers).forEach(f => f.style.display = 'none');
            this.elements.footers[stepId].style.display = 'flex';
        },
        handleParse() {
            const rawContent = this.elements.harInput.value.trim();
            if (!rawContent) return this.ui.showToast('請輸入請求內容', 'error');
            try {
                this.state.request = this.parser.parse(rawContent);
                this.ui.renderEditStep(); this.navigateTo('step-2');
            } catch (error) { this.ui.showToast(`解析失敗: ${error.message}`, 'error'); console.error(error); }
        },
        async handleSendRequest() {
            this.ui.updateRequestFromUI();
            this.ui.setLoading(this.elements.sendRequestBtn, true, '發送中...');
            this.ui.setLoading(this.elements.resendRequestBtn, true, '發送中...');
            try {
                const result = await this.network.executeRequest();
                this.ui.renderResultStep(result); this.navigateTo('step-3');
            } catch (error) { this.ui.renderResultStep({ error }); this.navigateTo('step-3');
            } finally {
                this.ui.setLoading(this.elements.sendRequestBtn, false, '發送請求');
                this.ui.setLoading(this.elements.resendRequestBtn, false, '重新發送');
            }
        },
        ui: {
            setLoading(button, isLoading, text) { if(!button) return; button.disabled = isLoading; button.textContent = text; },
            showToast(message, type = 'info') {
                const toastColors = { success: 'var(--success-color)', error: 'var(--error-color)', info: 'var(--primary-color)' };
                const container = document.getElementById('toast-container');
                const toast = document.createElement('div');
                toast.textContent = message;
                toast.style.backgroundColor = toastColors[type];
                toast.style.color = 'white';
                toast.style.padding = '0.75rem 1.25rem';
                toast.style.borderRadius = '6px';
                toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px)';
                toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                container.appendChild(toast);
                requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.addEventListener('transitionend', () => toast.remove());
                }, 3000);
            },
            renderStepper(currentStep) {
                const steps = ['輸入', '編輯', '結果'];
                let html = '';
                steps.forEach((name, index) => {
                    const step = index + 1;
                    let status = '';
                    if (step < currentStep) status = 'done';
                    if (step === currentStep) status = 'active';
                    html += `<div class="step ${status}">
                                <div class="step-circle">${status === 'done' ? '✓' : step}</div>
                                <div class="step-label">${name}</div>
                             </div>`;
                    if (step < steps.length) { html += `<div class="step-line ${status === 'done' || status === 'active' ? 'done' : ''}"></div>`; }
                });
                App.elements.stepper.innerHTML = html;
            },
            addKeyValueRow(container, key = '', value = '') {
                const div = document.createElement('div');
                div.className = 'key-value-pair';
                div.innerHTML = `<input type="text" placeholder="Key" style="width: 33.333%" value="${key}"><input type="text" placeholder="Value" style="flex-grow: 1" value="${value}"><button type="button" title="刪除" style="color: var(--error-color); padding: 0.5rem; font-size: 1.25rem; line-height: 1; opacity: 0.6; transition: opacity 0.2s;">&times;</button>`;
                div.querySelector('button').addEventListener('click', () => div.remove());
                container.appendChild(div);
            },
            switchBodyTab(tabId) { App.state.activeBodyTab = tabId.includes('raw') ? 'raw' : 'form'; App.elements.bodyTabs.forEach(t => t.classList.toggle('active', t.id === tabId)); App.elements.bodySections.forEach(s => s.style.display = s.id.includes(App.state.activeBodyTab) ? 'block' : 'none'); },
            switchResultTab(tabId) { App.elements.resultTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId)); App.elements.resultTabContents.forEach(c => c.style.display = c.id === tabId ? 'block' : 'none'); },
            renderEditStep() {
                const { method, url, headers, body } = App.state.request;
                const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
                App.elements.methodSelect.innerHTML = methods.map(m => `<option value="${m}" ${m === method ? 'selected' : ''}>${m}</option>`).join('');
                App.elements.urlInput.value = url;
                App.elements.headersContainer.innerHTML = '';
                headers.forEach(h => this.addKeyValueRow(App.elements.headersContainer, h.key, h.value));
                App.elements.bodyRaw.value = body || '';
                const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value || '';
                if (body && contentType.includes('application/x-www-form-urlencoded')) { this.renderFormData(body); this.switchBodyTab('body-tab-form'); } else { this.switchBodyTab('body-tab-raw'); }
            },
            renderFormData(body) { const c = App.elements.formDataContainer; c.innerHTML = ''; try { new URLSearchParams(body).forEach((v, k) => this.addKeyValueRow(c, k, v)); } catch (e) { console.error(e); } },
            updateRequestFromUI() { let body = ''; if (App.state.activeBodyTab === 'raw') { body = App.elements.bodyRaw.value; } else { const p = new URLSearchParams(); App.elements.formDataContainer.querySelectorAll('.key-value-pair').forEach(d => { const i = d.querySelectorAll('input'); if (i[0].value) p.append(i[0].value, i[1].value); }); body = p.toString(); } const h = Array.from(App.elements.headersContainer.querySelectorAll('.key-value-pair')).map(d => { const i = d.querySelectorAll('input'); return { key: i[0].value, value: i[1].value }; }).filter(h => h.key); App.state.request = { method: App.elements.methodSelect.value, url: App.elements.urlInput.value, headers: h, body, id: App.state.request?.id || Date.now() }; },
            renderResultStep({ response, duration, error }) {
                const s = App.elements.resultStatus, b = App.elements.shell.querySelector('#response-body'), h = App.elements.shell.querySelector('#response-headers');
                if (error) { s.className = 'error'; s.innerHTML = `<strong>錯誤:</strong> ${error.message}`; return; }
                s.className = response.ok ? 'success' : 'error'; s.innerHTML = `<strong>${response.status} ${response.statusText}</strong><span>${duration} ms</span>`;
                h.textContent = Array.from(response.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\n');
                response.text().then(text => { b.innerHTML = `<pre class="code-editor" style="height: 100%; border: none;">${text.replace(/</g, "&lt;")}</pre>`; });
                this.switchResultTab('response-body');
            },
        },
        network: { async executeRequest() { const { method, url, headers, body } = App.state.request; const h = headers.reduce((a, c) => { if (c.key) a[c.key] = c.value; return a; }, {}); const t = performance.now(); try { const r = await fetch(url, { method, headers: h, body: (method !== 'GET' && method !== 'HEAD' && body) ? body : undefined, mode: 'cors' }); return { response: r, duration: Math.round(performance.now() - t) }; } catch (e) { throw e; } } },
        parser: {
            parse(rawContent) { if (rawContent.trim().startsWith('curl')) return this.parseCurl(rawContent); if (rawContent.trim().startsWith('fetch')) return this.parseFetch(rawContent); try { const har = JSON.parse(rawContent); if (har.log?.entries?.length > 0) return this.parseHar(har); } catch { } throw new Error('無法識別的格式。'); },
            parseHar(har) { const e = har.log.entries[0].request; return { method: e.method.toUpperCase(), url: e.url, headers: e.headers.map(h => ({ key: h.name, value: h.value })), body: e.postData ? e.postData.text : '' }; },
            parseCurl(raw) { const s = raw.replace(/\\\n/g, '').replace(/\n/g, ' '); const u = s.match(/curl\s+(?:--location\s+)?['"]?([^'"\s]+)['"]?/); if (!u) throw new Error('cURL: 無法解析 URL'); const m = s.match(/-X\s+['"]?(\w+)['"]?/); const h = [...s.matchAll(/-H\s+['"]([^:]+):\s*([^'"]+)['"]/g)].map(m => ({ key: m[1].trim(), value: m[2].trim() })); const d = s.match(/--data(?:-raw)?\s+'([^']*)'|--data(?:-raw)?\s+"([^"]*)"/); const b = d ? (d[1] || d[2] || '') : ''; return { method: m ? m[1].toUpperCase() : (b ? 'POST' : 'GET'), url: u[1], headers: h, body: b }; },
            parseFetch(raw) { const u = raw.match(/fetch\(\s*['"]([^'"]+)['"]/); if (!u) throw new Error('Fetch: 無法解析 URL'); const o = raw.match(/,\s*(\{[\s\S]*\}\s*)\)/); let m = 'GET', h = [], b = ''; if (o) { try { const j = o[1].replace(/'/g, '"').replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":').replace(/,\s*}/g, ' }').replace(/,\s*]/g, ' ]'); const p = JSON.parse(j); m = p.method?.toUpperCase() || 'GET'; if (p.headers) h = Object.entries(p.headers).map(([k, v]) => ({ key: k, value: v })); if (p.body) b = typeof p.body === 'string' ? p.body : JSON.stringify(p.body); } catch (e) { throw new Error('Fetch: 解析選項失敗'); } } return { method: m, url: u[1], headers: h, body: b }; }
        },
    };

    // --- 步驟 3: 啟動函式 ---
    function launchTool() {
        if (document.getElementById('api-tool-shell')) return;
        const shell = document.createElement('div');
        shell.id = 'api-tool-shell';
        shell.innerHTML = toolHTML;
        document.body.appendChild(shell);
        const styleElement = document.createElement('style');
        styleElement.id = 'api-tool-styles';
        styleElement.textContent = toolCSS;
        document.head.appendChild(styleElement);
        requestAnimationFrame(() => { App.init(); });
    }

    // --- 步驟 4: 執行 ---
    launchTool();
})();
