javascript:(function() {
    'use strict';

    // =========================================================================
    // SECTION: 1. Config (組態設定模組)
    // =========================================================================
    const Config = {
        VERSION: '4.4.0-manual-auditor',
        TOOL_ID: 'pct-main-container',
        STYLE_ID: 'pct-custom-styles',
        TOKEN_STORAGE_KEY: 'euisToken',
        API_ENDPOINTS: {
            // findOrgEmp 已不再使用，但暫時保留路徑以備不時之需
            findOrgEmp: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api/org/findOrgEmp',
            findProposal: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        },
        BATCH_CONFIG: {
            defaultDispatchOrg: 'H'
        }
    };

    // =========================================================================
    // SECTION: 2. GlobalState (全域狀態管理模組)
    // =========================================================================
    const GlobalState = (() => {
        let state = {
            token: null,
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
    };

    // =========================================================================
    // SECTION: 4. UI (極簡UI管理模組)
    // =========================================================================
    const UI = {
        injectStyle: () => {
            const css = `
              .pct-modal-mask { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); z-index: 9998; display: flex; align-items: center; justify-content: center; }
              .pct-modal-dialog { background-color: #fff; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); padding: 20px; width: 500px; }
              .pct-modal-header { font-size: 1.25rem; font-weight: bold; margin-bottom: 15px; }
              .pct-modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
              .pct-form-group { margin-bottom: 15px; }
              .pct-form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
              .pct-form-group input[type="text"], .pct-form-group textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
              .pct-btn { padding: 8px 16px; border: 1px solid #007bff; background-color: #007bff; color: white; border-radius: 4px; cursor: pointer; }
              .pct-btn-outline { background-color: transparent; color: #6c757d; border: 1px solid #6c757d; }
              .pct-btn:disabled { background-color: #a0cffa; border-color: #a0cffa; cursor: not-allowed; }
            `;
            if (document.getElementById(Config.STYLE_ID)) return;
            const style = document.createElement('style');
            style.id = Config.STYLE_ID;
            style.textContent = css;
            document.head.appendChild(style);
        },
        showModal: (html, onOpen) => {
            let mask = document.createElement('div');
            mask.id = 'pct-modal-mask';
            mask.className = 'pct-modal-mask';
            mask.innerHTML = `<div class="pct-modal-dialog">${html}</div>`;
            document.body.appendChild(mask);
            if (typeof onOpen === 'function') {
                onOpen(mask.querySelector('.pct-modal-dialog'));
            }
        },
        closeModal: () => {
            document.querySelector('#pct-modal-mask')?.remove();
        }
    };

    // =========================================================================
    // SECTION: 5. DataService (API 與資料服務模組)
    // =========================================================================
    const DataService = (() => {
        async function baseFetch(url, options) {
            const token = GlobalState.get('token');
            if (!token) {
                throw new Error('TOKEN_MISSING');
            }
            options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' };
            const response = await fetch(url, options);
            if (response.status === 401 || response.status === 403) {
                throw new Error('TOKEN_INVALID');
            }
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
            }
            return response.json();
        }

        async function queryProposal(applyNumber) {
            const payload = { "applyNumber": applyNumber, pageIndex: 1, size: 50 };
            const options = { method: 'POST', body: JSON.stringify(payload) };
            return await baseFetch(Config.API_ENDPOINTS.findProposal, options);
        }

        async function assignManually(applyNumberList, auditor) {
            const payload = {
                "dispatchOrgAf": Config.BATCH_CONFIG.defaultDispatchOrg, "auditorAf": auditor,
                "dispatchOrgBf": "", "applyNumbers": applyNumberList
            };
            const options = { method: 'POST', body: JSON.stringify(payload) };
            return await baseFetch(Config.API_ENDPOINTS.assignManually, options);
        }

        return { queryProposal, assignManually };
    })();
    
    // =========================================================================
    // SECTION: 6. UIComponents (業務特定UI元件模組)
    // =========================================================================
    const UIComponents = (() => {
        function showTokenDialog() {
            const htmlContent = `
                <div class="pct-modal-header">請提供 SSO-TOKEN</div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="pct-token-input">未自動偵測到 Token，請手動貼上：</label>
                        <textarea id="pct-token-input" rows="5" placeholder="從 F12 開發者工具的網路(Network)請求中複製 SSO-TOKEN 的值..."></textarea>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-cancel-token" class="pct-btn-outline">取消</button>
                    <button id="pct-skip-token" class="pct-btn-outline">略過</button>
                    <button id="pct-confirm-token" class="pct-btn">儲存並繼續</button>
                </div>
            `;
            return new Promise(resolve => {
                UI.showModal(htmlContent, modal => {
                    const tokenInput = modal.querySelector('#pct-token-input');
                    const confirmBtn = modal.querySelector('#pct-confirm-token');
                    const skipBtn = modal.querySelector('#pct-skip-token');
                    const cancelBtn = modal.querySelector('#pct-cancel-token');
                    
                    confirmBtn.addEventListener('click', () => {
                        const token = tokenInput.value.trim();
                        if (!token) { alert('請輸入 TOKEN'); return; }
                        resolve(token);
                    });
                    
                    skipBtn.addEventListener('click', () => resolve('_skip_'));
                    cancelBtn.addEventListener('click', () => resolve(null));
                    setTimeout(() => tokenInput.focus(), 50);
                });
            });
        }
        
        function showBatchSetupDialog() {
             // [修改] 將 select 下拉選單改為 input 輸入框
             const htmlContent = `
                <div class="pct-modal-header">批次派工作業</div>
                <div class="pct-modal-body">
                    <div class="pct-form-group">
                        <label for="pct-batch-auditor">指派對象 (AD 帳號)</label>
                        <input type="text" id="pct-batch-auditor" placeholder="請手動輸入指派對象的 AD 帳號">
                    </div>
                    <div class="pct-form-group">
                        <label for="pct-batch-numbers">要保書號碼 (多筆請換行)</label>
                        <textarea id="pct-batch-numbers" rows="10" placeholder="請在此貼上多筆要保書號碼..."></textarea>
                    </div>
                </div>
                <div class="pct-modal-footer">
                    <button id="pct-cancel-batch" class="pct-btn-outline">取消</button>
                    <button id="pct-start-batch" class="pct-btn">開始執行</button>
                </div>
            `;
            return new Promise(resolve => {
                // [修改] 移除 async，因為不再需要 await API
                UI.showModal(htmlContent, (modal) => {
                    const auditorInput = modal.querySelector('#pct-batch-auditor');
                    const numbersInput = modal.querySelector('#pct-batch-numbers');
                    const startBtn = modal.querySelector('#pct-start-batch');
                    const cancelBtn = modal.querySelector('#pct-cancel-batch');

                    // [修改] 移除所有載入人員清單的 try-catch 邏輯
                    setTimeout(() => auditorInput.focus(), 50);

                    cancelBtn.addEventListener('click', () => { UI.closeModal(); resolve(null); });
                    
                    startBtn.addEventListener('click', () => {
                        if (!GlobalState.get('token')) {
                            alert('無法執行操作，因為您未提供有效的 Token。\n請重新執行工具並輸入 Token。');
                            return;
                        }

                        const auditor = auditorInput.value.trim(); // 從 input 讀取值
                        const applyNumbers = Utils.splitInput(numbersInput.value);
                        
                        if (!auditor) { // 檢查是否有輸入
                            alert('請輸入指派對象');
                            return;
                        }
                        if (applyNumbers.length === 0) {
                            alert('請輸入要保書號碼');
                            return;
                        }
                        
                        UI.closeModal();
                        resolve({ auditor, applyNumbers });
                    });
                });
            });
        }
        
        return { showTokenDialog, showBatchSetupDialog };
    })();

    // =========================================================================
    // SECTION: 7. Main (主流程控制模組)
    // =========================================================================
    const Main = (() => {
        async function handleTokenFlow() {
            let token = Utils.findStoredToken();
            if (token) {
                GlobalState.set({ token: token });
                return true;
            }

            const userResponse = await UIComponents.showTokenDialog();
            UI.closeModal();

            if (typeof userResponse === 'string' && userResponse !== '_skip_') {
                GlobalState.set({ token: userResponse });
                localStorage.setItem(Config.TOKEN_STORAGE_KEY, userResponse);
                return true;
            } else if (userResponse === '_skip_') {
                GlobalState.set({ token: null });
                return true;
            } else {
                alert('操作已取消。');
                return false;
            }
        }
        
        async function executeBatchFlow() {
            try {
                const setup = await UIComponents.showBatchSetupDialog();
                if (!setup) { console.log('使用者取消操作。'); return; }

                const { auditor, applyNumbers } = setup;
                console.log(`準備處理 ${applyNumbers.length} 筆案件，指派給 ${auditor}`);

                const successfulQueries = [];
                const failedQueries = [];
                
                console.log('--- 開始批次查詢 ---');
                for (const number of applyNumbers) {
                    try {
                        const result = await DataService.queryProposal(number);
                        if (result && result.records && result.records.length > 0) {
                            successfulQueries.push({ number: number, data: result.records[0] });
                            console.log(`✅ 查詢成功: ${number}`);
                        } else {
                            failedQueries.push({ number: number, reason: '查無資料' });
                            console.warn(`⚠️ 查詢無資料: ${number}`);
                        }
                    } catch (error) {
                        failedQueries.push({ number: number, reason: error.message });
                        console.error(`❌ 查詢失敗: ${number}`, error);
                        // 如果是因為 Token 問題導致第一次查詢就失敗，可以提早中止
                        if (error.message === 'TOKEN_MISSING' || error.message === 'TOKEN_INVALID') {
                            alert(`查詢失敗：${error.message}。請重新執行工具並提供有效 Token。`);
                            return; 
                        }
                    }
                }
                console.log('--- 批次查詢結束 ---');
                console.log(`查詢報告：${successfulQueries.length} 筆成功，${failedQueries.length} 筆失敗。`);

                if (successfulQueries.length === 0) {
                    alert('查詢完成，沒有任何可供派工的案件。詳情請見 Console。');
                    return;
                }

                const numbersToAssign = successfulQueries.map(item => item.number);
                if (confirm(`查詢完成！\n\n共 ${successfulQueries.length} 筆案件可派工。\n準備指派給【${auditor}】。\n\n您確定要繼續嗎？`)) {
                    console.log('使用者確認，開始執行派工...');
                    const assignResult = await DataService.assignManually(numbersToAssign, auditor);
                    alert(`成功派工 ${numbersToAssign.length} 筆案件！`);
                    console.log('✅ 批次派工成功！伺服器回應:', assignResult);
                } else {
                    alert('操作已取消。');
                    console.log('使用者取消了派工操作。');
                }

            } catch (error) {
                if (error.message === 'TOKEN_INVALID') {
                    alert('Token 無效或已過期，請重新整理頁面並執行工具，以輸入新的 Token。');
                    localStorage.removeItem(Config.TOKEN_STORAGE_KEY);
                } else {
                    alert(`發生未預期的錯誤: ${error.message}，詳情請查看 Console。`);
                }
                console.error('批次處理流程發生錯誤:', error);
            } finally {
                UI.closeModal();
            }
        }

        async function initialize() {
            UI.injectStyle();
            const shouldContinue = await handleTokenFlow();
            if (shouldContinue) {
                await executeBatchFlow();
            }
        }

        return { initialize };
    })();

    // =========================================================================
    // SECTION: 8. Initializer (工具啟動器)
    // =========================================================================
    (function initializeAppAndRun() {
        document.querySelector(`#${Config.TOOL_ID}`)?.remove();
        document.querySelector('#pct-modal-mask')?.remove();
        document.getElementById(Config.STYLE_ID)?.remove();
        Main.initialize();
    })();

})();
