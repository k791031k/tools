/**
 * ===================================================================================
 * 書籤小工具：個人派件工作站 (V15 - 個人專用版)
 * ===================================================================================
 *
 * @version 15.0.0
 * @description
 * 1. 【專注個人模式】移除公池查詢功能，只處理個人案件派發。
 * 2. 【修正 UI 無反應問題】加強事件綁定與 DOM 檢查，確保點擊後立即渲染。
 * 3. 【錯誤補正】優化非同步流程、狀態管理與錯誤處理。
 * 4. 保留黑盒子日誌、Token 管理、展示模式等。
 */
(function() {
    'use strict';

    // ===================================================================================
    // 模組 1：應用程式設定 (Configuration)
    // ===================================================================================
    const config = {
        allowedDomain: /kgilife\.com\.tw$/,
        tokenSources: [
            () => localStorage.getItem('SSO-TOKEN'),
            () => sessionStorage.getItem('SSO-TOKEN'),
            () => localStorage.getItem('euisToken'),
            () => sessionStorage.getItem('euisToken')
        ],
        uiId: 'kgilife-personal-workstation-ui',
        apiEndpoints: {
            queryPersonalCases: {
                url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
                method: 'POST'
            },
            fetchPersonnel: {
                url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp',
                method: 'POST'
            },
            assignCases: {
                url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually',
                method: 'POST'
            }
        }
    };

    // ===================================================================================
    // 模組 2：應用程式狀態管理器 (State Manager)
    // ===================================================================================
    const state = {
        token: null,
        isTokenVerified: false,
        isAllowedDomain: false,
        isBusy: false,
        operationLock: false,
        currentCases: [],
        selectedCases: [],
        personnelList: [],
        set(newState) {
            Object.assign(this, newState);
        },
        reset() {
            this.isBusy = false;
            this.operationLock = false;
            this.currentCases = [];
            this.selectedCases = [];
            this.personnelList = [];
        }
    };

    // ===================================================================================
    // 模組 3：工具函式 (Utilities)
    // ===================================================================================
    const utils = {
        checkDomain: () => config.allowedDomain.test(window.location.hostname),
        findStoredToken: () => {
            for (const source of config.tokenSources) {
                try {
                    const token = source();
                    if (token && token.trim()) return token.trim();
                } catch (e) {
                    console.warn('Token 讀取警告:', e);
                }
            }
            return null;
        },
        escapeHtml: (str) => String(str || '').replace(/[&<>"']/g, m => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#039;'})[m]),
        safeQuerySelector: (selector, container = document) => {
            try {
                return container.querySelector(selector);
            } catch (e) {
                console.error('DOM 查詢錯誤:', selector, e);
                return null;
            }
        },
        waitForElement: (selector, timeout = 1000) => {
            return new Promise((resolve) => {
                const element = utils.safeQuerySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                const observer = new MutationObserver(() => {
                    const element = utils.safeQuerySelector(selector);
                    if (element) {
                        observer.disconnect();
                        resolve(element);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                setTimeout(() => {
                    observer.disconnect();
                    resolve(null);
                }, timeout);
            });
        }
    };

    // ===================================================================================
    // 模組 4：UI 管理器 (UI Manager)
    // ===================================================================================
    const uiManager = {
        async createLauncherDialog() {
            if (state.isBusy || state.operationLock) {
                console.warn('UI 正在建立中，跳過重複請求');
                return;
            }
            try {
                state.set({ isBusy: true, operationLock: true });
                const isAllowed = state.isAllowedDomain;
                const uiContainer = await this.createBaseUI('個人派件工作站');
                if (!uiContainer) throw new Error('UI 容器建立失敗');
                const warningBanner = !isAllowed ? 
                    `<div class="cqb-warning-banner"><strong>展示模式</strong>：目前不在支援的網域，API 功能已停用。</div>` : '';
                const bodyElement = utils.safeQuerySelector('.cqb-modal-body', uiContainer);
                if (!bodyElement) throw new Error('找不到 modal-body 元素');
                bodyElement.innerHTML = `
                    ${warningBanner}
                    <p class="cqb-p">點擊開始智慧派發個人案件：</p>
                    <div class="cqb-launcher-buttons">
                        <button id="cqb-launch-personal" class="cqb-btn cqb-btn-primary" ${!isAllowed ? 'disabled' : ''}>
                            開始個人案件派發
                        </button>
                    </div>
                `;
                document.body.appendChild(uiContainer);
                await this.bindLauncherEvents();
            } catch (error) {
                console.error('建立啟動器對話框失敗:', error);
                this.showToast(`建立介面失敗: ${error.message}`, 'error');
                state.reset();
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        async bindLauncherEvents() {
            const personalBtn = await utils.waitForElement('#cqb-launch-personal');
            if (personalBtn) {
                personalBtn.addEventListener('click', () => eventHandlers.startPersonalCaseFlow());
            }
        },
        async createCaseListDialog(cases) {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                const isAllowed = state.isAllowedDomain;
                const uiContainer = await this.createBaseUI('步驟 1：勾選個人案件');
                if (!uiContainer) throw new Error('UI 容器建立失敗');
                const filterHtml = this.createFilterButtons(cases);
                const tableHtml = this.createCaseTable(cases, isAllowed);
                const bodyElement = utils.safeQuerySelector('.cqb-modal-body', uiContainer);
                if (bodyElement) {
                    bodyElement.innerHTML = filterHtml + tableHtml;
                }
                const footerElement = utils.safeQuerySelector('.cqb-modal-footer', uiContainer);
                if (footerElement) {
                    footerElement.innerHTML = `
                        <div class="cqb-footer-left">
                            <button id="cqb-back-btn" class="cqb-btn cqb-btn-secondary" data-action="launcher">返回</button>
                        </div>
                        <div class="cqb-footer-right">
                            <button id="cqb-proceed-btn" class="cqb-btn cqb-btn-primary" disabled>下一步：選擇人員</button>
                        </div>
                    `;
                }
                document.body.appendChild(uiContainer);
                await this.bindCaseListEvents(cases, isAllowed);
            } catch (error) {
                console.error('建立案件列表對話框失敗:', error);
                this.showToast(`建立介面失敗: ${error.message}`, 'error');
                state.reset();
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        createCaseTable(cases, isAllowed) {
            if (cases.length === 0) {
                return `<p class="cqb-p">查無個人案件。</p>`;
            }
            const tableRows = cases.map(c => `
                <tr data-case-number="${utils.escapeHtml(c.applyNumber)}" data-case-status="${utils.escapeHtml(c.assignStatusDesc || 'N/A')}">
                    <td><input type="checkbox" class="cqb-case-checkbox" value="${utils.escapeHtml(c.applyNumber)}" ${!isAllowed ? 'disabled' : ''}></td>
                    <td>${utils.escapeHtml(c.applyNumber)}</td>
                    <td>${utils.escapeHtml(c.policyHolderName || c.ownerName)}</td>
                    <td>${utils.escapeHtml(c.insuredName)}</td>
                    <td>${utils.escapeHtml(c.assignStatusDesc || c.mainStatus || 'N/A')}</td>
                </tr>
            `).join('');
            return `
                <div class="cqb-table-container">
                    <table class="cqb-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="cqb-select-all-checkbox" ${!isAllowed ? 'disabled' : ''}></th>
                                <th>要保號</th>
                                <th>要保人</th>
                                <th>被保人</th>
                                <th>狀態</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
                <div id="cqb-selection-summary">已勾選 0 件 (共 ${cases.length} 件)</div>
            `;
        },
        async bindCaseListEvents(cases, isAllowed) {
            if (cases.length > 0 && isAllowed) {
                document.querySelectorAll('.cqb-filter-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => eventHandlers.handleFilterClick(e));
                });
                const selectAllCheckbox = await utils.waitForElement('#cqb-select-all-checkbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.addEventListener('change', (e) => eventHandlers.handleSelectAll(e));
                }
                document.querySelectorAll('.cqb-case-checkbox').forEach(cb => {
                    cb.addEventListener('change', () => eventHandlers.handleCheckboxChange());
                });
                const proceedBtn = await utils.waitForElement('#cqb-proceed-btn');
                if (proceedBtn) {
                    proceedBtn.addEventListener('click', () => eventHandlers.handleProceedToPersonnel());
                }
            }
            const backBtn = await utils.waitForElement('#cqb-back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => eventHandlers.handleBack('launcher'));
            }
        },
        createFilterButtons(cases) {
            if (cases.length === 0) return '';
            const statusCounts = cases.reduce((acc, c) => {
                const status = c.assignStatusDesc || '未知狀態';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            let buttonsHtml = '<div class="cqb-filter-container"><label>快速篩選與勾選：</label>';
            for (const status in statusCounts) {
                buttonsHtml += `<button class="cqb-btn cqb-btn-filter cqb-filter-btn" data-status="${utils.escapeHtml(status)}">${utils.escapeHtml(status)} (${statusCounts[status]})</button>`;
            }
            buttonsHtml += `<button class="cqb-btn cqb-btn-filter-clear cqb-filter-btn" data-status="all">顯示全部</button></div><hr class="cqb-hr">`;
            return buttonsHtml;
        },
        async createDispatchDialog(personnel) {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                const uiContainer = await this.createBaseUI('最終步驟：確認派發');
                if (!uiContainer) throw new Error('UI 容器建立失敗');
                const optionsHtml = personnel.length > 0 ? 
                    personnel.map(p => `<option value="${utils.escapeHtml(p.adAccount)}">${utils.escapeHtml(p.userName)} (${utils.escapeHtml(p.adAccount)})</option>`).join('') :
                    '<option value="" disabled>未能載入人員清單</option>';
                const bodyElement = utils.safeQuerySelector('.cqb-modal-body', uiContainer);
                if (bodyElement) {
                    bodyElement.innerHTML = `
                        <div class="cqb-summary-box">
                            您已選擇 <strong>${state.selectedCases.length}</strong> 件案件準備進行派發。
                        </div>
                        <div class="cqb-form-group">
                            <label for="cqb-personnel-selector">請選擇指派對象：</label>
                            <select id="cqb-personnel-selector" class="cqb-input" ${personnel.length === 0 ? 'disabled' : ''}>
                                ${optionsHtml}
                            </select>
                        </div>
                    `;
                }
                const footerElement = utils.safeQuerySelector('.cqb-modal-footer', uiContainer);
                if (footerElement) {
                    footerElement.innerHTML = `
                        <div class="cqb-footer-left">
                            <button id="cqb-back-btn" class="cqb-btn cqb-btn-secondary" data-action="personal">返回上一步</button>
                        </div>
                        <div class="cqb-footer-right">
                            <button id="cqb-dispatch-btn" class="cqb-btn cqb-btn-primary" ${personnel.length === 0 ? 'disabled' : ''}>確認派發</button>
                        </div>
                    `;
                }
                document.body.appendChild(uiContainer);
                await this.bindDispatchEvents();
            } catch (error) {
                console.error('建立派發對話框失敗:', error);
                this.showToast(`建立介面失敗: ${error.message}`, 'error');
                state.reset();
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        async bindDispatchEvents() {
            const backBtn = await utils.waitForElement('#cqb-back-btn');
            const dispatchBtn = await utils.waitForElement('#cqb-dispatch-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => eventHandlers.handleBack('personal'));
            }
            if (dispatchBtn) {
                dispatchBtn.addEventListener('click', () => eventHandlers.handleConfirmDispatch());
            }
        },
        async createTokenDialog() {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                const uiContainer = await this.createBaseUI('手動輸入 Token');
                if (!uiContainer) throw new Error('UI 容器建立失敗');
                const bodyElement = utils.safeQuerySelector('.cqb-modal-body', uiContainer);
                if (bodyElement) {
                    bodyElement.innerHTML = `
                        <p class="cqb-p">在支援的網站上，但未自動找到 Token。</p>
                        <p class="cqb-p">請手動貼上您的 SSO-TOKEN：</p>
                        <div class="cqb-form-group">
                            <textarea id="cqb-token-input" class="cqb-input cqb-textarea" rows="4" placeholder="請在此處貼上 Token..."></textarea>
                        </div>
                    `;
                }
                const footerElement = utils.safeQuerySelector('.cqb-modal-footer', uiContainer);
                if (footerElement) {
                    footerElement.innerHTML = `
                        <div class="cqb-footer-left"></div>
                        <div class="cqb-footer-right">
                            <button id="cqb-save-token-btn" class="cqb-btn cqb-btn-primary">儲存並開始</button>
                        </div>
                    `;
                }
                document.body.appendChild(uiContainer);
                await this.bindTokenEvents();
            } catch (error) {
                console.error('建立 Token 對話框失敗:', error);
                this.showToast(`建立介面失敗: ${error.message}`, 'error');
                state.reset();
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        async bindTokenEvents() {
            const saveBtn = await utils.waitForElement('#cqb-save-token-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => eventHandlers.handleSaveTokenClick());
            }
        },
        async createBaseUI(title) {
            try {
                this.destroy();
                this.injectCSS();
                const container = document.createElement('div');
                container.id = config.uiId;
                container.innerHTML = `
                    <div class="cqb-modal-backdrop"></div>
                    <div class="cqb-modal-content">
                        <div class="cqb-modal-header">
                            <h2>${title}</h2>
                            <button id="cqb-close-btn" class="cqb-close-btn">&times;</button>
                        </div>
                        <div class="cqb-modal-body"></div>
                        <div class="cqb-modal-footer"></div>
                    </div>
                `;
                setTimeout(async () => {
                    const closeBtn = await utils.waitForElement('.cqb-close-btn', container);
                    if (closeBtn) {
                        closeBtn.addEventListener('click', () => this.destroy());
                    }
                }, 0);
                return container;
            } catch (error) {
                console.error('建立基礎 UI 失敗:', error);
                return null;
            }
        },
        showToast(message, type = 'info', duration = 3000) {
            try {
                const toastId = `${config.uiId}-toast`;
                const oldToast = document.getElementById(toastId);
                if (oldToast) oldToast.remove();
                const toast = document.createElement('div');
                toast.id = toastId;
                toast.className = `cqb-toast cqb-toast-${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => {
                    if (toast && toast.parentNode) toast.remove();
                }, duration);
            } catch (error) {
                console.error('顯示 Toast 失敗:', error);
                alert(message);
            }
        },
        destroy() {
            try {
                const uiElement = document.getElementById(config.uiId);
                if (uiElement) uiElement.remove();
                state.reset();
            } catch (error) {
                console.error('銷毀 UI 失敗:', error);
            }
        },
        injectCSS() {
            const styleId = `${config.uiId}-style`;
            if (document.getElementById(styleId)) return;
            try {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    :root { --cqb-primary: #007bff; --cqb-secondary: #6c757d; --cqb-light: #f8f9fa; --cqb-dark: #343a40; }
                    #${config.uiId} { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                    #${config.uiId} .cqb-modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); z-index: 2147483645; }
                    #${config.uiId} .cqb-modal-content { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: var(--cqb-light); border-radius: 8px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25); z-index: 2147483646; width: 800px; max-width: 95%; display: flex; flex-direction: column; max-height: 90vh; }
                    #${config.uiId} .cqb-modal-header { padding: 16px 24px; border-bottom: 1px solid #dee2e6; background-color: #fff; position: relative; }
                    #${config.uiId} .cqb-modal-header h2 { margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--cqb-dark); }
                    #${config.uiId} .cqb-close-btn { background: none; border: none; font-size: 1.75rem; cursor: pointer; color: #888; position: absolute; top: 50%; right: 24px; transform: translateY(-50%); }
                    #${config.uiId} .cqb-modal-body { padding: 24px; overflow-y: auto; background-color: #fff; }
                    #${config.uiId} .cqb-warning-banner, #${config.uiId} .cqb-summary-box { background-color: #e2f3f5; border: 1px solid #b6e0e6; color: #317281; padding: 1rem; margin-bottom: 1.5rem; border-radius: 0.25rem; }
                    #${config.uiId} .cqb-table-container { max-height: 60vh; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.25rem; }
                    #${config.uiId} .cqb-table { width: 100%; border-collapse: collapse; }
                    #${config.uiId} .cqb-table th, #${config.uiId} .cqb-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
                    #${config.uiId} .cqb-table thead th { background-color: #f8f9fa; position: sticky; top: 0; z-index: 1; }
                    #${config.uiId} .cqb-table tbody tr:hover { background-color: #f1f3f5; }
                    #${config.uiId} #cqb-selection-summary { margin-top: 1rem; font-weight: 500; color: var(--cqb-dark); }
                    #${config.uiId} .cqb-input, #${config.uiId} .cqb-textarea { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 1rem; border: 1px solid #ced4da; border-radius: 0.25rem; box-sizing: border-box; }
                    #${config.uiId} .cqb-modal-footer { padding: 16px 24px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; gap: 12px; background-color: var(--cqb-light); align-items: center; }
                    #${config.uiId} .cqb-footer-left, #${config.uiId} .cqb-footer-right { display: flex; gap: 12px; }
                    #${config.uiId} .cqb-btn { font-weight: 400; cursor: pointer; border: 1px solid transparent; padding: 0.5rem 1rem; font-size: 1rem; border-radius: 0.25rem; transition: background-color 0.2s, border-color 0.2s; }
                    #${config.uiId} .cqb-btn:disabled { opacity: 0.65; cursor: not-allowed; }
                    #${config.uiId} .cqb-btn-primary { color: #fff; background-color: var(--cqb-primary); border-color: var(--cqb-primary); }
                    #${config.uiId} .cqb-btn-primary:not(:disabled):hover { background-color: #0069d9; border-color: #0062cc; }
                    #${config.uiId} .cqb-btn-secondary { color: #212529; background-color: transparent; border: 1px solid #ccc; }
                    #${config.uiId} .cqb-btn-secondary:not(:disabled):hover { background-color: #e2e6ea; }
                    #${config.uiId} .cqb-filter-container { margin-bottom: 1rem; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
                    #${config.uiId} .cqb-filter-container label { font-weight: 500; margin-right: 5px; font-size: 0.9rem; }
                    #${config.uiId} .cqb-btn-filter { background-color: #e9ecef; border-color: #ced4da; color: var(--cqb-dark); padding: 0.25rem 0.75rem; font-size: 0.9rem; }
                    #${config.uiId} .cqb-btn-filter:hover { background-color: #dee2e6; }
                    #${config.uiId} .cqb-btn-filter-clear { background-color: var(--cqb-secondary); color: white; }
                    #${config.uiId} .cqb-hr { border: 0; border-top: 1px solid #dee2e6; margin: 0 0 1.5rem 0; }
                    #${config.uiId} .cqb-launcher-buttons { display: flex; gap: 15px; justify-content: center; padding: 2rem 0; }
                    #${config.uiId} .cqb-launcher-buttons .cqb-btn { padding: 1rem 2rem; font-size: 1.2rem; }
                    #${config.uiId} .cqb-grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                    #${config.uiId} .cqb-form-group { margin-bottom: 1rem; }
                    #${config.uiId} .cqb-form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
                    #${config.uiId} .cqb-p { margin-bottom: 1rem; line-height: 1.5; }
                    .cqb-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 6px; color: #fff; font-size: 1rem; z-index: 2147483647; box-shadow: 0 3px 15px rgba(0, 0, 0, 0.2); opacity: 0; transition: opacity 0.3s, top 0.3s; animation: cqb-toast-in 0.5s forwards; }
                    .cqb-toast-info { background-color: #17a2b8; }
                    .cqb-toast-warning { background-color: #ffc107; color: #212529; }
                    .cqb-toast-error { background-color: #dc3545; }
                    @keyframes cqb-toast-in { from { opacity: 0; top: 0; } to { opacity: 1; top: 20px; } }
                `;
                document.head.appendChild(style);
            } catch (error) {
                console.error('注入 CSS 失敗:', error);
            }
        }
    };

    // ===================================================================================
    // 模組 5：API 處理器 (API Handler)
    // ===================================================================================
    const apiHandler = {
        async _fetch(endpoint, payload) {
            if (!state.isTokenVerified || !state.token) {
                throw new Error('Token 未驗證或不存在。');
            }
            try {
                const options = {
                    method: endpoint.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'SSO-TOKEN': state.token
                    },
                    body: JSON.stringify(payload)
                };
                const response = await fetch(endpoint.url, options);
                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error('API 請求失敗:', errorBody);
                    throw new Error(`API 請求失敗: ${response.status} - ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error('API 請求異常:', error);
                throw error;
            }
        },
        async fetchPersonalCases() {
            try {
                let allCases = [];
                let currentPage = 1;
                const pageSize = 50;
                let totalPages = 1;
                do {
                    const payload = {
                        nowPage: currentPage,
                        pageSize: pageSize,
                        orderBy: "assignId",
                        ascOrDesc: "desc"
                    };
                    const result = await this._fetch(config.apiEndpoints.queryPersonalCases, payload);
                    if (currentPage === 1) {
                        console.log("黑盒子日誌 (個人案件 API 原始回應 - 第一頁):", result);
                    }
                    if (result && result.records) {
                        allCases = allCases.concat(result.records);
                        if (currentPage === 1 && result.total) {
                            totalPages = Math.ceil(result.total / pageSize);
                        }
                    } else {
                        break;
                    }
                    currentPage++;
                } while (currentPage <= totalPages);
                return allCases;
            } catch (error) {
                console.error('獲取個人案件失敗:', error);
                throw error;
            }
        },
        async fetchPersonnel() {
            try {
                const payload = {
                    "validDate": "true",
                    "orderBys": ["userName asc", "adAccount asc"]
                };
                return await this._fetch(config.apiEndpoints.fetchPersonnel, payload);
            } catch (error) {
                console.error('獲取人員清單失敗:', error);
                throw error;
            }
        },
        async assignCases(caseNumbers, assigneeId) {
            try {
                const payload = {
                    "dispatchOrgAf": "H",
                    "auditorAf": assigneeId,
                    "dispatchOrgBf": "",
                    "applyNumbers": caseNumbers
                };
                return await this._fetch(config.apiEndpoints.assignCases, payload);
            } catch (error) {
                console.error('派發案件失敗:', error);
                throw error;
            }
        }
    };

    // ===================================================================================
    // 模組 6：事件處理器 (Event Handlers)
    // ===================================================================================
    const eventHandlers = {
        async handleSaveTokenClick() {
            if (state.isBusy) return;
            try {
                const tokenInput = await utils.waitForElement('#cqb-token-input');
                const token = tokenInput?.value.trim();
                if (token) {
                    state.set({ token: token, isTokenVerified: true });
                    uiManager.showToast('Token 已儲存', 'info');
                    await uiManager.createLauncherDialog();
                } else {
                    uiManager.showToast('請輸入有效的 Token', 'warning');
                }
            } catch (error) {
                console.error('處理 Token 儲存失敗:', error);
                uiManager.showToast('儲存 Token 時發生錯誤', 'error');
            }
        },
        async startPersonalCaseFlow() {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                uiManager.showToast('正在抓取所有個人案件資料...', 'info');
                const cases = await apiHandler.fetchPersonalCases();
                state.set({ currentCases: cases, selectedCases: [] });
                await uiManager.createCaseListDialog(cases);
            } catch (error) {
                console.error('個人案件流程失敗:', error);
                uiManager.showToast(`抓取案件失敗: ${error.message}`, 'error');
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        handleSelectAll(event) {
            try {
                const isChecked = event.target.checked;
                document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox').forEach(cb => {
                    cb.checked = isChecked;
                });
                this.updateSelectionState();
            } catch (error) {
                console.error('處理全選失敗:', error);
            }
        },
        handleCheckboxChange() {
            this.updateSelectionState();
        },
        updateSelectionState() {
            try {
                const selected = Array.from(document.querySelectorAll('.cqb-case-checkbox:checked')).map(cb => cb.value);
                state.set({ selectedCases: selected });
                const summaryEl = utils.safeQuerySelector('#cqb-selection-summary');
                if (summaryEl) {
                    summaryEl.textContent = `已勾選 ${selected.length} 件 (共 ${state.currentCases.length} 件)`;
                }
                const proceedBtn = utils.safeQuerySelector('#cqb-proceed-btn');
                if (proceedBtn) {
                    proceedBtn.disabled = selected.length === 0;
                }
                const allVisibleCheckboxes = document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox');
                const allVisibleAndChecked = document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox:checked');
                const selectAllCheckbox = utils.safeQuerySelector('#cqb-select-all-checkbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = allVisibleCheckboxes.length > 0 && allVisibleAndChecked.length === allVisibleCheckboxes.length;
                    selectAllCheckbox.indeterminate = allVisibleAndChecked.length > 0 && allVisibleAndChecked.length < allVisibleCheckboxes.length;
                }
            } catch (error) {
                console.error('更新選擇狀態失敗:', error);
            }
        },
        handleFilterClick(event) {
            try {
                const statusToFilter = event.target.getAttribute('data-status');
                document.querySelectorAll('.cqb-table tbody tr').forEach(row => {
                    const checkbox = row.querySelector('.cqb-case-checkbox');
                    if (statusToFilter === 'all' || row.getAttribute('data-case-status') === statusToFilter) {
                        row.style.display = '';
                        if (checkbox) checkbox.checked = statusToFilter !== 'all';
                    } else {
                        row.style.display = 'none';
                        if (checkbox) checkbox.checked = false;
                    }
                });
                this.updateSelectionState();
            } catch (error) {
                console.error('處理篩選點擊失敗:', error);
            }
        },
        async handleProceedToPersonnel() {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                uiManager.showToast('正在獲取人員清單...', 'info');
                const result = await apiHandler.fetchPersonnel();
                console.group("黑盒子日誌 - 人員清單查詢");
                console.log("1. API 原始回應 (Raw Response):", result);
                const personnel = Array.isArray(result) ? result : 
                                  result.data || result.records || 
                                  (typeof result === 'object' && result !== null ? Object.values(result).find(Array.isArray) : []) || [];
                console.log("2. 智慧搜查提取出的人員陣列:", personnel);
                console.groupEnd();
                state.set({ personnelList: personnel });
                await uiManager.createDispatchDialog(personnel);
                if (personnel.length === 0) {
                    uiManager.showToast('API 已回應，但未在資料中找到有效的人員清單。請按 F12 查看 Console 中的「黑盒子」日誌。', 'warning', 6000);
                }
            } catch (error) {
                console.error('獲取人員清單失敗:', error);
                uiManager.showToast(`獲取人員清單失敗: ${error.message}`, 'error');
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        },
        async handleBack(source) {
            try {
                if (source === 'launcher') {
                    await uiManager.createLauncherDialog();
                } else if (source === 'personal') {
                    await uiManager.createCaseListDialog(state.currentCases);
                    setTimeout(() => {
                        document.querySelectorAll('.cqb-case-checkbox').forEach(cb => {
                            if (state.selectedCases.includes(cb.value)) cb.checked = true;
                        });
                        this.updateSelectionState();
                    }, 100);
                }
            } catch (error) {
                console.error('處理返回失敗:', error);
                uiManager.showToast('返回操作失敗', 'error');
            }
        },
        async handleConfirmDispatch() {
            if (state.isBusy || state.operationLock) return;
            try {
                state.set({ isBusy: true, operationLock: true });
                const personnelSelector = await utils.waitForElement('#cqb-personnel-selector');
                const assigneeId = personnelSelector?.value;
                const casesToDispatch = state.selectedCases;
                if (!assigneeId) {
                    uiManager.showToast('請選擇一位指派對象', 'warning');
                    return;
                }
                const btn = await utils.waitForElement('#cqb-dispatch-btn');
                if (btn) {
                    btn.textContent = '派發中...';
                    btn.disabled = true;
                }
                await apiHandler.assignCases(casesToDispatch, assigneeId);
                uiManager.destroy();
                uiManager.showToast(`成功派發 ${casesToDispatch.length} 件案件給 ${assigneeId}！`, 'info', 5000);
            } catch (error) {
                console.error('確認派發失敗:', error);
                uiManager.showToast(`派發失敗: ${error.message}`, 'error');
                const btn = await utils.waitForElement('#cqb-dispatch-btn');
                if (btn) {
                    btn.textContent = '確認派發';
                    btn.disabled = false;
                }
            } finally {
                state.set({ isBusy: false, operationLock: false });
            }
        }
    };

    // ===================================================================================
    // 模組 7：主執行函式 (Main Execution)
    // ===================================================================================
    async function init() {
        try {
            if (document.getElementById(config.uiId)) {
                uiManager.showToast('工具已在執行中', 'warning');
                return;
            }
            const isAllowed = utils.checkDomain();
            state.set({ isAllowedDomain: isAllowed });
            if (isAllowed) {
                const storedToken = utils.findStoredToken();
                if (storedToken) {
                    state.set({ token: storedToken, isTokenVerified: true });
                    await uiManager.createLauncherDialog();
                } else {
                    await uiManager.createTokenDialog();
                }
            } else {
                await uiManager.createLauncherDialog();
            }
        } catch (error) {
            console.error('初始化失敗:', error);
            try {
                uiManager.showToast('工具初始化失敗，請重新嘗試', 'error');
            } catch (toastError) {
                alert('工具初始化失敗，請重新嘗試');
            }
        }
    }
    init();
})();
