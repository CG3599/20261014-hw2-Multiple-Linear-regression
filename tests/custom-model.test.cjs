'use strict';
// Run from repository root: node tests/custom-model.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = global;
require('../docs/custom-model.js');
const model = global.FeatureLabModel;
function numericTest() {
  const headers=['x1','x2','target'];
  const rows=Array.from({length:45},(_,i)=>[String(i),String((i%6)-2),String(500+23*i-9*((i%6)-2))]);
  const fields=headers.map(name=>({name,type:'numeric',use:name!=='target'}));
  const config={headers,rows,fields,target:'target',split:.8,seed:42,k:2,methods:['EFS','RFECV','Lasso','Backward','SFS']};
  const a=model.analyze(config),b=model.analyze(config);
  assert.equal(a.results.length,6);
  assert.equal(a.data.encoded,2);
  assert(a.results.every(r=>Number.isFinite(r.testRmse)));
  assert(a.results[0].r2>.99999);
  assert.deepEqual(a,b);
}
function startupTest() {
  const text=fs.readFileSync(path.join(__dirname,'../docs/sample-startups.csv'),'utf8').trim();
  const lines=text.split(/\r?\n/);
  const headers=lines.shift().split(',');
  const rows=lines.map(line=>line.split(','));
  const fields=headers.map(name=>({name,use:name!=='Profit',type:name==='State'?'category':'numeric'}));
  const out=model.analyze({headers,rows,fields,target:'Profit',split:.8,seed:42,k:3,methods:['EFS','RFECV','Lasso','Backward','SFS']});
  assert.equal(out.data.valid,50);
  assert.equal(out.data.train,40);
  assert.equal(out.data.test,10);
  assert.equal(out.data.raw,4);
  assert.equal(out.data.encoded,5);
  assert.equal(out.results.length,6);
  for (const r of out.results) {
    assert(Number.isFinite(r.cvRmse));
    assert(Number.isFinite(r.testRmse));
    assert(r.features.length===r.count);
  }
}
numericTest();startupTest();
console.log('Custom Dataset regression tests passed.');
