// 基礎設施管理系統的主要JavaScript文件

// 全局變數
const API_BASE_URL = '/admin';

// Helper: 確保 select 中不會重複加入相同 value 的 option
function ensureSelectOption(selectElem, value, text) {
    if (!selectElem) return false;
    const valStr = String(value);
    // 如果已存在相同 value 的 option，則跳過
    if (selectElem.querySelector(`option[value="${valStr}"]`)) return false;
    const opt = document.createElement('option');
    opt.value = valStr;
    opt.textContent = text;
    selectElem.appendChild(opt);
    return true;
}

// DOM Ready事件
document.addEventListener('DOMContentLoaded', function () {
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
        logoutLink.addEventListener('click', function () {
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
    const revision = window.dashboardRevision = (window.dashboardRevision || 0) + 1;
    try {
        console.log('開始載入儀表板數據...');

        // 1. 載入基礎統計數據並更新每日請求圖表
        const recentStats = await fetchRecentStats();
        if (window.dashboardRevision !== revision) return;
        console.log('基礎統計數據載入完成:', recentStats);
        renderRecentStats(recentStats);
        await updateDailyRequestsChart();

        // 2. 載入並渲染服務使用量統計
        const servicesStats = await fetchServicesUsageStats();
        if (window.dashboardRevision !== revision) return;
        console.log('服務使用量數據載入完成:', servicesStats);
        renderServicesUsageChart(servicesStats);

        // 3. 載入用戶、服務和Token數據，填充選擇器
        const [users, services, tokens] = await Promise.all([
            fetchUsersData(),
            fetchServicesData(),
            fetchTokensData()
        ]);
        if (window.dashboardRevision !== revision) return;

        console.log('用戶數據載入完成:', users.length);
        console.log('服務數據載入完成:', services.length);
        console.log('Token數據載入完成:', tokens.length);

        fillUserSelectors(users);
        fillServiceSelectors(services);
        fillTokenSelectors(tokens);

        // 4. 以「全部」為預設，載入圖表
        try {
            updateUserServiceChart();
            updateUserTokenChart();
            updateServiceTimeChart();
            updateTokenTimeChart();
        } catch (err) {
            console.warn('初始化圖表時發生錯誤', err);
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
        const days = 30;
        console.log(`獲取最近${days}天的統計數據...`);
        const response = await fetch(`${API_BASE_URL}/stats/dashboard-recent?days=${days}`, {
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
        if (!userId || userId === 'all') return stats || [];
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
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
    cutoffDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    return stats.filter(item => {
        const itemDate = new Date(item.date);
        return !isNaN(itemDate) && itemDate >= cutoffDate && itemDate < endDate;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// 更新圖表選擇器並保留仍有效的選擇。
function refreshChartSelector(id, items, label) {
    const selector = document.getElementById(id);
    if (!selector) return;
    const previous = selector.value;
    const all = Array.from(selector.options).find(option => option.value === 'all');
    selector.replaceChildren();
    if (all) selector.appendChild(all);
    for (const item of items) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = label(item);
        selector.appendChild(option);
    }
    selector.value = Array.from(selector.options).some(option => option.value === previous) ? previous : 'all';
}

function fillUserSelectors(users) {
    const active = (users || []).filter(user => user.is_active);
    refreshChartSelector('userServiceSelector', active, user => user.username);
    refreshChartSelector('userTokenSelector', active, user => user.username);
}

function fillServiceSelectors(services) {
    const active = (services || []).filter(service => service.is_active);
    refreshChartSelector('serviceTimeSelector', active, service => service.name);
}

function fillTokenSelectors(tokens) {
    const active = (tokens || []).filter(token => token.is_active && !token.disabled);
    refreshChartSelector('tokenTimeSelector', active, token => `${token.user?.username || '未知用戶'} - ${token.service?.name || '未知服務'} (${token.token_value?.substring(0, 8)}...)`);
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
    const tomorrowString = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const newTokenExpiresField = document.getElementById('newTokenExpires');
    if (newTokenExpiresField) {
        newTokenExpiresField.value = tomorrowString;
    }
}

// API調用相關函數
function showApiError(message) {
    let notice = document.getElementById('apiErrorNotice');
    if (!notice) { notice = document.createElement('div'); notice.id = 'apiErrorNotice'; notice.setAttribute('role','alert'); document.body.appendChild(notice); }
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(notice.dismissTimer);
    notice.dismissTimer = setTimeout(() => { notice.hidden = true; }, 6000);
}

async function fetchWithAuth(url, options = {}) {
    try {
        const response = await fetch(url, {...options, credentials:'include'});
        if (response.redirected && new URL(response.url).pathname === '/login') { window.location.href='/login'; throw new Error('請重新登入'); }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error(`伺服器回應格式錯誤（${response.status}）`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || `請求失敗（${response.status}）`);
        return data;
    } catch (error) {
        showApiError(error.message || '連線失敗，請稍後再試');
        throw error;
    }
}

function tableMessage(id, message) {
    const body = document.getElementById(id); if (!body) return;
    const row = document.createElement('tr'); const cell = document.createElement('td');
    cell.colSpan = 8; cell.textContent = message; row.append(cell); body.replaceChildren(row);
}

// 獲取用戶列表
function fetchUsers() {
    fetchWithAuth(`${API_BASE_URL}/users`)
        .then(users => {
            renderUserTable(users);
            fillUserDropdown(users); // 填充使用者下拉選單
        })
        .catch(error => { tableMessage('userTableBody', '無法載入使用者'); console.error('獲取用戶失敗:', error); });
}

// 獲取服務列表
function fetchServices() {
    fetchWithAuth(`${API_BASE_URL}/services`)
        .then(services => {
            renderServiceTable(services);
            fillServiceDropdown(services); // 填充服務下拉選單
        })
        .catch(error => { tableMessage('serviceTableBody', '無法載入服務'); console.error('獲取服務失敗:', error); });
}

// 填充使用者下拉選單
function fillUserDropdown(users) {
    const userSelect = document.getElementById('newTokenUserId');
    const filterTokenUser = document.getElementById('filterTokenUser');

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

    if (filterTokenUser) {
        users.forEach(user => {
            if (user.is_active) {
                ensureSelectOption(filterTokenUser, user.id, user.username);
            }
        });
        console.log(`填充 filterTokenUser，使用者數: ${users.filter(u => u.is_active).length}`);
    }
}

// 填充服務下拉選單
function fillServiceDropdown(services) {
    const serviceSelect = document.getElementById('newTokenServiceId');
    const filterTokenService = document.getElementById('filterTokenService');

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

    if (filterTokenService) {
        services.forEach(service => {
            if (service.is_active) {
                ensureSelectOption(filterTokenService, service.id, service.name);
            }
        });
        console.log(`填充 filterTokenService，服務數: ${services.filter(s => s.is_active).length}`);
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

// 獲取Token列表（可選 userId, serviceId 作為過濾）
function fetchTokens(userId = '', serviceId = '', status = '') {
    let url = `${API_BASE_URL}/tokens`;
    const params = [];
    if (userId) params.push(`user_id=${encodeURIComponent(userId)}`);
    if (serviceId) params.push(`service_id=${encodeURIComponent(serviceId)}`);
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (params.length) url += `?${params.join('&')}`;

    fetchWithAuth(url)
        .then(tokens => {
            // 使用統一的渲染函數
            const list = tokens || [];
            renderTokenTable(list);
            // 若篩選下拉仍無選項，嘗試從 token 列表反補
            syncTokenFiltersFromTokens(list);
        })
        .catch(error => { tableMessage('tokenTableBody', '無法載入 Token'); console.error('獲取Token失敗:', error); });
}

// 應用目前的 Token 篩選器
function applyTokenFilters() {
    const userId = document.getElementById('filterTokenUser')?.value || '';
    const serviceId = document.getElementById('filterTokenService')?.value || '';
    const status = document.getElementById('filterTokenStatus')?.value || '';
    fetchTokens(userId, serviceId, status);
}

// 清除 Token 篩選器
function clearTokenFilters() {
    const userSelect = document.getElementById('filterTokenUser');
    const serviceSelect = document.getElementById('filterTokenService');
    if (userSelect) userSelect.value = '';
    if (serviceSelect) serviceSelect.value = '';
    const statusSelect = document.getElementById('filterTokenStatus');
    if (statusSelect) statusSelect.value = '';
    fetchTokens();
}

// 若 user/service 篩選下拉尚未有選項，從 tokens 裡補齊
function syncTokenFiltersFromTokens(tokens) {
    if (!tokens || !tokens.length) return;

    const userSelect = document.getElementById('filterTokenUser');
    const serviceSelect = document.getElementById('filterTokenService');

    if (userSelect && userSelect.options.length <= 1) {
        // 收集不重複的使用者
        const usersMap = {};
        tokens.forEach(t => {
            if (t.user && t.user.id && t.user.username) usersMap[t.user.id] = t.user.username;
        });
        Object.keys(usersMap).forEach(id => {
            ensureSelectOption(userSelect, id, usersMap[id]);
        });
        console.log(`從 tokens 補充 filterTokenUser，新增 ${Object.keys(usersMap).length} 個項目（避免重複）`);
    }

    if (serviceSelect && serviceSelect.options.length <= 1) {
        const servicesMap = {};
        tokens.forEach(t => {
            if (t.service && t.service.id && t.service.name) servicesMap[t.service.id] = t.service.name;
        });
        Object.keys(servicesMap).forEach(id => {
            ensureSelectOption(serviceSelect, id, servicesMap[id]);
        });
        console.log(`從 tokens 補充 filterTokenService，新增 ${Object.keys(servicesMap).length} 個項目（避免重複）`);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

async function copyTableValue(button, value) {
    try { await navigator.clipboard.writeText(value); const label=button.textContent; button.textContent='已複製'; setTimeout(()=>{button.textContent=label;},2000); }
    catch { showApiError('複製失敗，請檢查瀏覽器剪貼簿權限。'); }
}

// 渲染Token表格
function renderTokenTable(tokens) {
    const tableBody = document.getElementById('tokenTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    if (!tokens.length) { tableMessage('tokenTableBody', '目前沒有Token'); return; }
    tokens.forEach(token => {
        const row = document.createElement('tr');

        // 判斷是否過期
        const expiryDate = token.expires_at ? new Date(token.expires_at) : null;
        const isPermanent = token.expires_at ? isPermanentToken(token.expires_at) : false;
        const isExpired = expiryDate && !isPermanent && expiryDate < new Date();
        if (isExpired) row.classList.add('token-expired');

        const displayToken = token.token_value || '-';
        const serviceName = token.service ? token.service.name : '';

        // 狀態邏輯：過期 > 失效(Disabled) > 停用/啟用
        let statusHtml = '';
        if (isExpired) {
            statusHtml = `<span class="text-danger">已過期</span>`;
        } else if (token.disabled) {
            statusHtml = `<span class="text-danger">失效</span>`;
        } else {
            statusHtml = token.is_active ? '<span class="text-success">啟用</span>' : '<span class="text-danger">停用</span>';
        }

        // 若 token 被標記為 Disabled，則停用「停用/啟用」按鈕
        const toggleButtonHtml = token.disabled ?
            `<button class="btn btn-secondary btn-sm" disabled>已失效</button>` :
            `<button class="btn ${token.is_active ? 'btn-warning' : 'btn-success'} btn-sm" onclick="toggleTokenStatus(${token.id}, ${!token.is_active})">
                    ${token.is_active ? '停用' : '啟用'}
                </button>`;

        row.innerHTML = `
            <td>${token.id}</td>
            <td class="td-token">
                <div class="token-text" title="${escapeHtml(token.token_value)}">${escapeHtml(displayToken)}</div>
                <div class="token-actions">
                    <button class="btn btn-info btn-sm" data-action="copy-token">複製</button>
                    <button class="btn btn-secondary btn-sm" data-action="copy-url">複製請求網址</button>
                </div>
            </td>
            <td>${escapeHtml(token.user ? token.user.username : '未知使用者')}</td>
            <td>${escapeHtml(token.service ? token.service.name : '未知服務')}</td>
            <td class="td-description">${escapeHtml(token.description ? token.description : '-')}</td>
            <td>${token.expires_at ? (isPermanent ? '永久有效' : new Date(token.expires_at).toLocaleString()) : '-'}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editToken(${token.id})">編輯</button>
                ${toggleButtonHtml}
                <button class="btn btn-danger btn-sm" onclick="deleteToken(${token.id})">刪除</button>
            </td>
        `;
        row.querySelector('[data-action="copy-token"]').addEventListener('click', event => copyTableValue(event.currentTarget, token.token_value));
        row.querySelector('[data-action="copy-url"]').addEventListener('click', event => {
            const service = encodeURIComponent(serviceName);
            const value = encodeURIComponent(token.token_value);
            copyTableValue(event.currentTarget, `${window.location.origin}/use/${service}/${value}/`);
        });
        tableBody.appendChild(row);
    });
}

// 忽略過期回應，避免重複建立或覆蓋較新的圖表。
function beginChartUpdate(name) {
    window.chartRevisions ||= {};
    window.chartRevisions[name] = (window.chartRevisions[name] || 0) + 1;
    return window.chartRevisions[name];
}

// 更新每日請求數量趨勢圖
function updateDailyRequestsChart() {
    const chartRevision = beginChartUpdate('dailyRequests');
    // 獲取選定的時間範圍
    const days = document.getElementById('dailyRequestsTimeRange').value || 30;

    fetchWithAuth(`${API_BASE_URL}/stats/dashboard-recent?days=${days}`)
        .then(data => {
            const dailyRequestsCanvas = document.getElementById('dailyRequestsChart');
            if (!dailyRequestsCanvas) return;

            // 若已存在圖表，則先銷毀

            // 確保數據按日期排序
            data.sort((a, b) => new Date(a.date) - new Date(b.date));

            const dates = data.map(d => d.date);
            const counts = data.map(d => d.count);

            console.log('每日請求數據:', { dates, counts });

            // 創建新圖表
            if (window.chartRevisions.dailyRequests !== chartRevision) return;
                if (window.charts.dailyRequests) window.charts.dailyRequests.destroy();
                window.charts.dailyRequests = new Chart(dailyRequestsCanvas, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: '每日請求數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: 'rgb(75, 192, 192)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function (tooltipItems) {
                                    return tooltipItems[0].label;
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
    if (!users.length) { tableMessage('userTableBody', '目前沒有使用者'); return; }
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id}</td>
            <td>${escapeHtml(user.username)}</td>
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
    if (!services.length) { tableMessage('serviceTableBody', '目前沒有服務'); return; }
    services.forEach(service => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${service.id}</td>
            <td>${escapeHtml(service.name)}</td>
            <td>${escapeHtml(service.description)}</td>
            <td>${escapeHtml(service.base_url)}</td>
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
    const element = document.getElementById('totalRequests');
    if (element) element.textContent = Array.isArray(stats) && stats.length ? stats.reduce((sum, day) => sum + (Number(day.count) || 0), 0) : '—';
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
    const backgroundColors = getPalette(stats.length);

    // 根據選擇的圖表類型創建圖表
    const chartType = window.chartTypes.serviceUsage || 'bar';

    // 計算總數(用於計算百分比)
    const total = data.reduce((acc, val) => acc + val, 0);

    // 只有在 datalabels 插件正確載入且 id 為 'datalabels' 時才啟用
    const includeDatalabels = (chartType === 'pie' || chartType === 'doughnut') && (window.ChartDataLabels && window.ChartDataLabels.id === 'datalabels');

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
                        label: function (context) {
                            if (chartType === 'pie' || chartType === 'doughnut') {
                                const value = context.raw;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} (${percentage}%)`;
                            }
                            return `${context.label}: ${context.raw}`;
                        }
                    }
                },
                // 如果是圓餅圖，直接在圖上顯示百分比（僅當插件存在時）
                datalabels: includeDatalabels ? {
                    formatter: (value, ctx) => {
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${percentage}%`;
                    },
                    color: '#fff',
                    font: {
                        weight: 'bold'
                    }
                } : undefined
            }
        }
    });
}

// 更新用戶服務使用量圖表
function updateUserServiceChart() {
    const chartRevision = beginChartUpdate('userService');
    const userId = document.getElementById('userServiceSelector').value || 'all';
    const chartType = window.chartTypes.userService || 'bar';
    const userServiceCanvas = document.getElementById('userServiceChart');
    if (!userServiceCanvas) return;

    if (userId === 'all') {
        // 顯示全部使用者的服務使用量
        if (chartType === 'line') {
            // 以每個服務為一條線，時間為 X 軸
            const days = document.getElementById('dailyRequestsTimeRange')?.value || 30;
            fetchServicesData().then(services => {
                const activeServices = services.filter(s => s.is_active);
                const promises = activeServices.map(s => fetchServiceTimeStats(s.id, days).then(data => ({ service: s, data })));
                Promise.all(promises).then(results => {
                    // 構建 servicesMap
                    const servicesMap = {};
                    results.forEach(r => {
                        const map = {};
                        r.data.forEach(item => { map[item.date] = item.count; });
                        servicesMap[r.service.id] = { name: r.service.name, data: map };
                    });

                    // 計算日期範圍
                    const cutoffDate = new Date();
                    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                    cutoffDate.setUTCHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setUTCHours(0, 0, 0, 0);
                    const dateRange = generateDateRange(cutoffDate, today);

                    // 準備數據集
                    const datasets = [];
                    const colors = getPalette(Object.keys(servicesMap).length);

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

                    if (window.chartRevisions.userService !== chartRevision) return;
                if (window.charts.userService) window.charts.userService.destroy();
                window.charts.userService = new Chart(userServiceCanvas, {
                        type: 'line',
                        data: { labels: dateRange, datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false
                        }
                    });
                });
            });
        } else {
            // bar / pie: 使用 services usage 統計
            fetchServicesUsageStats().then(data => {
                const labels = data.map(d => d.service_name);
                const counts = data.map(d => d.count);
                const colors = getPalette(labels.length);
                const total = counts.reduce((acc, val) => acc + val, 0);

                if (window.chartRevisions.userService !== chartRevision) return;
                if (window.charts.userService) window.charts.userService.destroy();
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
                        maintainAspectRatio: false
                    }
                });
            });
        }

        return;
    }

    // 若指定單一使用者，原有邏輯
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
                cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                cutoffDate.setUTCHours(0, 0, 0, 0);

                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                // 產生完整的日期範圍，包含今日
                const dateRange = generateDateRange(cutoffDate, today);

                // 準備數據集
                const datasets = [];
                const colors = getPalette(Object.keys(servicesMap).length);

                Object.keys(servicesMap).forEach((serviceId, idx) => {
                    const service = servicesMap[serviceId];
                    const serviceData = dateRange.map(date => service.data[date] || 0);

                    datasets.push({
                        label: service.name,
                        data: serviceData,
                        fill: false,
                        borderColor: colors[idx],
                        backgroundColor: colors[idx],
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: colors[idx]
                    });
                });

                // 創建圖表
                if (window.chartRevisions.userService !== chartRevision) return;
                if (window.charts.userService) window.charts.userService.destroy();
                window.charts.userService = new Chart(userServiceCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function (tooltipItems) {
                                        return tooltipItems[0].label;
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
            const colors = getPalette(labels.length);

            // 計算總數(用於計算百分比)
            const total = counts.reduce((acc, val) => acc + val, 0);

            // 只有在 datalabels 插件正確載入且 id 為 'datalabels' 時才啟用
            const includeDatalabels = (chartType === 'pie' || chartType === 'doughnut') && (window.ChartDataLabels && window.ChartDataLabels.id === 'datalabels');

            if (window.chartRevisions.userService !== chartRevision) return;
                if (window.charts.userService) window.charts.userService.destroy();
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
                                label: function (context) {
                                    if (chartType === 'pie' || chartType === 'doughnut') {
                                        const value = context.raw;
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: ${value} (${percentage}%)`;
                                    }
                                    return `${context.label}: ${context.raw}`;
                                }
                            }
                        },
                        // 如果是圓餅圖，直接在圖上顯示百分比（僅當插件存在時）
                        datalabels: includeDatalabels ? {
                            formatter: (value, ctx) => {
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${percentage}%`;
                            },
                            color: '#fff',
                            font: {
                                weight: 'bold'
                            }
                        } : undefined
                    }
                }
            });
        });
    }
}

// 更新使用者Token使用量圖表
function updateUserTokenChart() {
    const chartRevision = beginChartUpdate('userToken');
    const userId = document.getElementById('userTokenSelector').value || 'all';

    const chartType = window.chartTypes.userToken || 'bar';
    const userTokenCanvas = document.getElementById('userTokenChart');
    if (!userTokenCanvas) return;


    if (chartType === 'line') {
        // 折線圖：以時間為橫軸，每個token一條線
        const days = document.getElementById('dailyRequestsTimeRange')?.value || 30;

        if (userId === 'all') {
            // 對於全部使用者，針對每個 active token 取得時間序列
            fetchTokensData().then(tokens => {
                const activeTokens = tokens.filter(t => t.is_active);
                const promises = activeTokens.map(t => fetchTokenTimeStats(t.id, days).then(data => ({ token: t, data })));
                Promise.all(promises).then(results => {
                    // 計算日期範圍
                    const cutoffDate = new Date();
                    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                    cutoffDate.setUTCHours(0, 0, 0, 0);
                    const today = new Date();
                    today.setUTCHours(0, 0, 0, 0);
                    const dateRange = generateDateRange(cutoffDate, today);

                    const datasets = [];
                    const colors = getPalette(results.length);
                    results.forEach((r, idx) => {
                        const map = {};
                        r.data.forEach(item => { map[item.date] = item.count; });
                        const dataArr = dateRange.map(d => map[d] || 0);
                        datasets.push({
                            label: `${r.token.token_value.substring(0, 8)}... - ${r.token.service?.name || ''}`,
                            data: dataArr,
                            fill: false,
                            borderColor: colors[idx],
                            backgroundColor: colors[idx],
                            tension: 0.4,
                            cubicInterpolationMode: 'monotone',
                            pointRadius: 2
                        });
                    });

                    if (window.chartRevisions.userToken !== chartRevision) return;
                if (window.charts.userToken) window.charts.userToken.destroy();
                window.charts.userToken = new Chart(userTokenCanvas, {
                        type: 'line',
                        data: { labels: dateRange, datasets },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                });
            });

            return;
        }

        // 指定某使用者的折線圖
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
                cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                cutoffDate.setUTCHours(0, 0, 0, 0);

                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                // 產生完整的日期範圍，包含今日
                const dateRange = generateDateRange(cutoffDate, today);

                // 準備數據集
                const datasets = [];
                const colors = getPalette(Object.keys(tokensMap).length);

                Object.keys(tokensMap).forEach((tokenId, idx) => {
                    const token = tokensMap[tokenId];
                    const tokenData = dateRange.map(date => token.data[date] || 0);

                    datasets.push({
                        label: token.name,
                        data: tokenData,
                        fill: false,
                        borderColor: colors[idx],
                        backgroundColor: colors[idx],
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: colors[idx]
                    });
                });

                // 創建圖表
                if (window.chartRevisions.userToken !== chartRevision) return;
                if (window.charts.userToken) window.charts.userToken.destroy();
                window.charts.userToken = new Chart(userTokenCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    title: function (tooltipItems) {
                                        return tooltipItems[0].label;
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
            const colors = getPalette(data.length);

            // 計算總數(用於計算百分比)
            const total = counts.reduce((acc, val) => acc + val, 0);

            // 只有在 datalabels 插件正確載入且 id 為 'datalabels' 時才啟用
            const includeDatalabels = (chartType === 'pie' || chartType === 'doughnut') && (window.ChartDataLabels && window.ChartDataLabels.id === 'datalabels');

            if (window.chartRevisions.userToken !== chartRevision) return;
                if (window.charts.userToken) window.charts.userToken.destroy();
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
                                label: function (context) {
                                    if (chartType === 'pie' || chartType === 'doughnut') {
                                        const value = context.raw;
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return `${context.label}: ${value} (${percentage}%)`;
                                    }
                                    return `${context.label}: ${context.raw}`;
                                }
                            }
                        },
                        // 如果是圓餅圖，直接在圖上顯示百分比（僅當插件存在時）
                        datalabels: includeDatalabels ? {
                            formatter: (value, ctx) => {
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${percentage}%`;
                            },
                            color: '#fff',
                            font: {
                                weight: 'bold'
                            }
                        } : undefined
                    }
                }
            });
        });
    }
}

// 更新Token隨時間使用量圖表
function updateTokenTimeChart() {
    const chartRevision = beginChartUpdate('tokenTime');
    const tokenId = document.getElementById('tokenTimeSelector').value || 'all';

    // 獲取選定的時間範圍
    const days = document.getElementById('tokenTimeRange').value || 30;

    const tokenTimeCanvas = document.getElementById('tokenTimeChart');
    if (!tokenTimeCanvas) return;


    if (tokenId === 'all') {
        // 聚合所有 Token 的時間序列並畫多條線
        fetchTokensData().then(tokens => {
            const activeTokens = tokens.filter(t => t.is_active);
            const promises = activeTokens.map(t => fetchTokenTimeStats(t.id, days).then(data => ({ token: t, data })));
            Promise.all(promises).then(results => {
                // 計算日期範圍
                const cutoffDate = new Date();
                cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                cutoffDate.setUTCHours(0, 0, 0, 0);
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const dateRange = generateDateRange(cutoffDate, today);

                const datasets = [];
                const colors = getPalette(results.length);

                results.forEach((r, idx) => {
                    const map = {};
                    r.data.forEach(item => { map[item.date] = item.count; });
                    const dataArr = dateRange.map(d => map[d] || 0);
                    datasets.push({
                        label: `${r.token.token_value.substring(0, 8)}... - ${r.token.service?.name || ''}`,
                        data: dataArr,
                        fill: false,
                        borderColor: colors[idx],
                        tension: 0.1,
                        pointRadius: 3,
                        pointBackgroundColor: colors[idx]
                    });
                });

                if (window.chartRevisions.tokenTime !== chartRevision) return;
                if (window.charts.tokenTime) window.charts.tokenTime.destroy();
                window.charts.tokenTime = new Chart(tokenTimeCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }).catch(error => console.error('獲取Token時間使用量失敗:', error));
        });

        return;
    }

    fetchWithAuth(`${API_BASE_URL}/stats/tokens/${tokenId}/time`)
        .then(data => {
            const tokenTimeCanvas = document.getElementById('tokenTimeChart');
            if (!tokenTimeCanvas) return;

            // 若已存在圖表，則先銷毀

            // 計算日期範圍（過去X天到今天）
            const cutoffDate = new Date();
            cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
            cutoffDate.setUTCHours(0, 0, 0, 0);

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            // 產生完整的日期範圍，包含今日
            const dateRange = generateDateRange(cutoffDate, today);

            // 處理數據，填充日期範圍
            const dateMap = {};
            data.forEach(item => {
                dateMap[item.date] = item.count;
            });

            const counts = dateRange.map(date => dateMap[date] || 0);

            // 創建圖表
            if (window.chartRevisions.tokenTime !== chartRevision) return;
                if (window.charts.tokenTime) window.charts.tokenTime.destroy();
                window.charts.tokenTime = new Chart(tokenTimeCanvas, {
                type: 'line',
                data: {
                    labels: dateRange,
                    datasets: [{
                        label: 'Token使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: 'rgb(75, 192, 192)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function (tooltipItems) {
                                    return tooltipItems[0].label;
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
    const chartRevision = beginChartUpdate('serviceTime');
    const serviceId = document.getElementById('serviceTimeSelector').value || 'all';

    // 獲取選定的時間範圍
    const days = document.getElementById('serviceTimeRange').value || 30;

    const serviceTimeCanvas = document.getElementById('serviceTimeChart');
    if (!serviceTimeCanvas) return;


    if (serviceId === 'all') {
        // 取得所有服務的時間序列，然後依服務畫多條線
        fetchServicesData().then(services => {
            const activeServices = services.filter(s => s.is_active);
            const promises = activeServices.map(s => fetchServiceTimeStats(s.id, days).then(data => ({ service: s, data })));
            Promise.all(promises).then(results => {
                // 日期範圍
                const cutoffDate = new Date();
                cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
                cutoffDate.setUTCHours(0, 0, 0, 0);
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const dateRange = generateDateRange(cutoffDate, today);

                const datasets = [];
                const colors = getPalette(results.length);

                results.forEach((r, idx) => {
                    const map = {};
                    r.data.forEach(item => { map[item.date] = item.count; });
                    const dataArr = dateRange.map(d => map[d] || 0);
                    datasets.push({
                        label: r.service.name,
                        data: dataArr,
                        fill: false,
                        borderColor: colors[idx],
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: colors[idx]
                    });
                });

                if (window.chartRevisions.serviceTime !== chartRevision) return;
                if (window.charts.serviceTime) window.charts.serviceTime.destroy();
                window.charts.serviceTime = new Chart(serviceTimeCanvas, {
                    type: 'line',
                    data: { labels: dateRange, datasets },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }).catch(error => console.error('獲取服務時間使用量失敗:', error));
        });

        return;
    }

    fetchWithAuth(`${API_BASE_URL}/stats/services/${serviceId}/time`)
        .then(data => {
            const serviceTimeCanvas = document.getElementById('serviceTimeChart');
            if (!serviceTimeCanvas) return;

            // 若已存在圖表，則先銷毀

            // 計算日期範圍（過去X天到今天）
            const cutoffDate = new Date();
            cutoffDate.setUTCDate(cutoffDate.getUTCDate() - parseInt(days) + 1);
            cutoffDate.setUTCHours(0, 0, 0, 0);

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            // 產生完整的日期範圍，包含今日
            const dateRange = generateDateRange(cutoffDate, today);

            // 處理數據，填充日期範圍
            const dateMap = {};
            data.forEach(item => {
                dateMap[item.date] = item.count;
            });

            const counts = dateRange.map(date => dateMap[date] || 0);

            // 創建圖表
            if (window.chartRevisions.serviceTime !== chartRevision) return;
                if (window.charts.serviceTime) window.charts.serviceTime.destroy();
                window.charts.serviceTime = new Chart(serviceTimeCanvas, {
                type: 'line',
                data: {
                    labels: dateRange,
                    datasets: [{
                        label: '服務使用次數',
                        data: counts,
                        fill: false,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone',
                        pointRadius: 2,
                        pointBackgroundColor: 'rgb(255, 99, 132)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function (tooltipItems) {
                                    return tooltipItems[0].label;
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

// Chart.js 全域美化設定
// 數字格式化（千分位）
function formatNumber(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return new Intl.NumberFormat('zh-TW').format(value);
    // 若為字串數字，嘗試轉換
    const n = Number(value);
    if (!isNaN(n)) return new Intl.NumberFormat('zh-TW').format(n);
    return String(value);
}

// End formatNumber
if (window.Chart) {
    // 基本字體與色彩
    Chart.defaults.font.family = 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#2b3a4a';

    // 外觀與行為
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.elements.point.radius = 2;
    Chart.defaults.elements.line.tension = 0.3;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.animation = { duration: 700, easing: 'easeOutQuart' };

    // Tooltip 行為與格式化（使用千分位）
    Chart.defaults.plugins.tooltip.mode = 'index';
    Chart.defaults.plugins.tooltip.intersect = false;
    Chart.defaults.plugins.tooltip.callbacks = Chart.defaults.plugins.tooltip.callbacks || {};
    Chart.defaults.plugins.tooltip.callbacks.label = function (context) {
        const val = context.parsed && typeof context.parsed === 'object' ? context.parsed.y : (context.parsed ?? context.raw);
        const formatted = formatNumber(val);
        if (context.dataset && context.dataset.label) return `${context.dataset.label}: ${formatted}`;
        return formatted;
    };
}

// 改進預設色盤（更柔和的漸層）
function getPalette(count) {
    const base = [
        'rgba(45,109,163,0.85)',
        'rgba(76,175,80,0.85)',
        'rgba(255,159,64,0.85)',
        'rgba(158,113,255,0.85)',
        'rgba(255,99,132,0.85)',
        'rgba(54,162,235,0.85)'
    ];
    const palette = [];
    for (let i = 0; i < count; i++) {
        const c = base[i % base.length];
        palette.push(c.replace('0.85', '0.7'));
    }
    return palette;
}

// 生成日期範圍，確保今天是最後一個點
function generateDateRange(startDate, endDate) {
    const result = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    current.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    while (current <= end) {
        result.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return result;
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

async function deleteService(id) {
    try {
        const tokens = await fetchWithAuth(`${API_BASE_URL}/service-tokens/${id}`);
        if (!confirm(`確定刪除此服務？相關的 ${tokens.length} 個 Token 將永久失效。`)) return;
        await fetchWithAuth(`${API_BASE_URL}/services/${id}`, {method:'DELETE'});
        fetchServices();
    } catch (error) { console.error('刪除服務失敗:', error); }
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
                document.getElementById('editTokenExpires').value = new Date(expiryDate.getTime() - expiryDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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

    fetchWithAuth(`${API_BASE_URL}/tokens/${id}/details`, {
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
    fetch('/logout', { method: 'GET' })
        .then(() => {
            window.location.href = '/login';
        })
        .catch(error => {
            console.error('登出失敗:', error);
        });
}