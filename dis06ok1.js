javascript: (() => {
  /**
   * =================================================================================
   * 多功能派件整合 - v15.13 (錯誤修復與寬度調整版)
   * =================================================================================
   * @version   15.13.0 (Refactored)
   * @description
   * 本版本主要修復使用者回報的問題並進行調整。
   *
   * - [修復] 解決了「派件成功」對話框中，成功與失敗件數始終顯示為 0 的問題。
   * - [修復] 確保「匯入人員」後，下拉選單會即時更新並正確排序。
   * - [調整] 根據使用者要求，將主視窗的整體寬度調整為 1200px。
   * =================================================================================
   */
  'use strict';

  try {
    // === 1. 設定模組 (AppConfig) ===
    const AppConfig = Object.freeze({
      VERSION: '15.13 (錯誤修復版)',
      TOOL_CONTAINER_ID: 'dispatch-tool-container-v15',
      STYLE_ELEMENT_ID: 'dispatch-tool-style-v15',
      TOKEN_KEY: 'euisToken',
      PRESETS_KEY: 'dispatchPresets_v4',
      BATCH_PAGE_SIZE: 50,
      CONCURRENT_API_LIMIT: 5,
      DEBOUNCE_DELAY: 600,
      DEFAULT_ASSIGNEES: [
        'alex.yc.liu', 'carol.chan', 'chenjui.chang', 'jessy.fu',
        'lisa.wu', 'pearl.ho', 'peiyi.wu', 'cih.lian'
      ],
      SPECIAL_ASSIGNEES: [
        'chenjui.chang', 'peiyi.wu', 'cih.lian'
      ],
      MODAL_ACTIONS: {
        CONFIRM: 'confirm',
        RETRY_AUTOCHECK: 'retry_autocheck',
        SWITCH_MODE: 'switch_mode',
        NEXT_STEP: 'next_step',
        CONFIRM_ASSIGNMENT: 'confirm_assignment',
        CLOSE: 'close',
        BACK: 'back',
        RETRY: 'retry',
        CHANGE_TOKEN: 'change_token',
        EDIT_PRESETS: 'edit_presets',
        RESET_POSITION: 'reset_position',
        SAVE_PRESETS: 'save_presets',
        RESET_PRESETS: 'reset_presets',
        BACK_TO_MAIN: 'back_to_main'
      },
      ZINDEX: {
        TOAST: 2147483647,
        MASK: 2147483640,
        MODAL: 2147483641
      },
      API: {
        QUERY_PERSONAL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
        QUERY_BATCH: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
        MANUAL_ASSIGN: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
      },
      TOOL_CONTAINER_WIDTH: '1200px',
      COLUMN_DEFINITIONS: {
        applyNumber: { label: "受理號碼", key: "applyNumber" },
        policyNumber: { label: "保單號碼", key: "policyNumber" },
        ownerName: { label: "要保人", key: "ownerName" },
        insuredName: { label: "被保人", key: "insuredName" },
        applyDate: { label: "受理日", key: "applyDate", type: "date" },
        mainStatus: { label: "主狀態", key: "mainStatus" },
        subStatus: { label: "次狀態", key: "subStatus" },
        currentOwner: { label: "目前人員", key: "currentOwner" },
        polpln: { label: "險種代碼", key: "polpln" },
        planCodeName: { label: "險種名稱", key: "planCodeName" },
        pool: { label: "Pool", key: "pool" },
        poolStatus: { label: "Pool狀態", key: "poolStatus" },
        uwLevel: { label: "核保層級", key: "uwLevel" },
        channel: { label: "業務來源", key: "channel" },
        firstBillingMethod: { label: "首期繳費方式", key: "firstBillingMethod" },
        agencyCode: { label: "送件單位代碼", key: "agencyCode" },
        seq: { label: "序號", key: "seq" },
        select: { label: "選取", key: "select" },
      },
      PERSONAL_VIEW_CONFIG: {
        columns: ['select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currentOwner', 'polpln'],
        widths: {
          select: '35px', seq: '35px', applyDate: '100px', applyNumber: '110px', policyNumber: '110px',
          ownerName: '90px', insuredName: '90px', mainStatus: '80px', subStatus: '80px',
          currentOwner: '100px', polpln: '90px'
        }
      },
      BATCH_VIEW_CONFIG: {
        columns: ['select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currentOwner'],
        widths: {
          select: '35px', seq: '35px', applyDate: '100px', applyNumber: '110px', policyNumber: '110px',
          ownerName: '90px', insuredName: '90px', mainStatus: '80px', subStatus: '80px',
          currentOwner: '100px'
        }
      },
      FILTER_CONFIG: {
        common: ['applyNumber', 'policyNumber', 'ownerName', 'insuredName'],
        personal_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDate', 'polpln'],
        batch_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDate', 'pool', 'poolStatus', 'uwLevel']
      },
      EXPORT_COLUMN_KEYS: [
        'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus',
        'currentOwner', 'applyDate', 'polpln', 'planCodeName', 'pool', 'poolStatus',
        'uwLevel', 'channel', 'firstBillingMethod', 'agencyCode'
      ],
      DEFAULT_FILTERS: {
        personal: {},
        batch: {
          mainStatus: '2',
          applyDateStart: '',
          applyDateEnd: ''
        }
      }
    });

    // === 2. 全域狀態模組 (AppState) ===
    const AppState = (() => {
      const state = {
        userToken: null,
        modalPosition: { top: null, left: null },
        abortController: null,
        isLoading: false,
        currentMode: 'personal'
      };
      return {
        get: (key) => key ? state[key] : { ...state },
        set: (k, v) => {
          if (typeof k === 'object') Object.assign(state, k);
          else state[k] = v;
        },
        createAbortSignal: () => (state.abortController = new AbortController()).signal,
        abortRequest: () => {
          state.abortController?.abort();
          state.abortController = null;
        }
      };
    })();

    // === 3. 工具方法模組 (Utils) ===
    const Utils = (() => ({
      escapeHtml: (str) => {
        if (str === null || str === undefined) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
      },
      getStoredToken: () => [localStorage, sessionStorage].map(s => s.getItem(AppConfig.TOKEN_KEY)).find(t => t && t.trim()) || null,
      jsonToCsv: (items, columnKeys, definitions) => {
        const headerRow = columnKeys.map(key => JSON.stringify(definitions[key].label)).join(',');
        const rows = items.map(row => columnKeys.map(key => JSON.stringify(row[key] ?? '')).join(','));
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
      debounce: (fn, delay) => {
        let t;
        return function(...args) {
          clearTimeout(t);
          t = setTimeout(() => fn.apply(this, args), delay);
        };
      },
      readTxt: () => new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.style.display = 'none';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) { reject(new Error('未選取檔案')); return; }
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('檔案讀取失敗'));
          reader.readAsText(file);
        };
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      }),
      splitTextInput: (text) => text.split(/[\n,;\s]+/).map(s => s.trim()).filter(s => s)
    }))();
    
    // === 3.5. DOM 輔助工具模組 (DOMHelper) ===
    const DOMHelper = (() => ({
      create: (tag, options = {}) => {
        const el = document.createElement(tag);
        if (options.className) el.className = options.className;
        if (options.id) el.id = options.id;
        if (options.textContent) el.textContent = options.textContent;
        if (options.innerHTML) el.innerHTML = options.innerHTML;

        if (options.style) {
          Object.assign(el.style, options.style);
        }
        if (options.attributes) {
          for (const [key, value] of Object.entries(options.attributes)) {
            el.setAttribute(key, value);
          }
        }
        if (options.children) {
          options.children.forEach(child => el.appendChild(child));
        }
        if (options.events) {
          for (const [event, handler] of Object.entries(options.events)) {
            el.addEventListener(event, handler);
          }
        }
        return el;
      }
    }))();

    // === 4. UI 管理模組 (UIManager) ===
    const UIManager = (() => {
      function injectStyle() {
        if (document.getElementById(AppConfig.STYLE_ELEMENT_ID)) return;
        const style = DOMHelper.create('style', {
          id: AppConfig.STYLE_ELEMENT_ID,
          textContent: `
            :root { --primary-color: #007bff; --primary-dark: #0056b3; --secondary-color: #6C757D; --success-color: #28a745; --error-color: #dc3545; --warning-color: #fd7e14; }
            .dispatch-mask { position: fixed; z-index: ${AppConfig.ZINDEX.MASK}; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.2s; }
            .dispatch-mask.show { opacity: 1; }
            .dispatch-modal { font-family: 'Microsoft JhengHei', 'Segoe UI', sans-serif; background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,.15); padding:0; position: fixed;
            top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: ${AppConfig.ZINDEX.MODAL}; display: flex; flex-direction: column; opacity: 0; transition: opacity .18s; max-height: 90vh;
            max-width: 95vw; box-sizing: border-box; }
            .dispatch-modal.show { opacity: 1; } .dispatch-modal.dragging { transition: none !important; }
            .dispatch-header { padding: 16px 20px; font-size: 20px; font-weight: bold; border-bottom: 1px solid #E0E0E0; color: #1a1a1a; cursor: grab; position: relative; text-align:center; }
            .dispatch-close { position: absolute; top:10px; right:10px; background:transparent; border:none; font-size:28px; font-weight:bold; color:var(--secondary-color); cursor:pointer; width:36px; height:36px; border-radius:50%; transition:.2s; display:flex; align-items:center; justify-content:center; }
            .dispatch-close:hover { background:#f0f0f0; color:#333; transform:rotate(90deg)scale(1.05); }
            .dispatch-body { padding:16px 20px; flex-grow:1; overflow-y:auto; min-height:50px; display:flex; flex-direction:column; }
            .dispatch-footer { padding:12px 20px 16px 20px; border-top:1px solid #e0e0e0; display:flex; align-items:center; width:100%; box-sizing:border-box; }
            .dispatch-btn { display:inline-flex; align-items:center; justify-content:center; padding:8px 18px; font-size:15px; border-radius:6px; border:1px solid transparent; background:var(--primary-color); color:#fff; cursor:pointer; transition:.25s; font-weight:600; white-space:nowrap; }
            .dispatch-btn:not([disabled]):hover { background:var(--primary-dark); transform:translateY(-2px); }
            .dispatch-btn[disabled] { background:#d6d6d6; cursor:not-allowed; }
            .dispatch-btn.dispatch-outline { background:transparent; border-color:var(--secondary-color); color:var(--secondary-color); }
            .dispatch-btn.dispatch-outline:not([disabled]):hover { background-color:#f8f8f8; }
            .dispatch-btn.small { padding:4px 10px; font-size:13px; }
            .dispatch-input, textarea.dispatch-input, select.dispatch-input { width:100%; font-size:14px; padding:8px 12px; border-radius:5px; box-sizing:border-box; border:1px solid #e0e0e0; margin-top:5px; }
            .dispatch-toast { position:fixed; left:50%; top:30px; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:10px 22px; border-radius:6px; font-size:16px; z-index:${AppConfig.ZINDEX.TOAST}; opacity:0; transition:.3s; }
            .dispatch-toast.show { opacity:1; }
            .dispatch-progress { position:fixed; inset:0; background:rgba(255,255,255,0.8); z-index:${AppConfig.ZINDEX.TOAST}; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:1.2rem; font-weight:bold; }
            .dispatch-progress button { margin-top:20px; }
            .dispatch-tabs { margin-bottom:15px; border-bottom:1px solid #ccc; display:flex; }
            .dispatch-tabs button { background:transparent; border:none; padding:10px 15px; cursor:pointer; font-size:16px; border-bottom:3px solid transparent; margin-bottom:-1px; }
            .dispatch-tabs button.active { font-weight:bold; color:var(--primary-color); border-bottom-color:var(--primary-color); }
            .filter-controls { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px 15px; margin-bottom:10px; }
            .advanced-filters { display: none; margin-top: 10px; }
            .case-table-container { overflow:auto; position:relative; flex-grow:1; border:1px solid #ddd; }
            .case-table { border-collapse:collapse; white-space:nowrap; font-size:14px; table-layout:fixed; }
            .case-table thead { position:sticky; top:0; z-index:1; background-color:#f2f2f2; }
            .case-table th, .case-table td { border:1px solid #ddd; padding:8px 10px; text-align:center; overflow:hidden; text-overflow:ellipsis; }
            .case-table th { cursor:pointer; user-select: none; } .case-table td { cursor:cell; }
            .case-table th .sort-indicator { margin-left:5px; font-weight:normal; opacity:0.5; }
            .header-config-btn { position: absolute; top: 14px; left: 14px; font-size: 20px; width:36px; height:36px; border-radius:50%; border:none; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; }
            .header-config-btn:hover { background: #f0f0f0; }
            .config-menu { position: absolute; top: 52px; left: 10px; background: #fff; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10;
            padding: 5px 0; display: none; }
            .config-menu button { background: none; border: none; padding: 8px 16px; width: 100%; text-align: left; cursor: pointer; font-size: 14px; }
            .config-menu button:hover { background: #f0f0f0; }
            .preset-form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .preset-form-col { display: flex; flex-direction: column; }
            .preset-form h3 { margin: 0 0 10px; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
            .special-assignee { font-weight: bold; color: #00008B; background-color: #FFFFE0; }
          `
        });
        document.head.appendChild(style);
      }

      const Toast = {
        show: (msg, type = 'success', duration = 2100) => {
          document.querySelector('.dispatch-toast')?.remove();
          const toastElement = DOMHelper.create('div', {
            className: `dispatch-toast ${type}`,
            textContent: msg,
            style: { background: `var(--${type}-color, #555)` }
          });
          document.body.appendChild(toastElement);
          requestAnimationFrame(() => toastElement.classList.add('show'));
          if (duration > 0) {
            setTimeout(() => {
              toastElement.classList.remove('show');
              toastElement.addEventListener('transitionend', () => toastElement.remove(), { once: true });
            }, duration);
          }
        }
      };

      const Progress = {
        show(text) {
          this.hide();
          const stopButton = DOMHelper.create('button', {
            id: 'stop-query',
            className: 'dispatch-btn dispatch-outline',
            textContent: '停止查詢',
            events: {
              click: () => {
                AppState.abortRequest();
                this.hide();
                Toast.show('查詢已中斷', 'warning');
              }
            }
          });
          const progressElement = DOMHelper.create('div', {
            id: 'dispatch-progress',
            className: 'dispatch-progress',
            children: [
              DOMHelper.create('div', { textContent: Utils.escapeHtml(text) }),
              stopButton
            ]
          });
          document.body.appendChild(progressElement);
        },
        update(percent, text) {
          const progressText = document.getElementById('dispatch-progress')?.querySelector('div:first-child');
          if (progressText) {
            progressText.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
          }
        },
        hide() {
          document.getElementById('dispatch-progress')?.remove();
        }
      };

      const Modal = {
        hide() {
          const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
          if (modal) {
            const style = window.getComputedStyle(modal);
            AppState.set({ modalPosition: { top: style.top, left: style.left } });
            modal.style.opacity = '0';
            modal.style.display = 'none';
          }
          const mask = document.getElementById('dispatch-mask');
          if (mask) mask.classList.remove('show');
          
          AppState.abortRequest();
          document.removeEventListener('keydown', EventHandlers.handleEsc);
        },
        show(opts) {
          return new Promise(resolve => {
            const modal = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
            if (!modal) {
              console.error('Modal container not found.');
              return resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE });
            }

            modal.style.display = 'flex';
            modal.style.opacity = '0';
            document.getElementById('dispatch-mask')?.classList.add('show');
            
            modal.innerHTML = '';
            const header = DOMHelper.create('div', { className: 'dispatch-header', innerHTML: opts.header });
            const closeButton = DOMHelper.create('button', {
                className: 'dispatch-close',
                innerHTML: '&times;',
                events: { click: () => { Modal.hide(); resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE }); } }
            });
            header.appendChild(closeButton);
            
            modal.append(header, opts.body, opts.footer);

            const { top, left } = AppState.get('modalPosition');
            if (top && left && top !== 'auto' && left !== 'auto') {
                modal.style.top = top;
                modal.style.left = left;
                modal.style.transform = 'none';
            } else {
                modal.style.top = '50%';
                modal.style.left = '50%';
                modal.style.transform = 'translate(-50%, -50%)';
            }
            modal.style.width = opts.width || 'auto';
            requestAnimationFrame(() => modal.style.opacity = '1');

            header.addEventListener('mousedown', EventHandlers.dragStart);
            EventHandlers.setupKeyListener();

            if (opts.onOpen) opts.onOpen(modal, resolve);
          });
        }
      };

      function initModalContainer() {
        if (document.getElementById(AppConfig.TOOL_CONTAINER_ID)) return;
        const container = DOMHelper.create('div', { id: AppConfig.TOOL_CONTAINER_ID, className: 'dispatch-modal' });
        const mask = DOMHelper.create('div', { id: 'dispatch-mask', className: 'dispatch-mask' });
        document.body.append(container, mask);
      }

      return { injectStyle, Toast, Progress, Modal, initModalContainer };
    })();

    // === 5. 事件處理模組 (EventHandlers) ===
    const EventHandlers = (() => {
      const drag = { active: false, sX: 0, sY: 0, iL: 0, iT: 0 };
      
      function dragStart(e) {
        const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
        if (!m || e.target.closest('.dispatch-close, .header-config-btn')) return;
        
        e.preventDefault();
        drag.active = true;
        m.classList.add('dragging');
        
        const r = m.getBoundingClientRect();
        drag.sX = e.clientX;
        drag.sY = e.clientY;
        drag.iL = r.left;
        drag.iT = r.top;
        
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag, { once: true });
      }

      function doDrag(e) {
        if (!drag.active) return;
        e.preventDefault();
        const m = document.getElementById(AppConfig.TOOL_CONTAINER_ID);
        if (m) {
          m.style.left = `${drag.iL + e.clientX - drag.sX}px`;
          m.style.top = `${drag.iT + e.clientY - drag.sY}px`;
          m.style.transform = 'none';
        }
      }

      function stopDrag() {
        drag.active = false;
        document.getElementById(AppConfig.TOOL_CONTAINER_ID)?.classList.remove('dragging');
        document.removeEventListener('mousemove', doDrag);
      }
      
      function handleEsc(e) { if (e.key === 'Escape') UIManager.Modal.hide(); }
      
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
        if (!token) throw new Error('TOKEN無效或過期');

        const fetchOptions = {
            ...options,
            headers: {
                ...options.headers,
                'SSO-TOKEN': token,
                'Content-Type': 'application/json'
            },
            signal: AppState.createAbortSignal()
        };

        const response = await fetch(url, fetchOptions);

        if (response.status === 401 || response.status === 403) {
            throw new Error('TOKEN無效或過期');
        }

        if (!response.ok) {
            const error = new Error(`伺服器錯誤: ${response.status}`);
            try {
                error.data = await response.json();
            } catch {
                error.data = await response.text();
            }
            throw error;
        }
        
        return response.json();
      }

      async function fetchAllPages(endpoint, payload, listName) {
        let allRecords = [];
        let page = 1;
        let totalPages = 1;
        
        UIManager.Progress.show(`載入${listName}中...`);

        try {
            const firstPageData = await _fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify({ ...payload, pageIndex: page, size: AppConfig.BATCH_PAGE_SIZE })
            });
            
            if (firstPageData?.records?.length > 0) {
                allRecords = allRecords.concat(firstPageData.records);
                if (firstPageData.total > AppConfig.BATCH_PAGE_SIZE) {
                    totalPages = Math.ceil(firstPageData.total / AppConfig.BATCH_PAGE_SIZE);
                }
            } else {
                 UIManager.Progress.hide();
                 return [];
            }

            if (totalPages > 1) {
                const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
                
                const pageChunks = [];
                for (let i = 0; i < pagesToFetch.length; i += AppConfig.CONCURRENT_API_LIMIT) {
                    pageChunks.push(pagesToFetch.slice(i, i + AppConfig.CONCURRENT_API_LIMIT));
                }

                for (const chunk of pageChunks) {
                    const promises = chunk.map(p => _fetch(endpoint, {
                        method: 'POST',
                        body: JSON.stringify({ ...payload, pageIndex: p, size: AppConfig.BATCH_PAGE_SIZE })
                    }));

                    const results = await Promise.all(promises);
                    results.forEach(res => {
                        if (res?.records?.length > 0) {
                            allRecords.push(...res.records);
                        }
                    });

                    const loadedCount = allRecords.length;
                    const totalCount = firstPageData.total;
                    const percent = Math.round(100 * loadedCount / totalCount);
                    UIManager.Progress.update(percent, `載入${listName}中... ${loadedCount}/${totalCount} 筆`);
                }
            }
            UIManager.Progress.hide();
            return allRecords;
        } catch(error) {
            UIManager.Progress.hide();
            console.error(`[ApiService] Fetch failed for ${listName}:`, error);
            throw error;
        }
      }

      return {
        fetchPersonalCases: () => fetchAllPages(AppConfig.API.QUERY_PERSONAL, {}, '個人案件'),
        fetchBatchCases: (filters) => fetchAllPages(AppConfig.API.QUERY_BATCH, filters, '批次案件'),
        manualAssign: async (applyNumbers, assignee) => {
          const response = await _fetch(AppConfig.API.MANUAL_ASSIGN, {
            method: 'POST',
            body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: assignee, dispatchOrgBf: '', applyNumbers })
          });
          
          const successfulCases = response?.assignSuccess ?? [];
          const failedCases = (response?.assignFail ?? []).map(failItem => ({
            caseId: failItem.caseId,
            reason: failItem.errorMsg || '未知原因'
          }));

          return { successful: successfulCases, failed: failedCases };
        }
      };
    })();

    // === 7. UI元件模組 (UIComponents) ===
    const UIComponents = (() => {
        const TokenDialog = {
            show: (showRetry) => UIManager.Modal.show({
                header: '請輸入 SSO-TOKEN',
                width: '450px',
                body: DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('p', { textContent: '請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。', style: { marginTop: '0' } }),
                        DOMHelper.create('textarea', { id: 'token-input', className: 'dispatch-input', attributes: { rows: '4' }, style: { fontFamily: 'monospace' } }),
                        ...(showRetry ? [DOMHelper.create('p', { textContent: '自動偵測失敗，請手動輸入。', style: { color: 'var(--error-color)', fontSize: '14px', marginBottom: '0' } })] : [])
                    ]
                }),
                footer: DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: showRetry ? 'space-between' : 'flex-end', padding: '12px 20px 16px' },
                    children: [
                        DOMHelper.create('button', { id: 'retry-autocheck-btn', className: 'dispatch-btn dispatch-outline', textContent: '重新驗證', style: { display: showRetry ? 'inline-flex' : 'none' } }),
                        DOMHelper.create('button', { id: 'confirm-token-btn', className: 'dispatch-btn', textContent: '確認' })
                    ]
                }),
                onOpen: (modal, resolve) => {
                    modal.querySelector('#confirm-token-btn').onclick = () => {
                        const value = modal.querySelector('#token-input').value.trim();
                        if (value) resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM, value });
                        else UIManager.Toast.show('Token 不可為空', 'error');
                    };
                    if (showRetry) {
                        modal.querySelector('#retry-autocheck-btn').onclick = () => resolve({ action: AppConfig.MODAL_ACTIONS.RETRY_AUTOCHECK });
                    }
                }
            })
        };
        
        const PresetDialog = {
            show: () => {
                const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}');
                const currentPresets = {
                    personal: { ...AppConfig.DEFAULT_FILTERS.personal, ...(presets.personal || {}) },
                    batch: { ...AppConfig.DEFAULT_FILTERS.batch, ...(presets.batch || {}) }
                };

                const createFormColumn = (mode, data) => {
                    const keys = mode === 'personal' 
                        ? [...AppConfig.FILTER_CONFIG.common, ...AppConfig.FILTER_CONFIG.personal_advanced]
                        : [...AppConfig.FILTER_CONFIG.common, ...AppConfig.FILTER_CONFIG.batch_advanced];
                    
                    const inputs = keys.map(key => {
                        const label = AppConfig.COLUMN_DEFINITIONS[key]?.label ?? key;
                        const value = data[key] ?? '';
                        const displayValue = Array.isArray(value) ? value.join(',') : value;
                        return DOMHelper.create('div', {
                            children: [
                                DOMHelper.create('label', { textContent: `${label}:`, style: { fontSize: '14px', display: 'block' } }),
                                DOMHelper.create('input', { type: 'text', id: `preset-${mode}-${key}`, className: 'dispatch-input', attributes: { value: Utils.escapeHtml(displayValue) } })
                            ]
                        });
                    });

                    return DOMHelper.create('div', {
                        className: 'preset-form-col',
                        children: [
                            DOMHelper.create('h3', { textContent: mode === 'personal' ? '個人案件預設篩選' : '批次案件預設篩選' }),
                            ...inputs
                        ]
                    });
                };

                const body = DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('div', {
                            className: 'preset-form',
                            children: [
                                createFormColumn('personal', currentPresets.personal),
                                createFormColumn('batch', currentPresets.batch)
                            ]
                        })
                    ]
                });

                const footer = DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                    children: [
                        DOMHelper.create('button', { id: 'reset-presets-btn', className: 'dispatch-btn dispatch-outline', textContent: '恢復預設值' }),
                        DOMHelper.create('div', {
                            children: [
                                DOMHelper.create('button', { id: 'back-to-main-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回', style: { marginRight: '10px' } }),
                                DOMHelper.create('button', { id: 'save-presets-btn', className: 'dispatch-btn', textContent: '儲存' }),
                            ]
                        })
                    ]
                });

                return UIManager.Modal.show({
                    header: '調整當次載入清單',
                    width: '800px',
                    body: body,
                    footer: footer,
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#save-presets-btn').onclick = () => {
                            const newPresets = { personal: {}, batch: {} };
                            const modes = ['personal', 'batch'];
                            
                            modes.forEach(mode => {
                                const keys = mode === 'personal'
                                    ? [...AppConfig.FILTER_CONFIG.common, ...AppConfig.FILTER_CONFIG.personal_advanced]
                                    : [...AppConfig.FILTER_CONFIG.common, ...AppConfig.FILTER_CONFIG.batch_advanced];
                                
                                keys.forEach(key => {
                                    const input = modal.querySelector(`#preset-${mode}-${key}`);
                                    if (input) newPresets[mode][key] = input.value.trim();
                                });
                            });

                            localStorage.setItem(AppConfig.PRESETS_KEY, JSON.stringify(newPresets));
                            UIManager.Toast.show('當次載入清單條件已儲存', 'success');
                            resolve({ action: AppConfig.MODAL_ACTIONS.BACK_TO_MAIN });
                        };
                        modal.querySelector('#reset-presets-btn').onclick = () => {
                            if (confirm('確定要將所有條件恢復為出廠設定嗎？')) {
                                localStorage.removeItem(AppConfig.PRESETS_KEY);
                                UIManager.Toast.show('已恢復為預設值', 'info');
                                resolve({ action: AppConfig.MODAL_ACTIONS.BACK_TO_MAIN });
                            }
                        };
                        modal.querySelector('#back-to-main-btn').onclick = () => {
                            resolve({ action: AppConfig.MODAL_ACTIONS.BACK_TO_MAIN });
                        };
                    }
                });
            }
        };
        
        const PersonnelSelectDialog = {
            show: (opts) => {
                const { selectedCount, defaultUsers } = opts;
                const body = DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('p', { innerHTML: `已選取 <strong>${selectedCount}</strong> 筆案件，請選擇或輸入指派人員：`, style: { marginTop: '0' } }),
                        DOMHelper.create('div', {
                            style: { display: 'flex', alignItems: 'center', gap: '10px' },
                            children: [
                                DOMHelper.create('select', { id: 'assignee-select', className: 'dispatch-input', style: { flexGrow: '1', marginTop: '0' } }),
                                DOMHelper.create('button', { id: 'import-personnel-btn', className: 'dispatch-btn dispatch-outline small', textContent: '匯入人員' })
                            ]
                        }),
                        DOMHelper.create('div', {
                            style: { marginTop: '15px' },
                            children: [
                                DOMHelper.create('label', { style: { cursor: 'pointer' }, children: [
                                    DOMHelper.create('input', { type: 'checkbox', id: 'manual-assignee-checkbox' }),
                                    DOMHelper.create('span', { textContent: ' 或手動輸入帳號' })
                                ]}),
                                DOMHelper.create('input', { type: 'text', id: 'manual-assignee-input', className: 'dispatch-input', attributes: { placeholder: '請輸入完整 AD 帳號' }, style: { display: 'none' } })
                            ]
                        })
                    ]
                });

                const footer = DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'space-between', padding: '12px 20px 16px' },
                    children: [
                        DOMHelper.create('button', { id: 'back-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回上一步' }),
                        DOMHelper.create('button', { id: 'confirm-assignment-btn', className: 'dispatch-btn', textContent: '確認指派', attributes: { disabled: true } })
                    ]
                });

                return UIManager.Modal.show({
                    header: '選擇指派人員',
                    width: '450px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        const selectEl = modal.querySelector('#assignee-select');
                        const importBtn = modal.querySelector('#import-personnel-btn');
                        const manualCheckbox = modal.querySelector('#manual-assignee-checkbox');
                        const manualInput = modal.querySelector('#manual-assignee-input');
                        const confirmBtn = modal.querySelector('#confirm-assignment-btn');
                        
                        let currentPersonnelList = [...defaultUsers];

                        const populateSelect = (list) => {
                            const specialUsers = [];
                            const regularUsers = [];

                            list.forEach(user => {
                                if (AppConfig.SPECIAL_ASSIGNEES.includes(user)) {
                                    specialUsers.push(user);
                                } else {
                                    regularUsers.push(user);
                                }
                            });

                            specialUsers.sort();
                            regularUsers.sort();

                            const specialOptions = specialUsers.map(u => 
                                `<option value="${Utils.escapeHtml(u)}" class="special-assignee">${Utils.escapeHtml(u)}</option>`
                            );
                            const regularOptions = regularUsers.map(u => 
                                `<option value="${Utils.escapeHtml(u)}">${Utils.escapeHtml(u)}</option>`
                            );
                            
                            selectEl.innerHTML = [...specialOptions, ...regularOptions].join('');
                        };

                        const updateConfirmBtnState = () => {
                            const hasValue = manualCheckbox.checked ? manualInput.value.trim() !== '' : !!selectEl.value;
                            confirmBtn.disabled = !hasValue;
                        };
                        
                        const handleImport = async () => {
                            try {
                                const importedNames = Utils.splitTextInput(await Utils.readTxt());
                                if (importedNames.length > 0) {
                                    currentPersonnelList = [...new Set([...currentPersonnelList, ...importedNames])];
                                    populateSelect(currentPersonnelList);
                                    UIManager.Toast.show(`成功匯入 ${importedNames.length} 位人員`, 'success');
                                }
                            } catch (e) {
                                if (e.message !== '未選取檔案') {
                                    UIManager.Toast.show(e.message, 'error');
                                }
                            }
                        };
                        
                        manualCheckbox.onchange = () => {
                            const isChecked = manualCheckbox.checked;
                            selectEl.disabled = isChecked;
                            manualInput.style.display = isChecked ? 'block' : 'none';
                            if (isChecked) manualInput.focus();
                            updateConfirmBtnState();
                        };
                        
                        selectEl.onchange = updateConfirmBtnState;
                        manualInput.oninput = updateConfirmBtnState;
                        importBtn.onclick = handleImport;
                        modal.querySelector('#back-btn').onclick = () => resolve({ action: AppConfig.MODAL_ACTIONS.BACK });
                        confirmBtn.onclick = () => {
                            const assignee = manualCheckbox.checked ? manualInput.value.trim() : selectEl.value;
                            if (!assignee) return UIManager.Toast.show('請選擇或輸入指派人員', 'error');
                            resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT, assignee });
                        };

                        populateSelect(currentPersonnelList);
                        updateConfirmBtnState();
                    }
                });
            }
        };

        const AssignmentResultDialog = {
            show: ({ successful, failed, assignee }) => {
                const hasFailures = failed.length > 0;
                
                const bodyChildren = [
                    DOMHelper.create('p', { innerHTML: `已完成對 <strong>${Utils.escapeHtml(assignee)}</strong> 的派件操作。`}),
                    DOMHelper.create('p', { 
                        innerHTML: `成功 ${successful.length} 筆，失敗 ${failed.length} 筆。`,
                        style: { fontWeight: 'bold', color: hasFailures ? 'var(--warning-color)' : 'var(--success-color)' }
                    })
                ];

                if (failed.length > 0) {
                    bodyChildren.push(DOMHelper.create('div', {
                        style: { marginTop: '15px' },
                        children: [
                            DOMHelper.create('strong', { textContent: '失敗詳情：' }),
                            DOMHelper.create('textarea', {
                                className: 'dispatch-input',
                                attributes: { rows: '5', readonly: true },
                                style: { fontSize: '12px', background: '#f8f8f8' },
                                textContent: failed.map(f => `受理號碼: ${Utils.escapeHtml(f.caseId)}\n原因: ${Utils.escapeHtml(f.reason)}`).join('\n\n')
                            })
                        ]
                    }));
                }
                
                if (successful.length > 0 && failed.length > 0) {
                     bodyChildren.push(DOMHelper.create('div', {
                        style: { marginTop: '10px' },
                        children: [
                            DOMHelper.create('strong', { textContent: '成功列表：' }),
                            DOMHelper.create('textarea', {
                                className: 'dispatch-input',
                                attributes: { rows: '3', readonly: true },
                                style: { fontSize: '12px' },
                                textContent: successful.map(Utils.escapeHtml).join('\n')
                            })
                        ]
                    }));
                }
                
                const body = DOMHelper.create('div', { className: 'dispatch-body', children: bodyChildren });
                const footer = DOMHelper.create('div', { className: 'dispatch-footer', style: { justifyContent: 'flex-end'}, children: [
                    DOMHelper.create('button', { id: 'close-result-btn', className: 'dispatch-btn', textContent: '關閉' })
                ]});

                return UIManager.Modal.show({
                    header: hasFailures ? '派件部分成功' : '派件成功',
                    width: '500px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        const closeBtn = modal.querySelector('#close-result-btn');
                        let interval;
                        const closeAndResolve = () => {
                            if (interval) clearInterval(interval);
                            UIManager.Modal.hide();
                            resolve({ action: AppConfig.MODAL_ACTIONS.CLOSE });
                        };
                        closeBtn.onclick = closeAndResolve;
                        if (!hasFailures) {
                            let countdown = 3;
                            closeBtn.textContent = `關閉 (${countdown})`;
                            interval = setInterval(() => {
                                countdown--;
                                if (countdown > 0) {
                                    closeBtn.textContent = `關閉 (${countdown})`;
                                } else {
                                    closeAndResolve();
                                }
                            }, 1000);
                        }
                    }
                });
            }
        };

        const ErrorDialog = {
            show: ({ error }) => {
                 const body = DOMHelper.create('div', { className: 'dispatch-body', children: [
                    DOMHelper.create('p', { textContent: '在執行過程中發生錯誤：', style: { color: 'var(--error-color)' } }),
                    DOMHelper.create('pre', { 
                        textContent: Utils.escapeHtml(error.message),
                        style: { background: '#f0f0f0', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
                    })
                 ]});
                 const footer = DOMHelper.create('div', { className: 'dispatch-footer', style: { justifyContent: 'space-between' }, children: [
                    DOMHelper.create('button', { id: 'back-to-main-btn', className: 'dispatch-btn dispatch-outline', textContent: '返回' }),
                    DOMHelper.create('button', { id: 'retry-btn', className: 'dispatch-btn', textContent: '重試' })
                 ]});

                return UIManager.Modal.show({
                    header: '操作失敗',
                    width: '500px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        modal.querySelector('#back-to-main-btn').onclick = () => { UIManager.Modal.hide(); resolve({ action: AppConfig.MODAL_ACTIONS.BACK }); };
                        modal.querySelector('#retry-btn').onclick = () => { UIManager.Modal.hide(); resolve({ action: AppConfig.MODAL_ACTIONS.RETRY }); };
                    }
                });
            }
        };

        const CaseListView = { show: async (opts) => {
            const { caseList, error, mode, viewConfig } = opts;
            const { columns: columnKeys, widths } = viewConfig;
            
            const totalWidth = columnKeys.reduce((sum, key) => sum + parseInt(widths[key] || 100, 10), 0);
            const tableWidth = Math.max(totalWidth, parseInt(AppConfig.TOOL_CONTAINER_WIDTH, 10) - 40);

            const isErrorState = !!error;
            
            let sortState = { key: 'seq', order: 'asc' };
            let currentData = isErrorState ? [] : [...caseList];

            let elements = {};

            const header = _createHeader();
            const body = _createBody();
            const footer = _createFooter();
            
            function _renderTable(data) {
                if (isErrorState) {
                    elements.tbody.innerHTML = '';
                    const errorLink = DOMHelper.create('a', {
                        textContent: '點此重新驗證 Token',
                        attributes: { href: '#' },
                        style: { color: 'var(--error-color)', textDecoration: 'underline' },
                        events: { click: (e) => { e.preventDefault(); elements.resolve({ action: AppConfig.MODAL_ACTIONS.CHANGE_TOKEN }); }}
                    });
                    const errorCell = DOMHelper.create('td', {
                        attributes: { colspan: columnKeys.length },
                        style: { color: 'var(--error-color)', fontWeight: 'bold', height: '100px' },
                        children: [
                            DOMHelper.create('span', { textContent: `資料載入失敗：${Utils.escapeHtml(error.message)} ` }),
                            errorLink
                        ]
                    });
                    elements.tbody.appendChild(DOMHelper.create('tr', { children: [errorCell] }));
                    elements.countElem.textContent = '載入失敗';
                    elements.nextBtn.disabled = true;
                    return;
                }
                
                const fragment = document.createDocumentFragment();
                data.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = columnKeys.map(key => {
                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                        if (key === 'select') {
                            return `<td><input type="checkbox" class="case-checkbox" value="${Utils.escapeHtml(item.applyNumber)}"></td>`;
                        }
                        const displayValue = key === 'seq' ? index + 1 : (def.type === 'date' ? Utils.formatDisplayDate(item[key]) : item[key] ?? '');
                        return `<td title="${Utils.escapeHtml(item[key] ?? '')}">${Utils.escapeHtml(displayValue)}</td>`;
                    }).join('');
                    fragment.appendChild(tr);
                });
                
                elements.tbody.innerHTML = '';
                elements.tbody.appendChild(fragment);
                elements.countElem.textContent = `顯示 ${data.length} / ${caseList.length} 筆`;
                _updateNextButton();
            }

            function _updateNextButton() {
                const count = elements.modal.querySelectorAll('.case-checkbox:checked').length;
                elements.nextBtn.disabled = count === 0;
                elements.nextBtn.textContent = `下一步 (${count})`;
            }

            const _applyFiltersAndSort = Utils.debounce(() => {
                const filterValues = {};
                elements.filterInputs.forEach(input => {
                    const key = input.id.replace('filter-', '');
                    if (input.value) filterValues[key] = input.value.trim().toLowerCase();
                });

                let filteredData = caseList.filter(item => 
                    Object.entries(filterValues).every(([key, value]) => String(item[key] ?? '').toLowerCase().includes(value))
                );

                filteredData.sort((a, b) => {
                    let valA = a[sortState.key] ?? '';
                    let valB = b[sortState.key] ?? '';
                    if (AppConfig.COLUMN_DEFINITIONS[sortState.key]?.type === 'date') {
                        valA = new Date(valA).getTime() || 0;
                        valB = new Date(valB).getTime() || 0;
                    }
                    if (valA < valB) return sortState.order === 'asc' ? -1 : 1;
                    if (valA > valB) return sortState.order === 'asc' ? 1 : -1;
                    return 0;
                });
                
                currentData = filteredData;
                _renderTable(currentData);
            }, AppConfig.DEBOUNCE_DELAY);

            function _createHeader() {
                return `多功能派件整合
                    <button class="header-config-btn" id="config-btn" title="設定">⚙️</button>
                    <div class="config-menu" id="config-menu">
                        <button id="change-token-btn">重新驗證</button>
                        <button id="edit-presets-btn">調整當次載入清單</button>
                        <button id="reset-position-btn">重置視窗位置</button>
                    </div>`;
            }

            function _createBody() {
                const createFilterControls = () => {
                    const { common, personal_advanced, batch_advanced } = AppConfig.FILTER_CONFIG;
                    const advancedKeys = mode === 'personal' ? personal_advanced : batch_advanced;
                    const renderInput = key => {
                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                        return DOMHelper.create('div', { children: [
                            DOMHelper.create('label', { textContent: def.label, style: { fontSize: '14px', display: 'block', textAlign: 'left' } }),
                            DOMHelper.create('input', { type: 'text', id: `filter-${key}`, className: 'dispatch-input filter-field', attributes: { placeholder: `篩選${def.label}`, ...(isErrorState && { disabled: true }) } })
                        ]});
                    };
                    const commonInputs = common.map(renderInput);
                    const advancedInputs = advancedKeys.map(renderInput);
                    return [
                        DOMHelper.create('div', { className: 'filter-controls', children: commonInputs }),
                        DOMHelper.create('div', { className: 'filter-controls advanced-filters', children: advancedInputs })
                    ];
                };

                return DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('div', { className: 'dispatch-tabs', children: [
                            DOMHelper.create('button', { textContent: '個人案件', className: mode === 'personal' ? 'active' : '', attributes: { 'data-mode': 'personal' } }),
                            DOMHelper.create('button', { textContent: '批次案件', className: mode === 'batch' ? 'active' : '', attributes: { 'data-mode': 'batch' } })
                        ]}),
                        ...createFilterControls(),
                        DOMHelper.create('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }, children: [
                            DOMHelper.create('span', { id: 'case-count', style: { fontSize: '14px' } }),
                            DOMHelper.create('div', { children: [
                                DOMHelper.create('button', { id: 'toggle-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多篩選條件' }),
                                DOMHelper.create('button', { id: 'export-csv-btn', className: 'dispatch-btn small', textContent: '匯出CSV', attributes: { ...(isErrorState && { disabled: true }) }, style: { marginLeft: '8px' } }),
                                DOMHelper.create('button', { id: 'retry-fetch-btn', className: 'dispatch-btn small', textContent: '重新載入', style: { marginLeft: '8px', display: isErrorState ? 'inline-flex' : 'none' } })
                            ]})
                        ]}),
                        DOMHelper.create('div', { id: 'case-table-container', className: 'case-table-container', children: [
                            DOMHelper.create('table', { id: 'case-table', className: 'case-table', style: { width: `${tableWidth}px` }, children: [
                                DOMHelper.create('thead', { children: [
                                    DOMHelper.create('tr', { innerHTML: columnKeys.map(key => {
                                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                                        const width = widths[key];
                                        if (key === 'select') {
                                           return `<th style="width:${width};"><input type="checkbox" id="select-all-header" ${isErrorState ? 'disabled' : ''}></th>`;
                                        }
                                        return `<th style="width:${width};" data-key="${def.key}" data-type="${def.type || ''}" title="點擊排序">${def.label} <span class="sort-indicator"></span></th>`;
                                    }).join('') })
                                ]}),
                                DOMHelper.create('tbody')
                            ]})
                        ]})
                    ]
                });
            }

            function _createFooter() {
                return DOMHelper.create('div', {
                    className: 'dispatch-footer',
                    style: { justifyContent: 'flex-end' },
                    children: [
                        DOMHelper.create('button', { id: 'next-step-btn', className: 'dispatch-btn', textContent: '下一步 (0)', attributes: { disabled: true } })
                    ]
                });
            }
            
            function _bindEvents(resolve) {
                elements.resolve = resolve;
                _bindHeaderEvents();
                _bindTabEvents();
                _bindFilterEvents();
                _bindTableEvents();
                _bindFooterEvents();
            }

            function _bindHeaderEvents() {
                elements.modal.querySelector('#config-btn').onclick = (e) => {
                    const menu = elements.modal.querySelector('#config-menu');
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                };
                elements.modal.querySelector('#change-token-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.CHANGE_TOKEN });
                elements.modal.querySelector('#edit-presets-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.EDIT_PRESETS });
                elements.modal.querySelector('#reset-position-btn').onclick = () => {
                    AppState.set({ modalPosition: { top: null, left: null } });
                    UIManager.Toast.show('已重置視窗位置，下次開啟時將居中', 'success');
                    elements.modal.querySelector('#config-menu').style.display = 'none';
                };
            }

            function _bindTabEvents() {
                 elements.modal.querySelector('.dispatch-tabs').onclick = (e) => {
                    if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
                        elements.resolve({ action: AppConfig.MODAL_ACTIONS.SWITCH_MODE, mode: e.target.dataset.mode });
                    }
                };
            }

            function _bindFilterEvents() {
                elements.modal.querySelector('#toggle-filters-btn').onclick = (e) => {
                    const advancedFilters = elements.modal.querySelector('.advanced-filters');
                    const isHidden = advancedFilters.style.display === 'none' || advancedFilters.style.display === '';
                    advancedFilters.style.display = isHidden ? 'grid' : 'none';
                    e.target.textContent = isHidden ? '隱藏更多篩選條件' : '顯示更多篩選條件';
                };
                
                elements.modal.querySelector('#export-csv-btn').onclick = () => {
                    if (currentData.length === 0) return UIManager.Toast.show('沒有可匯出的資料', 'warning');
                    const filename = `${mode}_案件清單_${new Date().toISOString().slice(0, 10)}.csv`;
                    Utils.downloadCsv(Utils.jsonToCsv(currentData, AppConfig.EXPORT_COLUMN_KEYS, AppConfig.COLUMN_DEFINITIONS), filename);
                };

                if (isErrorState) {
                    elements.modal.querySelector('#retry-fetch-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.RETRY });
                } else {
                    elements.filterInputs.forEach(input => { input.oninput = _applyFiltersAndSort; });
                }
            }

            function _bindTableEvents() {
                if (isErrorState) return;

                elements.table.onclick = e => {
                    const target = e.target;
                    if (target.matches('th[data-key], th[data-key] *')) {
                        const th = target.closest('th[data-key]');
                        const key = th.dataset.key;
                        sortState.order = (sortState.key === key && sortState.order === 'asc') ? 'desc' : 'asc';
                        sortState.key = key;
                        elements.modal.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
                        th.querySelector('.sort-indicator').textContent = sortState.order === 'asc' ? '▲' : '▼';
                        _applyFiltersAndSort();
                    } 
                    else if (target.id === 'select-all-header') {
                        elements.tbody.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = target.checked);
                        _updateNextButton();
                    } 
                    else if (target.matches('.case-checkbox')) {
                        _updateNextButton();
                    }
                    else if (target.tagName === 'TD') {
                        navigator.clipboard.writeText(target.textContent).then(() => UIManager.Toast.show('已複製', 'success', 1000));
                    }
                };
            }

            function _bindFooterEvents() {
                if (isErrorState) return;
                elements.nextBtn.onclick = () => {
                    const selectedCases = Array.from(elements.modal.querySelectorAll('.case-checkbox:checked')).map(cb => cb.value);
                    if (selectedCases.length > 0) elements.resolve({ action: AppConfig.MODAL_ACTIONS.NEXT_STEP, selectedCases });
                };
            }

            return UIManager.Modal.show({
                header,
                body,
                footer,
                width: AppConfig.TOOL_CONTAINER_WIDTH,
                onOpen: (modal, resolve) => {
                    elements = {
                        modal,
                        resolve,
                        tbody: modal.querySelector('tbody'),
                        table: modal.querySelector('#case-table'),
                        countElem: modal.querySelector('#case-count'),
                        nextBtn: modal.querySelector('#next-step-btn'),
                        filterInputs: modal.querySelectorAll('.filter-field')
                    };
                    
                    _bindEvents(resolve);
                    
                    _renderTable(currentData);
                }
            });
        }}

        return {
            TokenDialog,
            PresetDialog,
            CaseListView,
            PersonnelSelectDialog,
            AssignmentResultDialog,
            ErrorDialog
        };
    })();

    // === 8. 主程式執行器 (AppRunner) ===
    const AppRunner = (() => {
        const state = {
            personalCases: [], 
            batchCases: [], 
            selectedCases: [], 
            assigneeList: [...AppConfig.DEFAULT_ASSIGNEES] 
        };

        const init = () => {
            UIManager.injectStyle();
            UIManager.initModalContainer();
        };

        const run = async () => {
            init();
            const token = Utils.getStoredToken();
            AppState.set('userToken', token);
            await handleMainView();
        };
        
        async function fetchCases(mode) {
             const presets = JSON.parse(localStorage.getItem(AppConfig.PRESETS_KEY) || '{}');
             const filterPayload = { ...AppConfig.DEFAULT_FILTERS[mode], ...(presets[mode] || {}) };
             const apiCall = mode === 'personal' 
                ? () => ApiService.fetchPersonalCases()
                : () => ApiService.fetchBatchCases(filterPayload);

            try {
                const cases = await apiCall();
                if (mode === 'personal') state.personalCases = cases;
                else state.batchCases = cases;
                state.selectedCases = [];
                return { data: cases };
            } catch (error) {
                return { error };
            }
        }

        async function handleMainView() {
            const mode = AppState.get('currentMode');
            const result = await fetchCases(mode);
            
            const res = await UIComponents.CaseListView.show({
                caseList: result.data,
                error: result.error,
                viewConfig: mode === 'personal' ? AppConfig.PERSONAL_VIEW_CONFIG : AppConfig.BATCH_VIEW_CONFIG,
                mode: mode
            });

            switch (res?.action) {
                case AppConfig.MODAL_ACTIONS.SWITCH_MODE:
                    AppState.set('currentMode', res.mode);
                    await handleMainView();
                    break;
                case AppConfig.MODAL_ACTIONS.NEXT_STEP:
                    state.selectedCases = res.selectedCases;
                    await handlePersonnelSelection();
                    break;
                case AppConfig.MODAL_ACTIONS.RETRY:
                    await handleMainView();
                    break;
                case AppConfig.MODAL_ACTIONS.CHANGE_TOKEN:
                    await handleTokenChange();
                    break;
                case AppConfig.MODAL_ACTIONS.EDIT_PRESETS:
                    await handlePresetEdit();
                    break;
                case AppConfig.MODAL_ACTIONS.CLOSE:
                default:
                    UIManager.Modal.hide();
                    break;
            }
        }

        async function handleTokenChange() {
            const res = await UIComponents.TokenDialog.show(true);
            if (res?.action === AppConfig.MODAL_ACTIONS.CONFIRM) {
                AppState.set('userToken', res.value);
            }
            await handleMainView();
        }

        async function handlePresetEdit() {
            const res = await UIComponents.PresetDialog.show();
            if (res?.action === AppConfig.MODAL_ACTIONS.BACK_TO_MAIN) {
                await handleMainView();
            }
        }

        async function handlePersonnelSelection() {
            const res = await UIComponents.PersonnelSelectDialog.show({
                selectedCount: state.selectedCases.length,
                defaultUsers: state.assigneeList
            });

            if (res?.action === AppConfig.MODAL_ACTIONS.CONFIRM_ASSIGNMENT) {
                await handleAssignment(res.assignee);
            } else if (res?.action === AppConfig.MODAL_ACTIONS.BACK) {
                await handleMainView();
            } else {
                UIManager.Modal.hide();
            }
        }

        async function handleAssignment(assignee) {
            UIManager.Progress.show(`正在派件 ${state.selectedCases.length} 筆案件給 ${assignee}`);
            try {
                const apiResult = await ApiService.manualAssign(state.selectedCases, assignee);
                UIManager.Progress.hide();
                
                await UIComponents.AssignmentResultDialog.show({
                    successful: apiResult.successful,
                    failed: apiResult.failed,
                    assignee: assignee
                });
                
                if (apiResult.successful.length > 0) {
                    await handleMainView();
                }

            } catch (error) {
                UIManager.Progress.hide();
                const res = await UIComponents.ErrorDialog.show({ error });
                
                if (res?.action === AppConfig.MODAL_ACTIONS.RETRY) {
                    await handleAssignment(assignee);
                } else if (res?.action === AppConfig.MODAL_ACTIONS.BACK) {
                    await handlePersonnelSelection();
                } else {
                    UIManager.Modal.hide();
                }
            }
        }

        return { run };
    })();

    // === 執行 ===
    AppRunner.run();

  } catch (e) {
    console.error('致命錯誤：', e);
    document.getElementById(AppConfig.TOOL_CONTAINER_ID)?.remove();
    document.getElementById('dispatch-mask')?.remove();
    document.getElementById('dispatch-progress')?.remove();
    alert(`腳本發生致命錯誤，請檢查控制台以獲取詳細資訊：\n${e.message}`);
  }
})();