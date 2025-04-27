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
        const stats = await fetchWithAuth(`${API_BASE_URL}/stats/recent?days=${days}`);
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
    // 移除了 Basic Auth 認證，改為使用 Cookie 中的 Session
    // Session 憑證會自動隨請求發送
    return fetch(url, {
        ...options,
        credentials: 'include' // 確保發送 Cookie
    }).then(response => {
        if (response.status === 401) {
            // 認證失敗，重定向到登入頁面
            window.location.href = '/login';
            return Promise.reject('認證失敗');
        }
        return response.json();
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
            renderTokenTable(tokens);
        })
        .catch(error => console.error('獲取Token失敗:', error));
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
            
            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);
            
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
                        tension: 0.1
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

// 渲染Token表格
function renderTokenTable(tokens) {
    const tableBody = document.getElementById('tokenTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    tokens.forEach(token => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${token.id}</td>
            <td>${token.token_value}</td>
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

// 渲染最近統計數據
function renderRecentStats(stats) {
    // 確保有數據
    if (!stats || !stats.length) {
        console.warn('沒有可用的統計數據');
        return;
    }

    // 計算總數
    const totalRequests = stats.reduce((sum, day) => sum + day.count, 0);
    const totalUsers = Math.max(...stats.map(day => day.user_count));
    const totalServices = Math.max(...stats.map(day => day.service_count));
    const totalTokens = Math.max(...stats.map(day => day.token_count));
    
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
            } : undefined
        }
    });
}

// 更新使用者服務使用量圖表
function updateUserServiceChart() {
    const userId = document.getElementById('userServiceSelector').value;
    if (!userId) {
        return; // 未選擇使用者
    }
    
    fetchWithAuth(`${API_BASE_URL}/stats/users/services`)
        .then(data => {
            // 過濾特定使用者的數據
            const userData = data.filter(item => item.user_id == userId);
            
            const userServiceCanvas = document.getElementById('userServiceChart');
            if (!userServiceCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.userService) {
                window.charts.userService.destroy();
            }
            
            // 准備圖表數據
            const labels = userData.map(d => d.service_name);
            const counts = userData.map(d => d.count);
            const backgroundColors = generateColors(userData.length);
            
            // 根據選擇的圖表類型創建圖表
            const chartType = window.chartTypes.userService || 'bar';
            
            // 配置數據集
            let datasets = [];
            if (chartType === 'line') {
                // 折線圖使用單一數據集
                datasets = [{
                    label: '使用次數',
                    data: counts,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }];
            } else {
                // 條形圖和圓餅圖使用帶顏色的數據集
                datasets = [{
                    label: '使用次數',
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.5', '1')),
                    borderWidth: 1
                }];
            }
            
            // 創建圖表
            window.charts.userService = new Chart(userServiceCanvas, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: chartType !== 'pie' ? {
                        y: {
                            beginAtZero: true
                        }
                    } : undefined
                }
            });
        })
        .catch(error => console.error('獲取使用者服務使用量數據失敗:', error));
}

// 更新使用者Token使用量圖表
function updateUserTokenChart() {
    const userId = document.getElementById('userTokenSelector').value;
    if (!userId) {
        return; // 未選擇使用者
    }
    
    fetchWithAuth(`${API_BASE_URL}/stats/users/tokens`)
        .then(data => {
            // 過濾特定使用者的數據
            const userData = data.filter(item => item.user_id == userId);
            
            const userTokenCanvas = document.getElementById('userTokenChart');
            if (!userTokenCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.userToken) {
                window.charts.userToken.destroy();
            }
            
            // 准備圖表數據
            const labels = userData.map(d => `${d.service_name} (${d.token_value.substring(0, 8)}...)`);
            const counts = userData.map(d => d.count);
            const backgroundColors = generateColors(userData.length);
            
            // 根據選擇的圖表類型創建圖表
            const chartType = window.chartTypes.userToken || 'bar';
            
            // 配置數據集
            let datasets = [];
            if (chartType === 'line') {
                // 折線圖使用單一數據集
                datasets = [{
                    label: 'Token使用次數',
                    data: counts,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }];
            } else {
                // 條形圖和圓餅圖使用帶顏色的數據集
                datasets = [{
                    label: 'Token使用次數',
                    data: counts,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.5', '1')),
                    borderWidth: 1
                }];
            }
            
            // 創建圖表
            window.charts.userToken = new Chart(userTokenCanvas, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: chartType !== 'pie' ? {
                        y: {
                            beginAtZero: true
                        }
                    } : undefined
                }
            });
        })
        .catch(error => console.error('獲取使用者Token使用量數據失敗:', error));
}

// 更新Token隨時間使用量圖表
function updateTokenTimeChart() {
    const tokenId = document.getElementById('tokenTimeSelector').value;
    if (!tokenId) {
        return; // 未選擇Token
    }
    
    // 顯示載入中的提示
    console.log(`正在載入 Token ID ${tokenId} 的時間使用量數據...`);
    
    fetchWithAuth(`${API_BASE_URL}/stats/tokens/${tokenId}/time`)
        .then(data => {
            console.log('Token時間使用量數據載入成功:', data);
            
            const tokenTimeCanvas = document.getElementById('tokenTimeChart');
            if (!tokenTimeCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.tokenTime) {
                window.charts.tokenTime.destroy();
            }
            
            // 如果沒有數據，顯示提示
            if (!data || data.length === 0) {
                console.warn('沒有可用的Token使用時間數據');
                // 創建一個空的圖表以顯示"無數據"訊息
                window.charts.tokenTime = new Chart(tokenTimeCanvas, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Token使用次數',
                            data: [],
                            fill: false,
                            borderColor: 'rgb(54, 162, 235)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: '無可用數據'
                            }
                        }
                    }
                });
                return;
            }
            
            // 獲取選定的時間範圍
            const days = document.getElementById('tokenTimeRange').value || 30;
            
            // 過濾最近X天的數據
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            
            // 格式化日期並排序
            let filteredData = data
                .filter(item => {
                    // 確保日期格式正確，可能需要添加時區考慮
                    const itemDate = new Date(item.date);
                    return !isNaN(itemDate) && itemDate >= cutoffDate;
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // 生成時間序列，填補空缺日期
            const dateRange = generateDateRange(cutoffDate, new Date());
            const dateMap = {};
            filteredData.forEach(item => {
                dateMap[item.date] = item.count;
            });
            
            const dates = dateRange;
            const counts = dateRange.map(date => dateMap[date] || 0);
            
            console.log('Token時間使用量圖表數據準備完成:', { dates, counts });
            
            // 創建圖表
            window.charts.tokenTime = new Chart(tokenTimeCanvas, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Token使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
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
        })
        .catch(error => console.error('獲取Token使用量數據失敗:', error));
}

// 更新服務隨時間使用量圖表
function updateServiceTimeChart() {
    const serviceId = document.getElementById('serviceTimeSelector').value;
    if (!serviceId) {
        return; // 未選擇服務
    }
    
    // 顯示載入中的提示
    console.log(`正在載入 Service ID ${serviceId} 的時間使用量數據...`);
    
    fetchWithAuth(`${API_BASE_URL}/stats/services/${serviceId}/time`)
        .then(data => {
            console.log('服務時間使用量數據載入成功:', data);
            
            const serviceTimeCanvas = document.getElementById('serviceTimeChart');
            if (!serviceTimeCanvas) return;
            
            // 若已存在圖表，則先銷毀
            if (window.charts.serviceTime) {
                window.charts.serviceTime.destroy();
            }
            
            // 如果沒有數據，顯示提示
            if (!data || data.length === 0) {
                console.warn('沒有可用的服務使用時間數據');
                // 創建一個空的圖表以顯示"無數據"訊息
                window.charts.serviceTime = new Chart(serviceTimeCanvas, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: '服務使用次數',
                            data: [],
                            fill: false,
                            borderColor: 'rgb(255, 99, 132)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: '無可用數據'
                            }
                        }
                    }
                });
                return;
            }
            
            // 獲取選定的時間範圍
            const days = document.getElementById('serviceTimeRange').value || 30;
            
            // 過濾最近X天的數據
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            
            // 格式化日期並排序
            let filteredData = data
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return !isNaN(itemDate) && itemDate >= cutoffDate;
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // 生成時間序列，填補空缺日期
            const dateRange = generateDateRange(cutoffDate, new Date());
            const dateMap = {};
            filteredData.forEach(item => {
                dateMap[item.date] = item.count;
            });
            
            const dates = dateRange;
            const counts = dateRange.map(date => dateMap[date] || 0);
            
            console.log('服務時間使用量圖表數據準備完成:', { dates, counts });
            
            // 創建圖表
            window.charts.serviceTime = new Chart(serviceTimeCanvas, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: '服務使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
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
        })
        .catch(error => console.error('獲取服務使用量數據失敗:', error));
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

// 生成日期範圍
function generateDateRange(startDate, endDate) {
    const dateArray = [];
    let currentDate = new Date(startDate);
    
    // 確保日期格式一致
    currentDate.setHours(0, 0, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDateTime) {
        dateArray.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }
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
    
    const requestBody = {
        user_id: parseInt(userId),
        service_id: parseInt(serviceId),
        is_permanent: isPermanent
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
    
    const requestBody = {
        is_permanent: isPermanent,
        // 保留原有的啟用狀態，不再從表單獲取
        is_active: true
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

// 登出
function logout() {
    localStorage.removeItem('auth');
    window.location.href = '/';
}