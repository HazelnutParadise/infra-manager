const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('date ranges are inclusive and limited to 90 calendar days', () => {
 const context={document:{getElementById(){return null;}},Date,URLSearchParams};vm.createContext(context);
 vm.runInContext(fs.readFileSync('static/js/dashboard-date.js','utf8'),context);
 assert.equal(context.dashboardDateQuery('2026-06-01','2026-06-30'),'start=2026-06-01&end=2026-06-30');
 assert.throws(()=>context.dashboardDateQuery('2026-06-30','2026-06-01'));
 assert.throws(()=>context.dashboardDateQuery('2026-01-01','2026-06-01'));
 assert.throws(()=>context.dashboardDateQuery('2026-02-30','2026-03-01'));
});


test('applying dates updates both panels and invalid input leaves the last range intact', () => {
 const handlers={};const form={addEventListener(name,fn){handlers.submit=fn;}};
 const elements={dashboardDateForm:form,dashboardStartDate:{value:''},dashboardEndDate:{value:''},dashboardDateError:{textContent:''},dailyRequestsTimeRange:{value:'30',addEventListener(name,fn){handlers.preset=fn;}}};
 let overview=0, chart=0;
 const context={document:{getElementById(id){return elements[id]||null;}},Date,URLSearchParams,loadOverview(){overview++;},updateDailyRequestsChart(){chart++;}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('static/js/dashboard-date.js','utf8'),context);
 elements.dashboardStartDate.value='2026-06-01';elements.dashboardEndDate.value='2026-06-03';handlers.submit({preventDefault(){}});
 assert.equal(context.getDashboardDateQuery(),'start=2026-06-01&end=2026-06-03');assert.equal(elements.dailyRequestsTimeRange.value,'custom');assert.equal(overview,1);assert.equal(chart,1);
 elements.dashboardEndDate.value='2026-05-01';handlers.submit({preventDefault(){}});
 assert.equal(context.getDashboardDateQuery(),'start=2026-06-01&end=2026-06-03');assert.ok(elements.dashboardDateError.textContent);assert.equal(overview,1);assert.equal(chart,1);
});
