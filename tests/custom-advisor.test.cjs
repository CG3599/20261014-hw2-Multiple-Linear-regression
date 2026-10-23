'use strict';
// Run from repository root: node tests/custom-advisor.test.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.window=global;
require('../docs/custom-advisor.js');
require('../docs/custom-model.js');
const advisor=global.FeatureLabAdvisor,model=global.FeatureLabModel;
const ui=fs.readFileSync(path.join(__dirname,'../docs/custom.js'),'utf8');
const begin=ui.indexOf('function normalize('),end=ui.indexOf('function infer(',begin);
assert(begin>=0&&end>begin,'normalize definition missing');
const normalize=new Function('matrix','const missing=x=>x==null||String(x).trim()==="";'+ui.slice(begin,end)+'return normalize(matrix);');
for(const count of [60,61,120]){
  const table=[Array.from({length:count},(_,i)=>'f'+i),Array.from({length:count},(_,i)=>String(i))];
  assert.equal(normalize(table).headers.length,count,'must accept '+count+' original CSV columns');
}
assert.throws(()=>normalize([Array.from({length:121},(_,i)=>'f'+i),Array(121).fill('1')]),/120 欄/);
for(const name of ['car_ID','EmployeeNumber','CustomerID','row_id'])assert(advisor.idColumn(name),name);
for(const name of ['fluid','valid','hybrid','bodyfat','R&D Spend'])assert(!advisor.idColumn(name),name+' is not an ID');
// Exercise hard limits and the training-count adaptive budget with numeric
// and three-level categorical fields. This suite checks exact boundaries.
function fixture(n,numberCount,categoryCount,categorySize=3){
  const headers=[...Array.from({length:numberCount},(_,i)=>'n'+i),...Array.from({length:categoryCount},(_,i)=>'c'+i),'target'];
  const rows=Array.from({length:n},(_,i)=>[
    ...Array.from({length:numberCount},(_,j)=>String((i*(j+3)+(i%13)**2)%137)),
    ...Array.from({length:categoryCount},(_,j)=>'v'+(i+j)%categorySize),
    String(100+i*2+i%5)
  ]);
  const fields=headers.map(name=>({name,type:name.startsWith('c')?'category':'numeric',use:name!=='target'}));
  return {headers,rows,fields,target:'target',split:.8,seed:42,k:2,methods:[]};
}
function outcome(payload){return model.analyze(payload);}
const sixty=fixture(150,60,0);
assert.equal(outcome(sixty).data.encoded,60);
const eighty=fixture(150,40,20,3);
const result=outcome(eighty);
assert.equal(result.data.raw,60);
assert.equal(result.data.encoded,80);
assert.equal(result.data.maxEncoded,80);
assert(result.data.overfitRisk);
const eightyOne=fixture(150,39,21,3);
assert.throws(()=>outcome(eightyOne),/80 個編碼特徵/);
const raw61=fixture(150,61,0);
assert.throws(()=>outcome(raw61),/60 個原始/);
const dynamic=fixture(75,51,0);
const before=advisor.evaluate(dynamic.headers,dynamic.rows,dynamic.fields,'target',.8);
assert.equal(before.trainCount,60);
assert.equal(before.maxEncoded,50);
assert(before.toExclude.length>=1);
assert(before.recommendedEncoded<=50);
assert.throws(()=>outcome(dynamic),/訓練筆數減 10/);
const reduced=dynamic.fields.map(f=>({...f,use:f.use&&!before.toExclude.includes(f.name)}));
assert.equal(outcome({...dynamic,fields:reduced}).data.encoded,50);
const risk=fixture(113,35,0);
assert.equal(outcome(risk).data.train,90);
assert(outcome(risk).data.overfitRisk);
assert(advisor.evaluate(risk.headers,risk.rows,risk.fields,'target',.8).warnings.some(s=>s.includes('過擬合')));
const startups=fs.readFileSync(path.join(__dirname,'../docs/sample-startups.csv'),'utf8').trim().split(/\r?\n/);
const h=startups.shift().split(','),data=startups.map(line=>line.split(','));
const f=h.map(name=>({name,type:name==='State'?'category':'numeric',use:name!=='Profit'}));
const plan=advisor.evaluate(h,data,f,'Profit',.8);
assert.equal(plan.currentEncoded,5);assert.equal(plan.trainCount,40);assert.equal(plan.maxEncoded,30);
assert.equal(plan.toExclude.length,0);assert(plan.ready);
const html=fs.readFileSync(path.join(__dirname,'../docs/custom.html'),'utf8');
assert(html.includes('id="overfit-warning"'));
console.log('Advisor and model limit tests: 60 raw, 80 encoded, train minus 10, overfit flag PASSED');
