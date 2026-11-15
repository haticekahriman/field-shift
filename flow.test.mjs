import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('Field-Shift.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
test('bundled UI flow, guided planting, camera, reload and shared mode',async()=>{
 const state=new Map();
 const el=()=>({focus(){},innerHTML:'',textContent:'',setAttribute(name,value){this[name]=value;}});
 const boot=async()=>{
   const app=el(),nav=el(),events={},risk=el(),run=el(),layer=el(),zoom=el(),zone=el();
   app.querySelector=()=>el();
   zone.getBoundingClientRect=()=>({width:1080,height:585});
   zone.classList={add(){},remove(){}};
   const context=vm.createContext({
     structuredClone,crypto,TextEncoder,TextDecoder,URLSearchParams,AbortSignal,setInterval,clearInterval,setTimeout,console,
     fetch:async()=>{throw Error('offline');},
     localStorage:{getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)},
     document:{documentElement:{},querySelector:s=>({'#app':app,'#nav':nav,'#risks':risk,'[data-action=run]':run,'#world-layer':layer,'.world-viewport':zone,'#zoom-value':zoom})[s]??el(),addEventListener:(k,v)=>events[k]=v},
     confirm:()=>true,FormData:class{values(){return app.innerHTML.includes('name="q3"')?[0,1,0,1]:[0,1,0];}}
   });
   await vm.runInContext('(async()=>{'+script+'})()',context);
   return {app,run,nav,layer,zoom,click:(action,dataset={})=>events.click({target:{closest:()=>({dataset:{action,...dataset}})}}),
     change:target=>events.change({target}),drag(){
       const pointer={target:{closest:()=>zone},button:0,pointerId:1,clientX:0,clientY:0};
       events.pointerdown(pointer);events.pointermove({...pointer,clientX:30,clientY:20});events.pointerup(pointer);
     },quiz:()=>events.submit({target:{id:'quiz'},preventDefault(){}})};
 };
 let flow=await boot();
 assert.match(flow.app.innerHTML,/İlk göreve başla/);
 await flow.click('setup');await flow.click('fetch');
 assert.match(flow.app.innerHTML,/NASA POWER verisi alınamadı/);
 await flow.click('start');
 assert.match(flow.app.innerHTML,/A1 için bir ürün seç/);
 assert.doesNotMatch(flow.app.innerHTML,/id="quiz"/);
 assert.equal(flow.run.disabled,true);
 await flow.click('zoom-in');assert.equal(flow.zoom.textContent,'122%');
 flow.drag();assert.match(flow.layer.transform,/translate\(30 20\)/);
 await new Promise(resolve=>setTimeout(resolve,5));
 await flow.click('center');assert.equal(flow.zoom.textContent,'100%');
 await flow.click('crop',{crop:'wheat'});assert.equal(flow.run.disabled,false);
 await flow.click('run');await flow.click('month');
 assert.match(flow.app.innerHTML,/Aylık yağış/);
 assert.match(flow.app.innerHTML,/raining/);
 flow=await boot();await flow.click('resume');
 assert.match(flow.app.innerHTML,/Aylık yağış/);
 const finish=async(from)=>{for(let y=from;y<3;y++){await flow.click('run');await flow.click('skip');await flow.click('advance');}};
 await flow.click('skip');await flow.click('advance');await finish(1);
 assert.match(flow.app.innerHTML,/Planın ve hesaplanan alternatifler/);
 await flow.click('retry');await flow.click('crop',{crop:'lentil'});
 await finish(0);
 assert.match(flow.app.innerHTML,/Buğday → Mercimek/);
 await flow.click('previous-map');assert.match(flow.app.innerHTML,/Önceki deneme/);
 await flow.click('post');flow.quiz();
 assert.match(flow.app.innerHTML,/Akraba ürünler/);
 await flow.click('compare');await flow.click('lang');
 assert.match(flow.app.innerHTML,/Three-year comparison/);
 await flow.click('reset');await flow.change({id:'mode',value:'shared',dataset:{}});
 await flow.click('start');await flow.click('calendar');await flow.click('fill');
 assert.equal([...flow.app.innerHTML.matchAll(/data-cell=/g)].length,27);
 await flow.click('farm',{farm:'B'});assert.match(flow.app.innerHTML,/B1/);
 await finish(0);
 assert.match(flow.app.innerHTML,/shared water is insufficient/);
});
