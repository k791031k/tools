javascript:(function() {
    'use strict';

    // =========================================================================
    // SECTION: 1. Config (組態設定模組) - 新增個人案件API
    // =========================================================================
    const Config = {
        VERSION: '4.0.0-integrated',
        TOOL_ID: 'pct-main-container',
        STYLE_ID: 'pct-custom-styles',
        TOKEN_STORAGE_KEY: 'euisToken',
        API_ENDPOINTS: {
            // 原有批次派工API
            findProposal: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually',
            // 新增個人案件API
            queryPersonalCases: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
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
            BATCH_SETUP: { width: '600px', height: 'auto' },
            PERSONAL_CASES: { width: '85vw', height: '80vh' },
            PERSONNEL_SELECT: { width: '600px', height: 'auto' },
            RESULTS_TABLE: { width: '95vw', height: '90vh' }
        },
    };

    // =========================================================================
    // SECTION: 2. GlobalState (全域狀態管理模組) - 新增個人案件狀態
    // =========================================================================
    const GlobalState = (() => {
        let state = {
            token: null,
            env: window.location.hostname.includes('-uat') ? 'UAT' : 'PROD',
            results: [],
            currentQueryController: null,
            // 新增個人案件相關狀態
            personalCases: [],
            selectedCases: [],
            personnelList: [],
            currentMode: null // 'batch' 或 'personal'
        };
        return {
            get: (key) => state[key],
            set: (newState) => { state = { ...state, ...newState }; },
        };
    })();

    // =========================================================================
    // SECTION: 3. Utils (工具函數模組)
    // =========================================================================
    const Utils = {
        findStoredToken: () => localStorage.getItem(Config.TOKEN_STORAGE_KEY) || sessionStorage.getItem('SSO-TOKEN') || null,
        splitInput: (text) => text.split(/[\s,，\n]+/).filter(Boolean),
        toHalfWidthUpperCase: (str) => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).toUpperCase(),
        escapeHtml: (str) => String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]),
    };

    // =========================================================================
    // SECTION: 4. UI (通用UI管理模組)
    // =========================================================================
    const UI = {
        injectStyle: () => {
            const css = `
              :root { --pct-primary-color: #007bff; --pct-background-color: #fff; --pct-text-color: #333; }
              .pct-modal-mask { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); z-index: 9998; display: flex; align-items: center; justify-content: center; }
              .pct-modal-dialog { background-color: var(--pct-background-color); border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
              .pct-modal-header { padding: 16px; border-bottom: 1px solid #dee2e6; font-size: 1.25rem; font-weight: 500; display: flex; justify-content: space-between; align-items: center; }
              .pct-modal-body { padding: 16px; overflow-y: auto; }
              .pct-modal-footer { padding: 12px 16px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; background-color: #f8f9fa; }
              .pct-modal-close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6c757d; }
              .pct-btn { padding: 8px 16px; border: 1px solid var(--pct-primary-color); background-color: var(--pct-primary-color); color: white; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; margin-left: 8px; }
              .pct-btn-outline { background-color: transparent; color: var(--pct-primary-color); }
              .pct-btn:disabled { background-color: #6c757d; cursor: not-allowed; }
              .pct-form-group { margin-bottom: 1rem; } 
              .pct-form-group label { display: block; margin-bottom: .5rem; font-weight: 500; }
              .pct-form-group input[type="text"], .pct-form-group textarea, .pct-form-group select { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
              .pct-form-check-group { display: flex; gap: 20px; align-items: center; } 
              .pct-form-check-group label { font-weight: normal; }
              .pct-mode-buttons { display: flex; gap: 15px; justify-content: center; margin: 20px 0; }
              .pct-mode-btn { padding: 15px 25px; font-size: 16px; border-radius: 8px; }
              .pct-table { width: 100%; border-collapse: collapse; font-size: 13px; }
              .pct-table th, .pct-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
              .pct-table thead tr { background: #f8f9fa; position: sticky; top: 0; }
              .pct-table tbody tr:hover { background-color: #f5faff; }
              .pct-filter-buttons { margin-bottom: 10px; }
              .pct-filter-buttons button { margin-right: 5px; padding: 4px 8px; border: 1px solid #007bff; background: white; color: #007bff; border-radius: 3px; cursor: pointer; font-size: 12px; }
              .pct-filter-buttons button.active { background: #007bff; color: white; }
              .pct-manual-input { margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd; }
              .pct-toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 6px; color: #fff; z-index: 9999; font-weight: 600; }
              .pct-toast.info { background: #17a2b8; } .pct-toast.success { background: #28a745; } .pct-toast.warning { background: #ffc107; color: #212529; } .pct-toast.error { background: #dc3545; }
              .pct-progress { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px; z-index: 10000; }
            `;
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Config.STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        },
        Modal: {
            show(html, onOpen, size = {}) {
                const mask = document.createElement('div');
                mask.id = 'pctModalMask';
                mask.className = 'pct-modal-mask';
                mask.innerHTML = `<div class="pct-modal-dialog" style="width:${size.width || 'auto'}; height:${size.height || 'auto'};">${html}</div>`;
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
        Toast: {
            show(message, type = 'info', duration = 3000) {
                const existingToast = document.querySelector('.pct-toast');
                if (existingToast) existingToast.remove();
                const toast = document.createElement('div');
                toast.className = `pct-toast ${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), duration);
            }
        },
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
                if (progress) progress.innerHTML = `<div>${text}</div><div>進度: ${percentage}%</div>`;
            },
            hide() {
                document.getElementById('pctProgress')?.remove();
            }
        }
    };
    
    // =========================================================================
    // SECTION: 5. DataService (API與資料服務模組) - 新增個人案件API
    // =========================================================================
    const DataService = (() => {
        async function fetchWithRetry(url, options, retries = Config.RETRY_SETTINGS.count) {
            try {
                const response = await fetch(url, options);
                if (response.status === 401 || response.status === 403) throw new Error('TOKEN_INVALID');
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                
                const responseClone = response.clone();
                try {
                    const data = await response.json();
                    console.log('%c[API回應]', 'color: blue; font-weight: bold;', url, data);
                    return { success: true, data: data, error: null };
                } catch (jsonError) {
                    console.error('JSON解析失敗:', jsonError);
                    const textData = await responseClone.text();
                    console.log('%c[API原始回應]', 'color: red; font-weight: bold;', textData);
                    throw new Error('Failed to parse JSON response');
                }
            } catch (error) {
                if (error.name === 'AbortError') return { success: false, data: null, error: 'aborted' };
                if (error.message === 'TOKEN_INVALID') throw error;
                if (retries > 0) {
                    await new Promise(res => setTimeout(res, Config.RETRY_SETTINGS.delay));
                    return fetchWithRetry(url, options, retries - 1);
                }
                return { success: false, data: null, error: error.message };
            }
        }

        // 原有批次查詢功能
        async function query(value, apiKey, signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, data: null, error: 'token_missing' };
            const payload = { [apiKey]: value, pageIndex: 1, size: 50 };
            const options = { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token }, 
                body: JSON.stringify(payload), 
                signal 
            };
            return await fetchWithRetry(Config.API_ENDPOINTS.findProposal, options);
        }

        // 新增：查詢個人案件（支援分頁）
        async function fetchAllPersonalCases(signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, data: null, error: 'token_missing' };
            
            let allCases = [];
            let currentPage = 1;
            let totalPages = 1;
            
            while (currentPage <= totalPages) {
                const payload = {
                    nowPage: currentPage,
                    pageSize: Config.BATCH_CONFIG.pageSize,
                    orderBy: 'assignId',
                    ascOrDesc: 'desc'
                };
                
                const options = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token },
                    body: JSON.stringify(payload),
                    signal
                };
                
                const result = await fetchWithRetry(Config.API_ENDPOINTS.queryPersonalCases, options);
                if (!result.success || !result.data || !result.data.records) break;
                
                allCases = allCases.concat(result.data.records);
                if (currentPage === 1 && result.data.total) {
                    totalPages = Math.ceil(result.data.total / Config.BATCH_CONFIG.pageSize);
                }
                currentPage++;
            }
            return { success: true, data: allCases, error: null };
        }

        // 新增：查詢人員清單
        async function fetchPersonnel(signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, data: null, error: 'token_missing' };
            
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
            
            return await fetchWithRetry(Config.API_ENDPOINTS.fetchPersonnel, options);
        }

        // 派工功能（兩種模式共用）
        async function assignManually(applyNumberList, auditor, organization, signal) {
            const token = GlobalState.get('token');
            if (!token) return { success: false, data: null, error: 'token_missing' };
            const payload = { 
                "dispatchOrgAf": organization, 
                "auditorAf": auditor, 
                "dispatchOrgBf": "", 
                "applyNumbers": applyNumberList 
            };
            const options = { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token }, 
                body: JSON.stringify(payload), 
                signal 
            };
            return await fetchWithRetry(Config.API_ENDPOINTS.assignManually, options);
        }

        return { query, fetchAllPersonalCases, fetchPersonnel, assignManually };
    })();

    // =========================================================================
    // SECTION: 6. UIComponents (業務特定UI元件模組) - 新增個人案件UI
    // =========================================================================
    const UIComponents = (() => {
        // Token 輸入對話框
        async function showTokenDialog(showRetryBtn = false) {
            const retryBtnHtml = showRetryBtn ? '<button id="pct-retry-autocheck" class="pct-btn pct-btn-outline">重新自動檢測</button>' : '';
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
                        resolve('_token_skip_'); UI.Modal.close();
                    });
                    setTimeout(() => tokenInput.focus(), 200);
                }, Config.MODAL_SIZES.TOKEN_INPUT);
            });
        }

        // 模式選擇對話框
        async function showModeSelectDialog() {
            const htmlContent = `
                <div class="pct-modal-header">選擇工作模式 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <p>請選擇您要使用的功能：</p>
                    <div class="pct-mode-buttons">
                        <button id="pct-mode-personal" class="pct-btn pct-mode-btn">個人案件派發</button>
                        <button id="pct-mode-batch" class="pct-btn pct-mode-btn">批次派工作業</button>
                    </div>
                    <div style="margin-top: 20px; font-size: 14px; color: #666;">
                        <p><strong>個人案件派發：</strong>查看並派發您個人名下的所有案件</p>
                        <p><strong>批次派工作業：</strong>透過要保號批次查詢並派工案件</p>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-change-token" class="pct-btn pct-btn-outline">變更Token</button>
                    <div></div>
                </div>`;
            
            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    modal.querySelector('#pct-mode-personal')?.addEventListener('click', () => {
                        resolve('personal'); UI.Modal.close();
                    });
                    modal.querySelector('#pct-mode-batch')?.addEventListener('click', () => {
                        resolve('batch'); UI.Modal.close();
                    });
                    modal.querySelector('#pct-change-token')?.addEventListener('click', () => {
                        resolve('_change_token_'); UI.Modal.close();
                    });
                }, Config.MODAL_SIZES.MODE_SELECT);
            });
        }

        // 個人案件列表對話框
        async function showPersonalCasesDialog(cases) {
            // 計算狀態統計
            const statusCount = {};
            cases.forEach(c => {
                const status = c.assignStatusDesc || c.mainStatus || '未知';
                statusCount[status] = (statusCount[status] || 0) + 1;
            });

            // 生成篩選按鈕
            let filterBtnsHtml = '';
            Object.entries(statusCount).forEach(([status, count]) => {
                filterBtnsHtml += `<button data-status="${Utils.escapeHtml(status)}">${Utils.escapeHtml(status)} (${count})</button>`;
            });
            filterBtnsHtml += `<button data-status="all" class="active">全部</button>`;

            // 生成表格行
            const tableRows = cases.map(c => `
                <tr data-status="${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '未知')}">
                    <td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(c.applyNumber)}"></td>
                    <td>${Utils.escapeHtml(c.applyNumber)}</td>
                    <td>${Utils.escapeHtml(c.ownerName || c.policyHolderName || '')}</td>
                    <td>${Utils.escapeHtml(c.insuredName || '')}</td>
                    <td>${Utils.escapeHtml(c.assignStatusDesc || c.mainStatus || '')}</td>
                </tr>
            `).join('');

            const htmlContent = `
                <div class="pct-modal-header">個人案件列表 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-filter-buttons">${filterBtnsHtml}</div>
                    <table class="pct-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="select-all-checkbox"></th>
                                <th>要保號</th><th>要保人</th><th>被保人</th><th>狀態</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div id="selection-info" style="margin-top: 10px;">已選 0 筆 / 共 ${cases.length} 筆</div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-back-to-mode" class="pct-btn pct-btn-outline">返回</button>
                    <button id="pct-next-to-personnel" class="pct-btn" disabled>下一步</button>
                </div>`;

            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    const filterButtons = modal.querySelectorAll('.pct-filter-buttons button');
                    const selectAllCheckbox = modal.querySelector('#select-all-checkbox');
                    const caseCheckboxes = modal.querySelectorAll('.case-checkbox');
                    const selectionInfo = modal.querySelector('#selection-info');
                    const nextButton = modal.querySelector('#pct-next-to-personnel');

                    function updateSelection() {
                        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => 
                            cb.closest('tr').style.display !== 'none');
                        const checkedBoxes = visibleCheckboxes.filter(cb => cb.checked);
                        
                        selectionInfo.textContent = `已選 ${checkedBoxes.length} 筆 / 共 ${cases.length} 筆`;
                        nextButton.disabled = checkedBoxes.length === 0;
                        
                        // 更新全選狀態
                        selectAllCheckbox.checked = visibleCheckboxes.length > 0 && 
                            visibleCheckboxes.every(cb => cb.checked);
                        selectAllCheckbox.indeterminate = !selectAllCheckbox.checked && 
                            checkedBoxes.length > 0;
                        
                        // 更新全域狀態
                        GlobalState.set({ selectedCases: checkedBoxes.map(cb => cb.value) });
                    }

                    // 篩選按鈕事件
                    filterButtons.forEach(btn => {
                        btn.addEventListener('click', () => {
                            filterButtons.forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                            const status = btn.getAttribute('data-status');
                            
                            caseCheckboxes.forEach(cb => {
                                const tr = cb.closest('tr');
                                tr.style.display = (status === 'all' || 
                                    tr.getAttribute('data-status') === status) ? '' : 'none';
                            });
                            updateSelection();
                        });
                    });

                    // 全選事件
                    selectAllCheckbox.addEventListener('change', () => {
                        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => 
                            cb.closest('tr').style.display !== 'none');
                        visibleCheckboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
                        updateSelection();
                    });

                    // 單選事件
                    caseCheckboxes.forEach(cb => {
                        cb.addEventListener('change', updateSelection);
                    });

                    // 按鈕事件
                    modal.querySelector('#pct-back-to-mode')?.addEventListener('click', () => {
                        resolve('_back_to_mode_'); UI.Modal.close();
                    });
                    modal.querySelector('#pct-next-to-personnel')?.addEventListener('click', () => {
                        resolve('_next_to_personnel_'); UI.Modal.close();
                    });

                    updateSelection();
                }, Config.MODAL_SIZES.PERSONAL_CASES);
            });
        }

        // 人員選擇對話框
        async function showPersonnelSelectDialog(personnelList) {
            let personnelOptions = '';
            if (personnelList.length > 0) {
                personnelOptions = personnelList.map(p => 
                    `<option value="${Utils.escapeHtml(p.adAccount)}">${Utils.escapeHtml(p.userName)} (${Utils.escapeHtml(p.adAccount)})</option>`
                ).join('');
            }

            const htmlContent = `
                <div class="pct-modal-header">選擇派件人員 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <p>您已選擇 <strong>${GlobalState.get('selectedCases').length}</strong> 筆案件</p>
                    ${personnelList.length > 0 ? `
                        <div class="pct-form-group">
                            <label for="personnel-select">請選擇派件人員：</label>
                            <select id="personnel-select">
                                <option value="">請選擇...</option>
                                ${personnelOptions}
                            </select>
                        </div>
                    ` : `<p style="color: #dc3545;">查無可用人員清單</p>`}
                    
                    <div class="pct-manual-input">
                        <label><input type="checkbox" id="use-manual-input"> 手動輸入人員帳號</label>
                        <input type="text" id="manual-person-id" placeholder="請輸入人員帳號" style="display:none; margin-top: 8px;" />
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-back-to-cases" class="pct-btn pct-btn-outline">返回</button>
                    <button id="pct-confirm-assign" class="pct-btn" disabled>確認派件</button>
                </div>`;

            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    const personnelSelect = modal.querySelector('#personnel-select');
                    const useManualInput = modal.querySelector('#use-manual-input');
                    const manualPersonId = modal.querySelector('#manual-person-id');
                    const confirmButton = modal.querySelector('#pct-confirm-assign');

                    function checkButtonState() {
                        if (useManualInput && useManualInput.checked) {
                            confirmButton.disabled = !manualPersonId.value.trim();
                        } else {
                            confirmButton.disabled = !personnelSelect || !personnelSelect.value;
                        }
                    }

                    // 切換手動輸入
                    useManualInput?.addEventListener('change', () => {
                        if (useManualInput.checked) {
                            manualPersonId.style.display = 'block';
                            if (personnelSelect) personnelSelect.disabled = true;
                        } else {
                            manualPersonId.style.display = 'none';
                            if (personnelSelect) personnelSelect.disabled = false;
                        }
                        checkButtonState();
                    });

                    personnelSelect?.addEventListener('change', checkButtonState);
                    manualPersonId?.addEventListener('input', checkButtonState);

                    modal.querySelector('#pct-back-to-cases')?.addEventListener('click', () => {
                        resolve('_back_to_cases_'); UI.Modal.close();
                    });
                    
                    modal.querySelector('#pct-confirm-assign')?.addEventListener('click', () => {
                        const assigneeId = useManualInput && useManualInput.checked ? 
                            manualPersonId.value.trim() : personnelSelect?.value;
                        if (!assigneeId) {
                            UI.Toast.show('請選擇或輸入派件人員', 'error');
                            return;
                        }
                        resolve({ action: '_confirm_assign_', assigneeId });
                        UI.Modal.close();
                    });
                }, Config.MODAL_SIZES.PERSONNEL_SELECT);
            });
        }

        // 批次設定對話框（原有功能保留）
        async function showBatchSetupDialog() {
            const htmlContent = `
                <div class="pct-modal-header">批次派工作業設定 <button class="pct-modal-close-btn">&times;</button></div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="pct-batch-auditor">指派對象 (AD帳號)</label>
                        <input type="text" id="pct-batch-auditor" value="${Utils.escapeHtml(Config.BATCH_CONFIG.defaultAuditor)}">
                    </div>
                    <div class="pct-form-group">
                        <label for="pct-batch-numbers">要保書號碼 (每行一個，或用逗號/空白分隔)</label>
                        <textarea id="pct-batch-numbers" rows="10" placeholder="請在此貼上多筆要保書號碼..."></textarea>
                    </div>
                    <div class="pct-form-group pct-form-check-group">
                         <label><input type="radio" name="runMode" value="dry" checked> 演練模式 (僅查詢)</label>
                         <label><input type="radio" name="runMode" value="actual"> 實際模式 (查詢後派工)</label>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-back-to-mode-batch" class="pct-btn pct-btn-outline">返回</button>
                    <button id="pct-start-batch" class="pct-btn">開始執行</button>
                </div>`;
            
            return new Promise(resolve => {
                UI.Modal.show(htmlContent, (modal) => {
                    const auditorInput = modal.querySelector('#pct-batch-auditor');
                    const numbersInput = modal.querySelector('#pct-batch-numbers');
                    
                    modal.querySelector('#pct-back-to-mode-batch')?.addEventListener('click', () => {
                        resolve('_back_to_mode_'); UI.Modal.close();
                    });
                    
                    modal.querySelector('#pct-start-batch')?.addEventListener('click', () => {
                        const applyNumbers = Utils.splitInput(numbersInput.value);
                        const auditor = auditorInput.value.trim();
                        const isDryRun = modal.querySelector('input[name="runMode"]:checked').value === 'dry';
                        if (!auditor) { UI.Toast.show('請輸入指派對象', 'error'); return; }
                        if (applyNumbers.length === 0) { UI.Toast.show('請輸入要保書號碼', 'error'); return; }
                        resolve({ action: '_start_batch_', applyNumbers, auditor, isDryRun });
                        UI.Modal.close();
                    });
                    setTimeout(() => numbersInput.focus(), 200);
                }, Config.MODAL_SIZES.BATCH_SETUP);
            });
        }

        return { 
            showTokenDialog, 
            showModeSelectDialog, 
            showPersonalCasesDialog,
            showPersonnelSelectDialog,
            showBatchSetupDialog 
        };
    })();

    // =========================================================================
    // SECTION: 7. Main (主流程控制模組) - 整合兩種模式
    // =========================================================================
    const Main = (() => {
        async function initialize() {
            UI.injectStyle();
            await autoCheckToken();
        }

        async function autoCheckToken() {
            const storedToken = Utils.findStoredToken();
            if (storedToken) {
                GlobalState.set({ token: storedToken });
                setTimeout(showModeSelectFlow, 500);
            } else {
                UI.Toast.show('未找到 Token，請手動輸入', 'warning', 1500);
                setTimeout(() => showTokenDialogFlow(true), 500);
            }
        }

        async function showTokenDialogFlow(showRetryBtn) {
            const tokenRes = await UIComponents.showTokenDialog(showRetryBtn);
            if (tokenRes === '_retry_autocheck_') return autoCheckToken();
            if (tokenRes === '_close_tool_') { UI.Toast.show('工具已關閉', 'info'); return; }
            
            if(tokenRes === '_token_skip_'){
                GlobalState.set({token: null});
                UI.Toast.show('已略過Token設定','warning',4000);
            } else {
                GlobalState.set({ token: tokenRes });
                localStorage.setItem(Config.TOKEN_STORAGE_KEY, tokenRes);
                UI.Toast.show('Token 已儲存', 'success');
            }
            await showModeSelectFlow();
        }

        async function showModeSelectFlow() {
            const modeRes = await UIComponents.showModeSelectDialog();
            if (modeRes === '_change_token_') {
                return showTokenDialogFlow(false);
            } else if (modeRes === 'personal') {
                GlobalState.set({ currentMode: 'personal' });
                return showPersonalCaseFlow();
            } else if (modeRes === 'batch') {
                GlobalState.set({ currentMode: 'batch' });
                return showBatchDispatchFlow();
            }
        }

        // 個人案件流程
        async function showPersonalCaseFlow() {
            try {
                UI.Progress.show('載入個人案件中...');
                const controller = new AbortController();
                GlobalState.set({ currentQueryController: controller });

                const casesResult = await DataService.fetchAllPersonalCases(controller.signal);
                UI.Progress.hide();

                if (!casesResult.success) {
                    UI.Toast.show('載入個人案件失敗: ' + casesResult.error, 'error');
                    return showModeSelectFlow();
                }

                GlobalState.set({ personalCases: casesResult.data, selectedCases: [] });
                
                while (true) {
                    const casesRes = await UIComponents.showPersonalCasesDialog(casesResult.data);
                    
                    if (casesRes === '_back_to_mode_') {
                        return showModeSelectFlow();
                    } else if (casesRes === '_next_to_personnel_') {
                        const selectedCases = GlobalState.get('selectedCases');
                        if (selectedCases.length === 0) {
                            UI.Toast.show('請先選擇案件', 'warning');
                            continue;
                        }
                        
                        UI.Progress.show('載入人員清單中...');
                        const personnelResult = await DataService.fetchPersonnel(controller.signal);
                        UI.Progress.hide();
                        
                        let personnel = [];
                        if (personnelResult.success && personnelResult.data) {
                            // 處理不同的回應格式
                            if (Array.isArray(personnelResult.data)) {
                                personnel = personnelResult.data;
                            } else if (personnelResult.data.records) {
                                personnel = personnelResult.data.records;
                            } else if (personnelResult.data.data) {
                                personnel = personnelResult.data.data;
                            }
                        }
                        
                        const personnelRes = await UIComponents.showPersonnelSelectDialog(personnel);
                        
                        if (personnelRes === '_back_to_cases_') {
                            continue;
                        } else if (personnelRes.action === '_confirm_assign_') {
                            UI.Progress.show('執行派件中...');
                            const assignResult = await DataService.assignManually(
                                selectedCases, 
                                personnelRes.assigneeId, 
                                Config.BATCH_CONFIG.defaultDispatchOrg,
                                controller.signal
                            );
                            UI.Progress.hide();
                            
                            if (assignResult.success) {
                                UI.Toast.show(`成功派件 ${selectedCases.length} 筆案件！`, 'success', 5000);
                                return showModeSelectFlow();
                            } else {
                                UI.Toast.show('派件失敗: ' + assignResult.error, 'error', 5000);
                                continue;
                            }
                        }
                    }
                }
            } catch (error) {
                UI.Progress.hide();
                if (error.message === 'TOKEN_INVALID') {
                    UI.Toast.show('Token無效或已過期，請重新設定', 'error', 5000);
                    return showTokenDialogFlow(false);
                }
                UI.Toast.show(`發生錯誤: ${error.message}`, 'error');
                return showModeSelectFlow();
            } finally {
                GlobalState.set({ currentQueryController: null });
            }
        }

        // 批次派工流程（原有功能保留）
        async function showBatchDispatchFlow() {
            try {
                while (true) {
                    const setupRes = await UIComponents.showBatchSetupDialog();
                    
                    if (setupRes === '_back_to_mode_') {
                        return showModeSelectFlow();
                    } else if (setupRes.action === '_start_batch_') {
                        const { applyNumbers, auditor, isDryRun } = setupRes;
                        
                        UI.Progress.show(`查詢中 (0/${applyNumbers.length})...`);
                        const controller = new AbortController();
                        GlobalState.set({ currentQueryController: controller });

                        const successfulQueries = [];
                        const failedQueries = [];

                        for (let i = 0; i < applyNumbers.length; i++) {
                            const number = applyNumbers[i];
                            UI.Progress.update(Math.round(((i + 1) / applyNumbers.length) * 100), 
                                `查詢中 (${i + 1}/${applyNumbers.length}): ${number}`);
                            const apiRet = await DataService.query(number, 'applyNumber', controller.signal);

                            if (apiRet.success && apiRet.data.content && apiRet.data.content.length > 0) {
                                successfulQueries.push({ number: number, data: apiRet.data.content[0] });
                            } else {
                                failedQueries.push({ number: number, reason: apiRet.error || '查無資料' });
                            }
                        }

                        console.log(`%c====== 批次查詢結果報告 ======`, 'color: blue; font-weight: bold;');
                        if(successfulQueries.length > 0) console.log(`✅ 成功查詢 ${successfulQueries.length} 筆可派工案件:`, successfulQueries.map(i => i.number));
                        if(failedQueries.length > 0) console.log(`❌ ${failedQueries.length} 筆案件查詢失敗:`, failedQueries);

                        UI.Progress.hide();

                        if (isDryRun || successfulQueries.length === 0) {
                            const msg = isDryRun ? `演練完成，${successfulQueries.length} 筆可派工` : '無任何案件可派工';
                            UI.Toast.show(msg, 'info');
                            continue;
                        }

                        if (confirm(`查詢完成！\n\n準備將 ${successfulQueries.length} 筆案件指派給【${auditor}】。\n\n您確定要繼續嗎？`)) {
                            const numbersToAssign = successfulQueries.map(item => item.number);
                            UI.Progress.show('執行派件中...');
                            const assignResult = await DataService.assignManually(
                                numbersToAssign, 
                                auditor, 
                                Config.BATCH_CONFIG.defaultDispatchOrg, 
                                controller.signal
                            );
                            UI.Progress.hide();
                            
                            if (assignResult.success) {
                                UI.Toast.show(`成功派工 ${numbersToAssign.length} 筆案件！`, 'success', 5000);
                                return showModeSelectFlow();
                            } else {
                                UI.Toast.show('派工失敗，請檢查Console。', 'error', 5000);
                            }
                        } else {
                            UI.Toast.show('操作已取消', 'info');
                        }
                        continue;
                    }
                }
            } catch (error) {
                UI.Progress.hide();
                if (error.message === 'TOKEN_INVALID') {
                    UI.Toast.show('Token無效或已過期，請重新設定', 'error', 5000);
                    return showTokenDialogFlow(false);
                }
                UI.Toast.show(`發生錯誤: ${error.message}`, 'error');
                return showModeSelectFlow();
            } finally {
                GlobalState.set({ currentQueryController: null });
            }
        }
        
        return { initialize };
    })();

    // =========================================================================
    // SECTION: 8. Initializer (工具啟動器)
    // =========================================================================
    (function initializeAppAndRun() {
        // 清理舊的UI元素
        document.querySelectorAll(`#${Config.TOOL_ID}, #${Config.STYLE_ID}, .pct-toast, #pctModalMask`).forEach(el => el.remove());
        Main.initialize();
    })();

})();
