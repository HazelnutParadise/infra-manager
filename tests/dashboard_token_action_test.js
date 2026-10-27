const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('token action opens only the requested positive token ID on the token page', () => {
 const values=new Map([['dashboardTokenEdit','42']]);let edited;
 const context={sessionStorage:{getItem:k=>values.get(k),removeItem:k=>values.delete(k)},window:{location:{pathname:'/tokens'}},document:{querySelector(){return null;}},editToken(id){edited=id;}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('static/js/dashboard-search-target.js','utf8'),context);
 assert.equal(edited,42);assert.equal(values.has('dashboardTokenEdit'),false);
});
