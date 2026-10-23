'use strict';
/* Deterministic, explainable setup suggestions. No target-dependent feature
 * ranking or held-out test scoring is used to recommend exclusions. */
window.FeatureLabAdvisor=(()=>{
  const missing=v=>v==null||['','na','null','n/a'].includes(String(v).trim().toLowerCase());
  const idColumn=name=>/^(?:id|index|index_\d+|unnamed:?\s*\d*|serial(?:number)?|row_?id|record_?id|.*[_-]id|.*id|.*identifier|(?:car|employee|customer|patient|order|transaction|record|invoice|product)[_-]?(?:number|no))$/i.test(String(name).replace(/\s+/g,''));
  const emptyStats=()=>({unique:0,missingRate:1,type:'numeric'});
  function stats(headers,rows,fields){
    return fields.map(f=>{
      const index=headers.indexOf(f.name),values=rows.map(row=>row[index]);
      const present=values.filter(v=>!missing(v));
      return {
        name:f.name,type:f.type,use:f.use,
        unique:new Set(present.map(String)).size,
        missingRate:values.length?1-present.length/values.length:1,
        examples:[...new Set(present.map(String))].slice(0,3),
        encodedCost:f.type==='category'?Math.max(0,new Set(present.map(String)).size-1):1,
        idLike:idColumn(f.name)
      };
    });
  }
  function evaluate(headers,rows,fields,target){
    const info=stats(headers,rows,fields);
    const targetIndex=headers.indexOf(target);
    const numericTargets=rows.map(row=>row[targetIndex]).filter(v=>!missing(v)&&Number.isFinite(Number(String(v).replace(/,/g,'')))).length;
    const targetRate=rows.length?numericTargets/rows.length:0;
    const reasons=[],blocked=new Set();
    function suggest(item,description){
      if(blocked.has(item.name))return;
      blocked.add(item.name);
      reasons.push({name:item.name,description,selected:!!item.use});
    }
    for(const c of info){
      if(c.name===target)continue;
      if(c.idLike)suggest(c,'疑似 ID／流水號，不建議作為迴歸輸入');
      else if(c.unique<=1)suggest(c,'只有 '+c.unique+' 種有效值，幾乎沒有可學習的變化');
      else if(c.type==='category'&&c.unique>12)suggest(c,'有 '+c.unique+' 種類別，超過單一類別欄位 12 種上限');
      else if(c.missingRate>=.5)suggest(c,'缺失比例約 '+Math.round(c.missingRate*100)+'%，建議先排除或清理');
    }
    const chosen=info.filter(c=>c.name!==target&&c.use);
    const active=chosen.filter(c=>!blocked.has(c.name));
    let encoded=active.reduce((v,c)=>v+c.encodedCost,0);
    // To stay below One-Hot / matrix size limits, first remove categories that
    // produce the most dummy columns; do not claim these are poor predictors.
    const candidates=[...active].sort((a,b)=>{
      const cost=b.encodedCost-a.encodedCost;
      if(cost)return cost;
      return headers.indexOf(b.name)-headers.indexOf(a.name);
    });
    for(const c of candidates){
      const kept=active.filter(item=>!blocked.has(item.name));
      if(kept.length<=39&&encoded<=40)break;
      blocked.add(c.name);
      encoded-=c.encodedCost;
      reasons.push({
        name:c.name,
        description:'為符合 '+(kept.length>39?'39 個原始特徵':'40 個編碼後特徵')+
          '的分析上限；此欄位預估增加 '+c.encodedCost+' 個編碼特徵',
        selected:true
      });
    }
    const kept=active.filter(c=>!blocked.has(c.name));
    const selectedNames=kept.map(c=>c.name);
    const beforeEncoded=chosen.reduce((v,c)=>v+c.encodedCost,0);
    const warnings=[];
    if(numericTargets<15)warnings.push('Target「'+target+'」只有 '+numericTargets+' 筆有效數值，至少需要 15 筆。');
    if(numericTargets>3000)warnings.push('Target 有 '+numericTargets+' 筆有效數值，超過 3,000 筆分析上限。');
    if(beforeEncoded>40)warnings.push('目前選取欄位的 One-Hot 預估為 '+beforeEncoded+' 個，超過 40 個運算上限。');
    if(chosen.length>39)warnings.push('目前選了 '+chosen.length+' 個原始 Features，超過 39 個上限。');
    const toExclude=reasons.filter(r=>r.selected).map(r=>r.name);
    const raw=kept.length,enc=kept.reduce((v,c)=>v+c.encodedCost,0);
    return {
      target,validTargets:numericTargets,totalRows:rows.length,
      currentRaw:chosen.length,currentEncoded:beforeEncoded,
      recommendedRaw:raw,recommendedEncoded:enc,
      selectedNames,toExclude,reasons,warnings,
      canApply:toExclude.length>0,
      ready:numericTargets>=15&&numericTargets<=3000&&raw>=1&&raw<=39&&enc>=1&&enc<=40
    };
  }
  return {evaluate,idColumn,stats};
})();
