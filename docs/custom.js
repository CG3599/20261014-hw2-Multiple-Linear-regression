'use strict';
(() => {
const $ = id => document.getElementById(id);
let dataset=null,fields=[],results=[],analysisOutput=null,selectedMethod='EFS';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const missing=s=>s==null||String(s).trim()===''||['na','null','n/a'].includes(String(s).trim().toLowerCase());
function status(message,error=false,where='upload-status'){const el=$(where);el.textContent=message;el.classList.toggle('error',error);}
function detectDelimiter(text){const line=(text.split(/\r?\n/).find(s=>s.trim())||'').slice(0,2000),options=[',','\t',';'];return options.map(d=>({d,n:line.split(d).length-1})).sort((a,b)=>b.n-a.n)[0].d;}
function parseCSV(text){text=text.replace(/^\uFEFF/,'');const delim=detectDelimiter(text),table=[],row=[];let buf='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){buf+='"';i++;}else quoted=!quoted;}else if(c===delim&&!quoted){row.push(buf);buf='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(buf);buf='';if(row.some(v=>String(v).trim()))table.push(row.slice());row.length=0;if(table.length>6002)throw Error('資料超過 6,000 列，請先縮減檔案。');}else buf+=c;}if(quoted)throw Error('CSV 格式錯誤：引號未關閉。');row.push(buf);if(row.some(v=>String(v).trim()))table.push(row);return table;}
function normalize(matrix){if(!Array.isArray(matrix)||matrix.length<2)throw Error('資料至少需要標題列與一筆資料。');if(matrix[0].length>60)throw Error('原始欄位上限為 60。');const seen=new Set(),headers=matrix[0].map((v,i)=>{const base=String(v||'Column '+(i+1)).trim();let name=base,n=2;while(seen.has(name)){name=base+'_'+n++;}seen.add(name);return name;});if(headers.length<2)throw Error('至少需要兩個欄位（Feature + Target）。');const rows=matrix.slice(1).filter(row=>row.some(v=>!missing(v))).map(row=>headers.map((_,i)=>String(row[i]??'').trim()));return {headers,rows};}
function infer(values){const vals=values.filter(v=>!missing(v));return vals.length>0&&vals.filter(v=>Number.isFinite(Number(v))).length/vals.length>=.9?'numeric':'category';}
function estimate(){if(!dataset)return;const target=$('target-select').value,chosen=fields.filter(f=>f.use&&f.name!==target);let count=0,invalid=[];
for(const f of chosen){if(f.type==='numeric')count++;else{const vals=new Set(dataset.rows.map(row=>row[dataset.headers.indexOf(f.name)]).filter(v=>!missing(v)));if(vals.size>12)invalid.push(f.name+' ('+vals.size+' 類)');count+=Math.max(0,vals.size-1);}}
$('raw-feature-total').textContent=chosen.length;$('encoded-feature-total').textContent=count;
const ok=chosen.length>13&&chosen.length<40;
$('feature-guidance').textContent='原始輸入特徵 '+chosen.length+' 個：'+(ok?'符合':'不符合')+' HW2 的 14–39 個條件（這是資料檢查提示，不阻止分析）。'+(invalid.length?' 超過 12 類，需排除的類別欄：'+invalid.join('、')+'。':'')+' 編碼數僅為整份資料預估，實際由訓練資料決定。';
}
function renderFields(){if(!dataset)return;const target=$('target-select').value;const container=$('feature-fields');container.textContent='';
for(const f of fields){const div=document.createElement('label');div.className='feature-field';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=f.use&&f.name!==target;checkbox.disabled=f.name===target;checkbox.addEventListener('change',()=>{f.use=checkbox.checked;estimate();hideResults();});const info=document.createElement('span');const bold=document.createElement('strong');bold.textContent=f.name;const small=document.createElement('small');small.textContent=f.name===target?'Target（不列入 Features）':f.type==='numeric'?'Numerical':'Categorical';info.append(bold,small);const sel=document.createElement('select');for(const [name,label] of [['numeric','數值'],['category','類別']]){const opt=document.createElement('option');opt.value=name;opt.textContent=label;sel.add(opt);}sel.value=f.type;sel.disabled=f.name===target;sel.addEventListener('change',()=>{f.type=sel.value;small.textContent=f.type==='numeric'?'Numerical':'Categorical';estimate();hideResults();});div.append(checkbox,info,sel);container.append(div);}estimate();}
function hideResults(){
  $('analysis-results').hidden=true;
  results=[];analysisOutput=null;
}
function activeRow(method,k){
  if(!analysisOutput)return null;
  return method==='Baseline'?analysisOutput.baseline:
    analysisOutput.curves.find(row=>row.method===method&&row.count===k);
}
function setView(k,method){
  if(!analysisOutput)return;
  const maxK=analysisOutput.maxK;
  const count=Math.min(maxK,Math.max(1,Number(k)||1));
  $('feature-k').value=String(count);
  selectedMethod=method||selectedMethod;
  const available=['Baseline',...window.FeatureLabCurves.methods];
  if(!available.includes(selectedMethod))selectedMethod='EFS';
  results=[analysisOutput.baseline,...analysisOutput.curves.filter(row=>row.count===count)];
  const select=$('diagnostic-method');
  if(![...select.options].some(option=>option.value===selectedMethod))selectedMethod='EFS';
  select.value=selectedMethod;
  window.FeatureLabCharts.renderScores(results);
  window.FeatureLabCurves.render(analysisOutput.curves,count,$('curve-metric').value,selectedMethod);
  const diagnostic=activeRow(selectedMethod,count)||analysisOutput.baseline;
  window.FeatureLabCharts.renderDiagnostics(diagnostic);
  for(const tr of $('model-results').querySelectorAll('tr[data-method]')){
    const active=tr.dataset.method===selectedMethod&&(selectedMethod==='Baseline'||Number(tr.dataset.k)===count);
    tr.classList.toggle('selected',active);
    tr.setAttribute('aria-selected',String(active));
  }
}
function selectDiagnostic(method){setView($('feature-k').value,method);}
function renderMethodTable(){
  const tbody=$('model-results');tbody.textContent='';
  const all=[analysisOutput.baseline,...analysisOutput.curves];
  for(const r of all){
    const tr=document.createElement('tr');
    tr.dataset.method=r.method;
    tr.dataset.k=String(r.count);
    tr.tabIndex=0;tr.setAttribute('role','button');
    tr.setAttribute('aria-label','查看 '+r.method+' 在 '+r.count+' 個特徵時的診斷圖');
    for(const v of [r.method,r.count,Number.isFinite(r.cvRmse)?r.cvRmse.toFixed(3):'—',r.testRmse.toFixed(3),r.r2===null?'N/A':r.r2.toFixed(4),r.features.join('、')]){
      const td=document.createElement('td');td.textContent=String(v);tr.append(td);
    }
    const choose=()=>setView(r.method==='Baseline'?$('feature-k').value:r.count,r.method);
    tr.addEventListener('click',choose);
    tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
    tbody.append(tr);
  }
}
function importMatrix(matrix,name){const value=normalize(matrix);if(value.rows.length<2)throw Error('資料列數不足。');dataset=value;const {headers,rows}=value;$('preview').hidden=false;$('config').hidden=false;hideResults();
let target=headers.find(v=>/^(price|profit|saleprice|target|y|charges)$/i.test(v.trim()))||headers[headers.length-1];const targets=dataset.rows.map(r=>r[headers.indexOf(target)]).filter(v=>!missing(v));if(targets.filter(v=>Number.isFinite(Number(v))).length<targets.length*.8){const numeric=headers.filter((h,i)=>infer(rows.map(row=>row[i]))==='numeric');target=numeric[numeric.length-1]||target;}
const sel=$('target-select');sel.textContent='';for(const h of headers){const opt=document.createElement('option');opt.value=h;opt.textContent=h;sel.append(opt);}sel.value=target;
fields=headers.map((name,i)=>{const type=infer(rows.map(row=>row[i]));const values=rows.map(row=>row[i]).filter(v=>!missing(v)),unique=new Set(values).size;return {name,type,use:name!==target&&!/^(id|index|unnamed:?\s*\d*|serial|row_?id)$/i.test(name)&&!(type==='category'&&unique>12)};});
$('row-total').textContent=rows.length.toLocaleString();$('column-total').textContent=headers.length;$('data-source').textContent=name;$('preview-head').textContent='';$('preview-body').textContent='';
const head=document.createElement('tr');for(const h of headers){const th=document.createElement('th');th.textContent=h;head.append(th);}$('preview-head').append(head);
for(const row of rows.slice(0,5)){const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('preview-body').append(tr);}
renderFields();status('已匯入 '+name+'：'+rows.length.toLocaleString()+' 筆、'+headers.length+' 欄。請設定 Target 與 Features。');}
async function excel(file){if(!window.XLSX){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';script.onload=resolve;script.onerror=()=>reject(Error('無法載入 Excel 解析套件。請確認網路，或另存 CSV 上傳。'));document.head.append(script);});}const buffer=await file.arrayBuffer(),book=XLSX.read(buffer,{type:'array',cellDates:false});const first=book.Sheets[book.SheetNames[0]];return XLSX.utils.sheet_to_json(first,{header:1,defval:'',raw:false,blankrows:false});}
async function handleFile(file){if(!file)return;try{if(file.size>5*1024*1024)throw Error('檔案大小上限為 5 MB。');status('正在讀取 '+file.name+' ...');const matrix=/\.xlsx?$/i.test(file.name)?await excel(file):parseCSV(await file.text());importMatrix(matrix,file.name);}catch(e){status(e.message,true);}}
for(const btn of document.querySelectorAll('[data-source]'))btn.addEventListener('click',()=>{const selected=btn.dataset.source;for(const target of document.querySelectorAll('[data-source]')){target.classList.toggle('active',target===btn);target.setAttribute('aria-pressed',String(target===btn));}for(const mode of ['file','url','paste'])$('import-'+mode).hidden=mode!==selected;});
$('dataset-file').addEventListener('change',e=>handleFile(e.target.files[0]));
const zone=$('dropzone');zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragover');});zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');handleFile(e.dataTransfer.files[0]);});
$('load-paste').addEventListener('click',()=>{try{const text=$('dataset-paste').value;if(text.length>5*1024*1024)throw Error('貼上資料超過 5MB。');importMatrix(parseCSV(text),'貼上資料');}catch(e){status(e.message,true);}});
$('load-url').addEventListener('click',async()=>{try{const u=new URL($('dataset-url').value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('請輸入有效的 HTTP(S) 檔案直接網址。');status('正在讀取公開網址…');const res=await fetch(u.href,{credentials:'omit',mode:'cors'});if(!res.ok)throw Error('遠端下載失敗（HTTP '+res.status+'）。');const length=Number(res.headers.get('content-length')||0);if(length>5*1024*1024)throw Error('遠端檔案過大（超過 5MB）。');const text=await res.text();if(text.length>5*1024*1024)throw Error('遠端檔案過大（超過 5MB）。');importMatrix(parseCSV(text),u.hostname);}catch(e){status('URL 匯入失敗：'+e.message+'。請檢查網址或 CORS，亦可改為下載 CSV 上傳。',true);}});
$('load-startups').addEventListener('click',async()=>{try{status('載入原始 50 Startups CSV…');const res=await fetch('sample-startups.csv',{cache:'no-store'});if(!res.ok)throw Error('範例檔案不存在');importMatrix(parseCSV(await res.text()),'50 Startups');}catch(e){status(e.message,true);}});
$('target-select').addEventListener('change',()=>{const target=$('target-select').value;for(const f of fields){if(f.name===target)f.use=false;}renderFields();hideResults();});
function csvCell(v){let s=String(v??'');if(/^\s*[=+@]/.test(s)||(/^\s*-/.test(s)&&!Number.isFinite(Number(s))))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function download(text,filename){const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('run-analysis').addEventListener('click',async()=>{const btn=$('run-analysis');try{hideResults();if(!dataset)throw Error('請先匯入 Dataset。');const methods=['EFS','RFECV','LassoCV','Backward','SFS'];const seed=Number($('random-seed').value);if(!Number.isInteger(seed)||seed<0||seed>999999)throw Error('隨機種子請填入 0–999999 的整數。');const input={...dataset,target:$('target-select').value,fields,split:Number($('train-split').value),seed,methods,k:Number($('feature-k').value)};btn.disabled=true;status('正在執行多元線性迴歸、交叉驗證與特徵選擇…',false,'analysis-status');await new Promise(resolve=>setTimeout(resolve,70));
if(!window.FeatureLabModel||!window.FeatureLabCharts||!window.FeatureLabCurves)throw Error('分析或圖表程式未載入，請重新整理。');const output=window.FeatureLabModel.analyze(input);analysisOutput=output;results=output.results;
const summary=$('model-summary');summary.textContent='';for(const [label,value] of [['有效筆數',output.data.valid],['訓練 / 測試',output.data.train+' / '+output.data.test],['原始 Features',output.data.raw],['編碼後 Features',output.data.encoded]]){const node=document.createElement('div'),s=document.createElement('span'),v=document.createElement('strong');s.textContent=label;v.textContent=value;node.append(s,v);summary.append(node);}
renderMethodTable();
const diagnostic=$('diagnostic-method');diagnostic.textContent='';
for(const method of ['Baseline',...window.FeatureLabCurves.methods]){
  const opt=document.createElement('option');opt.value=method;opt.textContent=method;diagnostic.append(opt);
}
// Choose the default method by training-CV RMSE, never by held-out test scores.
const selected=results.filter(row=>Number.isFinite(row.cvRmse)).sort((a,b)=>a.cvRmse-b.cvRmse)[0]||results[0];
setView(output.selectedK,selected.method);
$('analysis-results').hidden=false;status('分析完成：五種方法 × '+output.maxK+' 個特徵數 = '+output.curves.length+' 組曲線結果，加上 Baseline。',false,'analysis-status');$('analysis-results').scrollIntoView({behavior:'smooth',block:'start'});
}catch(e){status('分析失敗：'+e.message,true,'analysis-status');}finally{btn.disabled=false;}});
$('diagnostic-method').addEventListener('change',e=>selectDiagnostic(e.target.value));
$('curve-metric').addEventListener('change',()=>{if(analysisOutput)setView($('feature-k').value,selectedMethod);});
$('feature-k').addEventListener('change',e=>{if(analysisOutput)setView(e.target.value,selectedMethod);});
$('five-curve-grid').addEventListener('click',event=>{
  const point=event.target.closest('[data-k][data-method]');
  if(point){setView(point.dataset.k,point.dataset.method);return;}
  const btn=event.target.closest('[data-choose-method]');
  if(btn)setView($('feature-k').value,btn.dataset.chooseMethod);
});
$('five-curve-grid').addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const point=event.target.closest('[data-k][data-method]');
  if(point){event.preventDefault();setView(point.dataset.k,point.dataset.method);}
});
for(const el of document.querySelectorAll('#config input:not([type="checkbox"]),#config select:not(#feature-k)')){
  el.addEventListener('change',hideResults);
}
$('export-results').addEventListener('click',()=>{if(!analysisOutput)return;const cols=['Method','Features','CV RMSE','Test RMSE','Test R2','Selected Features'],lines=[cols.map(csvCell).join(',')];for(const r of [analysisOutput.baseline,...analysisOutput.curves])lines.push([r.method,r.count,r.cvRmse,r.testRmse,r.r2??'',r.features.join(' | ')].map(csvCell).join(','));download(lines.join('\r\n'),'feature_lab_all_methods_k1_to_k5.csv');});
const toggle=$('theme-toggle');function drawTheme(){const dark=document.documentElement.dataset.theme==='dark';toggle.textContent=dark?'☀ 淺色模式':'☾ 黑暗模式';toggle.setAttribute('aria-pressed',String(dark));}
toggle.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('feature-lab-theme',next);}catch{}drawTheme();});drawTheme();
})();