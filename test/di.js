javascript:(function() {
    'use strict';

    /**
     * =================================================================================
     * 書籤小工具 - 多功能派件整合版 v2.0
     * =================================================================================
     * 概述：
     * 本工具整合了「個人案件派發」與「批次查詢派工」兩大核心功能。
     * 採用模組化架構，並內建 Token 自動檢核、可拖曳式 UI 及友善的錯誤提示。
     *
     * 核心模組職責：
     * - Config:        集中管理所有靜態設定與常數。
     * - GlobalState:   提供全局響應式的狀態管理中心。
     * - Utils:         放置通用的、無副作用的工具函式。
     * - UI:            提供底層的 UI 元件（如 Modal, Toast）與樣式注入。
     * - EventHandlers: 集中處理通用的 UI 互動事件（如拖曳、鍵盤事件）。
     * - DataService:   封裝所有與後端 API 的通訊。
     * - AssignmentModule: 處理批次查詢與派件的核心業務邏輯。
     * - UIComponents:  基於 UI 模組，建立與業務相關的特定 UI 元件。
     * - App:           應用程式的總控制器，負責協調所有模組，執行主要流程。
     * =================================================================================
     */

    /**
     * @module Config
     * @description 全局靜態配置與常數管理模組。
     */
    const Config = Object.freeze({
        VERSION: '2.0.0-multi-function',
        TOOL_ID: 'pct-multifunction-tool-container',
        STYLE_ID: 'pct-multifunction-tool-styles',
        TOKEN_STORAGE_KEY: 'euisToken',
        API_ENDPOINTS: {
            // 個人案件
            queryPersonalCases: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
            fetchPersonnel: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp',
            // 批次作業
            findProposal: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            // 通用
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
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
            MODE_SELECT: 'mode-select',
            PERSONAL_CASES: 'large',
            PERSONNEL_SELECT: 'medium',
            BATCH_SETUP: 'medium'
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
            splitInput: (text) => text.split(/[\s,，\n]+/).filter(Boolean),
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
                .pct-modal[data-size="mode-select"] { width: 400px; }
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
     * @description API 服務，封裝所有與後端 API 的通訊。
     */
    const DataService = (() => {
        async function baseFetch(url, options) {
            const token = GlobalState.get('token');
            if (!token) throw new Error('TOKEN_IS_MISSING');

            options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' };

            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) throw new Error('TOKEN_IS_INVALID');
            if (!response.ok) {
                const errorBody = await response.text();
                const err = new Error(`HTTP_ERROR_${response.status}`);
                try { err.data = JSON.parse(errorBody); } catch (e) { err.data = errorBody; }
                throw err;
            }
            return response.json();
        }
        return {
            queryPersonalCases: (signal) => {
                const payload = { nowPage: 1, pageSize: Config.BATCH_CONFIG.pageSize * 10, orderBy: 'assignId', ascOrDesc: 'desc' }; // 增加查詢筆數
                return baseFetch(Config.API_ENDPOINTS.queryPersonalCases, { method: 'POST', body: JSON.stringify(payload), signal });
            },
            fetchPersonnel: (signal) => {
                const payload = { validDate: 'true', orderBys: ['userName asc', 'adAccount asc'] };
                return baseFetch(Config.API_ENDPOINTS.fetchPersonnel, { method: 'POST', body: JSON.stringify(payload), signal });
            },
            queryProposal: (applyNumber) => {
                const payload = { applyNumber, pageIndex: 1, size: 10 };
                return baseFetch(Config.API_ENDPOINTS.findProposal, { method: 'POST', body: JSON.stringify(payload) });
            },
            assignManually: (applyNumberList, auditor) => {
                const payload = { dispatchOrgAf: Config.BATCH_CONFIG.defaultDispatchOrg, auditorAf: auditor, dispatchOrgBf: "", applyNumbers: applyNumberList };
                return baseFetch(Config.API_ENDPOINTS.assignManually, { method: 'POST', body: JSON.stringify(payload) });
            }
        };
    })();

    /**
     * @module AssignmentModule
     * @description 處理批次查詢與派件的核心業務邏輯。
     */
    const AssignmentModule = (() => {
        async function execute({ auditor, applyNumbers }) {
            const successfulQueries = [];
            const failedQueries = [];
            
            for (let i = 0; i < applyNumbers.length; i++) {
                const number = applyNumbers[i];
                UI.Progress.update(Math.round(100 * (i + 1) / applyNumbers.length), `正在查詢 ${number}...`);
                try {
                    const result = await DataService.queryProposal(number);
                    if (result && result.records && result.records.length > 0) {
                        successfulQueries.push({ number });
                    } else {
                        failedQueries.push({ number, reason: '查無資料' });
                    }
                } catch (error) {
                    throw new Error(`查詢案件 ${number} 失敗，請檢查 Token 或網路連線。錯誤: ${error.message}`);
                }
            }
            
            if (successfulQueries.length === 0) {
                return { success: false, message: '無任何可供派工的案件。', successfulCount: 0, failedQueries, assignmentResponse: null };
            }
            
            UI.Progress.show(`查詢完成，正在派件 ${successfulQueries.length} 筆...`);
            const numbersToAssign = successfulQueries.map(item => item.number);
            const assignmentResponse = await DataService.assignManually(numbersToAssign, auditor);
            
            return { success: true, message: '批次指派成功。', successfulCount: numbersToAssign.length, failedQueries, assignmentResponse };
        }
        return { execute };
    })();

    /**
     * @module UIComponents
     * @description 業務特定 UI 元件模組。
     */
    const UIComponents = (() => {
        function showTokenDialog(showRetryBtn = false) {
             const { token, env } = GlobalState.get();
             const retryHtml = showRetryBtn ? `<div style="text-align:center; margin-bottom: 15px;"><button id="pct-retry-token" class="pct-btn pct-btn-outline" style="font-size:13px; padding:6px 12px;">🔄 重新自動檢測</button></div>` : '';
             return UI.Modal.show({
                 header: `Token 設定 (${env} 環境)`,
                 body: `${retryHtml}<label for="pct-token-input" style="font-size:14px; color:#333; display:block; margin-bottom:5px;">請貼上您的 SSO-TOKEN：</label><textarea id="pct-token-input" class="pct-input" rows="4" placeholder="請從開發者工具中複製 TOKEN...">${Utils.escapeHtml(token || '')}</textarea>`,
                 footer: `<button id="pct-confirm-token" class="pct-btn">儲存並繼續</button>`,
                 size: Config.MODAL_SIZES.TOKEN_INPUT,
                 onOpen: (modal, resolve) => {
                     const tokenInput = modal.querySelector('#pct-token-input');
                     const handleConfirm = () => { const val = tokenInput.value.trim(); if (!val) {UI.Toast.show('請輸入 TOKEN', 'error'); return;} resolve({ action: '_confirm_', value: val }); UI.Modal.close(); };
                     modal.querySelector('#pct-confirm-token').addEventListener('click', handleConfirm);
                     modal.querySelector('#pct-retry-token')?.addEventListener('click', () => { resolve({ action: '_retry_autocheck_' }); UI.Modal.close(); });
                     tokenInput.focus();
                 }
             });
        }
        
        function showModeSelectDialog() {
            return UI.Modal.show({
                header: `選擇工作模式`,
                body: `<p style="text-align:center; margin-bottom:20px;">請選擇您要使用的功能：</p>
                       <div style="display:flex; flex-direction:column; gap:15px;">
                           <button id="mode-personal" class="pct-btn">個人案件派發</button>
                           <button id="mode-batch" class="pct-btn">批次查詢與派件</button>
                       </div>`,
                footer: `<span>版本: ${Config.VERSION}</span><button id="change-token" class="pct-btn pct-btn-outline">變更 Token</button>`,
                size: Config.MODAL_SIZES.MODE_SELECT,
                onOpen: (modal, resolve) => {
                    modal.querySelector('#mode-personal').addEventListener('click', () => resolve({ action: 'personal' }));
                    modal.querySelector('#mode-batch').addEventListener('click', () => resolve({ action: 'batch' }));
                    modal.querySelector('#change-token').addEventListener('click', () => resolve({ action: '_change_token_' }));
                }
            });
        }

        function showPersonalCasesDialog(cases) {
            const statusCount = cases.reduce((acc, c) => { const s = c.assignStatusDesc || c.mainStatus || '未知'; acc[s] = (acc[s] || 0) + 1; return acc; }, {});
            let filterButtonsHtml = `<button data-status="all" class="active">全部 (${cases.length})</button>`;
            Object.entries(statusCount).forEach(([st, count]) => { filterButtonsHtml += `<button data-status="${Utils.escapeHtml(st)}">${Utils.escapeHtml(st)} (${count})</button>`; });
            const tableRows = cases.map(c => `<tr data-status="${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '未知')}"><td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td><td>${Utils.escapeHtml(c.applyNumber)}</td><td>${Utils.escapeHtml(c.ownerName || '')}</td><td>${Utils.escapeHtml(c.insuredName || '')}</td><td>${Utils.escapeHtml(c.assignStatusDesc || '')}</td></tr>`).join('');
            return UI.Modal.show({
                header: '個人案件派發',
                body: `<div class="pct-filter-buttons">${filterButtonsHtml}</div><div style="overflow-y: auto; max-height: calc(80vh - 220px);"><table class="pct-table"><thead><tr><th><input type="checkbox" id="select-all-checkbox"></th><th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5" style="text-align:center;">無案件</td></tr>'}</tbody></table></div>`,
                footer: `<div id="pct-selection-info">已選 0 筆</div><div style="display:flex; gap:10px;"><button id="back-btn" class="pct-btn pct-btn-outline">返回模式選擇</button><button id="next-btn" class="pct-btn" disabled>下一步</button></div>`,
                size: Config.MODAL_SIZES.PERSONAL_CASES,
                onOpen: (modal, resolve) => {
                    const all = modal.querySelector('#select-all-checkbox'), boxes = modal.querySelectorAll('.case-checkbox'), info = modal.querySelector('#pct-selection-info'), next = modal.querySelector('#next-btn');
                    const update = () => { const vis = [...boxes].filter(c=>c.closest('tr').style.display!=='none'), chk = vis.filter(c=>c.checked); info.textContent = `已選 ${chk.length} 筆 / 共 ${cases.length} 筆`; next.disabled = chk.length === 0; all.checked = vis.length > 0 && chk.length === vis.length; all.indeterminate = chk.length > 0 && chk.length < vis.length; GlobalState.set({ selectedCases: chk.map(c => c.value) }); };
                    modal.querySelectorAll('.pct-filter-buttons button').forEach(b => b.addEventListener('click', () => { modal.querySelector('.active').classList.remove('active'); b.classList.add('active'); const s = b.dataset.status; boxes.forEach(c => { c.closest('tr').style.display = (s === 'all' || c.closest('tr').dataset.status === s) ? '' : 'none'; }); update(); }));
                    all.addEventListener('change', () => { [...boxes].filter(c => c.closest('tr').style.display !== 'none').forEach(c => c.checked = all.checked); update(); });
                    boxes.forEach(c => c.addEventListener('change', update));
                    next.addEventListener('click', () => resolve({ action: '_next_step_' }));
                    modal.querySelector('#back-btn').addEventListener('click', () => resolve({ action: '_back_to_mode_' }));
                    update();
                }
            });
        }
        
        function showPersonnelSelectDialog(personnelList) {
            const opts = personnelList.map(p => `<option value="${Utils.escapeHtml(p.adAccount)}">${Utils.escapeHtml(p.userName)} (${Utils.escapeHtml(p.adAccount)})</option>`).join('');
            return UI.Modal.show({
                header: '選擇派件人員',
                body: `<p>您已選擇 <strong>${GlobalState.get('selectedCases').length}</strong> 筆案件</p><div style="margin-top:1rem;">${opts ? `<label for="p-select">請選擇人員：</label><select id="p-select" class="pct-input">${opts}</select>`: `<p style="color:var(--error-color);">查無人員清單，請手動輸入。</p>`}</div><div style="margin-top:1rem;"><label><input type="checkbox" id="m-check"> 手動輸入帳號</label><input type="text" id="m-input" class="pct-input" placeholder="請輸入 AD 帳號" style="display:none;"></div>`,
                footer: `<button id="btn-back" class="pct-btn pct-btn-outline">返回</button><button id="btn-confirm" class="pct-btn" disabled>確認派件</button>`,
                size: Config.MODAL_SIZES.PERSONNEL_SELECT,
                onOpen: (modal, resolve) => {
                    const sel = modal.querySelector('#p-select'), mc = modal.querySelector('#m-check'), mi = modal.querySelector('#m-input'), cf = modal.querySelector('#btn-confirm');
                    const update = () => { cf.disabled = mc.checked ? mi.value.trim() === '' : !sel || sel.value === ''; };
                    mc.addEventListener('change', () => { const i = mc.checked; mi.style.display = i ? 'block' : 'none'; if(sel) sel.disabled = i; update(); });
                    if(sel) sel.addEventListener('change', update);
                    mi.addEventListener('input', update);
                    modal.querySelector('#btn-back').addEventListener('click', () => resolve({ action: '_back_' }));
                    cf.addEventListener('click', () => { const a = mc.checked ? mi.value.trim() : sel.value; if (!a) {UI.Toast.show('請選擇或輸入派件人員', 'error'); return;} resolve({ action: '_confirm_assignment_', assignee: a }); });
                    if (!opts) { mc.checked = true; mc.dispatchEvent(new Event('change')); mc.disabled = true; }
                    update();
                }
            });
        }
        
        function showBatchSetupDialog() {
            return UI.Modal.show({
                header: '批次查詢與派件',
                body: `<div style="margin-bottom:15px;"><label for="b-auditor">指派對象 (AD 帳號)</label><input type="text" id="b-auditor" class="pct-input" placeholder="請輸入指派對象的 AD 帳號"></div><div><label for="b-numbers">要保書號碼 (多筆請換行)</label><textarea id="b-numbers" class="pct-input" rows="10" placeholder="請在此貼上多筆要保書號碼..."></textarea></div>`,
                footer: `<button id="btn-back" class="pct-btn pct-btn-outline">返回</button><button id="btn-start" class="pct-btn">開始執行</button>`,
                size: Config.MODAL_SIZES.BATCH_SETUP,
                onOpen: (modal, resolve) => {
                    const auditor = modal.querySelector('#b-auditor'), numbers = modal.querySelector('#b-numbers');
                    modal.querySelector('#btn-back').addEventListener('click', () => resolve({ action: '_back_to_mode_' }));
                    modal.querySelector('#btn-start').addEventListener('click', () => {
                        const a = auditor.value.trim(), n = Utils.splitInput(numbers.value);
                        if (!a) return UI.Toast.show('請輸入指派對象', 'error');
                        if (n.length === 0) return UI.Toast.show('請輸入要保書號碼', 'error');
                        resolve({ action: '_start_batch_', auditor: a, applyNumbers: n });
                    });
                    auditor.focus();
                }
            });
        }
        
        return { showTokenDialog, showModeSelectDialog, showPersonalCasesDialog, showPersonnelSelectDialog, showBatchSetupDialog };
    })();

    /**
     * @module App
     * @description 主流程控制模組。
     */
    const App = (() => {
        // [個人案件] 流程
        async function handlePersonalAssignmentFlow(isRetry = false) {
            UI.Progress.show('載入人員列表中…');
            let pList = GlobalState.get('personnelList');
            if (!isRetry || pList.length === 0) {
                 try {
                     const res = await DataService.fetchPersonnel();
                     pList = res ? (Array.isArray(res) ? res : (res.records || [])) : [];
                     GlobalState.set({ personnelList: pList });
                 } catch (e) { UI.Toast.show(`取得人員清單錯誤: ${e.message}`, 'error'); }
            }
            UI.Progress.hide();

            const result = await UIComponents.showPersonnelSelectDialog(pList);
            UI.Modal.close();
            
            if (result.action === '_confirm_assignment_') {
                UI.Progress.show('執行派件中…');
                try {
                    await DataService.assignManually(GlobalState.get('selectedCases'), result.assignee);
                    UI.Progress.hide();
                    UI.Toast.show(`成功派件 ${GlobalState.get('selectedCases').length} 筆`, 'success');
                    await Utils.sleep(1500);
                    handlePersonalCasesFlow(); // 成功後刷新
                } catch (e) {
                    UI.Progress.hide();
                    UI.Toast.show(`派件失敗: ${e.message}`, 'error');
                }
            } else if (result.action === '_back_') {
                handlePersonalCasesFlow(true);
            } else {
                startModeSelection(); // 取消則返回模式選擇
            }
        }
        
        async function handlePersonalCasesFlow(isRetry = false) {
            if (!isRetry) {
                UI.Progress.show('載入個人案件中…');
                try {
                    const res = await DataService.queryPersonalCases();
                    GlobalState.set({ personalCases: res.records || [] });
                } catch (e) { UI.Toast.show(`載入案件錯誤: ${e.message}`, 'error'); }
                UI.Progress.hide();
            }
            
            const result = await UIComponents.showPersonalCasesDialog(GlobalState.get('personalCases'));
            UI.Modal.close();

            if (result.action === '_next_step_') await handlePersonalAssignmentFlow();
            else startModeSelection();
        }

        // [批次作業] 流程
        async function handleBatchAssignmentFlow() {
            const setup = await UIComponents.showBatchSetupDialog();
            UI.Modal.close();

            if (!setup || setup.action === '_back_to_mode_') return startModeSelection();
            
            if (confirm(`準備將 ${setup.applyNumbers.length} 筆案件指派給【${setup.auditor}】。\n\n您確定要繼續嗎？`)) {
                UI.Progress.show('開始執行批次作業...');
                try {
                    const result = await AssignmentModule.execute(setup);
                    UI.Progress.hide();
                    alert(`作業完成！\n\n成功: ${result.successfulCount} 筆\n查詢失敗: ${result.failedQueries.length} 筆\n\n詳細失敗清單請查看 Console。`);
                    console.log("批次作業報告:", result);
                } catch (e) {
                    UI.Progress.hide();
                    UI.Toast.show(`作業發生嚴重錯誤: ${e.message}`, 'error', 5000);
                    console.error("批次作業錯誤詳情:", e);
                }
            } else {
                UI.Toast.show('操作已取消', 'info');
            }
            startModeSelection(); // 無論成功失敗，都返回模式選擇
        }
        
        // [通用] 流程
        async function startModeSelection() {
            UI.Modal.close();
            const result = await UIComponents.showModeSelectDialog();
            UI.Modal.close();

            switch(result.action) {
                case 'personal':      await handlePersonalCasesFlow(); break;
                case 'batch':         await handleBatchAssignmentFlow(); break;
                case '_change_token_': showTokenDialogFlow(false, true); break;
                default:              UI.Toast.show('工具已關閉', 'info');
            }
        }
        
        async function showTokenDialogFlow(showRetryBtn, isChanging = false) {
            if (isChanging) {
                localStorage.removeItem(Config.TOKEN_STORAGE_KEY);
                GlobalState.set({ token: null });
            }
            const result = await UIComponents.showTokenDialog(showRetryBtn);
            if (result.action === '_confirm_') {
                GlobalState.set({ token: result.value });
                localStorage.setItem(Config.TOKEN_STORAGE_KEY, result.value);
                UI.Toast.show('Token 已儲存', 'success', 1500);
                await Utils.sleep(500);
                startModeSelection();
            } else if (result.action === '_retry_autocheck_') {
                autoCheckToken();
            } else {
                UI.Toast.show('操作已取消', 'info');
            }
        }

        async function autoCheckToken() {
            UI.Progress.show('正在自動檢測 Token...');
            await Utils.sleep(300);
            const token = Utils.findStoredToken();
            UI.Progress.hide();
            if (token) {
                GlobalState.set({ token });
                UI.Toast.show('已自動載-入 Token', 'success', 1500);
                await Utils.sleep(500);
                startModeSelection();
            } else {
                UI.Toast.show('未找到可用 Token', 'warning');
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
