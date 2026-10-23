'use strict';
/* One RMSE chart + one R² chart; tabs, slider, and optional five-line overlay.
   Both metrics represent the same held-out test set as the original 50 Startups page. */
window.FeatureLabCurves=(()=>{
  const methods=['EFS','RFECV','LassoCV','Backward','SFS'];
  const colors={EFS:'#087f78',RFECV:'#d58635',LassoCV:'#6c62ae',Backward:'#3589b0',SFS:'#b45877'};
  const darkColors={EFS:'#68d8bd',RFECV:'#f0b56b',LassoCV:'#b6a5ff',Backward:'#79c7ef',SFS:'#f1a0bd'};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  function color(name,dark){return (dark?darkColors:colors)[name]||colors.EFS;}
  function format(v,metric){return Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:metric==='r2'?3:0,maximumFractionDigits:metric==='r2'?3:0}):'N/A';}
  function chartSvg(rows,metric,method,k,compare,maxK,dark=false){
    const selected=compare?methods:[method];
    const valid=rows.filter(r=>selected.includes(r.method)&&Number.isFinite(r[metric]));
    if(!valid.length)return '<div class="custom-note">此指標沒有可用資料（Target 可能全部相同）。</div>';
    const W=540,H=310,L=65,R=18,T=22,B=50;
    const values=valid.map(r=>r[metric]);
    let lo=Math.min(...values),hi=Math.max(...values);
    const pad=(hi-lo||Math.max(Math.abs(hi)*.1,1e-4))*.15;
    lo-=pad;hi+=pad;
    const max=Math.max(1,maxK);
    const x=n=>L+(max===1?.5:(n-1)/(max-1))*(W-L-R);
    const y=v=>T+(hi-v)*(H-T-B)/(hi-lo);
    const f=v=>Number(v).toFixed(2);
    let svg='';
    for(let i=0;i<5;i++){
      const value=lo+(hi-lo)*i/4,yy=y(value);
      svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+f(yy)+'" y2="'+f(yy)+'" class="grid-line"/>';
      svg+='<text x="'+(L-10)+'" y="'+f(yy+4)+'" text-anchor="end" class="chart-label">'+escape(format(value,metric))+'</text>';
    }
    const activeX=x(k);
    svg+='<line x1="'+f(activeX)+'" x2="'+f(activeX)+'" y1="'+T+'" y2="'+(H-B)+'" class="active-feature-line"/>';
    for(let n=1;n<=max;n++)svg+='<text x="'+f(x(n))+'" y="'+(H-B+24)+'" text-anchor="middle" class="chart-label">'+n+'</text>';
    svg+='<text x="'+f((L+W-R)/2)+'" y="'+(H-8)+'" text-anchor="middle" class="chart-label">Number of Features</text>';
    const ordered=selected.filter(n=>n!==method).concat(method);
    for(const name of ordered){
      const series=rows.filter(r=>r.method===name&&Number.isFinite(r[metric])).sort((a,b)=>a.count-b.count);
      const stroke=escape(color(name,dark)),active=name===method;
      if(series.length>1){
        const points=series.map(r=>f(x(r.count))+','+f(y(r[metric]))).join(' ');
        svg+='<polyline points="'+points+'" fill="none" stroke="'+stroke+'" stroke-width="'+(active?2.8:1.8)+'" stroke-opacity="'+(active?1:.70)+'" stroke-dasharray="'+(!active&&compare?'6 4':'none')+'"/>';
      }
      for(const row of series){
        svg+='<circle cx="'+f(x(row.count))+'" cy="'+f(y(row[metric]))+'" r="'+(active&&row.count===k?6:4)+'" fill="'+stroke+'" stroke="var(--chart-point-outline,white)" stroke-width="1.5" class="chart-point" data-method="'+escape(name)+'" data-k="'+row.count+'" tabindex="0" role="button" aria-label="'+escape(name+' · '+row.count+' features · '+metric+' '+format(row[metric],metric))+'">';
        svg+='<title>'+escape(name+' · '+row.count+' Features · '+metric+': '+row[metric].toFixed(4)+' · '+row.features.join(', '))+'</title></circle>';
      }
    }
    const title=metric==='testRmse'?'Test RMSE':'Test R-squared';
    return '<svg viewBox="0 0 '+W+' '+H+'" role="img" class="custom-method-svg" aria-label="'+escape(title+' by Number of Features')+'"><title>'+escape(title)+'</title>'+svg+'</svg>';
  }
  function render(rows,method,k,compare,maxK){
    const dark=typeof document!=='undefined'&&document.documentElement.dataset.theme==='dark';
    const rmse=document.getElementById('rmse-chart'),r2=document.getElementById('r2-chart');
    rmse.innerHTML=chartSvg(rows,'testRmse',method,k,compare,maxK,dark);
    r2.innerHTML=chartSvg(rows,'r2',method,k,compare,maxK,dark);
  }
  return {render,chartSvg,methods,colors,darkColors,color};
})();