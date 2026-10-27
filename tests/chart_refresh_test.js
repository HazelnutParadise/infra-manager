const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const kind of ['token', 'service']) {
    test(`an older ${kind} chart response cannot replace a newer one`, async () => {
        const pending = [];
        const prefix = kind === 'token' ? 'tokenTime' : 'serviceTime';
        const elements = {
            [`${prefix}Selector`]: {value: 'all'}, [`${prefix}Range`]: {value: '30'}, [`${prefix}Chart`]: {}
        };
        let created = 0;
        const context = {
            window: {charts: {}, chartTypes: {}},
            document: {addEventListener() {}, getElementById(id) { return elements[id] || null; }},
            console: {log() {}, warn() {}, error() {}}, setTimeout, clearTimeout,
            Chart: class { constructor() { created++; } destroy() {} }
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync('static/js/main.js', 'utf8'), context);
        const fetchName = kind === 'token' ? 'fetchTokensData' : 'fetchServicesData';
        const updateName = kind === 'token' ? 'updateTokenTimeChart' : 'updateServiceTimeChart';
        context[fetchName] = () => new Promise(resolve => pending.push(resolve));
        context[updateName]();
        context[updateName]();
        pending[1]([]);
        await new Promise(setImmediate);
        pending[0]([]);
        await new Promise(setImmediate);
        assert.equal(created, 1);
    });
}

for (const kind of ['daily', 'token', 'service']) {
    test(`an older ${kind} response cannot destroy the latest chart`, async () => {
        const pending = [];
        const prefix = kind === 'token' ? 'tokenTime' : kind === 'service' ? 'serviceTime' : 'dailyRequests';
        const elements = {[`${prefix}Selector`]: {value:'1'}, [`${prefix}Range`]: {value:'30'}, [`${prefix}Chart`]: {}};
        if (kind === 'daily') elements.dailyRequestsTimeRange = {value:'30'};
        let alive = 0;
        const context = {window:{charts:{},chartTypes:{}},document:{addEventListener(){},getElementById(id){return elements[id] || null;}},
            console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,
            Chart:class { constructor(){this.live=true;alive++;} destroy(){if(this.live){this.live=false;alive--;}} }};
        vm.createContext(context);
        vm.runInContext(fs.readFileSync('static/js/main.js','utf8'),context);
        context.fetchWithAuth = () => new Promise(resolve => pending.push(resolve));
        const update = kind === 'daily' ? 'updateDailyRequestsChart' : kind === 'token' ? 'updateTokenTimeChart' : 'updateServiceTimeChart';
        context[update]();context[update]();
        pending[1]([]);await new Promise(setImmediate);
        assert.equal(alive,1);
        pending[0]([]);await new Promise(setImmediate);
        assert.equal(alive,1);
    });
}

test('UTC date ranges include only the requested calendar days', () => {
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : ['2026-10-27T20:30:00Z'])); }
        static now() { return new Date('2026-10-27T20:30:00Z').getTime(); }
    }
    const context = {window:{charts:{},chartTypes:{}},document:{addEventListener(){}},
        console:{log(){},warn(){},error(){}},Date:FixedDate,setTimeout,clearTimeout};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('static/js/main.js','utf8'),context);
    const dates = context.generateDateRange(new FixedDate('2026-01-01T00:00:00Z'), new FixedDate('2026-01-03T00:00:00Z'));
    assert.deepEqual(Array.from(dates), ['2026-01-01','2026-01-02','2026-01-03']);
    const stats = ['2026-10-25','2026-10-26','2026-10-27','2026-10-28'].map(date => ({date}));
    assert.deepEqual(Array.from(context.filterStatsByDays(stats,2), x => x.date), ['2026-10-26','2026-10-27']);
});
