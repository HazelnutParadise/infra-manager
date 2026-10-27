function dashboardDateQuery(start, end) {
    function parse(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
        const ms = Date.parse(`${value}T00:00:00Z`);
        return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : NaN;
    }
    const first = parse(start), last = parse(end);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first || last-first >= 90*86400000) throw new Error('請選擇 1 至 90 天的有效日期。');
    return new URLSearchParams({start,end}).toString();
}

const dashboardDateForm = document.getElementById('dashboardDateForm');
let activeDashboardDateQuery = '';
function getDashboardDateQuery() { return activeDashboardDateQuery; }
if (dashboardDateForm) {
    const start = document.getElementById('dashboardStartDate');
    const end = document.getElementById('dashboardEndDate');
    const notice = document.getElementById('dashboardDateError');
    const preset = document.getElementById('dailyRequestsTimeRange');
    function setPreset(days) {
        const taipeiNow = new Date(Date.now()+8*3600000);
        const endDay = new Date(Date.UTC(taipeiNow.getUTCFullYear(),taipeiNow.getUTCMonth(),taipeiNow.getUTCDate()));
        const startDay = new Date(endDay.getTime()-(days-1)*86400000);
        start.value=startDay.toISOString().slice(0,10);end.value=endDay.toISOString().slice(0,10);
        activeDashboardDateQuery=dashboardDateQuery(start.value,end.value);notice.textContent='';
    }
    setPreset(30);
    dashboardDateForm.addEventListener('submit', event => {
        event.preventDefault();
        try { activeDashboardDateQuery=dashboardDateQuery(start.value,end.value); notice.textContent=''; preset.value='custom'; loadOverview(); updateDailyRequestsChart(); }
        catch (error) { notice.textContent=error.message; }
    });
    preset.addEventListener('change', () => {
        const days=Number(preset.value);
        if (days) {setPreset(days);loadOverview();}
    });
}
