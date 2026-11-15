const pigment={wheat:['#f2ca69','#ba792e'],barley:['#efad76','#ac663f'],chickpea:['#aada7e','#477656'],lentil:['#8ee0ba','#497c70']};
const p2=(x,y)=>[540+(x-y)*72,254+(x+y)*34];
const at=(x,y,h=0)=>{const [a,b]=p2(x,y);return [a,b-h];};
const points=a=>a.map(c=>c.map(v=>+v.toFixed(2)).join(',')).join(' ');
const quad=(x,y,w,h,z=0)=>[at(x,y,z),at(x+w,y,z),at(x+w,y+h,z),at(x,y+h,z)];
const polygon=(pts,fill,rest='')=>`<polygon points="${points(pts)}" fill="${fill}" ${rest}/>`;
const terrain=[
 ['#527754','#304c43','#263e38'],['#65875a','#426449','#314c40'],['#557a56','#436346','#365347'],['#76915e','#4d6a48','#3b5943']
];
const noise=(i,s=0)=>{
 const n=Math.imul((i+1)^Math.imul(s+19,0x45d9f3b),0x27d4eb2d);
 return ((n^(n>>>15))>>>0)/4294967296;
};
function slab(x,y,w,h,z,thick,palette){
 const q=quad(x,y,w,h,z), [top,right,left]=palette;
 return polygon([q[1],q[2],[q[2][0],q[2][1]+thick],[q[1][0],q[1][1]+thick]],right)+
 polygon([q[2],q[3],[q[3][0],q[3][1]+thick],[q[2][0],q[2][1]+thick]],left)+polygon(q,top);
}
function tree(x,y,n){
 const [a,b]=at(x,y,1), h=29+noise(n,3)*28, w=h*.52;
 return `<g transform="translate(${a} ${b})"><ellipse cy="3" rx="${w*1.17}" ry="${w*.42}" fill="#1f443d" opacity=".45"/><path d="M0 2v-${h*.55}" stroke="#432f38" stroke-width="5"/><path d="M0-${h} L${w} -9 0 0 -${w} -9Z" fill="#285646"/><path d="M0-${h} L0 0 -${w} -9Z" fill="#568161"/><path d="M0-${h} L${w*.72} -${h*.48} 0 -${h*.3} -${w*.72} -${h*.48}Z" fill="#6d9970"/></g>`;
}
function shed(x,y){
 return slab(x,y,.72,.72,36,36,['#e3c29c','#b68b6c','#8d655c'])+
 slab(x-.08,y-.08,.88,.88,44,10,['#c26e57','#9a5049','#774348'])+
 polygon([at(x-.08,y-.08,44),at(x+.8,y-.08,44),at(x+.8,y+.34,65),at(x-.08,y+.34,65)],'#e49168')+
 polygon([at(x-.08,y+.34,65),at(x+.8,y+.34,65),at(x+.8,y+.8,44),at(x-.08,y+.8,44)],'#aa544b')+
 polygon([at(x+.20,y+.725,19),at(x+.48,y+.725,19),at(x+.48,y+.725,0),at(x+.20,y+.725,0)],'#4e4546');
}
function plotTile(z){
 const {i,x,y,id,crop,water,phase,active,unmet,heat}=z;
 const field=quad(x+.08,y+.08,1.84,1.84,4), [a,b]=at(x+1,y+1,6);
 const colors=pigment[crop], grown=phase===undefined?1:phase<0?0:(phase+1)/4;
 const rows=Array.from({length:6},(_,r)=>polygon(quad(x+.23+r*.255,y+.21,.075,1.56,6),'#443024','opacity=".42"')).join('');
 const plants=colors&&grown?Array.from({length:36},(_,n)=>{
   const [cx,cy]=at(x+.26+(n%6)*.255,y+.29+Math.floor(n/6)*.25,8);
   const height=(8+noise(n,i)*11)*grown;
   return `<g transform="translate(${cx} ${cy})"><path class="sprout" d="M0 0V-${height}m0 ${height*.52}l-5-4m5 5l5-5" stroke="${colors[1]}" stroke-width="4" stroke-linecap="round"/><circle cy="-${height}" r="${2+grown*2}" fill="${colors[0]}"/></g>`;
 }).join(''):'';
 const frame=active?'#ffee9c':heat&&!unmet?'#ffbc82':unmet?'#fa8b66':'#d7c394';
 return `<g class="world-plot ${active?'selected-plot':''}" data-plot="${i}">
 ${slab(x+.08,y+.08,1.84,1.84,4,12,[water!==undefined&&water<18?'#a8774e':'#8b6348','#573d3a','#664b39'])}
 ${rows}${plants}${polygon(field,'transparent',`class="plot-outline" stroke="${frame}" stroke-opacity="${active||unmet||heat?1:.7}" stroke-width="${active?4:2}"`)}
 <g class="plot-tag" transform="translate(${a} ${b+34})"><rect x="-27" y="-12" width="54" height="24" rx="7" fill="${active?'#ffeb9b':'#122731'}"/><text text-anchor="middle" dominant-baseline="central" fill="${active?'#1a2630':'#f9f0d2'}" font-size="14" font-weight="800">${id}${unmet||heat?' !':''}</text></g></g>`;
}
const island=slab(-3.25,-3.25,6.5,6.5,-4,44,['#637e54','#435e47','#3b4e42']);
const surroundings=Array.from({length:117},(_,i)=>{
 const x=-7.8+noise(i,1)*10.9,y=-7.8+noise(i,7)*10.9;
 if(x>-3.41&&y>-3.41)return '';
 const q=quad(x,y,.3+noise(i,12),.4+noise(i,23));
 return polygon(q,terrain[i%4][0],`opacity="${.16+noise(i,27)*.34}"`);
}).join('');
const terrace=Array.from({length:36},(_,i)=>polygon(quad(-3+(i%6),-3+Math.floor(i/6),.98,.98),'none','stroke="#becc92" stroke-opacity=".11"')).join('');
const pond=`<g class="world-pond">${slab(-2.66,-.29,1.38,1.48,0,3,['#244d52','#294750','#304f49'])}${polygon(quad(-2.59,-.22,1.24,1.33,1),'url(#pond-water)')}
 <path class="water-ring" d="M342 194q19-9 40-2m-24 13q24-12 45-7m-28 19q22-11 37-6" fill="none" stroke="#a2e7df" stroke-opacity=".7" stroke-width="2"/></g>`;
const coordinates=[[-2.54,-2.49],[.04,-2.45],[.04,.04]];
const treeBack=[[-3,-2.7],[-3,-1.8],[-2.9,-.9],[-2.6,-3],[-1.7,-3],[.7,-2.92],[1.7,-2.97],[2.24,-2.48],[2.58,-1.75],[2.6,-.7]];
const treeFront=[[-2.89,.72],[-2.83,1.5],[-2.42,2.77],[-1.63,2.57],[-.80,2.85],[.22,2.73],[1.19,2.7],[2.28,2.64],[2.71,1.66],[2.73,.87]];
export function worldSvg(plots,weather=0,decorative=false){
 const sky=Array.from({length:73},(_,i)=>`<circle cx="${noise(i,4)*1080}" cy="${noise(i,19)*500}" r="${.35+noise(i,9)*1.3}" opacity="${.14+noise(i,5)*.55}" fill="#a8d9dd"/>`).join('');
 return `<svg class="farm-world ${weather>0?'raining':''}" viewBox="0 0 1080 585" aria-hidden="true">
 <defs><radialGradient id="sky"><stop stop-color="#264959"/><stop offset="1" stop-color="#0a172a"/></radialGradient><linearGradient id="pond-water" x2="1" y2="1"><stop stop-color="#4caaa6"/><stop offset="1" stop-color="#246882"/></linearGradient>
 <radialGradient id="planet-light" cx=".35" cy=".25"><stop stop-color="#57849d"/><stop offset="1" stop-color="#163448"/></radialGradient><clipPath id="planet-edge"><circle cx="596" cy="209" r="181"/></clipPath><pattern id="survey-grid" width="47" height="47" patternUnits="userSpaceOnUse"><path d="M47 0H0v47" stroke="#afdce7" stroke-opacity=".08" fill="none"/></pattern></defs>
 <rect width="1080" height="585" fill="url(#sky)"/><rect width="1080" height="585" fill="url(#survey-grid)"/>
 ${sky}${decorative?"<g class=\"orbit-earth\"><circle cx=\"596\" cy=\"209\" r=\"194\" fill=\"none\" stroke=\"#75a9b8\" opacity=\".31\"/><circle cx=\"596\" cy=\"209\" r=\"181\" fill=\"url(#planet-light)\" stroke=\"#7bb3c9\" stroke-opacity=\".61\" stroke-width=\"3\"/><g clip-path=\"url(#planet-edge)\" opacity=\".65\"><path d=\"M432 137l46-46 46 5 22-27 42 14 25 30-21 27-39 5-13 18-40-4-4 26-28 25-21-15zm148 28 41-23 23 5 20-21 32 5 31-21 37 4 22 46-27 26-36-9-27 44-29 8-17-16-25 15-26-21-21 9-26-22zm7 61 51-11 24 23-10 45-21 16-18 43-29-35-11-40z\" fill=\"#729b83\"/><g fill=\"none\" stroke=\"#bbdce2\" stroke-opacity=\".36\"><ellipse cx=\"596\" cy=\"209\" rx=\"82\" ry=\"181\"/><ellipse cx=\"596\" cy=\"209\" rx=\"143\" ry=\"181\"/><ellipse cx=\"596\" cy=\"209\" rx=\"181\" ry=\"52\"/><ellipse cx=\"596\" cy=\"122\" rx=\"156\" ry=\"32\"/></g></g><circle cx=\"644\" cy=\"187\" r=\"5\" fill=\"#fbe39d\"/><circle class=\"survey-pulse\" cx=\"644\" cy=\"187\" r=\"13\" stroke=\"#fbe39d\" stroke-width=\"2\" fill=\"none\"/><path d=\"M659 187h105l28-23h95\" stroke=\"#fbe39d\" stroke-opacity=\".64\" fill=\"none\"/></g>":''}<g fill="none" stroke="#99d9d1" stroke-opacity=".13"><ellipse cx="539" cy="276" rx="495" ry="204" transform="rotate(-10 539 276)"/><ellipse cx="539" cy="276" rx="435" ry="159" transform="rotate(14 539 276)"/><ellipse cx="539" cy="276" rx="485" ry="228" stroke-dasharray="1 7"/></g>
 <g id="world-layer"><ellipse cx="540" cy="431" rx="443" ry="87" fill="#060e1b" opacity=".55"/>${surroundings}${island}${terrace}
 ${polygon(quad(-.52,-3.2,.48,6.1,-2),'#b49a70','opacity=".85"')}${polygon(quad(-3.17,-.44,6.15,.4,-2),'#b49a70','opacity=".85"')}
 ${treeBack.map(([x,y],i)=>tree(x,y,i*7)).join('')}
 ${shed(-1.64,1.42)}${pond}
 ${plots.map((plot,i)=>plotTile({...plot,x:coordinates[i][0],y:coordinates[i][1]})).join('')}
 ${treeFront.map(([x,y],i)=>tree(x,y,i*11+4)).join('')}
 <g transform="translate(867 128)" fill="none" stroke="#a1c7cd" opacity=".53"><circle r="27"/><path d="M0-40v80m-40-40h80"/><path d="M0-27 8 5 0 0-8 5Z" fill="#a1c7cd"/></g></g>
 ${weather>0?`<g class="rain-lines" stroke="#96dbf3" stroke-width="1.8">${Array.from({length:Math.min(52,12+Math.round(weather))},(_,i)=>{const x=noise(i,34)*920+80,y=noise(i,43)*420;return `<path d="M${x} ${y}l-9 24" style="animation-delay:-${noise(i,7)*2}s"/>`;}).join('')}</g>`:''}
 </svg>`;
}
export const showpiece=()=>worldSvg([{i:0,id:'A1',crop:'wheat'},{i:1,id:'A2',crop:'chickpea'},{i:2,id:'A3',crop:'barley'}],0,true);
