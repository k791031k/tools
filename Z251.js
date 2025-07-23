javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * KGI Plan Code Query Tool v25.1.0
     *
     * @version 2025.07.23 - Refined Edition
     * @author Gemini
     *
     * 更新說明 (v25.1.0):
     * - **【遵循使用者偏好】**:
     * - 依據 [2025-07-21] 的儲存指示進行介面微調。
     * - **術語更新**:
     * - `現售` 改為 `現售中`。
     * - `尚未開賣` 改為 `即將開賣`。
     * - **按鈕文字**:
     * - 表格中載入商品名稱 (POLPLN) 的按鈕文字從「載入」改為「更多」。
     * - **通路顯示優化**:
     * - 銷售通路嚴格依照「現售中 > 停售 > 日期異常 > 即將開賣」的順序排序。
     * - 為各通路群組增加滑鼠懸停提示，顯示其詳細的銷售起迄日期。
     * - **保留所有優點**: 沿用 v25.0.0 的所有功能與優化。
     * =================================================================================
     */

    /**
     * @module ConfigModule
     * @description 儲存所有靜態設定與常數。
     */
    const ConfigModule = Object.freeze({
        TOOL_ID: 'planCodeQueryToolInstance',
        STYLE_ID: 'planCodeToolStyle',
        VERSION: '25.1.0-Refined-Edition',
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            MASTER_CLASSIFIED: 'masterClassified',
            CHANNEL_CLASSIFIED: 'channelClassified',
        },
        // [MODIFIED] 根據使用者 [2025-07-21] 指示更新顯示術語
        MASTER_STATUS_TYPES: {
            IN_SALE: '現售中', // '現售' -> '現售中'
            STOPPED: '停售',
            PENDING: '即將開賣', // '尚未開賣' -> '即將開賣'
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
        DEFAULT_QUERY_PARAMS: {
            PAGE_SIZE_MASTER: 10000,
            PAGE_SIZE_CHANNEL: 10000,
            PAGE_SIZE_TABLE: 50,
        },
        DEBOUNCE_DELAY: { SEARCH: 500 },
        BATCH_SIZES: { DETAIL_LOAD: 20 },
    });

    /**
     * @module StateModule
     * @description 管理應用程式的所有動態狀態。
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
            pageNo: 1,
            pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
            isFullView: false,
            searchKeyword: '',
            sortKey: 'no',
            sortAsc: true,
            masterDataCache: null,
            channelDataCache: null,
            polplnDataCache: new Map(),
            mergedDataCache: null,
            currentQueryController: null,
            searchDebounceTimer: null,
            modalPosition: { top: null, left: null },
        };
        state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;

        const get = () => ({ ...state });
        const set = (newState) => { Object.assign(state, newState); };
        const resetQueryState = () => set({
            pageNo: 1, searchKeyword: '', isFullView: false, sortKey: 'no', sortAsc: true,
        });

        return { get, set, resetQueryState };
    })();

    /**
     * @module UtilsModule
     * @description 提供各種工具函式。
     */
    const UtilsModule = (() => {
        const escapeHtml = (str) => {
            if (typeof str !== 'string') return str;
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return str.replace(/[&<>"']/g, m => map[m]);
        };
        const formatToday = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const formatDateForUI = (dt) => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
        const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
            if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
            const today = new Date();
            const startDate = new Date(saleStartStr.slice(0, 4), saleStartStr.slice(4, 6) - 1, saleStartStr.slice(6, 8));
            const endDate = new Date(saleEndStr.slice(0, 4), saleEndStr.slice(4, 6) - 1, saleEndStr.slice(6, 8));
            today.setHours(0, 0, 0, 0);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
            if (today < startDate) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
            if (today > endDate) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
            return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
        };
        const convertCodeToText = (v, map) => map[String(v)] || v || '';
        const copyTextToClipboard = (text, showToast) => {
            navigator.clipboard.writeText(text)
                .then(() => showToast('已複製', 'success'))
                .catch(() => showToast('複製失敗', 'error'));
        };
        const splitInput = (input) => input.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
        const toHalfWidthUpperCase = (str) => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();

        return {
            escapeHtml, formatToday, formatDateForUI, getSaleStatus,
            convertCodeToText, copyTextToClipboard, splitInput, toHalfWidthUpperCase,
        };
    })();

    /**
     * @module UIModule
     * @description 處理所有 DOM 操作與 UI 渲染。
     */
    const UIModule = (() => {
        const injectStyle = () => {
            const style = document.createElement('style');
            style.id = ConfigModule.STYLE_ID;
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
                .pct-table th:nth-child(1), .pct-table td:nth-child(1) { width: 6.8%; text-align: center; }
                .pct-table th:nth-child(2), .pct-table td:nth-child(2) { width: 6.8%; }
                .pct-table th:nth-child(3), .pct-table td:nth-child(3) { width: 19.3%; }
                .pct-table th:nth-child(4), .pct-table td:nth-child(4) { width: 5.7%; text-align: center; }
                .pct-table th:nth-child(5), .pct-table td:nth-child(5) { width: 4.5%; text-align: center; }
                .pct-table th:nth-child(6), .pct-table td:nth-child(6) { width: 4.5%; text-align: center; }
                .pct-table th:nth-child(7), .pct-table td:nth-child(7) { width: 11.4%; text-align: center; }
                .pct-table th:nth-child(8), .pct-table td:nth-child(8) { width: 11.4%; text-align: center; }
                .pct-table th:nth-child(9), .pct-table td:nth-child(9) { width: 6.8%; text-align: center; }
                .pct-table th:nth-child(10), .pct-table td:nth-child(10) { width: 9.1%; }
                .pct-table th:nth-child(11), .pct-table td:nth-child(11) { width: 13.6%; }
                .pct-table th[data-key] { position: relative; padding-right: 20px; }
                .pct-table th[data-key]::after { content: ''; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 0.3; border: 4px solid transparent; }
                .pct-table th[data-key].sort-asc::after { border-bottom-color: var(--primary-color); opacity: 1; }
                .pct-table th[data-key].sort-desc::after { border-top-color: var(--primary-color); opacity: 1; }
                .pct-table tr:hover td { background: #e3f2fd; }
                .pct-table td.clickable-cell { cursor: cell; }
                .pct-load-polpln-btn { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
                .pct-load-polpln-btn:hover { background: #f0f0f0; }
                .pct-channel-insale { color: var(--primary-color); font-weight: bold; }
                .pct-channel-offsale { color: var(--error-color); }
                .pct-channel-abnormal { color: var(--warning-color); }
                .pct-channel-pending { color: var(--secondary-color); }
                .pct-channel-separator { margin: 0 6px; color: #ccc; font-weight: bold; }
                .pct-toast { position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 22px; border-radius: 6px; font-size: 16px; z-index: 2147483647; opacity: 0; transition: opacity .3s, transform .3s; }
                .pct-toast.show { opacity: 1; }
                .pct-toast.success { background: var(--success-color); }
                .pct-toast.error { background: var(--error-color); }
                .pct-progress-container { display: none; align-items: center; gap: 16px; padding: 12px; background-color: #f0f8ff; border-radius: 6px; margin-bottom: 16px; }
                .pct-progress-bar-wrapper { flex-grow: 1; height: 10px; background-color: rgba(0,0,0,0.1); border-radius: 5px; overflow: hidden; }
                .pct-progress-bar { width: 0%; height: 100%; background-color: var(--primary-color); transition: width .4s ease-out; }
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

                modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown);
                modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close);
                
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
        
        const showError = (msg, elId) => {
            const el = document.getElementById(elId);
            if (el) { el.textContent = msg; el.style.display = 'block'; }
            else { Toast.show(msg, 'error'); }
        };
        const hideError = (elId) => {
            const el = document.getElementById(elId);
            if (el) { el.style.display = 'none'; el.textContent = ''; }
        };

        return { injectStyle, Toast, Modal, Progress, showError, hideError };
    })();

    /**
     * @module EventModule
     * @description 集中處理所有事件監聽與處理。
     */
    const EventModule = (() => {
        const dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };

        const dragMouseDown = (e) => {
            const modal = document.getElementById(ConfigModule.TOOL_ID);
            if (!modal || e.target.classList.contains('pct-modal-close-btn')) return;
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
                UIModule.Modal.close();
                document.removeEventListener('keydown', handleEscKey);
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

        return { dragMouseDown, setupGlobalKeyListener, autoFormatInput };
    })();

    /**
     * @module ApiModule
     * @description 負責所有與後端 API 的通訊。
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
                throw new Error(`API 請求失敗: ${errorText}`);
            }
            return response.json();
        };

        const verifyToken = async (token) => {
            if (!token) return false;
            try {
                const { apiBase } = StateModule.get();
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
        };
        
        const fetchMasterData = async (signal) => {
            const res = await callApi('/planCodeController/query', { currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, signal);
            return res.records || [];
        };

        const fetchChannelData = async (signal) => {
            const res = await callApi('/planCodeSaleDateController/query', { pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }, signal);
            return (res.planCodeSaleDates?.records || []).map(r => ({...r, channel: r.channel === 'OT' ? 'BK' : r.channel }));
        };
        
        const fetchPolplnForCode = async (planCode, signal) => {
            const res = await callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }, signal);
            return res.records || [];
        };

        return { verifyToken, fetchMasterData, fetchChannelData, fetchPolplnForCode };
    })();

    /**
     * @module DataModule
     * @description 負責資料的獲取、快取、合併與篩選。
     */
    const DataModule = (() => {
        const initializeCaches = async (signal) => {
            const { masterDataCache, channelDataCache } = StateModule.get();
            const tasks = [];
            
            if (!masterDataCache) tasks.push(ApiModule.fetchMasterData(signal).then(data => StateModule.set({ masterDataCache: data })));
            if (!channelDataCache) tasks.push(ApiModule.fetchChannelData(signal).then(data => StateModule.set({ channelDataCache: data })));

            if (tasks.length > 0) {
                UIModule.Progress.show('首次載入，正在獲取主檔與通路資料...');
                await Promise.all(tasks);
                UIModule.Progress.update(50, '資料獲取完畢，正在合併處理...');
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

            const mergedData = masterDataCache.map((item) => {
                const planCode = String(item.planCode || '-');
                const channelsRaw = channelMap.get(planCode) || [];
                
                // [MODIFIED] 將 saleStartDate/saleEndDate 傳遞到 channel 物件中，供 hover 提示使用
                const channels = channelsRaw.map(c => {
                    const saleStartDate = UtilsModule.formatDateForUI(c.saleStartDate);
                    const saleEndDate = UtilsModule.formatDateForUI(c.saleEndDate);
                    return {
                        channel: c.channel,
                        status: UtilsModule.getSaleStatus(today, saleStartDate, saleEndDate),
                        saleStartDate,
                        saleEndDate,
                    };
                });

                return {
                    planCode,
                    shortName: item.shortName || item.planName || '-',
                    currency: UtilsModule.convertCodeToText(item.currency || item.cur, ConfigModule.FIELD_MAPS.CURRENCY),
                    unit: UtilsModule.convertCodeToText(item.reportInsuranceAmountUnit || item.insuranceAmountUnit, ConfigModule.FIELD_MAPS.UNIT),
                    coverageType: UtilsModule.convertCodeToText(item.coverageType || item.type, ConfigModule.FIELD_MAPS.COVERAGE_TYPE),
                    saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate),
                    saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate),
                    mainStatus: UtilsModule.getSaleStatus(today, UtilsModule.formatDateForUI(item.saleStartDate), UtilsModule.formatDateForUI(item.saleEndDate)),
                    polpln: null,
                    channels,
                };
            });
            
            StateModule.set({ mergedDataCache: mergedData });
        };
        
        const getFilteredData = () => {
            const { mergedDataCache, queryMode, queryInput, masterStatusSelection, channelSelection, channelStatusSelection, searchKeyword, sortKey, sortAsc } = StateModule.get();
            if (!mergedDataCache) return [];
            let data = [...mergedDataCache];

            switch (queryMode) {
                case ConfigModule.QUERY_MODES.PLAN_CODE:
                    const codesToSearch = UtilsModule.splitInput(queryInput);
                    if (codesToSearch.length > 0) {
                        data = data.filter(item => codesToSearch.some(code => item.planCode.includes(code)));
                    }
                    break;
                case ConfigModule.QUERY_MODES.PLAN_NAME:
                    const nameKeyword = queryInput.toLowerCase();
                    data = data.filter(item => item.shortName.toLowerCase().includes(nameKeyword));
                    break;
                case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                    data = data.filter(item => masterStatusSelection.has(item.mainStatus));
                    break;
                case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                    data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel)));
                    if (channelStatusSelection === ConfigModule.MASTER_STATUS_TYPES.IN_SALE) {
                        data = data.filter(item => item.channels.some(c => channelSelection.has(c.channel) && c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE));
                    } else if (channelStatusSelection === ConfigModule.MASTER_STATUS_TYPES.STOPPED) {
                        data = data.filter(item => {
                            const relevantChannels = item.channels.filter(c => channelSelection.has(c.channel));
                            return relevantChannels.length > 0 && !relevantChannels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE);
                        });
                    }
                    break;
            }

            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();
                data = data.filter(item => Object.values(item).some(value => {
                    const strValue = String(value === null ? '' : value).toLowerCase();
                    return strValue.includes(keyword);
                }));
            }

            if (sortKey && sortKey !== 'no') {
                data.sort((a, b) => {
                    let valA = a[sortKey], valB = b[sortKey];
                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });
            }

            return data.map((item, index) => ({ ...item, no: index + 1 }));
        };

        return { initializeCaches, getFilteredData };
    })();

    /**
     * @module ControllerModule
     * @description 應用程式的主控制器，協調各模組運作。
     */
    const ControllerModule = (() => {
        const initialize = async () => {
            UIModule.injectStyle();
            EventModule.setupGlobalKeyListener();
            const storedToken = localStorage.getItem('SSO-TOKEN') || sessionStorage.getItem('SSO-TOKEN');
            if (storedToken) {
                UIModule.Toast.show('正在自動驗證 Token...', 'info', 2000);
                if (await ApiModule.verifyToken(storedToken)) {
                    StateModule.set({ token: storedToken, isTokenVerified: true });
                    UIModule.Toast.show('Token 驗證成功', 'success');
                    showQueryDialog();
                } else {
                    StateModule.set({ token: '', isTokenVerified: false });
                    UIModule.Toast.show('自動驗證失敗，請手動輸入', 'warning');
                    showTokenDialog();
                }
            } else {
                showTokenDialog();
            }
        };

        const showTokenDialog = (isModification = false) => {
            const { env, token: currentToken } = StateModule.get();
            const html = `
                <div class="pct-modal-header">${isModification ? '修改' : '設定'} Token (${env})<button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="pct-token-input">請貼上您的 SSO-TOKEN：</label>
                        <textarea id="pct-token-input" class="pct-input" rows="4">${isModification ? currentToken : ''}</textarea>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div></div>
                    <div style="display:flex; gap:10px;">
                        <button id="pct-cancel-token" class="pct-btn pct-btn-outline">${isModification ? '取消' : '略過'}</button>
                        <button id="pct-confirm-token" class="pct-btn">${isModification ? '確定' : '驗證'}</button>
                    </div>
                </div>
            `;
            UIModule.Modal.show(html, (modal) => {
                const tokenInput = document.getElementById('pct-token-input');
                const confirmBtn = document.getElementById('pct-confirm-token');
                const cancelBtn = document.getElementById('pct-cancel-token');

                const handleConfirm = async () => {
                    const token = tokenInput.value.trim();
                    if (!token) {
                        UIModule.Toast.show('Token 不可為空', 'error');
                        return;
                    }
                    if (isModification) {
                        localStorage.setItem('SSO-TOKEN', token);
                        StateModule.set({ token, isTokenVerified: true });
                        UIModule.Toast.show('Token 已更新', 'success');
                        showQueryDialog();
                    } else {
                        confirmBtn.disabled = true;
                        confirmBtn.textContent = '驗證中...';
                        if (await ApiModule.verifyToken(token)) {
                            localStorage.setItem('SSO-TOKEN', token);
                            StateModule.set({ token, isTokenVerified: true });
                            UIModule.Toast.show('Token 驗證成功', 'success');
                            showQueryDialog();
                        } else {
                            UIModule.Toast.show('Token 驗證失敗', 'error');
                        }
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '驗證';
                    }
                };

                cancelBtn.addEventListener('click', () => {
                    if (isModification) showQueryDialog();
                    else {
                        StateModule.set({ token: '', isTokenVerified: false });
                        UIModule.Toast.show('已略過驗證', 'warning');
                        showQueryDialog();
                    }
                });

                confirmBtn.addEventListener('click', handleConfirm);
                tokenInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirm(); }
                });
            }, 'query');
        };

        const showQueryDialog = () => {
            StateModule.resetQueryState();
            const { env } = StateModule.get();
            const html = `
                <div class="pct-modal-header">選擇查詢條件 (${env})<button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label>查詢模式:</label>
                        <div class="pct-mode-card-grid">
                            <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_CODE}">商品代號</div>
                            <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.PLAN_NAME}">商品名稱</div>
                            <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.MASTER_CLASSIFIED}">主約銷售時間</div>
                            <div class="pct-mode-card" data-mode="${ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED}">通路銷售時間</div>
                        </div>
                        <div id="pct-dynamic-options" style="display:none; margin-top: 15px;"></div>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div class="pct-modal-footer-left">
                        <button id="pct-change-token" class="pct-btn pct-btn-outline">修改 Token</button>
                    </div>
                    <div class="pct-modal-footer-right">
                        <button id="pct-start-query" class="pct-btn" disabled>開始查詢</button>
                    </div>
                </div>
            `;
            UIModule.Modal.show(html, (modal) => {
                const modeCards = modal.querySelectorAll('.pct-mode-card');
                const dynamicOptions = document.getElementById('pct-dynamic-options');
                const startQueryBtn = document.getElementById('pct-start-query');
                
                const updateDynamicOptions = (mode) => {
                    let content = '';
                    switch (mode) {
                        case ConfigModule.QUERY_MODES.PLAN_CODE:
                            content = `<label for="pct-plan-code-input">商品代碼：(多筆可用空白、逗號或換行分隔)</label><textarea id="pct-plan-code-input" class="pct-input" rows="3"></textarea>`;
                            break;
                        case ConfigModule.QUERY_MODES.PLAN_NAME:
                            content = `<label for="pct-plan-name-input">商品名稱關鍵字：</label><input type="text" id="pct-plan-name-input" class="pct-input" placeholder="例如：健康、終身">`;
                            break;
                        case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                            content = `<label>主約銷售狀態：</label><div class="pct-sub-option-grid master-status">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s => `<div class="pct-sub-option" data-status="${s}">${s}</div>`).join('')}</div>`;
                            break;
                        case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                            content = `
                                <label>選擇通路：</label>
                                <div class="pct-channel-option-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                    <div class="pct-channel-option" data-channel="all"><strong>全選</strong></div>
                                    ${ConfigModule.FIELD_MAPS.CHANNELS.map(ch => `<div class="pct-channel-option" data-channel="${ch}">${ch}</div>`).join('')}
                                </div>
                                <label style="margin-top:10px;">銷售範圍：</label>
                                <div class="pct-sub-option-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                    <div class="pct-sub-option" data-range="${ConfigModule.MASTER_STATUS_TYPES.IN_SALE}">現售商品</div>
                                    <div class="pct-sub-option" data-range="${ConfigModule.MASTER_STATUS_TYPES.STOPPED}">停售商品</div>
                                </div>
                            `;
                            break;
                    }
                    dynamicOptions.innerHTML = content;
                    dynamicOptions.style.display = content ? 'block' : 'none';
                    bindDynamicEvents();
                    checkCanStartQuery();
                };

                const bindDynamicEvents = () => {
                    document.querySelectorAll('.pct-sub-option[data-status]').forEach(o => o.addEventListener('click', () => {
                        o.classList.toggle('selected');
                        const selected = new Set(Array.from(document.querySelectorAll('.pct-sub-option[data-status].selected')).map(el => el.dataset.status));
                        StateModule.set({ masterStatusSelection: selected });
                        checkCanStartQuery();
                    }));
                    
                    const channelOptions = document.querySelectorAll('.pct-channel-option');
                    channelOptions.forEach(o => o.addEventListener('click', () => {
                        const channel = o.dataset.channel;
                        if (channel === 'all') {
                            const isAllSelected = o.classList.contains('selected');
                            channelOptions.forEach(opt => opt.classList.toggle('selected', !isAllSelected));
                        } else {
                            o.classList.toggle('selected');
                            const allBtn = document.querySelector('.pct-channel-option[data-channel="all"]');
                            const individualOptions = Array.from(channelOptions).filter(opt => opt.dataset.channel !== 'all');
                            allBtn.classList.toggle('selected', individualOptions.every(opt => opt.classList.contains('selected')));
                        }
                        
                        const selected = new Set(Array.from(document.querySelectorAll('.pct-channel-option.selected')).map(el => el.dataset.channel).filter(c => c !== 'all'));
                        StateModule.set({ channelSelection: selected });
                        checkCanStartQuery();
                    }));

                    document.querySelectorAll('.pct-sub-option[data-range]').forEach(o => o.addEventListener('click', () => {
                        document.querySelectorAll('.pct-sub-option[data-range]').forEach(i => i.classList.remove('selected'));
                        o.classList.add('selected');
                        StateModule.set({ channelStatusSelection: o.dataset.range });
                        checkCanStartQuery();
                    }));
                    
                    document.querySelectorAll('.pct-input').forEach(input => input.addEventListener('input', EventModule.autoFormatInput));
                    document.querySelectorAll('.pct-input').forEach(input => input.addEventListener('input', checkCanStartQuery));
                };
                
                const checkCanStartQuery = () => {
                    const state = StateModule.get();
                    let canStart = false;
                    switch (state.queryMode) {
                        case ConfigModule.QUERY_MODES.PLAN_CODE:
                            canStart = !!(document.getElementById('pct-plan-code-input')?.value.trim());
                            break;
                        case ConfigModule.QUERY_MODES.PLAN_NAME:
                            canStart = !!(document.getElementById('pct-plan-name-input')?.value.trim());
                            break;
                        case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                            canStart = state.masterStatusSelection.size > 0;
                            break;
                        case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED:
                            canStart = state.channelSelection.size > 0 && !!state.channelStatusSelection;
                            break;
                    }
                    startQueryBtn.disabled = !canStart;
                };

                modeCards.forEach(card => card.addEventListener('click', () => {
                    modeCards.forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    StateModule.set({ queryMode: card.dataset.mode });
                    updateDynamicOptions(card.dataset.mode);
                }));

                document.getElementById('pct-change-token').addEventListener('click', () => showTokenDialog(true));
                startQueryBtn.addEventListener('click', handleStartQuery);

            }, 'query');
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
                document.getElementById('pct-table-body').innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px; color: var(--error-color);">權限不足，請返回並提供有效 Token。</td></tr>`;
                document.getElementById('pct-result-count').textContent = '共 0 筆資料';
                return;
            }

            const controller = new AbortController();
            StateModule.set({ currentQueryController: controller });

            try {
                await DataModule.initializeCaches(controller.signal);
                UIModule.Progress.hide();
                const filteredData = DataModule.getFilteredData();
                rerenderTable(filteredData);
            } catch (error) {
                UIModule.Progress.hide();
                if (error.name !== 'AbortError') {
                    UIModule.Toast.show(`查詢失敗: ${error.message}`, 'error', 5000);
                    rerenderTable([]);
                }
            } finally {
                StateModule.set({ currentQueryController: null });
            }
        };

        const loadSinglePolpln = async (planCode, signal) => {
            const polplnCache = StateModule.get().polplnDataCache;
            if (polplnCache.has(planCode) && polplnCache.get(planCode) !== null) return;

            polplnCache.set(planCode, '載入中...');
            try {
                const polplnRecords = await ApiModule.fetchPolplnForCode(planCode, signal);
                const extractPolpln = (str) => typeof str === 'string' ? str.trim().replace(/^\d+/, "").replace(/\d+$/, "").replace(/%$/, "").trim() : "";
                const uniquePolplns = [...new Set(polplnRecords.map(r => extractPolpln(r.polpln)).filter(Boolean))];
                const polpln = uniquePolplns.length === 1 ? uniquePolplns[0] : (uniquePolplns.length > 1 ? '多筆不同' : '無資料');
                polplnCache.set(planCode, polpln);
            } catch (e) {
                if (e.name !== 'AbortError') polplnCache.set(planCode, '載入失敗');
                else polplnCache.set(planCode, null);
            }
        };
        
        const showResultsDialog = () => {
            const { env } = StateModule.get();
            const html = `
                <div class="pct-modal-header">查詢結果 (${env})<button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body" style="display: flex; flex-direction: column; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0;">
                        <div class="pct-search-wrapper">
                            <label for="pct-search-input" style="font-size: 14px; color: #666; margin-right: 5px;">搜尋:</label>
                            <input type="text" id="pct-search-input" placeholder="篩選結果...">
                            <button id="pct-clear-search" title="清除搜尋">&times;</button>
                        </div>
                        <span id="pct-result-count" style="font-size: 16px; color: #333; font-weight: bold;"></span>
                    </div>
                    <div class="pct-table-wrap">
                        <table class="pct-table">
                            <thead>
                                <tr>
                                    <th data-key="no">No</th>
                                    <th data-key="planCode">代號</th>
                                    <th data-key="shortName">名稱</th>
                                    <th data-key="currency">幣別</th>
                                    <th data-key="unit">單位</th>
                                    <th data-key="coverageType">類型</th>
                                    <th data-key="saleStartDate">主約銷售日</th>
                                    <th data-key="saleEndDate">主約停賣日</th>
                                    <th data-key="mainStatus">險種狀態</th>
                                    <th data-key="polpln">商品名稱</th>
                                    <th>銷售通路</th>
                                </tr>
                            </thead>
                            <tbody id="pct-table-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div class="pct-modal-footer-left">
                         <button id="pct-toggle-view" class="pct-btn pct-btn-outline">一頁顯示</button>
                         <button id="pct-load-all-polpln" class="pct-btn pct-btn-outline">全部載入 POLPLN</button>
                    </div>
                    <div class="pct-pagination">
                        <button id="pct-prev-page" class="pct-btn pct-btn-outline">◀</button>
                        <span id="pct-page-info" style="font-size: 14px;">-</span>
                        <button id="pct-next-page" class="pct-btn pct-btn-outline">▶</button>
                    </div>
                    <div class="pct-modal-footer-right" style="gap: 15px;">
                        <button id="pct-copy-all" class="pct-btn">一鍵複製</button>
                        <button id="pct-back-to-query" class="pct-btn">重新查詢</button>
                    </div>
                </div>`;
            UIModule.Modal.show(html, setupResultsDialog, 'results');
        };

        const setupResultsDialog = (modal) => {
            const searchInput = document.getElementById('pct-search-input');
            const clearSearchBtn = document.getElementById('pct-clear-search');
            const tableBody = document.getElementById('pct-table-body');
            
            searchInput.addEventListener('input', EventModule.autoFormatInput);
            searchInput.addEventListener('input', () => {
                clearTimeout(StateModule.get().searchDebounceTimer);
                const timer = setTimeout(() => {
                    StateModule.set({ searchKeyword: searchInput.value.trim(), pageNo: 1 });
                    rerenderTable(DataModule.getFilteredData());
                }, ConfigModule.DEBOUNCE_DELAY.SEARCH);
                StateModule.set({ searchDebounceTimer: timer });
            });

            clearSearchBtn.addEventListener('click', () => {
                searchInput.value = '';
                StateModule.set({ searchKeyword: '', pageNo: 1 });
                rerenderTable(DataModule.getFilteredData());
            });

            tableBody.addEventListener('click', async (e) => {
                const target = e.target;
                if (target.classList.contains('clickable-cell')) {
                    const cellValue = e.target.textContent.trim();
                    if (cellValue && cellValue !== '...' && cellValue !== '-') UtilsModule.copyTextToClipboard(cellValue, UIModule.Toast.show);
                } else if (target.classList.contains('pct-load-polpln-btn')) {
                    target.disabled = true;
                    target.textContent = '...';
                    const planCode = target.dataset.plancode;
                    await loadSinglePolpln(planCode, new AbortController().signal);
                    rerenderTable(DataModule.getFilteredData());
                }
            });

            modal.querySelectorAll('th[data-key]').forEach(th => th.addEventListener('click', () => {
                const key = th.dataset.key;
                const { sortKey, sortAsc } = StateModule.get();
                StateModule.set(sortKey === key ? { sortAsc: !sortAsc } : { sortKey: key, sortAsc: true });
                rerenderTable(DataModule.getFilteredData());
            }));

            document.getElementById('pct-load-all-polpln').addEventListener('click', async (e) => {
                e.target.disabled = true;
                const filteredData = DataModule.getFilteredData();
                const itemsToLoad = filteredData.filter(item => item.polpln === null);
                if (itemsToLoad.length === 0) {
                    UIModule.Toast.show('所有 POLPLN 皆已載入', 'info');
                    e.target.disabled = false;
                    return;
                }
                
                UIModule.Progress.show('批次載入商品名稱...');
                const { BATCH_SIZES } = ConfigModule;
                for (let i = 0; i < itemsToLoad.length; i += BATCH_SIZES.DETAIL_LOAD) {
                    const batch = itemsToLoad.slice(i, i + BATCH_SIZES.DETAIL_LOAD);
                    UIModule.Progress.update((i + batch.length) / itemsToLoad.length * 100, `載入 ${i + batch.length}/${itemsToLoad.length}...`);
                    await Promise.all(batch.map(item => loadSinglePolpln(item.planCode, new AbortController().signal)));
                    rerenderTable(DataModule.getFilteredData());
                }
                UIModule.Progress.hide();
                e.target.disabled = false;
            });

            document.getElementById('pct-toggle-view').addEventListener('click', (e) => {
                const isFullView = !StateModule.get().isFullView;
                StateModule.set({ isFullView, pageNo: 1 });
                e.target.textContent = isFullView ? '分頁顯示' : '一頁顯示';
                rerenderTable(DataModule.getFilteredData());
            });

            document.getElementById('pct-prev-page').addEventListener('click', () => {
                const { pageNo } = StateModule.get();
                if (pageNo > 1) {
                    StateModule.set({ pageNo: pageNo - 1 });
                    rerenderTable(DataModule.getFilteredData());
                }
            });

            document.getElementById('pct-next-page').addEventListener('click', () => {
                const { pageNo, pageSize } = StateModule.get();
                const maxPage = Math.ceil(DataModule.getFilteredData().length / pageSize);
                if (pageNo < maxPage) {
                    StateModule.set({ pageNo: pageNo + 1 });
                    rerenderTable(DataModule.getFilteredData());
                }
            });
            
            document.getElementById('pct-copy-all').addEventListener('click', () => {
                 const dataToCopy = DataModule.getFilteredData();
                 if (dataToCopy.length === 0) {
                      UIModule.Toast.show('無資料可複製', 'warning');
                      return;
                 }
                 const headers = ['No', '代號', '名稱', '幣別', '單位', '類型', '主約銷售日', '主約停賣日', '險種狀態', '商品名稱', '銷售通路'];
                 const rows = dataToCopy.map(item => [
                      item.no, item.planCode, item.shortName, item.currency, item.unit, item.coverageType,
                      item.saleStartDate, item.saleEndDate, item.mainStatus, item.polpln,
                      item.channels.map(ch => ch.channel).join(' ')
                 ]);
                 const tsvContent = [headers, ...rows].map(row => row.join('\t')).join('\n');
                 UtilsModule.copyTextToClipboard(tsvContent, UIModule.Toast.show);
            });

            document.getElementById('pct-back-to-query').addEventListener('click', showQueryDialog);
        };

        const rerenderTable = (filteredData) => {
            const { isFullView, pageNo, pageSize, sortKey, sortAsc, polplnDataCache } = StateModule.get();
            const totalItems = filteredData.length;
            let displayData = filteredData;
            
            if (!isFullView) {
                const startIdx = (pageNo - 1) * pageSize;
                displayData = filteredData.slice(startIdx, startIdx + pageSize);
            }

            const tableBody = document.getElementById('pct-table-body');
            if (tableBody) {
                tableBody.innerHTML = displayData.length > 0 
                    ? displayData.map(item => renderTableRow(item, polplnDataCache)).join('')
                    : `<tr><td colspan="11" style="text-align:center; padding: 20px;">查無符合條件的資料</td></tr>`;
            }
            
            document.querySelectorAll('th[data-key]').forEach(th => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (th.dataset.key === sortKey) th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
            });

            updatePaginationInfo(totalItems);
            document.getElementById('pct-result-count').textContent = `共 ${totalItems} 筆資料`;
        };

        const renderTableRow = (item, polplnCache) => {
            const polplnValue = polplnCache.get(item.planCode);
            let polplnCellContent;
            if (polplnValue === undefined || polplnValue === null) {
                // [MODIFIED] 按鈕文字從「載入」改為「更多」
                polplnCellContent = `<button class="pct-load-polpln-btn" data-plancode="${item.planCode}">更多</button>`;
            } else {
                polplnCellContent = `<span class="clickable-cell">${UtilsModule.escapeHtml(polplnValue)}</span>`;
            }

            return `
                <tr>
                    <td class="clickable-cell">${item.no}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.planCode)}</td>
                    <td class="clickable-cell" title="${UtilsModule.escapeHtml(item.shortName)}">${UtilsModule.escapeHtml(item.shortName)}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.currency)}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.unit)}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.coverageType)}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleStartDate)}</td>
                    <td class="clickable-cell">${UtilsModule.escapeHtml(item.saleEndDate)}</td>
                    <td>${renderStatusPill(item.mainStatus)}</td>
                    <td>${polplnCellContent}</td>
                    <td>${renderChannelsCell(item.channels)}</td>
                </tr>
            `;
        };

        const renderStatusPill = (status) => {
            const config = {
                [ConfigModule.MASTER_STATUS_TYPES.IN_SALE]: { e: '🟢' },
                [ConfigModule.MASTER_STATUS_TYPES.STOPPED]: { e: '🔴' },
                [ConfigModule.MASTER_STATUS_TYPES.PENDING]: { e: '🔵' },
                [ConfigModule.MASTER_STATUS_TYPES.ABNORMAL]: { e: '🟡' },
            }[status] || { e: '⚪' };
            return `<span class="clickable-cell">${config.e} ${status}</span>`;
        };
        
        // [REFACTORED] 完全重構此函式以滿足排序與 hover 提示的需求
        const renderChannelsCell = (channels) => {
            if (!channels || channels.length === 0) return ' - ';
            
            const { IN_SALE, STOPPED, PENDING, ABNORMAL } = ConfigModule.MASTER_STATUS_TYPES;
            
            // 1. [MODIFIED] 定義新的排序優先級
            const statusOrder = {
                [IN_SALE]: 1,
                [STOPPED]: 2,
                [ABNORMAL]: 3,
                [PENDING]: 4
            };

            // 2. [MODIFIED] 分組時保留完整的 channel 物件 (包含日期)
            const grouped = channels.reduce((acc, channel) => {
                const status = channel.status;
                if (!acc[status]) acc[status] = [];
                acc[status].push(channel);
                return acc;
            }, {});

            // 3. 對每個狀態內的通路按字母排序
            Object.values(grouped).forEach(group => group.sort((a, b) => a.channel.localeCompare(b.channel)));

            // 4. [MODIFIED] 依照新的 statusOrder 排序狀態組
            const sortedGroups = Object.entries(grouped).sort(([statusA], [statusB]) => {
                return (statusOrder[statusA] || 99) - (statusOrder[statusB] || 99);
            });

            // 5. [MODIFIED] 產生 HTML，並為每個 span 加上 title 屬性作為 hover 提示
            return sortedGroups.map(([status, channelObjects]) => {
                let className = '';
                switch (status) {
                    case IN_SALE:  className = 'pct-channel-insale'; break;
                    case STOPPED:  className = 'pct-channel-offsale'; break;
                    case ABNORMAL: className = 'pct-channel-abnormal'; break;
                    case PENDING:  className = 'pct-channel-pending'; break;
                }
                
                // 組合顯示的通路代碼
                const channelCodes = channelObjects.map(c => c.channel).join(' ');
                
                // 組合 hover 提示的詳細資訊
                const titleDetails = channelObjects
                    .map(c => `${c.channel}: ${c.saleStartDate || 'N/A'} - ${c.saleEndDate || 'N/A'}`)
                    .join('\n');

                return `<span class="${className}" title="${UtilsModule.escapeHtml(titleDetails)}">${channelCodes}</span>`;
            }).join('<span class="pct-channel-separator">|</span>');
        };

        const updatePaginationInfo = (totalItems) => {
            const { isFullView, pageNo, pageSize } = StateModule.get();
            const pageInfoEl = document.getElementById('pct-page-info');
            const prevBtn = document.getElementById('pct-prev-page');
            const nextBtn = document.getElementById('pct-next-page');
            const paginationEl = document.querySelector('.pct-pagination');
            
            if (!pageInfoEl || !prevBtn || !nextBtn || !paginationEl) return;
            if (isFullView || totalItems === 0) {
                paginationEl.style.visibility = 'hidden';
            } else {
                paginationEl.style.visibility = 'visible';
                const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
                pageInfoEl.textContent = `${pageNo} / ${maxPage}`;
                prevBtn.disabled = pageNo <= 1;
                nextBtn.disabled = pageNo >= maxPage;
            }
        };

        return { initialize };
    })();

    document.querySelectorAll(`#${ConfigModule.TOOL_ID}, #${ConfigModule.STYLE_ID}, .pct-toast`).forEach(el => el.remove());
    ControllerModule.initialize();

})();
