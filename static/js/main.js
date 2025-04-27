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
    // 先獲取最近統計數據，這將提供基本的圓餅圖數據
    fetchRecentStats()
        .then(recentStats => {
            // 更新統計卡片
            renderRecentStats(recentStats);
            
            // 接著獲取服務使用量數據，用於繪製服務使用量圖表
            return fetchServicesUsageStats();
        })
        .then(servicesStats => {
            // 繪製服務使用量圖表
            renderServicesUsageStats(servicesStats);
            
            // 初始化每日請求圖表
            initDailyRequestsChart();
        })
        .catch(error => {
            console.error('載入儀表板數據失敗:', error);
        });
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

// 獲取Token列表
function fetchTokens() {
    fetchWithAuth(`${API_BASE_URL}/tokens`)
        .then(tokens => {
            renderTokenTable(tokens);
        })
        .catch(error => console.error('獲取Token失敗:', error));
}

// 獲取最近統計數據 - 返回 Promise 以便鏈式調用
function fetchRecentStats() {
    return fetchWithAuth(`${API_BASE_URL}/stats/recent`)
        .catch(error => {
            console.error('獲取統計數據失敗:', error);
            return []; // 返回空數組以避免後續處理出錯
        });
}

// 獲取服務使用量統計 - 返回 Promise 以便鏈式調用
function fetchServicesUsageStats() {
    return fetchWithAuth(`${API_BASE_URL}/stats/services`)
        .catch(error => {
            console.error('獲取服務使用量統計失敗:', error);
            return []; // 返回空數組以避免後續處理出錯
        });
}

// 初始化每日請求圖表
function initDailyRequestsChart() {
    fetchWithAuth(`${API_BASE_URL}/stats/recent?days=30`)
        .then(data => {
            const dailyRequestsCanvas = document.getElementById('dailyRequestsChart');
            if (!dailyRequestsCanvas) return;
            
            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);
            
            new Chart(dailyRequestsCanvas, {
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

// 渲染服務使用量統計
function renderServicesUsageStats(stats) {
    // 確保有數據
    if (!stats || !stats.length) {
        console.warn('沒有可用的服務使用量數據');
        return;
    }

    // 初始化服務使用量圖表
    const serviceUsageCanvas = document.getElementById('serviceUsageChart');
    if (!serviceUsageCanvas) return;

    // 準備圖表數據
    const labels = stats.map(s => s.service_name);
    const data = stats.map(s => s.count);
    const backgroundColors = generateColors(stats.length);
    
    // 繪製圖表
    window.serviceChart = new Chart(serviceUsageCanvas, {
        type: 'bar',
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
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
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