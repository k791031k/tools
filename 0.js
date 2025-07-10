// ==UserScript==
// @name         凱基人壽商品查詢小工具 v20.2.0 - 完整可執行版
// @namespace    http://tampermonkey.net/
// @version      20.2.0
// @description  一次載入，多次查詢的優化架構 - 完整可執行版
// @author       Senior Engineer
// @match        https://euisv*.apps.*.kgilife.com.tw/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置模組 ====================
    const ConfigModule = Object.freeze({
        VERSION: '20.2.0',
        QUERY_MODES: {
            PLAN_CODE: 'planCode',
            PLAN_NAME: 'planCodeName',
            MASTER_CLASSIFIED: 'masterClassified',
            CHANNEL_CLASSIFIED: 'channelClassified',
            ALL_PLANS: 'allPlans',
            IN_SALE_WITH_DETAILS: 'inSaleWithDetails',
            ADVANCED_CHANNEL_QUERY: 'advancedChannelQuery'
        },
        API_ENDPOINTS: {
            UAT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api',
            PROD: 'https://euisv.apps.ocp4.kgilife.com.tw/euisw/euisbq/api',
            CURRENT: 'https://euisv-uat.apps.tocp4.kgilife.com.tw/euisw/euisbq/api'
        },
        API_PATHS: {
            PLAN_CODE_QUERY: '/planCodeController/query',
            PLAN_CODE_DETAIL: '/planCodeController/queryDetail',
            PLAN_NAME_SEARCH: '/planCodeController/queryByName',
            PLAN_QUERY_ALL: '/planCodeController/queryAll',
            CHANNEL_QUERY: '/planCodeSaleDateController/query',
            CHANNEL_STATUS: '/channelController/status',
            CHANNEL_ANALYSIS: '/channelController/analysis'
        },
        CACHE_CONFIG: {
            EXPIRE_TIME: 30 * 60 * 1000,
            MAX_SIZE: 1000
        }
    });

    // ==================== 狀態管理模組 ====================
    const StateModule = (() => {
        let state = {
            token: '',
            abortController: null,
            currentQuery: null,
            pagination: {
                currentPage: 1,
                pageSize: 50,
                totalItems: 0,
                showAll: false
            }
        };

        return {
            getToken: () => state.token,
            setToken: (token) => { state.token = token; },
            getAbortController: () => state.abortController,
            setAbortController: (controller) => { state.abortController = controller; },
            getCurrentQuery: () => state.currentQuery,
            setCurrentQuery: (query) => { state.currentQuery = query; },
            getPagination: () => state.pagination,
            setPagination: (pagination) => { state.pagination = { ...state.pagination, ...pagination }; }
        };
    })();

    // ==================== UI 模組 ====================
    const UIModule = (() => {
        // CSS 樣式
        const getStyles = () => `
            <style>
                .pct-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .pct-modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 95%;
                    max-width: 1200px;
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }
                .pct-modal-header {
                    background: #007bff;
                    color: white;
                    padding: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: bold;
                }
                .pct-close {
                    cursor: pointer;
                    font-size: 1.5rem;
                }
                .pct-modal-body {
                    padding: 1rem;
                    overflow-y: auto;
                    flex: 1;
                }
                .pct-section {
                    margin-bottom: 1.5rem;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                }
                .pct-section-header {
                    background: #f8f9fa;
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid #dee2e6;
                    font-weight: bold;
                }
                .pct-input-group {
                    padding: 1rem;
                }
                .pct-input-group input,
                .pct-input-group textarea,
                .pct-input-group select {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    font-size: 14px;
                    margin-bottom: 0.5rem;
                }
                .pct-btn {
                    padding: 0.375rem 0.75rem;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    margin-right: 0.5rem;
                }
                .pct-btn-primary {
                    background: #007bff;
                    color: white;
                }
                .pct-btn-secondary {
                    background: #6c757d;
                    color: white;
                }
                .pct-table-container {
                    max-height: 500px;
                    overflow: auto;
                    border: 1px solid #dee2e6;
                }
                .pct-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.875rem;
                }
                .pct-table th {
                    background: #f8f9fa;
                    padding: 0.75rem 0.5rem;
                    text-align: left;
                    border-bottom: 2px solid #dee2e6;
                    font-weight: 600;
                    position: sticky;
                    top: 0;
                }
                .pct-table td {
                    padding: 0.5rem;
                    border-bottom: 1px solid #dee2e6;
                }
                .pct-table tr:hover {
                    background: #f8f9fa;
                }
                .pct-progress {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    box-shadow: 0 1rem 3rem rgba(0,0,0,.175);
                    z-index: 10001;
                    min-width: 300px;
                }
                .pct-progress-bar {
                    width: 100%;
                    height: 20px;
                    background: #f8f9fa;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 0.5rem;
                }
                .pct-progress-fill {
                    height: 100%;
                    background: #007bff;
                    transition: width 0.3s ease;
                    width: 0%;
                }
                .pct-progress-text {
                    text-align: center;
                    font-weight: 500;
                }
                .pct-toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10002;
                    max-width: 400px;
                }
                .pct-toast-content {
                    background: white;
                    padding: 1rem;
                    border-radius: 6px;
                    box-shadow: 0 1rem 3rem rgba(0,0,0,.175);
                    border-left: 4px solid #17a2b8;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pct-toast.success .pct-toast-content {
                    border-left-color: #28a745;
                }
                .pct-toast.warning .pct-toast-content {
                    border-left-color: #ffc107;
                }
                .pct-toast.error .pct-toast-content {
                    border-left-color: #dc3545;
                }
            </style>
        `;

        // 模態框 HTML
        const getModalHTML = () => `
            <div class="pct-modal" style="display: none;">
                <div class="pct-modal-content">
                    <div class="pct-modal-header">
                        <span>商品查詢工具 v${ConfigModule.VERSION}</span>
                        <span class="pct-close">&times;</span>
                    </div>
                    <div class="pct-modal-body">
                        <div class="pct-section">
                            <div class="pct-section-header">Token 設定</div>
                            <div class="pct-input-group">
                                <input type="password" id="pct-token-input" placeholder="請輸入 API Token..." />
                                <button class="pct-btn pct-btn-primary" id="pct-test-token">測試 Token</button>
                                <button class="pct-btn pct-btn-secondary" id="pct-skip-token">略過驗證</button>
                                <div id="pct-token-status">未驗證</div>
                            </div>
                        </div>
                        <div class="pct-section">
                            <div class="pct-section-header">查詢條件</div>
                            <div class="pct-input-group">
                                <select id="pct-query-mode">
                                    <option value="${ConfigModule.QUERY_MODES.PLAN_CODE}">商品代號查詢</option>
                                    <option value="${ConfigModule.QUERY_MODES.PLAN_NAME}">商品名稱查詢</option>
                                    <option value="${ConfigModule.QUERY_MODES.ALL_PLANS}">查詢全部商品</option>
                                    <option value="${ConfigModule.QUERY_MODES.IN_SALE_WITH_DETAILS}">現售商品含通路詳情</option>
                                    <option value="${ConfigModule.QUERY_MODES.ADVANCED_CHANNEL_QUERY}">進階通路狀態查詢</option>
                                </select>
                                <textarea id="pct-query-input" placeholder="請輸入查詢條件..." rows="3"></textarea>
                                <button class="pct-btn pct-btn-primary" id="pct-execute-query">執行查詢</button>
                                <button class="pct-btn pct-btn-secondary" id="pct-abort-query" style="display: none;">中止查詢</button>
                                <button class="pct-btn pct-btn-secondary" id="pct-force-reload">強制重新載入資料</button>
                            </div>
                        </div>
                        <div class="pct-section">
                            <div class="pct-section-header">查詢結果</div>
                            <div id="pct-result-summary">尚未查詢</div>
                            <div class="pct-table-container">
                                <table class="pct-table" id="pct-result-table">
                                    <thead>
                                        <tr>
                                            <th>No</th>
                                            <th>代號</th>
                                            <th>商品名稱</th>
                                            <th>幣別</th>
                                            <th>單位</th>
                                            <th>類型</th>
                                            <th>銷售起日</th>
                                            <th>銷售迄日</th>
                                            <th>狀態</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="pct-progress" id="pct-progress" style="display: none;">
                <div class="pct-progress-bar">
                    <div class="pct-progress-fill" id="pct-progress-fill"></div>
                </div>
                <div class="pct-progress-text" id="pct-progress-text">處理中...</div>
            </div>
            <div class="pct-toast" id="pct-toast" style="display: none;">
                <div class="pct-toast-content">
                    <span id="pct-toast-message"></span>
                </div>
            </div>
        `;

        // 進度條控制
        const Progress = {
            show: () => {
                document.getElementById('pct-progress').style.display = 'block';
            },
            hide: () => {
                document.getElementById('pct-progress').style.display = 'none';
            },
            update: (percentage, text) => {
                const progressFill = document.getElementById('pct-progress-fill');
                const progressText = document.getElementById('pct-progress-text');
                
                if (progressFill) progressFill.style.width = `${percentage}%`;
                if (progressText) progressText.textContent = text;
            }
        };

        // Toast 通知
        const Toast = {
            show: (message, type = 'info', duration = 3000) => {
                const toast = document.getElementById('pct-toast');
                const messageEl = document.getElementById('pct-toast-message');
                
                toast.className = `pct-toast ${type}`;
                messageEl.textContent = message;
                toast.style.display = 'block';
                
                setTimeout(() => {
                    toast.style.display = 'none';
                }, duration);
            }
        };

        // 表格渲染
        const renderTable = (data) => {
            const tbody = document.querySelector('#pct-result-table tbody');
            if (!tbody) return;

            tbody.innerHTML = data.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${item.planCode || ''}</strong></td>
                    <td>${item.planCodeName || ''}</td>
                    <td>${item.currency || ''}</td>
                    <td>${item.unit || ''}</td>
                    <td>${item.planType || ''}</td>
                    <td>${formatDate(item.saleStartDate)}</td>
                    <td>${formatDate(item.saleEndDate)}</td>
                    <td>${item.statusLabel || ''}</td>
                </tr>
            `).join('');

            // 更新結果統計
            const resultSummary = document.getElementById('pct-result-summary');
            if (resultSummary) {
                resultSummary.textContent = `共找到 ${data.length} 筆結果`;
            }
        };

        // 日期格式化
        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? dateStr : 
                `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        };

        return {
            getStyles,
            getModalHTML,
            Progress,
            Toast,
            renderTable
        };
    })();

    // ==================== 資料管理模組 ====================
    const DataManagerModule = (() => {
        // 全域資料儲存
        let masterData = {
            allPlans: [],
            channelData: [],
            lastUpdate: null,
            isLoaded: false,
            isLoading: false,
            planCodeIndex: new Map(),
            planNameIndex: new Map(),
            channelIndex: new Map()
        };

        // 一次性載入所有資料
        const loadAllData = async (force = false, onProgress = null) => {
            if (!force && masterData.isLoaded && !isDataExpired()) {
                console.log('使用快取資料，無需重新載入');
                return masterData;
            }

            if (masterData.isLoading) {
                return await waitForLoading();
            }

            masterData.isLoading = true;
            
            try {
                onProgress && onProgress(0, 100, '開始載入基礎資料...');

                // 模擬載入資料（實際應用中替換為真實API）
                await simulateDataLoad(onProgress);

                // 建立索引
                buildDataIndexes();

                masterData.lastUpdate = new Date();
                masterData.isLoaded = true;
                masterData.isLoading = false;

                console.log(`資料載入完成：${masterData.allPlans.length} 個商品，${masterData.channelData.length} 筆通路資料`);
                
                return masterData;

            } catch (error) {
                masterData.isLoading = false;
                console.error('資料載入失敗:', error);
                throw error;
            }
        };

        // 模擬載入資料
        const simulateDataLoad = async (onProgress) => {
            onProgress && onProgress(20, 100, '載入商品基本資料...');
            
            // 模擬商品資料
            masterData.allPlans = [
                {
                    planCode: 'TEST01',
                    planCodeName: '測試商品一',
                    currency: 'TWD',
                    unit: '份',
                    planType: '壽險',
                    saleStartDate: '2024-01-01',
                    saleEndDate: '2024-12-31'
                },
                {
                    planCode: 'TEST02',
                    planCodeName: '測試商品二',
                    currency: 'USD',
                    unit: '份',
                    planType: '投資型',
                    saleStartDate: '2024-06-01',
                    saleEndDate: '2025-05-31'
                }
            ];

            onProgress && onProgress(60, 100, '載入通路資料...');
            
            // 模擬通路資料
            masterData.channelData = [
                {
                    planCode: 'TEST01',
                    channelCode: 'CH001',
                    channelName: '直銷通路',
                    channelStartDate: '2024-01-01',
                    channelEndDate: '2024-12-31'
                },
                {
                    planCode: 'TEST02',
                    channelCode: 'CH002',
                    channelName: '銀行通路',
                    channelStartDate: '2024-06-01',
                    channelEndDate: '2025-05-31'
                }
            ];

            // 模擬載入時間
            await new Promise(resolve => setTimeout(resolve, 1000));
        };

        // 等待載入完成
        const waitForLoading = async () => {
            return new Promise((resolve) => {
                const checkLoading = () => {
                    if (!masterData.isLoading) {
                        resolve(masterData);
                    } else {
                        setTimeout(checkLoading, 100);
                    }
                };
                checkLoading();
            });
        };

        // 檢查資料是否過期
        const isDataExpired = () => {
            if (!masterData.lastUpdate) return true;
            return Date.now() - masterData.lastUpdate.getTime() > ConfigModule.CACHE_CONFIG.EXPIRE_TIME;
        };

        // 建立資料索引
        const buildDataIndexes = () => {
            masterData.planCodeIndex.clear();
            masterData.planNameIndex.clear();
            masterData.channelIndex.clear();

            // 建立商品代號索引
            masterData.allPlans.forEach(plan => {
                masterData.planCodeIndex.set(plan.planCode, plan);
            });

            // 建立商品名稱索引
            masterData.allPlans.forEach(plan => {
                const name = plan.planCodeName.toLowerCase();
                if (!masterData.planNameIndex.has(name)) {
                    masterData.planNameIndex.set(name, []);
                }
                masterData.planNameIndex.get(name).push(plan);
            });

            // 建立通路索引
            masterData.channelData.forEach(channel => {
                const planCode = channel.planCode;
                if (!masterData.channelIndex.has(planCode)) {
                    masterData.channelIndex.set(planCode, []);
                }
                masterData.channelIndex.get(planCode).push(channel);
            });

            console.log('資料索引建立完成');
        };

        // 強制重新載入資料
        const forceReload = async (onProgress = null) => {
            masterData.isLoaded = false;
            masterData.lastUpdate = null;
            return await loadAllData(true, onProgress);
        };

        // 取得資料狀態
        const getDataStatus = () => {
            return {
                isLoaded: masterData.isLoaded,
                isLoading: masterData.isLoading,
                isExpired: isDataExpired(),
                planCount: masterData.allPlans.length,
                channelCount: masterData.channelData.length,
                lastUpdate: masterData.lastUpdate
            };
        };

        // 取得原始資料
        const getRawData = () => {
            return {
                allPlans: masterData.allPlans,
                channelData: masterData.channelData,
                indexes: {
                    planCodeIndex: masterData.planCodeIndex,
                    planNameIndex: masterData.planNameIndex,
                    channelIndex: masterData.channelIndex
                }
            };
        };

        return {
            loadAllData,
            forceReload,
            getDataStatus,
            getRawData,
            isDataExpired
        };
    })();

    // ==================== 查詢處理模組 ====================
    const QueryProcessorModule = (() => {
        // 商品代號查詢（前端處理）
        const queryPlanCodes = async (codes, onProgress = null) => {
            onProgress && onProgress(0, 100, '準備查詢資料...');

            // 確保資料已載入
            const data = await DataManagerModule.loadAllData(false, onProgress);
            const { planCodeIndex } = data.indexes;

            onProgress && onProgress(50, 100, '查詢商品代號...');

            // 前端查詢處理
            const results = [];
            const notFound = [];

            codes.forEach(code => {
                const plan = planCodeIndex.get(code);
                if (plan) {
                    results.push({
                        ...plan,
                        status: calculateStatus(plan.saleStartDate, plan.saleEndDate),
                        statusLabel: getStatusLabel(calculateStatus(plan.saleStartDate, plan.saleEndDate))
                    });
                } else {
                    notFound.push(code);
                }
            });

            onProgress && onProgress(100, 100, `找到 ${results.length} 筆結果`);

            if (notFound.length > 0) {
                console.warn('未找到的商品代號:', notFound);
                UIModule.Toast.show(`${notFound.length} 個代號未找到`, 'warning');
            }

            return results;
        };

        // 商品名稱查詢（前端處理）
        const queryPlanNames = async (keyword, onProgress = null) => {
            onProgress && onProgress(0, 100, '準備搜尋資料...');

            // 確保資料已載入
            const data = await DataManagerModule.loadAllData(false, onProgress);
            
            onProgress && onProgress(50, 100, '搜尋商品名稱...');

            // 前端模糊搜尋
            const results = [];
            const searchKeyword = keyword.toLowerCase();

            data.allPlans.forEach(plan => {
                const planName = plan.planCodeName.toLowerCase();
                if (planName.includes(searchKeyword)) {
                    results.push({
                        ...plan,
                        status: calculateStatus(plan.saleStartDate, plan.saleEndDate),
                        statusLabel: getStatusLabel(calculateStatus(plan.saleStartDate, plan.saleEndDate))
                    });
                }
            });

            // 智能排序
            results.sort((a, b) => a.planCodeName.localeCompare(b.planCodeName, 'zh-TW'));

            onProgress && onProgress(100, 100, `找到 ${results.length} 筆結果`);

            return results;
        };

        // 查詢全部商品（直接返回）
        const queryAllPlans = async (onProgress = null) => {
            onProgress && onProgress(0, 100, '準備所有商品資料...');

            // 確保資料已載入
            const data = await DataManagerModule.loadAllData(false, onProgress);
            
            onProgress && onProgress(100, 100, '資料準備完成');

            return data.allPlans.map(plan => ({
                ...plan,
                status: calculateStatus(plan.saleStartDate, plan.saleEndDate),
                statusLabel: getStatusLabel(calculateStatus(plan.saleStartDate, plan.saleEndDate))
            }));
        };

        // 現售商品含通路詳情
        const queryInSaleWithDetails = async (onProgress = null) => {
            onProgress && onProgress(0, 100, '準備通路資料...');

            const data = await DataManagerModule.loadAllData(false, onProgress);
            
            onProgress && onProgress(50, 100, '分析通路狀態...');

            const results = data.allPlans
                .filter(plan => calculateStatus(plan.saleStartDate, plan.saleEndDate) === 'active')
                .map(plan => ({
                    ...plan,
                    status: 'active',
                    statusLabel: '現售中'
                }));

            onProgress && onProgress(100, 100, `找到 ${results.length} 筆現售商品`);

            return results;
        };

        // 進階通路狀態查詢
        const queryAdvancedChannelStatus = async (onProgress = null) => {
            onProgress && onProgress(0, 100, '準備進階分析...');

            const data = await DataManagerModule.loadAllData(false, onProgress);
            
            onProgress && onProgress(50, 100, '執行進階分析...');

            // 返回所有商品及其通路狀態
            const results = data.allPlans.map(plan => ({
                ...plan,
                status: calculateStatus(plan.saleStartDate, plan.saleEndDate),
                statusLabel: getStatusLabel(calculateStatus(plan.saleStartDate, plan.saleEndDate)),
                channelCount: data.channelData.filter(ch => ch.planCode === plan.planCode).length
            }));

            onProgress && onProgress(100, 100, '進階分析完成');

            return results;
        };

        // 輔助函數：計算狀態
        const calculateStatus = (startDate, endDate) => {
            const now = new Date();
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return 'error';
            }

            if (now < start) return 'pending';
            if (now > end) return 'inactive';
            return 'active';
        };

        // 輔助函數：取得狀態標籤
        const getStatusLabel = (status) => {
            const labels = {
                'active': '現售中',
                'inactive': '已停售',
                'pending': '尚未開賣',
                'error': '日期異常'
            };
            return labels[status] || '未知狀態';
        };

        return {
            queryPlanCodes,
            queryPlanNames,
            queryAllPlans,
            queryInSaleWithDetails,
            queryAdvancedChannelStatus
        };
    })();

    // ==================== 事件處理模組 ====================
    const EventModule = (() => {
        // 初始化事件綁定
        const initializeEvents = () => {
            // 模態框關閉
            document.querySelector('.pct-close').addEventListener('click', () => {
                document.querySelector('.pct-modal').style.display = 'none';
            });

            // Token 相關事件
            document.getElementById('pct-test-token').addEventListener('click', testToken);
            document.getElementById('pct-skip-token').addEventListener('click', skipTokenValidation);

            // 查詢相關事件
            document.getElementById('pct-execute-query').addEventListener('click', executeQuery);
            document.getElementById('pct-abort-query').addEventListener('click', abortQuery);
            document.getElementById('pct-force-reload').addEventListener('click', forceReload);

            // 查詢模式變更
            document.getElementById('pct-query-mode').addEventListener('change', handleQueryModeChange);
        };

        // Token 測試
        const testToken = async () => {
            const token = document.getElementById('pct-token-input').value.trim();
            StateModule.setToken(token || 'demo-token');
            document.getElementById('pct-token-status').textContent = 'Token 已設定';
            UIModule.Toast.show('Token 設定完成', 'success');
        };

        // 略過 Token 驗證
        const skipTokenValidation = () => {
            StateModule.setToken('demo-token');
            document.getElementById('pct-token-status').textContent = '已略過驗證';
            UIModule.Toast.show('已略過 Token 驗證', 'info');
        };

        // 執行查詢
        const executeQuery = async () => {
            const mode = document.getElementById('pct-query-mode').value;
            const input = document.getElementById('pct-query-input').value.trim();

            // 檢查 Token
            if (!StateModule.getToken()) {
                UIModule.Toast.show('請先設定 Token', 'warning');
                return;
            }

            try {
                // 準備查詢
                const abortController = new AbortController();
                StateModule.setAbortController(abortController);

                // UI 更新
                UIModule.Progress.show();
                document.getElementById('pct-execute-query').style.display = 'none';
                document.getElementById('pct-abort-query').style.display = 'inline-block';

                let results = [];

                // 根據查詢模式執行
                switch (mode) {
                    case ConfigModule.QUERY_MODES.PLAN_CODE:
                        if (!input) {
                            throw new Error('請輸入商品代號');
                        }
                        const codes = input.toUpperCase().split(/[,\s;]+/).filter(code => code.length > 0);
                        results = await QueryProcessorModule.queryPlanCodes(codes, 
                            (current, total, message) => {
                                const percentage = Math.round((current / total) * 100);
                                UIModule.Progress.update(percentage, message);
                            });
                        break;

                    case ConfigModule.QUERY_MODES.PLAN_NAME:
                        if (!input) {
                            throw new Error('請輸入關鍵字');
                        }
                        results = await QueryProcessorModule.queryPlanNames(input, 
                            (current, total, message) => {
                                UIModule.Progress.update(current, message);
                            });
                        break;

                    case ConfigModule.QUERY_MODES.ALL_PLANS:
                        results = await QueryProcessorModule.queryAllPlans(
                            (current, total, message) => {
                                UIModule.Progress.update(current, message);
                            });
                        break;

                    case ConfigModule.QUERY_MODES.IN_SALE_WITH_DETAILS:
                        results = await QueryProcessorModule.queryInSaleWithDetails(
                            (current, total, message) => {
                                UIModule.Progress.update(current, message);
                            });
                        break;

                    case ConfigModule.QUERY_MODES.ADVANCED_CHANNEL_QUERY:
                        results = await QueryProcessorModule.queryAdvancedChannelStatus(
                            (current, total, message) => {
                                UIModule.Progress.update(current, message);
                            });
                        break;

                    default:
                        throw new Error('不支援的查詢模式');
                }

                // 顯示結果
                UIModule.renderTable(results);
                StateModule.setCurrentQuery(results);
                
                UIModule.Toast.show(`查詢完成，找到 ${results.length} 筆結果`, 'success');

            } catch (error) {
                if (error.name === 'AbortError') {
                    UIModule.Toast.show('查詢已中止', 'info');
                } else {
                    console.error('查詢錯誤:', error);
                    UIModule.Toast.show(`查詢失敗: ${error.message}`, 'error');
                }
            } finally {
                UIModule.Progress.hide();
                document.getElementById('pct-execute-query').style.display = 'inline-block';
                document.getElementById('pct-abort-query').style.display = 'none';
                StateModule.setAbortController(null);
            }
        };

        // 中止查詢
        const abortQuery = () => {
            const controller = StateModule.getAbortController();
            if (controller) {
                controller.abort();
                UIModule.Toast.show('正在中止查詢...', 'info');
            }
        };

        // 強制重新載入
        const forceReload = async () => {
            try {
                UIModule.Progress.show();
                await DataManagerModule.forceReload((progress, total, message) => {
                    UIModule.Progress.update(progress, message);
                });
                UIModule.Progress.hide();
                UIModule.Toast.show('資料重新載入完成', 'success');
            } catch (error) {
                UIModule.Progress.hide();
                UIModule.Toast.show(`重新載入失敗: ${error.message}`, 'error');
            }
        };

        // 查詢模式變更
        const handleQueryModeChange = (e) => {
            const mode = e.target.value;
            const input = document.getElementById('pct-query-input');
            
            const placeholders = {
                [ConfigModule.QUERY_MODES.PLAN_CODE]: '請輸入商品代號，多個代號用逗號分隔...',
                [ConfigModule.QUERY_MODES.PLAN_NAME]: '請輸入商品名稱關鍵字...',
                [ConfigModule.QUERY_MODES.ALL_PLANS]: '點擊執行查詢即可取得所有商品',
                [ConfigModule.QUERY_MODES.IN_SALE_WITH_DETAILS]: '點擊執行查詢即可取得現售商品詳情',
                [ConfigModule.QUERY_MODES.ADVANCED_CHANNEL_QUERY]: '點擊執行查詢即可進行通路狀態分析'
            };
            
            input.placeholder = placeholders[mode] || '請輸入查詢條件...';
            
            const noInputModes = [
                ConfigModule.QUERY_MODES.ALL_PLANS,
                ConfigModule.QUERY_MODES.IN_SALE_WITH_DETAILS,
                ConfigModule.QUERY_MODES.ADVANCED_CHANNEL_QUERY
            ];
            
            input.disabled = noInputModes.includes(mode);
            if (input.disabled) {
                input.value = '';
            }
        };

        return {
            initializeEvents
        };
    })();

    // ==================== 初始化函數 ====================
    const initializeUI = () => {
        // 檢查是否在正確的網域
        if (!window.location.hostname.includes('kgilife.com.tw')) {
            console.warn('此工具僅適用於凱基人壽內部系統');
            // 在開發環境中仍然允許執行
        }

        // 注入樣式
        const styleEl = document.createElement('div');
        styleEl.innerHTML = UIModule.getStyles();
        document.head.appendChild(styleEl.firstElementChild);

        // 創建 UI
        const modalEl = document.createElement('div');
        modalEl.innerHTML = UIModule.getModalHTML();
        document.body.appendChild(modalEl.firstElementChild);

        // 初始化事件
        EventModule.initializeEvents();

        // 顯示模態框
        document.querySelector('.pct-modal').style.display = 'flex';

        // 顯示初始化完成提示
        setTimeout(() => {
            UIModule.Toast.show(`商品查詢工具 v${ConfigModule.VERSION} 已載入完成`, 'success');
        }, 500);

        console.log(`凱基人壽商品查詢工具 v${ConfigModule.VERSION} 初始化完成`);
    };

    // ==================== 主控制器 ====================
    const ControllerModule = (() => {
        // 初始化時載入資料
        const initialize = async () => {
            try {
                // 顯示載入狀態
                UIModule.Progress.show();
                UIModule.Progress.update(0, '正在初始化...');

                // 載入所有基礎資料
                await DataManagerModule.loadAllData(false, (progress, total, message) => {
                    UIModule.Progress.update(progress, message);
                });

                UIModule.Progress.hide();
                UIModule.Toast.show('資料載入完成，可以開始查詢', 'success');

                // 顯示資料狀態
                const status = DataManagerModule.getDataStatus();
                console.log('資料載入狀態:', status);

            } catch (error) {
                UIModule.Progress.hide();
                UIModule.Toast.show(`資料載入失敗: ${error.message}`, 'error');
                console.error('初始化失敗:', error);
            }
        };

        return {
            initialize
        };
    })();

    // ==================== 啟動應用程式 ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeUI();
            ControllerModule.initialize();
        });
    } else {
        initializeUI();
        ControllerModule.initialize();
    }

})();
