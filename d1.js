/**
 * ===================================================================================
 * 書籤小工具：整合派件工作站 (V13 - 診斷版)
 * ===================================================================================
 *
 * @version 13.0.0
 * @description
 * 1.  【重要】本版本為診斷版，旨在徹底解決 UI 無法呈現資料的問題。
 * 2.  【重要】在 API 請求成功後，會在 F12 的 Console 中打印出最原始的回應資料（黑盒子），方便進行問題診斷。
 * 3.  採用更強化的「智慧搜查」邏輯，嘗試從任何可能的結構中提取案件與人員陣列。
 * 4.  保留了先前版本的所有功能，包括完整案件列表、智慧篩選按鈕等。
 *
 */
(function() {
    'use strict';

    // ===================================================================================
    // 模組 1：應用程式設定 (Configuration)
    // ===================================================================================
    const config = {
        allowedDomain: /kgilife\.com\.tw$/,
        tokenSources: [() => localStorage.getItem('SSO-TOKEN'), () => sessionStorage.getItem('SSO-TOKEN'), () => localStorage.getItem('euisToken'), () => sessionStorage.getItem('euisToken')],
        uiId: 'kgilife-workstation-ui',
        apiEndpoints: {
            queryPersonalCases: { url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool', method: 'POST' },
            findPublicProposals: { url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch', method: 'POST' },
            fetchPersonnel: { url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp', method: 'POST' },
            assignCases: { url: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually', method: 'POST' }
        }
    };

    // ===================================================================================
    // 模組 2：應用程式狀態管理器 (State Manager)
    // ===================================================================================
    const state = {
        token: null, isTokenVerified: false, isAllowedDomain: false,
        isBusy: false,
        currentCases: [], selectedCases: [], personnelList: [],
        set(newState) { Object.assign(this, newState); }
    };

    // ===================================================================================
    // 模組 3：工具函式 (Utilities)
    // ===================================================================================
    const utils = {
        checkDomain: () => config.allowedDomain.test(window.location.hostname),
        findStoredToken: () => { for (const source of config.tokenSources) { const token = source(); if (token && token.trim()) return token.trim(); } return null; },
        escapeHtml: (str) => String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m])
    };

    // ===================================================================================
    // 模組 4：UI 管理器 (UI Manager)
    // ===================================================================================
    const uiManager = {
        createLauncherDialog() {
            if (state.isBusy) return;
            state.set({ isBusy: true });
            const isAllowed = state.isAllowedDomain;
            const uiContainer = this.createBaseUI('整合派件工作站');
            if (!uiContainer) { state.set({ isBusy: false }); return; }
            const warningBanner = !isAllowed ? `<div class="cqb-warning-banner"><strong>展示模式</strong>：目前不在支援的網域，API 功能已停用。</div>` : '';
            uiContainer.querySelector('.cqb-modal-body').innerHTML = `
                ${warningBanner}
                <p class="cqb-p">請選擇您要執行的功能：</p>
                <div class="cqb-launcher-buttons">
                    <button id="cqb-launch-personal" class="cqb-btn cqb-btn-primary" ${!isAllowed ? 'disabled' : ''}>智慧派發個人案件</button>
                    <button id="cqb-launch-public" class="cqb-btn cqb-btn-primary" ${!isAllowed ? 'disabled' : ''}>查詢公池並派件</button>
                </div>`;
            document.body.appendChild(uiContainer);
            document.getElementById('cqb-launch-personal').addEventListener('click', () => eventHandlers.startPersonalCaseFlow());
            document.getElementById('cqb-launch-public').addEventListener('click', () => eventHandlers.startPublicCaseFlow());
            state.set({ isBusy: false });
        },
        createPublicSearchDialog() {
            if (state.isBusy) return;
            state.set({ isBusy: true });
            const uiContainer = this.createBaseUI('查詢公池案件');
            if (!uiContainer) { state.set({ isBusy: false }); return; }
            uiContainer.querySelector('.cqb-modal-body').innerHTML = `
                <div class="cqb-grid-form">
                    <div class="cqb-form-group"><label for="f-applyNumber">要保號</label><input id="f-applyNumber" type="text" class="cqb-input"></div>
                    <div class="cqb-form-group"><label for="f-policyNumber">保單號</label><input id="f-policyNumber" type="text" class="cqb-input"></div>
                    <div class="cqb-form-group"><label for="f-insuredName">被保人姓名</label><input id="f-insuredName" type="text" class="cqb-input"></div>
                    <div class="cqb-form-group"><label for="f-ownerName">要保人姓名</label><input id="f-ownerName" type="text" class="cqb-input"></div>
                    <div class="cqb-form-group"><label for="f-applyDateStart">申請日期 (起)</label><input id="f-applyDateStart" type="date" class="cqb-input"></div>
                    <div class="cqb-form-group"><label for="f-applyDateEnd">申請日期 (迄)</label><input id="f-applyDateEnd" type="date" class="cqb-input"></div>
                </div>`;
            uiContainer.querySelector('.cqb-modal-footer').innerHTML = `<div class="cqb-footer-left"><button id="cqb-back-to-launcher" class="cqb-btn cqb-btn-secondary">返回</button></div><div class="cqb-footer-right"><button id="cqb-public-search-btn" class="cqb-btn cqb-btn-primary">查詢</button></div>`;
            document.body.appendChild(uiContainer);
            document.getElementById('cqb-back-to-launcher').addEventListener('click', () => eventHandlers.handleBack('launcher'));
            document.getElementById('cqb-public-search-btn').addEventListener('click', () => eventHandlers.handlePublicSearch());
            state.set({ isBusy: false });
        },
        createCaseListDialog(cases, source) {
            if (state.isBusy) return;
            state.set({ isBusy: true });
            const isAllowed = state.isAllowedDomain;
            const title = source === 'personal' ? '步驟 1：勾選個人案件' : '步驟 2：勾選查詢結果';
            const uiContainer = this.createBaseUI(title);
            if (!uiContainer) { state.set({ isBusy: false }); return; }
            const filterHtml = source === 'personal' ? this.createFilterButtons(cases) : '';
            const tableRows = cases.map(c => `
                <tr data-case-number="${utils.escapeHtml(c.applyNumber)}" data-case-status="${utils.escapeHtml(c.assignStatusDesc || 'N/A')}">
                    <td><input type="checkbox" class="cqb-case-checkbox" value="${utils.escapeHtml(c.applyNumber)}" ${!isAllowed ? 'disabled' : ''}></td>
                    <td>${utils.escapeHtml(c.applyNumber)}</td>
                    <td>${utils.escapeHtml(c.policyHolderName || c.ownerName)}</td>
                    <td>${utils.escapeHtml(c.insuredName)}</td>
                    <td>${utils.escapeHtml(c.assignStatusDesc || c.mainStatus || 'N/A')}</td>
                </tr>`).join('');
            const tableHtml = cases.length > 0 ? `
                <div class="cqb-table-container"><table>
                    <thead><tr>
                        <th><input type="checkbox" id="cqb-select-all-checkbox" ${!isAllowed ? 'disabled' : ''}></th>
                        <th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th>
                    </tr></thead>
                    <tbody>${tableRows}</tbody>
                </table></div>
                <div id="cqb-selection-summary">已勾選 0 件 (共 ${cases.length} 件)</div>` : `<p class="cqb-p">查無符合條件的案件。</p>`;
            const backButtonAction = source === 'personal' ? 'launcher' : 'publicSearch';
            uiContainer.querySelector('.cqb-modal-body').innerHTML = filterHtml + tableHtml;
            uiContainer.querySelector('.cqb-modal-footer').innerHTML = `<div class="cqb-footer-left"><button id="cqb-back-btn" class="cqb-btn cqb-btn-secondary" data-action="${backButtonAction}">返回</button></div><div class="cqb-footer-right"><button id="cqb-proceed-btn" class="cqb-btn cqb-btn-primary" disabled>下一步：選擇人員</button></div>`;
            document.body.appendChild(uiContainer);

            if (cases.length > 0 && isAllowed) {
                if(source === 'personal') { document.querySelectorAll('.cqb-filter-btn').forEach(btn => btn.addEventListener('click', (e) => eventHandlers.handleFilterClick(e))); }
                document.getElementById('cqb-select-all-checkbox').addEventListener('change', (e) => eventHandlers.handleSelectAll(e));
                document.querySelectorAll('.cqb-case-checkbox').forEach(cb => cb.addEventListener('change', () => eventHandlers.handleCheckboxChange()));
                document.getElementById('cqb-proceed-btn').addEventListener('click', () => eventHandlers.handleProceedToPersonnel(source));
            }
            document.getElementById('cqb-back-btn').addEventListener('click', (e) => eventHandlers.handleBack(e.target.dataset.action));
            state.set({ isBusy: false });
        },
        createFilterButtons(cases) {
            if (cases.length === 0) return '';
            const statusCounts = cases.reduce((acc, c) => { const status = c.assignStatusDesc || '未知狀態'; acc[status] = (acc[status] || 0) + 1; return acc; }, {});
            let buttonsHtml = '<div class="cqb-filter-container"><label>快速篩選與勾選：</label>';
            for (const status in statusCounts) { buttonsHtml += `<button class="cqb-btn cqb-btn-filter cqb-filter-btn" data-status="${utils.escapeHtml(status)}">${utils.escapeHtml(status)} (${statusCounts[status]})</button>`; }
            buttonsHtml += `<button class="cqb-btn cqb-btn-filter-clear cqb-filter-btn" data-status="all">顯示全部</button></div><hr class="cqb-hr">`;
            return buttonsHtml;
        },
        createDispatchDialog(personnel, source) {
            if (state.isBusy) return;
            state.set({ isBusy: true });
            const uiContainer = this.createBaseUI('最終步驟：確認派發');
            if (!uiContainer) { state.set({ isBusy: false }); return; }
            const optionsHtml = personnel.length > 0 ? personnel.map(p => `<option value="${utils.escapeHtml(p.adAccount)}">${utils.escapeHtml(p.userName)} (${utils.escapeHtml(p.adAccount)})</option>`).join('') : '<option value="" disabled>未能載入人員清單</option>';
            uiContainer.querySelector('.cqb-modal-body').innerHTML = `<div class="cqb-summary-box">您已選擇 <strong>${state.selectedCases.length}</strong> 件案件準備進行派發。</div><div class="cqb-form-group"><label for="cqb-personnel-selector">請選擇指派對象：</label><select id="cqb-personnel-selector" class="cqb-input" ${personnel.length === 0 ? 'disabled' : ''}>${optionsHtml}</select></div>`;
            uiContainer.querySelector('.cqb-modal-footer').innerHTML = `<div class="cqb-footer-left"><button id="cqb-back-btn" class="cqb-btn cqb-btn-secondary" data-action="${source}">返回上一步</button></div><div class="cqb-footer-right"><button id="cqb-dispatch-btn" class="cqb-btn cqb-btn-primary" ${personnel.length === 0 ? 'disabled' : ''}>確認派發</button></div>`;
            document.body.appendChild(uiContainer);
            document.getElementById('cqb-back-btn').addEventListener('click', (e) => eventHandlers.handleBack(e.target.dataset.action));
            document.getElementById('cqb-dispatch-btn').addEventListener('click', () => eventHandlers.handleConfirmDispatch());
            state.set({ isBusy: false });
        },
        createTokenDialog() { /* ... (與前版相同) ... */ },
        createBaseUI(title) { /* ... (與前版相同) ... */ },
        showToast(message, type, duration) { /* ... (與前版相同) ... */ },
        destroy() { const uiElement = document.getElementById(config.uiId); if (uiElement) uiElement.remove(); state.set({ isBusy: false }); },
        injectCSS() { /* ... (與前版相同) ... */ }
    };

    // ===================================================================================
    // 模組 5：API 處理器 (API Handler)
    // ===================================================================================
    const apiHandler = {
        async _fetch(endpoint, payload) { if (!state.isTokenVerified || !state.token) { throw new Error('Token 未驗證或不存在。'); } const options = { method: endpoint.method, headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': state.token }, body: JSON.stringify(payload) }; const response = await fetch(endpoint.url, options); if (!response.ok) { const errorBody = await response.text(); console.error('API 請求失敗:', errorBody); throw new Error(`API 請求失敗: ${response.status}`); } return response.json(); },
        async fetchPersonalCases() {
            let allCases = []; let currentPage = 1; const pageSize = 50; let totalPages = 1;
            do {
                const payload = { nowPage: currentPage, pageSize: pageSize, orderBy: "assignId", ascOrDesc: "desc" };
                const result = await this._fetch(config.apiEndpoints.queryPersonalCases, payload);
                if (result && result.records) {
                    allCases = allCases.concat(result.records);
                    if (currentPage === 1 && result.total) { totalPages = Math.ceil(result.total / pageSize); }
                } else { break; } currentPage++;
            } while (currentPage <= totalPages);
            return allCases;
        },
        async findPublicProposals(searchParams) { const payload = { pageIndex: 1, size: 200, poolOrg: "H", orderBys: ["applyNumber asc"], ...searchParams }; Object.keys(payload).forEach(key => (payload[key] === "" || payload[key] === null) && delete payload[key]); return this._fetch(config.apiEndpoints.findPublicProposals, payload); },
        async fetchPersonnel() { const payload = { "validDate": "true", "orderBys": ["userName asc", "adAccount asc"] }; return this._fetch(config.apiEndpoints.fetchPersonnel, payload); },
        async assignCases(caseNumbers, assigneeId) { const payload = { "dispatchOrgAf": "H", "auditorAf": assigneeId, "dispatchOrgBf": "", "applyNumbers": caseNumbers }; return this._fetch(config.apiEndpoints.assignCases, payload); }
    };

    // ===================================================================================
    // 模組 6：事件處理器 (Event Handlers)
    // ===================================================================================
    const eventHandlers = {
        handleSaveTokenClick() { if(state.isBusy) return; const token = document.getElementById('cqb-token-input')?.value.trim(); if (token) { state.set({ token: token, isTokenVerified: true }); uiManager.showToast('Token 已儲存', 'info'); uiManager.createLauncherDialog(); } else { uiManager.showToast('請輸入有效的 Token', 'warning'); } },
        async startPersonalCaseFlow() {
            if(state.isBusy) return; state.set({ isBusy: true });
            uiManager.showToast('正在抓取所有個人案件資料...', 'info');
            try {
                const cases = await apiHandler.fetchPersonalCases();
                console.group("黑盒子日誌 - 個人案件查詢");
                console.log("1. API 原始回應 (Raw Response):", cases); // 這裡的 cases 已經是合併後的完整陣列
                console.groupEnd();
                state.set({ currentCases: cases, selectedCases: [] });
                uiManager.createCaseListDialog(cases, 'personal');
            } catch (error) { uiManager.showToast(`抓取案件失敗: ${error.message}`, 'error'); }
            state.set({ isBusy: false });
        },
        startPublicCaseFlow() { uiManager.createPublicSearchDialog(); },
        async handlePublicSearch() {
            if(state.isBusy) return; state.set({ isBusy: true });
            const searchBtn = document.getElementById('cqb-public-search-btn');
            if(searchBtn) { searchBtn.textContent = '查詢中...'; searchBtn.disabled = true; }
            try {
                const params = {
                    applyNumber: document.getElementById('f-applyNumber').value, policyNumber: document.getElementById('f-policyNumber').value,
                    insuredName: document.getElementById('f-insuredName').value, ownerName: document.getElementById('f-ownerName').value,
                    applyDateStart: document.getElementById('f-applyDateStart').value, applyDateEnd: document.getElementById('f-applyDateEnd').value,
                };
                const result = await apiHandler.findPublicProposals(params);
                console.group("黑盒子日誌 - 公池案件查詢");
                console.log("1. API 原始回應 (Raw Response):", result);
                const cases = Array.isArray(result) ? result : result.data || result.records || (typeof result === 'object' && result !== null ? Object.values(result).find(Array.isArray) : []) || [];
                console.log("2. 智慧搜查提取出的案件陣列:", cases);
                console.groupEnd();
                state.set({ currentCases: cases, selectedCases: [] });
                uiManager.createCaseListDialog(cases, 'public');
            } catch(e) {
                uiManager.showToast(`查詢公池失敗: ${e.message}`, 'error');
                if(searchBtn) { searchBtn.textContent = '查詢'; searchBtn.disabled = false; }
            }
            state.set({ isBusy: false });
        },
        handleSelectAll(event) { const isChecked = event.target.checked; document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox').forEach(cb => { cb.checked = isChecked; }); eventHandlers.updateSelectionState(); },
        handleCheckboxChange() { eventHandlers.updateSelectionState(); },
        updateSelectionState() {
            const selected = Array.from(document.querySelectorAll('.cqb-case-checkbox:checked')).map(cb => cb.value);
            state.set({ selectedCases: selected });
            const summaryEl = document.getElementById('cqb-selection-summary');
            if (summaryEl) summaryEl.textContent = `已勾選 ${selected.length} 件 (共 ${state.currentCases.length} 件)`;
            const proceedBtn = document.getElementById('cqb-proceed-btn');
            if (proceedBtn) proceedBtn.disabled = selected.length === 0;
            const allVisibleCheckboxes = document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox');
            const allVisibleAndChecked = document.querySelectorAll('.cqb-table tbody tr:not([style*="display: none"]) .cqb-case-checkbox:checked');
            const selectAllCheckbox = document.getElementById('cqb-select-all-checkbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = allVisibleCheckboxes.length > 0 && allVisibleAndChecked.length === allVisibleCheckboxes.length;
                selectAllCheckbox.indeterminate = allVisibleAndChecked.length > 0 && allVisibleAndChecked.length < allVisibleCheckboxes.length;
            }
        },
        handleFilterClick(event) {
            const statusToFilter = event.target.getAttribute('data-status');
            document.querySelectorAll('.cqb-table tbody tr').forEach(row => {
                const checkbox = row.querySelector('.cqb-case-checkbox');
                if (statusToFilter === 'all' || row.getAttribute('data-case-status') === statusToFilter) {
                    row.style.display = ''; checkbox.checked = statusToFilter !== 'all';
                } else {
                    row.style.display = 'none'; checkbox.checked = false;
                }
            });
            eventHandlers.updateSelectionState();
        },
        async handleProceedToPersonnel(source) {
            if(state.isBusy) return; state.set({ isBusy: true });
            uiManager.showToast('正在獲取人員清單...', 'info');
            try {
                const result = await apiHandler.fetchPersonnel();
                console.group("黑盒子日誌 - 人員清單查詢");
                console.log("1. API 原始回應 (Raw Response):", result);
                const personnel = Array.isArray(result) ? result : result.data || result.records || (typeof result === 'object' && result !== null ? Object.values(result).find(Array.isArray) : []) || [];
                console.log("2. 智慧搜查提取出的人員陣列:", personnel);
                console.groupEnd();
                state.set({ personnelList: personnel });
                uiManager.createDispatchDialog(personnel, source);
                if(personnel.length === 0){ uiManager.showToast('API 已回應，但未在資料中找到有效的人員清單。請按 F12 查看 Console 中的「黑盒子」日誌。', 'warning', 6000); }
            } catch (error) { uiManager.showToast(`獲取人員清單失敗: ${error.message}`, 'error'); }
            state.set({ isBusy: false });
        },
        handleBack(source) {
            if (source === 'launcher') { uiManager.createLauncherDialog(); }
            else if (source === 'publicSearch') { uiManager.createPublicSearchDialog(); }
            else if (source === 'personal' || source === 'public') {
                uiManager.createCaseListDialog(state.currentCases, source);
                setTimeout(() => {
                    document.querySelectorAll('.cqb-case-checkbox').forEach(cb => { if (state.selectedCases.includes(cb.value)) { cb.checked = true; } });
                    eventHandlers.updateSelectionState();
                }, 0);
            }
        },
        async handleConfirmDispatch() {
            if(state.isBusy) return; state.set({ isBusy: true });
            const assigneeId = document.getElementById('cqb-personnel-selector')?.value;
            const casesToDispatch = state.selectedCases;
            if (!assigneeId) { uiManager.showToast('請選擇一位指派對象', 'warning'); state.set({ isBusy: false }); return; }
            const btn = document.getElementById('cqb-dispatch-btn');
            if(btn) { btn.textContent = '派發中...'; btn.disabled = true; }
            try {
                await apiHandler.assignCases(casesToDispatch, assigneeId);
                uiManager.destroy();
                uiManager.showToast(`成功派發 ${casesToDispatch.length} 件案件給 ${assigneeId}！`, 'info', 5000);
            } catch (error) {
                uiManager.showToast(`派發失敗: ${error.message}`, 'error');
                if(btn) { btn.textContent = '確認派發'; btn.disabled = false; }
            }
            state.set({ isBusy: false });
        }
    };

    // ===================================================================================
    // 模組 7：主執行函式 (Main Execution)
    // ===================================================================================
    function init() {
        if (document.getElementById(config.uiId)) { uiManager.showToast('工具已在執行中', 'warning'); return; }
        const isAllowed = utils.checkDomain();
        state.set({ isAllowedDomain: isAllowed });
        if (isAllowed) {
            const storedToken = utils.findStoredToken();
            if (storedToken) {
                state.set({ token: storedToken, isTokenVerified: true });
                uiManager.createLauncherDialog();
            } else {
                uiManager.createTokenDialog();
            }
        } else {
            uiManager.createLauncherDialog();
        }
    }
    init();
})();
