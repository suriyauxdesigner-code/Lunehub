/* ============================================================
   Lune — lightweight SVG charts (bar / area / donut)
   ============================================================ */
(function(){
const G='#1FA97A', GD='#0E8E6D';
function svg(w,h){return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%;display:block">`;}
function niceMax(v){const p=Math.pow(10,Math.floor(Math.log10(v)));const n=v/p;const m=n<=1?1:n<=2?2:n<=5?5:10;return m*p;}
function fmtAxis(v){if(v>=1e6)return(v/1e6).toFixed(v%1e6?1:0)+'M';if(v>=1e3)return Math.round(v/1e3)+'K';return''+v;}

/* ---------- BAR ---------- */
function bar(el,vals,labels,opts){
  opts=opts||{};
  const W=720,H=320,padL=44,padR=12,padT=14,padB=30;
  const iw=W-padL-padR, ih=H-padT-padB;
  const max=niceMax(Math.max(...vals,1));
  const n=vals.length, bw=iw/n, barW=Math.min(opts.barW||26,bw*0.55);
  let s=svg(W,H);
  // gridlines
  const ticks=5;
  for(let i=0;i<=ticks;i++){
    const y=padT+ih*(1-i/ticks), v=max*i/ticks;
    s+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#EFF1F3" stroke-width="1" ${i?'stroke-dasharray="3 4"':''}/>`;
    s+=`<text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#9aa1ab" font-family="Figtree,sans-serif">${fmtAxis(v)}</text>`;
  }
  vals.forEach((v,i)=>{
    const h=ih*(v/max), x=padL+bw*i+(bw-barW)/2, y=padT+ih-h;
    s+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0,h).toFixed(1)}" rx="4" fill="${G}"><title>${labels[i]}: ${v}</title></rect>`;
    s+=`<text x="${(x+barW/2).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#9aa1ab" font-family="Figtree,sans-serif">${labels[i]}</text>`;
  });
  s+='</svg>';
  el.innerHTML=s;
}

/* ---------- AREA (smooth) ---------- */
function area(el,vals,labels){
  const W=820,H=320,padL=44,padR=14,padT=14,padB=30;
  const iw=W-padL-padR, ih=H-padT-padB;
  const max=niceMax(Math.max(...vals,1));
  const n=vals.length;
  const pts=vals.map((v,i)=>[padL+iw*(i/(n-1)), padT+ih*(1-v/max)]);
  // catmull-rom -> bezier
  let d=`M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const c1x=p1[0]+(p2[0]-p0[0])/6, c1y=p1[1]+(p2[1]-p0[1])/6;
    const c2x=p2[0]-(p3[0]-p1[0])/6, c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const gid='ag'+Math.random().toString(36).slice(2,7);
  let s=svg(W,H);
  s+=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${G}" stop-opacity="0.32"/><stop offset="1" stop-color="${G}" stop-opacity="0.02"/></linearGradient></defs>`;
  const ticks=5;
  for(let i=0;i<=ticks;i++){
    const y=padT+ih*(1-i/ticks), v=max*i/ticks;
    s+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#EFF1F3" stroke-width="1" ${i?'stroke-dasharray="3 4"':''}/>`;
    s+=`<text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#9aa1ab" font-family="Figtree,sans-serif">${fmtAxis(v)}</text>`;
  }
  s+=`<path d="${d} L ${pts[n-1][0].toFixed(1)} ${(padT+ih).toFixed(1)} L ${pts[0][0].toFixed(1)} ${(padT+ih).toFixed(1)} Z" fill="url(#${gid})"/>`;
  s+=`<path d="${d}" fill="none" stroke="${GD}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  labels.forEach((l,i)=>{ if(n>12 && i%2) return;
    s+=`<text x="${pts[i][0].toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#9aa1ab" font-family="Figtree,sans-serif">${l}</text>`;});
  s+='</svg>';
  el.innerHTML=s;
}

/* ---------- DONUT ---------- */
function donut(el,segs){ // segs: [{label,value,color}]
  const total=segs.reduce((a,s)=>a+s.value,0)||1;
  const W=240,H=240,cx=120,cy=120,r=92,ir=58;
  let a0=-Math.PI/2, s=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;display:block">`;
  segs.forEach(seg=>{
    const a1=a0+(seg.value/total)*Math.PI*2;
    const gap=0.012;
    const x0=cx+r*Math.cos(a0+gap), y0=cy+r*Math.sin(a0+gap);
    const x1=cx+r*Math.cos(a1-gap), y1=cy+r*Math.sin(a1-gap);
    const xi1=cx+ir*Math.cos(a1-gap), yi1=cy+ir*Math.sin(a1-gap);
    const xi0=cx+ir*Math.cos(a0+gap), yi0=cy+ir*Math.sin(a0+gap);
    const large=(a1-a0)>Math.PI?1:0;
    s+=`<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L ${xi1.toFixed(1)} ${yi1.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi0.toFixed(1)} ${yi0.toFixed(1)} Z" fill="${seg.color}"><title>${seg.label}: ${(seg.value/total*100).toFixed(1)}%</title></path>`;
    a0=a1;
  });
  s+='</svg>';
  el.innerHTML=s;
}

window.Charts={bar,area,donut};
})();
