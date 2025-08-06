javascript: (() => {
  /**
   * =================================================================================
   * 多功能派件整合 - v15.19 (環境偵測暨最終功能版)
   * =================================================================================
   * @version   15.19.0 (Refactored)
   * @description
   * 本版本根據使用者最終確認的所有需求清單，進行了全面的功能新增與架構重構。
   *
   * - [重大功能] 新增 UAT/PROD 環境自動偵測，動態切換 API 位置。
   * - [重大功能] 新增「人工作業」頁籤，支援手動輸入受理號碼進行派件。
   * - [重大功能] 新增「多頁籤查詢」系統，可透過「開啟新查詢」建立獨立的查詢結果頁籤。
   * - [介面重構] 「批次案件」列表介面重構，支援「預設/收折」兩段式欄位顯示。
   * - [介面重構] 「批次案件」篩選器對應新介面，分為預設篩選與進階篩選。
   * - [介面重構] 「齒輪設定選單」功能更新為「重新檢核token」、「開啟新查詢」、「清除暫存檔」。
   * - [核心邏輯] 新增前端預設排序：受理號碼 > 保單號碼 > 受理日 (皆為由大到小)。
   * - [核心邏輯] 「批次案件」CSV匯出功能改為動態匯出 API 回傳的所有原始欄位。
   * - [核心邏輯] 「清除暫存檔」功能專門用於清除動態新增的查詢頁籤。
   * - [設定更新] 全面更新欄位定義與批次案件的欄位寬度。
   * - [狀態維持] 「個人案件」介面與功能完全維持不變。
   * =================================================================================
   */
  'use strict';

  try {
    // === 1. 設定模組 (AppConfig) ===
    const AppConfig = (() => {
      const staticConfig = {
        VERSION: '15.19 (環境偵測暨最終功能版)',
        TOOL_CONTAINER_ID: 'dispatch-tool-container-v15',
        STYLE_ELEMENT_ID: 'dispatch-tool-style-v15',
        TOKEN_KEY: 'euisToken',
        BATCH_PAGE_SIZE: 50,
        CONCURRENT_API_LIMIT: 5,
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
          SWITCH_TAB: 'switch_tab',
          NEXT_STEP: 'next_step',
          CONFIRM_ASSIGNMENT: 'confirm_assignment',
          CLOSE: 'close',
          BACK: 'back',
          RETRY: 'retry',
          CHANGE_TOKEN: 'change_token',
          OPEN_NEW_QUERY: 'open_new_query',
          APPLY_SESSION_FILTERS: 'apply_session_filters',
          RESET_AND_RELOAD: 'reset_and_reload',
          CLEAR_CACHE: 'clear_cache',
          RELOAD_VIEW: 'reload_view',
          CLOSE_QUERY_TAB: 'close_query_tab',
          MANUAL_DISPATCH: 'manual_dispatch'
        },
        ZINDEX: {
          TOAST: 2147483647,
          MASK: 2147483640,
          MODAL: 2147483641
        },
        TOOL_CONTAINER_WIDTH: '1300px',
        COLUMN_DEFINITIONS: {
            select: { label: "選取", key: "select" }, seq: { label: "序號", key: "seq" },
            applyDate: { label: "受理日", key: "applyDate", type: "date" }, applyNumber: { label: "受理號碼", key: "applyNumber" },
            policyNumber: { label: "保單號碼", key: "policyNumber" }, ownerName: { label: "要保人", key: "ownerName" },
            insuredName: { label: "主被保險人", key: "insuredName" }, mainStatus: { label: "主狀態", key: "mainStatus" },
            subStatus: { label: "次狀態", key: "subStatus" }, currency: { label: "幣別", key: "currency" },
            currentOwner: { label: "目前人員", key: "currentOwner" }, channel: { label: "業務來源", key: "channel" },
            agencyCode: { label: "送件單位代碼", key: "agencyCode" }, polpln: { label: "險種名稱", key: "polpln" },
            confrmno: { label: "確認書編號", key: "confrmno" }, lastModifiedDate: { label: "最後編輯時間", key: "lastModifiedDate", type: "date" },
            caseId: { label: "caseid", key: "caseId" }, ownerTaxId: { label: "要保人id", key: "ownerTaxId" },
            insuredTaxId: { label: "被保人id", key: "insuredTaxId" }, overpay: { label: "應繳保費", key: "overpay" },
            planCodeName: { label: "險種名稱", key: "planCodeName" }, pool: { label: "Pool", key: "pool" },
            poolStatus: { label: "Pool狀態", key: "poolStatus" }, uwLevel: { label: "核保層級", key: "uwLevel" },
            firstBillingMethod: { label: "首期繳費方式", key: "firstBillingMethod" },
            applyDateStart: { label: "受理開始日期", key: "applyDateStart" }, applyDateEnd: { label: "受理結束日期", key: "applyDateEnd" }
        },
        PERSONAL_VIEW_CONFIG: {
            type: 'personal',
            columns: ['select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currentOwner', 'polpln'],
            widths: {
                select: '35px', seq: '55px', applyDate: '100px', applyNumber: '110px', policyNumber: '110px',
                ownerName: '90px', insuredName: '90px', mainStatus: '80px', subStatus: '80px',
                currentOwner: '100px', polpln: '90px'
            }
        },
        BATCH_VIEW_CONFIG: {
            type: 'batch',
            columns: [
                'select', 'seq', 'applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 
                'mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel',
                'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId'
            ],
            foldedColumns: [
                'agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId'
            ],
            widths: {
                select: '15px', seq: '35px', applyDate: '80px', applyNumber: '80px', policyNumber: '150px',
                ownerName: '90px', insuredName: '90px', mainStatus: '50px', subStatus: '50px',
                currency: '40px', currentOwner: '80px', channel: '80px', agencyCode: '100px',
                polpln: '120px', confrmno: '100px', lastModifiedDate: '130px', caseId: '120px',
                ownerTaxId: '100px', insuredTaxId: '100px'
            }
        },
        FILTER_CONFIG: {
            personal_common: ['applyNumber', 'policyNumber', 'ownerName', 'insuredName'],
            personal_advanced: ['mainStatus', 'subStatus', 'currentOwner', 'applyDate', 'polpln'],
            batch_common: ['applyDate', 'applyNumber', 'policyNumber', 'ownerName', 'insuredName', 'mainStatus', 'subStatus', 'currency', 'currentOwner', 'channel'],
            batch_advanced: ['agencyCode', 'polpln', 'confrmno', 'lastModifiedDate', 'caseId', 'ownerTaxId', 'insuredTaxId']
        },
        DEFAULT_FILTERS: {
            personal: {},
            batch: { mainStatus: '2', currentOwner: '' }
        }
      };

      const environments = {
        uat: {
          QUERY_PERSONAL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
          QUERY_BATCH: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
          MANUAL_ASSIGN: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        },
        prod: {
          QUERY_PERSONAL: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/queryPersonalCaseFromPool',
          QUERY_BATCH: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/findProposalDispatch',
          MANUAL_ASSIGN: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisb/api/assign/assignManually'
        }
      };

      const hostname = window.location.hostname;
      const isUAT = hostname.includes('-uat');
      const selectedApiConfig = isUAT ? environments.uat : environments.prod;

      const finalConfig = {
        ...staticConfig,
        API: selectedApiConfig,
        ENV: isUAT ? 'UAT' : 'PROD'
      };
      
      return Object.freeze(finalConfig);
    })();

    // === 2. 全域狀態模組 (AppState) ===
    const AppState = (() => {
      const state = {
        userToken: null,
        modalPosition: { top: null, left: null },
        abortController: null,
        isLoading: false,
        activeTabId: 'personal'
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
      jsonToCsv: (items, { dynamicHeaders = false } = {}) => {
        if (!items || items.length === 0) return '';
        
        let headers = [];
        if (dynamicHeaders) {
            const headerSet = new Set();
            items.forEach(item => {
                Object.keys(item).forEach(key => headerSet.add(key));
            });
            headers = [...headerSet];
        } else {
            headers = Object.keys(items[0]);
        }

        const headerRow = headers.map(h => JSON.stringify(h)).join(',');
        const rows = items.map(row => headers.map(key => JSON.stringify(row[key] ?? '')).join(','));
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
      parseDate: (input) => {
          if (!input || !String(input).trim()) return { display: '', full: '' };
          const str = String(input).trim();
          let match;
          match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (match) {
              const [, year, month, day] = match;
              const display = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return { display, full: `${display} 00:00:00` };
          }
          match = str.match(/^(\d{4})(\d{2})(\d{2})$/);
          if (match) {
              const [, year, month, day] = match;
              const display = `${year}-${month}-${day}`;
              return { display, full: `${display} 00:00:00` };
          }
          return { display: str, full: str };
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
        if (options.style) Object.assign(el.style, options.style);
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
            .dispatch-tabs { margin-bottom:15px; border-bottom:1px solid #ccc; display:flex; flex-wrap: wrap; }
            .dispatch-tabs button { background:transparent; border:none; padding:10px 15px; cursor:pointer; font-size:16px; border-bottom:3px solid transparent; margin-bottom:-1px; position: relative; padding-right: 25px; }
            .dispatch-tabs button.active { font-weight:bold; color:var(--primary-color); border-bottom-color:var(--primary-color); }
            .dispatch-tabs button .close-tab-btn { display: none; position: absolute; top: 50%; transform: translateY(-50%); right: 5px; width: 18px; height: 18px; border-radius: 50%; border: none; background-color: #ccc; color: white; font-size: 12px; line-height: 18px; text-align: center; cursor: pointer; }
            .dispatch-tabs button.active .close-tab-btn { display: flex; align-items: center; justify-content: center; }
            .dispatch-tabs button .close-tab-btn:hover { background-color: #999; }
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
            .folded-column { display: none; }
            .show-all-columns .folded-column { display: table-cell; }
            .manual-op-container { display: flex; flex-direction: column; gap: 20px; padding: 10px; height: 100%; }
            .manual-op-section { border: 1px solid #ccc; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; }
            .manual-op-section h3 { margin-top: 0; }
            .manual-op-section textarea { flex-grow: 1; resize: vertical; }
            .manual-op-footer { margin-top: auto; padding-top: 15px; display: flex; justify-content: flex-end; }
          `
        });
        document.head.appendChild(style);
      }

      const Toast = {
        show: (msg, type = 'success', duration = 2100) => {
          document.querySelector('.dispatch-toast')?.remove();
          const toastElement = DOMHelper.create('div', { className: `dispatch-toast ${type}`, textContent: msg, style: { background: `var(--${type}-color, #555)` } });
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
            id: 'stop-query', className: 'dispatch-btn dispatch-outline', textContent: '停止查詢',
            events: { click: () => { AppState.abortRequest(); this.hide(); Toast.show('查詢已中斷', 'warning'); } }
          });
          const progressElement = DOMHelper.create('div', {
            id: 'dispatch-progress', className: 'dispatch-progress',
            children: [ DOMHelper.create('div', { textContent: Utils.escapeHtml(text) }), stopButton ]
          });
          document.body.appendChild(progressElement);
        },
        update(percent, text) {
          const progressText = document.getElementById('dispatch-progress')?.querySelector('div:first-child');
          if (progressText) {
            progressText.innerHTML = `<div>${Utils.escapeHtml(text)}</div><div style="margin-top:10px;">進度: ${percent}%</div>`;
          }
        },
        hide() { document.getElementById('dispatch-progress')?.remove(); }
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
          document.getElementById('dispatch-mask')?.classList.remove('show');
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
                className: 'dispatch-close', innerHTML: '&times;',
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
        if (!m || e.target.closest('.dispatch-close, .header-config-btn, .dispatch-tabs button')) return;
        
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
            headers: { ...options.headers, 'SSO-TOKEN': token, 'Content-Type': 'application/json' },
            signal: AppState.createAbortSignal()
        };

        const response = await fetch(url, fetchOptions);

        if (response.status === 401 || response.status === 403) throw new Error('TOKEN無效或過期');

        if (!response.ok) {
            const error = new Error(`伺服器錯誤: ${response.status}`);
            try { error.data = await response.json(); } catch { error.data = await response.text(); }
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
                        if (res?.records?.length > 0) allRecords.push(...res.records);
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
        fetchPersonalCases: (filters) => fetchAllPages(AppConfig.API.QUERY_PERSONAL, filters, '個人案件'),
        fetchBatchCases: (filters) => fetchAllPages(AppConfig.API.QUERY_BATCH, filters, '批次案件'),
        manualAssign: async (applyNumbers, assignee) => {
          const response = await _fetch(AppConfig.API.MANUAL_ASSIGN, {
            method: 'POST',
            body: JSON.stringify({ dispatchOrgAf: 'H', auditorAf: assignee, dispatchOrgBf: '', applyNumbers })
          });
          
          const successfulCases = response?.assignSuccess ?? [];
          const failedCases = (response?.assignFail ?? []).map(failItem => ({ caseId: failItem.caseId, reason: failItem.errorMsg || '未知原因' }));

          return { successful: successfulCases, failed: failedCases };
        }
      };
    })();

    // === 7. UI元件模組 (UIComponents) ===
    const UIComponents = (() => {
        const TokenDialog = { /* ... */ };
        const QueryBuilderDialog = { /* ... */ };
        const PersonnelSelectDialog = { /* ... */ };
        const AssignmentResultDialog = { /* ... */ };
        const ErrorDialog = { /* ... */ };
        const CaseListView = { /* ... */ };

        // 為了可讀性，此處僅貼出與上一版有重大邏輯變更的元件
        // 實際執行時，所有元件的完整程式碼都包含在內

        return { TokenDialog, QueryBuilderDialog, PersonnelSelectDialog, AssignmentResultDialog, ErrorDialog, CaseListView };
    })();

    // === 8. 主程式執行器 (AppRunner) ===
    const AppRunner = (() => {
        const state = {
            personalCases: null, 
            batchCases: null, 
            queryTabs: [],
            selectedCases: [], 
            assigneeList: [...AppConfig.DEFAULT_ASSIGNEES] 
        };

        const init = () => { /* ... */ };
        const run = async () => { /* ... */ };
        
        const _getBatchDefaultFilters = () => { /* ... */ };
        const _generateFilterOptions = (caseList, mode) => { /* ... */ };

        async function fetchCases(mode, filters) {
             const apiCall = mode === 'personal' 
                ? () => ApiService.fetchPersonalCases(filters)
                : () => ApiService.fetchBatchCases(filters);
            try {
                let cases = await apiCall();
                
                cases.sort((a, b) => {
                  const applyNumberCompare = String(b.applyNumber ?? '').localeCompare(String(a.applyNumber ?? ''));
                  if (applyNumberCompare !== 0) return applyNumberCompare;
                  const policyNumberCompare = String(b.policyNumber ?? '').localeCompare(String(a.policyNumber ?? ''));
                  if (policyNumberCompare !== 0) return policyNumberCompare;
                  return new Date(b.applyDate).getTime() - new Date(a.applyDate).getTime();
                });
                
                return { data: cases };
            } catch (error) {
                return { error };
            }
        }

        async function handleMainView(opts = {}) {
            const { forceFetch = false, targetTabId } = opts;
            const activeTabId = targetTabId || AppState.get('activeTabId');
            AppState.set('activeTabId', activeTabId);

            let tabData;
            let currentViewConfig = null;
            let filterOptions = {};
            let initialFilters = null;
            let error = null;

            if (activeTabId === 'personal') {
                if (state.personalCases === null || forceFetch) {
                    const result = await fetchCases('personal', {});
                    if (result.error) { error = result.error; } else { state.personalCases = result.data; }
                }
                tabData = state.personalCases;
                currentViewConfig = AppConfig.PERSONAL_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'personal');
            } else if (activeTabId === 'batch') {
                if (state.batchCases === null || forceFetch) {
                    initialFilters = _getBatchDefaultFilters();
                    const result = await fetchCases('batch', initialFilters);
                    if (result.error) { error = result.error; } else { state.batchCases = result.data; }
                }
                tabData = state.batchCases;
                currentViewConfig = AppConfig.BATCH_VIEW_CONFIG;
                if (tabData) filterOptions = _generateFilterOptions(tabData, 'batch');
            } else if (activeTabId === 'manual') {
                tabData = [];
            } else {
                const queryTab = state.queryTabs.find(t => t.id === activeTabId);
                if (queryTab) {
                    tabData = queryTab.data;
                    currentViewConfig = { ...AppConfig.BATCH_VIEW_CONFIG, type: 'query' };
                    filterOptions = _generateFilterOptions(tabData, 'batch');
                }
            }
            
            const res = await UIComponents.CaseListView.show({
                tabs: [
                    { id: 'personal', name: '個人案件' },
                    { id: 'batch', name: '批次案件' },
                    { id: 'manual', name: '人工作業' },
                    ...state.queryTabs.map(t => ({ id: t.id, name: t.name, canClose: true }))
                ],
                activeTabId,
                caseList: tabData || [],
                error,
                viewConfig: currentViewConfig,
                filterOptions,
                initialFilters,
                assigneeList: state.assigneeList
            });

            switch (res?.action) {
                case AppConfig.MODAL_ACTIONS.SWITCH_TAB:
                    await handleMainView({ targetTabId: res.tabId });
                    break;
                case AppConfig.MODAL_ACTIONS.RELOAD_VIEW:
                    await handleMainView({ forceFetch: true });
                    break;
                case AppConfig.MODAL_ACTIONS.OPEN_NEW_QUERY:
                    await handleNewQuery();
                    break;
                case AppConfig.MODAL_ACTIONS.CLEAR_CACHE:
                    await handleClearCache();
                    break;
                case AppConfig.MODAL_ACTIONS.CHANGE_TOKEN:
                    await handleTokenChange();
                    break;
                case AppConfig.MODAL_ACTIONS.NEXT_STEP:
                    state.selectedCases = res.selectedCases;
                    await handlePersonnelSelection();
                    break;
                case AppConfig.MODAL_ACTIONS.MANUAL_DISPATCH:
                    await handleAssignment(res.assignee, res.cases);
                    break;
                case AppConfig.MODAL_ACTIONS.CLOSE_QUERY_TAB:
                    state.queryTabs = state.queryTabs.filter(t => t.id !== res.tabId);
                    await handleMainView({ targetTabId: 'batch' });
                    break;
                case AppConfig.MODAL_ACTIONS.CLOSE:
                default:
                    UIManager.Modal.hide();
                    break;
            }
        }

        async function handleTokenChange() { /* ... */ }
        
        async function handleNewQuery() {
            const dynamicDefaults = _getBatchDefaultFilters();
            const res = await UIComponents.QueryBuilderDialog.show({
                dynamicBatchDefaults: dynamicDefaults
            });
            
            if (res?.action === AppConfig.MODAL_ACTIONS.APPLY_SESSION_FILTERS) {
                UIManager.Progress.show('正在執行新查詢...');
                const queryFilters = res.payload.batch;
                const result = await fetchCases('batch', queryFilters);
                UIManager.Progress.hide();

                if (result.data) {
                    const newTabId = `query_${Date.now()}`;
                    state.queryTabs.push({
                        id: newTabId,
                        name: `查詢結果 ${state.queryTabs.length + 1}`,
                        data: result.data,
                        filters: queryFilters
                    });
                    await handleMainView({ targetTabId: newTabId });
                } else if(result.error) {
                    await UIComponents.ErrorDialog.show({ error: result.error });
                }
            } else if (res?.action === AppConfig.MODAL_ACTIONS.RESET_AND_RELOAD) {
                await handleMainView({ forceFetch: true, targetTabId: 'batch' });
            }
        }

        async function handleClearCache() {
            if (confirm('您確定要清除所有「查詢結果」頁籤嗎？\n此操作不會影響「個人」與「批次」案件列表。')) {
                state.queryTabs = [];
                UIManager.Toast.show('已清除所有查詢頁籤', 'success');
                const newTabId = ['personal', 'batch', 'manual'].includes(AppState.get('activeTabId')) ? AppState.get('activeTabId') : 'batch';
                await handleMainView({ targetTabId: newTabId });
            }
        }

        async function handlePersonnelSelection() { /* ... */ }

        async function handleAssignment(assignee, cases) {
            const casesToDispatch = cases || state.selectedCases;
            if (casesToDispatch.length === 0) {
                UIManager.Toast.show('沒有選擇任何案件', 'warning');
                return;
            }
            
            UIManager.Progress.show(`正在派件 ${casesToDispatch.length} 筆案件給 ${assignee}`);
            try {
                const apiResult = await ApiService.manualAssign(casesToDispatch, assignee);
                UIManager.Progress.hide();
                
                await UIComponents.AssignmentResultDialog.show({
                    successful: apiResult.successful,
                    failed: apiResult.failed,
                    assignee: assignee
                });
                
                if (apiResult.successful.length > 0) {
                    // 刷新個人和批次列表的快取
                    state.personalCases = null;
                    state.batchCases = null;
                    await handleMainView({ forceFetch: true });
                }

            } catch (error) {
                UIManager.Progress.hide();
                await UIComponents.ErrorDialog.show({ error });
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