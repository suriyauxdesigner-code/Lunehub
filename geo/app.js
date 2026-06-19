/* ============================================================
   Lune Geolocation Analytics — app logic
   ============================================================ */
const {BRANDS,CATEGORIES,SEGMENTS,TXN_TYPES,AGE_BANDS,SHOPS,METRICS,fmtAED,fmtNum}=window.GEO;
const COUNTRIES=[...new Set(SHOPS.map(s=>s.country))].sort();
const SHOPS_BY_ID=Object.fromEntries(SHOPS.map(s=>[s.id,s]));
const brandById=id=>BRANDS[id];

const PERIODS={'30d':['Last 30 days',0.18],'3m':['Last 3 months',0.5],'6m':['Last 6 months',1],'12m':['Last 12 months',1.9]};

const state={
  metric:'spend', period:'6m', gender:'all', age:[], minTicket:0,
  category:[], brand:[], segment:[], txnType:[], country:[],
  bufferRadius:1609,
  layers:{pins:true, cluster:true, buffer:false, heat:false, choropleth:false}
};
const BUFFER_RADII=[['0.5 mi',805],['1 mi',1609],['2 mi',3219],['5 mi',8047]];

/* ---------- value helpers ---------- */
function periodMult(){return PERIODS[state.period][1];}
function shopVal(s,key){
  key=key||state.metric;
  if(key==='avgTicket')return s.avgTicket;
  let v=s[key]*periodMult();
  if(state.gender==='male')v*=s.male/100; else if(state.gender==='female')v*=s.female/100;
  if(state.age.length){
    let share=0; state.age.forEach(a=>{const i=AGE_BANDS.indexOf(a); if(i>=0)share+=s.age[i];});
    v*=share/100;
  }
  return v;
}
function passes(s){
  if(state.minTicket>0 && s.avgTicket<state.minTicket)return false;
  if(state.category.length && !state.category.includes(s.category))return false;
  if(state.brand.length && !state.brand.includes(s.brandId))return false;
  if(state.segment.length && !state.segment.includes(s.segment))return false;
  if(state.txnType.length && !state.txnType.includes(s.txnType))return false;
  if(state.country.length && !state.country.includes(s.country))return false;
  return true;
}
let filteredShops=SHOPS;
function recompute(){filteredShops=SHOPS.filter(passes);}

/* ============================================================
   MAP
   ============================================================ */
const map=L.map('map',{zoomControl:false,worldCopyJump:true,minZoom:2,maxZoom:18,
  center:[24,20], zoom:2.6, preferCanvas:true,
  maxBounds:[[-85,-220],[85,220]]});
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{
  subdomains:'abcd', maxZoom:19,
  attribution:'&copy; OpenStreetMap &copy; CARTO'
}).addTo(map);

const markerLayer=L.layerGroup();
let grandTotal=1;   // total of the selected metric across filtered shops (for cluster sizing)
function clusterValue(cluster){
  const kids=cluster.getAllChildMarkers();
  if(state.metric==='avgTicket'){
    let s=0; kids.forEach(m=>s+=m.options.shopVal); return s/kids.length;
  }
  let s=0; kids.forEach(m=>s+=m.options.shopVal); return s;
}
const clusterLayer=L.markerClusterGroup({
  maxClusterRadius:48, showCoverageOnHover:false, spiderfyOnMaxZoom:true,
  iconCreateFunction(cluster){
    const val=clusterValue(cluster);
    const n=cluster.getChildCount();
    // normalize to 0..1 across the volume range, spread for contrast
    let t;
    if(state.metric==='avgTicket'){t=Math.min(1,val/420);}
    else {t=Math.min(1,Math.sqrt((val/grandTotal)/0.30));}
    const size=Math.round(38+t*36);
    const shade=volColor(t);
    const dark=t<0.30;                 // light bubble → dark text
    const label=METRICS[state.metric].fmt(val);
    const fs=label.length>7?12:label.length>5?13:15;
    return L.divIcon({className:'',iconSize:[size,size],
      html:`<div class="cluster-ic${dark?' onlight':''}" style="width:${size}px;height:${size}px;background:${shade};font-size:${fs}px"><b>${label}</b><i>${n} stores</i></div>`});
  }
});
/* high-contrast volume spectrum: pale green → green → amber → orange → deep red */
const VOL_STOPS=[[197,231,213],[95,195,154],[31,169,122],[224,162,30],[226,98,46],[176,42,38]];
function volColor(t){
  t=Math.max(0,Math.min(1,t));
  const x=t*(VOL_STOPS.length-1),i=Math.floor(x),f=x-i,a=VOL_STOPS[i],b=VOL_STOPS[Math.min(i+1,VOL_STOPS.length-1)];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}
let heatLayer=null;
let choroLayer=null;
let worldGeo=null;
const bufferLayer=L.layerGroup();

function pinIcon(s){
  return L.divIcon({className:'',iconSize:[24,24],iconAnchor:[12,23],popupAnchor:[0,-20],
    html:`<div class="pin" style="width:24px;height:24px;background:${s.color}"><span>${s.abbr}</span></div>`});
}
function makeMarker(s){
  const m=L.marker([s.lat,s.lng],{icon:pinIcon(s),shopVal:shopVal(s)});
  m.bindPopup(()=>tipHtml(s),{closeButton:false,offset:[0,-4]});
  m.on('popupopen',()=>{
    const el=document.querySelector('.tip .open[data-s="'+s.id+'"]');
    if(el)el.onclick=()=>{map.closePopup();openShop(s);};
  });
  m.on('click',()=>{});
  return m;
}
function tipHtml(s){
  return `<div class="tip"><div class="tt"><span class="dot" style="background:${s.color}"></span>${s.brand}</div>
  <div class="tr">${s.addr}</div>
  <div class="tr">${METRICS[state.metric].label}: <b>${METRICS[state.metric].fmt(shopVal(s))}</b></div>
  <div class="open" data-s="${s.id}">View store detail →</div></div>`;
}

function refreshMarkers(){
  markerLayer.clearLayers(); clusterLayer.clearLayers();
  map.removeLayer(markerLayer); map.removeLayer(clusterLayer);
  updateVolLegend();
  if(!state.layers.pins)return;
  grandTotal=filteredShops.reduce((a,s)=>a+shopVal(s),0)||1;
  const markers=filteredShops.map(makeMarker);
  if(state.layers.cluster){markers.forEach(m=>clusterLayer.addLayer(m)); map.addLayer(clusterLayer);}
  else{markers.forEach(m=>markerLayer.addLayer(m)); map.addLayer(markerLayer);}
}
function updateVolLegend(){
  const el=document.getElementById('vol-legend');
  if(!el)return;
  const show=state.layers.pins&&state.layers.cluster;
  el.classList.toggle('show',show);
  if(show)document.getElementById('vol-label').textContent=METRICS[state.metric].label.toLowerCase()+' per cluster';
}

function refreshBuffers(){
  bufferLayer.clearLayers();
  if(!state.layers.buffer){if(map.hasLayer(bufferLayer))map.removeLayer(bufferLayer);return;}
  if(!map.hasLayer(bufferLayer))map.addLayer(bufferLayer);
  // only draw what's in view (capped) so it stays light
  const draw=visibleShops().slice(0,1500);
  draw.forEach(s=>{
    L.circle([s.lat,s.lng],{radius:state.bufferRadius,color:s.color,weight:1.2,
      opacity:.7,fillColor:s.color,fillOpacity:.16}).addTo(bufferLayer);
  });
}

function refreshHeat(){
  if(heatLayer){map.removeLayer(heatLayer);heatLayer=null;}
  if(!state.layers.heat)return;
  const vals=filteredShops.map(s=>shopVal(s));
  const max=Math.max(1,...vals);
  const pts=filteredShops.map((s,i)=>[s.lat,s.lng,Math.max(0.12,vals[i]/max)]);
  heatLayer=L.heatLayer(pts,{radius:24,blur:20,maxZoom:9,minOpacity:.25,
    gradient:{0.2:'#D7EFE6',0.45:'#7FD0B6',0.7:'#13A07B',1:'#0B6B52'}});
  map.addLayer(heatLayer);
}

function choroColor(t){ // t in 0..1
  const stops=[[236,247,242],[183,228,213],[111,208,182],[31,169,122],[11,107,82]];
  const x=Math.min(.999,Math.max(0,t))*(stops.length-1);
  const i=Math.floor(x),f=x-i,a=stops[i],b=stops[i+1];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
}
function refreshChoropleth(){
  if(choroLayer){map.removeLayer(choroLayer);choroLayer=null;}
  document.getElementById('legend').classList.toggle('show',state.layers.choropleth);
  if(!state.layers.choropleth)return;
  if(!worldGeo){toast('Loading country boundaries…');return;}
  const byCountry={};
  filteredShops.forEach(s=>{byCountry[s.country]=(byCountry[s.country]||0)+(state.metric==='avgTicket'?s.avgTicket:shopVal(s));});
  if(state.metric==='avgTicket'){ // make it an average
    const cnt={}; filteredShops.forEach(s=>cnt[s.country]=(cnt[s.country]||0)+1);
    Object.keys(byCountry).forEach(k=>byCountry[k]/=cnt[k]);
  }
  const max=Math.max(1,...Object.values(byCountry));
  choroLayer=L.geoJSON(worldGeo,{
    style:f=>{
      const v=byCountry[f.properties.name];
      return v?{fillColor:choroColor(v/max),fillOpacity:.72,color:'#fff',weight:.7}
               :{fillColor:'#F1F3F5',fillOpacity:.25,color:'#fff',weight:.5};
    },
    onEachFeature:(f,layer)=>{
      const v=byCountry[f.properties.name];
      layer.bindTooltip(`<b>${f.properties.name}</b><br>${v?METRICS[state.metric].fmt(v):'No data'}`,{sticky:true});
      layer.on('mouseover',()=>layer.setStyle({weight:1.6,color:'#0B6B52'}));
      layer.on('mouseout',()=>choroLayer.resetStyle(layer));
    }
  }).addTo(map);
  choroLayer.bringToBack();
  document.getElementById('legend-label').textContent=METRICS[state.metric].label.toLowerCase()+' by country';
}
fetch((window.__resources&&window.__resources.worldAtlas)||'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
  .then(r=>r.json())
  .then(topo=>{worldGeo=topojson.feature(topo,topo.objects.countries); if(state.layers.choropleth)refreshChoropleth();})
  .catch(()=>{const l=document.querySelector('.layer[data-l="choropleth"]'); if(l){l.style.opacity=.45;l.title='Country boundaries unavailable offline';}});

/* ============================================================
   VIEWPORT LEADERBOARD
   ============================================================ */
function visibleShops(){
  const b=map.getBounds();
  return filteredShops.filter(s=>b.contains([s.lat,s.lng]));
}
const CROWN='<span class="crown"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18l2-9 5 4 2-7 2 7 5-4 2 9z"/></svg></span>';
function updateBoard(){
  const vis=visibleShops();
  const m=METRICS[state.metric];
  const list=document.getElementById('board-list');
  const singleBrand=state.brand.length===1?state.brand[0]:null;

  // ---------- SHOP DRILL-DOWN MODE (one brand selected) ----------
  if(singleBrand!==null){
    const b=brandById(singleBrand);
    let rows=vis.filter(s=>s.brandId===singleBrand).map(s=>({s,val:shopVal(s)}));
    rows.sort((a,b)=>b.val-a.val);
    const totalLoc=rows.length;
    rows=rows.slice(0,30);
    const maxVal=rows.length?rows[0].val:1;
    document.getElementById('board-title-text').textContent='Top '+b.name+' locations';
    if(!rows.length){list.innerHTML=`<div class="board-empty">No ${b.name} locations in this view.<br>Zoom out or relax filters.</div>`;}
    else{
      list.innerHTML=rows.map((row,i)=>{
        const s=row.s;
        return `<div class="lrow" data-shop="${s.id}">
          <div class="rk">${i+1}</div>
          <div class="mk" style="background:${s.color}">${s.abbr}</div>
          <div class="mid">
            <div class="nm">${s.area}<span class="ct">· ${s.code}</span></div>
            <div class="lbar-track"><div class="lbar-fill" style="width:${Math.max(3,row.val/maxVal*100)}%;background:${s.color}"></div></div>
          </div>
          <div class="val"><div class="n">${m.fmt(row.val)}</div><div class="s">${fmtNum(s.txns*periodMult())} txns</div></div>
        </div>`;
      }).join('');
      [...list.querySelectorAll('.lrow')].forEach(el=>{
        el.onclick=()=>{const s=SHOPS_BY_ID[+el.dataset.shop];openShop(s);};
      });
    }
    const total=vis.filter(s=>s.brandId===singleBrand).reduce((x,s)=>x+(state.metric==='avgTicket'?s.avgTicket:shopVal(s)),0);
    document.getElementById('vp-val').textContent=m.fmt(state.metric==='avgTicket'&&totalLoc?total/totalLoc:total);
    document.getElementById('vp-shops').textContent=totalLoc+' '+b.name+' store'+(totalLoc===1?'':'s');
    document.getElementById('board-foot-total').textContent='Showing '+rows.length+' of '+totalLoc+' locations in view';
    setScope(vis);
    return;
  }

  // ---------- BRAND MODE ----------
  document.getElementById('board-title-text').textContent='Top contributors';
  const agg={};
  vis.forEach(s=>{
    const a=agg[s.brandId]||(agg[s.brandId]={brandId:s.brandId,val:0,shops:0,txns:0,cust:0,tickets:[]});
    a.shops++; a.txns+=s.txns*periodMult(); a.cust+=s.customers*periodMult();
    if(state.metric==='avgTicket')a.tickets.push(s.avgTicket); else a.val+=shopVal(s);
  });
  let rows=Object.values(agg);
  if(state.metric==='avgTicket')rows.forEach(a=>a.val=a.tickets.reduce((x,y)=>x+y,0)/a.tickets.length);
  rows.sort((a,b)=>b.val-a.val);
  rows=rows.slice(0,30);
  const maxVal=rows.length?rows[0].val:1;

  if(!rows.length){list.innerHTML=`<div class="board-empty">No stores match in this view.<br>Zoom out or relax filters.</div>`;}
  else{
    list.innerHTML=rows.map((a,i)=>{
      const b=brandById(a.brandId);
      return `<div class="lrow" data-brand="${a.brandId}">
        <div class="rk">${i+1}</div>
        <div class="mk" style="background:${b.color}">${b.abbr}</div>
        <div class="mid">
          <div class="nm">${b.name}<span class="ct">· ${a.shops} ${a.shops>1?'stores':'store'}</span></div>
          <div class="lbar-track"><div class="lbar-fill" style="width:${Math.max(3,a.val/maxVal*100)}%;background:${b.color}"></div></div>
        </div>
        <div class="val"><div class="n">${m.fmt(a.val)}</div><div class="s">${fmtNum(a.txns)} txns</div></div>
      </div>`;
    }).join('');
    [...list.querySelectorAll('.lrow')].forEach(el=>{
      el.onclick=()=>openBrand(+el.dataset.brand,vis);
    });
  }

  const total=state.metric==='avgTicket'
    ? (vis.length?vis.reduce((x,s)=>x+s.avgTicket,0)/vis.length:0)
    : vis.reduce((x,s)=>x+shopVal(s),0);
  document.getElementById('vp-val').textContent=m.fmt(total);
  document.getElementById('vp-shops').textContent=vis.length+' store'+(vis.length===1?'':'s');
  document.getElementById('board-foot-total').textContent=
    rows.length+' brand'+(rows.length===1?'':'s')+' · '+vis.length+' stores in view';
  setScope(vis);
}
function setScope(vis){
  const cset=[...new Set(vis.map(s=>s.country))];
  let scope;
  if(map.getZoom()<=2.8)scope='Worldwide';
  else if(cset.length===0)scope='No regions';
  else if(cset.length===1)scope=cset[0];
  else if(cset.length<=3)scope=cset.join(' · ');
  else scope=cset.length+' countries';
  const suffix=state.brand.length===1?' · ranked by '+METRICS[state.metric].short.toLowerCase():' · top 30 brands';
  document.getElementById('scope-text').textContent=scope+suffix;
}
map.on('moveend zoomend',()=>{updateBoard(); if(state.layers.buffer)refreshBuffers();});

/* ============================================================
   LAYER SWITCHER
   ============================================================ */
const LAYER_DEFS=[
  ['pins','Brand pins','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>'],
  ['cluster','Cluster nearby','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2"/><circle cx="11" cy="16" r="2.4"/></svg>'],
  ['buffer','Catchment buffer','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>'],
  ['heat','Spend heatmap','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-1.5.7-3 1.5-4"/></svg>'],
  ['choropleth','Region density','<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>']
];
function buildLayers(){
  const box=document.getElementById('layers');
  LAYER_DEFS.forEach(([k,label,ic])=>{
    const el=document.createElement('div');
    el.className='layer'+(state.layers[k]?' on':''); el.dataset.l=k;
    el.innerHTML=`<span class="ic">${ic}</span>${label}<span class="sw"></span>`;
    el.onclick=()=>{
      state.layers[k]=!state.layers[k];
      el.classList.toggle('on',state.layers[k]);
      updateLayerCount();
      if(k==='heat')refreshHeat();
      else if(k==='choropleth')refreshChoropleth();
      else if(k==='buffer'){refreshBuffers();syncRadiusCtl();}
      else refreshMarkers();
    };
    box.appendChild(el);
    if(k==='buffer'){
      const rc=document.createElement('div'); rc.id='radius-ctl'; rc.className='radius-ctl';
      rc.innerHTML=`<span class="rl">Radius</span>`+BUFFER_RADII.map(([l,v])=>
        `<button data-r="${v}" class="${v===state.bufferRadius?'on':''}">${l}</button>`).join('');
      rc.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();
        state.bufferRadius=+b.dataset.r;
        rc.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
        refreshBuffers();});
      box.appendChild(rc);
      syncRadiusCtl(rc);
    }
  });
}
function syncRadiusCtl(rc){rc=rc||document.getElementById('radius-ctl'); if(rc)rc.style.display=state.layers.buffer?'flex':'none';}
function updateLayerCount(){
  const n=Object.values(state.layers).filter(Boolean).length;
  const c=document.getElementById('layers-count'); if(c)c.textContent=n;
}
(function initLayersToggle(){
  const ctl=document.getElementById('layers-ctl'), btn=document.getElementById('layers-btn');
  btn.onclick=e=>{e.stopPropagation();const open=ctl.classList.toggle('open');btn.setAttribute('aria-expanded',open);};
  document.addEventListener('click',e=>{if(!ctl.contains(e.target))ctl.classList.remove('open'),btn.setAttribute('aria-expanded','false');});
})();

/* ============================================================
   FILTER BAR
   ============================================================ */
const IC={
  cal:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  gender:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="13" r="5"/><path d="M19 4l-5 5M19 4h-4M19 4v4"/></svg>',
  age:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  amt:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15 9.5A2.5 2.5 0 0 0 12.5 8h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1A2.5 2.5 0 0 1 9 14.5"/></svg>',
  cat:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  brand:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/></svg>',
  seg:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6"/></svg>',
  ch:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
  country:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  chev:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  check:'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>'
};
const FILTERS=[
  {id:'period',type:'period',label:'Period',icon:IC.cal},
  {id:'gender',type:'radio',label:'Gender',icon:IC.gender,opts:[['all','All genders'],['male','Male'],['female','Female']]},
  {id:'age',type:'multi',label:'Age',icon:IC.age,opts:AGE_BANDS.map(a=>[a,a])},
  {id:'minTicket',type:'range',label:'Min ticket',icon:IC.amt},
  {id:'category',type:'multi',label:'Category',icon:IC.cat,opts:CATEGORIES.map(c=>[c,c])},
  {id:'brand',type:'brand',label:'Brand',icon:IC.brand},
  {id:'segment',type:'multi',label:'Segment',icon:IC.seg,opts:SEGMENTS.map(s=>[s,s])},
  {id:'txnType',type:'multi',label:'Channel',icon:IC.ch,opts:TXN_TYPES.map(t=>[t,t])},
  {id:'country',type:'multi',label:'Country',icon:IC.country,opts:COUNTRIES.map(c=>[c,c])}
];
/* ---------- active filter accounting ---------- */
const ARR_FILTERS=['age','category','brand','segment','txnType','country'];
function activeGroups(){
  let n=0;
  if(state.period!=='6m')n++;
  if(state.gender!=='all')n++;
  if(state.minTicket>0)n++;
  ARR_FILTERS.forEach(k=>{if(state[k].length)n++;});
  return n;
}
function clearGroup(k){
  if(k==='period')state.period='6m';
  else if(k==='gender')state.gender='all';
  else if(k==='minTicket')state.minTicket=0;
  else state[k]=[];
}
function clearAll(){Object.assign(state,{period:'6m',gender:'all',age:[],minTicket:0,category:[],brand:[],segment:[],txnType:[],country:[]});}

/* ---------- toolbar (Filters button + active chips) ---------- */
function chipList(){
  const out=[];
  if(state.period!=='6m')out.push({k:'period',txt:PERIODS[state.period][0]});
  if(state.gender!=='all')out.push({k:'gender',txt:state.gender==='male'?'Male':'Female'});
  if(state.minTicket>0)out.push({k:'minTicket',txt:'Min '+fmtAED(state.minTicket)});
  const names={age:'Age',category:'Category',brand:'Brand',segment:'Segment',txnType:'Channel',country:'Country'};
  ARR_FILTERS.forEach(k=>{
    if(state[k].length){
      if(k==='brand'&&state.brand.length===1){const b=BRANDS[state.brand[0]];out.push({k,txt:b.name,dot:b.color});}
      else out.push({k,txt:names[k]+' · '+state[k].length});
    }
  });
  return out;
}
function buildToolbar(){
  const action=document.getElementById('filters-action'); action.innerHTML='';
  const bar=document.getElementById('filters'); bar.innerHTML='';
  const n=activeGroups();
  const btn=document.createElement('button');
  btn.className='filters-btn'+(n?' has':'');
  btn.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 5h18l-7 8.2V20l-4 1.5v-8.3L3 5z"/></svg>Filters${n?'<span class="chip-count">'+n+'</span>':''}`;
  btn.onclick=e=>{e.stopPropagation();openSheet();};
  action.appendChild(btn);

  const chips=document.createElement('div'); chips.className='fchips';
  chipList().forEach(c=>{
    const el=document.createElement('span'); el.className='fchip';
    el.innerHTML=(c.dot?'<span class="dot" style="background:'+c.dot+'"></span>':'')+c.txt+
      '<span class="x"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg></span>';
    el.querySelector('.x').onclick=()=>{clearGroup(c.k);apply();};
    chips.appendChild(el);
  });
  bar.appendChild(chips);

  if(n){
    const reset=document.createElement('button'); reset.className='reset';
    reset.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"/></svg>Reset filters';
    reset.onclick=()=>{clearAll();apply();};
    bar.appendChild(reset);
  }
  bar.style.display=n?'flex':'none';
}

/* ---------- inline category + brand quick-filters ---------- */
let brandPopOpen=false, brandQuery='';
function buildInlineFilters(){
  const cats=document.getElementById('if-cats'); if(!cats)return;
  cats.innerHTML='';
  const all=document.createElement('div'); all.className='if-cat'+(state.category.length===0?' on':'');
  all.innerHTML='<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span>All';
  all.onclick=()=>{if(state.category.length){state.category=[];pruneBrandsToCategory();brandPopOpen=false;apply();}};
  cats.appendChild(all);
  CATEGORIES.forEach(c=>{
    const el=document.createElement('div'); el.className='if-cat'+(state.category.includes(c)?' on':'');
    el.innerHTML='<span class="ic">'+(CAT_ICONS[c]||'')+'</span>'+c;
    el.onclick=()=>{toggleArr('category',c);pruneBrandsToCategory();brandPopOpen=false;apply();};
    cats.appendChild(el);
  });

  const bwrap=document.getElementById('if-brand'); bwrap.innerHTML='';
  const n=state.brand.length;
  const btn=document.createElement('button'); btn.className='if-brand-btn'+(n?' has':'');
  btn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/></svg>'+
    (n?n+' brand'+(n>1?'s':''):'All brands')+
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  const pop=document.createElement('div'); pop.className='if-brand-pop'+(brandPopOpen?' open':'');
  const allowed=state.category.length?BRANDS.filter(b=>state.category.includes(b.category)):BRANDS;
  const search=document.createElement('input'); search.type='text'; search.className='brand-search'; search.placeholder='Search brands\u2026'; search.value=brandQuery;
  const pills=document.createElement('div'); pills.className='optpills';
  allowed.forEach(b=>{
    const p=pill(b.name,state.brand.includes(b.id),b.color); p.dataset.name=b.name.toLowerCase();
    p.onclick=e=>{e.stopPropagation();toggleArr('brand',b.id);brandPopOpen=true;dataRefresh();};
    pills.appendChild(p);
  });
  const filterPills=()=>{const q=brandQuery.trim().toLowerCase();[...pills.children].forEach(p=>p.style.display=p.dataset.name.includes(q)?'':'none');};
  search.oninput=()=>{brandQuery=search.value;filterPills();};
  search.onclick=e=>e.stopPropagation();
  pop.appendChild(search); pop.appendChild(pills);
  btn.onclick=e=>{e.stopPropagation();const willOpen=!pop.classList.contains('open');
    document.querySelectorAll('.if-brand-pop.open,.why-pop.open').forEach(x=>x.classList.remove('open'));
    brandPopOpen=willOpen; pop.classList.toggle('open',willOpen);};
  bwrap.appendChild(btn); bwrap.appendChild(pop);
  if(brandQuery)filterPills();
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.if-brand')){brandPopOpen=false;document.querySelectorAll('.if-brand-pop.open').forEach(x=>x.classList.remove('open'));}
});
const FSECS=[
  {id:'period',type:'single',label:'Time period',icon:IC.cal,opts:Object.entries(PERIODS).map(([k,v])=>[k,v[0]]),get:()=>state.period,set:v=>state.period=v},
  {id:'gender',type:'single',label:'Gender',icon:IC.gender,opts:[['all','All'],['male','Male'],['female','Female']],get:()=>state.gender,set:v=>state.gender=v},
  {id:'age',type:'multi',label:'Age group',icon:IC.age,opts:AGE_BANDS.map(a=>[a,a])},
  {id:'minTicket',type:'range',label:'Minimum avg ticket',icon:IC.amt},
  {id:'category',type:'multi',label:'Category',icon:IC.cat,opts:CATEGORIES.map(c=>[c,c])},
  {id:'brand',type:'brand',label:'Brand',icon:IC.brand},
  {id:'segment',type:'multi',label:'Customer segment',icon:IC.seg,opts:SEGMENTS.map(s=>[s,s])},
  {id:'txnType',type:'multi',label:'Channel',icon:IC.ch,opts:TXN_TYPES.map(t=>[t,t])},
  {id:'country',type:'multi',label:'Country',icon:IC.country,opts:COUNTRIES.map(c=>[c,c])}
];
const TICK='<span class="tick"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>';
const CAT_ICONS={
 "Shopping":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h7.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg>',
 "Dining":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11M16 3c-1.5 0-2.5 1.8-2.5 4.5S14.5 12 16 12s2.5-1.8 2.5-4.5S17.5 3 16 3zM16 12v9"/></svg>',
 "Services":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6L3 18l3 3 6.9-6.9a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2 2.3-2.3z"/></svg>',
 "Groceries":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 8h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 8z"/><path d="M8 8l2-4M16 8l-2-4M9 12v4M15 12v4"/></svg>',
 "Travel":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 16l7-2 5-9 1.5.6L15 13l4-1 2-3 1.3.5-1.6 5L3 19v-3z"/></svg>',
 "Wellness":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 1-.3 2-.8 3H15l-1.5 2.5L10 9l-2 4H5.5"/></svg>',
 "Entertainment":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l3-4 4 4M10 8l3-4 4 4M3 8l4-4"/></svg>',
 "Transportation":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M4 11h16v5H4zM4 16v2M20 16v2"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/></svg>',
 "Savings & Investments":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 2 2 4-5"/></svg>'
};
function pill(label,sel,dot){
  const el=document.createElement('div'); el.className='optpill'+(sel?' sel':'');
  el.innerHTML=(dot?'<span class="dot" style="background:'+dot+'"></span>':'')+label+TICK;
  return el;
}
function buildSheet(){
  const body=document.getElementById('sheet-body');
  const keepScroll=body.scrollTop;
  body.innerHTML='';
  FSECS.forEach(f=>{
    const sec=document.createElement('div'); sec.className='fsec';
    const cnt=f.type==='multi'||f.type==='brand'?state[f.id].length:0;
    sec.innerHTML=`<div class="fsec-h">${f.icon}${f.label}${cnt?'<span class="cnt">'+cnt+' selected</span>':''}</div>`;
    if(f.type==='range'){
      const wrap=document.createElement('div'); wrap.className='fl-amt';
      wrap.innerHTML=`<div class="row"><span>Threshold</span><b id="amt-v">${state.minTicket?fmtAED(state.minTicket):'Any'}</b></div>
        <input type="range" min="0" max="400" step="10" value="${state.minTicket}">
        <div class="row" style="margin:8px 0 0;color:var(--faint);font-size:11px"><span>Any</span><span>AED 400+</span></div>`;
      const inp=wrap.querySelector('input');
      inp.oninput=()=>{wrap.querySelector('#amt-v').textContent=+inp.value?fmtAED(+inp.value):'Any';};
      inp.onchange=()=>{state.minTicket=+inp.value;dataRefresh();};
      sec.appendChild(wrap);
    }else{
      const pills=document.createElement('div'); pills.className='optpills';
      if(f.type==='single'){
        f.opts.forEach(([v,l])=>{
          const p=pill(l,f.get()===v);
          p.onclick=()=>{f.set(v);[...pills.children].forEach(c=>c.classList.remove('sel'));p.classList.add('sel');dataRefresh();};
          pills.appendChild(p);
        });
      }else if(f.type==='brand'){
        const allowed=state.category.length?BRANDS.filter(b=>state.category.includes(b.category)):BRANDS;
        if(state.category.length){
          const h=sec.querySelector('.fsec-h');
          const hint=document.createElement('span'); hint.className='fsec-hint';
          hint.textContent='in '+(state.category.length===1?state.category[0]:state.category.length+' categories');
          h.appendChild(hint);
        }
        const search=document.createElement('input');
        search.type='text'; search.className='brand-search'; search.placeholder='Search brands\u2026';
        sec.appendChild(search);
        const empty=document.createElement('div'); empty.className='brand-empty'; empty.textContent='No brands match.'; empty.style.display='none';
        allowed.forEach(b=>{
          const p=pill(b.name,state.brand.includes(b.id),b.color);
          p.dataset.name=b.name.toLowerCase();
          p.onclick=()=>{toggleArr('brand',b.id);p.classList.toggle('sel');refreshSecCount(sec,'brand');dataRefresh();};
          pills.appendChild(p);
        });
        search.oninput=()=>{
          const q=search.value.trim().toLowerCase();
          let shown=0;
          [...pills.children].forEach(p=>{const m=p.dataset.name.includes(q);p.style.display=m?'':'none';if(m)shown++;});
          empty.style.display=shown?'none':'block';
        };
        sec.appendChild(pills);
        sec.appendChild(empty);
        body.appendChild(sec);
        return;
      }else{
        f.opts.forEach(([v,l])=>{
          const p=pill(l,state[f.id].includes(v));
          if(f.id==='category'){p.classList.add('cat-pill');p.insertAdjacentHTML('afterbegin','<span class="cat-ic">'+(CAT_ICONS[v]||'')+'</span>');}
          p.onclick=()=>{
            toggleArr(f.id,v);p.classList.toggle('sel');refreshSecCount(sec,f.id);
            if(f.id==='category'){pruneBrandsToCategory();dataRefresh();buildSheet();}
            else dataRefresh();
          };
          pills.appendChild(p);
        });
      }
      sec.appendChild(pills);
    }
    body.appendChild(sec);
  });
  body.scrollTop=keepScroll;
}
function refreshSecCount(sec,id){
  const h=sec.querySelector('.fsec-h'); let c=h.querySelector('.cnt');
  const n=state[id].length;
  if(n){if(!c){c=document.createElement('span');c.className='cnt';h.appendChild(c);}c.textContent=n+' selected';}
  else if(c)c.remove();
}
function toggleArr(id,v){const a=state[id];const i=a.indexOf(v); if(i<0)a.push(v); else a.splice(i,1);}
function pruneBrandsToCategory(){
  if(!state.category.length)return;
  state.brand=state.brand.filter(id=>state.category.includes(BRANDS[id].category));
}

const sheet=document.getElementById('filter-sheet'), sheetScrim=document.getElementById('sheet-scrim');
function openSheet(){buildSheet();sheet.classList.add('open');sheetScrim.classList.add('open');}
function closeSheet(){sheet.classList.remove('open');sheetScrim.classList.remove('open');}
document.getElementById('sheet-close').onclick=closeSheet;
document.getElementById('sheet-apply').onclick=closeSheet;
sheetScrim.onclick=closeSheet;
document.getElementById('sheet-reset').onclick=()=>{clearAll();apply();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});

/* ============================================================
   DETAIL PANEL
   ============================================================ */
const panel=document.getElementById('panel'), scrim=document.getElementById('scrim');
function openPanel(){panel.classList.add('open');scrim.classList.add('open');}
function closePanel(){panel.classList.remove('open','wide','modal');panel.style.transform='';scrim.classList.remove('open');}
window.closePanel=closePanel;
scrim.onclick=closePanel;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel();});

/* ---- SLI helper renderers ---- */
function sliKpi(label,val){
  return `<div class="sli-kpi"><div class="sli-kpi-k">${label}</div><div class="sli-kpi-v">${val}</div></div>`;
}
function sliSkpi(label,val){
  return `<div class="sli-skpi"><div class="sli-skpi-k">${label}</div><div class="sli-skpi-v">${val}</div></div>`;
}

function metricCard(k,label,val,delta){
  return `<div class="metric-card"><div class="k">${label}</div><div class="v">${val}</div>
    ${delta!==undefined?`<div class="d ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}% vs prev</div>`:''}</div>`;
}
function splitBar(m,col1,col2){
  return `<div class="split-bar"><div style="width:${m}%;background:#2A8FE0">${m}%</div>
    <div style="width:${100-m}%;background:#E83C82">${100-m}%</div></div>
    <div class="split-legend"><span><i style="background:#2A8FE0"></i>Male</span><span><i style="background:#E83C82"></i>Female</span></div>`;
}
function ageRows(age){
  return `<div class="age-rows">${AGE_BANDS.map((b,i)=>`<div class="age-row"><span>${b}</span>
    <div class="trk"><div class="fil" style="width:${age[i]}%"></div></div><span class="pc">${age[i]}%</span></div>`).join('')}</div>`;
}
function spark(trend,cur){
  const mx=Math.max(...trend);
  const labels=['Jan','Feb','Mar','Apr','May','Jun'];
  return `<div class="spark">${trend.map((v,i)=>`<div class="b ${i===trend.length-1?'cur':''}" style="height:${v/mx*100}%"></div>`).join('')}</div>
    <div class="spark-x">${labels.map(l=>`<span>${l}</span>`).join('')}</div>`;
}
function openShop(s){
  panel.className='panel';
  const b=brandById(s.brandId);
  panel.innerHTML=`
    <div class="panel-head">
      <div class="top">
        <div class="mk" style="background:${s.color}">${s.abbr}</div>
        <div><h3>${s.brand}</h3>
          <div class="loc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.2"/></svg>${s.addr}</div>
          <span class="cat">${s.category} · ${s.country}</span>
        </div>
        <button class="close" onclick="closePanel()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </div>
    <div class="panel-body">
      <div class="metrics-grid">
        ${metricCard('spend','Total spend',fmtAED(s.spend*periodMult()),s.delta)}
        ${metricCard('txns','Transactions',fmtNum(s.txns*periodMult()))}
        ${metricCard('cust','Customers',fmtNum(s.customers*periodMult()))}
        ${metricCard('avg','Avg ticket',fmtAED(s.avgTicket))}
      </div>
      <div class="psec"><h4>Gender split <span class="hint">share of customers</span></h4>${splitBar(s.male)}</div>
      <div class="psec"><h4>Age distribution</h4>${ageRows(s.age)}</div>
      <div class="psec"><h4>Spend trend <span class="hint">last 6 months</span></h4>${spark(s.trend)}</div>
      <div class="psec"><h4>Customer profile</h4>
        <div class="cats">
          <div class="catr"><span class="nm">Dominant segment</span><span class="v">${s.segment}</span></div>
          <div class="catr"><span class="nm">Primary channel</span><span class="v">${s.txnType}</span></div>
          <div class="catr"><span class="nm">Online share</span><span class="v">${s.onlineShare}%</span></div>
        </div>
      </div>
    </div>
    <div class="panel-foot">
      <button class="btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>Export</button>
      <button class="btn primary"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Add to acquiring list</button>
    </div>`;
  openPanel();
  map.flyTo([s.lat,s.lng],Math.max(map.getZoom(),9),{duration:.6});
}
function openBrand(brandId,vis){
  const b=brandById(brandId);
  const m=METRICS[state.metric];

  /* all visible stores for this brand, sorted by current metric */
  const listShops=vis.filter(s=>s.brandId===brandId).sort((a,x)=>shopVal(x)-shopVal(a));
  if(!listShops.length)return;

  /* context title: city → country → brand name depending on spread */
  const uniqueCities=[...new Set(listShops.map(s=>s.city))];
  const uniqueCountries=[...new Set(listShops.map(s=>s.country))];
  let displayTitle,displaySub;
  if(uniqueCities.length===1){
    displayTitle=uniqueCities[0];
    displaySub=listShops[0].country+' · '+listShops.length+' store'+(listShops.length===1?'':'s');
  }else if(uniqueCountries.length===1){
    displayTitle=uniqueCountries[0];
    displaySub=uniqueCities.length+' cities · '+listShops.length+' stores';
  }else{
    displayTitle=b.name;
    displaySub=uniqueCountries.length+' countries · '+listShops.length+' stores in view';
  }

  /* view-level aggregates */
  const totalSpend=listShops.reduce((x,s)=>x+s.spend*periodMult(),0);
  const totalTxns=listShops.reduce((x,s)=>x+s.txns*periodMult(),0);
  const totalCust=listShops.reduce((x,s)=>x+s.customers*periodMult(),0);
  const avgTicket=Math.round(listShops.reduce((x,s)=>x+s.avgTicket,0)/listShops.length);

  panel.className='panel wide modal';
  panel.innerHTML=`
    <div class="sli-panel">
      <div class="sli-head">
        <div class="sli-label">Store-level Intelligence</div>
        <div class="sli-city-row">
          <div>
            <h2 class="sli-city">${displayTitle}</h2>
            <div class="sli-head-sub">${displaySub}</div>
          </div>
          <button class="sli-head-close" onclick="closePanel()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>
      <div class="sli-kpis">
        ${sliKpi('Total spend',fmtAED(totalSpend))}
        ${sliKpi('Transactions',fmtNum(totalTxns))}
        ${sliKpi('Customers',fmtNum(totalCust))}
        ${sliKpi('Avg ticket',fmtAED(avgTicket))}
        ${sliKpi('Stores in view',listShops.length)}
      </div>
      <div class="sli-body">
        <div class="sli-stores">
          <div class="sli-stores-head">Stores (${listShops.length}) <span class="sli-sort-hint">by ${m.short.toLowerCase()}</span></div>
          <div class="sli-list" id="sli-list"></div>
        </div>
        <div class="sli-detail" id="sli-detail"></div>
      </div>
    </div>`;

  let activeIdx=0;

  function renderList(){
    const el=document.getElementById('sli-list');
    if(!el)return;
    el.innerHTML=listShops.map((s,i)=>{
      const val=shopVal(s);
      const valStr=state.metric==='avgTicket'?fmtAED(val):state.metric==='spend'?fmtAED(val):fmtNum(val);
      const txnStr=fmtNum(s.txns*periodMult())+' txns';
      return `<div class="sli-store-row${i===activeIdx?' active':''}" data-i="${i}">
        <div class="sli-sr-mk" style="background:${s.color}">${s.abbr}</div>
        <div class="sli-sr-mid">
          <div class="sli-sr-name">${s.area}</div>
          <div class="sli-sr-code">${s.code} · ${s.city}</div>
        </div>
        <div class="sli-sr-val">
          <div class="sli-sr-amt">${valStr}</div>
          <div class="sli-sr-txns">${txnStr}</div>
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('.sli-store-row').forEach(row=>{
      row.onclick=()=>{activeIdx=+row.dataset.i;renderList();renderDetail();
        const s=listShops[activeIdx];map.flyTo([s.lat,s.lng],Math.max(map.getZoom(),10),{duration:.5});};
    });
  }

  function renderDetail(){
    const el=document.getElementById('sli-detail');
    if(!el)return;
    const s=listShops[activeIdx];
    const rank=activeIdx+1;
    const contrib=totalSpend>0?Math.round(s.spend*periodMult()/totalSpend*1000)/10:0;
    el.innerHTML=window.StoreDetail.renderContent(s,{
      rank, total:listShops.length, contrib,
      displaySpend:s.spend*periodMult(),
      displayTxns:s.txns*periodMult(),
      displayCustomers:s.customers*periodMult()
    });
  }

  renderList();
  renderDetail();
  openPanel();
}

/* ============================================================
   METRIC SWITCHER + WHY POPOVER + RESET VIEW
   ============================================================ */
document.querySelectorAll('#metric-seg button').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('#metric-seg button').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on'); state.metric=btn.dataset.m;
    refreshMarkers();refreshHeat();refreshChoropleth();updateBoard();
  };
});
const whyBtn=document.getElementById('why-btn'),whyPop=document.getElementById('why-pop');
whyBtn.onclick=e=>{e.stopPropagation();whyPop.classList.toggle('open');};
document.addEventListener('click',e=>{if(!whyBtn.contains(e.target))whyPop.classList.remove('open');});
document.getElementById('reset-view').onclick=()=>map.flyTo([24,20],2.6,{duration:.6});

let toastTimer;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200);}

/* ============================================================
   APPLY + BOARD COLLAPSE
   ============================================================ */
function dataRefresh(){
  recompute();
  refreshMarkers();refreshBuffers();refreshHeat();refreshChoropleth();updateBoard();
  buildToolbar();buildInlineFilters();
}
function apply(){
  dataRefresh();
  if(sheet.classList.contains('open'))buildSheet();
}

/* board collapse / expand */
const geoBody=document.querySelector('.geo-body');
function setBoardCollapsed(c){
  geoBody.classList.toggle('board-collapsed',c);
  setTimeout(()=>{map.invalidateSize();updateBoard();if(state.layers.buffer)refreshBuffers();},320);
}
document.getElementById('board-collapse').onclick=()=>setBoardCollapsed(true);
document.getElementById('board-reopen').onclick=()=>setBoardCollapsed(false);

/* init */
buildLayers();
updateLayerCount();

/* deep-link: ?brand=ID or ?cat=NAME pre-applies a filter from brand/category pages */
(function deepLink(){
  const q=new URLSearchParams(location.search);
  const bid=q.get('brand'), cat=q.get('cat');
  if(cat&&CATEGORIES.includes(cat))state.category=[cat];
  if(bid!==null&&bid!==''&&BRANDS[+bid]){state.brand=[+bid];}
  const ctry=q.get('country');
  if(ctry&&COUNTRIES.includes(ctry))state.country=[ctry];
})();

buildToolbar();
buildInlineFilters();
recompute();
refreshMarkers();
map.whenReady(()=>{setTimeout(()=>{map.invalidateSize();updateBoard();},120);});

window.__geo={map,openShop,openBrand,state,SHOPS,visibleShops,apply,openSheet,setBoardCollapsed};
