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
    // 獲取統計數據
    fetchRecentStats();
    fetchServicesUsageStats();
    
    // 若有圖表，初始化圖表
    initCharts();
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

// 獲取最近統計數據
function fetchRecentStats() {
    fetchWithAuth(`${API_BASE_URL}/stats/recent`)
        .then(stats => {
            renderRecentStats(stats);
        })
        .catch(error => console.error('獲取統計數據失敗:', error));
}

// 獲取服務使用量統計
function fetchServicesUsageStats() {
    fetchWithAuth(`${API_BASE_URL}/stats/services`)
        .then(stats => {
            renderServicesUsageStats(stats);
        })
        .catch(error => console.error('獲取服務使用量統計失敗:', error));
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
    // 這裡根據實際需求渲染統計數據到儀表板
    const totalRequests = stats.reduce((sum, day) => sum + day.count, 0);
    const totalUsers = stats.reduce((max, day) => Math.max(max, day.user_count), 0);
    const totalServices = stats.reduce((max, day) => Math.max(max, day.service_count), 0);
    const totalTokens = stats.reduce((max, day) => Math.max(max, day.token_count), 0);
    
    // 更新統計卡片
    document.getElementById('totalRequests').textContent = totalRequests;
    document.getElementById('activeUsers').textContent = totalUsers;
    document.getElementById('activeServices').textContent = totalServices;
    document.getElementById('activeTokens').textContent = totalTokens;
}

// 渲染服務使用量統計
function renderServicesUsageStats(stats) {
    // 在這裡可以初始化服務使用量的圖表
    if (window.serviceChart) {
        // 更新圖表數據
        const labels = stats.map(s => s.service_name);
        const data = stats.map(s => s.count);
        
        window.serviceChart.data.labels = labels;
        window.serviceChart.data.datasets[0].data = data;
        window.serviceChart.update();
    }
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
            document.getElementById('editUserActive').checked = user.is_active;
            document.getElementById('editUserModal').style.display = 'block';
        })
        .catch(error => console.error('獲取用戶資料失敗:', error));
}

function updateUser() {
    const id = document.getElementById('editUserID').value;
    const username = document.getElementById('editUsername').value;
    const isActive = document.getElementById('editUserActive').checked;
    
    fetchWithAuth(`${API_BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            is_active: isActive
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

// 其他服務相關函數
function editService(id) {
    // 獲取服務資料並顯示編輯模態窗口
    // 類似editUser函數
}

function updateService() {
    // 更新服務資料
    // 類似updateUser函數
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
}

function addToken() {
    const userId = document.getElementById('newTokenUserId').value;
    const serviceId = document.getElementById('newTokenServiceId').value;
    const expiresAt = document.getElementById('newTokenExpires').value;
    
    fetchWithAuth(`${API_BASE_URL}/tokens`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: parseInt(userId),
            service_id: parseInt(serviceId),
            expires_at: new Date(expiresAt).toISOString()
        })
    })
    .then(() => {
        document.getElementById('addTokenModal').style.display = 'none';
        fetchTokens();
    })
    .catch(error => console.error('添加Token失敗:', error));
}

// 其他Token相關函數
function editToken(id) {
    // 獲取Token資料並顯示編輯模態窗口
}

function updateToken() {
    // 更新Token資料
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

// 關閉模態窗口
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 登出
function logout() {
    localStorage.removeItem('auth');
    window.location.href = '/';
}