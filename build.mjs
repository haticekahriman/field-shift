import {readFile,writeFile} from 'node:fs/promises';
const read=name=>readFile(new URL(name,import.meta.url),'utf8').then(s=>s.replace(/^\uFEFF/,''));
const names=['config','nasa','model','i18n','world','interface','app'];
const modules=await Promise.all(names.map(name=>read(name+'.mjs')));
const script=modules.map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
const embedded=await read('nasa-package.json').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const climate=embedded ? 'globalThis.FIELD_SHIFT_CLIMATE=JSON.parse('+JSON.stringify(JSON.stringify(embedded)).replaceAll('<','\\u003c')+');\n' : '';
const html=(await read('index.html'))
.replace('<link rel="stylesheet" href="style.css">','<style>\n'+await read('style.css')+'\n</style>')
.replace('<script type="module" src="app.mjs"></script>',()=>'<script type="module">\n'+climate+script+'\n</script>');
await writeFile(new URL('Field-Shift.html',import.meta.url),html);
console.log('Field-Shift.html');
