'use strict';
/* Deterministic, explainable setup suggestions. No target-dependent feature
 * ranking or held-out test scoring is used to recommend exclusions. */
window.FeatureLabAdvisor=(()=>{
  const missing=v=>v==null||['','na','null','n/a'].includes(String(v).trim().toLowerCase());
  const idColumn=name=>{
    const label=String(name).trim();
    return /^(?:id|index(?:_\\d+)?|unnamed:?\\s*\\d*|serial(?:number)?|row[_\\s-]?id|record[_\\s-]?id)$/i.test(label)
      || /(?:[_\\s-]id)$/i.test(label)
      || /^[A-Za-z][A-Za-z0-9]*ID$/.test(label)
      || /identifier$/i.test(label)
      || /^(?:car|employee|customer|patient|order|transaction|record|invoice|product)[_\\s-]?(?:number|no)$/i.test(label);
  };
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
  function evaluate(headers,rows,fields,target,split=.8){
    const info=stats(headers,rows,fields);
    const targetIndex=headers.indexOf(target);
    const numericTargets=rows.map(row=>row[targetIndex]).filter(v=>!missing(v)&&Number.isFinite(Number(String(v).replace(/,/g,'')))).length;
    const ratio=[.7,.8,.9].includes(Number(split))?Number(split):.8;
    const trainCount=Math.max(10,Math.min(numericTargets-3,Math.floor(numericTargets*ratio)));
    const trainBudget=Math.max(0,trainCount-10);
    const maxEncoded=Math.min(80,trainBudget);
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
    // These are feature-budget suggestions, not predictor-quality rankings.
    // Prefer dropping expensive One-Hot fields before dropping numeric fields.
    const candidates=[...active].sort((a,b)=>{
      const cost=b.encodedCost-a.encodedCost;
      if(cost)return cost;
      return headers.indexOf(b.name)-headers.indexOf(a.name);
    });
    for(const c of (maxEncoded>=1?candidates:[])){
      const current=active.filter(item=>!blocked.has(item.name));
      if(current.length<=60&&encoded<=maxEncoded)break;
      blocked.add(c.name);
      encoded-=c.encodedCost;
      const reason=current.length>60?'60 個原始特徵':(maxEncoded<80?'訓練 '+trainCount+' 筆、最多 '+maxEncoded+' 個編碼特徵':'80 個編碼特徵');
      reasons.push({
        name:c.name,
        description:'為符合 '+reason+'的分析限制；此欄位預估增加 '+c.encodedCost+' 個編碼特徵',
        selected:true
      });
    }
    const kept=active.filter(c=>!blocked.has(c.name));
    const selectedNames=kept.map(c=>c.name);
    const beforeEncoded=chosen.reduce((v,c)=>v+c.encodedCost,0);
    const warnings=[];
    if(numericTargets<15)warnings.push('Target「'+target+'」只有 '+numericTargets+' 筆有效數值，至少需要 15 筆。');
    if(trainBudget<1)warnings.push('目前訓練資料約 '+trainCount+' 筆，套用「訓練筆數減 10」後無法保留任何特徵。請增加有效資料或提高訓練比例。');
    if(numericTargets>3000)warnings.push('Target 有 '+numericTargets+' 筆有效數值，超過 3,000 筆分析上限。');
    if(beforeEncoded>80)warnings.push('目前 One-Hot 預估 '+beforeEncoded+' 個特徵，超過 80 個硬性上限。');
    if(beforeEncoded>trainBudget)warnings.push('依 '+trainCount+' 筆訓練資料減 10，編碼後最多 '+trainBudget+' 個；目前預估 '+beforeEncoded+' 個。');
    if(chosen.length>60)warnings.push('目前選了 '+chosen.length+' 個原始 Features，超過 60 個上限。');
    if(beforeEncoded>trainCount/3)warnings.push('過擬合風險提醒：編碼後預估 '+beforeEncoded+' 個特徵，超過訓練資料 '+trainCount+' 筆的三分之一（'+Math.floor(trainCount/3)+' 個）。建議比較較小 k 並驗證測試表現。');
    const toExclude=reasons.filter(r=>r.selected).map(r=>r.name);
    const raw=kept.length,enc=kept.reduce((v,c)=>v+c.encodedCost,0);
    return {
      target,validTargets:numericTargets,totalRows:rows.length,trainCount,maxEncoded,
      overfitRisk:beforeEncoded>trainCount/3,recommendedOverfitRisk:enc>trainCount/3,
      currentRaw:chosen.length,currentEncoded:beforeEncoded,
      recommendedRaw:raw,recommendedEncoded:enc,
      selectedNames,toExclude,reasons,warnings,
      canApply:toExclude.length>0,
      ready:numericTargets>=15&&numericTargets<=3000&&raw>=1&&raw<=60&&enc>=1&&enc<=maxEncoded
    };
  }
  return {evaluate,idColumn,stats};
})();
