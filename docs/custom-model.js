'use strict';
/* Standalone, capped browser-side linear regression. Never sends data to a server. */
window.FeatureLabModel = (() => {
  const mean = a => a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
  const rmse = (y,p) => Math.sqrt(mean(y.map((v,i)=>(v-p[i])**2)));
  function r2(y,p) {const m=mean(y),den=y.reduce((s,v)=>s+(v-m)**2,0);return den>1e-12?1-y.reduce((s,v,i)=>s+(v-p[i])**2,0)/den:null;}
  function random(seed){let s=(seed>>>0)||42;return ()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
  function shuffle(n,seed){const a=Array.from({length:n},(_,i)=>i),rng=random(seed);for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function solve(A,b){const n=b.length;A=A.map(row=>row.slice());b=b.slice();for(let i=0;i<n;i++){let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;if(Math.abs(A[pivot][i])<1e-10)A[pivot][i]+=1e-6;[A[i],A[pivot]]=[A[pivot],A[i]];[b[i],b[pivot]]=[b[pivot],b[i]];let t=A[i][i]||1e-8;for(let j=i;j<n;j++)A[i][j]/=t;b[i]/=t;for(let h=i+1;h<n;h++){const factor=A[h][i];if(!factor)continue;for(let j=i;j<n;j++)A[h][j]-=factor*A[i][j];b[h]-=factor*b[i];}}const out=Array(n).fill(0);for(let i=n-1;i>=0;i--){out[i]=b[i];for(let j=i+1;j<n;j++)out[i]-=A[i][j]*out[j];}return out;}
  function fit(X,y,selected){const p=selected.length+1,A=Array.from({length:p},()=>Array(p).fill(0)),b=Array(p).fill(0);for(let i=0;i<X.length;i++){const v=[1,...selected.map(j=>X[i][j])];for(let j=0;j<p;j++){b[j]+=v[j]*y[i];for(let k=0;k<=j;k++)A[j][k]+=v[j]*v[k];}}for(let j=0;j<p;j++){for(let k=0;k<j;k++)A[k][j]=A[j][k];if(j)A[j][j]+=1e-6;}return solve(A,b);}
  function predict(X,b,features){return X.map(row=>b[0]+features.reduce((s,j,i)=>s+b[i+1]*row[j],0));}
  function sub(a,ids){return ids.map(i=>a[i]);}
  function cv(X,y,features,seed){const idx=shuffle(X.length,seed),folds=3;let err=0;for(let f=0;f<folds;f++){const test=idx.filter((_,i)=>i%folds===f),train=idx.filter((_,i)=>i%folds!==f),xt=sub(X,train),yt=sub(y,train),xp=sub(X,test),yp=sub(y,test);const coef=fit(xt,yt,features);err+=rmse(yp,predict(xp,coef,features));}return err/folds;}
  function relevance(X,y){const m=mean(y);return Array.from({length:X[0].length},(_,j)=>({id:j,score:Math.abs(X.reduce((s,row,i)=>s+row[j]*(y[i]-m),0))})).sort((a,b)=>b.score-a.score).map(o=>o.id);}
  function combinations(pool,k,visit){const a=[];function walk(pos){if(a.length===k){visit(a.slice());return;}for(let i=pos;i<=pool.length-(k-a.length);i++){a.push(pool[i]);walk(i+1);a.pop();}}walk(0);}
  function efs(X,y,k,rank,seed){const pool=rank.slice(0,8),kk=Math.min(k,pool.length);let best=[],err=Infinity;combinations(pool,kk,c=>{const v=cv(X,y,c,seed);if(v<err){err=v;best=c;}});return best;}
  function sfs(X,y,k,rank,seed){let selected=[];const pool=rank.slice(0,12);while(selected.length<Math.min(k,pool.length)){let best=null,err=Infinity;for(const j of pool){if(selected.includes(j))continue;const v=cv(X,y,[...selected,j],seed);if(v<err){err=v;best=j;}}selected.push(best);}return selected;}
  function rfePath(X,y,rank,k,seed){let pool=rank.slice(0,Math.min(15,rank.length)),snapshots=[];while(pool.length){if(pool.length<=k)snapshots.push(pool.slice());if(pool.length===1)break;const coeff=fit(X,y,pool);let worst=0;for(let i=1;i<pool.length;i++)if(Math.abs(coeff[i+1])<Math.abs(coeff[worst+1]))worst=i;pool.splice(worst,1);}let best=snapshots[0],err=Infinity;for(const selected of snapshots){const v=cv(X,y,selected,seed);if(v<err){err=v;best=selected;}}return best;}
  // Fixed-feature-count diagnostic path corresponding to RFECV's underlying RFE.
  // The original RFECV automatic feature count is a different experiment.
  function rfeFixed(X,y,rank,k){
    const pool=rank.slice(0,Math.min(15,rank.length));
    while(pool.length>k){
      const coeff=fit(X,y,pool);
      let worst=0;
      for(let i=1;i<pool.length;i++) if(Math.abs(coeff[i+1])<Math.abs(coeff[worst+1])) worst=i;
      pool.splice(worst,1);
    }
    return pool;
  }
  function backward(X,y,k,rank){let pool=rank.slice(0,Math.min(18,rank.length));while(pool.length>k){const coef=fit(X,y,pool);let worst=0;for(let i=1;i<pool.length;i++)if(Math.abs(coef[i+1])<Math.abs(coef[worst+1]))worst=i;pool.splice(worst,1);}return pool;}
  function lassoCoefficients(X,y,alpha){const n=X.length,p=X[0].length,center=mean(y),yy=y.map(v=>v-center),b=Array(p).fill(0),res=yy.slice(),norm=Array.from({length:p},(_,j)=>X.reduce((s,row)=>s+row[j]*row[j],0)/n||1);
    for(let iter=0;iter<170;iter++){let largest=0;for(let j=0;j<p;j++){let rho=0;for(let i=0;i<n;i++)rho+=X[i][j]*(res[i]+X[i][j]*b[j]);rho/=n;const mag=Math.max(0,Math.abs(rho)-alpha),next=(Math.sign(rho)*mag)/norm[j],delta=next-b[j];if(delta){for(let i=0;i<n;i++)res[i]-=X[i][j]*delta;}b[j]=next;largest=Math.max(largest,Math.abs(delta));}if(largest<1e-5)break;}return b;}
  function lasso(X,y,k,seed){const alphaBase=Math.sqrt(mean(y.map(v=>(v-mean(y))**2)))||1,alphas=[.001,.01,.05,.12].map(v=>v*alphaBase);let best=null,score=Infinity;for(const alpha of alphas){const coef=lassoCoefficients(X,y,alpha),indices=coef.map((v,j)=>({j,v:Math.abs(v)})).sort((a,b)=>b.v-a.v).slice(0,k).map(o=>o.j),v=cv(X,y,indices,seed);if(v<score){score=v;best=indices;}}return best;}
  const isMissing=v=>v==null||String(v).trim()===''||String(v).trim().toLowerCase()==='na'||String(v).trim().toLowerCase()==='null';
  function prepare(rows,headers,target,fields){const ti=headers.indexOf(target),filtered=rows.map(row=>({row,target:Number(String(row[ti]??'').replace(/,/g,''))})).filter(o=>!isMissing(o.row[ti])&&Number.isFinite(o.target));if(filtered.length<15)throw Error('可用數值 Target 至少需要 15 筆資料。');if(filtered.length>3000)throw Error('為保護瀏覽器，最多可分析 3,000 筆有效資料；請先抽樣。');
    const index=fields.filter(f=>f.use&&f.name!==target).map(f=>({...f,pos:headers.indexOf(f.name)}));if(!index.length)throw Error('請至少選擇一個 Feature。');if(index.length>60)throw Error('最多可選擇 60 個原始輸入特徵，請取消部分欄位。');
    return {filtered,index};}
  function encode(prepared,split,seed){const {filtered,index}=prepared,order=shuffle(filtered.length,seed),trainCount=Math.max(10,Math.min(filtered.length-3,Math.floor(filtered.length*split))),trainRows=order.slice(0,trainCount).map(i=>filtered[i]),testRows=order.slice(trainCount).map(i=>filtered[i]),meta=[],colNames=[];
    for(const field of index){const vals=trainRows.map(o=>String(o.row[field.pos]??'').trim()).filter(v=>!isMissing(v));if(field.type==='numeric'){const nums=vals.map(Number).filter(Number.isFinite),impute=nums.length?mean(nums):0;let std=Math.sqrt(mean(nums.length?nums.map(v=>(v-impute)**2):[0]));if(std<1e-9)std=1;meta.push({pos:field.pos,type:'numeric',impute,std});colNames.push(field.name);}
    else {const counts=new Map();for(const v of vals)counts.set(v,(counts.get(v)||0)+1);const distinct=[...counts].sort((a,b)=>b[1]-a[1]);if(distinct.length>12)throw Error('類別欄位 '+field.name+' 有 '+distinct.length+' 種值（上限 12）；請排除欄位或改用其他特徵。');const most=distinct[0]?.[0]||'(missing)',classes=distinct.map(x=>x[0]).sort();meta.push({pos:field.pos,type:'category',classes,impute:most});for(const c of classes.slice(1))colNames.push(field.name+'='+c);}}
    if(colNames.length<1)throw Error('編碼後沒有可用 Features。');if(colNames.length>80)throw Error('One-Hot 後有 '+colNames.length+' 個特徵，超過 80 個編碼特徵的運算上限。');const maxForTrain=trainCount-10;if(colNames.length>maxForTrain)throw Error('訓練資料 '+trainCount+' 筆，依訓練筆數減 10 的規則，最多可使用 '+Math.max(0,maxForTrain)+' 個編碼後特徵；目前為 '+colNames.length+' 個。請減少 Features 或增加有效資料筆數。');
    function convert(items){return items.map(o=>{let arr=[];for(const m of meta){let value=String(o.row[m.pos]??'').trim();if(isMissing(value))value=String(m.impute);if(m.type==='numeric'){let n=Number(value);if(!Number.isFinite(n))n=m.impute;arr.push((n-m.impute)/m.std);}else {for(const c of m.classes.slice(1))arr.push(Number(value===c));}}return arr;});}
    return {X:convert(trainRows),y:trainRows.map(o=>o.target),Xt:convert(testRows),yt:testRows.map(o=>o.target),names:colNames,trainCount,testCount:testRows.length,valid:filtered.length,overfitRisk:colNames.length>trainCount/3};}

  // Approximate Student-t critical value (Cornish-Fisher expansion).
  function t95(df){
    if(df<1)return NaN;
    const z=1.959963984540054;
    const z2=z*z,z3=z2*z,z5=z3*z2,z7=z5*z2;
    return z+(z3+z)/(4*df)+(5*z5+16*z3+3*z)/(96*df*df)+(3*z7+19*z5+17*z3-15*z)/(384*df*df*df);
  }
  function inverseGram(X,selected){
    const p=selected.length+1,n=X.length;
    const a=Array.from({length:p},()=>Array(p*2).fill(0));
    for(let j=0;j<p;j++)a[j][p+j]=1;
    for(const row of X){
      const v=[1,...selected.map(i=>row[i])];
      for(let i=0;i<p;i++)for(let j=0;j<p;j++)a[i][j]+=v[i]*v[j];
    }
    for(let i=0;i<p;i++){
      let pivot=i;
      for(let j=i+1;j<p;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
      if(Math.abs(a[pivot][i])<1e-8)return null;
      [a[i],a[pivot]]=[a[pivot],a[i]];
      const val=a[i][i];
      for(let k=0;k<2*p;k++)a[i][k]/=val;
      for(let j=0;j<p;j++)if(j!==i){
        const factor=a[j][i];if(!factor)continue;
        for(let k=0;k<2*p;k++)a[j][k]-=factor*a[i][k];
      }
    }
    return a.map(row=>row.slice(p));
  }
  function predictionIntervals(X,y,Xt,yt,selected,beta,preds){
    const df=X.length-selected.length-1;
    if(df<3)return null;
    const inv=inverseGram(X,selected);
    if(!inv)return null;
    const residuals=predict(X,beta,selected).map((p,i)=>y[i]-p);
    const s2=residuals.reduce((total,v)=>total+v*v,0)/df;
    const t=t95(df);
    if(!Number.isFinite(s2)||!Number.isFinite(t))return null;
    const pts=Xt.map((row,i)=>{
      const v=[1,...selected.map(j=>row[j])];
      let leverage=0;
      for(let j=0;j<v.length;j++)for(let k=0;k<v.length;k++)leverage+=v[j]*inv[j][k]*v[k];
      if(leverage<-.00001||!Number.isFinite(leverage))return null;
      const margin=t*Math.sqrt(s2*(1+Math.max(0,leverage)));
      return {actual:yt[i],predicted:preds[i],lower:preds[i]-margin,upper:preds[i]+margin};
    });
    return pts.some(p=>p==null||![p.actual,p.predicted,p.lower,p.upper].every(Number.isFinite))?null:pts;
  }
  function analyze(payload){
    const {rows,headers,target,fields,split,seed,methods,k}=payload;
    const prepared=prepare(rows,headers,target,fields);
    const data=encode(prepared,split,seed);
    const {X,y,Xt,yt,names}=data;
    const rank=relevance(X,y);
    const maxK=Math.min(5,names.length);
    const chosenK=Math.min(Math.max(1,Number(k)||1),maxK);
    const requested=methods||['EFS','RFECV','LassoCV','Backward','SFS'];
    const ordered=['EFS','RFECV','LassoCV','Backward','SFS'].filter(method=>requested.includes(method)||(method==='LassoCV'&&requested.includes('Lasso')));
    const evaluate=(method,selected,count)=>{
      const beta=fit(X,y,selected);
      const prediction=predict(Xt,beta,selected);
      return {
        method,count: selected.length,requestedCount:count,
        features:selected.map(i=>names[i]),
        cvRmse:cv(X,y,selected,seed),
        testRmse:rmse(yt,prediction),r2:r2(yt,prediction),
        testActual:yt.slice(),testPredicted:prediction,
        predictionPoints:method==='Baseline'?null:predictionIntervals(X,y,Xt,yt,selected,beta,prediction)
      };
    };
    const baseline=evaluate('Baseline',names.map((_,i)=>i),names.length);
    // This computes all feature counts on one consistent train/test split, without
    // selecting features using test scores. Curves remain browser JS approximations.
    const curves=[];
    for (const method of ordered){
      for(let count=1;count<=maxK;count++){
        let selected;
        if(method==='EFS')selected=efs(X,y,count,rank,seed);
        else if(method==='RFECV')selected=rfeFixed(X,y,rank,count);
        else if(method==='LassoCV')selected=lasso(X,y,count,seed);
        else if(method==='Backward')selected=backward(X,y,count,rank);
        else if(method==='SFS')selected=sfs(X,y,count,rank,seed);
        curves.push(evaluate(method,selected,count));
      }
    }
    const results=[baseline,...curves.filter(row=>row.requestedCount===chosenK)];
    return {
      results,curves,baseline,maxK,selectedK:chosenK,
      data:{valid:data.valid,train:data.trainCount,test:data.testCount,raw:prepared.index.length,encoded:names.length,overfitRisk:data.overfitRisk,maxEncoded:Math.min(80,data.trainCount-10)}
    };
  }
  return {analyze};
})();