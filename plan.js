javascript:(function() {
  'use strict';

  /**
   * ===================================================================
   * 商品查詢小工具 v19.0.0 (最終機能完全版)
   *
   * @version 19.0.0
   * @description
   * - [架構] 實作通路查詢的反向載入邏輯。
   * - [功能] 整合POLPLN加工計算、單筆重查、Token略過等所有確認功能。
   * - [UI] 套用最終版的欄位配置、樣式、名稱與互動體驗。
   * - [修正] 解決表格更新閃爍問題並完善所有UI細節。
   * ===================================================================
   */

  // 清理舊工具實例
  (() => {
    ['planCodeQueryToolInstance', 'planCodeToolStyle', 'pctModalMask'].forEach(id => document.getElementById(id)?.remove());
    document.querySelectorAll('.pct-toast').forEach(el => el.remove());
  })();

  /**
   * ========================================================
   * 模組 1：配置管理 (ConfigModule)
   * ========================================================
   */
  const ConfigModule = Object.freeze({
    TOOL_ID: 'planCodeQueryToolInstance',
    STYLE_ID: 'planCodeToolStyle',
    VERSION: '19.0.0-Final-Release',
    QUERY_MODES: {
      PLAN_CODE: 'planCode',
      PLAN_NAME: 'planCodeName',
      MASTER_CLASSIFIED: 'masterClassified',
      CHANNEL_CLASSIFIED: 'channelClassified'
    },
    MASTER_STATUS_TYPES: {
      IN_SALE: '現售',
      STOPPED: '停售',
      PENDING: '尚未開賣',
      ABNORMAL: '日期異常'
    },
    API_ENDPOINTS: {
      UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
      PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api'
    },
    FIELD_MAPS: {
      CURRENCY: {'1':'TWD','2':'USD','3':'AUD','4':'CNT','5':'USD_OIU','6':'EUR','7':'JPY'},
      UNIT: {'A1':'元','A3':'仟元','A4':'萬元','B1':'計畫','C1':'單位'},
      COVERAGE_TYPE: {'M':'主約','R':'附約'},
      CHANNELS: ['AG','BR','BK','WS','EC']
    },
    DEFAULT_QUERY_PARAMS: { PAGE_SIZE_MASTER: 10000, PAGE_SIZE_CHANNEL: 5000, PAGE_SIZE_DETAIL: 50, PAGE_SIZE_TABLE: 50 },
    DEBOUNCE_DELAY: { SEARCH: 1000 },
    BATCH_SIZES: { MULTI_CODE_QUERY: 10 }
  });

  /**
   * ========================================================
   * 模組 2：狀態管理 (StateModule)
   * ========================================================
   */
  const StateModule = (() => {
    const state = {
      env: (window.location.host.toLowerCase().includes('uat') || window.location.host.toLowerCase().includes('test')) ? 'UAT' : 'PROD',
      apiBase: '', token: '', tokenCheckEnabled: true,
      queryMode: '', queryInput: '', masterStatusSelection: new Set(), channelStatusSelection: '', channelSelection: new Set(),
      allProcessedData: [], pageNo: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_TABLE,
      isFullView: false, filterSpecial: false, searchKeyword: '', sortKey: 'no', sortAsc: true,
      activeFrontendFilters: new Set(),
      cacheDetail: new Map(), cacheChannel: new Map(), cacheProduct: new Map(),
      currentQueryController: null, searchDebounceTimer: null
    };
    state.apiBase = state.env === 'PROD' ? ConfigModule.API_ENDPOINTS.PROD : ConfigModule.API_ENDPOINTS.UAT;
    const get = () => state;
    const set = (newState) => { Object.assign(state, newState); };
    const resetQueryState = () => {
      set({ allProcessedData: [], pageNo: 1, filterSpecial: false, searchKeyword: '', isFullView: false, activeFrontendFilters: new Set() });
      state.cacheDetail.clear(); state.cacheChannel.clear(); state.cacheProduct.clear();
    };
    return { get, set, resetQueryState };
  })();

  /**
   * ========================================================
   * 模組 3：通用工具函式庫 (UtilsModule)
   * ========================================================
   */
  const UtilsModule = (() => {
    const escapeHtml = t => typeof t === 'string' ? t.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : t;
    const formatToday = () => { const d = new Date(); return `${d.getFullYear()}${('0'+(d.getMonth()+1)).slice(-2)}${('0'+d.getDate()).slice(-2)}`; };
    const formatDateForUI = dt => !dt ? '' : String(dt).split(' ')[0].replace(/-/g, '');
    const formatDateForComparison = dt => { if (!dt) return ''; const p = String(dt).split(' ')[0]; return /^\d{8}$/.test(p) ? p.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : p; };
    const getSaleStatus = (todayStr, saleStartStr, saleEndStr) => {
        if (!saleStartStr || !saleEndStr) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        const today = new Date(formatDateForComparison(todayStr)), sS = new Date(formatDateForComparison(saleStartStr)), sE = new Date(formatDateForComparison(saleEndStr));
        if (isNaN(today.getTime()) || isNaN(sS.getTime()) || isNaN(sE.getTime())) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        if (sS.getTime() > sE.getTime()) return ConfigModule.MASTER_STATUS_TYPES.ABNORMAL;
        if (today < sS) return ConfigModule.MASTER_STATUS_TYPES.PENDING;
        if (today > sE) return ConfigModule.MASTER_STATUS_TYPES.STOPPED;
        return ConfigModule.MASTER_STATUS_TYPES.IN_SALE;
    };
    const checkSpecialStatus = item => {
        const reasons = [];
        const mainStatus = item.mainStatus;
        const channels = item.channels || [];
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.STOPPED && channels.some(c => c.status === ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約已停售，但部分通路仍在售。'); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.IN_SALE && channels.length > 0 && channels.every(c => c.status !== ConfigModule.MASTER_STATUS_TYPES.IN_SALE)) { reasons.push('主約為現售，但所有通路皆非現售狀態。'); }
        const mainEndDate = new Date(formatDateForComparison(item.rawSaleEndDate));
        if (!isNaN(mainEndDate.getTime())) { channels.forEach(c => { const channelEndDate = new Date(formatDateForComparison(c.rawEnd)); if (!isNaN(channelEndDate.getTime()) && channelEndDate > mainEndDate) { reasons.push(`通路[${c.channel}]迄日(${c.saleEndDate})晚於主約迄日(${item.saleEndDate})。`); } }); }
        const mainStartDate = new Date(formatDateForComparison(item.rawSaleStartDate));
        if (!isNaN(mainStartDate.getTime())) { channels.forEach(c => { const channelStartDate = new Date(formatDateForComparison(c.rawStart)); if (!isNaN(channelStartDate.getTime()) && channelStartDate < mainStartDate) { reasons.push(`通路[${c.channel}]起日(${c.saleStartDate})早於主約起日(${item.saleStartDate})。`); } }); }
        if (mainStatus === ConfigModule.MASTER_STATUS_TYPES.ABNORMAL) { reasons.push('主約本身的銷售起迄日期異常(起日>迄日)。'); }
        return reasons.join('\n');
    };
    const channelUIToAPI = c => c === 'BK' ? 'OT' : c, channelAPIToUI = c => c === 'OT' ? 'BK' : c;
    const currencyConvert = v => ConfigModule.FIELD_MAPS.CURRENCY[String(v)] || v || '', unitConvert = v => ConfigModule.FIELD_MAPS.UNIT[String(v)] || v || '', coverageTypeConvert = v => ConfigModule.FIELD_MAPS.COVERAGE_TYPE[String(v)] || v || '';
    const copyTextToClipboard = (t, showToast) => { if (!navigator.clipboard) { const e = document.createElement('textarea'); e.value = t; document.body.appendChild(e); e.select(); document.execCommand('copy'); document.body.removeChild(e); showToast('已複製 (舊版)', 'success'); } else { navigator.clipboard.writeText(t).then(() => showToast('已複製', 'success')).catch(() => showToast('複製失敗', 'error')); } };
    const splitInput = i => i.trim().split(/[\s,;，；、|\n\r]+/).filter(Boolean);
    const toHalfWidthUpperCase = str => str.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).toUpperCase();
    return { escapeHtml, formatToday, formatDateForUI, formatDateForComparison, getSaleStatus, checkSpecialStatus, channelUIToAPI, channelAPIToUI, currencyConvert, unitConvert, coverageTypeConvert, copyTextToClipboard, splitInput, toHalfWidthUpperCase };
  })();

  /**
   * ========================================================
   * 模組 4：UI 介面管理器 (UIModule)
   * ========================================================
   */
  const UIModule = (() => {
    const injectStyle = () => {
      const s = document.createElement('style'); s.id = ConfigModule.STYLE_ID;
      s.textContent = `
        :root{--primary-color:#4A90E2;--primary-dark-color:#357ABD;--secondary-color:#6C757D;--secondary-dark-color:#5A6268;--success-color:#28a745;--success-dark-color:#218838;--error-color:#dc3545;--error-dark-color:#c82333;--warning-color:#ffc107;--warning-dark-color:#e0a800;--info-color:#17a2b8;--info-dark-color:#138496;--background-light:#f8f9fa;--surface-color:#FFFFFF;--border-color:#dee2e6;--text-color-dark:#212529;--text-color-light:#495057;--box-shadow-light:rgba(0,0,0,0.08);--box-shadow-medium:rgba(0,0,0,0.15);--box-shadow-strong:rgba(0,0,0,0.3);--border-radius-base:6px;--border-radius-lg:10px;--transition-speed:0.25s;}
        .pct-modal-mask{position:fixed;z-index:2147483646;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.25);opacity:0;transition:opacity var(--transition-speed) ease-out;}
        .pct-modal-mask.show{opacity:1;}
        .pct-modal{font-family:'Microsoft JhengHei','Segoe UI','Roboto','Helvetica Neue',sans-serif;background:var(--surface-color);border-radius:var(--border-radius-lg);box-shadow:0 4px 24px var(--box-shadow-strong);padding:0;max-width:95vw;position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);opacity:0;z-index:2147483647;transition:opacity var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1),transform var(--transition-speed) cubic-bezier(0.25,0.8,0.25,1);display:flex;flex-direction:column;}
        .pct-modal[data-size="query"] { width: 520px; }
        .pct-modal[data-size="results"] { width: 1050px; }
        .pct-modal.show{opacity:1;transform:translateX(-50%) translateY(0);}
        .pct-modal.dragging{transition:none;}
        .pct-modal-header{padding:16px 50px 8px 20px;font-size:20px;font-weight:bold;border-bottom:1px solid var(--border-color);color:var(--text-color-dark);cursor:grab;position:relative;}
        .pct-modal-header.dragging{cursor:grabbing;}
        .pct-modal-close-btn{position:absolute;top:50%;right:15px;transform:translateY(-50%);background:transparent;border:none;font-size:24px;line-height:1;color:var(--secondary-color);cursor:pointer;padding:5px;width:34px;height:34px;border-radius:50%;transition:background-color .2s, color .2s;display:flex;align-items:center;justify-content:center;}
        .pct-modal-close-btn:hover{background-color:var(--background-light);color:var(--text-color-dark);}
        .pct-modal-body{padding:16px 20px 8px 20px;flex-grow:1;overflow-y:auto;min-height:50px;}
        .pct-modal[data-size="query"] .pct-modal-body { height: 260px; }
        .pct-modal-footer{padding:12px 20px 16px 20px;border-top:1px solid var(--border-color);display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;}
        .pct-modal-footer-left,.pct-modal-footer-right{display:flex;gap:10px;align-items:center;}
        .pct-btn{display:inline-flex;align-items:center;justify-content:center;margin:0;padding:8px 18px;font-size:15px;border-radius:var(--border-radius-base);border:1px solid transparent;background:var(--primary-color);color:#fff;cursor:pointer;transition:background var(--transition-speed),transform var(--transition-speed),box-shadow var(--transition-speed), color var(--transition-speed), border-color var(--transition-speed);font-weight:600;box-shadow:0 2px 5px var(--box-shadow-light);white-space:nowrap; min-width: 90px;}
        .pct-btn:hover{background:var(--primary-dark-color);transform:translateY(-1px) scale(1.01);box-shadow:0 4px 8px var(--box-shadow-medium);color:#fff;border-color:transparent;}
        .pct-btn:disabled{background:#CED4DA;color:#A0A0A0;cursor:not-allowed;transform:none;box-shadow:none;border-color:transparent;}
        .pct-btn-secondary{background:var(--secondary-color);border-color:var(--secondary-color);} .pct-btn-secondary:hover{background:var(--secondary-dark-color);border-color:var(--secondary-dark-color);}
        .pct-btn.pct-btn-outline { background-color: transparent; border-color: var(--secondary-color); color: var(--secondary-color); }
        .pct-btn.pct-btn-outline:hover { background-color: var(--background-light); color: var(--text-color-dark); border-color: var(--secondary-color); }
        .pct-btn.pct-btn-outline.pct-btn-primary { background-color: var(--primary-color); border-color: var(--primary-color); color: #fff; }
        .pct-filter-btn{font-size:14px;padding:5px 12px;background:var(--warning-color);color:var(--text-color-dark);border:1px solid var(--warning-dark-color);border-radius:5px;cursor:pointer;font-weight:600;white-space:nowrap;}
        .pct-filter-btn.active{background:var(--warning-dark-color);color:white;}
        .pct-input{width:100%;font-size:16px;padding:9px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;margin-top:5px;}
        .pct-input:focus{border-color:var(--primary-color);box-shadow:0 0 0 2px rgba(74,144,226,0.2);outline:none;}
        .pct-error{color:var(--error-color);font-size:13px;margin:8px 0 0 0;display:block;}
        .pct-form-group{margin-bottom:20px;}
        .pct-mode-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;}
        .pct-mode-card, .pct-sub-option, .pct-channel-option { background: var(--background-light); border: 1px solid var(--border-color); border-radius: var(--border-radius-base); padding: 10px; text-align: center; cursor: pointer; transition: all .2s ease-out; font-weight: 500; font-size: 15px; display: flex; align-items: center; justify-content: center; min-height: 50px; }
        .pct-mode-card:hover, .pct-sub-option:hover, .pct-channel-option:hover { transform: translateY(-2px); box-shadow: 0 4px 8px var(--box-shadow-medium); background-color: #f0f7ff; border-color: var(--primary-color); }
        .pct-mode-card.selected, .pct-sub-option.selected, .pct-channel-option.selected { background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold; }
        .pct-sub-option-grid, .pct-channel-option-grid{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;}
        .pct-table-wrap{max-height:60vh;overflow:auto;margin:15px 0;}
        .pct-table{border-collapse:collapse;width:100%;font-size:14px;background:var(--surface-color);table-layout:fixed;min-width:1000px;}
        .pct-table th, .pct-table td{border:1px solid #ddd;padding:5px;vertical-align:top;word-wrap:break-word; text-align: center;}
        .pct-table th { background:#f8f9fa;position:sticky;top:0;z-index:1;cursor:pointer;}
        .pct-table td:nth-child(3), .pct-table td:nth-child(9) { text-align: left; }
        .pct-table th:nth-child(7), .pct-table th:nth-child(8) { width: 30px; }
        .pct-table th[data-key]:after{content:'';position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:0.3;font-size:12px;transition:opacity 0.2s;border:4px solid transparent;}
        .pct-table th[data-key].sort-asc:after{content:'';border-bottom-color:var(--primary-color);opacity:1;}
        .pct-table th[data-key].sort-desc:after{content:'';border-top-color:var(--primary-color);opacity:1;}
        .pct-table tr.special-row{background:#fffde7;border-left:4px solid var(--warning-color);cursor:help;}
        .pct-table tr:hover{background:#e3f2fd;}
        .pct-table tr.clickable:hover { background: #e3f2fd; cursor: pointer; }
        .pct-status-blue { color: var(--primary-color); }
        .pct-status-red { color: var(--error-color); }
        .pct-status-green { color: var(--success-color); }
        .pct-channel-insale { color: var(--primary-color); font-weight: bold; }
        .pct-channel-offsale { color: var(--error-color); }
        .pct-channel-separator { margin: 0 8px; color: var(--border-color); }
        .pct-filter-controls{display:flex; align-items:center; gap:16px; margin: 0 0 16px 0; flex-wrap: wrap;}
        .pct-query-info{ font-size: 14px; color: var(--text-color-light); white-space: nowrap; }
        .pct-search-container{flex-grow: 1; min-width: 250px;}
        .pct-search-input{width:100%;font-size:14px;padding:8px 12px;border-radius:5px;border:1px solid var(--border-color);box-sizing:border-box;}
        .pct-status-filters{display:flex;gap:10px;}
        .pct-status-filter-btn{font-size:13px;padding:5px 12px !important;flex-shrink:0;}
        .pct-summary-bar { font-size: 14px; color: var(--text-color-light); margin-bottom: 10px; background-color: var(--background-light); padding: 8px 12px; border-radius: 5px; }
        .toast{position:fixed;left:50%;top:30px;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 22px;border-radius:var(--border-radius-base);font-size:16px;z-index:2147483647;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;box-shadow:0 4px 12px rgba(0,0,0,0.2);white-space:nowrap;}
        .toast.show{opacity:1;transform:translateX(-50%) translateY(0);pointer-events:auto;}
        .toast.success{background:var(--success-color);} .toast.error{background:var(--error-color);} .toast.warning{background:var(--warning-color);color:var(--text-color-dark);} .toast.info{background:var(--info-color);}
        .confirm-toast{display:flex;align-items:center;gap:15px;} .confirm-toast .pct-btn{padding:5px 10px;font-size:14px;}
        .pagination{display:flex;justify-content:center;align-items:center;gap:10px;}
        .pagination-info{font-size:14px;color:var(--text-color-light);}
        .progress-container{display:none;align-items:center;gap:16px;padding:12px;background-color:#f0f8ff;border-radius:var(--border-radius-base);margin-bottom:16px;}
        .progress-bar-wrapper{flex-grow:1;height:10px;background-color:rgba(0,0,0,0.1);border-radius:5px;overflow:hidden;}
        .progress-bar{width:0%;height:100%;background-color:var(--primary-color);transition:width .4s ease-out;border-radius:5px;}
        .progress-text{font-size:14px;color:var(--text-color-dark);white-space:nowrap;}
        .abort-btn{background-color:var(--error-color) !important;color:white !important;padding:5px 14px !important;font-size:14px !important;}
      `;
      document.head.appendChild(s);
    };
    const Toast = {
      show: (msg, type = 'info', duration = 3000) => { let e = document.querySelector('.pct-toast'); if (e) e.remove(); e = document.createElement('div'); e.className = `pct-toast ${type}`; e.textContent = msg; document.body.appendChild(e); setTimeout(() => e.classList.add('show'), 10); if (duration > 0) { setTimeout(() => { e.classList.remove('show'); e.addEventListener('transitionend', () => e.remove(), { once: true }); }, duration); } },
      confirm: (msg, onConfirm) => { /* Logic removed as confirmation is now in-dialog */ },
      close: () => { document.querySelector('.pct-toast')?.remove(); }
    };
    const Modal = {
      close: () => { document.getElementById(ConfigModule.TOOL_ID)?.remove(); document.getElementById('pctModalMask')?.remove(); StateModule.get().currentQueryController?.abort(); },
      show: (html, onOpen) => {
        Modal.close(); let mask = document.createElement('div'); mask.id = 'pctModalMask';
        mask.className = 'pct-modal-mask'; document.body.appendChild(mask);
        let modal = document.createElement('div'); modal.id = ConfigModule.TOOL_ID; modal.className = 'pct-modal'; modal.innerHTML = html; document.body.appendChild(modal);
        setTimeout(() => { mask.classList.add('show'); modal.classList.add('show'); }, 10);
        modal.querySelector('.pct-modal-header')?.addEventListener('mousedown', EventModule.dragMouseDown);
        modal.querySelector('.pct-modal-close-btn')?.addEventListener('click', Modal.close);
        if (onOpen) setTimeout(() => onOpen(modal), 50);
      }
    };
    const showError = (msg, elId) => { const el = document.getElementById(elId); if (el) { el.textContent = msg; el.style.display = 'block'; } else { Toast.show(msg, 'error'); } };
    const hideError = (elId) => { const el = document.getElementById(elId); if (el) { el.style.display = 'none'; el.textContent = ''; } };
    const Progress = {
      show: (text) => {
          let p = document.getElementById('pct-progress-container');
          const anchor = document.querySelector('.pct-modal-body');
          if (!p && anchor) {
              p = document.createElement('div'); p.id = 'pct-progress-container'; p.className = 'progress-container';
              anchor.prepend(p);
          }
          if(p) {
            p.style.display = 'flex';
            p.innerHTML = `<span class="progress-text">${text}</span><div class="progress-bar-wrapper"><div class="progress-bar"></div></div><button class="abort-btn pct-btn">中止</button>`;
            p.querySelector('.abort-btn').onclick = () => { StateModule.get().currentQueryController?.abort(); Progress.hide(); UIModule.Toast.show('查詢已中止', 'warning'); };
          }
      },
      update: (percentage, text) => {
          const bar = document.querySelector('.progress-bar'); if (bar) bar.style.width = `${percentage}%`;
          const textEl = document.querySelector('.progress-text'); if (textEl && text) textEl.textContent = text;
      },
      hide: () => { const p = document.getElementById('pct-progress-container'); if(p) p.style.display = 'none'; }
    };
    return { injectStyle, Toast, Modal, showError, hideError, Progress };
  })();

  /**
   * ========================================================
   * 模組 5：事件管理器 (EventModule)
   * ========================================================
   */
  const EventModule = (() => {
    const dragState = { isDragging: false, initialX: 0, initialY: 0, modal: null };
    const dragMouseDown = e => { const m = document.getElementById(ConfigModule.TOOL_ID); if (!m || e.target.classList.contains('pct-modal-close-btn')) return; dragState.isDragging = true; dragState.modal = m; dragState.initialX = e.clientX - m.getBoundingClientRect().left; dragState.initialY = e.clientY - m.getBoundingClientRect().top; m.classList.add('dragging'); e.currentTarget.classList.add('dragging'); document.addEventListener('mousemove', elementDrag); document.addEventListener('mouseup', closeDragElement); e.preventDefault(); };
    const elementDrag = e => { if (!dragState.isDragging) return; const { modal, initialX, initialY } = dragState; const cX = e.clientX - initialX, cY = e.clientY - initialY; modal.style.left = `${cX + modal.offsetWidth / 2}px`; modal.style.top = `${cY}px`; e.preventDefault(); };
    const closeDragElement = () => { if (!dragState.isDragging) return; dragState.isDragging = false; const m = dragState.modal; if (m) { m.classList.remove('dragging'); m.querySelector('.pct-modal-header')?.classList.remove('dragging'); } document.removeEventListener('mousemove', elementDrag); document.removeEventListener('mouseup', closeDragElement); };
    const setupGlobalKeyListener = () => { document.addEventListener('keydown', handleEscKey); };
    const removeGlobalKeyListener = () => { document.removeEventListener('keydown', handleEscKey); };
    const handleEscKey = (e) => { if (e.key === 'Escape') { UIModule.Modal.close(); removeGlobalKeyListener(); } };
    const autoFormatInput = (event) => { const input = event.target; let value = input.value; const selectionStart = input.selectionStart; const selectionEnd = input.selectionEnd; input.value = UtilsModule.toHalfWidthUpperCase(value); input.setSelectionRange(selectionStart, selectionEnd); };
    return { dragMouseDown, setupGlobalKeyListener, autoFormatInput };
  })();

  /**
   * ========================================================
   * 模組 6：API 服務層 (ApiModule)
   * ========================================================
   */
  const ApiModule = (() => {
    const callApi = async (endpoint, params, signal) => { const { apiBase, token } = StateModule.get(); const response = await fetch(`${apiBase}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'SSO-TOKEN': token }, body: JSON.stringify(params), signal: signal }); if (!response.ok) { let errorText = await response.text(); try { const errorJson = JSON.parse(errorText); errorText = errorJson.message || errorJson.error || errorText; } catch (e) { } throw new Error(`API 請求失敗: ${errorText}`); } return response.json(); };
    const verifyToken = async (token) => { try { const res = await ApiModule.callApi('/planCodeController/query', { planCode: '5105', currentPage: 1, pageSize: 1 }, null); return res && typeof res.total !== 'undefined'; } catch (e) { return false; } };
    return { callApi, verifyToken };
  })();

  /**
   * ========================================================
   * 模組 7：資料處理與查詢邏輯層 (DataModule)
   * ========================================================
   */
  const DataModule = (() => {
    const extractPolpln = (polplnString) => { if (!polplnString || typeof polplnString !== 'string') return ""; let t = polplnString.trim(); if (t.endsWith("%%")) t = t.substring(0, t.length - 2); return t.replace(/^\d+/, "").replace(/\d+$/, "").trim() || ""; };
    const processMultiplePolpln = (polplnRecords) => { if (!polplnRecords || polplnRecords.length === 0) return "-"; if (polplnRecords.length === 1) return extractPolpln(polplnRecords[0]) || "-"; const extractedPolplns = polplnRecords.map(r => extractPolpln(r)).filter(p => p !== ""); if (extractedPolplns.length === 0) return "-"; const firstPolpln = extractedPolplns[0]; return extractedPolplns.every(p => p === firstPolpln) ? firstPolpln : "-"; };
    const queryMultiplePlanCodes = async (codes, signal, onProgress) => { const BATCH_SIZE = ConfigModule.BATCH_SIZES.MULTI_CODE_QUERY; const allRecords = []; const totalBatches = Math.ceil(codes.length / BATCH_SIZE); for (let i = 0; i < codes.length; i += BATCH_SIZE) { const batch = codes.slice(i, i + BATCH_SIZE); const batchNum = i / BATCH_SIZE + 1; onProgress(batchNum / totalBatches * 100, `批量查詢第 ${batchNum}/${totalBatches} 批...`); const promises = batch.map(async c => { try { const res = await ApiModule.callApi('/planCodeController/query', { planCode: c, currentPage: 1, pageSize: 10 }, signal); return (res.records && res.records.length > 0) ? res.records.map(r => ({...r, _isErrorRow: false})) : [{ planCode: c, _apiStatus: '查無資料', _isErrorRow: true }]; } catch (e) { if (e.name === 'AbortError') throw e; return [{ planCode: c, _apiStatus: '查詢失敗', _isErrorRow: true }]; } }); allRecords.push(...(await Promise.all(promises)).flat()); } return { records: allRecords }; };
    const queryChannelData = async (mode, channels, signal) => { const channelsToQuery = channels.length > 0 ? channels : ConfigModule.FIELD_MAPS.CHANNELS; const query = async (ch, inSale) => { const params = { planCode: "", channel: UtilsModule.channelUIToAPI(ch), saleEndDate: inSale ? "9999-12-31 00:00:00" : "", pageIndex: 1, size: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_CHANNEL }; const res = await ApiModule.callApi('/planCodeSaleDateController/query', params, signal); return (res.planCodeSaleDates?.records || []); }; const queryAll = async (chList) => (await Promise.all(chList.map(c => query(c, false)))).flat(); const queryCurrent = async (chList) => (await Promise.all(chList.map(c => query(c, true)))).flat(); if (mode === '停售') { const [all, current] = await Promise.all([queryAll(channelsToQuery), queryCurrent(channelsToQuery)]); const currentSet = new Set(current.map(i => `${i.planCode}_${i.channel}`)); return all.filter(i => !currentSet.has(`${i.planCode}_${i.channel}`)); } else { return await queryCurrent(channelsToQuery); } };
    const processRawDataForTable = (rawData) => { const today = UtilsModule.formatToday(); return rawData.map((item, index) => { if (item._isErrorRow) return { ...item, no: index + 1, _loadingDetails: false }; return { no: index + 1, planCode: item.planCode || '-', shortName: item.shortName || item.planName || '-', currency: UtilsModule.currencyConvert(item.currency || item.cur), unit: UtilsModule.unitConvert(item.reportInsuranceAmountUnit || item.insuranceAmountUnit), coverageType: UtilsModule.coverageTypeConvert(item.coverageType || item.type), saleStartDate: UtilsModule.formatDateForUI(item.saleStartDate), rawSaleStartDate: item.saleStartDate, saleEndDate: UtilsModule.formatDateForUI(item.saleEndDate), rawSaleEndDate: item.saleEndDate, mainStatus: UtilsModule.getSaleStatus(today, item.saleStartDate, item.saleEndDate), polpln: '...', channels: [], specialReason: '', _isErrorRow: false, _originalItem: item, _loadingDetails: true }; }); };
    const processChannelDataForTable = (rawData) => { const today = UtilsModule.formatToday(); const groupedByPlanCode = rawData.reduce((acc, cur) => { if (!acc[cur.planCode]) { acc[cur.planCode] = { no: Object.keys(acc).length + 1, planCode: cur.planCode, shortName: '...', currency: '...', unit: '...', coverageType: '...', saleStartDate: '...', rawSaleStartDate: null, saleEndDate: '...', rawSaleEndDate: null, mainStatus: '...', polpln: '...', channels: [], specialReason: '', _isErrorRow: false, _loadingProduct: true }; } acc[cur.planCode].channels.push({ channel: UtilsModule.channelAPIToUI(cur.channel), saleStartDate: UtilsModule.formatDateForUI(cur.saleStartDate), saleEndDate: UtilsModule.formatDateForUI(cur.saleEndDate), rawStart: cur.saleStartDate, rawEnd: cur.saleEndDate, status: UtilsModule.getSaleStatus(today, cur.saleStartDate, cur.saleEndDate) }); return acc; }, {}); return Object.values(groupedByPlanCode); };
    const getProductDetails = async (planCode) => { const { cacheProduct } = StateModule.get(); if (cacheProduct.has(planCode)) return cacheProduct.get(planCode); const res = await ApiModule.callApi('/planCodeController/query', { planCode, currentPage: 1, pageSize: 1 }); const productData = (res.records && res.records.length > 0) ? res.records[0] : null; if(productData) cacheProduct.set(planCode, productData); return productData; };
    const getPolplnData = async (planCode) => { const { cacheDetail } = StateModule.get(); if (cacheDetail.has(planCode)) return cacheDetail.get(planCode); const detail = await ApiModule.callApi('/planCodeController/queryDetail', { planCode, currentPage: 1, pageSize: 50 }); const polplnRecords = (detail.records || []).map(r => r.polpln); const processedPolpln = processMultiplePolpln(polplnRecords); cacheDetail.set(planCode, processedPolpln); return processedPolpln; };
    const getChannelDetails = async (planCode) => { const { cacheChannel } = StateModule.get(); if (cacheChannel.has(planCode)) return cacheChannel.get(planCode); const sale = await ApiModule.callApi('/planCodeSaleDateController/query', { planCode, currentPage: 1, pageSize: 50 }); const channels = (sale.planCodeSaleDates?.records || []).map(r => ({ channel: UtilsModule.channelAPIToUI(r.channel), saleStartDate: UtilsModule.formatDateForUI(r.saleStartDate), saleEndDate: UtilsModule.formatDateForUI(r.saleEndDate), rawStart: r.saleStartDate, rawEnd: r.saleEndDate })); cacheChannel.set(planCode, channels); return channels; };
    const sortData = (data, key, asc) => { if (!key) return data; return [...data].sort((a, b) => { let valA = a[key], valB = b[key]; if (key === 'no') { valA = a._originalIndex; valB = b._originalIndex; } if (key.includes('Date')) { valA = new Date(UtilsModule.formatDateForComparison(a['raw' + key.charAt(0).toUpperCase() + key.slice(1)])); valB = new Date(UtilsModule.formatDateForComparison(b['raw' + key.charAt(0).toUpperCase() + key.slice(1)])); if (isNaN(valA.getTime())) return 1; if (isNaN(valB.getTime())) return -1; } if (typeof valA === 'string') valA = valA.toLowerCase(); if (typeof valB === 'string') valB = valB.toLowerCase(); if (valA < valB) return asc ? -1 : 1; if (valA > valB) return asc ? 1 : -1; return 0; }); };
    return { queryMultiplePlanCodes, queryChannelData, processRawDataForTable, processChannelDataForTable, getProductDetails, getPolplnData, getChannelDetails, sortData };
  })();

/**
   * ========================================================
   * 模組 8：主控制器/應用程式邏輯 (ControllerModule)
   * ========================================================
   */
  const ControllerModule = (() => {

    /**
     * 初始化工具，包含樣式注入、事件監聽與Token自動檢核
     */
    const initialize = async () => {
      UIModule.injectStyle();
      EventModule.setupGlobalKeyListener();
      
      const storedToken = [
          localStorage.getItem('SSO-TOKEN'),
          sessionStorage.getItem('SSO-TOKEN'),
          localStorage.getItem('euisToken'),
          sessionStorage.getItem('euisToken')
      ].find(t => t && t.trim() !== 'null' && t.trim() !== '');

      if (storedToken) {
        StateModule.set({ token: storedToken, tokenCheckEnabled: true });
        UIModule.Toast.show('正在自動驗證 Token...', 'info');
        if (await ApiModule.verifyToken(storedToken)) {
          UIModule.Toast.show('Token 驗證成功', 'success');
          showQueryDialog();
        } else {
          UIModule.Toast.show('自動驗證失敗，請手動輸入', 'warning');
          StateModule.set({ token: '' });
          showTokenDialog();
        }
      } else {
        showTokenDialog();
      }
    };

    /**
     * 顯示 Token 設定對話框，包含驗證與略過功能
     */
    const showTokenDialog = () => {
      const { env } = StateModule.get();
      UIModule.Modal.show(`
        <div class="pct-modal-header"><span>設定 Token (${env})</span><button class="pct-modal-close-btn">&times;</button></div>
        <div class="pct-modal-body">
            <div class="pct-form-group">
                <label for="pct-token-input" class="pct-label">請貼上您的 SSO-TOKEN 或 euisToken：</label>
                <textarea class="pct-input" id="pct-token-input" rows="4" placeholder="貼上您的 Token..."></textarea>
                <div class="pct-error" id="pct-token-err" style="display:none;"></div>
            </div>
        </div>
        <div class="pct-modal-footer">
            <div class="pct-modal-footer-right">
                <button class="pct-btn" id="pct-token-ok">驗證</button>
                <button class="pct-btn pct-btn-secondary" id="pct-token-skip">略過</button>
            </div>
        </div>
      `, modal => {
        modal.setAttribute('data-size', 'query');
        const tokenInput = modal.querySelector('#pct-token-input');
        
        modal.querySelector('#pct-token-ok').onclick = async () => { 
            const val = tokenInput.value.trim(); 
            if (!val) { UIModule.showError('請輸入 Token', 'pct-token-err'); return; } 
            UIModule.hideError('pct-token-err');
            UIModule.Toast.show('正在檢查...', 'info'); 
            StateModule.set({ token: val, tokenCheckEnabled: true });
            if (await ApiModule.verifyToken(val)) { 
                localStorage.setItem('SSO-TOKEN', val);
                UIModule.Toast.show('Token 驗證成功', 'success'); 
                showQueryDialog(); 
            } else { 
                UIModule.showError('Token 驗證失敗，請檢查或選擇略過', 'pct-token-err'); 
                StateModule.set({ token: '' }); 
            } 
        };
        
        modal.querySelector('#pct-token-skip').onclick = () => { 
            const val = tokenInput.value.trim();
            StateModule.set({ token: val, tokenCheckEnabled: false });
            if (val) {
                localStorage.setItem('SSO-TOKEN', val);
            } else {
                localStorage.removeItem('SSO-TOKEN');
                localStorage.removeItem('euisToken');
            }
            UIModule.Toast.show('已略過驗證，若查詢失敗請檢查 Token', 'warning'); 
            showQueryDialog(); 
        };
      });
    };
    
    /**
     * 顯示主查詢條件對話框
     */
    const showQueryDialog = () => {
        const { env } = StateModule.get();
        const modeLabel = m => ({[ConfigModule.QUERY_MODES.PLAN_CODE]:'商品代號', [ConfigModule.QUERY_MODES.PLAN_NAME]:'商品名稱', [ConfigModule.QUERY_MODES.MASTER_CLASSIFIED]:'商品銷售時間', [ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED]:'通路銷售時間'}[m] || m);
        const footerLeftHTML = `<button class="pct-btn pct-btn-secondary" id="pct-back-to-token">修改 Token</button><button class="pct-btn pct-btn-secondary" id="pct-clear-reset">清除重設</button>`;
        
        UIModule.Modal.show(`
            <div class="pct-modal-header"><span>選擇查詢條件 (${env})</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body">
                <div id="pct-query-view">
                    <div id="pct-mode-wrap" class="pct-mode-card-grid">${Object.values(ConfigModule.QUERY_MODES).map(m=>`<div class="pct-mode-card" data-mode="${m}">${modeLabel(m)}</div>`).join('')}</div>
                    <div id="pct-dynamic-query-content"></div>
                </div>
                <div id="pct-confirm-view" style="display:none; text-align:center; padding-top: 30px;">
                     <h4>您確定要掃描全部資料嗎？</h4>
                     <p style="color:#666; margin: 10px 0 30px 0;">此操作可能耗時較長。</p>
                </div>
                <div id="pct-query-err" class="pct-error" style="display:none;"></div>
            </div>
            <div class="pct-modal-footer">
                <div class="pct-modal-footer-left">${footerLeftHTML}</div>
                <div class="pct-modal-footer-right"><button class="pct-btn" id="pct-query-ok">開始查詢</button></div>
            </div>
        `, modal => {
            modal.setAttribute('data-size', 'query');
            let localState = { mode: '', input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() };
            const queryView = modal.querySelector('#pct-query-view');
            const confirmView = modal.querySelector('#pct-confirm-view');
            const dynamicContent = modal.querySelector('#pct-dynamic-query-content');
            const footer = modal.querySelector('.pct-modal-footer');
            const originalFooterHTML = footer.innerHTML;

            const resetLocalState = () => {
                localState = { mode: '', input: '', masterStatus: new Set(), channelStatus: '', channels: new Set() };
                updateUI();
            };

            const updateUI = () => {
                queryView.style.display = 'block';
                confirmView.style.display = 'none';
                footer.innerHTML = originalFooterHTML;
                footer.querySelector('#pct-back-to-token').onclick = showTokenDialog;
                footer.querySelector('#pct-clear-reset').onclick = resetLocalState;
                footer.querySelector('#pct-query-ok').onclick = handleQueryClick;

                modal.querySelectorAll('.pct-mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === localState.mode));
                let content = '';
                switch (localState.mode) {
                    case ConfigModule.QUERY_MODES.PLAN_CODE: content = `<div class="pct-form-group"><label class="pct-label">商品代碼：</label><textarea class="pct-input" id="pct-query-input" rows="3" placeholder="多筆可用空格、逗號或換行分隔"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.PLAN_NAME: content = `<div class="pct-form-group"><label class="pct-label">商品名稱：</label><textarea class="pct-input" id="pct-query-input" rows="3"></textarea></div>`; break;
                    case ConfigModule.QUERY_MODES.MASTER_CLASSIFIED:
                        content = `<div class="pct-form-group"><label class="pct-label">主檔銷售時間：</label><div class="pct-sub-option-grid">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<div class="pct-sub-option" data-type="masterStatus" data-value="${s}">${s}</div>`).join('')}</div><p style="font-size:12px;color:#666;margin-top:15px;">ⓘ 將掃描所有主檔資料，執行時間可能較長。</p></div>`; break;
                    case ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED: content = `<div class="pct-form-group"><label class="pct-label">通路：(可多選)</label><div class="pct-channel-option-grid">${ConfigModule.FIELD_MAPS.CHANNELS.map(c=>`<div class="pct-channel-option" data-type="channels" data-value="${c}">${c}</div>`).join('')}</div></div><div class="pct-form-group"><label class="pct-label">銷售範圍：</label><div class="pct-sub-option-grid">${['現售','停售'].map(s=>`<div class="pct-sub-option" data-type="channelStatus" data-value="${s}">${s}</div>`).join('')}</div></div>`; break;
                }
                dynamicContent.innerHTML = content;
                dynamicContent.querySelectorAll('.pct-input').forEach(el => el.addEventListener('input', EventModule.autoFormatInput));
                const inputEl = dynamicContent.querySelector('#pct-query-input'); if (inputEl) { inputEl.value = localState.input; inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQueryClick(); }}; }
                dynamicContent.querySelectorAll('[data-value]').forEach(el => { const type = el.dataset.type; if (type === 'masterStatus') el.classList.toggle('selected', localState.masterStatus.has(el.dataset.value)); else if (type === 'channels') el.classList.toggle('selected', localState.channels.has(el.dataset.value)); else if (type === 'channelStatus') el.classList.toggle('selected', localState.channelStatus === el.dataset.value); });
            };

            const handleQueryClick = () => {
                UIModule.hideError('pct-query-err');
                if (!StateModule.get().token && StateModule.get().tokenCheckEnabled) { UIModule.Toast.show('Token 未設定，請點擊左下角「修改 Token」按鈕進行設定', 'error'); return; }
                if (localState.mode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED) {
                    if (localState.masterStatus.size === 0) { UIModule.showError('請至少選擇一個商品銷售時間', 'pct-query-err'); return; }
                    if (localState.masterStatus.size === Object.keys(ConfigModule.MASTER_STATUS_TYPES).length) {
                        queryView.style.display = 'none';
                        confirmView.style.display = 'block';
                        footer.innerHTML = `<div class="pct-modal-footer-right"><button class="pct-btn pct-btn-secondary" id="pct-confirm-cancel-scan">取消</button><button class="pct-btn" id="pct-confirm-full-scan">確認掃描</button></div>`;
                        footer.querySelector('#pct-confirm-full-scan').onclick = () => { StateModule.set({ queryMode: localState.mode, masterStatusSelection: localState.masterStatus }); executeQuery(); };
                        footer.querySelector('#pct-confirm-cancel-scan').onclick = updateUI;
                        return;
                    }
                }
                if (localState.mode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED && !localState.channelStatus) { UIModule.showError('請選擇通路銷售範圍', 'pct-query-err'); return; }
                if (!localState.mode) { UIModule.showError('請選擇查詢模式', 'pct-query-err'); return; }
                StateModule.set({ queryMode: localState.mode, queryInput: localState.input, masterStatusSelection: localState.masterStatus, channelStatusSelection: localState.channelStatus, channelSelection: localState.channels });
                executeQuery();
            };

            modal.querySelector('#pct-mode-wrap').onclick = e => { const card = e.target.closest('.pct-mode-card'); if (card) { localState.mode = card.dataset.mode; updateUI(); } };
            dynamicContent.addEventListener('click', e => { const option = e.target.closest('[data-value]'); if (!option) return; const {type, value} = option.dataset; if (type === 'masterStatus') { if(localState.masterStatus.has(value)) localState.masterStatus.delete(value); else localState.masterStatus.add(value); } else if (type === 'channels') { if(localState.channels.has(value)) localState.channels.delete(value); else localState.channels.add(value); } else if (type === 'channelStatus') { localState.channelStatus = localState.channelStatus === value ? '' : value; } updateUI(); });
            dynamicContent.addEventListener('input', e => { if (e.target.id === 'pct-query-input') localState.input = e.target.value; });
            
            resetLocalState();
        });
    };
    
    /**
     * 執行主查詢並觸發後續的詳細資料載入
     */
    const executeQuery = async () => {
        UIModule.Modal.close(); await new Promise(r => setTimeout(r, 100));
        renderTable(); 
        const controller = new AbortController();
        StateModule.set({ currentQueryController: controller });
        const oldState = { ...StateModule.get() };
        StateModule.resetQueryState();
        StateModule.set({ queryMode: oldState.queryMode, queryInput: oldState.queryInput, tokenCheckEnabled: oldState.tokenCheckEnabled, activeFrontendFilters: oldState.masterStatusSelection });
        const { queryMode, queryInput, masterStatusSelection, channelStatusSelection, channelSelection } = oldState;
        try {
            UIModule.Progress.show('開始查詢...');
            let rawData = [], processedData = [];

            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                rawData = await DataModule.queryChannelData(channelStatusSelection, [...channelSelection], controller.signal);
                processedData = DataModule.processChannelDataForTable(rawData);
            } else {
                if (queryMode === ConfigModule.QUERY_MODES.PLAN_CODE) { rawData = (await DataModule.queryMultiplePlanCodes(UtilsModule.splitInput(queryInput), controller.signal, UIModule.Progress.update)).records; }
                else if (queryMode === ConfigModule.QUERY_MODES.PLAN_NAME) { rawData = (await ApiModule.callApi('/planCodeController/query', { planCodeName: queryInput, currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, controller.signal)).records || []; }
                else if (queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED) { rawData = (await ApiModule.callApi('/planCodeController/query', { planCodeName: '', currentPage: 1, pageSize: ConfigModule.DEFAULT_QUERY_PARAMS.PAGE_SIZE_MASTER }, controller.signal)).records || []; }
                processedData = DataModule.processRawDataForTable(rawData);
            }
            
            StateModule.set({ allProcessedData: processedData });
            renderTable();
            UIModule.Progress.hide();
            UIModule.Toast.show(`主資料查詢完成，開始載入詳細資訊...`, 'info', 2000);
            
            // 根據查詢模式觸發不同的背景載入邏輯
            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                await Promise.all(processedData.filter(i => i._loadingProduct).map(item => DataModule.loadProductForSingleRow(item)));
            } else {
                await Promise.all(processedData.filter(i => i._loadingDetails).map(item => DataModule.loadDetailsForSingleRow(item)));
            }

        } catch (e) {
            if (e.name !== 'AbortError') { UIModule.Progress.hide(); UIModule.Toast.show(`查詢失敗: ${e.message}`, 'error'); renderTable(); }
        } finally {
            StateModule.set({ currentQueryController: null });
        }
    };

    /**
     * 手動觸發所有詳細資料的重載
     */
    const handleReloadDetails = async () => {
        const { queryMode, allProcessedData } = StateModule.get();
        UIModule.Toast.show('開始重載所有詳細資料...', 'info');
        UIModule.Progress.show('重載資料...');
        try {
            if (queryMode === ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED) {
                await Promise.all(allProcessedData.map(item => DataModule.loadProductForSingleRow(item)));
            } else {
                await Promise.all(allProcessedData.map(item => DataModule.loadDetailsForSingleRow(item)));
            }
            UIModule.Toast.show('所有詳細資料重載完成', 'success');
        } catch (e) {
            if (e.name !== 'AbortError') UIModule.Toast.show(`重載失敗: ${e.message}`, 'error');
        } finally {
            UIModule.Progress.hide();
        }
    };

    /**
     * 點擊單筆資料列時，觸發該筆的重查
     * @param {string} planCode - 要重查的商品代碼
     */
    const handleRowClick = async (planCode) => {
        const item = StateModule.get().allProcessedData.find(p => p.planCode === planCode);
        if (!item || (!item._loadingProduct && !item._loadingDetails)) return;

        try {
            if (item._loadingProduct) {
                UIModule.Toast.show(`查詢 ${planCode} 的商品資訊...`, 'info', 2000);
                await DataModule.loadProductForSingleRow(item);
            } else if (item._loadingDetails) {
                UIModule.Toast.show(`查詢 ${planCode} 的POLPLN與通路...`, 'info', 2000);
                await DataModule.loadDetailsForSingleRow(item);
            }
        } catch (e) {
            UIModule.Toast.show(`重查 ${planCode} 失敗: ${e.message}`, 'error');
        }
    };

    /**
     * 渲染結果表格
     */
    const renderTable = () => {
        const state = StateModule.get();
        let filteredData = state.allProcessedData;
        const errorCount = filteredData.filter(r => r._isErrorRow).length;
        if (state.activeFrontendFilters.size > 0) { filteredData = filteredData.filter(r => state.activeFrontendFilters.has(r.mainStatus)); }
        if (state.filterSpecial) { filteredData = filteredData.filter(r => r.specialReason && !r._isErrorRow); }
        if (state.searchKeyword.trim()) { const keyword = state.searchKeyword.toLowerCase(); filteredData = filteredData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(keyword))); }
        
        const sortedData = DataModule.sortData(filteredData, state.sortKey, state.sortAsc);
        const totalPages = state.pageSize > 0 ? Math.ceil(sortedData.length / state.pageSize) : 1;
        const pageData = state.isFullView ? sortedData : sortedData.slice((state.pageNo - 1) * state.pageSize, state.pageNo * state.pageSize);
        const modeLabel = m => ({[ConfigModule.QUERY_MODES.PLAN_CODE]:'商品代號', [ConfigModule.QUERY_MODES.PLAN_NAME]:'商品名稱', [ConfigModule.QUERY_MODES.MASTER_CLASSIFIED]:'商品銷售時間', [ConfigModule.QUERY_MODES.CHANNEL_CLASSIFIED]:'通路銷售時間'}[m] || '未知');

        const headers = [
            { key: 'no', label: 'No' }, { key: 'planCode', label: '險種代碼' }, { key: 'shortName', label: '商品中文名稱' }, { key: 'currency', label: '幣別' }, { key: 'unit', label: '單位' }, { key: 'coverageType', label: '類型' }, { key: 'saleStartDate', label: '商品銷售日' }, { key: 'saleEndDate', label: '商品停賣日' }, { key: 'mainStatus', label: '險種狀態' }, { key: 'polpln', label: '商品名稱' }
        ];

        const modalHTML = `
            <div class="pct-modal-header"><span>查詢結果 (${state.env})</span><button class="pct-modal-close-btn">&times;</button></div>
            <div class="pct-modal-body">
                <div id="pct-progress-container" style="display:none;"></div>
                <div class="pct-query-info">查詢方式：<strong>${modeLabel(state.queryMode)}</strong></div>
                <div class="pct-filter-controls">
                    <div class="pct-search-container"><input type="text" class="pct-search-input" id="pct-search-input" placeholder="可搜尋表格內所有資訊商品代號、名稱、或其他內容..." value="${UtilsModule.escapeHtml(state.searchKeyword)}"></div>
                    ${state.queryMode === ConfigModule.QUERY_MODES.MASTER_CLASSIFIED ? `<div class="pct-status-filters">${Object.values(ConfigModule.MASTER_STATUS_TYPES).map(s=>`<button class="pct-btn pct-status-filter-btn ${state.activeFrontendFilters.has(s)?'pct-btn-primary':'pct-btn-outline'}" data-status="${s}">${s}</button>`).join('')}</div>` : ''}
                </div>
                <div class="pct-summary-bar">共查詢到 ${state.allProcessedData.length} 筆，顯示 ${sortedData.length} 筆${errorCount > 0 ? `，<span style="color:red;">失敗 ${errorCount} 筆</span>` : ''}。</div>
                <div class="pct-table-wrap"><table class="pct-table">
                    <thead><tr>${headers.map(h => `<th data-key="${h.key||''}">${h.label}</th>`).join('')}</tr></thead>
                    <tbody id="pct-table-body">${renderTableRows(pageData)}</tbody>
                </table></div>
            </div>
            <div class="pct-modal-footer">
                <div class="pct-modal-footer-left">
                    <button class="pct-btn pct-btn-secondary" id="pct-view-toggle">${state.isFullView?'分頁顯示':'一頁顯示'}</button>
                    ${state.allProcessedData.some(r=>r.specialReason)?`<button class="pct-btn ${state.filterSpecial?'active':''} pct-filter-btn" id="pct-table-filter">${state.filterSpecial?'顯示全部':'異常資料'}</button>`:''}
                </div>
                <div class="pct-pagination" style="display:${state.isFullView?'none':'flex'}"><button id="pct-table-prev" class="pct-btn" ${state.pageNo<=1?'disabled':''}>◀</button><span class="pct-pagination-info">${state.pageNo} / ${totalPages}</span><button id="pct-table-next" class="pct-btn" ${state.pageNo>=totalPages?'disabled':''}>▶</button></div>
                <div class="pct-modal-footer-right"><button class="pct-btn pct-btn-info" id="pct-reload-details">重載資料</button><button class="pct-btn pct-btn-success" id="pct-table-copy">一鍵複製</button><button class="pct-btn" id="pct-table-requery">重新查詢</button></div>
            </div>`;
        UIModule.Modal.show(modalHTML, modal => {
            modal.setAttribute('data-size', 'results');
            modal.querySelector('#pct-search-input').addEventListener('input', e => { clearTimeout(state.searchDebounceTimer); state.searchDebounceTimer = setTimeout(() => { StateModule.set({ searchKeyword: e.target.value, pageNo: 1 }); renderTable(); }, ConfigModule.DEBOUNCE_DELAY.SEARCH); });
            modal.querySelector('#pct-view-toggle').onclick = () => { StateModule.set({ isFullView: !state.isFullView, pageNo: 1 }); renderTable(); };
            modal.querySelector('#pct-table-prev').onclick = () => { if(state.pageNo > 1) { StateModule.set({pageNo: state.pageNo - 1}); renderTable(); }};
            modal.querySelector('#pct-table-next').onclick = () => { if(state.pageNo < totalPages) { StateModule.set({pageNo: state.pageNo + 1}); renderTable(); }};
            modal.querySelector('#pct-table-filter')?.addEventListener('click', () => { StateModule.set({ filterSpecial: !state.filterSpecial, pageNo: 1 }); renderTable(); });
            modal.querySelector('#pct-reload-details').onclick = handleReloadDetails;
            modal.querySelector('#pct-table-copy').onclick = () => { const text = `${headers.map(h=>h.label).join('\t')}\n` + sortedData.map(r => { const rowNum = sortedData.indexOf(r) + 1; return [rowNum, r.planCode, r.shortName, r.currency, r.unit, r.coverageType, r.saleStartDate, r.saleEndDate, r.mainStatus, r.polpln].join('\t'); }).join('\n'); UtilsModule.copyTextToClipboard(text, UIModule.Toast.show); };
            modal.querySelector('#pct-table-requery').onclick = showQueryDialog;
            modal.querySelectorAll('.pct-table th[data-key]').forEach(th => { th.classList.toggle('sort-asc', state.sortKey === th.dataset.key && state.sortAsc); th.classList.toggle('sort-desc', state.sortKey === th.dataset.key && !state.sortAsc); th.onclick = () => { const key = th.dataset.key; if (key) { StateModule.set({ sortAsc: state.sortKey === key ? !state.sortAsc : true, sortKey: key, pageNo: 1 }); renderTable(); }}; });
            modal.querySelectorAll('.pct-table tbody tr.clickable').forEach(tr => { tr.onclick = () => handleRowClick(tr.dataset.planCode); });
            modal.querySelectorAll('.pct-status-filter-btn').forEach(btn => btn.onclick = () => { const status = btn.dataset.status; const filters = state.activeFrontendFilters; if (filters.has(status)) { filters.delete(status); } else { filters.add(status); } StateModule.set({ pageNo: 1, activeFrontendFilters: filters }); renderTable(); });
        });
    };
    
    /**
     * 產生表格行的 HTML
     */
    const renderTableRows = (data) => {
        return data.map((r, index) => {
            const rowNum = index + 1;
            if (r._isErrorRow) return `<tr class="error-row"><td colspan="10">${r._apiStatus}: ${UtilsModule.escapeHtml(r.planCode)}</td></tr>`;
            
            let specialAttr = r.specialReason ? ` class="special-row" title="${UtilsModule.escapeHtml(r.specialReason)}"` : '';
            if (r._loadingProduct || r._loadingDetails) { specialAttr += ` class="clickable"`; }
            
            let statusClass = '', statusText = r.mainStatus;
            switch (r.mainStatus) {
                case ConfigModule.MASTER_STATUS_TYPES.STOPPED: statusClass = 'pct-status-red'; break;
                case ConfigModule.MASTER_STATUS_TYPES.IN_SALE: statusClass = 'pct-status-blue'; break;
                case ConfigModule.MASTER_STATUS_TYPES.ABNORMAL: statusText = `⚠ ${r.mainStatus} ⚠`; statusClass = 'pct-status-green'; break;
                case ConfigModule.MASTER_STATUS_TYPES.PENDING: statusClass = 'pct-status-green'; break;
            }

            return `<tr data-plan-code="${r.planCode}" ${specialAttr}>
                <td>${rowNum}</td>
                <td title="${UtilsModule.escapeHtml(r._originalItem?.planName || r.shortName || '')}">${UtilsModule.escapeHtml(r.planCode)}</td>
                <td>${UtilsModule.escapeHtml(r.shortName)}</td>
                <td>${UtilsModule.escapeHtml(r.currency)}</td>
                <td>${UtilsModule.escapeHtml(r.unit)}</td>
                <td>${UtilsModule.escapeHtml(r.coverageType)}</td>
                <td>${UtilsModule.escapeHtml(r.saleStartDate)}</td>
                <td>${UtilsModule.escapeHtml(r.saleEndDate)}</td>
                <td class="${statusClass}">${statusText}</td>
                <td>${UtilsModule.escapeHtml(r.polpln)}</td>
            </tr>`;
        }).join('');
    };

    /**
     * 更新單一資料列，避免刷新整個表格
     */
    const updateSingleRowByPlanCode = (planCode) => {
        const modal = document.getElementById(ConfigModule.TOOL_ID);
        if (!modal) return;
        const row = modal.querySelector(`tr[data-plan-code="${planCode}"]`);
        if (!row) return;

        const item = StateModule.get().allProcessedData.find(p => p.planCode === planCode);
        if (!item) return;

        // 重新渲染該行的內容
        const newRowContent = renderTableRows([item]);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = '<table><tbody>' + newRowContent + '</tbody></table>';
        const newRow = tempDiv.querySelector('tr');
        if (newRow) {
            row.innerHTML = newRow.innerHTML; // 只更新內部儲存格
            // 恢復點擊事件 (如果需要)
            if (item._loadingProduct || item._loadingDetails) {
                row.classList.add('clickable');
                row.onclick = () => handleRowClick(item.planCode);
            } else {
                row.classList.remove('clickable');
                row.onclick = null;
            }
        }
    };

    return { initialize, updateSingleRowByPlanCode };
  })();

  ControllerModule.initialize();
})();
