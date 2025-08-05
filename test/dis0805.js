javascript: (function() {
    'use strict';

    // =================================================================================
    // 多功能派件整合 - 全 ES6+ 語意命名現代模組版
    // 版本: 9.6.0-modern
    // =================================================================================

    // === 1. 設定模組（AppConfig） ===
    const AppConfig = Object.freeze({
        VERSION: '9.6.0-modern',
        TOOL_CONTAINER_ID: 'dispatch-tool-container-v96',
        STYLE_ELEMENT_ID: 'dispatch-tool-style-v96',
        TOKEN_KEY: 'euisToken',
        PRESETS_KEY: 'dispatchPresets_v3',
        API: {
            QUERY_PERSONAL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
            QUERY_BATCH: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
            MANUAL_ASSIGN: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        },
        DEFAULT_PERSONAL_USERS: [
            'chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu',
            'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu'
        ].sort(),
        DEFAULT_BATCH_USERS: [
            'chenjui.chang', 'carol.chan', 'pearl.ho', 'jessy.fu', 'alex.yc.liu',
            'cheryl0319.liu', 'lisa.wu', 'vita.wu', 'nancy.wu', 'peiyi.wu'
        ].sort(),
        SPECIAL_USERS: ['chenjui.chang', 'peiyi.wu'],
        DEFAULT_PERSONAL_FILTER: {
            applyNumber: '', policyNumber: '', mainStatus: '', subStatus: '', hint: '', ownerName: '',
            insuredName: '', firstBillingMethod: '', planCodeName: '', planCode: '', applyDateStart: '',
            applyDateEnd: '', agencyCodeName: '', replyEstimatedCompletionDateStart: '',
            replyEstimatedCompletionDateEnd: '', channel: '', caseLabelings: [], productLabelings: []
        },
        DEFAULT_BATCH_FILTER: {
            applyNumber: '', policyNumber: '', org: '', poolOrg: '', uwLevels: [], poolUwLevels: [],
            caseLabelings: [], productLabelings: [], polpln: '', mainStatus: '2', subStatus: '',
            channel: '', agencyCode: '', uwApprover: null, currentOwner: null, firstBillingMethod: '',
            hint: '', ownerTaxId: '', ownerName: '', insuredTaxId: '', insuredName: '', applyDateStart: '',
            applyDateEnd: '', confrmno: '', currency: '', firstPaymentPremiumFlag: ''
        },
        NON_EDITABLE_FIELDS: ['pageIndex', 'size', 'orderBys'],
        BATCH_PAGE_SIZE: 50,
        ZINDEX: {
            TOAST: 2147483647, MASK: 2147483640, MODAL: 2147483641
        }
    });

    // === 2. 全域狀態模組（AppState） ===
    const AppState = (() => {
        const state = {
            userToken: null,
            modalPosition: { top: null, left: null },
            personalCaseList: [],
            batchCaseList: [],
            abortController: null,
            prevViewState: {}
        };
        return {
            get: (key) => key ? state[key] : { ...state },
            set: (k, v) => {
                if (typeof k === 'object') Object.assign(state, k);
                else state[k] = v;
            },
            clearSession: () => {
                state.personalCaseList = [];
                state.batchCaseList = [];
                state.prevViewState = {};
            },
            createAbortSignal: () => {
                state.abortController = new AbortController();
                return state.abortController.signal;
            },
            abortRequest: () => {
                state.abortController?.abort();
                state.abortController = null;
            }
        };
    })();

    // === 3. 工具方法模組（Utils） ===
    const Utils = (() => ({
        escapeHtml: (str) => {
            if (str === null || str === undefined) return '';
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return String(str).replace(/[&<>"']/g, m => map[m]);
        },
        getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(AppConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
        splitTextInput: (text) => text.split(/[\s,，\n]+/).map(s => s.trim()).filter(Boolean),
        sleep: ms => new Promise(res => setTimeout(res, ms)),
        readTxt: () => new Promise((resolve, reject) => {
            const i = document.createElement('input');
            i.type = 'file'; i.accept = '.txt';
            i.onchange = e => {
                const f = e.target.files[0];
                if (f) {
                    const r = new FileReader();
                    r.onload = e => resolve(e.target.result);
                    r.onerror = () => reject(new Error('讀取檔案失敗'));
                    r.readAsText(f);
                } else reject(new Error('未選擇任何檔案'));
            };
            i.click();
        }),
        jsonToCsv: (items, headers) => {
            const keys = Object.keys(headers);
            const headerRow = Object.values(headers).map(h => JSON.stringify(h.label)).join(',');
            const rows = items.map(row => keys.map(key => JSON.stringify(row[key] ?? '')).join(','));
            return [headerRow, ...rows].join('\r\n');
        },
        downloadCsv: (csv, filename) => {
            const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        formatDisplayDate: (d) => (d && typeof d === 'string') ? d.split(' ')[0] : '',
        formatDateApi: (date) => {
            if (!date) return '';
            const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d} 00:00:00`;
        },
        today: () => new Date(),
        nDaysAgo: (date, n) => new Date(date.getTime() - n * 24 * 60 * 60 * 1000),
        debounce: (fn, delay) => {
            let t;
            return function(...args) {
                clearTimeout(t);
                t = setTimeout(() => fn.apply(this, args), delay);
            };
        }
    }))();

    // === 4. UI 管理模組（UIManager） ===
    const UIManager = (() => {
        function injectStyle() {
            if (document.getElementById(AppConfig.STYLE_ELEMENT_ID)) return;
            const style = document.createElement('style');
            style.id = AppConfig.STYLE_ELEMENT_ID;
            style.textContent = `
              :root { --primary-color: #007bff; --primary-dark: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
              .dispatch-mask { position: fixed; z-index: ${AppConfig.ZINDEX.MASK}; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; }
              .dispatch-mask.show { opacity: 1; }
              .dispatch-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.15); padding:0; position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: ${AppConfig.ZINDEX.MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity .18s; max-height: 90vh; max-width: 95vw; box-sizing: border-box;}
              .dispatch-modal.show { opacity: 1; }
              .dispatch-modal.dragging { transition: none !important; }
              .dispatch-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; text-align:center;}
              .dispatch-close { position: absolute;top:10px;right:10px;background:transparent;border:none;font-size:28px;font-weight:bold;color:var(--secondary-color);cursor:pointer;width:36px;height:36px;border-radius:50%;transition:.2s;display:flex;align-items:center;justify-content:center;}
              .dispatch-close:hover {background:#f0f0f0;color:#333;transform:rotate(90deg)scale(1.05);}
              .dispatch-body{padding:16px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
              .dispatch-footer{padding:12px 20px 16px 20px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center;}
              .dispatch-btn{display:inline-flex;align-items:center;justify-content:center;padding:8px 18px;font-size:15px;border-radius:6px;border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:.25s;font-weight:600;white-space:nowrap;}
              .dispatch-btn:not([disabled]):hover{background:var(--primary-dark);transform:translateY(-2px);}
              .dispatch-btn[disabled]{background:#d6d6d6;cursor:not-allowed;}
              .dispatch-btn.dispatch-outline{background:transparent;border-color:var(--secondary-color);color:var(--secondary-color);}
              .dispatch-btn.dispatch-outline:not([disabled]):hover{background-color:#f8f8f8;}
              .dispatch-btn.small{padding:4px 10px;font-size:13px;}
              .dispatch-input,textarea.dispatch-input,select.dispatch-input{width:100%;font-size:14px;padding:8px 12px;border-radius:5px;box-sizing:border-box;border:1px solid #e0e0e0;margin-top:5px;}
              .dispatch-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 3px rgba(0,123,255,.25);outline:none;}
              .dispatch-toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:6px;font-size:16px;z-index:${AppConfig.ZINDEX.TOAST};opacity:0;transition:.3s;}
              .dispatch-toast.show{opacity:1;}
              .dispatch-progress{position:fixed;inset:0;background:rgba(255,255,255,0.8);z-index:${AppConfig.ZINDEX.TOAST};display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:1.2rem;font-weight:bold;}
              .dispatch-progress button{margin-top:20px;}
              .dispatch-help{position:absolute;top:15px;left:15px;font-size:18px;width:30px;height:30px;padding:0;border-radius:50%;background:#f0f0f0;color:#555;border:1px solid #ccc;}
              .case-table-container{overflow:auto;max-height:calc(85vh - 250px);position:relative;}
              .case-table{width:100%;border-collapse:collapse;white-space:nowrap;font-size:14px;}
              .case-table th, .case-table td{border:1px solid #ddd;padding:8px 10px;text-align:left;}
              .case-table th{background-color:#f2f2f2;position:sticky;top:0;z-index:1;cursor:pointer;}
              .case-table th .sort-indicator{margin-left:5px;font-weight:normal;opacity:0.5;}
              .case-table tr:hover td{background-color:#f5f5f5;}
              .filter-controls{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #e0e0e0;}
            `;
            document.head.appendChild(style);
        }
        const Toast = {
            show: (msg, type = 'success', duration = 2100) => {
                document.querySelector('.dispatch-toast')?.remove();
                const t = document.createElement('div');
                t.className = `dispatch-toast ${type}`;
                t.textContent = msg;
                t.style.background = `var(--${type}-color, #555)`;
                document.body.appendChild(t);
                requestAnimationFrame(() => t.classList.add('show'));
                if (duration > 0)
                    setTimeout(() => {
                        t.classList.remove('show');
                        t.addEventListener('transitionend', () => t.remove(), { once: true });
                    }, duration);
            }
        };
        const Progress = {
            show(text) {
                this.hide();
                const p = document.createElement('div');
                p.className = 'dispatch-progress';
                p.id = 'dispatch-progress';
                p.innerHTML = `<div>${Utils.escapeHtml(text)}</div><button id="stop-query" class="dispatch-btn dispatch-outline">停止查詢</button>`;
                document.body.appendChild(p);
                document.getElementById('stop-query').onclick = () => {
                    AppState.abortRequest();
                    this.hide();
                    Toast.show('查詢已中斷', 'warning');
                };
            },
            update(percent, text) {
                const p = document.getElementById('dispatch-progress');
                if (p) {
                    const d = p.querySelector('div:first-child');
                    if (d) d.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
                }
            },
            hide() { document.getElementById('dispatch-progress')?.remove(); }
        };
        const Modal = {
            close() {
                const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
                if (m) AppState.set({ modalPosition: { top: m.style.top, left: m.style.left } });
                AppState.abortRequest();
                document.getElementById('dispatch-mask')?.remove();
                m?.remove();
                document.removeEventListener('keydown', EventHandlers.handleEsc);
                AppState.clearSession();
            },
            show(opts) {
                return new Promise(resolve => {
                    this.close();
                    const { top, left } = AppState.get('modalPosition');
                    const mask = document.createElement('div');
                    mask.id = 'dispatch-mask';
                    mask.className = 'dispatch-mask';
                    document.body.appendChild(mask);
                    requestAnimationFrame(() => mask.classList.add('show'));
                    const modal = document.createElement('div');
                    modal.id = AppConfig.TOOL_CONTAINER_ID;
                    modal.className = 'dispatch-modal';
                    modal.style.width = opts.width || 'auto';
                    modal.innerHTML = `<div class="dispatch-header">${opts.header}<button class="dispatch-close">&times;</button></div><div class="dispatch-body">${opts.body}</div><div class="dispatch-footer">${opts.footer}</div>`;
                    if (top && left) {
                        modal.style.top = top;
                        modal.style.left = left;
                        modal.style.transform = 'none';
                    }
                    document.body.appendChild(modal);
                    requestAnimationFrame(() => modal.classList.add('show'));
                    modal.querySelector('.dispatch-header').addEventListener('mousedown', EventHandlers.dragStart);
                    modal.querySelector('.dispatch-close').addEventListener('click', () => {
                        this.close();
                        resolve({ action: '_close_tool_' });
                    });
                    EventHandlers.setupKeyListener();
                    if (opts.onOpen) opts.onOpen(modal, resolve);
                });
            }
        };
        return { injectStyle, Toast, Progress, Modal };
    })();

    // === 5. 事件管理模組 (EventHandlers) ===
    const EventHandlers = (() => {
        const drag = { active: false, sX: 0, sY: 0, iL: 0, iT: 0 };
        function dragStart(e) {
            const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
            if (!m || e.target.closest('.dispatch-close')) return;
            e.preventDefault();
            drag.active = true;
            m.classList.add('dragging');
            const r = m.getBoundingClientRect();
            drag.sX = e.clientX;
            drag.sY = e.clientY;
            drag.iL = r.left;
            drag.iT = r.top;
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        }
        function doDrag(e) {
            if (!drag.active) return;
            e.preventDefault();
            const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
            if (!m) return;
            m.style.left = `${drag.iL + e.clientX - drag.sX}px`;
            m.style.top = `${drag.iT + e.clientY - drag.sY}px`;
            m.style.transform = 'none';
        }
        function stopDrag() {
            drag.active = false;
            document.getElementById(AppConfig.TOOL_CONTAINER_ID)?.classList.remove('dragging');
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        }
        function handleEsc(e) { if (e.key === 'Escape') UIManager.Modal.close(); }
        function setupKeyListener() {
            document.removeEventListener('keydown', handleEsc);
            document.addEventListener('keydown', handleEsc);
        }
        return { dragStart, handleEsc, setupKeyListener };
    })();

    // === 6. 資料服務模組 (ApiService) ===
    const ApiService = (() => {
        async function _fetch(url, options) {
            const token = AppState.get('userToken');
            if (!token) throw new Error('TOKEN不存在');
            options.headers = { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' };
            options.signal = AppState.get('abortController')?.signal;
            const resp = await fetch(url, options);
            if (resp.status === 401 || resp.status === 403) throw new Error('TOKEN無效或逾期');
            if (!resp.ok) {
                const err = new Error(`伺服器錯誤_${resp.status}`);
                try { err.data = await resp.json(); } catch { err.data = await resp.text(); }
                throw err;
            }
            return resp.json();
        }
        async function fetchAllPages(endpoint, payload, listName) {
            let list = [], page = 1, totalPages = 1;
            while (page <= totalPages) {
                const request = { ...payload, pageIndex: page, size: AppConfig.BATCH_PAGE_SIZE };
                UIManager.Progress.update(totalPages > 1 ? Math.round(100 * page / totalPages) : 50, `載入${listName} 第 ${page} / ${totalPages === 1 ? '?' : totalPages} 頁...`);
                const res = await _fetch(endpoint, { method: 'POST', body: JSON.stringify(request) });
                if (res?.records?.length > 0) {
                    list = list.concat(res.records);
                    if (page === 1 && res.total) totalPages = Math.ceil(res.total / AppConfig.BATCH_PAGE_SIZE);
                } else break;
                page++;
            }
            return list;
        }
        return {
            fetchPersonalCases: (filters) => fetchAllPages(AppConfig.API.QUERY_PERSONAL, filters, '個人案件'),
            fetchBatchCases: (filters) => fetchAllPages(AppConfig.API.QUERY_BATCH, filters, '批次案件'),
            manualAssign: (applyNumbers, assignee) => _fetch(AppConfig.API.MANUAL_ASSIGN, {
                method: 'POST',
                body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: assignee, dispatchOrgBf: '', applyNumbers })
            })
        };
    })();

    // === 7. UI 組件模組 (UIModules) ===
    const UIModules = (() => {
        /**
         * 顯示 Token 輸入對話框
         * @param {boolean} showAutoDetectFailed - 是否顯示自動檢測失敗的提示
         */
        const tokenDialog = (showAutoDetectFailed) => UIManager.Modal.show({
            header: '請輸入 SSO-TOKEN',
            width: '450px',
            body: `
                <p style="margin-top:0;">請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。</p>
                <textarea id="token-input" class="dispatch-input" rows="4" style="font-family:monospace;"></textarea>
                ${showAutoDetectFailed ? `<p style="color:var(--error-color);font-size:14px;margin-bottom:0;">自動偵測失敗，請手動輸入。</p>` : ''}
            `,
            footer: `
                ${showAutoDetectFailed ? '<button id="retry-autocheck-btn" class="dispatch-btn dispatch-outline">重試自動偵測</button>' : '<span></span>'}
                <button id="confirm-token-btn" class="dispatch-btn">確認</button>
            `,
            onOpen: (modal, resolve) => {
                const tokenInput = modal.querySelector('#token-input');
                modal.querySelector('#confirm-token-btn').onclick = () => {
                    const value = tokenInput.value.trim();
                    if (value) resolve({ action: '_confirm_', value });
                    else UIManager.Toast.show('Token 不可為空', 'error');
                };
                if (showAutoDetectFailed) {
                    modal.querySelector('#retry-autocheck-btn').onclick = () => resolve({ action: '_retry_autocheck_' });
                }
            }
        });

        /**
         * 顯示功能模式選擇對話框
         */
        const modeDialog = () => UIManager.Modal.show({
            header: `多功能派件整合 ${AppConfig.VERSION}`,
            width: '500px',
            body: `
                <div style="display:flex; justify-content:space-around; gap:15px; padding: 20px 0;">
                    <button id="personal-mode-btn" class="dispatch-btn" style="width:45%;padding:20px;">個人案件查詢</button>
                    <button id="batch-mode-btn" class="dispatch-btn" style="width:45%;padding:20px;">批次案件查詢</button>
                </div>
            `,
            footer: `
                <div>
                    <button id="change-token-btn" class="dispatch-btn dispatch-outline">變更 Token</button>
                    <button id="edit-presets-btn" class="dispatch-btn dispatch-outline">編輯預設條件</button>
                </div>
                <span></span>
            `,
            onOpen: (modal, resolve) => {
                modal.querySelector('#personal-mode-btn').onclick = () => resolve({ action: 'personal' });
                modal.querySelector('#batch-mode-btn').onclick = () => resolve({ action: 'batch' });
                modal.querySelector('#change-token-btn').onclick = () => resolve({ action: '_change_token_' });
                modal.querySelector('#edit-presets-btn').onclick = () => resolve({ action: '_edit_presets_' });
            }
        });

        /**
         * 顯示預設查詢條件編輯對話框
         */
        const presetDialog = () => {
            const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}');
            const personalPresets = { ...AppConfig.DEFAULT_PERSONAL_FILTER, ...(presets.personal || {}) };
            const batchPresets = { ...AppConfig.DEFAULT_BATCH_FILTER, ...(presets.batch || {}) };

            const createForm = (id, data) => Object.entries(data)
                .map(([key, value]) => `
                    <div style="margin-bottom: 8px;">
                        <label for="${id}-${key}" style="font-size:14px; display:block;">${key}:</label>
                        <textarea id="${id}-${key}" class="dispatch-input" rows="1" style="font-size:13px; padding: 5px 8px;">${Utils.escapeHtml(Array.isArray(value) ? value.join(',') : value)}</textarea>
                    </div>`).join('');

            return UIManager.Modal.show({
                header: '編輯預設查詢條件',
                width: '800px',
                body: `
                    <div style="display:flex; gap: 20px;">
                        <div style="flex:1;">
                            <h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">個人案件</h3>
                            <div style="max-height: 50vh; overflow-y:auto; padding-right:10px;">${createForm('personal', personalPresets)}</div>
                        </div>
                        <div style="flex:1;">
                            <h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">批次案件</h3>
                            <div style="max-height: 50vh; overflow-y:auto; padding-right:10px;">${createForm('batch', batchPresets)}</div>
                        </div>
                    </div>
                `,
                footer: `
                    <button id="reset-presets-btn" class="dispatch-btn dispatch-outline">恢復原廠設定</button>
                    <div>
                        <button id="back-btn" class="dispatch-btn dispatch-outline">返回</button>
                        <button id="save-presets-btn" class="dispatch-btn">儲存</button>
                    </div>
                `,
                onOpen: (modal, resolve) => {
                    modal.querySelector('#save-presets-btn').onclick = () => {
                        const newPresets = { personal: {}, batch: {} };
                        Object.keys(personalPresets).forEach(key => {
                            const val = modal.querySelector(`#personal-${key}`).value.trim();
                            newPresets.personal[key] = key.endsWith('s') ? Utils.splitTextInput(val) : val;
                        });
                        Object.keys(batchPresets).forEach(key => {
                            const val = modal.querySelector(`#batch-${key}`).value.trim();
                            newPresets.batch[key] = key.endsWith('s') ? Utils.splitTextInput(val) : val;
                        });
                        localStorage.setItem(AppConfig.PRESETS_KEY, JSON.stringify(newPresets));
                        UIManager.Toast.show('預設條件已儲存', 'success');
                        resolve({ action: '_saved_' });
                    };
                    modal.querySelector('#reset-presets-btn').onclick = () => {
                        if (confirm('確定要將所有條件恢復為原廠設定嗎？')) {
                            localStorage.removeItem(AppConfig.PRESETS_KEY);
                            UIManager.Toast.show('已恢復原廠設定', 'info');
                            resolve({ action: '_saved_' }); // Re-open main menu
                        }
                    };
                    modal.querySelector('#back-btn').onclick = () => resolve({ action: '_back_' });
                }
            });
        };

        /**
         * 顯示案件列表與篩選介面
         */
        const caseListView = async (opts) => {
            let { caseList, header, onBack, defaultFilterFn } = opts;
            const isPersonal = header.includes('個人');
            const TABLE_HEADERS = isPersonal ?
                { applyNumber: "要保號", policyNumber: "保單號", ownerName: "要保人", insuredName: "被保人", mainStatus: "主狀態", subStatus: "次狀態", currentOwner: "目前關卡人員", applyDate: "受理日" } :
                { applyNumber: "要保號", policyNumber: "保單號", ownerName: "要保人", insuredName: "被保人", mainStatus: "主狀態", subStatus: "次狀態", pool: "Pool", poolStatus: "Pool狀態", currentOwner: "目前關卡人員", applyDate: "受理日" };
            
            // 恢復上次檢視狀態
            let viewState = AppState.get('prevViewState') || {};
            let localFilters = viewState.filters || {};
            let sortState = viewState.sort || { key: 'applyNumber', order: 'asc' };
            let globalSearch = viewState.globalSearch || '';

            AppState.set({ [isPersonal ? 'personalCaseList' : 'batchCaseList']: caseList });

            const modalContent = `
                <div class="filter-controls">
                    <input type="text" id="global-search" class="dispatch-input" placeholder="全域快速搜尋..." value="${Utils.escapeHtml(globalSearch)}">
                    ${Object.entries(TABLE_HEADERS).map(([key, label]) => `
                        <input type="text" id="filter-${key}" class="dispatch-input" data-key="${key}" placeholder="篩選 ${label}..." value="${Utils.escapeHtml(localFilters[key] || '')}">
                    `).join('')}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <button id="select-all-btn" class="dispatch-btn small">全選</button>
                        <button id="deselect-all-btn" class="dispatch-btn small dispatch-outline">取消全選</button>
                        <button id="import-txt-btn" class="dispatch-btn small dispatch-outline">匯入TXT篩選</button>
                    </div>
                    <div id="case-count"></div>
                </div>
                <div id="case-table-container" class="case-table-container">
                    <table id="case-table" class="case-table"></table>
                </div>
            `;
            const modalFooter = `
                <div>
                    <button id="back-btn" class="dispatch-btn dispatch-outline">返回主選單</button>
                    <button id="manual-query-btn" class="dispatch-btn dispatch-outline">手動查詢</button>
                </div>
                <div>
                    <button id="export-csv-btn" class="dispatch-btn dispatch-outline">匯出CSV</button>
                    <button id="next-step-btn" class="dispatch-btn" disabled>派送選取項目 (0)</button>
                </div>
            `;

            const res = await UIManager.Modal.show({ header, width: '90vw', body: modalContent, footer: modalFooter, onOpen: (modal, resolve) => {
                const tableContainer = modal.querySelector('#case-table-container');
                const tableElem = modal.querySelector('#case-table');
                const caseCountElem = modal.querySelector('#case-count');
                const nextStepBtn = modal.querySelector('#next-step-btn');
                let displayedCases = [];

                function updateSelection() {
                    const selected = Array.from(modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value);
                    nextStepBtn.disabled = selected.length === 0;
                    nextStepBtn.textContent = `派送選取項目 (${selected.length})`;
                    return selected;
                }

                function renderTable() {
                    // 1. 全域搜尋
                    let filtered = globalSearch ? caseList.filter(item => 
                        Object.values(item).some(val => String(val ?? '').toLowerCase().includes(globalSearch.toLowerCase()))
                    ) : [...caseList];
                    
                    // 2. 預設篩選 (for batch)
                    if (defaultFilterFn) {
                         filtered = filtered.filter(defaultFilterFn);
                    }
                    
                    // 3. 欄位篩選
                    const activeFilters = Object.entries(localFilters).filter(([, value]) => value);
                    if (activeFilters.length > 0) {
                        filtered = filtered.filter(item => activeFilters.every(([key, value]) => String(item[key] ?? '').toLowerCase().includes(value.toLowerCase())));
                    }

                    // 4. 排序
                    if (sortState.key) {
                        filtered.sort((a, b) => {
                            const valA = a[sortState.key] ?? '';
                            const valB = b[sortState.key] ?? '';
                            if (valA < valB) return sortState.order === 'asc' ? -1 : 1;
                            if (valA > valB) return sortState.order === 'asc' ? 1 : -1;
                            return 0;
                        });
                    }
                    
                    displayedCases = filtered;

                    // 5. 渲染
                    const headerHtml = `<thead><tr><th><input type="checkbox" id="select-all-header"></th>${Object.entries(TABLE_HEADERS).map(([key, label]) =>
                        `<th data-key="${key}">${label} <span class="sort-indicator">${sortState.key === key ? (sortState.order === 'asc' ? '▲' : '▼') : ''}</span></th>`
                    ).join('')}</tr></thead>`;

                    const bodyHtml = `<tbody>${filtered.map(item => `<tr>
                        <td><input type="checkbox" class="case-checkbox" value="${item.applyNumber}"></td>
                        ${Object.keys(TABLE_HEADERS).map(key => `<td>${Utils.escapeHtml(key === 'applyDate' ? Utils.formatDisplayDate(item[key]) : item[key])}</td>`).join('')}
                    </tr>`).join('')}</tbody>`;

                    tableElem.innerHTML = headerHtml + bodyHtml;
                    caseCountElem.textContent = `共 ${filtered.length} / ${caseList.length} 筆`;

                    // 恢復捲動位置
                    if (viewState.scrollTop) tableContainer.scrollTop = viewState.scrollTop;
                    viewState = {}; // 用後即焚
                }
                
                // 儲存狀態
                function saveViewState() {
                    AppState.set('prevViewState', {
                        filters: localFilters,
                        sort: sortState,
                        globalSearch,
                        scrollTop: tableContainer.scrollTop,
                    });
                }

                modal.onclick = e => {
                    // 表頭排序
                    const th = e.target.closest('th[data-key]');
                    if (th) {
                        const key = th.dataset.key;
                        const newOrder = (sortState.key === key && sortState.order === 'asc') ? 'desc' : 'asc';
                        sortState = { key, order: newOrder };
                        renderTable();
                    }
                    // 全選 Checkbox
                    if (e.target.id === 'select-all-header') {
                        modal.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = e.target.checked);
                        updateSelection();
                    }
                    if (e.target.matches('.case-checkbox')) {
                        updateSelection();
                    }
                };

                // 綁定篩選輸入框事件
                modal.querySelectorAll('[id^="filter-"]').forEach(input => {
                    input.oninput = Utils.debounce(() => {
                        localFilters[input.dataset.key] = input.value.trim();
                        renderTable();
                    }, 300);
                });
                modal.querySelector('#global-search').oninput = Utils.debounce(e => {
                    globalSearch = e.target.value.trim();
                    renderTable();
                }, 300);

                // 按鈕事件
                modal.querySelector('#select-all-btn').onclick = () => {
                    displayedCases.forEach(item => {
                         const cb = modal.querySelector(`.case-checkbox[value="${item.applyNumber}"]`);
                         if (cb) cb.checked = true;
                    });
                    updateSelection();
                };
                modal.querySelector('#deselect-all-btn').onclick = () => {
                    modal.querySelectorAll('.case-checkbox:checked').forEach(cb => cb.checked = false);
                    updateSelection();
                };
                modal.querySelector('#import-txt-btn').onclick = async () => {
                    try {
                        const content = await Utils.readTxt();
                        const ids = Utils.splitTextInput(content);
                        if(ids.length === 0) return UIManager.Toast.show('檔案內容為空或格式錯誤', 'warning');
                        
                        const idSet = new Set(ids);
                        localFilters = { 'applyNumber': Array.from(idSet).join(' ') }; // 簡易實作：用空格分隔，觸發篩選
                        modal.querySelector('#filter-applyNumber').value = localFilters['applyNumber'];
                        renderTable();
                        UIManager.Toast.show(`已匯入 ${ids.length} 個要保號進行篩選`, 'success');
                    } catch (err) {
                        UIManager.Toast.show(`匯入失敗: ${err.message}`, 'error');
                    }
                };
                modal.querySelector('#export-csv-btn').onclick = () => {
                    const selectedCases = updateSelection();
                    const dataToExport = selectedCases.length > 0 ? caseList.filter(c => selectedCases.includes(c.applyNumber)) : displayedCases;
                    if(dataToExport.length === 0) return UIManager.Toast.show('沒有可匯出的資料', 'warning');
                    
                    const csv = Utils.jsonToCsv(dataToExport, TABLE_HEADERS);
                    Utils.downloadCsv(csv, `派件清單_${new Date().toISOString().slice(0,10)}.csv`);
                    UIManager.Toast.show(`已匯出 ${dataToExport.length} 筆資料`, 'success');
                };
                 modal.querySelector('#manual-query-btn').onclick = async () => {
                    saveViewState();
                    resolve({ action: '_manual_query_' }); // 通知 AppMain 重新查詢
                };

                // 流程控制按鈕
                modal.querySelector('#back-btn').onclick = () => {
                    saveViewState();
                    resolve({ action: '_back_to_mode_' });
                };
                nextStepBtn.onclick = () => {
                    const selectedCases = updateSelection();
                    if (selectedCases.length > 0) {
                        saveViewState();
                        resolve({ action: '_next_step_', selectedCases });
                    }
                };

                renderTable();
            }});
            
            // 如果是手動查詢，則回到主流程重新拉取資料
            if(res.action === '_manual_query_') {
                 // 重新呼叫外層的 flow function
                 if(isPersonal) {
                    await AppMain.publicMethods.personalFlow(false);
                 } else {
                    await AppMain.publicMethods.batchFlow(false);
                 }
                 // 返回一個不會繼續執行的結果
                 return { action: '_flow_restarted_' };
            }
            return res;
        };

        /**
         * 顯示人員指派對話框
         */
        const personnelSelectDialog = (opts) => {
            const { selectedCount, mode, onBack } = opts;
            const users = mode === 'personal' ? AppConfig.DEFAULT_PERSONAL_USERS : AppConfig.DEFAULT_BATCH_USERS;
            const userOptions = users.map(u => `<option value="${u}" ${AppConfig.SPECIAL_USERS.includes(u) ? 'style="font-weight:bold;color:var(--primary-dark);"' : ''}>${u}</option>`).join('');

            return UIManager.Modal.show({
                header: '選擇指派人員',
                width: '400px',
                body: `
                    <p style="margin-top:0;">已選取 <strong>${selectedCount}</strong> 筆案件，請選擇要指派的人員：</p>
                    <select id="assignee-select" class="dispatch-input">${userOptions}</select>
                `,
                footer: `
                    <button id="back-btn" class="dispatch-btn dispatch-outline">返回上一步</button>
                    <button id="confirm-assignment-btn" class="dispatch-btn">確認指派</button>
                `,
                onOpen: (modal, resolve) => {
                    modal.querySelector('#back-btn').onclick = onBack;
                    modal.querySelector('#confirm-assignment-btn').onclick = () => {
                        const assignee = modal.querySelector('#assignee-select').value;
                        resolve({ action: '_confirm_assignment_', assignee });
                    };
                }
            });
        };

        /**
         * 顯示成功派件訊息
         */
        const successDialog = (opts) => UIManager.Modal.show({
            header: '派件成功',
            width: '500px',
            body: `
                <p>已成功將 <strong>${opts.cases.length}</strong> 筆案件指派給 <strong>${opts.assignee}</strong></p>
                <p>要保號列表:</p>
                <textarea class="dispatch-input" rows="5" readonly>${opts.cases.join('\n')}</textarea>
            `,
            footer: '<button id="close-success-btn" class="dispatch-btn">關閉</button>',
            onOpen: (modal, resolve) => {
                modal.querySelector('#close-success-btn').onclick = () => resolve({ action: '_close_' });
            }
        });

        return { tokenDialog, modeDialog, presetDialog, caseListView, personnelSelectDialog, successDialog };
    })();

    // == 8. 主流程模組 (AppMain) ==
    const AppMain = (() => {
        const getPresets = () => JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}');
        
        async function personalFlow(keepState = false) {
            if (!keepState) AppState.set({ prevViewState: {} });
            UIManager.Progress.show('正在載入所有個人案件...');
            AppState.createAbortSignal();
            try {
                const presets = getPresets();
                const caseList = await ApiService.fetchPersonalCases(presets.personal || AppConfig.DEFAULT_PERSONAL_FILTER);
                UIManager.Progress.hide();
                
                const res = await UIModules.caseListView({
                    header: '個人案件查詢與派發',
                    caseList,
                    onBack: () => modeSelector()
                });

                if (res.action === '_next_step_') {
                    const res2 = await UIModules.personnelSelectDialog({
                        selectedCount: res.selectedCases.length,
                        mode: 'personal',
                        onBack: () => personalFlow(true)
                    });
                    if (res2.action === '_confirm_assignment_') {
                        UIManager.Progress.show('執行派件中…');
                        try {
                            await ApiService.manualAssign(res.selectedCases, res2.assignee);
                            UIManager.Progress.hide();
                            await UIModules.successDialog({ assignee: res2.assignee, cases: res.selectedCases });
                            modeSelector();
                        } catch (e) {
                            UIManager.Toast.show(`派件失敗: ${e.message}`, 'error', 5000);
                            UIManager.Progress.hide();
                        }
                    }
                } else if (res.action === '_back_to_mode_') {
                    modeSelector();
                }
            } catch (e) {
                if (e.name !== 'AbortError') UIManager.Toast.show(`載入案件錯誤: ${e.message}`, 'error', 5000);
                UIManager.Progress.hide();
            }
        }
        
        async function batchFlow(keepState = false) {
            if (!keepState) AppState.set({ prevViewState: {} });
            
            UIManager.Progress.show('正在載入批次案件...');
            AppState.createAbortSignal();
            let caseList = [];
            try {
                const presets = getPresets();
                const batchPayload = presets.batch || AppConfig.DEFAULT_BATCH_FILTER;
                const today = Utils.today(), past = Utils.nDaysAgo(today, 10);
                const dynamicFilter = {
                    applyDateStart: batchPayload.applyDateStart || Utils.formatDateApi(past),
                    applyDateEnd: batchPayload.applyDateEnd || Utils.formatDateApi(today)
                };
                caseList = await ApiService.fetchBatchCases({ ...batchPayload, ...dynamicFilter });
            } catch (e) {
                if (e.name !== 'AbortError') UIManager.Toast.show(`預設清單自動載入失敗: ${e.message}，請改用手動查詢。`, 'warning', 4000);
            }
            UIManager.Progress.hide();
            
            const res = await UIModules.caseListView({
                header: '批次查詢與派件',
                caseList,
                onBack: () => modeSelector()
            });

            if (res.action === '_next_step_') {
                const res2 = await UIModules.personnelSelectDialog({
                    selectedCount: res.selectedCases.length,
                    mode: 'batch',
                    onBack: () => batchFlow(true)
                });
                if (res2.action === '_confirm_assignment_') {
                    if (!confirm(`準備將 ${res.selectedCases.length} 筆案件指派給【${res2.assignee}】？`)) {
                        UIManager.Toast.show('操作已取消', 'info');
                        return modeSelector();
                    }
                    UIManager.Progress.show('執行派件中…');
                    try {
                        await ApiService.manualAssign(res.selectedCases, res2.assignee);
                        UIManager.Progress.hide();
                        await UIModules.successDialog({ assignee: res2.assignee, cases: res.selectedCases });
                        modeSelector();
                    } catch (e) {
                        UIManager.Toast.show(`派件失敗: ${e.message}`, 'error', 5000);
                        UIManager.Progress.hide();
                    }
                }
            } else if (res.action === '_back_to_mode_') {
                modeSelector();
            }
        }

        async function modeSelector() {
            UIManager.Modal.close();
            const res = await UIModules.modeDialog();
            switch (res.action) {
                case 'personal': await personalFlow(); break;
                case 'batch': await batchFlow(); break;
                case '_change_token_': await tokenDialog(true); break;
                case '_edit_presets_': await presetDialog(); break;
            }
        }

        async function presetDialog() {
            const res = await UIModules.presetDialog();
            if (res.action === '_saved_' || res.action === '_back_') {
                modeSelector();
            }
        }

        async function tokenDialog(isChange = false) {
            if (isChange) {
                localStorage.removeItem(AppConfig.TOKEN_KEY);
                AppState.set({ userToken: null });
            }
            const res = await UIModules.tokenDialog(!isChange);
            if (res.action === '_confirm_') {
                AppState.set({ userToken: res.value });
                localStorage.setItem(AppConfig.TOKEN_KEY, res.value);
                UIManager.Toast.show('Token 已儲存', 'success');
                UIManager.Modal.close();
                await Utils.sleep(400);
                modeSelector();
            } else if (res.action === '_retry_autocheck_') {
                UIManager.Modal.close();
                autoToken();
            } else {
                UIManager.Toast.show('操作已取消', 'info');
            }
        }

        async function autoToken() {
            UIManager.Progress.show('正在自動檢測 Token...');
            await Utils.sleep(260);
            const token = Utils.getStoredToken();
            if (!AppState.get('abortController')?.signal.aborted) {
                UIManager.Progress.hide();
                if (token) {
                    AppState.set({ userToken: token });
                    UIManager.Toast.show('已自動載入 Token', 'success');
                    await Utils.sleep(400);
                    modeSelector();
                } else {
                    UIManager.Toast.show('未找到可用 Token，請手動輸入', 'warning');
                    await Utils.sleep(400);
                    tokenDialog(false);
                }
            }
        }

        function init() {
            UIManager.injectStyle();
            autoToken();
        }
        
        // 暴露需要被其他模組呼叫的方法
        return { init, publicMethods: { personalFlow, batchFlow } };
    })();

    // === 9. 啟動程式 ===
    (function startApp() {
        document.querySelectorAll(`#${AppConfig.TOOL_CONTAINER_ID}, #${AppConfig.STYLE_ELEMENT_ID}, .dispatch-toast, #dispatch-mask, #dispatch-progress`).forEach(el => el.remove());
        AppMain.init();
    })();

})();