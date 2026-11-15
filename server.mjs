import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
   const route=new URL(req.url,'http://localhost').pathname;
   if(!/^\/[\w.-]*$/.test(route)) throw Error('Invalid path');
   const file=path.join(root,route==='/'?'index.html':route.slice(1));
   if(!mime[path.extname(file)]) throw Error('Invalid file');
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[path.extname(file)]+'; charset=utf-8'});
   res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.FIELD_SHIFT_PORT||4173),'127.0.0.1',()=>console.log('Field Shift: http://127.0.0.1:'+(process.env.FIELD_SHIFT_PORT||4173)));
