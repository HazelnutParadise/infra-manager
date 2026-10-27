const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('daily chart shows HTTP response classes as stacked bars', async () => {
    const elements = {dailyRequestsTimeRange:{value:'30'}, dailyRequestsChart:{}};
    let chart, requested;
    const context = {window:{charts:{},chartTypes:{}}, document:{addEventListener(){},getElementById(id){return elements[id]||null;}},
        console:{log(){},warn(){},error(){}}, setTimeout, clearTimeout,
        Chart:class {constructor(canvas,config){chart=config;} destroy(){}}};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('static/js/main.js','utf8'),context);
    context.fetchWithAuth = async url => {requested=url;return [{date:'2026-10-27',success:8,error:2}];};
    context.updateDailyRequestsChart();
    await new Promise(setImmediate);
    assert.match(requested,/dashboard-responses\?days=30$/);
    assert.equal(chart.type,'bar');
    assert.equal(chart.options.scales.x.stacked,true);
    assert.deepEqual(Array.from(chart.data.datasets, x => x.data[0]),[2,8]);
});
