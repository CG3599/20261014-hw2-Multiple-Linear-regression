'use strict';
/* Shared six-method comparison used by Cars, 50 Startups, and Custom Dataset.
 * Never replace missing held-out test metrics with CV estimates. */
window.FeatureLabMethodComparison=(()=>{
  const methods=['Baseline','EFS','RFECV','LassoCV','Backward','SFS'];
  const numeric=(v,digits=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';
  const makeTag=name=>{
    const span=document.createElement('span');
    span.className='feature-tag';
    span.textContent=String(name).replace(/^(num|cat)__/, '');
    return span;
  };
  function featureCell(features){
    const td=document.createElement('td');
    td.className='method-features';
    if(!Array.isArray(features)||!features.length){td.textContent='—（未提供）';return td;}
    const shown=features.slice(0,4);
    const excerpt=document.createElement('div');excerpt.className='method-feature-list';
    excerpt.append(...shown.map(makeTag));td.append(excerpt);
    if(features.length>shown.length){
      const details=document.createElement('details');details.className='method-feature-details';
      const summary=document.createElement('summary');summary.textContent='展開其餘 '+(features.length-shown.length)+' 個特徵';
      const rest=document.createElement('div');rest.className='method-feature-list';
      rest.append(...features.slice(shown.length).map(makeTag));details.append(summary,rest);td.append(details);
    }
    return td;
  }
  function render(tbody,rows,{selected=null,onSelect=null,allowBaseline=false}={}){
    tbody.replaceChildren();
    for(const row of rows){
      const tr=document.createElement('tr');tr.dataset.method=row.method;
      if(row.method===selected)tr.classList.add('selected');
      const add=value=>{const td=document.createElement('td');td.textContent=String(value);tr.append(td);};
      add(row.method);
      add(row.count);
      tr.append(featureCell(row.features));
      add(numeric(row.cvRmse));
      add(numeric(row.testRmse));
      add(numeric(row.testR2,4));
      if(row.testRmse==null){tr.children[4].title='該方法未保存獨立測試集的評估結果';tr.children[5].title='該方法未保存獨立測試集的評估結果';}
      if(typeof onSelect==='function'&&(row.method!=='Baseline'||allowBaseline)){
        tr.tabIndex=0;tr.setAttribute('aria-label',row.method+' · '+row.count+' 個特徵');
        tr.classList.add('method-row-action');
        const choose=()=>onSelect(row);
        tr.addEventListener('click',e=>{if(e.target.closest('details'))return;choose();});
        tr.addEventListener('keydown',e=>{if(e.target!==tr)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
      }
      tbody.append(tr);
    }
  }
  function fromCars(experiment){
    return experiment.methods.map(row=>({
      method:row.method==='Lasso'?'LassoCV':row.method,
      count:row.count,features:row.features,
      cvRmse:row.cv_rmse,
      testRmse:row.method===experiment.best_method?experiment.test.rmse:null,
      testR2:row.method===experiment.best_method?experiment.test.r2:null
    }));
  }
  function fromStartups(experiment){
    return experiment.automatic.map(row=>{
      const match=experiment.curves.find(curve=>curve.method===row.method&&curve.count===row.count&&Math.abs(curve.rmse-row.test_rmse)<1e-6);
      const baseline=experiment.curves.find(curve=>curve.count===row.count);
      return {
        method:row.method,count:row.count,
        features:match?.features||((row.method==='Baseline')?baseline?.features:null)||null,
        cvRmse:row.cv_rmse,testRmse:row.test_rmse,testR2:row.test_r2
      };
    });
  }
  function fromCustom(output){
    const result=[{
      method:'Baseline',count:output.baseline.count,features:output.baseline.features,
      cvRmse:output.baseline.cvRmse,testRmse:output.baseline.testRmse,testR2:output.baseline.r2
    }];
    for(const method of methods.slice(1)){
      const candidates=output.curves.filter(row=>row.method===method);
      if(!candidates.length)continue;
      // Training-CV-only choice, never search over held-out Test scores.
      const best=candidates.reduce((winner,row)=>{
        if(!winner)return row;
        const a=Number.isFinite(row.cvRmse)?row.cvRmse:Infinity;
        const b=Number.isFinite(winner.cvRmse)?winner.cvRmse:Infinity;
        return a<b?row:winner;
      },null);
      result.push({
        method,count:best.count,features:best.features,
        cvRmse:best.cvRmse,testRmse:best.testRmse,testR2:best.r2
      });
    }
    return result;
  }
  return {render,fromCars,fromStartups,fromCustom,methods};
})();