const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('editing a disabled service type retains its disabled status', async()=>{
 const elements={editServiceID:{value:'1'},editServiceName:{value:'api'},editServiceDescription:{value:''},editServiceType:{value:'Database'},editServiceBaseUrl:{value:'http://example.test'},editServiceIsActive:{value:'false'},editServiceModal:{style:{}}};
 let payload, endpoint;
 const context={window:{},document:{addEventListener(){},getElementById(id){return elements[id]||null;}},console:{log(){},warn(){},error(){}},setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(fs.readFileSync('static/js/main.js','utf8'),context);
 context.fetchWithAuth=async(url,options)=>{endpoint=url;payload=JSON.parse(options.body);return {};};context.fetchServices=()=>{};
 context.updateService();await new Promise(setImmediate);
 assert.equal(Object.hasOwn(payload,'is_active'),false);assert.match(endpoint,/\/services\/1\/details$/);assert.equal(payload.type,'Database');
});
