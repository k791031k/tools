javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * 書籤小工具 - 個人案件派發專用版 v3.0 (含演練模式)
     * =================================================================================
     * 概述：
     * 本工具專為「個人案件派發」設計，提供從案件查詢、篩選、勾選到
     * 指派人員的完整流程。它具備 Token 自動檢核、分頁資料獲取、
     * 狀態與關鍵字雙重篩選、可拖曳式 UI 以及無需 Token 的演練模式。
     *
     * 核心模組職責：
     * - Config:        集中管理所有靜態設定與常數。
     * - GlobalState:   提供全局響應式的狀態管理中心。
     * - Utils:         放置通用的、無副作用的工具函式。
     * - UI:            提供底層的 UI 元件（如 Modal, Toast）與樣式注入。
     * - EventHandlers: 集中處理通用的 UI 互動事件（如拖曳、鍵盤事件）。
     * - DataService:   封裝所有與後端 API 的通訊，並包含演練模式的模擬資料。
     * - UIComponents:  基於 UI 模組，建立與業務相關的特定 UI 元件。
     * - App:           應用程式的總控制器，協調所有模組執行核心流程。
     * =================================================================================
     */

    /**
     * @module Config
     * @description 全局靜態配置與常數管理模組。
     */
    const Config = Object.freeze({
        VERSION: '3.0.0-rehearsal-mode',
        TOOL_ID: 'pct-personal-tool-container',
        STYLE_ID: 'pct-personal-tool-styles',
        TOKEN_STORAGE_KEY: 'SSO-TOKEN',
        API_ENDPOINTS: {
            queryPersonalCases: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually',
            fetchPersonnel: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp'
        },
        BATCH_CONFIG: {
            defaultDispatchOrg: 'H',
            pageSize: 50
        },
        ZINDEX: {
            NOTIFY: 2147483647,
            OVERLAY: 2147483640,
            MAIN_MODAL: 2147483641
        },
        UI_COLORS: {
            PRIMARY: '#007bff',
            PRIMARY_DARK: '#0056b3',
            SECONDARY: '#6C757D',
            SUCCESS: '#28a745',
            ERROR: '#dc3545',
            WARNING: '#fd7e14',
            INFO: '#17a2b8'
        },
        MODAL_SIZES: {
            TOKEN_INPUT: 'token',
            PERSONAL_CASES: 'large',
            PERSONNEL_SELECT: 'medium'
        }
    });

    /**
     * @module GlobalState
     * @description 全局狀態管理模組，應用程式的單一數據來源。
     */
    const GlobalState = (() => {
        const detectEnv = () => window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test') ? 'UAT' : 'PROD';
        const state = {
            env: detectEnv(),
            token: null,
            modalPosition: { top: null, left: null },
            isRehearsalMode: false, // [新增] 演練模式旗標
            currentQueryController: null,
            personalCases: [],
            selectedCases: [],
            personnelList: []
        };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => {
                if (typeof k === 'object') {
                    Object.assign(state, k);
                } else {
                    state[k] = v;
                }
            }
        };
    })();

    /**
     * @module Utils
     * @description 通用工具函式模組。
     */
    const Utils = (() => {
        return {
            escapeHtml: (str) => {
                if (str === null || str === undefined) return '';
                if (typeof str !== 'string') str = String(str);
                const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
                return str.replace(/[&<>"']/g, m => map[m]);
            },
            findStoredToken: () => {
                const sources = [
                    () => localStorage.getItem(Config.TOKEN_STORAGE_KEY),
                    () => sessionStorage.getItem(Config.TOKEN_STORAGE_KEY),
                    () => localStorage.getItem('euisToken'),
                    () => sessionStorage.getItem('euisToken')
                ];
                for (const source of sources) {
                    const token = source();
                    if (token && token.trim()) return token.trim();
                }
                return null;
            },
            sleep: (ms) => new Promise(res => setTimeout(res, ms))
        };
    })();

    /**
     * @module UI
     * @description 底層通用 UI 元件模組。
     */
    const UI = (() => {
        function injectStyle() {
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Config.STYLE_ID;
            style.textContent = `
                :root {
                    --primary-color: ${Config.UI_COLORS.PRIMARY}; --primary-dark-color: ${Config.UI_COLORS.PRIMARY_DARK};
                    --secondary-color: ${Config.UI_COLORS.SECONDARY}; --success-color: ${Config.UI_COLORS.SUCCESS};
                    --error-color: ${Config.UI_COLORS.ERROR}; --warning-color: ${Config.UI_COLORS.WARNING};
                    --info-color: ${Config.UI_COLORS.INFO};
                }
                .pct-modal-mask {
                    position: fixed; z-index: ${Config.ZINDEX.OVERLAY}; top: 0; left: 0;
                    width: 100vw; height: 100vh; background: rgba(0,0,0,0.6);
                    opacity: 0; transition: opacity 0.25s ease-out; display: flex; align-items: center; justify-content: center;
                }
                .pct-modal-mask.show { opacity: 1; }
                .pct-modal {
                    font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #FFFFFF;
                    border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.15); padding: 0;
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    z-index: ${Config.ZINDEX.MAIN_MODAL}; display: flex; flex-direction: column;
                    opacity: 0; transition: opacity 0.2s ease-out; max-height: 90vh; max-width: 95vw; box-sizing: border-box;
                }
                .pct-modal.show-init { opacity: 1; }
                .pct-modal.dragging { transition: none !important; }
                .pct-modal[data-size="token"] { width: 500px; }
                .pct-modal[data-size="medium"] { width: 600px; }
                .pct-modal[data-size="large"] { width: 85vw; }
                .pct-modal-header {
                    padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0;
                    color: #1a1a1a; cursor: grab; position: relative; flex-shrink: 0; text-align: center;
                }
                .pct-modal-header.dragging { cursor: grabbing; }
                .pct-modal-close-btn {
                    position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 28px;
                    font-weight: bold; color: var(--secondary-color); cursor: pointer; width: 36px; height: 36px;
                    border-radius: 50%; transition: all .2s; display: flex; align-items: center; justify-content: center; line-height: 1;
                }
                .pct-modal-close-btn:hover { background-color: #f0f0f0; color: #333; transform: rotate(90deg) scale(1.1); }
                .pct-modal-body { padding: 16px 20px; flex-grow: 1; overflow-y: auto; min-height: 50px; }
                .pct-modal-footer {
                    padding: 12px 20px 16px 20px; border-top: 1px solid #E0E0E0;
                    display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;
                }
                .pct-btn {
                    display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; font-size: 15px;
                    border-radius: 6px; border: 1px solid transparent; background: var(--primary-color); color: #fff;
                    cursor: pointer; transition: all 0.25s ease-in-out; font-weight: 600; white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .pct-btn:not([disabled]):hover { background: var(--primary-dark-color); transform: translateY(-2px); box-shadow: 0 4px 8px rgba(74,144,226,0.3); }
                .pct-btn[disabled] { background-color: #d6d6d6; border-color: #d6d6d6; cursor: not-allowed; color: #9e9e9e; }
                .pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
                .pct-btn.pct-btn-outline:not([disabled]):hover { background-color: #F8F8F8; }
                .pct-input, textarea.pct-input {
                    width: 100%; font-size: 16px; padding: 9px 12px; border-radius: 5px; box-sizing: border-box;
                    border: 1px solid #E0E0E0; margin-top: 5px; transition: all .2s;
                }
                .pct-input:focus { border-color: var(--primary-color); box-shadow: 0 0 0 3px rgba(74,144,226,0.2); outline: none; }
                .pct-toast {
                    position: fixed; left: 50%; top: 30px; transform: translateX(-50%); background: rgba(0,0,0,0.8);
                    color: #fff; padding: 10px 22px; border-radius: 6px; font-size: 16px; z-index: ${Config.ZINDEX.NOTIFY};
                    opacity: 0; transition: opacity .3s, transform .3s; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }
                .pct-toast.show { opacity: 1; }
                .pct-toast.info { background: var(--info-color); }
                .pct-toast.success { background: var(--success-color); }
                .pct-toast.error { background: var(--error-color); }
                .pct-toast.warning { background: var(--warning-color); }
                .pct-progress-overlay {
                    position: fixed; inset: 0; background-color: rgba(255, 255, 255, 0.8);
                    z-index: ${Config.ZINDEX.NOTIFY}; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: #333; font-size: 1.2rem; font-weight: bold;
                }
                .pct-filter-buttons { margin-bottom: 10px; user-select:none; }
                .pct-filter-buttons button {
                    margin-right: 6px; padding: 5px 12px; border-radius: 4px; border: 1px solid var(--primary-color);
                    background: white; color: var(--primary-color); cursor: pointer; font-size: 13px;
                }
                .pct-filter-buttons button.active { background: var(--primary-color); color: white; }
                .pct-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .pct-table thead { background-color: #f8f9fa; position: sticky; top: -1px; z-index: 1; }
                .pct-table th, .pct-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
                .pct-table tbody tr:hover { background-color: #f1f3f5; }
                #pct-selection-info { font-weight: 600; color: #333; }
            `;
            document.head.appendChild(style);
        }

        const Toast = {
            show: (msg, type = 'info', duration = 3000) => {
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
        };

        const Progress = {
            show(text) {
                this.hide();
                const progress = document.createElement('div');
                progress.id = 'pctProgress';
                progress.className = 'pct-progress-overlay';
                progress.innerHTML = `<div>${Utils.escapeHtml(text)}</div>`;
                document.body.appendChild(progress);
            },
            update(percentage, text) {
                const progress = document.getElementById('pctProgress');
                if (progress) progress.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percentage}%</div>`;
            },
            hide() {
                document.getElementById('pctProgress')?.remove();
            }
        };

        const Modal = {
            close: () => {
                const modal = document.getElementById(Config.TOOL_ID);
                if (modal) {
                    GlobalState.set({ modalPosition: { top: modal.style.top, left: modal.style.left } });
                }
                GlobalState.get('currentQueryController')?.abort();
                document.getElementById('pctModalMask')?.remove();
                modal?.remove();
                document.removeEventListener('keydown', EventHandlers.handleEscKey);
            },
            show: (options) => {
                return new Promise(resolve => {
                    const { top, left } = GlobalState.get('modalPosition');
                    Modal.close();
                    const mask = document.createElement('div');
                    mask.id = 'pctModalMask';
                    mask.className = 'pct-modal-mask';
                    document.body.appendChild(mask);
                    requestAnimationFrame(() => mask.classList.add('show'));

                    const modal = document.createElement('div');
                    modal.id = Config.TOOL_ID;
                    modal.className = 'pct-modal';
                    if (options.size) modal.dataset.size = options.size;
                    modal.innerHTML = `
                        <div class="pct-modal-header">${options.header}<button class="pct-modal-close-btn">&times;</button></div>
                        <div class="pct-modal-body">${options.body}</div>
                        <div class="pct-modal-footer">${options.footer}</div>`;

                    if (top && left) {
                        modal.style.top = top;
                        modal.style.left = left;
                        modal.style.transform = 'none';
                    }

                    document.body.appendChild(modal);
                    requestAnimationFrame(() => modal.classList.add('show-init'));

                    modal.querySelector('.pct-modal-header').addEventListener('mousedown', EventHandlers.dragMouseDown);
                    modal.querySelector('.pct-modal-close-btn').addEventListener('click', () => {
                        Modal.close();
                        resolve({ action: '_close_tool_' });
                    });
                    EventHandlers.setupGlobalKeyListener();
                    if (options.onOpen) options.onOpen(modal, resolve);
                });
            }
        };

        return { injectStyle, Toast, Modal, Progress };
    })();

    /**
     * @module EventHandlers
     * @description UI 行為事件集中管理模組。
     */
    const EventHandlers = (() => {
        const dragState = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };
        function dragMouseDown(e) {
            const modal = document.getElementById(Config.TOOL_ID);
            if (!modal || (e.target.closest && e.target.closest('.pct-modal-close-btn'))) return;
            e.preventDefault();
            dragState.isDragging = true;
            modal.classList.add('dragging');
            const rect = modal.getBoundingClientRect();
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;
            dragState.initialLeft = rect.left;
            dragState.initialTop = rect.top;
            document.addEventListener('mousemove', elementDrag);
            document.addEventListener('mouseup', closeDragElement);
        }
        function elementDrag(e) {
            if (!dragState.isDragging) return;
            e.preventDefault();
            const modal = document.getElementById(Config.TOOL_ID);
            if (!modal) return;
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            modal.style.left = `${dragState.initialLeft + dx}px`;
            modal.style.top = `${dragState.initialTop + dy}px`;
            modal.style.transform = 'none';
        }
        function closeDragElement() {
            dragState.isDragging = false;
            document.getElementById(Config.TOOL_ID)?.classList.remove('dragging');
            document.removeEventListener('mousemove', elementDrag);
            document.removeEventListener('mouseup', closeDragElement);
        }
        function handleEscKey(e) {
            if (e.key === 'Escape') UI.Modal.close();
        }
        function setupGlobalKeyListener() {
            document.removeEventListener('keydown', handleEscKey);
            document.addEventListener('keydown', handleEscKey);
        }
        return { dragMouseDown, handleEscKey, setupGlobalKeyListener };
    })();

    /**
     * @module DataService
     * @description API 服務，封裝所有與後端 API 的通訊，並包含演練模式的模擬資料。
     */
    const DataService = (() => {
        // [新增] 演練模式使用的假資料
        const MockData = {
            getPersonalCases: async () => {
                await Utils.sleep(500); // 模擬網路延遲
                const mockCases = [
                    { applyNumber: 'MOCK001', ownerName: '陳大文', insuredName: '林小美', assignStatusDesc: '核保中' },
                    { applyNumber: 'MOCK002', ownerName: '王小明', insuredName: '王小明', assignStatusDesc: '已派件' },
                    { applyNumber: 'MOCK003', ownerName: '張美麗', insuredName: '李國強', assignStatusDesc: '待補文件' },
                    { applyNumber: 'MOCK004', ownerName: '黃市場', insuredName: '黃市場', assignStatusDesc: '核保中' },
                    { applyNumber: 'MOCK005', ownerName: '趙一德', insuredName: '孫二娘', assignStatusDesc: '已派件' },
                    { applyNumber: 'MOCK006', ownerName: '錢夫人', insuredName: '周小弟', assignStatusDesc: '照會中' },
                    { applyNumber: 'MOCK007', ownerName: '吳先生', insuredName: '吳先生', assignStatusDesc: '核保中' },
                    { applyNumber: 'MOCK008', ownerName: '鄭成功', insuredName: '鄭失敗', assignStatusDesc: '待補文件' },
                    { applyNumber: 'MOCK009', ownerName: '馮寶寶', insuredName: '馮寶寶', assignStatusDesc: '核保中' },
                    { applyNumber: 'MOCK010', ownerName: '衛宮士郎', insuredName: '遠坂凜', assignStatusDesc: '已派件' },
                ];
                return { records: mockCases, total: mockCases.length };
            },
            getPersonnel: async () => {
                await Utils.sleep(300);
                return [
                    { adAccount: 'test.userA', userName: '測試人員A' },
                    { adAccount: 'test.userB', userName: '測試人員B' },
                    { adAccount: 'test.userC', userName: '測試人員C' },
                ];
            },
            assignManually: async () => {
                await Utils.sleep(800);
                return { success: true, message: 'Rehearsal assignment complete.' };
            }
        };
        
        // 底層的 fetch 函數，統一處理 Token 和錯誤
        async function baseFetch(url, options) {
            const token = GlobalState.get('token');
            if (!token) throw new Error('TOKEN_IS_MISSING');
            options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' };
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) throw new Error('TOKEN_IS_INVALID');
            if (!response.ok) {
                const err = new Error(`HTTP_ERROR_${response.status}`);
                try { err.data = await response.json(); } catch (e) { err.data = await response.text(); }
                throw err;
            }
            return response.json();
        }

        return {
            queryPersonalCases: async (signal) => {
                // [修改] 檢查是否為演練模式
                if (GlobalState.get('isRehearsalMode')) {
                    UI.Progress.show('載入演練案件...');
                    return MockData.getPersonalCases();
                }
                
                let allRecords = [];
                let currentPage = 1;
                let totalPages = 1;
                while (currentPage <= totalPages) {
                    const payload = { nowPage: currentPage, pageSize: Config.BATCH_CONFIG.pageSize, orderBy: 'assignId', ascOrDesc: 'desc' };
                    UI.Progress.update(totalPages > 1 ? Math.round(100 * currentPage / totalPages) : 50, `正在載入個人案件 第 ${currentPage} / ${totalPages === 1 ? '?' : totalPages} 頁...`);
                    const result = await baseFetch(Config.API_ENDPOINTS.queryPersonalCases, { method: 'POST', body: JSON.stringify(payload), signal });
                    if (result && result.records && result.records.length > 0) {
                        allRecords = allRecords.concat(result.records);
                        if (currentPage === 1 && result.total) {
                            totalPages = Math.ceil(result.total / Config.BATCH_CONFIG.pageSize);
                        }
                    } else {
                        break;
                    }
                    currentPage++;
                }
                return { records: allRecords, total: allRecords.length };
            },
            fetchPersonnel: (signal) => {
                // [修改] 檢查是否為演練模式
                if (GlobalState.get('isRehearsalMode')) {
                    return MockData.getPersonnel();
                }
                const payload = { validDate: 'true', orderBys: ['userName asc', 'adAccount asc'] };
                return baseFetch(Config.API_ENDPOINTS.fetchPersonnel, { method: 'POST', body: JSON.stringify(payload), signal });
            },
            assignManually: (applyNumbers, auditor, signal) => {
                // [修改] 檢查是否為演練模式
                if (GlobalState.get('isRehearsalMode')) {
                    return MockData.assignManually();
                }
                const payload = { dispatchOrgAf: Config.BATCH_CONFIG.defaultDispatchOrg, auditorAf: auditor, dispatchOrgBf: '', applyNumbers: applyNumbers };
                return baseFetch(Config.API_ENDPOINTS.assignManually, { method: 'POST', body: JSON.stringify(payload), signal });
            }
        };
    })();

    /**
     * @module UIComponents
     * @description 業務特定 UI 元件模組。
     */
    const UIComponents = (() => {
        // [修改] 新增「進入演練模式」按鈕
        function showTokenDialog(showRetryBtn = false) {
             const { token, env } = GlobalState.get();
             const retryHtml = showRetryBtn ? `<div style="text-align:center; margin-bottom: 15px;"><button id="pct-retry-token" class="pct-btn pct-btn-outline" style="font-size:13px; padding:6px 12px;">🔄 重新自動檢測</button></div>` : '';
             return UI.Modal.show({
                 header: `Token 設定 (${env} 環境)`,
                 body: `${retryHtml}<label for="pct-token-input" style="font-size:14px; color:#333; display:block; margin-bottom:5px;">請貼上您的 SSO-TOKEN：</label><textarea id="pct-token-input" class="pct-input" rows="4" placeholder="請從開發者工具中複製 TOKEN...">${Utils.escapeHtml(token || '')}</textarea>`,
                 footer: `
                    <button id="pct-rehearsal-mode" class="pct-btn pct-btn-outline">進入演練模式</button>
                    <div style="display:flex; gap:10px;">
                        <button id="pct-confirm-token" class="pct-btn">儲存並繼續</button>
                    </div>
                 `,
                 size: Config.MODAL_SIZES.TOKEN_INPUT,
                 onOpen: (modal, resolve) => {
                     const tokenInput = modal.querySelector('#pct-token-input');
                     const handleConfirm = () => { const val = tokenInput.value.trim(); if (!val) {UI.Toast.show('請輸入 TOKEN', 'error'); return;} resolve({ action: '_confirm_', value: val }); UI.Modal.close(); };
                     modal.querySelector('#pct-confirm-token').addEventListener('click', handleConfirm);
                     modal.querySelector('#pct-retry-token')?.addEventListener('click', () => { resolve({ action: '_retry_autocheck_' }); UI.Modal.close(); });
                     modal.querySelector('#pct-rehearsal-mode').addEventListener('click', () => { resolve({ action: '_rehearsal_mode_' }); UI.Modal.close(); }); // 新增的事件
                     tokenInput.focus();
                 }
             });
        }
        
        function showPersonalCasesDialog(cases) {
            const isRehearsal = GlobalState.get('isRehearsalMode');
            const headerText = `個人案件派發 ${isRehearsal ? '<span style="color: var(--warning-color); font-size: 16px;">(演練模式)</span>' : ''}`;
            const statusCount = cases.reduce((acc, c) => { const status = c.assignStatusDesc || c.mainStatus || '未知'; acc[status] = (acc[status] || 0) + 1; return acc; }, {});
            let filterButtonsHtml = `<button data-status="all" class="active">全部 (${cases.length})</button>`;
            Object.entries(statusCount).forEach(([st, count]) => { filterButtonsHtml += `<button data-status="${Utils.escapeHtml(st)}">${Utils.escapeHtml(st)} (${count})</button>`; });
            const tableRows = cases.map(c => {
                const searchData = [c.applyNumber, c.ownerName, c.policyHolderName, c.insuredName].filter(Boolean).join(' ').toLowerCase();
                return `<tr data-status="${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '未知')}" data-search-term="${Utils.escapeHtml(searchData)}">
                        <td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td>
                        <td>${Utils.escapeHtml(c.applyNumber)}</td>
                        <td>${Utils.escapeHtml(c.ownerName || c.policyHolderName || '')}</td>
                        <td>${Utils.escapeHtml(c.insuredName || '')}</td>
                        <td>${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '')}</td>
                    </tr>`;
            }).join('');

            return UI.Modal.show({
                header: headerText,
                body: `
                    <div class="pct-filter-buttons">${filterButtonsHtml}</div>
                    <div style="margin: 10px 0; padding: 5px; background-color: #f0f8ff; border: 1px solid #e0e0e0; border-radius: 5px;">
                        <input type="text" id="pct-search-input" class="pct-input" placeholder="🔍 在此輸入要保號、要保人或被保人姓名進行搜尋..." style="margin-top:0;">
                    </div>
                    <div style="overflow-y: auto; max-height: calc(80vh - 270px);">
                        <table class="pct-table">
                            <thead><tr>
                                <th><input type="checkbox" id="select-all-checkbox"></th>
                                <th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th>
                            </tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>`,
                footer: `
                    <div id="pct-selection-info">已選 0 筆</div>
                    <div style="display:flex; gap:10px;">
                        <button id="change-token-btn" class="pct-btn pct-btn-outline">變更Token</button>
                        <button id="next-btn" class="pct-btn" disabled>下一步</button>
                    </div>`,
                size: Config.MODAL_SIZES.PERSONAL_CASES,
                onOpen: (modal, resolve) => {
                    const selectAll = modal.querySelector('#select-all-checkbox'), checkboxes = modal.querySelectorAll('.case-checkbox'), info = modal.querySelector('#pct-selection-info'), nextBtn = modal.querySelector('#next-btn'), searchInput = modal.querySelector('#pct-search-input'), tableRows = modal.querySelectorAll('tbody tr');
                    const applyFilters = () => {
                        const activeStatus = modal.querySelector('.pct-filter-buttons button.active').dataset.status;
                        const searchTerm = searchInput.value.toLowerCase().trim();
                        tableRows.forEach(row => {
                            const statusMatch = (activeStatus === 'all' || row.dataset.status === activeStatus);
                            const searchMatch = (searchTerm === '' || row.dataset.searchTerm.includes(searchTerm));
                            row.style.display = (statusMatch && searchMatch) ? '' : 'none';
                        });
                        updateSelection();
                    };
                    const updateSelection = () => {
                        const visible = [...checkboxes].filter(cb => cb.closest('tr').style.display !== 'none');
                        const checked = visible.filter(cb => cb.checked);
                        info.textContent = `已選 ${checked.length} 筆 / 共 ${cases.length} 筆`;
                        nextBtn.disabled = checked.length === 0;
                        selectAll.checked = visible.length > 0 && checked.length === visible.length;
                        selectAll.indeterminate = checked.length > 0 && checked.length < visible.length;
                        GlobalState.set({ selectedCases: checked.map(cb => cb.value) });
                    };
                    modal.querySelectorAll('.pct-filter-buttons button').forEach(btn => btn.addEventListener('click', () => { modal.querySelector('.pct-filter-buttons button.active').classList.remove('active'); btn.classList.add('active'); applyFilters(); }));
                    searchInput.addEventListener('input', applyFilters);
                    selectAll.addEventListener('change', () => { [...checkboxes].filter(cb => cb.closest('tr').style.display !== 'none').forEach(cb => cb.checked = selectAll.checked); updateSelection(); });
                    checkboxes.forEach(cb => cb.addEventListener('change', updateSelection));
                    nextBtn.addEventListener('click', () => resolve({ action: '_next_step_' }));
                    modal.querySelector('#change-token-btn').addEventListener('click', () => { UI.Modal.close(); resolve({ action: '_change_token_' }); });
                    updateSelection();
                }
            });
        }
        
        function showPersonnelSelectDialog(personnelList) {
            const isRehearsal = GlobalState.get('isRehearsalMode');
            const headerText = `選擇派件人員 ${isRehearsal ? '<span style="color: var(--warning-color); font-size: 16px;">(演練模式)</span>' : ''}`;
            const personnelOptions = personnelList.map(p => `<option value="${Utils.escapeHtml(p.adAccount)}">${Utils.escapeHtml(p.userName)} (${Utils.escapeHtml(p.adAccount)})</option>`).join('');
            return UI.Modal.show({
                header: headerText,
                body: `
                    <p>您已選擇 <strong>${GlobalState.get('selectedCases').length}</strong> 筆案件</p>
                    <div style="margin-top: 1rem;">
                        ${personnelList.length > 0 ? `<label for="personnel-select">請選擇派件人員：</label><select id="personnel-select" class="pct-input">${personnelOptions}</select>` : '<p style="color:var(--error-color);">查無可用人員清單，請使用下方手動輸入。</p>'}
                    </div>
                    <div style="margin-top: 1rem;">
                        <label><input type="checkbox" id="use-manual-input"> 手動輸入帳號</label>
                        <input type="text" id="manual-employee-id" class="pct-input" placeholder="請輸入員工 AD 帳號" style="display:none;">
                    </div>`,
                footer: `<button id="btn-back" class="pct-btn pct-btn-outline">返回</button><button id="btn-confirm" class="pct-btn" disabled>確認派件</button>`,
                size: Config.MODAL_SIZES.PERSONNEL_SELECT,
                onOpen: (modal, resolve) => {
                    const selectElem = modal.querySelector('#personnel-select'), manualCheck = modal.querySelector('#use-manual-input'), manualInput = modal.querySelector('#manual-employee-id'), confirmBtn = modal.querySelector('#btn-confirm');
                    const updateBtnState = () => { confirmBtn.disabled = manualCheck.checked ? manualInput.value.trim() === '' : !selectElem || selectElem.value === ''; };
                    manualCheck.addEventListener('change', () => { const isChecked = manualCheck.checked; manualInput.style.display = isChecked ? 'block' : 'none'; if (selectElem) selectElem.disabled = isChecked; updateBtnState(); });
                    if (selectElem) selectElem.addEventListener('change', updateBtnState);
                    manualInput.addEventListener('input', updateBtnState);
                    modal.querySelector('#btn-back').addEventListener('click', () => resolve({ action: '_back_' }));
                    confirmBtn.addEventListener('click', () => { const assignee = manualCheck.checked ? manualInput.value.trim() : selectElem.value; if (!assignee) { UI.Toast.show('請選擇或輸入派件人員', 'error'); return; } resolve({ action: '_confirm_assignment_', assignee }); });
                    if (personnelList.length === 0) { manualCheck.checked = true; manualCheck.dispatchEvent(new Event('change')); manualCheck.disabled = true; }
                    updateBtnState();
                }
            });
        }
        
        return { showTokenDialog, showPersonalCasesDialog, showPersonnelSelectDialog };
    })();

    /**
     * @module App
     * @description 主流程控制模組。
     */
    const App = (() => {
        async function performAssignment(assignee) {
            const isRehearsal = GlobalState.get('isRehearsalMode');
            const progressText = isRehearsal ? '執行演練派件中…' : '執行派件中…';
            UI.Progress.show(progressText);
            try {
                await DataService.assignManually(GlobalState.get('selectedCases'), assignee);
                UI.Progress.hide();
                const message = isRehearsal ? `(演練) 成功派件 ${GlobalState.get('selectedCases').length} 筆案件` : `成功派件 ${GlobalState.get('selectedCases').length} 筆案件`;
                UI.Toast.show(message, 'success', 5000);
                return true;
            } catch (e) {
                UI.Progress.hide();
                UI.Toast.show(`派件失敗: ${e.message}`, 'error', 5000);
                return false;
            }
        }
        
        async function handleAssignmentFlow() {
            UI.Progress.show('載入人員列表中…');
            let personnelList = GlobalState.get('personnelList');
            if (!personnelList || personnelList.length === 0) {
                 try {
                     const res = await DataService.fetchPersonnel();
                     personnelList = res ? (Array.isArray(res) ? res : (res.records || [])) : [];
                     GlobalState.set({ personnelList });
                 } catch (e) { UI.Toast.show(`取得人員清單錯誤: ${e.message}`, 'error'); }
            }
            UI.Progress.hide();
            const result = await UIComponents.showPersonnelSelectDialog(personnelList);
            UI.Modal.close();
            if (result.action === '_confirm_assignment_') {
                const success = await performAssignment(result.assignee);
                if (success) await startPersonalCasesFlow();
            } else if (result.action === '_back_') {
                await startPersonalCasesFlow(true);
            }
        }
        
        async function startPersonalCasesFlow(useCache = false) {
            if (!useCache) {
                UI.Progress.show('載入個人案件中…');
                try {
                    const res = await DataService.queryPersonalCases();
                    GlobalState.set({ personalCases: res.records || [], selectedCases: [] });
                } catch (e) {
                    UI.Progress.hide();
                    UI.Toast.show(`載入案件錯誤: ${e.message}`, 'error');
                    if (e.message === 'TOKEN_IS_INVALID' && !GlobalState.get('isRehearsalMode')) showTokenDialogFlow(true);
                    return;
                }
                UI.Progress.hide();
            }
            const result = await UIComponents.showPersonalCasesDialog(GlobalState.get('personalCases'));
            if (result.action === '_next_step_') {
                await handleAssignmentFlow();
            } else if (result.action === '_change_token_') {
                showTokenDialogFlow(false, true);
            } else if (result.action === '_close_tool_') {
                UI.Toast.show('工具已關閉', 'info');
            }
        }
        
        // [修改] 增加處理演練模式的邏輯
        async function showTokenDialogFlow(showRetryBtn, isChanging = false) {
            if (isChanging) {
                localStorage.removeItem(Config.TOKEN_STORAGE_KEY);
                GlobalState.set({ token: null, isRehearsalMode: false }); // 更換 Token 時，同時脫離演練模式
                UI.Toast.show('請輸入新的 Token', 'info');
            }
            const result = await UIComponents.showTokenDialog(showRetryBtn);
            switch (result.action) {
                case '_confirm_':
                    GlobalState.set({ token: result.value, isRehearsalMode: false });
                    localStorage.setItem(Config.TOKEN_STORAGE_KEY, result.value);
                    UI.Toast.show('Token 已儲存', 'success');
                    startPersonalCasesFlow();
                    break;
                case '_retry_autocheck_':
                    autoCheckToken();
                    break;
                case '_rehearsal_mode_': // 新增的處理 case
                    GlobalState.set({ isRehearsalMode: true, token: null });
                    UI.Toast.show('已進入演練模式', 'info');
                    await Utils.sleep(500);
                    startPersonalCasesFlow();
                    break;
                default:
                     UI.Toast.show('操作已取消', 'info');
                     break;
            }
        }

        async function autoCheckToken() {
            UI.Progress.show('正在自動檢測 Token...');
            await Utils.sleep(300);
            const storedToken = Utils.findStoredToken();
            UI.Progress.hide();

            if (storedToken) {
                GlobalState.set({ token: storedToken, isRehearsalMode: false });
                UI.Toast.show('已自動載入 Token', 'success', 1500);
                await Utils.sleep(500);
                startPersonalCasesFlow();
            } else {
                UI.Toast.show('未找到可用 Token，請手動輸入', 'warning');
                await Utils.sleep(500);
                showTokenDialogFlow(true);
            }
        }

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
        App.initialize();
    })();

})();