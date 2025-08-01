(function () {
  'use strict';

  // === 設定參數（使用正確的API端點）===
  const config = {
    apiBase: 'https://euisv-uat.apps.tocp4.kgilife.com.tw',
    apiEndpoints: {
      queryPersonalCases: '/euisw/euisb/api/assign/queryPersonalCaseFromPool',
      fetchPersonnel: '/euisw/euisbq/api/org/findOrgEmp',
      assignCases: '/euisw/euisb/api/assign/assignManually'
    },
    pageSize: 50,
    uiId: 'personal-dispatcher-ui',
    tokenKeys: ['SSO-TOKEN', 'euisToken'],
    allowedRegex: /kgilife\.com\.tw/,
  };

  const state = {
    token: '',
    isBusy: false,
    isAuthorized: false,
    cases: [],
    selected: [],
    personnel: [],
  };

  // === 工具函式 ===
  const utils = {
    getToken() {
      for (const key of config.tokenKeys) {
        let token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (token && token.trim()) return token.trim();
      }
      return '';
    },
    setToken(token) {
      if (!token) return;
      localStorage.setItem(config.tokenKeys[0], token);
      state.token = token;
    },
    escape(text) {
      if (!text) return '';
      return String(text).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
    },
    showToast(msg, type='info', dur=2500) {
      const id = 'toast-dispatch';
      let toast = document.getElementById(id);
      if (toast) toast.remove();
      toast = document.createElement('div');
      toast.id = id;
      toast.textContent = msg;
      toast.style = `
        position:fixed;top:25px;left:50%;transform:translateX(-50%);z-index:99999999;
        background:${type==='error'?'#dc3545':'#007bff'};color:#fff;
        padding:8px 16px;border-radius:5px;font-size:14px;font-weight:600;
        pointer-events:none;
      `;
      document.body.appendChild(toast);
      setTimeout(()=>toast.remove(), dur);
    },
  };

  // === API 封裝（使用正確端點）===
  const api = {
    async doPost(path, data) {
      if (!state.token) throw new Error('無有效Token');
      const url = config.apiBase + path;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'SSO-TOKEN': state.token
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API錯誤(${res.status}): ${txt}`);
      }
      return res.json();
    },

    // 分頁抓取全部個人案件
    async fetchAllPersonalCases() {
      let allCases = [];
      let currentPage = 1;
      let totalPages = 1;
      
      while (currentPage <= totalPages) {
        const payload = {
          nowPage: currentPage,
          pageSize: config.pageSize,
          orderBy: 'assignId',
          ascOrDesc: 'desc'
        };
        
        const result = await this.doPost(config.apiEndpoints.queryPersonalCases, payload);
        console.log('第', currentPage, '頁資料:', result);
        
        if (!result || !result.records) break;
        allCases = allCases.concat(result.records);
        
        if (currentPage === 1 && result.total) {
          totalPages = Math.ceil(result.total / config.pageSize);
        }
        currentPage++;
      }
      return allCases;
    },

    async fetchPersonnelList() {
      const payload = { validDate: 'true', orderBys: ['userName asc', 'adAccount asc'] };
      const res = await this.doPost(config.apiEndpoints.fetchPersonnel, payload);
      // 處理不同的回傳結構
      if (Array.isArray(res)) return res;
      if (res.records) return res.records;
      if (res.data) return res.data;
      return [];
    },

    async assignCasesToPerson(caseNumbers, assigneeId) {
      const payload = {
        dispatchOrgAf: 'H',
        auditorAf: assigneeId,
        dispatchOrgBf: '',
        applyNumbers: caseNumbers
      };
      return this.doPost(config.apiEndpoints.assignCases, payload);
    }
  };

  // === UI 管理（縮小畫面尺寸）===
  const ui = {
    injectCSS() {
      if (document.getElementById(config.uiId + '-style')) return;
      const style = document.createElement('style');
      style.id = config.uiId + '-style';
      style.textContent = `
        #${config.uiId} {
          position: fixed;
          top: 10vh; left: 10vw; width: 80vw; height: 75vh; /* 縮小尺寸 */
          background: white;
          border-radius: 8px;
          box-shadow: 0 0 15px rgba(0,0,0,0.3);
          z-index: 9999999;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        #${config.uiId} header {
          padding: 10px 15px;
          background: #007bff;
          color: white;
          font-weight: bold;
          font-size: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
          border-radius: 8px 8px 0 0;
        }
        #${config.uiId} header button {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
        }
        #${config.uiId} main {
          flex-grow: 1;
          overflow-y: auto;
          padding: 15px;
        }
        #${config.uiId} table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        #${config.uiId} table th, #${config.uiId} table td {
          border: 1px solid #ddd;
          padding: 5px;
          text-align: left;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        #${config.uiId} table thead tr {
          background: #f8f9fa;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        #${config.uiId} tbody tr:hover {
          background-color: #f5faff;
          cursor: pointer;
        }
        #${config.uiId} #filterButtons {
          margin-bottom: 10px;
          user-select: none;
        }
        #${config.uiId} #filterButtons button {
          margin-right: 5px;
          padding: 4px 8px;
          border: 1px solid #007bff;
          background: white;
          color: #007bff;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        #${config.uiId} #filterButtons button.active {
          background: #007bff;
          color: white;
        }
        #${config.uiId} footer {
          padding: 10px 15px;
          text-align: right;
          border-top: 1px solid #ccc;
        }
        #${config.uiId} footer button {
          margin-left: 8px;
          padding: 6px 14px;
          border: none;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          background: #007bff;
          color: white;
        }
        #${config.uiId} footer button:disabled {
          background: #a2c6f2;
          cursor: default;
        }
        #${config.uiId} .manual-input {
          margin-top: 10px;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 5px;
          border: 1px solid #ddd;
        }
        #${config.uiId} .manual-input input {
          width: 100%;
          padding: 5px;
          margin-top: 5px;
        }
      `;
      document.head.appendChild(style);
    },

    createUI(title) {
      this.injectCSS();
      this.removeUI();
      const container = document.createElement('div');
      container.id = config.uiId;
      container.innerHTML = `
        <header>
          <div>${title}</div>
          <button aria-label="關閉" id="btnClose">&times;</button>
        </header>
        <main><p>載入中，請稍候...</p></main>
        <footer></footer>
      `;
      document.body.appendChild(container);
      container.querySelector('#btnClose').addEventListener('click', () => this.removeUI());
      return container;
    },

    removeUI() {
      const el = document.getElementById(config.uiId);
      if (el) el.remove();
    },

    showLauncher() {
      const container = this.createUI('個人案件派件工具');
      const main = container.querySelector('main');
      const footer = container.querySelector('footer');
      
      main.innerHTML = `
        <p>點擊下方按鈕載入您的個人案件並進行派件操作</p>
      `;
      footer.innerHTML = `
        <button id="btnToken">變更Token</button>
        <button id="btnStart">開始載入案件</button>
      `;
      
      container.querySelector('#btnToken').onclick = this.showTokenInput.bind(this);
      container.querySelector('#btnStart').onclick = handlers.loadCases;
    },

    showTokenInput() {
      const container = this.createUI('變更Token');
      const main = container.querySelector('main');
      const footer = container.querySelector('footer');
      
      main.innerHTML = `
        <p>請輸入新的Token：</p>
        <textarea id="tokenInput" style="width:100%;height:80px;"></textarea>
      `;
      footer.innerHTML = `
        <button id="btnBack">返回</button>
        <button id="btnSave">儲存</button>
      `;
      
      container.querySelector('#btnBack').onclick = this.showLauncher.bind(this);
      container.querySelector('#btnSave').onclick = () => {
        const token = container.querySelector('#tokenInput').value.trim();
        if (!token) {
          utils.showToast('請輸入Token', 'error');
          return;
        }
        utils.setToken(token);
        utils.showToast('Token已更新');
        this.showLauncher();
      };
    },

    renderCases(cases) {
      const container = this.createUI('選擇個人案件');
      const main = container.querySelector('main');
      const footer = container.querySelector('footer');

      if (!cases.length) {
        main.innerHTML = '<p>找不到案件。</p>';
        footer.innerHTML = `<button id="btnBack">返回</button>`;
        container.querySelector('#btnBack').onclick = this.showLauncher.bind(this);
        return;
      }

      // 製作狀態篩選按鈕
      const statusCount = {};
      for (const c of cases) {
        const status = c.assignStatusDesc || c.mainStatus || '未知';
        statusCount[status] = (statusCount[status] || 0) + 1;
      }
      
      let filterBtnsHtml = '';
      for (const status in statusCount) {
        filterBtnsHtml += `<button data-status="${utils.escape(status)}">${utils.escape(status)} (${statusCount[status]})</button>`;
      }
      filterBtnsHtml += `<button data-status="all" class="active">全部</button>`;

      main.innerHTML = `
        <div id="filterButtons">${filterBtnsHtml}</div>
        <table>
          <thead>
            <tr>
              <th><input id="chkAll" type="checkbox"></th>
              <th>要保號</th>
              <th>要保人</th>
              <th>被保人</th>
              <th>案件狀態</th>
            </tr>
          </thead>
          <tbody>
            ${cases.map(c => `
              <tr data-status="${utils.escape(c.assignStatusDesc || c.mainStatus || '未知')}">
                <td><input class="chkCase" type="checkbox" value="${utils.escape(c.applyNumber)}"></td>
                <td>${utils.escape(c.applyNumber)}</td>
                <td>${utils.escape(c.ownerName || c.policyHolderName || '')}</td>
                <td>${utils.escape(c.insuredName || '')}</td>
                <td>${utils.escape(c.assignStatusDesc || c.mainStatus || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div id="selectionInfo">已選0筆 / 共${cases.length}筆</div>
      `;

      footer.innerHTML = `
        <button id="btnBack">返回</button>
        <button id="btnNext" disabled>下一步</button>
      `;

      // 綁定事件
      this.bindCaseEvents(container, cases);
    },

    bindCaseEvents(container, cases) {
      const filterButtons = container.querySelectorAll('#filterButtons button');
      const chkAll = container.querySelector('#chkAll');
      const caseCheckboxes = container.querySelectorAll('.chkCase');
      const selectionInfo = container.querySelector('#selectionInfo');
      const btnBack = container.querySelector('#btnBack');
      const btnNext = container.querySelector('#btnNext');

      btnBack.onclick = this.showLauncher.bind(this);
      btnNext.onclick = handlers.gotoSelectPersonnel;

      function updateSelection() {
        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => 
          cb.closest('tr').style.display !== 'none');
        const checkedBoxes = visibleCheckboxes.filter(cb => cb.checked);
        
        selectionInfo.textContent = `已選${checkedBoxes.length}筆 / 共${cases.length}筆`;
        btnNext.disabled = checkedBoxes.length === 0;
        
        chkAll.checked = visibleCheckboxes.length > 0 && 
          visibleCheckboxes.every(cb => cb.checked);
        chkAll.indeterminate = !chkAll.checked && checkedBoxes.length > 0;
        
        state.selected = checkedBoxes.map(cb => cb.value);
      }

      chkAll.onchange = () => {
        const visibleCheckboxes = Array.from(caseCheckboxes).filter(cb => 
          cb.closest('tr').style.display !== 'none');
        for (const cb of visibleCheckboxes) {
          cb.checked = chkAll.checked;
        }
        updateSelection();
      };

      for (const btn of filterButtons) {
        btn.onclick = () => {
          for (const b of filterButtons) b.classList.remove('active');
          btn.classList.add('active');
          const status = btn.getAttribute('data-status');
          for (const cb of caseCheckboxes) {
            const tr = cb.closest('tr');
            tr.style.display = (status === 'all' || 
              status === tr.getAttribute('data-status')) ? '' : 'none';
          }
          updateSelection();
        };
      }

      for (const cb of caseCheckboxes) {
        cb.onchange = updateSelection;
      }

      updateSelection();
    },

    renderPersonnelSelect(personnelList) {
      const container = this.createUI('選擇派件人員');
      const main = container.querySelector('main');
      const footer = container.querySelector('footer');

      let personnelHtml = '';
      if (personnelList.length > 0) {
        personnelHtml = `
          <label for="selPerson">請選擇派件人員：</label>
          <select id="selPerson" style="width:100%;padding:6px;margin-top:6px;">
            <option value="">請選擇...</option>
            ${personnelList.map(p => 
              `<option value="${utils.escape(p.adAccount)}">${utils.escape(p.userName)} (${utils.escape(p.adAccount)})</option>`
            ).join('')}
          </select>
        `;
      } else {
        personnelHtml = `<p style="color:#dc3545;">查無可用人員清單</p>`;
      }

      // 新增手動輸入功能
      main.innerHTML = `
        <p>您已選擇 ${state.selected.length} 筆案件。</p>
        ${personnelHtml}
        <div class="manual-input">
          <label><input type="checkbox" id="useManualInput"> 手動輸入人員帳號</label>
          <input type="text" id="manualPersonId" placeholder="請輸入人員帳號" 
                 style="display:none;" />
        </div>
      `;

      footer.innerHTML = `
        <button id="btnBack">返回</button>
        <button id="btnAssign" disabled>確認派件</button>
      `;

      const selPerson = container.querySelector('#selPerson');
      const useManualInput = container.querySelector('#useManualInput');
      const manualPersonId = container.querySelector('#manualPersonId');
      const btnBack = container.querySelector('#btnBack');
      const btnAssign = container.querySelector('#btnAssign');

      btnBack.onclick = () => this.renderCases(state.cases);
      btnAssign.onclick = handlers.assignSelectedCases;

      // 切換手動輸入模式
      useManualInput.onchange = () => {
        if (useManualInput.checked) {
          manualPersonId.style.display = 'block';
          if (selPerson) selPerson.disabled = true;
        } else {
          manualPersonId.style.display = 'none';
          if (selPerson) selPerson.disabled = false;
        }
        checkAssignButtonState();
      };

      function checkAssignButtonState() {
        if (useManualInput.checked) {
          btnAssign.disabled = !manualPersonId.value.trim();
        } else {
          btnAssign.disabled = !selPerson || !selPerson.value;
        }
      }

      if (selPerson) {
        selPerson.onchange = checkAssignButtonState;
      }
      manualPersonId.oninput = checkAssignButtonState;
    }
  };

  // === 事件處理 ===
  const handlers = {
    async loadCases() {
      if (state.isBusy) return;
      state.isBusy = true;
      utils.showToast('載入中，請稍候...');
      
      try {
        const cases = await api.fetchAllPersonalCases();
        state.cases = cases;
        state.selected = [];
        ui.renderCases(cases);
      } catch (e) {
        utils.showToast('載入失敗：' + e.message, 'error');
        console.error(e);
      }
      
      state.isBusy = false;
    },

    async gotoSelectPersonnel() {
      if (!state.selected.length) {
        utils.showToast('請先選擇案件', 'error');
        return;
      }
      
      utils.showToast('取得人員清單...');
      try {
        const personnel = await api.fetchPersonnelList();
        ui.renderPersonnelSelect(personnel);
      } catch (e) {
        utils.showToast('取得人員失敗，但可手動輸入', 'error');
        ui.renderPersonnelSelect([]); // 顯示手動輸入選項
      }
    },

    async assignSelectedCases() {
      if (!state.selected.length) {
        utils.showToast('請選擇案件', 'error');
        return;
      }

      const container = document.getElementById(config.uiId);
      const useManualInput = container.querySelector('#useManualInput');
      const selPerson = container.querySelector('#selPerson');
      const manualPersonId = container.querySelector('#manualPersonId');

      let assigneeId = '';
      if (useManualInput && useManualInput.checked) {
        assigneeId = manualPersonId.value.trim();
      } else if (selPerson) {
        assigneeId = selPerson.value;
      }

      if (!assigneeId) {
        utils.showToast('請選擇或輸入派件人員', 'error');
        return;
      }

      if (state.isBusy) return;
      state.isBusy = true;

      const btnAssign = container.querySelector('#btnAssign');
      btnAssign.disabled = true;
      btnAssign.textContent = '派件中...';
      
      utils.showToast('派件執行中...');

      try {
        await api.assignCasesToPerson(state.selected, assigneeId);
        utils.showToast(`成功派件 ${state.selected.length} 件`, 'info', 4000);
        ui.removeUI();
      } catch (e) {
        utils.showToast('派件失敗：' + e.message, 'error');
        btnAssign.disabled = false;
        btnAssign.textContent = '確認派件';
      }
      
      state.isBusy = false;
    }
  };

  // === 主程序啟動 ===
  function startApp() {
    if (document.getElementById(config.uiId)) {
      utils.showToast('工具已啟動');
      return;
    }
    
    state.isAuthorized = config.allowedRegex.test(location.hostname);
    state.token = utils.getToken();
    
    if (!state.token) {
      const token = prompt('請輸入您的 SSO-TOKEN');
      if (!token) return;
      utils.setToken(token.trim());
    }
    
    ui.showLauncher();
  }

  startApp();
})();
