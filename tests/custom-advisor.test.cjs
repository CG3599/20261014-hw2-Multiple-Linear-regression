'use strict';
// Run from repository root: node tests/custom-advisor.test.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.window=global;
require('../docs/custom-advisor.js');
const advisor=global.FeatureLabAdvisor;
const ui=fs.readFileSync(path.join(__dirname,'../docs/custom.js'),'utf8');
const begin=ui.indexOf('function normalize('),end=ui.indexOf('function infer(',begin);
assert(begin>=0&&end>begin,'normalize definition missing');
const normalize=new Function('matrix','const missing=x=>x==null||String(x).trim()==="";'+ui.slice(begin,end)+'return normalize(matrix);');
for(const count of [60,61,120]){
  const table=[Array.from({length:count},(_,i)=>'f'+i),Array.from({length:count},(_,i)=>String(i))];
  assert.equal(normalize(table).headers.length,count,'should accept '+count+' original columns');
}
assert.throws(()=>normalize([Array.from({length:121},(_,i)=>'f'+i),Array(121).fill('1')]),/120 欄/);
for(const name of ['car_ID','EmployeeNumber','CustomerID','row_id'])assert(advisor.idColumn(name),name);
for(const name of ['fluid','valid','hybrid','bodyfat','R&D Spend'])assert(!advisor.idColumn(name),name+' is not ID');
// This mimics a CarPrice-like dataset: 14 numeric predictors + categorical
// columns whose One-Hot encoding would exceed the 40-feature model budget.
const headers=['car_ID','CarName','fuelsystem','price',...Array.from({length:35},(_,i)=>'numeric'+i)];
const rows=Array.from({length:205},(_,i)=>[
  String(i+1),'car model '+i,'fuel'+(i%8),String(5000+i*22),
  ...Array.from({length:35},(_,j)=>String(i*(j+1)%150))
]);
const fields=headers.map(name=>({
 name,type: ['car_ID','price',...headers.slice(4)].includes(name)?'numeric':'category',
 use:name!=='price'&&!advisor.idColumn(name)&&name!=='CarName'
}));
const original=advisor.evaluate(headers,rows,fields,'price');
assert(original.currentEncoded>40);
assert(original.reasons.some(n=>n.name==='car_ID'));
assert(original.reasons.some(n=>n.name==='CarName'));
assert(original.reasons.some(n=>n.name==='fuelsystem'));
assert(original.recommendedEncoded<=40);
assert(original.recommendedRaw<=39);
assert(original.toExclude.length>0);
const removals=new Set(original.toExclude);
const recommended=fields.map(f=>({...f,use:f.use&&!removals.has(f.name)}));
const after=advisor.evaluate(headers,rows,recommended,'price');
assert(after.currentEncoded<=40);
assert.equal(after.toExclude.length,0);
assert(after.ready);
const startup=fs.readFileSync(path.join(__dirname,'../docs/sample-startups.csv'),'utf8').trim().split(/\r?\n/);
const h=startup.shift().split(','),data=startup.map(line=>line.split(','));
const fspec=h.map(name=>({name,type:name==='State'?'category':'numeric',use:name!=='Profit'}));
const startupPlan=advisor.evaluate(h,data,fspec,'Profit');
assert.equal(startupPlan.currentEncoded,5);
assert.equal(startupPlan.toExclude.length,0);
console.log('Custom advisor: 120 columns, One-Hot budget, CarPrice-style heuristics, and startup regression checks passed.');
