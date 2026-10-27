const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('service response rate handles zero and formats real counts', () => {
 const code = fs.readFileSync('static/js/overview.js','utf8').split('let overviewRevision')[0];
 const context={};vm.createContext(context);vm.runInContext(code,context);
 assert.equal(context.responseRate(100,97),'97.0%');
 assert.equal(context.responseRate(0,0),'—');
});
