javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * KGI Plan Code Query Tool v2.2.0 (Final Build)
     *
     * @version 2.2.0
     * @author Gemini AI
     * @description
     * 最終功能完整版。整合了所有使用者提出的需求，包含核心架構重構與多項體驗優化。
     *
     * --- v2.2.0 更新日誌 ---
     * 1. [新增] 視窗管理：新增「收折」與「最小化」功能，方便在查詢時進行多工操作。
     * 2. [新增] 篩選器擴充：結果頁篩選器新增「通路」選項，並為整個篩選器區塊加上外框。
     * 3. [新增] 資料時間戳：右上角標題列新增「資料更新時間」，並在更新資料後自動刷新。
     * 4. [優化] 「更新」邏輯：點擊「更新」將在背景重新擷取 API 資料，並自動刷新所有頁籤的現有查詢結果。
     * 5. [優化] 介面調整：簡化篩選器標題佈局、恢復「一頁顯示」按鈕、恢復狀態 Emoji 與通路顏色分隔符、
     * 簡化商品名稱 Tooltip、隱藏「修改 Token」按鈕並調整部分按鈕文字。
     * 6. [修正] 修正了排序與「more」按鈕在表格刷新後偶爾失效的 Bug。
     * 7. [修正] 恢復「預覽」功能的完整樣式，包含頁籤與「欄/列置換」功能。
     * =================================================================================
     */

    const ConfigModule = Object.freeze({
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '2.2.0',
        RESULTS_PAGE_FILTERS: [
            { key: 'mainStatus', label: '主檔狀態', type: 'standard', filterType: 'select' },
            { key: 'channels', label: '通路', type: 'standard', filterType: 'select' }, // 新增通路篩選
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
            CURRENTLY_SOLD: 'currently sold', DISCONTINUING_SOON: 'discontinuing soon', DISCONTINUED: 'discontinued',
            ABNORMAL_DATE: 'abnormal date', COMING_SOON: 'coming soon', NOT_SOLD: 'not sold'
        },
        MASTER_STATUS_TEXT: {
            'currently sold': '銷售中', 'discontinuing soon': '即將停售', 'discontinued': '已停售',
            'abnormal date': '日期異常', 'coming soon': '即將上市', 'not sold': '未銷售'
        },
        QUERY_MASTER_STATUS_OPTIONS: {
            'coming soon': '即將上市', 'currently sold': '銷售中', 'discontinuing soon': '即將停售',
            'discontinued': '已停售', 'abnormal date': '日期異常'
        },
        QUERY_CHANNEL_STATUS_OPTIONS: {
            'currently sold': '銷售中', 'discontinued': '已停售', 'coming soon': '即將上市',
            'abnormal date': '日期異常', 'not sold': '未銷售'
        },
        STATUS_ORDER: {
            'coming soon': 1, 'discontinuing soon': 2, 'currently sold': 3,
            'discontinued': 4, 'abnormal date': 5, 'not sold': 6
        },
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
        },
        FIELD_MAPS: {
            CURRENCY: { '1': 'TWD', '2': 'USD', '3': 'AUD', '4': 'CNT', '5': 'USD_OIU', '6': 'EUR', '7': 'JPY' },
            UNIT: { 'A1': '元', 'A3': '仟元', 'A4': '萬元', 'B1': '計畫', 'C1': '單位' },
            COVERAGE_TYPE: { 'M': '主約', 'R': '附約' },
            CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC']
        },
        DEFAULT_QUERY_PARAMS: {
            PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 10000, PAGE_SIZE_TABLE: 50
        },
        DEBOUNCE_DELAY: { SEARCH: 300 }
    });

    const StateModule = (() => {
        const state = {
            global: {
                env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
                apiBase: '', token: '', isTokenVerified: false, masterDataCache: null, channelDataCache: null,
                polplnDataCache: new Map(), rawPolplnDataCache: new Map(), mergedDataCache: null,
                lastDbUpdateTime: '', currentQueryController: null, debounceTimers: {},
                modalPosition: { top: '60px', left: '50%' },
                windowState: 'normal' // 'normal', 'collapsed', 'minimized'
            },
            tabs: [],
            activeTabId: null,
        };
        state.global.apiBase = state.global.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;

        const createNewTabState = (id, name) => ({
            id: id, name: name, uiState: 'query',
            query: {
                keyword: '', masterStatus: new Set(), channels: new Set(), channelStatus: new Set()
            },
            results: {
                initialData: [], filteredData: [], viewMode: 'standard',
                filterOptions: {}, activeFilters: {}, advancedFilters: {},
                isFilterVisible: true, pageNo: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
                isFullView: false, showPlanName: false, searchKeyword: '', sortKey: 'no', sortAsc: true,
            }
        });

        const getGlobal = (key) => key ? state.global[key] : { ...state.global };
        const setGlobal = (newState) => { Object.assign(state.global, newState); };
        const getActiveTab = () => state.tabs.find(t => t.id === state.activeTabId);
        const setTabState = (tabId, newTabState) => {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) Object.assign(tab, newTabState);
        };
        const setActiveTabState = (newActiveTabState) => {
            const activeTab = getActiveTab();
            if (activeTab) Object.assign(activeTab, newActiveTabState);
        };
        const getTabs = () => [...state.tabs];
        const getActiveTabId = () => state.activeTabId;
        const setActiveTabId = (tabId) => { state.activeTabId = tabId; };
        const addNewTab = () => {
            const newId = `tab_${Date.now()}`;
            const newName = `查詢 ${state.tabs.length + 1}`;
            state.tabs.push(createNewTabState(newId, newName));
            state.activeTabId = newId;
            return getActiveTab();
        };
        const removeTab = (tabId) => {
            const tabIndex = state.tabs.findIndex(t => t.id === tabId);
            if (tabIndex === -1) return;
            state.tabs.splice(tabIndex, 1);
            if (state.activeTabId === tabId) {
                state.activeTabId = state.tabs[tabIndex]?.id || state.tabs[tabIndex - 1]?.id || null;
            }
            if (state.tabs.length === 0) { addNewTab(); }
        };
        const clearAllCaches = () => setGlobal({
            masterDataCache: null, channelDataCache: null, mergedDataCache: null,
            polplnDataCache: new Map(), rawPolplnDataCache: new Map(), lastDbUpdateTime: ''
        });
        addNewTab();
        return {
            getGlobal, setGlobal, getActiveTab, setTabState, setActiveTabState,
            getTabs, getActiveTabId, setActiveTabId, addNewTab, removeTab, clearAllCaches
        };
    })();

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
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            } catch (e) { return isoString; }
        };
        const parseDateString = (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string' || dateStr.length !== 8) return null;
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) return date;
            return null;
        };
        const getMasterSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
            const STATUS = ConfigModule.MASTER_STATUS_TYPES;
            if (!saleStartStr || !saleEndStr) return STATUS.ABNORMAL_DATE;
            const startDate = parseDateString(saleStartStr);
            const endDate = parseDateString(saleEndStr);
            const todayDate = parseDateString(todayStr);
            if (!startDate || !endDate || !todayDate || startDate > endDate) return STATUS.ABNORMAL_DATE;
            if (todayDate < startDate) return STATUS.COMING_SOON;
            if (todayDate > endDate) return STATUS.DISCONTINUED;
            const daysUntilEnd = (endDate - todayDate) / (1000 * 60 * 60 * 24);
            if (saleEndStr !== '99991231' && daysUntilEnd <= 45) return STATUS.DISCONTINUING_SOON;
            return STATUS.CURRENTLY_SOLD;
        };
        const getChannelSaleStatus = (masterStart, masterEnd, channelStart, channelEnd, today) => {
            const STATUS = ConfigModule.MASTER_STATUS_TYPES;
            if (!channelStart || !channelEnd) return STATUS.NOT_SOLD;
            if (!masterStart || !masterEnd) return STATUS.ABNORMAL_DATE;
            const mS = parseDateString(masterStart), mE = parseDateString(masterEnd),
                  cS = parseDateString(channelStart), cE = parseDateString(channelEnd),
                  t = parseDateString(today);
            if (!mS || !mE || !cS || !cE || !t) return STATUS.ABNORMAL_DATE;
            if (cS > cE || mS > mE || cS < mS || cE > mE) return STATUS.ABNORMAL_DATE;
            if (t < cS) return STATUS.COMING_SOON;
            if (t > cE) return STATUS.DISCONTINUED;
            return STATUS.CURRENTLY_SOLD;
        };
        const convertCodeToText = (v, map) => map[String(v)] || v || '';
        const copyTextToClipboard = (text, showToast) => {
            navigator.clipboard.writeText(text).then(() => showToast('複製成功', 'success')).catch(() => showToast('複製失敗', 'error'));
        };
        const toHalfWidthUpperCase = (e) => {
            const input = e.target;
            const { value, selectionStart, selectionEnd } = input;
            input.value = value.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();
            input.setSelectionRange(selectionStart, selectionEnd);
        };
        const findStoredToken = () => {
            const sources = [() => localStorage.getItem('SSO-TOKEN'), () => sessionStorage.getItem('SSO-TOKEN'), () => localStorage.getItem('euisToken'), () => sessionStorage.getItem('euisToken')];
            for (const source of sources) { const token = source(); if (token && token.trim()) return token.trim(); }
            return null;
        };
        return {
            escapeHtml, formatToday, formatDateForUI, formatDateTime, parseDateString,
            getMasterSaleStatus, getChannelSaleStatus,
            convertCodeToText, copyTextToClipboard, toHalfWidthUpperCase, findStoredToken,
        };
    })();

    const UIModule = (() => {
        const injectStyle = () => {
            if (document.getElementById(ConfigModule.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = ConfigModule.STYLE_ID;
            style.textContent = `
:root { --primary-color: #4A90E2; --primary-dark-color: #357ABD; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; --info-color: #17a2b8; --abnormal-bg-color: #fff3cd; }
.pct-modal-mask { position: fixed; z-index: 2147483646; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.25); }
.pct-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #FFFFFF; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); padding: 0; max-width: 95vw; width: 1050px; height: 850px; position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 2147483647; display: flex; flex-direction: column; transition: transform 0.3s ease, opacity 0.3s ease, height 0.3s ease; }
.pct-modal.dragging { transition: none !important; }
.pct-modal.collapsed { height: 95px; overflow: hidden; }
.pct-modal.minimized, .pct-minimized-widget.hiding { transform: translate(50vw, -50vh) scale(0.1); opacity: 0; }
.pct-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; font-size: 18px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; flex-shrink: 0; }
.pct-header-controls { display: flex; align-items: center; gap: 8px; }
.pct-header-btn { width: 22px; height: 22px; border: 1px solid #ccc; border-radius: 4px; background-color: #f0f0f0; cursor: pointer; font-size: 16px; line-height: 20px; text-align: center; }
.pct-header-btn:hover { background-color: #e0e0e0; }
.pct-modal-header-title { flex-grow: 1; }
.pct-modal-header.dragging { cursor: grabbing; }
.pct-close-btn-custom { display: flex; flex-direction: column; justify-content: center; align-items: center; background: transparent; border: 1px solid var(--secondary-color); color: var(--secondary-color); border-radius: 6px; padding: 4px 10px; cursor: pointer; transition: all 0.2s; line-height: 1.2; height: 40px; }
.pct-close-btn-custom:hover { background-color: #f8f8f8; }
.pct-close-btn-custom span:first-child { font-size: 15px; font-weight: 600; }
.pct-close-btn-custom span:last-child { font-size: 11px; color: var(--error-color); }
.pct-tab-bar { flex-shrink: 0; display: flex; align-items: center; padding: 8px 15px 0 15px; background-color: #f0f2f5; border-bottom: 1px solid #dcdcdc; }
.pct-tab { padding: 8px 15px; border: 1px solid #dcdcdc; border-bottom: none; background-color: #e9ecef; cursor: pointer; border-radius: 6px 6px 0 0; position: relative; margin-right: 4px; display: flex; align-items: center; max-width: 150px; }
.pct-tab.active { background-color: #fff; border-bottom: 1px solid #fff; font-weight: bold; color: var(--primary-color); z-index: 2; margin-bottom: -1px; }
.pct-tab:not(.active):hover { background-color: #f8f9fa; }
.pct-tab-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-grow: 1; }
.pct-tab-close { margin-left: 8px; font-size: 16px; border: none; background: transparent; cursor: pointer; padding: 0 4px; border-radius: 50%; line-height: 1; }
.pct-tab-close:hover { background-color: #ddd; }
.pct-add-tab-btn { font-size: 20px; font-weight: bold; cursor: pointer; padding: 0 10px; border-radius: 4px; border: 1px solid transparent; }
.pct-add-tab-btn:hover { background-color: #dcdcdc; }
.pct-minimized-widget { position: fixed; top: 15px; right: 15px; width: 50px; height: 50px; background-color: lightgreen; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #1e5128; cursor: pointer; z-index: 2147483647; box-shadow: 0 2px 10px rgba(0,0,0,0.3); transition: transform 0.3s ease, opacity 0.3s ease; }
.pct-minimized-widget:hover { transform: scale(1.1); }
.pct-modal-body { padding: 16px 20px 8px 20px; flex-grow: 1; display: flex; flex-direction: column; overflow-y: auto; }
.pct-modal-footer { padding: 12px 20px 16px 20px; border-top: 1px solid #E0E0E0; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.pct-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; font-size: 15px; border-radius: 6px; border: 1px solid transparent; background: var(--primary-color); color: #fff; cursor: pointer; transition: all 0.25s; font-weight: 600; white-space: nowrap; }
.pct-btn:hover { background: var(--primary-dark-color); }
.pct-btn:disabled { background: #E9ECEF; color: #6C757D; border: 1px solid #DEE2E6; cursor: not-allowed; }
.pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
.pct-btn.pct-btn-outline:hover:not(:disabled) { background-color: #F8F8F8; }
.pct-input { width: 100%; font-size: 16px; padding: 9px 12px; border-radius: 5px; border: 1px solid #E0E0E0; box-sizing: border-box; margin-top: 5px; transition: all .2s; }
.pct-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(74,144,226,0.2); outline: none; }
.pct-query-container { display: flex; flex-direction: column; gap: 18px; padding: 10px; height: 100%; }
.pct-query-section { background: #fdfdff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 15px; }
.pct-query-section-title { font-size: 16px; font-weight: bold; margin: 0 0 12px 0; color: #333; }
.pct-query-btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
.pct-query-btn { padding: 8px 14px; font-size: 14px; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
.pct-query-btn.selected { background-color: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
.pct-results-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.pct-result-top-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0; }
.pct-controls-left, .pct-controls-right { display: flex; align-items: center; gap: 15px; }
#pct-search-input { width: 220px; font-size: 14px; padding: 6px 30px 6px 10px; background-color: #f0f7ff; border: 1px solid #b8d6f3; }
#pct-clear-search { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: transparent; border: none; font-size: 20px; color: #999; cursor: pointer; display: none; padding: 0 5px; }
#pct-search-input:not(:placeholder-shown) + #pct-clear-search { display: block; }
.pct-query-summary { flex-shrink: 0; background-color: #f0f5ff; border: 1px solid #cce0ff; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 13px; color: #333; line-height: 1.6; }
.pct-query-summary strong { color: #004085; }
.pct-query-summary .summary-item { display: inline-block; margin-right: 15px; }
.pct-query-summary .summary-item .label { font-weight: 600; }
.pct-query-summary .summary-item .value { background-color: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #b8d6f3; }
#pct-table-view-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; } .pct-table-wrap { flex: 1; overflow: auto; border: 1px solid #E0E0E0; border-radius: 6px; }
.pct-table { border-collapse: collapse; width: 100%; font-size: 13px; table-layout: fixed; min-width: 1200px; }
.pct-table th { background: #f0f2f5; position: sticky; top: 0; z-index: 1; cursor: pointer; font-size: 14px; font-weight: bold; text-align: center !important; white-space: nowrap; }
.pct-table th, .pct-table td { border: 1px solid #ddd; padding: 8px 4px; vertical-align: middle; text-align: center; }
.pct-table td.pct-align-left { text-align: left !important; padding-left: 8px !important; }
.pct-table tr.pct-row-abnormal-date > td { background-color: var(--abnormal-bg-color) !important; }
.pct-table td.clickable-cell { cursor: cell; }
.pct-table td.copy-row-trigger { cursor: pointer; color: var(--primary-color); font-weight: 500; }
.pct-table td.copy-row-trigger:hover { text-decoration: underline; }
.pct-table tr:not(.pct-row-abnormal-date):hover td { background: #e3f2fd; }
.pct-table th[data-key] { position: relative; padding-right: 20px; }
.pct-table th[data-key]::after { content: ''; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.3; border: 4px solid transparent; }
.pct-table th[data-key].sort-asc::after { border-bottom-color: var(--primary-color); opacity: 1; }
.pct-table th[data-key].sort-desc::after { border-top-color: var(--primary-color); opacity: 1; }
.pct-load-polpln-btn { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; } .pct-load-polpln-btn:hover { background: #f0f0f0; }
.pct-channel-comingsoon { color: var(--success-color); font-weight: bold; } .pct-channel-insale { color: var(--primary-color); font-weight: bold; } .pct-channel-offsale { color: var(--error-color); font-weight: bold; } .pct-channel-abnormal { color: var(--warning-color); font-weight: bold; } .pct-channel-notsold { color: #888; }
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
#pct-filters-wrapper { margin-bottom: 10px; flex-shrink: 0; background-color: #f8f9fa; border-radius: 6px; padding: 8px; border: 1px solid #dee2e6;}
.pct-filters-header { display: flex; justify-content: flex-end; align-items: center; margin-bottom: 8px; gap: 8px; }
#pct-all-filters-container { display: grid; grid-template-columns: repeat(${ConfigModule.RESULTS_PAGE_FILTERS.length}, 1fr); gap: 5px 10px; align-items: center; transition: all 0.3s ease-in-out; }
#pct-all-filters-container.collapsed { display: none; }
.pct-filter-label { font-size: 13px; font-weight: bold; text-align: center; grid-row: 1; }
.pct-filter-control { grid-row: 2; }
.pct-filter-control .pct-input, .pct-filter-control select { font-size: 13px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; width: 100%; box-sizing: border-box; }
#pct-db-update-time { font-size: 12px; color: #666; font-weight: normal; margin: 0 15px 0 auto; }
#pct-toggle-filters-btn, #pct-reset-filters { font-size: 12px; padding: 2px 8px; }
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
            create: () => {
                Modal.close();
                const mask = document.createElement('div');
                mask.id = 'pctModalMask';
                mask.className = 'pct-modal-mask';
                document.body.appendChild(mask);
                const modal = document.createElement('div');
                modal.id = ConfigModule.TOOL_ID;
                modal.className = 'pct-modal';
                const { top, left } = StateModule.getGlobal('modalPosition');
                modal.style.top = top;
                modal.style.left = left;
                if(left === '50%') modal.style.transform = 'translateX(-50%)';

                document.body.appendChild(modal);
                return modal;
            },
            close: () => {
                const modal = document.getElementById(ConfigModule.TOOL_ID);
                if (modal && StateModule.getGlobal('windowState') === 'normal') {
                    const { top, left, transform } = modal.style;
                    StateModule.setGlobal({ modalPosition: { top, left, transform } });
                }
                StateModule.getGlobal('currentQueryController')?.abort();
                modal?.remove();
                document.getElementById('pctModalMask')?.remove();
                document.getElementById('pct-minimized-widget')?.remove();
            },
            render: () => {
                const modal = document.getElementById(ConfigModule.TOOL_ID) || Modal.create();
                const widget = document.getElementById('pct-minimized-widget');
                const mask = document.getElementById('pctModalMask');

                const { windowState, env } = StateModule.getGlobal();
                
                if (widget) widget.style.display = 'none';
                if (mask) mask.style.display = 'block';
                modal.style.display = 'flex';
                modal.classList.remove('collapsed', 'minimized');

                if (windowState === 'minimized') {
                    modal.classList.add('minimized');
                    mask.style.display = 'none';
                    setTimeout(() => {
                        modal.style.display = 'none';
                        const minimizedWidget = document.createElement('div');
                        minimizedWidget.id = 'pct-minimized-widget';
                        minimizedWidget.className = 'pct-minimized-widget';
                        minimizedWidget.textContent = '查';
                        minimizedWidget.title = '還原查詢工具';
                        document.body.appendChild(minimizedWidget);
                        minimizedWidget.addEventListener('click', ControllerModule.handleMinimizeToggle);
                    }, 300);
                    return;
                }
                
                if (windowState === 'collapsed') {
                    modal.classList.add('collapsed');
                }

                modal.innerHTML = `
                    <div class="pct-modal-header">
                        <div class="pct-modal-header-title">商品查詢 v${ConfigModule.VERSION} (${env})</div>
                        <div id="pct-db-update-time"></div>
                        <div class="pct-header-controls">
                            <button id="pct-minimize-btn" class="pct-header-btn" title="最小化">_</button>
                            <button id="pct-collapse-btn" class="pct-header-btn" title="收折">□</button>
                        </div>
                        <button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button>
                    </div>
                    <div id="pct-tab-bar" class="pct-tab-bar"></div>
                    <div id="pct-main-content" class="pct-modal-body"></div>
                    <div class="pct-modal-footer">
                        <div style="display:flex; gap:10px;">
                           <button id="pct-update-btn" class="pct-btn pct-btn-outline">更新</button>
                        </div>
                        <div id="pct-footer-actions" style="display:flex; gap:10px;"></div>
                    </div>
                `;
                Modal.renderTabs();
                Modal.renderContent();
                EventModule.bindModalEvents();
                ControllerModule.renderTimestamp();
            },
            renderTabs: () => {
                const tabBar = document.getElementById('pct-tab-bar');
                if (!tabBar) return;
                const tabs = StateModule.getTabs();
                const activeTabId = StateModule.getActiveTabId();
                tabBar.innerHTML = `
                    ${tabs.map(tab => `
                        <div class="pct-tab ${tab.id === activeTabId ? 'active' : ''}" data-tab-id="${tab.id}" title="${ControllerModule.generateTabTooltipText(tab.query)}">
                           <span class="pct-tab-name">${UtilsModule.escapeHtml(tab.name)}</span>
                           <button class="pct-tab-close" data-tab-id="${tab.id}">&times;</button>
                        </div>
                    `).join('')}
                    <div id="pct-add-tab-btn" class="pct-add-tab-btn" title="新增查詢">+</div>
                `;
            },
            renderContent: () => {
                const contentArea = document.getElementById('pct-main-content');
                const footerArea = document.getElementById('pct-footer-actions');
                if (!contentArea || !footerArea) return;
                const activeTab = StateModule.getActiveTab();
                if (!activeTab) {
                    contentArea.innerHTML = '<div>錯誤：找不到作用中的頁籤。</div>'; return;
                }
                if (activeTab.uiState === 'query') {
                    contentArea.innerHTML = getQueryScreenHTML(activeTab);
                    footerArea.innerHTML = `<button id="pct-start-query" class="pct-btn">開始查詢</button>`;
                } else if (activeTab.uiState === 'results') {
                    contentArea.innerHTML = getResultsScreenHTML(activeTab);
                    footerArea.innerHTML = `
                        <button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button>
                        <button id="pct-preview-all" class="pct-btn pct-btn-outline">預覽</button>
                        <button id="pct-copy-all" class="pct-btn pct-btn-outline">複製</button>
                        <button id="pct-back-to-query" class="pct-btn pct-btn-outline">返回</button>
                    `;
                }
                EventModule.bindContentEvents();
            }
        };
        const getQueryScreenHTML = (tabState) => {
            const { keyword } = tabState.query;
            const masterStatusOpts = Object.entries(ConfigModule.QUERY_MASTER_STATUS_OPTIONS)
                .map(([key, value]) => `<button class="pct-query-btn" data-type="masterStatus" data-value="${key}">${value}</button>`).join('');
            const channelOpts = ConfigModule.FIELD_MAPS.CHANNELS
                .map(ch => `<button class="pct-query-btn" data-type="channels" data-value="${ch}">${ch}</button>`).join('');
            const channelStatusOpts = Object.entries(ConfigModule.QUERY_CHANNEL_STATUS_OPTIONS)
                .map(([key, value]) => `<button class="pct-query-btn" data-type="channelStatus" data-value="${key}">${value}</button>`).join('');
            return `
            <div class="pct-query-container">
                <div class="pct-query-section">
                    <h3 class="pct-query-section-title">1. 商品代號或名稱 (可選)</h3>
                    <input type="text" id="pct-query-keyword" class="pct-input" value="${UtilsModule.escapeHtml(keyword)}" placeholder="輸入商品代號、名稱關鍵字...">
                </div>
                <div class="pct-query-section">
                    <h3 class="pct-query-section-title">2. 主約銷售狀態 (可複選)</h3>
                    <div class="pct-query-btn-group">${masterStatusOpts}</div>
                </div>
                <div class="pct-query-section">
                    <h3 class="pct-query-section-title">3. 通路條件 (可複選，篩選邏輯為 "任一" 所選通路滿足條件)</h3>
                    <p style="font-size: 13px; color: #666; margin: -5px 0 10px 0;">若只選通路狀態，則代表查詢至少有一個通路是該狀態的商品。</p>
                    <strong>銷售通路:</strong>
                    <div class="pct-query-btn-group" style="margin-top: 5px;">
                        <button class="pct-query-btn" data-type="channels" data-value="all">全選</button>
                        ${channelOpts}
                    </div>
                    <strong style="display: block; margin-top: 15px;">通路銷售狀態:</strong>
                    <div class="pct-query-btn-group" style="margin-top: 5px;">
                         <button class="pct-query-btn" data-type="channelStatus" data-value="all">全選</button>
                        ${channelStatusOpts}
                    </div>
                </div>
            </div>`;
        };
        const getResultsScreenHTML = (tabState) => {
             const { showPlanName, searchKeyword, viewMode } = tabState.results;
             const viewToggleText = viewMode === 'standard' ? '檢視通路詳情' : '檢視標準模式';
             return `<div class="pct-results-container">
                <div class="pct-result-top-controls">
                    <div class="pct-controls-left">
                        <div class="search-wrapper" style="position: relative;">
                            <label for="pct-search-input" style="font-size: 14px; color: #666; margin-right: 5px;">結果內搜尋:</label>
                            <input type="text" id="pct-search-input" placeholder="搜尋關鍵字..." value="${UtilsModule.escapeHtml(searchKeyword)}">
                            <button id="pct-clear-search" title="清除搜尋">&times;</button>
                        </div>
                        <div style="display:flex; align-items:center; gap: 8px;">
                            <span style="font-size: 13px; color: #555;">簡稱</span>
                            <label class="pct-toggle-switch"><input type="checkbox" id="pct-name-toggle" ${showPlanName ? 'checked' : ''}><span class="pct-toggle-slider"></span></label>
                            <span style="font-size: 13px; color: #555;">全名</span>
                        </div>
                        <button id="pct-view-toggle" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">${viewToggleText}</button>
                    </div>
                    <div class="pct-controls-right">
                        <span id="pct-result-count"></span>
                        <div class="pct-pagination" style="display: flex; align-items: center; gap: 5px;">
                            <button id="pct-prev-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">←</button>
                            <span id="pct-page-info" style="font-size: 14px; min-width: 50px; text-align: center;">-</span>
                            <button id="pct-next-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">→</button>
                        </div>
                    </div>
                </div>
                <div id="pct-query-summary" class="pct-query-summary"></div>
                <div id="pct-table-view-wrapper">
                    <div id="pct-filters-wrapper"></div>
                    <div class="pct-table-wrap" id="pct-table-wrap">
                        <table class="pct-table"><tbody id="pct-table-body"></tbody></table>
                    </div>
                </div>
             </div>`;
        };
        const Progress = {
            show: (text) => {
                const anchor = document.getElementById('pct-main-content');
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

    const EventModule = (() => {
        const dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };
        const dragMouseDown = (e) => {
            const modal = document.getElementById(ConfigModule.TOOL_ID);
            if (!modal || e.target.closest('.pct-close-btn-custom, .pct-tab-bar, .pct-header-controls')) return;
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
            if (e.key === 'Escape') ControllerModule.cleanupAndClose();
        };
        const bindModalEvents = () => {
            document.querySelector('.pct-modal-header')?.addEventListener('mousedown', dragMouseDown);
            document.querySelector('.pct-close-btn-custom')?.addEventListener('click', ControllerModule.cleanupAndClose);
            document.getElementById('pct-update-btn')?.addEventListener('click', () => ControllerModule.handleForceUpdate());
            document.getElementById('pct-minimize-btn')?.addEventListener('click', ControllerModule.handleMinimizeToggle);
            document.getElementById('pct-collapse-btn')?.addEventListener('click', ControllerModule.handleCollapseToggle);

            const tabBar = document.getElementById('pct-tab-bar');
            tabBar?.addEventListener('click', (e) => {
                const tabTarget = e.target.closest('.pct-tab');
                const closeTarget = e.target.closest('.pct-tab-close');
                const addTarget = e.target.closest('#pct-add-tab-btn');
                if (closeTarget) {
                    e.stopPropagation();
                    ControllerModule.handleCloseTab(closeTarget.dataset.tabId);
                } else if (tabTarget) {
                    ControllerModule.handleSwitchTab(tabTarget.dataset.tabId);
                } else if (addTarget) {
                    ControllerModule.handleAddNewTab();
                }
            });
        };
        const bindContentEvents = () => {
            const activeTab = StateModule.getActiveTab();
            if (!activeTab) return;
            if (activeTab.uiState === 'query') {
                document.getElementById('pct-start-query')?.addEventListener('click', ControllerModule.handleStartQuery);
                document.getElementById('pct-query-keyword')?.addEventListener('input', UtilsModule.toHalfWidthUpperCase);
                document.querySelectorAll('.pct-query-btn').forEach(btn => btn.addEventListener('click', ControllerModule.handleQuerySelection));
            } else if (activeTab.uiState === 'results') {
                document.getElementById('pct-back-to-query')?.addEventListener('click', ControllerModule.handleBackToQuery);
                document.getElementById('pct-copy-all')?.addEventListener('click', ControllerModule.handleCopyAll);
                document.getElementById('pct-preview-all')?.addEventListener('click', ControllerModule.handlePreviewAll);
                document.getElementById('pct-toggle-view')?.addEventListener('click', ControllerModule.handleToggleView);

                const searchInput = document.getElementById('pct-search-input');
                searchInput?.addEventListener('input', UtilsModule.toHalfWidthUpperCase);
                searchInput?.addEventListener('input', ControllerModule.handleResultSearch);
                document.getElementById('pct-clear-search')?.addEventListener('click', ControllerModule.handleClearResultSearch);
                document.getElementById('pct-name-toggle')?.addEventListener('change', ControllerModule.handleNameToggle);
                document.getElementById('pct-view-toggle')?.addEventListener('click', ControllerModule.handleViewToggle);
                document.getElementById('pct-prev-page')?.addEventListener('click', () => ControllerModule.changePage(-1));
                document.getElementById('pct-next-page')?.addEventListener('click', () => ControllerModule.changePage(1));
                
                document.getElementById('pct-table-wrap')?.addEventListener('click', ControllerModule.handleTableClick);
            }
        };
        const setupGlobalKeyListener = () => {
            document.removeEventListener('keydown', handleEscKey);
            document.addEventListener('keydown', handleEscKey);
        };
        return { bindModalEvents, bindContentEvents, setupGlobalKeyListener, handleEscKey };
    })();

    const ApiModule = (() => {
        const callApi = async (endpoint, params, signal) => {
            const { apiBase, token } = StateModule.getGlobal();
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
                StateModule.setGlobal({ lastDbUpdateTime: res.updateTime || new Date().toISOString() });
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

    const DataModule = (() => {
        const initializeCaches = async (signal) => {
            const { masterDataCache, channelDataCache } = StateModule.getGlobal();
            const tasks = [];
            if (!masterDataCache) tasks.push(ApiModule.fetchMasterData(signal).then(data => StateModule.setGlobal({ masterDataCache: data })));
            if (!channelDataCache) tasks.push(ApiModule.fetchChannelData(signal).then(data => StateModule.setGlobal({ channelDataCache: data })));
            if (tasks.length > 0) {
                UIModule.Progress.show('首次載入基礎資料中，請稍候...');
                UIModule.Progress.update(10, '正在取得資料庫資料...');
                await Promise.all(tasks);
                UIModule.Progress.update(50, '資料載入完成，正在處理合併...');
                mergeData();
            }
        };
        const mergeData = () => {
            const { masterDataCache, channelDataCache } = StateModule.getGlobal();
            if (!masterDataCache || !channelDataCache) return;
            const today = UtilsModule.formatToday();
            const channelMap = channelDataCache.reduce((acc, cur) => {
                if (!acc.has(cur.planCode)) acc.set(cur.planCode, []);
                acc.get(cur.planCode).push(cur);
                return acc;
            }, new Map());
            const mergedData = masterDataCache.map((rawMasterItem) => {
                const planCode = String(rawMasterItem.planCode || '-');
                const masterSaleStart = UtilsModule.formatDateForUI(rawMasterItem.saleStartDate);
                const masterSaleEnd = UtilsModule.formatDateForUI(rawMasterItem.saleEndDate);
                const channelsRaw = channelMap.get(planCode) || [];
                const fixedChannelStatuses = {};
                const channelDataMap = new Map(channelsRaw.map(c => [c.channel, c]));
                ConfigModule.FIELD_MAPS.CHANNELS.forEach(channelName => {
                    const channelData = channelDataMap.get(channelName);
                    const channelSaleStart = channelData ? UtilsModule.formatDateForUI(channelData.saleStartDate) : '';
                    const channelSaleEnd = channelData ? UtilsModule.formatDateForUI(channelData.saleEndDate) : '';
                    const status = UtilsModule.getChannelSaleStatus(masterSaleStart, masterSaleEnd, channelSaleStart, channelSaleEnd, today);
                    fixedChannelStatuses[channelName] = { status, saleStartDate: channelSaleStart, saleEndDate: channelSaleEnd };
                });
                return {
                    planCode, fullName: rawMasterItem.planCodeName || rawMasterItem.shortName || '-',
                    displayName: rawMasterItem.shortName || rawMasterItem.planCodeName || '-',
                    currency: UtilsModule.convertCodeToText(rawMasterItem.currency || rawMasterItem.cur, ConfigModule.FIELD_MAPS.CURRENCY),
                    unit: UtilsModule.convertCodeToText(rawMasterItem.reportInsuranceAmountUnit || rawMasterItem.insuranceAmountUnit, ConfigModule.FIELD_MAPS.UNIT),
                    coverageType: UtilsModule.convertCodeToText(rawMasterItem.coverageType || rawMasterItem.type, ConfigModule.FIELD_MAPS.COVERAGE_TYPE),
                    saleStartDate: masterSaleStart, saleEndDate: masterSaleEnd,
                    mainStatus: UtilsModule.getMasterSaleStatus(today, masterSaleStart, masterSaleEnd),
                    fixedChannelStatuses, _raw: { master: rawMasterItem, channels: channelsRaw }
                };
            });
            StateModule.setGlobal({ mergedDataCache: mergedData });
        };
        const getInitialDataForTab = (queryState) => {
            const { mergedDataCache } = StateModule.getGlobal();
            if (!mergedDataCache) return [];
            const { keyword, masterStatus, channels, channelStatus } = queryState;
            let data = [...mergedDataCache];
            if (keyword) {
                const lowerKeyword = keyword.toLowerCase();
                data = data.filter(item =>
                    item.planCode.toLowerCase().includes(lowerKeyword) ||
                    item.displayName.toLowerCase().includes(lowerKeyword) ||
                    item.fullName.toLowerCase().includes(lowerKeyword)
                );
            }
            if (masterStatus.size > 0) {
                data = data.filter(item => masterStatus.has(item.mainStatus));
            }
            if (channels.size > 0 || channelStatus.size > 0) {
                 data = data.filter(item => {
                    const targetChannels = channels.size > 0 ? Array.from(channels) : ConfigModule.FIELD_MAPS.CHANNELS;
                    const targetStatuses = channelStatus.size > 0 ? channelStatus : null;
                    return targetChannels.some(ch => {
                        const currentStatus = item.fixedChannelStatuses[ch]?.status;
                        if (!targetStatuses) return currentStatus !== ConfigModule.MASTER_STATUS_TYPES.NOT_SOLD;
                        return targetStatuses.has(currentStatus);
                    });
                });
            }
            return data;
        };
        const getFilteredData = (baseData, viewState) => {
            let data = [...baseData];
            if (!data) return [];
            const { searchKeyword, sortKey, sortAsc, activeFilters, advancedFilters } = viewState;
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
                        if (key === 'channels') { // Special handling for new channel filter
                            return item.fixedChannelStatuses[filterValue]?.status !== ConfigModule.MASTER_STATUS_TYPES.NOT_SOLD;
                        }
                        return String(item[key]) === filterValue;
                    });
                    if (!standardMatch) return false;
                    return advancedFilterKeys.every(key => {
                        const filterConfig = allFilterConfigs.find(f => f.key === key);
                        const rawValue = item._raw?.master?.[filterConfig.rawKey];
                        const filterValue = advancedFilters[key];
                        return String(rawValue ?? '') === filterValue;
                    });
                });
            }
            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                data = data.filter(item => {
                    const searchableItem = { ...item };
                    delete searchableItem._raw;
                    delete searchableItem.fixedChannelStatuses;
                    return Object.values(searchableItem).some(value => String(value ?? '').toLowerCase().includes(keyword));
                });
            }
            if (sortKey && sortKey !== 'no') {
                data.sort((a, b) => {
                    let valA, valB;
                    if (ConfigModule.FIELD_MAPS.CHANNELS.includes(sortKey)) {
                         valA = ConfigModule.STATUS_ORDER[a.fixedChannelStatuses[sortKey]?.status] || 99;
                         valB = ConfigModule.STATUS_ORDER[b.fixedChannelStatuses[sortKey]?.status] || 99;
                    } else {
                        valA = a[sortKey]; valB = b[sortKey];
                    }
                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });
            }
            return data.map((item, index) => ({ ...item, no: index + 1 }));
        };
        return { initializeCaches, getInitialDataForTab, getFilteredData };
    })();

    const ControllerModule = (() => {
        const initialize = () => {
            console.log(`=== 商品查詢工具 v${ConfigModule.VERSION} 初始化 ===`);
            UIModule.injectStyle();
            EventModule.setupGlobalKeyListener();
            autoCheckToken();
        };
        const cleanupAndClose = () => {
            console.log('Clearing all data caches and closing tool...');
            StateModule.clearAllCaches();
            UIModule.Modal.close();
            document.removeEventListener('keydown', EventModule.handleEscKey);
        };
        const autoCheckToken = () => {
            const storedToken = UtilsModule.findStoredToken();
            if (storedToken) {
                StateModule.setGlobal({ token: storedToken, isTokenVerified: true });
                UIModule.Toast.show('已自動載入 Token', 'info', 1500);
                setTimeout(showMainUI, 500);
            } else {
                UIModule.Toast.show('未找到 Token，請手動輸入', 'warning', 1500);
                setTimeout(() => showTokenDialog(), 500);
            }
        };
        const showTokenDialog = () => {
            const { env, token: currentToken } = StateModule.getGlobal();
            const dialog = document.createElement('div');
            dialog.innerHTML = `<div class="pct-modal-mask"></div>
                <div class="pct-modal" style="width: 600px; height: auto; top: 100px;">
                    <div class="pct-modal-header"><div class="pct-modal-header-title">請提供權限 (${env})</div></div>
                    <div class="pct-modal-body">
                        <label for="pct-token-input">請貼上您的 SSO-TOKEN：</label>
                        <textarea id="pct-token-input" class="pct-input" rows="4" placeholder="請從開發者工具或相關系統中複製 TOKEN...">${currentToken || ''}</textarea>
                    </div>
                    <div class="pct-modal-footer">
                        <div></div>
                        <button id="pct-confirm-token" class="pct-btn">儲存並開始</button>
                    </div>
                </div>`;
            document.body.appendChild(dialog);
            const confirmBtn = dialog.querySelector('#pct-confirm-token');
            const tokenInput = dialog.querySelector('#pct-token-input');
            const handleConfirm = () => {
                const token = tokenInput.value.trim();
                if (!token) { UIModule.Toast.show('請輸入 TOKEN', 'error'); return; }
                localStorage.setItem('SSO-TOKEN', token);
                StateModule.setGlobal({ token, isTokenVerified: true });
                UIModule.Toast.show('TOKEN 已儲存', 'success');
                dialog.remove();
                if(!document.getElementById(ConfigModule.TOOL_ID)){
                    setTimeout(showMainUI, 500);
                }
            };
            confirmBtn.addEventListener('click', handleConfirm);
            tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); } });
        };
        const showMainUI = () => {
            UIModule.Modal.create();
            UIModule.Modal.render();
        };
        const handleAddNewTab = () => {
            StateModule.addNewTab();
            UIModule.Modal.renderTabs();
            UIModule.Modal.renderContent();
        };
        const handleSwitchTab = (tabId) => {
            if (StateModule.getActiveTabId() === tabId) return;
            StateModule.setActiveTabId(tabId);
            UIModule.Modal.renderTabs();
            UIModule.Modal.renderContent();
            rerenderTable();
        };
        const handleCloseTab = (tabId) => {
            StateModule.removeTab(tabId);
            UIModule.Modal.renderTabs();
            UIModule.Modal.renderContent();
            rerenderTable();
        };
        const handleQuerySelection = (e) => {
            const button = e.target;
            const type = button.dataset.type;
            const value = button.dataset.value;
            const activeTab = StateModule.getActiveTab();
            if (!activeTab || !type || !value) return;
            const queryState = activeTab.query;
            const toggleSelection = (set, val) => {
                if (set.has(val)) set.delete(val); else set.add(val);
            };
            const handleGroupSelection = (key, allValues) => {
                const set = queryState[key];
                if (value === 'all') {
                    const isAddingAll = !allValues.every(v => set.has(v));
                    set.clear();
                    if (isAddingAll) allValues.forEach(v => set.add(v));
                } else {
                    toggleSelection(set, value);
                }
            };
            switch(type) {
                case 'masterStatus': toggleSelection(queryState.masterStatus, value); break;
                case 'channels': handleGroupSelection('channels', ConfigModule.FIELD_MAPS.CHANNELS); break;
                case 'channelStatus': handleGroupSelection('channelStatus', Object.keys(ConfigModule.QUERY_CHANNEL_STATUS_OPTIONS)); break;
            }
            updateQueryButtonUI();
        };
        const updateQueryButtonUI = () => {
            const { query } = StateModule.getActiveTab();
            const updateGroupUI = (key, allValues) => {
                const set = query[key];
                allValues.forEach(val => document.querySelector(`.pct-query-btn[data-type="${key}"][data-value="${val}"]`)?.classList.toggle('selected', set.has(val)));
                const allBtn = document.querySelector(`.pct-query-btn[data-type="${key}"][data-value="all"]`);
                if(allBtn) allBtn.classList.toggle('selected', allValues.every(v => set.has(v)));
            };
            updateGroupUI('masterStatus', Object.keys(ConfigModule.QUERY_MASTER_STATUS_OPTIONS));
            updateGroupUI('channels', ConfigModule.FIELD_MAPS.CHANNELS);
            updateGroupUI('channelStatus', Object.keys(ConfigModule.QUERY_CHANNEL_STATUS_OPTIONS));
        };
        const handleStartQuery = async () => {
            const activeTab = StateModule.getActiveTab();
            if (!activeTab) return;
            activeTab.query.keyword = document.getElementById('pct-query-keyword').value.trim();
            activeTab.uiState = 'results';
            UIModule.Modal.renderContent();
            if (!StateModule.getGlobal('isTokenVerified')) { return; }
            const controller = new AbortController();
            StateModule.setGlobal({ currentQueryController: controller });
            try {
                await DataModule.initializeCaches(controller.signal);
                UIModule.Progress.update(80, '根據條件篩選資料...');
                const initialData = DataModule.getInitialDataForTab(activeTab.query);
                activeTab.results.initialData = initialData;
                updateFilterOptions();
                rerenderTable();
                UIModule.Progress.hide();
            } catch (error) {
                UIModule.Progress.hide();
                if (error.name !== 'AbortError') {
                    UIModule.Toast.show(`查詢錯誤: ${error.message}`, 'error', 5000);
                    activeTab.results.initialData = [];
                    rerenderTable();
                }
            } finally {
                StateModule.setGlobal({ currentQueryController: null });
            }
        };
        const handleBackToQuery = () => {
             const activeTab = StateModule.getActiveTab();
             if (!activeTab) return;
             activeTab.uiState = 'query';
             UIModule.Modal.renderContent();
             requestAnimationFrame(() => updateQueryButtonUI());
        };
        const rerenderTable = () => {
            const activeTab = StateModule.getActiveTab();
            const tableWrap = document.getElementById('pct-table-wrap');
            if (!activeTab || activeTab.uiState !== 'results' || !tableWrap) {
                return;
            }
            renderQuerySummary();
            const filteredData = DataModule.getFilteredData(activeTab.results.initialData, activeTab.results);
            activeTab.results.filteredData = filteredData;
            document.getElementById('pct-result-count').textContent = `共 ${filteredData.length} 筆資料`;
            const { isFullView, pageNo, pageSize, sortKey, sortAsc, viewMode } = activeTab.results;
            const displayData = isFullView ? filteredData : filteredData.slice((pageNo - 1) * pageSize, pageNo * pageSize);
            const colspan = viewMode === 'standard' ? 11 : 9 + ConfigModule.FIELD_MAPS.CHANNELS.length;
            
            tableWrap.innerHTML = `<table class="pct-table">
                ${generateResultsTableHeader()}
                <tbody id="pct-table-body">${displayData.map(renderTableRow).join('') || `<tr><td colspan="${colspan}" style="text-align:center; padding: 20px;">查無符合條件的資料</td></tr>`}</tbody>
            </table>`;
            
            tableWrap.querySelectorAll('thead th[data-key]').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.key === sortKey) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
            });
            updatePaginationInfo();
            renderFilterControls(false);
        };
        const handleSort = (key) => {
            const { results } = StateModule.getActiveTab();
            if (results.sortKey === key) {
                results.sortAsc = !results.sortAsc;
            } else {
                results.sortKey = key;
                results.sortAsc = true;
            }
            rerenderTable();
        };
        const handleResultSearch = (e) => {
            const timers = StateModule.getGlobal('debounceTimers');
            clearTimeout(timers.resultSearch);
            timers.resultSearch = setTimeout(() => {
                const { results } = StateModule.getActiveTab();
                results.searchKeyword = e.target.value.trim();
                results.pageNo = 1;
                rerenderTable();
            }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
        };
        const handleClearResultSearch = () => {
             const { results } = StateModule.getActiveTab();
             document.getElementById('pct-search-input').value = '';
             results.searchKeyword = '';
             results.pageNo = 1;
             rerenderTable();
        };
        const handleNameToggle = (e) => {
             StateModule.getActiveTab().results.showPlanName = e.target.checked;
             rerenderTable();
        };
        const handleViewToggle = () => {
            const { results } = StateModule.getActiveTab();
            results.viewMode = results.viewMode === 'standard' ? 'channelDetail' : 'standard';
            rerenderTable();
        };
        const handleToggleView = (e) => {
            const { results } = StateModule.getActiveTab();
            results.isFullView = !results.isFullView;
            results.pageNo = 1;
            e.target.textContent = results.isFullView ? '分頁顯示' : '一頁顯示';
            rerenderTable();
        };
        const changePage = (direction) => {
            const { results } = StateModule.getActiveTab();
            if (results.isFullView) return;
            const maxPage = Math.max(1, Math.ceil(results.filteredData.length / results.pageSize));
            const newPageNo = results.pageNo + direction;
            if (newPageNo >= 1 && newPageNo <= maxPage) {
                results.pageNo = newPageNo;
                rerenderTable();
            }
        };
        const generateResultsTableHeader = () => {
            const { results } = StateModule.getActiveTab();
            const commonHeaders = `
                <th data-key="no" style="width: 4%;">No</th>
                <th data-key="planCode" style="width: 7%;">代號</th>
                <th data-key="displayName" style="width: 16%;">商品名稱</th>
                <th data-key="currency" style="width: 5%;">幣別</th>
                <th data-key="unit" style="width: 5%;">單位</th>
                <th data-key="coverageType" style="width: 5%;">型態</th>
                <th data-key="saleStartDate" style="width: 7%;">主檔銷售日</th>
                <th data-key="saleEndDate" style="width: 7%;">主檔停售日</th>
                <th data-key="mainStatus" style="width: 9%;">主檔狀態</th>
            `;
            if (results.viewMode === 'channelDetail') {
                const channelHeaders = ConfigModule.FIELD_MAPS.CHANNELS.map(ch => `<th data-key="${ch}">${ch}</th>`).join('');
                return `<thead><tr>${commonHeaders}${channelHeaders}</tr></thead>`;
            } else { // standard view
                return `<thead><tr>
                    ${commonHeaders.replace('style="width: 16%;"', 'style="width: 27%;"')}
                    <th data-key="polpln" style="width: 7%;">POLPLN</th>
                    <th data-key="channels" style="width: 14%;">銷售通路</th>
                </tr></thead>`;
            }
        };
        const renderTableRow = (item) => {
            const { results } = StateModule.getActiveTab();
            const { showPlanName, viewMode } = results;
            const { polplnDataCache } = StateModule.getGlobal();
            const nameToShow = showPlanName ? item.fullName : item.displayName;
            const nameInTitle = showPlanName ? item.displayName : item.fullName;
            const isAbnormalRow = item.mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE;

            const commonCells = `
                <td class="copy-row-trigger" title="點擊複製整行">${item.no}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td>
                <td class="clickable-cell pct-align-left" title="${UtilsModule.escapeHtml(nameInTitle)}">${UtilsModule.escapeHtml(nameToShow)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td>
                <td>${renderStatusPill(item.mainStatus)}</td>
            `;

            let specificCells = '';
            if (viewMode === 'channelDetail') {
                specificCells = ConfigModule.FIELD_MAPS.CHANNELS.map(ch => {
                    const statusInfo = item.fixedChannelStatuses[ch];
                    const statusText = (ConfigModule.MASTER_STATUS_TEXT[statusInfo.status] || statusInfo.status);
                    const title = `${ch} [${statusText}]&#10;起日: ${statusInfo.saleStartDate || '無'}&#10;迄日: ${statusInfo.saleEndDate || '無'}`;
                    return `<td title="${title}">${renderStatusPill(statusInfo.status)}</td>`;
                }).join('');
            } else { // standard view
                const polplnValue = polplnDataCache.get(item.planCode);
                const polplnCellContent = (polplnValue === undefined)
                    ? `<button class="pct-load-polpln-btn" data-plancode="${item.planCode}">more</button>`
                    : `<span class="clickable-cell">${UtilsModule.escapeHtml(polplnValue)}</span>`;

                const { content: channelsCellContent, tooltip: tooltipText } = renderChannelsCell(item);
                specificCells = `
                    <td>${polplnCellContent}</td>
                    <td class="pct-align-left" title="${tooltipText}">${channelsCellContent}</td>
                `;
            }
            return `<tr class="${isAbnormalRow ? 'pct-row-abnormal-date' : ''}">${commonCells}${specificCells}</tr>`;
        };
        const renderChannelsCell = (item) => {
            const channels = Object.entries(item.fixedChannelStatuses).map(([c, d])=>({channel:c,...d}));
            const channelsToDisplay = channels.filter(ch => ch.status !== ConfigModule.MASTER_STATUS_TYPES.NOT_SOLD)
              .sort((a, b) => (ConfigModule.STATUS_ORDER[a.status] || 99) - (ConfigModule.STATUS_ORDER[b.status] || 99));

            const tooltipText = ConfigModule.FIELD_MAPS.CHANNELS.map(chName => {
                const chData = channels.find(c => c.channel === chName);
                const statusText = chData ? (ConfigModule.MASTER_STATUS_TEXT[chData.status] || chData.status) : '未銷售';
                return `${chName} 【${statusText}】 • 起日: ${chData?.saleStartDate || '無'} | 迄日: ${chData?.saleEndDate || '無'}`;
            }).join('&#10;');

            if (channelsToDisplay.length === 0) return { content: '【無銷售通路】', tooltip: tooltipText };
            
            const content = channelsToDisplay.reduce((acc, ch, index) => {
                const classMap = {
                    [ConfigModule.MASTER_STATUS_TYPES.COMING_SOON]: 'pct-channel-comingsoon', [ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD]: 'pct-channel-insale',
                    [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED]: 'pct-channel-offsale', [ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE]: 'pct-channel-abnormal'
                };
                const span = `<span class="${classMap[ch.status] || 'pct-channel-notsold'}">${ch.channel}</span>`;
                if (index > 0 && ch.status !== channelsToDisplay[index - 1].status) acc.push(' | ');
                else if (index > 0) acc.push(' ');
                acc.push(span);
                return acc;
            }, []).join('');

            return { content, tooltip: tooltipText };
        };
        const renderStatusPill = (status) => {
            const config = {
                [ConfigModule.MASTER_STATUS_TYPES.COMING_SOON]: { e: '🟢' }, [ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD]: { e: '🔵' },
                [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUING_SOON]: { e: '🟡' }, [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED]: { e: '🔴' },
                [ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE]: { e: '🟠' }, [ConfigModule.MASTER_STATUS_TYPES.NOT_SOLD]: { e: '⚪️' }
            }[status] || { e: '❔' };
            const statusText = ConfigModule.MASTER_STATUS_TEXT[status] || status;
            return `<span class="pct-status-pill" title="${statusText}">${config.e} ${statusText}</span>`;
        };
        const updatePaginationInfo = () => {
            const { results } = StateModule.getActiveTab();
            const paginationEl = document.querySelector('.pct-pagination');
            if (!paginationEl) return;
            paginationEl.style.visibility = (results.isFullView || results.filteredData.length === 0) ? 'hidden' : 'visible';
            if (!results.isFullView && results.filteredData.length > 0) {
                 const maxPage = Math.max(1, Math.ceil(results.filteredData.length / results.pageSize));
                 document.getElementById('pct-page-info').textContent = `${results.pageNo} / ${maxPage}`;
                 document.getElementById('pct-prev-page').disabled = results.pageNo <= 1;
                 document.getElementById('pct-next-page').disabled = results.pageNo >= maxPage;
            }
        };
        const handleTableClick = async (e) => {
            const activeTab = StateModule.getActiveTab();
            if (!activeTab) return;
            
            const headerCell = e.target.closest('th[data-key]');
            if (headerCell) {
                handleSort(headerCell.dataset.key);
                return;
            }

            const clickableCell = e.target.closest('.clickable-cell');
            const loadBtn = e.target.closest('.pct-load-polpln-btn');
            const copyTrigger = e.target.closest('.copy-row-trigger');

            if (clickableCell) {
                const cellValue = clickableCell.textContent.trim();
                if (cellValue && cellValue !== '...') UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show);
            } else if (loadBtn) {
                loadBtn.disabled = true; loadBtn.textContent = '...';
                const planCode = loadBtn.dataset.plancode;
                await loadSinglePolpln(planCode, new AbortController().signal);
                rerenderTable();
            } else if (copyTrigger) {
                const rowNo = parseInt(copyTrigger.textContent, 10);
                const item = activeTab.results.filteredData.find(d => d.no === rowNo);
                if (item) copyTableRow(item);
            }
        };
        const loadSinglePolpln = async (planCode, signal) => {
            const { polplnDataCache, rawPolplnDataCache } = StateModule.getGlobal();
            if (polplnDataCache.has(planCode)) return;
            polplnDataCache.set(planCode, '載入中...');
            try {
                const polplnRecords = await ApiModule.fetchPolplnForCode(planCode, signal);
                rawPolplnDataCache.set(planCode, polplnRecords);
                const extract = (str) => typeof str === 'string' ? str.trim().replace(/^\d+/, "").replace(/\d+$/, "").replace(/%$/, "").trim() : "";
                const uniquePolplns = [...new Set(polplnRecords.map(r => extract(r.polpln)).filter(Boolean))];
                const polpln = uniquePolplns.length === 1 ? uniquePolplns[0] : (uniquePolplns.length > 1 ? '多筆不同' : '無資料');
                polplnDataCache.set(planCode, polpln);
            } catch (e) { polplnDataCache.set(planCode, '載入錯誤'); }
        };
        const copyTableRow = (item) => {
            const { results } = StateModule.getActiveTab();
            const { polplnDataCache } = StateModule.getGlobal();
            const channelText = Object.entries(item.fixedChannelStatuses).filter(([,d]) => d.status !== 'not sold').map(([c]) => c).join(' | ') || '無';
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const rowData = [
                item.no, item.planCode, results.showPlanName ? item.fullName : item.displayName,
                item.currency, item.unit, item.coverageType, item.saleStartDate, item.saleEndDate,
                ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                polplnDataCache.get(item.planCode) || '', channelText
            ];
            const tsvContent = [headers, rowData].map(row => row.join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
        };
        const handleCopyAll = () => {
            const { results } = StateModule.getActiveTab();
            const { polplnDataCache } = StateModule.getGlobal();
            const dataToCopy = results.filteredData;
            if (dataToCopy.length === 0) { UIModule.Toast.show('無資料可複製', 'warning'); return; }
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const rows = dataToCopy.map(item => {
                const channelText = Object.entries(item.fixedChannelStatuses).filter(([,d]) => d.status !== 'not sold').map(([c]) => c).join(' | ') || '無';
                return [
                    item.no, item.planCode, results.showPlanName ? item.fullName : item.displayName, item.currency, item.unit, item.coverageType,
                    item.saleStartDate, item.saleEndDate, ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                    polplnDataCache.get(item.planCode) || '', channelText
                ];
            });
            const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
        };
        const handlePreviewAll = () => {
            const { results } = StateModule.getActiveTab();
            const dataToPreview = results.filteredData;
            if (dataToPreview.length === 0) { UIModule.Toast.show('無資料可預覽', 'warning'); return; }
            const previewContent = generatePreviewPageHTML(dataToPreview);
            const previewWindow = window.open('', '_blank');
            if (previewWindow) {
                previewWindow.document.write(previewContent);
                previewWindow.document.close();
            } else { UIModule.Toast.show('無法開啟新視窗，請檢查瀏覽器設定', 'error'); }
        };
        const generatePreviewPageHTML = (data) => {
            const { results } = StateModule.getActiveTab();
            const { polplnDataCache, rawPolplnDataCache } = StateModule.getGlobal();
            const createTableHTML = (tableId, dataArray, keysToShow, customHeaders = {}) => {
                 if (!dataArray || dataArray.length === 0) return '<p>無資料可顯示。</p>';
                 let headers = keysToShow || Object.keys(dataArray[0] || {});
                 let thead = '<thead><tr>' + headers.map(h => `<th>${UtilsModule.escapeHtml(customHeaders[h] || h)}</th>`).join('') + '</tr></thead>';
                 let tbody = '<tbody>' + dataArray.map(row => '<tr>' + headers.map(headerKey => `<td>${UtilsModule.escapeHtml(row[headerKey])}</td>`).join('') + '</tr>').join('') + '</tbody>';
                 return `<div class="pct-preview-table-wrap"><table id="${tableId}">${thead}${tbody}</table></div>`;
            };
            const processedDataForTable = data.map(item => {
                 const { content: channelsCellContent } = renderChannelsCell(item);
                 return {
                     'No': item.no, '代號': item.planCode, '商品名稱': results.showPlanName ? item.fullName : item.displayName, '幣別': item.currency, '單位': item.unit, '型態': item.coverageType,
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
            const rawPolplnData = Array.from(rawPolplnDataCache.entries()).filter(([planCode]) => currentPlanCodes.has(planCode)).flatMap(([, records]) => records);
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
                tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
                transposeBtns.forEach(btn => {
                    let isTransposed = false;
                    const tableId = btn.dataset.table;
                    const table = document.getElementById(tableId);
                    if(!table) return;
                    const originalTableHTML = table.innerHTML;
                    btn.addEventListener('click', () => {
                        if (isTransposed) { table.innerHTML = originalTableHTML; isTransposed = false; return; }
                        const rows = Array.from(table.querySelectorAll('tr')); if (rows.length === 0) return;
                        const numCols = rows[0].children.length; let newTableHTML = '<tbody>';
                        for (let j = 0; j < numCols; j++) {
                            newTableHTML += '<tr>';
                            for (let i = 0; i < rows.length; i++) {
                                const cell = rows[i].children[j]; const cellContent = cell ? cell.innerHTML : '';
                                const cellTag = (i === 0) ? 'th' : 'td';
                                newTableHTML += '<' + cellTag + '>' + cellContent + '</' + cellTag + '>';
                            }
                            newTableHTML += '</tr>';
                        }
                        newTableHTML += '</tbody>'; table.innerHTML = newTableHTML; isTransposed = true;
                    });
                });
                switchTab('tab-processed');
            }`;

            return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>全表預覽</title><style>
                :root{--tab-active-border: #4A90E2;}
                body{font-family:'Microsoft JhengHei',sans-serif;margin:0;background-color:#f4f7f9;}
                .pct-preview-container{padding: 15px;}
                .pct-preview-tabs{display:flex;border-bottom:1px solid #ccc;margin-top:15px;}
                .pct-tab-btn{padding:10px 20px;cursor:pointer;background-color:#eee;border:1px solid #ccc;border-bottom:none;border-radius:6px 6px 0 0;margin-right:5px;}
                .pct-tab-btn.active{background-color:#fff;border-bottom:1px solid #fff;border-color:var(--tab-active-border) var(--tab-active-border) #fff;font-weight:bold;}
                .pct-tab-content{padding:15px;background-color:#fff;border:1px solid #ccc;border-top:none;}
                .pct-preview-table-wrap{width:100%;overflow-x:auto;}
                table{border-collapse:collapse;width:100%;font-size:12px;} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
                thead th{background-color:#f0f2f5;position:sticky;top:0;} tbody th{background-color:#f7f7f7;}
                .pct-content-header{display:flex;justify-content:flex-end;align-items:center;margin-bottom:10px;}
                </style></head><body>
                <div class="pct-preview-container">
                <h2>查詢結果預覽 (共 ${data.length} 筆)</h2>
                <div class="pct-preview-tabs">
                    <div class="pct-tab-btn" data-tab="tab-processed">合併處理後資料</div><div class="pct-tab-btn" data-tab="tab-master">商品主檔原始資料</div>
                    <div class="pct-tab-btn" data-tab="tab-channel">通路銷售原始資料</div><div class="pct-tab-btn" data-tab="tab-polpln">POLPLN 原始資料</div>
                </div>
                <div id="tab-processed" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-processed">欄/列 置換</button></div>${tab1Content}</div>
                <div id="tab-master" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-master">欄/列 置換</button></div>${tab2Content}</div>
                <div id="tab-channel" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-channel">欄/列 置換</button></div>${tab3Content}</div>
                <div id="tab-polpln" class="pct-tab-content"><div class="pct-content-header"><button class="transpose-btn" data-table="preview-table-polpln">欄/列 置換</button></div>${tab4Content}</div>
                </div><script>(${scriptForPreviewPage.toString()})();</script></body></html>`;
        };
        const handleForceUpdate = async () => {
             UIModule.Toast.show('開始更新資料，請稍候...', 'info', 0);
             const controller = new AbortController();
             StateModule.setGlobal({ currentQueryController: controller });
             try {
                StateModule.clearAllCaches();
                await DataModule.initializeCaches(controller.signal);
                UIModule.Progress.hide();
                
                StateModule.getTabs().forEach(tab => {
                    if (tab.uiState === 'results') {
                        tab.results.initialData = DataModule.getInitialDataForTab(tab.query);
                    }
                });

                rerenderTable(); // Re-render the active tab
                renderTimestamp();
                UIModule.Toast.show('資料更新成功！所有頁籤已刷新。', 'success', 3000);

             } catch (error) {
                 UIModule.Progress.hide();
                 if (error.name !== 'AbortError') UIModule.Toast.show(`更新失敗: ${error.message}`, 'error', 5000);
             } finally {
                StateModule.setGlobal({ currentQueryController: null });
             }
        };
        const updateFilterOptions = () => {
            const { results } = StateModule.getActiveTab();
            const newOptions = {};
            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                let values = new Set();
                results.initialData.forEach(item => {
                    if (filter.type === 'standard') {
                        if (filter.key === 'channels') {
                            ConfigModule.FIELD_MAPS.CHANNELS.forEach(ch => {
                                if (item.fixedChannelStatuses[ch]?.status !== ConfigModule.MASTER_STATUS_TYPES.NOT_SOLD) {
                                    values.add(ch);
                                }
                            });
                        } else {
                            const val = (filter.key === 'mainStatus') ? ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] : item[filter.key];
                            if (val) values.add(val);
                        }
                    } else if (filter.type === 'advanced') {
                        const rawValue = item._raw?.master?.[filter.rawKey];
                        if (rawValue !== undefined && rawValue !== null) values.add(String(rawValue));
                    }
                });
                newOptions[filter.key] = Array.from(values).sort();
            });
            results.filterOptions = newOptions;
        };
        const renderFilterControls = (shouldUpdateOptions = true) => {
            if (shouldUpdateOptions) updateFilterOptions();
            const { results } = StateModule.getActiveTab();
            const wrapper = document.getElementById('pct-filters-wrapper');
            if (!wrapper) return;

            const headerHtml = `<div class="pct-filters-header">
                <button id="pct-reset-filters" class="pct-btn pct-btn-outline">重設</button>
                <button id="pct-toggle-filters-btn" class="pct-btn pct-btn-outline">${results.isFilterVisible ? '收折' : '展開'}</button>
            </div>`;
            let container = document.createElement('div');
            container.id = 'pct-all-filters-container';
            container.className = results.isFilterVisible ? '' : 'collapsed';

            let labelsHtml = '', controlsHtml = '';
            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                labelsHtml += `<div class="pct-filter-label">${filter.label}</div>`;
                const currentValue = filter.type === 'standard' ? results.activeFilters[filter.key] : results.advancedFilters[filter.key];
                let controlHtml = '<div class="pct-filter-control">';
                controlHtml += `<select id="filter-${filter.key}" data-key="${filter.key}" data-type="${filter.type}"><option value="">全部</option>`;
                (results.filterOptions[filter.key] || []).forEach(opt => {
                    const selected = String(currentValue ?? '') === String(opt) ? 'selected' : '';
                    controlHtml += `<option value="${UtilsModule.escapeHtml(opt)}" ${selected}>${UtilsModule.escapeHtml(opt)}</option>`;
                });
                controlHtml += `</select></div>`;
                controlsHtml += controlHtml;
            });
            container.innerHTML = labelsHtml + controlsHtml;
            wrapper.innerHTML = headerHtml + container.outerHTML;
            bindFilterEvents();
        };
        const bindFilterEvents = () => {
            document.querySelectorAll('#pct-all-filters-container select').forEach(el => {
                el.addEventListener('input', (e) => {
                    const { results } = StateModule.getActiveTab();
                    const key = e.target.dataset.key, type = e.target.dataset.type, value = e.target.value;
                    const filterGroup = type === 'standard' ? results.activeFilters : results.advancedFilters;
                    if (value) filterGroup[key] = value; else delete filterGroup[key];
                    results.pageNo = 1;
                    rerenderTable();
                });
            });
            document.getElementById('pct-reset-filters')?.addEventListener('click', () => {
                const { results } = StateModule.getActiveTab();
                results.activeFilters = {}; results.advancedFilters = {}; results.pageNo = 1;
                rerenderTable();
            });
            document.getElementById('pct-toggle-filters-btn')?.addEventListener('click', (e) => {
                const { results } = StateModule.getActiveTab();
                results.isFilterVisible = !results.isFilterVisible;
                document.getElementById('pct-all-filters-container').classList.toggle('collapsed', !results.isFilterVisible);
                e.target.textContent = results.isFilterVisible ? '收折' : '展開';
            });
        };
        const renderQuerySummary = () => {
            const summaryEl = document.getElementById('pct-query-summary');
            if (!summaryEl) return;
            const { query } = StateModule.getActiveTab();
            const parts = [];
            if (query.keyword) {
                parts.push(`<div class="summary-item"><span class="label">關鍵字:</span> <span class="value">${UtilsModule.escapeHtml(query.keyword)}</span></div>`);
            }
            if (query.masterStatus.size > 0) {
                const text = Array.from(query.masterStatus).map(s => ConfigModule.MASTER_STATUS_TEXT[s] || s).join(', ');
                parts.push(`<div class="summary-item"><span class="label">主約狀態:</span> <span class="value">${UtilsModule.escapeHtml(text)}</span></div>`);
            }
            if (query.channels.size > 0) {
                parts.push(`<div class="summary-item"><span class="label">通路:</span> <span class="value">${UtilsModule.escapeHtml(Array.from(query.channels).join(', '))}</span></div>`);
            }
            if (query.channelStatus.size > 0) {
                 const text = Array.from(query.channelStatus).map(s => ConfigModule.MASTER_STATUS_TEXT[s] || s).join(', ');
                parts.push(`<div class="summary-item"><span class="label">通路狀態:</span> <span class="value">${UtilsModule.escapeHtml(text)}</span></div>`);
            }
            if (parts.length > 0) {
                summaryEl.innerHTML = `<strong>查詢條件：</strong> ${parts.join('')}`;
                summaryEl.style.display = 'block';
            } else {
                summaryEl.innerHTML = '<strong>查詢條件：</strong> 無 (顯示全部資料)';
                summaryEl.style.display = 'block';
            }
        };
        const generateTabTooltipText = (query) => {
            const parts = [];
            if (query.keyword) parts.push(`關鍵字: ${query.keyword}`);
            if (query.masterStatus.size > 0) parts.push(`主約狀態: ${Array.from(query.masterStatus).map(s => ConfigModule.MASTER_STATUS_TEXT[s] || s).join(', ')}`);
            if (query.channels.size > 0) parts.push(`通路: ${Array.from(query.channels).join(', ')}`);
            if (query.channelStatus.size > 0) parts.push(`通路狀態: ${Array.from(query.channelStatus).map(s => ConfigModule.MASTER_STATUS_TEXT[s] || s).join(', ')}`);
            if (parts.length === 0) return "無特定查詢條件";
            return parts.join(' | ');
        };
        const handleCollapseToggle = () => {
            const currentState = StateModule.getGlobal('windowState');
            StateModule.setGlobal({ windowState: currentState === 'collapsed' ? 'normal' : 'collapsed' });
            UIModule.Modal.render();
        };
        const handleMinimizeToggle = () => {
            const currentState = StateModule.getGlobal('windowState');
            StateModule.setGlobal({ windowState: currentState === 'minimized' ? 'normal' : 'minimized' });
            if (currentState === 'minimized') {
                 document.getElementById('pct-minimized-widget')?.classList.add('hiding');
                 setTimeout(() => {
                    document.getElementById('pct-minimized-widget')?.remove();
                    UIModule.Modal.render();
                 }, 300);
            } else {
                 UIModule.Modal.render();
            }
        };
        const renderTimestamp = () => {
            const timeEl = document.getElementById('pct-db-update-time');
            if(timeEl) {
                const time = StateModule.getGlobal('lastDbUpdateTime');
                timeEl.textContent = time ? `資料更新: ${UtilsModule.formatDateTime(time)}` : '';
            }
        };

        return { 
            initialize, cleanupAndClose, showTokenDialog, handleAddNewTab, handleSwitchTab, handleCloseTab,
            handleQuerySelection, handleStartQuery, handleBackToQuery, rerenderTable,
            handleResultSearch, handleClearResultSearch, handleNameToggle, handleViewToggle, handleToggleView,
            changePage, handleTableClick, handleCopyAll, handlePreviewAll, handleForceUpdate, generateTabTooltipText,
            handleCollapseToggle, handleMinimizeToggle, renderTimestamp
        };
    })();

    document.querySelectorAll(`#${ConfigModule.TOOL_ID}, #${ConfigModule.STYLE_ID}, .pct-toast, #pctModalMask, #pct-minimized-widget`).forEach(el => el.remove());
    ControllerModule.initialize();
})();
