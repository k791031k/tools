javascript:(function() {
    'use strict';

    /*************************************************************************
     * *
     * 派件輔助工具 v4.0.0                          *
     * *
     *************************************************************************/

    // =========================================================================
    // 1. Config (組態設定)
    // =========================================================================
    const Config = {
        VERSION: '4.0.0-full-integrated',
        TOOL_ID: 'pct-main-container',
        STYLE_ID: 'pct-custom-styles',
        TOKEN_STORAGE_KEY: 'euisToken',
        API_ENDPOINTS: {
            // 個人案件
            queryPersonalCases: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
            // 公池查詢
            findPublicProposals: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            // 派件API（通用）
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually',
            // 人員清單
            fetchPersonnel: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp'
        },
        BATCH_CONFIG: {
            defaultAuditor: 'chenjui.chang',
            defaultDispatchOrg: 'H',
            pageSize: 50
        },
        RETRY_SETTINGS: {
            count: 2,
            delay: 1000
        },
        MODAL_SIZES: {
            TOKEN_INPUT: { width: '500px' },
            MODE_SELECT: { width: '600px', height: 'auto' },
            PERSONAL_CASES: { width: '85vw', height: '80vh' },
            PUBLIC_CASES: { width: '95vw', height: '80vh' },
            PERSONNEL_SELECT: { width: '600px', height: 'auto' },
            BATCH_SETUP: { width: '600px', height: 'auto' }
        }
    };

    // =========================================================================
    // 2. GlobalState (全域狀態管理)
    // =========================================================================
    const GlobalState = (() => {
        let state = {
            token: null,
            env: window.location.hostname.includes('-uat') ? 'UAT' : 'PROD',
            currentQueryController: null,
            personalCases: [],
            publicCases: [],
            selectedCases: [],
            personnelList: [],
            currentMode: null // 'personal', 'public', 或 'batch'
        };
        return {
            get: (key) => state[key],
            set: (newState) => { state = {...state, ...newState}; }
        };
    })();

    // =========================================================================
    // 3. Utils (工具函式)
    // =========================================================================
    const Utils = {
        /** 在 LocalStorage 或 SessionStorage 中尋找已儲存的 Token */
        findStoredToken: () => localStorage.getItem(Config.TOKEN_STORAGE_KEY) || sessionStorage.getItem('SSO-TOKEN') || null,
        /** 將輸入的文字（以空格、逗號、換行分隔）轉換為陣列 */
        splitInput: (text) => text.split(/[\s,，\n]+/).filter(Boolean),
        /** 將全形字元轉為半形並轉為大寫 */
        toHalfWidthUpperCase: (str) => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).toUpperCase(),
        /** 進行 HTML 特殊字元跳脫，防止 XSS */
        escapeHtml: (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]),
        /** 非同步延遲函式 */
        sleep: (ms) => new Promise(res => setTimeout(res, ms))
    };

    // =========================================================================
    // 4. UI (使用者介面管理)
    // =========================================================================
    const UI = {
        /** 將工具所需的 CSS 樣式注入到頁面中 */
        injectStyle: () => {
            const css = `
                :root {
                    --pct-primary-color: #007bff;
                    --pct-background-color: #fff;
                    --pct-text-color: #333;
                }
                .pct-modal-mask {
                    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6);
                    z-index: 9998; display: flex; align-items: center; justify-content: center;
                    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                }
                .pct-modal-dialog {
                    background-color: var(--pct-background-color); border-radius: 8px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column;
                    max-height: 90vh; width: 600px; max-width: 90vw; overflow: hidden;
                }
                .pct-modal-header {
                    padding: 16px; border-bottom: 1px solid #dee2e6; font-size: 1.25rem; font-weight: 600;
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--pct-primary-color); color: white;
                }
                .pct-modal-body { padding: 16px; overflow-y: auto; max-height: calc(90vh - 120px); }
                .pct-modal-footer {
                    padding: 12px 16px; border-top: 1px solid #dee2e6;
                    display: flex; justify-content: flex-end; gap: 10px;
                }
                .pct-modal-close-btn {
                    background: none; border: none; font-size: 1.5rem; cursor: pointer; color: white;
                }
                .pct-btn {
                    padding: 8px 16px; border: 1px solid var(--pct-primary-color);
                    background-color: var(--pct-primary-color); color: white; border-radius: 4px;
                    cursor: pointer; transition: background-color 0.2s; user-select: none;
                }
                .pct-btn:not(:disabled):hover { background-color: #0056b3; }
                .pct-btn-outline { background-color: transparent; color: var(--pct-primary-color); }
                .pct-btn:disabled {
                    background-color: #d6d6d6; border-color: #d6d6d6;
                    cursor: not-allowed; color: #9e9e9e;
                }
                .pct-form-group { margin-bottom: 1rem; }
                .pct-form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
                input[type="text"], textarea, select {
                    width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;
                    box-sizing: border-box; font-size: 14px;
                }
                .pct-mode-buttons { display: flex; justify-content: space-around; gap: 15px; padding: 20px 0; }
                .pct-mode-btn { flex: 1; padding: 20px; font-size: 1rem; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                thead { background-color: #f8f9fa; position: sticky; top: 0; z-index: 1; }
                th, td {
                    border: 1px solid #ddd; padding: 6px 8px; text-align: left;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                tbody tr:hover { background-color: #f1f3f5; cursor: pointer; }
                .pct-filter-buttons { margin-bottom: 10px; user-select:none; }
                .pct-filter-buttons button {
                    margin-right: 6px; padding: 5px 12px; border-radius: 4px;
                    border: 1px solid var(--pct-primary-color); background: white;
                    color: var(--pct-primary-color); cursor: pointer; font-size: 13px; user-select:none;
                }
                .pct-filter-buttons button.active { background: var(--pct-primary-color); color: white; cursor: default; }
                #pct-selection-info { margin-top: 10px; font-weight: 600; color: var(--pct-text-color); }
                .pct-toast {
                    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                    padding: 10px 20px; border-radius: 6px; background-color: #333;
                    color: white; z-index: 10001; box-shadow: 0 3px 6px rgba(0,0,0,0.16);
                    font-size: 14px; transition: top 0.5s ease-in-out, opacity 0.5s ease-in-out;
                }
                .pct-toast-info { background-color: #007bff; }
                .pct-toast-success { background-color: #28a745; }
                .pct-toast-error { background-color: #dc3545; }
                .pct-progress {
                    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.7);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 1.2rem; flex-direction: column; text-align: center;
                }
            `;
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Config.STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        },
        /** 核心 Modal (對話框) 元件 */
        Modal: {
            show(html, onOpen, size = { width: '600px', height: 'auto' }) {
                this.close();
                const mask = document.createElement('div');
                mask.id = 'pctModalMask';
                mask.className = 'pct-modal-mask';
                mask.innerHTML = `<div class="pct-modal-dialog" style="width:${size.width};height:${size.height};">${html}</div>`;
                document.body.appendChild(mask);
                const dialog = mask.querySelector('.pct-modal-dialog');
                mask.addEventListener('click', (e) => { if (e.target === mask) this.close(); });
                dialog.querySelector('.pct-modal-close-btn')?.addEventListener('click', () => this.close());
                if (typeof onOpen === 'function') onOpen(dialog);
            },
            close() {
                document.querySelector('#pctModalMask')?.remove();
            }
        },
        /** Toast (提示訊息) 元件 */
        Toast: {
            show(message, type = 'info', duration = 3000) {
                const existing = document.querySelector('.pct-toast');
                if (existing) existing.remove();
                const toast = document.createElement('div');
                toast.className = `pct-toast pct-toast-${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), duration);
            }
        },
        /** Progress (進度條) 元件 */
        Progress: {
            show(text) {
                this.hide();
                const progress = document.createElement('div');
                progress.id = 'pctProgress';
                progress.className = 'pct-progress';
                progress.innerHTML = `<div>${text}</div>`;
                document.body.appendChild(progress);
            },
            update(percentage, text) {
                const progress = document.getElementById('pctProgress');
                if (progress) progress.innerHTML = `<div>${text}</div><div style="margin-top:10px;">進度: ${percentage}%</div>`;
            },
            hide() {
                document.getElementById('pctProgress')?.remove();
            }
        }
    };

    // =========================================================================
    // 5. DataService (API 服務)
    // =========================================================================
    const DataService = (() => {
        /** 帶有重試機制的 fetch 封裝 */
        async function fetchWithRetry(url, options, retries = Config.RETRY_SETTINGS.count) {
            try {
                const response = await fetch(url, options);
                if (response.status === 401 || response.status === 403) throw new Error('TOKEN_INVALID');
                if (!response.ok) throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);

                const cloneResp = response.clone();
                try {
                    const data = await response.json();
                    console.log('%c[API 回應]', 'color: blue; font-weight: bold;', url, data);
                    return { success: true, data, error: null };
                } catch (e) {
                    const text = await cloneResp.text();
                    console.error('JSON 解析失敗:', e);
                    console.log('%c[API 原始文字]', 'color: red; font-weight: bold;', text);
                    throw new Error('無法解析伺服器回應');
                }
            } catch (error) {
                if(error.name === 'AbortError') return { success: false, error: '請求已取消' };
                if(error.message === 'TOKEN_INVALID') throw error;
                if (retries > 0) {
                    await Utils.sleep(Config.RETRY_SETTINGS.delay);
                    return fetchWithRetry(url, options, retries - 1);
                }
                return { success: false, error: error.message };
            }
        }
        
        /** 取得個人所有案件 */
        async function fetchPersonalCases(signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, error: '缺少Token' };
            let allRecords = [];
            let currentPage = 1;
            let totalPages = 1;
            while(currentPage <= totalPages) {
                const payload = {
                    nowPage: currentPage,
                    pageSize: Config.BATCH_CONFIG.pageSize,
                    orderBy: 'assignId',
                    ascOrDesc: 'desc'
                };
                const options = {
                    method: 'POST',
                    headers: { 'Content-Type':'application/json', 'SSO-TOKEN': token},
                    body: JSON.stringify(payload),
                    signal
                };
                const result = await fetchWithRetry(Config.API_ENDPOINTS.queryPersonalCases, options);
                if (!result.success || !result.data || !result.data.records) break;
                allRecords = allRecords.concat(result.data.records);
                if(currentPage === 1 && result.data.total) {
                    totalPages = Math.ceil(result.data.total / Config.BATCH_CONFIG.pageSize);
                }
                currentPage++;
            }
            return { success: true, data: allRecords };
        }

        /** 查詢公池案件 (可傳入要保號碼陣列) */
        async function fetchPublicCases(params, signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, error: '缺少Token' };
            const payload = {
                pageIndex: 1,
                size: 200, // 增加單次查詢數量以符合批次需求
                poolOrg: 'H',
                orderBys: ['applyNumber asc'],
                ...params
            };
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
                body: JSON.stringify(payload),
                signal
            };
            return fetchWithRetry(Config.API_ENDPOINTS.findPublicProposals, options);
        }

        /** 取得人員清單 */
        async function fetchPersonnel(signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, error: '缺少Token' };
            const payload = {
                validDate: 'true',
                orderBys: ['userName asc', 'adAccount asc']
            };
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
                body: JSON.stringify(payload),
                signal
            };
            return fetchWithRetry(Config.API_ENDPOINTS.fetchPersonnel, options);
        }

        /** 執行案件指派 */
        async function assignCases(applyNumbers, auditor, organization, signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, error: '缺少Token' };
            const payload = {
                dispatchOrgAf: organization,
                auditorAf: auditor,
                dispatchOrgBf: '',
                applyNumbers: applyNumbers
            };
            const options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
                body: JSON.stringify(payload),
                signal
            };
            return fetchWithRetry(Config.API_ENDPOINTS.assignManually, options);
        }

        return {
            fetchPersonalCases,
            fetchPublicCases,
            fetchPersonnel,
            assignCases
        };
    })();

    // =========================================================================
    // 6. UIComponents (UI 元件產生器)
    // =========================================================================
    const UIComponents = (() => {
        /** 顯示 Token 輸入對話框 */
        async function showTokenDialog(showRetryBtn = false) {
            const retryBtnHtml = showRetryBtn ? `<button id="pct-retry-autocheck" class="pct-btn pct-btn-outline">重新自動檢測</button>` : '';
            const htmlContent = `
                <div class="pct-modal-header">設定存取權杖 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="pct-token-input">請貼上您的 SSO-TOKEN</label>
                        <textarea id="pct-token-input" rows="4" placeholder="請在此處貼上完整的Token..."></textarea>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <div>${retryBtnHtml}<button id="pct-skip-token" class="pct-btn pct-btn-outline">略過</button></div>
                    <button id="pct-save-token" class="pct-btn">儲存並繼續</button>
                </div>`;

            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    const tokenInput = modal.querySelector('#pct-token-input');
                    modal.querySelector('#pct-save-token')?.addEventListener('click', () => {
                        const token = tokenInput.value.trim();
                        if (!token) { UI.Toast.show('請輸入Token', 'error'); return; }
                        resolve(token); UI.Modal.close();
                    });
                    modal.querySelector('#pct-retry-autocheck')?.addEventListener('click', () => {
                        resolve('_retry_autocheck_'); UI.Modal.close();
                    });
                    modal.querySelector('#pct-skip-token')?.addEventListener('click', () => {
                        resolve('_skip_'); UI.Modal.close();
                    });
                    setTimeout(() => tokenInput.focus(), 200);
                }, Config.MODAL_SIZES.TOKEN_INPUT);
            });
        }

        /** 顯示模式選擇對話框 */
        async function showModeSelectDialog() {
            const htmlContent = `
                <div class="pct-modal-header">選擇工作模式 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <p>請選擇您要使用的功能：</p>
                    <div class="pct-mode-buttons">
                        <button id="pct-mode-personal" class="pct-btn pct-mode-btn">個人案件派發</button>
                        <button id="pct-mode-public" class="pct-btn pct-mode-btn">公池查詢派件</button>
                        <button id="pct-mode-batch" class="pct-btn pct-mode-btn">批次派工作業</button>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-change-token" class="pct-btn pct-btn-outline">變更Token</button>
                </div>`;
            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    modal.querySelector('#pct-mode-personal')?.addEventListener('click', () => { resolve('personal'); UI.Modal.close(); });
                    modal.querySelector('#pct-mode-public')?.addEventListener('click', () => { resolve('public'); UI.Modal.close(); });
                    modal.querySelector('#pct-mode-batch')?.addEventListener('click', () => { resolve('batch'); UI.Modal.close(); });
                    modal.querySelector('#pct-change-token')?.addEventListener('click', () => { resolve('_change_token_'); UI.Modal.close(); });
                }, Config.MODAL_SIZES.MODE_SELECT);
            });
        }

        /** 顯示個人案件列表對話框 */
        async function showPersonalCasesDialog(cases) {
            const statusCount = cases.reduce((acc, c) => {
                const status = c.assignStatusDesc || c.mainStatus || '未知';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
            }, {});
            let filterButtonsHtml = Object.entries(statusCount).map(([st, count]) => 
                `<button data-status="${Utils.escapeHtml(st)}">${Utils.escapeHtml(st)} (${count})</button>`
            ).join('');
            filterButtonsHtml += `<button data-status="all" class="active">全部 (${cases.length})</button>`;

            const tableRows = cases.map(c => `
                <tr data-status="${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '未知')}">
                    <td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td>
                    <td>${Utils.escapeHtml(c.applyNumber)}</td>
                    <td>${Utils.escapeHtml(c.ownerName || c.policyHolderName || '')}</td>
                    <td>${Utils.escapeHtml(c.insuredName || '')}</td>
                    <td>${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '')}</td>
                </tr>`).join('');

            const html = `
                <div class="pct-modal-header">個人案件列表 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-filter-buttons">${filterButtonsHtml}</div>
                    <div style="overflow-y: auto; max-height: calc(80vh - 200px);">
                        <table class="pct-table">
                            <thead><tr>
                                <th><input type="checkbox" id="select-all-checkbox"></th>
                                <th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th>
                            </tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                    <div id="pct-selection-info"></div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-back-to-mode" class="pct-btn pct-btn-outline">返回</button>
                    <button id="pct-next-to-personnel" class="pct-btn" disabled>下一步</button>
                </div>`;
            return new Promise((resolve) => {
                UI.Modal.show(html, (modal) => {
                    // 綁定事件處理器
                    const filterButtons = modal.querySelectorAll('.pct-filter-buttons button');
                    const selectAllCheckbox = modal.querySelector('#select-all-checkbox');
                    const caseCheckboxes = modal.querySelectorAll('.case-checkbox');
                    const selectionInfo = modal.querySelector('#pct-selection-info');
                    const nextButton = modal.querySelector('#pct-next-to-personnel');
                    const tbody = modal.querySelector('tbody');

                    function updateSelection() {
                        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none');
                        const checkedBoxes = visibleCheckboxes.filter(cb => cb.checked);
                        
                        selectionInfo.textContent = `已選 ${checkedBoxes.length} 筆 / 可見 ${visibleCheckboxes.length} 筆 / 共 ${cases.length} 筆`;
                        nextButton.disabled = checkedBoxes.length === 0;
                        
                        selectAllCheckbox.checked = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb.checked);
                        selectAllCheckbox.indeterminate = !selectAllCheckbox.checked && checkedBoxes.length > 0;
                        
                        GlobalState.set({ selectedCases: checkedBoxes.map(cb => cb.value) });
                    }

                    filterButtons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            filterButtons.forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            const status = btn.getAttribute('data-status');
                            caseCheckboxes.forEach(cb => {
                                const tr = cb.closest('tr');
                                tr.style.display = (status === 'all' || tr.getAttribute('data-status') === status) ? '' : 'none';
                            });
                            updateSelection();
                        });
                    });

                    selectAllCheckbox.addEventListener('change', () => {
                        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => cb.closest('tr').style.display !== 'none');
                        visibleCheckboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
                        updateSelection();
                    });

                    tbody.addEventListener('change', (e) => {
                        if (e.target.classList.contains('case-checkbox')) {
                            updateSelection();
                        }
                    });

                    modal.querySelector('#pct-back-to-mode').addEventListener('click', () => { resolve('_back_to_mode_'); UI.Modal.close(); });
                    modal.querySelector('#pct-next-to-personnel').addEventListener('click', () => { resolve('_next_to_personnel_'); UI.Modal.close(); });
                    updateSelection();
                }, Config.MODAL_SIZES.PERSONAL_CASES);
            });
        }

        /** 顯示公池案件列表對話框 */
        async function showPublicCasesDialog(cases) {
             const casesCount = cases.length;
             const tableRows = cases.map(c => `
                 <tr>
                     <td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td>
                     <td>${Utils.escapeHtml(c.applyNumber)}</td>
                     <td>${Utils.escapeHtml(c.policyHolderName || '')}</td>
                     <td>${Utils.escapeHtml(c.insuredName || '')}</td>
                     <td>${Utils.escapeHtml(c.status || '')}</td>
                 </tr>`).join('');
     
             const html = `
                 <div class="pct-modal-header">公池查詢結果 <button class="pct-modal-close-btn">&times;</button></div>
                 <div class="pct-modal-body">
                    <div style="overflow-y: auto; max-height: calc(80vh - 180px);">
                         <table class="pct-table">
                             <thead><tr>
                                 <th><input type="checkbox" id="select-all-checkbox"></th>
                                 <th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th>
                             </tr></thead>
                             <tbody>${tableRows}</tbody>
                         </table>
                    </div>
                     <div id="pct-selection-info"></div>
                 </div>
                 <div class="pct-modal-footer">
                     <button id="pct-back-to-mode" class="pct-btn pct-btn-outline">返回</button>
                     <button id="pct-next-to-personnel" class="pct-btn" disabled>下一步</button>
                 </div>`;
 
             return new Promise((resolve) => {
                 UI.Modal.show(html, modal => {
                     const selectAllCheckbox = modal.querySelector('#select-all-checkbox');
                     const caseCheckboxes = modal.querySelectorAll('.case-checkbox');
                     const nextButton = modal.querySelector('#pct-next-to-personnel');
                     const selectionInfo = modal.querySelector('#pct-selection-info');
                     const tbody = modal.querySelector('tbody');
 
                     function updateSelection() {
                         const checkedBoxes = Array.from(caseCheckboxes).filter(cb => cb.checked);
                         selectionInfo.textContent = `已選 ${checkedBoxes.length} 筆 / 共 ${casesCount} 筆`;
                         nextButton.disabled = checkedBoxes.length === 0;
                         selectAllCheckbox.checked = casesCount > 0 && checkedBoxes.length === casesCount;
                         selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < casesCount;
                         GlobalState.set({ selectedCases: checkedBoxes.map(cb => cb.value) });
                     }
 
                     selectAllCheckbox.addEventListener('change', () => {
                         caseCheckboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
                         updateSelection();
                     });
 
                     tbody.addEventListener('change', (e) => {
                         if (e.target.classList.contains('case-checkbox')) {
                            updateSelection();
                         }
                     });
 
                     modal.querySelector('#pct-back-to-mode').addEventListener('click', () => { resolve('_back_to_mode_'); UI.Modal.close(); });
                     modal.querySelector('#pct-next-to-personnel').addEventListener('click', () => { resolve('_next_to_personnel_'); UI.Modal.close(); });
                     updateSelection();
                 }, Config.MODAL_SIZES.PUBLIC_CASES);
             });
        }
        
        /** 顯示人員選擇對話框 */
        async function showPersonnelSelectDialog(personnelList) {
            let personnelOptions = '';
            if (personnelList && personnelList.length > 0) {
                personnelOptions = personnelList.map(p =>
                    `<option value="${Utils.escapeHtml(p.adAccount)}">${Utils.escapeHtml(p.userName)} (${Utils.escapeHtml(p.adAccount)})</option>`
                ).join('');
            }

            const html = `
                <div class="pct-modal-header">選擇派件人員 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <p>您已選擇 <strong>${GlobalState.get('selectedCases').length}</strong> 筆案件</p>
                    ${personnelList && personnelList.length > 0 ? `
                        <div class="pct-form-group">
                            <label for="personnel-select">請選擇派件人員：</label>
                            <select id="personnel-select">
                                <option value="">請選擇...</option>
                                ${personnelOptions}
                            </select>
                        </div>`
                        : '<p style="color:#dc3545;">查無可用人員清單，請使用下方手動輸入。</p>'
                    }
                    <div class="pct-manual-input" style="margin-top: 12px;">
                        <label><input type="checkbox" id="use-manual-input"> 使用手動輸入帳號</label>
                        <input type="text" id="manual-employee-id" placeholder="請輸入員工帳號" style="display:none; margin-top: 5px;">
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="btn-back" class="pct-btn pct-btn-outline">返回</button>
                    <button id="btn-confirm" class="pct-btn" disabled>確認派件</button>
                </div>`;

            return new Promise((resolve) => {
                UI.Modal.show(html, (modal) => {
                    const btnBack = modal.querySelector('#btn-back');
                    const btnConfirm = modal.querySelector('#btn-confirm');
                    const selectElem = modal.querySelector('#personnel-select');
                    const checkboxManual = modal.querySelector('#use-manual-input');
                    const inputManual = modal.querySelector('#manual-employee-id');

                    function updateBtnState() {
                        if (checkboxManual.checked) {
                            btnConfirm.disabled = inputManual.value.trim() === '';
                        } else {
                            btnConfirm.disabled = !selectElem || selectElem.value === '';
                        }
                    }
                    
                    btnBack.addEventListener('click', () => { resolve('_back_to_cases_'); UI.Modal.close(); });
                    btnConfirm.addEventListener('click', () => {
                        const assignee = checkboxManual.checked ? inputManual.value.trim() : selectElem.value;
                        if (!assignee) { UI.Toast.show('請選擇或輸入派件人員', 'error'); return; }
                        resolve({ action: '_confirm_assignment_', assignee }); UI.Modal.close();
                    });

                    if (selectElem) selectElem.addEventListener('change', updateBtnState);
                    
                    checkboxManual.addEventListener('change', () => {
                        inputManual.style.display = checkboxManual.checked ? 'block' : 'none';
                        if (selectElem) selectElem.disabled = checkboxManual.checked;
                        updateBtnState();
                    });

                    inputManual.addEventListener('input', updateBtnState);
                    setTimeout(() => { if (selectElem) selectElem.focus(); }, 200);
                    updateBtnState();
                }, Config.MODAL_SIZES.PERSONNEL_SELECT);
            });
        }
        
        /** 顯示批次作業設定對話框 */
        async function showBatchSetupDialog() {
            const html = `
                <div class="pct-modal-header">批次派工作業設定 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="batch-apply-numbers">要保號列表 (以逗號、空格或換行分隔)</label>
                        <textarea id="batch-apply-numbers" rows="8" placeholder="請貼上要保號列表..."></textarea>
                    </div>
                    <div class="pct-form-group">
                        <label for="batch-auditor">派件對象 (員工 AD 帳號)</label>
                        <input type="text" id="batch-auditor" value="${Config.BATCH_CONFIG.defaultAuditor}">
                    </div>
                    <div class="pct-form-group">
                        <label><input type="checkbox" id="batch-dry-run"> 僅查詢不派件 (Dry Run)</label>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="batch-cancel" class="pct-btn pct-btn-outline">取消</button>
                    <button id="batch-start" class="pct-btn">開始執行</button>
                </div>`;
            return new Promise(resolve => {
                UI.Modal.show(html, modal => {
                    modal.querySelector('#batch-cancel').addEventListener('click', () => { resolve(null); UI.Modal.close(); });
                    modal.querySelector('#batch-start').addEventListener('click', () => {
                        const applyNumbersRaw = modal.querySelector('#batch-apply-numbers').value;
                        const auditor = modal.querySelector('#batch-auditor').value.trim();
                        const isDryRun = modal.querySelector('#batch-dry-run').checked;

                        const applyNumbers = Utils.splitInput(applyNumbersRaw).map(Utils.toHalfWidthUpperCase);

                        if (applyNumbers.length === 0) { UI.Toast.show('請輸入要保號', 'error'); return; }
                        if (!auditor) { UI.Toast.show('請輸入派件對象帳號', 'error'); return; }
                        
                        resolve({ applyNumbers, auditor, isDryRun });
                        UI.Modal.close();
                    });
                }, Config.MODAL_SIZES.BATCH_SETUP);
            });
        }

        // 匯出所有 UI 元件函式
        return {
            showTokenDialog,
            showModeSelectDialog,
            showPersonalCasesDialog,
            showPublicCasesDialog,
            showPersonnelSelectDialog,
            showBatchSetupDialog
        };
    })();

    // =========================================================================
    // 7. Main (主要應用程式流程控制)
    // =========================================================================
    const Main = (() => {
        /** 處理人員選擇與最終派件的通用流程 */
        async function handleAssignmentFlow(backActionCallback) {
            UI.Progress.show('載入人員列表中…');
            const personnelRes = await DataService.fetchPersonnel();
            UI.Progress.hide();

            if (!personnelRes.success && personnelRes.error !== 'aborted') {
                UI.Toast.show(`取得人員列表失敗: ${personnelRes.error}`, 'error');
                await backActionCallback(); // 失敗時返回上一層
                return;
            }
            
            const personnelList = personnelRes.data?.records || [];
            GlobalState.set({ personnelList });
            
            const assignAction = await UIComponents.showPersonnelSelectDialog(personnelList);

            if (assignAction === '_back_to_cases_') {
                await backActionCallback();
                return;
            }

            if (assignAction?.action === '_confirm_assignment_') {
                const { assignee } = assignAction;
                const casesToAssign = GlobalState.get('selectedCases');
                
                UI.Progress.show(`正在派件 ${casesToAssign.length} 筆案件...`);
                try {
                    const assignRes = await DataService.assignCases(casesToAssign, assignee, Config.BATCH_CONFIG.defaultDispatchOrg);
                    UI.Progress.hide();
                    if (assignRes.success) {
                        UI.Toast.show(`成功派件 ${casesToAssign.length} 筆案件給 ${assignee}`, 'success', 5000);
                    } else {
                        UI.Toast.show(`派件失敗: ${assignRes.error || '未知錯誤'}`, 'error', 5000);
                    }
                } catch(e) {
                    UI.Progress.hide();
                    UI.Toast.show(`派件時發生例外錯誤: ${e.message}`, 'error', 5000);
                }
            }
        }
        
        /** 個人案件派發流程 */
        async function runPersonalFlow() {
            UI.Progress.show('載入個人案件中…');
            const res = await DataService.fetchPersonalCases();
            UI.Progress.hide();
            
            if (!res.success) {
                UI.Toast.show(`無法取得個人案件: ${res.error || '未知錯誤'}`, 'error');
                return;
            }
            
            GlobalState.set({ personalCases: res.data, selectedCases: [], currentMode: 'personal' });

            const userAction = await UIComponents.showPersonalCasesDialog(res.data);
            if (userAction === '_next_to_personnel_') {
                await handleAssignmentFlow(runPersonalFlow); // 設定返回動作為重新執行個人流程
            }
        }

        /** 公池查詢派件流程 */
        async function runPublicFlow() {
            UI.Progress.show('載入公池案件中…');
            const res = await DataService.fetchPublicCases({}); // 傳入空物件以使用預設參數查詢
            UI.Progress.hide();

            if (!res.success) {
                UI.Toast.show(`無法取得公池案件: ${res.error || '未知錯誤'}`, 'error');
                return;
            }
            
            const cases = res.data?.content || [];
            GlobalState.set({ publicCases: cases, selectedCases: [], currentMode: 'public' });

            const userAction = await UIComponents.showPublicCasesDialog(cases);
            if (userAction === '_next_to_personnel_') {
                await handleAssignmentFlow(runPublicFlow); // 設定返回動作為重新執行公池流程
            }
        }
        
        /** 批次派工作業流程 */
        async function runBatchFlow() {
            const setup = await UIComponents.showBatchSetupDialog();
            if (!setup) { UI.Toast.show('操作已取消', 'info'); return; }

            const { applyNumbers, auditor, isDryRun } = setup;
            
            UI.Progress.show(`查詢中 0/${applyNumbers.length}…`);
            const queryRes = await DataService.fetchPublicCases({ applyNumbers });
            
            if (!queryRes.success) {
                UI.Progress.hide();
                UI.Toast.show(`查詢失敗: ${queryRes.error}`, 'error');
                return;
            }

            const foundCases = queryRes.data?.content || [];
            const foundNumbers = new Set(foundCases.map(c => c.applyNumber));
            const failedNumbers = applyNumbers.filter(num => !foundNumbers.has(num));

            UI.Progress.hide();
            
            let resultMessage = `查詢完成！\n成功找到 ${foundCases.length} 筆，失敗 ${failedNumbers.length} 筆。`;
            if (failedNumbers.length > 0) {
                console.warn('查詢失敗或不存在的要保號:', failedNumbers);
                resultMessage += `\n(失敗列表請見開發者工具 Console)`;
            }
            alert(resultMessage);

            if (isDryRun || foundCases.length === 0) {
                UI.Toast.show(isDryRun ? 'Dry Run 結束，未執行派件。' : '無案件可派送。', 'info');
                return;
            }
            
            if (confirm(`確定要將這 ${foundCases.length} 筆案件派送給 ${auditor} 嗎？`)) {
                UI.Progress.show(`派件中 0/${foundCases.length}…`);
                const assignRes = await DataService.assignCases(Array.from(foundNumbers), auditor, Config.BATCH_CONFIG.defaultDispatchOrg);
                UI.Progress.hide();
                if (assignRes.success) {
                    UI.Toast.show(`成功派件 ${foundCases.length} 筆`, 'success', 5000);
                } else {
                    UI.Toast.show(`派件失敗: ${assignRes.error}`, 'error', 5000);
                }
            } else {
                UI.Toast.show('操作已取消', 'info');
            }
        }
        
        /** 初始化函式，程式進入點 */
        async function initialize() {
            UI.injectStyle();

            // 1. 處理 Token
            let token = Utils.findStoredToken();
            if (!token) {
                const tokenInput = await UIComponents.showTokenDialog(false);
                if (!tokenInput || tokenInput === '_skip_') {
                    UI.Toast.show('未提供 Token，部分功能可能無法使用', 'error');
                    token = null;
                } else {
                    token = tokenInput;
                    localStorage.setItem(Config.TOKEN_STORAGE_KEY, token); // 儲存 Token
                }
            }
            GlobalState.set({ token });
            
            // 2. 進入主迴圈，選擇模式
            let isRunning = true;
            while(isRunning) {
                const mode = await UIComponents.showModeSelectDialog();
                switch (mode) {
                    case 'personal':
                        await runPersonalFlow();
                        break;
                    case 'public':
                        await runPublicFlow();
                        break;
                    case 'batch':
                        await runBatchFlow();
                        break;
                    case '_change_token_':
                        localStorage.removeItem(Config.TOKEN_STORAGE_KEY);
                        const newToken = await UIComponents.showTokenDialog(false);
                        if (newToken && newToken !== '_skip_') {
                             GlobalState.set({ token: newToken });
                             localStorage.setItem(Config.TOKEN_STORAGE_KEY, newToken);
                             UI.Toast.show('Token 已更新', 'success');
                        }
                        break;
                    default: // 使用者關閉視窗或取消
                        isRunning = false;
                        break;
                }
            }
            UI.Toast.show('工具已關閉', 'info');
        }

        return { initialize };
    })();

    // =========================================================================
    // 8. Tool Initializer (啟動器)
    // =========================================================================
    (() => {
        // 清理可能殘留的舊版元件
        document.querySelectorAll(`#${Config.TOOL_ID}, #${Config.STYLE_ID}, .pct-toast, #pctModalMask, #pctProgress`).forEach(el => el.remove());
        // 啟動主程式
        Main.initialize().catch(err => {
            console.error("工具執行時發生未預期的嚴重錯誤:", err);
            alert("工具執行時發生嚴重錯誤，請檢查開發者工具 Console 的訊息。");
        });
    })();

})();
