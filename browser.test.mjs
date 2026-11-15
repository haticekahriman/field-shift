import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
const browser=process.env.FIELD_SHIFT_BROWSER??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile=await mkdtemp(path.join(tmpdir(),'field-shift-edge-'));
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,FIELD_SHIFT_PORT:'4188'}});
const edge=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9237','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const base='http://127.0.0.1:4188/';
try{
 let targets;
 for(let i=0;i<45;i++){
  try{targets=await (await fetch('http://127.0.0.1:9237/json/list')).json();if(targets.length)break;}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 assert.ok(targets?.length,'Edge debugger is reachable');
 const ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl), pending=new Map();
 let id=0;
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}};
 await once(ws,'open');
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const n=++id;
  pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));
  ws.send(JSON.stringify({id:n,method,params}));
 });
 const js=async expression=>{
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
 };
 const wait=async expression=>{
  for(let i=0;i<40;i++){if(await js(expression))return;await new Promise(r=>setTimeout(r,125));}
  throw Error('Timed out: '+expression);
 };
 const click=async k=>{
  await js(`document.querySelector('[data-action="${k}"]').click()`);
 };
 const quiz=()=>js("document.querySelectorAll('fieldset').forEach(x=>x.querySelector('input').click());document.querySelector('form').requestSubmit()");
 const complete=async()=>{for(let y=0;y<3;y++){await click('run');await click('skip');await click('advance');}};
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:process.argv.includes('--file')?(await import('node:url')).pathToFileURL(path.resolve('Field-Shift.html')).href:base});
 await wait("!!document.querySelector('[data-action=setup]')");
 await click('setup');
 await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*power.larc.nasa.gov*']});
 await click('fetch');
 await wait("document.querySelector('[role=status]').textContent.includes('alınamadı')");
 assert.equal(await js("document.querySelector('.badge').textContent.includes('NASA POWER')"),true);
 await click('start');
 if(process.argv[2] && process.argv[2]!=="--file"){await new Promise(r=>setTimeout(r,450));await writeFile(process.argv[2],Buffer.from((await send('Page.captureScreenshot')).data,'base64'));}
 assert.equal(await js("document.querySelector('[data-action=run]').disabled"),true);
 await send('Page.bringToFront');
 assert.equal(await js("document.querySelector('[data-crop=wheat]').focus(); document.activeElement.dataset.crop"),'wheat');
 await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32});
 await wait("!document.querySelector('[data-action=run]').disabled");
 await click('run');await click('month');
 assert.equal(await js("document.querySelectorAll('.chart i').length"),1);
 await send('Page.reload');
 await wait("!!document.querySelector('[data-action=resume]')");
 await click('resume');
 assert.equal(await js("document.querySelectorAll('.chart i').length"),1);
 await click('skip');await click('advance');await click('calendar');
 assert.equal(await js("document.querySelectorAll('select[data-cell]:disabled').length"),3);
 for(let y=1;y<3;y++){await click('run');await click('skip');await click('advance');}
 assert.equal(await js("document.querySelectorAll('.plan-metrics thead th').length"),6);
 assert.equal(await js("document.querySelectorAll('.deficit-grid thead th').length"),14);
 assert.equal(await js("document.querySelectorAll('.deficit-grid tbody tr').length"),3);
 assert.equal(await js("document.querySelectorAll('.option-card .after-bar').length>=5"),true);
 assert.equal(await js("document.querySelector('.diagnosis h3').textContent.includes('A')"),true);
 assert.equal(await js("document.querySelector('.climate-proof').textContent.includes('T2M_MAX')"),true);
 assert.equal(await js("document.body.textContent.includes('Göreli verim')&&document.body.textContent.includes('Görev yıldızları')"),true);
 assert.equal(await js("document.querySelectorAll('.strategy-graph').length"),4);
 assert.equal(await js("document.querySelectorAll('[data-action=try-strategy]').length"),3);
 assert.equal(await js("document.querySelectorAll('#plot-review .plot-review-card').length>0"),true);
 assert.equal(await js("document.querySelector('#plot-review').textContent.includes('Ekim tarihi')"),true);
 assert.equal(await js("document.querySelectorAll('#decision-comparison .cf-group').length"),2);
 assert.equal(await js("document.querySelector('.strategy-graphs').nextElementSibling.id"),'decision-comparison');
 assert.match(await js("document.querySelector('#decision-comparison').textContent"),/−%[0-9]/);
 await click('try-coach');
 assert.equal(await js("document.querySelector('h2').textContent"),'Çiftliği yönet');

 await js("document.querySelector('[data-crop=lentil]').click();");
 await complete();
 assert.equal(await js("document.body.textContent.includes('Değişen ürünler')"),true);
 await click('post');await quiz();
 assert.equal(await js("document.body.textContent.includes('Akraba ürünler')"),true);
 await click('compare');await click('lang');
 assert.equal(await js("document.querySelector('h2').textContent"),'Three-year comparison');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
 assert.equal(await js("document.documentElement.scrollWidth<=360"),true);
 await js("window.confirm=()=>true");await click('reset');
 await js("const mode=document.querySelector('#mode');mode.value='shared';mode.dispatchEvent(new Event('change',{bubbles:true}));");
 await click('start');await click('calendar');await click('fill');
 assert.equal(await js("document.querySelectorAll('select[data-cell]').length"),27);
 assert.equal(await js("document.documentElement.scrollWidth<=360"),true);
 await complete();
 assert.equal(await js("document.body.textContent.includes('remaining shared water')"),true);
 if(process.argv.includes('--demo')){
   await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
   const demo=(await import('node:url')).pathToFileURL(path.resolve('Judging-Demo.html')).href;
   await send('Page.navigate',{url:demo});
   await wait("document.querySelectorAll('main>section').length===7");
   assert.equal(await js("document.documentElement.scrollWidth<=1280"),true);
   const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
   await writeFile('Judging-Demo.pdf',Buffer.from(pdf.data,'base64'));
 }
 console.log('PASS: bundled NASA observations, API failure fallback, keyboard, monthly progress, reload, solo replay, three-plan comparison, quiz, English, 360px, shared mode');
 ws.close();
}finally{
 edge.kill();server.kill();
 try{await rm(profile,{recursive:true,force:true});}catch{}
}
