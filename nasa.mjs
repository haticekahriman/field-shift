import {region} from './config.mjs';
export const fields = ['PRECTOTCORR','T2M','T2M_MAX','T2M_MIN'];
export const url = 'https://power.larc.nasa.gov/api/temporal/daily/point?' + new URLSearchParams({
 parameters:fields.join(','), community:'AG', latitude:region.latitude, longitude:region.longitude,
 start:region.start, end:region.end, format:'JSON', 'time-standard':'UTC'
});
export function dates(start,end) {
 const parse = key => {
   if (!/^\d{8}$/.test(key)) throw Error('Invalid date');
   const date = new Date(key.replace(/^(....)(..)(..)$/, '$1-$2-$3')+'T00:00:00Z');
   if (date.toISOString().slice(0,10).replaceAll('-','') !== key) throw Error('Invalid date');
   return +date;
 };
 const first=parse(start), last=parse(end);
 if(last<first) throw Error('Invalid date interval');
 return Array.from({length:(last-first)/86400000+1},(_,i)=>new Date(first+i*86400000).toISOString().slice(0,10).replaceAll('-',''));
}
export async function sha(value) {
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), x=>x.toString(16).padStart(2,'0')).join('');
}
export function normalize(raw,start=region.start,end=region.end) {
 const {header,parameters,properties}=raw;
 if(header?.time_standard!=='UTC'||!Number.isFinite(header.fill_value)||
    !fields.every((f,i)=>properties?.parameter?.[f] && (i ? /^(C|°C)$/ : /^mm\/(day|d)$/).test(parameters?.[f]?.units))) throw Error('Unexpected NASA POWER metadata');
 let missing=0;
 const rows=dates(start,end).map(date=>{
   const v=fields.map(f=>properties.parameter[f][date]);
   if(v.some(x=>!Number.isFinite(x)||x===header.fill_value||x===-999)||v[0]<0||v[1]<v[3]||v[1]>v[2]) {
     missing++;
     return [date,null,null,null,null];
   }
   return [date,...v];
 });
 return {rows,missing};
}
export function choose(rows) {
 const years = new Map();
 for(const row of rows) {
   const month=+row[0].slice(4,6), year=+row[0].slice(0,4)+(month>=9?1:0);
   if(!years.has(year)) years.set(year,[]);
   years.get(year).push(row);
 }
 const candidates=[];
 for(const year of years.keys()){
   const periods=[year,year+1,year+2].map(y=>years.get(y));
   if(periods.some((p,i)=>!p||p.length!==dates((year+i-1)+'0901',(year+i)+'0831').length||p.some(row=>row[1]===null))) continue;
   const rain=periods.flat().reduce((sum,row)=>+row[0].slice(4,6)===8?sum:sum+row[1],0);
   candidates.push({year,periods,rain});
 }
 candidates.sort((a,b)=>a.rain-b.rain||a.year-b.year);
 if(candidates.length<2) throw Error('Two complete three-season windows required');
 return { dry:candidates[0], typical:candidates[Math.floor(candidates.length/2)] };
}
export async function makePackage(bytes,source) {
 const raw=JSON.parse(new TextDecoder().decode(bytes));
 const {rows,missing}=normalize(raw);
 const scenarios=choose(rows);
 const record={source:'NASA POWER', status:source, url, downloadedAt:new Date().toISOString(), latitude:region.latitude,
   longitude:region.longitude, start:region.start,end:region.end, units:Object.fromEntries(fields.map(f=>[f,raw.parameters[f].units])),
   header:raw.header, missing, rawHash:await sha(bytes),
   transformations:'UTC date join; missing days excluded from eligible windows, no interpolation.',
   selection:'Sort complete contiguous three-season windows by total September–July rainfall. Select minimum and upper median.'};
 return Promise.all(Object.entries(scenarios).map(async ([id,s])=>({...s,id,record,hash:await sha(JSON.stringify(s.periods))})));
}
export async function samples(){
 return Promise.all(['typical','dry'].map(async (id,i)=>{
   const periods=[2022,2023,2024].map((y,j)=>dates((y-1)+'0901',y+'0831').map((date,d)=>{
     const wave=Math.cos((+date.slice(4,6)-7)*Math.PI/6), rain=(d*37+j*23)%17;
     const mean=+(12+15*wave+(d%9-4)*.7+(i?1.5:0)).toFixed(2);
     return [date,rain<4?+(rain*(i?1.3:2.45)).toFixed(2):0,mean,mean+7,mean-7];
   }));
   return {id,year:2022,periods,hash:await sha(JSON.stringify(periods)),record:{source:'synthetic',status:'synthetic', units:['mm/day','°C','°C','°C'], missing:0, timeStandard:'UTC calendar',transformations:'Deterministic educational fixture'}};
 }));
}
