const stageNames = {
    authentication: '驗證失敗', local: '本系統錯誤', upstream_connection: '上游連線失敗',
    upstream_response: '上游回應失敗', transfer: '傳輸中斷'
};
const reasonNames = {
    invalid_path: '路徑格式錯誤', service_unavailable: '服務不存在或已停用', database_error: '資料庫查詢失敗',
    invalid_token: 'Token 無效或已停用', expired_token: 'Token 已過期', user_unavailable: '使用者不存在或已停用',
    invalid_service_url: '服務網址設定錯誤', request_creation_failed: '建立代理請求失敗', connection_failed: '無法連接上游',
    dns_failed: '無法解析上游網域', connection_refused: '上游拒絕連線', timeout: '連線逾時', tls_failed: '上游 TLS 驗證失敗',
    http_error: '上游回傳錯誤', response_transfer_failed: '傳輸中斷，來源未確認', response_read_failed: '讀取上游回應失敗', client_write_failed: '傳送回應給用戶端失敗'
};
const pageSize = 50;
let failures = [];
let services = {};
let cursors = [null];
let page = 0;
let requestSequence = 0;
let appliedFilters = new URLSearchParams({limit: String(pageSize)});

function renderFailures() {
    const rows = document.querySelector('#failureRows');
    rows.replaceChildren();
    for (const failure of failures) {
        const row = document.createElement('tr');
        const values = [new Date(failure.created_at).toLocaleString('zh-TW'), stageNames[failure.stage] || failure.stage,
            reasonNames[failure.reason] || failure.reason,
            failure.service_id ? (services[failure.service_id] || `服務 #${failure.service_id}`) : '未知',
            failure.status_code, failure.upstream_status_code ?? '—'];
        for (const value of values) {
            const cell = document.createElement('td');
            cell.textContent = String(value);
            row.append(cell);
        }
        rows.append(row);
    }
    document.querySelector('#failureMessage').textContent = failures.length ? '' : '沒有符合的失敗紀錄。';
    document.querySelector('#pageNumber').textContent = `第 ${page + 1} 頁`;
    document.querySelector('#previousPage').disabled = page === 0;
    document.querySelector('#nextPage').disabled = failures.length < pageSize;
}

function readFilters() {
    const params = new URLSearchParams({limit: String(pageSize)});
    for (const [id, key] of [['failureStage', 'stage'], ['failureService', 'service_id'],
        ['failureCode', 'status_code'], ['failureUpstreamCode', 'upstream_status_code']]) {
        const input = document.getElementById(id);
        if (input.value && !input.checkValidity()) throw new Error('回應碼須介於 100 到 999。');
        if (input.value) params.set(key, input.value);
    }
    const from = document.querySelector('#failureFrom').value;
    const to = document.querySelector('#failureTo').value;
    if (from && to && from > to) throw new Error('開始日期不可晚於結束日期。');
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) {
        const end = new Date(`${to}T00:00:00`);
        end.setDate(end.getDate() + 1);
        params.set('until', end.toISOString());
    }
    return params;
}

async function loadFailures() {
    const sequence = ++requestSequence;
    const message = document.querySelector('#failureMessage');
    message.textContent = '載入中…';
    document.querySelector('#previousPage').disabled = true;
    document.querySelector('#nextPage').disabled = true;
    try {
        const params = new URLSearchParams(appliedFilters);
        if (cursors[page]) params.set('before_id', cursors[page]);
        const response = await fetch(`/admin/stats/failures?${params}`);
        if (!response.ok || response.redirected) throw new Error('無法載入失敗紀錄，請確認登入狀態後重新整理。');
        const data = await response.json();
        if (sequence !== requestSequence) return;
        failures = data;
        renderFailures();
    } catch (error) {
        if (sequence !== requestSequence) return;
        message.textContent = error.message || '無法載入失敗紀錄。';
        document.querySelector('#failureRows').replaceChildren();
        document.querySelector('#previousPage').disabled = page === 0;
    }
}

async function loadServices() {
    try {
        const response = await fetch('/admin/services');
        if (!response.ok || response.redirected) throw new Error();
        const select = document.querySelector('#failureService');
        for (const service of await response.json()) {
            services[service.id] = service.name;
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = service.name;
            select.append(option);
        }
    } catch {
        const select = document.querySelector('#failureService');
        select.disabled = true;
        select.options[0].textContent = '無法載入服務清單';
    }
}

function resetQuery() {
    requestSequence++;
    try {
        appliedFilters = readFilters();
        page = 0;
        cursors = [null];
        loadFailures();
    } catch (error) {
        document.querySelector('#failureMessage').textContent = error.message;
    }
}

document.querySelector('#refreshFailures').addEventListener('click', loadFailures);
document.querySelector('#applyFilters').addEventListener('click', resetQuery);
document.querySelector('#previousPage').addEventListener('click', () => { if (page > 0) { page--; loadFailures(); } });
document.querySelector('#nextPage').addEventListener('click', () => {
    if (failures.length === pageSize) {
        cursors = cursors.slice(0, page + 1);
        cursors.push(failures[failures.length - 1].id);
        page++;
        loadFailures();
    }
});
loadServices().then(loadFailures);
