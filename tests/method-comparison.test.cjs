'use strict';
// node tests/method-comparison.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
global.window=global;
require('../docs/method-comparison.js');
require('../docs/custom-model.js');
const adapter=global.FeatureLabMethodComparison;
const ROOT=path.join(__dirname,'../docs');
function data(name,variable){
  return vm.runInNewContext(fs.readFileSync(path.join(ROOT,name),'utf8')+'\n'+variable);
}
const carRows=adapter.fromCars(data('cars-data.js','CARS_EXPERIMENT'));
const startupData=data('data.js','EXPERIMENT');
const startupRows=adapter.fromStartups(startupData);
const csv=fs.readFileSync(path.join(ROOT,'sample-startups.csv'),'utf8').trim().split(/\r?\n/);
const headers=csv.shift().split(','),rows=csv.map(line=>line.split(','));
const fields=headers.map(name=>({name,type:name==='State'?'category':'numeric',use:name!=='Profit'}));
const custom=global.FeatureLabModel.analyze({headers,rows,fields,target:'Profit',split:.8,seed:42,k:2,methods:adapter.methods.slice(1)});
const customRows=adapter.fromCustom(custom);
assert.equal(carRows.length,6);
assert.equal(startupRows.length,6);
assert.equal(customRows.length,6);
assert.deepEqual(carRows.filter(row=>row.testRmse!==null).map(row=>row.method),['Baseline']);
assert(carRows.every(row=>row.features.length===row.count));
assert(startupRows.every(row=>row.features.length===row.count));
assert(customRows.every(row=>row.features.length===row.count));
assert(startupRows.every(row=>Number.isFinite(row.cvRmse)&&Number.isFinite(row.testRmse)&&Number.isFinite(row.testR2)));
const profitBaseline=startupRows.find(row=>row.method==='Baseline');
assert.equal(profitBaseline.features.length,5);
for(const row of customRows.filter(row=>row.method!=='Baseline')){
  const candidates=custom.curves.filter(c=>c.method===row.method);
  assert.equal(row.cvRmse,Math.min(...candidates.map(c=>c.cvRmse)),'Custom method choice must use training CV');
}
class FakeElement{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.events={};this.className='';this.classList={add:()=>{}};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  addEventListener(type,fn){this.events[type]=fn;}
  setAttribute(key,val){this.attrs[key]=val;}
}
global.document={createElement:tag=>new FakeElement(tag)};
for(const rows of [carRows,startupRows,customRows]){
  const tbody=new FakeElement('tbody');
  adapter.render(tbody,rows,{selected:'Backward',allowBaseline:true,onSelect:()=>{}});
  assert.equal(tbody.children.length,6);
  for(const tr of tbody.children)assert.equal(tr.children.length,6);
  assert.equal(tbody.children[0].children[2].tag,'td');
}
const expectedHeaders=['Method','特徵數','Selected Features','CV RMSE ↓','Test RMSE ↓','Test R² ↑'];
for(const page of ['index.html','startups.html','custom.html']){
  const html=fs.readFileSync(path.join(ROOT,page),'utf8');
  const mark='<table class="method-comparison-table">';
  const start=html.indexOf(mark);
  assert(start>=0,page+' missing shared comparison table');
  const table=html.slice(start,html.indexOf('</table>',start));
  const actual=[...table.matchAll(/<th>([^<]+)<\/th>/g)].map(match=>match[1]);
  assert.deepEqual(actual,expectedHeaders,page+' has inconsistent comparison columns');
  assert(html.indexOf('id="feature-curves"')<start,page+' chart must precede comparison');
  assert(start<html.indexOf('id="methodology"'),page+' CRISP-DM must follow comparison');
}
assert.equal((fs.readFileSync(path.join(ROOT,'startups.html'),'utf8').match(/id="auto-results"/g)||[]).length,1);
console.log('All three unified six-method tables passed structural and data tests.');
