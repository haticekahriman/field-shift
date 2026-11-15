import {writeFile} from 'node:fs/promises';
import {url,makePackage} from './nasa.mjs';
try {
 const response=await fetch(url,{signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw Error('HTTP '+response.status);
 const bytes=new Uint8Array(await response.arrayBuffer());
 const pack=await makePackage(bytes,'cached');
 await writeFile('nasa-raw.json',bytes);
 await writeFile('nasa-package.json',JSON.stringify(pack));
 console.log(pack.map(({id,year,rain,hash,record})=>({id,year,rain,hash,missing:record.missing,rawHash:record.rawHash})));
} catch(error){console.error(error,error.cause);process.exitCode=1;}
