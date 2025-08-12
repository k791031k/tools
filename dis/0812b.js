javascript: void((() => {
    /**
     * =================================================================================
     * 案件清單作業 - v0826 (最終融合版)
     * =================================================================================
     * @version     0826
     * @description
     * 融合 v0825.4 的優秀架構與 v0816 的完整使用者體驗，包含：
     * 1. [架構] 引入事件、計時器、DOM 和 LRU 快取管理器，杜絕記憶體洩漏，提升效能。
     * 2. [核心] 修正滾動行為，篩選區塊固定，清單獨立滾動且標頭置頂。
     * 3. [核心] 修復所有按鈕失靈問題，確保互動穩定。
     * 4. [UI/UX] 查詢/操作後自動收折篩選條件，並新增目前查詢條件顯示區。
     * 5. [UI/UX] 查詢視窗中特定欄位改為下拉選單，並處理 BK->OT 的業務邏輯。
     * 6. [UI/UX] 篩選條件旁新增唯一值計數功能。
     * 7. [UI/UX] 統一視窗大小，並在操作後保持視窗位置，提供還原按鈕。
     * 8. [視覺] 強化整體色彩對比度，表格加入斑馬紋與滑鼠懸停效果。
     * =================================================================================
     */
    'use strict';

    /**
     * =========================================================================
     * I. 基礎設施與管理器 (Infrastructure & Managers)
     * =========================================================================
     */

    const EventManager = (() => {
        const listeners = new WeakMap();
        return {
            add(element, event, handler, options = {}) {
                element.addEventListener(event, handler, options);
                if (!listeners.has(element)) {
                    listeners.set(element, []);
                }
                listeners.get(element).push({ event, handler, options });
            },
            removeAll(element) {
                const elementListeners = listeners.get(element);
                if (elementListeners) {
                    elementListeners.forEach(({ event, handler, options }) => {
                        element.removeEventListener(event, handler, options);
                    });
                    listeners.delete(element);
                }
            },
            cleanup() {
                // WeakMap handles cleanup automatically when elements are garbage collected.
                // This is more for explicit, immediate cleanup if needed.
                console.log("EventManager cleaned up.");
            }
        };
    })();

    const TimerManager = (() => {
        const timers = new Map();
        let timerId = 0;
        return {
            setInterval(callback, interval, ...args) {
                const id = ++timerId;
                const timer = setInterval(() => callback(...args), interval);
                timers.set(id, { type: 'interval', timer });
                return id;
            },
            setTimeout(callback, delay, ...args) {
                const id = ++timerId;
                const timer = setTimeout(() => {
                    timers.delete(id);
                    callback(...args);
                }, delay);
                timers.set(id, { type: 'timeout', timer });
                return id;
            },
            clear(id) {
                const timerInfo = timers.get(id);
                if (timerInfo) {
                    if (timerInfo.type === 'timeout') clearTimeout(timerInfo.timer);
                    else clearInterval(timerInfo.timer);
                    timers.delete(id);
                    return true;
                }
                return false;
            },
            clearAll() {
                timers.forEach((timerInfo) => {
                    if (timerInfo.type === 'timeout') clearTimeout(timerInfo.timer);
                    else clearInterval(timerInfo.timer);
                });
                timers.clear();
            }
        };
    })();
    
    const LRUCache = (maxSize = 100, ttl = 5 * 60 * 1000) => {
        const cache = new Map();
        const timers = new Map();
        const accessOrder = new Map();
        let accessCounter = 0;
    
        const cleanup = (key) => {
            if (timers.has(key)) {
                TimerManager.clear(timers.get(key));
                timers.delete(key);
            }
            cache.delete(key);
            accessOrder.delete(key);
        };
    
        const evictLRU = () => {
            let oldestKey = null;
            let oldestAccess = Infinity;
            accessOrder.forEach((accessTime, key) => {
                if (accessTime < oldestAccess) {
                    oldestAccess = accessTime;
                    oldestKey = key;
                }
            });
            if (oldestKey !== null) cleanup(oldestKey);
        };
    
        return {
            set(key, value) {
                if (cache.has(key)) cleanup(key);
                if (cache.size >= maxSize) evictLRU();
                cache.set(key, { data: value, timestamp: Date.now(), hits: 0 });
                accessOrder.set(key, ++accessCounter);
                if (ttl > 0) {
                    const timerId = TimerManager.setTimeout(() => cleanup(key), ttl);
                    timers.set(key, timerId);
                }
                return this;
            },
            get(key) {
                const item = cache.get(key);
                if (!item) return null;
                if (ttl > 0 && Date.now() - item.timestamp > ttl) {
                    cleanup(key);
                    return null;
                }
                item.hits++;
                accessOrder.set(key, ++accessCounter);
                return item.data;
            },
            clear() {
                timers.forEach(timerId => TimerManager.clear(timerId));
                timers.clear();
                cache.clear();
                accessOrder.clear();
                accessCounter = 0;
            }
        };
    };

    const DOMManager = (() => {
        const domRefs = new Set();
        return {
            register(element) {
                if (!(element instanceof Element)) return;
                domRefs.add(element);
            },
            cleanup(element) {
                if (domRefs.has(element)) {
                    try {
                        EventManager.removeAll(element);
                        element.parentNode?.removeChild(element);
                        domRefs.delete(element);
                    } catch (error) {
                        console.error('清理 DOM 元素時發生錯誤:', error);
                    }
                }
            },
            cleanupAll() {
                domRefs.forEach(element => this.cleanup(element));
            }
        };
    })();

    const ResourceManager = (() => {
        let isInitialized = false;
        return {
            init(apiCache) {
                if (isInitialized) return;
                EventManager.add(window, 'beforeunload', () => this.cleanup());
                isInitialized = true;
            },
            cleanup() {
                TimerManager.clearAll();
                EventManager.cleanup();
                DOMManager.cleanupAll();
                console.log('所有資源已清理完畢。');
            }
        };
    })();

    /**
     * =========================================================================
     * II. 模組定義區 (Module Definitions)
     * =========================================================================
     */

    // === 1. 設定模組 (AppConfig) ===
    const AppConfig = (() => {
        const staticConfig = {
            VERSION: '0826',
            TOOL_CONTAINER_ID: 'dispatch-tool-container-v28',
            STYLE_ELEMENT_ID: 'dispatch-tool-style-v28',
            TOKEN_KEY: 'euisToken',
            BATCH_PAGE_SIZE: 50,
            CONCURRENT_API_LIMIT: 5,
            DEBOUNCE_DELAY: 300,
            DEFAULT_ASSIGNEES: [
                'alex.yc.liu', 'carol.chan', 'chenjui.chang', 'jessy.fu',
                'lisa.wu', 'pearl.ho', 'peiyi.wu', 'cih.lian'
            ],
            SPECIAL_ASSIGNEES: [
                'chenjui.chang', 'peiyi.wu', 'cih.lian'
            ],
            MODAL_ACTIONS: {
                CONFIRM: 'confirm', SWITCH_TAB: 'switch_tab', NEXT_STEP: 'next_step',
                CONFIRM_ASSIGNMENT: 'confirm_assignment', CLOSE: 'close', BACK: 'back',
                RETRY: 'retry', CHANGE_TOKEN: 'change_token', OPEN_NEW_QUERY: 'open_new_query',
                APPLY_SESSION_FILTERS: 'apply_session_filters', RESET_AND_RELOAD: 'reset_and_reload',
                CLEAR_CACHE: 'clear_cache', RELOAD_VIEW: 'reload_view',
                CLOSE_QUERY_TAB: 'close_query_tab', MANUAL_DISPATCH: 'manual_dispatch',
                RESET_WINDOW: 'reset_window',
            },
            ZINDEX: {
                TOAST: 2147483647, MASK: 2147483640, MODAL: 2147483641
            },
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
                applyDateStart: { label: "受理開始時間", key: "applyDateStart" },
                applyDateEnd: { label: "受理結束時間", key: "applyDateEnd" }
            },
            SHARED_VIEW_CONFIG: {
                columns: [
                    'select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName',
                    'mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel',
                    'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId'
                ],
                foldedColumns: [
                    'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId'
                ]
            },
            SHARED_FILTER_CONFIG: [
                'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 
                'subStatus', 'currency', 'currentOwner', 'channel', 'polpln', 'confrmno', 
                'caseId'
            ],
            TEXT_INPUT_FILTERS: ['applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'subStatus', 'currentOwner', 'polpln', 'confrmno', 'caseId'],
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
    const createOptimizedState = () => {
        const state = {
            userToken: null,
            abortController: null,
            isLoading: false,
            activeTabId: 'personal'
        };
        const subscribers = new Map();
        const notify = (changedKeys) => {
            changedKeys.forEach(key => {
                if (subscribers.has(key)) subscribers.get(key).forEach(callback => callback(state));
            });
            if (subscribers.has('*')) subscribers.get('*').forEach(callback => callback(state));
        };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => {
                let changedKeys = [];
                if (typeof k === 'object') {
                    changedKeys = Object.keys(k);
                    Object.assign(state, k);
                } else {
                    changedKeys.push(k);
                    state[k] = v;
                }
                notify(changedKeys);
            },
            subscribe: (key, callback) => {
                if (!subscribers.has(key)) subscribers.set(key, new Set());
                subscribers.get(key).add(callback);
                return () => subscribers.get(key).delete(callback);
            },
            createAbortSignal: () => (state.abortController = new AbortController()).signal,
            abortRequest: () => {
                state.abortController?.abort();
                state.abortController = null;
            }
        };
    };

    // === 3. 工具函式模組 (Utils) ===
    const createUtils = (appConfig) => {
        const createOptimizedDebounce = (func, wait, options = {}) => {
            let timeout, previous = 0,
                result;
            const {
                leading = false, trailing = true
            } = options;
            const later = (context, args) => {
                previous = leading === false ? 0 : Date.now();
                timeout = null;
                result = func.apply(context, args);
                if (!timeout) context = args = null;
            };
            return function(...args) {
                const now = Date.now();
                if (!previous && leading === false) previous = now;
                const remaining = wait - (now - previous);
                const context = this;
                if (remaining <= 0 || remaining > wait) {
                    if (timeout) {
                        clearTimeout(timeout);
                        timeout = null;
                    }
                    previous = now;
                    result = func.apply(context, args);
                    if (!timeout) context = args = null;
                } else if (!timeout && trailing !== false) {
                    timeout = TimerManager.setTimeout(() => later(context, args), remaining);
                }
                return result;
            };
        };
        return {
            escapeHtml: (str) => {
                if (str === null || str === undefined) return '';
                const map = {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#039;'
                };
                return String(str).replace(/[&<>"']/g, m => map[m]);
            },
            getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(appConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
            jsonToCsv: (items, {
                dynamicHeaders = false
            } = {}) => {
                if (!items || items.length === 0) return '';
                const headers = dynamicHeaders ? [...items.reduce((acc, item) => (Object.keys(item).forEach(key => acc.add(key)), acc), new Set())] : Object.keys(items[0]);
                const headerRow = headers.map(h => JSON.stringify(h)).join(',');
                const rows = items.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','));
                return [headerRow, ...rows].join('\r\n');
            },
            downloadCsv: (csv, filename) => {
                const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
                    type: 'text/csv;charset=utf-8;'
                });
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
                if (!input || !String(input).trim()) return {
                    display: '',
                    full: ''
                };
                const str = String(input).trim();
                let match = str.match(/^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})$/);
                if (match) {
                    const [, year, month, day] = match;
                    const display = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    return {
                        display,
                        full: `${display} 00:00:00`
                    };
                }
                return {
                    display: str,
                    full: str
                };
            },
            debounce: createOptimizedDebounce,
            readTxt: () => new Promise((resolve, reject) => {
                const input = Object.assign(document.createElement('input'), {
                    type: 'file',
                    accept: '.txt',
                    style: 'display:none'
                });
                EventManager.add(input, 'change', e => {
                    const file = e.target.files[0];
                    if (!file) return reject(new Error('未選取檔案'));
                    const reader = new FileReader();
                    EventManager.add(reader, 'load', e => resolve(e.target.result));
                    EventManager.add(reader, 'error', () => reject(new Error('檔案讀取失敗')));
                    reader.readAsText(file);
                });
                document.body.appendChild(input);
                input.click();
                document.body.removeChild(input);
            }),
            splitTextInput: (text) => text.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean)
        };
    };

    // === 4. UI 管理模組 (UIManager) ===
    const createUIManager = (appConfig, appState, utils, domHelper) => {
        function injectStyle() {
            if (document.getElementById(appConfig.STYLE_ELEMENT_ID)) return;
            const style = domHelper.create('style', {
                id: appConfig.STYLE_ELEMENT_ID,
                textContent: `
                    :root {
                        --primary-50: #eef2ff; --primary-100: #e0e7ff; --primary-500: #6366f1; --primary-600: #4f46e5; --primary-700: #4338ca;
                        --gray-50: #f8fafc; --gray-100: #f1f5f9; --gray-200: #e2e8f0; --gray-300: #cbd5e1; --gray-500: #64748b; --gray-700: #334155; --gray-900: #0f172a;
                        --success-color: #10b981; --warning-color: #f59e0b; --error-color: #ef4444;
                        --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                        --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
                        --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                        --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
                        --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
                        --border-radius-sm: 6px; --border-radius-md: 8px; --border-radius-lg: 12px; --border-radius-xl: 16px;
                    }
                    .dispatch-mask { position: fixed; z-index: ${appConfig.ZINDEX.MASK}; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); opacity: 0; transition: opacity 0.3s ease; pointer-events: none; }
                    .dispatch-mask.show { opacity: 1; pointer-events: auto; }
                    .dispatch-modal {
                        font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; position: fixed; top: 50%; left: 50%; z-index: ${appConfig.ZINDEX.MODAL};
                        display: flex; flex-direction: column; opacity: 0; transition: opacity .2s, transform .2s, width .2s, height .2s; pointer-events: none;
                        transform: translate(-50%, -50%) scale(0.95);
                        background: var(--gray-100); border-radius: var(--border-radius-xl); box-shadow: var(--shadow-xl);
                        border: 1px solid rgba(255, 255, 255, 0.2); width: 1300px; height: 80vh; max-width: 95vw; max-height: 90vh;
                    }
                    .dispatch-modal.show { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }
                    .dispatch-modal.dragging { transition: none !important; }
                    .dispatch-header { background: white; border-bottom: 1px solid var(--gray-200); border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0; padding: 12px 20px; position: relative; cursor: grab; text-align: center; font-size: 1.1rem; font-weight: 600; color: var(--gray-900); }
                    .dispatch-close { position: absolute; top: 50%; transform: translateY(-50%); right: 16px; background: 0 0; border: none; font-size: 28px; color: var(--gray-500); cursor: pointer; width: 32px; height: 32px; border-radius: 50%; transition: all .2s; display: flex; align-items: center; justify-content: center; }
                    .dispatch-close:hover { background: var(--gray-200); color: var(--gray-900); transform: translateY(-50%) rotate(90deg) scale(1.05); }
                    .dispatch-body { flex-grow:1; display:flex; flex-direction:column; overflow: hidden; font-family:'Microsoft JhengHei','Segoe UI',sans-serif }
                    .dispatch-footer { padding:10px 16px; border-top:1px solid var(--gray-200); display:flex; align-items:center; width:100%; box-sizing:border-box; background:#fff; border-radius:0 0 var(--border-radius-xl) var(--border-radius-xl) }
                    .dispatch-tabs { flex-shrink: 0; margin: 0; padding: 0 16px; border-bottom: 1px solid var(--gray-200); background: #fff; display: flex; overflow-x: auto; }
                    .dispatch-tabs button { background: 0 0; border: none; padding: 10px 14px; font-weight: 500; color: var(--gray-500); border-bottom: 3px solid transparent; transition: all .2s ease; white-space: nowrap; position: relative; cursor: pointer; font-family:'Microsoft JhengHei','Segoe UI',sans-serif }
                    .dispatch-tabs button.active { color: var(--primary-600); border-bottom-color: var(--primary-600); font-weight: 600; }
                    .dispatch-tabs button:hover:not(.active) { color: var(--gray-900); background: var(--gray-100); }
                    .dispatch-tabs button .close-tab-btn { position: absolute; top: 50%; transform: translateY(-50%); right: -2px; width: 18px; height: 18px; border-radius: 50%; border: none; background-color: transparent; color: var(--gray-500); font-size: 16px; line-height: 1; text-align: center; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: all .2s; }
                    .dispatch-tabs button:hover .close-tab-btn { opacity: 1; pointer-events: auto; }
                    .dispatch-tabs button .close-tab-btn:hover { background-color: var(--gray-300); color: var(--gray-900); }
                    .tab-content-wrapper { flex-grow: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 12px; }
                    .filter-controls { flex-shrink: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 12px; background: #fff; border: 1px solid var(--gray-200); border-radius: var(--border-radius-md); margin-bottom: 10px; transition: all .3s ease-in-out; max-height: 500px; opacity: 1; overflow: hidden; }
                    .filter-controls.collapsed { max-height: 0; padding-top: 0; padding-bottom: 0; margin-bottom: 0; border-width: 0; opacity: 0; }
                    .case-table-container { flex-grow: 1; overflow: auto; border: 1px solid var(--gray-200); border-radius: var(--border-radius-md); background: #fff; box-shadow: var(--shadow-sm); }
                    .case-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
                    .case-table thead th { background: var(--gray-50); font-weight: 600; color: var(--gray-900); padding: 10px 12px; border-bottom: 2px solid var(--gray-300); position: sticky; top: 0; z-index: 10; cursor: pointer; transition: background .2s ease; text-align: center; white-space: nowrap; }
                    .case-table thead th:hover { background: var(--gray-200); }
                    .case-table tbody td { padding: 8px 12px; border-bottom: 1px solid var(--gray-200); transition: background-color .15s ease; text-align: center; white-space: nowrap; }
                    .case-table tbody tr:nth-child(even) { background-color: var(--gray-100); }
                    .case-table tbody tr:hover { background-color: var(--primary-100); }
                    .case-table td,.case-table th { overflow: hidden; text-overflow: ellipsis; }
                    .dispatch-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; font-size: 14px; font-weight: 600; border-radius: var(--border-radius-md); border: none; cursor: pointer; transition: all .2s cubic-bezier(.4,0,.2,1); box-shadow: var(--shadow-sm); background: var(--primary-600); color: #fff; font-family:'Microsoft JhengHei','Segoe UI',sans-serif }
                    .dispatch-btn:hover:not([disabled]) { transform: translateY(-1px); box-shadow: var(--shadow-md); background: var(--primary-700); }
                    .dispatch-btn.dispatch-outline { background: #fff; border: 1px solid var(--gray-300); color: var(--gray-700); box-shadow: var(--shadow-xs); }
                    .dispatch-btn.dispatch-outline:hover:not([disabled]) { border-color: var(--primary-500); color: var(--primary-600); background: var(--primary-50); }
                    .dispatch-btn.small { padding: 6px 12px; font-size: 13px; }
                    .dispatch-btn[disabled] { background: var(--gray-300)!important; color: var(--gray-500); cursor: not-allowed; transform: none; box-shadow: none; }
                    .dispatch-input,textarea.dispatch-input,select.dispatch-input { width: 100%; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--gray-300); border-radius: var(--border-radius-md); font-size: 14px; transition: border-color .2s ease,box-shadow .2s ease; background: #fff; font-family:'Microsoft JhengHei','Segoe UI',sans-serif }
                    .dispatch-input:focus { outline: 0; border-color: var(--primary-500); box-shadow: 0 0 0 3px rgba(79,70,229,.2); }
                    .dispatch-toast { position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(17,24,39,.9); backdrop-filter: blur(5px); color: #fff; padding: 12px 24px; border-radius: var(--border-radius-lg); font-size: 15px; z-index: ${appConfig.ZINDEX.TOAST}; opacity: 0; transition: .3s; box-shadow: var(--shadow-xl); border: 1px solid rgba(255,255,255,.2); }
                    .dispatch-toast.show { opacity: 1; }
                    .dispatch-progress { position: fixed; inset: 0; background: rgba(255,255,255,.7); backdrop-filter: blur(5px); z-index: ${appConfig.ZINDEX.TOAST}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; color: var(--gray-900); }
                    .dispatch-progress button { margin-top: 20px; }
                    .manual-op-container { display: flex; flex-direction: row; gap: 12px; height: 100%; }
                    .manual-op-section { border: 1px solid var(--gray-200); background: #fff; border-radius: var(--border-radius-lg); padding: 12px; display: flex; flex-direction: column; flex: 1; min-width: 0; }
                    .personnel-selector-cards { display: flex; gap: 8px; margin-bottom: 12px; }
                    .personnel-selector-cards .card-btn { flex: 1; padding: 8px 12px; font-size: 14px; border: 1px solid var(--gray-300); background-color: var(--gray-50); color: var(--gray-700); cursor: pointer; border-radius: var(--border-radius-md); transition: all .2s; font-family:'Microsoft JhengHei','Segoe UI',sans-serif }
                    .personnel-selector-cards .card-btn.active { background-color: var(--primary-600); color: #fff; border-color: var(--primary-700); font-weight: 600; box-shadow: var(--shadow-sm); }
                    .personnel-selector-content { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
                    .personnel-selector-pane { display: none; height: 100%; flex-direction: column; }
                    .personnel-selector-pane.active { display: flex; }
                    .personnel-list { list-style: none; padding: 5px; margin: 0; flex-grow: 1; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--border-radius-md); }
                    .personnel-list .selectable-item { padding: 8px 12px; border-radius: var(--border-radius-sm); cursor: pointer; transition: background-color .2s,color .2s; border: 1px solid transparent; }
                    .personnel-list .selectable-item:hover { background-color: var(--gray-100); }
                    .personnel-list .selectable-item.selected { background-color: var(--primary-600)!important; color: #fff; border-color: var(--primary-700); font-weight: 500; }
                    .special-assignee { font-weight: 700; color: #00008b; background-color: #ffffe0; }
                    .folded-column { display: none; }
                    .show-all-columns .folded-column { display: table-cell; }
                    .query-form-group { margin-bottom: 16px; }
                    .query-form-group h3 { font-size: 1rem; font-weight: 600; color: var(--gray-800); margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200); }
                    .query-form-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(250px,1fr)); gap: 16px 20px; }
                    .query-criteria-display { flex-shrink: 0; background-color: var(--primary-50); border: 1px solid var(--primary-100); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 13px; line-height: 1.6; word-break: break-all; }
                    .query-criteria-display strong { color: var(--primary-700); font-weight: 600; }
                    .query-criteria-display span { color: var(--gray-700); margin-left: 4px; }
                    .filter-label-count { color: var(--primary-600); font-weight: 500; margin-left: 4px; }
                    .header-toolbar { position: absolute; top: 50%; left: 16px; transform: translateY(-50%); display: flex; gap: 4px; }
                    .header-toolbar button { position: relative; font-size: 20px; width: 32px; height: 32px; border-radius: 50%; border: none; background: 0 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--gray-500); transition: all .2s; }
                    .header-toolbar button:hover { background: var(--gray-200); color: var(--gray-900); }
                    .header-toolbar button .tooltip-text { visibility: hidden; width: max-content; background-color: #555; color: #fff; text-align: center; border-radius: 6px; padding: 5px 8px; position: absolute; z-index: 1; bottom: 125%; left: 50%; transform: translateX(-50%); opacity: 0; transition: opacity .2s; font-size: 12px; pointer-events: none; }
                    .header-toolbar button:hover .tooltip-text { visibility: visible; opacity: 1; }
                    @media (max-width:1200px) { .dispatch-modal{width:98vw} .filter-controls{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px} }
                    @media (max-width:768px) { .dispatch-modal{width:100vw;height:100vh;max-height:100vh;border-radius:0;top:0;left:0;transform:none!important} .dispatch-header,.dispatch-footer{border-radius:0} .tab-content-wrapper{padding:8px} .filter-controls{padding:12px} .manual-op-container{flex-direction:column;gap:8px} .case-table{font-size:12px} .case-table thead th,.case-table tbody td{padding:8px 6px} .query-form-grid{grid-template-columns:1fr} }
                `
            });
            document.head.appendChild(style);
        }

        const Toast = {
            show: (msg, type = 'success', duration = 2100) => {
                document.querySelector('.dispatch-toast')?.remove();
                const bgColor = type === 'error' ? 'var(--error-color)' : (type === 'warning' ? 'var(--warning-color)' : 'rgba(17, 24, 39, 0.9)');
                const toastElement = domHelper.create('div', {
                    className: `dispatch-toast ${type}`,
                    textContent: msg,
                    style: {
                        background: bgColor
                    }
                });
                document.body.appendChild(toastElement);
                requestAnimationFrame(() => toastElement.classList.add('show'));
                if (duration > 0) {
                    TimerManager.setTimeout(() => {
                        toastElement.classList.remove('show');
                        EventManager.add(toastElement, 'transitionend', () => toastElement.remove(), {
                            once: true
                        });
                    }, duration);
                }
            }
        };

        const Progress = {
            show(text) {
                this.hide();
                const stopButton = domHelper.create('button', {
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
                    children: [domHelper.create('div', {
                        textContent: utils.escapeHtml(text)
                    }), stopButton]
                });
                document.body.appendChild(progressElement);
                DOMManager.register(progressElement);
            },
            update(percent, text) {
                const progressText = document.getElementById('dispatch-progress')?.querySelector('div:first-child');
                if (progressText) {
                    progressText.innerHTML = `<div>${utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
                }
            },
            hide() {
                DOMManager.cleanup(document.getElementById('dispatch-progress'));
            }
        };

        const Modal = (() => {
            let lastPosition = {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
            };
            const dragState = {
                active: false,
                sX: 0,
                sY: 0,
                iL: 0,
                iT: 0
            };
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    const topModal = Array.from(document.querySelectorAll('.dispatch-modal.show')).pop();
                    topModal?.querySelector('.dispatch-close')?.click();
                }
            };

            function dragStart(e) {
                const modal = e.target.closest('.dispatch-modal');
                if (!modal || e.target.closest('.dispatch-close, .header-toolbar, .dispatch-tabs button, input, select, button, textarea, .case-table-container')) return;
                e.preventDefault();
                dragState.active = true;
                modal.classList.add('dragging');
                const rect = modal.getBoundingClientRect();
                dragState.sX = e.clientX;
                dragState.sY = e.clientY;
                dragState.iL = rect.left;
                dragState.iT = rect.top;
                EventManager.add(document, 'mousemove', doDrag);
                EventManager.add(document, 'mouseup', stopDrag, {
                    once: true
                });
            }

            function doDrag(e) {
                if (!dragState.active) return;
                e.preventDefault();
                const modal = document.querySelector('.dispatch-modal.dragging');
                if (modal) {
                    modal.style.left = `${dragState.iL + e.clientX - dragState.sX}px`;
                    modal.style.top = `${dragState.iT + e.clientY - dragState.sY}px`;
                    modal.style.transform = 'none';
                }
            }

            function stopDrag() {
                dragState.active = false;
                const modal = document.querySelector('.dispatch-modal.dragging');
                if (modal) {
                    modal.classList.remove('dragging');
                    if (modal.id === appConfig.TOOL_CONTAINER_ID) {
                        lastPosition = {
                            left: modal.style.left,
                            top: modal.style.top,
                            transform: 'none'
                        };
                    }
                }
                EventManager.removeAll(document); // Clean up mousemove
            }
            return {
                hide() {
                    const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                    const mask = document.getElementById('dispatch-mask');
                    if(modal) modal.classList.remove('show');
                    if(mask) mask.classList.remove('show');
                    appState.abortRequest();
                    EventManager.removeAll(document);
                },
                show(opts) {
                    return new Promise(resolve => {
                        const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                        if (!modal) return resolve({
                            action: appConfig.MODAL_ACTIONS.CLOSE
                        });
                        document.getElementById('dispatch-mask')?.classList.add('show');

                        requestAnimationFrame(() => modal.classList.add('show'));

                        modal.innerHTML = '';
                        const header = domHelper.create('div', {
                            className: 'dispatch-header'
                        });
                        if (opts.headerContent) {
                            header.appendChild(opts.headerContent);
                        } else {
                            header.innerHTML = opts.header;
                        }

                        const closeButton = domHelper.create('button', {
                            className: 'dispatch-close',
                            innerHTML: '&times;',
                            events: {
                                click: () => {
                                    Modal.hide();
                                    resolve({
                                        action: appConfig.MODAL_ACTIONS.CLOSE
                                    });
                                }
                            }
                        });
                        header.appendChild(closeButton);
                        modal.append(header, opts.body, opts.footer);

                        Object.assign(modal.style, lastPosition);

                        EventManager.add(header, 'mousedown', dragStart);
                        EventManager.add(document, 'keydown', handleEsc);
                        if (opts.onOpen) opts.onOpen(modal, resolve);
                    });
                },
                resetPosition() {
                    lastPosition = {
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                    };
                    const modal = document.getElementById(appConfig.TOOL_CONTAINER_ID);
                    if (modal) {
                        Object.assign(modal.style, lastPosition);
                    }
                }
            };
        })();

        function initModalContainer() {
            if (document.getElementById(appConfig.TOOL_CONTAINER_ID)) return;
            const container = domHelper.create('div', {
                id: appConfig.TOOL_CONTAINER_ID,
                className: 'dispatch-modal'
            });
            const mask = domHelper.create('div', {
                id: 'dispatch-mask',
                className: 'dispatch-mask'
            });
            document.body.append(container, mask);
            DOMManager.register(container);
            DOMManager.register(mask);
        }

        return {
            injectStyle,
            Toast,
            Progress,
            Modal,
            initModalContainer
        };
    };

    // === 5. API 服務模組 (ApiService) ===
    const createApiService = (appConfig, appState, uiManager) => {
        const apiCache = LRUCache(10, 5 * 60 * 1000); // Max 10 items, 5 min TTL
        
        async function _fetch(url, options) {
            appState.set('isLoading', true);
            try {
                const token = appState.get('userToken');
                if (!token) throw new Error('TOKEN無效或過期');
                const fetchOptions = {
                    ...options,
                    headers: {
                        ...options.headers,
                        'SSO-TOKEN': token,
                        'Content-Type': 'application/json'
                    },
                    signal: appState.createAbortSignal()
                };
                const response = await fetch(url, fetchOptions);
                if (response.status === 401 || response.status === 403) throw new Error('TOKEN無效或過期');
                if (!response.ok) {
                    const error = new Error(`伺服器錯誤: ${response.status}`);
                    try {
                        error.data = await response.json();
                    } catch {
                        error.data = await response.text();
                    }
                    throw error;
                }
                return response.json();
            } finally {
                appState.set('isLoading', false);
            }
        }
        async function fetchAllPagesOptimized(endpoint, payload, listName) {
            let allRecords = [],
                page = 1,
                totalPages = 1;
            uiManager.Progress.show(`載入${listName}中...`);
            try {
                const firstPageData = await _fetch(endpoint, {
                    method: 'POST',
                    body: JSON.stringify({ ...payload,
                        pageIndex: page,
                        size: appConfig.BATCH_PAGE_SIZE
                    })
                });
                if (firstPageData?.records?.length > 0) {
                    allRecords = allRecords.concat(firstPageData.records);
                    if (firstPageData.total > appConfig.BATCH_PAGE_SIZE) totalPages = Math.ceil(firstPageData.total / appConfig.BATCH_PAGE_SIZE);
                } else {
                    uiManager.Progress.hide();
                    return [];
                }
                if (totalPages > 1) {
                    const pagesToFetch = Array.from({
                        length: totalPages - 1
                    }, (_, i) => i + 2);
                    for (let i = 0; i < pagesToFetch.length; i += appConfig.CONCURRENT_API_LIMIT) {
                        const chunk = pagesToFetch.slice(i, i + appConfig.CONCURRENT_API_LIMIT);
                        const promises = chunk.map(p => _fetch(endpoint, {
                            method: 'POST',
                            body: JSON.stringify({ ...payload,
                                pageIndex: p,
                                size: appConfig.BATCH_PAGE_SIZE
                            })
                        }));
                        const results = await Promise.all(promises);
                        results.forEach(res => {
                            if (res?.records?.length > 0) allRecords.push(...res.records);
                        });
                        const percent = Math.round(100 * allRecords.length / firstPageData.total);
                        uiManager.Progress.update(percent, `載入${listName}中... ${allRecords.length}/${firstPageData.total} 筆`);
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
        async function _fetchWithCache(endpoint, payload, listName) {
            const cacheKey = `${endpoint}_${JSON.stringify(payload)}`;
            const cachedData = apiCache.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }
            const result = await fetchAllPagesOptimized(endpoint, payload, listName);
            apiCache.set(cacheKey, result);
            return result;
        }
        return {
            fetchPersonalCases: (filters) => _fetchWithCache(appConfig.API.QUERY_PERSONAL, filters, '個人案件'),
            fetchBatchCases: (filters) => _fetchWithCache(appConfig.API.QUERY_BATCH, filters, '批次案件'),
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
                const failedCases = (response?.assignFail ?? []).filter(item => item && item.caseId).map(failItem => ({
                    caseId: failItem.caseId,
                    reason: failItem.errorMsg || '未知原因'
                }));
                return {
                    successful: successfulCases,
                    failed: failedCases
                };
            },
            clearCache: () => {
                apiCache.clear();
                console.log('API cache cleared.');
            }
        };
    };

    // === 6. UI 元件模組 (UIComponents) ===
    const createUIComponents = (appConfig, uiManager, utils, domHelper) => {
        const createSubWindow = (opts) => {
            return new Promise(resolve => {
                const mask = domHelper.create('div', {
                    id: `dispatch-sub-mask-${Date.now()}`,
                    className: 'dispatch-mask sub-mask show'
                });
                const modal = domHelper.create('div', {
                    id: `dispatch-sub-modal-${Date.now()}`,
                    className: 'dispatch-modal sub-window'
                });
                DOMManager.register(mask);
                DOMManager.register(modal);

                const close = () => {
                    modal.classList.remove('show');
                    mask.classList.remove('show');
                    EventManager.add(modal, 'transitionend', () => {
                        DOMManager.cleanup(modal);
                        DOMManager.cleanup(mask);
                    }, { once: true });
                    resolve({ action: appConfig.MODAL_ACTIONS.CLOSE });
                };

                const header = domHelper.create('div', { className: 'dispatch-header' });
                if (opts.headerContent) {
                    header.appendChild(opts.headerContent);
                } else {
                    header.innerHTML = opts.header;
                }
                const closeButton = domHelper.create('button', { className: 'dispatch-close', innerHTML: '&times;', events: { click: close } });
                header.appendChild(closeButton);
                modal.append(header, opts.body, opts.footer);
                document.body.append(mask, modal);

                requestAnimationFrame(() => modal.classList.add('show'));

                if (opts.onOpen) opts.onOpen(modal, resolve, close);
            });
        };

        const TokenDialog = {
            show: (opts = {}) => {
                const { mode } = opts;
                const isRevalidateMode = mode === 'revalidate';
                return createSubWindow({
                    headerContent: domHelper.create('span', { textContent: `重新驗證TOKEN (${appConfig.ENV})` }),
                    body: domHelper.create('div', {
                        className: 'dispatch-body', style: { padding: '20px' },
                        children: [
                            domHelper.create('p', { textContent: '請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。', style: { marginTop: '0' } }),
                            domHelper.create('textarea', { id: 'token-input', className: 'dispatch-input', attributes: { rows: '4' }, style: { fontFamily: 'monospace' } })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: isRevalidateMode ? 'space-between' : 'flex-end' },
                        children: [
                            ...(isRevalidateMode ? [domHelper.create('button', { id: 'auto-check-btn', className: 'dispatch-btn dispatch-outline', textContent: '自動檢核' })] : []),
                            domHelper.create('button', { id: 'confirm-token-btn', className: 'dispatch-btn', textContent: '確認' })
                        ]
                    }),
                    onOpen: (modal, resolve, close) => {
                        modal.style.width = '600px';
                        modal.style.height = 'auto';
                        const tokenInput = modal.querySelector('#token-input');
                        if (isRevalidateMode) {
                            EventManager.add(modal.querySelector('#auto-check-btn'), 'click', () => {
                                const storedToken = utils.getStoredToken();
                                if (storedToken) {
                                    uiManager.Toast.show('已自動檢核並儲存 Token', 'success');
                                    resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM, value: storedToken });
                                    close();
                                } else {
                                    uiManager.Toast.show('在瀏覽器中未找到 Token', 'warning');
                                }
                            });
                        }
                        EventManager.add(modal.querySelector('#confirm-token-btn'), 'click', () => {
                            const value = tokenInput.value.trim();
                            if (value) {
                                resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM, value });
                                close();
                            } else {
                                uiManager.Toast.show('Token 不可為空', 'error');
                            }
                        });
                    }
                });
            }
        };

        const QueryBuilderDialog = {
            show: (opts = {}) => {
                const { initialData = {} } = opts;
                const createField = (key, value) => {
                    const def = appConfig.COLUMN_DEFINITIONS[key];
                    if (!def) return null;
                    const controlWrapper = domHelper.create('div');
                    const label = domHelper.create('label', { textContent: `${def.label}:`, style: { fontSize: '14px', display: 'block', marginBottom: '4px', color: 'var(--gray-700)' } });
                    let control;
                    switch (key) {
                        case 'mainStatus':
                            control = domHelper.create('select', { id: `query-${key}`, className: 'dispatch-input' });
                            const statuses = { '': '全部', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6' };
                            for(const [val, text] of Object.entries(statuses)) control.add(new Option(text, val));
                            break;
                        case 'currency':
                            control = domHelper.create('select', { id: `query-${key}`, className: 'dispatch-input' });
                            const currencies = { '': '全部', 'TWD': 'NT$', 'USD': 'USD', 'CNY': 'CNT', 'AUD': 'AUD' };
                            for(const [val, text] of Object.entries(currencies)) control.add(new Option(text, val));
                            break;
                        case 'channel':
                             control = domHelper.create('select', { id: `query-${key}`, className: 'dispatch-input' });
                             const channels = { '': '全部', 'AG': 'AG', 'BR': 'BR', 'BK': 'BK', 'WS': 'WS', 'EC': 'EC' };
                             for(const [val, text] of Object.entries(channels)) control.add(new Option(text, val));
                            break;
                        default:
                            const parsedDate = utils.parseDate(value);
                            control = domHelper.create('input', {
                                type: 'text', id: `query-${key}`, className: 'dispatch-input',
                                attributes: { 
                                    value: utils.escapeHtml(parsedDate.display), 
                                    'data-full-value': utils.escapeHtml(parsedDate.full),
                                    placeholder: `請輸入${def.label}...`
                                }
                            });
                            if (key.toLowerCase().includes('date')) {
                                EventManager.add(control, 'blur', (e) => {
                                    const formatted = utils.parseDate(e.target.value);
                                    e.target.value = formatted.display;
                                    e.target.dataset.fullValue = formatted.full;
                                });
                            }
                    }
                    if (value) control.value = value.split(' ')[0];
                    controlWrapper.append(label, control);
                    return controlWrapper;
                };
                const createForm = (presets) => {
                    const formContainer = domHelper.create('div');
                    const fieldGroups = {
                        '日期範圍': ['applyDateStart', 'applyDateEnd'],
                        '案件關鍵字': ['applyNumber', 'policyNumber', 'ownerName', 'insuredName'],
                        '其他條件': ['mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel', 'polpln', 'confrmno', 'caseId']
                    };
                    for (const [groupTitle, keys] of Object.entries(fieldGroups)) {
                        const groupDiv = domHelper.create('div', { className: 'query-form-group' });
                        const groupHeader = domHelper.create('h3', { textContent: groupTitle });
                        const gridDiv = domHelper.create('div', { className: 'query-form-grid' });
                        keys.forEach(key => {
                            const field = createField(key, presets[key] ?? '');
                            if (field) gridDiv.appendChild(field);
                        });
                        groupDiv.append(groupHeader, gridDiv);
                        formContainer.appendChild(groupDiv);
                    }
                    return formContainer;
                };
                const body = domHelper.create('div', { className: 'tab-content-wrapper' });
                body.appendChild(createForm(initialData));
                return createSubWindow({
                    headerContent: domHelper.create('span', { textContent: '案件進階查詢' }),
                    body,
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer', style: { justifyContent: 'space-between' },
                        children: [
                            domHelper.create('button', { id: 'reset-defaults-btn', className: 'dispatch-btn dispatch-outline', textContent: '恢復預設' }),
                            domHelper.create('div', {
                                children: [
                                    domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '關閉', style: { marginRight: '10px' } }),
                                    domHelper.create('button', { id: 'apply-filters-btn', className: 'dispatch-btn', textContent: '套用並查詢' }),
                                ]
                            })
                        ]
                    }),
                    onOpen: (modal, resolve, close) => {
                        modal.style.width = '900px';
                        modal.style.height = '75vh';
                        modal.querySelector('.tab-content-wrapper').style.overflowY = 'auto';
                        EventManager.add(modal.querySelector('#apply-filters-btn'), 'click', () => {
                            const payload = { batch: {} };
                            modal.querySelectorAll('.dispatch-input, select.dispatch-input').forEach(input => {
                                const key = input.id.replace('query-', '');
                                let value = input.dataset.fullValue || input.value.trim();
                                if (key === 'channel' && value === 'BK') value = 'OT';
                                if (value) payload.batch[key] = value;
                            });
                            resolve({ action: appConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS, payload });
                            close();
                        });
                        EventManager.add(modal.querySelector('#reset-defaults-btn'), 'click', () => { resolve({ action: appConfig.MODAL_ACTIONS.RESET_AND_RELOAD }); close(); });
                        EventManager.add(modal.querySelector('#back-btn'), 'click', () => { resolve({ action: appConfig.MODAL_ACTIONS.CLOSE }); close(); });
                    }
                });
            }
        };
        const PersonnelSelectDialog = {
            show: (opts) => {
                const { selectedCount, defaultUsers } = opts;
                return createSubWindow({
                    headerContent: domHelper.create('span', { textContent: '選擇指派人員' }),
                    body: domHelper.create('div', {
                        className: 'dispatch-body', style: { padding: '20px' },
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
                                    domHelper.create('label', { style: { cursor: 'pointer' }, children: [domHelper.create('input', { type: 'checkbox', id: 'manual-assignee-checkbox' }), domHelper.create('span', { textContent: ' 或手動輸入帳號' })] }),
                                    domHelper.create('input', { type: 'text', id: 'manual-assignee-input', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號' }, style: { display: 'none' } })
                                ]
                            })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer', style: { justifyContent: 'space-between' },
                        children: [
                            domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回上一步' }),
                            domHelper.create('button', { id: 'confirm-assignment-btn', className: 'dispatch-btn', textContent: '確認指派', attributes: { disabled: true } })
                        ]
                    }),
                    onOpen: (modal, resolve, close) => {
                        modal.style.width = '600px';
                        modal.style.height = 'auto';
                        const selectEl = modal.querySelector('#assignee-select');
                        const manualCheckbox = modal.querySelector('#manual-assignee-checkbox');
                        const manualInput = modal.querySelector('#manual-assignee-input');
                        const confirmBtn = modal.querySelector('#confirm-assignment-btn');
                        let currentPersonnelList = [...defaultUsers];
                        const populateSelect = (list) => {
                            const uniqueList = [...new Set(list)];
                            const specialUsers = [], regularUsers = [];
                            uniqueList.forEach(user => { appConfig.SPECIAL_ASSIGNEES.includes(user) ? specialUsers.push(user) : regularUsers.push(user); });
                            specialUsers.sort(); regularUsers.sort();
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
                            } catch (e) { if (e.message !== '未選取檔案') uiManager.Toast.show(e.message, 'error'); }
                        };
                        EventManager.add(manualCheckbox, 'change', () => {
                            const isChecked = manualCheckbox.checked;
                            selectEl.disabled = isChecked;
                            manualInput.style.display = isChecked ? 'block' : 'none';
                            if (isChecked) manualInput.focus();
                            updateConfirmBtnState();
                        });
                        EventManager.add(selectEl, 'change', updateConfirmBtnState);
                        EventManager.add(manualInput, 'input', (e) => { e.target.value = e.target.value.toLowerCase(); updateConfirmBtnState(); });
                        EventManager.add(modal.querySelector('#import-personnel-btn'), 'click', handleImport);
                        EventManager.add(modal.querySelector('#back-btn'), 'click', () => { resolve({ action: appConfig.MODAL_ACTIONS.BACK }); close(); });
                        EventManager.add(confirmBtn, 'click', () => {
                            const assignee = manualCheckbox.checked ? manualInput.value.trim() : selectEl.value;
                            if (!assignee) return uiManager.Toast.show('請選擇或輸入指派人員', 'error');
                            resolve({ action: appConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT, assignee });
                            close();
                        });
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
                if (failed.length > 0) bodyChildren.push(domHelper.create('div', { style: { marginTop: '15px' }, children: [domHelper.create('strong', { textContent: '失敗詳情：' }), domHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '5', readonly: true }, style: { fontSize: '12px', background: '#f8f8f8' }, textContent: failed.map(f => `受理號碼: ${utils.escapeHtml(f.caseId)}\n原因: ${utils.escapeHtml(f.reason)}`).join('\n\n') })] }));
                if (successful.length > 0 && failed.length > 0) bodyChildren.push(domHelper.create('div', { style: { marginTop: '10px' }, children: [domHelper.create('strong', { textContent: '成功列表：' }), domHelper.create('textarea', { className: 'dispatch-input', attributes: { rows: '3', readonly: true }, style: { fontSize: '12px' }, textContent: successful.map(utils.escapeHtml).join('\n') })] }));
                
                return createSubWindow({
                    headerContent: domHelper.create('span', { textContent: hasFailures ? '派件部分成功' : '派件成功' }),
                    body: domHelper.create('div', { className: 'dispatch-body', style: { padding: '20px', overflowY: 'auto' }, children: bodyChildren }),
                    footer: domHelper.create('div', { className: 'dispatch-footer', style: { justifyContent: 'flex-end' }, children: [domHelper.create('button', { id: 'close-result-btn', className: 'dispatch-btn', textContent: '關閉' })] }),
                    onOpen: (modal, resolve, close) => {
                        modal.style.width = '600px';
                        modal.style.height = '500px';
                        const closeBtn = modal.querySelector('#close-result-btn');
                        const closeAndResolve = () => { resolve({ action: appConfig.MODAL_ACTIONS.CLOSE }); close(); };
                        EventManager.add(closeBtn, 'click', closeAndResolve);
                        if (!hasFailures) {
                            let countdown = 3;
                            closeBtn.textContent = `關閉 (${countdown})`;
                            const timerId = TimerManager.setInterval(() => {
                                countdown--;
                                if (countdown > 0) {
                                    closeBtn.textContent = `關閉 (${countdown})`;
                                } else {
                                    TimerManager.clear(timerId);
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
                return createSubWindow({
                    headerContent: domHelper.create('span', { textContent: '操作失敗' }),
                    body: domHelper.create('div', {
                        className: 'dispatch-body', style: { padding: '20px' },
                        children: [
                            domHelper.create('p', { textContent: '在執行過程中發生錯誤：', style: { color: 'var(--error-color)' } }),
                            domHelper.create('pre', { textContent: utils.escapeHtml(error.message), style: { background: '#f0f0f0', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' } })
                        ]
                    }),
                    footer: domHelper.create('div', {
                        className: 'dispatch-footer', style: { justifyContent: 'space-between' },
                        children: [
                            domHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回' }),
                            domHelper.create('button', { id: 'retry-btn', className: 'dispatch-btn', textContent: '重試' })
                        ]
                    }),
                    onOpen: (modal, resolve, close) => {
                        modal.style.width = '600px';
                        modal.style.height = 'auto';
                        EventManager.add(modal.querySelector('#back-btn'), 'click', () => { resolve({ action: appConfig.MODAL_ACTIONS.BACK }); close(); });
                        EventManager.add(modal.querySelector('#retry-btn'), 'click', () => { resolve({ action: appConfig.MODAL_ACTIONS.RETRY }); close(); });
                    }
                });
            }
        };

        return { TokenDialog, QueryBuilderDialog, AssignmentResultDialog, ErrorDialog, PersonnelSelectDialog };
    };

    // === 7. 主程式執行器 (AppRunner) ===
    const createAppRunner = (appConfig, appState, apiService, uiComponents, utils, uiManager, domHelper) => {
        const _getBatchDefaultFilters = () => {
            const endDate = new Date(),
                startDate = new Date();
            startDate.setDate(endDate.getDate() - 10);
            return { applyDateStart: utils.formatDateTime(startDate), applyDateEnd: utils.formatDateTime(endDate) };
        };

        const state = {
            tabs: {
                personal: { id: 'personal', name: '個人案件', data: null, status: 'idle', viewConfig: { ...appConfig.SHARED_VIEW_CONFIG, type: 'personal' }, error: null, queryInfo: null },
                batch: { id: 'batch', name: '批次案件', data: null, status: 'idle', viewConfig: { ...appConfig.SHARED_VIEW_CONFIG, type: 'batch' }, error: null, queryInfo: _getBatchDefaultFilters() },
                manual: { id: 'manual', name: '手動派件', data: [], status: 'success', viewConfig: null, error: null, queryInfo: null },
            },
            assigneeList: [...appConfig.DEFAULT_ASSIGNEES],
            isFiltersCollapsed: true,
            selectedCases: [],
        };
        
        const TableRenderer = {
            createHeaderRow: (viewConfig) => {
                const tr = domHelper.create('tr');
                viewConfig.columns.forEach(key => {
                    const def = appConfig.COLUMN_DEFINITIONS[key];
                    const isFolded = (viewConfig.foldedColumns || []).includes(key);
                    const th = domHelper.create('th', {
                        className: isFolded ? 'folded-column' : '',
                        attributes: { 'data-key': def.key, 'data-type': def.type || '', 'data-action': 'sort_column', title: '點擊排序' }
                    });

                    if (key === 'select') {
                        th.appendChild(domHelper.create('input', { type: 'checkbox', id: 'select-all-header' }));
                    } else {
                        th.textContent = def.label;
                        th.appendChild(domHelper.create('span', { className: 'sort-indicator' }));
                    }
                    tr.appendChild(th);
                });
                return tr;
            },
            createDataRow: (item, viewConfig, index) => {
                const tr = domHelper.create('tr');
                viewConfig.columns.forEach(key => {
                    const def = appConfig.COLUMN_DEFINITIONS[key];
                    const isFolded = (viewConfig.foldedColumns || []).includes(key);
                    const td = domHelper.create('td', {
                        className: isFolded ? 'folded-column' : '',
                        attributes: { title: item[key] ?? '', 'data-action': 'copy_cell' }
                    });

                    if (key === 'select') {
                        td.dataset.action = '';
                        td.appendChild(domHelper.create('input', { type: 'checkbox', className: 'case-checkbox', attributes: { value: item.applyNumber } }));
                    } else {
                        const displayValue = key === 'seq' ? index + 1 : (def.type === 'date' ? utils.formatDisplayDate(item[key]) : item[key] ?? '');
                        td.textContent = displayValue;
                    }
                    tr.appendChild(td);
                });
                return tr;
            }
        };

        const _requireToken = () => {
            if (appState.get('userToken')) return true;
            uiManager.Toast.show('請先設定 SSO-TOKEN 才能執行此操作', 'warning');
            return false;
        };

        async function executeApiCall(apiFunction, ...args) {
            let shouldRetry = true;
            while (shouldRetry) {
                shouldRetry = false;
                try {
                    return await apiFunction(...args);
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        const res = await uiComponents.ErrorDialog.show({ error });
                        if (res?.action === appConfig.MODAL_ACTIONS.RETRY) {
                            shouldRetry = true;
                        }
                    }
                }
            }
            return null;
        }

        async function fetchCasesForTab(tab) {
            tab.status = 'loading';
            let apiCall;
            if (tab.id === 'personal') {
                apiCall = () => apiService.fetchPersonalCases({});
            } else if (tab.id === 'batch' || tab.viewConfig?.type === 'query') {
                apiCall = () => apiService.fetchBatchCases(tab.queryInfo);
            }

            if (!apiCall) {
                tab.status = 'success';
                tab.data = [];
                return;
            }

            const data = await executeApiCall(apiCall);

            if (data !== null) {
                data.sort((a, b) => {
                    const applyNumberCompare = String(b.applyNumber ?? '').localeCompare(String(a.applyNumber ?? ''), undefined, { numeric: true });
                    if (applyNumberCompare !== 0) return applyNumberCompare;
                    const policyNumberCompare = String(b.policyNumber ?? '').localeCompare(String(a.policyNumber ?? ''), undefined, { numeric: true });
                    if (policyNumberCompare !== 0) return policyNumberCompare;
                    return new Date(b.applyDate).getTime() - new Date(a.applyDate).getTime();
                });
                tab.data = data;
                tab.status = 'success';
                tab.error = null;
            } else {
                tab.status = 'error';
                tab.error = new Error('資料載入失敗或被取消。');
            }
        }

        async function handleMainView(opts = {}) {
            const { forceFetch = false, targetTabId, collapseFilters = false } = opts;
            const activeTabId = targetTabId || appState.get('activeTabId');
            appState.set('activeTabId', activeTabId);

            const activeTab = state.tabs[activeTabId];
            
            if (!appState.get('userToken') && activeTabId !== 'manual') {
                activeTab.status = 'error';
                activeTab.error = new Error('SSO-TOKEN 未設定。請點擊左上角 🔑 圖示設定。');
                activeTab.data = [];
            } else if (forceFetch || activeTab.status === 'idle') {
                await fetchCasesForTab(activeTab);
            }

            const caseListViewShow = (tab) => {
                const isErrorState = tab.status === 'error';
                const caseList = tab.data || [];
                let sortState = { key: null, order: 'asc' };
                let currentData = [...caseList];
                let elements = {};
                
                const _generateFilterOptions = (cases) => {
                    const options = {};
                    appConfig.SHARED_FILTER_CONFIG.forEach(key => {
                        if (appConfig.TEXT_INPUT_FILTERS.includes(key)) return;
                        const values = new Set();
                        let hasBlank = false;
                        cases.forEach(item => {
                            const value = item[key];
                            if (value !== null && value !== undefined && value !== '') values.add(key.toLowerCase().includes('date') ? String(value).split(' ')[0] : String(value));
                            else hasBlank = true;
                        });
                        const sortedValues = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                        if(hasBlank) sortedValues.unshift('(空白)');
                        options[key] = sortedValues;
                    });
                    return options;
                };
                const filterOptions = _generateFilterOptions(caseList);

                function _renderTable(data) {
                    if (!elements.tbody) return;
                    elements.tbody.innerHTML = ''; 
                    if (isErrorState) {
                        const errorLink = domHelper.create('a', {
                            textContent: '點此設定 Token', attributes: { href: '#', 'data-action': 'change_token' },
                            style: { color: 'var(--primary-600)', fontWeight: '600', textDecoration: 'underline' }
                        });
                        const td = domHelper.create('td', {
                            attributes: { colspan: tab.viewConfig?.columns?.length || 1 },
                            style: { color: 'var(--gray-700)', fontWeight: '500', height: '150px', textAlign: 'center' },
                            children: [domHelper.create('div', { textContent: `${utils.escapeHtml(tab.error.message)} ` }), errorLink]
                        });
                        elements.tbody.appendChild(domHelper.create('tr', { children: [td] }));
                        elements.countElem.textContent = '載入失敗';
                        if (elements.nextBtn) elements.nextBtn.disabled = true;
                        return;
                    }
                    
                    const fragment = document.createDocumentFragment();
                    data.forEach((item, index) => {
                        fragment.appendChild(TableRenderer.createDataRow(item, tab.viewConfig, index));
                    });
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
                    elements.modal.querySelectorAll('.filter-select, .filter-input').forEach(input => {
                        if (input.value) filterValues[input.dataset.key] = input.value;
                    });
                    
                    let filteredData = caseList.filter(item => 
                        Object.entries(filterValues).every(([key, value]) => {
                            const itemValue = item[key] ?? '';
                            if (value === '(空白)') return itemValue === '';
                            if (appConfig.COLUMN_DEFINITIONS[key]?.type === 'date') return String(itemValue).startsWith(value);
                            return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
                        })
                    );

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
                    const headerHTML = `案件清單作業 v${appConfig.VERSION} (${appConfig.ENV})`;
                    const buttons = [
                        { action: appConfig.MODAL_ACTIONS.CHANGE_TOKEN, icon: '🔑', title: '重新驗證Token' },
                        { action: appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY, icon: '✨', title: '開啟新查詢' },
                        { action: appConfig.MODAL_ACTIONS.CLEAR_CACHE, icon: '🧹', title: '清除查詢頁籤與快取' },
                        { action: appConfig.MODAL_ACTIONS.RESET_WINDOW, icon: '🖼️', title: '還原視窗預設值' },
                    ];
                    const toolbar = domHelper.create('div', { className: 'header-toolbar', children:
                        buttons.map(btnInfo => domHelper.create('button', {
                            textContent: btnInfo.icon,
                            attributes: { 'data-action': btnInfo.action },
                            children: [domHelper.create('span', {className: 'tooltip-text', textContent: btnInfo.title})]
                        }))
                    });
                    const headerContent = domHelper.create('span', { textContent: headerHTML });
                    return { headerContent, toolbar };
                }
                
                function _createManualOpView() {
                    const createPersonnelList = (assignees) => {
                        const uniqueAssignees = [...new Set(assignees)];
                        const special = uniqueAssignees.filter(a => appConfig.SPECIAL_ASSIGNEES.includes(a)).sort();
                        const regular = uniqueAssignees.filter(a => !appConfig.SPECIAL_ASSIGNEES.includes(a)).sort();
                        return domHelper.create('ul', { className: 'personnel-list', children:
                            [...special, ...regular].map(assignee => domHelper.create('li', {
                                className: `selectable-item ${appConfig.SPECIAL_ASSIGNEES.includes(assignee) ? 'special-assignee' : ''}`,
                                textContent: assignee,
                                attributes: { 'data-value': assignee, 'data-action': 'select_assignee' }
                            }))
                        });
                    };
                    const defaultPane = domHelper.create('div', { className: 'personnel-selector-pane active', attributes: { 'data-pane': 'default' }, children: [createPersonnelList(state.assigneeList)] });
                    const importPane = domHelper.create('div', { className: 'personnel-selector-pane', attributes: { 'data-pane': 'import' } });
                    const manualPane = domHelper.create('div', { className: 'personnel-selector-pane', attributes: { 'data-pane': 'manual' }, children: [
                        domHelper.create('input', { id: 'manual-assignee-input', type: 'text', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號', style: 'margin-top:0;' } })
                    ]});
                    return domHelper.create('div', {
                        className: 'manual-op-container',
                        children: [
                            domHelper.create('div', { className: 'manual-op-section', children: [
                                domHelper.create('div', { className: 'section-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [
                                    domHelper.create('h3', { textContent: '1. 輸入受理號碼' }),
                                    domHelper.create('div', { style: { display: 'flex', gap: '8px' }, children: [
                                        domHelper.create('button', { 'data-action': 'import_cases', className: 'dispatch-btn dispatch-outline small', textContent: '匯入' }),
                                        domHelper.create('button', { 'data-action': 'clear_cases', className: 'dispatch-btn dispatch-outline small', textContent: '清除' })
                                    ]})
                                ]}),
                                domHelper.create('textarea', { id: 'manual-cases-input', className: 'dispatch-input', attributes: { placeholder: '請輸入受理號碼，以逗號、分號、空格或換行分隔', style: 'margin-top: 0; flex-grow: 1; resize: vertical;' } })
                            ]}),
                            domHelper.create('div', { className: 'manual-op-section', children: [
                                domHelper.create('h3', { textContent: '2. 選擇指派人員' }),
                                domHelper.create('div', { className: 'personnel-selector-cards', children: [
                                    domHelper.create('button', { className: 'card-btn active', textContent: '預設清單', attributes: { 'data-pane': 'default', 'data-action': 'switch_personnel_pane' } }),
                                    domHelper.create('button', { className: 'card-btn', textContent: '匯入清單', attributes: { 'data-pane': 'import', 'data-action': 'switch_personnel_pane' } }),
                                    domHelper.create('button', { className: 'card-btn', textContent: '手動輸入', attributes: { 'data-pane': 'manual', 'data-action': 'switch_personnel_pane' } }),
                                ]}),
                                domHelper.create('div', { className: 'personnel-selector-content', children: [defaultPane, importPane, manualPane] })
                            ]})
                        ]
                    });
                }

                function _createBody() {
                    const allTabs = [state.tabs.personal, state.tabs.batch, state.tabs.manual, ...Object.values(state.tabs).filter(t => t.id.startsWith('query_'))];
                    const tabButtons = allTabs.map(t => domHelper.create('button', {
                        className: t.id === activeTabId ? 'active' : '', attributes: { 'data-tab-id': t.id, 'data-action': 'switch_tab' }, textContent: t.name,
                        children: t.id.startsWith('query_') ? [domHelper.create('button', { className: 'close-tab-btn', textContent: '×', attributes: { 'data-tab-id': t.id, 'data-action': 'close_query_tab' } })] : []
                    }));
                    
                    const contentWrapper = domHelper.create('div', { className: 'tab-content-wrapper' });
                    
                    if (tab.id === 'manual') {
                        contentWrapper.appendChild(_createManualOpView());
                    } else if (tab.viewConfig) {
                        const createFilterControls = () => {
                            const renderControl = (key) => {
                                const def = appConfig.COLUMN_DEFINITIONS[key];
                                if (!def) return null;
                                const controlWrapper = domHelper.create('div');
                                let control;
                                const labelText = def.label;
                                
                                if (appConfig.TEXT_INPUT_FILTERS.includes(key)) {
                                    control = domHelper.create('input', {
                                        type: 'text', className: 'dispatch-input filter-input',
                                        attributes: { 'data-key': key, placeholder: `搜尋 ${labelText}...`, ...(isErrorState && { disabled: true }) }
                                    });
                                } else {
                                    const options = filterOptions[key] || [];
                                    control = domHelper.create('select', {
                                        className: 'dispatch-input filter-select',
                                        attributes: { 'data-key': key, ...(isErrorState && { disabled: true }) },
                                        children: [
                                            domHelper.create('option', { textContent: '全部', attributes: { value: '' } }),
                                            ...options.map(opt => domHelper.create('option', { textContent: opt, attributes: { value: opt } }))
                                        ]
                                    });
                                }
                                
                                const label = domHelper.create('label', {
                                    style: { fontSize: '14px', display: 'block', textAlign: 'left', marginBottom: '4px' },
                                    children: [
                                        document.createTextNode(labelText),
                                        !appConfig.TEXT_INPUT_FILTERS.includes(key) && domHelper.create('span', { className: 'filter-label-count', textContent: `(${(filterOptions[key] || []).length})` })
                                    ].filter(Boolean)
                                });
                                
                                controlWrapper.append(label, control);
                                return controlWrapper;
                            };
                            return domHelper.create('div', {
                                className: `filter-controls ${state.isFiltersCollapsed ? 'collapsed' : ''}`,
                                children: appConfig.SHARED_FILTER_CONFIG.map(renderControl).filter(Boolean)
                            });
                        };
                        
                        let queryDisplay = null;
                        if (tab.queryInfo) {
                            const criteriaHtml = Object.entries(tab.queryInfo).map(([key, value]) => {
                                if (!value) return null;
                                const label = appConfig.COLUMN_DEFINITIONS[key]?.label ?? key;
                                const displayValue = utils.escapeHtml(String(value).split(' ')[0]);
                                return `<strong>${label}:</strong> <span>${displayValue}</span>`;
                            }).filter(Boolean).join('; ');
                            
                            if (criteriaHtml) queryDisplay = domHelper.create('div', { className: 'query-criteria-display', innerHTML: `<strong>查詢條件:</strong> ${criteriaHtml}` });
                        }

                        contentWrapper.append(
                            queryDisplay,
                            createFilterControls(),
                            domHelper.create('div', {
                                className: 'controls-row', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px', flexShrink: 0 },
                                children: [
                                    domHelper.create('span', { id: 'case-count', style: { fontSize: '14px' } }),
                                    domHelper.create('div', {
                                        className: 'right-controls', style: { display: 'flex', gap: '8px', alignItems: 'center' },
                                        children: [
                                            domHelper.create('button', { 'data-action': 'toggle_filters', className: 'dispatch-btn dispatch-outline small', textContent: state.isFiltersCollapsed ? '展開篩選條件' : '收折篩選條件' }),
                                            domHelper.create('button', { 'data-action': 'toggle_columns', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多欄位' }),
                                            domHelper.create('button', { 'data-action': 'clear_filters', className: 'dispatch-btn dispatch-outline small', textContent: '清除篩選' }),
                                            domHelper.create('button', { 'data-action': 'export_csv', className: 'dispatch-btn small', textContent: '匯出CSV', attributes: { ...(isErrorState && { disabled: true }) } }),
                                            domHelper.create('button', { 'data-action': 'reload_view', className: 'dispatch-btn small', textContent: '重新整理' }),
                                        ]
                                    })
                                ]
                            }),
                            domHelper.create('div', {
                                id: 'case-table-container', className: 'case-table-container',
                                children: [
                                    domHelper.create('table', {
                                        id: 'case-table', className: 'case-table',
                                        children: [
                                            domHelper.create('thead', { children: [TableRenderer.createHeaderRow(tab.viewConfig)] }),
                                            domHelper.create('tbody')
                                        ]
                                    })
                                ]
                            })
                        );
                    } else {
                        contentWrapper.appendChild(domHelper.create('p', { textContent: '請選擇一個頁籤。' }));
                    }

                    return domHelper.create('div', {
                        className: 'dispatch-body',
                        children: [domHelper.create('div', { className: 'dispatch-tabs', children: tabButtons }), contentWrapper]
                    });
                }

                function _createFooter() {
                    const rightSide = domHelper.create('div', { style: { display: 'flex', gap: '8px', marginLeft: 'auto' } });
                    
                    if (tab.id === 'manual') {
                        rightSide.appendChild(domHelper.create('button', { 'data-action': 'manual_dispatch', className: 'dispatch-btn', textContent: '執行派件' }));
                    } else if (tab.viewConfig && !isErrorState) {
                        rightSide.appendChild(domHelper.create('button', { id: 'next-step-btn', 'data-action': 'next_step', className: 'dispatch-btn', textContent: '下一步 (0)', attributes: { disabled: true } }));
                    }
                    
                    return domHelper.create('div', { className: 'dispatch-footer', children: [rightSide] });
                }
                
                async function handleAction(e, resolve) {
                    const target = e.target;
                    const actionTarget = target.closest('[data-action]');
                    if (!actionTarget || !actionTarget.dataset.action) return;

                    const action = actionTarget.dataset.action;
                    if (action === 'close_query_tab') e.stopPropagation();

                    const actionsRequiringToken = [
                        'reload_view', 'open_new_query', 'next_step', 'manual_dispatch',
                        'clear_cache', 'export_csv'
                    ];

                    if (actionsRequiringToken.includes(action)) {
                        if (!_requireToken()) return;
                    }

                    switch (action) {
                        // --- RESOLVE ACTIONS ---
                        case appConfig.MODAL_ACTIONS.SWITCH_TAB:
                        case appConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB:
                        case appConfig.MODAL_ACTIONS.CHANGE_TOKEN:
                        case appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY:
                        case appConfig.MODAL_ACTIONS.CLEAR_CACHE:
                        case appConfig.MODAL_ACTIONS.RESET_WINDOW:
                        case appConfig.MODAL_ACTIONS.RELOAD_VIEW: {
                            resolve({ action, tabId: actionTarget.dataset.tabId });
                            break;
                        }
                        case appConfig.MODAL_ACTIONS.NEXT_STEP: {
                            const selectedCases = Array.from(elements.modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value);
                            if (selectedCases.length === 0) return;
                            resolve({ action, selectedCases });
                            break;
                        }
                        case appConfig.MODAL_ACTIONS.MANUAL_DISPATCH: {
                            const cases = utils.splitTextInput(elements.modal.querySelector('#manual-cases-input').value);
                            if (cases.length === 0) return uiManager.Toast.show('請輸入至少一筆受理號碼', 'error');
                            let assignee = null;
                            const manualInput = elements.modal.querySelector('#manual-assignee-input');
                            const selectedListItem = elements.modal.querySelector('.selectable-item.selected');
                            if (manualInput && manualInput.value.trim()) assignee = manualInput.value.trim();
                            else if (selectedListItem) assignee = selectedListItem.dataset.value;
                            if (!assignee) return uiManager.Toast.show('請選擇或輸入指派人員', 'error');
                            resolve({ action, cases, assignee });
                            break;
                        }

                        // --- UI-ONLY ACTIONS ---
                        case 'toggle_filters': {
                            const filters = elements.modal.querySelector('.filter-controls');
                            const isCollapsed = filters.classList.toggle('collapsed');
                            actionTarget.textContent = isCollapsed ? '展開篩選條件' : '收折篩選條件';
                            state.isFiltersCollapsed = isCollapsed;
                            break;
                        }
                        case 'toggle_columns': {
                            const tableContainer = elements.modal.querySelector('.case-table-container');
                            tableContainer.classList.toggle('show-all-columns');
                            actionTarget.textContent = tableContainer.classList.contains('show-all-columns') ? '隱藏部分欄位' : '顯示更多欄位';
                            break;
                        }
                        case 'clear_filters': {
                            elements.modal.querySelectorAll('.filter-select, .filter-input').forEach(el => el.value = '');
                            _applyFiltersAndSort();
                            break;
                        }
                        case 'export_csv': {
                            if (currentData.length === 0) return uiManager.Toast.show('沒有可匯出的資料', 'warning');
                            const filename = `${tab.viewConfig.type}_案件清單_${new Date().toISOString().slice(0, 10)}.csv`;
                            const csvData = utils.jsonToCsv(currentData, { dynamicHeaders: true });
                            utils.downloadCsv(csvData, filename);
                            break;
                        }
                        case 'sort_column': {
                            const key = actionTarget.dataset.key;
                            sortState.order = (sortState.key === key && sortState.order === 'asc') ? 'desc' : 'asc';
                            sortState.key = key;
                            elements.modal.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
                            actionTarget.querySelector('.sort-indicator').textContent = sortState.order === 'asc' ? '▲' : '▼';
                            _applyFiltersAndSort();
                            break;
                        }
                        case 'copy_cell': {
                            navigator.clipboard.writeText(actionTarget.textContent).then(() => uiManager.Toast.show('已複製', 'success', 1000));
                            break;
                        }

                        // --- MANUAL TAB ACTIONS ---
                        case 'switch_personnel_pane': {
                            const paneId = actionTarget.dataset.pane;
                            const container = elements.modal.querySelector('.manual-op-container');
                            container.querySelectorAll('.card-btn').forEach(b => b.classList.toggle('active', b.dataset.pane === paneId));
                            container.querySelectorAll('.personnel-selector-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === paneId));
                            if (paneId === 'import') {
                                try {
                                    const names = utils.splitTextInput(await utils.readTxt());
                                    if (names.length > 0) {
                                        state.assigneeList = [...new Set([...state.assigneeList, ...names])];
                                        const importPane = container.querySelector('[data-pane="import"]');
                                        importPane.innerHTML = '';
                                        importPane.appendChild(_createPersonnelList(names));
                                        const defaultPane = container.querySelector('[data-pane="default"]');
                                        defaultPane.innerHTML = '';
                                        defaultPane.appendChild(_createPersonnelList(state.assigneeList));
                                        uiManager.Toast.show(`成功匯入 ${names.length} 位人員`, 'success');
                                    }
                                } catch (e) {
                                    if (e.message !== '未選取檔案') uiManager.Toast.show(`匯入失敗: ${e.message}`, 'error');
                                    // Switch back to default on failure/cancel
                                    container.querySelectorAll('.card-btn').forEach(b => b.classList.toggle('active', b.dataset.pane === 'default'));
                                    container.querySelectorAll('.personnel-selector-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === 'default'));
                                }
                            }
                            break;
                        }
                        case 'select_assignee': {
                            elements.modal.querySelectorAll('.selectable-item').forEach(item => item.classList.remove('selected'));
                            actionTarget.classList.add('selected');
                            const manualInput = elements.modal.querySelector('#manual-assignee-input');
                            if (manualInput) manualInput.value = '';
                            break;
                        }
                        case 'import_cases': {
                            try {
                                const text = await utils.readTxt();
                                let cases = utils.splitTextInput(text);
                                if (cases.length > 50) {
                                    cases = cases.slice(0, 50);
                                    uiManager.Toast.show(`匯入資料超過50筆，將只讀取前50筆。`, 'warning', 3000);
                                }
                                if (cases.length > 0) {
                                    elements.modal.querySelector('#manual-cases-input').value = cases.join('\n');
                                    uiManager.Toast.show(`成功匯入 ${cases.length} 筆案件`, 'success');
                                }
                            } catch (e) {
                                if (e.message !== '未選取檔案') uiManager.Toast.show(e.message, 'error');
                            }
                            break;
                        }
                        case 'clear_cases': {
                            elements.modal.querySelector('#manual-cases-input').value = '';
                            break;
                        }
                    }
                }

                const {
                    headerContent,
                    toolbar
                } = _createHeader();
                return uiManager.Modal.show({
                    headerContent,
                    body: _createBody(),
                    footer: _createFooter(),
                    onOpen: (modal, resolve) => {
                        modal.querySelector('.dispatch-header').appendChild(toolbar);
                        modal.style.width = '';
                        modal.style.height = '';

                        elements = {
                            modal,
                            resolve,
                            tbody: modal.querySelector('tbody'),
                            table: modal.querySelector('#case-table'),
                            countElem: modal.querySelector('#case-count'),
                            nextBtn: modal.querySelector('#next-step-btn')
                        };

                        EventManager.add(modal, 'click', (e) => handleAction(e, resolve));
                        EventManager.add(modal, 'change', (e) => {
                            if (e.target.matches('.filter-select')) _applyFiltersAndSort();
                            if (e.target.matches('.case-checkbox, #select-all-header')) {
                                if (e.target.id === 'select-all-header') {
                                    elements.tbody.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = e.target.checked);
                                }
                                _updateNextButton();
                            }
                        });
                        EventManager.add(modal, 'keyup', (e) => {
                            if (e.target.matches('.filter-input')) _applyFiltersAndSort();
                        });

                        if (tab.id !== 'manual' && tab.viewConfig) {
                            _renderTable(currentData);
                            if (opts.collapseFilters) {
                                const toggleFiltersBtn = elements.modal.querySelector('[data-action="toggle_filters"]');
                                if(toggleFiltersBtn) toggleFiltersBtn.click();
                            }
                        }
                    }
                });
            };

            const res = await caseListViewShow(activeTab);

            appState.set('isLoading', false);
            switch (res?.action) {
                case appConfig.MODAL_ACTIONS.SWITCH_TAB:
                    await handleMainView({
                        targetTabId: res.tabId
                    });
                    break;
                case appConfig.MODAL_ACTIONS.RELOAD_VIEW:
                    state.isFiltersCollapsed = true;
                    await handleMainView({
                        forceFetch: true,
                        targetTabId: appState.get('activeTabId')
                    });
                    break;
                case appConfig.MODAL_ACTIONS.OPEN_NEW_QUERY:
                    await handleNewQuery();
                    break;
                case appConfig.MODAL_ACTIONS.CLEAR_CACHE:
                    await handleClearCache();
                    break;
                case appConfig.MODAL_ACTIONS.CHANGE_TOKEN:
                    await handleTokenChange();
                    break;
                case appConfig.MODAL_ACTIONS.NEXT_STEP:
                    state.selectedCases = res.selectedCases;
                    await handlePersonnelSelection();
                    break;
                case appConfig.MODAL_ACTIONS.MANUAL_DISPATCH:
                    await handleAssignment(res.assignee, res.cases);
                    break;
                case appConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB:
                    delete state.tabs[res.tabId];
                    await handleMainView({
                        targetTabId: 'batch'
                    });
                    break;
                case appConfig.MODAL_ACTIONS.RESET_WINDOW:
                    uiManager.Modal.resetPosition();
                    break;
                default:
                    break;
            }
        }
        async function handleTokenChange() {
            const res = await uiComponents.TokenDialog.show({
                mode: 'revalidate'
            });
            if (res?.action === appConfig.MODAL_ACTIONS.CONFIRM) {
                appState.set('userToken', res.value);
                Object.values(state.tabs).forEach(tab => {
                    if (tab.id !== 'manual') {
                        tab.status = 'idle';
                        tab.data = null;
                    }
                });
                apiService.clearCache();
                uiManager.Toast.show('Token 已更新', 'success');
                await handleMainView({
                    forceFetch: true
                });
            }
        }
        async function handleNewQuery() {
            const res = await uiComponents.QueryBuilderDialog.show({
                initialData: _getBatchDefaultFilters()
            });
            if (res?.action === appConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS) {
                const queryFilters = res.payload.batch;
                const newTabId = `query_${Date.now()}`;
                const queryTabsCount = Object.keys(state.tabs).filter(k => k.startsWith('query_')).length;

                state.tabs[newTabId] = {
                    id: newTabId,
                    name: `查詢結果 ${queryTabsCount + 1}`,
                    data: null,
                    status: 'idle',
                    viewConfig: { ...appConfig.SHARED_VIEW_CONFIG,
                        type: 'query'
                    },
                    error: null,
                    queryInfo: queryFilters
                };

                await handleMainView({
                    forceFetch: true,
                    targetTabId: newTabId,
                    collapseFilters: true
                });
            } else if (res?.action === appConfig.MODAL_ACTIONS.RESET_AND_RELOAD) {
                await handleNewQuery();
            }
        }
        async function handleClearCache() {
            if (window.confirm('您確定要清除所有「查詢結果」頁籤與快取嗎？')) {
                apiService.clearCache();
                Object.keys(state.tabs).forEach(key => {
                    if (key.startsWith('query_')) {
                        delete state.tabs[key];
                    } else {
                        state.tabs[key].status = 'idle';
                        state.tabs[key].data = null;
                    }
                });
                uiManager.Toast.show('已清除所有查詢頁籤與快取', 'success');
                const currentTabId = appState.get('activeTabId');
                const newTabId = currentTabId.startsWith('query_') ? 'batch' : currentTabId;
                await handleMainView({
                    forceFetch: true,
                    targetTabId: newTabId
                });
            }
        }
        async function handlePersonnelSelection() {
            const res = await uiComponents.PersonnelSelectDialog.show({
                selectedCount: state.selectedCases.length,
                defaultUsers: state.assigneeList
            });
            if (res?.action === appConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT) {
                await handleAssignment(res.assignee);
            }
        }
        async function handleAssignment(assignee, cases) {
            const casesToDispatch = cases || state.selectedCases;
            if (casesToDispatch.length === 0) {
                uiManager.Toast.show('沒有選擇任何案件', 'warning');
                return;
            }
            const result = await executeApiCall(() => apiService.manualAssign(casesToDispatch, assignee));

            if (result) {
                await uiComponents.AssignmentResultDialog.show({ ...result,
                    assignee
                });
                // Reset all data tabs to force refetch
                Object.values(state.tabs).forEach(tab => {
                    if (tab.id !== 'manual') {
                        tab.status = 'idle';
                        tab.data = null;
                    }
                });
                apiService.clearCache();
                state.isFiltersCollapsed = true;
                await handleMainView({
                    forceFetch: true
                });
            }
        }

        return {
            run
        };
    };

    /**
     * =========================================================================
     * II. 應用程式啟動區 (Application Bootstrap)
     * =========================================================================
     */
    try {
        if (document.getElementById(AppConfig.TOOL_CONTAINER_ID)) {
            console.log("工具已在執行中，將重新啟動。");
            document.querySelectorAll('[id^="dispatch-tool-"]').forEach(el => el.remove());
            document.querySelectorAll('.dispatch-mask, .dispatch-modal').forEach(el => el.remove());
        }
        const utils = createUtils(AppConfig);
        const domHelper = DOMHelper;
        const appState = createOptimizedState();
        const uiManager = createUIManager(AppConfig, appState, utils, domHelper);
        const apiService = createApiService(AppConfig, appState, uiManager);
        const uiComponents = createUIComponents(AppConfig, uiManager, utils, domHelper);
        const app = createAppRunner(AppConfig, appState, apiService, uiComponents, utils, uiManager, domHelper);
        
        ResourceManager.init();
        app.run();
    } catch (e) {
        console.error('案件清單作業 - 致命錯誤:', e);
        try {
            const uiManager = createUIManager(AppConfig, {}, createUtils(AppConfig), DOMHelper);
            uiManager.injectStyle();
            uiManager.Toast.show(`腳本發生致命錯誤: ${e.message}`, 'error', 5000);
        } catch (finalError) {
            alert(`腳本發生致命錯誤，且無法顯示提示框：\n${e.message}`);
        }
    }
})());
