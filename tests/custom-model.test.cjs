'use strict';
// Run from repository root: node tests/custom-model.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = global;
require('../docs/custom-model.js');
const model = global.FeatureLabModel;
require('../docs/custom-charts.js');
const charts = global.FeatureLabCharts;
require('../docs/custom-curves.js');
const curves = global.FeatureLabCurves;
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
  assert.equal(out.curves.length,25);
  assert.equal(out.maxK,5);
  assert.equal(out.selectedK,3);
  for(const method of curves.methods){
    const methodRows=out.curves.filter(row=>row.method===method);
    assert.deepEqual(methodRows.map(row=>row.count),[1,2,3,4,5]);
    for(const row of methodRows){
      assert(Number.isFinite(row.cvRmse));
      assert.equal(row.features.length,row.count);
      assert.equal(row.testActual.length,10);
      assert.equal(row.testPredicted.length,10);
    }
    for(const metric of ['cvRmse','testRmse','r2']){
      const svg=curves.curveSvg(methodRows,metric,3,method);
      assert(svg.startsWith('<svg'));
      assert.equal((svg.match(/class="feature-curve-point/g)||[]).length,5);
      assert(svg.includes('data-k="3"'));
    }
  }
  assert(curves.curveSvg([{method:'EFS',count:1,r2:null}],'r2',1,'EFS').includes('沒有有效指標'));
  for (const r of out.results) {
    assert.equal(r.testActual.length,10);
    assert.equal(r.testPredicted.length,10);
    assert(r.testPredicted.every(Number.isFinite));
  }
  const rmseSvg=charts.rmseChart(out.results);
  const r2Svg=charts.r2Chart(out.results);
  const actualSvg=charts.scatter(out.results[0],'prediction');
  const residualSvg=charts.scatter(out.results[0],'residual');
  for (const picture of [rmseSvg,r2Svg,actualSvg,residualSvg]) {
    assert(picture.startsWith('<svg'));
    assert(picture.includes('</svg>'));
  }
  assert.equal((actualSvg.match(/<circle /g)||[]).length,10);
  assert.equal((residualSvg.match(/<circle /g)||[]).length,10);
  assert(charts.r2Chart([{method:'A',r2:-1},{method:'B',r2:0.6}]).includes('bar-negative'));
  assert(charts.r2Chart([{method:'A',r2:null}]).includes('無有效 R²'));
  for (const r of out.results) {
    assert(Number.isFinite(r.cvRmse));
    assert(Number.isFinite(r.testRmse));
    assert(r.features.length===r.count);
  }
}
numericTest();startupTest();
console.log('Custom Dataset regression tests passed.');
