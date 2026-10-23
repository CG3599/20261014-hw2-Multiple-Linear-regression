'use strict';
// node tests/custom-model.test.cjs — regression and screenshot-style chart verification
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
global.window=global;
require('../docs/custom-model.js');
require('../docs/custom-curves.js');
const model=global.FeatureLabModel,curves=global.FeatureLabCurves;
function numericTest(){
  const headers=['x1','x2','target'];
  const rows=Array.from({length:45},(_,i)=>[String(i),String((i%6)-2),String(500+23*i-9*((i%6)-2))]);
  const fields=headers.map(name=>({name,type:'numeric',use:name!=='target'}));
  const cfg={headers,rows,fields,target:'target',split:.8,seed:42,k:2,methods:curves.methods};
  const a=model.analyze(cfg),b=model.analyze(cfg);
  assert.deepEqual(a,b);
  assert.equal(a.maxK,2);
  assert.equal(a.curves.length,10);
  assert.equal(a.results.length,6);
  assert(a.baseline.r2>.99999);
  for(const method of curves.methods){
    const row=a.curves.filter(r=>r.method===method);
    assert.deepEqual(row.map(r=>r.count),[1,2]);
    assert.equal((curves.chartSvg(a.curves,'testRmse',method,2,false,2).match(/class="chart-point"/g)||[]).length,2);
  }
}
function startupTest(){
  const csv=fs.readFileSync(path.join(__dirname,'../docs/sample-startups.csv'),'utf8').trim().split(/\r?\n/);
  const headers=csv.shift().split(','),rows=csv.map(row=>row.split(','));
  const fields=headers.map(name=>({name,use:name!=='Profit',type:name==='State'?'category':'numeric'}));
  const out=model.analyze({headers,rows,fields,target:'Profit',seed:42,split:.8,k:2,methods:curves.methods});
  assert.equal(out.data.valid,50);assert.equal(out.data.train,40);assert.equal(out.data.test,10);
  assert.equal(out.data.raw,4);assert.equal(out.data.encoded,5);
  assert.equal(out.curves.length,25);assert.equal(out.results.length,6);
  for(const method of curves.methods){
    const values=out.curves.filter(r=>r.method===method);
    assert.deepEqual(values.map(row=>row.count),[1,2,3,4,5]);
    for(const metric of ['testRmse','r2']){
      const chart=curves.chartSvg(out.curves,metric,method,2,false,5,true);
      assert(chart.startsWith('<svg'));assert.equal((chart.match(/class="chart-point"/g)||[]).length,5);
      assert(chart.includes('data-k="2"'));
    }
  }
  for(const metric of ['testRmse','r2']){
    const overlay=curves.chartSvg(out.curves,metric,'Backward',2,true,5,true);
    assert.equal((overlay.match(/class="chart-point"/g)||[]).length,25);
    assert(overlay.includes('stroke-dasharray'));
  }
  const invalid=curves.chartSvg([{method:'EFS',count:1,r2:null}],'r2','EFS',1,false,1);
  assert(invalid.includes('沒有可用資料'));
  const negative=curves.chartSvg([{method:'EFS',count:1,r2:-1,features:['X']}],'r2','EFS',1,false,1);
  assert(negative.includes('<svg'));
  assert(out.curves.every(r=>Number.isFinite(r.testRmse)&&r.testActual.length===10&&r.testPredicted.length===10));
  const html=fs.readFileSync(path.join(__dirname,'../docs/custom.html'),'utf8');
  for(const id of ['method-tabs','feature-count','compare','rmse-chart','r2-chart','result-rows','crisp-timeline','export-results'])
    assert(html.includes('id="'+id+'"'),id+' missing');
  assert(!html.includes('prediction-scatter-chart'));
  assert(!html.includes('five-curve-grid'));
  assert.equal((html.match(/class="chart-card"/g)||[]).length,2);
}
numericTest();startupTest();
console.log('Custom Dataset model and two comparison curves: tests passed.');
