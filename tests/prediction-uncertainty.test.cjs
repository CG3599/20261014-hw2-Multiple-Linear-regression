'use strict';
/* Run from repository root: node tests/prediction-uncertainty.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
global.window=global;
require('../docs/prediction-uncertainty.js');
require('../docs/custom-model.js');
const base=path.join(__dirname,'../docs');
const read=file=>fs.readFileSync(path.join(base,file),'utf8');
const fromScript=(file,name)=>vm.runInNewContext(read(file)+'\n'+name);
const pred=window.FeatureLabPrediction;
const cars=fromScript('cars-data.js','CARS_EXPERIMENT');
const startups=fromScript('startups-prediction-data.js','STARTUPS_PREDICTION');
const c=pred.cars(cars),cs=pred.assess(c.points);
assert.equal(cars.predictions.length,287);
assert.equal(c.calibration,143);
assert.equal(c.evaluation,144);
assert.equal(cs.total,144);
assert(c.q>0);
assert.equal(Math.ceil((c.calibration+1)*.95),137);
assert.equal(cs.covered,138);
assert(Math.abs(cs.rate-.9583333333333334)<1e-12);
assert.equal(startups.method,'Backward');
assert.equal(startups.trainCount,40);
assert.equal(startups.df,38);
assert.equal(startups.points.length,10);
const startupStats=pred.assess(startups.points);
assert.equal(startupStats.total,10);
assert(startups.points.every(p=>p.lower<p.predicted&&p.predicted<p.upper));
const startupRmse=Math.sqrt(startups.points.reduce((v,p)=>v+(p.actual-p.predicted)**2,0)/startups.points.length);
assert(Math.abs(startupRmse-7714.334890830185)<1e-6);
// 95% PI must include independent observation error, not merely mean CI.
assert(new Set(startups.points.map(p=>Math.round(p.upper-p.lower))).size>1);
const csv=read('sample-startups.csv').trim().split(/\r?\n/);
const headers=csv.shift().split(','),rows=csv.map(line=>line.split(','));
const fields=headers.map(name=>({name,type:name==='State'?'category':'numeric',use:name!=='Profit'}));
const output=window.FeatureLabModel.analyze({headers,rows,fields,target:'Profit',split:.8,seed:42,k:2,methods:['EFS','RFECV','LassoCV','Backward','SFS']});
assert.equal(output.curves.length,25);
assert(output.curves.every(row=>row.predictionPoints&&row.predictionPoints.length===10));
assert(output.curves.every(row=>row.predictionPoints.every(point=>[point.actual,point.predicted,point.lower,point.upper].every(Number.isFinite))));
const diagram=pred.svg(startups.points,'USD');
assert(diagram.includes('pred-whisker'));
assert(diagram.includes('pred-actual'));
assert(diagram.includes('pred-reference'));
for(const htmlFile of ['index.html','startups.html','custom.html']){
  const html=read(htmlFile);
  for(const id of ['prediction-uncertainty','prediction-plot','prediction-model','prediction-stat','prediction-explanation']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,htmlFile+' missing/duplicated '+id);
  }
  assert(html.indexOf('id="prediction-uncertainty"')>html.indexOf('class="method-comparison-table"'));
  assert(html.indexOf('id="prediction-uncertainty"')<html.indexOf('id="methodology"'));
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
  const common=scripts.findIndex(name=>name.startsWith('prediction-uncertainty.js'));
  const main=scripts.findIndex(name=>/^(cars|app|custom)\.js/.test(name));
  assert(common>=0&&common<main,'prediction module must load first in '+htmlFile);
}
assert(read('index.html').includes('143 筆校準'));
assert(read('startups.html').includes('Student-t'));
assert(read('custom.html').includes('t 值近似'));
console.log('All three prediction interval charts, dataset sources and boundaries passed.');
