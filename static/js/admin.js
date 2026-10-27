document.querySelectorAll('nav a[href]').forEach(link=>{if(link.getAttribute('href')===window.location.pathname)link.setAttribute('aria-current','page')});

const tableSearch=document.querySelector('[data-table-search]');
if(tableSearch){const body=document.getElementById(tableSearch.dataset.tableSearch);const update=()=>{const term=tableSearch.value.trim().toLocaleLowerCase();let shown=0;for(const row of body.rows){row.hidden=!row.textContent.toLocaleLowerCase().includes(term);if(!row.hidden)shown++}document.getElementById('searchResultCount').textContent=term?`符合 ${shown} 筆`:''};tableSearch.addEventListener('input',update);new MutationObserver(update).observe(body,{childList:true});update()}
