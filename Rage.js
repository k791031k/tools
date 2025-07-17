好的，這就為您提供包含所有函式實作細節的最終完整程式碼。
這份程式碼是可以直接執行的最終版本，沒有任何省略。
javascript:(function() {
    'use strict';

    /**
     * @class InsuranceAgeCalculator
     * @description 一個專業的、物件導向的保險年齡計算工具。
     * @author Gemini (Refactored by a 30-year experience senior engineer)
     * @version 2.0 (Master Refactoring)
     */

    // App ID，用於 DOM 元素識別與防止重複執行
    const APP_ID = 'InsuranceAgeCalculatorPanel_Master';

    // === 防止重複執行，若已存在則銷毀舊實例 ===
    if (document.getElementById(APP_ID)) {
        const oldInstance = document.getElementById(APP_ID)._instance;
        // 呼叫舊實例的銷毀方法，確保清除所有事件與元素
        oldInstance?.destroy();
    }

    class InsuranceAgeCalculator {

        constructor() {
            /**
             * 靜態設定，定義 App 的核心常數
             * @type {object}
             */
            this.config = {
                appId: APP_ID,
                storageKeys: {
                    position: 'AgePanelPosition_v2',
                    settings: 'AgeSettings_v2',
                    history: 'insuranceCalcHistory_v2'
                },
                maxHistory: 50,
                sidePanelGap: 8
            };

            /**
             * 動態狀態管理，儲存所有會變動的資料
             * @type {object}
             */
            this.state = {
                panelPosition: { x: 40, y: 40 },
                appSettings: { yearType: '西元', ageType: '保險年齡' },
                isDragging: false,
                dragOffset: { x: 0, y: 0 },
                activeDragTarget: null,
                currentFocusedInput: null,
                lastEditedField: null,
                targetAgeForTable: null,
                ageInputTimeoutId: null,
                dateEditModes: {},
                currentTableTab: 0,
            };

            /**
             * DOM 元素快取，避免重複查詢
             * @type {object}
             */
            this.elements = {};
            
            /**
             * 計算結果快取，用於效能優化
             * @private
             */
            this._ageTableCache = { birthKey: null, data: [] };

            // 啟動 App
            this.init();
        }

        /**
         * 初始化應用程式
         */
        init() {
            try {
                this.loadStateFromStorage();
                this.injectCSS();
                this.buildMainPanel();
                this.bindGlobalEvents();
                this.updateUIFromState();
            } catch (error) {
                console.error("InsuranceAgeCalculator initialization failed:", error);
                alert("小工具初始化失敗，請檢查瀏覽器控制台日誌。");
            }
        }

        /**
         * 銷毀應用程式，清除所有 DOM 元素和事件監聽器，防止記憶體洩漏
         */
        destroy() {
            document.removeEventListener('mousemove', this.handleDragMove);
            document.removeEventListener('mouseup', this.handleDragEnd);
            document.removeEventListener('keydown', this.handleGlobalKeyPress);

            // 移除所有在 this.elements 中快取的 DOM 元素
            Object.keys(this.elements).forEach(key => {
                const el = this.elements[key];
                if (el instanceof HTMLElement && el.parentElement) {
                    el.remove();
                }
                delete this.elements[key];
            });
        }
        
        /**
         * 從 localStorage 載入使用者先前的設定與位置
         */
        loadStateFromStorage() {
            try {
                const savedPosition = JSON.parse(localStorage.getItem(this.config.storageKeys.position));
                if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
                    this.state.panelPosition = savedPosition;
                }

                const savedSettings = JSON.parse(localStorage.getItem(this.config.storageKeys.settings));
                if (savedSettings && savedSettings.yearType && savedSettings.ageType) {
                    this.state.appSettings = savedSettings;
                }
            } catch (error) {
                console.warn('Could not parse state from localStorage. Using defaults.', error);
            }
        }

        /**
         * 將狀態儲存到 localStorage
         * @param {string} key - 狀態的鍵名 ('position', 'settings', 'history')
         * @param {object} value - 要儲存的物件
         */
        saveState(key, value) {
            try {
                localStorage.setItem(this.config.storageKeys[key], JSON.stringify(value));
            } catch (error) {
                console.error(`Failed to save state for ${key}:`, error);
                this.showToast('儲存設定失敗', 'error');
            }
        }
        
        /**
         * 將所有 CSS 樣式動態注入到頁面的 <head> 中
         */
        injectCSS() {
            const style = this.createElem({tag: 'style', id: `${this.config.appId}-styles`});
            style.textContent = `
                /* Base Styles */
                .iac-panel, .iac-side-panel { position: fixed; z-index: 2147483646; background: #fff; border: 1px solid #e9eef2; border-radius: 10px; font-family: "Microsoft JhengHei", "Segoe UI", sans-serif; box-shadow: 0 8px 32px rgba(0,0,0,0.08); user-select: none; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; color: #212529; }
                .iac-panel-header { padding: 0 10px 0 20px; height: 45px; border-bottom: 1px solid #e9eef2; flex-shrink: 0; cursor: move; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; }
                .iac-panel-title { margin: 0; font-size: 16px; color: #007aff; font-weight: bold; }
                .iac-close-btn { background: transparent; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 0; line-height: 1; }
                .iac-panel-content { padding: 12px 16px 16px; flex-grow: 1; display: flex; flex-direction: column; }
                /* Form Elements */
                .iac-row { display: flex; align-items: center; margin-bottom: 8px; gap: 8px; }
                .iac-label { min-width: 70px; color: #5a6a7b; font-weight: 600; font-size: 14px; cursor: pointer; }
                .iac-input-container { flex: 1; display: flex; align-items: center; gap: 4px; position: relative; }
                .iac-input-wrapper { position: relative; flex: 1; }
                .iac-input { width: 100%; padding: 8px 28px 8px 10px; height: 36px; box-sizing: border-box; border: 1px solid #e1e8ed; border-radius: 8px; font-size: 14px; background: #f8f9fa; color: #212529; font-weight: bold; transition: all 0.2s; outline: none; }
                .iac-input:focus { border-color: #80bdff; box-shadow: 0 0 0 3px rgba(0,123,255,0.15); }
                .iac-hover-clear-btn { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; font-size: 10px; border: none; border-radius: 50%; background: #ff6b6b; color: #fff; cursor: pointer; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10; display: none; }
                .iac-input-wrapper:hover .iac-input:not(:placeholder-shown) + .iac-hover-clear-btn { display: flex; }
                .iac-hover-clear-btn:hover { background: #ff5252; }
                /* Buttons */
                .iac-btn { padding: 0 8px; height: 30px; font-size: 14px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
                .iac-btn-card { border: 1px solid #e9eef2; background: #f1f5f9; color: #495057; }
                .iac-btn-card:hover { background: #e9eef2; }
                .iac-btn-calc { background: linear-gradient(145deg, #007bff, #0056b3); color: #fff; border: none; font-weight: bold; }
                .iac-btn-calc:hover { background: linear-gradient(145deg, #0069d9, #004085); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3); }
                .iac-btn-edit { padding: 4px 6px; height: 28px; font-size: 12px; border: 1px solid #e1e8ed; border-radius: 6px; background: #f1f5f9; color: #495057; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 28px; }
                .iac-btn-edit:hover { background: #e9eef2; }
                .iac-btn-edit-confirm { background: #007aff; color: #fff; }
                /* Toggle Switch */
                .iac-toggle-switch { display: inline-flex; border: 1px solid #e1e8ed; border-radius: 8px; background: #f1f5f9; padding: 2px; height: 30px; box-sizing: border-box; }
                .iac-toggle-option { padding: 0; font-size: 13px; text-align: center; cursor: pointer; transition: all 0.25s ease; border-radius: 6px; display: flex; align-items: center; justify-content: center; height: 100%; background: transparent; color: #007aff; font-weight: 600; }
                .iac-toggle-option.active { background: #007aff; color: #fff; font-weight: bold; }
                /* Display & Toast */
                .iac-display-row-val { flex: 1; padding: 0 10px; font-size: 13px; font-weight: bold; color: #0056b3; background: rgba(0, 122, 255, 0.07); border-radius: 8px; text-align: center; height: 34px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; white-space: nowrap; }
                .iac-toast { position: fixed; z-index: 2147483648; background: #fff; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); padding: 10px 20px; font-weight: bold; font-size: 14px; transition: all 0.4s ease-out; text-align: center; opacity: 0; transform: translateY(0px); display: flex; align-items: center; gap: 8px; }
                .iac-toast.success { color: #28a745; border: 1.5px solid #28a745; }
                .iac-toast.error { color: #dc3545; border: 1.5px solid #dc3545; }
                /* Date Segment Editor */
                .iac-date-segment-container { display: flex; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid #e1e8ed; border-radius: 8px; background: #f8f9fa; height: 36px; box-sizing: border-box; flex: 1; }
                .iac-date-segment { display: flex; flex-direction: column; align-items: center; gap: 1px; }
                .iac-date-segment-btn { width: 20px; height: 10px; font-size: 8px; border: none; background: #007aff; color: #fff; cursor: pointer; border-radius: 2px; display: flex; align-items: center; justify-content: center; line-height: 1; }
                .iac-date-segment-input { height: 16px; text-align: center; border: none; background: transparent; font-size: 13px; font-weight: bold; outline: none; padding: 0; }
                .iac-date-segment-separator { font-size: 14px; color: #5a6a7b; font-weight: bold; }
                /* Side Panels */
                .iac-side-panel .iac-panel-content { overflow-y: auto; padding: 0; }
                .iac-history-item { padding: 10px; border-bottom: 1px solid #e9eef2; cursor: pointer; border-radius: 7px; margin-bottom: 4px; transition: background-color 0.2s; }
                .iac-history-item:hover { background-color: #e9eef2; }
                .iac-side-panel .iac-panel-content-padded { padding: 8px; }
                /* Age Comparison Table */
                .iac-age-table-controls { padding: 8px; flex-shrink: 0; border-bottom: 1px solid #e9eef2; }
                .iac-age-table-tabs { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; background: #e9eef2; padding: 4px 8px; flex-shrink: 0; }
                .iac-age-table-tab { padding: 4px 0; font-size: 11px; border: none; border-radius: 6px; background: transparent; color: #5a6a7b; font-weight: bold; cursor: pointer; transition: all 0.2s; }
                .iac-age-table-tab.active { background: #007aff; color: #fff; }
                .iac-age-table-wrapper { flex-grow: 1; overflow-y: auto; padding: 0 8px; }
                .iac-age-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
                .iac-age-table thead { position: sticky; top: 0; z-index: 10; background-color: #fff; }
                .iac-age-table th { padding: 8px 2px; border-bottom: 2px solid #007aff; color: #007aff; font-weight: bold; font-size: 12px; }
                .iac-age-table td { padding: 6px 2px; border-bottom: 1px solid #e9eef2; text-align: center; font-size: 12px; word-break: break-all; transition: background-color 0.3s; }
                .iac-age-table tr.is-target-row td { background-color: rgba(255, 236, 179, 0.8); font-weight: bold; }
                .iac-age-table td.is-target-col { background-color: rgba(0, 122, 255, 0.07); }
                .iac-age-table tr.is-past td { color: #90a4ae; background-color: #fcfcfc; }
            `;
            document.head.appendChild(style);
            this.elements.styleTag = style;
        }

        /**
         * 創建 DOM 元素的輔助函式
         * @param {object} options - 元素選項
         * @returns {HTMLElement}
         */
        createElem({tag, id = '', className = '', textContent = '', innerHTML = '', ...props } = {}, style = {}) {
            const el = document.createElement(tag);
            if (id) el.id = id;
            if (className) el.className = className;
            if (textContent) el.textContent = textContent;
            if (innerHTML) el.innerHTML = innerHTML;
            Object.assign(el, props);
            Object.assign(el.style, style);
            return el;
        }

        /**
         * 建立主面板 UI
         */
        buildMainPanel() {
            const panel = this.createElem({
                tag: 'div', id: this.config.appId, className: 'iac-panel',
                _instance: this
            }, {
                left: `${this.state.panelPosition.x}px`, top: `${this.state.panelPosition.y}px`,
                width: '300px', height: '420px'
            });

            const header = this.createElem({tag: 'div', className: 'iac-panel-header'});
            header.addEventListener('mousedown', e => this.handleDragStart(e, panel));
            const title = this.createElem({tag: 'h3', className: 'iac-panel-title', textContent: '保險年齡小工具'});
            const closeBtn = this.createElem({tag: 'button', className: 'iac-close-btn', textContent: '×'});
            closeBtn.onclick = () => this.destroy();
            header.append(title, closeBtn);

            const content = this.createElem({tag: 'div', className: 'iac-panel-content'});
            
            const settingsContainer = this.createElem({tag: 'div', className: 'iac-row', style: { justifyContent: 'space-between', marginBottom: '12px' } });
            const yearTypeSwitch = this.createToggleSwitch(['西元', '民國'], this.state.appSettings.yearType, this.handleYearTypeChange.bind(this), [55, 55]);
            const ageTypeSwitch = this.createToggleSwitch(['實際年齡', '保險年齡'], this.state.appSettings.ageType, (val) => this.handleAgeTypeChange(val, false), [80, 80]);
            this.elements.yearTypeSwitch = yearTypeSwitch;
            this.elements.ageTypeSwitch = ageTypeSwitch;
            settingsContainer.append(yearTypeSwitch, ageTypeSwitch);

            const inputContainer = this.createElem({tag: 'div', style: { marginBottom: 'auto' } });

            const ageRow = this.createInputRow(this.state.appSettings.ageType, 'number', '請輸入年齡', 3, 'age');
            this.elements.ageLabel = ageRow.label;
            
            const quickAgeWrapper = this.createElem({tag: 'div', style: { padding: '0 0 8px 78px' } });
            const quickAgeContainer = this.createElem({tag: 'div', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } });
            ['07', '15', '45', '65', '80'].forEach(age => {
                const btn = this.createQuickAgeButton(age, () => this.handleQuickAgeClick(age));
                quickAgeContainer.appendChild(btn);
            });
            quickAgeWrapper.appendChild(quickAgeContainer);
            
            const effectiveRow = this.createInputRow('計算迄日', 'text', 'YYYY-MM-DD', 10, 'effectiveDate');
            this.elements.effectiveDateInputContainer = effectiveRow.inputContainer;
            
            const birthRow = this.createInputRow('出生日期', 'text', 'YYYY-MM-DD', 10, 'birthDate');
            this.elements.birthDateInputContainer = birthRow.inputContainer;

            const separator = this.createElem({tag: 'div', style: { height: '1.5px', background: '#e9eef2', margin: '10px 0' } });
            
            const preciseAgeRow = this.createDisplayRow('實際足歲');
            this.elements.preciseAgeDisplay = preciseAgeRow.valueSpan;
            const ageRangeRow = this.createDisplayRowWithSubLabel('年齡區間');
            this.elements.ageRangeDisplay = ageRangeRow.valueSpan;
            this.elements.ageRangeSubLabel = ageRangeRow.subLabel;
            
            inputContainer.append(ageRow.row, quickAgeWrapper, effectiveRow.row, birthRow.row, separator, preciseAgeRow.row, ageRangeRow.row);
            
            const buttonContainer = this.createElem({tag: 'div', style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginTop: '2px' } });
            buttonContainer.append(
                this.createCardButton('紀錄', () => this.showHistoryPanel()),
                this.createCardButton('期間', () => this.showAgeRange()),
                this.createCardButton('清除', () => this.handleClearAll()),
                this.createCardButton('今天', () => this.handleSetToday()),
                this.createCardButton('計算', () => this.handleSmartCalculate(), true)
            );

            content.append(settingsContainer, inputContainer, buttonContainer);
            panel.append(header, content);

            document.body.appendChild(panel);
            this.elements.mainPanel = panel;
        }

        createInputRow(labelText, inputType, placeholder, maxLength, fieldName) {
            const row = this.createElem({tag: 'div', className: 'iac-row'});
            const label = this.createElem({tag: 'label', className: 'iac-label', textContent: labelText });
            label.onclick = () => this.copyToClipboard(this.elements[fieldName + 'Input']?.value);
            
            const inputContainer = this.createElem({tag: 'div', className: 'iac-input-container' });
            this.elements[fieldName + 'InputContainer'] = inputContainer;

            this.toggleDateEditMode(fieldName, false); // Initial render as standard input

            if (fieldName === 'age') {
                this.elements.ageInput.addEventListener('input', () => {
                    this.state.lastEditedField = 'age';
                    clearTimeout(this.state.ageInputTimeoutId);
                    this.state.ageInputTimeoutId = setTimeout(() => {
                        if (document.activeElement === this.elements.ageInput) this.handleSmartCalculate();
                    }, 500);
                });
            }

            row.append(label, inputContainer);
            return { row, label };
        }
        
        createDisplayRow(labelText) {
            const row = this.createElem({tag: 'div', className: 'iac-row', style: { marginBottom: '6px', minHeight: '34px' }});
            const label = this.createElem({tag: 'label', className: 'iac-label', textContent: labelText });
            const valueSpan = this.createElem({tag: 'span', className: 'iac-display-row-val' });
            row.append(label, valueSpan);
            return { row, valueSpan };
        }
        
        createDisplayRowWithSubLabel(labelText) {
            const row = this.createElem({tag: 'div', className: 'iac-row', style: { marginBottom: '6px', minHeight: '34px', alignItems: 'flex-start' }});
            const labelWrapper = this.createElem({tag: 'div', style: { minWidth: '70px', textAlign: 'left' } });
            const label = this.createElem({tag: 'div', textContent: labelText, style: { color: '#5a6a7b', fontWeight: '600', fontSize: '14px', lineHeight: '1.2' } });
            const subLabel = this.createElem({tag: 'div', style: { fontSize: '12px', color: '#007aff' } });
            labelWrapper.append(label, subLabel);
            const valueSpan = this.createElem({tag: 'span', className: 'iac-display-row-val' });
            row.append(labelWrapper, valueSpan);
            return { row, valueSpan, subLabel };
        }
        
        createToggleSwitch(options, initialValue, onToggle, widths) {
            const container = this.createElem({tag: 'div', className: 'iac-toggle-switch' });
            options.forEach((option, idx) => {
                const el = this.createElem({tag: 'div', className: `iac-toggle-option ${option === initialValue ? 'active' : ''}`, textContent: option }, { width: `${widths[idx]}px` });
                el.dataset.value = option;
                el.onclick = () => {
                    if (el.classList.contains('active')) return;
                    container.querySelector('.active')?.classList.remove('active');
                    el.classList.add('active');
                    onToggle(option);
                };
                container.appendChild(el);
            });
            return container;
        }
        
        createCardButton(text, onClick, isCalc = false) {
            const btn = this.createElem({tag: 'button', className: `iac-btn ${isCalc ? 'iac-btn-calc' : 'iac-btn-card'}`, textContent: text });
            btn.onclick = onClick;
            return btn;
        }
        
        createQuickAgeButton(age, onClick) {
            const btn = this.createElem({tag: 'button', className: 'iac-btn', textContent: age, style: { padding: '0 8px', height: '22px', fontSize: '12px', border: '1px solid #d0d9e8', background: 'transparent', color: '#007aff' } });
            btn.onmouseover = () => btn.style.background = '#e9eef2';
            btn.onmouseout = () => btn.style.background = 'transparent';
            btn.onclick = onClick;
            return btn;
        }

        bindGlobalEvents() {
            this.handleDragMove = this.handleDragMove.bind(this);
            this.handleDragEnd = this.handleDragEnd.bind(this);
            this.handleGlobalKeyPress = this.handleGlobalKeyPress.bind(this);

            document.addEventListener('mousemove', this.handleDragMove);
            document.addEventListener('mouseup', this.handleDragEnd);
            document.addEventListener('keydown', this.handleGlobalKeyPress);
        }

        handleDragStart(e, targetPanel) {
            e.preventDefault();
            this.state.activeDragTarget = targetPanel;
            const rect = targetPanel.getBoundingClientRect();
            this.state.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.state.isDragging = true;
            targetPanel.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            targetPanel.style.transition = 'none';
        }

        handleDragMove(e) {
            if (!this.state.isDragging || !this.state.activeDragTarget) return;
            e.preventDefault();
            const newPos = { x: e.clientX - this.state.dragOffset.x, y: e.clientY - this.state.dragOffset.y };
            this.state.activeDragTarget.style.left = `${newPos.x}px`;
            this.state.activeDragTarget.style.top = `${newPos.y}px`;
            
            if (this.state.activeDragTarget === this.elements.mainPanel) {
                this.state.panelPosition = newPos;
                this.repositionSidePanels();
            }
        }
        
        handleDragEnd() {
            if (!this.state.isDragging || !this.state.activeDragTarget) return;

            const target = this.state.activeDragTarget;
            target.style.cursor = '';
            target.querySelector('.iac-panel-header').style.cursor = 'move';
            target.style.transition = '';

            if (target === this.elements.mainPanel) {
                this.saveState('position', this.state.panelPosition);
            }
            
            this.state.isDragging = false;
            this.state.activeDragTarget = null;
            document.body.style.cursor = 'default';
        }

        handleGlobalKeyPress(e) {
            if (e.key === 'Escape') {
                if (this.elements.ageRangePanel || this.elements.historyPanel) {
                    this.elements.ageRangePanel?.remove();
                    this.elements.historyPanel?.remove();
                    delete this.elements.ageRangePanel;
                    delete this.elements.historyPanel;
                } else {
                    this.destroy();
                }
            }
        }
        
        handleYearTypeChange(newValue) {
            const oldYearType = this.state.appSettings.yearType;
            this.state.appSettings.yearType = newValue;

            ['effectiveDate', 'birthDate'].forEach(fieldName => {
                this.toggleDateEditMode(fieldName, false); // Exit edit mode
                const input = this.elements[fieldName + 'Input'];
                const curVal = this.formatFromDisplay(input.value);
                if (curVal) {
                    const converted = this.convertDate(curVal, oldYearType, newValue);
                    input.value = this.formatDateToDisplay(converted);
                }
            });

            this.saveState('settings', this.state.appSettings);
            this.showToast(`已切換至 ${newValue} 年制`);
            if (this.elements.birthDateInput.value) this.handleSmartCalculate();
            this.updateAgeRangePanel();
        }

        handleAgeTypeChange(newValue, fromTable = false) {
            this.state.appSettings.ageType = newValue;
            this.elements.ageLabel.textContent = newValue;
            this.saveState('settings', this.state.appSettings);
            if (!fromTable) this.showToast(`已切換至 ${newValue} 模式`);
            if (this.elements.birthDateInput.value) this.handleSmartCalculate();
            this.updateAgeRangePanel();
        }

        handleSetToday() {
            if (!this.state.currentFocusedInput || (this.state.currentFocusedInput.dataset.fieldName !== 'effectiveDate' && this.state.currentFocusedInput.dataset.fieldName !== 'birthDate')) {
                this.showToast('請先點擊一個日期欄位', 'error');
                return;
            }
            const fieldName = this.state.currentFocusedInput.dataset.fieldName;
            this.toggleDateEditMode(fieldName, false); // Make sure it's a standard input
            this.elements[fieldName + 'Input'].value = this.formatDateToDisplay(this.formatDate(new Date(), this.state.appSettings.yearType));
            this.state.lastEditedField = fieldName;
            this.showToast(`已設定為今日日期 (${this.state.appSettings.yearType})`);
            if (this.elements.birthDateInput.value) this.handleSmartCalculate();
        }

        handleClearAll() {
            this.elements.ageInput.value = '';
            this.toggleDateEditMode('effectiveDate', false);
            this.toggleDateEditMode('birthDate', false);
            this.elements.effectiveDateInput.value = this.formatDateToDisplay(this.formatDate(new Date(), this.state.appSettings.yearType));
            this.elements.birthDateInput.value = '';
            this.elements.preciseAgeDisplay.textContent = '';
            this.elements.ageRangeDisplay.textContent = '';
            this.elements.ageRangeSubLabel.textContent = '';
            this.state.currentFocusedInput = null;
            this.state.targetAgeForTable = null;
            this.state.lastEditedField = null;
            this.state.dateEditModes = {};
            this.showToast('已清除所有資料');
            this.updateAgeRangePanel();
        }

        handleQuickAgeClick(age) {
            this.elements.ageInput.value = age;
            this.state.lastEditedField = 'age';
            this.handleSmartCalculate();
        }
        
        handleSmartCalculate() {
            const effDateStr = this.formatFromDisplay(this.elements.effectiveDateInput.value);
            const birthDateStr = this.formatFromDisplay(this.elements.birthDateInput.value);
            const ageStr = this.elements.ageInput.value;
            const expectedLen = this.state.appSettings.yearType === '西元' ? 8 : 7;
            let calculationPerformed = false;

            if (this.state.lastEditedField === 'age') {
                if (effDateStr.length === expectedLen && ageStr) {
                    if (this.calculateBirthDate()) { this.showToast('已依【年齡】反推【出生日期】'); calculationPerformed = true; }
                } else if(document.activeElement === this.elements.ageInput) { this.showToast('請確認【計算迄日】與【年齡】皆已輸入', 'error'); }
            } else if (this.state.lastEditedField === 'birthDate' || this.state.lastEditedField === 'effectiveDate') {
                if (effDateStr.length === expectedLen && birthDateStr.length === expectedLen) {
                    if (this.calculateAge()) { this.showToast('已依【日期】計算【年齡】'); calculationPerformed = true; }
                }
            }
            
            if (!calculationPerformed) {
                 if (effDateStr.length === expectedLen && birthDateStr.length === expectedLen) {
                    if (this.calculateAge()) this.showToast(`${this.state.appSettings.ageType} 計算完成`);
                } else if (effDateStr.length === expectedLen && ageStr) {
                    if (this.calculateBirthDate()) this.showToast('出生日期計算完成');
                } else if (birthDateStr.length === expectedLen && ageStr) {
                    if (this.calculateEffectiveDate()) this.showToast('計算迄日計算完成');
                } else {
                    this.showToast('請提供任意兩項有效資訊', 'error');
                }
            }
        }
        
        calculateAge() {
            const { yearType } = this.state.appSettings;
            const effDate = this.parseDate(this.elements.effectiveDateInput.value, yearType);
            const birthDate = this.parseDate(this.elements.birthDateInput.value, yearType);
            
            if (!effDate || !birthDate) { this.showToast('日期格式錯誤', 'error'); return false; }
            if (effDate < birthDate) { this.showToast('計算迄日不能早於出生日', 'error'); return false; }
            this.updateAllResults(birthDate, effDate);
            return true;
        }

        calculateBirthDate() {
            const targetAgeVal = parseInt(this.elements.ageInput.value, 10);
            const { yearType, ageType } = this.state.appSettings;
            const effDate = this.parseDate(this.elements.effectiveDateInput.value, yearType);

            if (isNaN(targetAgeVal) || targetAgeVal < 0 || !effDate) return false;

            let birthDate = new Date(effDate);
            if (ageType === '保險年齡') {
                birthDate.setFullYear(effDate.getFullYear() - targetAgeVal);
                birthDate.setMonth(birthDate.getMonth() + 6);
                birthDate.setDate(birthDate.getDate() + 1);
            } else {
                birthDate.setFullYear(effDate.getFullYear() - targetAgeVal);
            }
            
            this.toggleDateEditMode('birthDate', false);
            this.elements.birthDateInput.value = this.formatDateToDisplay(this.formatDate(birthDate, yearType));
            this.updateAllResults(birthDate, effDate);
            return true;
        }

        calculateEffectiveDate() {
            const targetAgeVal = parseInt(this.elements.ageInput.value, 10);
            const { yearType, ageType } = this.state.appSettings;
            const birthDate = this.parseDate(this.elements.birthDateInput.value, yearType);
            
            if (isNaN(targetAgeVal) || targetAgeVal < 0 || !birthDate) return false;

            let effDate = new Date(birthDate);
            if (ageType === '保險年齡') {
                effDate.setFullYear(birthDate.getFullYear() + targetAgeVal -1);
                effDate.setMonth(effDate.getMonth() + 6);
            } else {
                effDate.setFullYear(birthDate.getFullYear() + targetAgeVal);
            }
            
            this.toggleDateEditMode('effectiveDate', false);
            this.elements.effectiveDateInput.value = this.formatDateToDisplay(this.formatDate(effDate, yearType));
            this.updateAllResults(birthDate, effDate);
            return true;
        }

        updateAllResults(birthDate, effDate) {
            const { ageType, yearType } = this.state.appSettings;
            
            const actualAge = this.getActualAge(birthDate, effDate);
            const insuranceAge = this.getInsuranceAge(birthDate, effDate);
            this.state.targetAgeForTable = ageType === '實際年齡' ? actualAge : insuranceAge;

            const diff = this.calculatePreciseAgeDiff(birthDate, effDate);
            this.elements.preciseAgeDisplay.textContent = `${diff.years} 歲 ${diff.months} 月 ${diff.days} 日`;
            
            let finalAge, range, rangeText;
            if (ageType === '實際年齡') {
                finalAge = actualAge;
                range = this.getAgeRange(birthDate, actualAge);
            } else {
                finalAge = insuranceAge;
                range = this.getInsuranceAgeRangeFromTable(birthDate, effDate, finalAge) || this.getInsuranceAgeRangeFallback(birthDate, finalAge);
            }
            rangeText = `${this.formatDateToDisplay(this.formatDate(range.start, yearType))} ~ ${this.formatDateToDisplay(this.formatDate(range.end, yearType))}`;

            this.elements.ageInput.value = finalAge;
            this.elements.ageRangeDisplay.textContent = rangeText;
            this.elements.ageRangeSubLabel.textContent = `(${ageType})`;

            this.saveHistory(birthDate, effDate, finalAge, diff, rangeText);
            this.updateAgeRangePanel();
            if(this.elements.historyPanel) this.showHistoryPanel(true);
        }

        saveHistory(birthDate, effDate, finalAge, diff, rangeText) {
             try {
                let history = JSON.parse(localStorage.getItem(this.config.storageKeys.history) || '[]');
                const newRecord = {
                    timestamp: new Date().toISOString(),
                    effectiveDate: this.formatDateToDisplay(this.formatDate(effDate, this.state.appSettings.yearType)),
                    birthDate: this.formatDateToDisplay(this.formatDate(birthDate, this.state.appSettings.yearType)),
                    ...this.state.appSettings,
                    finalAge: finalAge,
                    preciseAge: `${diff.years} 歲 ${diff.months} 月 ${diff.days} 日`,
                    ageRange: rangeText
                };
                history.unshift(newRecord);
                if (history.length > this.config.maxHistory) history = history.slice(0, this.config.maxHistory);
                this.saveState('history', history);
            } catch (error) {
                console.warn("Failed to save history:", error);
            }
        }
        
        convertDate(dateStr, fromType, toType) {
            if (!dateStr || fromType === toType) return dateStr;
            const clean = dateStr.replace(/[^0-9]/g, '');
            if (fromType === '西元' && toType === '民國' && clean.length === 8) return `${parseInt(clean.substring(0, 4), 10) - 1911}`.padStart(3, '0') + clean.substring(4);
            if (fromType === '民國' && toType === '西元' && clean.length === 7) return `${parseInt(clean.substring(0, 3), 10) + 1911}` + clean.substring(3);
            return clean;
        }

        parseDate(dateStr, yearType) {
            const westernStr = this.convertDate(this.formatFromDisplay(dateStr), yearType, '西元');
            if (!/^\d{8}$/.test(westernStr)) return null;
            const y = parseInt(westernStr.substring(0, 4), 10);
            const m = parseInt(westernStr.substring(4, 6), 10) - 1;
            const d = parseInt(westernStr.substring(6, 8), 10);
            const dt = new Date(y, m, d);
            return (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) ? dt : null;
        }

        formatDate(date, yearType) {
            if (!(date instanceof Date) || isNaN(date)) return '';
            const y = date.getFullYear(), m = (date.getMonth() + 1).toString().padStart(2, '0'), d = date.getDate().toString().padStart(2, '0');
            const dispY = yearType === '西元' ? y.toString().padStart(4, '0') : (y - 1911).toString().padStart(3, '0');
            return `${dispY}${m}${d}`;
        }
        
        formatDateToDisplay(dateStr) {
            if (!dateStr) return '';
            const clean = dateStr.replace(/[^0-9]/g, '');
            if (clean.length === 8) return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
            if (clean.length === 7) return `${clean.substring(0, 3)}-${clean.substring(3, 5)}-${clean.substring(5, 7)}`;
            return dateStr;
        }

        formatFromDisplay(dateStr) { return dateStr.replace(/[^0-9]/g, ''); }

        calculatePreciseAgeDiff(start, end) {
            let y = end.getFullYear() - start.getFullYear(), m = end.getMonth() - start.getMonth(), d = end.getDate() - start.getDate();
            if (d < 0) { m--; d += new Date(end.getFullYear(), end.getMonth(), 0).getDate(); }
            if (m < 0) { y--; m += 12; }
            return { years: y, months: m, days: d };
        }
        
        getActualAge(birth, ref) { return this.calculatePreciseAgeDiff(birth, ref).years; }

        getInsuranceAge(birth, ref) {
            const diff = this.calculatePreciseAgeDiff(birth, ref);
            return diff.months > 6 || (diff.months === 6 && diff.days >= 1) ? diff.years + 1 : diff.years;
        }
        
        getAgeRange(birthDate, age) {
            const start = new Date(birthDate);
            start.setFullYear(birthDate.getFullYear() + age);
            const end = new Date(start);
            end.setFullYear(start.getFullYear() + 1);
            end.setDate(end.getDate() - 1);
            return { start, end };
        }
        
        getInsuranceAgeRangeFallback(birthDate, insuranceAge) {
            const start = new Date(birthDate);
            start.setFullYear(birthDate.getFullYear() + insuranceAge - 1);
            start.setMonth(start.getMonth() + 6);
            const end = new Date(birthDate);
            end.setFullYear(birthDate.getFullYear() + insuranceAge);
            end.setMonth(end.getMonth() + 6);
            end.setDate(end.getDate() - 1);
            return { start, end };
        }

        showToast(msg, type = 'success') {
            const toast = this.createElem({tag: 'div', className: `iac-toast ${type}`});
            const icon = this.createElem({tag: 'span', textContent: type === 'success' ? '✅' : '❌' });
            toast.append(icon, msg);
            document.body.appendChild(toast);

            const mainRect = this.elements.mainPanel?.getBoundingClientRect() || { top: 50, left: window.innerWidth / 2, width: 0 };
            const toastRect = toast.getBoundingClientRect();
            toast.style.left = `${mainRect.left + (mainRect.width / 2) - (toastRect.width / 2)}px`;
            toast.style.top = `${mainRect.top + 50}px`;

            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(10px)';
            }, 30);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(0px)';
                setTimeout(() => toast.remove(), 500);
            }, 2200);
        }

        async copyToClipboard(text) {
            if (!text) { this.showToast('內容為空，無法複製', 'error'); return; }
            try {
                if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); } 
                else { throw new Error('Clipboard API not available.'); }
                this.showToast(`已複製: ${text}`);
            } catch (err) {
                 const textArea = this.createElem({tag: 'textarea', value: text }, { position: 'fixed', top: '-9999px', left: '-9999px' });
                 document.body.appendChild(textArea);
                 textArea.select();
                 try { document.execCommand('copy'); this.showToast(`已複製: ${text}`); } 
                 catch (copyErr) { this.showToast('複製失敗', 'error'); console.error('Clipboard copy failed: ', err, copyErr); } 
                 finally { textArea.remove(); }
            }
        }
        
        toggleDateEditMode(fieldName, shouldEdit) {
            this.state.dateEditModes[fieldName] = shouldEdit;
            const inputContainer = this.elements[fieldName + 'InputContainer'];
            if (!inputContainer) return;
            
            const currentValue = this.elements[fieldName + 'Input']?.value || '';
            inputContainer.innerHTML = ''; 

            if (shouldEdit) {
                const segmentEditor = this.createDateSegmentInput(fieldName, currentValue);
                const confirmBtn = this.createElem({tag: 'button', className: 'iac-btn iac-btn-edit iac-btn-edit-confirm', textContent: '✓' });
                confirmBtn.onclick = () => this.toggleDateEditMode(fieldName, false);
                inputContainer.append(segmentEditor, confirmBtn);
            } else {
                const inputWrapper = this.createElem({tag: 'div', className: 'iac-input-wrapper' });
                const input = this.createElem({tag: 'input', className: 'iac-input', value: currentValue, 'data-field-name': fieldName });
                input.placeholder = this.state.appSettings.yearType === '西元' ? 'YYYY-MM-DD' : 'YYY-MM-DD';

                input.addEventListener('focus', () => this.state.currentFocusedInput = input);
                input.addEventListener('blur', e => {
                    const cleanValue = this.formatFromDisplay(e.target.value);
                    const expectedLen = this.state.appSettings.yearType === '西元' ? 8 : 7;
                    if (cleanValue.length === expectedLen) e.target.value = this.formatDateToDisplay(cleanValue);
                });
                input.addEventListener('input', () => this.state.lastEditedField = fieldName);

                const clearBtn = this.createElem({tag: 'button', className: 'iac-hover-clear-btn', textContent: '×' });
                clearBtn.onclick = () => { input.value = ''; this.updateAllResultsBasedOnInputs(); };
                
                inputWrapper.append(input, clearBtn);
                
                const editBtn = this.createElem({tag: 'button', className: 'iac-btn iac-btn-edit', textContent: '✏️' });
                editBtn.onclick = () => this.toggleDateEditMode(fieldName, true);

                inputContainer.append(inputWrapper, editBtn);
                this.elements[fieldName + 'Input'] = input;
            }
        }
        
        createDateSegmentInput(fieldName, currentValue) {
            const container = this.createElem({tag: 'div', className: 'iac-date-segment-container' });
            
            const clean = this.formatFromDisplay(currentValue);
            const isWestern = this.state.appSettings.yearType === '西元';
            let year, month, day;

            const dateToParse = (isWestern && clean.length === 8) || (!isWestern && clean.length === 7) ? clean : this.formatDate(new Date(), this.state.appSettings.yearType);
            year = isWestern ? dateToParse.substring(0, 4) : dateToParse.substring(0, 3);
            month = isWestern ? dateToParse.substring(4, 6) : dateToParse.substring(3, 5);
            day = isWestern ? dateToParse.substring(6, 8) : dateToParse.substring(5, 7);
            
            const segments = {};
            const createSegment = (value, maxLength, min, max, partName) => {
                const segmentContainer = this.createElem({tag: 'div', className: 'iac-date-segment' });
                const upBtn = this.createElem({tag: 'button', className: 'iac-date-segment-btn', textContent: '▲' });
                const input = this.createElem({tag: 'input', className: 'iac-date-segment-input', value: value, maxLength: maxLength }, { width: `${maxLength * 12}px` });
                const downBtn = this.createElem({tag: 'button', className: 'iac-date-segment-btn', textContent: '▼' });

                const updateMainInput = () => {
                    const y = segments.year.value.padStart(isWestern ? 4 : 3, '0');
                    const m = segments.month.value.padStart(2, '0');
                    const d = segments.day.value.padStart(2, '0');
                    const newValue = y + m + d;
                    
                    // Directly update the cached main input element
                    const mainInput = this.elements[fieldName + 'Input'];
                    if (mainInput) mainInput.value = this.formatDateToDisplay(newValue);
                    
                    this.state.lastEditedField = fieldName;
                    this.updateAllResultsBasedOnInputs();
                };

                const changeValue = (amount) => {
                    let val = parseInt(input.value, 10) || min;
                    val += amount;
                    if (partName === 'month') { if (val > 12) val = 1; if (val < 1) val = 12; }
                    else if (partName === 'day') { if (val > 31) val = 1; if (val < 1) val = 31; }
                    input.value = val.toString().padStart(maxLength, '0');
                    updateMainInput();
                };

                upBtn.onclick = () => changeValue(1);
                downBtn.onclick = () => changeValue(-1);
                input.addEventListener('input', () => { if (input.value.length >= maxLength) updateMainInput(); });
                input.addEventListener('blur', updateMainInput);

                segmentContainer.append(upBtn, input, downBtn);
                segments[partName] = input;
                return segmentContainer;
            };

            container.append(
                createSegment(year, isWestern ? 4 : 3, isWestern ? 1900 : 1, isWestern ? 2100 : 200, 'year'),
                this.createElem({tag: 'span', className: 'iac-date-segment-separator', textContent: '-' }),
                createSegment(month, 2, 1, 12, 'month'),
                this.createElem({tag: 'span', className: 'iac-date-segment-separator', textContent: '-' }),
                createSegment(day, 2, 1, 31, 'day')
            );
            return container;
        }

        createSidePanel(id, width, height) {
            if (this.elements[id]) { this.elements[id].remove(); delete this.elements[id]; this.repositionSidePanels(); return null; }
            const panel = this.createElem({tag: 'div', id, className: 'iac-side-panel'}, { width: `${width}px`, height: `${height}px`, top: `${this.state.panelPosition.y}px`, left: '-9999px', transition: 'left 0.3s ease-out, top 0.1s linear', });
            const header = this.createElem({tag: 'div', className: 'iac-panel-header'});
            header.addEventListener('mousedown', e => this.handleDragStart(e, panel));
            const content = this.createElem({tag: 'div', className: 'iac-panel-content'});
            panel.append(header, content);
            document.body.appendChild(panel);
            this.elements[id] = panel;
            return { panel, header, content };
        }

        repositionSidePanels() {
            const mainRect = this.elements.mainPanel.getBoundingClientRect();
            let lastRight = mainRect.right;
            ['ageRangePanel', 'historyPanel'].forEach(panelId => {
                const panel = this.elements[panelId];
                if(panel) {
                    panel.style.top = `${mainRect.top}px`;
                    panel.style.left = `${lastRight + this.config.sidePanelGap}px`;
                    lastRight += panel.offsetWidth + this.config.sidePanelGap;
                }
            });
        }
        
        showAgeRange() {
            const birthDate = this.parseDate(this.elements.birthDateInput.value, this.state.appSettings.yearType);
            if (!birthDate) { this.showToast('請先輸入有效的出生日期', 'error'); return; }
            const result = this.createSidePanel('ageRangePanel', 380, 420);
            if (!result) return;
            const { panel, header, content } = result;
            const title = this.createElem({tag: 'h3', className: 'iac-panel-title', textContent: '年齡區間比較表' });
            const closeBtn = this.createElem({tag: 'button', className: 'iac-close-btn', textContent: '×'});
            closeBtn.onclick = () => { panel.remove(); delete this.elements.ageRangePanel; };
            header.append(title, closeBtn);
            this.renderAgeComparisonTable(content, birthDate);
            this.repositionSidePanels();
        }
        
        updateAgeRangePanel() {
            if (!this.elements.ageRangePanel) return;
            const content = this.elements.ageRangePanel.querySelector('.iac-panel-content');
            const birthDate = this.parseDate(this.elements.birthDateInput.value, this.state.appSettings.yearType);
            if(content && birthDate) this.renderAgeComparisonTable(content, birthDate);
        }

        renderAgeComparisonTable(container) {
            container.innerHTML = '';
            const stickyContainer = this.createElem({tag: 'div', style: { display: 'flex', flexDirection: 'column', height: '100%' }});
            const controlContainer = this.createElem({tag: 'div', className: 'iac-age-table-controls' });
            const ageTypeSwitch = this.createToggleSwitch(['實際年齡', '保險年齡'], this.state.appSettings.ageType, (val) => this.handleAgeTypeChange(val, true), [80, 80]);
            controlContainer.appendChild(ageTypeSwitch);
            const tabContainer = this.createElem({tag: 'div', className: 'iac-age-table-tabs' });
            const ageRanges = [ {label: '0-10'}, {label: '11-20'}, {label: '21-30'}, {label: '31-40'}, {label: '41-50'}, {label: '51-60'}, {label: '61-70'}, {label: '71-80'} ];
            ageRanges.forEach((range, i) => {
                const btn = this.createElem({tag: 'button', className: 'iac-age-table-tab', textContent: range.label});
                btn.dataset.index = i;
                if (i === this.state.currentTableTab) btn.classList.add('active');
                btn.onclick = () => this.switchTableTab(i);
                tabContainer.appendChild(btn);
            });
            const tableWrapper = this.createElem({tag: 'div', className: 'iac-age-table-wrapper' });
            const table = this.createElem({tag: 'table', className: 'iac-age-table' });
            table.innerHTML = `<thead><tr><th style="width:18%">實際年齡</th><th style="width:18%">保險年齡</th><th style="width:32%">區間起始日</th><th style="width:32%">區間結束日</th></tr></thead><tbody></tbody>`;
            tableWrapper.appendChild(table);
            stickyContainer.append(controlContainer, tabContainer, tableWrapper);
            container.appendChild(stickyContainer);
            this.updateTableContent();
        }

        updateTableContent() {
            if (!this.elements.ageRangePanel) return;
            const tbody = this.elements.ageRangePanel.querySelector('tbody');
            const birthDate = this.parseDate(this.elements.birthDateInput.value, this.state.appSettings.yearType);
            if (!tbody || !birthDate) return;
            const referenceDate = this.parseDate(this.elements.effectiveDateInput.value, this.state.appSettings.yearType) || new Date();
            referenceDate.setHours(0,0,0,0);
            tbody.innerHTML = '';
            const allRows = this.getAgeComparisonTable(birthDate);
            const tabStartAge = this.state.currentTableTab * 10 + (this.state.currentTableTab > 0 ? 1 : 0);
            const tabEndAge = tabStartAge + (this.state.currentTableTab > 0 ? 9 : 10);
            const rowsForTab = allRows.filter(row => row.實際年齡 >= tabStartAge && row.實際年齡 <= tabEndAge);
            rowsForTab.forEach(row => {
                const tr = this.createElem({tag: 'tr'});
                const endDate = new Date(row.區間結束日.replace(/-/g, '/'));
                if (referenceDate > endDate) tr.classList.add('is-past');
                if (this.state.targetAgeForTable !== null && ((this.state.appSettings.ageType === '實際年齡' && row.實際年齡 === this.state.targetAgeForTable) || (this.state.appSettings.ageType === '保險年齡' && row.保險年齡 === this.state.targetAgeForTable))) tr.classList.add('is-target-row');
                ['實際年齡', '保險年齡', '區間起始日', '區間結束日'].forEach(key => {
                    const val = (key.includes('日')) ? this.formatDateToDisplay(this.formatDate(new Date(row[key].replace(/-/g, '/')), this.state.appSettings.yearType)) : row[key];
                    const td = this.createElem({tag: 'td', textContent: val});
                    if (this.state.appSettings.ageType === key) td.classList.add('is-target-col');
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            const highlightedRow = tbody.querySelector('.is-target-row');
            if(highlightedRow) setTimeout(() => highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
        
        switchTableTab(index) {
            this.state.currentTableTab = index;
            const tabContainer = this.elements.ageRangePanel.querySelector('.iac-age-table-tabs');
            tabContainer.querySelector('.active')?.classList.remove('active');
            tabContainer.querySelector(`[data-index="${index}"]`)?.classList.add('active');
            this.updateTableContent();
        }

        getAgeComparisonTable(birthDate) {
            const birthKey = birthDate.toISOString().split('T')[0];
            if (this._ageTableCache.birthKey === birthKey) return this._ageTableCache.data;
            const rows = [];
            const [y, m, d] = [birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate()];
            const pad = (n) => n.toString().padStart(2,'0');
            for (let age = 0; age <= 80; age++) {
                const thisBD = new Date(y + age, m, d);
                const plus6M = new Date(thisBD); plus6M.setMonth(plus6M.getMonth() + 6);
                const plus6M_1D = new Date(plus6M); plus6M_1D.setDate(plus6M.getDate() - 1);
                const nextBD = new Date(y + age + 1, m, d);
                const nextBD_1D = new Date(nextBD); nextBD_1D.setDate(nextBD.getDate() - 1);
                const formatDateStr = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;

                rows.push({ 區間起始日: formatDateStr(thisBD), 區間結束日: formatDateStr(plus6M_1D), 實際年齡: age, 保險年齡: age });
                rows.push({ 區間起始日: formatDateStr(plus6M), 區間結束日: formatDateStr(nextBD_1D), 實際年齡: age, 保險年齡: age + 1 });
            }
            this._ageTableCache = { birthKey, data: rows };
            return rows;
        }

        getInsuranceAgeRangeFromTable(birthDate, effectiveDate, insuranceAge) {
            const table = this.getAgeComparisonTable(birthDate);
            const effDateStr = `${effectiveDate.getFullYear()}-${(effectiveDate.getMonth() + 1).toString().padStart(2,'0')}-${effectiveDate.getDate().toString().padStart(2,'0')}`;
            const relevantRow = table.find(row => row.保險年齡 === insuranceAge && effDateStr >= row.區間起始日 && effDateStr <= row.區間結束日);
            if (relevantRow) return { start: new Date(relevantRow.區間起始日.replace(/-/g, '/')), end: new Date(relevantRow.區間結束日.replace(/-/g, '/')) };
            const firstMatchingRow = table.find(row => row.保險年齡 === insuranceAge);
            if (firstMatchingRow) return { start: new Date(firstMatchingRow.區間起始日.replace(/-/g, '/')), end: new Date(firstMatchingRow.區間結束日.replace(/-/g, '/')) };
            return null;
        }
        
        showHistoryPanel(isRefresh = false) {
             if (!isRefresh) {
                const result = this.createSidePanel('historyPanel', 280, 420);
                if (!result) return;
             }
             const panel = this.elements.historyPanel;
             if (!panel) return;
             const header = panel.querySelector('.iac-panel-header');
             const content = panel.querySelector('.iac-panel-content');
             header.innerHTML = ''; content.innerHTML = ''; content.classList.add('iac-panel-content-padded');
             const title = this.createElem({tag: 'h3', className: 'iac-panel-title', textContent: '計算歷史紀錄' });
             const buttonGroup = this.createElem({tag: 'div', style: { display: 'flex', alignItems: 'center', gap: '10px' }});
             const clearHistoryBtn = this.createElem({tag: 'button', textContent: '全部清除', style: { background: '#ffeded', color: '#c0392b', border: '1px solid #f5b7b1', padding: '2px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }});
             clearHistoryBtn.onclick = () => { localStorage.removeItem(this.config.storageKeys.history); this.showHistoryPanel(true); this.showToast('所有歷史紀錄已清除'); };
             const closeBtn = this.createElem({tag: 'button', className: 'iac-close-btn', textContent: '×' });
             closeBtn.onclick = () => { panel.remove(); delete this.elements.historyPanel; };
             buttonGroup.append(clearHistoryBtn, closeBtn);
             header.append(title, buttonGroup);
             const history = JSON.parse(localStorage.getItem(this.config.storageKeys.history) || '[]');
             if (history.length === 0) { content.innerHTML = '<div style="text-align:center; padding: 24px; color: #888;">尚無任何紀錄。</div>'; } 
             else {
                 history.forEach(rec => {
                     const recDiv = this.createElem({tag: 'div', className: 'iac-history-item' });
                     recDiv.onclick = () => {
                         this.handleAgeTypeChange(rec.ageType, true);
                         this.handleYearTypeChange(rec.yearType);
                         
                         const newAgeTypeSwitch = this.createToggleSwitch(['實際年齡', '保險年齡'], rec.ageType, (val) => this.handleAgeTypeChange(val, false), [80, 80]);
                         this.elements.ageTypeSwitch.replaceWith(newAgeTypeSwitch);
                         this.elements.ageTypeSwitch = newAgeTypeSwitch;

                         const newYearTypeSwitch = this.createToggleSwitch(['西元', '民國'], rec.yearType, this.handleYearTypeChange.bind(this), [55, 55]);
                         this.elements.yearTypeSwitch.replaceWith(newYearTypeSwitch);
                         this.elements.yearTypeSwitch = newYearTypeSwitch;
                         
                         this.toggleDateEditMode('effectiveDate', false);
                         this.toggleDateEditMode('birthDate', false);
                         this.elements.effectiveDateInput.value = rec.effectiveDate;
                         this.elements.birthDateInput.value = rec.birthDate;
                         this.calculateAge();
                     };
                     const time = new Date(rec.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
                     recDiv.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;color:#5a6a7b;margin-bottom:6px;"><span>${rec.ageType}(${rec.yearType})</span><span>${time}</span></div><div style="font-weight:bold;font-size:13px;"><span style="color:#007aff;">${rec.finalAge}歲</span> - ${rec.preciseAge}</div><div style="font-size:12px;color:#0056b3;margin-top:4px;">${rec.ageRange}</div>`;
                     content.appendChild(recDiv);
                 });
             }
             if (!isRefresh) this.repositionSidePanels();
         }
        
        updateAllResultsBasedOnInputs() {
            const effDateStr = this.formatFromDisplay(this.elements.effectiveDateInput.value);
            const birthDateStr = this.formatFromDisplay(this.elements.birthDateInput.value);
            const expectedLen = this.state.appSettings.yearType === '西元' ? 8 : 7;
            if (effDateStr.length === expectedLen && birthDateStr.length === expectedLen) {
                this.calculateAge();
            }
        }

        updateUIFromState() {
            const { yearType, ageType } = this.state.appSettings;
            this.elements.ageLabel.textContent = ageType;
            this.toggleDateEditMode('effectiveDate', false);
            this.toggleDateEditMode('birthDate', false);
            this.elements.effectiveDateInput.value = this.formatDateToDisplay(this.formatDate(new Date(), yearType));
        }
    }

    // 啟動應用程式
    new InsuranceAgeCalculator();

})();

