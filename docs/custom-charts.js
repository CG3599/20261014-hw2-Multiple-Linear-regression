'use strict';
/* SVG charts for the custom dataset experiment: no third-party chart dependencies. */
window.FeatureLabCharts = (() => {
  const W = 680, H = 315;
  const f = (value, digits = 0) => {
    if (!Number.isFinite(value)) return 'N/A';
    const a = Math.abs(value);
    if (a > 0 && a < .001) return value.toExponential(1);
    return value.toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const xml = value => String(value).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  const number = value => Number.isFinite(value) ? value.toFixed(2) : '0';
  const svg = (label, contents) =>
    '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" class="custom-svg" role="img" aria-label="'+xml(label)+'">'+contents+'</svg>';
  const text = (x,y,s,cl='axis',anchor='middle') =>
    '<text x="'+number(x)+'" y="'+number(y)+'" text-anchor="'+anchor+'" class="'+cl+'">'+xml(s)+'</text>';
  const line = (x1,y1,x2,y2,cl='grid') =>
    '<line x1="'+number(x1)+'" y1="'+number(y1)+'" x2="'+number(x2)+'" y2="'+number(y2)+'" class="'+cl+'"/>';
  function ticks(min,max,steps=4) {
    let out=[];
    for (let i=0;i<=steps;i++) out.push(min+(max-min)*i/steps);
    return out;
  }
  function plotAxes(minY,maxY,left=78,right=20,top=18,bottom=70,formatter=f){
    const chartHeight=H-top-bottom, chartWidth=W-left-right;
    const y = value => top+(maxY-value)/(maxY-minY)*chartHeight;
    const x = value => left+value*chartWidth;
    let content='';
    for (const value of ticks(minY,maxY)) {
      const py=y(value);
      content+=line(left,py,W-right,py);
      content+=text(left-12,py+4,formatter(value),'tick','end');
    }
    content+=line(left,H-bottom,W-right,H-bottom,'axis-line');
    return {content,x,y,width:chartWidth,height:chartHeight,left,right,top,bottom};
  }
  function rmseChart(results) {
    const n=results.length, max=Math.max(1,...results.flatMap(r=>[r.cvRmse,r.testRmse]).filter(Number.isFinite))*1.15;
    const a=plotAxes(0,max), step=a.width/n;
    let content=a.content, width=Math.min(28,step*.29);
    for (let i=0;i<n;i++) {
      const r=results[i], center=a.x((i+.5)/n);
      for (const [j,v,cl,kind] of [[0,r.cvRmse,'cv','Train CV'],[1,r.testRmse,'test','Test']]){
        if (!Number.isFinite(v))continue;
        const x=center+(j===0?-width-2:2),y=a.y(v),height=Math.max(0,H-a.bottom-y);
        content+='<rect x="'+number(x)+'" y="'+number(y)+'" width="'+number(width)+'" height="'+number(height)+'" rx="3" class="bar-'+cl+'"><title>'+xml(r.method+' · '+kind+' RMSE: '+f(v,3))+'</title></rect>';
      }
      content+=text(center,H-a.bottom+22,r.method,'method-label');
    }
    return svg('訓練交叉驗證與測試 RMSE 比較，越低越好',content);
  }
  function r2Chart(results) {
    const values=results.map(r=>r.r2).filter(Number.isFinite);
    if(!values.length)return svg('測試 R²',text(W/2,H/2,'無有效 R²（目標值可能全部相同）'));
    const lower=Math.min(0,...values), upper=Math.max(.1,...values);
    const span=upper-lower||1, min=lower-span*.13,max=upper+span*.13;
    const a=plotAxes(min,max,78,20,18,70,x=>f(x,2)),n=results.length,step=a.width/n;
    let content=a.content+line(a.left,a.y(0),W-a.right,a.y(0),'zero-line');
    for(let i=0;i<n;i++){
      const r=results[i],center=a.x((i+.5)/n);
      if(Number.isFinite(r.r2)){
        const y=a.y(r.r2),base=a.y(0),height=Math.max(2,Math.abs(base-y));
        content+='<rect x="'+number(center-Math.min(30,step*.31))+'" y="'+number(Math.min(y,base))+'" width="'+number(Math.min(60,step*.62))+'" height="'+number(height)+'" rx="3" class="bar-'+(r.r2<0?'negative':'test')+'"><title>'+xml(r.method+' · Test R²: '+f(r.r2,4))+'</title></rect>';
      }
      content+=text(center,H-a.bottom+22,r.method,'method-label');
    }
    return svg('測試集 R² 比較，越高越好；可為負數',content);
  }
  function scatter(model, mode='prediction') {
    const observed=model.testActual||[],predicted=model.testPredicted||[];
    const points=observed.map((actual,i)=>({actual,pred:predicted[i]})).filter(p=>Number.isFinite(p.actual)&&Number.isFinite(p.pred));
    if(!points.length)return svg('模型診斷圖',text(W/2,H/2,'無有效測試預測資料'));
    const subset=points.filter((_,i)=>i%Math.max(1,Math.ceil(points.length/220))===0);
    const left=82,right=24,top=16,bottom=61;
    const axisLeft=left,plotWidth=W-left-right,plotHeight=H-top-bottom;
    let xMin,xMax,yMin,yMax;
    if(mode==='prediction'){
      xMin=Math.min(...points.map(p=>p.actual),...points.map(p=>p.pred));
      xMax=Math.max(...points.map(p=>p.actual),...points.map(p=>p.pred));
      const pad=Math.max((xMax-xMin)*.08,Math.abs(xMax)*.005,1e-5);
      xMin-=pad;xMax+=pad;yMin=xMin;yMax=xMax;
    }else{
      xMin=Math.min(...points.map(p=>p.pred));xMax=Math.max(...points.map(p=>p.pred));
      const residual=points.map(p=>p.actual-p.pred),abs=Math.max(1e-8,...residual.map(Math.abs));
      yMin=-abs*1.18;yMax=abs*1.18;
      const pad=Math.max((xMax-xMin)*.08,Math.abs(xMax)*.005,1e-5);
      xMin-=pad;xMax+=pad;
    }
    const x=v=>axisLeft+(v-xMin)/(xMax-xMin)*plotWidth;
    const y=v=>top+(yMax-v)/(yMax-yMin)*plotHeight;
    let content='';
    for(const tick of ticks(yMin,yMax)){const py=y(tick);content+=line(left,py,W-right,py)+text(left-12,py+4,f(tick,2),'tick','end');}
    for(const tick of ticks(xMin,xMax)){const px=x(tick);content+=line(px,top,px,H-bottom)+text(px,H-bottom+18,f(tick,1),'tick');}
    if(mode==='prediction'){
      content+=line(x(xMin),y(xMin),x(xMax),y(xMax),'ideal-line');
    }else{
      content+=line(left,y(0),W-right,y(0),'ideal-line');
    }
    for(const p of subset) {
      const xv=mode==='prediction'?p.actual:p.pred,yv=mode==='prediction'?p.pred:p.actual-p.pred;
      content+='<circle cx="'+number(x(xv))+'" cy="'+number(y(yv))+'" r="4.2" class="diagnostic-point"><title>'+xml('Actual: '+f(p.actual,3)+' · Predicted: '+f(p.pred,3)+' · Residual: '+f(p.actual-p.pred,3))+'</title></circle>';
    }
    const xLabel=mode==='prediction'?'Actual（實際值）':'Predicted（預測值）';
    content+=text(W/2,H-8,xLabel,'axis-title');
    content+='<text transform="translate(20 '+number(H/2)+') rotate(-90)" text-anchor="middle" class="axis-title">'+xml(mode==='prediction'?'Predicted（預測值）':'Residual（實際 − 預測）')+'</text>';
    return svg(mode==='prediction'?'實際值與預測值散佈圖，虛線是完美預測':'殘差與預測值散佈圖，虛線是零殘差',content);
  }
  function renderScores(results){
    document.getElementById('rmse-compare-chart').innerHTML=rmseChart(results);
    document.getElementById('r2-compare-chart').innerHTML=r2Chart(results);
  }
  function renderDiagnostics(model){
    document.getElementById('prediction-scatter-chart').innerHTML=scatter(model,'prediction');
    document.getElementById('residual-scatter-chart').innerHTML=scatter(model,'residual');
    const count=(model.testActual||[]).length;
    document.getElementById('chart-model-hint').textContent=model.method+' · '+count+' 筆測試資料 · 最多顯示 220 個散佈點（均勻取樣；所有測試點均參與指標計算）。';
  }
  return {renderScores,renderDiagnostics,rmseChart,r2Chart,scatter};
})();
