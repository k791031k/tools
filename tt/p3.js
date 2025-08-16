javascript: (function() {
    'use strict';

    /**
     * =================================================================================
     * KGI Plan Code Query Tool v4.0.0 (Final Version with Token Input)
     * =================================================================================
     * 此版本根據使用者回饋，將 Token 處理流程恢復為可手動輸入，並維持所有優化功能。
     * - 啟動：彈出 Token 檢核視窗，可自動偵測或手動輸入。
     * - 流程：Token 成功後，單一查詢介面動態顯示結果。
     * - 修正：優化了 Token 偵測邏輯，提高自動偵測的成功率。
     * - 功能：保留所有篩選、排序、分頁和資料處理功能。
     */

    /**
     * @module ConfigModule
     * @description
     * 儲存所有應用程式的靜態設定、常數和配置。
     * 使用 Object.freeze 確保物件不可變動。
     */
    const ConfigModule = Object.freeze({
        // 核心 UI 識別符
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '4.0.0',

        // 查詢模式類型
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            MASTER_CLASSIFIED: 'masterClassified',
            CHANNEL_CLASSIFIED: 'channelClassified',
        },

        // 結果頁面的篩選器配置
        RESULTS_PAGE_FILTERS: [{
                key: 'mainStatus',
                label: '主檔狀態',
                type: 'standard',
                filterType: 'select'
            },
            {
                key: 'currency',
                label: '幣別',
                type: 'standard',
                filterType: 'select'
            },
            {
                key: 'unit',
                label: '單位',
                type: 'standard',
                filterType: 'select'
            },
            {
                key: 'coverageType',
                label: '型態',
                type: 'standard',
                filterType: 'select'
            },
            {
                key: 'policyType',
                rawKey: 'cnttype',
                label: '保單類型',
                type: 'advanced',
                filterType: 'select'
            },
            {
                key: 'category',
                rawKey: 'accumulationType',
                label: '分類類別',
                type: 'advanced',
                filterType: 'select'
            },
            {
                key: 'hasFuneralExpenses',
                rawKey: 'burialAmountFlag',
                label: '喪葬費用',
                type: 'advanced',
                filterType: 'select'
            },
            {
                key: 'noRiderAttachable',
                rawKey: 'noCoverageFlag',
                label: '附加附約',
                type: 'advanced',
                filterType: 'select'
            },
            {
                key: 'isSinglePremium',
                rawKey: 'singlePaymentFlag',
                label: '躉繳',
                type: 'advanced',
                filterType: 'select'
            }
        ],

        // 銷售狀態的內部代碼與顯示文字
        MASTER_STATUS_TYPES: {
            CURRENTLY_SOLD: 'currently sold',
            DISCONTINUING_SOON: 'discontinuing soon',
            DISCONTINUED: 'discontinued',
            ABNORMAL_DATE: 'abnormal date',
            COMING_SOON: 'coming soon',
        },
        MASTER_STATUS_TEXT: {
            'currently sold': '銷售中',
            'discontinuing soon': '即將停售',
            'discontinued': '已停售',
            'abnormal date': '日期異常',
            'coming soon': '尚未開賣',
            'not sold': '未銷售',
        },
        MASTER_STATUS_FILTER_OPTIONS: {
            'coming soon': '尚未開賣',
            'currently sold': '銷售中',
            'discontinuing soon': '即將停售',
            'discontinued': '已停售',
            'abnormal date': '日期異常',
        },
        CHANNEL_STATUS_FILTER_OPTIONS: {
            'currently sold': '銷售中',
            'discontinued': '已停售',
            'coming soon': '尚未開賣',
            'abnormal date': '日期異常',
            'not sold': '未銷售',
        },
        STATUS_ORDER: {
            'coming soon': 1,
            'discontinuing soon': 2,
            'currently sold': 3,
            'discontinued': 4,
            'abnormal date': 5,
            'not sold': 6,
        },

        // API 端點
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api',
        },

        // 資料欄位代碼對應表
        FIELD_MAPS: {
            CURRENCY: {
                '1': 'TWD',
                '2': 'USD',
                '3': 'AUD',
                '4': 'CNT',
                '5': 'USD_OIU',
                '6': 'EUR',
                '7': 'JPY'
            },
            UNIT: {
                'A1': '元',
                'A3': '仟元',
                'A4': '萬元',
                'B1': '計畫',
                'C1': '單位'
            },
            COVERAGE_TYPE: {
                'M': '主約',
                'R': '附約'
            },
            CHANNELS: ['AG', 'BR', 'BK', 'WS', 'EC'],
        },

        // 預設參數
        DEFAULT_QUERY_PARAMS: {
            PAGE_SIZE_MASTER: 10000,
            PAGE_SIZE_CHANNEL: 10000,
            PAGE_SIZE_TABLE: 50,
        },

        // 延遲設定
        DEBOUNCE_DELAY: {
            SEARCH: 300
        },
    });

    /**
     * @module StateModule
     * @description
     * 管理應用程式的所有動態狀態。
     * 採用閉包模式，確保狀態的私有性。
     */
    const StateModule = (() => {
        // 私有狀態物件
        const state = {
            env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
            apiBase: '',
            token: null,
            queryMode: ConfigModule.QUERY_MODES.MASTER_CLASSIFIED,
            queryInput: '',
            masterStatusSelection: new Set(),
            channelStatusSelection: new Set(),
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
            modalPosition: {
                top: null,
                left: null
            },
        };
        state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;

        /**
         * 取得當前狀態的副本。
         * @returns {object} 當前狀態物件。
         */
        const get = () => ({
            ...state
        });

        /**
         * 更新狀態。
         * @param {object} newState - 包含要更新的鍵值對的物件。
         */
        const set = (newState) => {
            Object.assign(state, newState);
        };

        /**
         * 重設結果頁面的相關狀態。
         */
        const resetResultState = () => set({
            pageNo: 1,
            searchKeyword: '',
            isFullView: false,
            showPlanName: false,
            sortKey: 'no',
            sortAsc: true,
            activeFilters: {},
            filterOptions: {},
            advancedFilters: {},
            isFilterVisible: true
        });

        /**
         * 重設查詢條件頁面的相關狀態。
         */
        const resetQueryConditions = () => set({
            queryMode: ConfigModule.QUERY_MODES.MASTER_CLASSIFIED,
            queryInput: '',
            masterStatusSelection: new Set(),
            channelStatusSelection: new Set(),
            channelSelection: new Set(),
        });

        /**
         * 清除所有快取資料。
         */
        const clearAllCaches = () => set({
            masterDataCache: null,
            channelDataCache: null,
            mergedDataCache: null,
            polplnDataCache: new Map(),
            rawPolplnDataCache: new Map(),
            lastDbUpdateTime: ''
        });

        return {
            get,
            set,
            resetResultState,
            resetQueryConditions,
            clearAllCaches
        };
    })();

    /**
     * @module UtilsModule
     * @description
     * 提供各種輔助工具函式，不涉及應用程式的核心邏輯。
     */
    const UtilsModule = (() => {
        /**
         * 轉義 HTML 特殊字元，防止 XSS 攻擊。
         * @param {string} str - 待轉義的字串。
         * @returns {string} 已轉義的字串。
         */
        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            if (typeof str !== 'string') str = String(str);
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return str.replace(/[&<>"']/g, m => map[m]);
        };

        /**
         * 取得今天的日期字串 (YYYYMMDD)。
         * @returns {string} 今天的日期字串。
         */
        const formatToday = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

        /**
         * 將日期字串格式化為 YYYYMMDD。
         * @param {string|Date} dt - 待格式化的日期。
         * @returns {string} 格式化後的日期字串。
         */
        const formatDateForUI = (dt) => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');

        /**
         * 將 ISO 日期時間字串格式化為 YYYY-MM-DD HH:mm。
         * @param {string} isoString - ISO 格式的日期時間字串。
         * @returns {string} 格式化後的日期時間字串。
         */
        const formatDateTime = (isoString) => {
            if (!isoString) return '';
            try {
                const date = new Date(isoString);
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            } catch (e) {
                return isoString;
            }
        };

        /**
         * 解析 YYYYMMDD 格式的日期字串為 Date 物件。
         * @param {string} dateStr - YYYYMMDD 格式的日期字串。
         * @returns {Date|null} 解析後的 Date 物件，或無效時返回 null。
         */
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

        /**
         * 根據銷售起迄日判斷主檔銷售狀態。
         * @param {string} todayStr - 今日日期字串 (YYYYMMDD)。
         * @param {string} saleStartStr - 銷售起日字串 (YYYYMMDD)。
         * @param {string} saleEndStr - 銷售迄日字串 (YYYYMMDD)。
         * @returns {string} 銷售狀態代碼。
         */
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
            if (saleEndStr !== '99991231' && daysUntilEnd <= 45) {
                return STATUS.DISCONTINUING_SOON;
            }

            return STATUS.CURRENTLY_SOLD;
        };

        /**
         * 根據主檔和通路銷售起迄日判斷通路銷售狀態。
         * @param {string} masterStart - 主檔銷售起日。
         * @param {string} masterEnd - 主檔銷售迄日。
         * @param {string} channelStart - 通路銷售起日。
         * @param {string} channelEnd - 通路銷售迄日。
         * @param {string} today - 今日日期。
         * @returns {string} 通路銷售狀態代碼。
         */
        const getChannelSaleStatus = (masterStart, masterEnd, channelStart, channelEnd, today) => {
            const STATUS = ConfigModule.MASTER_STATUS_TYPES;
            // 修正邏輯：如果通路銷售起迄日為空，則直接返回未銷售
            if (!channelStart || !channelEnd) return 'not sold';
            // 如果主檔日期有問題，則通路也視為日期異常
            if (!masterStart || !masterEnd) return STATUS.ABNORMAL_DATE;

            const mS = parseDateString(masterStart),
                mE = parseDateString(masterEnd),
                cS = parseDateString(channelStart),
                cE = parseDateString(channelEnd),
                t = parseDateString(today);

            if (!mS || !mE || !cS || !cE || !t) return STATUS.ABNORMAL_DATE;
            // 額外判斷：通路日期範圍必須在主檔日期範圍內
            if (cS > cE || cS < mS || cE > mE) return STATUS.ABNORMAL_DATE;

            if (t < cS) return STATUS.COMING_SOON;
            if (t > cE) return STATUS.DISCONTINUED;
            return STATUS.CURRENTLY_SOLD;
        };

        /**
         * 將代碼轉換為對應的文字。
         * @param {string|number} v - 代碼值。
         * @param {object} map - 代碼對應表。
         * @returns {string} 轉換後的文字或原代碼。
         */
        const convertCodeToText = (v, map) => map[String(v)] || v || '';

        /**
         * 複製文字到剪貼簿。
         * @param {string} text - 欲複製的文字。
         * @param {function} showToast - 顯示提示訊息的函式。
         */
        const copyTextToClipboard = (text, showToast) => {
            navigator.clipboard.writeText(text).then(() => showToast('複製成功', 'success')).catch(() => showToast('複製失敗', 'error'));
        };

        /**
         * 將輸入的字串依分隔符號拆分為陣列。
         * @param {string} input - 輸入的字串。
         * @returns {string[]} 處理後的字串陣列。
         */
        const splitInput = (input) => input.trim().split(/[\s,;，；\n\r]+/).filter(Boolean);

        /**
         * 將全形字元轉換為半形大寫。
         * @param {string} str - 待轉換的字串。
         * @returns {string} 轉換後的字串。
         */
        const toHalfWidthUpperCase = (str) => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();

        /**
         * 搜尋瀏覽器儲存中的 Token。
         * @returns {string|null} 找到的 Token，否則為 null。
         */
        const findStoredToken = () => {
            // 優先檢查 localStorage 和 sessionStorage
            const sessionToken = sessionStorage.getItem('SSO-TOKEN') || sessionStorage.getItem('euisToken') || sessionStorage.getItem('EAP-TOKEN');
            if (sessionToken && sessionToken.trim()) return sessionToken.trim();
            
            const localToken = localStorage.getItem('SSO-TOKEN') || localStorage.getItem('euisToken') || localStorage.getItem('EAP-TOKEN');
            if (localToken && localToken.trim()) return localToken.trim();
            
            // 次要檢查 Cookies
            const cookies = document.cookie.split(';').map(c => c.trim());
            for (const cookie of cookies) {
                if (cookie.startsWith('eap_token=') || cookie.startsWith('SSO-TOKEN=') || cookie.startsWith('euisToken=')) {
                    const token = decodeURIComponent(cookie.substring(cookie.indexOf('=') + 1));
                    if (token.trim()) return token.trim();
                }
            }

            // 最後檢查網址參數
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token') || urlParams.get('sso-token');
            if (urlToken && urlToken.trim()) return urlToken.trim();
            
            return null;
        };

        return {
            escapeHtml,
            formatToday,
            formatDateForUI,
            formatDateTime,
            parseDateString,
            getMasterSaleStatus,
            getChannelSaleStatus,
            convertCodeToText,
            copyTextToClipboard,
            splitInput,
            toHalfWidthUpperCase,
            findStoredToken,
        };
    })();

    /**
     * @module UIModule
     * @description
     * 處理所有與使用者介面渲染和互動相關的邏輯。
     */
    const UIModule = (() => {
        /**
         * 注入 CSS 樣式到頁面。
         */
        const injectStyle = () => {
            if (document.getElementById(ConfigModule.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = ConfigModule.STYLE_ID;
            const filterColumnCount = ConfigModule.RESULTS_PAGE_FILTERS.length;
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
.pct-modal[data-size="query"] .pct-modal-body { height: 450px; }
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
.pct-query-controls { padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 12px; }
.pct-query-controls h4 { margin: 0 0 10px 0; font-size: 16px; color: #333; }
.pct-query-row { display: flex; flex-wrap: wrap; gap: 15px; align-items: center; margin-bottom: 8px; }
.pct-query-group { display: flex; align-items: center; gap: 8px; }
.pct-query-group label { font-weight: bold; color: #555; }
.pct-query-input { padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px; min-width: 200px; }
.pct-checkbox-group { display: flex; gap: 12px; flex-wrap: wrap; }
.pct-checkbox-item { display: flex; align-items: center; gap: 4px; font-size: 14px; }
.pct-radio-group { display: flex; gap: 15px; }
.pct-radio-item { display: flex; align-items: center; gap: 4px; font-size: 14px; }
.pct-query-buttons { display: flex; gap: 10px; }
.pct-table-wrap { flex: 1; overflow: auto; border: 1px solid #E0E0E0; border-radius: 6px; }
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
#pct-all-filters-container { display: grid; grid-template-columns: repeat(${filterColumnCount}, 1fr) auto; gap: 5px 10px; align-items: center; transition: all 0.3s ease-in-out; }
#pct-all-filters-container.collapsed { display: none; }
.pct-filter-label { font-size: 13px; font-weight: bold; text-align: center; grid-row: 1; }
.pct-filter-control { grid-row: 2; }
.pct-filter-control .pct-input, .pct-filter-control select { font-size: 13px; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; width: 100%; box-sizing: border-box; }
#pct-db-update-time-header { font-size: 12px; color: #666; font-weight: normal; margin-left: auto; padding-right: 15px; }
#pct-toggle-filters-btn { font-size: 12px; padding: 2px 8px; }
#pct-table-view-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
`;
            document.head.appendChild(style);
        };

        /**
         * 處理頁面提示訊息 (Toast)。
         */
        const Toast = {
            /**
             * 顯示 Toast 訊息。
             * @param {string} msg - 訊息內容。
             * @param {string} [type='info'] - 訊息類型 ('success', 'error', 'warning', 'info')。
             * @param {number} [duration=3000] - 顯示持續時間 (毫秒)。
             */
            show: (msg, type = 'info', duration = 3000) => {
                document.querySelector('.pct-toast')?.remove();
                const toastEl = document.createElement('div');
                toastEl.className = `pct-toast ${type}`;
                toastEl.textContent = msg;
                document.body.appendChild(toastEl);
                requestAnimationFrame(() => toastEl.classList.add('show'));
                if (duration > 0) setTimeout(() => {
                    toastEl.classList.remove('show');
                    toastEl.addEventListener('transitionend', () => toastEl.remove(), {
                        once: true
                    });
                }, duration);
            }
        };

        /**
         * 處理模態框的顯示與隱藏。
         */
        const Modal = {
            /**
             * 關閉模態框。
             */
            close: () => {
                const modal = document.getElementById(ConfigModule.TOOL_ID);
                if (modal) {
                    const {
                        top,
                        left
                    } = modal.style;
                    StateModule.set({
                        modalPosition: {
                            top,
                            left
                        }
                    });
                }
                StateModule.get().currentQueryController?.abort();
                modal?.remove();
                document.getElementById('pctModalMask')?.remove();
            },
            /**
             * 顯示模態框。
             * @param {string} html - 模態框的 HTML 內容。
             * @param {function} onOpen - 模態框打開後執行的回呼函式。
             * @param {string} size - 模態框的尺寸 ('query' 或 'results')。
             */
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

        /**
         * 處理進度條的顯示與更新。
         */
        const Progress = {
            /**
             * 顯示進度條。
             * @param {string} text - 進度條旁邊的文字。
             */
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
            /**
             * 更新進度條。
             * @param {number} percentage - 進度百分比 (0-100)。
             * @param {string} text - 進度條旁邊的新文字。
             */
            update: (percentage, text) => {
                const bar = document.getElementById('pct-progress-bar');
                if (bar) bar.style.width = `${percentage}%`;
                const textEl = document.querySelector('#pct-progress-container .pct-progress-text');
                if (textEl && text) textEl.textContent = text;
            },
            /**
             * 隱藏進度條。
             */
            hide: () => {
                document.getElementById('pct-progress-container')?.remove();
            }
        };

        return {
            injectStyle,
            Toast,
            Modal,
            Progress
        };
    })();

    /**
     * @module EventModule
     * @description
     * 集中管理所有使用者事件的監聽器與處理函式。
     */
    const EventModule = (() => {
        // 模態框拖曳狀態
        const dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            initialLeft: 0,
            initialTop: 0
        };

        /**
         * 處理滑鼠按下事件，啟動模態框拖曳。
         * @param {Event} e - 滑鼠事件物件。
         */
        const dragMouseDown = (e) => {
            const modal = document.getElementById(ConfigModule.TOOL_ID);
            if (!modal || e.target.closest('.pct-close-btn-custom')) return;

            e.preventDefault();
            dragState.isDragging = true;
            modal.classList.add('dragging');
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            dragState.initialLeft = rect.left;
            dragState.initialTop = rect.top;

            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement, {
                once: true
            });
        };

        /**
         * 處理滑鼠移動事件，執行模態框拖曳。
         * @param {Event} e - 滑鼠事件物件。
         */
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

        /**
         * 處理滑鼠放開事件，停止模態框拖曳。
         */
        const closeDragElement = () => {
            dragState.isDragging = false;
            document.getElementById(ConfigModule.TOOL_ID)?.classList.remove('dragging');
            document.removeEventListener('mousemove', elementDrag);
        };

        /**
         * 處理鍵盤 Esc 鍵，關閉模態框。
         * @param {Event} e - 鍵盤事件物件。
         */
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                ControllerModule.cleanupAndClose();
            }
        };

        /**
         * 設定全域鍵盤事件監聽器。
         */
        const setupGlobalKeyListener = () => {
            document.removeEventListener('keydown', handleEscKey);
            document.addEventListener('keydown', handleEscKey);
        };

        /**
         * 自動格式化輸入框內容為半形大寫。
         * @param {Event} event - 輸入事件物件。
         */
        const autoFormatInput = (event) => {
            const input = event.target;
            const {
                value,
                selectionStart,
                selectionEnd
            } = input;
            input.value = UtilsModule.toHalfWidthUpperCase(value);
            input.setSelectionRange(selectionStart, selectionEnd);
        };

        return {
            dragMouseDown,
            setupGlobalKeyListener,
            autoFormatInput,
            handleEscKey
        };
    })();

    /**
     * @module ApiModule
     * @description
     * 處理所有與後端 API 相關的資料請求。
     */
    const ApiModule = (() => {
        /**
         * 呼叫後端 API 的通用函式。
         * @param {string} endpoint - API 端點路徑。
         * @param {object} params - 請求參數。
         * @param {AbortSignal} signal - 用於取消請求的信號。
         * @returns {Promise<object>} 請求結果的 JSON 物件。
         */
        const callApi = async (endpoint, params, signal) => {
            const state = StateModule.get();
            const token = state.token;
            if (!token) throw new Error('API Token 不存在，請重新檢核。');

            const headers = {
                'Content-Type': 'application/json',
                'SSO-TOKEN': token
            };

            const response = await fetch(`${state.apiBase}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(params),
                signal,
            });

            if (!response.ok) {
                let errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    errorText = errorJson.message || errorJson.error || errorText;
                } catch (e) {}
                throw new Error(`API 錯誤: ${response.status} ${errorText}`);
            }
            return response.json();
        };

        /**
         * 取得主檔資料。
         * @param {AbortSignal} signal - 取消信號。
         * @returns {Promise<Array>} 主檔資料陣列。
         */
        const fetchMasterData = async (signal) => {
            const res = await callApi('/planCodeController/query', {
                currentPage: 1,
                pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER
            }, signal);
            if (res.records) {
                StateModule.set({
                    lastDbUpdateTime: res.updateTime || new Date().toISOString()
                });
            }
            return res.records || [];
        };

        /**
         * 取得通路資料。
         * @param {AbortSignal} signal - 取消信號。
         * @returns {Promise<Array>} 通路資料陣列。
         */
        const fetchChannelData = async (signal) => {
            const res = await callApi('/planCodeSaleDateController/query', {
                pageIndex: 1,
                size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL
            }, signal);
            return (res.planCodeSaleDates?.records || []).map(r => ({
                ...r,
                channel: r.channel === 'OT' ? 'BK' : r.channel
            }));
        };

        /**
         * 根據險種代號取得 POLPLN 資訊。
         * @param {string} planCode - 險種代號。
         * @param {AbortSignal} signal - 取消信號。
         * @returns {Promise<Array>} POLPLN 資料陣列。
         */
        const fetchPolplnForCode = async (planCode, signal) => {
            const res = await callApi('/planCodeController/queryDetail', {
                planCode,
                currentPage: 1,
                pageSize: 50
            }, signal);
            return res.records || [];
        };

        return {
            fetchMasterData,
            fetchChannelData,
            fetchPolplnForCode
        };
    })();

    /**
     * @module DataModule
     * @description
     * 處理資料的快取、合併和篩選邏輯。
     */
    const DataModule = (() => {
        /**
         * 初始化並快取主檔和通路資料。
         * @param {AbortSignal} signal - 取消信號。
         */
        const initializeCaches = async (signal) => {
            const {
                masterDataCache,
                channelDataCache
            } = StateModule.get();
            const tasks = [];
            if (!masterDataCache) tasks.push(ApiModule.fetchMasterData(signal).then(data => StateModule.set({
                masterDataCache: data
            })));
            if (!channelDataCache) tasks.push(ApiModule.fetchChannelData(signal).then(data => StateModule.set({
                channelDataCache: data
            })));

            if (tasks.length > 0) {
                UIModule.Progress.show('首次載入基礎資料中，請稍候...');
                UIModule.Progress.update(10, '正在取得資料庫資料...');
                await Promise.all(tasks);
                UIModule.Progress.update(50, '資料載入完成，正在處理合併...');
                mergeData();
            }
        };

        /**
         * 合併主檔和通路資料。
         */
        const mergeData = () => {
            const {
                masterDataCache,
                channelDataCache
            } = StateModule.get();
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
                    fixedChannelStatuses[channelName] = {
                        status,
                        saleStartDate: channelSaleStart,
                        saleEndDate: channelSaleEnd
                    };
                });

                const processedChannels = channelsRaw.map(c => {
                    const channelSaleStart = UtilsModule.formatDateForUI(c.saleStartDate);
                    const channelSaleEnd = UtilsModule.formatDateForUI(c.saleEndDate);
                    return {
                        channel: c.channel,
                        status: UtilsModule.getChannelSaleStatus(masterSaleStart, masterSaleEnd, channelSaleStart, channelSaleEnd, today),
                        saleStartDate: channelSaleStart,
                        saleEndDate: channelSaleEnd
                    };
                });

                return {
                    planCode,
                    fullName: rawMasterItem.planCodeName || rawMasterItem.shortName || '-',
                    displayName: rawMasterItem.shortName || rawMasterItem.planCodeName || '-',
                    currency: UtilsModule.convertCodeToText(rawMasterItem.currency || rawMasterItem.cur, ConfigModule.FIELD_MAPS.CURRENCY),
                    unit: UtilsModule.convertCodeToText(rawMasterItem.reportInsuranceAmountUnit || rawMasterItem.insuranceAmountUnit, ConfigModule.FIELD_MAPS.UNIT),
                    coverageType: UtilsModule.convertCodeToText(rawMasterItem.coverageType || rawMasterItem.type, ConfigModule.FIELD_MAPS.COVERAGE_TYPE),
                    saleStartDate: masterSaleStart,
                    saleEndDate: masterSaleEnd,
                    mainStatus: UtilsModule.getMasterSaleStatus(today, masterSaleStart, masterSaleEnd),
                    channels: processedChannels,
                    fixedChannelStatuses,
                    _raw: {
                        master: rawMasterItem,
                        channels: channelsRaw
                    }
                };
            });
            StateModule.set({
                mergedDataCache: mergedData
            });
        };

        /**
         * 根據初始查詢條件篩選資料。
         * @returns {Array} 篩選後的資料陣列。
         */
        const getInitialData = () => {
            const {
                mergedDataCache,
                queryMode,
                queryInput,
                masterStatusSelection,
                channelSelection,
                channelStatusSelection
            } = StateModule.get();
            if (!mergedDataCache) return [];

            let data = [...mergedDataCache];

            const formattedInput = UtilsModule.toHalfWidthUpperCase(queryInput);

            switch (queryMode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE:
                    const codesToSearch = UtilsModule.splitInput(formattedInput);
                    if (codesToSearch.length > 0) data = data.filter(item => codesToSearch.some(code => item.planCode.includes(code)));
                    break;

                case ConfigModule.QUERY_MODES.PLAN_NAME:
                    const nameKeyword = formattedInput.toLowerCase();
                    data = data.filter(item => item.displayName.toLowerCase().includes(nameKeyword) || item.fullName.toLowerCase().includes(nameKeyword));
                    break;

                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                    if (masterStatusSelection.size > 0) {
                        data = data.filter(item => masterStatusSelection.has(item.mainStatus));
                    }
                    break;

                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                    if (channelSelection.size > 0 && channelStatusSelection.size > 0) {
                        data = data.filter(item => {
                            return Array.from(channelSelection).some(selectedChannel => {
                                const channelStatus = item.fixedChannelStatuses[selectedChannel]?.status;
                                return channelStatusSelection.has(channelStatus);
                            });
                        });
                    }
                    break;
            }
            return data;
        };

        /**
         * 根據結果頁面的篩選器和排序條件進一步處理資料。
         * @param {Array} baseData - 初始資料陣列。
         * @returns {Array} 最終篩選和排序後的資料陣列。
         */
        const getFilteredData = (baseData) => {
            let data = baseData;
            if (!data) return [];

            const {
                searchKeyword,
                sortKey,
                sortAsc,
                activeFilters,
                advancedFilters
            } = StateModule.get();
            const allFilterConfigs = ConfigModule.RESULTS_PAGE_FILTERS;

            const activeFilterKeys = Object.keys(activeFilters).filter(k => activeFilters[k]);
            const advancedFilterKeys = Object.keys(advancedFilters).filter(k => advancedFilters[k]);

            if (activeFilterKeys.length > 0 || advancedFilterKeys.length > 0) {
                data = data.filter(item => {
                    const standardMatch = activeFilterKeys.every(key => {
                        const filterValue = activeFilters[key];
                        return (key === 'mainStatus') ?
                            ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] === filterValue :
                            String(item[key]) === filterValue;
                    });
                    if (!standardMatch) return false;

                    const advancedMatch = advancedFilterKeys.every(key => {
                        const filterConfig = allFilterConfigs.find(f => f.key === key);
                        const rawValue = item._raw?.master?.[filterConfig.rawKey];
                        const filterValue = advancedFilters[key];
                        return (filterConfig.filterType === 'text') ?
                            String(rawValue || '').toLowerCase().includes(filterValue.toLowerCase()) :
                            String(rawValue ?? '') === filterValue;
                    });
                    return advancedMatch;
                });
            }

            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                data = data.filter(item => {
                    const searchableItem = {
                        ...item
                    };
                    delete searchableItem._raw;
                    delete searchableItem.fixedChannelStatuses;
                    return Object.values(searchableItem).some(value => String(value ?? '').toLowerCase().includes(keyword));
                });
            }

            if (sortKey && sortKey !== 'no') {
                data = [...data].sort((a, b) => {
                    let valA, valB;
                    if (ConfigModule.FIELD_MAPS.CHANNELS.includes(sortKey)) {
                        valA = a.fixedChannelStatuses[sortKey]?.status || '';
                        valB = b.fixedChannelStatuses[sortKey]?.status || '';
                    } else {
                        valA = a[sortKey];
                        valB = b[sortKey];
                    }

                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });
            }

            return data.map((item, index) => ({
                ...item,
                no: index + 1
            }));
        };

        return {
            initializeCaches,
            getInitialData,
            getFilteredData
        };
    })();

    /**
     * @module ControllerModule
     * @description
     * 負責協調所有模組，處理應用程式的流程控制。
     */
    const ControllerModule = (() => {
        let initialQueryData = [];

        /**
         * 清理所有快取並關閉工具。
         */
        const cleanupAndClose = () => {
            console.log(`[PlanCodeTool] Cleaning all caches and closing tool v${ConfigModule.VERSION}.`);
            StateModule.clearAllCaches();
            initialQueryData = [];
            UIModule.Modal.close();
            document.removeEventListener('keydown', EventModule.handleEscKey);
        };

        /**
         * 初始化工具。
         */
        const initialize = async () => {
            console.log(`[PlanCodeTool] Initializing v${ConfigModule.VERSION}...`);
            UIModule.injectStyle();
            EventModule.setupGlobalKeyListener();

            const storedToken = UtilsModule.findStoredToken();
            if (storedToken) {
                StateModule.set({ token: storedToken });
                await loadDataAndShowQueryUI();
            } else {
                showTokenDialog();
            }
        };

        /**
         * 載入資料並顯示查詢 UI。
         */
        const loadDataAndShowQueryUI = async () => {
            try {
                const controller = new AbortController();
                StateModule.set({ currentQueryController: controller });
                await DataModule.initializeCaches(controller.signal);
                StateModule.set({ currentQueryController: null });
                
                showQueryDialog();
                UIModule.Progress.hide();

            } catch (err) {
                UIModule.Progress.hide();
                if (err.name !== 'AbortError') {
                    showErrorDialog('資料載入失敗，請確認 Token 有效或網路連線正常。');
                }
            }
        };

        /**
         * 顯示 Token 檢核對話框。
         * @param {string} [initialMsg=''] - 初始訊息，通常用於錯誤提示。
         */
        const showTokenDialog = (initialMsg = '') => {
            const { env } = StateModule.get();
            const html = `
                <div class="pct-modal-header">
                    <div class="pct-modal-header-title">Token 檢核 (${env})</div>
                    <button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button>
                </div>
                <div class="pct-modal-body" style="text-align: center;">
                    ${initialMsg ? `<p style="color: var(--error-color);">${UtilsModule.escapeHtml(initialMsg)}</p>` : `<p style="color: var(--info-color);">請先確認您的登入狀態。</p>`}
                    <div style="margin-top: 15px; text-align: left;">
                        <label for="pct-token-input">API Token (非必填，若未填將自動偵測)</label>
                        <textarea id="pct-token-input" class="pct-input" rows="2" placeholder="請從開發者工具中複製 SSO-TOKEN..."></textarea>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div style="display:flex; flex:1;">
                        <button id="pct-retry-token" class="pct-btn pct-btn-outline" style="margin-right: auto;">重新檢核</button>
                    </div>
                    <button id="pct-start-with-token" class="pct-btn">載入資料</button>
                </div>`;
            UIModule.Modal.show(html, (modal) => {
                const tokenInput = modal.querySelector('#pct-token-input');
                const startBtn = modal.querySelector('#pct-start-with-token');
                const retryBtn = modal.querySelector('#pct-retry-token');

                retryBtn.addEventListener('click', async () => {
                    const foundToken = UtilsModule.findStoredToken();
                    if (foundToken) {
                        UIModule.Toast.show('已找到 Token，正在重新載入資料...', 'success');
                        StateModule.set({ token: foundToken });
                        await loadDataAndShowQueryUI();
                    } else {
                        UIModule.Toast.show('自動檢核失敗，請手動輸入 Token。', 'error');
                        tokenInput.focus();
                    }
                });
                
                startBtn.addEventListener('click', async () => {
                    const manualToken = tokenInput.value.trim();
                    if (manualToken) {
                        StateModule.set({ token: manualToken });
                        await loadDataAndShowQueryUI();
                    } else {
                        UIModule.Toast.show('請手動輸入 Token 或使用「重新檢核」按鈕。', 'warning');
                    }
                });

            }, 'query');
        };

        /**
         * 顯示查詢對話框。
         */
        const showQueryDialog = () => {
            const { env, lastDbUpdateTime } = StateModule.get();
            const formattedTime = UtilsModule.formatDateTime(lastDbUpdateTime);
            const html = `
                <div class="pct-modal-header">
                    <div class="pct-modal-header-title">商品查詢 (${env})</div>
                    <span id="pct-db-update-time-header">更新: ${formattedTime}</span>
                    <button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button>
                </div>
                <div class="pct-modal-body" style="display: flex; flex-direction: column;">
                    <div id="pct-query-container">
                        ${generateQueryControlsHtml()}
                    </div>
                    <div id="pct-table-result-container" style="display: none; flex-direction: column; height: 100%; gap: 10px;">
                        <div class="pct-result-top-controls">
                            <div class="pct-search-name-wrapper">
                                <div class="search-wrapper" style="position: relative;">
                                    <label for="pct-search-input" style="font-size: 14px; color: #666; margin-right: 5px;">結果內搜尋:</label>
                                    <input type="text" id="pct-search-input" placeholder="搜尋關鍵字...">
                                    <button id="pct-clear-search" title="清除搜尋">&times;</button>
                                </div>
                                <div style="display:flex; align-items:center; gap: 8px;">
                                    <span style="font-size: 13px; color: #555;">簡稱</span>
                                    <label class="pct-toggle-switch">
                                        <input type="checkbox" id="pct-name-toggle">
                                        <span class="pct-toggle-slider"></span>
                                    </label>
                                    <span style="font-size: 13px; color: #555;">全名</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span id="pct-result-count"></span>
                                <div class="pct-pagination" style="display: flex; align-items: center; gap: 5px;">
                                    <button id="pct-prev-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">←</button>
                                    <span id="pct-page-info" style="font-size: 14px; min-width: 50px; text-align: center;">-</span>
                                    <button id="pct-next-page" class="pct-btn pct-btn-outline" style="padding: 5px 10px;">→</button>
                                </div>
                            </div>
                        </div>
                        <div id="pct-table-view-wrapper">
                            <div id="pct-filters-wrapper"></div>
                            <div class="pct-table-wrap" id="pct-table-wrap">
                                <table class="pct-table"><tbody id="pct-table-body"></tbody></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button>
                    </div>
                    <div style="display:flex; gap: 10px;">
                        <button id="pct-force-update-results" class="pct-btn pct-btn-outline">更新</button>
                        <button id="pct-preview-all" class="pct-btn pct-btn-outline">預覽</button>
                        <button id="pct-copy-all" class="pct-btn pct-btn-outline">複製</button>
                        <button id="pct-run-query" class="pct-btn">查詢</button>
                    </div>
                </div>`;
            UIModule.Modal.show(html, setupQueryDialogListeners, 'results');
        };

        const generateQueryControlsHtml = () => {
            const state = StateModule.get();
            return `
                <div class="pct-query-controls">
                    <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:center; margin-bottom:8px;">
                        <div class="pct-query-group">
                            <label>險種代號/名稱：</label>
                            <input type="text" id="pct-keyword-input" class="pct-query-input" placeholder="輸入險種代號或名稱進行搜尋" value="${UtilsModule.escapeHtml(state.queryInput)}">
                        </div>
                        <div class="pct-query-group">
                            <label>銷售狀態：</label>
                            <div class="pct-checkbox-group">
                                ${Object.entries(ConfigModule.MASTER_STATUS_FILTER_OPTIONS).map(([key, text]) =>
                                    `<div class="pct-checkbox-item"><input type="checkbox" class="pct-status-checkbox" value="${key}" ${state.masterStatusSelection.has(key) ? 'checked' : ''}> ${text}</div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:center; margin-bottom:8px;">
                        <div class="pct-query-group">
                            <label>通路：</label>
                            <div class="pct-checkbox-group">
                                ${ConfigModule.FIELD_MAPS.CHANNELS.map(ch =>
                                    `<div class="pct-checkbox-item"><input type="checkbox" class="pct-channel-checkbox" value="${ch}" ${state.channelSelection.has(ch) ? 'checked' : ''}> ${ch}</div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:15px; align-items:center;">
                        <div class="pct-query-group">
                            <label>顯示模式：</label>
                            <div class="pct-radio-group">
                                <div class="pct-radio-item">
                                    <input type="radio" name="pct-view-mode" value="${ConfigModule.QUERY_MODES.MASTER_CLASSIFIED}" ${state.queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED ? 'checked' : ''}> 主檔格式
                                </div>
                                <div class="pct-radio-item">
                                    <input type="radio" name="pct-view-mode" value="${ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED}" ${state.queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED ? 'checked' : ''}> 通路視窗格式
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        };
        /**
         * 顯示錯誤對話框。
         * @param {string} message - 錯誤訊息。
         * @param {boolean} showRetry - 是否顯示重試按鈕。
         */
        const showErrorDialog = (message, showRetry = false) => {
            const html = `
                <div class="pct-modal-header">
                    <div class="pct-modal-header-title">錯誤訊息</div>
                    <button class="pct-close-btn-custom"><span>關閉</span><span>釋放記憶體</span></button>
                </div>
                <div class="pct-modal-body" style="text-align: center; padding: 20px;">
                    <h2 style="color: var(--error-color);">載入失敗</h2>
                    <p>${UtilsModule.escapeHtml(message)}</p>
                    ${showRetry ? `<button id="pct-retry-btn" class="pct-btn">重新檢核</button>` : ''}
                </div>
                <div class="pct-modal-footer"></div>
            `;
            UIModule.Modal.show(html, (modal) => {
                if (showRetry) {
                    document.getElementById('pct-retry-btn').addEventListener('click', () => {
                        cleanupAndClose();
                        setTimeout(() => initialize(), 100);
                    });
                }
            }, 'query');
        };
        /**
         * 設定查詢對話框的事件監聽器。
         * @param {HTMLElement} modal - 模態框 DOM 元素。
         */
        const setupQueryDialogListeners = (modal) => {
            // 搜尋框事件
            const searchInput = document.getElementById('pct-search-input');
            const runQueryBtn = document.getElementById('pct-run-query');
            const queryContainer = document.getElementById('pct-query-container');
            const resultContainer = document.getElementById('pct-table-result-container');

            runQueryBtn.addEventListener('click', () => {
                const queryInput = document.getElementById('pct-keyword-input').value.trim();
                const selectedStatuses = new Set(
                    Array.from(document.querySelectorAll('.pct-status-checkbox:checked')).map(cb => cb.value)
                );
                const selectedChannels = new Set(
                    Array.from(document.querySelectorAll('.pct-channel-checkbox:checked')).map(cb => cb.value)
                );
                const queryMode = document.querySelector('input[name="pct-view-mode"]:checked')?.value || ConfigModule.QUERY_MODES.MASTER_CLASSIFIED;

                StateModule.set({
                    queryInput,
                    masterStatusSelection: selectedStatuses,
                    channelStatusSelection: selectedStatuses,
                    channelSelection: selectedChannels,
                    queryMode,
                    pageNo: 1,
                    searchKeyword: '',
                    isFullView: false,
                    showPlanName: false,
                    sortKey: 'no',
                    sortAsc: true,
                    activeFilters: {},
                    advancedFilters: {},
                    isFilterVisible: true
                });

                initialQueryData = DataModule.getInitialData();
                rerenderTable();

                queryContainer.style.display = 'none';
                resultContainer.style.display = 'flex';
                modal.querySelector('.pct-modal-footer').style.justifyContent = 'flex-end';
            });

            // 初始狀態下不顯示結果區
            resultContainer.style.display = 'none';
            // 初始狀態下顯示查詢按鈕
            modal.querySelector('#pct-run-query').style.display = 'inline-flex';

            // 表格相關事件
            document.getElementById('pct-table-body')?.addEventListener('click', handleTableClick);
            modal.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => handleSortClick(th)));

            // 控制項事件
            document.getElementById('pct-name-toggle')?.addEventListener('change', (e) => {
                StateModule.set({
                    showPlanName: e.target.checked
                });
                rerenderTable();
            });
            document.getElementById('pct-toggle-view')?.addEventListener('click', handleToggleView);
            document.getElementById('pct-prev-page')?.addEventListener('click', () => changePage(-1));
            document.getElementById('pct-next-page')?.addEventListener('click', () => changePage(1));

            // 頁腳按鈕事件
            document.getElementById('pct-force-update-results')?.addEventListener('click', () => handleForceUpdate());
            document.getElementById('pct-preview-all')?.addEventListener('click', handlePreviewAll);
            document.getElementById('pct-copy-all')?.addEventListener('click', handleCopyAll);
            
            // 返回查詢按鈕
            const backToQueryBtn = document.getElementById('pct-back-to-query');
            if (backToQueryBtn) {
                backToQueryBtn.addEventListener('click', () => {
                    const queryContainer = document.getElementById('pct-query-container');
                    const resultContainer = document.getElementById('pct-table-result-container');
                    if (queryContainer && resultContainer) {
                        queryContainer.style.display = 'flex';
                        resultContainer.style.display = 'none';
                    }
                    // 恢復頁腳按鈕
                    modal.querySelector('.pct-modal-footer').style.justifyContent = 'space-between';
                    modal.querySelector('#pct-run-query').style.display = 'inline-flex';
                });
            }
        };

        /**
         * 根據當前查詢模式產生表格標頭 HTML。
         * @returns {string} 表格標頭 HTML。
         */
        const generateResultsTableHeader = () => {
            const {
                queryMode
            } = StateModule.get();
            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                const channelHeaders = ConfigModule.FIELD_MAPS.CHANNELS.map(ch => `<th data-key="${ch}">${ch}</th>`).join('');
                return `<thead><tr>
                    <th data-key="no" style="width: 4%;">No</th>
                    <th data-key="planCode" style="width: 7%;">代號</th>
                    <th data-key="displayName" style="width: 16%;">商品名稱</th>
                    <th data-key="currency" style="width: 5%;">幣別</th>
                    <th data-key="unit" style="width: 5%;">單位</th>
                    <th data-key="coverageType" style="width: 5%;">型態</th>
                    <th data-key="saleStartDate" style="width: 7%;">主檔銷售日</th>
                    <th data-key="saleEndDate" style="width: 7%;">主檔停售日</th>
                    <th data-key="mainStatus" style="width: 9%;">主檔狀態</th>
                    ${channelHeaders}
                </tr></thead>`;
            } else {
                return `<thead><tr>
                    <th data-key="no" style="width: 4%;">No</th>
                    <th data-key="planCode" style="width: 7%;">代號</th>
                    <th data-key="displayName" style="width: 27%;">商品名稱</th>
                    <th data-key="currency" style="width: 5%;">幣別</th>
                    <th data-key="unit" style="width: 5%;">單位</th>
                    <th data-key="coverageType" style="width: 6%;">型態</th>
                    <th data-key="saleStartDate" style="width: 8%;">主檔銷售日</th>
                    <th data-key="saleEndDate" style="width: 8%;">主檔停售日</th>
                    <th data-key="mainStatus" style="width: 9%;">主檔狀態</th>
                    <th data-key="polpln" style="width: 7%;">POLPLN</th>
                    <th data-key="channels" style="width: 14%;">銷售通路</th>
                </tr></thead>`;
            }
        };

        /**
         * 重新渲染表格內容與篩選器。
         */
        const rerenderTable = () => {
            const table = document.querySelector('#pct-table-wrap .pct-table');
            if (table) {
                const newHead = document.createElement('thead');
                newHead.innerHTML = generateResultsTableHeader().replace(/<\/?thead>/g, '');
                table.querySelector('thead')?.replaceWith(newHead);
                newHead.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => handleSortClick(th)));
            }

            const filteredData = DataModule.getFilteredData(initialQueryData);
            document.getElementById('pct-result-count').textContent = `共 ${filteredData.length} 筆資料`;

            const {
                isFullView,
                pageNo,
                pageSize,
                sortKey,
                sortAsc,
                queryMode
            } = StateModule.get();
            const totalItems = filteredData.length;
            const displayData = isFullView ? filteredData : filteredData.slice((pageNo - 1) * pageSize, pageNo * pageSize);

            const tableBody = document.getElementById('pct-table-body');
            if (!tableBody) return;

            const colspan = queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED ? 9 + ConfigModule.FIELD_MAPS.CHANNELS.length : 11;
            tableBody.innerHTML = displayData.length > 0 ?
                displayData.map(renderTableRow).join('') :
                `<tr><td colspan="${colspan}" style="text-align:center; padding: 20px;">查無符合條件的資料</td></tr>`;

            document.querySelectorAll('th[data-key]').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.key === sortKey) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
            });

            updatePaginationInfo(totalItems);
            renderFilterControls();
        };

        /**
         * 渲染表格中的單一行。
         * @param {object} item - 單筆資料物件。
         * @returns {string} 行的 HTML 字串。
         */
        const renderTableRow = (item) => {
            const {
                showPlanName,
                polplnDataCache,
                queryMode
            } = StateModule.get();
            const nameToShow = showPlanName ? item.fullName : item.displayName;
            const nameInTitle = showPlanName ? item.displayName : item.fullName;
            const isAbnormalRow = item.mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE;
            const rowClass = isAbnormalRow ? 'pct-row-abnormal-date' : '';

            let rowHtml = `<tr class="${rowClass}">
                <td class="copy-row-trigger" title="點擊複製整行">${item.no}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td>
                <td class="clickable-cell pct-align-left" title="[另一名稱]&#10;${UtilsModule.escapeHtml(nameInTitle)}">${UtilsModule.escapeHtml(nameToShow)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td>
                <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td>
                <td>${renderStatusPill(item.mainStatus)}</td>`;

            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                const channelCells = ConfigModule.FIELD_MAPS.CHANNELS.map(channelName => {
                    const statusInfo = item.fixedChannelStatuses[channelName];
                    const statusText = ConfigModule.MASTER_STATUS_TEXT[statusInfo.status] || statusInfo.status;
                    const bgColor = statusInfo.status === 'abnormal date' ? `style="background-color: var(--abnormal-bg-color);"` : '';
                    const title = `${channelName} [${statusText}]&#10;起日: ${statusInfo.saleStartDate || '無'}&#10;迄日: ${statusInfo.saleEndDate || '無'}`;
                    
                    const cellContent = statusInfo.status === 'not sold' ? '' : renderStatusPill(statusInfo.status);
                    
                    return `<td ${bgColor} title="${title}">${cellContent}</td>`;
                }).join('');
                rowHtml += channelCells;
            } else {
                const polplnValue = polplnDataCache.get(item.planCode);
                const polplnCellContent = (polplnValue === undefined) ?
                    `<button class="pct-load-polpln-btn" data-plancode="${item.planCode}">more</button>` :
                    `<span class="clickable-cell">${UtilsModule.escapeHtml(polplnValue)}</span>`;
                const {
                    content: channelsCellContent,
                    tooltip: tooltipText
                } = renderChannelsCell(item);
                rowHtml += `
                    <td>${polplnCellContent}</td>
                    <td class="pct-align-left" title="${tooltipText}">${channelsCellContent}</td>`;
            }
            rowHtml += `</tr>`;
            return rowHtml;
        };

        /**
         * 渲染銷售通路單元格的內容。
         * @param {object} item - 單筆資料物件。
         * @returns {object} 包含 HTML 內容和工具提示文字的物件。
         */
        const renderChannelsCell = (item) => {
            const channelsToDisplay = item.channels
                .filter(ch => ch.status !== 'not sold')
                .sort((a, b) => (ConfigModule.STATUS_ORDER[a.status] || 99) - (ConfigModule.STATUS_ORDER[b.status] || 99));

            const tooltipText = ConfigModule.FIELD_MAPS.CHANNELS.map(chName => {
                const chData = item.channels.find(c => c.channel === chName);
                const statusText = chData ? (ConfigModule.MASTER_STATUS_TEXT[chData.status] || chData.status) : '未銷售';
                return `${chName} 【${statusText}】 • 起日: ${chData?.saleStartDate || '無'} | 迄日: ${chData?.saleEndDate || '無'}`;
            }).join('&#10;');

            if (channelsToDisplay.length === 0) return {
                content: '【無銷售通路】',
                tooltip: tooltipText
            };

            const groupedHtml = channelsToDisplay.reduce((acc, ch, index) => {
                const classMap = {
                    'coming soon': 'pct-channel-comingsoon',
                    'currently sold': 'pct-channel-insale',
                    'discontinued': 'pct-channel-offsale',
                    'abnormal date': 'pct-channel-abnormal'
                };
                const className = classMap[ch.status] || 'pct-channel-notsold';
                const span = `<span class="${className}">${ch.channel}</span>`;

                if (index > 0 && ch.status !== channelsToDisplay[index - 1].status) acc.push(' | ');
                else if (index > 0) acc.push(' ');
                acc.push(span);
                return acc;
            }, []);
            return {
                content: groupedHtml.join(''),
                tooltip: tooltipText
            };
        };

        /**
         * 渲染狀態圖示和文字。
         * @param {string} status - 狀態代碼。
         * @returns {string} 狀態圖示和文字的 HTML 字串。
         */
        const renderStatusPill = (status) => {
            const config = {
                [ConfigModule.MASTER_STATUS_TYPES.COMING_SOON]: {
                    e: '🟢'
                },
                [ConfigModule.MASTER_STATUS_TYPES.CURRENTLY_SOLD]: {
                    e: '🔵'
                },
                [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUING_SOON]: {
                    e: '🟡'
                },
                [ConfigModule.MASTER_STATUS_TYPES.DISCONTINUED]: {
                    e: '🔴'
                },
                [ConfigModule.MASTER_STATUS_TYPES.ABNORMAL_DATE]: {
                    e: '🟠'
                },
                'not sold': {
                    e: ''
                }
            }[status] || {
                e: '❔'
            };
            const statusText = ConfigModule.MASTER_STATUS_TEXT[status] || status;
            return `<span class="pct-status-pill" title="${statusText}">${config.e} ${statusText}</span>`;
        };

        /**
         * 處理表格欄位排序點擊事件。
         * @param {HTMLElement} thElement - 被點擊的表頭元素。
         */
        const handleSortClick = (thElement) => {
            const key = thElement.dataset.key;
            const {
                sortKey,
                sortAsc
            } = StateModule.get();
            StateModule.set(sortKey === key ? {
                sortAsc: !sortAsc
            } : {
                sortKey: key,
                sortAsc: true
            });
            rerenderTable();
        };

        /**
         * 處理表格內容點擊事件。
         * @param {Event} e - 事件物件。
         */
        const handleTableClick = async (e) => {
            const target = e.target;
            if (target.classList.contains('clickable-cell')) {
                const cellValue = target.textContent.trim();
                if (cellValue && cellValue !== '...') UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show);
            } else if (target.classList.contains('pct-load-polpln-btn')) {
                target.disabled = true;
                target.textContent = '...';
                const planCode = target.dataset.plancode;
                await loadSinglePolpln(planCode, new AbortController().signal);
                rerenderTable();
            } else if (target.classList.contains('copy-row-trigger')) {
                const rowNo = parseInt(target.textContent, 10);
                const item = DataModule.getFilteredData(initialQueryData).find(d => d.no === rowNo);
                if (item) copyTableRow(item);
            }
        };

        /**
         * 載入單一險種的 POLPLN 資料。
         * @param {string} planCode - 險種代號。
         * @param {AbortSignal} signal - 取消信號。
         */
        const loadSinglePolpln = async (planCode, signal) => {
            const {
                polplnDataCache,
                rawPolplnDataCache
            } = StateModule.get();
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

        /**
         * 更新分頁資訊。
         * @param {number} totalItems - 總資料筆數。
         */
        const updatePaginationInfo = (totalItems) => {
            const {
                isFullView,
                pageNo,
                pageSize
            } = StateModule.get();
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

        /**
         * 切換分頁。
         * @param {number} direction - 方向 (1 為下一頁，-1 為上一頁)。
         */
        const changePage = (direction) => {
            const {
                pageNo,
                pageSize,
                isFullView
            } = StateModule.get();
            if (isFullView) return;
            const totalItems = DataModule.getFilteredData(initialQueryData).length;
            const maxPage = Math.ceil(totalItems / pageSize);
            const newPageNo = pageNo + direction;
            if (newPageNo >= 1 && newPageNo <= maxPage) {
                StateModule.set({
                    pageNo: newPageNo
                });
                rerenderTable();
            }
        };

        /**
         * 切換表格的顯示模式（分頁/一頁顯示）。
         * @param {Event} e - 事件物件。
         */
        const handleToggleView = (e) => {
            const isFullView = !StateModule.get().isFullView;
            StateModule.set({
                isFullView,
                pageNo: 1
            });
            e.target.textContent = isFullView ? '分頁顯示' : '一頁顯示';
            rerenderTable();
        };

        /**
         * 強制更新資料。
         */
        const handleForceUpdate = async () => {
            UIModule.Toast.show('正在清除快取並從伺服器更新資料...', 'info', 3000);
            StateModule.clearAllCaches();
            initialQueryData = [];
            cleanupAndClose();
            setTimeout(() => initialize(), 100);
            UIModule.Toast.show('資料已清除，正在重新載入...', 'info', 4000);
        };

        /**
         * 根據資料更新篩選器的選項。
         * @param {Array} baseData - 作為篩選基礎的資料。
         */
        const updateFilterOptions = (baseData) => {
            const newOptions = {};
            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                let values = new Set();
                if (filter.type === 'standard') {
                    baseData.forEach(item => {
                        const value = (filter.key === 'mainStatus') ?
                            ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] :
                            item[filter.key];
                        if (value !== undefined && value !== null) values.add(value);
                    });
                } else if (filter.type === 'advanced') {
                    baseData.forEach(item => {
                        const rawValue = item._raw?.master?.[filter.rawKey];
                        if (rawValue !== undefined && rawValue !== null) values.add(String(rawValue));
                    });
                }
                newOptions[filter.key] = Array.from(values).sort();
            });
            StateModule.set({
                filterOptions: newOptions
            });
        };

        /**
         * 渲染篩選器控制項。
         */
        const renderFilterControls = () => {
            const wrapper = document.getElementById('pct-filters-wrapper');
            if (!wrapper) return;

            const {
                filterOptions,
                activeFilters,
                advancedFilters,
                isFilterVisible
            } = StateModule.get();
            const filterColumnCount = ConfigModule.RESULTS_PAGE_FILTERS.length;

            let labelsHtml = '';
            let controlsHtml = '';
            ConfigModule.RESULTS_PAGE_FILTERS.forEach(filter => {
                labelsHtml += `<div class="pct-filter-label">${filter.label}</div>`;

                const currentValue = filter.type === 'standard' ? activeFilters[filter.key] : advancedFilters[filter.key];
                let controlContent = '';
                if (filter.filterType === 'select') {
                    const options = filterOptions[filter.key] || [];
                    const optionsHtml = options.map(opt => {
                        const selected = String(currentValue ?? '') === String(opt) ? 'selected' : '';
                        return `<option value="${UtilsModule.escapeHtml(opt)}" ${selected}>${UtilsModule.escapeHtml(opt)}</option>`;
                    }).join('');
                    controlContent = `<select id="filter-${filter.key}" data-key="${filter.key}" data-type="${filter.type}"><option value="">全部</option>${optionsHtml}</select>`;
                } else {
                    controlContent = `<input type="text" id="filter-${filter.key}" data-key="${filter.key}" data-type="${filter.type}" class="pct-input" value="${UtilsModule.escapeHtml(currentValue || '')}" placeholder="關鍵字...">`;
                }
                controlsHtml += `<div class="pct-filter-control">${controlContent}</div>`;
            });

            labelsHtml += `<div class="pct-filter-label"></div>`;
            controlsHtml += `<div class="pct-filter-control" style="text-align: right;"><button id="pct-reset-filters" class="pct-btn pct-btn-outline" style="font-size: 12px; padding: 4px 8px;">重設</button></div>`;

            const headerHtml = `<div class="pct-filters-header"><h4>篩選器</h4><button id="pct-toggle-filters-btn" class="pct-btn pct-btn-outline" style="font-size: 12px; padding: 2px 8px;">${isFilterVisible ? '收折' : '展開'}</button></div>`;
            wrapper.innerHTML = headerHtml + `<div id="pct-all-filters-container" style="display: grid; grid-template-columns: repeat(${filterColumnCount}, 1fr) auto; gap: 5px 10px; align-items: center; transition: all 0.3s ease-in-out;">` + labelsHtml + controlsHtml + '</div>';

            document.getElementById('pct-all-filters-container').classList.toggle('collapsed', !isFilterVisible);
            bindFilterEvents();
        };

        /**
         * 綁定篩選器控制項的事件。
         */
        const bindFilterEvents = () => {
            document.querySelectorAll('#pct-all-filters-container select, #pct-all-filters-container input').forEach(el => {
                el.addEventListener('input', (e) => {
                    const timers = StateModule.get().debounceTimers;
                    const key = e.target.dataset.key;
                    clearTimeout(timers[key]);
                    timers[key] = setTimeout(() => {
                        const type = e.target.dataset.type;
                        const value = e.target.value;
                        const filterStateKey = type === 'standard' ? 'activeFilters' : 'advancedFilters';
                        const newFilters = {
                            ...StateModule.get()[filterStateKey]
                        };

                        if (value) newFilters[key] = value;
                        else delete newFilters[key];

                        StateModule.set({
                            [filterStateKey]: newFilters,
                            pageNo: 1
                        });
                        rerenderTable();
                    }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
                });
            });

            document.getElementById('pct-reset-filters')?.addEventListener('click', () => {
                StateModule.set({
                    activeFilters: {},
                    advancedFilters: {},
                    pageNo: 1
                });
                rerenderTable();
            });

            document.getElementById('pct-toggle-filters-btn')?.addEventListener('click', (e) => {
                const isVisible = !StateModule.get().isFilterVisible;
                StateModule.set({
                    isFilterVisible: isVisible
                });
                document.getElementById('pct-all-filters-container').classList.toggle('collapsed', !isVisible);
                e.target.textContent = isVisible ? '收折' : '展開';
            });
        };

        /**
         * 複製所有篩選後資料到剪貼簿。
         */
        const handleCopyAll = () => {
            const dataToCopy = DataModule.getFilteredData(initialQueryData);
            if (dataToCopy.length === 0) {
                UIModule.Toast.show('無資料可複製', 'warning');
                return;
            }
            const {
                showPlanName,
                polplnDataCache
            } = StateModule.get();
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const rows = dataToCopy.map(item => [
                item.no, item.planCode, showPlanName ? item.fullName : item.displayName,
                item.currency, item.unit, item.coverageType,
                item.saleStartDate, item.saleEndDate, ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                polplnDataCache.get(item.planCode) || '',
                item.channels.filter(c => c.status !== 'not sold').map(ch => ch.channel).join(' | ') || '無資料'
            ]);
            const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
            UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
        };

        /**
         * 複製單一行資料到剪貼簿。
         * @param {object} item - 單筆資料物件。
         */
        const copyTableRow = (item) => {
            const {
                showPlanName,
                polplnDataCache
            } = StateModule.get();
            const headers = ['No', '代號', '商品名稱', '幣別', '單位', '型態', '主檔銷售日', '主檔停售日', '主檔狀態', 'POLPLN', '銷售通路'];
            const channelText = item.channels.filter(c => c.status !== 'not sold').map(c => c.channel).join(' | ') || '無資料';
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

        /**
         * 處理預覽按鈕點擊事件，在新視窗中顯示所有資料。
         */
        const handlePreviewAll = () => {
            const dataToPreview = DataModule.getFilteredData(initialQueryData);
            if (dataToPreview.length === 0) {
                UIModule.Toast.show('無資料可預覽', 'warning');
                return;
            }

            const previewContent = generatePreviewPageHTML(dataToPreview);
            const previewWindow = window.open('', '_blank');
            if (previewWindow) {
                previewWindow.document.write(previewContent);
                previewWindow.document.close();
            } else {
                UIModule.Toast.show('無法開啟新視窗，請檢查瀏覽器設定', 'error');
            }
        };

        /**
         * 產生預覽頁面的 HTML 內容。
         * @param {Array} data - 預覽資料陣列。
         * @returns {string} 預覽頁面的完整 HTML 字串。
         */
        const generatePreviewPageHTML = (data) => {
            const {
                showPlanName,
                polplnDataCache
            } = StateModule.get();

            const createTableHTML = (tableId, dataArray, keysToShow) => {
                if (!dataArray || dataArray.length === 0) return '<p>無資料可顯示。</p>';
                let headers = keysToShow || Object.keys(dataArray[0] || {});

                let thead = '<thead><tr>' + headers.map(h => `<th>${UtilsModule.escapeHtml(h)}</th>`).join('') + '</tr></thead>';
                let tbody = '<tbody>' + dataArray.map(row => {
                    return '<tr>' + headers.map(headerKey => `<td>${UtilsModule.escapeHtml(row[headerKey] ?? '')}</td>`).join('') + '</tr>';
                }).join('') + '</tbody>';

                return `<div class="pct-preview-table-wrap"><table id="${tableId}">${thead}${tbody}</table></div>`;
            };

            const processedData = data.map(item => {
                const channelStr = item.channels
                    .filter(c => c.status !== 'not sold')
                    .map(c => `${c.channel}(${ConfigModule.MASTER_STATUS_TEXT[c.status]||c.status})`)
                    .join(', ') || '無通路';

                return {
                    'No': item.no,
                    '代號': item.planCode,
                    '商品名稱': showPlanName ? item.fullName : item.displayName,
                    '幣別': item.currency,
                    '單位': item.unit,
                    '型態': item.coverageType,
                    '銷售起日': item.saleStartDate,
                    '銷售迄日': item.saleEndDate,
                    '主檔狀態': ConfigModule.MASTER_STATUS_TEXT[item.mainStatus] || item.mainStatus,
                    'POLPLN': polplnDataCache.get(item.planCode) || '',
                    '通路': channelStr
                };
            });

            const tab1Content = createTableHTML('preview-table-processed', processedData);

            // 最簡版預覽 HTML
            return `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>查詢預覽</title>
<style>
body{font-family:'Microsoft JhengHei',sans-serif;margin:0;background-color:#f4f7f9;}
.pct-preview-container{padding:15px;}
.pct-preview-table-wrap{width:100%;overflow-x:auto;max-height:70vh;margin-top:10px;}
table{border-collapse:collapse;width:100%;font-size:13px;}
th,td{border:1px solid #ccc;padding:6px 8px;white-space:nowrap;}
thead th{background-color:#f0f2f5;}
</style>
</head>
<body>
<div class="pct-preview-container">
<h2>查詢結果預覽 (共 ${processedData.length} 筆)</h2>
${tab1Content}
</div>
</body>
</html>`;
        };

        // === 初始化執行點 ===
        return {
            initialize,
            cleanupAndClose
        };
    })();

    // 啟動前清理舊的 DOM 元素，確保不會重複建立。
    document.querySelectorAll(`#${ConfigModule.TOOL_ID}, #${ConfigModule.STYLE_ID}, .pct-toast, #pctModalMask`)
        .forEach(el => el.remove());

    // 啟動工具
    ControllerModule.initialize();

})();
