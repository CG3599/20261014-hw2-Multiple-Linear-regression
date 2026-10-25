'use strict';
(() => {
const $ = id => document.getElementById(id);
let dataset=null,fields=[],results=[],analysisOutput=null,selectedMethod='Backward',selectedK=2,compare=false,advice=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const missing=s=>s==null||String(s).trim()===''||['na','null','n/a'].includes(String(s).trim().toLowerCase());
function status(message,error=false,where='upload-status'){const el=$(where);el.textContent=message;el.classList.toggle('error',error);}
function detectDelimiter(text){const line=(text.split(/\r?\n/).find(s=>s.trim())||'').slice(0,2000),options=[',','\t',';'];return options.map(d=>({d,n:line.split(d).length-1})).sort((a,b)=>b.n-a.n)[0].d;}
function parseCSV(text){text=text.replace(/^\uFEFF/,'');const delim=detectDelimiter(text),table=[],row=[];let buf='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){buf+='"';i++;}else quoted=!quoted;}else if(c===delim&&!quoted){row.push(buf);buf='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(buf);buf='';if(row.some(v=>String(v).trim()))table.push(row.slice());row.length=0;if(table.length>6002)throw Error('資料超過 6,000 列，請先縮減檔案。');}else buf+=c;}if(quoted)throw Error('CSV 格式錯誤：引號未關閉。');row.push(buf);if(row.some(v=>String(v).trim()))table.push(row);return table;}
function normalize(matrix){if(!Array.isArray(matrix)||matrix.length<2)throw Error('資料至少需要標題列與一筆資料。');if(matrix[0].length>120)throw Error('原始欄位上限為 120 欄。');const seen=new Set(),headers=matrix[0].map((v,i)=>{const base=String(v||'Column '+(i+1)).trim();let name=base,n=2;while(seen.has(name)){name=base+'_'+n++;}seen.add(name);return name;});if(headers.length<2)throw Error('至少需要兩個欄位（Feature + Target）。');const rows=matrix.slice(1).filter(row=>row.some(v=>!missing(v))).map(row=>headers.map((_,i)=>String(row[i]??'').trim()));return {headers,rows};}
function infer(values){const vals=values.filter(v=>!missing(v));return vals.length>0&&vals.filter(v=>Number.isFinite(Number(v))).length/vals.length>=.9?'numeric':'category';}
function estimate(){if(!dataset)return;const target=$('target-select').value,chosen=fields.filter(f=>f.use&&f.name!==target);let count=0,invalid=[];
for(const f of chosen){if(f.type==='numeric')count++;else{const vals=new Set(dataset.rows.map(row=>row[dataset.headers.indexOf(f.name)]).filter(v=>!missing(v)));if(vals.size>12)invalid.push(f.name+' ('+vals.size+' 類)');count+=Math.max(0,vals.size-1);}}
$('raw-feature-total').textContent=chosen.length;$('encoded-feature-total').textContent=count;
const ok=chosen.length>13&&chosen.length<40;
$('feature-guidance').textContent='原始輸入特徵 '+chosen.length+' 個：'+(ok?'符合':'不符合')+' HW2 的 14–39 個條件（僅作業提示）。網站上限為 60 個原始、80 個編碼後特徵，且編碼數不得超過訓練筆數減 10。'+(invalid.length?' 需排除超過 12 類的欄位：'+invalid.join('、')+'。':'')+' 此處編碼數為整份資料預估，實際以訓練資料為準。';
updateAdvisor();
}
function updateAdvisor(){
  if(!dataset||!window.FeatureLabAdvisor)return;
  advice=window.FeatureLabAdvisor.evaluate(dataset.headers,dataset.rows,fields,$('target-select').value,Number($('train-split').value));
  const summary=$('advisor-summary');summary.replaceChildren();
  const summaries=[
    ['目前選取',advice.currentRaw+' 個原始 / '+advice.currentEncoded+' 個編碼後'],
    ['建議設定',advice.recommendedRaw+' 個原始 / '+advice.recommendedEncoded+' 個編碼後'],
    ['預估訓練筆數',advice.trainCount+' 筆'],
    ['可用編碼特徵上限',advice.maxEncoded+' 個（60 原始 / 80 編碼硬上限）'],
    ['有效 Target',advice.validTargets+' / '+advice.totalRows+' 筆']
  ];
  for(const [name,value] of summaries){
    const cell=document.createElement('div');cell.className='setup-advisor-stat';
    const label=document.createElement('small');label.textContent=name;
    const result=document.createElement('strong');result.textContent=value;
    if(name==='建議設定')result.className='teal';
    cell.append(label,result);summary.append(cell);
  }
  const warnings=$('advisor-warnings');warnings.replaceChildren();
  for(const message of advice.warnings){
    const line=document.createElement('p');line.textContent='需注意 · '+message;warnings.append(line);
  }
  const list=$('advisor-list');list.replaceChildren();
  for(const note of advice.reasons.slice(0,30)){
    const card=document.createElement('div');card.className='setup-advisor-item';
    const mark=document.createElement('span');mark.className='advisor-mark';
    mark.textContent=note.selected?'建議排除':'已排除';
    const detail=document.createElement('div');
    const title=document.createElement('strong');title.textContent=note.name;
    const desc=document.createElement('p');desc.textContent=note.description;
    detail.append(title,desc);card.append(mark,detail);list.append(card);
  }
  if(advice.reasons.length>30){
    const more=document.createElement('p');more.className='setup-advisor-empty';
    more.textContent='另有 '+(advice.reasons.length-30)+' 個欄位建議，請在輸入欄位清單檢查。';
    list.append(more);
  }
  if(!advice.reasons.length){
    const empty=document.createElement('p');empty.className='setup-advisor-empty';
    empty.textContent='目前沒有偵測到明顯的 ID、高類別數或超額編碼欄位。';
    list.append(empty);
  }
  const button=$('apply-advisor');
  button.disabled=!advice.canApply;
  button.textContent=advice.canApply?'套用建議排除 '+advice.toExclude.length+' 欄 ↗':'已符合欄位建議';
  $('advisor-status').textContent='這些是資料格式與運算預算的啟發式建議，不保證能獲得最低 RMSE／最高 R²。'+
    (advice.ready?'建議設定符合目前運算上限。':'請先確認 Target 與欄位設定能符合分析條件。');
}
$('apply-advisor').addEventListener('click',()=>{
  if(!dataset||!advice||!advice.toExclude.length)return;
  const drop=new Set(advice.toExclude);
  for(const field of fields){if(drop.has(field.name))field.use=false;}
  hideResults();renderFields();
});
function renderFields(){if(!dataset)return;const target=$('target-select').value;const container=$('feature-fields');container.textContent='';
for(const f of fields){const div=document.createElement('label');div.className='feature-field';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=f.use&&f.name!==target;checkbox.disabled=f.name===target;checkbox.addEventListener('change',()=>{f.use=checkbox.checked;estimate();hideResults();});const info=document.createElement('span');const bold=document.createElement('strong');bold.textContent=f.name;const small=document.createElement('small');small.textContent=f.name===target?'Target（不列入 Features）':f.type==='numeric'?'Numerical':'Categorical';info.append(bold,small);const sel=document.createElement('select');for(const [name,label] of [['numeric','數值'],['category','類別']]){const opt=document.createElement('option');opt.value=name;opt.textContent=label;sel.add(opt);}sel.value=f.type;sel.disabled=f.name===target;sel.addEventListener('change',()=>{f.type=sel.value;small.textContent=f.type==='numeric'?'Numerical':'Categorical';estimate();hideResults();});div.append(checkbox,info,sel);container.append(div);}estimate();}
const methodNotes={
  EFS:'從訓練資料預選最多 8 個候選特徵，在每個 k 值窮舉組合，依訓練三折 CV RMSE 選取。',
  RFECV:'固定 k 的 RFE 消除路徑：逐次移除 OLS 係數絕對值較低的特徵。此曲線不等於 RFECV 自動選取 k。',
  LassoCV:'以 JavaScript 簡化版 L1 正則化比較係數，依排名選取 k 個特徵，再以線性迴歸重新擬合；非 sklearn 原生 LassoCV。',
  Backward:'逐步移除 OLS 係數絕對值較小的特徵直到剩下指定數量；此瀏覽器版本不使用 p-value 或 0.05 停止條件。',
  SFS:'從空集合開始，在最多 12 個預選候選中，每次依訓練三折 CV RMSE 加入下一個特徵。'
};
const fmt=(v,n=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}):'N/A';
function syncSidebar(){
  const imported=!!dataset;
  const analyzed=imported&&!!analysisOutput&&!$('analysis-results').hidden;
  for(const link of document.querySelectorAll('#custom-side-nav [data-nav-stage]')){
    const stage=link.dataset.navStage;
    link.hidden=stage==='imported'?!imported:stage==='analyzed'?!analyzed:false;
  }
  const links=[...document.querySelectorAll('#custom-side-nav a:not([hidden])')];
  const active=links.find(link=>link.classList.contains('active'));
  if(!active&&links.length)links[0].classList.add('active');
}
function hideResults(){$('analysis-results').hidden=true;analysisOutput=null;results=[];syncSidebar();}
function currentRow(){
  return analysisOutput?.curves.find(row=>row.method===selectedMethod&&row.count===selectedK);
}
function changeView(method,k){
  if(!analysisOutput)return;
  const methods=window.FeatureLabCurves.methods;
  if(methods.includes(method))selectedMethod=method;
  selectedK=Math.max(1,Math.min(analysisOutput.maxK,Number(k)||1));
  renderView();
}
function renderView(){
  if(!analysisOutput)return;
  const row=currentRow();
  $('feature-count').value=String(selectedK);
  $('count-label').textContent=selectedK+' / '+analysisOutput.maxK;
  $('compare').checked=compare;
  $('method-note').textContent=methodNotes[selectedMethod];
  $('table-title').textContent=selectedMethod+' · 特徵組合與表現';
  $('table-badge').textContent=analysisOutput.maxK+' combinations';
  for(const tr of $('method-compare-rows').querySelectorAll('tr[data-method]')){
    const active=tr.dataset.method===selectedMethod;
    tr.classList.toggle('selected',active);
    tr.setAttribute('aria-selected',String(active));
  }
  const tabs=$('method-tabs');
  for(const button of tabs.querySelectorAll('[role="tab"]')){
    const active=button.dataset.method===selectedMethod;
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  }
  const activeMethods=compare?window.FeatureLabCurves.methods:[selectedMethod];
  const legend=$('legend');legend.replaceChildren();
  for(const name of activeMethods){
    const node=document.createElement('span'),swatch=document.createElement('i');
    swatch.style.background=window.FeatureLabCurves.color(name,document.documentElement.dataset.theme==='dark');
    node.append(swatch,document.createTextNode(name));legend.append(node);
  }
  window.FeatureLabCurves.render(analysisOutput.curves,selectedMethod,selectedK,compare,analysisOutput.maxK);
  const table=$('result-rows');table.replaceChildren();
  for(const result of analysisOutput.curves.filter(r=>r.method===selectedMethod)){
    const tr=document.createElement('tr');
    tr.tabIndex=0;tr.classList.toggle('selected',result.count===selectedK);
    tr.setAttribute('aria-selected',String(result.count===selectedK));
    tr.setAttribute('aria-label',selectedMethod+'，'+result.count+' 個特徵');
    const count=document.createElement('td');count.textContent=String(result.count).padStart(2,'0');
    const feature=document.createElement('td');
    for(const name of result.features){const tag=document.createElement('span');tag.className='feature-tag';tag.textContent=name;feature.append(tag);}
    const rmse=document.createElement('td');rmse.textContent=fmt(result.testRmse,4);
    const r2=document.createElement('td');r2.textContent=fmt(result.r2,4);
    tr.append(count,feature,rmse,r2);
    tr.addEventListener('click',()=>changeView(selectedMethod,result.count));
    tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();changeView(selectedMethod,result.count);}});
    table.append(tr);
  }
  $('selection-detail').textContent=row
    ?'目前查看：'+selectedMethod+' / '+selectedK+' 個特徵 / '+row.features.join(' + '):'';
  // Plot the currently selected trained model; interval width is based only
  // on training residuals and leverage, never on the held-out test outcomes.
  $('prediction-model').textContent=selectedMethod+' · '+selectedK+' 個特徵';
  if(row&&row.predictionPoints&&window.FeatureLabPrediction){
    const assessed=window.FeatureLabPrediction.render($('prediction-plot'),row.predictionPoints);
    $('prediction-stat').textContent='近似 95% 預測區間\n測試資料：'+assessed.total+' 筆\n區間涵蓋：'+assessed.covered+' / '+assessed.total+'（'+fmt(assessed.rate*100,1)+'%）';
    $('prediction-explanation').textContent='本圖對應 '+row.features.join(' + ')+'。區間使用訓練殘差變異、槓桿值及 Student-t 近似計算；測試資料不參與區間寬度估計。';
  }else{
    $('prediction-plot').innerHTML='<p class="prediction-empty">此模型的訓練資料不足或特徵矩陣不可逆，無法可靠估計預測區間。</p>';
    $('prediction-stat').textContent='區間無法估計';
    $('prediction-explanation').textContent='可嘗試較少的特徵數、排除完全共線欄位，或增加有效訓練資料。';
  }
  const evalExample=$('crisp-evaluation-example');
  if(evalExample&&row) evalExample.textContent=selectedMethod+' k='+selectedK+' 的 Test RMSE = '+fmt(row.testRmse,2)+'，Test R² = '+fmt(row.r2,4)+'；這是目前切分的結果，不代表所有 Dataset 或其他切分都相同。';
}
function initTabs(){
  const tabs=$('method-tabs');
  tabs.replaceChildren();
  const names=window.FeatureLabCurves.methods;
  names.forEach((name,i)=>{
    const button=document.createElement('button');button.type='button';button.textContent=name;
    button.dataset.method=name;button.setAttribute('role','tab');button.setAttribute('aria-selected','false');
    button.addEventListener('click',()=>changeView(name,selectedK));
    button.addEventListener('keydown',event=>{
      if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();
      const ix=event.key==='Home'?0:event.key==='End'?names.length-1:(i+(event.key==='ArrowRight'?1:names.length-1))%names.length;
      changeView(names[ix],selectedK);tabs.children[ix].focus();
    });
    tabs.append(button);
  });
}
function initCount(){
  const max=analysisOutput.maxK,input=$('feature-count'),labels=$('range-labels');
  input.max=String(max);input.value=String(Math.min(selectedK,max));
  labels.replaceChildren();
  for(let n=1;n<=max;n++){const label=document.createElement('span');label.textContent=n;labels.append(label);}
}
function renderMethodology(){
  const root=$('crisp-timeline');root.replaceChildren();
  const out=analysisOutput,d=out.data,target=$('target-select').value;
  const inputs=fields.filter(field=>field.use&&field.name!==target);
  const exampleNames=inputs.slice(0,3).map(f=>f.name);
  const numeric=inputs.filter(f=>f.type==='numeric').map(f=>f.name);
  const categorical=inputs.filter(f=>f.type==='category').map(f=>f.name);
  const ds=$('data-source').textContent||'Dataset';
  const efs=out.curves.find(row=>row.method==='EFS'&&row.count===1);
  const methodDetails=[
    ['EFS · Exhaustive Feature Selection','在最多 8 個候選特徵內，對每個 k 窮舉組合，以訓練 CV RMSE 比較。'],
    ['RFECV · RFE 固定數量路徑','逐步依 OLS 係數絕對值移除特徵，輸出固定 k 的 RFE 路徑；非自動 RFECV。'],
    ['LassoCV · L1 Regularization','使用簡化的 L1 正則化與參數比較選取係數較重要的 k 個特徵，再以 OLS 重訓。'],
    ['Backward · Backward Elimination','每輪移除絕對係數最小的欄位，直到 k 個；此版本不是 p-value 刪除法。'],
    ['SFS · Sequential Forward Selection','在最多 12 個候選中從空集合逐步加欄位，依訓練 CV RMSE 決定下一個。']
  ];
  const stage=[
    {english:'Business Understanding',title:'定義問題',
      desc:'這次實驗以「'+target+'」作為連續數值預測目標，利用 '+inputs.length+' 個原始輸入欄位建立多元線性迴歸，觀察減少特徵後的預測效果。',
      label:'研究問題',example:exampleNames.length?'只使用 '+exampleNames[0]+'，或再加入 '+(exampleNames[1]||'其他欄位')+'，能否改善 '+target+' 的預測？':'如何從選取的欄位預測 '+target+'？'},
    {english:'Data Understanding',title:'認識資料',
      desc:'匯入 '+ds+'，共有 '+dataset.rows.length+' 筆資料、'+dataset.headers.length+' 個欄位；目標為 '+target+'，本次選取 '+inputs.length+' 個原始 Features。',
      label:'欄位示例',example:'輸入欄位：'+(exampleNames.join('、')||'無')+'；數值欄 '+numeric.length+' 個，類別欄 '+categorical.length+' 個。'},
    {english:'Data Preparation',title:'處理缺值與類別',
      desc:'先剔除 Target 缺漏／無效的資料列；使用固定 random_state='+$('random-seed').value+' 切成 '+d.train+' 筆訓練、'+d.test+' 筆測試。數值缺值以訓練平均值補齊並標準化；類別缺值以眾數補齊，One-Hot 編碼後移除第一個類別。',
      label:'實際轉換',example:'從 '+d.raw+' 個原始 Features 轉為 '+d.encoded+' 個編碼後 Features。'+(categorical.length?'類別欄位 '+categorical.slice(0,2).join('、')+' 轉為指示變數。':'本次沒有選用類別欄位。')},
    {english:'Modeling',title:'訓練與特徵選擇',
      desc:'以 OLS 線性迴歸作為 Baseline；分別比較 EFS、RFECV（固定 k 的 RFE）、LassoCV（簡化 L1）、Backward、SFS，在 k=1–'+out.maxK+' 個特徵下的預測表現。所有特徵選取只使用訓練資料。',
      label:'實際操作',example:efs?'EFS k=1 依本次訓練資料選出 '+efs.features.join('、')+'；其他方法及數量可在上方曲線與表格切換。':'本次特徵選擇詳見上方曲線。',
      methods:methodDetails},
    {english:'Evaluation',title:'以共同測試集比較',
      desc:'在訓練資料上計算三折 CV RMSE，特徵選擇不看測試集；所有 '+out.curves.length+' 組方法使用同一份保留測試集評估 Test RMSE 與 Test R²。RMSE 越低越好；R² 越高越好。',
      label:'讀圖方式',example:'',exampleId:'crisp-evaluation-example'},
    {english:'Deployment',title:'發佈可互動報告',
      desc:'這個 Custom Dataset 在使用者瀏覽器中執行 JavaScript 分析，產生五方法曲線、特徵組合表格，並將 '+out.curves.length+' 組加上 Baseline 的結果匯出 CSV。',
      label:'使用方式',example:'按方法分頁、拖動 k 滑桿或勾選「同時比較五種方法」檢視 '+target+' 的模型結果；切換視圖不會重新訓練。'}
  ];
  stage.forEach((item,i)=>{
    const article=document.createElement('article');article.className='crisp-stage';
    const number=document.createElement('div');number.className='crisp-step';
    const no=document.createElement('span');no.textContent=String(i+1).padStart(2,'0');number.append(no);
    const body=document.createElement('div');body.className='crisp-body';
    const en=document.createElement('span');en.className='crisp-en';en.textContent=item.english;
    const h=document.createElement('h3');h.textContent=item.title;
    const p=document.createElement('p');p.textContent=item.desc;
    const ex=document.createElement('div');ex.className='crisp-example';
    const label=document.createElement('span');label.textContent=item.label;
    const explanation=document.createElement('p');explanation.textContent=item.example;
    if(item.exampleId)explanation.id=item.exampleId;
    ex.append(label,explanation);body.append(en,h,p,ex);
    if(item.methods){
      const details=document.createElement('div');details.className='crisp-methods';
      const header=document.createElement('div');header.className='crisp-methods-head';
      const eyebrow=document.createElement('span');eyebrow.textContent='MODEL SELECTION / 05 SCHEMES';
      const sub=document.createElement('h4');sub.textContent='五種特徵選擇，實際怎麼做？';
      header.append(eyebrow,sub);details.append(header);
      item.methods.forEach(([name,desc],j)=>{
        const line=document.createElement('div');line.className='crisp-method-row';
        const index=document.createElement('span');index.className='crisp-method-index';index.textContent=String(j+1).padStart(2,'0');
        const title=document.createElement('strong');title.textContent=name;
        const explanation=document.createElement('p');explanation.textContent=desc;
        line.append(index,title,explanation);details.append(line);
      });
      body.append(details);
    }
    article.append(number,body);root.append(article);
  });
}
function importMatrix(matrix,name){const value=normalize(matrix);if(value.rows.length<2)throw Error('資料列數不足。');dataset=value;const {headers,rows}=value;$('preview').hidden=false;$('config').hidden=false;hideResults();
let target=headers.find(v=>/^(price|profit|saleprice|target|y|charges)$/i.test(v.trim()))||headers[headers.length-1];const targets=dataset.rows.map(r=>r[headers.indexOf(target)]).filter(v=>!missing(v));if(targets.filter(v=>Number.isFinite(Number(v))).length<targets.length*.8){const numeric=headers.filter((h,i)=>infer(rows.map(row=>row[i]))==='numeric');target=numeric[numeric.length-1]||target;}
const sel=$('target-select');sel.textContent='';for(const h of headers){const opt=document.createElement('option');opt.value=h;opt.textContent=h;sel.append(opt);}sel.value=target;
fields=headers.map((name,i)=>{const type=infer(rows.map(row=>row[i]));const values=rows.map(row=>row[i]).filter(v=>!missing(v)),unique=new Set(values).size;return {name,type,use:name!==target&&!window.FeatureLabAdvisor.idColumn(name)&&!(type==='category'&&unique>12)};});
$('row-total').textContent=rows.length.toLocaleString();$('column-total').textContent=headers.length;$('data-source').textContent=name;$('preview-head').textContent='';$('preview-body').textContent='';
const head=document.createElement('tr');for(const h of headers){const th=document.createElement('th');th.textContent=h;head.append(th);}$('preview-head').append(head);
for(const row of rows.slice(0,5)){const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('preview-body').append(tr);}
renderFields();status('已匯入 '+name+'：'+rows.length.toLocaleString()+' 筆、'+headers.length+' 欄。請設定 Target 與 Features。');$('preview').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
async function excel(file){if(!window.XLSX){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';script.onload=resolve;script.onerror=()=>reject(Error('無法載入 Excel 解析套件。請確認網路，或另存 CSV 上傳。'));document.head.append(script);});}const buffer=await file.arrayBuffer(),book=XLSX.read(buffer,{type:'array',cellDates:false});const first=book.Sheets[book.SheetNames[0]];return XLSX.utils.sheet_to_json(first,{header:1,defval:'',raw:false,blankrows:false});}
async function handleFile(file){if(!file)return;try{if(file.size>5*1024*1024)throw Error('檔案大小上限為 5 MB。');status('正在讀取 '+file.name+' ...');const matrix=/\.xlsx?$/i.test(file.name)?await excel(file):parseCSV(await file.text());importMatrix(matrix,file.name);}catch(e){status(e.message,true);}}
for(const btn of document.querySelectorAll('[data-source]'))btn.addEventListener('click',()=>{const selected=btn.dataset.source;for(const target of document.querySelectorAll('[data-source]')){target.classList.toggle('active',target===btn);target.setAttribute('aria-pressed',String(target===btn));}for(const mode of ['file','url','paste'])$('import-'+mode).hidden=mode!==selected;});
$('dataset-file').addEventListener('change',e=>handleFile(e.target.files[0]));
const zone=$('dropzone');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');handleFile(e.dataTransfer.files[0]);});
$('load-paste').addEventListener('click',()=>{try{const text=$('dataset-paste').value;if(text.length>5*1024*1024)throw Error('貼上資料超過 5MB。');importMatrix(parseCSV(text),'貼上資料');}catch(e){status(e.message,true);}});
$('load-url').addEventListener('click',async()=>{
  let url;
  try{
    url=new URL($('dataset-url').value);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('請輸入有效的 HTTP(S) CSV 直接網址。');
  }catch(e){status('網址格式不正確：'+e.message,true);return;}
  status('正在讀取公開 CSV 網址…');
  let text;
  try{
    const res=await fetch(url.href,{credentials:'omit',mode:'cors'});
    if(!res.ok)throw Error('HTTP '+res.status);
    if(Number(res.headers.get('content-length')||0)>5*1024*1024)throw Error('檔案超過 5 MiB');
    text=await res.text();
    if(text.length>5*1024*1024)throw Error('檔案超過 5 MiB');
  }catch(e){status('網址下載失敗：'+e.message+'。請確認原始 CSV 網址、網路或 CORS。',true);return;}
  try{importMatrix(parseCSV(text),url.hostname);}
  catch(e){status('Dataset 格式或匯入限制：'+e.message+' 請檢查欄位、列數及檔案內容。',true);}
});
$('load-startups').addEventListener('click',async()=>{try{status('載入原始 50 Startups CSV…');const res=await fetch('sample-startups.csv',{cache:'no-store'});if(!res.ok)throw Error('範例檔案不存在');importMatrix(parseCSV(await res.text()),'50 Startups');}catch(e){status(e.message,true);}});
$('target-select').addEventListener('change',()=>{const target=$('target-select').value;for(const f of fields){if(f.name===target)f.use=false;}renderFields();hideResults();});
function csvCell(v){let s=String(v??'');if(/^\s*[=+@]/.test(s)||(/^\s*-/.test(s)&&!Number.isFinite(Number(s))))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function download(text,filename){const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('run-analysis').addEventListener('click',async()=>{
  const btn=$('run-analysis');
  try{
    hideResults();
    if(!dataset)throw Error('請先匯入 Dataset。');
    const seed=Number($('random-seed').value);
    if(!Number.isInteger(seed)||seed<0||seed>999999)throw Error('隨機種子請填入 0–999999 的整數。');
    const payload={...dataset,target:$('target-select').value,fields,split:Number($('train-split').value),
      seed,methods:['EFS','RFECV','LassoCV','Backward','SFS'],k:2};
    btn.disabled=true;
    status('正在計算五種方法 × 1–5 個特徵及 RMSE / R² 曲線…',false,'analysis-status');
    await new Promise(resolve=>setTimeout(resolve,70));
    if(!window.FeatureLabModel||!window.FeatureLabCurves)throw Error('迴歸或繪圖程式未載入，請重新整理。');
    const out=window.FeatureLabModel.analyze(payload);
    if(!window.FeatureLabMethodComparison)throw Error('方法比較表格程式未載入，請重新整理。');
    window.FeatureLabMethodComparison.render(
      $('method-compare-rows'),
      window.FeatureLabMethodComparison.fromCustom(out),
      {selected:'Backward',onSelect:row=>changeView(row.method,row.count)}
    );
    analysisOutput=out;results=out.curves;selectedK=Math.min(2,out.maxK);selectedMethod='Backward';compare=false;
    $('model-summary').textContent=out.data.valid+' 筆有效資料 / '+out.data.train+' 訓練 / '+out.data.test+
       ' 測試 · '+out.data.raw+' 個原始特徵 / '+out.data.encoded+' 個編碼後特徵';
    $('curve-heading').textContent=out.maxK===out.data.encoded?'從 1 個特徵，到完整模型':'從 1 個特徵，到 '+out.maxK+' 個特徵';
    const risk=$('overfit-warning');
    risk.hidden=!out.data.overfitRisk;
    risk.textContent=out.data.overfitRisk?
      '過擬合風險提醒：本次編碼後使用 '+out.data.encoded+' 個特徵，已超過 '+out.data.train+' 筆訓練資料的三分之一。建議查看較少特徵的曲線，並留意測試集表現。':'';
    initTabs();initCount();renderMethodology();renderView();
    $('analysis-results').hidden=false;
    syncSidebar();
    status('分析完成：'+out.curves.length+' 組固定特徵數結果及 Baseline。',false,'analysis-status');
    $('analysis-results').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){status('分析失敗：'+e.message,true,'analysis-status');}finally{btn.disabled=false;}
});
$('train-split').addEventListener('change',updateAdvisor);
$('feature-count').addEventListener('input',e=>changeView(selectedMethod,Number(e.target.value)));
$('compare').addEventListener('change',e=>{compare=e.target.checked;renderView();});
for(const graphId of ['rmse-chart','r2-chart']){
  const graph=$(graphId);
  graph.addEventListener('click',e=>{
    const point=e.target.closest('circle.chart-point');
    if(point)changeView(point.dataset.method,Number(point.dataset.k));
  });
  graph.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const point=e.target.closest('circle.chart-point');
    if(point){e.preventDefault();changeView(point.dataset.method,Number(point.dataset.k));}
  });
}
for(const el of document.querySelectorAll('#config input:not([type="checkbox"]),#config select')){
  el.addEventListener('change',hideResults);
}
$('export-results').addEventListener('click',()=>{
  if(!analysisOutput)return;
  const cols=['Method','Number of Features','Selected Features','Train CV RMSE','Test RMSE','Test R-squared'];
  const lines=[cols.map(csvCell).join(',')];
  for(const r of [analysisOutput.baseline,...analysisOutput.curves])
    lines.push([r.method,r.count,r.features.join(' | '),r.cvRmse,r.testRmse,r.r2??''].map(csvCell).join(','));
  download(lines.join('\r\n'),'feature_lab_all_five_schemes.csv');
});

const toggle=$('theme-toggle');function drawTheme(){const dark=document.documentElement.dataset.theme==='dark';toggle.textContent=dark?'☀ 淺色模式':'☾ 黑暗模式';toggle.setAttribute('aria-pressed',String(dark));}
toggle.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('feature-lab-theme',next);}catch{}drawTheme();});drawTheme();
syncSidebar();
})();