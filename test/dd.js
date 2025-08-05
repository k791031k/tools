javascript: (function() {
    'use strict';

    /**
     * =================================================================================
     * 多功能派件整合 - v14.0 (Feature Complete)
     * =================================================================================
     * @version 14.0.0
     * @description
     * 功能集大成的最終版本。在 v13.0 的穩定架構基礎上，回歸並強化了所有靈活的
     * 派件人員選擇功能：
     * 1. [功能回歸]: 新增「匯入人員」按鈕，可從 TXT 檔案動態擴充人員清單。
     * 2. [功能回歸]: 新增「手動輸入帳號」核取方塊，可指派人員給非預設清單成員。
     * 3. [架構與健壯性]: 完整保留 v13.0 的所有架構優化與穩定性設計。
     * =================================================================================
     */

    try {
        // === 1. 設定模組（AppConfig） ===
        const AppConfig = Object.freeze({
            VERSION: '14.0.0 (Feature Complete)',
            TOOL_CONTAINER_ID: 'dispatch-tool-container-v14',
            STYLE_ELEMENT_ID: 'dispatch-tool-style-v14',
            TOKEN_KEY: 'euisToken',
            PRESETS_KEY: 'dispatchPresets_v4',
            API: {
                QUERY_PERSONAL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
                QUERY_BATCH: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
                MANUAL_ASSIGN: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
            },
            DEFAULT_PERSONAL_USERS: ['chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu', 'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu'].sort(),
            DEFAULT_BATCH_USERS: ['chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu', 'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu'].sort(),
            SPECIAL_USERS: ['chenjui.chang', 'peiyi.wu'],
            DEFAULT_PERSONAL_FILTER: { applyNumber: '', policyNumber: '', mainStatus: '', subStatus: '', hint: '', ownerName: '', insuredName: '', firstBillingMethod: '', planCodeName: '', planCode: '', applyDateStart: '', applyDateEnd: '', agencyCodeName: '', replyEstimatedCompletionDateStart: '', replyEstimatedCompletionDateEnd: '', channel: '', caseLabelings: [], productLabelings: [] },
            DEFAULT_BATCH_FILTER: { applyNumber: '', policyNumber: '', org: '', poolOrg: '', uwLevels: [], poolUwLevels: [], caseLabelings: [], productLabelings: [], polpln: '', mainStatus: '2', subStatus: '', channel: '', agencyCode: '', uwApprover: null, currentOwner: null, firstBillingMethod: '', hint: '', ownerTaxId: '', ownerName: '', insuredTaxId: '', insuredName: '', applyDateStart: '', applyDateEnd: '', confrmno: '', currency: '', firstPaymentPremiumFlag: '' },
            NON_EDITABLE_FIELDS: ['pageIndex', 'size', 'orderBys'],
            BATCH_PAGE_SIZE: 50,
            ZINDEX: { TOAST: 2147483647, MASK: 2147483640, MODAL: 2147483641 }
        });

        // === 2. 全域狀態模組（AppState） ===
        const AppState = (() => {
            const state = { userToken: null, modalPosition: { top: null, left: null }, abortController: null, prevViewState: {}, isLoading: false };
            return {
                get: (key) => key ? state[key] : { ...state },
                set: (k, v) => { if (typeof k === 'object') Object.assign(state, k); else state[k] = v; },
                clearSession: () => { state.prevViewState = {}; },
                createAbortSignal: () => (state.abortController = new AbortController()).signal,
                abortRequest: () => { state.abortController?.abort(); state.abortController = null; }
            };
        })();

        // === 3. 工具方法模組（Utils） ===
        const Utils = (() => ({
            escapeHtml: (str) => { if (str === null || str === undefined) return ''; const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return String(str).replace(/[&<>"']/g, m => map[m]); },
            getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(AppConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
            splitTextInput: (text) => text.split(/[\s,，\n]+/).map(s => s.trim()).filter(Boolean),
            sleep: ms => new Promise(res => setTimeout(res, ms)),
            readTxt: () => new Promise((resolve, reject) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.txt'; i.onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => reject(new Error('讀取檔案失敗')); r.readAsText(f); } else reject(new Error('未選擇任何檔案')); }; i.click(); }),
            jsonToCsv: (items, headers) => { const keys = Object.keys(headers); const headerRow = Object.values(headers).map(h => JSON.stringify(h.label || h)).join(','); const rows = items.map(row => keys.map(key => JSON.stringify(row[key] ?? '')).join(',')); return [headerRow, ...rows].join('\r\n'); },
            downloadCsv: (csv, filename) => { const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); },
            formatDisplayDate: (d) => (d && typeof d === 'string') ? d.split(' ')[0] : '',
            formatDateApi: (date) => { if (!date) return ""; const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d} 00:00:00`; },
            today: () => new Date(),
            nDaysAgo: (date, n) => new Date(date.getTime() - n * 24 * 60 * 60 * 1000),
            debounce: (fn, delay) => { let t; return function(...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); }; }
        }))();

        // === 4. UI 管理模組（UIManager） ===
        const UIManager = (() => {
            function injectStyle() {
                if (document.getElementById(AppConfig.STYLE_ELEMENT_ID)) return;
                const style = document.createElement('style'); style.id = AppConfig.STYLE_ELEMENT_ID;
                style.textContent = `
                  :root { --primary-color: #007bff; --primary-dark: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
                  .dispatch-mask { position: fixed; z-index: ${AppConfig.ZINDEX.MASK}; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; }
                  .dispatch-mask.show { opacity: 1; }
                  .dispatch-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.15); padding:0; position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: ${AppConfig.ZINDEX.MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity .18s; max-height: 90vh; max-width: 95vw; box-sizing: border-box;}
                  .dispatch-modal.show { opacity: 1; } .dispatch-modal.dragging { transition: none !important; }
                  .dispatch-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; text-align:center;}
                  .dispatch-close { position: absolute;top:10px;right:10px;background:transparent;border:none;font-size:28px;font-weight:bold;color:var(--secondary-color);cursor:pointer;width:36px;height:36px;border-radius:50%;transition:.2s;display:flex;align-items:center;justify-content:center;}
                  .dispatch-close:hover {background:#f0f0f0;color:#333;transform:rotate(90deg)scale(1.05);}
                  .dispatch-body{padding:16px 20px;flex-grow:1;overflow-y:auto;min-height:50px;display:flex;flex-direction:column;}
                  .dispatch-footer{padding:12px 20px 16px 20px;border-top:1px solid #e0e0e0;display:flex;align-items:center;width:100%;box-sizing:border-box;}
                  .dispatch-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 18px;font-size:15px;border-radius:6px;border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:.25s;font-weight:600;white-space:nowrap;}
                  .dispatch-btn:not([disabled]):hover{background:var(--primary-dark);transform:translateY(-2px);}
                  .dispatch-btn[disabled]{background:#d6d6d6;cursor:not-allowed;}
                  .dispatch-btn.dispatch-outline{background:transparent;border-color:var(--secondary-color);color:var(--secondary-color);}
                  .dispatch-btn.dispatch-outline:not([disabled]):hover{background-color:#f8f8f8;}
                  .dispatch-btn.small{padding:4px 10px;font-size:13px;}
                  .dispatch-input,textarea.dispatch-input,select.dispatch-input{width:100%;font-size:14px;padding:8px 12px;border-radius:5px;box-sizing:border-box;border:1px solid #e0e0e0;margin-top:5px;}
                  .dispatch-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 3px rgba(0,123,255,.25);outline:none;}
                  .dispatch-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:6px;font-size:16px;z-index:${AppConfig.ZINDEX.TOAST};opacity:0;transition:.3s;}
                  .dispatch-toast.show{opacity:1;}
                  .dispatch-progress{position:fixed;inset:0;background:rgba(255,255,255,0.8);z-index:${AppConfig.ZINDEX.TOAST};display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:1.2rem;font-weight:bold;}
                  .dispatch-progress button{margin-top:20px;}
                  .dispatch-help-btn{position:absolute;top:15px;left:15px;font-size:18px;width:30px;height:30px;padding:0;border-radius:50%;background:#f0f0f0;color:#555;border:1px solid #ccc;}
                  .dispatch-tabs{margin-bottom:15px;border-bottom:1px solid #ccc;}
                  .dispatch-tabs button{background:transparent;border:none;padding:10px 15px;cursor:pointer;font-size:16px;border-bottom:3px solid transparent;}
                  .dispatch-tabs button.active{font-weight:bold;color:var(--primary-color);border-bottom-color:var(--primary-color);}
                  .dispatch-pane{display:none;flex-grow:1;flex-direction:column;} .dispatch-pane.active{display:flex;}
                  .filter-controls{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:15px;}
                  .case-table-container{overflow:auto;position:relative;flex-grow:1;}
                  .case-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:14px;table-layout:fixed;}
                  .case-table th, .case-table td{border:1px solid #ddd;padding:8px 10px;text-align:left;overflow:hidden;text-overflow:ellipsis;}
                  .case-table thead{position:sticky;top:0;z-index:1;background-color:#f2f2f2;}
                  .case-table th{cursor:pointer;} .case-table td{cursor:cell;}
                  .case-table th .sort-indicator{margin-left:5px;font-weight:normal;opacity:0.5;}
                `;
                document.head.appendChild(style);
            }
            const Toast = { show: (msg, type = 'success', duration = 2100) => { document.querySelector('.dispatch-toast')?.remove(); const t = document.createElement('div'); t.className = `dispatch-toast ${type}`; t.textContent = msg; t.style.background = `var(--${type}-color, #555)`; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show')); if (duration > 0) setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => t.remove(), { once: true }); }, duration); } };
            const Progress = {
                show(text) {
                    this.hide(); const p = document.createElement('div'); p.className = 'dispatch-progress'; p.id = 'dispatch-progress';
                    p.innerHTML = `<div>${Utils.escapeHtml(text)}</div><button id="stop-query" class="dispatch-btn dispatch-outline">停止查詢</button>`;
                    document.body.appendChild(p); document.getElementById('stop-query').onclick = () => { AppState.abortRequest(); this.hide(); Toast.show('查詢已中斷', 'warning'); };
                },
                update(percent, text) { const p = document.getElementById('dispatch-progress')?.querySelector('div:first-child'); if (p) p.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`; },
                hide() { document.getElementById('dispatch-progress')?.remove(); }
            };
            const Modal = {
                close() { const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID); if (m) AppState.set({ modalPosition: { top: m.style.top, left: m.style.left } }); AppState.abortRequest(); document.getElementById('dispatch-mask')?.remove(); m?.remove(); document.removeEventListener('keydown', EventHandlers.handleEsc); },
                show(opts) {
                    return new Promise(resolve => {
                        this.close(); const { top, left } = AppState.get('modalPosition'); const mask = document.createElement('div');
                        mask.id = 'dispatch-mask'; mask.className = 'dispatch-mask'; document.body.appendChild(mask); requestAnimationFrame(() => mask.classList.add('show'));
                        const modal = document.createElement('div'); modal.id = AppConfig.TOOL_CONTAINER_ID; modal.className = 'dispatch-modal';
                        modal.style.width = opts.width || 'auto'; modal.innerHTML = `<div class="dispatch-header">${opts.header}<button class="dispatch-close">&times;</button></div><div class="dispatch-body">${opts.body}</div><div class="dispatch-footer">${opts.footer}</div>`;
                        if (top && left) { modal.style.top = top; modal.style.left = left; modal.style.transform = 'none'; }
                        document.body.appendChild(modal); requestAnimationFrame(() => modal.classList.add('show'));
                        modal.querySelector('.dispatch-header').addEventListener('mousedown', EventHandlers.dragStart);
                        modal.querySelector('.dispatch-close').addEventListener('click', () => { this.close(); resolve({ action: '_close_tool_' }); });
                        EventHandlers.setupKeyListener(); if (opts.onOpen) opts.onOpen(modal, resolve);
                    });
                }
            };
            return { injectStyle, Toast, Progress, Modal };
        })();

        const EventHandlers = (() => {
            const drag = { active: false, sX: 0, sY: 0, iL: 0, iT: 0 };
            function dragStart(e) { const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID); if (!m || e.target.closest('.dispatch-close, .dispatch-help-btn')) return; e.preventDefault(); drag.active = true; m.classList.add('dragging'); const r = m.getBoundingClientRect(); drag.sX = e.clientX; drag.sY = e.clientY; drag.iL = r.left; drag.iT = r.top; document.addEventListener('mousemove', doDrag); document.addEventListener('mouseup', stopDrag); }
            function doDrag(e) { if (!drag.active) return; e.preventDefault(); const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID); if (m) { m.style.left = `${drag.iL + e.clientX - drag.sX}px`; m.style.top = `${drag.iT + e.clientY - drag.sY}px`; m.style.transform = 'none'; } }
            function stopDrag() { drag.active = false; document.getElementById(AppConfig.TOOL_CONTAINER_ID)?.classList.remove('dragging'); document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag); }
            function handleEsc(e) { if (e.key === 'Escape') UIManager.Modal.close(); }
            function setupKeyListener() { document.removeEventListener('keydown', handleEsc); document.addEventListener('keydown', handleEsc); }
            return { dragStart, handleEsc, setupKeyListener };
        })();

        // === 6. 資料服務模組 (ApiService) ===
        const ApiService = (() => {
            async function _fetch(url, options) { const token = AppState.get('userToken'); if (!token) throw new Error('TOKEN不存在'); options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' }; options.signal = AppState.createAbortSignal(); const resp = await fetch(url, options); if (resp.status === 401 || resp.status === 403) throw new Error('TOKEN無效或逾期'); if (!resp.ok) { const err = new Error(`伺服器錯誤_${resp.status}`); try { err.data = await resp.json(); } catch { err.data = await resp.text(); } throw err; } return resp.json(); }
            async function fetchAllPages(endpoint, payload, listName) { let list = [], page = 1, totalPages = 1; while (page <= totalPages) { const request = { ...payload, pageIndex: page, size: AppConfig.BATCH_PAGE_SIZE }; UIManager.Progress.update(totalPages > 1 ? Math.round(100 * page / totalPages) : 50, `載入${listName} 第 ${page} / ${totalPages === 1 ? '?' : totalPages} 頁...`); const res = await _fetch(endpoint, { method: 'POST', body: JSON.stringify(request) }); if (res?.records?.length > 0) { list = list.concat(res.records); if (page === 1 && res.total) totalPages = Math.ceil(res.total / AppConfig.BATCH_PAGE_SIZE); } else break; page++; } return list; }
            return {
                fetchPersonalCases: (filters) => fetchAllPages(AppConfig.API.QUERY_PERSONAL, filters, '個人案件'),
                fetchBatchCases: (filters) => fetchAllPages(AppConfig.API.QUERY_BATCH, filters, '批次案件'),
                manualAssign: (applyNumbers, assignee) => {
                    if (!Array.isArray(applyNumbers) || applyNumbers.length === 0) return Promise.reject(new Error('參數錯誤：applyNumbers 必須為一個非空的陣列。'));
                    if (typeof assignee !== 'string' || !assignee.trim()) return Promise.reject(new Error('參數錯誤：assignee 必須為一個有效的字串。'));
                    return _fetch(AppConfig.API.MANUAL_ASSIGN, { method: 'POST', body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: assignee, dispatchOrgBf: '', applyNumbers }) });
                }
            };
        })();

        const UIModules = (() => {
            const TokenDialog = { show: (showRetry) => UIManager.Modal.show({ header: '請輸入 SSO-TOKEN', width: '450px', body: `<p style="margin-top:0;">請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。</p><textarea id="token-input" class="dispatch-input" rows="4" style="font-family:monospace;"></textarea>${showRetry ? `<p style="color:var(--error-color);font-size:14px;margin-bottom:0;">自動偵測失敗，請手動輸入。</p>` : ''}`, footer: `<div style="width:100%; display:flex; justify-content:${showRetry ? 'space-between' : 'flex-end'};"><button id="retry-autocheck-btn" class="dispatch-btn dispatch-outline" style="display:${showRetry ? 'inline-flex' : 'none'}">重試自動偵測</button><button id="confirm-token-btn" class="dispatch-btn">確認</button></div>`, onOpen: (modal, resolve) => { modal.querySelector('#confirm-token-btn').onclick = () => { const value = modal.querySelector('#token-input').value.trim(); if (value) resolve({ action: '_confirm_', value }); else UIManager.Toast.show('Token 不可為空', 'error'); }; if (showRetry) modal.querySelector('#retry-autocheck-btn').onclick = () => resolve({ action: '_retry_autocheck_' }); } }) };
            const ModeDialog = { show: () => UIManager.Modal.show({ header: `多功能派件整合 ${AppConfig.VERSION}`, width: '500px', body: `<div style="display:flex; justify-content:space-around; gap:15px; padding: 20px 0;"><button id="personal-mode-btn" class="dispatch-btn" style="width:45%;padding:20px;">個人案件查詢</button><button id="batch-mode-btn" class="dispatch-btn" style="width:45%;padding:20px;">批次案件查詢</button></div>`, footer: `<div style="width:100%; display:flex; justify-content:center; gap: 15px;"><button id="change-token-btn" class="dispatch-btn dispatch-outline">變更 Token</button><button id="edit-presets-btn" class="dispatch-btn dispatch-outline">編輯預設條件</button></div>`, onOpen: (modal, resolve) => { modal.querySelector('#personal-mode-btn').onclick = () => resolve({ action: 'personal' }); modal.querySelector('#batch-mode-btn').onclick = () => resolve({ action: 'batch' }); modal.querySelector('#change-token-btn').onclick = () => resolve({ action: '_change_token_' }); modal.querySelector('#edit-presets-btn').onclick = () => resolve({ action: '_edit_presets_' }); } }) };
            const PresetDialog = {
                show: () => {
                    const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}'); const personalPresets = { ...AppConfig.DEFAULT_PERSONAL_FILTER, ...(presets.personal || {}) }; const batchPresets = { ...AppConfig.DEFAULT_BATCH_FILTER, ...(presets.batch || {}) };
                    const createForm = (id, data) => Object.entries(data).filter(([key]) => !AppConfig.NON_EDITABLE_FIELDS.includes(key)).map(([key, value]) => `<div style="margin-bottom: 8px;"><label for="${id}-${key}" style="font-size:14px; display:block;">${key}:</label><textarea id="${id}-${key}" class="dispatch-input" rows="1" style="font-size:13px; padding: 5px 8px;">${Utils.escapeHtml(Array.isArray(value) ? value.join(',') : value)}</textarea></div>`).join('');
                    return UIManager.Modal.show({ header: '編輯預設查詢條件', width: '800px', body: `<div style="display:flex; gap: 20px;"><div style="flex:1;"><h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">個人案件</h3><div style="max-height: 50vh; overflow-y:auto; padding-right:10px;">${createForm('personal', personalPresets)}</div></div><div style="flex:1;"><h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">批次案件</h3><div style="max-height: 50vh; overflow-y:auto; padding-right:10px;">${createForm('batch', batchPresets)}</div></div></div>`, footer: `<div style="width:100%; display:flex; justify-content:space-between; align-items:center;"><div><button id="reset-presets-btn" class="dispatch-btn dispatch-outline">恢復原廠設定</button></div><div style="display:flex; gap:10px;"><button id="back-btn" class="dispatch-btn dispatch-outline">返回</button><button id="save-presets-btn" class="dispatch-btn">儲存</button></div></div>`, onOpen: (modal, resolve) => { modal.querySelector('#save-presets-btn').onclick = () => { const newPresets = { personal: {}, batch: {} }; Object.keys(personalPresets).forEach(key => { const input = modal.querySelector(`#personal-${key}`); if (input) newPresets.personal[key] = Array.isArray(AppConfig.DEFAULT_PERSONAL_FILTER[key]) ? Utils.splitTextInput(input.value.trim()) : input.value.trim(); }); Object.keys(batchPresets).forEach(key => { const input = modal.querySelector(`#batch-${key}`); if (input) newPresets.batch[key] = Array.isArray(AppConfig.DEFAULT_BATCH_FILTER[key]) ? Utils.splitTextInput(input.value.trim()) : input.value.trim(); }); localStorage.setItem(AppConfig.PRESETS_KEY, JSON.stringify(newPresets)); UIManager.Toast.show('預設條件已儲存', 'success'); resolve({ action: '_saved_' }); }; modal.querySelector('#reset-presets-btn').onclick = () => { if (confirm('確定要將所有條件恢復為原廠設定嗎？')) { localStorage.removeItem(AppConfig.PRESETS_KEY); UIManager.Toast.show('已恢復原廠設定', 'info'); resolve({ action: '_saved_' }); } }; modal.querySelector('#back-btn').onclick = () => resolve({ action: '_back_' }); } });
                }
            };
            const CaseListView = {
                show: async (opts) => {
                    if (!opts || !Array.isArray(opts.caseList)) { console.warn('CaseListView.show 呼叫錯誤: opts.caseList 必須是一個陣列，已校正為空陣列。'); opts.caseList = []; }
                    let { caseList, header } = opts; const TABLE_HEADERS = header.includes('個人') ? { seq: "序號", applyNumber: "要保號", policyNumber: "保單號", ownerName: "要保人", insuredName: "被保人", mainStatus: "主狀態", subStatus: "次狀態", currentOwner: "目前關卡人員", applyDate: "受理日" } : { seq: "序號", applyNumber: "要保號", policyNumber: "保單號", ownerName: "要保人", insuredName: "被保人", mainStatus: "主狀態", subStatus: "次狀態", pool: "Pool", poolStatus: "Pool狀態", currentOwner: "目前關卡人員", applyDate: "受理日" };
                    let viewState = AppState.get('prevViewState') || {}; let sortState = viewState.sort || { key: 'seq', order: 'asc' }; let globalSearch = viewState.globalSearch || ''; let activeTab = viewState.activeTab || 'query';
                    const modalBody = `<button class="dispatch-help-btn">?</button><div class="dispatch-tabs"><button data-tab="query" class="${activeTab === 'query' ? 'active' : ''}">查詢案件</button><button data-tab="manual" class="${activeTab === 'manual' ? 'active' : ''}">手動輸入</button></div><div id="query-pane" class="dispatch-pane ${activeTab === 'query' ? 'active' : ''}"><div class="filter-controls"><input type="text" id="global-search" class="dispatch-input" placeholder="全域快速搜尋..." value="${Utils.escapeHtml(globalSearch)}"></div><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;"><span id="case-count"></span><button id="export-csv-btn" class="dispatch-btn small dispatch-outline">匯出CSV</button></div><div id="case-table-container" class="case-table-container"><div id="virtual-scroll-content" style="position:relative; overflow:hidden;"><table id="case-table" class="case-table"></table></div></div></div><div id="manual-pane" class="dispatch-pane ${activeTab === 'manual' ? 'active' : ''}"><h4 style="margin-top:0;">請貼上要保號 (以空格、逗號或換行分隔)</h4><textarea id="manual-input-area" class="dispatch-input" style="flex-grow:1;resize:none;">${viewState.manualInput || ''}</textarea></div>`;
                    const modalFooter = `<div style="width:100%; display:flex; justify-content:space-between; align-items:center;"><div><button id="back-btn" class="dispatch-btn dispatch-outline">返回主選單</button></div><div style="display:flex; gap:10px;"><button id="next-step-btn" class="dispatch-btn" disabled>下一步 (0)</button></div></div>`;
                    return UIManager.Modal.show({
                        header, width: '90vw', body: modalBody, footer: modalFooter, onOpen: (modal, resolve) => {
                            let sortedData = []; const tableContainer = modal.querySelector('#case-table-container'), virtualContent = modal.querySelector('#virtual-scroll-content'), tableElem = modal.querySelector('#case-table'); const countElem = modal.querySelector('#case-count'), nextBtn = modal.querySelector('#next-step-btn'), manualTextarea = modal.querySelector('#manual-input-area');
                            const updateNextButton = () => { let count = activeTab === 'query' ? modal.querySelectorAll('.case-checkbox:checked').length : Utils.splitTextInput(manualTextarea.value).length; nextBtn.disabled = count === 0; nextBtn.textContent = `下一步 (${count})`; };
                            const renderTable = (data) => { const headerHtml = `<thead><tr><th style="width:50px;"><input type="checkbox" id="select-all-header"></th>${Object.entries(TABLE_HEADERS).map(([key, label]) => `<th data-key="${key}" title="點擊排序">${label} <span class="sort-indicator">${sortState.key === key ? (sortState.order === 'asc' ? '▲' : '▼') : ''}</span></th>`).join('')}</tr></thead>`; tableElem.innerHTML = headerHtml + '<tbody></tbody>'; const tbody = tableElem.querySelector('tbody'), rowHeight = 35; virtualContent.style.height = `${data.length * rowHeight}px`; let lastRenderedStart = -1; const renderViewport = (force = false) => { const scrollTop = tableContainer.scrollTop, startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5); if (startIndex === lastRenderedStart && !force) return; const visibleRows = Math.ceil(tableContainer.clientHeight / rowHeight) + 10, endIndex = Math.min(data.length, startIndex + visibleRows); let rowsHtml = ''; for (let i = startIndex; i < endIndex; i++) { const item = data[i]; rowsHtml += `<tr style="position:absolute; top:${i * rowHeight}px; left:0; right:0; height:${rowHeight}px;"><td><input type="checkbox" class="case-checkbox" value="${item.applyNumber}"></td>${Object.keys(TABLE_HEADERS).map(key => `<td title="${Utils.escapeHtml(item[key])}">${Utils.escapeHtml(key === 'seq' ? i + 1 : (key.includes('Date') ? Utils.formatDisplayDate(item[key]) : item[key] ?? ''))}</td>`).join('')}</tr>`; } tbody.innerHTML = rowsHtml; lastRenderedStart = startIndex; }; renderViewport(true); if (viewState.scrollTop) tableContainer.scrollTop = viewState.scrollTop; tableContainer.onscroll = () => renderViewport(); };
                            const applyFiltersAndSort = () => { const filteredData = (globalSearch ? caseList.filter(item => Object.values(item).some(val => String(val ?? '').toLowerCase().includes(globalSearch.toLowerCase()))) : [...caseList]).map((item, index) => ({ ...item, _originalIndex: index })); sortedData = [...filteredData].sort((a, b) => { let valA = a[sortState.key] ?? '', valB = b[sortState.key] ?? ''; if (sortState.key === 'seq') { valA = a._originalIndex; valB = b._originalIndex; } if (valA < valB) return sortState.order === 'asc' ? -1 : 1; if (valA > valB) return sortState.order === 'asc' ? 1 : -1; return 0; }); countElem.textContent = `共 ${sortedData.length} / ${caseList.length} 筆`; renderTable(sortedData); updateNextButton(); };
                            modal.querySelector('#global-search').oninput = Utils.debounce(e => { globalSearch = e.target.value.trim(); applyFiltersAndSort(); }, 300);
                            modal.onclick = e => { if (e.target.matches('.dispatch-help-btn')) alert('功能說明：\n1. 查詢案件：於上方搜尋框輸入文字可進行全域搜尋，點擊欄位標題可排序。\n2. 手動輸入：切換頁籤後可直接貼上要保號。\n3. 點擊表格內任一儲存格即可複製其內容。'); if (e.target.closest('th[data-key]')) { const key = e.target.closest('th[data-key]').dataset.key; sortState.order = (sortState.key === key && sortState.order === 'asc') ? 'desc' : 'asc'; sortState.key = key; applyFiltersAndSort(); } if (e.target.id === 'select-all-header') { modal.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = e.target.checked); updateNextButton(); } if (e.target.matches('.case-checkbox')) updateNextButton(); if (e.target.tagName === 'TD') navigator.clipboard.writeText(e.target.textContent).then(() => UIManager.Toast.show('已複製', 'success', 1000)).catch(err => UIManager.Toast.show('複製失敗', 'error')); };
                            modal.querySelectorAll('.dispatch-tabs button').forEach(btn => btn.onclick = () => { activeTab = btn.dataset.tab; modal.querySelectorAll('.dispatch-tabs button,.dispatch-pane').forEach(el => el.classList.remove('active')); btn.classList.add('active'); modal.querySelector(`#${activeTab}-pane`).classList.add('active'); updateNextButton(); });
                            manualTextarea.oninput = updateNextButton; const saveViewState = () => AppState.set('prevViewState', { sort: sortState, globalSearch, activeTab, scrollTop: tableContainer.scrollTop, manualInput: manualTextarea.value });
                            nextBtn.onclick = () => { const selectedCases = activeTab === 'query' ? Array.from(modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value) : Utils.splitTextInput(manualTextarea.value); if (selectedCases.length > 0) { saveViewState(); resolve({ action: '_next_step_', selectedCases }); } };
                            modal.querySelector('#back-btn').onclick = () => { saveViewState(); resolve({ action: '_back_to_mode_' }); };
                            modal.querySelector('#export-csv-btn').onclick = () => { if (sortedData.length === 0) return UIManager.Toast.show('沒有可匯出的資料', 'warning'); const csvData = sortedData.map((item, index) => ({...item, seq: index + 1 })); Utils.downloadCsv(Utils.jsonToCsv(csvData, TABLE_HEADERS), `派件清單_${new Date().toISOString().slice(0, 10)}.csv`); };
                            applyFiltersAndSort(); updateNextButton();
                        }
                    });
                }
            };
            const PersonnelSelectDialog = {
                show: (opts) => {
                    const { selectedCount, mode, onBack } = opts;
                    const bodyHtml = `
                        <p style="margin-top:0;">已選取 <strong>${selectedCount}</strong> 筆案件，請選擇或輸入指派人員：</p>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <select id="assignee-select" class="dispatch-input" style="flex-grow: 1; margin-top:0;"></select>
                            <button id="import-personnel-btn" class="dispatch-btn dispatch-outline small">匯入人員</button>
                        </div>
                        <div style="margin-top: 15px;">
                            <label style="cursor:pointer;"><input type="checkbox" id="manual-assignee-checkbox"> 或手動輸入帳號</label>
                            <input type="text" id="manual-assignee-input" class="dispatch-input" placeholder="請輸入完整 AD 帳號" style="display: none;">
                        </div>`;
                    const footerHtml = `<div style="width:100%; display:flex; justify-content:space-between; align-items:center;"><div><button id="back-btn" class="dispatch-btn dispatch-outline">返回上一步</button></div><div><button id="confirm-assignment-btn" class="dispatch-btn" disabled>確認指派</button></div></div>`;
                    
                    return UIManager.Modal.show({
                        header: '選擇指派人員', width: '450px', body: bodyHtml, footer: footerHtml,
                        onOpen: (modal, resolve) => {
                            const selectEl = modal.querySelector('#assignee-select');
                            const importBtn = modal.querySelector('#import-personnel-btn');
                            const manualCheckbox = modal.querySelector('#manual-assignee-checkbox');
                            const manualInput = modal.querySelector('#manual-assignee-input');
                            const confirmBtn = modal.querySelector('#confirm-assignment-btn');

                            let personnelList = mode === 'personal' ? [...AppConfig.DEFAULT_PERSONAL_USERS] : [...AppConfig.DEFAULT_BATCH_USERS];

                            const populateSelect = () => {
                                selectEl.innerHTML = personnelList.map(u => `<option value="${u}" ${AppConfig.SPECIAL_USERS.includes(u) ? 'style="font-weight:bold;color:var(--primary-dark);"' : ''}>${u}</option>`).join('');
                            };

                            const updateConfirmBtnState = () => {
                                const isManual = manualCheckbox.checked;
                                const hasValue = isManual ? manualInput.value.trim() !== '' : selectEl.value;
                                confirmBtn.disabled = !hasValue;
                            };

                            importBtn.onclick = async () => {
                                try {
                                    const text = await Utils.readTxt();
                                    const importedNames = Utils.splitTextInput(text);
                                    if (importedNames.length > 0) {
                                        personnelList = [...new Set([...personnelList, ...importedNames])].sort();
                                        populateSelect();
                                        UIManager.Toast.show(`成功匯入 ${importedNames.length} 位人員`, 'success');
                                    }
                                } catch (e) {
                                    UIManager.Toast.show(e.message, 'error');
                                }
                            };

                            manualCheckbox.onchange = () => {
                                const isChecked = manualCheckbox.checked;
                                selectEl.disabled = isChecked;
                                manualInput.style.display = isChecked ? 'block' : 'none';
                                if (isChecked) manualInput.focus();
                                updateConfirmBtnState();
                            };

                            selectEl.onchange = updateConfirmBtnState;
                            manualInput.oninput = updateConfirmBtnState;
                            
                            modal.querySelector('#back-btn').onclick = onBack;
                            confirmBtn.onclick = () => {
                                const assignee = manualCheckbox.checked ? manualInput.value.trim() : selectEl.value;
                                if (!assignee) {
                                    UIManager.Toast.show('請選擇或輸入指派人員', 'error');
                                    return;
                                }
                                resolve({ action: '_confirm_assignment_', assignee });
                            };
                            
                            populateSelect();
                            updateConfirmBtnState();
                        }
                    });
                }
            };
            const SuccessDialog = { show: (opts) => new Promise(resolve => { let countdown = 5; UIManager.Modal.show({ header: '派件成功', width: '500px', body: `<p>已成功將 <strong>${opts.cases.length}</strong> 筆案件指派給 <strong>${opts.assignee}</strong></p><p>要保號列表:</p><textarea class="dispatch-input" rows="5" readonly>${opts.cases.join('\n')}</textarea>`, footer: `<div style="width:100%; display:flex; justify-content:flex-end;"><button id="close-success-btn" class="dispatch-btn">關閉</button></div>`, onOpen: (modal, modalResolve) => { const closeBtn = modal.querySelector('#close-success-btn'); const closeAndResolve = () => { clearInterval(interval); UIManager.Modal.close(); resolve({ action: '_closed_' }); }; const interval = setInterval(() => { countdown--; if (countdown > 0) closeBtn.textContent = `關閉 (${countdown})`; else closeAndResolve(); }, 1000); closeBtn.textContent = `關閉 (${countdown})`; closeBtn.onclick = closeAndResolve; } }); }) };
            const ErrorDialog = { show: ({ error, onRetry }) => UIManager.Modal.show({ header: '操作失敗', width: '500px', body: `<p style="color:var(--error-color);">在執行過程中發生錯誤：</p><pre style="background:#f0f0f0; padding:10px; border-radius:5px; white-space:pre-wrap; word-break:break-all;">${Utils.escapeHtml(error.message)}</pre>`, footer: `<div style="width:100%; display:flex; justify-content:space-between; align-items:center;"><div><button id="back-to-menu-btn" class="dispatch-btn dispatch-outline">返回主選單</button></div><div><button id="retry-btn" class="dispatch-btn">重試</button></div></div>`, onOpen: (modal, resolve) => { modal.querySelector('#back-to-menu-btn').onclick = () => resolve({ action: '_back_to_mode_' }); modal.querySelector('#retry-btn').onclick = () => { UIManager.Modal.close(); onRetry(); }; } }) };
            return { TokenDialog, ModeDialog, PresetDialog, CaseListView, PersonnelSelectDialog, SuccessDialog, ErrorDialog };
        })();

        // === 8. 主流程模組 (AppMain) ===
        const AppMain = (() => {
            async function personalFlow(keepState = false) {
                if (AppState.get('isLoading')) { UIManager.Toast.show('操作進行中，請稍候...', 'warning'); return; }
                AppState.set('isLoading', true);
                try {
                    if (!keepState) AppState.set({ prevViewState: {} }); UIManager.Progress.show('正在載入所有個人案件...');
                    const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}');
                    const caseList = await ApiService.fetchPersonalCases(presets.personal || AppConfig.DEFAULT_PERSONAL_FILTER);
                    UIManager.Progress.hide();
                    const res = await UIModules.CaseListView.show({ header: '個人案件查詢與派發', caseList });
                    if (res.action === '_next_step_') {
                        const res2 = await UIModules.PersonnelSelectDialog.show({ selectedCount: res.selectedCases.length, mode: 'personal', onBack: () => personalFlow(true) });
                        if (res2.action === '_confirm_assignment_') { UIManager.Progress.show('執行派件中…'); await ApiService.manualAssign(res.selectedCases, res2.assignee); UIManager.Progress.hide(); await UIModules.SuccessDialog.show({ assignee: res2.assignee, cases: res.selectedCases }); modeSelector(); }
                    } else if (res.action === '_back_to_mode_') modeSelector();
                } catch (e) {
                    UIManager.Progress.hide(); if (e.name === 'AbortError') return;
                    const res = await UIModules.ErrorDialog.show({ error: e, onRetry: () => personalFlow(keepState) });
                    if (res.action === '_back_to_mode_') modeSelector();
                } finally { AppState.set('isLoading', false); }
            }
            async function batchFlow(keepState = false) {
                if (AppState.get('isLoading')) { UIManager.Toast.show('操作進行中，請稍候...', 'warning'); return; }
                AppState.set('isLoading', true);
                try {
                    if (!keepState) AppState.set({ prevViewState: {} }); UIManager.Progress.show('正在載入批次案件...');
                    const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}'); const batchPayload = presets.batch || AppConfig.DEFAULT_BATCH_FILTER; const today = Utils.today(), past = Utils.nDaysAgo(today, 10);
                    const dynamicFilter = { applyDateStart: batchPayload.applyDateStart || Utils.formatDateApi(past), applyDateEnd: batchPayload.applyDateEnd || Utils.formatDateApi(today) };
                    const caseList = await ApiService.fetchBatchCases({ ...batchPayload, ...dynamicFilter });
                    UIManager.Progress.hide();
                    const res = await UIModules.CaseListView.show({ header: '批次查詢與派件', caseList });
                    if (res.action === '_next_step_') {
                        const res2 = await UIModules.PersonnelSelectDialog.show({ selectedCount: res.selectedCases.length, mode: 'batch', onBack: () => batchFlow(true) });
                        if (res2.action === '_confirm_assignment_') { if (!confirm(`準備將 ${res.selectedCases.length} 筆案件指派給【${res2.assignee}】？`)) { UIManager.Toast.show('操作已取消', 'info'); return modeSelector(); } UIManager.Progress.show('執行派件中…'); await ApiService.manualAssign(res.selectedCases, res2.assignee); UIManager.Progress.hide(); await UIModules.SuccessDialog.show({ assignee: res2.assignee, cases: res.selectedCases }); modeSelector(); }
                    } else if (res.action === '_back_to_mode_') modeSelector();
                } catch (e) {
                    UIManager.Progress.hide(); if (e.name === 'AbortError') return;
                    const res = await UIModules.ErrorDialog.show({ error: e, onRetry: () => batchFlow(keepState) });
                    if (res.action === '_back_to_mode_') modeSelector();
                } finally { AppState.set('isLoading', false); }
            }
            async function modeSelector() { UIManager.Modal.close(); AppState.clearSession(); const res = await UIModules.ModeDialog.show(); switch (res.action) { case 'personal': await personalFlow(); break; case 'batch': await batchFlow(); break; case '_change_token_': await tokenDialog(true); break; case '_edit_presets_': await presetDialog(); break; } }
            async function presetDialog() { const res = await UIModules.PresetDialog.show(); if (res.action === '_saved_' || res.action === '_back_') modeSelector(); }
            async function tokenDialog(isChange = false) {
                if (AppState.get('isLoading')) { UIManager.Toast.show('操作進行中，請稍候...', 'warning'); return; }
                if (isChange) { localStorage.removeItem(AppConfig.TOKEN_KEY); AppState.set({ userToken: null }); }
                const res = await UIModules.TokenDialog.show(isChange);
                if (res.action === '_confirm_') { AppState.set({ userToken: res.value }); localStorage.setItem(AppConfig.TOKEN_KEY, res.value); UIManager.Toast.show('Token 已儲存', 'success'); await Utils.sleep(400); modeSelector(); } else if (res.action === '_retry_autocheck_') autoToken();
            }
            async function autoToken() {
                if (AppState.get('isLoading')) { UIManager.Toast.show('操作進行中，請稍候...', 'warning'); return; }
                AppState.set('isLoading', true);
                UIManager.Progress.show('正在自動檢測 Token...');
                try {
                    await Utils.sleep(260); if (AppState.get('abortController')?.signal.aborted) return;
                    const token = Utils.getStoredToken(); UIManager.Progress.hide();
                    if (token) { AppState.set({ userToken: token }); UIManager.Toast.show('已自動載入 Token', 'success'); await Utils.sleep(400); modeSelector(); } else { const res = await UIModules.TokenDialog.show(true); if (res.action === '_confirm_') { AppState.set({ userToken: res.value }); localStorage.setItem(AppConfig.TOKEN_KEY, res.value); UIManager.Toast.show('Token 已儲存', 'success'); await Utils.sleep(400); modeSelector(); } }
                } catch (e) { UIManager.Progress.hide(); UIManager.Toast.show(`自動檢測發生錯誤: ${e.message}`, 'error');
                } finally { AppState.set('isLoading', false); }
            }
            return { init: () => { UIManager.injectStyle(); autoToken(); } };
        })();

        // === 9. 啟動程式 ===
        (function startApp() {
            document.querySelectorAll(`#${AppConfig.TOOL_CONTAINER_ID}, #${AppConfig.STYLE_ELEMENT_ID}, .dispatch-toast, #dispatch-mask, #dispatch-progress`).forEach(el => el.remove());
            AppMain.init();
        })();

    } catch (error) {
        console.error("多功能派件整合工具啟動失敗:", error);
        const escapeHtmlFallback = (str) => (str.message || String(str)).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]);
        const errorHtml = `<div style="position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(220,53,69,0.9);color:white;padding:15px 25px;border-radius:8px;font-family:sans-serif;font-size:16px;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><b>工具啟動失敗</b><br><p style="margin-top:10px;font-size:14px;">請按 F12 打開開發者工具，查看 console 中的詳細錯誤訊息。</p><pre style="margin-top:10px;background:rgba(0,0,0,0.2);padding:5px;border-radius:4px;">${escapeHtmlFallback(error)}</pre></div>`;
        document.body.insertAdjacentHTML('beforeend', errorHtml);
    }
})();