javascript:(function() {
    'use strict';

    // =========================================================================
    // SECTION: 1. Config (組態設定模組)
    // =========================================================================
    const Config = {
        VERSION: '4.4.2-final-debug',
        TOOL_ID: 'pct-main-container',
        STYLE_ID: 'pct-custom-styles',
        TOKEN_STORAGE_KEY: 'euisToken',
        API_ENDPOINTS: {
            findProposal: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            assignManually: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        },
        BATCH_CONFIG: {
            defaultDispatchOrg: 'H'
        }
    };

    // =========================================================================
    // SECTION: 2. GlobalState & Utils
    // =========================================================================
    const GlobalState = (() => { let s = { token: null }; return { get: k => s[k], set: n => { s = { ...s, ...n }; } }; })();
    const Utils = {
        findStoredToken: () => localStorage.getItem(Config.TOKEN_STORAGE_KEY) || sessionStorage.getItem('SSO-TOKEN') || null,
        splitInput: (text) => text.split(/[\s,，\n]+/).filter(Boolean),
    };

    // =========================================================================
    // SECTION: 3. UI
    // =========================================================================
    const UI = (() => {
        const css = `.pct-modal-mask{position:fixed;inset:0;background-color:rgba(0,0,0,.5);z-index:9998;display:flex;align-items:center;justify-content:center}.pct-modal-dialog{background-color:#fff;border-radius:8px;box-shadow:0 5px 15px rgba(0,0,0,.3);padding:20px;width:500px}.pct-modal-header{font-size:1.25rem;font-weight:700;margin-bottom:15px}.pct-modal-footer{margin-top:20px;display:flex;justify-content:flex-end;gap:10px}.pct-form-group{margin-bottom:15px}.pct-form-group label{display:block;margin-bottom:5px;font-weight:500}.pct-form-group input[type=text],.pct-form-group textarea{width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box}.pct-btn{padding:8px 16px;border:1px solid #007bff;background-color:#007bff;color:#fff;border-radius:4px;cursor:pointer}.pct-btn-outline{background-color:transparent;color:#6c757d;border:1px solid #6c757d}`;
        return {
            injectStyle: () => { if (document.getElementById(Config.STYLE_ID)) return; const style = document.createElement('style'); style.id = Config.STYLE_ID; style.textContent = css; document.head.appendChild(style); },
            showModal: (html, onOpen) => { let mask = document.createElement('div'); mask.id = 'pct-modal-mask'; mask.className = 'pct-modal-mask'; mask.innerHTML = `<div class="pct-modal-dialog">${html}</div>`; document.body.appendChild(mask); if (typeof onOpen === 'function') onOpen(mask.querySelector('.pct-modal-dialog')); },
            closeModal: () => document.querySelector('#pct-modal-mask')?.remove()
        };
    })();

    // =========================================================================
    // SECTION: 4. DataService
    // =========================================================================
    const DataService = (() => {
        async function baseFetch(url, options) {
            const token = GlobalState.get('token');
            if (!token) throw new Error('TOKEN_MISSING');
            options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' };
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.text();
                const err = new Error(`HTTP ${response.status}`);
                try { err.data = JSON.parse(errorBody); } catch (e) { err.data = errorBody; }
                throw err;
            }
            return response.json();
        }
        return {
            queryProposal: (applyNumber) => baseFetch(Config.API_ENDPOINTS.findProposal, { method: 'POST', body: JSON.stringify({ applyNumber, pageIndex: 1, size: 50 }) }),
            assignManually: (applyNumberList, auditor) => baseFetch(Config.API_ENDPOINTS.assignManually, { method: 'POST', body: JSON.stringify({ dispatchOrgAf: Config.BATCH_CONFIG.defaultDispatchOrg, auditorAf: auditor, dispatchOrgBf: "", applyNumbers: applyNumberList }) })
        };
    })();
    
    // =========================================================================
    // SECTION: 5. UIComponents
    // =========================================================================
    const UIComponents = (() => {
        const tokenDialogHtml = `<div class="pct-modal-header">請提供 SSO-TOKEN</div><div class="pct-modal-body"><div class="pct-form-group"><label for="pct-token-input">未自動偵測到 Token，請手動貼上：</label><textarea id="pct-token-input" rows="5" placeholder="從 F12 開發者工具的網路(Network)請求中複製 SSO-TOKEN 的值..."></textarea></div></div><div class="pct-modal-footer"><button id="pct-cancel-token" class="pct-btn-outline">取消</button><button id="pct-skip-token" class="pct-btn-outline">略過</button><button id="pct-confirm-token" class="pct-btn">儲存並繼續</button></div>`;
        const batchDialogHtml = `<div class="pct-modal-header">批次派工作業</div><div class="pct-modal-body"><div class="pct-form-group"><label for="pct-batch-auditor">指派對象 (AD 帳號)</label><input type="text" id="pct-batch-auditor" placeholder="請手動輸入指派對象的 AD 帳號"></div><div class="pct-form-group"><label for="pct-batch-numbers">要保書號碼 (多筆請換行)</label><textarea id="pct-batch-numbers" rows="10" placeholder="請在此貼上多筆要保書號碼..."></textarea></div></div><div class="pct-modal-footer"><button id="pct-cancel-batch" class="pct-btn-outline">取消</button><button id="pct-start-batch" class="pct-btn">開始執行</button></div>`;
        return {
            showTokenDialog: () => new Promise(resolve => {
                UI.showModal(tokenDialogHtml, modal => {
                    const i = modal.querySelector('#pct-token-input'), c = modal.querySelector('#pct-confirm-token'), s = modal.querySelector('#pct-skip-token'), n = modal.querySelector('#pct-cancel-token');
                    c.addEventListener('click', () => { const t = i.value.trim(); t ? resolve(t) : alert('請輸入 TOKEN'); });
                    s.addEventListener('click', () => resolve('_skip_'));
                    n.addEventListener('click', () => resolve(null));
                    setTimeout(() => i.focus(), 50);
                });
            }),
            showBatchSetupDialog: () => new Promise(resolve => {
                UI.showModal(batchDialogHtml, modal => {
                    const a = modal.querySelector('#pct-batch-auditor'), n = modal.querySelector('#pct-batch-numbers'), s = modal.querySelector('#pct-start-batch'), c = modal.querySelector('#pct-cancel-batch');
                    setTimeout(() => a.focus(), 50);
                    c.addEventListener('click', () => { UI.closeModal(); resolve(null); });
                    s.addEventListener('click', () => {
                        if (!GlobalState.get('token')) return alert('無法執行操作，因為您未提供有效的 Token。');
                        const auditor = a.value.trim(), applyNumbers = Utils.splitInput(n.value);
                        if (!auditor) return alert('請輸入指派對象');
                        if (applyNumbers.length === 0) return alert('請輸入要保書號碼');
                        UI.closeModal(); resolve({ auditor, applyNumbers });
                    });
                });
            })
        };
    })();

    // =========================================================================
    // SECTION: 6. Main
    // =========================================================================
    const Main = (() => {
        async function handleTokenFlow() {
            let token = Utils.findStoredToken();
            if (token) { GlobalState.set({ token }); return true; }
            const userResponse = await UIComponents.showTokenDialog();
            UI.closeModal();
            if (typeof userResponse === 'string' && userResponse !== '_skip_') {
                GlobalState.set({ token: userResponse }); localStorage.setItem(Config.TOKEN_STORAGE_KEY, userResponse); return true;
            }
            if (userResponse === '_skip_') { GlobalState.set({ token: null }); return true; }
            alert('操作已取消。'); return false;
        }
        async function executeBatchFlow() {
            try {
                const setup = await UIComponents.showBatchSetupDialog();
                if (!setup) return console.log('使用者取消操作。');
                const { auditor, applyNumbers } = setup;
                const successfulQueries = [];
                for (const number of applyNumbers) {
                    try {
                        const result = await DataService.queryProposal(number);
                        if (result && result.records && result.records.length > 0) successfulQueries.push({ number });
                    } catch (e) {
                        alert(`查詢案件 ${number} 失敗，可能是 Token 無效或權限不足。請重新執行工具。`); return;
                    }
                }
                if (successfulQueries.length === 0) return alert('查詢完成，但無任何可派工的案件。');
                const numbersToAssign = successfulQueries.map(i => i.number);
                if (confirm(`查詢完成！\n\n共 ${successfulQueries.length} 筆案件可派工。\n準備指派給【${auditor}】。\n\n您確定要繼續嗎？`)) {
                    await DataService.assignManually(numbersToAssign, auditor);
                    alert(`成功派工 ${numbersToAssign.length} 筆案件！`);
                } else {
                    alert('操作已取消。');
                }
            } catch (error) {
                // [最終偵錯] 提供更明確的錯誤訊息和建議
                let errorMsg = `指派失敗！伺服器回傳錯誤：${error.message}`;
                let errorCode = error.data?.code || (JSON.stringify(error.data).match(/\b\d{3,}\b/) ? JSON.stringify(error.data).match(/\b\d{3,}\b/)[0] : '未知');
                if (errorCode === '900') {
                    errorMsg = `指派失敗 (錯誤代碼: 900)。\n\n這通常表示資料有問題，請嘗試一次只指派一筆案件來找出問題件，或確認指派對象是否正確。`;
                } else {
                    errorMsg += ` (代碼: ${errorCode})\n\n請檢查 F12 Console 的詳細錯誤。`;
                }
                alert(errorMsg);
                console.error("指派操作捕獲到嚴重錯誤:", error.data || error);
            } finally {
                UI.closeModal();
            }
        }
        async function initialize() {
            UI.injectStyle();
            if (await handleTokenFlow()) await executeBatchFlow();
        }
        return { initialize };
    })();

    // =========================================================================
    // SECTION: 7. Initializer
    // =========================================================================
    (function() {
        document.querySelector(`#${Config.TOOL_ID}`)?.remove();
        document.querySelector('#pct-modal-mask')?.remove();
        document.getElementById(Config.STYLE_ID)?.remove();
        Main.initialize();
    })();
})();
