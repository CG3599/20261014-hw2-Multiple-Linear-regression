'use strict';
const methods = ['EFS','RFECV','LassoCV','Backward','SFS'];
const colors = {EFS:'#087f78',RFECV:'#d58635',LassoCV:'#6c62ae',Backward:'#3589b0',SFS:'#b45877'};
const darkColors = {EFS:'#68d8bd',RFECV:'#f0b56b',LassoCV:'#b6a5ff',Backward:'#79c7ef',SFS:'#f1a0bd'};
const schemeColor = name => (document.documentElement.dataset.theme === 'dark' ? darkColors : colors)[name];
const notes = {EFS:'窮舉每個特徵數的所有組合，以訓練交叉驗證 RMSE 選出組合。',RFECV:'固定數量的 RFE 路徑：逐步移除線性迴歸係數最小的特徵。此路徑保留原程式未標準化的設定。',LassoCV:'以標準化 LassoCV 係數絕對值排序；同分或零值以標準化 OLS 係數排序，再用選取的特徵重訓線性迴歸。',Backward:'逐步移除 OLS p-value 最大的特徵，直到剩下指定數量；固定數量曲線不使用 0.05 停止條件。',SFS:'向前逐步加入特徵，每一步依訓練交叉驗證 RMSE 選擇。'};
let method = 'Backward', count = 2, compare = false;
const $ = id => document.getElementById(id);
const fmt = (value,digits=2) => Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const rowsFor = name => EXPERIMENT.curves.filter(row=>row.method===name);
function choose(name,k){method=name;count=k;render();}
function svgNode(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;}
function chart(container,metric){
  const groups=compare?methods:[method];
  const values=EXPERIMENT.curves.filter(r=>groups.includes(r.method)).map(r=>r[metric]);
  const width=540,height=310,left=65,right=18,top=22,bottom=50;
  const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.abs(max)*.1||1)*.15;
  const lo=min-pad,hi=max+pad;
  const x=k=>left+(k-1)*(width-left-right)/4;
  const y=v=>top+(hi-v)*(height-top-bottom)/(hi-lo);
  const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${metric==='rmse'?'RMSE':'R-squared'} by Number of Features`});
  svg.append(svgNode('title',{},`${compare?'All schemes':method}: ${metric} by Number of Features`));
  for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4;svg.append(svgNode('line',{x1:left,y1:y(v),x2:width-right,y2:y(v),class:'grid-line'}));svg.append(svgNode('text',{x:left-10,y:y(v)+4,'text-anchor':'end',class:'chart-label'},fmt(v,metric==='rmse'?0:3)));}
  svg.append(svgNode('line',{x1:x(count),y1:top,x2:x(count),y2:height-bottom,stroke:'#b2cfc6','stroke-dasharray':'4 4'}));
  for(let k=1;k<=5;k++)svg.append(svgNode('text',{x:x(k),y:height-bottom+24,'text-anchor':'middle',class:'chart-label'},k));
  svg.append(svgNode('text',{x:(left+width-right)/2,y:height-8,'text-anchor':'middle',class:'chart-label'},'Number of Features'));
  const ordered=groups.filter(n=>n!==method).concat(method);
  for(const name of ordered){const rows=rowsFor(name);const active=name===method;
    svg.append(svgNode('polyline',{points:rows.map(r=>`${x(r.count)},${y(r[metric])}`).join(' '),fill:'none',stroke:schemeColor(name),'stroke-width':active?2.8:1.8,'stroke-opacity':active?1:.65,'stroke-dasharray':!active&&compare?'6 4':'none'}));
    for(const row of rows){const point=svgNode('circle',{cx:x(row.count),cy:y(row[metric]),r:active&&row.count===count?6:4,fill:schemeColor(name),stroke:'white','stroke-width':1.5,class:'chart-point',tabindex:0,role:'button','aria-label':`${name}, ${row.count} features, ${metric} ${fmt(row[metric],4)}`});point.append(svgNode('title',{},`${name} · ${row.count} features\n${metric}: ${fmt(row[metric],6)}\n${row.features.join(', ')}`));point.addEventListener('click',()=>choose(name,row.count));point.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(name,row.count);}});svg.append(point);}
  }
  $(container).replaceChildren(svg);
}
function render(){
  const selected=rowsFor(method).find(r=>r.count===count);
  $('rmse-stat').textContent=fmt(selected.rmse);$('r2-stat').textContent=fmt(selected.r2,4);
  $('feature-count').value=count;$('count-label').textContent=`${count} / 5`;
  $('method-note').textContent=notes[method];$('table-title').textContent=`${method} · 特徵組合與表現`;$('table-badge').textContent='5 combinations';
  document.querySelectorAll('[role=tab]').forEach(button=>{const active=button.dataset.method===method;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  $('legend').replaceChildren(...(compare?methods:[method]).map(name=>{const item=document.createElement('span');const line=document.createElement('i');line.style.background=schemeColor(name);item.append(line,document.createTextNode(name));return item;}));
  chart('rmse-chart','rmse');chart('r2-chart','r2');
  $('result-rows').replaceChildren(...rowsFor(method).map(row=>{const tr=document.createElement('tr');tr.className=row.count===count?'selected':'';tr.tabIndex=0;tr.setAttribute('aria-label',`${method}, ${row.count} features`);tr.setAttribute('aria-selected',String(row.count===count));
    const k=document.createElement('td');k.textContent=String(row.count).padStart(2,'0');const features=document.createElement('td');row.features.forEach(name=>{const tag=document.createElement('span');tag.className='feature-tag';tag.textContent=name;features.append(tag);});const rmse=document.createElement('td');rmse.textContent=fmt(row.rmse,6);const r2=document.createElement('td');r2.textContent=fmt(row.r2,6);tr.append(k,features,rmse,r2);tr.addEventListener('click',()=>choose(method,row.count));tr.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();choose(method,row.count);}});return tr;}));
  $('selection-detail').textContent=`目前查看：${method} / ${count} 個特徵 / ${selected.features.join(' + ')}`;
  const url=new URL(location.href);url.searchParams.set('method',method);url.searchParams.set('k',count);url.searchParams.set('compare',compare?'1':'0');history.replaceState(null,'',url);
}
const tabs=document.querySelector('.tabs');methods.forEach((name,i)=>{const button=document.createElement('button');button.textContent=name;button.dataset.method=name;button.setAttribute('role','tab');button.setAttribute('aria-selected','false');button.addEventListener('click',()=>choose(name,count));button.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?4:(i+(event.key==='ArrowRight'?1:4))%5;choose(methods[next],count);tabs.children[next].focus();}});tabs.append(button);});
$('feature-count').addEventListener('input',event=>{count=Number(event.target.value);render();});$('compare').addEventListener('change',event=>{compare=event.target.checked;render();});
$('download').addEventListener('click',()=>{const header=['Method','Number of Features','Selected Features','RMSE','R-squared'];const escape=value=>'"'+String(value).replaceAll('"','""')+'"';const csv=[header,...EXPERIMENT.curves.map(r=>[r.method,r.count,'['+r.features.join(', ')+']',r.rmse,r.r2])].map(row=>row.map(escape).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='all_schemes_feature_count_results.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.FeatureLabMethodComparison.render(
  $('auto-results'),
  window.FeatureLabMethodComparison.fromStartups(EXPERIMENT),
  {onSelect:row=>choose(row.method,Math.max(1,Math.min(5,row.count)))}
);
const params=new URLSearchParams(location.search);if(methods.includes(params.get('method')))method=params.get('method');const requested=Number(params.get('k'));if(Number.isInteger(requested)&&requested>=1&&requested<=5)count=requested;compare=params.get('compare')==='1';$('compare').checked=compare;render();

function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === 'dark';
  $('theme-toggle').textContent = dark ? '☀ 明亮模式' : '☾ 黑暗模式';
  $('theme-toggle').setAttribute('aria-label', dark ? '切換明亮模式' : '切換黑暗模式');
  $('theme-toggle').setAttribute('aria-pressed', String(dark));
}
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('feature-lab-theme', theme); } catch {}
  updateThemeToggle();
  render();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
  try { if (localStorage.getItem('feature-lab-theme')) return; } catch {}
  document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
  updateThemeToggle();
  render();
});
updateThemeToggle();

const startupPrediction=window.FeatureLabPrediction.render($('prediction-plot'),STARTUPS_PREDICTION.points,'USD');
$('prediction-model').textContent=STARTUPS_PREDICTION.method+' · R&D Spend';
$('prediction-stat').textContent='名目涵蓋率：95%\\n訓練集：'+STARTUPS_PREDICTION.trainCount+' 筆\\n測試集：'+startupPrediction.total+' 筆\\n實際涵蓋：'+startupPrediction.covered+' / '+startupPrediction.total+'（'+fmt(startupPrediction.rate*100,1)+'%）';
$('prediction-explanation').textContent='OLS Student-t 個別預測區間（df='+STARTUPS_PREDICTION.df+'），包含新觀測的隨機誤差與特徵槓桿值；不是平均預測值的信賴區間。';


