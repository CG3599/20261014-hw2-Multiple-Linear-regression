'use strict';
/* Shared predictive scatterplot: intervals must be calculated independently
 * from model training/calibration, not inferred from held-out test RMSE. */
window.FeatureLabPrediction=(()=>{
  const numeric=(x,d=0)=>Number.isFinite(x)?Number(x).toLocaleString('en-US',{maximumFractionDigits:d}):'—';
  function assess(points){
    const valid=(points||[]).filter(p=>[p.actual,p.predicted,p.lower,p.upper].every(Number.isFinite)&&p.lower<=p.upper);
    const covered=valid.filter(p=>p.actual>=p.lower&&p.actual<=p.upper).length;
    return {valid,covered,total:valid.length,rate:valid.length?covered/valid.length:null};
  }
  function svg(points,unit=''){
    const {valid}=assess(points);
    if(!valid.length)return '<p class="prediction-empty">尚無足夠且有效的預測區間資料。</p>';
    const W=760,H=465,PL=84,PR=27,PT=26,PB=67,plotW=W-PL-PR,plotH=H-PT-PB;
    const xVals=valid.map(p=>p.predicted),yVals=valid.flatMap(p=>[p.actual,p.predicted,p.lower,p.upper]);
    let minX=Math.min(...xVals),maxX=Math.max(...xVals),minY=Math.min(...yVals),maxY=Math.max(...yVals);
    const xPad=(maxX-minX||Math.abs(maxX)||1)*.09,yPad=(maxY-minY||Math.abs(maxY)||1)*.09;
    minX-=xPad;maxX+=xPad;minY-=yPad;maxY+=yPad;
    const x=v=>PL+(v-minX)/(maxX-minX)*plotW;
    const y=v=>PT+(maxY-v)/(maxY-minY)*plotH;
    const svgParts=['<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="實際值對預測值散點圖，每筆含95%預測區間及理想預測線" preserveAspectRatio="xMidYMid meet">',
      '<defs><clipPath id="prediction-clip"><rect x="'+PL+'" y="'+PT+'" width="'+plotW+'" height="'+plotH+'"/></clipPath></defs>'];
    for(let i=0;i<=5;i++){
      const vy=minY+(maxY-minY)*i/5,yy=y(vy);
      svgParts.push('<line class="pred-grid" x1="'+PL+'" y1="'+yy.toFixed(1)+'" x2="'+(W-PR)+'" y2="'+yy.toFixed(1)+'"/>');
      svgParts.push('<text class="pred-tick" x="'+(PL-10)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end">'+numeric(vy)+'</text>');
      const vx=minX+(maxX-minX)*i/5,xx=x(vx);
      svgParts.push('<text class="pred-tick" x="'+xx.toFixed(1)+'" y="'+(H-PB+22)+'" text-anchor="middle">'+numeric(vx)+'</text>');
    }
    svgParts.push('<line class="pred-axis" x1="'+PL+'" y1="'+PT+'" x2="'+PL+'" y2="'+(H-PB)+'"/>',
      '<line class="pred-axis" x1="'+PL+'" y1="'+(H-PB)+'" x2="'+(W-PR)+'" y2="'+(H-PB)+'"/>');
    const lineLo=Math.max(minX,minY),lineHi=Math.min(maxX,maxY);
    svgParts.push('<g clip-path="url(#prediction-clip)">');
    if(lineHi>lineLo)svgParts.push('<line class="pred-reference" x1="'+x(lineLo).toFixed(1)+'" y1="'+y(lineLo).toFixed(1)+'" x2="'+x(lineHi).toFixed(1)+'" y2="'+y(lineHi).toFixed(1)+'"/>');
    // Sample marks for readability, but coverage always uses every test point.
    const whiskerStep=Math.max(1,Math.ceil(valid.length/95)),dotStep=Math.max(1,Math.ceil(valid.length/240));
    for(let i=0;i<valid.length;i+=whiskerStep){
      const p=valid[i],xx=x(p.predicted).toFixed(1),lo=y(p.lower).toFixed(1),hi=y(p.upper).toFixed(1),center=x(p.predicted);
      svgParts.push('<line class="pred-whisker" x1="'+xx+'" y1="'+lo+'" x2="'+xx+'" y2="'+hi+'"/>',
        '<line class="pred-whisker-cap" x1="'+(center-3).toFixed(1)+'" y1="'+lo+'" x2="'+(center+3).toFixed(1)+'" y2="'+lo+'"/>',
        '<line class="pred-whisker-cap" x1="'+(center-3).toFixed(1)+'" y1="'+hi+'" x2="'+(center+3).toFixed(1)+'" y2="'+hi+'"/>');
    }
    for(let i=0;i<valid.length;i+=dotStep){
      const p=valid[i],inside=p.actual>=p.lower&&p.actual<=p.upper;
      svgParts.push('<circle class="'+(inside?'pred-actual':'pred-outside')+'" cx="'+x(p.predicted).toFixed(1)+'" cy="'+y(p.actual).toFixed(1)+'" r="3.7"/>');
    }
    svgParts.push('</g>',
      '<text class="pred-axis-label" x="'+(PL+plotW/2).toFixed(1)+'" y="'+(H-13)+'" text-anchor="middle">預測值 Predicted '+(unit?'('+unit+')':'')+'</text>',
      '<text class="pred-axis-label" x="19" y="'+(PT+plotH/2).toFixed(1)+'" text-anchor="middle" transform="rotate(-90 19 '+(PT+plotH/2).toFixed(1)+')">實際值 Actual '+(unit?'('+unit+')':'')+'</text>',
      '</svg>');
    return svgParts.join('');
  }
  function render(target,points,unit=''){
    const stats=assess(points);
    target.innerHTML=svg(points,unit);
    return stats;
  }
  function cars(source){
    const points=source.predictions.map(row=>({actual:row.actual,predicted:row.predicted}));
    const nCal=Math.floor(points.length/2),calib=points.slice(0,nCal),evalRows=points.slice(nCal);
    const residuals=calib.map(p=>Math.abs(p.actual-p.predicted)).sort((a,b)=>a-b);
    const rank=Math.ceil((nCal+1)*.95);
    if(rank>nCal)return {points:[],calibration:nCal,method:'conformal'};
    const q=residuals[rank-1];
    return {points:evalRows.map(p=>({...p,lower:p.predicted-q,upper:p.predicted+q})),calibration:nCal,evaluation:evalRows.length,q,method:'conformal'};
  }
  return {render,svg,assess,cars,numeric};
})();