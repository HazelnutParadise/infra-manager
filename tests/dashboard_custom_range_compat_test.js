const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const kind of ['service','token']) {
 test(`custom overview dates do not invalidate the detailed ${kind} chart`, async () => {
  const elements={dailyRequestsTimeRange:{value:'custom'},userServiceSelector:{value:'all'},userTokenSelector:{value:'all'},userServiceChart:{},userTokenChart:{}};
  let config;
  const context={window:{charts:{},chartTypes:{userService:'line',userToken:'line'}},document:{addEventListener(){},getElementById(id){return elements[id]||null;}},console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,Chart:class{constructor(canvas,c){config=c;}destroy(){}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync('static/js/main.js','utf8'),context);
  context.fetchServicesData=async()=>[];context.fetchTokensData=async()=>[];
  context[kind==='service'?'updateUserServiceChart':'updateUserTokenChart']();await new Promise(setImmediate);
  assert.equal(config.data.labels.length,30);
 });
}
