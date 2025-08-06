javascript: (() => {
    /**
     * =================================================================================
     * 多功能派件整合 - v15.22 (人員選擇器重構版)
     * =================================================================================
     * @version     15.22.2 (Corrected)
     * @description
     * 修正了 v15.22.1 版本中因大小寫錯誤導致的依賴注入失敗問題。
     * - [修正] 在應用程式啟動區塊，將傳遞給 uiComponents 和 AppRunner 的 'Utils' 變數
     * 更正為正確的 'utils'，解決了執行時的致命錯誤。
     * =================================================================================
     */
    'use strict';

    /**
     * =========================================================================
     * I. 模組定義區 (Module Definitions)
     * =========================================================================
     */

    // === 1. 設定模組 (AppConfig) ===
    const AppConfig = (() => {
        const staticConfig = {
            VERSION: '15.22 (人員選擇器重構版)',
            TOOL_CONTAINER_ID: 'dispatch-tool-container-v15',
            STYLE_ELEMENT_ID: 'dispatch-tool-style-v15',
            TOKEN_KEY: 'euisToken',
            BATCH_PAGE_SIZE: 50,
            CONCURRENT_API_LIMIT: 5,
            DEBOUNCE_DELAY: 800,
            DEFAULT_ASSIGNEES: [
                'alex.yc.liu', 'carol.chan', 'chenjui.chang', 'jessy.fu',
                'lisa.wu', 'pearl.ho', 'peiyi.wu', 'cih.lian'
            ],
            SPECIAL_ASSIGNEES: [
                'chenjui.chang', 'peiyi.wu', 'cih.lian'
            ],
            MODAL_ACTIONS: {
                CONFIRM: 'confirm',
                SWITCH_TAB: 'switch_tab',
                NEXT_STEP: 'next_step',
                CONFIRM_ASSIGNMENT: 'confirm_assignment',
                CLOSE: 'close',
                BACK: 'back',
                RETRY: 'retry',
                CHANGE_TOKEN: 'change_token',
                OPEN_NEW_QUERY: 'open_new_query',
                APPLY_SESSION_FILTERS: 'apply_session_filters',
                RESET_AND_RELOAD: 'reset_and_reload',
                CLEAR_CACHE: 'clear_cache',
                RELOAD_VIEW: 'reload_view',
                CLOSE_QUERY_TAB: 'close_query_tab',
                MANUAL_DISPATCH: 'manual_dispatch'
            },
            ZINDEX: {
                TOAST: 2147483647,
                MASK: 2147483640,
                MODAL: 2147483641
            },
            TOOL_CONTAINER_WIDTH: '1300px',
            COLUMN_DEFINITIONS: {
                select: { label: "選取", key: "select" }, seq: { label: "序號", key: "seq" },
                applyDate: { label: "受理日", key: "applyDate", type: "date" }, applyNumber: { label: "受理號碼", key: "applyNumber" },
                policyNumber: { label: "保單號碼", key: "policyNumber" }, ownerName: { label: "要保人", key: "ownerName" },
                insuredName: { label: "主被保險人", key: "insuredName" }, mainStatus: { label: "主狀態", key: "mainStatus" },
                subStatus: { label: "次狀態", key: "subStatus" }, currency: { label: "幣別", key: "currency" },
                currentOwner: { label: "目前人員", key: "currentOwner" }, channel: { label: "業務來源", key: "channel" },
                agencyCode: { label: "送件單位代碼", key: "agencyCode" }, polpln: { label: "險種名稱", key: "polpln" },
                confrmno: { label: "確認書編號", key: "confrmno" }, lastModifiedDate: { label: "最後編輯時間", key: "lastModifiedDate", type: "date" },
                caseId: { label: "caseid", key: "caseId" }, ownerTaxId: { label: "要保人id", key: "ownerTaxId" },
                insuredTaxId: { label: "被保人id", key: "insuredTaxId" }, overpay: { label: "應繳保費", key: "overpay" },
                planCodeName: { label: "險種名稱", key: "planCodeName" }, pool: { label: "Pool", key: "pool" },
                poolStatus: { label: "Pool狀態", key: "poolStatus" }, uwLevel: { label: "核保判級", key: "uwLevel" },
                firstBillingMethod: { label: "首期繳費方式", key: "firstBillingMethod" },
                applyDateStart: { label: "受理開始日期", key: "applyDateStart" }, applyDateEnd: { label: "受理結束日期", key: "applyDateEnd" }
            },
            PERSONAL_VIEW_CONFIG: {
                type: 'personal',
                columns: ['select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currentOwner', 'polpln']
            },
            BATCH_VIEW_CONFIG: {
                type: 'batch',
                columns: [
                    'select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName',
                    'mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel',
                    'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId'
                ],
                foldedColumns: [
                    'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId'
                ]
            },
            FILTER_CONFIG: {
                personal_common: ['applyNumber', 'policyNumber', 'ownerName', 'insuredName'],
                personal_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDate', 'polpln'],
                batch_common: ['applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel'],
                batch_advanced: ['agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId']
            },
            DEFAULT_FILTERS: {
                personal: {},
                batch: { mainStatus: '2', currentOwner: '' }
            }
        };

        const environments = {
            uat: {
                QUERY_PERSONAL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
                QUERY_BATCH: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
                MANUAL_ASSIGN: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
            },
            prod: {
                QUERY_PERSONAL: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
                QUERY_BATCH: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
                MANUAL_ASSIGN: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
            }
        };

        const hostname = window.location.hostname;
        const isUAT = hostname.includes('-uat');
        const selectedApiConfig = isUAT ? environments.uat : environments.prod;

        const finalConfig = {
            ...staticConfig,
            API: selectedApiConfig,
            ENV: isUAT ? 'UAT' : 'PROD'
        };

        return Object.freeze(finalConfig);
    })();

    // === 2. 全域狀態模組 (AppState) ===
    const AppState = (() => {
        const state = {
            userToken: null,
            modalPosition: { top: null, left: null },
            abortController: null,
            isLoading: false,
            activeTabId: 'personal'
        };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => {
                if (typeof k === 'object') Object.assign(state, k);
                else state[k] = v;
            },
            createAbortSignal: () => (state.abortController = new AbortController()).signal,
            abortRequest: () => {
                state.abortController?.abort();
                state.abortController = null;
            }
        };
    })();

    // === 3. 工具函式模組 (Utils) ===
    const createUtils = (AppConfig) => ({
        escapeHtml: (str) => {
            if (str === null || str === undefined) return '';
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(str).replace(/[&<>"']/g, m => map[m]);
        },
        getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(AppConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
        jsonToCsv: (items, { dynamicHeaders = false } = {}) => {
            if (!items || items.length === 0) return '';
            
            let headers = [];
            if (dynamicHeaders) {
                const headerSet = new Set();
                items.forEach(item => {
                    Object.keys(item).forEach(key => headerSet.add(key));
                });
                headers = [...headerSet];
            } else {
                headers = Object.keys(items[0]);
            }

            const headerRow = headers.map(h => JSON.stringify(h)).join(',');
            const rows = items.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','));
            return [headerRow, ...rows].join('\r\n');
        },
        downloadCsv: (csv, filename) => {
            const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        formatDisplayDate: (d) => (d && typeof d === 'string') ? d.split(' ')[0] : '',
        formatDateTime: (date) => {
            const Y = date.getFullYear();
            const M = String(date.getMonth() + 1).padStart(2, '0');
            const D = String(date.getDate()).padStart(2, '0');
            return `${Y}-${M}-${D} 00:00:00`;
        },
        parseDate: (input) => {
            if (!input || !String(input).trim()) return { display: '', full: '' };
            const str = String(input).trim();
            let match;
            match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (match) {
                const [, year, month, day] = match;
                const display = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                return { display, full: `${display} 00:00:00` };
            }
            match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
            if (match) {
                const [, year, month, day] = match;
                const display = `${year}-${month}-${day}`;
                return { display, full: `${display} 00:00:00` };
            }
            return { display: str, full: str };
        },
        debounce: (fn, delay) => {
            let t;
            return function(...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), delay);
            };
        },
        readTxt: () => new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.style.display = 'none';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) { reject(new Error('未選取檔案')); return; }
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = () => reject(new Error('檔案讀取失敗'));
                reader.readAsText(file);
            };
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        }),
        splitTextInput: (text) => text.split(/[\n,;\s]+/).map(s => s.trim()).filter(s => s)
    });

    // === 3.5. DOM 輔助工具模組 (DOMHelper) ===
    const DOMHelper = (() => ({
        create: (tag, options = {}) => {
            const el = document.createElement(tag);
            if (options.className) el.className = options.className;
            if (options.id) el.id = options.id;
            if (options.textContent) el.textContent = options.textContent;
            if (options.innerHTML) el.innerHTML = options.innerHTML;
            if (options.style) Object.assign(el.style, options.style);
            if (options.attributes) {
                for (const [key, value] of Object.entries(options.attributes)) {
                    el.setAttribute(key, value);
                }
            }
            if (options.children) {
                options.children.forEach(child => el.appendChild(child));
            }
            if (options.events) {
                for (const [event, handler] of Object.entries(options.events)) {
                    el.addEventListener(event, handler);
                }
            }
            return el;
        }
    }))();

    // === 4. UI 管理模組 (UIManager) ===
    const createUIManager = (AppConfig, AppState, Utils, DOMHelper) => {
        function injectStyle() {
            if (document.getElementById(AppConfig.STYLE_ELEMENT_ID)) return;
            const style = DOMHelper.create('style', {
                id: AppConfig.STYLE_ELEMENT_ID,
                textContent: `
                    :root { --primary-color: #007bff; --primary-dark: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
                    .dispatch-mask { position: fixed; z-index: ${AppConfig.ZINDEX.MASK}; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; }
                    .dispatch-mask.show { opacity: 1; }
                    .dispatch-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.15); padding:0; position: fixed;
                    top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: ${AppConfig.ZINDEX.MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity .18s; max-height: 90vh;
                    max-width: 95vw; box-sizing: border-box; }
                    .dispatch-modal.show { opacity: 1; } .dispatch-modal.dragging { transition: none !important; }
                    .dispatch-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; text-align:center; }
                    .dispatch-close { position: absolute; top:10px; right:10px; background:transparent; border:none; font-size:28px; font-weight:bold; color:var(--secondary-color); cursor:pointer; width:36px; height:36px; border-radius:50%; transition:.2s; display:flex; align-items:center; justify-content:center; }
                    .dispatch-close:hover { background:#f0f0f0; color:#333; transform:rotate(90deg)scale(1.05); }
                    .dispatch-body { padding:16px 20px; flex-grow:1; overflow-y:auto; min-height:50px; display:flex; flex-direction:column; }
                    .dispatch-footer { padding:12px 20px 16px 20px; border-top:1px solid #e0e0e0; display:flex; align-items:center; width:100%; box-sizing:border-box; }
                    .dispatch-btn { display:inline-flex; align-items:center; justify-content:center; padding:8px 18px; font-size:15px; border-radius:6px; border:1px solid transparent; background:var(--primary-color); color:#fff; cursor:pointer; transition:.25s; font-weight:600; white-space:nowrap; }
                    .dispatch-btn:not([disabled]):hover { background:var(--primary-dark); transform:translateY(-2px); }
                    .dispatch-btn[disabled] { background:#d6d6d6; cursor:not-allowed; }
                    .dispatch-btn.dispatch-outline { background:transparent; border-color:var(--secondary-color); color:var(--secondary-color); }
                    .dispatch-btn.dispatch-outline:not([disabled]):hover { background-color:#f8f8f8; }
                    .dispatch-btn.small { padding:4px 10px; font-size:13px; }
                    .dispatch-input, textarea.dispatch-input, select.dispatch-input { width:100%; font-size:14px; padding:8px 12px; border-radius:5px; box-sizing:border-box; border:1px solid #e0e0e0; margin-top:5px; }
                    .dispatch-toast { position:fixed; left:50%; top:30px; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 22px; border-radius:6px; font-size:16px; z-index:${AppConfig.ZINDEX.TOAST}; opacity:0; transition:.3s; }
                    .dispatch-toast.show { opacity:1; }
                    .dispatch-progress { position:fixed; inset:0; background:rgba(255,255,255,0.8); z-index:${AppConfig.ZINDEX.TOAST}; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:1.2rem; font-weight:bold; }
                    .dispatch-progress button { margin-top:20px; }
                    .dispatch-tabs { margin-bottom:15px; border-bottom:1px solid #ccc; display:flex; flex-wrap: wrap; }
                    .dispatch-tabs button { background:transparent; border:none; padding:10px 15px; cursor:pointer; font-size:16px; border-bottom:3px solid transparent; margin-bottom:-1px; position: relative; padding-right: 25px; }
                    .dispatch-tabs button.active { font-weight:bold; color:var(--primary-color); border-bottom-color:var(--primary-color); }
                    .dispatch-tabs button .close-tab-btn { display: none; position: absolute; top: 50%; transform: translateY(-50%); right: 5px; width: 18px; height: 18px; border-radius: 50%; border: none; background-color: #ccc; color: white; font-size: 12px; line-height: 18px; text-align: center; cursor: pointer; }
                    .dispatch-tabs button.active .close-tab-btn { display: flex; align-items: center; justify-content: center; }
                    .dispatch-tabs button .close-tab-btn:hover { background-color: #999; }
                    .filter-controls { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px 15px; margin-bottom:10px; }
                    .advanced-filters { display: none; margin-top: 10px; }
                    .case-table-container { overflow:auto; position:relative; flex-grow:1; border:1px solid #ddd; }
                    .case-table { border-collapse:collapse; white-space:nowrap; font-size:14px; table-layout:auto; }
                    .case-table thead { position:sticky; top:0; z-index:1; background-color:#f2f2f2; }
                    .case-table th, .case-table td { border:1px solid #ddd; padding:8px 10px; text-align:center; overflow:hidden; text-overflow:ellipsis; }
                    .case-table th { cursor:pointer; user-select: none; } .case-table td { cursor:cell; }
                    .case-table th .sort-indicator { margin-left:5px; font-weight:normal; opacity:0.5; }
                    .header-config-btn { position: absolute; top: 14px; left: 14px; font-size: 20px; width:36px; height:36px; border-radius:50%; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; }
                    .header-config-btn:hover { background: #f0f0f0; }
                    .config-menu { position: absolute; top: 52px; left: 10px; background: #fff; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10;
                    padding: 5px 0; display: none; }
                    .config-menu button { background: none; border: none; padding: 8px 16px; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
                    .config-menu button:hover { background: #f0f0f0; }
                    .preset-form { display: grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap: 15px; }
                    .preset-form-col { display: flex; flex-direction: column; }
                    .preset-form h3 { margin: 0 0 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
                    .special-assignee { font-weight: bold; color: #00008B; background-color: #FFFFE0; }
                    .dispatch-body .controls-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
                    .dispatch-body .controls-row .right-controls { display:flex; gap:8px; align-items:center; }
                    .folded-column { display: none; }
                    .show-all-columns .folded-column { display: table-cell; }
                    .manual-op-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 10px; height: 100%; }
                    .manual-op-section { border: 1px solid #ccc; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; }
                    .manual-op-section h3 { margin-top: 0; }
                    .manual-op-section textarea { flex-grow: 1; resize: vertical; min-height: 100px; }
                    .manual-op-footer { grid-column: 1 / -1; margin-top: auto; padding-top: 15px; display: flex; justify-content: flex-end; }
                    .query-criteria-display { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 13px; line-height: 1.6; word-break: break-all; }
                    .query-criteria-display strong { color: var(--primary-color); }
                    .personnel-selector { display: flex; flex-direction: column; height: 100%; }
                    .personnel-tabs { border-bottom: 1px solid #ccc; display: flex; }
                    .personnel-tabs button { background: #f1f1f1; border: 1px solid #ccc; border-bottom: none; padding: 8px 12px; cursor: pointer; margin-right: 5px; border-radius: 4px 4px 0 0; }
                    .personnel-tabs button.active { background: #fff; border-bottom: 1px solid #fff; }
                    .personnel-tab-content { border: 1px solid #ccc; border-top: none; padding: 10px; flex-grow: 1; overflow-y: auto; display: none; }
                    .personnel-tab-content.active { display: block; }
                    .personnel-tab-content .user-list { list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto; }
                    .personnel-tab-content .user-list li { padding: 5px; cursor: pointer; }
                    .personnel-tab-content .user-list li:hover { background-color: #f0f0f0; }
                    .personnel-tab-content .user-list input[type="radio"] { margin-right: 8px; }
                `
            });
            document.head.appendChild(style);
        }

        const Toast = {
            show: (msg, type = 'success', duration = 2100) => {
                document.querySelector('.dispatch-toast')?.remove();
                const toastElement = DOMHelper.create('div', { className: `dispatch-toast ${type}`, textContent: msg, style: { background: `var(--${type}-color, #555)` } });
                document.body.appendChild(toastElement);
                requestAnimationFrame(() => toastElement.classList.add('show'));
                if (duration > 0) {
                    setTimeout(() => {
                        toastElement.classList.remove('show');
                        toastElement.addEventListener('transitionend', () => toastElement.remove(), { once: true });
                    }, duration);
                }
            }
        };

        const Progress = {
            show(text) {
                this.hide();
                const stopButton = DOMHelper.create('button', {
                    id: 'stop-query', className: 'dispatch-btn dispatch-outline', textContent: '停止查詢',
                    events: { click: () => { AppState.abortRequest(); this.hide(); Toast.show('查詢已中斷', 'warning'); } }
                });
                const progressElement = DOMHelper.create('div', {
                    id: 'dispatch-progress', className: 'dispatch-progress',
                    children: [ DOMHelper.create('div', { textContent: Utils.escapeHtml(text) }), stopButton ]
                });
                document.body.appendChild(progressElement);
            },
            update(percent, text) {
                const progressText = document.getElementById('dispatch-progress')?.querySelector('div:first-child');
                if (progressText) {
                    progressText.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
                }
            },
            hide() { document.getElementById('dispatch-progress')?.remove(); }
        };

        const Modal = (() => {
            const dragState = { active: false, sX: 0, sY: 0, iL: 0, iT: 0 };
            
            function handleEsc(e) { if (e.key === 'Escape') Modal.hide(); }

            function dragStart(e) {
                const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
                if (!modal || e.target.closest('.dispatch-close, .header-config-btn, .dispatch-tabs button')) return;
                
                e.preventDefault();
                dragState.active = true;
                modal.classList.add('dragging');
                
                const rect = modal.getBoundingClientRect();
                dragState.sX = e.clientX;
                dragState.sY = e.clientY;
                dragState.iL = rect.left;
                dragState.iT = rect.top;
                
                document.addEventListener('mousemove', doDrag);
                document.addEventListener('mouseup', stopDrag, { once: true });
            }

            function doDrag(e) {
                if (!dragState.active) return;
                e.preventDefault();
                const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
                if (modal) {
                    modal.style.left = `${dragState.iL + e.clientX - dragState.sX}px`;
                    modal.style.top = `${dragState.iT + e.clientY - dragState.sY}px`;
                    modal.style.transform = 'none';
                }
            }

            function stopDrag() {
                dragState.active = false;
                document.getElementById(AppConfig.TOOL_CONTAINER_ID)?.classList.remove('dragging');
                document.removeEventListener('mousemove', doDrag);
            }

            return {
                hide() {
                    const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
                    if (modal) {
                        const style = window.getComputedStyle(modal);
                        AppState.set({ modalPosition: { top: style.top, left: style.left } });
                        modal.style.opacity = '0';
                        modal.style.display = 'none';
                    }
                    document.getElementById('dispatch-mask')?.classList.remove('show');
                    AppState.abortRequest();
                    document.removeEventListener('keydown', handleEsc);
                },
                show(opts) {
                    return new Promise(resolve => {
                        const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
                        if (!modal) {
                            console.error('Modal container not found.');
                            return resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE });
                        }

                        const isAlreadyVisible = modal.style.display === 'flex';
                        if (!isAlreadyVisible) {
                            modal.style.display = 'flex';
                            modal.style.opacity = '0';
                            document.getElementById('dispatch-mask')?.classList.add('show');
                        }
                        
                        modal.innerHTML = '';
                        const header = DOMHelper.create('div', { className: 'dispatch-header', innerHTML: opts.header });
                        const closeButton = DOMHelper.create('button', {
                            className: 'dispatch-close', innerHTML: '&times;',
                            events: { click: () => { Modal.hide(); resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE }); } }
                        });
                        header.appendChild(closeButton);
                        
                        modal.append(header, opts.body, opts.footer);

                        if (!isAlreadyVisible) {
                            const { top, left } = AppState.get('modalPosition');
                            if (top && left && top !== 'auto' && left !== 'auto') {
                                modal.style.top = top;
                                modal.style.left = left;
                                modal.style.transform = 'none';
                            } else {
                                modal.style.top = '50%';
                                modal.style.left = '50%';
                                modal.style.transform = 'translate(-50%, -50%)';
                            }
                            modal.style.width = opts.width || 'auto';
                            requestAnimationFrame(() => modal.style.opacity = '1');
                        }

                        header.addEventListener('mousedown', dragStart);
                        document.removeEventListener('keydown', handleEsc); 
                        document.addEventListener('keydown', handleEsc);

                        if (opts.onOpen) opts.onOpen(modal, resolve);
                    });
                }
            };
        })();

        function initModalContainer() {
            if (document.getElementById(AppConfig.TOOL_CONTAINER_ID)) return;
            const container = DOMHelper.create('div', { id: AppConfig.TOOL_CONTAINER_ID, className: 'dispatch-modal' });
            const mask = DOMHelper.create('div', { id: 'dispatch-mask', className: 'dispatch-mask' });
            document.body.append(container, mask);
        }

        return { injectStyle, Toast, Progress, Modal, initModalContainer };
    };

    // === 5. API 服務模組 (ApiService) ===
    const createApiService = (AppConfig, AppState, UIManager) => {
        async function _fetch(url, options) {
            const token = AppState.get('userToken');
            if (!token) throw new Error('TOKEN無效或過期');

            const fetchOptions = {
                ...options,
                headers: { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' },
                signal: AppState.createAbortSignal()
            };

            const response = await fetch(url, fetchOptions);

            if (response.status === 401 || response.status === 403) throw new Error('TOKEN無效或過期');

            if (!response.ok) {
                const error = new Error(`伺服器錯誤: ${response.status}`);
                try { error.data = await response.json(); } catch { error.data = await response.text(); }
                throw error;
            }
            
            return response.json();
        }

        async function fetchAllPages(endpoint, payload, listName) {
            let allRecords = [];
            let page = 1;
            let totalPages = 1;
            
            UIManager.Progress.show(`載入${listName}中...`);

            try {
                const firstPageData = await _fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ ...payload, pageIndex: page, size: AppConfig.BATCH_PAGE_SIZE })
                });
                
                if (firstPageData?.records?.length > 0) {
                    allRecords = allRecords.concat(firstPageData.records);
                    if (firstPageData.total > AppConfig.BATCH_PAGE_SIZE) {
                        totalPages = Math.ceil(firstPageData.total / AppConfig.BATCH_PAGE_SIZE);
                    }
                } else {
                    UIManager.Progress.hide();
                    return [];
                }

                if (totalPages > 1) {
                    const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                    
                    const pageChunks = [];
                    for (let i = 0; i < pagesToFetch.length; i += AppConfig.CONCURRENT_API_LIMIT) {
                        pageChunks.push(pagesToFetch.slice(i, i + AppConfig.CONCURRENT_API_LIMIT));
                    }

                    for (const chunk of pageChunks) {
                        const promises = chunk.map(p => _fetch(endpoint, {
                            method: 'POST',
                            body: JSON.stringify({ ...payload, pageIndex: p, size: AppConfig.BATCH_PAGE_SIZE })
                        }));

                        const results = await Promise.all(promises);
                        results.forEach(res => {
                            if (res?.records?.length > 0) allRecords.push(...res.records);
                        });

                        const loadedCount = allRecords.length;
                        const totalCount = firstPageData.total;
                        const percent = Math.round(100 * loadedCount / totalCount);
                        UIManager.Progress.update(percent, `載入${listName}中... ${loadedCount}/${totalCount} 筆`);
                    }
                }
                UIManager.Progress.hide();
                return allRecords;
            } catch(error) {
                if (error.name !== 'AbortError') {
                    UIManager.Progress.hide();
                    console.error(`[ApiService] Fetch failed for ${listName}:`, error);
                }
                throw error;
            }
        }

        return {
            fetchPersonalCases: (filters) => fetchAllPages(AppConfig.API.QUERY_PERSONAL, filters, '個人案件'),
            fetchBatchCases: (filters) => fetchAllPages(AppConfig.API.QUERY_BATCH, filters, '批次案件'),
            manualAssign: async (applyNumbers, assignee) => {
                const response = await _fetch(AppConfig.API.MANUAL_ASSIGN, {
                    method: 'POST',
                    body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: assignee, dispatchOrgBf: '', applyNumbers })
                });
                
                const successfulCases = response?.assignSuccess ?? [];
                const failedCases = (response?.assignFail ?? []).map(failItem => ({ caseId: failItem.caseId, reason: failItem.errorMsg || '未知原因' }));

                return { successful: successfulCases, failed: failedCases };
            }
        };
    };
    
    // === 6. UI 元件模組 (UIComponents) ===
    const createUIComponents = (AppConfig, UIManager, Utils, DOMHelper) => {
        const TokenDialog = {
            show: (opts = {}) => {
                const { mode } = opts;
                const isRevalidateMode = mode === 'revalidate';
    
                return UIManager.Modal.show({
                    header: `重新驗核TOKEN (${AppConfig.ENV})`,
                    width: '450px',
                    body: DOMHelper.create('div', {
                        className: 'dispatch-body',
                        children: [
                            DOMHelper.create('p', { textContent: '請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。', style: { marginTop: '0' } }),
                            DOMHelper.create('textarea', { id: 'token-input', className: 'dispatch-input', attributes: { rows: '4' }, style: { fontFamily: 'monospace' } })
                        ]
                    }),
                    footer: DOMHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: isRevalidateMode ? 'space-between' : 'flex-end', padding: '12px 20px 16px' },
                        children: [
                            ...(isRevalidateMode ? [DOMHelper.create('button', { id: 'auto-check-btn', className: 'dispatch-btn dispatch-outline', textContent: '自動檢核' })] : []),
                            DOMHelper.create('button', { id: 'confirm-token-btn', className: 'dispatch-btn', textContent: '確認' })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        const tokenInput = modal.querySelector('#token-input');
                        
                        if (isRevalidateMode) {
                            modal.querySelector('#auto-check-btn').onclick = () => {
                                const storedToken = Utils.getStoredToken();
                                if (storedToken) {
                                    UIManager.Toast.show('已自動檢核並儲存 Token', 'success');
                                    resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM, value: storedToken });
                                } else {
                                    UIManager.Toast.show('在瀏覽器中未找到 Token', 'warning');
                                }
                            };
                        }
                        
                        modal.querySelector('#confirm-token-btn').onclick = () => {
                            const value = tokenInput.value.trim();
                            if (value) resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM, value });
                            else UIManager.Toast.show('Token 不可為空', 'error');
                        };
                    }
                });
            }
        };
        
        const QueryBuilderDialog = {
            show: (opts = {}) => {
                const { dynamicBatchDefaults, currentFilters } = opts;
                
                const batchPresets = {
                    ...dynamicBatchDefaults,
                    ...currentFilters
                };
                let allFieldsVisible = false;
    
                const createForm = () => {
                    const formContainer = DOMHelper.create('div', { className: 'preset-form' });
                    
                    const commonKeys = AppConfig.FILTER_CONFIG.batch_common;
                    const advancedKeys = AppConfig.FILTER_CONFIG.batch_advanced;
                    const displayedKeys = new Set([...commonKeys, ...advancedKeys]);
    
                    const createInput = (key) => {
                            const label = AppConfig.COLUMN_DEFINITIONS[key]?.label ?? key;
                        const value = batchPresets[key] ?? '';
                        const parsedDate = Utils.parseDate(value);
                        
                        const input = DOMHelper.create('input', { 
                            type: 'text', id: `preset-batch-${key}`, className: 'dispatch-input', 
                            attributes: { 
                                value: Utils.escapeHtml(parsedDate.display),
                                'data-full-value': Utils.escapeHtml(parsedDate.full)
                            } 
                        });
    
                        if (key.toLowerCase().includes('date')) {
                            input.addEventListener('blur', (e) => {
                                const formatted = Utils.parseDate(e.target.value);
                                e.target.value = formatted.display;
                                e.target.dataset.fullValue = formatted.full;
                            });
                        }
    
                        return DOMHelper.create('div', {
                            children: [
                                DOMHelper.create('label', { textContent: `${label}:`, style: { fontSize: '14px', display: 'block' } }),
                                input
                            ]
                        });
                    };
    
                    const commonInputs = commonKeys.map(createInput);
                    const advancedInputs = advancedKeys.map(createInput);
                    
                    const commonCol = DOMHelper.create('div', { className: 'preset-form-col', children: [DOMHelper.create('h3', { textContent: '常用篩選' }), ...commonInputs] });
                    const advancedCol = DOMHelper.create('div', { className: 'preset-form-col', children: [DOMHelper.create('h3', { textContent: '進階篩選' }), ...advancedInputs] });
                    
                    formContainer.append(commonCol, advancedCol);
    
                    if (allFieldsVisible) {
                        const otherKeys = Object.keys(AppConfig.COLUMN_DEFINITIONS).filter(k => !displayedKeys.has(k) && !['select', 'seq'].includes(k));
                        const otherInputs = otherKeys.map(createInput);
                        const otherCol = DOMHelper.create('div', { className: 'preset-form-col', children: [DOMHelper.create('h3', { textContent: '其他欄位' }), ...otherInputs] });
                        formContainer.appendChild(otherCol);
                    }
                    
                    return formContainer;
                };
    
                const body = DOMHelper.create('div', { className: 'dispatch-body' });
                body.appendChild(createForm());
                
                const loadMoreBtn = DOMHelper.create('button', { id: 'load-more-filters-btn', textContent: '載入更多查詢欄位', className: 'dispatch-btn dispatch-outline small', style: { marginTop: '10px' } });
                body.appendChild(loadMoreBtn);
    
                const footer = DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                    children: [
                        DOMHelper.create('button', { id: 'reset-defaults-btn', className: 'dispatch-btn dispatch-outline', textContent: '恢復預設值' }),
                        DOMHelper.create('div', {
                            children: [
                                DOMHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回', style: { marginRight: '10px' } }),
                                DOMHelper.create('button', { id: 'apply-filters-btn', className: 'dispatch-btn', textContent: '套用並查詢' }),
                            ]
                        })
                    ]
                });
    
                return UIManager.Modal.show({
                    header: '開啟新查詢',
                    width: '900px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#load-more-filters-btn').onclick = (e) => {
                            allFieldsVisible = true;
                            modal.querySelector('.preset-form').remove();
                            modal.querySelector('.dispatch-body').prepend(createForm());
                            e.target.style.display = 'none';
                        };
    
                        modal.querySelector('#apply-filters-btn').onclick = () => {
                            const payload = { batch: {} };
                            modal.querySelectorAll('.dispatch-input').forEach(input => {
                                const key = input.id.replace('preset-batch-', '');
                                const value = input.dataset.fullValue || input.value.trim();
                                if (value) {
                                    payload.batch[key] = value;
                                }
                            });
                            
                            resolve({ action: AppConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS, payload });
                        };
                        modal.querySelector('#reset-defaults-btn').onclick = () => {
                            resolve({ action: AppConfig.MODAL_ACTIONS.RESET_AND_RELOAD });
                        };
                        modal.querySelector('#back-btn').onclick = () => {
                            resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE });
                        };
                    }
                });
            }
        };
        
        const PersonnelSelectDialog = {
            show: (opts) => {
                const { selectedCount, defaultUsers } = opts;
                const body = DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('p', { innerHTML: `已選取 <strong>${selectedCount}</strong> 筆案件，請選擇或輸入指派人員：`, style: { marginTop: '0' } }),
                        DOMHelper.create('div', {
                            style: { display: 'flex', alignItems: 'center', gap: '10px' },
                            children: [
                                DOMHelper.create('select', { id: 'assignee-select', className: 'dispatch-input', style: { flexGrow: '1', marginTop: '0' } }),
                                DOMHelper.create('button', { id: 'import-personnel-btn', className: 'dispatch-btn dispatch-outline small', textContent: '匯入人員' })
                            ]
                        }),
                        DOMHelper.create('div', {
                            style: { marginTop: '15px' },
                            children: [
                                DOMHelper.create('label', { style: { cursor: 'pointer' }, children: [
                                    DOMHelper.create('input', { type: 'checkbox', id: 'manual-assignee-checkbox' }),
                                    DOMHelper.create('span', { textContent: ' 或手動輸入帳號' })
                                ]}),
                                DOMHelper.create('input', { type: 'text', id: 'manual-assignee-input', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號' }, style: { display: 'none' } })
                            ]
                        })
                    ]
                });

                const footer = DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                    children: [
                        DOMHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回上一步' }),
                        DOMHelper.create('button', { id: 'confirm-assignment-btn', className: 'dispatch-btn', textContent: '確認指派', attributes: { disabled: true } })
                    ]
                });

                return UIManager.Modal.show({
                    header: '選擇指派人員',
                    width: '450px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        const selectEl = modal.querySelector('#assignee-select');
                        const importBtn = modal.querySelector('#import-personnel-btn');
                        const manualCheckbox = modal.querySelector('#manual-assignee-checkbox');
                        const manualInput = modal.querySelector('#manual-assignee-input');
                        const confirmBtn = modal.querySelector('#confirm-assignment-btn');
                        
                        let currentPersonnelList = [...defaultUsers];

                        const populateSelect = (list) => {
                            const specialUsers = [];
                            const regularUsers = [];

                            list.forEach(user => {
                                if (AppConfig.SPECIAL_ASSIGNEES.includes(user)) {
                                    specialUsers.push(user);
                                } else {
                                    regularUsers.push(user);
                                }
                            });

                            specialUsers.sort();
                            regularUsers.sort();

                            const specialOptions = specialUsers.map(u => `<option value="${Utils.escapeHtml(u)}" class="special-assignee">${Utils.escapeHtml(u)}</option>`);
                            const regularOptions = regularUsers.map(u => `<option value="${Utils.escapeHtml(u)}">${Utils.escapeHtml(u)}</option>`);
                            
                            selectEl.innerHTML = [...specialOptions, ...regularOptions].join('');
                        };

                        const updateConfirmBtnState = () => {
                            const hasValue = manualCheckbox.checked ? manualInput.value.trim() !== '' : !!selectEl.value;
                            confirmBtn.disabled = !hasValue;
                        };
                        
                        const handleImport = async () => {
                            try {
                                const importedNames = Utils.splitTextInput(await Utils.readTxt());
                                if (importedNames.length > 0) {
                                    currentPersonnelList = [...new Set([...currentPersonnelList, ...importedNames])];
                                    populateSelect(currentPersonnelList);
                                    UIManager.Toast.show(`成功匯入 ${importedNames.length} 位人員`, 'success');
                                }
                            } catch (e) {
                                if (e.message !== '未選取檔案') UIManager.Toast.show(e.message, 'error');
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
                        manualInput.addEventListener('input', (e) => {
                            e.target.value = e.target.value.toLowerCase();
                            updateConfirmBtnState();
                        });
                        importBtn.onclick = handleImport;
                        modal.querySelector('#back-btn').onclick = () => resolve({ action: AppConfig.MODAL_ACTIONS.BACK });
                        confirmBtn.onclick = () => {
                            const assignee = manualCheckbox.checked ? manualInput.value.trim() : selectEl.value;
                            if (!assignee) return UIManager.Toast.show('請選擇或輸入指派人員', 'error');
                            resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT, assignee });
                        };

                        populateSelect(currentPersonnelList);
                        updateConfirmBtnState();
                    }
                });
            }
        };

        const AssignmentResultDialog = {
            show: ({ successful, failed, assignee }) => {
                const hasFailures = failed.length > 0;
                const totalCount = successful.length + failed.length;
                
                const bodyChildren = [
                    DOMHelper.create('p', { innerHTML: `已完成對 <strong>${Utils.escapeHtml(assignee)}</strong> 的派件操作。`}),
                    DOMHelper.create('p', { innerHTML: `派發總案件數: ${totalCount} 筆`, style: { fontWeight: 'bold' } }),
                    DOMHelper.create('p', { innerHTML: `成功 ${successful.length} 筆，失敗 ${failed.length} 筆。`, style: { color: hasFailures ? 'var(--warning-color)' : 'var(--success-color)' }})
                ];

                if (failed.length > 0) {
                    bodyChildren.push(DOMHelper.create('div', {
                        style: { marginTop: '15px' },
                        children: [
                            DOMHelper.create('strong', { textContent: '失敗詳情：' }),
                            DOMHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '5', readonly: true }, style: { fontSize: '12px', background: '#f8f8f8' }, textContent: failed.map(f => `受理號碼: ${Utils.escapeHtml(f.caseId)}\n原因: ${Utils.escapeHtml(f.reason)}`).join('\n\n') })
                        ]
                    }));
                }
                
                if (successful.length > 0 && failed.length > 0) {
                     bodyChildren.push(DOMHelper.create('div', {
                        style: { marginTop: '10px' },
                        children: [
                            DOMHelper.create('strong', { textContent: '成功列表：' }),
                            DOMHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '3', readonly: true }, style: { fontSize: '12px' }, textContent: successful.map(Utils.escapeHtml).join('\n') })
                        ]
                    }));
                }
                
                const body = DOMHelper.create('div', { className: 'dispatch-body', children: bodyChildren });
                const footer = DOMHelper.create('div', { className: 'dispatch-footer', style: { justifyContent: 'flex-end'}, children: [ DOMHelper.create('button', { id: 'close-result-btn', className: 'dispatch-btn', textContent: '關閉' }) ]});

                return UIManager.Modal.show({
                    header: hasFailures ? '派件部分成功' : '派件成功',
                    width: '500px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        const closeBtn = modal.querySelector('#close-result-btn');
                        let interval;
                        const closeAndResolve = () => {
                            if (interval) clearInterval(interval);
                            resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE });
                        };
                        closeBtn.onclick = closeAndResolve;
                        if (!hasFailures) {
                            let countdown = 3;
                            closeBtn.textContent = `關閉 (${countdown})`;
                            interval = setInterval(() => {
                                countdown--;
                                if (countdown > 0) {
                                    closeBtn.textContent = `關閉 (${countdown})`;
                                } else {
                                    closeAndResolve();
                                }
                            }, 1000);
                        }
                    }
                });
            }
        };

        const ErrorDialog = {
            show: ({ error }) => {
                 const body = DOMHelper.create('div', { className: 'dispatch-body', children: [
                    DOMHelper.create('p', { textContent: '在執行過程中發生錯誤：', style: { color: 'var(--error-color)' } }),
                    DOMHelper.create('pre', { 
                        textContent: Utils.escapeHtml(error.message),
                        style: { background: '#f0f0f0', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
                    })
                 ]});
                  const footer = DOMHelper.create('div', { className: 'dispatch-footer', style: { justifyContent: 'space-between' }, children: [
                    DOMHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回' }),
                    DOMHelper.create('button', { id: 'retry-btn', className: 'dispatch-btn', textContent: '重試' })
                 ]});

                return UIManager.Modal.show({
                    header: '操作失敗',
                    width: '500px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#back-btn').onclick = () => { resolve({ action: AppConfig.MODAL_ACTIONS.BACK }); };
                        modal.querySelector('#retry-btn').onclick = () => { resolve({ action: AppConfig.MODAL_ACTIONS.RETRY }); };
                    }
                });
            }
        };

        const CaseListView = { show: async (opts) => {
            const { tabs, activeTabId, caseList, error, viewConfig, filterOptions, initialFilters, assigneeList, queryInfo } = opts;
            
            const isErrorState = !!error;
            let sortState = { key: null, order: 'asc' };
            let currentData = isErrorState ? [] : [...caseList];
            let elements = {};

            const header = _createHeader();
            const body = _createBody();
            const footer = _createFooter();
            
            function _renderTable(data) {
                if (isErrorState) {
                    elements.tbody.innerHTML = '';
                    const errorLink = DOMHelper.create('a', { textContent: '點此重新驗證 Token', attributes: { href: '#' }, style: { color: 'var(--error-color)', textDecoration: 'underline' }, events: { click: (e) => { e.preventDefault(); elements.resolve({ action: AppConfig.MODAL_ACTIONS.CHANGE_TOKEN }); }} });
                    const errorCell = DOMHelper.create('td', { attributes: { colspan: viewConfig.columns.length }, style: { color: 'var(--error-color)', fontWeight: 'bold', height: '100px' }, children: [ DOMHelper.create('span', { textContent: `資料載入失敗：${Utils.escapeHtml(error.message)} ` }), errorLink ] });
                    elements.tbody.appendChild(DOMHelper.create('tr', { children: [errorCell] }));
                    elements.countElem.textContent = '載入失敗';
                    elements.nextBtn.disabled = true;
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                data.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = viewConfig.columns.map(key => {
                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                        const isFolded = viewConfig.foldedColumns?.includes(key);
                        const className = isFolded ? 'class="folded-column"' : '';

                        if (key === 'select') {
                            return `<td ${className}><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(item.applyNumber)}"></td>`;
                        }
                        const displayValue = key === 'seq' ? index + 1 : (def.type === 'date' ? Utils.formatDisplayDate(item[key]) : item[key] ?? '');
                        return `<td ${className} title="${Utils.escapeHtml(item[key] ?? '')}">${Utils.escapeHtml(displayValue)}</td>`;
                    }).join('');
                    fragment.appendChild(tr);
                });
                
                elements.tbody.innerHTML = '';
                elements.tbody.appendChild(fragment);
                elements.countElem.textContent = `顯示 ${data.length} / ${caseList.length} 筆`;
                _updateNextButton();
            }

            function _updateNextButton() {
                if (!elements.nextBtn) return;
                const count = elements.modal.querySelectorAll('.case-checkbox:checked').length;
                elements.nextBtn.disabled = count === 0;
                elements.nextBtn.textContent = `下一步 (${count})`;
            }

            const _applyFiltersAndSort = Utils.debounce(() => {
                const filterValues = {};
                elements.filterSelects.forEach(select => {
                    const key = select.id.replace('filter-', '');
                    if (select.value) filterValues[key] = select.value;
                });

                let filteredData = caseList.filter(item => 
                    Object.entries(filterValues).every(([key, value]) => {
                        const itemValue = String(item[key] ?? '');
                        if (key === 'applyDateStart') return new Date(item.applyDate) >= new Date(value);
                        if (key === 'applyDateEnd') return new Date(item.applyDate) <= new Date(value);
                        if (key.toLowerCase().includes('date')) return itemValue.startsWith(value.split(' ')[0]);
                        return itemValue === value;
                    })
                );

                if (sortState.key) {
                    filteredData.sort((a, b) => {
                        let valA = a[sortState.key] ?? '';
                        let valB = b[sortState.key] ?? '';
                        if (AppConfig.COLUMN_DEFINITIONS[sortState.key]?.type === 'date') {
                            valA = new Date(valA).getTime() || 0;
                            valB = new Date(valB).getTime() || 0;
                        }
                        if (valA < valB) return sortState.order === 'asc' ? -1 : 1;
                        if (valA > valB) return sortState.order === 'asc' ? 1 : -1;
                        return 0;
                    });
                }
                
                currentData = filteredData;
                _renderTable(currentData);
            }, AppConfig.DEBOUNCE_DELAY);

            function _createHeader() {
                return `多功能派件整合 v${AppConfig.VERSION} (${AppConfig.ENV})
                    <button class="header-config-btn" id="config-btn" title="設定">⚙️</button>
                    <div class="config-menu" id="config-menu">
                        <button id="change-token-btn">重新驗核token</button>
                        <button id="open-new-query-btn">開啟新查詢</button>
                        <button id="clear-cache-btn">清除暫存檔</button>
                    </div>`;
            }

            function _createBody() {
                const tabButtons = tabs.map(tab => {
                    const closeBtn = tab.canClose ? DOMHelper.create('button', { className: 'close-tab-btn', textContent: '×', attributes: { 'data-tab-id': tab.id } }) : null;
                    return DOMHelper.create('button', {
                        className: tab.id === activeTabId ? 'active' : '',
                        attributes: { 'data-tab-id': tab.id },
                        textContent: tab.name,
                        children: closeBtn ? [closeBtn] : []
                    });
                });

                const contentContainer = DOMHelper.create('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }});

                if (activeTabId === 'manual') {
                    contentContainer.appendChild(_createManualOpView());
                } else if (viewConfig) {
                    _createListView().forEach(el => contentContainer.appendChild(el));
                } else {
                    contentContainer.appendChild(DOMHelper.create('p', { textContent: '請選擇一個頁籤。' }));
                }

                return DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('div', { className: 'dispatch-tabs', children: tabButtons }),
                        contentContainer
                    ]
                });
            }
            
            function _createListView() {
                const { type, columns, foldedColumns } = viewConfig;

                const createFilterControls = () => {
                    const config = AppConfig.FILTER_CONFIG;
                    const commonKeys = (type === 'personal') ? config.personal_common : config.batch_common;
                    const advancedKeys = (type === 'personal') ? config.personal_advanced : config.batch_advanced;
                    
                    const renderSelect = (key) => {
                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                        if (!def) return null;

                        const options = filterOptions[key] || [];
                        const select = DOMHelper.create('select', { 
                            id: `filter-${key}`, className: 'dispatch-input filter-select',
                            attributes: { ...(isErrorState && { disabled: true }) },
                            children: [
                                DOMHelper.create('option', { textContent: '全部', attributes: { value: '' } }),
                                ...options.map(opt => DOMHelper.create('option', { textContent: opt, attributes: { value: opt } }))
                            ]
                        });
                        
                        if (initialFilters && initialFilters[key]) {
                            const valueToSet = String(initialFilters[key]).split(' ')[0];
                            if (!options.includes(valueToSet)) {
                                select.appendChild(DOMHelper.create('option', { textContent: valueToSet, attributes: { value: valueToSet } }));
                            }
                            select.value = valueToSet;
                        }
                        
                        return DOMHelper.create('div', { children: [ DOMHelper.create('label', { textContent: def.label, style: { fontSize: '14px', display: 'block', textAlign: 'left' } }), select ]});
                    };

                    const commonSelects = commonKeys.map(renderSelect).filter(Boolean);
                    const advancedSelects = advancedKeys.map(renderSelect).filter(Boolean);
                    
                    return [
                        DOMHelper.create('div', { className: 'filter-controls', children: commonSelects }),
                        DOMHelper.create('div', { className: 'filter-controls advanced-filters', children: advancedSelects })
                    ];
                };
                
                let queryDisplay = null;
                if (queryInfo) {
                    const criteriaHtml = Object.entries(queryInfo)
                        .map(([key, value]) => {
                            if(!value) return null;
                            return `<strong>${AppConfig.COLUMN_DEFINITIONS[key]?.label ?? key}:</strong> ${Utils.escapeHtml(value)}`
                        })
                        .filter(Boolean)
                        .join('; ');
                        queryDisplay = DOMHelper.create('div', { className: 'query-criteria-display', innerHTML: `查詢條件： ${criteriaHtml}` });
                }
                
                return [
                    ...(queryDisplay ? [queryDisplay] : []),
                    ...createFilterControls(),
                    DOMHelper.create('div', { className: 'controls-row', children: [
                        DOMHelper.create('span', { id: 'case-count', style: { fontSize: '14px' } }),
                        DOMHelper.create('div', { className: 'right-controls', children: [
                            ...(type === 'batch' || type === 'query' ? [DOMHelper.create('button', { id: 'toggle-columns-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多欄位' })] : []),
                            DOMHelper.create('button', { id: 'toggle-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多篩選條件' }),
                            DOMHelper.create('button', { id: 'clear-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '清除篩選' }),
                            DOMHelper.create('button', { id: 'export-csv-btn', className: 'dispatch-btn small', textContent: '匯出CSV', attributes: { ...(isErrorState && { disabled: true }) } }),
                            DOMHelper.create('button', { id: 'reload-view-btn', className: 'dispatch-btn small', textContent: '重新整理', title: '重新載入案件列表' }),
                            DOMHelper.create('button', { id: 'retry-fetch-btn', className: 'dispatch-btn small', textContent: '重新載入', style: { display: isErrorState ? 'inline-flex' : 'none' } })
                        ]})
                    ]}),
                    DOMHelper.create('div', { id: 'case-table-container', className: 'case-table-container', children: [
                        DOMHelper.create('table', { id: 'case-table', className: 'case-table', children: [
                            DOMHelper.create('thead', { children: [
                                DOMHelper.create('tr', { innerHTML: columns.map(key => {
                                    const def = AppConfig.COLUMN_DEFINITIONS[key];
                                    const isFolded = foldedColumns?.includes(key);
                                    const className = isFolded ? 'class="folded-column"' : '';
                                    if (key === 'select') {
                                        return `<th ${className}><input type="checkbox" id="select-all-header" ${isErrorState ? 'disabled' : ''}></th>`;
                                    }
                                    return `<th ${className} data-key="${def.key}" data-type="${def.type || ''}" title="點擊排序">${def.label} <span class="sort-indicator"></span></th>`;
                                }).join('') })
                            ]}),
                            DOMHelper.create('tbody')
                        ]})
                    ]})
                ];
            }
            
            function _createManualOpView() {
                const personnelSelector = _createTabbedPersonnelSelector(assigneeList);

                return DOMHelper.create('div', {
                    id: 'manual-op-container', className: 'manual-op-container',
                    children: [
                        DOMHelper.create('div', { className: 'manual-op-section', style: { flexGrow: 1 }, children: [
                            DOMHelper.create('h3', { textContent: '1. 輸入受理號碼' }),
                            DOMHelper.create('textarea', { id: 'manual-cases-input', className: 'dispatch-input', attributes: { placeholder: '請輸入受理號碼，以逗號、空格或換行分隔' } })
                        ]}),
                        DOMHelper.create('div', { className: 'manual-op-section', children: [
                            DOMHelper.create('h3', { textContent: '2. 選擇指派人員' }),
                            personnelSelector.element
                        ]}),
                        DOMHelper.create('div', { className: 'manual-op-footer', children: [
                            DOMHelper.create('button', { id: 'manual-dispatch-btn', className: 'dispatch-btn', textContent: '執行派件' })
                        ]})
                    ]
                });
            }
            
            function _createTabbedPersonnelSelector(defaultUsers) {
                let importedUsers = [];
                const selectorId = `personnel-selector-${Date.now()}`;

                const createRadioList = (users, type) => {
                    const list = DOMHelper.create('ul', { className: 'user-list' });
                    users.forEach(user => {
                        const isSpecial = AppConfig.SPECIAL_ASSIGNEES.includes(user);
                        const li = DOMHelper.create('li', {
                            className: isSpecial ? 'special-assignee' : '',
                            children: [
                                DOMHelper.create('label', {
                                    children: [
                                        DOMHelper.create('input', { type: 'radio', attributes: { name: selectorId, value: user } }),
                                        DOMHelper.create('span', { textContent: user })
                                    ]
                                })
                            ]
                        });
                        list.appendChild(li);
                    });
                    return list;
                };

                const defaultTabContent = createRadioList([...new Set([...AppConfig.SPECIAL_ASSIGNEES, ...defaultUsers])].sort());
                const importTabContent = DOMHelper.create('div', { children: [
                    DOMHelper.create('button', { id: `import-btn-${selectorId}`, className: 'dispatch-btn dispatch-outline small', textContent: '從 .txt 匯入' }),
                    DOMHelper.create('div', { id: `import-list-${selectorId}`, style: { marginTop: '10px' }})
                ]});
                const manualTabContent = DOMHelper.create('input', { id: `manual-input-${selectorId}`, type: 'text', className: 'dispatch-input', attributes: { placeholder: '輸入完整 AD 帳號' } });
                
                const tabs = [
                    { id: 'default', name: '預設清單', content: defaultTabContent },
                    { id: 'import', name: '匯入清單', content: importTabContent },
                    { id: 'manual', name: '人工輸入', content: manualTabContent },
                ];
                
                const tabButtons = tabs.map(tab => DOMHelper.create('button', { textContent: tab.name, attributes: { 'data-tab': tab.id } }));
                const tabContents = tabs.map(tab => {
                    tab.content.classList.add('personnel-tab-content');
                    tab.content.setAttribute('data-tab-content', tab.id);
                    return tab.content;
                });
                
                const element = DOMHelper.create('div', {
                    className: 'personnel-selector',
                    children: [
                        DOMHelper.create('div', { className: 'personnel-tabs', children: tabButtons }),
                        ...tabContents
                    ]
                });

                function setActiveTab(tabId) {
                    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
                    tabContents.forEach(content => content.classList.toggle('active', content.dataset.tabContent === tabId));
                }

                element.querySelector('.personnel-tabs').addEventListener('click', e => {
                    if (e.target.tagName === 'BUTTON') {
                        setActiveTab(e.target.dataset.tab);
                    }
                });

                element.addEventListener('change', e => {
                    if (e.target.type === 'radio') {
                        manualTabContent.value = '';
                    }
                });
                manualTabContent.addEventListener('input', e => {
                    e.target.value = e.target.value.toLowerCase();
                    element.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
                });
                
                importTabContent.querySelector(`#import-btn-${selectorId}`).onclick = async () => {
                    try {
                        const names = Utils.splitTextInput(await Utils.readTxt());
                        if (names.length > 0) {
                            importedUsers = [...new Set(names)].sort();
                            const importListContainer = importTabContent.querySelector(`#import-list-${selectorId}`);
                            importListContainer.innerHTML = '';
                            importListContainer.appendChild(createRadioList(importedUsers, 'import'));
                            UIManager.Toast.show(`成功匯入 ${names.length} 位人員`, 'success');
                        }
                    } catch (e) {
                         if (e.message !== '未選取檔案') UIManager.Toast.show(e.message, 'error');
                    }
                };

                setActiveTab('default');

                return {
                    element,
                    getSelectedValue: () => {
                        const activeTabId = element.querySelector('.personnel-tabs .active').dataset.tab;
                        if (activeTabId === 'manual') {
                            return manualTabContent.value.trim();
                        } else {
                            const selectedRadio = element.querySelector(`input[name="${selectorId}"]:checked`);
                            return selectedRadio ? selectedRadio.value : null;
                        }
                    }
                };
            }

            function _createFooter() {
                if (activeTabId === 'manual' || !viewConfig) return DOMHelper.create('div', { className: 'dispatch-footer' });
                return DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'flex-end' },
                    children: [
                        DOMHelper.create('button', { id: 'next-step-btn', className: 'dispatch-btn', textContent: '下一步 (0)', attributes: { disabled: true } })
                    ]
                });
            }
            
            function _bindEvents(resolve) {
                elements.resolve = resolve;
                _bindHeaderEvents();
                _bindTabEvents();

                if (activeTabId === 'manual') {
                    _bindManualOpEvents();
                } else if(viewConfig) {
                    _bindFilterEvents();
                    _bindTableEvents();
                    _bindFooterEvents();
                }
            }

            function _bindHeaderEvents() {
                elements.modal.querySelector('#config-btn').onclick = (e) => {
                    const menu = elements.modal.querySelector('#config-menu');
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                };
                elements.modal.querySelector('#change-token-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.CHANGE_TOKEN });
                elements.modal.querySelector('#open-new-query-btn').onclick = () => {
                    const currentFilters = {};
                     elements.modal.querySelectorAll('.filter-select').forEach(sel => {
                        if(sel.value) currentFilters[sel.id.replace('filter-','')] = sel.value;
                    });
                    elements.resolve({ action: AppConfig.MODAL_ACTIONS.OPEN_NEW_QUERY, currentFilters });
                };
                elements.modal.querySelector('#clear-cache-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.CLEAR_CACHE });
            }

            function _bindTabEvents() {
                 elements.modal.querySelector('.dispatch-tabs').onclick = (e) => {
                    const target = e.target;
                    if (target.matches('.close-tab-btn')) {
                        e.stopPropagation();
                        elements.resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB, tabId: target.dataset.tabId });
                    } else {
                        const button = target.closest('button[data-tab-id]');
                        if (button && !button.classList.contains('active')) {
                            elements.resolve({ action: AppConfig.MODAL_ACTIONS.SWITCH_TAB, tabId: button.dataset.tabId });
                        }
                    }
                };
            }

            function _bindFilterEvents() {
                elements.modal.querySelector('#toggle-filters-btn').onclick = (e) => {
                    const advancedFilters = elements.modal.querySelector('.advanced-filters');
                    const isHidden = advancedFilters.style.display === 'none' || advancedFilters.style.display === '';
                    advancedFilters.style.display = isHidden ? 'grid' : 'none';
                    e.target.textContent = isHidden ? '隱藏進階篩選' : '顯示更多篩選條件';
                };
                
                const toggleColumnsBtn = elements.modal.querySelector('#toggle-columns-btn');
                if (toggleColumnsBtn) {
                    toggleColumnsBtn.onclick = (e) => {
                        const table = elements.modal.querySelector('#case-table');
                        table.classList.toggle('show-all-columns');
                        e.target.textContent = table.classList.contains('show-all-columns') ? '隱藏部分欄位' : '顯示更多欄位';
                    };
                }
                
                elements.modal.querySelector('#clear-filters-btn').onclick = () => {
                    elements.filterSelects.forEach(sel => sel.value = '');
                    _applyFiltersAndSort();
                };

                elements.modal.querySelector('#export-csv-btn').onclick = () => {
                    if (currentData.length === 0) return UIManager.Toast.show('沒有可匯出的資料', 'warning');
                    const filename = `${viewConfig.type}_案件清單_${new Date().toISOString().slice(0, 10)}.csv`;
                    const csvData = Utils.jsonToCsv(currentData, { dynamicHeaders: viewConfig.type === 'batch' || viewConfig.type === 'query' });
                    Utils.downloadCsv(csvData, filename);
                };

                elements.modal.querySelector('#reload-view-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.RELOAD_VIEW });

                if (isErrorState) {
                    elements.modal.querySelector('#retry-fetch-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.RELOAD_VIEW });
                } else {
                    elements.filterSelects.forEach(select => { select.onchange = _applyFiltersAndSort; });
                }
            }
            
            function _bindManualOpEvents() {
                 const container = elements.modal.querySelector('#manual-op-container');
                 const dispatchBtn = container.querySelector('#manual-dispatch-btn');
                 const casesInput = container.querySelector('#manual-cases-input');
                 const personnelSelector = container.querySelector('.personnel-selector');
                 
                 const getSelectedAssignee = () => {
                    const activeTabId = personnelSelector.querySelector('.personnel-tabs .active').dataset.tab;
                    if (activeTabId === 'manual') {
                        return personnelSelector.querySelector('input[type="text"]').value.trim();
                    } else {
                        const selectorId = personnelSelector.querySelector('input[type="radio"]').name;
                        const selectedRadio = personnelSelector.querySelector(`input[name="${selectorId}"]:checked`);
                        return selectedRadio ? selectedRadio.value : null;
                    }
                 };

                 dispatchBtn.onclick = () => {
                     const cases = Utils.splitTextInput(casesInput.value);
                     if (cases.length === 0) {
                         return UIManager.Toast.show('請輸入至少一個受理號碼', 'error');
                     }
                     
                     const assignee = getSelectedAssignee();
                     if (!assignee) {
                         return UIManager.Toast.show('請選擇或輸入指派人員', 'error');
                     }

                     elements.resolve({ action: AppConfig.MODAL_ACTIONS.MANUAL_DISPATCH, cases, assignee });
                 };
            }

            function _bindTableEvents() {
                if (isErrorState) return;
                elements.table.onclick = e => {
                    const target = e.target;
                    if (target.matches('th[data-key], th[data-key] *')) {
                        const th = target.closest('th[data-key]');
                        const key = th.dataset.key;
                        sortState.order = (sortState.key === key && sortState.order === 'asc') ? 'desc' : 'asc';
                        sortState.key = key;
                        elements.modal.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
                        th.querySelector('.sort-indicator').textContent = sortState.order === 'asc' ? '▲' : '▼';
                        _applyFiltersAndSort();
                    } 
                    else if (target.id === 'select-all-header') {
                        elements.tbody.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = target.checked);
                        _updateNextButton();
                    } 
                    else if (target.matches('.case-checkbox')) {
                        _updateNextButton();
                    }
                    else if (target.tagName === 'TD') {
                        navigator.clipboard.writeText(target.textContent).then(() => UIManager.Toast.show('已複製', 'success', 1000));
                    }
                };
            }

            function _bindFooterEvents() {
                if (isErrorState || !elements.nextBtn) return;
                elements.nextBtn.onclick = () => {
                    const selectedCases = Array.from(elements.modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value);
                    if (selectedCases.length > 0) elements.resolve({ action: AppConfig.MODAL_ACTIONS.NEXT_STEP, selectedCases });
                };
            }

            return UIManager.Modal.show({
                header,
                body,
                footer,
                width: AppConfig.TOOL_CONTAINER_WIDTH,
                onOpen: (modal, resolve) => {
                    elements = {
                        modal,
                        resolve,
                        tbody: modal.querySelector('tbody'),
                        table: modal.querySelector('#case-table'),
                        countElem: modal.querySelector('#case-count'),
                        nextBtn: modal.querySelector('#next-step-btn'),
                        filterSelects: modal.querySelectorAll('.filter-select')
                    };
                    
                    _bindEvents(resolve);
                    
                    if (activeTabId !== 'manual' && viewConfig) {
                        _renderTable(currentData);
                        if (initialFilters && !isErrorState) {
                             _applyFiltersAndSort();
                        }
                    }
                }
            });
        }}

        return { TokenDialog, QueryBuilderDialog, PersonnelSelectDialog, AssignmentResultDialog, ErrorDialog, CaseListView };
    };

    // === 7. 主程式執行器 (AppRunner) ===
    const createAppRunner = (AppConfig, AppState, ApiService, UIComponents, Utils, UIManager) => {
        const state = {
            personalCases: null, 
            batchCases: null, 
            queryTabs: [],
            selectedCases: [], 
            assigneeList: [...AppConfig.DEFAULT_ASSIGNEES] 
        };

        const init = () => {
            UIManager.injectStyle();
            UIManager.initModalContainer();
        };

        const run = async () => {
            init();
            const token = Utils.getStoredToken();
            AppState.set('userToken', token);
            await handleMainView();
        };
        
        const _getBatchDefaultFilters = () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 10);
            
            return {
                ...AppConfig.DEFAULT_FILTERS.batch,
                applyDateStart: Utils.formatDateTime(startDate),
                applyDateEnd: Utils.formatDateTime(endDate)
            };
        };
        
        const _generateFilterOptions = (caseList, mode) => {
            const options = {};
            const config = AppConfig.FILTER_CONFIG;
            const keys = new Set(mode === 'personal' 
              ? [...config.personal_common, ...config.personal_advanced]
              : [...config.batch_common, ...config.batch_advanced]
            );
            
            keys.forEach(key => {
                const uniqueValues = new Set();
                caseList.forEach(item => {
                    const value = item[key];
                    if (value !== null && value !== undefined && value !== '') {
                        if (key.toLowerCase().includes('date')) {
                            uniqueValues.add(String(value).split(' ')[0]);
                        } else {
                            uniqueValues.add(String(value));
                        }
                    }
                });
                options[key] = [...uniqueValues].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            });
            return options;
        };

        async function fetchCases(mode, filters) {
             const apiCall = mode === 'personal' 
                ? () => ApiService.fetchPersonalCases(filters)
                : () => ApiService.fetchBatchCases(filters);
            try {
                let cases = await apiCall();
                
                cases.sort((a, b) => {
                    const applyNumberCompare = String(b.applyNumber ?? '').localeCompare(String(a.applyNumber ?? ''), undefined, { numeric: true });
                    if (applyNumberCompare !== 0) return applyNumberCompare;
                    const policyNumberCompare = String(b.policyNumber ?? '').localeCompare(String(a.policyNumber ?? ''), undefined, { numeric: true });
                    if (policyNumberCompare !== 0) return policyNumberCompare;
                    return new Date(b.applyDate).getTime() - new Date(a.applyDate).getTime();
                });
                
                return { data: cases };
            } catch (error) {
                return { error };
            }
        }

        async function handleMainView(opts = {}) {
            const { forceFetch = false, targetTabId } = opts;
            const activeTabId = targetTabId || AppState.get('activeTabId');
            AppState.set('activeTabId', activeTabId);

            let tabData, currentViewConfig, filterOptions = {}, initialFilters = null, error = null, queryInfo = null;

            if (activeTabId === 'personal') {
                if (state.personalCases === null || forceFetch) {
                    const result = await fetchCases('personal', {});
                    if (result.error) { error = result.error; } else { state.personalCases = result.data; }
                }
                tabData = state.personalCases;
                currentViewConfig = AppConfig.PERSONAL_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'personal');
            } else if (activeTabId === 'batch') {
                if (state.batchCases === null || forceFetch) {
                    initialFilters = _getBatchDefaultFilters();
                    const result = await fetchCases('batch', initialFilters);
                    if (result.error) { error = result.error; } else { state.batchCases = result.data; }
                }
                tabData = state.batchCases;
                currentViewConfig = AppConfig.BATCH_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'batch');
            } else if (activeTabId === 'manual') {
                tabData = [];
            } else {
                const queryTab = state.queryTabs.find(t => t.id === activeTabId);
                if (queryTab) {
                    tabData = queryTab.data;
                    currentViewConfig = { ...AppConfig.BATCH_VIEW_CONFIG, type: 'query' };
                    filterOptions = _generateFilterOptions(tabData, 'batch');
                    queryInfo = queryTab.filters;
                }
            }
            
            const res = await UIComponents.CaseListView.show({
                tabs: [
                    { id: 'personal', name: '個人案件' },
                    { id: 'batch', name: '批次案件' },
                    { id: 'manual', name: '人工執行' },
                    ...state.queryTabs.map(t => ({ id: t.id, name: t.name, canClose: true }))
                ],
                activeTabId,
                caseList: tabData || [],
                error,
                viewConfig: currentViewConfig,
                filterOptions,
                initialFilters,
                assigneeList: state.assigneeList,
                queryInfo
            });

            switch (res?.action) {
                case AppConfig.MODAL_ACTIONS.SWITCH_TAB: await handleMainView({ targetTabId: res.tabId }); break;
                case AppConfig.MODAL_ACTIONS.RELOAD_VIEW: await handleMainView({ forceFetch: true }); break;
                case AppConfig.MODAL_ACTIONS.OPEN_NEW_QUERY: await handleNewQuery(res.currentFilters); break;
                case AppConfig.MODAL_ACTIONS.CLEAR_CACHE: await handleClearCache(); break;
                case AppConfig.MODAL_ACTIONS.CHANGE_TOKEN: await handleTokenChange(); break;
                case AppConfig.MODAL_ACTIONS.NEXT_STEP: state.selectedCases = res.selectedCases; await handlePersonnelSelection(); break;
                case AppConfig.MODAL_ACTIONS.MANUAL_DISPATCH: await handleAssignment(res.assignee, res.cases); break;
                case AppConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB:
                    state.queryTabs = state.queryTabs.filter(t => t.id !== res.tabId);
                    await handleMainView({ targetTabId: 'batch' });
                    break;
                case AppConfig.MODAL_ACTIONS.BACK: await handleMainView(); break;
                case AppConfig.MODAL_ACTIONS.CLOSE: default: UIManager.Modal.hide(); break;
            }
        }

        async function handleTokenChange() {
             const res = await UIComponents.TokenDialog.show({ mode: 'revalidate' });
            if (res?.action === AppConfig.MODAL_ACTIONS.CONFIRM) {
                AppState.set('userToken', res.value);
                state.personalCases = null; state.batchCases = null; state.queryTabs = [];
                await handleMainView({ forceFetch: true });
            }
        }
        
        async function handleNewQuery(currentFilters) {
            const dynamicDefaults = _getBatchDefaultFilters();
            const res = await UIComponents.QueryBuilderDialog.show({
                dynamicBatchDefaults,
                currentFilters
            });
            
            if (res?.action === AppConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS) {
                UIManager.Progress.show('正在執行新查詢...');
                const queryFilters = res.payload.batch;
                const result = await fetchCases('batch', queryFilters);
                UIManager.Progress.hide();

                if (result.data) {
                    const newTabId = `query_${Date.now()}`;
                    state.queryTabs.push({
                        id: newTabId,
                        name: `查詢結果 ${state.queryTabs.length + 1}`,
                        data: result.data,
                        filters: queryFilters
                    });
                    await handleMainView({ targetTabId: newTabId });
                } else if(result.error && result.error.name !== 'AbortError') {
                    await UIComponents.ErrorDialog.show({ error: result.error });
                }
            } else if (res?.action === AppConfig.MODAL_ACTIONS.RESET_AND_RELOAD) {
                state.batchCases = null;
                await handleMainView({ forceFetch: true, targetTabId: 'batch' });
            }
        }

        async function handleClearCache() {
            if (confirm('您確定要清除所有「查詢結果」頁籤嗎？\n此操作不會影響「個人」與「批次」案件列表。')) {
                state.queryTabs = [];
                UIManager.Toast.show('已清除所有查詢頁籤', 'success');
                const newTabId = ['personal', 'batch', 'manual'].includes(AppState.get('activeTabId')) ? AppState.get('activeTabId') : 'batch';
                await handleMainView({ targetTabId: newTabId });
            }
        }

        async function handlePersonnelSelection() {
            const res = await UIComponents.PersonnelSelectDialog.show({
                selectedCount: state.selectedCases.length,
                defaultUsers: state.assigneeList
            });

            if (res?.action === AppConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT) {
                await handleAssignment(res.assignee);
            } else if (res?.action === AppConfig.MODAL_ACTIONS.BACK) {
                await handleMainView();
            }
        }

        async function handleAssignment(assignee, cases) {
            const casesToDispatch = cases || state.selectedCases;
            if (casesToDispatch.length === 0) {
                UIManager.Toast.show('沒有選擇任何案件', 'warning');
                return;
            }
            
            UIManager.Progress.show(`正在派件 ${casesToDispatch.length} 筆案件給 ${assignee}`);
            try {
                const apiResult = await ApiService.manualAssign(casesToDispatch, assignee);
                UIManager.Progress.hide();
                
                const resDialog = await UIComponents.AssignmentResultDialog.show({
                    successful: apiResult.successful,
                    failed: apiResult.failed,
                    assignee: assignee
                });
                
                if (apiResult.successful.length > 0 && resDialog.action === AppConfig.MODAL_ACTIONS.CLOSE) {
                    state.personalCases = null;
                    state.batchCases = null;
                    state.queryTabs = [];
                    await handleMainView({ forceFetch: true, targetTabId: 'batch' });
                }

            } catch (error) {
                if (error.name !== 'AbortError') {
                    UIManager.Progress.hide();
                    const res = await UIComponents.ErrorDialog.show({ error });
                     if (res?.action === AppConfig.MODAL_ACTIONS.BACK) {
                        await handleMainView();
                    }
                }
            }
        }

        return { run };
    };

    /**
     * =========================================================================
     * II. 應用程式啟動區 (Application Bootstrap)
     * =========================================================================
     */
    try {
        const utils = createUtils(AppConfig);
        const uiManager = createUIManager(AppConfig, AppState, utils, DOMHelper);
        const apiService = createApiService(AppConfig, AppState, uiManager);
        const uiComponents = createUIComponents(AppConfig, uiManager, utils, DOMHelper); 
        const app = createAppRunner(AppConfig, AppState, apiService, uiComponents, utils, uiManager);
        app.run();
    } catch (e) {
        console.error('致命錯誤：', e);
        const containerId = typeof AppConfig !== 'undefined' ? AppConfig.TOOL_CONTAINER_ID : 'dispatch-tool-container-v15';
        document.getElementById(containerId)?.remove();
        document.getElementById('dispatch-mask')?.remove();
        document.getElementById('dispatch-progress')?.remove();
        alert(`腳本發生致命錯誤，請檢查控制台以獲取詳細資訊：\n${e.message}`);
    }
})();
