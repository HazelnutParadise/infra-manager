// Carry a dashboard search into the selected management list without putting it in the URL.
try {
    const raw = sessionStorage.getItem('dashboardSearch');
    if (raw) {
        sessionStorage.removeItem('dashboardSearch');
        const search = JSON.parse(raw);
        const input = document.querySelector('[data-table-search]');
        if (input && search.path === window.location.pathname && typeof search.query === 'string') {
            input.value = search.query;
            input.dispatchEvent(new Event('input', {bubbles:true}));
        }
    }
} catch (_) { /* Search remains usable in the destination list. */ }

try {
    const rawTokenID = sessionStorage.getItem('dashboardTokenEdit');
    if (rawTokenID && window.location.pathname === '/tokens') {
        sessionStorage.removeItem('dashboardTokenEdit');
        const id = Number(rawTokenID);
        if (Number.isSafeInteger(id) && id > 0 && typeof editToken === 'function') editToken(id);
    }
} catch (_) { /* The token list remains usable if storage is unavailable. */ }
