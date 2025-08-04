javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * 書籤小工具 - 多功能派件整合版 v9.2.1 (錯誤修正版)
     * =================================================================================
     * v9.2.1 更新日誌:
     * - 緊急修復：修正了因模組化後，主流程 (Main) 呼叫 UI 元件 (UIComponents)
     * 時未加前綴，導致 'is not defined' 的嚴重錯誤。
     * =================================================================================
     */

    /**
     * @module Config
     */
    const Config = Object.freeze({
        VERSION: '9.2.1-hotfix',
        TOOL_ID: 'pct-multifunction-tool-container-v92',
        STYLE_ID: 'pct-multifunction-tool-styles-v92',
        TOKEN_STORAGE_KEY: 'euisToken',
        PRESETS_STORAGE_KEY: 'pctToolPresets_v3',
        API_ENDPOINTS: {
            queryPersonalCases: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
            findProposalDispatch: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        },
        DEFAULT_PERSONNEL_PERSONAL: [ 'chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu', 'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu' ].sort(),
        DEFAULT_PERSONNEL_BATCH: [ 'chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu', 'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu' ].sort(),
        SPECIAL_PERSONNEL: ['chenjui.chang', 'peiyi.wu'],
        DEFAULT_PERSONAL_PAYLOAD: { applyNumber: "", policyNumber: "", mainStatus: "", subStatus: "", hint: "", ownerName: "", insuredName: "", firstBillingMethod: "", planCodeName: "", planCode: "", applyDateStart: "", applyDateEnd: "", agencyCodeName: "", replyEstimatedCompletionDateStart: "", replyEstimatedCompletionDateEnd: "", channel: "", caseLabelings: [], productLabelings: [] },
        DEFAULT_BATCH_PAYLOAD: { applyNumber: "", policyNumber: "", org: "", poolOrg: "", uwLevels: [], poolUwLevels: [], caseLabelings: [], productLabelings: [], polpln: "", mainStatus: "2", subStatus: "", channel: "", agencyCode: "", uwApprover: null, currentOwner: null, firstBillingMethod: "", hint: "", ownerTaxId: "", ownerName: "", insuredTaxId: "", insuredName: "", applyDateStart: "", applyDateEnd: "", confrmno: "", currency: "", firstPaymentPremiumFlag: "" },
        NON_EDITABLE_PRESETS: ["pageIndex", "size", "orderBys"],
        BATCH_CONFIG: { pageSize: 50 },
        ZINDEX: { NOTIFY: 2147483647, OVERLAY: 2147483640, MAIN_MODAL: 2147483641 }
    });

    /**
     * @module GlobalState
     */
    const GlobalState = (() => {
        const state = { token: null, modalPosition: { top: null, left: null }, allPersonalCases: [], allBatchCases: [], abortController: null, viewState: {} };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => { if (typeof k === 'object') { Object.assign(state, k); } else { state[k] = v; } },
            clearSessionState: () => { state.allPersonalCases = []; state.allBatchCases = []; state.viewState = {}; },
            createAbortController: () => { state.abortController = new AbortController(); return state.abortController.signal; },
            abortCurrentRequest: () => { state.abortController?.abort(); state.abortController = null; }
        };
    })();

    /**
     * @module Utils
     */
    const Utils = (() => {
        return {
            escapeHtml: (str) => { if (str === null || str === undefined) return ''; const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return String(str).replace(/[&<>"']/g, m => map[m]); },
            findStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(Config.TOKEN_STORAGE_KEY)).find(t => t && t.trim()) || null,
            splitInput: (text) => text.split(/[\s,，\n]+/).map(s => s.trim()).filter(Boolean),
            sleep: (ms) => new Promise(res => setTimeout(res, ms)),
            readTextFile: () => new Promise((resolve, reject) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.txt'; i.onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => reject(new Error("讀取檔案失敗")); r.readAsText(f); } else { reject(new Error("未選擇任何檔案")); } }; i.click(); }),
            jsonToCsv: (items, headers) => { const headerKeys = Object.keys(headers); const csvRows = items.map(row => headerKeys.map(key => JSON.stringify(row[key] === null ? '' : row[key])).join(',')); return [Object.values(headers).map(h => h.label).join(','), ...csvRows].join('\r\n'); },
            downloadCsv: (csvContent, filename) => { const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); },
            formatDateForDisplay: (dateString) => (dateString && typeof dateString === 'string') ? dateString.split(' ')[0] : '',
            formatDateForApi: (date) => { if (!date) return ""; const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d} 00:00:00`; },
            getTodayDate: () => new Date(),
            getDateBefore: (date, days) => new Date(date.getTime() - (days * 24 * 60 * 60 * 1000)),
            debounce: (func, delay) => { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; }
        };
    })();

    /**
     * @module UI
     */
    const UI = (() => {
        function injectStyle() {
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style'); style.id = Config.STYLE_ID;
            style.textContent = `
                :root { --primary-color: #007bff; --primary-dark-color: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
                .pct-modal-mask { position: fixed; z-index: ${Config.ZINDEX.OVERLAY}; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.25s ease-out; display: flex; align-items: center; justify-content: center; }
                .pct-modal-mask.show { opacity: 1; }
                .pct-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #FFFFFF; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); padding: 0; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: ${Config.ZINDEX.MAIN_MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity 0.2s ease-out; max-height: 90vh; max-width: 95vw; box-sizing: border-box; }
                .pct-modal.show-init { opacity: 1; } .pct-modal.dragging { transition: none !important; }
                .pct-modal-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; flex-shrink: 0; text-align: center; }
                .pct-modal-close-btn { position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 28px; font-weight: bold; color: var(--secondary-color); cursor: pointer; width: 36px; height: 36px; border-radius: 50%; transition: all .2s; display: flex; align-items: center; justify-content: center; line-height: 1; }
                .pct-modal-close-btn:hover { background-color: #f0f0f0; color: #333; transform: rotate(90deg) scale(1.1); }
                .pct-modal-body { padding: 16px 20px; flex-grow: 1; overflow-y: auto; min-height: 50px; }
                .pct-modal-footer { padding: 12px 20px 16px 20px; border-top: 1px solid #E0E0E0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
                .pct-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; font-size: 15px; border-radius: 6px; border: 1px solid transparent; background: var(--primary-color); color: #fff; cursor: pointer; transition: all 0.25s ease-in-out; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .pct-btn:not([disabled]):hover { background: var(--primary-dark-color); transform: translateY(-2px); }
                .pct-btn[disabled] { background-color: #d6d6d6; cursor: not-allowed; }
                .pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
                .pct-btn.pct-btn-outline:not([disabled]):hover { background-color: #F8F8F8; }
                .pct-btn.pct-btn-small { padding: 4px 10px; font-size: 13px; }
                .pct-input, textarea.pct-input, select.pct-input { width: 100%; font-size: 14px; padding: 8px 12px; border-radius: 5px; box-sizing: border-box; border: 1px solid #E0E0E0; margin-top: 5px; background-color: #fff; }
                .pct-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(0,123,255,.25); outline: none; }
                .pct-toast { position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 22px; border-radius: 6px; font-size: 16px; z-index: ${Config.ZINDEX.NOTIFY}; opacity: 0; transition: all .3s; }
                .pct-toast.show { opacity: 1; }
                .pct-progress-overlay { position: fixed; inset: 0; background-color: rgba(255, 255, 255, 0.8); z-index: ${Config.ZINDEX.NOTIFY}; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #333; font-size: 1.2rem; font-weight: bold; }
                .pct-progress-overlay button { margin-top: 20px; }
                .pct-filter-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; background-color: #f9f9f9; }
                .pct-filter-form div { display: flex; flex-direction: column; } .pct-filter-form label { font-size: 13px; margin-bottom: 2px; }
                .pct-table-container { overflow: auto; max-height: calc(85vh - 350px); position: relative; }
                .pct-table-scroll-content { position: absolute; top: 0; left: 0; width: 100%; }
                .pct-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                .pct-table th, .pct-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
                .pct-table th { background-color: #f8f9fa; position: sticky; top: -1px; z-index: 1; }
                .pct-table td { cursor: cell; }
                .pct-table th.sortable { cursor: pointer; user-select: none; } .pct-table th.sortable:hover { background-color: #e9ecef; }
                .pct-table th .sort-arrow { display: inline-block; width: 1em; text-align: center; }
                .pct-view-toggle { margin-bottom: 15px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
                .pct-view-toggle button { background: #f0f0f0; border: 1px solid #ccc; padding: 8px 15px; cursor: pointer; font-size:14px; }
                .pct-view-toggle button.active { background: #fff; border-bottom-color: #fff; font-weight: bold; color: var(--primary-color); }
                .pct-view-pane { display: none; } .pct-view-pane.active { display: block; }
                fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin-top: 15px; }
                legend { font-weight: bold; padding: 0 10px; }
                .pct-help-btn { position: absolute; top: 15px; left: 15px; font-size: 18px; width: 30px; height: 30px; padding: 0; border-radius: 50%; background: #f0f0f0; color: #555; border: 1px solid #ccc; }
            `;
            document.head.appendChild(style);
        }
        const Toast = { show: (msg, type = 'success', duration = 2000) => { document.querySelector('.pct-toast')?.remove(); const t = document.createElement('div'); t.className = `pct-toast ${type}`; t.textContent = msg; t.style.backgroundColor = `var(--${type}-color)`; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show')); if (duration > 0) setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => t.remove(), { once: true }); }, duration); } };
        const Progress = {
            show(txt) { this.hide(); const p = document.createElement('div'); p.id = 'pctProgress'; p.className = 'pct-progress-overlay'; p.innerHTML = `<div>${Utils.escapeHtml(txt)}</div><button id="stop-query-btn" class="pct-btn pct-btn-outline">停止查詢</button>`; document.body.appendChild(p); document.getElementById('stop-query-btn').onclick = () => { GlobalState.abortCurrentRequest(); this.hide(); UI.Toast.show('查詢已中斷', 'warning'); }; },
            update(pct, txt) { const p = document.getElementById('pctProgress'); if (p) { const textDiv = p.querySelector('div:first-child'); if (textDiv) textDiv.innerHTML = `<div>${Utils.escapeHtml(txt)}</div><div style="margin-top:10px;">進度: ${pct}%</div>`; } },
            hide() { document.getElementById('pctProgress')?.remove(); }
        };
        const Modal = {
            close() { const m = document.getElementById(Config.TOOL_ID); if (m) GlobalState.set({ modalPosition: { top: m.style.top, left: m.style.left } }); GlobalState.abortCurrentRequest(); document.getElementById('pctModalMask')?.remove(); m?.remove(); document.removeEventListener('keydown', EventHandlers.handleEscKey); GlobalState.clearSessionState(); },
            show(opts) {
                return new Promise(resolve => {
                    this.close(); const { top, left } = GlobalState.get('modalPosition');
                    const mask = document.createElement('div'); mask.id = 'pctModalMask'; mask.className = 'pct-modal-mask'; document.body.appendChild(mask); requestAnimationFrame(() => mask.classList.add('show'));
                    const modal = document.createElement('div'); modal.id = Config.TOOL_ID; modal.className = 'pct-modal';
                    modal.style.width = opts.width || 'auto';
                    modal.innerHTML = `<div class="pct-modal-header">${opts.header}<button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body">${opts.body}</div><div class="pct-modal-footer">${opts.footer}</div>`;
                    if (top && left) { modal.style.top = top; modal.style.left = left; modal.style.transform = 'none'; }
                    document.body.appendChild(modal); requestAnimationFrame(() => modal.classList.add('show-init'));
                    const closeAndResolve = (action) => { this.close(); resolve({ action }); };
                    modal.querySelector('.pct-modal-header').addEventListener('mousedown', EventHandlers.dragMouseDown);
                    modal.querySelector('.pct-modal-close-btn').addEventListener('click', () => closeAndResolve('_close_tool_'));
                    EventHandlers.setupGlobalKeyListener();
                    if (opts.onOpen) opts.onOpen(modal, resolve);
                });
            }
        };
        return { injectStyle, Toast, Progress, Modal };
    })();

    /**
     * @module EventHandlers
     */
    const EventHandlers = (() => { const d = { iD: false, sX: 0, sY: 0, iL: 0, iT: 0 }; function dragMD(e) { const m = document.getElementById(Config.TOOL_ID); if (!m || e.target.closest('.pct-modal-close-btn')) return; e.preventDefault(); d.iD = true; m.classList.add('dragging'); const r = m.getBoundingClientRect(); d.sX = e.clientX; d.sY = e.clientY; d.iL = r.left; d.iT = r.top; document.addEventListener('mousemove', dragEl); document.addEventListener('mouseup', closeDragEl); } function dragEl(e) { if (!d.iD) return; e.preventDefault(); const m = document.getElementById(Config.TOOL_ID); if (!m) return; m.style.left = `${d.iL + e.clientX - d.sX}px`; m.style.top = `${d.iT + e.clientY - d.sY}px`; m.style.transform = 'none'; } function closeDragEl() { d.iD = false; document.getElementById(Config.TOOL_ID)?.classList.remove('dragging'); document.removeEventListener('mousemove', dragEl); document.removeEventListener('mouseup', closeDragEl); } function escKey(e) { if (e.key === 'Escape') UI.Modal.close(); } function setupKeys() { document.removeEventListener('keydown', escKey); document.addEventListener('keydown', escKey); } return { dragMouseDown: dragMD, handleEscKey: escKey, setupGlobalKeyListener: setupKeys }; })();

    /**
     * @module DataService
     */
    const DataService = (() => {
        async function baseFetch(url, options) { const token = GlobalState.get('token'); if (!token) throw new Error('TOKEN不存在'); options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' }; options.signal = GlobalState.get('abortController')?.signal; const response = await fetch(url, options); if (response.status === 401 || response.status === 403) throw new Error('TOKEN無效或已過期'); if (!response.ok) { const err = new Error(`伺服器錯誤_${response.status}`); try { err.data = await response.json(); } catch (e) { err.data = await response.text(); } throw err; } return response.json(); }
        async function fetchPaginated(endpoint, payload, title) { let all = [], page = 1, total = 1; while (page <= total) { const pagePayload = { ...payload, pageIndex: page, size: Config.BATCH_CONFIG.pageSize }; UI.Progress.update(total > 1 ? Math.round(100 * page / total) : 50, `載入${title} 第 ${page} / ${total === 1 ? '?' : total} 頁...`); const res = await baseFetch(endpoint, { method: 'POST', body: JSON.stringify(pagePayload) }); if (res?.records?.length > 0) { all = all.concat(res.records); if (page === 1 && res.total) { total = Math.ceil(res.total / Config.BATCH_CONFIG.pageSize); } } else { break; } page++; } return all; }
        return {
            queryAllPersonalCases: (filters) => fetchPaginated(Config.API_ENDPOINTS.queryPersonalCases, filters, '個人案件'),
            queryAllBatchCases: (filters) => fetchPaginated(Config.API_ENDPOINTS.findProposalDispatch, filters, '批次案件'),
            assignManually: (applyNumbers, auditor) => baseFetch(Config.API_ENDPOINTS.assignManually, { method: 'POST', body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: auditor, dispatchOrgBf: "", applyNumbers }) })
        };
    })();

    /**
     * @module UIComponents
     */
    const UIComponents = (() => {
        const DISPLAY_HEADERS = { 'seq': { label: '序號', type: 'number' }, 'applyNumber': { label: '受理號碼', type: 'string' }, 'policyNumber': { label: '保單號碼', type: 'string' }, 'ownerName': { label: '要保人', type: 'string' }, 'insuredName': { label: '被保人', type: 'string' }, 'mainStatus': { label: '主狀態', type: 'string' }, 'subStatus': { label: '次狀態', type: 'string' }, 'currentOwner': { label: '目前處理人', type: 'string' }, 'channel': { label: '業務來源', type: 'string' }, 'applyDate': { label: '要保日', type: 'date' }, 'polpln': { label: '險種代碼', type: 'string' }, 'agencyCode': { label: '送件單位代碼', type: 'string' } };
        const EXPORT_HEADERS = { 'seq': { label: '序號', type: 'number' }, 'applyNumber': { label: '受理號碼', type: 'string' }, 'policyNumber': { label: '保單號碼', type: 'string' }, 'ownerName': { label: '要保人', type: 'string' }, 'insuredName': { label: '被保人', type: 'string' }, 'mainStatus': { label: '主狀態', type: 'string' }, 'subStatus': { label: '次狀態', type: 'string' }, 'currentOwner': { label: '目前處理人', type: 'string' }, 'channel': { label: '業務來源', type: 'string' }, 'applyDate': { label: '要保日', type: 'date' }, 'polpln': { label: '險種代碼', type: 'string' }, 'planCodeName': { label: '險種名稱', type: 'string' }, 'caseLabelInfo': { label: '案件標籤', type: 'string' }, 'productLabelInfo': { label: '商品標籤', type: 'string' }, 'dispatchOrPickUpDate': { label: '派件日', type: 'date' }, 'firstAuditDate': { label: '首審日', type: 'date' }, 'totalPremium': { label: '總保費', type: 'number' }, 'firstBillingMethod': { label: '首期繳費方式', type: 'string' }, 'agencyCode': { label: '送件單位代碼', type: 'string' }, 'jetCase': { label: '速件', type: 'string' }, 'highRiskFlag': { label: '高風險', type: 'string' }, 'hintAml': { label: 'AML', type: 'string' }, 'hintFollowingCase': { label: '跟催件', type: 'string' }, 'uwLevel': { label: '核保層級', type: 'string' }, 'org': { label: 'ORG', type: 'string' }, 'poolOrg': { label: 'POOL ORG', type: 'string' }};
        const PERSONAL_FILTER_FIELDS = [ {n:'applyNumber',l:'受理號碼'}, {n:'policyNumber',l:'保單號碼'}, {n:'name',l:'姓名(要/被保人)'}, {n:'channel',l:'業務來源'} ];
        const BATCH_FILTER_FIELDS = [ {n:'applyNumber',l:'受理號碼'},{n:'policyNumber',l:'保單號碼'},{n:'ownerName',l:'要保人姓名'},{n:'ownerTaxId',l:'要保人ID'},{n:'insuredName',l:'被保人姓名'},{n:'insuredTaxId',l:'被保人ID'},{n:'mainStatus',l:'主狀態'},{n:'poolOrg',l:'POOL ORG'},{n:'polpln',l:'險種代碼'},{n:'channel',l:'業務來源'},{n:'applyDateStart',l:'要保日(起)',t:'date'},{n:'applyDateEnd',l:'要保日(迄)',t:'date'} ];

        function createCaseListView(options) {
            const { header, allCases, filterFields, displayHeaders, exportHeaders, defaultFilterFn, onBack } = options;
            return UI.Modal.show({
                header, width: '95vw',
                body: `<button class="pct-help-btn">?</button><div class="pct-view-toggle"><button class="pct-view-btn active" data-view="query">查詢案件</button><button class="pct-view-btn" data-view="manual">手動輸入</button></div><div id="query-pane" class="pct-view-pane active"><div class="pct-filter-form">${filterFields.map(f=>`<div><label>${f.l}</label><input name="${f.n}" type="${f.t||'text'}" class="pct-input"></div>`).join('')}</div><div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 15px;"><div><button id="b-fc" class="pct-btn pct-btn-outline">清除條件</button></div><button id="b-ex" class="pct-btn">匯出 Excel (CSV)</button></div><div class="pct-table-container"><div class="pct-table-scroll-content"><table><thead><tr><th style="width:40px;"><input type="checkbox" id="select-all-checkbox"></th>${Object.entries(displayHeaders).map(([k,v])=>`<th class="sortable" data-sort-key="${k}" data-sort-type="${v.type}">${v.label}<span class="sort-arrow"></span></th>`).join('')}</tr></thead><tbody></tbody></table></div></div></div><div id="manual-pane" class="pct-view-pane"><h4>受理號碼列表 (手動輸入)</h4><div style="display:flex; gap:10px;"><textarea id="b-nums" class="pct-input" rows="15" placeholder="請在此貼上或匯入受理號碼..."></textarea><button id="imp-b" class="pct-btn pct-btn-small" style="align-self: flex-start;">匯入</button></div></div>`,
                footer: `<div id="pct-selection-info"></div><button id="b-back" class="pct-btn pct-btn-outline">返回主選單</button><button id="next-btn" class="pct-btn" disabled>下一步</button>`,
                onOpen: (m,r) => {
                    const viewBtns=m.querySelectorAll('.pct-view-btn'), panes={query:m.querySelector('#query-pane'),manual:m.querySelector('#manual-pane')}; let activeView='query';
                    const filterInputs={}; m.querySelectorAll('.pct-filter-form .pct-input').forEach(i=>filterInputs[i.name]=i);
                    const tbody=m.querySelector('tbody'), thead=m.querySelector('thead'), infoEl=m.querySelector('#pct-selection-info'), nextBtn=m.querySelector('#next-btn'), manualTextarea=m.querySelector('#b-nums'), tableContainer = m.querySelector('.pct-table-container'), scrollContent = m.querySelector('.pct-table-scroll-content');
                    let sortedCases = [], filteredCases = [];

                    const updateSelection = () => { let count=0,total=allCases.length,visible=filteredCases.length;if(activeView==='query'){const chk=[...tbody.querySelectorAll('input[type=checkbox]')].filter(cb=>cb.checked);count=chk.length;}else{count=Utils.splitInput(manualTextarea.value).length;visible=count;}infoEl.textContent=activeView==='query'?`總 ${total} 筆，顯示 ${visible} 筆，已選 ${count} 筆`:`手動輸入 ${count} 筆`;nextBtn.disabled=count===0; };
                    const renderVirtualScroll = () => { const rowHeight = 33; const visibleRows = Math.ceil(tableContainer.clientHeight / rowHeight) + 4; scrollContent.style.height = `${sortedCases.length * rowHeight}px`; let lastRenderedStart = -1; const render = () => { const scrollTop = tableContainer.scrollTop; const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2); if (startIndex === lastRenderedStart) return; lastRenderedStart = startIndex; const endIndex = Math.min(sortedCases.length, startIndex + visibleRows); tbody.innerHTML = sortedCases.slice(startIndex, endIndex).map((c, i) => { const originalIndex = startIndex + i; const rowId = allCases.indexOf(c); return `<tr data-row-id="${rowId}" style="position:absolute; top:${originalIndex * rowHeight}px; width:100%; left:0;"><td><input type="checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td>${Object.keys(displayHeaders).map(key => `<td title="${Utils.escapeHtml(c[key] || '')}">${Utils.escapeHtml((key === 'seq') ? originalIndex + 1 : (key === 'applyDate' ? Utils.formatDateForDisplay(c[key]) : (c[key] || '')))}</td>`).join('')}</tr>`; }).join(''); }; tableContainer.onscroll = render; render(); };
                    const applyFilters = () => { const filters = {}; Object.entries(filterInputs).forEach(([k, i]) => { if (i.value) filters[k] = i.value; }); filteredCases = allCases.filter(c => Object.entries(filters).every(([key, value]) => { if (key.endsWith('Start')) return new Date(c.applyDate) >= new Date(value); if (key.endsWith('End')) return new Date(c.applyDate) <= new Date(value); if (key === 'name') return (c.ownerName || '').toLowerCase().includes(value.toLowerCase()) || (c.insuredName || '').toLowerCase().includes(value.toLowerCase()); return String(c[key] || '').toLowerCase().includes(String(value).toLowerCase()); })); sortedCases = [...filteredCases]; renderVirtualScroll(); updateSelection(); };
                    const debouncedFilter = Utils.debounce(applyFilters, 300);
                    
                    Object.values(filterInputs).forEach(input => input.addEventListener('input', debouncedFilter));
                    viewBtns.forEach(btn=>btn.addEventListener('click',()=>{const view=btn.dataset.view;if(view===activeView)return;activeView=view;viewBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===view));Object.values(panes).forEach(p=>p.classList.toggle('active',p.id.startsWith(view)));updateSelection();}));
                    m.querySelector('#b-ex').addEventListener('click',()=>{const visData=sortedCases.map((c,idx)=>({...c,seq:idx+1}));if(visData.length===0)return UI.Toast.show('沒有可匯出的資料','warning');const csv=Utils.jsonToCsv(visData,exportHeaders);Utils.downloadCsv(csv,`${header}_${Utils.formatDateForDisplay(new Date().toISOString())}.csv`);});
                    m.querySelector('#b-fc').addEventListener('click',()=>{Object.values(filterInputs).forEach(i=>i.value='');let initialData=allCases;if(defaultFilterFn){initialData=allCases.filter(defaultFilterFn);}filteredCases=initialData;sortedCases=[...initialData];renderVirtualScroll();updateSelection();});
                    tbody.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]'))updateSelection();});
                    m.querySelector('#select-all-checkbox').addEventListener('change',e=>{const isChecked=e.target.checked;tbody.querySelectorAll('input[type=checkbox]').forEach(cb=>{if(cb)cb.checked=isChecked;});updateSelection();});
                    tbody.addEventListener('click',e=>{if(e.target.tagName==='TD'){navigator.clipboard.writeText(e.target.textContent).then(()=>UI.Toast.show(`已複製: ${e.target.textContent}`)).catch(()=>UI.Toast.show('複製失敗','error'));}});
                    thead.addEventListener('click',e=>{const header=e.target.closest('.sortable');if(!header)return;const key=header.dataset.sortKey;const type=header.dataset.sortType;const newDir=(header.dataset.sortDir||'desc')==='asc'?'desc':'asc';sortedCases.sort((a,b)=>{let vA=a[key]||'',vB=b[key]||'';if(type==='number'){vA=parseFloat(vA)||0;vB=parseFloat(vB)||0;}else if(type==='date'){vA=new Date(vA).getTime()||0;vB=new Date(vB).getTime()||0;}if(vA<vB)return newDir==='asc'?-1:1;if(vA>vB)return newDir==='asc'?1:-1;return 0;});renderVirtualScroll();thead.querySelectorAll('.sortable').forEach(th=>{th.dataset.sortDir='';th.querySelector('.sort-arrow').textContent='';});header.dataset.sortDir=newDir;header.querySelector('.sort-arrow').textContent=newDir==='asc'?'▲':'▼';});
                    m.querySelector('#imp-b').addEventListener('click',async()=>{try{manualTextarea.value=await Utils.readTextFile();updateSelection();UI.Toast.show(`成功匯入`,'success');}catch(e){UI.Toast.show(e.message,'error');}});
                    manualTextarea.addEventListener('input',updateSelection);
                    m.querySelector('#b-back').addEventListener('click', () => r({ action: '_back_to_mode_' }));
                    nextBtn.addEventListener('click',()=>{const selectedCases=activeView==='query'?[...tbody.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value):Utils.splitInput(manualTextarea.value);if(selectedCases.length===0)return UI.Toast.show('請選擇或輸入案件','error');GlobalState.set({viewState: {filters: Object.fromEntries(Object.entries(filterInputs).map(([k,v])=>[k,v.value])),sort:{key:thead.querySelector('[data-sort-dir]')?.dataset.sortKey,dir:thead.querySelector('[data-sort-dir]')?.dataset.sortDir}}});r({action:'_next_step_',selectedCases});});
                    m.querySelector('.pct-help-btn').addEventListener('click', () => alert('功能說明：\n1. 查詢案件：上方為篩選區，輸入條件後會即時篩選下方列表。\n2. 手動輸入：切換至此頁面可直接貼上或匯入受理號碼。\n3. 列表功能：點擊欄位標題可排序，點擊儲存格可複製內容。\n4. 狀態保持：從派件人選擇返回時，會保留您的篩選和排序狀態。'));
                    
                    const savedState = GlobalState.get('viewState');
                    if (savedState.filters) { Object.entries(savedState.filters).forEach(([k,v]) => { if(filterInputs[k]) filterInputs[k].value = v; }); applyFilters(); if (savedState.sort?.key) { const headerToSort = thead.querySelector(`[data-sort-key="${savedState.sort.key}"]`); if(headerToSort) { headerToSort.dataset.sortDir = savedState.sort.dir === 'asc' ? 'desc' : 'asc'; headerToSort.click(); } } } else { let initialData=allCases;if(defaultFilterFn){initialData=allCases.filter(defaultFilterFn);}filteredCases=initialData;sortedCases=[...initialData];renderVirtualScroll();updateSelection(); }
                }
            });
        }
        
        return {
            showTokenDialog: (retry) => UI.Modal.show({ header: `Token 設定`, width: '500px', body: `${retry ? `<div style="text-align:center; margin-bottom: 15px;"><button id="pct-retry-token" class="pct-btn pct-btn-outline">🔄 重新自動檢測</button></div>` : ''}<label for="pct-token-input">請貼上您的 SSO-TOKEN：</label><textarea id="pct-token-input" class="pct-input" rows="4">${Utils.escapeHtml(GlobalState.get('token') || '')}</textarea>`, footer: `<button id="pct-confirm-token" class="pct-btn">儲存並繼續</button>`, onOpen: (m, r) => { const i = m.querySelector('#pct-token-input'); const h = () => { const v = i.value.trim(); if (!v) return UI.Toast.show('請輸入 TOKEN', 'error'); r({ action: '_confirm_', value: v }); }; m.querySelector('#pct-confirm-token').addEventListener('click', h); m.querySelector('#pct-retry-token')?.addEventListener('click', () => r({ action: '_retry_autocheck_' })); i.focus(); } }),
            showModeSelectDialog: () => UI.Modal.show({ header: `選擇工作模式`, width: '400px', body: `<p style="text-align:center; margin-bottom:20px;">請選擇您要使用的功能：</p><div style="display:flex; flex-direction:column; gap:15px;"><button id="mode-personal" class="pct-btn">個人案件查詢與派發</button><button id="mode-batch" class="pct-btn">批次查詢與派件</button></div>`, footer: `<span>版本: ${Config.VERSION}</span><button id="presets-editor" class="pct-btn pct-btn-outline">修改預設載入</button><button id="change-token" class="pct-btn pct-btn-outline">變更 Token</button>`, onOpen: (m, r) => { m.querySelector('#mode-personal').addEventListener('click', () => r({ action: 'personal' })); m.querySelector('#mode-batch').addEventListener('click', () => r({ action: 'batch' })); m.querySelector('#change-token').addEventListener('click', () => r({ action: '_change_token_' })); m.querySelector('#presets-editor').addEventListener('click', () => r({ action: '_edit_presets_' })); } }),
            showPersonnelSelectDialog: (opts) => UI.Modal.show({ header: '選擇派件人員', width: '600px', body: `<p>您已選擇 <strong>${opts.selectedCount}</strong> 筆案件進行派件。</p><div style="margin-top: 1rem;"><label for="p-sel">指派對象</label><div class="pct-input-group"><select id="p-sel" class="pct-input"></select><button id="imp-p" class="pct-btn pct-btn-small">匯入人員</button></div></div><div style="margin-top: 1rem;"><label><input type="checkbox" id="m-chk"> 或手動輸入帳號</label><input type="text" id="m-in" class="pct-input" placeholder="請輸入完整的 AD 帳號" style="display:none;"></div>`, footer: `<button id="b-back" class="pct-btn pct-btn-outline">返回</button><button id="b-conf" class="pct-btn" disabled>確認派件</button>`, onOpen: (m, r) => { const s = m.querySelector('#p-sel'), mc = m.querySelector('#m-chk'), mi = m.querySelector('#m-in'), cf = m.querySelector('#b-conf'); const defaultList = opts.mode === 'batch' ? Config.DEFAULT_PERSONNEL_BATCH : Config.DEFAULT_PERSONNEL_PERSONAL; const regular = defaultList.filter(p => !Config.SPECIAL_PERSONNEL.includes(p)); const special = defaultList.filter(p => Config.SPECIAL_PERSONNEL.includes(p)); let pList = opts.mode === 'batch' ? [...special, ...regular] : [...regular, ...special]; const pop = () => { s.innerHTML = pList.map(p => `<option value="${Utils.escapeHtml(p)}" ${Config.SPECIAL_PERSONNEL.includes(p) ? 'style="background-color: #FFFFE0;"' : ''}>${Utils.escapeHtml(p)}</option>`).join(''); }; const upd = () => { cf.disabled = !(mc.checked ? mi.value.trim() !== '' : s.value); }; m.querySelector('#imp-p').addEventListener('click', async () => { try { const txt = await Utils.readTextFile(); const imp = Utils.splitInput(txt); if (imp.length > 0) { const combined = Array.from(new Set([...pList, ...imp])).sort(); const regularNew = combined.filter(p => !Config.SPECIAL_PERSONNEL.includes(p)); const specialNew = combined.filter(p => Config.SPECIAL_PERSONNEL.includes(p)); pList = opts.mode === 'batch' ? [...specialNew, ...regularNew] : [...regularNew, ...specialNew]; pop(); UI.Toast.show(`成功匯入 ${imp.length} 位人員`, 'success'); } } catch (e) { UI.Toast.show(e.message, 'error'); } }); mc.addEventListener('change', () => { const chk = mc.checked; mi.style.display = chk ? 'block' : 'none'; s.disabled = chk; if (chk) mi.focus(); upd(); }); s.addEventListener('change', upd); mi.addEventListener('input', upd); m.querySelector('#b-back').addEventListener('click', opts.onBack); cf.addEventListener('click', () => { const a = mc.checked ? mi.value.trim() : s.value; if (!a) return UI.Toast.show('請選擇或輸入派件人員', 'error'); r({ action: '_confirm_assignment_', assignee: a }); }); pop(); upd(); } }),
            showPresetEditorDialog: () => UI.Modal.show({ header: '修改預設載入條件', width: '800px', body: `<p>您可以在此修改個人與批次模式的預設查詢條件。修改後將永久保存在您的瀏覽器中。</p><fieldset><legend><b>個人案件</b> 預設查詢條件</legend><div id="preset-personal" class="pct-filter-form"></div></fieldset><fieldset><legend><b>批次案件</b> 預設查詢條件</legend><div id="preset-batch" class="pct-filter-form"></div></fieldset>`, footer: `<button id="b-back" class="pct-btn pct-btn-outline">返回主選單</button><button id="save-presets" class="pct-btn">保存設定</button>`, onOpen: (m,r) => { const buildForm = (payload, container) => { container.innerHTML = Object.entries(payload).filter(([k]) => !Config.NON_EDITABLE_PRESETS.includes(k)).map(([key, value]) => `<div><label>${key}</label><input name="${key}" class="pct-input" value="${Utils.escapeHtml(Array.isArray(value) ? value.join(',') : value)}"></div>`).join(''); }; const stored = JSON.parse(localStorage.getItem(Config.PRESETS_STORAGE_KEY) || '{}'); const pContainer = m.querySelector('#preset-personal'), bContainer = m.querySelector('#preset-batch'); buildForm(stored.personal || Config.DEFAULT_PERSONAL_PAYLOAD, pContainer); buildForm(stored.batch || Config.DEFAULT_BATCH_PAYLOAD, bContainer); m.querySelector('#save-presets').addEventListener('click', () => { try { const personal = { ...Config.DEFAULT_PERSONAL_PAYLOAD }, batch = { ...Config.DEFAULT_BATCH_PAYLOAD }; m.querySelectorAll('#preset-personal .pct-input').forEach(i => { const key = i.name; personal[key] = Array.isArray(personal[key]) ? Utils.splitInput(i.value) : i.value; }); m.querySelectorAll('#preset-batch .pct-input').forEach(i => { const key = i.name; batch[key] = Array.isArray(batch[key]) ? Utils.splitInput(i.value) : i.value; }); localStorage.setItem(Config.PRESETS_STORAGE_KEY, JSON.stringify({ personal, batch })); UI.Toast.show('設定已儲存', 'success'); setTimeout(() => r({ action: '_saved_' }), 1000); } catch(e) { UI.Toast.show('儲存失敗', 'error'); } }); m.querySelector('#b-back').addEventListener('click', () => r({ action: '_back_' })); } }),
            showSuccessSummaryDialog: (details) => new Promise(resolve => { let countdown = 5, intervalId, timeoutId; const cleanupAndResolve = () => { clearInterval(intervalId); clearTimeout(timeoutId); resolve(); }; UI.Modal.show({ header: '派件成功', width: '500px', body: `<p style="margin-bottom:10px;">已成功將 <strong>${details.cases.length}</strong> 筆案件指派給：<br><strong>${Utils.escapeHtml(details.assignee)}</strong></p><p>詳細受理號碼如下：</p><textarea class="pct-input" rows="8" readonly>${details.cases.join('\n')}</textarea>`, footer: `<button id="ok-btn" class="pct-btn">確定</button>`, onOpen: (modal) => { const okBtn = modal.querySelector('#ok-btn'); const close = () => { cleanupAndResolve(); UI.Modal.close(); }; modal.querySelector('.pct-modal-close-btn').onclick = close; okBtn.onclick = close; okBtn.textContent = `確定 (${countdown})`; intervalId = setInterval(() => { countdown--; if (countdown >= 0) okBtn.textContent = `確定 (${countdown})`; }, 1000); timeoutId = setTimeout(close, 5000); } }).then(cleanupAndResolve); }),
            createCaseListView, PERSONAL_FILTER_FIELDS, BATCH_FILTER_FIELDS, DISPLAY_HEADERS, EXPORT_HEADERS
        };
    })();

    /**
     * @module Main
     * @description 主流程控制器。
     */
    const Main = (() => {
        const getPresets = () => JSON.parse(localStorage.getItem(Config.PRESETS_STORAGE_KEY) || '{}');
        
        async function startPersonalCasesFlow(keepState = false) {
            if (!keepState) GlobalState.set({viewState: {}});
            UI.Progress.show('正在載入所有個人案件...');
            GlobalState.createAbortController();
            try {
                const presets = getPresets();
                const cases = await DataService.queryAllPersonalCases(presets.personal || Config.DEFAULT_PERSONAL_PAYLOAD);
                UI.Progress.hide();
                const res = await UIComponents.createCaseListView({ header: '個人案件查詢與派發', allCases: cases, filterFields: UIComponents.PERSONAL_FILTER_FIELDS, displayHeaders: UIComponents.DISPLAY_HEADERS, exportHeaders: UIComponents.EXPORT_HEADERS, onBack: startModeSelection });
                if (res.action === '_next_step_') {
                    const res2 = await UIComponents.showPersonnelSelectDialog({ selectedCount: res.selectedCases.length, mode: 'personal', onBack: () => startPersonalCasesFlow(true) });
                    if (res2.action === '_confirm_assignment_') {
                        UI.Progress.show('執行派件中…');
                        try { await DataService.assignManually(res.selectedCases, res2.assignee); UI.Progress.hide(); await UIComponents.showSuccessSummaryDialog({ assignee: res2.assignee, cases: res.selectedCases }); startModeSelection(); } catch (e) { UI.Toast.show(`派件失敗: ${e.message}`, 'error', 5000); UI.Progress.hide(); }
                    }
                } else if (res.action === '_back_to_mode_') { startModeSelection(); }
            } catch (e) { if (e.name !== 'AbortError') UI.Toast.show(`載入案件錯誤: ${e.message}`, 'error', 5000); UI.Progress.hide(); }
        }

        async function startBatchFlow(keepState = false) {
            if (!keepState) GlobalState.set({viewState: {}});
            UI.Progress.show('正在載入批次案件...');
            GlobalState.createAbortController();
            let cases = [];
            try {
                const presets = getPresets();
                const batchPayload = presets.batch || Config.DEFAULT_BATCH_PAYLOAD;
                const today = Utils.getTodayDate(); const past = Utils.getDateBefore(today, 10);
                const dynamicFilters = { applyDateStart: Utils.formatDateForApi(past), applyDateEnd: Utils.formatDateForApi(today) };
                cases = await DataService.queryAllBatchCases({ ...batchPayload, ...dynamicFilters });
            } catch (e) {
                if (e.name !== 'AbortError') UI.Toast.show(`預設清單自動載入失敗: ${e.message}，請改用手動查詢。`, 'warning', 4000);
            }
            UI.Progress.hide();
            
            const defaultFilterFn = c => { const today = Utils.getTodayDate(); const past = Utils.getDateBefore(today, 10); return c.mainStatus == '2' && new Date(c.applyDate) >= past && new Date(c.applyDate) <= today; };
            const res = await UIComponents.createCaseListView({ header: '批次查詢與派件', allCases: cases, filterFields: UIComponents.BATCH_FILTER_FIELDS, displayHeaders: UIComponents.DISPLAY_HEADERS, exportHeaders: UIComponents.EXPORT_HEADERS, defaultFilterFn, onBack: startModeSelection });
            if (res.action === '_next_step_') {
                const res2 = await UIComponents.showPersonnelSelectDialog({ selectedCount: res.selectedCases.length, mode: 'batch', onBack: () => startBatchFlow(true) });
                if (res2.action === '_confirm_assignment_') {
                    if (!confirm(`準備將 ${res.selectedCases.length} 筆案件指派給【${res2.assignee}】？`)) { UI.Toast.show('操作已取消', 'info'); return startModeSelection(); }
                    UI.Progress.show('執行派件中…');
                    try { await DataService.assignManually(res.selectedCases, res2.assignee); UI.Progress.hide(); await UIComponents.showSuccessSummaryDialog({ assignee: res2.assignee, cases: res.selectedCases }); startModeSelection(); } catch (e) { UI.Toast.show(`派件失敗: ${e.message}`, 'error', 5000); UI.Progress.hide(); }
                }
            } else if (res.action === '_back_to_mode_') { startModeSelection(); }
        }

        async function startModeSelection() { UI.Modal.close(); const res = await UIComponents.showModeSelectDialog(); switch (res.action) { case 'personal': await startPersonalCasesFlow(); break; case 'batch': await startBatchFlow(); break; case '_change_token_': await showTokenDialogFlow(true); break; case '_edit_presets_': await showPresetEditorFlow(); break; } }
        async function showPresetEditorFlow() { const res = await UIComponents.showPresetEditorDialog(); if (res.action === '_saved_' || res.action === '_back_') { startModeSelection(); } }
        async function showTokenDialogFlow(isChanging = false) { if (isChanging) { localStorage.removeItem(Config.TOKEN_STORAGE_KEY); GlobalState.set({ token: null }); } const res = await UIComponents.showTokenDialog(!isChanging); if (res.action === '_confirm_') { GlobalState.set({ token: res.value }); localStorage.setItem(Config.TOKEN_STORAGE_KEY, res.value); UI.Toast.show('Token 已儲存', 'success'); UI.Modal.close(); await Utils.sleep(500); startModeSelection(); } else if (res.action === '_retry_autocheck_') { UI.Modal.close(); autoCheckToken(); } else { UI.Toast.show('操作已取消', 'info'); } }
        async function autoCheckToken() { UI.Progress.show('正在自動檢測 Token...'); GlobalState.createAbortController(); await Utils.sleep(300); const token = Utils.findStoredToken(); if (!GlobalState.get('abortController')?.signal.aborted) { UI.Progress.hide(); if (token) { GlobalState.set({ token }); UI.Toast.show('已自動載入 Token', 'success'); await Utils.sleep(500); startModeSelection(); } else { UI.Toast.show('未找到可用 Token，請手動輸入', 'warning'); await Utils.sleep(500); showTokenDialogFlow(false); } } }

        function initialize() {
            UI.injectStyle();
            autoCheckToken();
        }
        
        return { initialize };
    })();

    /**
     * @description 工具啟動器
     */
    (function initializeAppAndRun() {
        document.querySelectorAll(`#${Config.TOOL_ID}, #${Config.STYLE_ID}, .pct-toast, #pctModalMask, #pctProgress`).forEach(el => el.remove());
        Main.initialize();
    })();

})();
