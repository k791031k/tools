javascript: (() => {
  /**
   * =================================================================================
   * 多功能派件整合 - v15.14 (綜合需求更新版)
   * =================================================================================
   * @version   15.14.0 (Refactored)
   * @description
   * 本版本根據使用者最終確認的需求清單，進行了全面的功能新增與調整。
   *
   * - [功能] 篩選條件從文字輸入改為動態資料下拉選單。
   * - [功能] 新增「重新整理」按鈕，可重新載入當前列表。
   * - [功能] 批次案件查詢加入 T-10 至 T 的預設日期條件，並顯示於畫面上。
   * - [功能] TOKEN 驗證視窗新增「自動檢核」功能。
   * - [優化] 派發結果通知新增總派發件數資訊。
   * - [調整] 主視窗寬度調整為 1300px，「序號」欄位加寬。
   * - [調整] 篩選防抖延遲時間調整為 800ms。
   * =================================================================================
   */
  'use strict';

  try {
    // === 1. 設定模組 (AppConfig) ===
    const AppConfig = Object.freeze({
      VERSION: '15.14 (綜合需求更新版)',
      TOOL_CONTAINER_ID: 'dispatch-tool-container-v15',
      STYLE_ELEMENT_ID: 'dispatch-tool-style-v15',
      TOKEN_KEY: 'euisToken',
      PRESETS_KEY: 'dispatchPresets_v4',
      BATCH_PAGE_SIZE: 50,
      CONCURRENT_API_LIMIT: 5,
      // [調整] 防抖延遲時間調整為 800ms
      DEBOUNCE_DELAY: 800,
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
        BACK_TO_MAIN: 'back_to_main',
        // [新增] 重新整理畫面的動作
        RELOAD_VIEW: 'reload_view'
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
      // [調整] 主視窗寬度調整為 1300px
      TOOL_CONTAINER_WIDTH: '1300px',
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
          // [調整] 序號欄位寬度增加 20px
          select: '35px', seq: '55px', applyDate: '100px', applyNumber: '110px', policyNumber: '110px',
          ownerName: '90px', insuredName: '90px', mainStatus: '80px', subStatus: '80px',
          currentOwner: '100px', polpln: '90px'
        }
      },
      BATCH_VIEW_CONFIG: {
        columns: ['select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currentOwner'],
        widths: {
          // [調整] 序號欄位寬度增加 20px
          select: '35px', seq: '55px', applyDate: '100px', applyNumber: '110px', policyNumber: '110px',
          ownerName: '90px', insuredName: '90px', mainStatus: '80px', subStatus: '80px',
          currentOwner: '100px'
        }
      },
      FILTER_CONFIG: {
        common: ['applyNumber', 'policyNumber', 'ownerName', 'insuredName'],
        personal_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDate', 'polpln'],
        batch_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDateStart', 'applyDateEnd', 'pool', 'poolStatus', 'uwLevel']
      },
      EXPORT_COLUMN_KEYS: [
        'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus',
        'currentOwner', 'applyDate', 'polpln', 'planCodeName', 'pool', 'poolStatus',
        'uwLevel', 'channel', 'firstBillingMethod', 'agencyCode'
      ],
      DEFAULT_FILTERS: {
        personal: {},
        // [調整] 批次案件的預設值改為在 AppRunner 中動態生成
        batch: {
          mainStatus: '2',
          currentOwner: ''
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
        const headerRow = columnKeys.map(key => JSON.stringify(definitions[key]?.label ?? key)).join(',');
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
      formatDateTime: (date) => {
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        return `${Y}-${M}-${D} 00:00:00`;
      },
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
            .filter-controls { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px 15px; margin-bottom:10px; }
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
            .dispatch-body .controls-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
            .dispatch-body .controls-row .right-controls { display:flex; gap:8px; align-items:center; }
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
        // [調整] TokenDialog 現在支持 'revalidate' 模式
        const TokenDialog = {
            show: (opts = {}) => {
                const { mode } = opts;
                const isRevalidateMode = mode === 'revalidate';

                return UIManager.Modal.show({
                    header: '請輸入 SSO-TOKEN',
                    width: '450px',
                    body: DOMHelper.create('div', {
                        className: 'dispatch-body',
                        children: [
                            DOMHelper.create('p', { textContent: '請從 EUIS 系統的 local/session Storage 取得您的 SSO-TOKEN 並貼在下方。', style: { marginTop: '0' } }),
                            DOMHelper.create('textarea', { id: 'token-input', className: 'dispatch-input', attributes: { rows: '4' }, style: { fontFamily: 'monospace' } })
                        ]
                    }),
                    footer: DOMHelper.create('div', {
                        className: 'dispatch-footer',
                        style: { justifyContent: isRevalidateMode ? 'space-between' : 'flex-end', padding: '12px 20px 16px' },
                        children: [
                            ...(isRevalidateMode ? [DOMHelper.create('button', { id: 'auto-check-btn', className: 'dispatch-btn dispatch-outline', textContent: '自動檢核' })] : []),
                            DOMHelper.create('button', { id: 'confirm-token-btn', className: 'dispatch-btn', textContent: '確認' })
                        ]
                    }),
                    onOpen: (modal, resolve) => {
                        const tokenInput = modal.querySelector('#token-input');
                        
                        if (isRevalidateMode) {
                            modal.querySelector('#auto-check-btn').onclick = () => {
                                const storedToken = Utils.getStoredToken();
                                if (storedToken) {
                                    tokenInput.value = storedToken;
                                    UIManager.Toast.show('已自動填入 Token', 'success');
                                } else {
                                    UIManager.Toast.show('在瀏覽器中未找到 Token', 'warning');
                                }
                            };
                        }
                        
                        modal.querySelector('#confirm-token-btn').onclick = () => {
                            const value = tokenInput.value.trim();
                            if (value) resolve({ action: AppConfig.MODAL_ACTIONS.CONFIRM, value });
                            else UIManager.Toast.show('Token 不可為空', 'error');
                        };
                    }
                });
            }
        };
        
        const PresetDialog = { /* ... 保持不變 ... */ };
        
        const PersonnelSelectDialog = {
            show: (opts) => {
                const { selectedCount, defaultUsers } = opts;
                const body = DOMHelper.create('div', { /* ... 保持不變 ... */ });
                const footer = DOMHelper.create('div', { /* ... 保持不變 ... */ });

                return UIManager.Modal.show({
                    header: '選擇指派人員',
                    width: '450px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => {
                        const selectEl = modal.querySelector('#assignee-select');
                        let currentPersonnelList = [...defaultUsers];

                        const populateSelect = (list) => { /* ... 保持不變 ... */ };
                        const updateConfirmBtnState = () => { /* ... 保持不變 ... */ };
                        const handleImport = async () => { /* ... 保持不變 ... */ };
                        
                        // ... 事件綁定保持不變 ...
                    }
                });
            }
        };

        // [調整] AssignmentResultDialog 新增總案件數顯示
        const AssignmentResultDialog = {
            show: ({ successful, failed, assignee }) => {
                const hasFailures = failed.length > 0;
                const totalCount = successful.length + failed.length;
                
                const bodyChildren = [
                    DOMHelper.create('p', { innerHTML: `已完成對 <strong>${Utils.escapeHtml(assignee)}</strong> 的派件操作。`}),
                    DOMHelper.create('p', { 
                        innerHTML: `派發總案件數: ${totalCount} 筆`,
                        style: { fontWeight: 'bold' }
                    }),
                    DOMHelper.create('p', { 
                        innerHTML: `成功 ${successful.length} 筆，失敗 ${failed.length} 筆。`,
                        style: { color: hasFailures ? 'var(--warning-color)' : 'var(--success-color)' }
                    })
                ];

                if (failed.length > 0) { /* ... 保持不變 ... */ }
                if (successful.length > 0 && failed.length > 0) { /* ... 保持不變 ... */ }
                
                const body = DOMHelper.create('div', { className: 'dispatch-body', children: bodyChildren });
                const footer = DOMHelper.create('div', { /* ... 保持不變 ... */ });

                return UIManager.Modal.show({
                    header: hasFailures ? '派件部分成功' : '派件成功',
                    width: '500px',
                    body,
                    footer,
                    onOpen: (modal, resolve) => { /* ... 保持不變 ... */ }
                });
            }
        };

        const ErrorDialog = { /* ... 保持不變 ... */ };

        // [調整] CaseListView 改為接收 filterOptions 和 initialFilters
        const CaseListView = { show: async (opts) => {
            const { caseList, error, mode, viewConfig, filterOptions, initialFilters } = opts;
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
            
            function _renderTable(data) { /* ... 保持不變 ... */ }
            function _updateNextButton() { /* ... 保持不變 ... */ }

            const _applyFiltersAndSort = Utils.debounce(() => {
                const filterValues = {};
                elements.filterSelects.forEach(select => {
                    const key = select.id.replace('filter-', '');
                    if (select.value) {
                        filterValues[key] = select.value;
                    }
                });

                let filteredData = caseList.filter(item => 
                    Object.entries(filterValues).every(([key, value]) => {
                        const itemValue = String(item[key] ?? '');
                        // 對於日期，我們只比對日期部分，忽略時間
                        if (key.toLowerCase().includes('date')) {
                            return itemValue.startsWith(value.split(' ')[0]);
                        }
                        return itemValue === value;
                    })
                );

                // ... 排序邏輯保持不變 ...
                
                currentData = filteredData;
                _renderTable(currentData);
            }, AppConfig.DEBOUNCE_DELAY);

            function _createHeader() { /* ... 保持不變 ... */ }

            function _createBody() {
                const createFilterControls = () => {
                    const config = AppConfig.FILTER_CONFIG;
                    const filterKeys = mode === 'personal' ? [...config.common, ...config.personal_advanced] : [...config.common, ...config.batch_advanced];
                    
                    const renderSelect = (key) => {
                        const def = AppConfig.COLUMN_DEFINITIONS[key];
                        if (!def) return null;

                        const options = filterOptions[key] || [];
                        const select = DOMHelper.create('select', { 
                            id: `filter-${key}`, 
                            className: 'dispatch-input filter-select',
                            attributes: { ...(isErrorState && { disabled: true }) },
                            children: [
                                DOMHelper.create('option', { textContent: '全部', attributes: { value: '' } }),
                                ...options.map(opt => DOMHelper.create('option', { textContent: opt, attributes: { value: opt } }))
                            ]
                        });
                        
                        // 設定預設值
                        if (initialFilters && initialFilters[key]) {
                            select.value = initialFilters[key];
                        }
                        
                        return DOMHelper.create('div', { children: [
                            DOMHelper.create('label', { textContent: def.label, style: { fontSize: '14px', display: 'block', textAlign: 'left' } }),
                            select
                        ]});
                    };

                    const commonSelects = config.common.map(renderSelect).filter(Boolean);
                    const advancedSelects = (mode === 'personal' ? config.personal_advanced : config.batch_advanced).map(renderSelect).filter(Boolean);
                    
                    return [
                        DOMHelper.create('div', { className: 'filter-controls', children: commonSelects }),
                        DOMHelper.create('div', { className: 'filter-controls advanced-filters', children: advancedSelects })
                    ];
                };

                return DOMHelper.create('div', {
                    className: 'dispatch-body',
                    children: [
                        DOMHelper.create('div', { className: 'dispatch-tabs', /* ... */ }),
                        ...createFilterControls(),
                        DOMHelper.create('div', { className: 'controls-row', children: [
                            DOMHelper.create('span', { id: 'case-count', style: { fontSize: '14px' } }),
                            DOMHelper.create('div', { className: 'right-controls', children: [
                                DOMHelper.create('button', { id: 'toggle-filters-btn', className: 'dispatch-btn dispatch-outline small', textContent: '顯示更多篩選條件' }),
                                DOMHelper.create('button', { id: 'export-csv-btn', className: 'dispatch-btn small', textContent: '匯出CSV', attributes: { ...(isErrorState && { disabled: true }) } }),
                                // [新增] 重新整理按鈕
                                DOMHelper.create('button', { id: 'reload-view-btn', className: 'dispatch-btn small', textContent: '重新整理', title: '重新載入案件列表' }),
                                DOMHelper.create('button', { id: 'retry-fetch-btn', className: 'dispatch-btn small', textContent: '重新載入', style: { display: isErrorState ? 'inline-flex' : 'none' } })
                            ]})
                        ]}),
                        DOMHelper.create('div', { id: 'case-table-container', /* ... */ })
                    ]
                });
            }

            function _createFooter() { /* ... 保持不變 ... */ }
            
            function _bindEvents(resolve) {
                elements.resolve = resolve;
                // ...
                _bindFilterEvents();
                // ...
            }
            
            function _bindFilterEvents() {
                // ...
                // [新增] 重新整理按鈕事件
                elements.modal.querySelector('#reload-view-btn').onclick = () => elements.resolve({ action: AppConfig.MODAL_ACTIONS.RELOAD_VIEW });

                if (!isErrorState) {
                    elements.filterSelects.forEach(select => { select.onchange = _applyFiltersAndSort; });
                }
            }

            return UIManager.Modal.show({
                header,
                body,
                footer,
                width: AppConfig.TOOL_CONTAINER_WIDTH,
                onOpen: (modal, resolve) => {
                    elements = {
                        modal, resolve,
                        tbody: modal.querySelector('tbody'),
                        table: modal.querySelector('#case-table'),
                        countElem: modal.querySelector('#case-count'),
                        nextBtn: modal.querySelector('#next-step-btn'),
                        filterSelects: modal.querySelectorAll('.filter-select')
                    };
                    
                    _bindEvents(resolve);
                    _renderTable(currentData);
                    // 初始觸發一次篩選，以應用預設值
                    if (mode === 'batch') {
                        _applyFiltersAndSort();
                    }
                }
            });
        }}

        return { TokenDialog, PresetDialog, PersonnelSelectDialog, AssignmentResultDialog, ErrorDialog, CaseListView };
    })();

    // === 8. 主程式執行器 (AppRunner) ===
    const AppRunner = (() => {
        const state = { /* ... */ };

        const init = () => { /* ... */ };

        const run = async () => { /* ... */ };
        
        // [新增] 獲取批次案件預設篩選條件
        const _getBatchDefaultFilters = () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 10);
            
            return {
                ...AppConfig.DEFAULT_FILTERS.batch,
                applyDateStart: Utils.formatDateTime(startDate),
                applyDateEnd: Utils.formatDateTime(endDate)
            };
        };
        
        // [新增] 從案件列表中產生篩選選項
        const _generateFilterOptions = (caseList) => {
            const options = {};
            const filterKeys = new Set([...AppConfig.FILTER_CONFIG.common, ...AppConfig.FILTER_CONFIG.personal_advanced, ...AppConfig.FILTER_CONFIG.batch_advanced]);
            
            filterKeys.forEach(key => {
                const uniqueValues = new Set(caseList.map(item => item[key]).filter(Boolean));
                options[key] = [...uniqueValues].sort();
            });
            return options;
        };

        async function fetchCases(mode, filters) {
             // ...
             const apiCall = mode === 'personal' 
                ? () => ApiService.fetchPersonalCases(filters)
                : () => ApiService.fetchBatchCases(filters);

            // ...
        }

        async function handleMainView() {
            const mode = AppState.get('currentMode');
            let initialFilters = null;
            let apiPayload = {};

            if (mode === 'batch') {
                initialFilters = _getBatchDefaultFilters();
                apiPayload = { ...initialFilters };
            }

            const result = await fetchCases(mode, apiPayload);
            const filterOptions = result.data ? _generateFilterOptions(result.data) : {};
            
            const res = await UIComponents.CaseListView.show({
                caseList: result.data,
                error: result.error,
                viewConfig: mode === 'personal' ? AppConfig.PERSONAL_VIEW_CONFIG : AppConfig.BATCH_VIEW_CONFIG,
                mode: mode,
                filterOptions: filterOptions,
                initialFilters: initialFilters
            });

            switch (res?.action) {
                // ...
                // [新增] 處理重新整理動作
                case AppConfig.MODAL_ACTIONS.RELOAD_VIEW:
                    await handleMainView();
                    break;
                case AppConfig.MODAL_ACTIONS.CHANGE_TOKEN:
                    await handleTokenChange();
                    break;
                // ...
            }
        }

        async function handleTokenChange() {
            // [調整] 呼叫 TokenDialog 時傳入模式
            const res = await UIComponents.TokenDialog.show({ mode: 'revalidate' });
            if (res?.action === AppConfig.MODAL_ACTIONS.CONFIRM) {
                AppState.set('userToken', res.value);
            }
            await handleMainView();
        }

        async function handlePersonnelSelection() { /* ... */ };

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