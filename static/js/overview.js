const overviewReason={authentication:'驗證失敗',local:'本系統錯誤',upstream_connection:'連接上游失敗',upstream_response:'上游回應錯誤',transfer:'傳輸中斷'};
async function overviewFetch(url){const response=await fetch(url);if(!response.ok||response.redirected)throw new Error('無法載入');return response.json()}
function overviewRow(parent,title,detail){const row=document.createElement('div');row.className='overview-row';const left=document.createElement('strong');left.textContent=title;const right=document.createElement('small');right.textContent=detail;row.append(left,right);parent.append(row)}
function responseRate(count, success){return count > 0 ? `${(success*100/count).toFixed(1)}%` : '—'}
function dashboardTrendText(current, previous, date){
 if(current === null || !Number.isFinite(current)) return '無法比較';
 if(previous === null || previous === undefined) return '無歷史資料';
 if(previous === 0) return current === 0 ? `較 ${date} 觀測無變化` : `較 ${date} 觀測新增 ${current}`;
 const change=(current-previous)*100/previous; return `較 ${date} 觀測 ${change>0?'+':''}${change.toFixed(1)}%`;
}
function dashboardTrendTone(current, previous, reverse){
 if(current === null || !Number.isFinite(current) || previous === null || previous === undefined || current === previous) return 'neutral';
 return (current > previous) !== reverse ? 'good' : 'bad';
}
let overviewRevision = 0;
async function loadOverview(){const revision = ++overviewRevision; const expiring=document.querySelector('#expiringTokens'),failures=document.querySelector('#recentFailures');expiring.innerHTML='<tr><td colspan="6">載入中…</td></tr>';failures.textContent='載入中…';
 const resources=await Promise.allSettled([overviewFetch('/admin/users'),overviewFetch('/admin/services'),overviewFetch('/admin/tokens'),overviewFetch('/admin/stats/failures?limit=5'),overviewFetch(`/admin/stats/dashboard-service-details?${getDashboardDateQuery()}`),overviewFetch('/admin/stats/dashboard-snapshot')]);
 if (revision !== overviewRevision) return;
 const setCount=(id,result,filter)=>{document.getElementById(id).textContent=result.status==='fulfilled'?result.value.filter(filter).length:'—'};
 setCount('activeUsers',resources[0],x=>x.is_active);setCount('activeServices',resources[1],x=>x.is_active);setCount('activeTokens',resources[2],x=>x.is_active&&!x.disabled&&new Date(x.expires_at)>new Date()&&x.user?.is_active&&x.service?.is_active);
 if(resources[2].status==='fulfilled'){
  const now=Date.now(), tokens=resources[2].value.filter(t=>t.is_active&&!t.disabled&&t.user?.is_active&&t.service?.is_active&&new Date(t.expires_at).getTime()>now).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
  document.getElementById('expiringTokenCount').textContent=tokens.filter(t=>new Date(t.expires_at).getTime()<=now+7*86400000).length;
  const upcoming=tokens.filter(t=>new Date(t.expires_at).getTime()<=now+30*86400000).slice(0,5);expiring.replaceChildren();
  for(const token of upcoming){
   const row=document.createElement('tr');const remaining=Math.ceil((new Date(token.expires_at).getTime()-now)/86400000);
   for(const value of [token.user?.username||'未知使用者',token.service?.name||'未知服務',token.description||'—',new Date(token.expires_at).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}),`${remaining} 天`]){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}
   const action=document.createElement('td'),link=document.createElement('a');link.href='/tokens';link.textContent='延長';link.addEventListener('click',()=>{try{sessionStorage.setItem('dashboardTokenEdit',String(token.id))}catch(_){}});action.append(link);row.append(action);expiring.append(row);
  }
  if(!upcoming.length)expiring.innerHTML='<tr><td colspan="6">沒有即將到期的 Token。</td></tr>';
 }else {document.getElementById('expiringTokenCount').textContent='—';expiring.innerHTML='<tr><td colspan="6">無法載入 Token 資料。</td></tr>';}
 const history=resources[5].status==='fulfilled'?resources[5].value.previous:null;
 for(const [valueID,trendID,key] of [['activeUsers','activeUsersTrend','active_users'],['activeServices','activeServicesTrend','active_services'],['activeTokens','activeTokensTrend','active_tokens'],['expiringTokenCount','expiringTokensTrend','expiring_tokens']]){
  const text=document.getElementById(valueID).textContent;const current=text==='—'?null:Number(text);const trend=document.getElementById(trendID);
  trend.textContent=resources[5].status==='fulfilled'?dashboardTrendText(current,history?.[key],history?.date):'無法載入歷史資料';
  const tone=dashboardTrendTone(current,history?.[key],key==='expiring_tokens');trend.classList.toggle('trend-good',tone==='good');trend.classList.toggle('trend-bad',tone==='bad');
  trend.title=history?.observed_at?`上月每日觀測時間：${new Date(history.observed_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}`:'';
 }
 if(resources[3].status==='fulfilled'){failures.replaceChildren();for(const f of resources[3].value)overviewRow(failures,`${overviewReason[f.stage]||'其他失敗'} · ${f.status_code}`,new Date(f.created_at).toLocaleString('zh-TW'));if(!resources[3].value.length)failures.textContent='目前沒有失敗紀錄。'}else failures.textContent='無法載入失敗紀錄。';
 const serviceTable=document.querySelector('#serviceOverview');serviceTable.replaceChildren();
 if(resources[4].status==='fulfilled'&&resources[4].value.length){
  for(const service of resources[4].value.slice(0,8)){
   const row=document.createElement('tr');
   for(const [index,value] of [service.name,service.type||'未設定',service.count,responseRate(service.count,service.success),service.users,service.tokens,service.last_used?new Date(service.last_used).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—'].entries()){const cell=document.createElement('td');cell.textContent=String(value);if(index===3&&service.count>0){const bar=document.createElement('progress');bar.max=service.count;bar.value=service.success;bar.setAttribute('aria-label',`正常回應率 ${value}`);cell.append(bar)}row.append(cell)}
   const action=document.createElement('td'), link=document.createElement('a');link.href='/services';link.textContent='管理';link.addEventListener('click',()=>{try{sessionStorage.setItem('dashboardSearch',JSON.stringify({path:'/services',query:service.name}))}catch(_){}});action.append(link);row.append(action);serviceTable.append(row);
  }
 }else {const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=8;cell.textContent=resources[4].status==='fulfilled'?'目前沒有使用紀錄。':'無法載入服務使用情況。';row.append(cell);serviceTable.append(row)}
}
document.querySelector('#refreshOverview').addEventListener('click', () => { loadOverview(); loadDashboardData(); });loadOverview();
