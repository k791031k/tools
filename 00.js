/**
 * @fileoverview KGI Plan Code Query Tool - Refactored Version
 * @version 25.1.0-Fixed
 * @description
 * 最終修正版本：此版本修復了先前重構版本中的執行錯誤，可正常運行。
 * - 【已修復】修正了自動驗證 Token 時的變數引用錯誤，恢復自動登入功能。
 * - 【已優化】將依賴注入統一在服務的建構函式中完成，提高穩定性。
 * - 【已優化】改進事件處理器的 this 綁定方式，避免潛在的上下文問題。
 * - 保持所有 v25.0.0 的核心功能、查詢邏輯、UI/UX 不變。
 */

javascript:(function() {
    'use strict';

    // =================================================================================
    // 核心架構類 (Core Architecture Classes)
    // =================================================================================

    /**
     * @class DependencyContainer
     * @description 依賴注入容器，管理模組間的依賴關係。
     */
    class DependencyContainer {
        constructor() {
            /** @type {Map<string, any>} */
            this.services = new Map();
            /** @type {Map<string, Function>} */
            this.factories = new Map();
        }
        register(name, service) { this.services.set(name, service); }
        registerFactory(name, factory) { this.factories.set(name, factory); }
        get(name) {
            if (this.services.has(name)) return this.services.get(name);
            if (this.factories.has(name)) {
                const factory = this.factories.get(name);
                const service = factory(this);
                this.services.set(name, service);
                return service;
            }
            throw new Error(`Service ${name} not found`);
        }
    }

    /**
     * @class EventBus
     * @description 事件匯流排，實現模組間的鬆耦合通訊。
     */
    class EventBus {
        constructor() {
            /** @type {Map<string, Set<Function>>} */
            this.listeners = new Map();
        }
        on(event, callback) {
            if (!this.listeners.has(event)) this.listeners.set(event, new Set());
            this.listeners.get(event).add(callback);
        }
        off(event, callback) {
            if (this.listeners.has(event)) this.listeners.get(event).delete(callback);
        }
        emit(event, data = null) {
            if (this.listeners.has(event)) {
                this.listeners.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Event handler error for ${event}:`, error);
                    }
                });
            }
        }
        clear() { this.listeners.clear(); }
    }

    // =================================================================================
    // 靜態配置與常數 (Static Configuration & Constants)
    // =================================================================================

    const Constants = Object.freeze({
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '25.1.0-Fixed',
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            MASTER_CLASSIFIED: 'masterClassified',
            CHANNEL_CLASSIFIED: 'channelClassified',
        },
        STATUS_TYPES: {
            IN_SALE: '現售',
            STOPPED: '停售',
            PENDING: '尚未開賣',
            ABNORMAL: '日期異常',
        },
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api',
        },
        FIELD_MAPS: {
            CURRENCY: { '1': 'TWD', '2': 'USD', '3': 'AUD', '4': 'CNT', '5': 'USD_OIU', '6': 'EUR', '7': 'JPY' },
            UNIT: { 'A1': '元', 'A3': '仟元', 'A4': '萬元', 'B1': '計畫', 'C1': '單位' },
            COVERAGE_TYPE: { 'M': '主約', 'R': '附約' },
            CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC'],
        },
        DEFAULTS: {
            PAGE_SIZE_MASTER: 10000,
            PAGE_SIZE_CHANNEL: 10000,
            PAGE_SIZE_TABLE: 50,
            DEBOUNCE_DELAY: 500,
            BATCH_SIZE: 20,
        },
        EVENTS: {
            MODAL_CLOSE: 'modal:close',
            QUERY_START: 'query:start',
            DATA_UPDATED: 'data:updated',
            TOKEN_VERIFIED: 'auth:tokenVerified',
            STATE_CHANGED: 'state:changed',
            ERROR: 'system:error',
        }
    });

    // =================================================================================
    // 服務類別 (Service Classes)
    // =================================================================================

    class ConfigService {
        constructor() {
            this.env = (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD';
            this.apiBase = this.env === 'PROD' ? Constants.API_ENDPOINTS.PROD : Constants.API_ENDPOINTS.UAT;
        }
        get(key) { return this[key]; }
    }

    class StateService {
        constructor(eventBus) {
            this.eventBus = eventBus;
            this.state = this._getInitialState();
        }
        _getInitialState() {
            return {
                token: '', isTokenVerified: false, queryMode: '', queryInput: '',
                masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set(),
                pageNo: 1, pageSize: Constants.DEFAULTS.PAGE_SIZE_TABLE, isFullView: false,
                searchKeyword: '', sortKey: 'no', sortAsc: true,
                masterDataCache: null, channelDataCache: null, polplnDataCache: new Map(), mergedDataCache: null,
                currentQueryController: null, searchDebounceTimer: null, modalPosition: { top: null, left: null },
            };
        }
        get() { return { ...this.state }; }
        set(newState) {
            const oldState = { ...this.state };
            Object.assign(this.state, newState);
            this.eventBus.emit(Constants.EVENTS.STATE_CHANGED, { oldState, newState: this.state });
        }
        resetResultState() {
            this.set({ pageNo: 1, searchKeyword: '', isFullView: false, sortKey: 'no', sortAsc: true });
        }
        resetQueryConditions() {
            this.set({ queryMode: '', queryInput: '', masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set() });
        }
    }

    class UtilsService {
        escapeHtml(str) {
            if (typeof str !== 'string') return str;
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return str.replace(/[&<>"']/g, m => map[m]);
        }
        formatToday() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
        formatDateForUI(dt) { return !dt ? '' : String(dt).split(' ')[0].replace(/-/g, ''); }
        getSaleStatus(todayStr, saleStartStr, saleEndStr) {
            if (!saleStartStr || !saleEndStr) return Constants.STATUS_TYPES.ABNORMAL;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const startDate = new Date(saleStartStr.slice(0, 4), saleStartStr.slice(4, 6) - 1, saleStartStr.slice(6, 8));
            const endDate = new Date(saleEndStr.slice(0, 4), saleEndStr.slice(4, 6) - 1, saleEndStr.slice(6, 8));
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return Constants.STATUS_TYPES.ABNORMAL;
            if (today < startDate) return Constants.STATUS_TYPES.PENDING;
            if (today > endDate) return Constants.STATUS_TYPES.STOPPED;
            return Constants.STATUS_TYPES.IN_SALE;
        }
        convertCodeToText(v, map) { return map[String(v)] || v || ''; }
        async copyTextToClipboard(text, toastService) {
            try {
                await navigator.clipboard.writeText(text);
                toastService.show('已複製', 'success');
            } catch {
                toastService.show('複製失敗', 'error');
            }
        }
        splitInput(input) { return input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean); }
        toHalfWidthUpperCase(str) { return str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase(); }
    }
    
    class StyleService {
        injectStyle() {
            if (document.getElementById(Constants.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Constants.STYLE_ID;
            style.textContent = `
                :root { --primary-color: #4A90E2; --primary-dark-color: #357ABD; --secondary-color: #6C757D; --success-color: #5CB85C; --error-color: #D9534F; --warning-color: #F0AD4E; --background-light: #F8F8F8; --surface-color: #FFFFFF; --border-color: #E0E0E0; --text-color-dark: #1a1a1a; --box-shadow-medium: rgba(0,0,0,0.15); --border-radius-lg: 10px; --transition-speed: 0.25s; }
                .pct-modal-mask { position: fixed; z-index: 2147483646; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.25); opacity: 0; transition: opacity var(--transition-speed) ease-out; }
                .pct-modal-mask.show { opacity: 1; }
                .pct-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: var(--surface-color); border-radius: var(--border-radius-lg); box-shadow: 0 4px 24px var(--box-shadow-medium); padding: 0; max-width: 95vw; position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 2147483647; display: flex; flex-direction: column; }
                .pct-modal.show-init { opacity: 1; }
                .pct-modal.dragging { transition: none !important; }
                .pct-modal[data-size="query"] { width: 520px; }
                .pct-modal[data-size="results"] { width: 1050px; height: 700px; }
                .pct-modal-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid var(--border-color); color: var(--text-color-dark); cursor: grab; position: relative; flex-shrink: 0; }
                .pct-modal-header.dragging { cursor: grabbing; }
                .pct-modal-close-btn { position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 28px; font-weight: bold; color: var(--secondary-color); cursor: pointer; width: 36px; height: 36px; border-radius: 50%; transition: background-color .2s, color .2s; display: flex; align-items: center; justify-content: center; line-height: 1; }
                .pct-modal-close-btn:hover { background-color: #f0f0f0; color: #333; }
                .pct-modal-body { padding: 16px 20px 8px 20px; flex-grow: 1; overflow-y: auto; min-height: 50px; }
                .pct-modal[data-size="query"] .pct-modal-body { height: 280px; }
                .pct-modal-footer { padding: 12px 20px 16px 20px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
                .pct-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; font-size: 15px; border-radius: 6px; border: 1px solid transparent; background: var(--primary-color); color: #fff; cursor: pointer; transition: all var(--transition-speed); font-weight: 600; white-space: nowrap; }
                .pct-btn:hover { background: var(--primary-dark-color); }
                .pct-btn:disabled { background: #CED4DA; color: #A0A0A0; cursor: not-allowed; }
                .pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
                .pct-btn.pct-btn-outline:hover { background-color: var(--background-light); }
                .pct-input { width: 100%; font-size: 16px; padding: 9px 12px; border-radius: 5px; border: 1px solid var(--border-color); box-sizing: border-box; margin-top: 5px; transition: border-color .2s, box-shadow .2s; }
                .pct-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(74,144,226,0.2); outline: none; }
                .pct-search-wrapper { position: relative; display: inline-block; }
                #pct-search-input { width: 220px; font-size: 14px; padding: 6px 30px 6px 10px; background-color: #f0f7ff; border: 1px solid #b8d6f3; }
                #pct-clear-search { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 20px; color: #999; cursor: pointer; display: none; padding: 0 5px; }
                #pct-search-input:not(:placeholder-shown) + #pct-clear-search { display: block; }
                .pct-mode-card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
                .pct-sub-option-grid.master-status { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
                .pct-mode-card, .pct-sub-option, .pct-channel-option { background: var(--background-light); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; text-align: center; cursor: pointer; transition: all .2s ease-out; font-weight: 500; font-size: 14px; }
                .pct-mode-card.selected, .pct-sub-option.selected, .pct-channel-option.selected { background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
                .pct-table-wrap { flex: 1; overflow: auto; border: 1px solid var(--border-color); border-radius: 6px; }
                .pct-table { border-collapse: collapse; width: 100%; font-size: 13px; table-layout: fixed; min-width: 1000px; }
                .pct-table th { background: #f0f2f5; position: sticky; top: 0; z-index: 1; cursor: pointer; text-align: center; font-weight: bold; font-size: 14px; white-space: nowrap; }
                .pct-table th, .pct-table td { border: 1px solid #ddd; padding: 8px 4px; vertical-align: middle; text-align: center; }
                .pct-table td { text-align: left; }
                .pct-table th:nth-child(1), .pct-table td:nth-child(1) { width: 6.8%; text-align: center; } .pct-table th:nth-child(2), .pct-table td:nth-child(2) { width: 6.8%; } .pct-table th:nth-child(3), .pct-table td:nth-child(3) { width: 19.3%; } .pct-table th:nth-child(4), .pct-table td:nth-child(4) { width: 5.7%; text-align: center; } .pct-table th:nth-child(5), .pct-table td:nth-child(5) { width: 4.5%; text-align: center; } .pct-table th:nth-child(6), .pct-table td:nth-child(6) { width: 4.5%; text-align: center; } .pct-table th:nth-child(7), .pct-table td:nth-child(7) { width: 11.4%; text-align: center; } .pct-table th:nth-child(8), .pct-table td:nth-child(8) { width: 11.4%; text-align: center; } .pct-table th:nth-child(9), .pct-table td:nth-child(9) { width: 6.8%; text-align: center; } .pct-table th:nth-child(10), .pct-table td:nth-child(10) { width: 9.1%; } .pct-table th:nth-child(11), .pct-table td:nth-child(11) { width: 13.6%; }
                .pct-table th[data-key] { position: relative; padding-right: 20px; }
                .pct-table th[data-key]::after { content: ''; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.3; border: 4px solid transparent; }
                .pct-table th[data-key].sort-asc::after { border-bottom-color: var(--primary-color); opacity: 1; }
                .pct-table th[data-key].sort-desc::after { border-top-color: var(--primary-color); opacity: 1; }
                .pct-table tr:hover td { background: #e3f2fd; }
                .pct-table td.clickable-cell { cursor: cell; }
                .pct-load-polpln-btn { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; } .pct-load-polpln-btn:hover { background: #f0f0f0; }
                .pct-channel-insale { color: var(--primary-color); font-weight: bold; }
                .pct-channel-offsale { color: var(--error-color); }
                .pct-channel-separator { margin: 0 6px; color: #ccc; font-weight: bold; }
                .pct-toast { position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 22px; border-radius: 6px; font-size: 16px; z-index: 2147483647; opacity: 0; transition: opacity .3s, transform .3s; }
                .pct-toast.show { opacity: 1; }
                .pct-toast.success { background: var(--success-color); } .pct-toast.error { background: var(--error-color); }
                .pct-progress-container { display: none; align-items: center; gap: 16px; padding: 12px; background-color: #f0f8ff; border-radius: 6px; margin-bottom: 16px; }
                .pct-progress-bar-wrapper { flex-grow: 1; height: 10px; background-color: rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden; }
                .pct-progress-bar { width: 0%; height: 100%; background-color: var(--primary-color); transition: width .4s ease-out; }
            `;
            document.head.appendChild(style);
        }
    }
    
    class ToastService {
        show(msg, type = 'info', duration = 3000) {
            document.querySelector('.pct-toast')?.remove();
            const toastEl = document.createElement('div');
            toastEl.className = `pct-toast ${type}`;
            toastEl.textContent = msg;
            document.body.appendChild(toastEl);
            requestAnimationFrame(() => toastEl.classList.add('show'));
            if (duration > 0) {
                setTimeout(() => {
                    toastEl.classList.remove('show');
                    toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
                }, duration);
            }
        }
    }

    class ProgressService {
        show(text) {
            const anchor = document.querySelector('.pct-modal-body');
            if (!anchor) return;
            this.hide();
            const p = document.createElement('div');
            p.id = 'pct-progress-container';
            p.className = 'pct-progress-container';
            p.style.display = 'flex';
            p.innerHTML = `<span class="pct-progress-text">${text}</span><div class="pct-progress-bar-wrapper"><div id="pct-progress-bar" class="pct-progress-bar"></div></div>`;
            anchor.prepend(p);
        }
        update(percentage, text) {
            const bar = document.getElementById('pct-progress-bar');
            if (bar) bar.style.width = `${percentage}%`;
            const textEl = document.querySelector('#pct-progress-container .pct-progress-text');
            if (textEl && text) textEl.textContent = text;
        }
        hide() { document.getElementById('pct-progress-container')?.remove(); }
    }
    
    class ErrorHandler {
        constructor(eventBus, toastService) {
            this.eventBus = eventBus;
            this.toastService = toastService;
        }
        handleApiError(error, context = 'API 操作') {
            if (error.name === 'AbortError') { this.toastService.show('操作已取消', 'info'); return; }
            const message = `${context}失敗: ${error.message}`;
            console.error(message, error);
            this.toastService.show(message, 'error', 5000);
            this.eventBus.emit(Constants.EVENTS.ERROR, { error, context });
        }
        handleGenericError(error, context = '操作') {
            const message = `${context}發生錯誤: ${error.message}`;
            console.error(message, error);
            this.toastService.show(message, 'error');
            this.eventBus.emit(Constants.EVENTS.ERROR, { error, context });
        }
    }

    class ApiService {
        constructor(configService, stateService, errorHandler) {
            this.configService = configService;
            this.stateService = stateService;
            this.errorHandler = errorHandler;
        }
        async callApi(endpoint, params, signal) {
            const { apiBase } = this.configService;
            const { token } = this.stateService.get();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['SSO-TOKEN'] = token;
            try {
                const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(params), signal });
                if (!response.ok) {
                    let errorText = await response.text();
                    try { errorText = JSON.parse(errorText).message || errorText; } catch (e) {}
                    throw new Error(`請求失敗: ${errorText}`);
                }
                return response.json();
            } catch (error) {
                this.errorHandler.handleApiError(error, `呼叫 ${endpoint}`);
                throw error;
            }
        }
        async verifyToken(token) {
            if (!token) return false;
            try {
                const { apiBase } = this.configService;
                const response = await fetch(`${apiBase}/planCodeController/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
                    body: JSON.stringify({ planCode: '5105', currentPage: 1, pageSize: 1 }),
                });
                if (!response.ok) return false;
                const data = await response.json();
                return typeof data.total !== 'undefined' || typeof data.records !== 'undefined';
            } catch (e) {
                console.error("Token verification failed:", e);
                return false;
            }
        }
        async fetchMasterData(signal) {
            const res = await this.callApi('/planCodeController/query', { currentPage: 1, pageSize: Constants.DEFAULTS.PAGE_SIZE_MASTER }, signal);
            return res.records || [];
        }
        async fetchChannelData(signal) {
            const res = await this.callApi('/planCodeSaleDateController/query', { pageIndex: 1, size: Constants.DEFAULTS.PAGE_SIZE_CHANNEL }, signal);
            return (res.planCodeSaleDates?.records || []).map(r => ({ ...r, channel: r.channel === 'OT' ? 'BK' : r.channel }));
        }
        async fetchPolplnForCode(planCode, signal) {
            const res = await this.callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }, signal);
            return res.records || [];
        }
    }

    class DataService {
        constructor(stateService, apiService, utilsService, progressService) {
            this.stateService = stateService;
            this.apiService = apiService;
            this.utilsService = utilsService;
            this.progressService = progressService;
        }
        async initializeCaches(signal) {
            const { masterDataCache, channelDataCache } = this.stateService.get();
            const tasks = [];
            if (!masterDataCache) tasks.push(this.apiService.fetchMasterData(signal).then(data => this.stateService.set({ masterDataCache: data })));
            if (!channelDataCache) tasks.push(this.apiService.fetchChannelData(signal).then(data => this.stateService.set({ channelDataCache: data })));
            if (tasks.length > 0) {
                this.progressService.show('首次載入，正在獲取主檔與通路資料...');
                await Promise.all(tasks);
                this.progressService.update(50, '資料獲取完畢，正在合併處理...');
                this._mergeData();
            }
        }
        _mergeData() {
            const { masterDataCache, channelDataCache } = this.stateService.get();
            if (!masterDataCache || !channelDataCache) return;
            const today = this.utilsService.formatToday();
            const channelMap = channelDataCache.reduce((acc, cur) => {
                if (!acc.has(cur.planCode)) acc.set(cur.planCode, []);
                acc.get(cur.planCode).push(cur);
                return acc;
            }, new Map());
            const mergedData = masterDataCache.map(item => {
                const planCode = String(item.planCode || '-');
                const channels = (channelMap.get(planCode) || []).map(c => ({
                    channel: c.channel,
                    status: this.utilsService.getSaleStatus(today, this.utilsService.formatDateForUI(c.saleStartDate), this.utilsService.formatDateForUI(c.saleEndDate)),
                }));
                return {
                    planCode,
                    shortName: item.shortName || item.planName || '-',
                    currency: this.utilsService.convertCodeToText(item.currency || item.cur, Constants.FIELD_MAPS.CURRENCY),
                    unit: this.utilsService.convertCodeToText(item.reportInsuranceAmountUnit || item.insuranceAmountUnit, Constants.FIELD_MAPS.UNIT),
                    coverageType: this.utilsService.convertCodeToText(item.coverageType || item.type, Constants.FIELD_MAPS.COVERAGE_TYPE),
                    saleStartDate: this.utilsService.formatDateForUI(item.saleStartDate),
                    saleEndDate: this.utilsService.formatDateForUI(item.saleEndDate),
                    mainStatus: this.utilsService.getSaleStatus(today, this.utilsService.formatDateForUI(item.saleStartDate), this.utilsService.formatDateForUI(item.saleEndDate)),
                    polpln: null, channels,
                };
            });
            this.stateService.set({ mergedDataCache: mergedData });
        }
        getFilteredData() {
            const { mergedDataCache, queryMode, queryInput, masterStatusSelection, channelSelection, channelStatusSelection, searchKeyword, sortKey, sortAsc } = this.stateService.get();
            if (!mergedDataCache) return [];
            let data = [...mergedDataCache];
            switch (queryMode) {
                case Constants.QUERY_MODES.PLAN_CODE:
                    const codes = this.utilsService.splitInput(queryInput);
                    if (codes.length > 0) data = data.filter(item => codes.some(code => item.planCode.includes(code)));
                    break;
                case Constants.QUERY_MODES.PLAN_NAME:
                    data = data.filter(item => item.shortName.toLowerCase().includes(queryInput.toLowerCase()));
                    break;
                case Constants.QUERY_MODES.MASTER_CLASSIFIED:
                    data = data.filter(item => masterStatusSelection.has(item.mainStatus));
                    break;
                case Constants.QUERY_MODES.CHANNEL_CLASSIFIED:
                    data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel)));
                    if (channelStatusSelection === Constants.STATUS_TYPES.IN_SALE) data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel) && c.status === Constants.STATUS_TYPES.IN_SALE));
                    else if (channelStatusSelection === Constants.STATUS_TYPES.STOPPED) data = data.filter(item => {
                        const relevant = item.channels.filter(c => channelSelection.has(c.channel));
                        return relevant.length > 0 && !relevant.some(c => c.status === Constants.STATUS_TYPES.IN_SALE);
                    });
                    break;
            }
            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                data = data.filter(item => Object.values(item).some(value => String(value ?? '').toLowerCase().includes(keyword)));
            }
            if (sortKey && sortKey !== 'no') {
                data.sort((a, b) => {
                    let valA = a[sortKey], valB = b[sortKey];
                    if (valA == null) return 1; if (valB == null) return -1;
                    const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
                    return sortAsc ? comparison : -comparison;
                });
            }
            return data.map((item, index) => ({ ...item, no: index + 1 }));
        }
        async loadSinglePolpln(planCode, signal) {
            const polplnDataCache = this.stateService.get().polplnDataCache;
            if (polplnDataCache.has(planCode) && polplnDataCache.get(planCode) !== null) return;
            polplnDataCache.set(planCode, '載入中...');
            this.stateService.set({ polplnDataCache: new Map(polplnDataCache) });
            try {
                const records = await this.apiService.fetchPolplnForCode(planCode, signal);
                const extract = (str) => typeof str === 'string' ? str.trim().replace(/^\d+/, "").replace(/\d+$/, "").replace(/%$/, "").trim() : "";
                const unique = [...new Set(records.map(r => extract(r.polpln)).filter(Boolean))];
                polplnDataCache.set(planCode, unique.length === 1 ? unique[0] : (unique.length > 1 ? '多筆不同' : '無資料'));
            } catch (e) {
                if (e.name !== 'AbortError') polplnDataCache.set(planCode, '載入失敗');
                else polplnDataCache.set(planCode, null);
            }
            this.stateService.set({ polplnDataCache: new Map(polplnDataCache) });
        }
    }
    
    class UIDialogService {
        constructor(container) {
            this.container = container;
            this.stateService = this.container.get('state');
            this.eventBus = this.container.get('eventBus');
            this.configService = this.container.get('config');
            this.apiService = this.container.get('api');
            this.toastService = this.container.get('toast');
            this.dataService = this.container.get('data');
            this.utilsService = this.container.get('utils');
            this.progressService = this.container.get('progress');
            this.dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };
            this._handleEscKey = this._handleEscKey.bind(this);
            this._elementDrag = this._elementDrag.bind(this);
            this._closeDragElement = this._closeDragElement.bind(this);
        }
        _closeModal() {
            const modal = document.getElementById(Constants.TOOL_ID);
            if (modal) this.stateService.set({ modalPosition: { top: modal.style.top, left: modal.style.left } });
            this.stateService.get().currentQueryController?.abort();
            modal?.remove();
            document.getElementById('pctModalMask')?.remove();
            document.removeEventListener('keydown', this._handleEscKey);
        }
        _showModal(html, onOpen, size) {
            this._closeModal();
            const { modalPosition } = this.stateService.get();
            const mask = document.createElement('div');
            mask.id = 'pctModalMask';
            mask.className = 'pct-modal-mask show';
            document.body.appendChild(mask);
            const modal = document.createElement('div');
            modal.id = Constants.TOOL_ID;
            modal.className = 'pct-modal';
            modal.dataset.size = size;
            modal.innerHTML = html;
            if (modalPosition.top && modalPosition.left) {
                modal.style.top = modalPosition.top;
                modal.style.left = modalPosition.left;
                modal.style.transform = 'none';
            }
            document.body.appendChild(modal);
            requestAnimationFrame(() => modal.classList.add('show-init'));
            modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', this._dragMouseDown.bind(this));
            modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', () => this._closeModal());
            document.addEventListener('keydown', this._handleEscKey);
            if (onOpen) onOpen(modal);
        }
        _handleEscKey(e) { if (e.key === 'Escape') this._closeModal(); }
        _dragMouseDown(e) {
            const modal = document.getElementById(Constants.TOOL_ID);
            if (!modal || e.target.classList.contains('pct-modal-close-btn')) return;
            e.preventDefault();
            this.dragState.isDragging = true;
            modal.classList.add('dragging');
            this.dragState.startX = e.clientX; this.dragState.startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            this.dragState.initialLeft = rect.left; this.dragState.initialTop = rect.top;
            document.addEventListener('mousemove', this._elementDrag);
            document.addEventListener('mouseup', this._closeDragElement);
        }
        _elementDrag(e) {
            if (!this.dragState.isDragging) return;
            e.preventDefault();
            const modal = document.getElementById(Constants.TOOL_ID);
            modal.style.left = `${this.dragState.initialLeft + (e.clientX - this.dragState.startX)}px`;
            modal.style.top = `${this.dragState.initialTop + (e.clientY - this.dragState.startY)}px`;
            modal.style.transform = 'none';
        }
        _closeDragElement() {
            this.dragState.isDragging = false;
            document.getElementById(Constants.TOOL_ID)?.classList.remove('dragging');
            document.removeEventListener('mousemove', this._elementDrag);
            document.removeEventListener('mouseup', this._closeDragElement);
        }
        showTokenDialog(isModification = false) {
            const { env } = this.configService;
            const { token: currentToken } = this.stateService.get();
            const html = `<div class="pct-modal-header">${isModification?'修改':'設定'} Token (${env})<button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body"><div class="pct-form-group"><label for="pct-token-input">請貼上您的 SSO-TOKEN：</label><textarea id="pct-token-input" class="pct-input" rows="4">${isModification?currentToken:''}</textarea></div></div><div class="pct-modal-footer"><div></div><div style="display:flex;gap:10px;"><button id="pct-cancel-token" class="pct-btn pct-btn-outline">${isModification?'取消':'略過'}</button><button id="pct-confirm-token" class="pct-btn">${isModification?'確定':'驗證'}</button></div></div>`;
            this._showModal(html, (modal) => {
                const tokenInput = modal.querySelector('#pct-token-input'), confirmBtn = modal.querySelector('#pct-confirm-token'), cancelBtn = modal.querySelector('#pct-cancel-token');
                const handleConfirm = async () => {
                    const token = tokenInput.value.trim();
                    if (!token) { this.toastService.show('Token 不可為空', 'error'); return; }
                    confirmBtn.disabled = true; confirmBtn.textContent = '驗證中...';
                    if (await this.apiService.verifyToken(token)) {
                        localStorage.setItem('SSO-TOKEN', token);
                        this.stateService.set({ token, isTokenVerified: true });
                        this.toastService.show(isModification ? 'Token 已更新' : 'Token 驗證成功', 'success');
                        this.showQueryDialog(isModification);
                    } else {
                        this.toastService.show('Token 驗證失敗', 'error');
                        confirmBtn.disabled = false; confirmBtn.textContent = isModification ? '確定' : '驗證';
                    }
                };
                cancelBtn.addEventListener('click', () => {
                    if (isModification) this.showQueryDialog(true); else {
                        this.stateService.set({ token: '', isTokenVerified: false });
                        this.toastService.show('已略過驗證', 'warning');
                        this.showQueryDialog();
                    }
                });
                confirmBtn.addEventListener('click', handleConfirm);
                tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); } });
            }, 'query');
        }
        showQueryDialog(preserveState = false) {
            if (!preserveState) this.stateService.resetQueryConditions();
            this.stateService.resetResultState();
            const { env } = this.configService;
            const html = `<div class="pct-modal-header">選擇查詢條件 (${env})<button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body"><div class="pct-form-group"><label>查詢模式:</label><div class="pct-mode-card-grid"><div class="pct-mode-card" data-mode="${Constants.QUERY_MODES.PLAN_CODE}">商品代號</div><div class="pct-mode-card" data-mode="${Constants.QUERY_MODES.PLAN_NAME}">商品名稱</div><div class="pct-mode-card" data-mode="${Constants.QUERY_MODES.MASTER_CLASSIFIED}">主約銷售時間</div><div class="pct-mode-card" data-mode="${Constants.QUERY_MODES.CHANNEL_CLASSIFIED}">通路銷售時間</div></div><div id="pct-dynamic-options" style="display:none; margin-top: 15px;"></div></div></div><div class="pct-modal-footer"><div class="pct-modal-footer-left" style="display:flex; gap:10px;"><button id="pct-change-token" class="pct-btn pct-btn-outline">修改 Token</button>${preserveState ? '<button id="pct-clear-selection" class="pct-btn pct-btn-outline">清除選擇</button>' : ''}</div><div class="pct-modal-footer-right"><button id="pct-start-query" class="pct-btn" disabled>開始查詢</button></div></div>`;
            this._showModal(html, (modal) => {
                const startQueryBtn = modal.querySelector('#pct-start-query');
                const updateDynamicOptions = (mode) => {
                    let c = '';
                    switch (mode) {
                        case Constants.QUERY_MODES.PLAN_CODE: c = `<label for="pct-plan-code-input">商品代碼(模糊)：(多筆可用空白、逗號或換行分隔)</label><textarea id="pct-plan-code-input" class="pct-input" rows="3"></textarea>`; break;
                        case Constants.QUERY_MODES.PLAN_NAME: c = `<label for="pct-plan-name-input">商品名稱關鍵字：</label><input type="text" id="pct-plan-name-input" class="pct-input" placeholder="例如：健康、終身">`; break;
                        case Constants.QUERY_MODES.MASTER_CLASSIFIED: c = `<label>主約銷售狀態：</label><div class="pct-sub-option-grid master-status">${Object.values(Constants.STATUS_TYPES).map(s=>`<div class="pct-sub-option" data-status="${s}">${s}</div>`).join('')}</div>`; break;
                        case Constants.QUERY_MODES.CHANNEL_CLASSIFIED: c = `<label>選擇通路：</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"><div class="pct-channel-option" data-channel="all"><strong>全選</strong></div>${Constants.FIELD_MAPS.CHANNELS.map(ch=>`<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`).join('')}</div><label style="margin-top:10px;">銷售範圍：</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"><div class="pct-sub-option" data-range="${Constants.STATUS_TYPES.IN_SALE}">現售商品</div><div class="pct-sub-option" data-range="${Constants.STATUS_TYPES.STOPPED}">停售商品</div></div>`; break;
                    }
                    modal.querySelector('#pct-dynamic-options').innerHTML = c;
                    modal.querySelector('#pct-dynamic-options').style.display = c ? 'block' : 'none';
                    bindDynamicEvents();
                };
                const checkCanStartQuery = () => {
                    const s = this.stateService.get(); let can = false;
                    switch(s.queryMode){
                        case Constants.QUERY_MODES.PLAN_CODE: can = !!modal.querySelector('#pct-plan-code-input')?.value.trim(); break;
                        case Constants.QUERY_MODES.PLAN_NAME: can = !!modal.querySelector('#pct-plan-name-input')?.value.trim(); break;
                        case Constants.QUERY_MODES.MASTER_CLASSIFIED: can = s.masterStatusSelection.size > 0; break;
                        case Constants.QUERY_MODES.CHANNEL_CLASSIFIED: can = s.channelSelection.size > 0 && !!s.channelStatusSelection; break;
                    }
                    startQueryBtn.disabled = !can;
                };
                const bindDynamicEvents = () => {
                    modal.querySelectorAll('.pct-sub-option[data-status]').forEach(o=>o.addEventListener('click', ()=>{ o.classList.toggle('selected'); this.stateService.set({masterStatusSelection: new Set(Array.from(modal.querySelectorAll('.pct-sub-option[data-status].selected')).map(el=>el.dataset.status))}); checkCanStartQuery(); }));
                    const chOpts = modal.querySelectorAll('.pct-channel-option');
                    chOpts.forEach(o=>o.addEventListener('click', ()=>{ const ch = o.dataset.channel; if(ch === 'all'){ const allSel = o.classList.contains('selected'); chOpts.forEach(opt=>opt.classList.toggle('selected',!allSel));} else { o.classList.toggle('selected'); modal.querySelector('.pct-channel-option[data-channel="all"]').classList.toggle('selected', Array.from(chOpts).filter(opt=>opt.dataset.channel!=='all').every(opt=>opt.classList.contains('selected')));} this.stateService.set({channelSelection:new Set(Array.from(modal.querySelectorAll('.pct-channel-option.selected')).map(el=>el.dataset.channel).filter(c=>c!=='all'))}); checkCanStartQuery();}));
                    modal.querySelectorAll('.pct-sub-option[data-range]').forEach(o=>o.addEventListener('click', ()=>{ modal.querySelectorAll('.pct-sub-option[data-range]').forEach(i=>i.classList.remove('selected')); o.classList.add('selected'); this.stateService.set({channelStatusSelection:o.dataset.range}); checkCanStartQuery();}));
                    modal.querySelectorAll('.pct-input').forEach(i=>i.addEventListener('input', e=>{const{value,selectionStart,selectionEnd}=e.target; e.target.value=this.utilsService.toHalfWidthUpperCase(value); e.target.setSelectionRange(selectionStart,selectionEnd); checkCanStartQuery();}));
                };
                modal.querySelectorAll('.pct-mode-card').forEach(c=>c.addEventListener('click',()=>{ modal.querySelectorAll('.pct-mode-card').forEach(i=>i.classList.remove('selected')); c.classList.add('selected'); this.stateService.set({queryMode:c.dataset.mode}); updateDynamicOptions(c.dataset.mode); checkCanStartQuery();}));
                if(preserveState){ const {queryMode,queryInput,masterStatusSelection,channelSelection,channelStatusSelection}=this.stateService.get(); if(queryMode){ const card=modal.querySelector(`.pct-mode-card[data-mode="${queryMode}"]`); if(card){ card.click(); if(queryMode==='planCode'||queryMode==='planCodeName'){const i=modal.querySelector('.pct-input');if(i){i.value=queryInput; i.dispatchEvent(new Event('input'));}} else if(queryMode==='masterClassified'){masterStatusSelection.forEach(s=>modal.querySelector(`.pct-sub-option[data-status="${s}"]`)?.click());} else if(queryMode==='channelClassified'){channelSelection.forEach(c=>modal.querySelector(`.pct-channel-option[data-channel="${c}"]`)?.click()); if(channelStatusSelection)modal.querySelector(`.pct-sub-option[data-range="${channelStatusSelection}"]`)?.click();}}}}
                modal.querySelector('#pct-change-token').addEventListener('click',()=>this.showTokenDialog(true));
                modal.querySelector('#pct-clear-selection')?.addEventListener('click',()=>this.showQueryDialog(false));
                startQueryBtn.addEventListener('click',()=>{this.stateService.set({queryInput:modal.querySelector('.pct-input')?.value.trim()||''}); this.eventBus.emit(Constants.EVENTS.QUERY_START);});
            }, 'query');
        }
        showResultsDialog() {
            const { env } = this.configService;
            const html = `<div class="pct-modal-header">查詢結果 (${env})<button class="pct-modal-close-btn">&times;</button></div><div class="pct-modal-body" style="display:flex;flex-direction:column;height:100%;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-shrink:0;"><div class="pct-search-wrapper"><label for="pct-search-input" style="font-size:14px;color:#666;margin-right:5px;">搜尋:</label><input type="text" id="pct-search-input" placeholder="篩選結果..."><button id="pct-clear-search" title="清除搜尋">&times;</button></div><div style="display:flex;align-items:center;gap:15px;"><span id="pct-result-count" style="font-size:16px;color:#333;font-weight:bold;"></span><div class="pct-pagination" style="display:flex;align-items:center;gap:5px;"><button id="pct-prev-page" class="pct-btn pct-btn-outline" style="padding:5px 10px;">◀</button><span id="pct-page-info" style="font-size:14px;min-width:50px;text-align:center;">-</span><button id="pct-next-page" class="pct-btn pct-btn-outline" style="padding:5px 10px;">▶</button></div></div></div><div class="pct-table-wrap"><table class="pct-table"><thead><tr><th data-key="no">No</th><th data-key="planCode">代號</th><th data-key="shortName">名稱</th><th data-key="currency">幣別</th><th data-key="unit">單位</th><th data-key="coverageType">類型</th><th data-key="saleStartDate">主約銷售日</th><th data-key="saleEndDate">主約停賣日</th><th data-key="mainStatus">險種狀態</th><th data-key="polpln">商品名稱</th><th>銷售通路</th></tr></thead><tbody id="pct-table-body"></tbody></table></div></div><div class="pct-modal-footer"><div class="pct-modal-footer-left" style="display:flex;gap:10px;"><button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button><button id="pct-load-all-polpln" class="pct-btn pct-btn-outline">全部載入 POLPLN</button></div><div class="pct-modal-footer-right" style="display:flex;gap:15px;"><button id="pct-copy-all" class="pct-btn">一鍵複製</button><button id="pct-back-to-query" class="pct-btn">重新查詢</button></div></div>`;
            this._showModal(html, (modal) => this._setupResultsDialogEvents(modal), 'results');
        }
        _setupResultsDialogEvents(modal) {
            const searchInput = modal.querySelector('#pct-search-input');
            searchInput.addEventListener('input', e=>{const{value,selectionStart,selectionEnd}=e.target;e.target.value=this.utilsService.toHalfWidthUpperCase(value);e.target.setSelectionRange(selectionStart,selectionEnd);clearTimeout(this.stateService.get().searchDebounceTimer);const t=setTimeout(()=>{this.stateService.set({searchKeyword:searchInput.value.trim(),pageNo:1});this.rerenderTable();},Constants.DEFAULTS.DEBOUNCE_DELAY);this.stateService.set({searchDebounceTimer:t});});
            modal.querySelector('#pct-clear-search').addEventListener('click',()=>{searchInput.value='';this.stateService.set({searchKeyword:'',pageNo:1});this.rerenderTable();});
            modal.querySelector('#pct-table-body').addEventListener('click', async e=>{const t=e.target;if(t.classList.contains('clickable-cell')){const v=t.textContent.trim();if(v&&v!=='...')await this.utilsService.copyTextToClipboard(v,this.toastService);}else if(t.classList.contains('pct-load-polpln-btn')){t.disabled=true;t.textContent='...';await this.dataService.loadSinglePolpln(t.dataset.plancode,new AbortController().signal);this.rerenderTable();}});
            modal.querySelectorAll('th[data-key]').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.key;const{sortKey,sortAsc}=this.stateService.get();this.stateService.set(sortKey===k?{sortAsc:!sortAsc}:{sortKey:k,sortAsc:true});this.rerenderTable();}));
            modal.querySelector('#pct-load-all-polpln').addEventListener('click', async e=>{e.target.disabled=true;const toLoad=this.dataService.getFilteredData().filter(i=>i.polpln===null);if(toLoad.length===0){this.toastService.show('所有 POLPLN 皆已載入','info');e.target.disabled=false;return;}this.progressService.show('批次載入商品名稱...');for(let i=0;i<toLoad.length;i+=Constants.DEFAULTS.BATCH_SIZE){const batch=toLoad.slice(i,i+Constants.DEFAULTS.BATCH_SIZE);this.progressService.update((i+batch.length)/toLoad.length*100,`載入 ${i+batch.length}/${toLoad.length}...`);await Promise.all(batch.map(item=>this.dataService.loadSinglePolpln(item.planCode,new AbortController().signal)));this.rerenderTable();}this.progressService.hide();e.target.disabled=false;});
            modal.querySelector('#pct-toggle-view').addEventListener('click',e=>{const isFull=!this.stateService.get().isFullView;this.stateService.set({isFullView:isFull,pageNo:1});e.target.textContent=isFull?'分頁顯示':'一頁顯示';this.rerenderTable();});
            modal.querySelector('#pct-prev-page').addEventListener('click',()=>{const{pageNo}=this.stateService.get();if(pageNo>1){this.stateService.set({pageNo:pageNo-1});this.rerenderTable();}});
            modal.querySelector('#pct-next-page').addEventListener('click',()=>{const{pageNo,pageSize}=this.stateService.get();const max=Math.ceil(this.dataService.getFilteredData().length/pageSize);if(pageNo<max){this.stateService.set({pageNo:pageNo+1});this.rerenderTable();}});
            modal.querySelector('#pct-copy-all').addEventListener('click',()=>{const data=this.dataService.getFilteredData();if(data.length===0){this.toastService.show('無資料可複製','warning');return;}const h=['No','代號','名稱','幣別','單位','類型','主約銷售日','主約停賣日','險種狀態','商品名稱','銷售通路'];const r=data.map(i=>[i.no,i.planCode,i.shortName,i.currency,i.unit,i.coverageType,i.saleStartDate,i.saleEndDate,i.mainStatus,i.polpln,i.channels.map(c=>c.channel).join(' ')]);this.utilsService.copyTextToClipboard([h,...r].map(row=>row.join('\t')).join('\n'),this.toastService);});
            modal.querySelector('#pct-back-to-query').addEventListener('click',()=>this.showQueryDialog(true));
        }
        rerenderTable() {
            const data = this.dataService.getFilteredData();
            const { isFullView, pageNo, pageSize, sortKey, sortAsc, polplnDataCache } = this.stateService.get();
            const displayData = isFullView ? data : data.slice((pageNo - 1) * pageSize, pageNo * pageSize);
            const body = document.getElementById('pct-table-body');
            if(body) body.innerHTML = displayData.length > 0 ? displayData.map(item => this._renderTableRow(item, polplnDataCache)).join('') : `<tr><td colspan="11" style="text-align:center; padding: 20px;">查無符合條件的資料</td></tr>`;
            document.querySelectorAll('th[data-key]').forEach(th => { th.classList.remove('sort-asc','sort-desc'); if (th.dataset.key === sortKey) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc'); });
            this._updatePaginationInfo(data.length);
            document.getElementById('pct-result-count').textContent = `共 ${data.length} 筆資料`;
        }
        _renderTableRow(item, polplnCache) {
            const val = polplnCache.get(item.planCode);
            const content = (val === undefined || val === null) ? `<button class="pct-load-polpln-btn" data-plancode="${item.planCode}">載入</button>` : `<span class="clickable-cell">${this.utilsService.escapeHtml(val)}</span>`;
            return `<tr><td class="clickable-cell">${item.no}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.planCode)}</td><td class="clickable-cell" title="${this.utilsService.escapeHtml(item.shortName)}">${this.utilsService.escapeHtml(item.shortName)}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.currency)}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.unit)}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.coverageType)}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.saleStartDate)}</td><td class="clickable-cell">${this.utilsService.escapeHtml(item.saleEndDate)}</td><td>${this._renderStatusPill(item.mainStatus)}</td><td>${content}</td><td>${this._renderChannelsCell(item.channels)}</td></tr>`;
        }
        _renderStatusPill(status) {
            const emoji = {[Constants.STATUS_TYPES.IN_SALE]:'🟢',[Constants.STATUS_TYPES.STOPPED]:'🔴',[Constants.STATUS_TYPES.PENDING]:'🔵',[Constants.STATUS_TYPES.ABNORMAL]:'🟡'}[status]||'⚪';
            return `<span class="clickable-cell">${emoji} ${status}</span>`;
        }
        _renderChannelsCell(channels) {
            if (!channels || channels.length === 0) return ' - ';
            const { IN_SALE, STOPPED } = Constants.STATUS_TYPES;
            const order = { [IN_SALE]: 1, [STOPPED]: 2 };
            const grouped = channels.reduce((acc,{channel,status})=>{if(!acc[status])acc[status]=[];acc[status].push(channel);return acc;},{});
            Object.values(grouped).forEach(g=>g.sort());
            return Object.entries(grouped).sort(([sA],[sB])=>(order[sA]||99)-(order[sB]||99)).map(([s,c])=>`<span class="${s===IN_SALE?'pct-channel-insale':'pct-channel-offsale'}">${c.join(' ')}</span>`).join('<span class="pct-channel-separator">|</span>');
        }
        _updatePaginationInfo(total) {
            const { isFullView, pageNo, pageSize } = this.stateService.get();
            const el = document.querySelector('.pct-pagination');
            if (!el) return;
            if (isFullView || total === 0) el.style.visibility = 'hidden'; else {
                el.style.visibility = 'visible';
                const max = Math.max(1, Math.ceil(total / pageSize));
                el.querySelector('#pct-page-info').textContent = `${pageNo} / ${max}`;
                el.querySelector('#pct-prev-page').disabled = pageNo <= 1;
                el.querySelector('#pct-next-page').disabled = pageNo >= max;
            }
        }
    }

    // =================================================================================
    // 主應用程式 (Main Application Class)
    // =================================================================================

    class Application {
        constructor() {
            this.container = new DependencyContainer();
            this.eventBus = new EventBus();
            this._registerServices();
            this._setupEventListeners();
        }
        _registerServices() {
            this.container.register('eventBus', this.eventBus);
            this.container.registerFactory('config', () => new ConfigService());
            this.container.registerFactory('utils', () => new UtilsService());
            this.container.registerFactory('style', () => new StyleService());
            this.container.registerFactory('toast', () => new ToastService());
            this.container.registerFactory('progress', () => new ProgressService());
            this.container.registerFactory('state', c => new StateService(c.get('eventBus')));
            this.container.registerFactory('errorHandler', c => new ErrorHandler(c.get('eventBus'), c.get('toast')));
            this.container.registerFactory('api', c => new ApiService(c.get('config'), c.get('state'), c.get('errorHandler')));
            this.container.registerFactory('data', c => new DataService(c.get('state'), c.get('api'), c.get('utils'), c.get('progress')));
            this.container.registerFactory('dialog', c => new UIDialogService(c));
        }
        _setupEventListeners() {
            this.eventBus.on(Constants.EVENTS.QUERY_START, async () => {
                const dialog = this.container.get('dialog'), data = this.container.get('data'), state = this.container.get('state'), progress = this.container.get('progress');
                dialog.showResultsDialog();
                await new Promise(r => setTimeout(r, 50));
                if (!state.get().isTokenVerified) {
                    document.getElementById('pct-table-body').innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--error-color);">權限不足，請返回並提供有效 Token。</td></tr>`;
                    document.getElementById('pct-result-count').textContent = '共 0 筆資料'; return;
                }
                const controller = new AbortController(); state.set({ currentQueryController: controller });
                try {
                    await data.initializeCaches(controller.signal);
                    progress.hide(); dialog.rerenderTable();
                } catch (error) {
                    progress.hide(); if (error.name !== 'AbortError') dialog.rerenderTable();
                } finally {
                    state.set({ currentQueryController: null });
                }
            });
        }
        _cleanup() {
            document.querySelectorAll(`#${Constants.TOOL_ID}, #${Constants.STYLE_ID}, .pct-toast`).forEach(el => el.remove());
            this.eventBus.clear();
        }
        async start() {
            try {
                this._cleanup();
                this.container.get('style').injectStyle();
                const dialog = this.container.get('dialog'), toast = this.container.get('toast'), state = this.container.get('state'), api = this.container.get('api');
                const storedToken = localStorage.getItem('SSO-TOKEN') || sessionStorage.getItem('SSO-TOKEN');
                if (storedToken) {
                    toast.show('正在自動驗證 Token...', 'info', 2000);
                    if (await api.verifyToken(storedToken)) {
                        state.set({ token: storedToken, isTokenVerified: true });
                        toast.show('Token 驗證成功', 'success');
                        dialog.showQueryDialog();
                    } else {
                        state.set({ token: '', isTokenVerified: false });
                        toast.show('自動驗證失敗，請手動輸入', 'warning');
                        dialog.showTokenDialog();
                    }
                } else {
                    dialog.showTokenDialog();
                }
            } catch (error) {
                this.container.get('errorHandler').handleGenericError(error, '應用程式啟動');
            }
        }
    }

    const app = new Application();
    app.start();

})();