import assert from 'node:assert/strict';
import test from 'node:test';
import {initial,mmToM3,allocate,simulate,baseline,alternative,calendar,summarize,validPlan,cropPhase,farmTargets,compareSingleEdits,relativeYield} from './model.mjs';
import {samples,dates,normalize,fields,choose,sha} from './nasa.mjs';
const scenarios=await samples();
const parts=scenarios[0].periods;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('water units and proportional allocation including zero demand and zero budget',()=>{
 assert.equal(mmToM3(1,1),10);
 assert.deepEqual(allocate([2,6],4),[1,3]);
 assert.deepEqual(allocate([2,6],10),[2,6]);
 assert.deepEqual(allocate([0,0],4),[0,0]);
 assert.deepEqual(allocate([2,6],0),[0,0]);
});
for(const shared of [false,true])test('water balance '+(shared?'shared':'solo'),()=>{
 const state=initial(shared), plan=baseline(state), result=simulate(state,parts,plan);
 result.forEach((y,no)=>{
  assert.ok(y.budget>=0);
  near(y.metrics.reduce((sum,m)=>sum+m.irrigation,0)+y.budget,state.budget);
  y.metrics.forEach((m,i)=>{
    const p=state.plots[i];
    assert.ok(m.finalWater>=0&&m.finalWater<=p.capacity);
    near(m.initialWater+m.effectiveRain-m.overflow-m.soilUse,m.finalWater);
    if(no)near(m.initialWater,result[no-1].metrics[i].finalWater);
  });
 });
});
test('date validation, leap days and matched NASA fields',()=>{
 assert.deepEqual(dates('20240228','20240301'),['20240228','20240229','20240301']);
 assert.throws(()=>dates('20230229','20230301'));
 const raw={header:{time_standard:'UTC',fill_value:-999},parameters:{},properties:{parameter:{}}};
 fields.forEach((f,i)=>{raw.parameters[f]={units:i?'C':'mm/day'};raw.properties.parameter[f]={20240301:[1,9,15,4][i],20240228:i?-999:4};});
 const normalized=normalize(raw,'20240228','20240301');
 assert.equal(normalized.missing,2);
 assert.deepEqual(normalized.rows,[['20240228',null,null,null,null],['20240229',null,null,null,null],['20240301',1,9,15,4]]);
 assert.throws(()=>normalize({...raw,header:{...raw.header,time_standard:'LST'}},'20240228','20240301'));
 assert.throws(()=>choose(normalized.rows));
});
test('climate selection finds actual contiguous windows and uses season rainfall',()=>{
 const rows=dates('20160901','20220831').map(d=>[d,+d.slice(0,4)-2015,10,20,0]);
 const {dry,typical}=choose(rows);
 assert.equal(dry.year,2017);
 assert.equal(typical.year,2019);
 assert.ok(dry.rain<typical.rain);
 assert.equal(dry.periods[1].at(-1)[0],'20180831');
});
test('calendar, family carryover, temperature and deterministic replay',async()=>{
 const state=initial(false), plan=baseline(state);
 const years=simulate(state,parts,plan);
 assert.deepEqual(simulate(state,parts,plan),years);
 assert.deepEqual(simulate(state,parts,plan,{frames:false}).map(y=>y.metrics),years.map(y=>y.metrics));
 assert.equal(years[1].metrics[0].repeat,1);
 assert.equal(years[0].metrics[0].bare,parts[0].length-(calendar(state.crops.wheat,parts[0]).end-calendar(state.crops.wheat,parts[0]).start+1));
 assert.throws(()=>calendar({start:'08-01',end:'07-01'},parts[0]));
 assert.equal(validPlan([['wheat']],3),false);
 const edited=structuredClone(plan);
 edited[0][0]='lentil';
 const changed=simulate(state,parts,edited);
 assert.equal(changed[1].metrics[0].repeat,0);
 near(changed[0].metrics[0].initialWater,state.plots[0].water);
 assert.notEqual(changed[0].metrics[0].unmet,years[0].metrics[0].unmet);
 const hot=parts.map(days=>days.map(([d,r,m,,lo])=>[d,r,m,55,lo]));
 assert.ok(summarize(simulate(state,hot,plan)).heat>summarize(years).heat);
 assert.equal(scenarios[0].record.status,'synthetic');
 assert.equal(scenarios[0].hash,await sha(JSON.stringify(parts)));
 assert.ok(validPlan(alternative(state,parts,plan),3));
});
test('changing one farm can affect another through the common water supply',()=>{
 const state=initial(true), plan=baseline(state);
 const before=simulate(state,parts,plan,{frames:false});
 const changed=plan.map((r,i)=>i<3?['lentil','lentil','lentil']:r);
 const after=simulate(state,parts,changed,{frames:false});
 assert.notEqual(summarize(before,'B').irrigation,summarize(after,'B').irrigation);
});

test('cereal sensitive stage falls in spring and farm targets gate advice',()=>{
 const state=initial(false), rows=parts[0], wheat=state.crops.wheat;
 const {start,end}=calendar(wheat,rows);
 const [first]=rows.find(([date],i)=>cropPhase(wheat,start,end,i)===2);
 assert.equal(first.slice(4,6),'05');
 const all=baseline(state).map(r=>r.map(()=> 'lentil'));
 assert.equal(farmTargets(state,all)[0].passes,false);
 assert.equal(compareSingleEdits(state,parts,all,simulate(state,parts,all)).length,0);
 assert.ok(farmTargets(state,alternative(state,parts,all)).every(x=>x.passes));
 const shared=initial(true), barePlan=baseline(shared).map(r=>r.map(()=> 'lentil'));
 assert.ok(farmTargets(shared,alternative(shared,parts,barePlan)).every(x=>x.passes));
});

test('relative yield bounds, sowing shifts and first deficit weather context',()=>{
 assert.equal(relativeYield(100,0,1.05),100);
 assert.equal(relativeYield(100,100,1.05),0);
 assert.equal(relativeYield(100,20,1.05),79);
 const state=initial(false), plan=baseline(state), crop=state.crops.wheat;
 const standard=calendar(crop,parts[0]), late=calendar(crop,parts[0],15);
 assert.equal(late.start-standard.start,15);
 assert.equal(late.end-standard.end,15);
 const outcomes=simulate(state,parts,plan,{offsets:[[15,0,0],[0,0,0],[0,0,0]]});
 assert.notEqual(outcomes[0].metrics[0].demand,simulate(state,parts,plan)[0].metrics[0].demand);
 const first=outcomes.flatMap(y=>y.metrics).find(m=>m.firstDeficit).firstDeficit;
 assert.ok(first.days>0&&first.days<=20&&first.rainWindow>=0&&Number.isFinite(first.maxTempWindow));
});
