function searchDashboard(resources, query) {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return [];
    const results = [];
    for (const user of resources.users) {
        if ((user.username || '').toLocaleLowerCase().includes(term)) results.push({path:'/users', label:`使用者：${user.username}`});
    }
    for (const service of resources.services) {
        if ((service.name || '').toLocaleLowerCase().includes(term)) results.push({path:'/services', label:`服務：${service.name}`});
    }
    for (const token of resources.tokens) {
        const description = token.description || '';
        const user = token.user?.username || '';
        const service = token.service?.name || '';
        if ([description, user, service].some(value => value.toLocaleLowerCase().includes(term))) {
            results.push({path:'/tokens', label:`Token：${description || '無備註'}（${user} / ${service}）`});
        }
    }
    return results.slice(0, 12);
}

const dashboardSearch = document.getElementById('dashboardSearch');
if (dashboardSearch) {
    const results = document.getElementById('dashboardSearchResults');
    let resources = null;
    let failed = false;
    function renderSearch() {
        results.replaceChildren();
        const query = dashboardSearch.value.trim();
        results.hidden = !query;
        if (!query) return;
        if (!resources || failed) {
            const message = document.createElement('div');
            message.textContent = failed ? '搜尋資料載入失敗，請重新整理。' : '搜尋資料載入中…';
            results.append(message); return;
        }
        const matches = searchDashboard(resources, query);
        if (!matches.length) { const message = document.createElement('div'); message.textContent = '找不到符合的項目。'; results.append(message); return; }
        for (const item of matches) {
            const link = document.createElement('a'); link.href = item.path; link.textContent = item.label;
            link.addEventListener('click', () => { try { sessionStorage.setItem('dashboardSearch', JSON.stringify({path:item.path, query})); } catch (_) {} });
            results.append(link);
        }
    }
    dashboardSearch.addEventListener('input', renderSearch);
    dashboardSearch.addEventListener('keydown', event => {if (event.key === 'Escape') {dashboardSearch.value=''; renderSearch();}});
    let revision = 0;
    function loadSearchData() {
        const current = ++revision;
        resources = null; failed = false; renderSearch();
        Promise.all(['/admin/users','/admin/services','/admin/tokens'].map(async url => {
            const response = await fetch(url); if (!response.ok || response.redirected) throw new Error('搜尋資料載入失敗'); return response.json();
        })).then(([users,services,tokens]) => {if (current !== revision) return; resources={users,services,tokens};renderSearch();}).catch(() => {if (current !== revision) return; failed=true;renderSearch();});
    }
    document.getElementById('refreshOverview').addEventListener('click', loadSearchData);
    loadSearchData();
}
