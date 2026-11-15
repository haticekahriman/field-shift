import {copy,questions} from './i18n.mjs';
import {region,crops,farms,version} from './config.mjs';
import {samples,sha,makePackage,url} from './nasa.mjs';
import {initial,baseline,alternative,simulate,summarize,validPlan,compareSingleEdits,farmTargets,calendar,compareStrategies,explainPlotChoices,compareDecisions} from './model.mjs';
import {worldSvg,showpiece} from './world.mjs';
import {visualWords} from './interface.mjs';

const app=document.querySelector('#app'), nav=document.querySelector('#nav'), key='field-shift-v1';
const synthetic=await samples();
let packs=synthetic, lang=+(localStorage.getItem('field-shift-language')==='en');
let view='home', game, shared=false, selected='typical', dataError='', timer, speed=1, result;
const t=k=>(copy[k]??visualWords[k])[lang], l=a=>a[lang], name=id=>crops[id]?l(crops[id].names):'—';
const farmName=id=>l(farms.find(f=>f.id===id).name);
const fmt=n=>new Intl.NumberFormat(lang?'en':'tr',{maximumFractionDigits:1}).format(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,c,primary=false,disabled=false)=>`<button type="button" data-action="${action}" class="${primary?'primary':''}" ${disabled?'disabled':''}>${c}</button>`;
const units={relativeYield:'%',unmet:'m³',irrigation:'m³'};
const keys=['relativeYield','unmet','irrigation','heat','repeat','diversity','bare','legumes'];
const value=(s,k)=>s[k==='legumes'?'legume':k];
const metric=(k,n)=>`<div class="card"><small>${t(k)}</small><strong class="metric">${fmt(n)} ${units[k]??''}</strong></div>`;
const checkpoints=['profile','plan','playback','summary','compare','post'];
let focusPlot=0, focusFarm='A', freePlay=false, calendarOpen=false, priorView=false, compareYear=0, showWater=true;
const camera={x:0,y:0,z:1};
let drag, blockClick=false;
function save(){
 if(!game||!checkpoints.includes(view))return;
 game.screen=view;
 try{localStorage.setItem(key,JSON.stringify(game));}catch{dataError=t('invalid');}
}
function halt(){clearInterval(timer);timer=null;}
function screen(next){halt();view=next;render();app.querySelector('h1,h2')?.focus();}
function dataNote(s){return `<p class="badge">${t(s.record.status)}</p>`;}
function dataDetails(s){
 return `<details class="card"><summary>${t('nasa')}</summary>${dataNote(s)}
 <p>${t('limit')} ${region.latitude}°, ${region.longitude}° · ${s.periods[0][0][0]}–${s.periods.at(-1).at(-1)[0]}</p>
 <p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/">NASA POWER Daily API</a> · <a href="https://power.larc.nasa.gov/docs/methodology/">NASA POWER Methodology</a></p>
 <pre>${esc(JSON.stringify({...s.record,climateHash:s.hash,model:version},null,2))}</pre>
 <p>${t('model')}</p><p>${t('explain')}</p><p>${t('rotation')}</p></details>`;
}
function scenarioLabel(s){return t(s.record.status==='synthetic'?(s.id==='dry'?'drySample':'wetSample'):s.id);}
function planAlerts(){
 const risk=game.plan.some((row,i)=>row.some((id,y)=>(calendarOpen||(i===focusPlot&&y===game.year))&&id&&crops[id].family===crops[y?row[y-1]:game.state.plots[i].previous]?.family));
 const mono=[0,1,2].some(y=>game.plan.every(row=>row[y]&&row[y]===game.plan[0][y]));
 document.querySelector('#risks').textContent=[risk?t('risk'):'',mono?t('mono'):''].filter(Boolean).join(' ');
 document.querySelector('[data-action=run]').disabled=!validPlan(game.plan,game.state.plots.length);
}
function calendarEditor(){
 return `
 ${game.year>0?`<p>${t('future')}</p>`:''}
 ${farms.slice(0,game.state.shared?3:1).map(f=>`<section class="card"><h3>${l(f.name)}</h3><div class="planner">
 <b>${t('plot')}</b>${[0,1,2].map(y=>`<b>${t('year')} ${y+1}</b>`).join('')}
 ${game.state.plots.map((p,i)=>p.farm!==f.id?'':`<div><b>${p.id}</b> · ${fmt(p.ha)} ha<br><small>${name(p.previous)}</small></div>${game.plan[i].map((id,y)=>`<div><i class="crop ${crops[id]?.family??''}"></i><select data-cell="${i},${y}" aria-label="${p.id} · ${t('year')} ${y+1}" ${y<game.year?'disabled':''}>
 <option value="">${t('choose')}</option>${Object.keys(crops).map(c=>`<option value="${c}" ${id===c?'selected':''}>${name(c)}</option>`).join('')}</select></div>`).join('')}`).join('')}</div></section>`).join('')}
 <div class="actions">${button('fill',t('fill'))}</div>
 <details class="card"><summary>${t('rules')}</summary><div class="grid">${Object.entries(crops).map(([id,c])=>`<article class="card"><b>${name(id)} · ${t(c.family)}</b><p>${c.start} → ${c.end}</p><small>${t('hot')} · ${fmt(c.kc[2])} Kc · ${c.heat} °C</small></article>`).join('')}</div></details>`;
}
function startMission(){
 const state=initial(shared), guided=!shared&&!freePlay;
 const plan=guided?baseline(state):state.plots.map(()=>['','','']);
 if(guided)plan[0][0]='';
 game={version,climate:structuredClone(packs.find(s=>s.id===selected)),state,plan,offsets:plan.map(()=>[0,0,0]),initialPlan:null,
   year:0,month:-1,attempts:[],edits:[],pre:[],post:[],guided};
 focusPlot=0;focusFarm='A';calendarOpen=false;resetCamera();
 screen('plan');
}
function currentPlot(){
 if(game.state.plots[focusPlot]?.farm!==focusFarm)focusPlot=game.state.plots.findIndex(p=>p.farm===focusFarm);
 if(focusPlot<0||!game.state.plots[focusPlot]){focusPlot=0;focusFarm='A';}
 return game.state.plots[focusPlot];
}
function selectPlot(index){
 if(!game?.state.plots[index])return;
 focusPlot=index;focusFarm=game.state.plots[index].farm;render();
 document.querySelector('[data-action=select-plot][data-plot="'+index+'"]')?.focus();
}
function selectCrop(id){
 if(view!=='plan'||!Object.hasOwn(crops,id))return;
 game.plan[focusPlot][game.year]=id;
 render();document.querySelector('[data-action=crop][data-crop="'+id+'"]')?.focus();
}
function resetCamera(){Object.assign(camera,{x:0,y:0,z:1});}
function paintCamera(){
 const layer=document.querySelector('#world-layer'), viewport=document.querySelector('.world-viewport');
 if(!viewport||!layer)return;
 layer.setAttribute('transform',`translate(${camera.x} ${camera.y}) translate(540 285) scale(${camera.z}) translate(-540 -285)`);
 const label=document.querySelector('#zoom-value');
 if(label)label.textContent=Math.round(camera.z*100)+'%';
}
function zoomBy(amount){
 camera.z=Math.max(.72,Math.min(2.35,camera.z+amount));
 paintCamera();
}
document.addEventListener('wheel',event=>{
 if(!event.target.closest('.world-viewport'))return;
 event.preventDefault();zoomBy(event.deltaY<0?.12:-.12);
},{passive:false});
document.addEventListener('pointerdown',event=>{
 const zone=event.target.closest('.world-viewport');
 if(!zone||event.button!==0)return;
 blockClick=false;
 drag={id:event.pointerId,zone,x:event.clientX,y:event.clientY,cx:camera.x,cy:camera.y,moved:false};
});
document.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 if(!drag.moved&&Math.hypot(dx,dy)<6)return;
 if(!drag.moved){drag.zone.setPointerCapture?.(drag.id);drag.zone.classList.add('dragging');drag.moved=true;}
 const rect=drag.zone.getBoundingClientRect(), scale=Math.max(Math.min(rect.width/1080,rect.height/585),.01);
 camera.x=Math.max(-710,Math.min(710,drag.cx+dx/scale));
 camera.y=Math.max(-490,Math.min(490,drag.cy+dy/scale));
 paintCamera();
});
function endDrag(event){
 if(!drag||event.pointerId!==drag.id)return;
 blockClick=drag.moved;drag.zone.classList.remove('dragging');drag=null;
 if(blockClick)setTimeout(()=>{blockClick=false;},0);
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',event=>{
 if(!event.target.matches('.world-viewport'))return;
 const move={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[event.key];
 if(move){event.preventDefault();camera.x=Math.max(-710,Math.min(710,camera.x+move[0]));camera.y=Math.max(-490,Math.min(490,camera.y+move[1]));paintCamera();}
 if(event.key==='+'||event.key==='='){event.preventDefault();zoomBy(.22);}
 if(event.key==='-'){event.preventDefault();zoomBy(-.22);}
 if(event.key==='0'){event.preventDefault();resetCamera();paintCamera();}
});
function farmTabs(){
 return game.state.shared?`<div class="farm-tabs" aria-label="${t('farmSelect')}">${farms.map(f=>`<button type="button" data-action="farm" data-farm="${f.id}" aria-pressed="${focusFarm===f.id}">${l(f.name)}</button>`).join('')}</div>`:'';
}
function scene(y,frame,editable=true,plan=game.plan,mapMetrics){
 const selected=currentPlot();
 const plots=game.state.plots.flatMap((p,i)=>p.farm!==selected.farm?[]:[{
   i,id:p.id,crop:plan[i][y],water:frame?.water[i]??p.water,phase:frame?.phases?.[i],active:i===focusPlot,
   unmet:showWater?(mapMetrics?.[i]?.unmet??frame?.unmet?.[i]):0,heat:showWater?(mapMetrics?.[i]?.heat??frame?.heat?.[i]):0
 }]);
 const budget=frame?.budget??game.state.budget;
 return `<section class="world-shell" aria-label="${t('farmTitle')}">
 <div class="world-top"><div><b>${farmName(selected.farm)}</b><small>${t('year')} 0${y+1} / 03</small></div>${farmTabs()}
 <div class="reservoir"><span>◒ ${t('left')}</span><b>${fmt(budget)} m³</b><div class="bar"><i style="width:${100*budget/game.state.budget}%"></i></div></div></div>
 <div class="world-viewport" tabindex="0" aria-label="${t('pan')}">${worldSvg(plots,editable?0:frame?.rain??0)}</div>
 <div class="world-bottom"><div class="plot-tabs" aria-label="${t('tap')}">${plots.map(p=>`<button type="button" data-action="select-plot" data-plot="${p.i}" aria-pressed="${p.active}">${p.id}<small>${name(p.crop)}</small></button>`).join('')}</div>
 <div class="camera-controls">${button('zoom-out','−').replace('type="button"',`type="button" aria-label="${t('zoomOut')}"`)}<span id="zoom-value">100%</span>${button('zoom-in','+').replace('type="button"',`type="button" aria-label="${t('zoomIn')}"`)}${button('center','⊙').replace('type="button"',`type="button" aria-label="${t('center')}"`)}</div></div>
 </section>`;
}
function sowingWindow(crop,year,offset){
 const rows=game.climate.periods[year], dates=calendar(crops[crop],rows,offset);
 return seasonDate(rows[dates.start][0])+' → '+seasonDate(rows[dates.end][0]);
}
function planner(){
 const p=currentPlot(), crop=game.plan[focusPlot][game.year], first=game.guided&&game.year===0&&!game.attempts.length;
 return `<div class="screen-heading"><div><p class="eyebrow">${t('briefing')}</p><h2 tabindex="-1">${t('mission')}</h2></div>${dataNote(game.climate)}</div>
 <div class="cockpit">${scene(game.year,null)}
 <aside class="flight-panel"><p class="eyebrow">${t('plot')} ${p.id} · ${fmt(p.ha)} ha</p><h3>${crop?name(crop):t('choose')}</h3>
 <p class="field-caption">${first&&!game.plan[0][0]?t('missionIntro'):`${t('previous')} · ${name(game.year?game.plan[focusPlot][game.year-1]:p.previous)}`}</p>
 <div class="crop-deck">${Object.entries(crops).map(([id,c])=>`<button type="button" data-action="crop" data-crop="${id}" aria-pressed="${crop===id}" class="crop-card ${id}">
 <span class="crop-icon" aria-hidden="true"><i></i><i></i><i></i></span><b>${name(id)}</b><small>${t(c.family)}</small></button>`).join('')}</div>
 ${crop?`<div class="actions" role="group" aria-label="${phrase('Ekim tarihi','Sowing date')}">${[-15,0,15].map((days,i)=>`<button type="button" data-action="sowing" data-days="${days}" aria-pressed="${game.offsets[focusPlot][game.year]===days}">${[phrase('Erken','Early'),phrase('Normal','Standard'),phrase('Geç','Late')][i]} ${days?days>0?'(+15)':'(−15)':''}</button>`).join('')}</div><p class="crop-notes">${sowingWindow(crop,game.year,game.offsets[focusPlot][game.year])} · ${fmt(crops[crop].kc[2])} Kc · ${crops[crop].heat} °C<br><small>${t('rules')}</small></p>`:''}
 <p id="risks" aria-live="polite"></p>${button('run',t('run')+' →',true)}
 </aside></div>
 <div class="actions mission-links">${button('calendar',t('showCalendar'))}${button('profile',t('seeProfile'))}</div>${calendarOpen?calendarEditor():''}`;
}
function comparisonMap(attempt,previous){
 const selection=priorView&&previous?previous:attempt, year=compareYear, p=currentPlot();
 const here=selection.years[year].metrics[focusPlot];
 return `<section class="comparison-world"><div class="actions map-actions">
 <strong>${t('compareScene')}</strong>
 ${[0,1,2].map(i=>`<button type="button" data-action="compare-year" data-year="${i}" aria-pressed="${year===i}">${t('year')} ${i+1}</button>`).join('')}
 ${previous?`<button type="button" data-action="previous-map" aria-pressed="${priorView}">${t(priorView?'prior':'current')}</button>`:''}
 <button type="button" data-action="water-layer" aria-pressed="${showWater}">${t('waterLayer')}</button>
 </div>${scene(year,{budget:selection.years[year].budget,water:selection.years[year].metrics.map(m=>m.finalWater)},false,selection.plan,selection.years[year].metrics)}
 <p class="map-metrics"><b>${p.id} · ${name(here.crop)}</b> · ${t('unmet')} ${fmt(here.unmet)} m³ · ${t('heat')} ${here.heat} · ${t('repeat')} ${here.repeat}</p></section>`;
}

function playback(){
 const frames=result[game.year].timeline, frame=frames[game.month], p=currentPlot(), i=focusPlot;
 const crop=game.plan[i][game.year], water=frame?.water[i]??p.water;
 const first=result[game.year].metrics[i].firstDeficit;
 const monthLabel=frame?new Intl.DateTimeFormat(lang?'en':'tr',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(frame.date.replace(/^(....)(..)(..)$/, '$1-$2-$3')+'T00:00:00Z')):'—';
 return `<div class="screen-heading"><div><p class="eyebrow">${t('role')} / ${t('year')} ${game.year+1}</p><h2 tabindex="-1">${t('playback')}</h2></div>${dataNote(game.climate)}</div>
 <div class="cockpit">${scene(game.year,frame,false)}<aside class="flight-panel playback-panel"><p class="eyebrow">${t('months')}</p><h3>${monthLabel}</h3>
 <div class="month-track">${frames.map((_,m)=>`<i class="${m<=game.month?'revealed':''} ${m===game.month?'current':''}"></i>`).join('')}</div>
 ${frame?`<div class="weather-readings"><div><small>${t('rain')}</small><b>${fmt(frame.rain)} <em>mm</em></b></div><div><small>${t('temp')}</small><b>${fmt(frame.temp)} <em>°C</em></b></div></div>`:`<p>${t('noWeather')}</p>`}
 <div class="field-reading"><b>${p.id} · ${name(crop)}</b><small>${frame?t('stage')[frame.phases[i]+1]:t('stageReady')}</small><p>${t('soil')} <b>${fmt(water)} / ${p.capacity} mm</b></p><div class="bar"><i style="width:${100*water/p.capacity}%"></i></div>
 ${first&&frame&&first.date<=frame.date?`<p class="field-alert"><b>${phrase('İlk açık','First deficit')}</b> · ${seasonDate(first.date)} · ${fmt(first.deficit)} m³</p>`:''}${frame?.unmet?.[i]?`<p class="field-alert">⚠ ${fmt(frame.unmet[i])} m³ · ${t('deficitFlag')}</p>`:''}
 ${frame?.heat?.[i]?`<p class="field-alert">☼ ${frame.heat[i]} · ${t('heatFlag')}</p>`:''}</div></aside></div>
 <div class="actions mission-links">${button('play',timer?'Ⅱ '+t('pause'):'▶ '+t('play'),true)}${button('month',t('month'))}${button('speed',speed===1?'2×':t('normal'))}${button('skip',t('skip')+' →')}</div>
 ${frame?`<section class="card climate-series"><b>${t('rain')}</b><div class="chart" role="img" aria-label="${t('rain')}">${frames.slice(0,game.month+1).map(f=>`<i title="${f.date} · ${fmt(f.rain)} mm" style="height:${Math.min(100,f.rain/2)}%"></i>`).join('')}</div></section>`:''}`;
}


const coachingCache=new WeakMap();
const phrase=(tr,en)=>lang?en:tr;
const seasonDate=key=>new Intl.DateTimeFormat(lang?'en':'tr',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(key.replace(/^(....)(..)(..)$/, '$1-$2-$3')+'T00:00:00Z'));
function climateInputs(){
 const real=game.climate.record.status!=='synthetic';
 return `<details class="card climate-proof"><summary>${phrase('İklim verisi oyunda nerede kullanıldı?','Where did climate data enter the game?')}</summary>
 <p>${real?'NASA POWER · ':phrase('Deneme veri seti · ','Demo dataset · ')}${region.latitude}° N, ${region.longitude}° E · ${seasonDate(game.climate.periods[0][0][0])} – ${seasonDate(game.climate.periods.at(-1).at(-1)[0])}</p>
 <ul><li><b>PRECTOTCORR · mm</b> — ${phrase('Günlük yağış ×','Daily rainfall ×')} ${fmt(game.state.rules.rainFraction*100)}% → ${phrase('toprak deposuna giren su.','water entering soil storage.')}</li>
 <li><b>T2M_MAX · °C</b> — ${phrase('Günlük tepe sıcaklık ürünün hassas evresindeki eşikle karşılaştırılır.','Daily maximum is compared with the crop threshold during its sensitive stage.')}</li>
 <li><b>T2M · °C</b> — ${phrase('Sezon ekranındaki aylık ortalama.','Monthly mean on the season screen.')}</li>
 <li><b>T2M_MIN · °C</b> — ${phrase('T2M, T2M_MAX ve T2M_MIN günlük Hargreaves referans su talebini belirler.','T2M, T2M_MAX and T2M_MIN drive daily Hargreaves reference evapotranspiration.')}</li></ul>
 <p>${phrase('Toprak kapasitesi, ürün eşikleri ve sulama bütçesi oyunun varsayımlarıdır.','Soil capacity, crop thresholds and irrigation budget are game assumptions.')}</p></details>`;
}
function firstGap(year){
 const first=year.metrics.filter(m=>m.firstDeficit).sort((a,b)=>a.firstDeficit.date.localeCompare(b.firstDeficit.date)||b.firstDeficit.deficit-a.firstDeficit.deficit)[0];
 if(!first)return `<div class="card diagnosis"><b>${phrase('Bu sezonda su açığı oluşmadı.','No water deficit this season.')}</b></div>`;
 const hit=first.firstDeficit;
 return `<div class="card diagnosis"><div><span class="eyebrow">${phrase('İlk su açığı','First water deficit')}</span><h3>${seasonDate(hit.date)} · ${first.id}</h3>
 <p>${name(first.crop)} · ${t('stage')[hit.phase+1]}</p></div>
 <div><p>${phrase('Toprak suyu kullanıldıktan sonra','After stored soil water was used,')} <b>${fmt(hit.shortfall)} m³</b> ${phrase('gerekiyordu. Ayrılan sulama','was still needed. Irrigation supplied')} <b>${fmt(hit.irrigation)} m³</b>. ${phrase('O günkü açık','That day’s deficit was')} <b>${fmt(hit.deficit)} m³</b>.</p>
 <small>${phrase('O günün yağışı','Rain that day')} ${fmt(hit.rain)} mm · ${hit.days} ${phrase('günlük yağış','day rainfall')} ${fmt(hit.rainWindow)} mm · ${phrase('ort. günlük en yüksek sıcaklık','mean daily maximum')} ${fmt(hit.maxTempWindow)} °C · ${phrase('Kalan toprak suyu','Remaining soil water')} ${fmt(hit.soilWater)} mm</small></div></div>`;
}
function heatMoment(year){
 const first=year.metrics.filter(m=>m.firstHeat).sort((a,b)=>a.firstHeat.date.localeCompare(b.firstHeat.date))[0];
 if(!first)return '';
 const h=first.firstHeat;
 return `<div class="card"><b>${phrase('İlk sıcaklık eşiği aşımı','First heat threshold crossing')} · ${first.id}</b>
 <p>${seasonDate(h.date)} · ${name(first.crop)} · ${fmt(h.max)} °C / ${phrase('ürün eşiği','crop threshold')} ${fmt(h.threshold)} °C</p></div>`;
}
function monthlyGaps(year){
 const values=year.timeline.map(f=>({date:f.date,sum:f.monthDeficits.reduce((a,b)=>a+b,0)}));
 const max=Math.max(1,...values.map(d=>d.sum));
 return `<section class="card coaching-chart"><h3>${phrase('Su açığı ne zaman büyüdü?','When did the water deficit grow?')}</h3>
 <p>${phrase('Aylık karşılanamayan su ihtiyacı · m³','Unmet monthly water demand · m³')}</p>
 <div class="gap-bars">${values.map(({date,sum})=>{const label=seasonDate(date);const month=date.slice(4,6);
 return `<div class="gap-bin" title="${label} · ${fmt(sum)} m³"><small>${sum?fmt(Math.round(sum)):''}</small><i style="--h:${100*sum/max}%"></i><span aria-label="${label}">${month}</span></div>`;}).join('')}</div>
 <details><summary>${phrase('Aylık değerler','Monthly values')}</summary><p>${values.map(d=>seasonDate(d.date)+' · '+fmt(d.sum)+' m³').join('<br>')}</p></details></section>`;
}

function deficitMap(year){
 const values=year.timeline.flatMap(f=>f.monthDeficits);
 const max=Math.max(0,...values);
 const levels=[0,1,2,3,4];
 const level=n=>n>1e-6?Math.min(4,Math.ceil(4*n/max)):0;
 return `<section class="card deficit-map"><h3>${phrase('Su açığı nerede oluştu?','Where did the water deficit occur?')}</h3>
 <div class="scroll"><table class="deficit-grid"><caption>${phrase('Aylık karşılanamayan su talebi','Monthly unmet water demand')} · m³</caption>
 <thead><tr><th scope="col">${phrase('Parsel','Plot')}</th>${year.timeline.map(f=>`<th scope="col" title="${seasonDate(f.date)}">${new Intl.DateTimeFormat(lang?'en':'tr',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(+f.date.slice(0,4),+f.date.slice(4,6)-1,1)))}</th>`).join('')}<th scope="col">Σ</th></tr></thead>
 <tbody>${year.metrics.map((m,i)=>`<tr><th scope="row" title="${name(m.crop)}">${m.id}</th>${year.timeline.map(f=>{
   const n=f.monthDeficits[i], peak=max>0&&Math.abs(n-max)<1e-6;
   return `<td class="gap-level-${level(n)}${peak?' gap-peak':''}" title="${m.id} · ${seasonDate(f.date)} · ${fmt(n)} m³">${n>1e-6?fmt(n):'–'}</td>`;
 }).join('')}<td><strong>${fmt(m.unmet)}</strong></td></tr>`).join('')}</tbody></table></div>
 <div class="gap-key"><span>0</span>${levels.map(n=>`<i class="gap-level-${n}" aria-hidden="true"></i>`).join('')}<span>${fmt(max)} m³</span></div></section>`;
}
function decisionChart(before,after){
 const metrics=[
   [phrase('Göreli verim','Relative yield'),'relativeYield','%'],
   [phrase('Su açığı','Water deficit'),'unmet','m³'],
   [phrase('Uygulanan sulama','Applied irrigation'),'irrigation','m³'],
   [phrase('Örtüsüz parsel-gün','Uncovered plot-days'),'bare',''],
   [phrase('Ürün ailesi tekrarı','Crop-family repeats'),'repeat',''],
   [phrase('Isı eşiği aşımı','Heat threshold crossings'),'heat','']
 ];
 return `<div class="decision-bars" role="group" aria-label="${phrase('Mevcut plan ve öneri karşılaştırması','Current plan and alternative comparison')}">
 <div class="decision-key"><span>${phrase('Mevcut','Current')}</span><span>${phrase('Öneri','Alternative')}</span></div>
 ${metrics.map(([title,key,unit])=>{
   const a=before[key],b=after[key], max=Math.max(a,b,1), delta=b-a, flat=Math.abs(delta)<1e-6;
   return `<div class="decision-metric"><div><b>${title}</b><strong class="${flat?'':(key==='relativeYield'?delta<0:delta>0)?'tradeoff-up':'tradeoff-down'}">${flat?'=':(delta>0?'+':'−')+fmt(Math.abs(delta))} ${unit}</strong></div>
   ${[a,b].map((n,i)=>`<div class="decision-row"><i class="${i?'after-bar':'before-bar'}" style="--bar:${100*n/max}%"></i><small>${fmt(n)} ${unit}</small></div>`).join('')}</div>`;
 }).join('')}</div>`;
}

function coachReport(attempt){
 let report=coachingCache.get(attempt);
 if(!report){
   const years=simulate(game.state,game.climate.periods,attempt.plan,{offsets:attempt.offsets});
   report={years,choices:compareSingleEdits(game.state,game.climate.periods,attempt.plan,years,attempt.offsets)};
   coachingCache.set(attempt,report);
 }
 return report;
}
function missionStars(attempt,years){
 const labels=(tr,en)=>phrase(tr,en);
 const targets=farmTargets(game.state,attempt.plan);
 return `<section class="card"><h3>${labels('Görev yıldızları','Mission stars')}</h3><div class="grid">
 ${targets.map(g=>{
   const f=farms.find(f=>f.id===g.id), totals=summarize(years,g.id);
   const plotCount=game.state.plots.filter(p=>p.farm===g.id).length;
   const diverse=years.at(-1).metrics.filter(m=>m.farm===g.id&&m.diversity>=2).length;
   const checks=g.id==='A'?[
     [g.passes,labels('Tahıl hedefi','Cereal target'),g.cereals+'/'+g.minCereals],
     [totals.unmet<=f.maxDeficit,labels('Su açığı','Water deficit'),fmt(totals.unmet)+' / ≤ '+fmt(f.maxDeficit)+' m³'],
     [totals.relativeYield>=55,labels('Göreli verim','Relative yield'),fmt(totals.relativeYield)+' / ≥ 55%']
   ]:g.id==='B'?[
     [g.passes,labels('Tahıl hedefi','Cereal target'),g.cereals+'/'+g.minCereals],
     [totals.relativeYield>=60,labels('Göreli verim','Relative yield'),fmt(totals.relativeYield)+' / ≥ 60%'],
     [totals.relativeYield>=f.yieldTarget,labels('İleri verim hedefi','Stretch yield target'),fmt(totals.relativeYield)+' / ≥ '+f.yieldTarget+'%']
   ]:[
     [g.passes,labels('Tahıl ve baklagil hedefleri','Cereal and legume targets'),g.cereals+'/'+g.minCereals+' · '+g.legumes+'/'+g.minLegumes],
     [diverse===plotCount,labels('En az iki aileyle ekilen parseller','Plots planted with at least two families'),diverse+'/'+plotCount],
     [totals.bare<=f.maxBare,labels('Örtüsüz parsel-gün','Uncovered plot-days'),fmt(totals.bare)+' / ≤ '+fmt(f.maxBare)]
   ];
   const stars=checks.filter(([pass])=>pass).length;
   return `<article class="goal-visual"><b>${l(f.name)} · <span aria-hidden="true">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span> · ${stars}/3</b>
   ${checks.map(([pass,title,value])=>`<small>${pass?'✓':'○'} ${title} · ${value}</small>`).join('')}</article>`;
 }).join('')}</div></section>`;
}

function coachView(attempt){
 const {years,choices}=coachReport(attempt), season=years[compareYear], before=summarize(years);
 return `<section class="coaching"><h2 class="coach-title">${phrase('Karar raporu','Decision report')}</h2>
 <div class="actions coach-years">${years.map((_,i)=>`<button type="button" data-action="coach-year" data-year="${i}" aria-pressed="${compareYear===i}">${t('year')} ${i+1} · ${fmt(summarize([years[i]]).unmet)} m³</button>`).join('')}</div>
 ${missionStars(attempt,years)}<p class="muted">${phrase('Göreli verim, her ürünün kendi su stresi olmayan referansına göre hesaplanan tahmindir.','Relative yield is estimated against each crop’s own no-water-stress reference.')}</p>${deficitMap(season)}${firstGap(season)}${heatMoment(season)}
 <section class="card"><h3>${phrase('Tek hamleyle ne değişirdi?','What would one change do?')}</h3>
 <p>${phrase('Her seçenek aynı hava, toprak ve bütçe ile baştan simüle edildi. Çiftliklerin ürün hedeflerini tutan seçenekler toplam su açığına göre sıralandı.','Each option was replayed with the same weather, soil and budget. Plans that meet the farm targets are ranked by total water deficit.')}</p>
 ${choices.length?`<div class="grid">${choices.map((c,i)=>{
   return `<article class="card option-card"><small>${game.state.plots[c.plot].id} · ${t('year')} ${c.year+1}</small><b>${name(c.current)} → ${name(c.crop)}</b>
   ${decisionChart(before,c.after)}
   <button type="button" data-action="try-coach" data-choice="${i}">${phrase('Bu hamleyle yeniden dene','Replay this change')}</button></article>`;}).join('')}</div>`:`<p>${phrase('Hedefleri tutup su açığını azaltan tek hamle bulunamadı. Geriye dönük planı incele.','No single change met all targets and reduced the deficit. Check the hindsight plan.')}</p>`}</section>
 ${climateInputs()}</section>`;
}


const strategyCache=new WeakMap();
function strategyReport(attempt){
 if(!strategyCache.has(attempt)){
   const report=compareStrategies(game.state,game.climate.periods,attempt.plan,attempt.offsets);
   strategyCache.set(attempt,{...report,plans:report.plans.map(p=>({...p,years:game.state.shared?simulate(game.state,game.climate.periods,p.plan,{frames:false,offsets:p.offsets}):undefined}))});
 }
 const report=strategyCache.get(attempt);
 const labels={
  mine:phrase('Senin planın','Your plan'),base:phrase('Örnek başlangıç','Reference plan'),
  water:phrase('En az su açığı','Lowest water deficit'),yield:phrase('En yüksek göreli verim','Highest relative yield'),
  cover:phrase('En fazla toprak örtüsü','Most crop cover')
 };
 return {...report,plans:report.plans.map(p=>({...p,label:labels[p.id]}))};
}
function strategyGraphs(plans){
 const series=[['unmet','m³',false],['relativeYield','%',true],['bare','',false],['irrigation','m³',null]];
 return `<div class="grid strategy-graphs">${series.map(([key,unit,higher])=>{
   const max=key==='relativeYield'?100:Math.max(1,...plans.map(p=>p.totals[key]));
   return `<section class="card strategy-graph"><h3>${t(key)} ${higher===null?'':higher?'↑':'↓'}</h3>
    ${plans.map(p=>`<div class="strategy-row ${p.id==='mine'?'own-plan':''}"><div><b>${p.label}</b><span>${fmt(p.totals[key])} ${unit}</span></div><div class="strategy-track"><i style="width:${100*p.totals[key]/max}%"></i></div></div>`).join('')}</section>`;
 }).join('')}</div>`;
}


function plotDecisionReview(attempt){
 const report=coachReport(attempt);
 report.plotChoices??=explainPlotChoices(game.state,game.climate.periods,attempt.plan,attempt.offsets,report.years);
 const rows=report.plotChoices;
 const family=id=>t(game.state.crops[id].family);
 const actualDate=(crop,year,shift)=>{
   const dates=game.climate.periods[year];
   return seasonDate(dates[calendar(game.state.crops[crop],dates,shift).start][0]);
 };
 return `<section class="card plot-review" id="plot-review"><h3>${phrase('Hangi parselde neyi farklı yapabilirdin?','What could you change on each plot?')}</h3>
 <p>${phrase('Aynı hava ve bütçeyle tek parsel-sezon değiştirildi. Öneriler çiftlik hedeflerini korur.','Each option changes one plot-season under the same weather and budget. Suggestions respect farm targets.')}</p>
 ${rows.length?`<div class="grid">${rows.map(({current,year,shift,cropEdit,dateEdit})=>`<article class="card plot-review-card">
 <h4>${current.id} · ${t('year')} ${year+1} · ${name(current.crop)}</h4>
 <dl><dt>${phrase('Ekim tarihi','Sowing date')}</dt><dd>${actualDate(current.crop,year,shift)}</dd>
 ${current.firstDeficit?`<dt>${phrase('İlk su açığı','First water deficit')}</dt><dd>${seasonDate(current.firstDeficit.date)} · ${t('stage')[current.firstDeficit.phase+1]}</dd>`:''}
 ${current.firstHeat?`<dt>${phrase('İlk sıcaklık eşiği aşımı','First heat threshold crossing')}</dt><dd>${seasonDate(current.firstHeat.date)} · ${fmt(current.firstHeat.max)} °C</dd>`:''}
 ${current.repeat?`<dt>${phrase('Rotasyon','Rotation')}</dt><dd>${phrase('Önceki sezonla aynı ürün ailesi','Same crop family as previous season')} · ${family(current.crop)}</dd>`:''}</dl>
 ${[cropEdit,dateEdit].filter(Boolean).map(c=>`<div class="plot-option"><b>${c.crop!==current.crop?phrase('Ürün ailesi alternatifi','Crop family alternative'):phrase('Ekim tarihi alternatifi','Sowing date alternative')}</b>
 <div>${name(c.crop)} · ${family(c.crop)} · ${actualDate(c.crop,year,c.shift)}</div>
 <dl><dt>${phrase('Parsel su açığı','Plot water deficit')}</dt><dd>${fmt(current.unmet)} → ${fmt(c.local.unmet)} m³</dd>
 <dt>${phrase('Parsel göreli verimi','Plot relative yield')}</dt><dd>%${fmt(current.relativeYield)} → %${fmt(c.local.relativeYield)}</dd>
 <dt>${phrase('Sıcaklık eşiği aşımı','Heat threshold crossings')}</dt><dd>${current.heat} → ${c.local.heat}</dd>
 <dt>${phrase('Üç sezon toplam su açığı','Total water deficit over three seasons')}</dt><dd>${fmt(summarize(report.years).unmet)} → ${fmt(c.total.unmet)} m³</dd></dl></div>`).join('')}
 ${!cropEdit&&!dateEdit?`<small>${phrase('Bu parselde hedefleri koruyan ve sonucu iyileştiren tek değişiklik bulunamadı.','No tested single change improved this plot while meeting the targets.')}</small>`:''}</article>`).join('')}</div>`:`<p>${phrase('Su açığı, sıcaklık eşiği aşımı veya ürün ailesi tekrarı görülmedi.','No water deficit, heat threshold crossings, or crop family repeats occurred.')}</p>`}</section>`;
}


function counterfactualSection(attempt){
 const report=coachReport(attempt);
 report.decisions??=compareDecisions(game.state,game.climate.periods,attempt.plan,attempt.offsets,report.years);
 const {before,replace,swap}=report.decisions;
 const percent=(a,b)=>{
   if(Math.abs(a-b)<.001)return '0%';
   if(a<.001)return phrase('Başlangıç: 0','Baseline: 0');
   const delta=(b-a)/a*100;
   return (delta>0?'+':'−')+'%'+fmt(Math.abs(delta));
 };
 const bar=(label,a,b,unit,higher)=>{
   const max=unit==='%'?100:Math.max(a,b,1);
   const delta=b-a, style=Math.abs(delta)<.001?'':(higher?delta>0:delta<0)?'is-gain':'is-loss';
   const points=unit==='%'&&Math.abs(delta)>=.001?` <small>(${delta>0?'+':'−'}${fmt(Math.abs(delta))} ${phrase('puan','pp')})</small>`:'';
   return `<div class="cf-metric"><div><b>${label}</b><strong class="${style}">${percent(a,b)}${points}</strong></div>
     <div class="cf-values"><span>${fmt(a)} ${unit}</span><span>→</span><span>${fmt(b)} ${unit}</span></div>
     <div class="cf-track" aria-hidden="true"><i style="width:${100*a/max}%"></i><i style="width:${100*b/max}%"></i></div></div>`;
 };
 const metricSet=(a,b)=>bar(t('unmet'),a.unmet,b.unmet,'m³',false)+bar(t('relativeYield'),a.relativeYield,b.relativeYield,'%',true);
 const card=({year,details,after},type)=>{
   const rows=game.climate.periods[year];
   const sow=(plot,crop)=>seasonDate(rows[calendar(game.state.crops[crop],rows,attempt.offsets[plot][year]).start][0]);
   const title=type==='swap'
     ?details.map(({before})=>before.id+' · '+name(before.crop)).join(' ↔ ')
     :details[0].before.id+' · '+name(details[0].before.crop)+' → '+name(details[0].crop);
   return `<article class="card cf-card"><small>${t('year')} ${year+1}</small><h4>${title}</h4>
    <div class="cf-changes">${details.map(({plot,crop,before,after})=>`<div><b>${before.id} · ${name(before.crop)} → ${name(crop)}</b>
     <small>${phrase('Ekim','Sowing')} · ${sow(plot,before.crop)} → ${sow(plot,crop)}${before.firstDeficit?' · '+phrase('İlk açık','First deficit')+' '+seasonDate(before.firstDeficit.date):''}</small>
     <small>${phrase('Parsel su açığı','Plot deficit')} · ${fmt(before.unmet)} → ${fmt(after.unmet)} m³ <b>(${percent(before.unmet,after.unmet)})</b></small></div>`).join('')}</div>
    <div class="cf-totals"><small>${phrase('Üç sezon · tüm parseller','Three seasons · all plots')}</small>
    ${metricSet(before,after)}
    <small>${t('bare')} ${fmt(before.bare)} → ${fmt(after.bare)} · ${t('heat')} ${fmt(before.heat)} → ${fmt(after.heat)}</small></div></article>`;
 };
 const group=(title,items,type)=>`<section class="cf-group"><h4>${title}</h4>${items.length?`<div class="grid cf-cards">${items.slice(0,3).map(i=>card(i,type)).join('')}</div>`:`<p>${phrase('Bu grupta hedefleri karşılayan ve sonucu iyileştiren değişiklik bulunmadı.','No tested change in this group improved the result while meeting the targets.')}</p>`}</section>`;
 return `<section class="card cf-section" id="decision-comparison"><h3>${phrase('Farklı karar verseydin ne olurdu?','What if you had chosen differently?')}</h3>
 <p>${phrase('Aynı hava ve su bütçesi · her kart ayrı bir deneme · yüzde farkı senin planına göre','Same weather and water budget · each card is a separate trial · percentage change from your plan')}</p>
 <div class="cf-legend"><span>${phrase('Senin planın','Your plan')}</span><span>${phrase('Alternatif','Alternative')}</span></div>
 ${group(phrase('Başka bir ürün ekseydin','If you planted a different crop'),replace,'replace')}
 ${group(phrase('İki parselin ürününü takas etseydin','If you swapped crops between two plots'),swap,'swap')}</section>`;
}

function comparison(){
 const attempt=game.attempts.at(-1), previous=game.attempts.at(-2);
 const report=strategyReport(attempt), plans=report.plans;
 const diff=previous&&summarize(previous.years);
 return `<h2 tabindex="-1">${t('compare')}</h2>${dataNote(game.climate)}<p>${t('frozen')}</p><section class="card strategy-summary"><h3>${phrase('Planın ve hesaplanan alternatifler','Your plan and calculated alternatives')}</h3>
 <p>${fmt(report.count)} ${phrase('hedefe uyan plan denendi · aynı 3 sezon, hava ve bütçe','feasible plans tested · same three seasons, weather and budget')}${report.waterPreservesYield?'':phrase(' · su açığı seçeneğinde mevcut verim korunamadı',' · the water option could not preserve current relative yield')}</p>
 ${new Set(plans.slice(2).map(p=>JSON.stringify([p.plan,p.offsets]))).size<3?`<small>${phrase('Bazı hedeflerde aynı plan birinci çıktı.','The same plan ranked first for some objectives.')}</small>`:''}${strategyGraphs(plans)}${counterfactualSection(attempt)}
 <div class="scroll"><table class="plan-metrics strategy-table"><thead><tr><th scope="col">${phrase('Gösterge','Metric')}</th>${plans.map(p=>`<th scope="col">${p.label}</th>`).join('')}</tr></thead><tbody>${keys.map(k=>`<tr><th scope="row">${t(k)}</th>${plans.map(p=>`<td>${fmt(value(p.totals,k))} ${units[k]??''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <div class="grid strategy-actions">${plans.slice(2).map(p=>{
 const changes=p.plan.flatMap((row,i)=>row.map((crop,y)=>{
  const previous=attempt.plan[i][y],shift=p.offsets[i][y],oldShift=attempt.offsets[i][y];
  return crop===previous&&shift===oldShift?'':game.state.plots[i].id+' · '+t('year')+' '+(y+1)+' · '+name(previous)+' ('+oldShift+'d) → '+name(crop)+' ('+shift+'d)';
 }).filter(Boolean));
 return `<article class="card"><b>${p.label}</b><ul>${changes.length?changes.map(v=>`<li>${v}</li>`).join(''):`<li>${t('unchanged')}</li>`}</ul><button type="button" data-action="try-strategy" data-strategy="${p.id}">${phrase('Bu planı dene','Try this plan')}</button></article>`;
 }).join('')}</div></section>
 ${coachView(attempt)}<details class="card"><summary>${phrase('Parselleri sahada karşılaştır','Compare plots on the map')}</summary>${comparisonMap(attempt,previous)}</details>
 ${game.state.shared?`<p>${t('sharedRule')}</p><div class="grid">${farms.map(f=>`<article class="card"><b>${l(f.name)}</b>${plans.map(p=>{const s=summarize(p.years,f.id);return `<p>${p.label} · ${t('unmet')} ${fmt(s.unmet)} m³ · ${t('irrigation')} ${fmt(s.irrigation)} m³</p>`;}).join('')}${previous?(()=>{const a=summarize(attempt.years,f.id),b=summarize(previous.years,f.id);return `<p>${t('delta')} · ${t('unmet')} ${fmt(a.unmet-b.unmet)} m³ · ${t('irrigation')} ${fmt(a.irrigation-b.irrigation)} m³</p>`;})():''}</article>`).join('')}</div>`:''}
 ${diff?`<section class="card"><h3>${t('delta')}</h3><b>${t('changes')}</b><p>${attempt.plan.flatMap((r,i)=>r.map((c,y)=>c===previous.plan[i][y]&&attempt.offsets[i][y]===previous.offsets[i][y]?'':`${game.state.plots[i].id} / ${t('year')} ${y+1} · ${name(previous.plan[i][y])} (${previous.offsets[i][y]} d) → ${name(c)} (${attempt.offsets[i][y]} d)`)).filter(Boolean).join('<br>')||t('unchanged')}</p>
 ${keys.map(k=>{const d=value(plans[0].totals,k)-value(diff,k);return `<div>${t(k)} · ${Math.abs(d)<1e-8?t('unchanged'):(d>0?'+':'')+fmt(d)+' '+(units[k]??'')}</div>`;}).join('')}</section>`:''}
 <p>${t('altWhy')}</p><p>${t('explain')} ${t('rotation')}</p>
 ${plotDecisionReview(attempt)}<div class="actions">${button('retry',t('retry'),true)}${button('post',t('finish'))}${button('export',t('out'))}${button('print',t('print'))}</div>${dataDetails(game.climate)}`;
}
const quizScore=answers=>answers.reduce((n,answer,i)=>n+Number(answer===questions[i][2]),0);
function quiz(){
 const qs=questions.slice(0,game.state.shared?4:3), answers=game.post;
 return `<h2 tabindex="-1">${t('reflection')}</h2><form id="quiz">
 ${qs.map(([q,choices,correct,why],i)=>`<fieldset class="card"><legend>${l(q)}</legend>
 ${choices.map((a,j)=>`<label><input type="radio" name="q${i}" value="${j}" required ${answers[i]===j?'checked':''}> ${l(a)}</label>`).join('')}
 ${answers.length?`<p>${answers[i]===correct?'✓':'↳'} ${l(choices[correct])}. ${l(why)}</p>`:''}</fieldset>`).join('')}
 <button class="primary">${t('next')}</button> ${button('compare',t('back'))+button('export',t('out'))}</form>`;
}
function render(){
 document.documentElement.lang=lang?'en':'tr';
 nav.innerHTML=button('lang',lang?'Türkçe':'English')+button('source',t('source'))+(game?button('reset',t('reset')):'');
 const active=packs.find(x=>x.id===selected)??packs[0];
 const screens={
 home:()=>`<div class="hero"><div class="hero-copy"><p class="eyebrow">NASA SPACE APPS CHALLENGE / WHY NOT</p><h1 tabindex="-1">Field <i>Shift.</i></h1><p class="hero-lead">${t('homeIntro')}</p><div class="actions">${game?button('resume',t('resume'),true):button('quick',t('launch'),true)}${button('setup',t('missions'))}</div><p class="hero-links"><label class="button">${t('import')}<input type="file" id="import" accept=".json"></label> <a href="https://power.larc.nasa.gov/">NASA POWER ↗</a></p></div><div class="hero-art">${showpiece()}<div class="orbit-label"><b>38.35° N / 38.31° E</b><span>MALATYA · ${t('sourceLim')}</span></div></div></div>`,
 setup:()=>`<h2 tabindex="-1">${t('setup')}</h2><p>${t('playtime')}</p>${dataNote(active)}
 <section class="card actions"><label><select id="mode" aria-label="${t('setup')}"><option value="solo">${t('solo')}</option><option value="shared" ${shared?'selected':''}>${t('shared')}</option></select></label>
 <label><select id="scenario" aria-label="${t('setup')}">${packs.map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${scenarioLabel(s)}</option>`).join('')}</select></label>
 <select id="format" aria-label="${t('mission')}"><option value="guided">${t('guided')}</option><option value="free" ${freePlay?'selected':''}>${t('free')}</option></select>${button('fetch',t('fetch'),false,fetching)}</section>
 <p role="status">${esc(dataError)}</p>${button('start',t('next'),true)}${dataDetails(active)}`,
 post:()=>quiz(),
 profile:()=>`<h2 tabindex="-1">${t('profile')}</h2>${dataNote(game.climate)}<p>${t('rules')} · ${t('budget')} ${fmt(game.state.budget)} m³ / ${t('year')}</p>
 <div class="grid">${farms.slice(0,game.state.shared?3:1).map(f=>`<article class="card"><b>${l(f.name)} · ${l(f.goal)}</b><p>${phrase('Tahıl alt sınırı','Minimum cereal plot-seasons')} ${f.minCereals}${f.minLegumes?' · '+phrase('Baklagil alt sınırı','Minimum legume plot-seasons')+' '+f.minLegumes:''}</p><p>${l(f.soil)}</p>${game.state.plots.filter(p=>p.farm===f.id).map(p=>`<p>${p.id} · ${fmt(p.ha)} ha · ${t('soil')} ${p.water}/${p.capacity} mm<br>${t('previous')} · ${name(p.previous)}</p>`).join('')}</article>`).join('')}</div>
 <p>${game.state.shared?t('sharedRule'):t('limit')}</p>${button('plan',t('next'),true)}`,
 plan:planner,playback,
 summary:()=>{const totals=summarize([result[game.year]]);return `<h2 tabindex="-1">${t('skip')} · ${t('year')} ${game.year+1}</h2>
 ${deficitMap(result[game.year])}${firstGap(result[game.year])}${monthlyGaps(result[game.year])}${scene(game.year,result[game.year].timeline.at(-1),false)}<div class="grid">${['unmet','heat','repeat'].map(k=>metric(k,totals[k])).join('')}</div><p>${t('explain')}</p><p>${t('rotation')} ${t('rethink')}</p>
 <div class="scroll card"><table><thead><tr><th>${t('plot')}</th><th>${t('unmet')}</th><th>${t('heat')}</th><th>${t('repeat')}</th></tr></thead><tbody>${result[game.year].metrics.map(m=>`<tr><td>${m.id} · ${name(m.crop)}</td><td>${fmt(m.unmet)} m³</td><td>${m.heat}</td><td>${m.repeat}</td></tr>`).join('')}</tbody></table></div>${button('advance',game.year===2?t('compare'):t('next'),true)}`;},
 compare:comparison,
 source:()=>`<h2 tabindex="-1">${t('source')}</h2>${button('return',t('next'))}${dataDetails(game?.climate??active)}`
 };
 app.innerHTML=(dataError&&view==='home'?`<p role="alert">${esc(dataError)}</p>`:'')+screens[view]();
 if(view==='plan')planAlerts();
 paintCamera();
 save();
}
let fetching=false, returnView='home';
function tick(){
 if(game.month>=11){screen('summary');return;}
 game.month++;
 render();
}
function exportGame(){
 const generated=game.attempts.length?strategyReport(game.attempts.at(-1)).plans:[];
 const href=URL.createObjectURL(new Blob([JSON.stringify({...game,comparison:generated,learning:{postCorrect:game.post.length?quizScore(game.post):null,questionCount:game.state.shared?4:3}},null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=href;link.download='field-shift-session.json';link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
async function readSession(candidate){
 if(!candidate||candidate.version!==version||!['pre',...checkpoints].includes(candidate.screen)||![0,1,2].includes(candidate.year)||
 !Number.isInteger(candidate.month)||candidate.month< -1||candidate.month>11||typeof candidate.state?.shared!=='boolean') throw Error('Invalid session schema');
 const state=initial(candidate.state.shared), n=state.plots.length;
 if(JSON.stringify(candidate.state)!==JSON.stringify(state)||!Array.isArray(candidate.plan)||candidate.plan.length!==n||
 !candidate.plan.every(r=>Array.isArray(r)&&r.length===3&&r.every(c=>c===''||Object.hasOwn(crops,c))))throw Error('Invalid plan or initial state');
 let climates=packs;
 if(candidate.climate?.record?.status==='synthetic')climates=synthetic;
 const climate=climates.find(c=>c.id===candidate.climate?.id&&c.hash===candidate.climate?.hash);
 if(!climate||await sha(JSON.stringify(candidate.climate.periods))!==climate.hash)throw Error('Missing climate package');
 if(!Array.isArray(candidate.attempts)||!Array.isArray(candidate.edits)||!Array.isArray(candidate.pre)||!Array.isArray(candidate.post)||
 ![candidate.pre,candidate.post].every(a=>a.length<=(state.shared?4:3)&&a.every(x=>Number.isInteger(x)&&x>=0&&x<3)))throw Error('Invalid history');
 const validOffsets=o=>Array.isArray(o)&&o.length===n&&o.every(row=>Array.isArray(row)&&row.length===3&&row.every(v=>[-15,0,15].includes(v)));
 if(!validOffsets(candidate.offsets))throw Error('Invalid sowing offsets');
 const attempts=candidate.attempts.map(a=>{
   if(!validPlan(a.plan,n)||!validPlan(a.initialPlan,n)||!validOffsets(a.offsets))throw Error('Invalid attempt');
   return {plan:a.plan,offsets:a.offsets,initialPlan:a.initialPlan,edits:a.edits,years:simulate(state,climate.periods,a.plan,{frames:false,offsets:a.offsets})};
 });
 if(['compare','post'].includes(candidate.screen)&&!attempts.length)throw Error('Missing result');
 if(['playback','summary'].includes(candidate.screen)&&!validPlan(candidate.plan,n))throw Error('Missing plan');
 return {...candidate,screen:candidate.screen==='pre'?'plan':candidate.screen,state,climate,attempts};
}
document.addEventListener('click',async event=>{
 if(blockClick){blockClick=false;return;}
 const target=event.target.closest('button[data-action]');
 if(!target){const item=event.target.closest('.world-plot');if(item&&view!=='home')selectPlot(Number(item.dataset.plot));return;}
 switch(target.dataset.action){
 case 'lang':lang=1-lang;localStorage.setItem('field-shift-language',lang?'en':'tr');render();document.querySelector('[data-action=lang]')?.focus();break;
 case 'source':if(view!=='source')returnView=view;screen('source');break;
 case 'return':screen(returnView);break;
 case 'resume':screen(game.screen);break;
 case 'reset':if(confirm(t('reset')+'?')){localStorage.removeItem(key);game=null;screen('setup');}break;
 case 'setup':screen('setup');break;
 case 'fetch':
   fetching=true;dataError='';render();
   try{const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw Error(res.status);
     packs=await makePackage(new Uint8Array(await res.arrayBuffer()),'live');
     try{localStorage.setItem('field-shift-climate',JSON.stringify(packs));}catch{}
   }catch{dataError=t('error');}finally{fetching=false;render();}
   break;
 case 'quick':shared=false;selected='typical';freePlay=false;startMission();break;
 case 'start':startMission();break;
 case 'select-plot':selectPlot(Number(target.dataset.plot));break;
 case 'crop':selectCrop(target.dataset.crop);break;
 case 'farm':focusFarm=target.dataset.farm;focusPlot=game.state.plots.findIndex(p=>p.farm===focusFarm);resetCamera();render();break;
 case 'calendar':calendarOpen=!calendarOpen;render();document.querySelector('[data-action=calendar]')?.focus();break;
 case 'zoom-in':zoomBy(.22);break;
 case 'zoom-out':zoomBy(-.22);break;
 case 'center':resetCamera();paintCamera();break;
 case 'previous-map':priorView=!priorView;render();document.querySelector('[data-action=previous-map]')?.focus();break;
 case 'coach-year':compareYear=Number(target.dataset.year);render();document.querySelector('[data-action=coach-year][data-year="'+compareYear+'"]')?.focus();break;
 case 'sowing':{const days=Number(target.dataset.days);if(view==='plan'&&[-15,0,15].includes(days)){game.offsets[focusPlot][game.year]=days;render();document.querySelector('[data-action=sowing][data-days="'+days+'"]')?.focus();}break;}
 case 'try-strategy':{
   const attempt=game.attempts.at(-1), strategy=strategyReport(attempt).plans.find(p=>p.id===target.dataset.strategy);
   if(!strategy)break;
   game.plan=structuredClone(strategy.plan);game.offsets=structuredClone(strategy.offsets);
   game.year=0;game.month=-1;game.edits=[];calendarOpen=true;screen('plan');break;
 }
 case 'try-coach':{
   const attempt=game.attempts.at(-1), edit=coachReport(attempt).choices[Number(target.dataset.choice)];
   if(!edit)break;
   game.plan=structuredClone(attempt.plan);game.offsets=structuredClone(attempt.offsets);
   game.plan[edit.plot][edit.year]=edit.crop;
   game.year=0;game.month=-1;game.edits=[];calendarOpen=edit.year>0;
   focusPlot=edit.plot;focusFarm=game.state.plots[edit.plot].farm;screen('plan');break;
 }
 case 'compare-year':compareYear=Number(target.dataset.year);render();document.querySelector('[data-action=compare-year][data-year="'+compareYear+'"]')?.focus();break;
 case 'water-layer':showWater=!showWater;render();document.querySelector('[data-action=water-layer]')?.focus();break;
 case 'profile':screen('profile');break;
 case 'plan':screen('plan');break;
 case 'fill':game.plan=baseline(game.state).map((r,i)=>r.map((c,y)=>y<game.year?game.plan[i][y]:c));render();document.querySelector('[data-action=fill]')?.focus();break;
 case 'run':
   if(!validPlan(game.plan,game.state.plots.length))break;
   if(!game.year)game.initialPlan=structuredClone(game.plan);
   else game.edits.push({year:game.year,plan:structuredClone(game.plan)});
   result=simulate(game.state,game.climate.periods,game.plan,{offsets:game.offsets});game.month=-1;screen('playback');break;
 case 'play':if(timer)halt();else timer=setInterval(tick,1250/speed);render();document.querySelector('[data-action=play]')?.focus();break;
 case 'speed':speed=3-speed;if(timer){halt();timer=setInterval(tick,1250/speed);}render();document.querySelector('[data-action=speed]')?.focus();break;
 case 'month':tick();document.querySelector('[data-action=month]')?.focus();break;
 case 'skip':screen('summary');break;
 case 'advance':
   if(game.year<2){game.year++;screen('plan');}
   else{priorView=false;compareYear=0;game.attempts.push({plan:structuredClone(game.plan),offsets:structuredClone(game.offsets),initialPlan:game.initialPlan,edits:game.edits,years:result.map(({metrics,budget})=>({metrics,budget}))});screen('compare');}
   break;
 case 'retry':game.year=0;game.month=-1;game.edits=[];calendarOpen=false;screen('plan');break;
 case 'post':screen('post');break;
 case 'compare':screen('compare');break;
 case 'export':exportGame();break;
 case 'print':print();break;
 }
});
document.addEventListener('change',async event=>{
 const el=event.target;
 if(el.id==='format')freePlay=el.value==='free';
 if(el.id==='mode')shared=el.value==='shared';
 if(el.id==='scenario'){selected=el.value;render();document.querySelector('#scenario')?.focus();}
 if(el.dataset.cell){
   const [i,y]=el.dataset.cell.split(',').map(Number);
   game.plan[i][y]=el.value;render();document.querySelector('[data-cell="'+i+','+y+'"]')?.focus();
 }
 if(el.id==='import'&&el.files[0]){
   try{game=await readSession(JSON.parse(await el.files[0].text()));result=validPlan(game.plan,game.state.plots.length)?simulate(game.state,game.climate.periods,game.plan,{offsets:game.offsets}):null;screen(game.screen);}
   catch{dataError=t('invalid');render();}
 }
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='quiz')return;
 event.preventDefault();
 const answers=[...new FormData(event.target).values()].map(Number);
 game.post=answers;render();
});
async function verifyPack(pack){
 if(!Array.isArray(pack)||pack.length!==2||new Set(pack.map(s=>s.id)).size!==2)throw Error('Climate package missing');
 for(const s of pack)if(s.record?.source!=='NASA POWER'||!['typical','dry'].includes(s.id)||!['live','cached'].includes(s.record.status)||await sha(JSON.stringify(s.periods))!==s.hash)throw Error('Climate package mismatch');
 return pack.map(s=>({...s,record:{...s.record,status:'cached'}}));
}
try{
 if(globalThis.FIELD_SHIFT_CLIMATE) packs=await verifyPack(globalThis.FIELD_SHIFT_CLIMATE);
 else {
   const response=await fetch('./nasa-package.json');
   if(response.ok)packs=await verifyPack(await response.json());
 }
}catch{}
if(packs===synthetic){
 try{const cached=localStorage.getItem('field-shift-climate');if(cached)packs=await verifyPack(JSON.parse(cached));}catch{}
}
try{
 const saved=localStorage.getItem(key);
 if(saved){game=await readSession(JSON.parse(saved));if(validPlan(game.plan,game.state.plots.length))result=simulate(game.state,game.climate.periods,game.plan,{offsets:game.offsets});}
}catch{game=null;dataError=t('invalid');}
render();
