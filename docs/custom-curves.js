'use strict';
/* Five feature-count SVG charts: no extra libraries and no target leakage in selection. */
window.FeatureLabCurves = (() => {
  const methods=['EFS','RFECV','LassoCV','Backward','SFS'];
  const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  function format(v,metric){
    return Number.isFinite(v)?(metric==='r2'?v.toFixed(3):v.toLocaleString('en-US',{maximumFractionDigits:1})):'N/A';
  }
  function curveSvg(rows,metric,selectedK,method){
    const W=560,H=245,L=68,R=25,T=25,B=55;
    const valid=rows.filter(r=>Number.isFinite(r[metric])).sort((a,b)=>a.count-b.count);
    if(!valid.length)return '<p class="custom-note">沒有有效指標（Target 可能全部相同）。</p>';
    const values=valid.map(r=>r[metric]);
    let lo=Math.min(...values),hi=Math.max(...values);
    if(Math.abs(hi-lo)<1e-10){let d=Math.max(.08,Math.abs(hi)*.12);lo-=d;hi+=d;}
    else{let d=(hi-lo)*.16;lo-=d;hi+=d;}
    if(metric!=='r2'&&lo<0)lo=0;
    const maxK=Math.max(1,...valid.map(r=>r.count));
    const x=k=>L+(maxK===1?.5:(k-1)/(maxK-1))*(W-L-R);
    const y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
    const n=v=>v.toFixed(2);
    let s='';
    for(let i=0;i<=4;i++){
      const v=lo+(hi-lo)*i/4,yy=y(v);
      s+='<line x1="'+n(L)+'" x2="'+n(W-R)+'" y1="'+n(yy)+'" y2="'+n(yy)+'" class="grid"></line>';
      s+='<text x="'+n(L-9)+'" y="'+n(yy+4)+'" text-anchor="end" class="tick">'+xml(format(v,metric))+'</text>';
    }
    if(metric==='r2'&&lo<0&&hi>0)s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+n(y(0))+'" y2="'+n(y(0))+'" class="zero-line"></line>';
    const d=valid.map((r,i)=>(i?'L':'M')+n(x(r.count))+' '+n(y(r[metric]))).join(' ');
    s+='<path d="'+d+'" class="feature-curve-line"></path>';
    for(const r of valid){
      const active=r.count===selectedK;
      s+='<text x="'+n(x(r.count))+'" y="'+n(H-B+24)+'" text-anchor="middle" class="tick">'+r.count+'</text>';
      s+='<circle cx="'+n(x(r.count))+'" cy="'+n(y(r[metric]))+'" r="'+(active?8:6)+'" class="feature-curve-point'+(active?' is-active':'')+'" data-k="'+r.count+'" data-method="'+xml(method)+'" role="button" tabindex="0" aria-label="'+xml(method+' '+r.count+' 個特徵 '+format(r[metric],metric))+'"><title>'+xml(method+' / k='+r.count+' / '+format(r[metric],metric))+'</title></circle>';
    }
    s+='<text x="'+n(W/2)+'" y="'+n(H-5)+'" text-anchor="middle" class="axis-title">Number of Features (k)</text>';
    return '<svg viewBox="0 0 '+W+' '+H+'" class="custom-svg feature-curve-svg" role="group" aria-label="'+xml(method+' 在 1–'+maxK+' 個特徵的 '+metric+' 曲線')+'">'+s+'</svg>';
  }
  function render(rows,selectedK,metric='cvRmse',selectedMethod='EFS'){
    for(const method of methods){
      const card=document.querySelector('.five-curve-card[data-method="'+method+'"]');
      if(!card)continue;
      const values=rows.filter(row=>row.method===method);
      const selected=values.find(row=>row.count===selectedK);
      card.classList.toggle('is-selected',method===selectedMethod);
      card.querySelector('.five-curve-plot').innerHTML=curveSvg(values,metric,selectedK,method);
      card.querySelector('.five-curve-summary').textContent=selected
       ?'k = '+selected.count+' · Train CV RMSE '+format(selected.cvRmse,'cvRmse')+' · Test R² '+format(selected.r2,'r2')+' · '+selected.features.join(' · ')
       :'此 Dataset 尚無該特徵數的輸出。';
    }
  }
  return {render,curveSvg,methods};
})();
