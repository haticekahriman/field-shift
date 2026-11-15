import {crops,version,rules,farms,region} from './config.mjs';
export const mmToM3=(mm,hectares)=>mm*hectares*10;
export const validPlan=(plan,count)=>Array.isArray(plan)&&plan.length===count&&plan.every(row=>Array.isArray(row)&&row.length===3&&row.every(id=>Object.hasOwn(crops,id)));
export const baseline = state => state.plots.map((p,i)=>Array(3).fill(i%3===1?'barley':'wheat'));
export function initial(shared) {
 return {version,shared,rules:structuredClone(rules),crops:structuredClone(crops),budget:shared?rules.sharedBudget:rules.soloBudget,
   plots:farms.slice(0,shared?3:1).flatMap(f=>f.plots.map(([ha,capacity,water,previous],i)=>({id:f.id+(i+1),farm:f.id,ha,capacity,water,previous})))};
}
export function allocate(demands,budget) {
 const total=demands.reduce((a,b)=>a+b,0);
 return demands.map(d=>total ? d*Math.min(1,budget/total):0);
}
export function calendar(crop,rows,shift=0){
 const find=key=>rows.findIndex(([date])=>date.slice(4)===key.replace('-',''));
 const start=find(crop.start),end=find(crop.end);
 if(start<0||end<start) throw Error('Crop outside production calendar');
 if(![-15,0,15].includes(shift)||start+shift<0||end+shift>=rows.length)throw Error("Invalid sowing offset");
 return {start:start+shift,end:end+shift};
}

function refET(row,latitude){
 const [date,,mean,high,low]=row;
 const year=+date.slice(0,4);
 const day=(Date.UTC(year,+date.slice(4,6)-1,+date.slice(6))-Date.UTC(year,0,1))/86400000+1;
 const phi=latitude*Math.PI/180, angle=2*Math.PI*day/365;
 const dec=.409*Math.sin(angle-1.39), distance=1+.033*Math.cos(angle);
 const sunset=Math.acos(Math.max(-1,Math.min(1,-Math.tan(phi)*Math.tan(dec))));
 const radiation=(1440/Math.PI)*.082*distance*(sunset*Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.sin(sunset));
 return Math.max(0,.0023*.408*radiation*(mean+17.8)*Math.sqrt(Math.max(0,high-low)));
}
const referenceCache=new WeakMap();
function referenceDays(rows){
 if(!referenceCache.has(rows))referenceCache.set(rows,rows.map(row=>refET(row,region.latitude)));
 return referenceCache.get(rows);
}
export function cropPhase(crop,start,end,day){
 if(day<start||day>end)return -1;
 const share=(day-start)/(end-start+1);
 let limit=0;
 for(const [i,duration] of crop.phases.entries()){
   limit+=duration;
   if(share<limit)return i;
 }
 return 3;
}
export function farmTargets(state,plan){
 return farms.filter(f=>state.plots.some(p=>p.farm===f.id)).map(f=>{
   const ids=plan.filter((_,i)=>state.plots[i].farm===f.id).flat();
   const cereals=ids.filter(id=>state.crops[id]?.family==='grass').length;
   const legumes=ids.filter(id=>state.crops[id]?.family==='legume').length;
   return {id:f.id,cereals,legumes,minCereals:f.minCereals,minLegumes:f.minLegumes,passes:cereals>=f.minCereals&&legumes>=f.minLegumes};
 });
}
const meetsTargets=(state,plan)=>farmTargets(state,plan).every(t=>t.passes);

export function relativeYield(demand,unmet,ky){
 return demand>0?100*Math.max(0,Math.min(1,1-ky*unmet/demand)):null;
}
export function simulate(state,periods,plan,{frames=true,offsets}={}){
 if(!validPlan(plan,state.plots.length)) throw Error('Incomplete plan');
 const history=state.plots.map(p=>[state.crops[p.previous].family]);
 const water=state.plots.map(p=>p.water);
 return periods.map((rows,y)=>{
   let budget=state.budget;
   const dailyET=referenceDays(rows);
   const schedules=plan.map((row,i)=>{
     const crop=state.crops[row[y]];
     return {...calendar(crop,rows,offsets?.[i]?.[y]??0),crop};
   });
   const metrics=state.plots.map((p,i)=>{
     const {crop}=schedules[i], family=crop.family, prior=history[i].at(-1);
     history[i].push(family);
     return {id:p.id,farm:p.farm, crop:plan[i][y],repeat:Number(family===prior),diversity:new Set(history[i].slice(1)).size,
       legume:Number(family==='legume'),bare:0,heat:0,demand:0,unmet:0,irrigation:0,overflow:0,soilUse:0,initialWater:water[i],effectiveRain:0};
   });
   const timeline=[];
   let monthDeficits=state.plots.map(()=>0);
   let rain=0, temp=0, days=0;
   for(let d=0;d<rows.length;d++){
     const [date,precip,mean,max]=rows[d];
     if(!Number.isFinite(precip)||!Number.isFinite(max)) throw Error('Climate data unavailable');
     rain+=precip; temp+=mean; days++;
     const phases=[];
     const shortfalls=state.plots.map((p,i)=>{
       const {start,end,crop}=schedules[i], m=metrics[i];
       const phase=cropPhase(crop,start,end,d);
       phases.push(phase);
       const input=precip*state.rules.rainFraction, available=water[i]+input;
       m.effectiveRain+=input; m.overflow+=Math.max(0,available-p.capacity);
       water[i]=Math.min(p.capacity,available);
       const use=phase<0?state.rules.fallowDemand:crop.kc[phase]*dailyET[d];
       const soilUse=Math.min(water[i],use);
       m.soilUse+=soilUse; water[i]-=soilUse;
       if(phase<0){m.bare++; return 0;}
       if(phase===2&&max>crop.heat){m.heat++;m.firstHeat??={date,max,threshold:crop.heat};}
       m.demand+=mmToM3(use,p.ha);
       return mmToM3(use-soilUse,p.ha);
     });
     const shares=allocate(shortfalls,budget);
     shares.forEach((amount,i)=>{
       budget=Math.max(0,budget-amount);
       const deficit=Math.max(0,shortfalls[i]-amount), metric=metrics[i];
       metric.irrigation+=amount;metric.unmet+=deficit;monthDeficits[i]+=deficit;
       if(deficit>1e-6&&!metric.firstDeficit){
         const recent=rows.slice(Math.max(0,d-19),d+1);
         metric.firstDeficit={date,phase:phases[i],rain:precip,soilWater:water[i],shortfall:shortfalls[i],irrigation:amount,deficit,days:recent.length,
           rainWindow:recent.reduce((sum,r)=>sum+r[1],0),maxTempWindow:recent.reduce((sum,r)=>sum+r[3],0)/recent.length};
       }
     });
     if(!rows[d+1]||date.slice(0,6)!==rows[d+1][0].slice(0,6)){
       if(frames)timeline.push({date,rain,temp:temp/days,budget,monthDeficits,water:[...water],phases,heat:metrics.map(m=>m.heat),unmet:metrics.map(m=>m.unmet)});
       rain=0;temp=0;days=0;monthDeficits=state.plots.map(()=>0);
     }
   }
   metrics.forEach((m,i)=>{m.finalWater=water[i];m.area=state.plots[i].ha;m.relativeYield=relativeYield(m.demand,m.unmet,schedules[i].crop.ky);});
   return {metrics,timeline,budget};
 });
}
export function summarize(years, farm){
 const totals={unmet:0,irrigation:0,heat:0,repeat:0,bare:0,legume:0,diversity:0};
 let potential=0, estimated=0;
 years.forEach((year,y)=>year.metrics.filter(m=>!farm||m.farm===farm).forEach(m=>{
   if(m.relativeYield!=null){potential+=m.area; estimated+=m.area*m.relativeYield;}
   for(const key in totals) if(key!=='diversity'||y===years.length-1) totals[key]+=m[key];
 }));
 return {...totals,relativeYield:potential?estimated/potential:0};
}
export function alternative(state,periods,start,offsets){
 const standard=baseline(state);
 const seed=standard.map((row,i)=>state.plots[i].farm==='C'&&i%3<2?row.map((id,y)=>y===i%3?'lentil':id):row);
 const seeds=[seed,start];
 for(let year=0;year<3;year++){
   for(const legume of ['lentil','chickpea']){
     seeds.push(seed.map((row,i)=>row.map((crop,y)=>y===year&&i%3===2?legume:crop)));
   }
 }
 const evaluate=plan=>summarize(simulate(state,periods,plan,{frames:false,offsets}));
 const candidates=seeds.filter(plan=>meetsTargets(state,plan)).map(plan=>({plan,score:evaluate(plan)}));
 const minimum=evaluate(start).relativeYield;
 const comparable=candidates.filter(c=>c.score.relativeYield>=minimum-1e-6);
 const pool=comparable.length?comparable:candidates;
 pool.sort((a,b)=>a.score.unmet-b.score.unmet||a.score.heat-b.score.heat||a.score.repeat-b.score.repeat);
 return pool[0].plan;
}

export function compareSingleEdits(state,periods,plan,original,offsets) {
 const before=summarize(original);
 const choices=[];
 for(const [plot,row] of plan.entries()){
   for(const [year,current] of row.entries()){
     for(const crop of Object.keys(state.crops)){
       if(crop===current) continue;
       const edit=plan.map((r,i)=>i!==plot?r:r.map((id,y)=>y===year?crop:id));
       if(!meetsTargets(state,edit))continue;
       const after=summarize(simulate(state,periods,edit,{frames:false,offsets}));
       if(after.relativeYield>=before.relativeYield-1e-6&&after.unmet<before.unmet-1e-6)choices.push({plot,year,current,crop,after,saved:before.unmet-after.unmet});
     }
   }
 }
 choices.sort((a,b)=>b.saved-a.saved||a.after.heat-b.after.heat||a.after.repeat-b.after.repeat);
 return choices.slice(0,3);
}

export function compareStrategies(state,periods,plan,offsets){
 const normal=plan.map(()=>[0,0,0]);
 const active=offsets??normal;
 const evaluate=(p,o)=>summarize(simulate(state,periods,p,{frames:false,offsets:o}));
 const current={id:'mine',plan,offsets:active,totals:evaluate(plan,active)};
 const reference={id:'base',plan:baseline(state),offsets:normal};
 reference.totals=evaluate(reference.plan,normal);
 const candidates=new Map();
 const add=(p,o)=>{
   const key=JSON.stringify([p,o]);
   if(!candidates.has(key)&&meetsTargets(state,p))candidates.set(key,{plan:p,offsets:o,totals:evaluate(p,o)});
 };
 const feasible=alternative(state,periods,plan,active);
 add(plan,active);add(reference.plan,normal);add(feasible,active);add(feasible,normal);
 for(const seed of [...candidates.values()]){
   for(const [i,row] of seed.plan.entries()){
     for(const [y,crop] of row.entries()){
       for(const next of Object.keys(state.crops)){
         if(next===crop)continue;
         add(seed.plan.map((r,j)=>i===j?r.map((c,k)=>y===k?next:c):r),seed.offsets);
       }
       for(const shift of [-15,0,15]){
         if(shift===seed.offsets[i][y])continue;
         add(seed.plan,seed.offsets.map((r,j)=>i===j?r.map((v,k)=>y===k?shift:v):r));
       }
     }
   }
 }
 const pool=[...candidates.values()];
 const minYield=pool.filter(p=>p.totals.relativeYield+1e-6>=current.totals.relativeYield);
 const water=(a,b)=>a.totals.unmet-b.totals.unmet||b.totals.relativeYield-a.totals.relativeYield||a.totals.bare-b.totals.bare;
 const yieldFirst=(a,b)=>b.totals.relativeYield-a.totals.relativeYield||water(a,b);
 const cover=(a,b)=>a.totals.bare-b.totals.bare||a.totals.repeat-b.totals.repeat||water(a,b);
 const pick=(arr,rank)=>[...arr].sort(rank)[0];
 return {count:pool.length,waterPreservesYield:!!minYield.length,plans:[current,reference,
   {...pick(minYield.length?minYield:pool,water),id:'water'},
   {...pick(pool,yieldFirst),id:'yield'},
   {...pick(pool,cover),id:'cover'}]};
}

export function explainPlotChoices(state,periods,plan,offsets,years){
 const overall=summarize(years);
 const choices=[];
 for(const [year,season] of years.entries()){
   for(const [plot,current] of season.metrics.entries()){
     if(current.unmet<=1e-6&&current.heat===0&&current.repeat===0)continue;
     const shift=offsets[plot][year];
     const family=state.crops[current.crop].family;
     const replacements=Object.keys(state.crops).filter(crop=>state.crops[crop].family!==family).map(crop=>({crop,shift}));
     const dates=[-15,0,15].filter(n=>n!==shift).map(shift=>({crop:current.crop,shift}));
     const viable=[];
     for(const candidate of [...replacements,...dates]){
       const next=plan.map((row,i)=>i===plot?row.map((c,y)=>y===year?candidate.crop:c):row);
       if(!meetsTargets(state,next))continue;
       const shifts=offsets.map((row,i)=>i===plot?row.map((v,y)=>y===year?candidate.shift:v):row);
       const outcome=simulate(state,periods,next,{frames:false,offsets:shifts});
       const local=outcome[year].metrics[plot], total=summarize(outcome);
       if(total.relativeYield+1e-6<overall.relativeYield||total.unmet>overall.unmet+1e-6)continue;
       const betterLocal=local.unmet<=current.unmet+1e-6&&local.relativeYield+1e-6>=current.relativeYield;
       const gain=local.unmet<current.unmet-1e-6||local.relativeYield>current.relativeYield+1e-6||local.heat<current.heat||local.repeat<current.repeat;
       if(betterLocal&&gain)viable.push({...candidate,local,total});
     }
     viable.sort((a,b)=>a.local.unmet-b.local.unmet||b.local.relativeYield-a.local.relativeYield||a.total.unmet-b.total.unmet);
     const cropEdit=viable.find(c=>c.crop!==current.crop), dateEdit=viable.find(c=>c.crop===current.crop);
     choices.push({plot,year,current,shift,cropEdit,dateEdit});
   }
 }
 return choices.sort((a,b)=>b.current.unmet-a.current.unmet||a.year-b.year||a.plot-b.plot);
}

export function compareDecisions(state,periods,plan,offsets,years){
 const before=summarize(years);
 const result={replace:[],swap:[]};
 const evaluate=(type,year,changes)=>{
   const changed=plan.map((row,plot)=>row.map((crop,y)=>y===year?changes.find(c=>c.plot===plot)?.crop??crop:crop));
   if(!meetsTargets(state,changed))return;
   const outcome=simulate(state,periods,changed,{frames:false,offsets});
   const after=summarize(outcome);
   const waterGain=before.unmet-after.unmet, yieldGain=after.relativeYield-before.relativeYield;
   if(waterGain<-.001||yieldGain<-.001||(waterGain<=.001&&yieldGain<=.001))return;
   const details=changes.map(({plot,crop})=>({plot,crop,before:years[year].metrics[plot],after:outcome[year].metrics[plot]}));
   result[type].push({year,details,after,waterGain,yieldGain});
 };
 for(let year=0;year<periods.length;year++){
   for(const [plot,row] of plan.entries()){
     for(const crop of Object.keys(state.crops)){
       if(crop!==row[year])evaluate('replace',year,[{plot,crop}]);
     }
     for(let other=plot+1;other<plan.length;other++){
       if(row[year]!==plan[other][year])evaluate('swap',year,[{plot,crop:plan[other][year]},{plot:other,crop:row[year]}]);
     }
   }
 }
 for(const options of Object.values(result))options.sort((a,b)=>b.waterGain-a.waterGain||b.yieldGain-a.yieldGain);
 return {before,...result};
}
