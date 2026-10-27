const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('dashboard search matches names and descriptions without exposing token values', () => {
    const context = {document:{getElementById(){return null;}},console};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('static/js/dashboard-search.js','utf8'),context);
    const resources = {users:[{username:'小明'}],services:[{name:'prod-api'}],tokens:[{description:'部署',token_value:'super-secret',user:{username:'小明'},service:{name:'prod-api'}}]};
    assert.equal(context.searchDashboard(resources,'super-secret').length,0);
    assert.deepEqual(Array.from(context.searchDashboard(resources,'prod'),x=>x.path),['/services','/tokens']);
    assert.deepEqual(Array.from(context.searchDashboard(resources,'部署'),x=>x.path),['/tokens']);
    assert.equal(context.searchDashboard(resources,'  ').length,0);
});
