const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('monthly comparisons handle unavailable and zero baselines honestly', () => {
 const code=fs.readFileSync('static/js/overview.js','utf8').split('let overviewRevision')[0];const context={};vm.createContext(context);vm.runInContext(code,context);
 assert.equal(context.dashboardTrendText(5,null,'2026-09-28'),'無歷史資料');
 assert.equal(context.dashboardTrendText(0,0,'2026-09-28'),'較 2026-09-28 觀測無變化');
 assert.equal(context.dashboardTrendText(5,0,'2026-09-28'),'較 2026-09-28 觀測新增 5');
 assert.equal(context.dashboardTrendText(12,10,'2026-09-28'),'較 2026-09-28 觀測 +20.0%');
 assert.equal(context.dashboardTrendText(null,10,'2026-09-28'),'無法比較');
});


test('trend colors distinguish growing expiry risk from other counts', () => {
 const code=fs.readFileSync('static/js/overview.js','utf8').split('let overviewRevision')[0];const context={};vm.createContext(context);vm.runInContext(code,context);
 assert.equal(context.dashboardTrendTone(12,10,false),'good');
 assert.equal(context.dashboardTrendTone(12,10,true),'bad');
 assert.equal(context.dashboardTrendTone(10,10,false),'neutral');
 assert.equal(context.dashboardTrendTone(10,null,false),'neutral');
});
