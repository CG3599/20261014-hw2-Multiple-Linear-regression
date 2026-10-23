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
function renderSelection() {
  const row = data.methods.find(item => item.method === selected);
  $('feature-title').textContent = `${selected} · ${row.count} 個特徵`;
  $('selection-detail').textContent = `CV RMSE €${fmt(row.cv_rmse)} ± ${fmt(row.cv_std)}${selected === data.best_method ? ' · 訓練 CV 最佳方法' : ''}`;
  $('feature-tags').replaceChildren(...row.features.map(name => {
    const tag = document.createElement('span'); tag.className='feature-tag'; tag.textContent=name.replace(/^(num|cat)__/, ''); return tag;
  }));
  document.querySelectorAll('#result-rows tr').forEach(tr => {const active=tr.dataset.method===(selected==='Lasso'?'LassoCV':selected);tr.classList.toggle('selected',active);tr.setAttribute('aria-selected',String(active));});
  const url = new URL(location.href); url.searchParams.set('method',selected); history.replaceState(null,'',url);
}
window.FeatureLabMethodComparison.render(
  $('result-rows'),
  window.FeatureLabMethodComparison.fromCars(data),
  {selected:selected==='Lasso'?'LassoCV':selected,allowBaseline:true,onSelect:row=>choose(row.method==='LassoCV'?'Lasso':row.method)}
);
$('sample-stat').textContent=`${data.valid_count} cars`;
$('split-stat').textContent=`${data.train_count} 筆訓練 / ${data.test_count} 筆測試`;
$('rmse-stat').textContent=`€${fmt(data.test.rmse)}`;
$('r2-stat').textContent=fmt(data.test.r2,4);
$('best-stat').textContent=`${data.best_method} · 依訓練 CV RMSE 選擇`;
$('mae-stat').textContent=`Test MAE €${fmt(data.test.mae)}`;
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
  renderSelection();
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
