javascript: (() => {
    /**
     * =================================================================================
     * 案件清單作業 - v0808v2 (穩定性修正版)
     * =================================================================================
     * @version     0808v2
     * @description
     * [穩定性修復] 徹底修復了因「手動派件」頁籤邏輯重構引入的變數範圍與遞迴呼叫錯誤，解決了啟動後閃退的問題。
     * [功能調整] 確認移除「送件單位代碼」與「最後編輯時間」的篩選/查詢功能，但保留其在列表中的顯示。
     * [介面重構] 「手動派件」頁籤採用全新的「牌卡式按鈕」介面選擇派件人員。
     * [樣式修正] 修正了查詢頁籤關閉按鈕的樣式，改為滑鼠懸停時顯示。
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
            VERSION: '0808v2',
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
                OPEN_NEW_QUERY_WITH_DEFAULTS: 'open_new_query_with_defaults',
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
                select: { label: "選取", key: "select" },
                seq: { label: "序號", key: "seq" },
                applyDate: { label: "受理日", key: "applyDate", type: "date" },
                applyNumber: { label: "受理號碼", key: "applyNumber" },
                policyNumber: { label: "保單號碼", key: "policyNumber" },
                ownerName: { label: "要保人", key: "ownerName" },
                insuredName: { label: "主被保險人", key: "insuredName" },
                mainStatus: { label: "主狀態", key: "mainStatus" },
                subStatus: { label: "次狀態", key: "subStatus" },
                currency: { label: "幣別", key: "currency" },
                currentOwner: { label: "目前人員", key: "currentOwner" },
                channel: { label: "業務來源", key: "channel" },
                agencyCode: { label: "送件單位代碼", key: "agencyCode" },
                polpln: { label: "險種名稱", key: "polpln" },
                confrmno: { label: "確認書編號", key: "confrmno" },
                lastModifiedDate: { label: "最後編輯時間", key: "lastModifiedDate", type: "date" },
                caseId: { label: "caseid", key: "caseId" },
                ownerTaxId: { label: "要保人id", key: "ownerTaxId" },
                insuredTaxId: { label: "被保人id", key: "insuredTaxId" },
                overpay: { label: "應繳保費", key: "overpay" },
                planCodeName: { label: "險種名稱", key: "planCodeName" },
                pool: { label: "Pool", key: "pool" },
                poolStatus: { label: "Pool狀態", key: "poolStatus" },
                uwLevel: { label: "核保判級", key: "uwLevel" },
                firstBillingMethod: { label: "首期繳費方式", key: "firstBillingMethod" },
                applyDateStart: { label: "受理開始日期", key: "applyDateStart" },
                applyDateEnd: { label: "受理結束日期", key: "applyDateEnd" }
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
                batch_common: ['applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'currency', 'currentOwner', 'channel'],
                batch_advanced: ['subStatus', 'polpln', 'confrmno', 'caseId', 'ownerTaxId', 'insuredTaxId']
            },
            QUERY_CONFIG: {
                 common: ['applyDateStart', 'applyDateEnd', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'currency', 'currentOwner', 'channel'],
                 advanced: ['subStatus', 'polpln', 'confrmno', 'caseId', 'ownerTaxId', 'insuredTaxId']
            },
            DEFAULT_FILTERS: {
                personal: {},
                batch: {
                    mainStatus: '2',
                    currentOwner: ''
                }
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
            abortController: null,
            isLoading: false,
            activeTabId: 'personal'
        };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => {
                (typeof k === 'object') ? Object.assign(state, k): state[k] = v;
            },
            createAbortSignal: () => (state.abortController = new AbortController()).signal,
            abortRequest: () => {
                state.abortController?.abort();
                state.abortController = null;
            }
        };
    })();

    // === 3. 工具函式模組 (Utils) ===
    const createUtils = (appConfig) => ({
        escapeHtml: (str) => {
            if (str === null || str === undefined) return '';
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(str).replace(/[&<>"']/g, m => map[m]);
        },
        getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(appConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
        jsonToCsv: (items, { dynamicHeaders = false } = {}) => {
            if (!items || items.length === 0) return '';
            const headers = dynamicHeaders ? [...items.reduce((acc, item) => (Object.keys(item).forEach(key => acc.add(key)), acc), new Set())] : Object.keys(items[0]);
            const headerRow = headers.map(h => JSON.stringify(h)).join(',');
            const rows = items.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','));
            return [headerRow, ...rows].join('\r\n');
        },
        downloadCsv: (csv, filename) => {
            const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: filename,
                style: 'visibility:hidden'
            });
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        formatDisplayDate: (d) => (d && typeof d === 'string') ? d.split(' ')[0] : '',
        formatDateTime: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} 00:00:00`,
        parseDate: (input) => {
            if (!input || !String(input).trim()) return { display: '', full: '' };
            const str = String(input).trim();
            let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/) || str.match(/^(\d{4})(\d{2})(\d{2})$/);
            if (match) {
                const [, year, month, day] = match;
                const display = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
            const input = Object.assign(document.createElement('input'), {
                type: 'file',
                accept: '.txt',
                style: 'display:none'
            });
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return reject(new Error('未選取檔案'));
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => reject(new Error('檔案讀取失敗'));
                reader.readAsText(file);
            };
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        }),
        splitTextInput: (text) => text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean)
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
    const createUIManager = (appConfig, appState, utils, domHelper) => {
        function injectStyle() {
            if (document.getElementById(appConfig.STYLE_ELEMENT_ID)) return;
            const style = domHelper.create('style', {
                id: appConfig.STYLE_ELEMENT_ID,
                textContent: `
                    :root { --primary-color: #007bff; --primary-dark: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
                    .dispatch-mask { position: fixed; z-index: ${appConfig.ZINDEX.MASK}; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; pointer-events: none; }
                    .dispatch-mask.show { opacity: 1; }
                    .dispatch-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.15); padding:0; position: fixed;
                    top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: ${appConfig.ZINDEX.MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity .18s; max-height: 90vh;
                    max-width: 95vw; box-sizing: border-box; pointer-events: none; }
                    .dispatch-modal.show { opacity: 1; pointer-events: auto; } .dispatch-modal.dragging { transition: none !important; }
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
                    .dispatch-toast { position:fixed; left:50%; top:30px; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 22px; border-radius:6px; font-size:16px; z-index:${appConfig.ZINDEX.TOAST}; opacity:0; transition:.3s; }
                    .dispatch-toast.show { opacity:1; }
                    .dispatch-progress { position:fixed; inset:0; background:rgba(255,255,255,0.8); z-index:${appConfig.ZINDEX.TOAST}; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:1.2rem; font-weight:bold; }
                    .dispatch-progress button { margin-top:20px; }
                    .dispatch-tabs { margin-bottom:15px; border-bottom:1px solid #ccc; display:flex; flex-wrap: wrap; }
                    .dispatch-tabs button { background:transparent; border:none; padding:10px 15px; cursor:pointer; font-size:16px; border-bottom:3px solid transparent; margin-bottom:-1px; position: relative; padding-right: 25px; }
                    .dispatch-tabs button.active { font-weight:bold; color:var(--primary-color); border-bottom-color:var(--primary-color); }
                    .dispatch-tabs button .close-tab-btn { position: absolute; top: 50%; transform: translateY(-50%); right: 5px; width: 18px; height: 18px; border-radius: 50%; border: none; background-color: #ccc; color: white; font-size: 12px; line-height: 1; text-align: center; cursor: pointer; display:flex; align-items:center; justify-content:center; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
                    .dispatch-tabs button:hover .close-tab-btn { opacity: 1; pointer-events: auto; }
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
                    .config-menu { position: absolute; top: 52px; left: 10px; background: #fff; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10; padding: 5px 0; display: none; }
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
                    .manual-op-container { display: flex; flex-direction: row; gap: 15px; padding: 10px 0; height: 100%; flex-grow: 1; }
                    .manual-op-section { border: 1px solid #ccc; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; flex: 1; min-width: 0; }
                    .manual-op-section .section-header { display: flex; justify-content: space-between; align-items: center; }
                    .manual-op-section h3 { margin-top: 0; margin-bottom: 10px; }
                    .manual-op-section textarea { flex-grow: 1; resize: vertical; min-height: 150px; }
                    .personnel-selector-cards { display: flex; gap: 8px; margin-bottom: 12px; }
                    .personnel-selector-cards .card-btn { flex: 1; padding: 8px 12px; font-size: 14px; border: 1px solid #ccc; background-color: #f8f8f8; cursor: pointer; border-radius: 5px; transition: background-color 0.2s, border-color 0.2s; }
                    .personnel-selector-cards .card-btn.active { background-color: #e7f1ff; border-color: var(--primary-color); font-weight: bold; }
                    .personnel-selector-content { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .personnel-selector-pane { display: none; height: 100%; flex-direction: column; }
                    .personnel-selector-pane.active { display: flex; }
                    .personnel-radio-list { list-style: none; padding: 0; margin: 0; flex-grow: 1; overflow-y: auto; border: 1px solid #eee; padding: 5px; border-radius: 5px; }
                    .personnel-radio-list label { display: block; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; }
                    .personnel-radio-list label:hover { background-color: #f0f0f0; }
                    .personnel-radio-list input[type="radio"] { margin-right: 8px; }
                    .query-criteria-display { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 13px; line-height: 1.6; word-break: break-all; }
                    .query-criteria-display strong { color: var(--primary-color); }
                `
            });
            document.head.appendChild(style);
        }

        const Toast = {
            show: (msg, type = 'success', duration = 2100) => {
                document.querySelector('.dispatch-toast')?.remove();
                const toastElement = domHelper.create('div', {
                    className: `dispatch-toast ${type}`,
                    textContent: msg,
                    style: { background: `var(--${type}-color, #555)` }
                });
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
                const stopButton = domHelper.create('button', {
                    id: 'stop-query',
                    className: 'dispatch-btn dispatch-outline',
                    textContent: '停止查詢',
                    events: {
                        click: () => {
                            appState.abortRequest();
                            this.hide();
                            Toast.show('查詢已中斷', 'warning');
                        }
                    }
                });
                const progressElement = domHelper.create('div', {
                    id: 'dispatch-progress',
                    className: 'dispatch-progress',
                    children: [domHelper.create('div', { textContent: utils.escapeHtml(text) }), stopButton]
                });
                document.body.appendChild(progressElement);
            },
            update(percent, text) {
                const progressText = document.getElementById('dispatch-progress')?.querySelector('div:first-child');
                if (progressText) {
                    progressText.innerHTML = `<div>${utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
                }
            },
            hide() {
                document.getElementById('dispatch-progress')?.remove();
            }
        };

        const Modal = (() => {
            const dragState = { active: false, sX: 0, sY: 0, iL: 0, iT: 0 };
            const handleEsc = (e) => { if (e.key === 'Escape') Modal.hide(); };

            function dragStart(e) {
                const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
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
                const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                if (modal) {
                    modal.style.left = `${dragState.iL + e.clientX - dragState.sX}px`;
                    modal.style.top = `${dragState.iT + e.clientY - dragState.sY}px`;
                    modal.style.transform = 'none';
                }
            }

            function stopDrag() {
                dragState.active = false;
                document.getElementById(appConfig.TOOL_CONTAINER_ID)?.classList.remove('dragging');
                document.removeEventListener('mousemove', doDrag);
            }

            return {
                hide() {
                    const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                    if (modal) {
                         modal.classList.remove('show');
                         modal.addEventListener('transitionend', () => {
                             if(!modal.classList.contains('show')) modal.style.display = 'none';
                         }, { once: true });
                    }
                    document.getElementById('dispatch-mask')?.classList.remove('show');
                    appState.abortRequest();
                    document.removeEventListener('keydown', handleEsc);
                },
                show(opts) {
                    return new Promise(resolve => {
                        const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                        if (!modal) return resolve({ action: appConfig.MODAL_ACTIONS.CLOSE });
                        
                        const isAlreadyVisible = modal.classList.contains('show');
                        modal.style.display = 'flex';
                        requestAnimationFrame(() => {
                           document.getElementById('dispatch-mask')?.classList.add('show');
                           modal.classList.add('show');
                        });

                        modal.innerHTML = '';
                        const header = domHelper.create('div', { className: 'dispatch-header', innerHTML: opts.header });
                        const closeButton = domHelper.create('button', {
                            className: 'dispatch-close',
                            innerHTML: '&times;',
                            events: {
                                click: () => {
                                    Modal.hide();
                                    resolve({ action: appConfig.MODAL_ACTIONS.CLOSE });
                                }
                            }
                        });
                        header.appendChild(closeButton);
                        modal.append(header, opts.body, opts.footer);

                        if (!isAlreadyVisible) {
                             Object.assign(modal.style, {
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)'
                            });
                            modal.style.width = opts.width || 'auto';
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
            if (document.getElementById(appConfig.TOOL_CONTAINER_ID)) return;
            const container = domHelper.create('div', { id: appConfig.TOOL_CONTAINER_ID, className: 'dispatch-modal' });
            const mask = domHelper.create('div', { id: 'dispatch-mask', className: 'dispatch-mask' });
            document.body.append(container, mask);
        }

        return { injectStyle, Toast, Progress, Modal, initModalContainer };
    };

    // === 5. API 服務模組 (ApiService) ===
    const createApiService = (appConfig, appState, uiManager) => {
        async function _fetch(url, options) {
            const token = appState.get('userToken');
            if (!token) throw new Error('TOKEN無效或過期');
            const fetchOptions = {
                ...options,
                headers: { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' },
                signal: appState.createAbortSignal()
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
            let allRecords = [], page = 1, totalPages = 1;
            uiManager.Progress.show(`載入${listName}中...`);
            try {
                const firstPageData = await _fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ ...payload, pageIndex: page, size: appConfig.BATCH_PAGE_SIZE })
                });
                if (firstPageData?.records?.length > 0) {
                    allRecords = allRecords.concat(firstPageData.records);
                    if (firstPageData.total > appConfig.BATCH_PAGE_SIZE) totalPages = Math.ceil(firstPageData.total / appConfig.BATCH_PAGE_SIZE);
                } else {
                    uiManager.Progress.hide();
                    return [];
                }
                if (totalPages > 1) {
                    const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                    const pageChunks = [];
                    for (let i = 0; i < pagesToFetch.length; i += appConfig.CONCURRENT_API_LIMIT) pageChunks.push(pagesToFetch.slice(i, i + appConfig.CONCURRENT_API_LIMIT));
                    for (const chunk of pageChunks) {
                        const promises = chunk.map(p => _fetch(endpoint, {
                            method: 'POST',
                            body: JSON.stringify({ ...payload, pageIndex: p, size: appConfig.BATCH_PAGE_SIZE })
                        }));
                        const results = await Promise.all(promises);
                        results.forEach(res => { if (res?.records?.length > 0) allRecords.push(...res.records); });
                        const loadedCount = allRecords.length, totalCount = firstPageData.total, percent = Math.round(100 * loadedCount / totalCount);
                        uiManager.Progress.update(percent, `載入${listName}中... ${loadedCount}/${totalCount} 筆`);
                    }
                }
                uiManager.Progress.hide();
                return allRecords;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    uiManager.Progress.hide();
                    console.error(`[ApiService] Fetch failed for ${listName}:`, error);
                }
                throw error;
            }
        }
        return {
            fetchPersonalCases: (filters) => fetchAllPages(appConfig.API.QUERY_PERSONAL, filters, '個人案件'),
            fetchBatchCases: (filters) => fetchAllPages(appConfig.API.QUERY_BATCH, filters, '批次案件'),
            manualAssign: async (applyNumbers, assignee) => {
                const response = await _fetch(appConfig.API.MANUAL_ASSIGN, {
                    method: 'POST',
                    body: JSON.stringify({
                        dispatchOrgAf: 'H',
                        auditorAf: assignee,
                        dispatchOrgBf: '',
                        applyNumbers
                    })
                });
                const successfulCases = response?.assignSuccess ?? [];
                const failedCases = (response?.assignFail ?? [])
                    .filter(item => item && item.caseId)
                    .map(failItem => ({
                        caseId: failItem.caseId,
                        reason: failItem.errorMsg || '未知原因'
                    }));
                return { successful: successfulCases, failed: failedCases };
            }
        };
    };

    // === 6. UI 元件模組 (UIComponents) ===
    const createUIComponents = (appConfig, uiManager, utils, domHelper) => {
        const TokenDialog = {
            show: (opts = {}) => {
                const { mode } = opts;
                const isRevalidateMode = mode === 'revalidate';
                return uiManager.Modal.show({
                    header: `重新驗證TOKEN (${appConfig.ENV})`,
                    width: '450px',
                    body: domHelper.create('div', {
                        className: 'dispatch-body',
                        children: [
                            domHelper.create('p', { textContent: '請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。', style: { marginTop: '0' } }),
                            domHelper.create('textarea', { id: 'token-input', className: 'dispatch-input', attributes: { rows: '4' }, style: { fontFamily: 'monospace' } })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: isRevalidateMode ? 'space-between' : 'flex-end', padding: '12px 20px 16px' },
                        children: [
                            ...(isRevalidateMode ? [domHelper.create('button', { id: 'auto-check-btn', className: 'dispatch-btn dispatch-outline', textContent: '自動檢核' })] : []),
                            domHelper.create('button', { id: 'confirm-token-btn', className: 'dispatch-btn', textContent: '確認' })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        const tokenInput = modal.querySelector('#token-input');
                        if (isRevalidateMode) {
                            modal.querySelector('#auto-check-btn').onclick = () => {
                                const storedToken = utils.getStoredToken();
                                if (storedToken) {
                                    uiManager.Toast.show('已自動檢核並儲存 Token', 'success');
                                    resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM, value: storedToken });
                                } else {
                                    uiManager.Toast.show('在瀏覽器中未找到 Token', 'warning');
                                }
                            };
                        }
                        modal.querySelector('#confirm-token-btn').onclick = () => {
                            const value = tokenInput.value.trim();
                            if (value) resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM, value });
                            else uiManager.Toast.show('Token 不可為空', 'error');
                        };
                    }
                });
            }
        };

        const QueryBuilderDialog = {
            show: (opts = {}) => {
                const { initialData = {} } = opts;
                let allFieldsVisible = false;

                const createForm = (presets) => {
                    const formContainer = domHelper.create('div', { className: 'preset-form' });
                    const commonKeys = appConfig.QUERY_CONFIG.common;
                    const advancedKeys = appConfig.QUERY_CONFIG.advanced;
                    const displayedKeys = new Set([...commonKeys, ...advancedKeys]);
                    
                    const createInput = (key) => {
                        const def = appConfig.COLUMN_DEFINITIONS[key];
                        if (!def) return null;
                        const value = presets[key] ?? '';
                        const parsedDate = utils.parseDate(value);
                        const input = domHelper.create('input', {
                            type: 'text',
                            id: `preset-batch-${key}`,
                            className: 'dispatch-input',
                            attributes: {
                                value: utils.escapeHtml(parsedDate.display),
                                'data-full-value': utils.escapeHtml(parsedDate.full)
                            }
                        });
                        if (key.toLowerCase().includes('date')) {
                            input.addEventListener('blur', (e) => {
                                const formatted = utils.parseDate(e.target.value);
                                e.target.value = formatted.display;
                                e.target.dataset.fullValue = formatted.full;
                            });
                        }
                        return domHelper.create('div', { children: [domHelper.create('label', { textContent: `${def.label}:`, style: { fontSize: '14px', display: 'block' } }), input] });
                    };
                    
                    const commonInputs = commonKeys.map(createInput).filter(Boolean);
                    const advancedInputs = advancedKeys.map(createInput).filter(Boolean);
                    const commonCol = domHelper.create('div', { className: 'preset-form-col', children: [domHelper.create('h3', { textContent: '常用查詢' }), ...commonInputs] });
                    const advancedCol = domHelper.create('div', { className: 'preset-form-col', children: [domHelper.create('h3', { textContent: '進階查詢' }), ...advancedInputs] });
                    formContainer.append(commonCol, advancedCol);
                    
                    if (allFieldsVisible) {
                        const otherKeys = Object.keys(appConfig.COLUMN_DEFINITIONS).filter(k => 
                            !displayedKeys.has(k) && !['select', 'seq', 'agencyCode', 'lastModifiedDate'].includes(k)
                        );
                        const otherInputs = otherKeys.map(createInput).filter(Boolean);
                        if(otherInputs.length > 0) {
                            formContainer.appendChild(domHelper.create('div', { className: 'preset-form-col', children: [domHelper.create('h3', { textContent: '其他欄位' }), ...otherInputs] }));
                        }
                    }
                    return formContainer;
                };

                const body = domHelper.create('div', { className: 'dispatch-body' });
                body.appendChild(createForm(initialData));
                body.appendChild(domHelper.create('button', { id: 'load-more-filters-btn', textContent: '載入更多查詢欄位', className: 'dispatch-btn dispatch-outline small', style: { marginTop: '10px' } }));

                return uiManager.Modal.show({
                    header: '開啟新查詢',
                    width: '900px',
                    body,
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                        children: [
                            domHelper.create('button', { id: 'reset-defaults-btn', className: 'dispatch-btn dispatch-outline', textContent: '恢復預設值' }),
                            domHelper.create('div', {
                                children: [
                                    domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回', style: { marginRight: '10px' } }),
                                    domHelper.create('button', { id: 'apply-filters-btn', className: 'dispatch-btn', textContent: '套用並查詢' }),
                                ]
                            })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#load-more-filters-btn').onclick = (e) => {
                            allFieldsVisible = true;
                            const currentValues = {};
                            modal.querySelectorAll('.dispatch-input').forEach(input => {
                                const key = input.id.replace('preset-batch-', '');
                                currentValues[key] = input.dataset.fullValue || input.value;
                            });
                            modal.querySelector('.preset-form').remove();
                            modal.querySelector('.dispatch-body').prepend(createForm(currentValues));
                            e.target.style.display = 'none';
                        };
                        modal.querySelector('#apply-filters-btn').onclick = () => {
                            const payload = { batch: {} };
                            modal.querySelectorAll('.dispatch-input').forEach(input => {
                                const key = input.id.replace('preset-batch-', '');
                                const value = input.dataset.fullValue || input.value.trim();
                                if (value) { payload.batch[key] = value; }
                            });
                            resolve({ action: appConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS, payload });
                        };
                        modal.querySelector('#reset-defaults-btn').onclick = () => { resolve({ action: appConfig.MODAL_ACTIONS.RESET_AND_RELOAD }); };
                        modal.querySelector('#back-btn').onclick = () => { resolve({ action: appConfig.MODAL_ACTIONS.CLOSE }); };
                    }
                });
            }
        };

        const PersonnelSelectDialog = {
            show: (opts) => {
                const { selectedCount, defaultUsers } = opts;
                return uiManager.Modal.show({
                    header: '選擇指派人員',
                    width: '450px',
                    body: domHelper.create('div', {
                        className: 'dispatch-body',
                        children: [
                            domHelper.create('p', { innerHTML: `已選取 <strong>${selectedCount}</strong> 筆案件，請選擇或輸入指派人員：`, style: { marginTop: '0' } }),
                            domHelper.create('div', {
                                style: { display: 'flex', alignItems: 'center', gap: '10px' },
                                children: [
                                    domHelper.create('select', { id: 'assignee-select', className: 'dispatch-input', style: { flexGrow: '1', marginTop: '0' } }),
                                    domHelper.create('button', { id: 'import-personnel-btn', className: 'dispatch-btn dispatch-outline small', textContent: '匯入人員' })
                                ]
                            }),
                            domHelper.create('div', {
                                style: { marginTop: '15px' },
                                children: [
                                    domHelper.create('label', { style: { cursor: 'pointer' }, children: [
                                        domHelper.create('input', { type: 'checkbox', id: 'manual-assignee-checkbox' }),
                                        domHelper.create('span', { textContent: ' 或手動輸入帳號' })
                                    ]}),
                                    domHelper.create('input', { type: 'text', id: 'manual-assignee-input', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號' }, style: { display: 'none' } })
                                ]
                            })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                        children: [
                            domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回上一步' }),
                            domHelper.create('button', { id: 'confirm-assignment-btn', className: 'dispatch-btn', textContent: '確認指派', attributes: { disabled: true } })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        const selectEl = modal.querySelector('#assignee-select');
                        const importBtn = modal.querySelector('#import-personnel-btn');
                        const manualCheckbox = modal.querySelector('#manual-assignee-checkbox');
                        const manualInput = modal.querySelector('#manual-assignee-input');
                        const confirmBtn = modal.querySelector('#confirm-assignment-btn');
                        let currentPersonnelList = [...defaultUsers];
                        const populateSelect = (list) => {
                            const uniqueList = [...new Set(list)];
                            const specialUsers = [], regularUsers = [];
                            uniqueList.forEach(user => { appConfig.SPECIAL_ASSIGNEES.includes(user) ? specialUsers.push(user) : regularUsers.push(user); });
                            specialUsers.sort();
                            regularUsers.sort();
                            const specialOptions = specialUsers.map(u => `<option value="${utils.escapeHtml(u)}" class="special-assignee">${utils.escapeHtml(u)}</option>`);
                            const regularOptions = regularUsers.map(u => `<option value="${utils.escapeHtml(u)}">${utils.escapeHtml(u)}</option>`);
                            selectEl.innerHTML = [...specialOptions, ...regularOptions].join('');
                        };
                        const updateConfirmBtnState = () => { confirmBtn.disabled = !(manualCheckbox.checked ? manualInput.value.trim() !== '' : !!selectEl.value); };
                        const handleImport = async () => {
                            try {
                                const importedNames = utils.splitTextInput(await utils.readTxt());
                                if (importedNames.length > 0) {
                                    currentPersonnelList = [...new Set([...currentPersonnelList, ...importedNames])];
                                    populateSelect(currentPersonnelList);
                                    uiManager.Toast.show(`成功匯入 ${importedNames.length} 位人員`, 'success');
                                }
                            } catch (e) {
                                if (e.message !== '未選取檔案') uiManager.Toast.show(e.message, 'error');
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
                        modal.querySelector('#back-btn').onclick = () => resolve({ action: appConfig.MODAL_ACTIONS.BACK });
                        confirmBtn.onclick = () => {
                            const assignee = manualCheckbox.checked ? manualInput.value.trim() : selectEl.value;
                            if (!assignee) return uiManager.Toast.show('請選擇或輸入指派人員', 'error');
                            resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT, assignee });
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
                    domHelper.create('p', { innerHTML: `已完成對 <strong>${utils.escapeHtml(assignee)}</strong> 的派件操作。` }),
                    domHelper.create('p', { innerHTML: `派發總案件數: ${totalCount} 筆`, style: { fontWeight: 'bold' } }),
                    domHelper.create('p', { innerHTML: `成功 ${successful.length} 筆，失敗 ${failed.length} 筆。`, style: { color: hasFailures ? 'var(--warning-color)' : 'var(--success-color)' } })
                ];
                if (failed.length > 0) {
                    bodyChildren.push(domHelper.create('div', { style: { marginTop: '15px' }, children: [
                        domHelper.create('strong', { textContent: '失敗詳情：' }),
                        domHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '5', readonly: true }, style: { fontSize: '12px', background: '#f8f8f8' }, textContent: failed.map(f => `受理號碼: ${utils.escapeHtml(f.caseId)}\n原因: ${utils.escapeHtml(f.reason)}`).join('\n\n') })
                    ] }));
                }
                if (successful.length > 0 && failed.length > 0) {
                    bodyChildren.push(domHelper.create('div', { style: { marginTop: '10px' }, children: [
                        domHelper.create('strong', { textContent: '成功列表：' }),
                        domHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '3', readonly: true }, style: { fontSize: '12px' }, textContent: successful.map(utils.escapeHtml).join('\n') })
                    ] }));
                }
                return uiManager.Modal.show({
                    header: hasFailures ? '派件部分成功' : '派件成功',
                    width: '500px',
                    body: domHelper.create('div', { className: 'dispatch-body', children: bodyChildren }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: 'flex-end' },
                        children: [domHelper.create('button', { id: 'close-result-btn', className: 'dispatch-btn', textContent: '關閉' })]
                    }),
                    onOpen: (modal, resolve) => {
                        const closeBtn = modal.querySelector('#close-result-btn');
                        let interval;
                        const closeAndResolve = () => {
                            if (interval) clearInterval(interval);
                            resolve({ action: appConfig.MODAL_ACTIONS.CLOSE });
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
                return uiManager.Modal.show({
                    header: '操作失敗',
                    width: '500px',
                    body: domHelper.create('div', {
                        className: 'dispatch-body',
                        children: [
                            domHelper.create('p', { textContent: '在執行過程中發生錯誤：', style: { color: 'var(--error-color)' } }),
                            domHelper.create('pre', { textContent: utils.escapeHtml(error.message), style: { background: '#f0f0f0', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' } })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: 'space-between' },
                        children: [
                            domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回' }),
                            domHelper.create('button', { id: 'retry-btn', className: 'dispatch-btn', textContent: '重試' })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#back-btn').onclick = () => { resolve({ action: appConfig.MODAL_ACTIONS.BACK }); };
                        modal.querySelector('#retry-btn').onclick = () => { resolve({ action: appConfig.MODAL_ACTIONS.RETRY }); };
                    }
                });
            }
        };
        
        const CaseListView = {};

        return { TokenDialog, QueryBuilderDialog, PersonnelSelectDialog, AssignmentResultDialog, ErrorDialog, CaseListView };
    };

    // === 7. 主程式執行器 (AppRunner) ===
    const createAppRunner = (appConfig, appState, apiService, uiComponents, utils, uiManager) => {
        const state = {
            personalCases: null,
            batchCases: null,
            queryTabs: [],
            selectedCases: [],
            assigneeList: [...appConfig.DEFAULT_ASSIGNEES]
        };

        const run = async () => {
            uiManager.injectStyle();
            uiManager.initModalContainer();
            const token = utils.getStoredToken();
            appState.set('userToken', token);
            await handleMainView();
        };

        const _getBatchDefaultFilters = () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 10);
            
            return {
                ...appConfig.DEFAULT_FILTERS.batch,
                applyDateStart: utils.formatDateTime(startDate),
                applyDateEnd: utils.formatDateTime(endDate)
            };
        };
        
        const _generateFilterOptions = (caseList, mode) => {
            const options = {};
            const config = appConfig.FILTER_CONFIG;
            const keys = new Set(mode === 'personal' 
                ? [...config.personal_common, ...config.personal_advanced]
                : [...config.batch_common, ...config.batch_advanced]
            );
            
            keys.forEach(key => {
                const uniqueValues = new Set();
                caseList.forEach(item => {
                    const value = item[key];
                    if (value !== null && value !== undefined && value !== '') {
                        uniqueValues.add(key.toLowerCase().includes('date') ? String(value).split(' ')[0] : String(value));
                    }
                });
                options[key] = [...uniqueValues].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            });
            return options;
        };

        async function fetchCases(mode, filters) {
            const apiCall = mode === 'personal' ? () => apiService.fetchPersonalCases(filters) : () => apiService.fetchBatchCases(filters);
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
            const activeTabId = targetTabId || appState.get('activeTabId');
            appState.set('activeTabId', activeTabId);

            let tabData, currentViewConfig, filterOptions = {}, initialFilters = null, error = null, queryInfo = null;

            if (activeTabId === 'personal') {
                if (state.personalCases === null || forceFetch) {
                    const result = await fetchCases('personal', {});
                    if (result.error) { error = result.error; state.personalCases = null; } else { state.personalCases = result.data; }
                }
                tabData = state.personalCases;
                currentViewConfig = appConfig.PERSONAL_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'personal');
            } else if (activeTabId === 'batch') {
                if (state.batchCases === null || forceFetch) {
                    initialFilters = _getBatchDefaultFilters();
                    const result = await fetchCases('batch', initialFilters);
                    if (result.error) { error = result.error; state.batchCases = null; } else { state.batchCases = result.data; }
                }
                tabData = state.batchCases;
                currentViewConfig = appConfig.BATCH_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'batch');
            } else if (activeTabId === 'manual') {
                tabData = [];
                currentViewConfig = null; 
            } else {
                const queryTab = state.queryTabs.find(t => t.id === activeTabId);
                if (queryTab) {
                    tabData = queryTab.data;
                    currentViewConfig = { ...appConfig.BATCH_VIEW_CONFIG, type: 'query' };
                    filterOptions = _generateFilterOptions(tabData, 'batch');
                    queryInfo = queryTab.filters;
                }
            }
            
            const caseListViewShow = (viewOpts) => {
                const { tabs, activeTabId, caseList, error, viewConfig, filterOptions, initialFilters, queryInfo } = viewOpts;
                let { assigneeList } = viewOpts;
                const isErrorState = !!error;
                let sortState = { key: null, order: 'asc' };
                let currentData = isErrorState ? [] : [...caseList];
                let elements = {};

                function _renderTable(data) {
                    if (isErrorState) {
                        elements.tbody.innerHTML = '';
                        const errorLink = domHelper.create('a', {
                            textContent: '點此重新驗證 Token',
                            attributes: { href: '#' },
                            style: { color: 'var(--error-color)', textDecoration: 'underline' },
                            events: { click: (e) => { e.preventDefault(); elements.resolve({ action: appConfig.MODAL_ACTIONS.CHANGE_TOKEN }); }}
                        });
                        elements.tbody.appendChild(domHelper.create('tr', { children: [domHelper.create('td', {
                            attributes: { colspan: viewConfig.columns.length },
                            style: { color: 'var(--error-color)', fontWeight: 'bold', height: '100px' },
                            children: [domHelper.create('span', { textContent: `資料載入失敗：${utils.escapeHtml(error.message)} ` }), errorLink]
                        })] }));
                        elements.countElem.textContent = '載入失敗';
                        if (elements.nextBtn) elements.nextBtn.disabled = true;
                        return;
                    }

                    const fragment = document.createDocumentFragment();
                    data.forEach((item, index) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = viewConfig.columns.map(key => {
                            const def = appConfig.COLUMN_DEFINITIONS[key];
                            const isFolded = viewConfig.foldedColumns?.includes(key);
                            const className = isFolded ? 'class="folded-column"' : '';
                            if (key === 'select') { return `<td ${className}><input type="checkbox" class="case-checkbox" value="${utils.escapeHtml(item.applyNumber)}"></td>`; }
                            const displayValue = key === 'seq' ? index + 1 : (def.type === 'date' ? utils.formatDisplayDate(item[key]) : item[key] ?? '');
                            return `<td ${className} title="${utils.escapeHtml(item[key] ?? '')}">${utils.escapeHtml(displayValue)}</td>`;
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

                const _applyFiltersAndSort = utils.debounce(() => {
                    const filterValues = {};
                    elements.filterSelects.forEach(select => { if (select.value) filterValues[select.id.replace('filter-', '')] = select.value; });
                    
                    let filteredData = caseList.filter(item => Object.entries(filterValues).every(([key, value]) => {
                        const itemValue = String(item[key] ?? '');
                         if (key === 'applyDate') return itemValue.startsWith(value);
                        return itemValue.includes(value);
                    }));

                    if (sortState.key) {
                        filteredData.sort((a, b) => {
                            let valA = a[sortState.key] ?? '', valB = b[sortState.key] ?? '';
                            if (appConfig.COLUMN_DEFINITIONS[sortState.key]?.type === 'date') {
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
                }, appConfig.DEBOUNCE_DELAY);

                function _createHeader() {
                    return `案件清單作業 v${appConfig.VERSION} (${appConfig.ENV})
                        <button class="header-config-btn" id="config-btn" title="設定">⚙️</button>
                        <div class="config-menu" id="config-menu">
                            <button data-action="${appConfig.MODAL_ACTIONS.CHANGE_TOKEN}">重新驗證token</button>
                            <button data-action="${appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY}">開啟新查詢</button>
                            <button data-action="${appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY_WITH_DEFAULTS}">開啟查詢(帶入批次條件)</button>
                            <button data-action="${appConfig.MODAL_ACTIONS.CLEAR_CACHE}">清除查詢頁籤</button>
                        </div>`;
                }

                function _createPersonnelRadioList(assignees, radioName) {
                    const uniqueAssignees = [...new Set(assignees)];
                    const special = uniqueAssignees.filter(a => appConfig.SPECIAL_ASSIGNEES.includes(a)).sort();
                    const regular = uniqueAssignees.filter(a => !appConfig.SPECIAL_ASSIGNEES.includes(a)).sort();
                    const sortedList = [...special, ...regular];
                    
                    const listContainer = domHelper.create('ul', { className: 'personnel-radio-list' });
                    sortedList.forEach(assignee => {
                        const isSpecial = appConfig.SPECIAL_ASSIGNEES.includes(assignee);
                        const label = domHelper.create('label', { className: isSpecial ? 'special-assignee' : '', children: [
                            domHelper.create('input', { type: 'radio', attributes: { name: radioName, value: assignee } }),
                            document.createTextNode(` ${assignee}`)
                        ]});
                        listContainer.appendChild(domHelper.create('li', { children: [label] }));
                    });
                    return listContainer;
                };
                
                function _createManualOpView() {
                    const defaultPane = domHelper.create('div', { className: 'personnel-selector-pane active', attributes: {'data-pane': 'default'} });
                    defaultPane.appendChild(_createPersonnelRadioList(assigneeList, 'manual_assignee_radio'));

                    const importPane = domHelper.create('div', { className: 'personnel-selector-pane', attributes: {'data-pane': 'import'} });
                    const importListContainer = domHelper.create('div', { id: 'manual-import-list-container', style: { flexGrow: 1, marginTop: '10px' }});
                    const importBtn = domHelper.create('button', { id: 'manual-import-personnel-btn', className: 'dispatch-btn dispatch-outline small', textContent: '從 .txt 匯入' });
                    importPane.append(importBtn, importListContainer);

                    const manualPane = domHelper.create('div', { className: 'personnel-selector-pane', attributes: {'data-pane': 'manual'}, children: [
                         domHelper.create('input', { id: 'manual-assignee-input', type: 'text', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號', style:'margin-top:0;' } })
                    ]});

                    const personnelSection = domHelper.create('div', { className: 'manual-op-section', children: [
                        domHelper.create('h3', { textContent: '2. 選擇指派人員' }),
                        domHelper.create('div', { className: 'personnel-selector-cards', children: [
                            domHelper.create('button', { className: 'card-btn active', textContent: '預設清單', attributes: {'data-pane': 'default'} }),
                            domHelper.create('button', { className: 'card-btn', textContent: '匯入清單', attributes: {'data-pane': 'import'} }),
                            domHelper.create('button', { className: 'card-btn', textContent: '手動輸入', attributes: {'data-pane': 'manual'} }),
                        ]}),
                        domHelper.create('div', { className: 'personnel-selector-content', children: [ defaultPane, importPane, manualPane ]})
                    ]});
                    
                    return domHelper.create('div', { className: 'manual-op-container', children: [
                        domHelper.create('div', { className: 'manual-op-section', children: [
                             domHelper.create('div', { className: 'section-header', children: [
                                domHelper.create('h3', { textContent: '1. 輸入受理號碼' }),
                                domHelper.create('button', { id: 'import-cases-btn', className: 'dispatch-btn dispatch-outline small', textContent: '匯入案件' })
                             ]}),
                             domHelper.create('textarea', { id: 'manual-cases-input', className: 'dispatch-input', attributes: { placeholder: '請輸入受理號碼，以逗號、分號、空格或換行分隔', style: 'margin-top: 0;' } })
                        ]}),
                        personnelSection
                    ]});
                }

                function _createBody() {
                    const tabButtons = tabs.map(tab => domHelper.create('button', {
                        className: tab.id === activeTabId ? 'active' : '',
                        attributes: { 'data-tab-id': tab.id },
                        textContent: tab.name,
                        children: tab.canClose ? [domHelper.create('button', { className: 'close-tab-btn', textContent: '×', attributes: { 'data-tab-id': tab.id } })] : []
                    }));
                    const contentContainer = domHelper.create('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' } });
                    
                    if (activeTabId === 'manual') {
                        contentContainer.appendChild(_createManualOpView());
                    } else if (viewConfig) {
                        let queryDisplay = null;
                        if (queryInfo) {
                            const criteriaHtml = Object.entries(queryInfo).map(([key, value]) => {
                                if (!value) return null;
                                return `<strong>${appConfig.COLUMN_DEFINITIONS[key]?.label ?? key}:</strong> ${utils.escapeHtml(value)}`;
                            }).filter(Boolean).join('; ');
                            queryDisplay = domHelper.create('div', { className: 'query-criteria-display', innerHTML: `查詢條件： ${criteriaHtml}` });
                        }

                        const createFilterControls = () => {
                            const config = appConfig.FILTER_CONFIG;
                            const type = viewConfig.type;
                            const commonKeys = (type === 'personal') ? config.personal_common : config.batch_common;
                            const advancedKeys = (type === 'personal') ? config.personal_advanced : config.batch_advanced;
                            const renderSelect = (key) => {
                                const def = appConfig.COLUMN_DEFINITIONS[key];
                                if (!def) return null;
                                const options = filterOptions[key] || [];
                                const select = domHelper.create('select', { 
                                    id: `filter-${key}`, className: 'dispatch-input filter-select',
                                    attributes: { ...(isErrorState && { disabled: true }) },
                                    children: [domHelper.create('option', { textContent: '全部', attributes: { value: '' } }), ...options.map(opt => domHelper.create('option', { textContent: opt, attributes: { value: opt } }))]
                                });
                                if (initialFilters && initialFilters[key]) {
                                    const valueToSet = String(initialFilters[key]).split(' ')[0];
                                    if (!options.includes(valueToSet)) {
                                        select.appendChild(domHelper.create('option', { textContent: valueToSet, attributes: { value: valueToSet } }));
                                    }
                                    select.value = valueToSet;
                                }
                                return domHelper.create('div', { children: [domHelper.create('label', { textContent: def.label, style: { fontSize: '14px', display: 'block', textAlign: 'left' } }), select] });
                            };
                            return [
                                domHelper.create('div', { className: 'filter-controls', children: commonKeys.map(renderSelect).filter(Boolean) }),
                                domHelper.create('div', { className: 'filter-controls advanced-filters', children: advancedKeys.map(renderSelect).filter(Boolean) })
                            ];
                        };
                        
                        const listViewElements = [
                            ...(queryDisplay ? [queryDisplay] : []), ...createFilterControls(),
                            domHelper.create('div', { className: 'controls-row', children: [
                                domHelper.create('span', { id: 'case-count', style: { fontSize: '14px' } }),
                                domHelper.create('div', { className: 'right-controls', children: [
                                    ...(viewConfig.type === 'batch' || viewConfig.type === 'query' ? [domHelper.create('button', { id: 'toggle-columns-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多欄位' })] : []),
                                    domHelper.create('button', { id: 'toggle-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多篩選條件' }),
                                    domHelper.create('button', { id: 'clear-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '清除篩選' }),
                                    domHelper.create('button', { id: 'export-csv-btn', className: 'dispatch-btn small', textContent: '匯出CSV', attributes: { ...(isErrorState && { disabled: true }) } }),
                                    domHelper.create('button', { id: 'reload-view-btn', className: 'dispatch-btn small', textContent: '重新整理', title: '重新載入案件列表' }),
                                    domHelper.create('button', { id: 'retry-fetch-btn', className: 'dispatch-btn small', textContent: '重新載入', style: { display: isErrorState ? 'inline-flex' : 'none' } })
                                ]})
                            ]}),
                            domHelper.create('div', { id: 'case-table-container', className: 'case-table-container', children: [ domHelper.create('table', { id: 'case-table', className: 'case-table', children: [
                                domHelper.create('thead', { children: [ domHelper.create('tr', { innerHTML: viewConfig.columns.map(key => {
                                    const def = appConfig.COLUMN_DEFINITIONS[key];
                                    const className = viewConfig.foldedColumns?.includes(key) ? 'class="folded-column"' : '';
                                    if (key === 'select') { return `<th ${className}><input type="checkbox" id="select-all-header" ${isErrorState ? 'disabled' : ''}></th>`; }
                                    return `<th ${className} data-key="${def.key}" data-type="${def.type || ''}" title="點擊排序">${def.label} <span class="sort-indicator"></span></th>`;
                                }).join('') })] }),
                                domHelper.create('tbody')
                            ]})]})
                        ];
                        listViewElements.forEach(el => contentContainer.appendChild(el));
                    } else {
                        contentContainer.appendChild(domHelper.create('p', { textContent: '請選擇一個頁籤。' }));
                    }

                    return domHelper.create('div', {
                        className: 'dispatch-body',
                        children: [domHelper.create('div', { className: 'dispatch-tabs', children: tabButtons }), contentContainer]
                    });
                }
                
                function _createFooter() {
                     if (!viewConfig && activeTabId !== 'manual') return domHelper.create('div', { className: 'dispatch-footer' });
                     const children = [];
                     if (activeTabId === 'manual') {
                         children.push(domHelper.create('button', { id: 'manual-dispatch-btn', className: 'dispatch-btn', textContent: '執行派件' }));
                     } else if (viewConfig && !isErrorState) {
                         children.push(domHelper.create('button', { id: 'next-step-btn', className: 'dispatch-btn', textContent: '下一步 (0)', attributes: { disabled: true } }));
                     }
                     return domHelper.create('div', {
                         className: 'dispatch-footer',
                         style: { justifyContent: 'flex-end' },
                         children: children
                     });
                }
                
                function _bindEvents(resolve) {
                    elements.resolve = resolve;
                    
                    elements.modal.querySelector('#config-btn').onclick = () => {
                        const menu = elements.modal.querySelector('#config-menu');
                        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    };
                    elements.modal.querySelectorAll('.config-menu button').forEach(btn => {
                        btn.onclick = () => {
                            const action = btn.dataset.action;
                            if (action) {
                                elements.resolve({ action });
                            }
                        };
                    });

                    elements.modal.querySelector('.dispatch-tabs').onclick = (e) => {
                        const target = e.target;
                        const button = target.closest('button[data-tab-id]');
                        if (target.matches('.close-tab-btn')) {
                            e.stopPropagation();
                            elements.resolve({ action: appConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB, tabId: target.dataset.tabId });
                        } else if (button && !button.classList.contains('active')) {
                            elements.resolve({ action: appConfig.MODAL_ACTIONS.SWITCH_TAB, tabId: button.dataset.tabId });
                        }
                    };
                    
                    if (activeTabId === 'manual') {
                         const container = elements.modal.querySelector('.manual-op-container');
                         if (!container) return;
                         
                         const cardBtns = container.querySelectorAll('.card-btn');
                         const panes = container.querySelectorAll('.personnel-selector-pane');
                         cardBtns.forEach(btn => {
                            btn.onclick = () => {
                                cardBtns.forEach(b => b.classList.remove('active'));
                                btn.classList.add('active');
                                panes.forEach(p => p.classList.toggle('active', p.getAttribute('data-pane') === btn.getAttribute('data-pane')));
                            };
                         });
                         
                         container.querySelector('#import-cases-btn').onclick = async () => {
                            try {
                                const text = await utils.readTxt();
                                const cases = utils.splitTextInput(text);
                                if (cases.length > 0) {
                                    container.querySelector('#manual-cases-input').value = cases.join('\n');
                                    uiManager.Toast.show(`成功匯入 ${cases.length} 筆案件`, 'success');
                                }
                            } catch(e) {
                                if (e.message !== '未選取檔案') uiManager.Toast.show(e.message, 'error');
                            }
                         };

                         container.querySelector('#manual-import-personnel-btn').onclick = async () => {
                             try {
                                const names = utils.splitTextInput(await utils.readTxt());
                                if(names.length > 0) {
                                    assigneeList = [...new Set([...assigneeList, ...names])];
                                    const importListContainer = container.querySelector('#manual-import-list-container');
                                    importListContainer.innerHTML = '';
                                    importListContainer.appendChild(_createPersonnelRadioList(names, 'manual_assignee_radio'));
                                    
                                    const defaultPane = container.querySelector('[data-pane="default"]');
                                    defaultPane.innerHTML = '';
                                    defaultPane.appendChild(_createPersonnelRadioList(assigneeList, 'manual_assignee_radio'));

                                    uiManager.Toast.show(`成功匯入 ${names.length} 位人員`, 'success');
                                }
                             } catch(e) {
                                if (e.message !== '未選取檔案') uiManager.Toast.show(e.message, 'error');
                             }
                         };

                    } else if (viewConfig) {
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
                            if (currentData.length === 0) return uiManager.Toast.show('沒有可匯出的資料', 'warning');
                            const filename = `${viewConfig.type}_案件清單_${new Date().toISOString().slice(0, 10)}.csv`;
                            const csvData = utils.jsonToCsv(currentData, { dynamicHeaders: viewConfig.type === 'batch' || viewConfig.type === 'query' });
                            utils.downloadCsv(csvData, filename);
                        };
                        elements.modal.querySelector('#reload-view-btn').onclick = () => elements.resolve({ action: appConfig.MODAL_ACTIONS.RELOAD_VIEW });

                        if (isErrorState) {
                             elements.modal.querySelector('#retry-fetch-btn').onclick = () => elements.resolve({ action: appConfig.MODAL_ACTIONS.RELOAD_VIEW });
                        } else {
                            elements.filterSelects.forEach(select => { select.onchange = _applyFiltersAndSort; });
                        }
                        
                         if (!isErrorState && elements.table) {
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
                                 } else if (target.id === 'select-all-header') {
                                     elements.tbody.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = target.checked);
                                     _updateNextButton();
                                 } else if (target.matches('.case-checkbox')) {
                                     _updateNextButton();
                                 } else if (target.tagName === 'TD') {
                                     navigator.clipboard.writeText(target.textContent).then(() => uiManager.Toast.show('已複製', 'success', 1000));
                                 }
                             };
                         }
                    }

                    const dispatchBtn = elements.modal.querySelector('#manual-dispatch-btn');
                    if (dispatchBtn) {
                         dispatchBtn.onclick = () => {
                            const cases = utils.splitTextInput(elements.modal.querySelector('#manual-cases-input').value);
                            if (cases.length === 0) return uiManager.Toast.show('請輸入至少一筆受理號碼', 'error');
                            const activePane = elements.modal.querySelector('.personnel-selector-pane.active');
                            let assignee = null;
                            if(activePane){
                                const paneType = activePane.getAttribute('data-pane');
                                if (paneType === 'manual') {
                                    assignee = activePane.querySelector('input[type=text]').value.trim();
                                } else { // default or import
                                    const selectedRadio = activePane.querySelector('input[type=radio]:checked');
                                    if(selectedRadio) assignee = selectedRadio.value;
                                }
                            }
                            if (!assignee) return uiManager.Toast.show('請選擇或輸入指派人員', 'error');
                            elements.resolve({ action: appConfig.MODAL_ACTIONS.MANUAL_DISPATCH, cases, assignee });
                        };
                    }
                    if (elements.nextBtn) {
                        elements.nextBtn.onclick = () => {
                            const selectedCases = Array.from(elements.modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value);
                            if (selectedCases.length > 0) elements.resolve({ action: appConfig.MODAL_ACTIONS.NEXT_STEP, selectedCases });
                        };
                    }
                }

                return uiManager.Modal.show({
                    header: _createHeader(),
                    body: _createBody(),
                    footer: _createFooter(),
                    width: appConfig.TOOL_CONTAINER_WIDTH,
                    onOpen: (modal, resolve) => {
                        elements = {
                            modal, resolve,
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
            };

            const res = await caseListViewShow({
                 tabs: [
                    { id: 'personal', name: '個人案件' },
                    { id: 'batch', name: '批次案件' },
                    { id: 'manual', name: '手動派件' },
                    ...state.queryTabs.map(t => ({ id: t.id, name: t.name, canClose: true }))
                ],
                activeTabId, caseList: tabData || [], error,
                viewConfig: currentViewConfig, filterOptions, initialFilters,
                assigneeList: state.assigneeList, queryInfo
            });

            switch (res?.action) {
                case appConfig.MODAL_ACTIONS.SWITCH_TAB: await handleMainView({ targetTabId: res.tabId }); break;
                case appConfig.MODAL_ACTIONS.RELOAD_VIEW: await handleMainView({ forceFetch: true, targetTabId: appState.get('activeTabId') }); break;
                case appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY: await handleNewQuery(false); break;
                case appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY_WITH_DEFAULTS: await handleNewQuery(true); break;
                case appConfig.MODAL_ACTIONS.CLEAR_CACHE: await handleClearCache(); break;
                case appConfig.MODAL_ACTIONS.CHANGE_TOKEN: await handleTokenChange(); break;
                case appConfig.MODAL_ACTIONS.NEXT_STEP: state.selectedCases = res.selectedCases; await handlePersonnelSelection(); break;
                case appConfig.MODAL_ACTIONS.MANUAL_DISPATCH: await handleAssignment(res.assignee, res.cases); break;
                case appConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB: state.queryTabs = state.queryTabs.filter(t => t.id !== res.tabId); await handleMainView({ targetTabId: 'batch' }); break;
                case appConfig.MODAL_ACTIONS.BACK: await handleMainView(); break;
                case appConfig.MODAL_ACTIONS.CLOSE: default: uiManager.Modal.hide(); break;
            }
        }

        async function handleTokenChange() {
            const res = await uiComponents.TokenDialog.show({ mode: 'revalidate' });
            if (res?.action === appConfig.MODAL_ACTIONS.CONFIRM) {
                appState.set('userToken', res.value);
                state.personalCases = null;
                state.batchCases = null;
                state.queryTabs = [];
                await handleMainView({ forceFetch: true });
            } else {
                 await handleMainView();
            }
        }

        async function handleNewQuery(prefillDefaults = false) {
            const res = await uiComponents.QueryBuilderDialog.show({ initialData: prefillDefaults ? _getBatchDefaultFilters() : {} });
            if (res?.action === appConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS) {
                uiManager.Progress.show('正在執行新查詢...');
                const queryFilters = res.payload.batch;
                const result = await fetchCases('batch', queryFilters);
                uiManager.Progress.hide();
                if (result.data) {
                    const newTabId = `query_${Date.now()}`;
                    state.queryTabs.push({ id: newTabId, name: `查詢結果 ${state.queryTabs.length + 1}`, data: result.data, filters: queryFilters });
                    await handleMainView({ targetTabId: newTabId });
                } else if (result.error && result.error.name !== 'AbortError') {
                    const retryRes = await uiComponents.ErrorDialog.show({ error: result.error });
                    if (retryRes?.action === appConfig.MODAL_ACTIONS.RETRY) { await handleNewQuery(prefillDefaults); } else { await handleMainView(); }
                } else { await handleMainView(); }
            } else { await handleMainView(); }
        }

        async function handleClearCache() {
            if (confirm('您確定要清除所有「查詢結果」頁籤嗎？\n此操作不會影響「個人」與「批次」案件列表。')) {
                state.queryTabs = [];
                uiManager.Toast.show('已清除所有查詢頁籤', 'success');
                const newTabId = ['personal', 'batch', 'manual'].includes(appState.get('activeTabId')) ? appState.get('activeTabId') : 'batch';
                await handleMainView({ targetTabId: newTabId });
            } else { await handleMainView(); }
        }

        async function handlePersonnelSelection() {
            const res = await uiComponents.PersonnelSelectDialog.show({
                selectedCount: state.selectedCases.length,
                defaultUsers: state.assigneeList
            });
            if (res?.action === appConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT) {
                await handleAssignment(res.assignee);
            } else {
                 await handleMainView();
            }
        }

        async function handleAssignment(assignee, cases) {
            const casesToDispatch = cases || state.selectedCases;
            if (casesToDispatch.length === 0) {
                uiManager.Toast.show('沒有選擇任何案件', 'warning');
                return;
            }
            uiManager.Progress.show(`正在派件 ${casesToDispatch.length} 筆案件給 ${assignee}`);
            try {
                const apiResult = await apiService.manualAssign(casesToDispatch, assignee);
                uiManager.Progress.hide();
                await uiComponents.AssignmentResultDialog.show({
                    successful: apiResult.successful,
                    failed: apiResult.failed,
                    assignee: assignee
                });

                state.personalCases = null;
                state.batchCases = null;

                const activeTabId = appState.get('activeTabId');
                const activeQueryTab = state.queryTabs.find(t => t.id === activeTabId);

                if (activeQueryTab) {
                    uiManager.Progress.show(`正在重新整理「${activeQueryTab.name}」...`);
                    const result = await fetchCases('batch', activeQueryTab.filters);
                    if (result.data) {
                        activeQueryTab.data = result.data;
                    }
                    uiManager.Progress.hide();
                }
                
                await handleMainView({ forceFetch: true, targetTabId: activeTabId });

            } catch (error) {
                if (error.name !== 'AbortError') {
                    uiManager.Progress.hide();
                    const res = await uiComponents.ErrorDialog.show({ error });
                    if (res?.action === appConfig.MODAL_ACTIONS.RETRY) { await handleAssignment(assignee, cases); } else { await handleMainView(); }
                } else { await handleMainView(); }
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
        const appState = AppState;
        const uiManager = createUIManager(AppConfig, appState, utils, DOMHelper);
        const apiService = createApiService(AppConfig, appState, uiManager);
        const uiComponents = createUIComponents(AppConfig, uiManager, utils, DOMHelper);
        const app = createAppRunner(AppConfig, appState, apiService, uiComponents, utils, uiManager);
        app.run();
    } catch (e) {
        console.error('案件清單作業 - 致命錯誤:', e);
        alert(`腳本發生致命錯誤，請檢查控制台以獲取詳細資訊：\n${e.message}`);
    }
})();
