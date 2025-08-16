javascript:(function () {
  'use strict';
  
  /* 檢查工具是否已開啟 */
  if (document.querySelector('#dc-container')) {
    alert('系統日設定工具已開啟。');
    return;
  }

  const DateChanger = {
    /**
     * 配置管理 - 集中管理所有常數與設定
     */
    config: {
      API_URL: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisb/api/businessDate/',
      TOKEN: localStorage.getItem('euisToken') || localStorage.getItem('SSO-TOKEN') || '',
      STORAGE_KEYS: {
        LAST_DATE: 'dateChanger_lastDate',
        MINIMIZED: 'dateChanger_minimized'
      },
      AUTO_REFRESH_INTERVAL: 15 * 60 * 1000, // 15 分鐘
      DEBOUNCE_DELAY: 400,
      SUCCESS_MESSAGE_TIMEOUT: 3000
    },

    /**
     * 狀態管理 - 存放工具的動態狀態
     */
    state: {
      isLoading: false,
      autoRefreshInterval: null,
      businessDate: null,
      myBusinessDate: null,
      isDragging: false
    },

    /**
     * DOM 元素快取
     */
    dom: {},

    /**
     * 工具函式庫
     */
    utils: {
      // 獲取今天日期
      getToday() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      },

      // 獲取年末日期
      getEndOfCurrentYear() {
        return `${new Date().getFullYear()}-12-31`;
      },

      // 驗證日期有效性
      isValidDate(year, month, day) {
        const y = Number(year);
        const m = Number(month);
        const d = Number(day);
        
        if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
          return false;
        }
        
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && 
               date.getMonth() === m - 1 && 
               date.getDate() === d;
      },

      // 主要日期格式化邏輯
      formatDateInput(input) {
        if (!input) return '';
        
        // 處理相對日期 (+1, -2 等)
        const relativeDateResult = this.parseRelativeDate(input);
        if (relativeDateResult) return relativeDateResult;
        
        // 處理純數字格式
        const numericDateResult = this.parseNumericDate(input);
        if (numericDateResult) return numericDateResult;
        
        // 處理分隔符格式
        const separatedDateResult = this.parseSeparatedDate(input);
        if (separatedDateResult) return separatedDateResult;
        
        return input; // 無法解析時返回原值
      },

      // 解析相對日期
      parseRelativeDate(input) {
        if (!input.startsWith('+') && !input.startsWith('-')) return null;
        
        const offset = parseInt(input, 10);
        if (isNaN(offset)) return null;
        
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      },

      // 解析純數字日期
      parseNumericDate(input) {
        const cleanInput = input.replace(/[^\d\-\/\.]/g, '');
        if (cleanInput.includes('-') || cleanInput.includes('/') || cleanInput.includes('.')) {
          return null; // 有分隔符的交給其他函數處理
        }
        
        const numbers = cleanInput.replace(/\D/g, '');
        const parsers = [
          { len: 8, format: () => ({ y: numbers.substring(0, 4), m: numbers.substring(4, 6), d: numbers.substring(6, 8) }) },
          { len: 6, format: () => ({ y: '20' + numbers.substring(0, 2), m: numbers.substring(2, 4), d: numbers.substring(4, 6) }) },
          { len: 4, format: () => ({ y: new Date().getFullYear().toString(), m: numbers.substring(0, 2), d: numbers.substring(2, 4) }) }
        ];

        for (const parser of parsers) {
          if (numbers.length === parser.len) {
            const { y, m, d } = parser.format();
            if (this.isValidDate(y, m, d)) {
              return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        }
        return null;
      },

      // 解析有分隔符的日期
      parseSeparatedDate(input) {
        const cleanInput = input.replace(/[^\d\-\/\.]/g, '');
        const parts = cleanInput.split(/[.\-\/]/);
        
        if (parts.length < 2) return null;
        
        let [year, month, day] = parts;
        
        // 處理只有兩個部分的情況（月日）
        if (parts.length === 2) {
          [day, month, year] = [month, year, new Date().getFullYear().toString()];
        }
        
        // 處理兩位年份
        if (String(year).length === 2) {
          const yearNum = parseInt(year);
          year = yearNum < 50 ? '20' + year : '19' + year;
        }
        
        month = String(month).padStart(2, '0');
        day = String(day).padStart(2, '0');
        
        if (this.isValidDate(year, month, day)) {
          return `${year}-${month}-${day}`;
        }
        
        return null;
      },

      // 防抖函數
      debounce(func, delay) {
        let timeoutId;
        return (...args) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => func(...args), delay);
        };
      },

      // 錯誤處理工具
      handleError(error, context = '') {
        console.error(`DateChanger Error ${context}:`, error);
        const errorMessage = error.message || '未知錯誤';
        
        if (errorMessage.includes('CORS') || errorMessage.includes('網路')) {
          return '網路連線問題或跨域請求被阻擋';
        }
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          return '授權失敗，請重新登入';
        }
        if (errorMessage.includes('403')) {
          return '權限不足';
        }
        if (errorMessage.includes('500')) {
          return '伺服器內部錯誤';
        }
        
        return errorMessage;
      }
    },

    /**
     * UI 相關方法
     */
    ui: {
      create() {
        const html = `
          <style id="dc-style">
            /* 基礎樣式重構 */
            #dc-container { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
              color: #333; 
            }
            #dc-container * { 
              box-sizing: border-box; 
            }
            
            /* 主視窗樣式優化 */
            .dc-window { 
              position: fixed; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              width: 360px; 
              max-width: 90vw;
              background: #fff; 
              border-radius: 12px; 
              box-shadow: 0 8px 32px rgba(0,0,0,0.18); 
              z-index: 99999; 
              overflow: hidden; 
              display: flex; 
              flex-direction: column; 
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
              border: 1px solid #e1e5e9;
            }
            
            /* 最小化狀態優化 */
            .dc-window.minimized { 
              width: 64px; 
              height: 64px; 
              border-radius: 50%; 
              cursor: pointer; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              background: linear-gradient(135deg, #007aff 0%, #0056b3 100%); 
              color: white; 
              font-weight: 700; 
              font-size: 13px; 
              text-align: center; 
              line-height: 1.2; 
              border: 2px solid rgba(255,255,255,0.2);
              box-shadow: 0 4px 20px rgba(0, 122, 255, 0.4);
            }
            
            .dc-window.minimized .dc-header, 
            .dc-window.minimized .dc-status, 
            .dc-window.minimized .dc-content { 
              display: none; 
            }
            
            .dc-minimized-content { 
              display: none; 
            }
            
            .dc-window.minimized .dc-minimized-content { 
              display: block; 
            }
            
            /* 標題列樣式改善 */
            .dc-header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              padding: 12px 16px; 
              background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%); 
              border-bottom: 1px solid #dee2e6; 
              cursor: move; 
              font-weight: 600; 
              font-size: 14px; 
              color: #495057;
              user-select: none;
            }
            
            .dc-header-controls { 
              display: flex; 
              gap: 6px; 
            }
            
            .dc-control-btn { 
              border: none; 
              background: none; 
              font-size: 16px; 
              cursor: pointer; 
              color: #6c757d; 
              padding: 4px 8px; 
              border-radius: 4px; 
              transition: all 0.2s ease; 
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
            }
            
            .dc-control-btn:hover { 
              color: #495057; 
              background: rgba(0,0,0,0.05); 
              transform: scale(1.1);
            }
            
            /* 狀態列樣式改善 */
            .dc-status { 
              text-align: center; 
              font-size: 13px; 
              font-weight: 500; 
              padding: 10px 16px; 
              min-height: 20px; 
              transition: all 0.3s ease;
            }
            
            .dc-status.error {
              color: #721c24; 
              background-color: #f8d7da; 
              border-bottom: 1px solid #f5c6cb;
            }
            
            .dc-status.success {
              color: #155724; 
              background-color: #d4edda; 
              border-bottom: 1px solid #c3e6cb;
            }
            
            .dc-status:empty { 
              display: none; 
            }
            
            /* 內容區域樣式優化 */
            .dc-content { 
              padding: 20px; 
              display: flex; 
              flex-direction: column; 
              gap: 18px; 
            }
            
            .dc-row { 
              display: flex; 
              align-items: center; 
              justify-content: space-between; 
              gap: 12px; 
            }
            
            .dc-date-info { 
              flex: 1; 
              min-width: 0;
            }
            
            .dc-label { 
              font-weight: 500; 
              color: #6c757d; 
              font-size: 12px; 
              margin-bottom: 6px;
              letter-spacing: 0.5px;
            }
            
            .dc-date-value { 
              font-weight: 700; 
              font-size: 18px; 
              color: #007aff; 
              font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
              letter-spacing: 0.5px;
            }
            
            /* 輸入框區域樣式重構 */
            .dc-input-wrapper { 
              position: relative; 
              display: flex; 
              align-items: stretch;
            }
            
            .dc-date-input { 
              flex: 1;
              border: 2px solid #e9ecef; 
              border-radius: 8px; 
              padding: 12px 85px 12px 16px; 
              font-size: 16px; 
              color: #28a745; 
              font-weight: 600; 
              transition: all 0.2s ease; 
              background: #f8f9fa;
              font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            }
            
            .dc-date-input:focus { 
              border-color: #007aff; 
              box-shadow: 0 0 0 4px rgba(0, 123, 255, 0.1); 
              outline: none; 
              background: white;
            }
            
            .dc-date-input:disabled {
              opacity: 0.6;
              cursor: not-allowed;
              background: #e9ecef;
            }
            
            /* 按鈕樣式優化 */
            .dc-btn { 
              padding: 8px 16px; 
              border: none; 
              border-radius: 6px; 
              cursor: pointer; 
              font-weight: 600; 
              font-size: 13px; 
              transition: all 0.2s ease; 
              white-space: nowrap;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 36px;
            }
            
            .dc-btn:disabled { 
              opacity: 0.5; 
              cursor: not-allowed; 
              transform: none;
            }
            
            .dc-btn:not(:disabled):hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .dc-btn-primary { 
              background: linear-gradient(135deg, #007aff 0%, #0056b3 100%); 
              color: white; 
            }
            
            .dc-btn-danger { 
              background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
              color: white; 
            }
            
            .dc-btn-success { 
              background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
              color: white; 
            }
            
            .dc-btn-success.hidden { 
              display: none; 
            }
            
            .dc-action-buttons { 
              display: flex; 
              align-items: center; 
              gap: 8px;
              flex-shrink: 0;
            }
            
            .dc-btn-inset { 
              position: absolute; 
              right: 8px; 
              top: 50%; 
              transform: translateY(-50%); 
              padding: 8px 16px;
              z-index: 1;
            }
            
            /* 響應式設計 */
            @media (max-width: 480px) {
              .dc-window {
                width: 95vw;
                margin: 0 2.5vw;
              }
              
              .dc-content {
                padding: 16px;
                gap: 16px;
              }
              
              .dc-row {
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
              }
              
              .dc-action-buttons {
                justify-content: flex-end;
              }
            }
          </style>
          <div id="dc-container">
            <div id="dc-window" class="dc-window">
              <div class="dc-header">
                <span>系統日設定工具</span>
                <div class="dc-header-controls">
                  <button id="dc-minimize" class="dc-control-btn" title="最小化" aria-label="最小化">─</button>
                  <button id="dc-close" class="dc-control-btn" title="關閉" aria-label="關閉">×</button>
                </div>
              </div>
              <div id="dc-status" class="dc-status" role="alert" aria-live="polite"></div>
              <div class="dc-content">
                <div class="dc-row">
                  <div class="dc-date-info">
                    <div class="dc-label">目前生效日期 (businessDate)</div>
                    <div id="dc-businessDateDisplay" class="dc-date-value">讀取中...</div>
                  </div>
                  <div class="dc-action-buttons">
                    <button id="dc-retryBtn" class="dc-btn dc-btn-success hidden" aria-label="重新讀取">重試</button>
                    <button id="dc-deleteBtn" class="dc-btn dc-btn-danger" aria-label="刪除我的業務日期">刪除</button>
                  </div>
                </div>
                <div class="dc-input-wrapper">
                  <input 
                    type="text" 
                    id="dc-dateInput" 
                    class="dc-date-input" 
                    placeholder="YYYY-MM-DD 或 +/-天數"
                    aria-label="日期輸入"
                    autocomplete="off"
                    spellcheck="false"
                  >
                  <button id="dc-setBtn" class="dc-btn dc-btn-primary dc-btn-inset" aria-label="設定日期">設定</button>
                </div>
              </div>
              <div id="dc-minimized-content" class="dc-minimized-content"></div>
            </div>
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
      },

      cacheDom() {
        const query = (selector) => {
          const element = document.querySelector(selector);
          if (!element) {
            console.warn(`DateChanger: 找不到元素 ${selector}`);
          }
          return element;
        };
        
        DateChanger.dom = {
          container: query('#dc-container'),
          window: query('#dc-window'),
          header: query('.dc-header'),
          status: query('#dc-status'),
          dateInput: query('#dc-dateInput'),
          setBtn: query('#dc-setBtn'),
          deleteBtn: query('#dc-deleteBtn'),
          retryBtn: query('#dc-retryBtn'),
          closeBtn: query('#dc-close'),
          minimizeBtn: query('#dc-minimize'),
          minimizedContent: query('#dc-minimized-content'),
          businessDateDisplay: query('#dc-businessDateDisplay'),
        };
      },

      updateStatus(text, type = '') {
        const { status } = DateChanger.dom;
        if (!status) return;
        
        status.textContent = text;
        status.className = `dc-status ${type}`;
        
        if (text && type === 'success') {
          setTimeout(() => {
            if (status.textContent === text) {
              status.textContent = '';
              status.className = 'dc-status';
            }
          }, DateChanger.config.SUCCESS_MESSAGE_TIMEOUT);
        }
      },

      setLoading(isLoading) {
        DateChanger.state.isLoading = isLoading;
        const { setBtn, deleteBtn, retryBtn, dateInput } = DateChanger.dom;
        
        if (setBtn) {
          setBtn.disabled = isLoading;
          setBtn.textContent = isLoading ? '處理中...' : '設定';
        }
        if (deleteBtn) deleteBtn.disabled = isLoading;
        if (retryBtn) retryBtn.disabled = isLoading;
        if (dateInput) dateInput.disabled = isLoading;
      },

      updateView() {
        const { state } = DateChanger;
        const { businessDateDisplay, dateInput, minimizedContent } = DateChanger.dom;
        
        businessDateDisplay.textContent = state.businessDate || '讀取失敗';
        
        const lastDate = localStorage.getItem(DateChanger.config.STORAGE_KEYS.LAST_DATE) || DateChanger.utils.getEndOfCurrentYear();
        dateInput.value = state.myBusinessDate || lastDate;
        
        if (state.businessDate && state.businessDate !== '讀取失敗') {
          const dateParts = state.businessDate.split('-');
          if (dateParts.length === 3) {
            minimizedContent.textContent = `${dateParts[1]}/${dateParts[2]}`;
          } else {
            minimizedContent.textContent = 'N/A';
          }
        } else {
          minimizedContent.textContent = 'N/A';
        }
      },

      toggleMinimize() {
        const { window } = DateChanger.dom;
        if (!window) return;
        
        const isMinimized = window.classList.toggle('minimized');
        localStorage.setItem(DateChanger.config.STORAGE_KEYS.MINIMIZED, String(isMinimized));
      },
    },

    /**
     * API 相關方法
     */
    api: {
      async request(endpoint, body = null) {
        const url = DateChanger.config.API_URL + endpoint;
        const options = {
          method: 'POST',
          headers: { 
            'Content-Type': 'text/plain', 
            'SSO-TOKEN': DateChanger.config.TOKEN 
          },
          body
        };
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超時
          
          const response = await fetch(url, { 
            ...options, 
            signal: controller.signal 
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return await response.json();
        } catch (error) {
          if (error.name === 'AbortError') {
            throw new Error('請求超時，請檢查網路連線');
          }
          throw error;
        }
      },

      async getBusinessDate() { 
        return DateChanger.api.request('getBusinessDate'); 
      },
      
      async setMyBusinessDate(date) { 
        return DateChanger.api.request('setMyBusinessDate', date); 
      },
      
      async deleteMyBusinessDate() { 
        return DateChanger.api.request('deleteMyBusinessDate'); 
      },
    },

    /**
     * 事件處理器
     */
    handlers: {
      async handleApiAction(action, { successMsg, errorMsg }) {
        if (DateChanger.state.isLoading) return;
        
        DateChanger.ui.setLoading(true);
        DateChanger.ui.updateStatus('', '');
        
        try {
          const result = await action();
          if (result) {
            await DateChanger.handlers.onLoad(successMsg);
          }
        } catch (error) {
          const friendlyError = DateChanger.utils.handleError(error, 'API Action');
          DateChanger.ui.updateStatus(friendlyError, 'error');
        } finally {
          DateChanger.ui.setLoading(false);
        }
      },

      async onLoad(successMsg = null) {
        if (DateChanger.state.isLoading && !successMsg) return;
        
        if (!successMsg) {
          DateChanger.state.isLoading = true;
          DateChanger.dom.retryBtn?.classList.add('hidden');
        }
        
        try {
          const data = await DateChanger.api.getBusinessDate();
          DateChanger.state.businessDate = data.businessDate;
          DateChanger.state.myBusinessDate = data.myBusinessDate;
          DateChanger.ui.updateView();
          
          if (successMsg) {
            DateChanger.ui.updateStatus(successMsg, 'success');
          }
        } catch (error) {
          DateChanger.state.businessDate = '讀取失敗';
          DateChanger.ui.updateView();
          
          const friendlyError = DateChanger.utils.handleError(error, 'Load Data');
          DateChanger.ui.updateStatus(friendlyError, 'error');
          DateChanger.dom.retryBtn?.classList.remove('hidden');
        } finally {
          if (!successMsg) {
            DateChanger.state.isLoading = false;
          }
        }
      },

      onSet() {
        const dateStr = DateChanger.dom.dateInput?.value?.trim();
        if (!dateStr) {
          DateChanger.ui.updateStatus('請輸入日期', 'error');
          return;
        }
        
        const formattedDate = DateChanger.utils.formatDateInput(dateStr);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
          DateChanger.ui.updateStatus('無效的日期格式，請使用 YYYY-MM-DD 格式', 'error');
          return;
        }
        
        DateChanger.dom.dateInput.value = formattedDate;
        localStorage.setItem(DateChanger.config.STORAGE_KEYS.LAST_DATE, formattedDate);
        
        DateChanger.handlers.handleApiAction(
          () => DateChanger.api.setMyBusinessDate(formattedDate),
          { successMsg: '日期設定成功！', errorMsg: '設定失敗' }
        );
      },

      onDelete() {
        DateChanger.handlers.handleApiAction(
          () => DateChanger.api.deleteMyBusinessDate(),
          { successMsg: '日期刪除成功！', errorMsg: '刪除失敗' }
        );
      },

      onClose() {
        if (DateChanger.state.autoRefreshInterval) {
          clearInterval(DateChanger.state.autoRefreshInterval);
        }
        DateChanger.dom.container?.remove();
        document.removeEventListener('keydown', DateChanger.handlers.onEscapeKey);
      },

      onDragStart(e) {
        if (DateChanger.dom.window?.classList.contains('minimized')) return;
        
        e.preventDefault();
        DateChanger.state.isDragging = true;
        
        const rect = DateChanger.dom.window.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        
        const onMouseMove = (moveEvent) => {
          if (!DateChanger.state.isDragging) return;
          
          const newX = moveEvent.clientX - offsetX;
          const newY = moveEvent.clientY - offsetY;
          
          // 確保視窗不會移出螢幕
          const maxX = window.innerWidth - DateChanger.dom.window.offsetWidth;
          const maxY = window.innerHeight - DateChanger.dom.window.offsetHeight;
          
          const boundedX = Math.max(0, Math.min(newX, maxX));
          const boundedY = Math.max(0, Math.min(newY, maxY));
          
          DateChanger.dom.window.style.left = `${boundedX}px`;
          DateChanger.dom.window.style.top = `${boundedY}px`;
          DateChanger.dom.window.style.transform = 'none';
        };
        
        const onMouseUp = () => {
          DateChanger.state.isDragging = false;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      },

      onEnterKey(e) { 
        if (e.key === 'Enter') {
          e.preventDefault();
          DateChanger.handlers.onSet(); 
        }
      },
      
      onEscapeKey(e) { 
        if (e.key === 'Escape') {
          DateChanger.handlers.onClose(); 
        }
      },
    },

    /**
     * 初始化方法
     */
    init() {
      try {
        this.ui.create();
        this.ui.cacheDom();
        
        // 檢查必要的DOM元素
        if (!this.dom.container || !this.dom.window) {
          throw new Error('無法創建必要的UI元素');
        }
        
        // 綁定事件監聽器
        this.bindEvents();
        
        // 恢復最小化狀態
        if (localStorage.getItem(this.config.STORAGE_KEYS.MINIMIZED) === 'true') {
          this.dom.window.classList.add('minimized');
        }
        
        // 初始載入資料
        this.handlers.onLoad();
        
        // 設定自動刷新
        this.state.autoRefreshInterval = setInterval(
          () => this.handlers.onLoad(), 
          this.config.AUTO_REFRESH_INTERVAL
        );
        
        console.log('系統日設定工具已成功啟動');
      } catch (error) {
        console.error('系統日設定工具初始化失敗:', error);
        alert('工具初始化失敗，請重新載入頁面後再試。');
      }
    },

    /**
     * 綁定所有事件監聽器
     */
    bindEvents() {
      const { dom, handlers } = this;
      
      // 視窗控制事件
      dom.header?.addEventListener('mousedown', handlers.onDragStart);
      dom.closeBtn?.addEventListener('click', handlers.onClose);
      dom.minimizeBtn?.addEventListener('click', this.ui.toggleMinimize);
      
      // 最小化視窗點擊恢復
      dom.window?.addEventListener('click', (e) => {
        if (e.target.id === 'dc-window' && dom.window.classList.contains('minimized')) {
          this.ui.toggleMinimize();
        }
      });
      
      // 按鈕事件
      dom.setBtn?.addEventListener('click', handlers.onSet);
      dom.deleteBtn?.addEventListener('click', handlers.onDelete);
      dom.retryBtn?.addEventListener('click', () => handlers.onLoad());
      
      // 輸入框事件 - 修正這裡：直接建立 debounced 函數
      const debouncedInput = this.utils.debounce((e) => {
        const value = e.target.value;
        const formatted = DateChanger.utils.formatDateInput(value);
        
        if (formatted !== value && /^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
          e.target.value = formatted;
        }
        
        localStorage.setItem(DateChanger.config.STORAGE_KEYS.LAST_DATE, e.target.value);
      }, this.config.DEBOUNCE_DELAY);
      
      dom.dateInput?.addEventListener('input', debouncedInput);
      dom.dateInput?.addEventListener('keydown', handlers.onEnterKey);
      
      // 全域鍵盤事件
      document.addEventListener('keydown', handlers.onEscapeKey);
    }
  };

  DateChanger.init();
})();
