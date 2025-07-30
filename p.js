javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * KGI Plan Code Query Tool v1.5.1 (Final Filter Logic Version)
     *
     * @version 1.5.1
     * @author Gemini AI based on final user specifications
     * @description
     * 本版本為最終交付版，根據使用者最終篩選邏輯定案進行重構：
     *
     * --- 核心功能與設計原則 ---
     * 1.  [篩選邏輯定案] 結果頁的所有篩選器（包含標準與進階）皆為下拉選單。其選項直接使用 API 回傳的原始值，不進行中文轉換，確保資料的原始一致性。
     * 2.  [UI/UX 定案] 查詢結果頁的篩選列採「標題在上，選項在下」的兩層式佈局，並提供「收折/展開」功能，優化空間利用。
     * 3.  [UI/UX 優化] 將「更新時間」移至標頭、「名稱開關」移至搜尋框旁，操作動線更合理。
     * 4.  [記憶體管理] 強化關閉機制，無論透過 ESC 鍵或右上角關閉按鈕，都會在關閉前徹底清除所有資料快取，避免瀏覽器當機風險。
     * 5.  [功能保留] 保留逐筆載入 POLPLN 的功能，但隱藏批次載入按鈕，介面更簡潔。
     * 6.  [資料流] 嚴格遵守「一次查詢，前端處理」原則。結果頁的所有篩選、排序、搜尋皆為純前端操作，不產生額外 API 請求。
     * 7.  [動態篩選] 結果頁的所有篩選器選項，皆根據當次查詢結果集(initialQueryData)的內容動態產生。
     * 8.  [BUG 修正] 修正禁用狀態按鈕因對比度不足導致文字看不見的問題，並修正篩選器收折後無法展開的 Bug。
     * =================================================================================
     */

    /**
     * @module ConfigModule
     * @description 靜態設定與常數管理模組。
     */
    const ConfigModule = Object.freeze({
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '1.5.1',
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            MASTER_CLASSIFIED: 'masterClassified',
            CHANNEL_CLASSIFIED: 'channelClassified',
        },
        RESULTS_PAGE_FILTERS: [
            { key: 'mainStatus', label: '主檔狀態', type: 'standard', filterType: 'select' },
            { key: 'currency', label: '幣別', type: 'standard', filterType: 'select' },
            { key: 'unit', label: '單位', type: 'standard', filterType: 'select' },
            { key: 'coverageType', label: '型態', type: 'standard', filterType: 'select' },
            { key: 'policyType', rawKey: 'cnttype', label: '保單類型', type: 'advanced', filterType: 'select' },
            { key: 'category', rawKey: 'accumulationType', label: '分類類別', type: 'advanced', filterType: 'select' },
            { key: 'hasFuneralExpenses', rawKey: 'burialAmountFlag', label: '喪葬費用', type: 'advanced', filterType: 'select' },
            { key: 'noRiderAttachable', rawKey: 'noCoverageFlag', label: '附加附約', type: 'advanced', filterType: 'select' },
            { key: 'isSinglePremium', rawKey: 'singlePaymentFlag', label: '躉繳', type: 'advanced', filterType: 'select' }
        ],
        MASTER_STATUS_TYPES: {
            CURRENTLY_SOLD: 'currently sold',
            DISCONTINUED: 'discontinued',
            ABNORMAL_DATE: 'abnormal date',
            COMING_SOON: 'coming soon',
        },
        MASTER_STATUS_TEXT: {
            'currently sold': '銷售中',
            'discontinued': '已停售',
            'abnormal date': '日期異常',
            'coming soon': '即將上市',
        },
        STATUS_ORDER: {
            'coming soon': 1, 'currently sold': 2, 'discontinued': 3, 'abnormal date': 4, 'not sold': 5,
        },
        CHANNEL_STATUS_OPTIONS: {
            IN_SALE: '銷售中', STOP_SALE: '已停售',
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
        DEFAULT_QUERY_PARAMS: {
            PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 10000, PAGE_SIZE_TABLE: 50,
        },
        DEBOUNCE_DELAY: { SEARCH: 300 },
        BATCH_SIZES: { DETAIL_LOAD: 20 },
    });

    /**
     * @module StateModule
     * @description 應用程式狀態管理模組。
     */
    const StateModule = (() => {
        const state = {
            env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
            apiBase: '',
            token: '',
            isTokenVerified: false,
            queryMode: '',
            queryInput: '',
            masterStatusSelection: new Set(),
            channelStatusSelection: '',
            channelSelection: new Set(),
            advancedFilters: {},
            pageNo: 1,
            pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
            isFullView: false,
            showPlanName: false,
            searchKeyword: '',
            sortKey: 'no',
            sortAsc: true,
            filterOptions: {},
            activeFilters: {},
            isFilterVisible: true,
            masterDataCache: null,
            channelDataCache: null,
            polplnDataCache: new Map(),
            rawPolplnDataCache: new Map(),
            mergedDataCache: null,
            lastDbUpdateTime: '',
            currentQueryController: null,
            debounceTimers: {},
            modalPosition: { top: null, left: null },
        };
        state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
        const get = () => ({ ...state });
        const set = (newState) => { Object.assign(state, newState); };
        const resetResultState = () => set({
            pageNo: 1, searchKeyword: '', isFullView: false, showPlanName: false, sortKey: 'no', sortAsc: true, activeFilters: {}, filterOptions: {}, advancedFilters: {}, isFilterVisible: true
        });
        const resetQueryConditions = () => set({
            queryMode: '', queryInput: '', masterStatusSelection: new Set(),
            channelStatusSelection: '', channelSelection: new Set(),
        });
        const clearAllCaches = () => set({
            masterDataCache: null, channelDataCache: null, mergedDataCache: null,
            polplnDataCache: new Map(), rawPolplnDataCache: new Map(), lastDbUpdateTime: ''
        });
        return { get, set, resetResultState, resetQueryConditions, clearAllCaches };
    })();

    /**
     * @module UtilsModule
     * @description 通用工具函式庫。
     */
    const UtilsModule = (() => {
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            if (typeof str !== 'string') str = String(str);
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return str.replace(/[&<>"']/g, m => map[m]);
        };
        const formatToday = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const formatDateForUI = (dt) => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
        const formatDateTime = (isoString) => {
            if (!isoString) return '';
            try {
                const date = new Date(isoString);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            } catch (e) {
                return isoString;
            }
        };
        const parseDateString = (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string' || dateStr.length !== 8) return null;
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) return date;
            return null;
        };
        const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
            if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE;
            const today = new Date();
            const startDate = parseDateString(saleStartStr);
            const endDate = parseDateString(saleEndStr);
            today.setHours(0, 0, 0, 0);
            if (!startDate || !endDate || startDate > endDate) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE;
            if (today < startDate) return ConfigModule.MASTER_STATUS_TYPES.COMING_SOON;
            if (today > endDate) return ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED;
            return ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD;
        };
        const convertCodeToText = (v, map) => map[String(v)] || v || '';
        const copyTextToClipboard = (text, showToast) => {
            navigator.clipboard.writeText(text)
                .then(() => showToast('複製成功', 'success'))
                .catch(() => showToast('複製失敗', 'error'));
        };
        const splitInput = (input) => input.trim().split(/[\s,;，；\n\r]+/).filter(Boolean);
        const toHalfWidthUpperCase = (str) => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();
        const findStoredToken = () => {
            const sources = [
                () => localStorage.getItem('SSO-TOKEN'), () => sessionStorage.getItem('SSO-TOKEN'),
                () => localStorage.getItem('euisToken'), () => sessionStorage.getItem('euisToken')
            ];
            for (let i = 0; i < sources.length; i++) {
                const token = sources[i]();
                if (token && token.trim()) return token.trim();
            }
            return null;
        };
        return {
            escapeHtml, formatToday, formatDateForUI, formatDateTime, parseDateString, getSaleStatus,
            convertCodeToText, copyTextToClipboard, splitInput, toHalfWidthUpperCase, findStoredToken,
        };
    })();

    /**
     * @module UIModule
     * @description 使用者介面與 DOM 操作模組。
     */
    const UIModule = (() => {
        const injectStyle = () => {
            if (document.getElementById(ConfigModule.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = ConfigModule.STYLE_ID;
            style.textContent = `
:root { --primary-color: #4A90E2; --primary-dark-color: #357ABD; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; --info-color: #17a2b8; --abnormal-bg-color: #fff3cd; }
.pct-modal-mask { position: fixed; z-index: 2147483646; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.25); opacity: 0; transition: opacity 0.25s ease-out; }
.pct-modal-mask.show { opacity: 1; }
.pct-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #FFFFFF; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); padding: 0; max-width: 95vw; position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 2147483647; display: flex; flex-direction: column; }
.pct-modal.show-init { opacity: 1; } .pct-modal.dragging { transition: none !important; }
.pct-modal[data-size="query"] { width: 800px; } .pct-modal[data-size="results"] { width: 1050px; height: 800px; }
.pct-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; flex-shrink: 0; }
.pct-modal-header-title { flex-grow: 1; }
.pct-modal-header.dragging { cursor: grabbing; }
.pct-close-btn-custom { display: flex; flex-direction: column; justify-content: center; align-items: center; background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color); border-radius: 6px; padding: 4px 10px; cursor: pointer; transition: all 0.2s; line-height: 1.2; height: 40px; }
.pct-close-btn-custom:hover { background-color: #f8f8f8; }
.pct-close-btn-custom span:first-child { font-size: 15px; font-weight: 600; }
.pct-close-btn-custom span:last-child { font-size: 11px; color: var(--error-color); }
.pct-modal-body { padding: 16px 20px 8px 20px; flex-grow: 1; overflow-y: auto; min-height: 50px; }
.pct-modal[data-size="query"] .pct-modal-body { height: 400px; }
.pct-modal[data-size="results"] .pct-modal-body { display: flex; flex-direction: column; overflow-y: hidden; }
.pct-modal-footer { padding: 12px 20px 16px 20px; border-top: 1px solid #E0E0E0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.pct-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; font-size: 15px; border-radius: 6px; border: 1px solid transparent; background: var(--primary-color); color: #fff; cursor: pointer; transition: all 0.25s; font-weight: 600; white-space: nowrap; }
.pct-btn:hover { background: var(--primary-dark-color); transform: translateY(-2px); box-shadow: 0 4px 8px rgba(74, 144, 226, 0.3); }
.pct-btn:disabled { background: #E9ECEF; color: #6C757D; border: 1px solid #DEE2E6; cursor: not-allowed; transform: none; box-shadow: none; }
.pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
.pct-btn.pct-btn-outline:hover:not(:disabled) { background-color: #F8F8F8; transform: translateY(-2px); } .pct-btn:active { transform: translateY(0); }
.pct-btn.pct-btn-outline.active { background-color: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
.pct-input { width: 100%; font-size: 16px; padding: 9px 12px; border-radius: 5px; border: 1px solid #E0E0E0; box-sizing: border-box; margin-top: 5px; transition: all .2s; }
.pct-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(74,144,226,0.2); outline: none; }
.pct-result-top-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; }
.pct-search-name-wrapper { display: flex; align-items: center; gap: 15px; }
#pct-search-input { width: 220px; font-size: 14px; padding: 6px 30px 6px 10px; background-color: #f0f7ff; border: 1px solid #b8d6f3; }
#pct-clear-search { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 20px; color: #999; cursor: pointer; display: none; padding: 0 5px; }
#pct-search-input:not(:placeholder-shown) + #pct-clear-search { display: block; }
.pct-mode-card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
.pct-sub-option-grid.master-status { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px; }
.pct-mode-card, .pct-sub-option, .pct-channel-option { background: #F8F8F8; border: 2px solid #E0E0E0; border-radius: 12px; padding: 20px 16px; text-align: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-weight: 500; font-size: 15px; position: relative; overflow: hidden; animation: slideInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1); animation-fill-mode: both; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.pct-sub-option { padding: 15px 12px; }
.pct-mode-card:nth-child(1) { animation-delay: 0.1s; } .pct-mode-card:nth-child(2) { animation-delay: 0.2s; } .pct-mode-card:nth-child(3) { animation-delay: 0.3s; } .pct-mode-card:nth-child(4) { animation-delay: 0.4s; }
@keyframes slideInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
.pct-mode-card.selected, .pct-sub-option.selected, .pct-channel-option.selected { background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark-color) 100%); color: white; border-color: var(--primary-color); font-weight: bold; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(74, 144, 226, 0.3); }
.pct-mode-card:not(.selected):hover { transform: translateY(-6px) scale(1.02); border-color: var(--primary-color); box-shadow: 0 12px 28px rgba(74, 144, 226, 0.25); background: linear-gradient(135deg, #ebf3fd 0%, #d6eaff 100%); }
#pct-table-view-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.pct-table-wrap { flex: 1; overflow: auto; border: 1px solid #E0E0E0; border-radius: 6px; }
.pct-table { border-collapse: collapse; width: 100%; font-size: 13px; table-layout: fixed; min-width: 1200px; }
.pct-table th { background: #f0f2f5; position: sticky; top: 0; z-index: 1; cursor: pointer; font-size: 14px; font-weight: bold; text-align: center !important; white-space: nowrap; }
.pct-table th, .pct-table td { border: 1px solid #ddd; padding: 8px 4px; vertical-align: middle; text-align: center; }
.pct-table td.pct-align-left { text-align: left !important; padding-left: 8px !important; }
.pct-table tr.pct-row-abnormal-date > td { background-color: var(--abnormal-bg-color) !important; }
.pct-table th:nth-child(1) { width: 4%; } .pct-table th:nth-child(2) { width: 7%; } .pct-table th:nth-child(3) { width: 27%; } .pct-table th:nth-child(4) { width: 5%; } .pct-table th:nth-child(5) { width: 5%; } .pct-table th:nth-child(6) { width: 6%; } .pct-table th:nth-child(7) { width: 8%; } .pct-table th:nth-child(8) { width: 8%; } .pct-table th:nth-child(9) { width: 9%; } .pct-table th:nth-child(10) { width: 7%; } .pct-table th:nth-child(11) { width: 14%; }
.pct-table td.clickable-cell { cursor: cell; }
.pct-table td.copy-row-trigger { cursor: pointer; color: var(--primary-color); font-weight: 500; }
.pct-table td.copy-row-trigger:hover { text-decoration: underline; }
.pct-table tr:not(.pct-row-abnormal-date):hover td { background: #e3f2fd; }
.pct-table th[data-key] { position: relative; padding-right: 20px; }
.pct-table th[data-key]::after { content: ''; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.3; border: 4px solid transparent; }
.pct-table th[data-key].sort-asc::after { border-bottom-color: var(--primary-color); opacity: 1; }
.pct-table th[data-key].sort-desc::after { border-top-color: var(--primary-color); opacity: 1; }
.pct-status-pill:hover { cursor: pointer; }
.pct-load-polpln-btn { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
.pct-load-polpln-btn:hover { background: #f0f0f0; }
.pct-channel-comingsoon { color: var(--success-color); font-weight: bold; }
.pct-channel-insale { color: var(--primary-color); font-weight: bold; }
.pct-channel-offsale { color: var(--error-color); font-weight: bold; }
.pct-channel-abnormal { color: var(--warning-color); font-weight: bold; }
.pct-channel-notsold { color: #888; }
.pct-toast { position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 22px; border-radius: 6px; font-size: 16px; z-index: 2147483647; opacity: 0; transition: opacity .3s, transform .3s; }
.pct-toast.show { opacity: 1; }
.pct-toast.success { background: var(--success-color); } .pct-toast.error { background: var(--error-color); } .pct-toast.warning { background: var(--warning-color); } .pct-toast.info { background: var(--info-color); }
.pct-progress-container { display: none; align-items: center; gap: 16px; padding: 12px; background-color: #f0f8ff; border-radius: 6px; margin-bottom: 16px; }
.pct-progress-bar-wrapper { flex-grow: 1; height: 10px; background-color: rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden; }
.pct-progress-bar { width: 0%; height: 100%; background-color: var(--primary-color); transition: width .4s ease-out; }
#pct-result-count { font-size: 18px; font-weight: bold; color: #333; }
.pct-toggle-switch { position: relative; display: inline-block; width: 50px; height: 26px; }
.pct-toggle-switch input { opacity: 0; width: 0; height: 0; }
.pct-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 26px; }
.pct-toggle-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .pct-toggle-slider { background-color: var(--primary-color); }
input:checked + .pct-toggle-slider:before { transform: translateX(24px); }
#pct-filters-wrapper { margin-bottom: 10px; flex-shrink: 0; background-color: #f8f9fa; border-radius: 6px; padding: 8px; }
.pct-filters-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.pct-filters-header h4 { margin: 0; font-size: 14px; }
#pct-all-filters-container { display: grid; grid-template-columns: repeat(${ConfigModule.RESULTS_PAGE_FILTERS.length}, 1fr) auto; gap: 5px 10px; align-items: center; transition: all 0.3s ease-in-out; }
#pct-all-filters-container.collapsed { display: none; }
.pct-filter-label { font-size: 13px; font-weight: bold; text-align: center; grid-row: 1; }
.pct-filter-control { grid-row: 2; }
.pct-filter-control .pct-input, .pct-filter-control select { font-size: 13px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; width: 100%; box-sizing: border-box; }
#pct-db-update-time-header { font-size: 12px; color: #666; font-weight: normal; margin-left: auto; padding-right: 15px; }
#pct-toggle-filters-btn { font-size: 12px; padding: 2px 8px; }
`;
            document.head.appendChild(style);
        };
        const Toast = {
            show: (msg, type = 'info', duration = 3000) => {
                document.querySelector('.pct-toast')?.remove();
                const toastEl = document.createElement('div');
                toastEl.className = `pct-toast ${type}`;
                toastEl.textContent = msg;
                document.body.appendChild(toastEl);
                requestAnimationFrame(() => toastEl.classList.add('show'));
                if (duration > 0) setTimeout(() => {
                    toastEl.classList.remove('show');
                    toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
                }, duration);
            }
        };
        const Modal = {
            close: () => {
                const modal = document.getElementById(ConfigModule.TOOL_ID);
                if (modal) {
                    const { top, left } = modal.style;
                    StateModule.set({ modalPosition: { top, left } });
                }
                StateModule.get().currentQueryController?.abort();
                modal?.remove();
                document.getElementById('pctModalMask')?.remove();
            },
            show: (html, onOpen, size) => {
                const currentPosition = StateModule.get().modalPosition;
                Modal.close();
                const mask = document.createElement('div');
                mask.id = 'pctModalMask';
                mask.className = 'pct-modal-mask show';
                document.body.appendChild(mask);
                const modal = document.createElement('div');
                modal.id = ConfigModule.TOOL_ID;
                modal.className = 'pct-modal';
                modal.dataset.size = size;
                modal.innerHTML = html;
                if (currentPosition.top && currentPosition.left) {
                    modal.style.top = currentPosition.top;
                    modal.style.left = currentPosition.left;
                    modal.style.transform = 'none';
                }
                document.body.appendChild(modal);
                requestAnimationFrame(() => modal.classList.add('show-init'));
                setTimeout(() => {
                    modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown);
                    modal.querySelector('.pct-close-btn-custom')?.addEventListener('click', ControllerModule.cleanupAndClose);
                }, 0);
                if (onOpen) onOpen(modal);
            }
        };
        const Progress = {
            show: (text) => {
                const anchor = document.querySelector('.pct-modal-body');
                if (!anchor) return;
                let p = document.getElementById('pct-progress-container');
                if (!p) {
                    p = document.createElement('div');
                    p.id = 'pct-progress-container';
                    p.className = 'pct-progress-container';
                    anchor.prepend(p);
                }
                p.style.display = 'flex';
                p.innerHTML = `<span class="pct-progress-text">${text}</span><div class="pct-progress-bar-wrapper"><div id="pct-progress-bar" class="pct-progress-bar"></div></div>`;
            },
            update: (percentage, text) => {
                const bar = document.getElementById('pct-progress-bar');
                if (bar) bar.style.width = `${percentage}%`;
                const textEl = document.querySelector('#pct-progress-container .pct-progress-text');
                if (textEl && text) textEl.textContent = text;
            },
            hide: () => {
                document.getElementById('pct-progress-container')?.remove();
            }
        };
        return { injectStyle, Toast, Modal, Progress };
    })();

    /**
     * @module EventModule
     * @description 事件處理模組。
     */
    const EventModule = (() => {
        const dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };
        const dragMouseDown = (e) => {
            const modal = document.getElementById(ConfigModule.TOOL_ID);
            if (!modal || e.target.classList.contains('pct-close-btn-custom') || e.target.parentElement.classList.contains('pct-close-btn-custom')) return;
            e.preventDefault();
            dragState.isDragging = true;
            modal.classList.add('dragging');
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            dragState.initialLeft = rect.left;
            dragState.initialTop = rect.top;
            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        };
        const elementDrag = (e) => {
            if (!dragState.isDragging) return;
            e.preventDefault();
            const modal = document.getElementById(ConfigModule.TOOL_ID);
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            modal.style.left = `${dragState.initialLeft + dx}px`;
            modal.style.top = `${dragState.initialTop + dy}px`;
            modal.style.transform = 'none';
        };
        const closeDragElement = () => {
            dragState.isDragging = false;
            document.getElementById(ConfigModule.TOOL_ID)?.classList.remove('dragging');
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
        };
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                ControllerModule.cleanupAndClose();
            }
        };
        const setupGlobalKeyListener = () => {
            document.removeEventListener('keydown', handleEscKey);
            document.addEventListener('keydown', handleEscKey);
        };
        const autoFormatInput = (event) => {
            const input = event.target;
            const { value, selectionStart, selectionEnd } = input;
            input.value = UtilsModule.toHalfWidthUpperCase(value);
            input.setSelectionRange(selectionStart, selectionEnd);
        };
        return { dragMouseDown, setupGlobalKeyListener, autoFormatInput, handleEscKey };
    })();

    /**
     * @module ApiModule
     * @description 網路請求與 API 通訊模組。
     */
    const ApiModule = (() => {
        const callApi = async (endpoint, params, signal) => {
            const { apiBase, token } = StateModule.get();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['SSO-TOKEN'] = token;
            const response = await fetch(`${apiBase}${endpoint}`, {
                method: 'POST', headers, body: JSON.stringify(params), signal,
            });
            if (!response.ok) {
                let errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    errorText = errorJson.message || errorJson.error || errorText;
                } catch (e) { /* silent */ }
                throw new Error(`API 錯誤: ${response.status} ${errorText}`);
            }
            return response.json();
        };
        const fetchMasterData = async (signal) => {
            const res = await callApi('/planCodeController/query', { currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, signal);
            if (res.records) {
                StateModule.set({ lastDbUpdateTime: res.updateTime || new Date().toISOString() });
            }
            return res.records || [];
        };
        const fetchChannelData = async (signal) => {
            const res = await callApi('/planCodeSaleDateController/query', { pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }, signal);
            return (res.planCodeSaleDates?.records || []).map(r => ({ ...r, channel: r.channel === 'OT' ? 'BK' : r.channel }));
        };
        const fetchPolplnForCode = async (planCode, signal) => {
            const res = await callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }, signal);
            return res.records || [];
        };
        return { fetchMasterData, fetchChannelData, fetchPolplnForCode };
    })();

    /**
     * @module DataModule
     * @description 資料處理、快取管理與資料操作模組。
     */
    const DataModule = (() => {
        const initializeCaches = async (signal) => {
            const { masterDataCache, channelDataCache } = StateModule.get();
            const tasks = [];
            if (!masterDataCache) tasks.push(ApiModule.fetchMasterData(signal).then(data => StateModule.set({ masterDataCache: data })));
            if (!channelDataCache) tasks.push(ApiModule.fetchChannelData(signal).then(data => StateModule.set({ channelDataCache: data })));
            if (tasks.length > 0) {
                UIModule.Progress.show('首次載入基礎資料中，請稍候...');
                UIModule.Progress.update(10, '正在取得資料庫資料...');
                await Promise.all(tasks);
                UIModule.Progress.update(50, '資料載入完成，正在處理合併...');
                mergeData();
            }
        };
        const mergeData = () => {
            const { masterDataCache, channelDataCache } = StateModule.get();
            if (!masterDataCache || !channelDataCache) return;
            const today = UtilsModule.formatToday();
            const channelMap = channelDataCache.reduce((acc, cur) => {
                if (!acc.has(cur.planCode)) acc.set(cur.planCode, []);
                acc.get(cur.planCode).push(cur);
                return acc;
            }, new Map());
            const mergedData = masterDataCache.map((rawMasterItem) => {
                const planCode = String(rawMasterItem.planCode || '-');
                const channelsRaw = channelMap.get(planCode) || [];
                const processedChannels = channelsRaw.map(c => ({
                    channel: c.channel,
                    status: UtilsModule.getSaleStatus(today, UtilsModule.formatDateForUI(c.saleStartDate), UtilsModule.formatDateForUI(c.saleEndDate)),
                    saleStartDate: UtilsModule.formatDateForUI(c.saleStartDate),
                    saleEndDate: UtilsModule.formatDateForUI(c.saleEndDate),
                }));
                return {
                    planCode,
                    fullName: rawMasterItem.planCodeName || rawMasterItem.shortName || '-',
                    displayName: rawMasterItem.shortName || rawMasterItem.planCodeName || '-',
                    currency: UtilsModule.convertCodeToText(rawMasterItem.currency || rawMasterItem.cur, ConfigModule.FIELD_MAPS.CURRENCY),
                    unit: UtilsModule.convertCodeToText(rawMasterItem.reportInsuranceAmountUnit || rawMasterItem.insuranceAmountUnit, ConfigModule.FIELD_MAPS.UNIT),
                    coverageType: UtilsModule.convertCodeToText(rawMasterItem.coverageType || rawMasterItem.type, ConfigModule.FIELD_MAPS.COVERAGE_TYPE),
                    saleStartDate: UtilsModule.formatDateForUI(rawMasterItem.saleStartDate),
                    saleEndDate: UtilsModule.formatDateForUI(rawMasterItem.saleEndDate),
                    mainStatus: UtilsModule.getSaleStatus(today, UtilsModule.formatDateForUI(rawMasterItem.saleStartDate), UtilsModule.formatDateForUI(rawMasterItem.saleEndDate)),
                    channels: processedChannels,
                    _raw: { master: rawMasterItem, channels: channelsRaw }
                };
            });
            StateModule.set({ mergedDataCache: mergedData });
        };
        const getInitialData = () => {
            const { mergedDataCache, queryMode, queryInput, masterStatusSelection, channelSelection, channelStatusSelection } = StateModule.get();
            if (!mergedDataCache) return [];
            let data = [...mergedDataCache];

            switch (queryMode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE:
                    const codesToSearch = UtilsModule.splitInput(queryInput);
                    if (codesToSearch.length > 0) data = data.filter(item => codesToSearch.some(code => item.planCode.includes(code)));
                    break;
                case ConfigModule.QUERY_MODES.PLAN_NAME:
                    const nameKeyword = queryInput.toLowerCase();
                    data = data.filter(item => item.displayName.toLowerCase().includes(nameKeyword) || item.fullName.toLowerCase().includes(nameKeyword));
                    break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                    if (masterStatusSelection.size > 0) data = data.filter(item => masterStatusSelection.has(item.mainStatus));
                    break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                    data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel)));
                    if (channelStatusSelection === ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD) {
                        data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel) && c.status === ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD));
                    } else if (channelStatusSelection === ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED) {
                        data = data.filter(item => {
                            const relevantChannels = item.channels.filter(c => channelSelection.has(c.channel));
                            return relevantChannels.length > 0 && !relevantChannels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD);
                        });
                    }
                    break;
            }
            return data;
        };
        const getFilteredData = (baseData) => {
            let data = baseData;
            if (!data) return [];

            const { searchKeyword, sortKey, sortAsc, activeFilters, advancedFilters } = StateModule.get();

            const allFilterConfigs = ConfigModule.RESULTS_PAGE_FILTERS;
            const activeFilterKeys = Object.keys(activeFilters).filter(k => activeFilters[k]);
            const advancedFilterKeys = Object.keys(advancedFilters).filter(k => advancedFilters[k]);

            if (activeFilterKeys.length > 0 || advancedFilterKeys.length > 0) {
                data = data.filter(item => {
                    const standardMatch = activeFilterKeys.every(key => {
                        const filterValue = activeFilters[key];
                        if (key === 'mainStatus') {
                            return ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] === filterValue;
                        }
                        return String(item[key]) === filterValue;
                    });

                    if (!standardMatch) return false;

                    const advancedMatch = advancedFilterKeys.every(key => {
                        const filterConfig = allFilterConfigs.find(f => f.key === key);
                        const rawValue = item._raw?.master?.[filterConfig.rawKey];
                        const filterValue = advancedFilters[key];
                        
                        if (filterConfig.filterType === 'text') {
                            return String(rawValue || '').toLowerCase().includes(filterValue.toLowerCase());
                        }
                        return String(rawValue ?? '') === filterValue;
                    });

                    return advancedMatch;
                });
            }

            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                data = data.filter(item => {
                    const searchableItem = { ...item };
                    delete searchableItem._raw;
                    return Object.values(searchableItem).some(value => String(value === null ? '' : value).toLowerCase().includes(keyword));
                });
            }

            if (sortKey && sortKey !== 'no') {
                data = [...data].sort((a, b) => {
                    let valA = a[sortKey], valB = b[sortKey];
                    if (sortKey === 'channels') {
                        valA = a.channels.map(c => c.channel).sort().join('');
                        valB = b.channels.map(c => c.channel).sort().join('');
                    } else if (sortKey === 'saleStartDate' || sortKey === 'saleEndDate') {
                        valA = a[sortKey] || '0';
                        valB = b[sortKey] || '0';
                    }
                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });
            }
            return data.map((item, index) => ({ ...item, no: index + 1 }));
        };

        return { initializeCaches, getInitialData, getFilteredData };
    })();

    /**
     * @module ControllerModule
     * @description 主控制器模組。
     */
    const ControllerModule = (() => {
        let initialQueryData = [];

        const cleanupAndClose = () => {
            console.log('Clearing all data caches and closing tool...');
            StateModule.clearAllCaches();
            initialQueryData = [];
            UIModule.Modal.close();
            document.removeEventListener('keydown', EventModule.handleEscKey);
        };

        const initialize = () => {
            console.log(`=== 商品查詢工具 v${ConfigModule.VERSION} 初始化 ===`);
            UIModule.injectStyle();
            EventModule.setupGlobalKeyListener();
            autoCheckToken();
        };
        const autoCheckToken = () => {
            const storedToken = UtilsModule.findStoredToken();
            if (storedToken) {
                StateModule.set({ token: storedToken, isTokenVerified: true });
                UIModule.Toast.show('已自動載入 Token', 'info', 1500);
                setTimeout(showQueryDialog, 500);
            } else {
                UIModule.Toast.show('未找到 Token，請手動輸入', 'warning', 1500);
                setTimeout(() => showTokenDialog(false), 500);
            }
        };
        const handleStartQuery = async () => {
            const { queryMode } = StateModule.get();
            let queryInput = '';
            if (queryMode === ConfigModule.QUERY_MODES.PLAN_CODE) queryInput = document.getElementById('pct-plan-code-input').value.trim();
            else if (queryMode === ConfigModule.QUERY_MODES.PLAN_NAME) queryInput = document.getElementById('pct-plan-name-input').value.trim();
            
            StateModule.set({ queryInput });
            showResultsDialog();
            await new Promise(resolve => setTimeout(resolve, 50));
            if (!StateModule.get().isTokenVerified) {
                renderNoTokenError();
                return;
            }
            const controller = new AbortController();
            StateModule.set({ currentQueryController: controller });
            try {
                await DataModule.initializeCaches(controller.signal);
                UIModule.Progress.update(100, '資料處理完成！');
                initialQueryData = DataModule.getInitialData();
                updateFilterOptions(initialQueryData);
                rerenderTable();
                UIModule.Progress.hide();
            } catch (error) {
                UIModule.Progress.hide();
                if (error.name !== 'AbortError') {
                    UIModule.Toast.show(`查詢錯誤: ${error.message}`, 'error', 5000);
                    initialQueryData = [];
                    rerenderTable();
                }
            } finally {
                StateModule.set({ currentQueryController: null });
            }
        };
        const showTokenDialog = () => {
            const { env, token: currentToken } = StateModule.get();
            const html = `<div class="pct-modal-header"><div class="pct-modal-header-title">商品查詢 (${env})</div><button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button></div><div class="pct-modal-body"><label for="pct-token-input">請貼上您的 SSO-TOKEN：</label><textarea id="pct-token-input" class="pct-input" rows="4" placeholder="請從開發者工具或相關系統中複製 TOKEN...">${currentToken || ''}</textarea></div><div class="pct-modal-footer"><div></div><div style="display:flex; gap:10px;"><button id="pct-confirm-token" class="pct-btn">儲存並繼續</button></div></div>`;
            UIModule.Modal.show(html, setupTokenDialogListeners, 'query');
        };
        const setupTokenDialogListeners = () => {
            const tokenInput = document.getElementById('pct-token-input');
            const confirmBtn = document.getElementById('pct-confirm-token');
            const handleConfirm = () => {
                const token = tokenInput.value.trim();
                if (!token) { UIModule.Toast.show('請輸入 TOKEN', 'error'); return; }
                localStorage.setItem('SSO-TOKEN', token);
                StateModule.set({ token, isTokenVerified: true });
                UIModule.Toast.show('TOKEN 已儲存', 'success');
                setTimeout(showQueryDialog, 1000);
            };
            confirmBtn.addEventListener('click', handleConfirm);
            tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); } });
        };
        const showQueryDialog = (preserveState = false) => {
            if (!preserveState) {
                StateModule.resetQueryConditions();
                StateModule.resetResultState();
            }
            const { env } = StateModule.get();
            const html = `<div class="pct-modal-header"><div class="pct-modal-header-title">商品查詢 (${env})</div><button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button></div><div class="pct-modal-body"><label>查詢模式:</label><div class="pct-mode-card-grid"><div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_CODE}">商品代號</div><div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_NAME}">商品名稱</div><div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.MASTER_CLASSIFIED}">主約銷售時間</div><div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED}">通路銷售時間</div></div><div id="pct-dynamic-options" style="display:none; margin-top: 15px;"></div></div><div class="pct-modal-footer"><div style="display:flex; gap:10px;"><button id="pct-change-token" class="pct-btn pct-btn-outline">修改 Token</button><button id="pct-force-update" class="pct-btn pct-btn-outline">更新</button>${preserveState ? '<button id="pct-clear-selection" class="pct-btn pct-btn-outline">清除選取</button>' : ''}</div><button id="pct-start-query" class="pct-btn" disabled>開始查詢</button></div>`;
            UIModule.Modal.show(html, (modal) => setupQueryDialogListeners(modal, preserveState), 'query');
        };
        const setupQueryDialogListeners = (modal, preserveState) => {
            modal.querySelectorAll('.pct-mode-card').forEach(card => card.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                StateModule.set({ queryMode: mode });
                modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                updateDynamicQueryOptions(mode);
                checkCanStartQuery();
            }));
            document.getElementById('pct-change-token').addEventListener('click', () => showTokenDialog(false));
            document.getElementById('pct-force-update').addEventListener('click', () => handleForceUpdate(false));
            document.getElementById('pct-clear-selection')?.addEventListener('click', () => showQueryDialog(false));
            document.getElementById('pct-start-query').addEventListener('click', handleStartQuery);
            if (preserveState) restoreQueryDialogState(modal);
        };
        const showResultsDialog = () => {
            const { env, showPlanName, lastDbUpdateTime } = StateModule.get();
            const formattedTime = UtilsModule.formatDateTime(lastDbUpdateTime);
            
            const html = `<div class="pct-modal-header"><div class="pct-modal-header-title">查詢結果 (${env})</div><span id="pct-db-update-time-header">更新: ${formattedTime}</span><button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button></div><div class="pct-modal-body"><div class="pct-result-top-controls"><div class="pct-search-name-wrapper"><div class="search-wrapper" style="position: relative;"><label for="pct-search-input" style="font-size: 14px; color: #666; margin-right: 5px;">結果內搜尋:</label><input type="text" id="pct-search-input" placeholder="搜尋關鍵字..."><button id="pct-clear-search" title="清除搜尋">&times;</button></div><div style="display:flex; align-items:center; gap: 8px;"><span style="font-size: 13px; color: #555;">簡稱</span><label class="pct-toggle-switch"><input type="checkbox" id="pct-name-toggle" ${showPlanName ? 'checked' : ''}><span class="pct-toggle-slider"></span></label><span style="font-size: 13px; color: #555;">全名</span></div></div><div style="display: flex; align-items: center; gap: 15px;"><span id="pct-result-count"></span><div class="pct-pagination" style="display: flex; align-items: center; gap: 5px;"><button id="pct-prev-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">←</button><span id="pct-page-info" style="font-size: 14px; min-width: 50px; text-align: center;">-</span><button id="pct-next-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">→</button></div></div></div><div id="pct-table-view-wrapper"><div id="pct-filters-wrapper"><div id="pct-all-filters-container"></div></div><div class="pct-table-wrap" id="pct-table-wrap"><table class="pct-table"><thead><tr><th data-key="no">No</th><th data-key="planCode">代號</th><th data-key="displayName">商品名稱</th><th data-key="currency">幣別</th><th data-key="unit">單位</th><th data-key="coverageType">型態</th><th data-key="saleStartDate">主檔銷售日</th><th data-key="saleEndDate">主檔停售日</th><th data-key="mainStatus">主檔狀態</th><th data-key="polpln">POLPLN</th><th data-key="channels">銷售通路</th></tr></thead><tbody id="pct-table-body"></tbody></table></div></div></div><div class="pct-modal-footer"><div style="display:flex; align-items:center; gap:15px;"><button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button></div><div style="display:flex; gap: 10px;"><button id="pct-force-update-results" class="pct-btn pct-btn-outline">更新</button><button id="pct-preview-all" class="pct-btn pct-btn-outline">預覽</button><button id="pct-copy-all" class="pct-btn pct-btn-outline">複製</button><button id="pct-back-to-query" class="pct-btn pct-btn-outline">返回查詢</button></div></div>`;
            UIModule.Modal.show(html, setupResultsDialogListeners, 'results');
        };
        const setupResultsDialogListeners = (modal) => {
            const searchInput = document.getElementById('pct-search-input');
            searchInput.addEventListener('input', EventModule.autoFormatInput);
            searchInput.addEventListener('input', () => {
                const timers = StateModule.get().debounceTimers;
                clearTimeout(timers.search);
                timers.search = setTimeout(() => {
                    StateModule.set({ searchKeyword: searchInput.value.trim(), pageNo: 1 });
                    rerenderTable();
                }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
            });
            document.getElementById('pct-clear-search').addEventListener('click', () => {
                searchInput.value = '';
                StateModule.set({ searchKeyword: '', pageNo: 1 });
                rerenderTable();
            });
            
            document.getElementById('pct-table-body').addEventListener('click', handleTableClick);
            modal.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => {
                const key = th.dataset.key;
                const { sortKey, sortAsc } = StateModule.get();
                StateModule.set(sortKey === key ? { sortAsc: !sortAsc, sortKey: key } : { sortKey: key, sortAsc: true });
                rerenderTable();
            }));
            document.getElementById('pct-name-toggle').addEventListener('change', (e) => {
                StateModule.set({ showPlanName: e.target.checked });
                rerenderTable();
            });
            document.getElementById('pct-toggle-view').addEventListener('click', handleToggleView);
            document.getElementById('pct-prev-page').addEventListener('click', () => changePage(-1));
            document.getElementById('pct-next-page').addEventListener('click', () => changePage(1));
            document.getElementById('pct-force-update-results').addEventListener('click', () => handleForceUpdate(true));
            document.getElementById('pct-preview-all').addEventListener('click', handlePreviewAll);
            document.getElementById('pct-copy-all').addEventListener('click', handleCopyAll);
            document.getElementById('pct-back-to-query').addEventListener('click', () => showQueryDialog(true));
        };
        const updateDynamicQueryOptions = (mode) => {
            const dynamicOptionsContainer = document.getElementById('pct-dynamic-options');
            let content = '';
            switch (mode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE:
                    content = `<label for="pct-plan-code-input">商品代號(複數)：(可使用空白、逗號、分行分隔)</label><textarea id="pct-plan-code-input" class="pct-input" rows="3" placeholder="例如：5105, 5106"></textarea>`;
                    break;
                case ConfigModule.QUERY_MODES.PLAN_NAME:
                    content = `<label for="pct-plan-name-input">商品名稱關鍵字：</label><input type="text" id="pct-plan-name-input" class="pct-input" placeholder="例如：健康、終身">`;
                    break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                    const allOpt = `<div class="pct-sub-option" data-status="all"><strong>全部</strong></div>`;
                    const statusOpts = Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s => `<div class="pct-sub-option" data-status="${s}">${ConfigModule.MASTER_STATUS_TEXT[s] || s}</div>`).join('');
                    content = `<label>主約銷售狀態：</label><div class="pct-sub-option-grid master-status">${allOpt}${statusOpts}</div>`;
                    break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                    const channelOpts = ConfigModule.FIELD_MAPS.CHANNELS.map(ch => `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`).join('');
                    const rangeOpts = Object.entries(ConfigModule.CHANNEL_STATUS_OPTIONS).map(([key, value]) => `<div class="pct-sub-option" data-range="${ConfigModule.MASTER_STATUS_TYPES[key === 'IN_SALE' ? 'CURRENTLY_SOLD' : 'DISCONTINUED']}">${value}</div>`).join('');
                    content = `<label>選擇通路：</label><div class="pct-channel-option-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"><div class="pct-channel-option" data-channel="all"><strong>全選</strong></div>${channelOpts}</div><label style="margin-top:10px;">銷售範圍：</label><div class="pct-sub-option-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${rangeOpts}</div>`;
                    break;
            }
            dynamicOptionsContainer.innerHTML = content;
            dynamicOptionsContainer.style.display = content ? 'block' : 'none';
            bindDynamicQueryOptionEvents(mode);
        };
        const bindDynamicQueryOptionEvents = (mode) => {
            const checkAndUpdate = () => checkCanStartQuery();
            switch (mode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE:
                case ConfigModule.QUERY_MODES.PLAN_NAME:
                    document.querySelector('#pct-dynamic-options .pct-input')?.addEventListener('input', (e) => {
                        EventModule.autoFormatInput(e);
                        checkAndUpdate();
                    });
                    break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                    document.querySelectorAll('.pct-sub-option[data-status]').forEach(el => el.addEventListener('click', e => {
                        handleMultiSelect(e.currentTarget, '.pct-sub-option[data-status]', 'status', 'masterStatusSelection');
                        checkAndUpdate();
                    }));
                    break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                    const channelOptions = document.querySelectorAll('.pct-channel-option');
                    channelOptions.forEach(el => el.addEventListener('click', e => {
                        const clickedButton = e.currentTarget;
                        const channel = clickedButton.dataset.channel;
                        const allBtn = document.querySelector('.pct-channel-option[data-channel="all"]');
                        const individualOptions = Array.from(channelOptions).filter(opt => opt.dataset.channel !== 'all');
                        if (channel === 'all') {
                            const isAllSelected = !allBtn.classList.contains('selected');
                            allBtn.classList.toggle('selected', isAllSelected);
                            individualOptions.forEach(opt => opt.classList.toggle('selected', isAllSelected));
                        } else {
                            clickedButton.classList.toggle('selected');
                            const allAreSelected = individualOptions.every(opt => opt.classList.contains('selected'));
                            allBtn.classList.toggle('selected', allAreSelected);
                        }
                        const newSelected = new Set();
                        individualOptions.forEach(opt => {
                            if (opt.classList.contains('selected')) {
                                newSelected.add(opt.dataset.channel);
                            }
                        });
                        StateModule.set({ channelSelection: newSelected });
                        checkAndUpdate();
                    }));
                    document.querySelectorAll('.pct-sub-option[data-range]').forEach(el => el.addEventListener('click', e => {
                        document.querySelectorAll('.pct-sub-option[data-range]').forEach(i => i.classList.remove('selected'));
                        e.currentTarget.classList.add('selected');
                        StateModule.set({ channelStatusSelection: e.currentTarget.dataset.range });
                        checkAndUpdate();
                    }));
                    break;
            }
        };
        const checkCanStartQuery = () => {
            const state = StateModule.get();
            let canStart = false;
            switch (state.queryMode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE: canStart = !!document.getElementById('pct-plan-code-input')?.value.trim(); break;
                case ConfigModule.QUERY_MODES.PLAN_NAME: canStart = !!document.getElementById('pct-plan-name-input')?.value.trim(); break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED: canStart = state.masterStatusSelection.size > 0; break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: canStart = state.channelSelection.size > 0 && !!state.channelStatusSelection; break;
            }
            document.getElementById('pct-start-query').disabled = !canStart;
        };
        const restoreQueryDialogState = (modal) => {
            const { queryMode, queryInput, masterStatusSelection, channelSelection, channelStatusSelection } = StateModule.get();
            if (queryMode) {
                const modeCard = modal.querySelector(`.pct-mode-card[data-mode="${queryMode}"]`);
                if (modeCard) {
                    modeCard.click();
                    if (queryMode === 'planCode' || queryMode === 'planCodeName') {
                        const input = document.getElementById('pct-plan-code-input') || document.getElementById('pct-plan-name-input');
                        if (input) input.value = queryInput;
                    } else if (queryMode === 'masterClassified') {
                        masterStatusSelection.forEach(status => document.querySelector(`.pct-sub-option[data-status="${status}"]`)?.classList.add('selected'));
                        updateMultiSelectAllButton('.pct-sub-option[data-status]', 'all');
                    } else if (queryMode === 'channelClassified') {
                        channelSelection.forEach(channel => document.querySelector(`.pct-channel-option[data-channel="${channel}"]`)?.classList.add('selected'));
                        updateMultiSelectAllButton('.pct-channel-option', 'all');
                        if (channelStatusSelection) document.querySelector(`.pct-sub-option[data-range="${channelStatusSelection}"]`)?.classList.add('selected');
                    }
                }
            }
            checkCanStartQuery();
        };
        const handleMultiSelect = (clickedElement, selector, dataAttribute, stateKey) => {
            const value = clickedElement.dataset[dataAttribute];
            const allButton = document.querySelector(`${selector}[data-${dataAttribute}="all"]`);
            const individualOptions = Array.from(document.querySelectorAll(selector)).filter(opt => opt.dataset[dataAttribute] !== 'all');
            if (value === 'all') {
                const isAllSelected = !allButton.classList.contains('selected');
                allButton.classList.toggle('selected', isAllSelected);
                individualOptions.forEach(opt => opt.classList.toggle('selected', isAllSelected));
            } else {
                clickedElement.classList.toggle('selected');
                updateMultiSelectAllButton(selector, 'all');
            }
            const selectedValues = new Set(Array.from(document.querySelectorAll(`${selector}.selected`)).map(el => el.dataset[dataAttribute]).filter(v => v !== 'all'));
            StateModule.set({ [stateKey]: selectedValues });
        };
        const updateMultiSelectAllButton = (selector, allValue) => {
            const dataAttribute = selector.match(/data-(\w+)/)[1];
            const allButton = document.querySelector(`${selector}[data-${dataAttribute}="${allValue}"]`);
            if (!allButton) return;
            const individualOptions = Array.from(document.querySelectorAll(selector)).filter(opt => opt.dataset[dataAttribute] !== allValue);
            const allAreSelected = individualOptions.length > 0 && individualOptions.every(opt => opt.classList.contains('selected'));
            allButton.classList.toggle('selected', allAreSelected);
        };
        const renderNoTokenError = () => {
            const errorHtml = `<tr><td colspan="11" style="text-align:center; padding: 20px;"><a href="#" id="pct-goto-token-settings" style="color: var(--primary-color); text-decoration: underline; font-weight: bold;">無有效權限，請返回設定正確的 Token。</a></td></tr>`;
            const tableBody = document.getElementById('pct-table-body');
            if (tableBody) {
                tableBody.innerHTML = errorHtml;
                document.getElementById('pct-goto-token-settings')?.addEventListener('click', (e) => { e.preventDefault(); showTokenDialog(); });
            }
            document.getElementById('pct-result-count').textContent = '共 0 筆資料';
        };
        const rerenderTable = () => {
            const filteredData = DataModule.getFilteredData(initialQueryData);

            document.getElementById('pct-result-count').textContent = `共 ${filteredData.length} 筆資料`;
            
            const { isFullView, pageNo, pageSize, sortKey, sortAsc } = StateModule.get();
            const totalItems = filteredData.length;
            let displayData = filteredData;
            if (!isFullView) {
                const startIdx = (pageNo - 1) * pageSize;
                displayData = filteredData.slice(startIdx, startIdx + pageSize);
            }
            const tableBody = document.getElementById('pct-table-body');
            if (!tableBody) return;
            tableBody.innerHTML = displayData.length > 0 ? displayData.map(item => renderTableRow(item)).join('') : `<tr><td colspan="11" style="text-align:center; padding: 20px;">查無符合條件的資料</td></tr>`;
            
            document.querySelectorAll('th[data-key]').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.key === sortKey) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
            });
            
            updatePaginationInfo(totalItems);
            renderFilterControls(false);
        };
        const renderTableRow = (item) => {
            const { showPlanName, polplnDataCache } = StateModule.get();
            const polplnValue = polplnDataCache.get(item.planCode);
            let polplnCellContent;
            if (polplnValue === undefined) polplnCellContent = `<button class="pct-load-polpln-btn" data-plancode="${item.planCode}">more</button>`;
            else polplnCellContent = `<span class="clickable-cell">${UtilsModule.escapeHtml(polplnValue)}</span>`;
            const { content: channelsCellContent, tooltip: tooltipText } = renderChannelsCell(item);
            const nameToShow = showPlanName ? item.fullName : item.displayName;
            const nameInTitle = showPlanName ? item.displayName : item.fullName;
            const rowClass = item.mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE ? 'pct-row-abnormal-date' : '';
            return `<tr class="${rowClass}"><td class="copy-row-trigger" title="點擊複製整行">${item.no}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td><td class="clickable-cell pct-align-left" title="[另一名稱]&#10;${UtilsModule.escapeHtml(nameInTitle)}">${UtilsModule.escapeHtml(nameToShow)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td><td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td><td>${renderStatusPill(item.mainStatus)}</td><td>${polplnCellContent}</td><td class="pct-align-left" title="${tooltipText}">${channelsCellContent}</td></tr>`;
        };
        const renderChannelsCell = (item) => {
            const productChannelsMap = new Map(item.channels.map(c => [c.channel, c]));
            const allChannelsData = ConfigModule.FIELD_MAPS.CHANNELS.map(channelCode => {
                const data = productChannelsMap.get(channelCode);
                return { channel: channelCode, status: data ? data.status : 'not sold' };
            });
            const tooltipLines = allChannelsData.map(ch => {
                if (ch.status !== 'not sold') {
                    const statusText = ConfigModule.MASTER_STATUS_TEXT[ch.status] || ch.status;
                    const saleData = item.channels.find(c => c.channel === ch.channel) || {};
                    return `${ch.channel} 【${statusText}】 • 起日: ${saleData.saleStartDate || '無'} | 迄日: ${saleData.saleEndDate || '無'}`;
                }
                return `${ch.channel} 【未銷售】`;
            });
            const tooltipText = tooltipLines.join('&#10;');
            const channelsToDisplay = allChannelsData
                .filter(ch => ch.status !== 'not sold')
                .sort((a, b) => (ConfigModule.STATUS_ORDER[a.status] || 99) - (ConfigModule.STATUS_ORDER[b.status] || 99));

            if (channelsToDisplay.length === 0) return { content: '【無銷售通路】', tooltip: tooltipText };
            
            const groupedHtml = channelsToDisplay.reduce((acc, ch, index) => {
                let className = '';
                switch (ch.status) {
                    case 'coming soon': className = 'pct-channel-comingsoon'; break;
                    case 'currently sold': className = 'pct-channel-insale'; break;
                    case 'discontinued': className = 'pct-channel-offsale'; break;
                    case 'abnormal date': className = 'pct-channel-abnormal'; break;
                }
                const span = `<span class="${className}">${ch.channel}</span>`;

                if (index > 0 && ch.status !== channelsToDisplay[index - 1].status) acc.push(' | ');
                else if (index > 0) acc.push(' ');
                acc.push(span);
                return acc;
            }, []);
            return { content: groupedHtml.join(''), tooltip: tooltipText };
        };
        const renderStatusPill = (status) => {
            const config = {
                [ConfigModule.MASTER_STATUS_TYPES.COMING_SOON]: { e: '🟢' },
                [ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD]: { e: '🔵' },
                [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED]: { e: '🔴' },
                [ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE]: { e: '🟠' }
            }[status] || { e: '⚪️' };
            const statusText = ConfigModule.MASTER_STATUS_TEXT[status] || status;
            return `<span class="pct-status-pill" title="${statusText}">${config.e} ${statusText}</span>`;
        };
        const updatePaginationInfo = (totalItems) => {
            const { isFullView, pageNo, pageSize } = StateModule.get();
            const paginationEl = document.querySelector('.pct-pagination');
            if (!paginationEl) return;
            if (isFullView || totalItems === 0) {
                paginationEl.style.visibility = 'hidden';
            } else {
                paginationEl.style.visibility = 'visible';
                const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
                document.getElementById('pct-page-info').textContent = `${pageNo} / ${maxPage}`;
                document.getElementById('pct-prev-page').disabled = pageNo <= 1;
                document.getElementById('pct-next-page').disabled = pageNo >= maxPage;
            }
        };
        const loadSinglePolpln = async (planCode, signal) => {
            const { polplnDataCache, rawPolplnDataCache } = StateModule.get();
            if (polplnDataCache.has(planCode)) return;
            polplnDataCache.set(planCode, '載入中...');
            try {
                const polplnRecords = await ApiModule.fetchPolplnForCode(planCode, signal);
                rawPolplnDataCache.set(planCode, polplnRecords);
                const extract = (str) => typeof str === 'string' ? str.trim().replace(/^\d+/, "").replace(/\d+$/, "").replace(/%$/, "").trim() : "";
                const uniquePolplns = [...new Set(polplnRecords.map(r => extract(r.polpln)).filter(Boolean))];
                const polpln = uniquePolplns.length === 1 ? uniquePolplns[0] : (uniquePolplns.length > 1 ? '多筆不同' : '無資料');
                polplnDataCache.set(planCode, polpln);
            } catch (e) {
                if (e.name === 'AbortError') {
                    polplnDataCache.delete(planCode);
                    rawPolplnDataCache.delete(planCode);
                } else {
                    polplnDataCache.set(planCode, '載入錯誤');
                }
            }
        };
        const handleTableClick = async (e) => {
            const target = e.target;
            if (target.classList.contains('clickable-cell')) {
                const cellValue = target.textContent.trim();
                if (cellValue && cellValue !== '...') UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show);
            } else if (target.classList.contains('pct-load-polpln-btn')) {
                target.disabled = true; target.textContent = '...';
                const planCode = target.dataset.plancode;
                await loadSinglePolpln(planCode, new AbortController().signal);
                rerenderTable();
            } else if (target.classList.contains('copy-row-trigger')) {
                const rowNo = parseInt(target.textContent, 10);
                const item = DataModule.getFilteredData(initialQueryData).find(d => d.no === rowNo);
                if (item) copyTableRow(item);
            }
        };
        const handleToggleView = (e) => {
            const isFullView = !StateModule.get().isFullView;
            StateModule.set({ isFullView, pageNo: 1 });
            e.target.textContent = isFullView ? '分頁顯示' : '一頁顯示';
            rerenderTable();
        };
        const changePage = (direction) => {
            const { pageNo, pageSize, isFullView } = StateModule.get();
            if (isFullView) return;
            const totalItems = DataModule.getFilteredData(initialQueryData).length;
            const maxPage = Math.ceil(totalItems / pageSize);
            const newPageNo = pageNo + direction;
            if (newPageNo >= 1 && newPageNo <= maxPage) {
                StateModule.set({ pageNo: newPageNo });
                rerenderTable();
            }
        };
        const handleCopyAll = () => {
            const dataToCopy = DataModule.getFilteredData(initialQueryData);
            if (dataToCopy.length === 0) { UIModule.Toast.show('無資料可複製', 'warning'); return; }
            const { showPlanName, polplnDataCache } = StateModule.get();
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const rows = dataToCopy.map(item => {
                const channelText = item.channels.length > 0 ? item.channels.map(ch => ch.channel).join(' | ') : '無資料';
                const nameToShow = showPlanName ? item.fullName : item.displayName;
                return [
                    item.no, item.planCode, nameToShow, item.currency, item.unit, item.coverageType,
                    item.saleStartDate, item.saleEndDate, ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                    polplnDataCache.get(item.planCode) || '', channelText
                ];
            });
            const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
        };
        const copyTableRow = (item) => {
            const { showPlanName, polplnDataCache } = StateModule.get();
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const channelText = item.channels.length > 0 ? item.channels.map(c => c.channel).join(' | ') : '無資料';
            const rowData = [
                item.no, item.planCode, showPlanName ? item.fullName : item.displayName,
                item.currency, item.unit, item.coverageType, item.saleStartDate, item.saleEndDate,
                ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                polplnDataCache.get(item.planCode) || '',
                channelText
            ];
            const tsvContent = [headers, rowData].map(row => row.join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
        };
        const handlePreviewAll = () => {
            const dataToPreview = DataModule.getFilteredData(initialQueryData);
            if (dataToPreview.length === 0) { UIModule.Toast.show('無資料可預覽', 'warning'); return; }
            const previewContent = generatePreviewPageHTML(dataToPreview);
            const previewWindow = window.open('', '_blank');
            if (previewWindow) {
                previewWindow.document.write(previewContent);
                previewWindow.document.close();
            } else {
                UIModule.Toast.show('無法開啟新視窗，請檢查瀏覽器設定', 'error');
            }
        };
        const generatePreviewPageHTML = (data) => {
            const { showPlanName, polplnDataCache, rawPolplnDataCache } = StateModule.get();

            const createTableHTML = (tableId, dataArray, keysToShow, customHeaders = {}) => {
                if (!dataArray || dataArray.length === 0) return '<p>無資料可顯示。</p>';
                let headers = keysToShow || Object.keys(dataArray[0] || {});
                let thead = '<thead><tr>' + headers.map(h => `<th>${UtilsModule.escapeHtml(customHeaders[h] || h)}</th>`).join('') + '</tr></thead>';
                let tbody = '<tbody>' + dataArray.map(row => {
                    let tr = '<tr>';
                    tr += headers.map(headerKey => `<td>${UtilsModule.escapeHtml(row[headerKey])}</td>`).join('');
                    tr += '</tr>';
                    return tr;
                }).join('') + '</tbody>';
                return `<div class="pct-preview-table-wrap"><table id="${tableId}">${thead}${tbody}</table></div>`;
            };

            const processedDataForTable = data.map(item => {
                const nameToShow = showPlanName ? item.fullName : item.displayName;
                const { content: channelsCellContent } = renderChannelsCell(item);
                return {
                    'No': item.no, '代號': item.planCode, '商品名稱': nameToShow, '幣別': item.currency, '單位': item.unit, '型態': item.coverageType,
                    '主檔銷售日': item.saleStartDate, '主檔停售日': item.saleEndDate, '主檔狀態': ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                    'POLPLN': polplnDataCache.get(item.planCode) || '', '銷售通路': channelsCellContent.replace(/<[^>]*>/g, ' ')
                };
            });
            const tab1Content = createTableHTML('preview-table-processed', processedDataForTable, ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路']);

            const rawMasterData = data.map(d => d._raw.master);
            const tab2Content = createTableHTML('preview-table-master', rawMasterData);

            const rawChannelData = data.flatMap(d => d._raw.channels.map(channel => ({planCode: d.planCode, ...channel})));
            const tab3Content = createTableHTML('preview-table-channel', rawChannelData);

            const currentPlanCodes = new Set(data.map(d => d.planCode));
            const rawPolplnData = Array.from(rawPolplnDataCache.entries())
                .filter(([planCode]) => currentPlanCodes.has(planCode))
                .flatMap(([, records]) => records);
            const tab4Content = createTableHTML('preview-table-polpln', rawPolplnData);

            const scriptForPreviewPage = `
function setupPreviewPage() {
const tabs = document.querySelectorAll('.pct-tab-btn');
const contents = document.querySelectorAll('.pct-tab-content');
const transposeBtns = document.querySelectorAll('.transpose-btn');

const switchTab = (tabId) => {
tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
contents.forEach(content => content.style.display = content.id === tabId ? 'block' : 'none');
};

tabs.forEach(tab => {
tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

transposeBtns.forEach(btn => {
let isTransposed = false;
const tableId = btn.dataset.table;
const table = document.getElementById(tableId);
if(!table) return;
const originalTableHTML = table.innerHTML;

btn.addEventListener('click', () => {
if (isTransposed) {
table.innerHTML = originalTableHTML;
isTransposed = false;
return;
}
const rows = Array.from(table.querySelectorAll('tr'));
if (rows.length === 0) return;
const numCols = rows[0].children.length;
let newTableHTML = '<tbody>';
for (let j = 0; j < numCols; j++) {
newTableHTML += '<tr>';
for (let i = 0; i < rows.length; i++) {
const cell = rows[i].children[j];
const cellContent = cell ? cell.innerHTML : '';
const cellTag = (i === 0) ? 'th' : 'td';
newTableHTML += '<' + cellTag + '>' + cellContent + '</' + cellTag + '>';
}
newTableHTML += '</tr>';
}
newTableHTML += '</tbody>';
table.innerHTML = newTableHTML;
isTransposed = true;
});
});
switchTab('tab-processed');
}`;

            return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>全表預覽</title><style>
:root{--abnormal-bg-color:#fff3cd; --tab-active-border: #4A90E2;}
body{font-family:'Microsoft JhengHei',sans-serif;margin:0;background-color:#f4f7f9;}
.pct-preview-container{padding: 15px;}
.pct-preview-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #ddd;}
.pct-preview-tabs{display:flex;border-bottom:1px solid #ccc;margin-top:15px;}
.pct-tab-btn{padding:10px 20px;cursor:pointer;background-color:#eee;border:1px solid #ccc;border-bottom:none;border-radius:6px 6px 0 0;margin-right:5px;font-size:14px;}
.pct-tab-btn.active{background-color:#fff;border-bottom:1px solid #fff;border-color:var(--tab-active-border) var(--tab-active-border) #fff;font-weight:bold;}
.pct-tab-content{padding:15px;background-color:#fff;border:1px solid #ccc;border-top:none;}
.pct-preview-table-wrap{width:100%;overflow-x:auto;}
table{border-collapse:collapse;width:100%;font-size:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top;white-space:nowrap;}
thead th{background-color:#f0f2f5;text-align:center;position:sticky;top:0;z-index:5;}
tbody th{background-color:#f7f7f7;}
.pct-content-header{display:flex;justify-content:flex-end;align-items:center;margin-bottom:10px;}
</style></head><body>
<div class="pct-preview-container">
<div class="pct-preview-header"><h2>查詢結果預覽 (共 ${data.length} 筆)</h2></div>
<div class="pct-preview-tabs">
<div class="pct-tab-btn" data-tab="tab-processed">合併處理後資料</div>
<div class="pct-tab-btn" data-tab="tab-master">商品主檔原始資料</div>
<div class="pct-tab-btn" data-tab="tab-channel">通路銷售原始資料</div>
<div class="pct-tab-btn" data-tab="tab-polpln">POLPLN 原始資料</div>
</div>
<div id="tab-processed" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-processed">欄/列 置換</button></div>${tab1Content}</div>
<div id="tab-master" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-master">欄/列 置換</button></div>${tab2Content}</div>
<div id="tab-channel" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-channel">欄/列 置換</button></div>${tab3Content}</div>
<div id="tab-polpln" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-polpln">欄/列 置換</button></div>${tab4Content}</div>
</div>
<script>(${scriptForPreviewPage.toString()})();<\/script>
</body></html>`;
        };
        const updateFilterOptions = (baseData) => {
            const newOptions = {};
            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                let values = new Set();
                if (filter.type === 'standard') {
                    baseData.forEach(item => {
                        if (filter.key === 'mainStatus') {
                            if (item.mainStatus) values.add(ConfigModule.MASTER_STATUS_TEXT[item.mainStatus]);
                        } else if (item[filter.key] !== undefined && item[filter.key] !== null) {
                            values.add(item[filter.key]);
                        }
                    });
                } else if (filter.type === 'advanced') {
                    baseData.forEach(item => {
                        const rawValue = item._raw?.master?.[filter.rawKey];
                        if (rawValue !== undefined && rawValue !== null) {
                            values.add(String(rawValue));
                        }
                    });
                }
                newOptions[filter.key] = Array.from(values).sort();
            });
            StateModule.set({ filterOptions: newOptions });
        };
        const renderFilterControls = (shouldUpdateOptions = true) => {
            if (shouldUpdateOptions) {
                updateFilterOptions(initialQueryData);
            }
            const container = document.getElementById('pct-all-filters-container');
            const wrapper = document.getElementById('pct-filters-wrapper');
            if (!container || !wrapper) return;

            const { filterOptions, activeFilters, advancedFilters, isFilterVisible } = StateModule.get();
            let headerHtml = `<div class="pct-filters-header"><h4>篩選器</h4><button id="pct-toggle-filters-btn" class="pct-btn pct-btn-outline" style="font-size: 12px; padding: 2px 8px;">${isFilterVisible ? '收折' : '展開'}</button></div>`;
            
            let labelsHtml = '';
            let controlsHtml = '';

            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                labelsHtml += `<div class="pct-filter-label">${filter.label}</div>`;
                
                let controlHtml = '<div class="pct-filter-control">';
                const currentValue = filter.type === 'standard' ? activeFilters[filter.key] : advancedFilters[filter.key];
                
                if (filter.filterType === 'select') {
                    controlHtml += `<select id="filter-${filter.key}" data-key="${filter.key}" data-type="${filter.type}">`;
                    controlHtml += `<option value="">全部</option>`;
                    const options = filterOptions[filter.key] || [];
                    options.forEach(opt => {
                        const selected = String(currentValue ?? '') === String(opt) ? 'selected' : '';
                        controlHtml += `<option value="${UtilsModule.escapeHtml(opt)}" ${selected}>${UtilsModule.escapeHtml(opt)}</option>`;
                    });
                    controlHtml += `</select>`;
                } else if (filter.filterType === 'text') {
                    controlHtml += `<input type="text" id="filter-${filter.key}" data-key="${filter.key}" data-type="${filter.type}" class="pct-input" value="${UtilsModule.escapeHtml(currentValue || '')}" placeholder="關鍵字...">`;
                }
                
                controlHtml += '</div>';
                controlsHtml += controlHtml;
            });
            
            labelsHtml += `<div class="pct-filter-label"></div>`; 
            controlsHtml += `<div class="pct-filter-control" style="text-align: right;"><button id="pct-reset-filters" class="pct-btn pct-btn-outline" style="font-size: 12px; padding: 4px 8px;">重設</button></div>`;
            
            container.innerHTML = labelsHtml + controlsHtml;
            wrapper.innerHTML = headerHtml + container.outerHTML;

            // Re-select container after innerHTML rewrite
            const newContainer = document.getElementById('pct-all-filters-container');
            newContainer.classList.toggle('collapsed', !isFilterVisible);

            bindFilterEvents();
        };

        const bindFilterEvents = () => {
            document.querySelectorAll('#pct-all-filters-container select, #pct-all-filters-container input').forEach(el => {
                el.addEventListener('input', (e) => {
                    const timers = StateModule.get().debounceTimers;
                    const key = e.target.dataset.key;
                    clearTimeout(timers[key]);
                    timers[key] = setTimeout(() => {
                        const type = e.target.dataset.type;
                        const value = e.target.value;

                        if (type === 'standard') {
                            const newActiveFilters = { ...StateModule.get().activeFilters };
                            if (value) newActiveFilters[key] = value;
                            else delete newActiveFilters[key];
                            StateModule.set({ activeFilters: newActiveFilters, pageNo: 1 });
                        } else if (type === 'advanced') {
                            const newAdvancedFilters = { ...StateModule.get().advancedFilters };
                            if (value) newAdvancedFilters[key] = value;
                            else delete newAdvancedFilters[key];
                            StateModule.set({ advancedFilters: newAdvancedFilters, pageNo: 1 });
                        }
                        rerenderTable();
                    }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
                });
            });

            const resetBtn = document.getElementById('pct-reset-filters');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    StateModule.set({ activeFilters: {}, advancedFilters: {}, pageNo: 1 });
                    rerenderTable();
                });
            }
            
            const toggleBtn = document.getElementById('pct-toggle-filters-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    const isVisible = !StateModule.get().isFilterVisible;
                    StateModule.set({ isFilterVisible: isVisible });
                    document.getElementById('pct-all-filters-container').classList.toggle('collapsed', !isVisible);
                    toggleBtn.textContent = isVisible ? '收折' : '展開';
                });
            }
        };

        const handleForceUpdate = async (reQueryAfter = false) => {
            UIModule.Toast.show('正在清除快取並從伺服器更新資料...', 'info', 3000);
            StateModule.clearAllCaches();
            initialQueryData = [];
            
            if (document.getElementById('pct-table-view-wrapper')) {
                 cleanupAndClose();
                 setTimeout(() => showQueryDialog(true), 100);
                 UIModule.Toast.show('資料已清除，請重新點擊查詢', 'info', 4000);
            } else {
                const controller = new AbortController();
                StateModule.set({ currentQueryController: controller });
                try {
                    await DataModule.initializeCaches(controller.signal);
                    UIModule.Progress.hide();
                    UIModule.Toast.show('資料更新成功！', 'success', 2000);
                } catch (error) {
                    UIModule.Progress.hide();
                    if (error.name !== 'AbortError') UIModule.Toast.show(`更新失敗: ${error.message}`, 'error', 5000);
                }
            }
        };

        return { initialize, cleanupAndClose };
    })();

    // --- 腳本啟動點 ---
    document.querySelectorAll(`#${ConfigModule.TOOL_ID}, #${ConfigModule.STYLE_ID}, .pct-toast, #pctModalMask`).forEach(el => el.remove());
    ControllerModule.initialize();
})();
