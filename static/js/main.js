// 基礎設施管理系統的主要JavaScript文件

// 全局變數
const API_BASE_URL = '/admin';

// DOM Ready事件
document.addEventListener('DOMContentLoaded', function() {
    // 根據當前頁面執行相應的初始化
    const currentPath = window.location.pathname;
    
    if (currentPath === '/' || currentPath.includes('login')) {
        initLoginPage();
    } else if (currentPath.includes('dashboard')) {
        initDashboard();
    } else if (currentPath.includes('users')) {
        initUsersPage();
    } else if (currentPath.includes('services')) {
        initServicesPage();
    } else if (currentPath.includes('tokens')) {
        initTokensPage();
    }
});

// 登入頁面初始化
function initLoginPage() {
    // 移除舊的 Basic Auth 登入表單處理
    // 現在登入功能已由 login.html 中的表單直接向 /auth/login 發送請求處理
    
    // 設置登出事件
    const logoutLink = document.querySelector('a[href="javascript:logout()"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', function() {
            fetch('/logout', { method: 'GET' })
                .then(() => {
                    window.location.href = '/login';
                })
                .catch(error => {
                    console.error('登出失敗:', error);
                });
        });
    }
}

// 儀表板頁面初始化
function initDashboard() {
    console.log('初始化儀表板...');
    
    // 用於存儲全局圖表對象的變量
    window.charts = {};
    window.chartTypes = {
        serviceUsage: 'bar',
        userService: 'bar',
        userToken: 'bar',
    };
    
    // 設置事件處理
    setupChartEventListeners();
    
    // 開始資料載入流程
    loadDashboardData();
}

// 設置圖表相關事件監聽
function setupChartEventListeners() {
    // 設置時間範圍選擇器事件
    const dailyRequestsTimeRange = document.getElementById('dailyRequestsTimeRange');
    if (dailyRequestsTimeRange) {
        dailyRequestsTimeRange.addEventListener('change', updateDailyRequestsChart);
    }
    
    // 設置服務和Token時間範圍選擇器事件
    const serviceTimeRange = document.getElementById('serviceTimeRange');
    if (serviceTimeRange) {
        serviceTimeRange.addEventListener('change', updateServiceTimeChart);
    }
    
    const tokenTimeRange = document.getElementById('tokenTimeRange');
    if (tokenTimeRange) {
        tokenTimeRange.addEventListener('change', updateTokenTimeChart);
    }
}

// 儀表板資料載入主流程
async function loadDashboardData() {
    try {
        console.log('開始載入儀表板數據...');
        
        // 1. 載入基礎統計數據並更新每日請求圖表
        const recentStats = await fetchRecentStats();
        console.log('基礎統計數據載入完成:', recentStats);
        renderRecentStats(recentStats);
        await updateDailyRequestsChart();
        
        // 2. 載入並渲染服務使用量統計
        const servicesStats = await fetchServicesUsageStats();
        console.log('服務使用量數據載入完成:', servicesStats);
        renderServicesUsageChart(servicesStats);
        
        // 3. 載入用戶、服務和Token數據，填充選擇器
        const [users, services, tokens] = await Promise.all([
            fetchUsersData(),
            fetchServicesData(),
            fetchTokensData()
        ]);
        
        console.log('用戶數據載入完成:', users.length);
        console.log('服務數據載入完成:', services.length);
        console.log('Token數據載入完成:', tokens.length);
        
        fillUserSelectors(users);
        fillServiceSelectors(services);
        fillTokenSelectors(tokens);
        
        // 4. 預載入第一個用戶的數據
        if (users.length > 0) {
            const firstUser = users.find(user => user.is_active);
            if (firstUser) {
                document.getElementById('userServiceSelector').value = firstUser.id;
                document.getElementById('userTokenSelector').value = firstUser.id;
                await Promise.all([
                    updateUserServiceChart(),
                    updateUserTokenChart()
                ]);
            }
        }
        
        // 5. 預載入第一個服務和Token的時間數據
        if (services.length > 0) {
            const firstService = services.find(service => service.is_active);
            if (firstService) {
                document.getElementById('serviceTimeSelector').value = firstService.id;
                await updateServiceTimeChart();
            }
        }
        
        if (tokens.length > 0) {
            const firstToken = tokens.find(token => token.is_active);
            if (firstToken) {
                document.getElementById('tokenTimeSelector').value = firstToken.id;
                await updateTokenTimeChart();
            }
        }
        
        console.log('儀表板數據載入完成！');
        
    } catch (error) {
        console.error('載入儀表板數據時發生錯誤:', error);
    }
}

// 獲取用戶數據 - 專用於圖表
async function fetchUsersData() {
    try {
        const users = await fetchWithAuth(`${API_BASE_URL}/users`);
        return users || [];
    } catch (error) {
        console.error('獲取用戶數據失敗:', error);
        return [];
    }
}

// 獲取服務數據 - 專用於圖表
async function fetchServicesData() {
    try {
        const services = await fetchWithAuth(`${API_BASE_URL}/services`);
        return services || [];
    } catch (error) {
        console.error('獲取服務數據失敗:', error);
        return [];
    }
}

// 獲取Token數據 - 專用於圖表
async function fetchTokensData() {
    try {
        const tokens = await fetchWithAuth(`${API_BASE_URL}/tokens`);
        return tokens || [];
    } catch (error) {
        console.error('獲取Token數據失敗:', error);
        return [];
    }
}

// 獲取最近統計數據
async function fetchRecentStats() {
    try {
        const days = document.getElementById('dailyRequestsTimeRange')?.value || '30';
        console.log(`獲取最近${days}天的統計數據...`);
        const response = await fetch(`${API_BASE_URL}/stats/recent?days=${days}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error(`獲取統計數據失敗: HTTP ${response.status} - ${response.statusText}`);
            const errorText = await response.text();
            console.error('錯誤詳情:', errorText);
            return [];
        }
        
        const stats = await response.json();
        console.log('獲取到的統計數據:', JSON.stringify(stats));
        return stats || [];
    } catch (error) {
        console.error('獲取統計數據失敗:', error);
        return [];
    }
}

// 獲取服務使用量統計
async function fetchServicesUsageStats() {
    try {
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/services`);
        return stats || [];
    } catch (error) {
        console.error('獲取服務使用量統計失敗:', error);
        return [];
    }
}

// 重寫獲取用戶服務使用量統計
async function fetchUserServiceStats(userId) {
    try {
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/users/services`);
        return (stats || []).filter(stat => stat.user_id == userId);
    } catch (error) {
        console.error('獲取用戶服務使用量統計失敗:', error);
        return [];
    }
}

// 重寫獲取用戶Token使用量統計
async function fetchUserTokenStats(userId) {
    try {
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/users/tokens`);
        return (stats || []).filter(stat => stat.user_id == userId);
    } catch (error) {
        console.error('獲取用戶Token使用量統計失敗:', error);
        return [];
    }
}

// 重寫獲取Token時間使用量統計
async function fetchTokenTimeStats(tokenId, days) {
    try {
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/tokens/${tokenId}/time`);
        return filterStatsByDays(stats || [], days);
    } catch (error) {
        console.error('獲取Token時間使用量統計失敗:', error);
        return [];
    }
}

// 重寫獲取服務時間使用量統計
async function fetchServiceTimeStats(serviceId, days) {
    try {
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/services/${serviceId}/time`);
        return filterStatsByDays(stats || [], days);
    } catch (error) {
        console.error('獲取服務時間使用量統計失敗:', error);
        return [];
    }
}

// 過濾特定天數的統計數據
function filterStatsByDays(stats, days) {
    if (!stats || !stats.length || !days) return stats;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    cutoffDate.setHours(0, 0, 0, 0);
    
    return stats.filter(item => {
        const itemDate = new Date(item.date);
        return !isNaN(itemDate) && itemDate >= cutoffDate;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// 填充用戶選擇器
function fillUserSelectors(users) {
    if (!users || !users.length) {
        console.warn('沒有可用的用戶數據來填充選擇器');
        return;
    }
    
    const userServiceSelector = document.getElementById('userServiceSelector');
    const userTokenSelector = document.getElementById('userTokenSelector');
    
    if (userServiceSelector && userTokenSelector) {
        // 只使用活躍用戶
        const activeUsers = users.filter(user => user.is_active);
        
        // 清空現有選項
        userServiceSelector.innerHTML = '<option value="">-- 選擇使用者 --</option>';
        userTokenSelector.innerHTML = '<option value="">-- 選擇使用者 --</option>';
        
        // 添加用戶選項
        activeUsers.forEach(user => {
            const option1 = document.createElement('option');
            option1.value = user.id;
            option1.textContent = user.username;
            userServiceSelector.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = user.id;
            option2.textContent = user.username;
            userTokenSelector.appendChild(option2);
        });
        
        console.log(`填充了 ${activeUsers.length} 個用戶到選擇器中`);
    }
}

// 填充服務選擇器
function fillServiceSelectors(services) {
    if (!services || !services.length) {
        console.warn('沒有可用的服務數據來填充選擇器');
        return;
    }
    
    const serviceTimeSelector = document.getElementById('serviceTimeSelector');
    
    if (serviceTimeSelector) {
        // 只使用活躍服務
        const activeServices = services.filter(service => service.is_active);
        
        // 清空現有選項
        serviceTimeSelector.innerHTML = '<option value="">-- 選擇服務 --</option>';
        
        // 添加服務選項
        activeServices.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            serviceTimeSelector.appendChild(option);
        });
        
        console.log(`填充了 ${activeServices.length} 個服務到選擇器中`);
    }
}

// 填充 Token 選擇器
function fillTokenSelectors(tokens) {
    if (!tokens || !tokens.length) {
        console.warn('沒有可用的Token數據來填充選擇器');
        return;
    }
    
    const tokenTimeSelector = document.getElementById('tokenTimeSelector');
    
    if (tokenTimeSelector) {
        // 只使用活躍 Token
        const activeTokens = tokens.filter(token => token.is_active);
        
        // 清空現有選項
        tokenTimeSelector.innerHTML = '<option value="">-- 選擇Token --</option>';
        
        // 添加 Token 選項
        activeTokens.forEach(token => {
            const option = document.createElement('option');
            option.value = token.id;
            option.textContent = `${token.user?.username || '未知用戶'} - ${token.service?.name || '未知服務'} (${token.token_value?.substring(0, 8)}...)`;
            tokenTimeSelector.appendChild(option);
        });
        
        console.log(`填充了 ${activeTokens.length} 個Token到選擇器中`);
    }
}

// 使用者頁面初始化
function initUsersPage() {
    fetchUsers();

    // 添加使用者按鈕事件
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', showAddUserModal);
    }
}

// 服務頁面初始化
function initServicesPage() {
    fetchServices();

    // 添加服務按鈕事件
    const addServiceBtn = document.getElementById('addServiceBtn');
    if (addServiceBtn) {
        addServiceBtn.addEventListener('click', showAddServiceModal);
    }
}

// Token頁面初始化
function initTokensPage() {
    fetchTokens();
    fetchUsers();
    fetchServices();

    // 添加Token按鈕事件
    const addTokenBtn = document.getElementById('addTokenBtn');
    if (addTokenBtn) {
        addTokenBtn.addEventListener('click', showAddTokenModal);
    }
    
    // 初始化過期時間為明天
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().slice(0, 16);
    
    const newTokenExpiresField = document.getElementById('newTokenExpires');
    if (newTokenExpiresField) {
        newTokenExpiresField.value = tomorrowString;
    }
}

// API調用相關函數
function fetchWithAuth(url, options = {}) {
    // 添加日誌以幫助調試
    console.log(`發送API請求：${url}`);
    
    // 在請求前設置 loading 狀態
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'api-loading-indicator';
    loadingDiv.textContent = '載入中...';
    document.body.appendChild(loadingDiv);
    
    return fetch(url, {
        ...options,
        credentials: 'include' // 確保發送 Cookie
    })
    .then(response => {
        // 移除 loading 狀態
        document.body.removeChild(loadingDiv);
        
        if (response.status === 401) {
            // 認證失敗，重定向到登入頁面
            console.error('API認證失敗，重定向到登入頁面');
            window.location.href = '/login';
            return Promise.reject('認證失敗');
        }
        
        if (!response.ok) {
            // 處理其他HTTP錯誤
            console.error(`API請求失敗：${response.status} ${response.statusText}`);
            return response.text().then(text => {
                try {
                    // 嘗試解析錯誤響應為JSON
                    const errorJson = JSON.parse(text);
                    console.error('API錯誤詳情：', errorJson);
                    return Promise.reject(`API錯誤：${errorJson.error || '未知錯誤'}`);
                } catch (e) {
                    // 如果不是JSON，則返回原始文本
                    console.error('API錯誤詳情：', text);
                    return Promise.reject(`API錯誤：${text || response.statusText || '未知錯誤'}`);
                }
            });
        }
        
        // 正常響應，嘗試解析為JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json().then(data => {
                console.log(`API響應成功，數據:`, data);
                return data;
            }).catch(error => {
                console.error('解析API響應為JSON時出錯：', error);
                return null; // 返回null替代解析失敗的JSON
            });
        } else {
            console.log('API響應不是JSON格式');
            return response.text().then(text => {
                console.log('API響應文本:', text);
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return text;
                }
            });
        }
    })
    .catch(error => {
        // 移除 loading 狀態（如果還存在）
        if (document.body.contains(loadingDiv)) {
            document.body.removeChild(loadingDiv);
        }
        
        // 網絡錯誤處理
        console.error('API請求出錯：', error);
        // 如果是我們已知的錯誤（字符串形式），直接重新拋出
        if (typeof error === 'string') {
            return Promise.reject(error);
        }
        // 其他錯誤（例如網絡問題）
        return Promise.reject(`API調用失敗：${error.message || '未知網絡錯誤'}`);
    });
}

// 獲取用戶列表
function fetchUsers() {
    fetchWithAuth(`${API_BASE_URL}/users`)
        .then(users => {
            renderUserTable(users);
            fillUserDropdown(users); // 填充使用者下拉選單
        })
        .catch(error => console.error('獲取用戶失敗:', error));
}

// 獲取服務列表
function fetchServices() {
    fetchWithAuth(`${API_BASE_URL}/services`)
        .then(services => {
            renderServiceTable(services);
            fillServiceDropdown(services); // 填充服務下拉選單
        })
        .catch(error => console.error('獲取服務失敗:', error));
}

// 填充使用者下拉選單
function fillUserDropdown(users) {
    const userSelect = document.getElementById('newTokenUserId');
    if (userSelect) {
        userSelect.innerHTML = '';
        users.forEach(user => {
            if (user.is_active) { // 只添加啟用的使用者
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.username;
                userSelect.appendChild(option);
            }
        });
    }
}

// 填充服務下拉選單
function fillServiceDropdown(services) {
    const serviceSelect = document.getElementById('newTokenServiceId');
    if (serviceSelect) {
        serviceSelect.innerHTML = '';
        services.forEach(service => {
            if (service.is_active) { // 只添加啟用的服務
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = `${service.name} (${service.description})`;
                serviceSelect.appendChild(option);
            }
        });
    }
}

// 切換圖表類型
function switchChartType(chartId, type) {
    // 更新按鈕樣式
    const buttons = document.querySelectorAll(`button[onclick^="switchChartType('${chartId}'"]`);
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${type}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 儲存當前圖表類型
    window.chartTypes[chartId] = type;
    
    // 根據圖表ID更新對應圖表
    switch (chartId) {
        case 'serviceUsage':
            fetchServicesUsageStats().then(renderServicesUsageChart);
            break;
        case 'userService':
            updateUserServiceChart();
            break;
        case 'userToken':
            updateUserTokenChart();
            break;
    }
}

// 獲取Token列表
function fetchTokens() {
    fetchWithAuth(`${API_BASE_URL}/tokens`)
        .then(tokens => {
            const tableBody = document.getElementById('tokenTableBody');
            if (!tableBody) return;
            
            tableBody.innerHTML = '';
            tokens.forEach(token => {
                const expiryDate = new Date(token.expires_at);
                const isPermanent = isPermanentToken(token.expires_at);
                const expiryStatus = isPermanent ? '永久有效' : 
                    (expiryDate > new Date() ? formatDate(expiryDate) : '<span class="text-danger">已過期</span>');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${token.id}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="mr-2">${token.token_value.substring(0, 8)}...</span>
                            <button class="btn btn-info btn-sm ml-2" onclick="copyToken('${token.token_value}')">複製</button>
                        </div>
                    </td>
                    <td>${token.user ? token.user.username : '未知使用者'}</td>
                    <td>${token.service ? token.service.name : '未知服務'}</td>
                    <td>${token.description || '-'}</td>
                    <td>${expiryStatus}</td>
                    <td>
                        <span class="badge ${token.is_active ? 'badge-success' : 'badge-danger'}">
                            ${token.is_active ? '啟用' : '禁用'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="editToken(${token.id})">編輯</button>
                        <button class="btn ${token.is_active ? 'btn-warning' : 'btn-success'} btn-sm" 
                            onclick="toggleTokenStatus(${token.id}, ${!token.is_active})">
                            ${token.is_active ? '禁用' : '啟用'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteToken(${token.id})">刪除</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(error => console.error('獲取Token失敗:', error));
}

// 渲染Token表格
function renderTokenTable(tokens) {
    const tableBody = document.getElementById('tokenTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    tokens.forEach(token => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${token.id}</td>
            <td>
                ${token.token_value}
                <button class="btn btn-info btn-sm" onclick="copyToken('${token.token_value}')">複製</button>
            </td>
            <td>${token.user.username}</td>
            <td>${token.service.name}</td>
            <td>${new Date(token.expires_at).toLocaleString()}</td>
            <td>${token.is_active ? '啟用' : '停用'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editToken(${token.id})">編輯</button>
                <button class="btn ${token.is_active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleTokenStatus(${token.id}, ${!token.is_active})">
                    ${token.is_active ? '停用' : '啟用'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteToken(${token.id})">刪除</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 更新每日請求數量趨勢圖
function updateDailyRequestsChart() {
    // 獲取選定的時間範圍
    const days = document.getElementById('dailyRequestsTimeRange').value || 30;
    
    fetchWithAuth(`${API_BASE_URL}/stats/recent?days=${days}`)
        .then(data => {
            const dailyRequestsCanvas = document.getElementById('dailyRequestsChart');
            if (!dailyRequestsCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.dailyRequests) {
                window.charts.dailyRequests.destroy();
            }
            
            // 確保數據按日期排序
            data.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);
            
            // 確保數據包含今天
            const today = new Date().toISOString().split('T')[0];
            if (!dates.includes(today)) {
                dates.push(today);
                counts.push(0); // 預設值為0
            }
            
            console.log('每日請求數據:', { dates, counts });
            
            // 創建新圖表
            window.charts.dailyRequests = new Chart(dailyRequestsCanvas, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: '每日請求數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgb(75, 192, 192)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    const date = new Date(tooltipItems[0].label);
                                    return date.toLocaleDateString('zh-TW');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: '日期'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '請求數量'
                            }
                        }
                    }
                }
            });
        })
        .catch(error => console.error('獲取每日請求數據失敗:', error));
}

// 渲染用戶表格
function renderUserTable(users) {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.is_active ? '啟用' : '停用'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editUser(${user.id})">編輯</button>
                <button class="btn ${user.is_active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                    ${user.is_active ? '停用' : '啟用'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">刪除</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 渲染服務表格
function renderServiceTable(services) {
    const tableBody = document.getElementById('serviceTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    services.forEach(service => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${service.id}</td>
            <td>${service.name}</td>
            <td>${service.description}</td>
            <td>${service.base_url}</td>
            <td>${service.is_active ? '啟用' : '停用'}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editService(${service.id})">編輯</button>
                <button class="btn ${service.is_active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleServiceStatus(${service.id}, ${!service.is_active})">
                    ${service.is_active ? '停用' : '啟用'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteService(${service.id})">刪除</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 渲染最近統計數據
function renderRecentStats(stats) {
    // 確保有數據
    if (!stats || !stats.length) {
        console.warn('沒有可用的統計數據');
        return;
    }

    console.log('正在渲染統計數據:', stats);

    // 計算總API請求數 - 修正加總邏輯
    let totalRequests = 0;
    stats.forEach(day => {
        // 確保day.count是有效數字
        if (day && typeof day.count === 'number') {
            totalRequests += day.count;
        }
    });
    
    // 取得最大的用戶、服務和Token數量
    const totalUsers = Math.max(...stats.map(day => day.user_count || 0));
    const totalServices = Math.max(...stats.map(day => day.service_count || 0));
    const totalTokens = Math.max(...stats.map(day => day.token_count || 0));
    
    console.log('計算的統計結果:', {totalRequests, totalUsers, totalServices, totalTokens});
    
    // 更新統計卡片
    const elemTotalRequests = document.getElementById('totalRequests');
    const elemActiveUsers = document.getElementById('activeUsers');
    const elemActiveServices = document.getElementById('activeServices');
    const elemActiveTokens = document.getElementById('activeTokens');

    if (elemTotalRequests) elemTotalRequests.textContent = totalRequests;
    if (elemActiveUsers) elemActiveUsers.textContent = totalUsers;
    if (elemActiveServices) elemActiveServices.textContent = totalServices;
    if (elemActiveTokens) elemActiveTokens.textContent = totalTokens;
}

// 渲染服務使用量統計圖表
function renderServicesUsageChart(stats) {
    // 確保有數據
    if (!stats || !stats.length) {
        console.warn('沒有可用的服務使用量數據');
        return;
    }

    // 獲取圖表元素
    const serviceUsageCanvas = document.getElementById('serviceUsageChart');
    if (!serviceUsageCanvas) return;
    
    // 若已存在圖表，則先銷毀
    if (window.charts.serviceUsage) {
        window.charts.serviceUsage.destroy();
    }

    // 準備圖表數據
    const labels = stats.map(s => s.service_name);
    const data = stats.map(s => s.count);
    const backgroundColors = generateColors(stats.length);
    
    // 根據選擇的圖表類型創建圖表
    const chartType = window.chartTypes.serviceUsage || 'bar';
    
    // 計算總數(用於計算百分比)
    const total = data.reduce((acc, val) => acc + val, 0);
    
    // 創建新圖表
    window.charts.serviceUsage = new Chart(serviceUsageCanvas, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: '服務使用次數',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.5', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: chartType !== 'pie' ? {
                y: {
                    beginAtZero: true
                }
            } : undefined,
            plugins: {
                tooltip: {
                    callbacks: {
                        // 如果是圓餅圖，顯示百分比
                        label: function(context) {
                            if (chartType === 'pie' || chartType === 'doughnut') {
                                const value = context.raw;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                            return `${context.label}: ${context.raw}`;
                        }
                    }
                },
                // 如果是圓餅圖，直接在圖上顯示百分比
                datalabels: chartType === 'pie' || chartType === 'doughnut' ? {
                    formatter: (value, ctx) => {
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${percentage}%`;
                    },
                    color: '#fff',
                    font: {
                        weight: 'bold'
                    }
                } : false
            }
        }
    });
}

// 更新用戶服務使用量圖表
function updateUserServiceChart() {
    const userId = document.getElementById('userServiceSelector').value;
    if (!userId) return;
    const chartType = window.chartTypes.userService || 'bar';
    const userServiceCanvas = document.getElementById('userServiceChart');
    if (!userServiceCanvas) return;
    if (window.charts.userService) {
        window.charts.userService.destroy();
    }
    if (chartType === 'line') {
        // 折線圖：以時間為橫軸，風格與每日請求數量趨勢圖一致
        const days = document.getElementById('dailyRequestsTimeRange')?.value || 30;
        
        fetchWithAuth(`${API_BASE_URL}/stats/users/${userId}/services/time`)
            .then(data => {
                // 分服務分日期彙整
                const servicesMap = {};
                data.forEach(item => {
                    if (!servicesMap[item.service_id]) {
                        servicesMap[item.service_id] = { name: item.service_name, data: {} };
                    }
                    servicesMap[item.service_id].data[item.date] = item.count;
                });
                
                // 計算日期範圍（過去X天到今天）
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - parseInt(days) + 1);
                cutoffDate.setHours(0, 0, 0, 0);
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // 產生完整的日期範圍，包含今日
                const dateRange = generateDateRange(cutoffDate, today);
                
                // 準備數據集
                const datasets = [];
                const colors = generateColors(Object.keys(servicesMap).length);
                
                Object.keys(servicesMap).forEach((serviceId, idx) => {
                    const service = servicesMap[serviceId];
                    const serviceData = dateRange.map(date => service.data[date] || 0);
                    
                    datasets.push({
                        label: service.name,
                        data: serviceData,
                        fill: false,
                        borderColor: colors[idx],
                        backgroundColor: colors[idx],
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: colors[idx]
                    });
                });
                
                // 創建圖表
                window.charts.userService = new Chart(userServiceCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function(tooltipItems) {
                                        const date = new Date(tooltipItems[0].label);
                                        return date.toLocaleDateString('zh-TW');
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: '日期'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: '使用次數'
                                }
                            }
                        }
                    }
                });
            })
            .catch(error => console.error('獲取使用者服務使用量時間數據失敗:', error));
    } else {
        fetchUserServiceStats(userId).then(data => {
            const serviceMap = {};
            data.forEach(item => {
                if (!serviceMap[item.service_id]) {
                    serviceMap[item.service_id] = { name: item.service_name, count: 0 };
                }
                serviceMap[item.service_id].count += item.count;
            });
            const labels = Object.values(serviceMap).map(s => s.name);
            const counts = Object.values(serviceMap).map(s => s.count);
            const colors = generateColors(labels.length);
            
            // 計算總數(用於計算百分比)
            const total = counts.reduce((acc, val) => acc + val, 0);
            
            window.charts.userService = new Chart(userServiceCanvas, {
                type: chartType,
                data: {
                    labels,
                    datasets: [{
                        label: '服務使用次數',
                        data: counts,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.5', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: chartType !== 'pie' ? { y: { beginAtZero: true } } : undefined,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                // 如果是圓餅圖，顯示百分比
                                label: function(context) {
                                    if (chartType === 'pie' || chartType === 'doughnut') {
                                        const value = context.raw;
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: ${value} (${percentage}%)`;
                                    }
                                    return `${context.label}: ${context.raw}`;
                                }
                            }
                        },
                        // 如果是圓餅圖，直接在圖上顯示百分比
                        datalabels: chartType === 'pie' || chartType === 'doughnut' ? {
                            formatter: (value, ctx) => {
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${percentage}%`;
                            },
                            color: '#fff',
                            font: {
                                weight: 'bold'
                            }
                        } : false
                    }
                }
            });
        });
    }
}

// 更新使用者Token使用量圖表
function updateUserTokenChart() {
    const userId = document.getElementById('userTokenSelector').value;
    if (!userId) return;
    
    const chartType = window.chartTypes.userToken || 'bar';
    const userTokenCanvas = document.getElementById('userTokenChart');
    if (!userTokenCanvas) return;
    
    if (window.charts.userToken) {
        window.charts.userToken.destroy();
    }

    if (chartType === 'line') {
        // 折線圖：以時間為橫軸，每個token一條線
        const days = document.getElementById('dailyRequestsTimeRange')?.value || 30;
        
        // 對於折線圖，需要獲取時間序列數據
        fetchWithAuth(`${API_BASE_URL}/stats/users/${userId}/tokens/time`)
            .then(data => {
                // 分token分日期彙整
                const tokensMap = {};
                data.forEach(item => {
                    if (!tokensMap[item.token_id]) {
                        tokensMap[item.token_id] = { 
                            name: `${item.token_value.substring(0, 8)}... - ${item.service_name}`, 
                            data: {} 
                        };
                    }
                    tokensMap[item.token_id].data[item.date] = item.count;
                });
                
                // 計算日期範圍（過去X天到今天）
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - parseInt(days) + 1);
                cutoffDate.setHours(0, 0, 0, 0);
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // 產生完整的日期範圍，包含今日
                const dateRange = generateDateRange(cutoffDate, today);
                
                // 準備數據集
                const datasets = [];
                const colors = generateColors(Object.keys(tokensMap).length);
                
                Object.keys(tokensMap).forEach((tokenId, idx) => {
                    const token = tokensMap[tokenId];
                    const tokenData = dateRange.map(date => token.data[date] || 0);
                    
                    datasets.push({
                        label: token.name,
                        data: tokenData,
                        fill: false,
                        borderColor: colors[idx],
                        backgroundColor: colors[idx],
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: colors[idx]
                    });
                });
                
                // 創建圖表
                window.charts.userToken = new Chart(userTokenCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function(tooltipItems) {
                                        const date = new Date(tooltipItems[0].label);
                                        return date.toLocaleDateString('zh-TW');
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: '日期'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 45
                                }
                            },
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: '使用次數'
                                }
                            }
                        }
                    }
                });
            })
            .catch(error => console.error('獲取使用者Token使用量時間數據失敗:', error));
    } else {
        // 長條圖/圓餅圖：以token為橫軸
        fetchUserTokenStats(userId).then(data => {
            const labels = data.map(d => `${d.token_value.substring(0, 8)}... - ${d.service_name}`);
            const counts = data.map(d => d.count);
            const colors = generateColors(data.length);
            
            // 計算總數(用於計算百分比)
            const total = counts.reduce((acc, val) => acc + val, 0);
            
            window.charts.userToken = new Chart(userTokenCanvas, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Token使用次數',
                        data: counts,
                        backgroundColor: colors,
                        borderColor: colors.map(color => color.replace('0.5', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: chartType !== 'pie' ? {
                        y: {
                            beginAtZero: true
                        }
                    } : undefined,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                // 如果是圓餅圖，顯示百分比
                                label: function(context) {
                                    if (chartType === 'pie' || chartType === 'doughnut') {
                                        const value = context.raw;
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: ${value} (${percentage}%)`;
                                    }
                                    return `${context.label}: ${context.raw}`;
                                }
                            }
                        },
                        // 如果是圓餅圖，直接在圖上顯示百分比
                        datalabels: chartType === 'pie' || chartType === 'doughnut' ? {
                            formatter: (value, ctx) => {
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${percentage}%`;
                            },
                            color: '#fff',
                            font: {
                                weight: 'bold'
                            }
                        } : false
                    }
                }
            });
        });
    }
}

// 更新Token隨時間使用量圖表
function updateTokenTimeChart() {
    const tokenId = document.getElementById('tokenTimeSelector').value;
    if (!tokenId) return;
    
    // 獲取選定的時間範圍
    const days = document.getElementById('tokenTimeRange').value || 30;
    
    fetchWithAuth(`${API_BASE_URL}/stats/tokens/${tokenId}/time`)
        .then(data => {
            const tokenTimeCanvas = document.getElementById('tokenTimeChart');
            if (!tokenTimeCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.tokenTime) {
                window.charts.tokenTime.destroy();
            }
            
            // 計算日期範圍（過去X天到今天）
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days) + 1);
            cutoffDate.setHours(0, 0, 0, 0);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 產生完整的日期範圍，包含今日
            const dateRange = generateDateRange(cutoffDate, today);
            
            // 處理數據，填充日期範圍
            const dateMap = {};
            data.forEach(item => {
                dateMap[item.date] = item.count;
            });
            
            const counts = dateRange.map(date => dateMap[date] || 0);
            
            // 創建圖表
            window.charts.tokenTime = new Chart(tokenTimeCanvas, {
                type: 'line',
                data: {
                    labels: dateRange,
                    datasets: [{
                        label: 'Token使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgb(75, 192, 192)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    const date = new Date(tooltipItems[0].label);
                                    return date.toLocaleDateString('zh-TW');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: '日期'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '使用次數'
                            }
                        }
                    }
                }
            });
        })
        .catch(error => console.error('獲取Token使用量數據失敗:', error));
}

// 更新服務隨時間使用量圖表
function updateServiceTimeChart() {
    const serviceId = document.getElementById('serviceTimeSelector').value;
    if (!serviceId) return;
    
    // 獲取選定的時間範圍
    const days = document.getElementById('serviceTimeRange').value || 30;
    
    fetchWithAuth(`${API_BASE_URL}/stats/services/${serviceId}/time`)
        .then(data => {
            const serviceTimeCanvas = document.getElementById('serviceTimeChart');
            if (!serviceTimeCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.serviceTime) {
                window.charts.serviceTime.destroy();
            }
            
            // 計算日期範圍（過去X天到今天）
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days) + 1);
            cutoffDate.setHours(0, 0, 0, 0);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 產生完整的日期範圍，包含今日
            const dateRange = generateDateRange(cutoffDate, today);
            
            // 處理數據，填充日期範圍
            const dateMap = {};
            data.forEach(item => {
                dateMap[item.date] = item.count;
            });
            
            const counts = dateRange.map(date => dateMap[date] || 0);
            
            // 創建圖表
            window.charts.serviceTime = new Chart(serviceTimeCanvas, {
                type: 'line',
                data: {
                    labels: dateRange,
                    datasets: [{
                        label: '服務使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgb(255, 99, 132)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(tooltipItems) {
                                    const date = new Date(tooltipItems[0].label);
                                    return date.toLocaleDateString('zh-TW');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: '日期'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: '使用次數'
                            }
                        }
                    }
                }
            });
        })
        .catch(error => console.error('獲取服務使用量數據失敗:', error));
}

// 格式化日期，用於顯示Token過期時間
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '無效日期';
    }
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 生成隨機顏色數組（用於圖表）
function generateColors(count) {
    const colors = [
        'rgba(255, 99, 132, 0.5)',
        'rgba(54, 162, 235, 0.5)',
        'rgba(255, 206, 86, 0.5)',
        'rgba(75, 192, 192, 0.5)',
        'rgba(153, 102, 255, 0.5)',
        'rgba(255, 159, 64, 0.5)'
    ];
    
    // 如果需要的顏色數量超過預設顏色數量，則生成隨機顏色
    while (colors.length < count) {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        colors.push(`rgba(${r}, ${g}, ${b}, 0.5)`);
    }
    
    return colors.slice(0, count);
}

// 生成日期範圍，確保今天是最後一個點
function generateDateRange(startDate, endDate) {
    const dateArray = [];
    let currentDate = new Date(startDate);
    
    // 確保日期格式一致
    currentDate.setHours(0, 0, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(0, 0, 0, 0);
    
    // 生成日期範圍直到今天
    while (currentDate <= endDateTime) {
        dateArray.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 確保最後一個是今天
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateArray.length > 0 && dateArray[dateArray.length - 1] !== todayStr) {
        dateArray.push(todayStr);
    }
    
    console.log("生成的日期範圍:", dateArray, "最後一個點是:", dateArray[dateArray.length - 1]);
    return dateArray;
}

// 初始化圖表
function initCharts() {
    const serviceUsageCanvas = document.getElementById('serviceUsageChart');
    if (serviceUsageCanvas) {
        window.serviceChart = new Chart(serviceUsageCanvas, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '服務使用次數',
                    data: [],
                    backgroundColor: 'rgba(45, 109, 163, 0.5)',
                    borderColor: 'rgba(45, 109, 163, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    const dailyRequestsCanvas = document.getElementById('dailyRequestsChart');
    if (dailyRequestsCanvas) {
        // 這裡可以初始化另一個圖表，顯示每日請求數量
    }
}

// 用戶操作函數
function showAddUserModal() {
    // 顯示添加用戶的模態窗口
    document.getElementById('addUserModal').style.display = 'block';
}

function addUser() {
    const username = document.getElementById('newUsername').value;
    
    fetchWithAuth(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            is_active: true
        })
    })
    .then(() => {
        document.getElementById('addUserModal').style.display = 'none';
        fetchUsers();
    })
    .catch(error => console.error('添加用戶失敗:', error));
}

function editUser(id) {
    // 獲取用戶資料並顯示編輯模態窗口
    fetchWithAuth(`${API_BASE_URL}/users/${id}`)
        .then(user => {
            document.getElementById('editUserID').value = user.id;
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editUserModal').style.display = 'block';
        })
        .catch(error => console.error('獲取用戶資料失敗:', error));
}

function updateUser() {
    const id = document.getElementById('editUserID').value;
    const username = document.getElementById('editUsername').value;
    
    fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            is_active: true // 保留原有狀態，不再從表單獲取
        })
    })
    .then(() => {
        document.getElementById('editUserModal').style.display = 'none';
        fetchUsers();
    })
    .catch(error => console.error('更新用戶失敗:', error));
}

function toggleUserStatus(id, status) {
    fetchWithAuth(`${API_BASE_URL}/users/${id}/status?status=${status}`, {
        method: 'PATCH'
    })
    .then(() => fetchUsers())
    .catch(error => console.error('更新用戶狀態失敗:', error));
}

function deleteUser(id) {
    if (confirm('確定要刪除此用戶嗎？')) {
        fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
            method: 'DELETE'
        })
        .then(() => fetchUsers())
        .catch(error => console.error('刪除用戶失敗:', error));
    }
}

// 服務操作函數
function showAddServiceModal() {
    document.getElementById('addServiceModal').style.display = 'block';
}

function addService() {
    const name = document.getElementById('newServiceName').value;
    const description = document.getElementById('newServiceDescription').value;
    const baseUrl = document.getElementById('newServiceBaseUrl').value;
    
    fetchWithAuth(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            description: description,
            base_url: baseUrl,
            is_active: true
        })
    })
    .then(() => {
        document.getElementById('addServiceModal').style.display = 'none';
        fetchServices();
    })
    .catch(error => console.error('添加服務失敗:', error));
}

// 獲取服務資料並顯示編輯模態窗口
function editService(id) {
    fetchWithAuth(`${API_BASE_URL}/services/${id}`)
        .then(service => {
            document.getElementById('editServiceID').value = service.id;
            document.getElementById('editServiceName').value = service.name;
            document.getElementById('editServiceDescription').value = service.description;
            document.getElementById('editServiceBaseUrl').value = service.base_url;
            
            document.getElementById('editServiceModal').style.display = 'block';
        })
        .catch(error => console.error('獲取服務資料失敗:', error));
}

// 更新服務資料
function updateService() {
    const id = document.getElementById('editServiceID').value;
    const name = document.getElementById('editServiceName').value;
    const description = document.getElementById('editServiceDescription').value;
    const baseUrl = document.getElementById('editServiceBaseUrl').value;
    
    fetchWithAuth(`${API_BASE_URL}/services/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            description: description,
            base_url: baseUrl,
            is_active: true // 保留原有狀態，不再從表單獲取
        })
    })
    .then(() => {
        document.getElementById('editServiceModal').style.display = 'none';
        fetchServices();
    })
    .catch(error => console.error('更新服務失敗:', error));
}

function toggleServiceStatus(id, status) {
    fetchWithAuth(`${API_BASE_URL}/services/${id}/status?status=${status}`, {
        method: 'PATCH'
    })
    .then(() => fetchServices())
    .catch(error => console.error('更新服務狀態失敗:', error));
}

function deleteService(id) {
    if (confirm('確定要刪除此服務嗎？')) {
        fetchWithAuth(`${API_BASE_URL}/services/${id}`, {
            method: 'DELETE'
        })
        .then(() => fetchServices())
        .catch(error => console.error('刪除服務失敗:', error));
    }
}

// Token操作函數
function showAddTokenModal() {
    document.getElementById('addTokenModal').style.display = 'block';
    document.getElementById('newTokenIsPermanent').checked = false;
    toggleExpiryDateField();
}

function addToken() {
    const userId = document.getElementById('newTokenUserId').value;
    const serviceId = document.getElementById('newTokenServiceId').value;
    const isPermanent = document.getElementById('newTokenIsPermanent').checked;
    const description = document.getElementById('newTokenDescription').value;
    
    const requestBody = {
        user_id: parseInt(userId),
        service_id: parseInt(serviceId),
        is_permanent: isPermanent,
        description: description
    };
    
    // 如果不是永久有效，則加入過期時間
    if (!isPermanent) {
        const expiresAt = document.getElementById('newTokenExpires').value;
        if (!expiresAt) {
            alert('請選擇過期時間或勾選永久有效');
            return;
        }
        requestBody.expires_at = new Date(expiresAt).toISOString();
    }
    
    fetchWithAuth(`${API_BASE_URL}/tokens`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(() => {
        document.getElementById('addTokenModal').style.display = 'none';
        fetchTokens();
    })
    .catch(error => console.error('添加Token失敗:', error));
}

function editToken(id) {
    // 獲取Token資料並顯示編輯模態窗口
    fetchWithAuth(`${API_BASE_URL}/tokens/${id}`)
        .then(token => {
            document.getElementById('editTokenID').value = token.id;
            document.getElementById('editTokenValue').value = token.token_value;
            document.getElementById('editTokenUser').value = token.user.username;
            document.getElementById('editTokenService').value = token.service.name;
            
            // 帶入備註說明
            document.getElementById('editTokenDescription').value = token.description || '';
            
            // 判斷是否為永久Token
            const isPermanent = isPermanentToken(token.expires_at);
            document.getElementById('editTokenIsPermanent').checked = isPermanent;
            
            // 設置過期時間
            if (!isPermanent) {
                const expiryDate = new Date(token.expires_at);
                document.getElementById('editTokenExpires').value = expiryDate.toISOString().slice(0, 16);
            }
            
            // 根據是否永久有效顯示/隱藏過期時間欄位
            toggleEditExpiryDateField();
            
            document.getElementById('editTokenModal').style.display = 'block';
        })
        .catch(error => console.error('獲取Token資料失敗:', error));
}

function updateToken() {
    const id = document.getElementById('editTokenID').value;
    const isPermanent = document.getElementById('editTokenIsPermanent').checked;
    const description = document.getElementById('editTokenDescription').value;
    
    const requestBody = {
        is_permanent: isPermanent,
        // 保留原有的啟用狀態，不再從表單獲取
        is_active: true,
        description: description
    };
    
    // 如果不是永久有效，則加入過期時間
    if (!isPermanent) {
        const expiresAt = document.getElementById('editTokenExpires').value;
        if (!expiresAt) {
            alert('請選擇過期時間或勾選永久有效');
            return;
        }
        requestBody.expires_at = new Date(expiresAt).toISOString();
    }
    
    fetchWithAuth(`${API_BASE_URL}/tokens/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(() => {
        document.getElementById('editTokenModal').style.display = 'none';
        fetchTokens();
    })
    .catch(error => console.error('更新Token失敗:', error));
}

function toggleTokenStatus(id, status) {
    fetchWithAuth(`${API_BASE_URL}/tokens/${id}/status?status=${status}`, {
        method: 'PATCH'
    })
    .then(() => fetchTokens())
    .catch(error => console.error('更新Token狀態失敗:', error));
}

function deleteToken(id) {
    if (confirm('確定要刪除此Token嗎？')) {
        fetchWithAuth(`${API_BASE_URL}/tokens/${id}`, {
            method: 'DELETE'
        })
        .then(() => fetchTokens())
        .catch(error => console.error('刪除Token失敗:', error));
    }
}

// 判斷 Token 是否為永久有效
function isPermanentToken(expiresAt) {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    // 如果過期時間在 900 年之後，視為永久有效
    return (expiryDate.getFullYear() - now.getFullYear() >= 900);
}

// 切換過期日期欄位的顯示/隱藏
function toggleExpiryDateField() {
    const isPermanent = document.getElementById('newTokenIsPermanent').checked;
    const expiresAtGroup = document.getElementById('expiresAtGroup');
    
    if (isPermanent) {
        expiresAtGroup.style.display = 'none';
    } else {
        expiresAtGroup.style.display = 'block';
    }
}

// 切換編輯模式中過期日期欄位的顯示/隱藏
function toggleEditExpiryDateField() {
    const isPermanent = document.getElementById('editTokenIsPermanent').checked;
    const expiresAtGroup = document.getElementById('editExpiresAtGroup');
    
    if (isPermanent) {
        expiresAtGroup.style.display = 'none';
    } else {
        expiresAtGroup.style.display = 'block';
    }
}

// 關閉模態窗口
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 複製Token
function copyToken(tokenValue) {
    navigator.clipboard.writeText(tokenValue)
        .then(() => {
            // 找到被點擊的按鈕
            const buttons = document.querySelectorAll(`button[onclick="copyToken('${tokenValue}')"]`);
            if (buttons.length > 0) {
                const button = buttons[0];
                const originalText = button.textContent;
                
                // 修改按鈕文字和樣式
                button.textContent = 'copied!';
                button.classList.remove('btn-info');
                button.classList.add('btn-success');
                
                // 2秒後恢復原樣
                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-info');
                }, 2000);
            }
        })
        .catch(error => {
            console.error('複製Token失敗:', error);
        });
}

// 登出
function logout() {
    fetch('/logout', { method: 'GET' })
        .then(() => {
            window.location.href = '/login';
        })
        .catch(error => {
            console.error('登出失敗:', error);
        });
}