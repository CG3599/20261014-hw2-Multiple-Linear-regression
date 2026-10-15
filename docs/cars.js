'use strict';
const data = CARS_EXPERIMENT;
const $ = id => document.getElementById(id);
const fmt = (v, digits = 2) => Number(v).toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits});
const order = ['Baseline', 'EFS', 'RFECV', 'Lasso', 'Backward', 'SFS'];
const light = ['#64767b', '#087f78', '#b46b19', '#6c62ae', '#3589b0', '#b45877'];
const dark = ['#b5c4cc', '#68d8bd', '#f0b56b', '#b6a5ff', '#79c7ef', '#f1a0bd'];
const color = name => (document.documentElement.dataset.theme === 'dark' ? dark : light)[order.indexOf(name)];
const notes = {
  Baseline: '完整模型：使用全部前處理與編碼後的特徵，作為比較基準。',
  EFS: '依 F 分數取前 8 個候選，窮舉 1–3 個特徵的組合，以內層 3 折 CV RMSE 選擇。',
  RFECV: '標準化後逐步移除特徵，每次移除 3 個、至少保留 2 個，依內層 3 折 CV 選擇。',
  Lasso: '以標準化 LassoCV 的非零係數選取特徵，再以 LinearRegression 重新擬合。',
  Backward: '反覆移除 OLS p-value 最大的特徵，直到全部 ≤ 0.05 或只剩一個特徵。',
  SFS: '依 F 分數取前 15 個候選，以內層 3 折 CV 逐步向前選取 8 個特徵。',
};
const requested = new URLSearchParams(location.search).get('method');
let selected = order.includes(requested) ? requested : data.best_method;
function node(tag, attrs = {}, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
}
function activate(el, name) {
  el.addEventListener('click', () => choose(name));
  el.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(name); }
  });
}
function choose(name) { selected = name; renderSelection(); }
function bars(container, metric) {
  const rows = data.methods;
  const w = 540, h = 330, left = 76, right = 14, top = 25, bottom = 58;
  const max = Math.max(...rows.map(r => r[metric] + (metric === 'cv_rmse' ? r.cv_std : 0))) * 1.12;
  const min = metric === 'cv_rmse' ? Math.min(0, ...rows.map(r => r.cv_rmse - r.cv_std)) * 1.12 : 0;
  const y = v => h - bottom - (v - min) / (max - min) * (h - top - bottom);
  const step = (w - left - right) / rows.length;
  const svg = node('svg', {viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': metric === 'cv_rmse' ? '各方法交叉驗證 RMSE 與標準差' : '各方法選取特徵數'});
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4;
    svg.append(node('line', {x1: left, x2: w - right, y1: y(value), y2: y(value), class: 'grid-line'}));
    svg.append(node('text', {x: left - 10, y: y(value) + 4, 'text-anchor': 'end', class: 'chart-label'}, fmt(value, 0)));
  }
  rows.forEach((row, i) => {
    const center = left + step * (i + .5), bw = step * .52;
    const rect = node('rect', {x: center - bw / 2, y: y(row[metric]), width: bw, height: y(0) - y(row[metric]), rx: 4, fill: color(row.method), opacity: row.method === selected ? 1 : .5, class: 'chart-bar', role: 'button', tabindex: 0, 'aria-label': `${row.method}: ${metric} ${fmt(row[metric])}`, 'aria-pressed': String(row.method === selected)});
    rect.append(node('title', {}, `${row.method}\nCV RMSE: ${fmt(row.cv_rmse)} ± ${fmt(row.cv_std)}\nFeatures: ${row.count}`));
    activate(rect, row.method); svg.append(rect);
    if (metric === 'cv_rmse') {
      const low = y(row.cv_rmse - row.cv_std), high = y(row.cv_rmse + row.cv_std);
      svg.append(node('path', {d: `M ${center} ${low} V ${high} M ${center-5} ${low} H ${center+5} M ${center-5} ${high} H ${center+5}`, stroke: 'var(--ink)', fill: 'none', 'pointer-events': 'none'}));
    } else svg.append(node('text', {x: center, y: y(row.count) - 8, 'text-anchor': 'middle', class: 'chart-label'}, row.count));
    svg.append(node('text', {x: center, y: h - bottom + 22, 'text-anchor': 'middle', class: 'chart-label'}, row.method));
  });
  $(container).replaceChildren(svg);
}
function scatter(container, residual) {
  const w = 540, h = 350, l = 82, r = 22, t = 24, b = 64;
  const points = data.predictions.map(row => ({...row, x: residual ? row.predicted : row.actual, y: residual ? row.residual : row.predicted}));
  let xmin = Math.min(0, ...points.map(p => p.x)), xmax = Math.max(...points.map(p => p.x));
  let ymin = Math.min(0, ...points.map(p => p.y)), ymax = Math.max(0, ...points.map(p => p.y));
  if (!residual) { xmin = ymin = Math.min(xmin, ymin); xmax = ymax = Math.max(xmax, ymax); }
  const xp = (xmax-xmin || 1) * .06, yp = (ymax-ymin || 1) * .06;
  xmin -= xp; xmax += xp; ymin -= yp; ymax += yp;
  const x = v => l + (v-xmin)/(xmax-xmin)*(w-l-r), y = v => h-b-(v-ymin)/(ymax-ymin)*(h-t-b);
  const svg = node('svg', {viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': residual ? '預測售價與殘差散點圖' : '實際與預測售價散點圖'});
  const tick = v => Math.abs(v) >= 1000 ? `${fmt(v/1000, 0)}k` : fmt(v, 0);
  for (let i=0; i<=4; i++) {
    const xv = xmin+(xmax-xmin)*i/4, yv = ymin+(ymax-ymin)*i/4;
    svg.append(node('line', {x1:l,x2:w-r,y1:y(yv),y2:y(yv),class:'grid-line'}));
    svg.append(node('text', {x:l-10,y:y(yv)+4,'text-anchor':'end',class:'chart-label'},tick(yv)));
    svg.append(node('text', {x:x(xv),y:h-b+23,'text-anchor':'middle',class:'chart-label'},tick(xv)));
  }
  svg.append(node('text', {x:(l+w-r)/2,y:h-12,'text-anchor':'middle',class:'chart-label'},residual ? 'Predicted price ($)' : 'Actual price ($)'));
  svg.append(node('text', {x:18,y:(t+h-b)/2,transform:`rotate(-90 18 ${(t+h-b)/2})`,'text-anchor':'middle',class:'chart-label'},residual ? 'Residual ($)' : 'Predicted price ($)'));
  svg.append(node('line', {x1:x(xmin),y1:y(residual?0:xmin),x2:x(xmax),y2:y(residual?0:xmax),class:'chart-reference'}));
  for (const p of points) {
    const label = `${p.name}: Actual $${fmt(p.actual)}, Predicted $${fmt(p.predicted)}, Residual $${fmt(p.residual)}`;
    const circle = node('circle', {cx:x(p.x),cy:y(p.y),r:4.5,fill:color(data.best_method),class:'cars-point',tabindex:0,'aria-label':label});
    circle.append(node('title',{},label)); svg.append(circle);
  }
  $(container).replaceChildren(svg);
}
function renderSelection() {
  const row = data.methods.find(item => item.method === selected);
  document.querySelectorAll('[role="tab"]').forEach(button => {
    const active = button.dataset.method === selected;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
  });
  $('method-note').textContent = notes[selected];
  $('feature-title').textContent = `${selected} · ${row.count} 個特徵`;
  $('selection-detail').textContent = `CV RMSE $${fmt(row.cv_rmse)} ± ${fmt(row.cv_std)}${selected === data.best_method ? ' · 訓練 CV 最佳方法' : ''}`;
  $('feature-tags').replaceChildren(...row.features.map(name => {
    const tag = document.createElement('span'); tag.className='feature-tag'; tag.textContent=name.replace(/^(num|cat)__/, ''); return tag;
  }));
  document.querySelectorAll('#result-rows tr').forEach(tr => {tr.classList.toggle('selected',tr.dataset.method===selected);tr.setAttribute('aria-selected',String(tr.dataset.method===selected));});
  bars('cv-chart','cv_rmse'); bars('count-chart','count');
  const url = new URL(location.href); url.searchParams.set('method',selected); history.replaceState(null,'',url);
}
const tabs = document.querySelector('.tabs');
order.forEach((name,i) => {
  const button=document.createElement('button'); button.type='button'; button.textContent=name; button.dataset.method=name;
  button.setAttribute('role','tab'); button.addEventListener('click',()=>choose(name));
  button.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next=event.key==='Home'?0:event.key==='End'?order.length-1:(i+(event.key==='ArrowRight'?1:order.length-1))%order.length;
    choose(order[next]); tabs.children[next].focus();
  }); tabs.append(button);
});
for (const row of data.methods) {
  const tr=document.createElement('tr'); tr.dataset.method=row.method; tr.tabIndex=0; tr.setAttribute('aria-label',`${row.method}, ${row.count} features`);
  for (const value of [row.method,row.count,fmt(row.cv_rmse),fmt(row.cv_std),fmt(row.seconds)]) {const td=document.createElement('td');td.textContent=value;tr.append(td);}
  activate(tr,row.method); $('result-rows').append(tr);
}
for (const row of data.predictions) {
  const tr=document.createElement('tr');
  for (const value of [row.name,fmt(row.actual),fmt(row.predicted),fmt(row.residual)]) {const td=document.createElement('td');td.textContent=value;tr.append(td);}
  $('prediction-rows').append(tr);
}
$('sample-stat').textContent=`${data.valid_count} cars`;
$('split-stat').textContent=`${data.train_count} 筆訓練 / ${data.test_count} 筆測試`;
$('rmse-stat').textContent=`$${fmt(data.test.rmse)}`;
$('r2-stat').textContent=fmt(data.test.r2,4);
$('best-stat').textContent=`${data.best_method} · 依訓練 CV RMSE 選擇`;
$('mae-stat').textContent=`Test MAE $${fmt(data.test.mae)}`;
$('prediction-title').textContent=`${data.best_method} · 最佳模型的預測表現`;
$('test-summary').textContent=`${data.test_count} 筆保留測試資料 · RMSE $${fmt(data.test.rmse)} · MAE $${fmt(data.test.mae)} · R² ${fmt(data.test.r2,4)}`;
$('test-note').textContent=data.test.r2 < 0 ? '測試 R² 為負：此模型在這份測試資料上的表現，比以測試集平均售價作為預測更差。以下保留所有預測與離群點，方便檢視誤差來源。' : '以下為 CV 選定模型在保留測試集上的結果；測試集未參與方法選擇。';
$('download').addEventListener('click',()=>{
  const escape=value=>'"'+String(value).replaceAll('"','""')+'"';
  const rows=[['Method','Selected_Count','CV_RMSE','CV_STD','Seconds','Selected_Features'],...data.methods.map(r=>[r.method,r.count,r.cv_rmse,r.cv_std,r.seconds,r.features.join('; ')])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='cars_method_comparison.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function renderTheme() {
  const isDark=document.documentElement.dataset.theme==='dark';
  $('theme-toggle').textContent=isDark?'☀ 明亮模式':'☾ 黑暗模式';
  $('theme-toggle').setAttribute('aria-label',isDark?'切換明亮模式':'切換黑暗模式');
  $('theme-toggle').setAttribute('aria-pressed',String(isDark));
  renderSelection(); scatter('prediction-chart',false); scatter('residual-chart',true);
}
$('theme-toggle').addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=theme;try{localStorage.setItem('feature-lab-theme',theme);}catch{} renderTheme();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',event=>{
  try{if(localStorage.getItem('feature-lab-theme'))return;}catch{}
  document.documentElement.dataset.theme=event.matches?'dark':'light';renderTheme();
});
renderTheme();
