/* ============================================================
   Lune — Brands & Categories explorers + detail pages
   ============================================================ */
(function(){
const {BRANDS,CATEGORIES,SHOPS,fmtAED,fmtNum}=window.GEO;
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const qs=new URLSearchParams(location.search);
/* spend spectrum for location bubbles */
const VOLc=[[197,231,213],[95,195,154],[31,169,122],[224,162,30],[226,98,46],[176,42,38]];
function volColor(t){t=Math.max(0,Math.min(1,t));const x=t*(VOLc.length-1),i=Math.floor(x),f=x-i,a=VOLc[i],b=VOLc[Math.min(i+1,VOLc.length-1)];
  return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;}

/* ---- category icons (inline) ---- */
const CAT_ICONS={
 "Shopping":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.2 12.2a1.5 1.5 0 0 0 1.5 1.3h7.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></svg>',
 "Dining":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3v7a2 2 0 0 0 4 0V3M7 10v11M16 3c-1.5 0-2.5 1.8-2.5 4.5S14.5 12 16 12s2.5-1.8 2.5-4.5S17.5 3 16 3zM16 12v9"/></svg>',
 "Services":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.6L3 18l3 3 6.9-6.9a3.5 3.5 0 0 0 4.6-4.6l-2.3 2.3-2-2 2.3-2.3z"/></svg>',
 "Groceries":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 8h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 8z"/><path d="M8 8l2-4M16 8l-2-4"/></svg>',
 "Travel":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 16l7-2 5-9 1.5.6L15 13l4-1 2-3 1.3.5-1.6 5L3 19v-3z"/></svg>',
 "Wellness":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 1-.3 2-.8 3H15l-1.5 2.5L10 9l-2 4H5.5"/></svg>',
 "Entertainment":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l3-4 4 4M10 8l3-4 4 4"/></svg>',
 "Transportation":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11M4 11h16v5H4zM4 16v2M20 16v2"/></svg>',
 "Savings & Investments":'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15l3-3 2 2 4-5"/></svg>'
};
/* subcategories per category */
const SUBCATS={
 "Dining":["Restaurants","Food Delivery","Coffee Shops","Fast Food","Bakeries & Desserts","Catering"],
 "Shopping":["Apparel","Footwear","Electronics","Department Stores","Home & Furniture","Marketplaces","Sporting Goods","Beauty Retail"],
 "Services":["Telecom","Utilities","Postal & Courier","Tolls"],
 "Groceries":["Hypermarkets","Supermarkets","Specialty Grocery"],
 "Travel":["Airlines","Hotels","Booking Platforms"],
 "Wellness":["Pharmacies","Beauty & Cosmetics","Fitness","Supplements"],
 "Entertainment":["Cinemas","Music & Media","Gaming","Live Events"],
 "Transportation":["Ride-hailing","Fuel","Car Rental"],
 "Savings & Investments":["Banking","Trading & Investments"]
};

/* ---- aggregation ---- */
function brandAgg(shops){
  shops=shops||SHOPS;
  const m={};
  shops.forEach(s=>{const a=m[s.brandId]||(m[s.brandId]={brand:BRANDS[s.brandId],spend:0,txns:0,customers:0});
    a.spend+=s.spend;a.txns+=s.txns;a.customers+=s.customers;});
  return Object.values(m).map(a=>({...a,
    avgTicket:a.spend/a.txns, spendPerCust:a.spend/a.customers,
    id:a.brand.id, name:a.brand.name, abbr:a.brand.abbr, color:a.brand.color, category:a.brand.category}));
}
function catAgg(){
  const m={};
  SHOPS.forEach(s=>{const a=m[s.category]||(m[s.category]={category:s.category,spend:0,txns:0,customers:0,brands:new Set()});
    a.spend+=s.spend;a.txns+=s.txns;a.customers+=s.customers;a.brands.add(s.brandId);});
  return CATEGORIES.map(c=>m[c]).filter(Boolean).map(a=>({...a,brandCount:a.brands.size,subCount:(SUBCATS[a.category]||[]).length}));
}
/* monthly series for a brand or category (deterministic) */
function monthly(seed,total){
  const r=rng(seed);const raw=MONTHS.map(()=>0.55+r());const sum=raw.reduce((a,b)=>a+b,0);
  return raw.map(v=>Math.round(v/sum*total));
}
function textSeed(value){
  return [...String(value||'')].reduce((n,ch)=>((n*31)+ch.charCodeAt(0))|0,0);
}
function totals(shops){
  return shops.reduce((a,s)=>{
    a.spend+=s.spend;a.txns+=s.txns;a.customers+=s.customers;
    return a;
  },{spend:0,txns:0,customers:0});
}

/* ============================================================ */
const page=document.body.dataset.page;

/* ---------------- BRAND EXPLORER ---------------- */
if(page==='brands'){
  let rows=brandAgg();
  const tbody=document.getElementById('rows');
  let q='', cat='';
  function render(){
    let r=rows.filter(x=>x.name.toLowerCase().includes(q)&&(!cat||x.category===cat));
    r.sort((a,b)=>b.spend-a.spend);
    tbody.innerHTML=r.map(x=>`
      <tr data-id="${x.id}">
        <td class="c-brand"><span class="mono" style="background:${x.color}">${x.abbr}</span>${x.name}</td>
        <td class="c-mut">${x.category}</td>
        <td class="num">${fmtAED(x.spend)}</td>
        <td class="num">${fmtNum(x.txns)}</td>
        <td class="num">${fmtNum(x.customers)}</td>
        <td class="num">${fmtAED(x.spendPerCust)}</td>
      </tr>`).join('');
    [...tbody.querySelectorAll('tr')].forEach(tr=>tr.onclick=()=>location.href='Brand.html?brand='+tr.dataset.id);
    document.getElementById('count').textContent=r.length+'/'+rows.length;
  }
  const si=document.getElementById('search'); if(si)si.oninput=()=>{q=si.value.trim().toLowerCase();render();};
  buildCatSelect(document.getElementById('cat-select'),v=>{cat=v;render();});
  render();
}

/* ---------------- CATEGORIES EXPLORER ---------------- */
if(page==='categories'){
  const rows=catAgg();
  const tbody=document.getElementById('rows');
  tbody.innerHTML=rows.map(x=>`
    <tr data-cat="${x.category}">
      <td class="c-brand"><span class="cat-ic">${CAT_ICONS[x.category]||''}</span>${x.category}</td>
      <td class="num">${fmtAED(x.spend)}</td>
      <td class="num">${fmtNum(x.txns)}</td>
      <td class="num">${fmtNum(x.customers)}</td>
      <td class="num c-sub">${x.subCount}</td>
    </tr>`).join('');
  [...tbody.querySelectorAll('tr')].forEach(tr=>tr.onclick=()=>location.href='Category.html?cat='+encodeURIComponent(tr.dataset.cat));
  document.getElementById('count').textContent=rows.length+'/'+rows.length;
}

/* ---------------- BRAND DETAIL ---------------- */
if(page==='brand'){
  const id=+qs.get('brand')||0;
  const b=BRANDS[id];
  const allBrandShops=SHOPS.filter(s=>s.brandId===id);
  document.title='Lune — '+b.name;
  document.getElementById('title').textContent=b.name;
  document.getElementById('subtitle').textContent='Category: '+b.category;
  document.getElementById('mono').textContent=b.abbr;
  document.getElementById('mono').style.background=b.color;
  const bt=document.getElementById('bar-title'); if(bt)bt.textContent=b.name+': Spend over time';
  const ts=document.getElementById('txn-sub'); if(ts)ts.textContent=b.name+' Transaction Records';

  function renderBrandScope(sc,country){
    const agg=totals(sc);
    const seed=textSeed(country);
    kpi('k-spend',fmtAED(agg.spend)); kpi('k-txns',fmtNum(agg.txns));
    kpi('k-cust',fmtNum(agg.customers));
    kpi('k-avg',fmtAED(agg.customers?agg.spend/agg.customers:0));
    window.Charts.bar(document.getElementById('chart-bar'),monthly(id*7+seed+1,agg.spend),MONTHS);
    window.Charts.area(document.getElementById('chart-area'),monthly(id*13+seed+5,agg.txns),MONTHS);
    renderBrandTransactions(sc,country);
    renderGeoInsights(sc,country,id*43+11,b.color,'brand');
  }

  function renderBrandTransactions(sc,country){
    const tb=document.getElementById('txn-rows');
    if(!sc.length){
      tb.innerHTML='<tr><td colspan="3" class="c-mut">No transactions for this country.</td></tr>';
      return;
    }
    const r=rng(id*101+textSeed(country)+3);
    tb.innerHTML=Array.from({length:10}).map(()=>{
      const shop=sc[Math.floor(r()*sc.length)];
      const cust='CUST-'+(100000+Math.floor(r()*900000));
      const d=new Date(2025,Math.floor(r()*6)+1,Math.floor(r()*27)+1);
      const amt=Math.max(1,Math.round(shop.avgTicket*(0.45+r()*1.1)));
      return `<tr><td>${cust}</td><td class="c-mut">${d.toISOString().slice(0,10)}</td><td class="num">${fmtAED(amt)}</td></tr>`;
    }).join('');
  }

  renderBrandScope(allBrandShops,'');
  // location widget
  locWidget(allBrandShops,'brand='+id,b.color,{onScopeChange:renderBrandScope});
}

/* ---------------- CATEGORY DETAIL ---------------- */
if(page==='category'){
  const cat=qs.get('cat')||'Dining';
  document.title='Lune — '+cat;
  document.getElementById('title').textContent=cat;
  const inCat=SHOPS.filter(s=>s.category===cat);
  document.getElementById('chart-title').textContent=cat+': Spend Over Time';
  document.getElementById('share-title').textContent='Brand Share in '+cat;
  document.getElementById('subcat-title').textContent='Subcategories in '+cat;
  document.getElementById('brands-title').textContent='Brands in '+cat;
  const subs=SUBCATS[cat]||[];
  document.getElementById('subcat-count').textContent=subs.length+' Subcategories';

  function renderCategoryScope(sc,country){
    const agg=totals(sc);
    const brandIds=[...new Set(sc.map(s=>s.brandId))];
    const seed=textSeed(country);
    kpi('k-spend',fmtAED(agg.spend)); kpi('k-txns',fmtNum(agg.txns));
    kpi('k-cust',fmtNum(agg.customers)); kpi('k-brands',fmtNum(brandIds.length));
    window.Charts.bar(document.getElementById('chart-bar'),monthly(cat.length*17+seed+2,agg.spend),MONTHS);

    const ba=brandAgg(sc).filter(x=>x.category===cat).sort((a,b)=>b.spend-a.spend);
    const top=ba.slice(0,9);
    window.Charts.donut(document.getElementById('donut'),top.map(x=>({label:x.name,value:x.spend,color:x.color})));
    document.getElementById('donut-legend').innerHTML=top.length?top.map(x=>
      `<div class="lg"><span class="d" style="background:${x.color}"></span>${x.name}</div>`).join('')
      :'<div class="c-mut">No brand data for this country.</div>';

    const r=rng(cat.length*31+seed+9);
    const weights=subs.map(()=>0.4+r());
    const wsum=weights.reduce((a,b)=>a+b,0)||1;
    document.getElementById('subcat-rows').innerHTML=subs.map((sname,i)=>{
      const sp=agg.spend*weights[i]/wsum, tx=agg.txns*weights[i]/wsum, cu=agg.customers*weights[i]/wsum;
      return `<tr><td>${sname}</td><td class="num">${fmtAED(sp)}</td><td class="num">${fmtNum(tx)}</td><td class="num">${fmtNum(cu)}</td></tr>`;
    }).join('');

    const brandsRows=document.getElementById('brands-rows');
    brandsRows.innerHTML=ba.length?ba.slice(0,8).map(x=>
      `<tr data-id="${x.id}"><td class="c-brand"><span class="mono sm" style="background:${x.color}">${x.abbr}</span>${x.name}</td>
       <td class="num">${fmtAED(x.spend)}</td><td class="num">${fmtNum(x.txns)}</td><td class="num">${fmtNum(x.customers)}</td></tr>`).join('')
      :'<tr><td colspan="4" class="c-mut">No brands for this country.</td></tr>';
    [...brandsRows.querySelectorAll('tr[data-id]')].forEach(tr=>tr.onclick=()=>location.href='Brand.html?brand='+tr.dataset.id);
    renderGeoInsights(sc,country,cat.length*59+17,'#13A07B','category');
  }

  renderCategoryScope(inCat,'');
  // location widget
  locWidget(inCat,'cat='+encodeURIComponent(cat),'#13A07B',{showBrand:true,onScopeChange:renderCategoryScope});
}

/* ---- helpers ---- */
function kpi(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

function renderGeoInsights(shops,country,baseSeed,accent,kind){
  const perf=document.getElementById('geo-performance');
  const opp=document.getElementById('geo-opportunities');
  const origin=document.getElementById('geo-origin');
  const scopeLabel=document.getElementById('geo-scope');
  if(!perf||!opp||!origin)return;
  if(scopeLabel)scopeLabel.textContent=country?'Geographic performance within '+country:'Geographic performance across all countries';
  if(!shops.length){
    const empty='<div class="insight-empty">No geographic data for this selection.</div>';
    perf.innerHTML=opp.innerHTML=origin.innerHTML=empty;
    return;
  }

  const cities={};
  shops.forEach(s=>{
    const c=cities[s.city]||(cities[s.city]={city:s.city,country:s.country,spend:0,txns:0,customers:0,stores:0});
    c.spend+=s.spend;c.txns+=s.txns;c.customers+=s.customers;c.stores++;
  });
  const rows=Object.values(cities).map(c=>({
    ...c,
    perStore:c.spend/c.stores,
    spendPerCustomer:c.customers?c.spend/c.customers:0
  }));
  const ranked=[...rows].sort((a,b)=>b.spend-a.spend).slice(0,5);
  const maxSpend=ranked[0]?ranked[0].spend:1;
  perf.innerHTML=ranked.map((c,i)=>`
    <div class="insight-row">
      <span class="insight-rank">${i+1}</span>
      <div class="insight-main">
        <div class="insight-name">${c.city}<small>${country?c.stores+' locations':c.country}</small></div>
        <div class="insight-track"><span class="insight-fill" style="width:${Math.max(6,c.spend/maxSpend*100)}%;background:${accent}"></span></div>
      </div>
      <div class="insight-value">${fmtAED(c.spend)}<small>${fmtAED(c.perStore)}/store</small></div>
    </div>`).join('');

  const seed=baseSeed+textSeed(country);
  const opportunityRows=rows.map(c=>{
    const r=rng(seed+textSeed(c.city));
    const growth=Math.round((5+r()*24)*10)/10;
    const demand=(c.txns/Math.max(1,c.stores))*(0.75+r()*0.5);
    const score=demand*(1+growth/100)/Math.sqrt(c.stores);
    return {...c,growth,score};
  }).sort((a,b)=>b.score-a.score).slice(0,3);
  opp.innerHTML=opportunityRows.map((c,i)=>`
    <div class="opp-row">
      <span class="opp-badge">${i===0?'HIGH':i===1?'MED':'WATCH'}</span>
      <div class="opp-copy"><b>${c.city}</b><span>${c.stores} location${c.stores===1?'':'s'} · ${fmtNum(c.txns/c.stores)} txns/store</span></div>
      <span class="opp-growth">+${c.growth.toFixed(1)}%</span>
    </div>`).join('')+
    `<div class="insight-name" style="margin-top:12px"><small>${kind==='brand'?'Opportunity combines demand, growth and current store coverage.':'Whitespace combines category demand, growth and brand coverage.'}</small></div>`;

  const r=rng(seed+991);
  const weightedOnline=shops.reduce((n,s)=>n+s.onlineShare*s.customers,0)/Math.max(1,shops.reduce((n,s)=>n+s.customers,0));
  let visitor=Math.round(10+r()*12+weightedOnline*.08);
  let nearby=Math.round(22+r()*13);
  let local=Math.max(35,100-nearby-visitor);
  const total=local+nearby+visitor;
  local=Math.round(local/total*100);nearby=Math.round(nearby/total*100);visitor=100-local-nearby;
  const repeat=Math.round(42+r()*27);
  origin.innerHTML=`
    <div class="origin-total"><b>${repeat}%</b><span>estimated repeat local customers</span></div>
    <div class="origin-bar"><span style="width:${local}%"></span><span style="width:${nearby}%"></span><span style="width:${visitor}%"></span></div>
    <div class="origin-key">
      <div><i></i><span>Local catchment <small>within 5 km</small></span><b>${local}%</b></div>
      <div><i></i><span>Nearby visitors <small>5–25 km</small></span><b>${nearby}%</b></div>
      <div><i></i><span>Travellers <small>over 25 km</small></span><b>${visitor}%</b></div>
    </div>`;
}

/* ---- location widget (top areas / stores) — brand & category pages ---- */
function locWidget(allShops, deepLink, accent, opts){
  opts=opts||{};
  const showBrand=!!opts.showBrand;
  const onScopeChange=opts.onScopeChange;
  const mapEl=document.getElementById('loc-map'); if(!mapEl)return;
  const countries=[...new Set(allShops.map(s=>s.country))].sort();
  let selCountry='';
  const STORE_ZOOM=7;

  // country dropdown in header
  buildLocCountry(countries, val=>{selCountry=val; refit(); });

  const map=L.map('loc-map',{zoomControl:true, attributionControl:false, scrollWheelZoom:false,
    doubleClickZoom:true, dragging:true, minZoom:1, maxZoom:13, zoomSnap:0.25, worldCopyJump:true}).setView([26,24],1.4);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:18}).addTo(map);
  const layer=L.layerGroup().addTo(map);
  const list=document.getElementById('loc-list');
  const cta=document.getElementById('loc-cta');
  const sub=document.getElementById('loc-sub');
  const legendB=document.querySelector('.loc-legend b');

  function scope(){return selCountry?allShops.filter(s=>s.country===selCountry):allShops;}
  function dl(){return deepLink+(selCountry?'&country='+encodeURIComponent(selCountry):'');}

  function refit(){
    const sc=scope();
    if(onScopeChange)onScopeChange(sc,selCountry);
    if(!sc.length){render();return;}
    if(selCountry){
      const grp=L.featureGroup(sc.map(s=>L.marker([s.lat,s.lng])));
      map.fitBounds(grp.getBounds().pad(0.25),{maxZoom:6,animate:false});
    }else{
      map.setView([26,24],1.4,{animate:false});
    }
    render();
  }

  function bubble(t,size){return L.divIcon({className:'',iconSize:[size,size],
    html:`<div class="gw-bubble" style="width:${size}px;height:${size}px;background:${volColor(t)}"></div>`});}

  function render(){
    layer.clearLayers();
    const z=map.getZoom(), b=map.getBounds(), sc=scope();
    const storeMode=z>=STORE_ZOOM;
    if(legendB)legendB.textContent=storeMode?'spend per store':'spend per area';

    if(storeMode){
      const vis=sc.filter(s=>b.contains([s.lat,s.lng]));
      const max=Math.max(1,...vis.map(s=>s.spend));
      vis.forEach(s=>{const t=Math.sqrt(s.spend/max);const size=Math.round(12+t*18);
        L.marker([s.lat,s.lng],{icon:bubble(t,size)}).addTo(layer)
         .bindTooltip(`<b>${showBrand?s.brand:s.area}</b><br>${showBrand?s.area+' · ':''}${s.code} · ${fmtAED(s.spend)}`,{direction:'top',offset:[0,-4]});});
      const rows=[...vis].sort((a,b)=>b.spend-a.spend).slice(0,6);
      list.innerHTML=rows.length?rows.map((s,i)=>`
        <a class="loc-row" href="Geolocation Analytics.html?${dl()}">
          <span class="loc-rk">${i+1}</span>
          <span class="loc-bar-wrap"><span class="loc-nm">${showBrand?'<span class="loc-dot" style="background:'+s.color+'"></span>':''}${showBrand?s.brand:s.area}<small>${showBrand?s.area+' · '+s.code:s.code+' · '+s.city}</small></span>
            <span class="loc-track"><span class="loc-fill" style="width:${Math.max(5,s.spend/max*100)}%;background:${showBrand?s.color:accent}"></span></span></span>
          <span class="loc-v">${fmtAED(s.spend)}<small>${fmtNum(s.txns)} txns</small></span>
        </a>`).join('')
        :`<div class="loc-empty">No stores in view — zoom out a little.</div>`;
      if(sub)sub.textContent=vis.length+' store'+(vis.length===1?'':'s')+' in view'+(selCountry?' · '+selCountry:'');
    }else{
      const m={};
      sc.forEach(s=>{const c=m[s.city]||(m[s.city]={city:s.city,country:s.country,lat:0,lng:0,n:0,spend:0,txns:0});
        c.lat+=s.lat;c.lng+=s.lng;c.n++;c.spend+=s.spend;c.txns+=s.txns;});
      const cities=Object.values(m).map(c=>({...c,lat:c.lat/c.n,lng:c.lng/c.n})).sort((a,b)=>b.spend-a.spend);
      const max=cities.length?cities[0].spend:1;
      cities.forEach(c=>{const t=Math.sqrt(c.spend/max);const size=Math.round(11+t*22);
        L.marker([c.lat,c.lng],{icon:bubble(t,size)}).addTo(layer)
         .bindTooltip(`<b>${c.city}</b><br>${c.n} stores · ${fmtAED(c.spend)}`,{direction:'top',offset:[0,-4]});});
      list.innerHTML=cities.slice(0,6).map((c,i)=>`
        <a class="loc-row" href="Geolocation Analytics.html?${dl()}">
          <span class="loc-rk">${i+1}</span>
          <span class="loc-bar-wrap"><span class="loc-nm">${c.city}<small>${c.country}</small></span>
            <span class="loc-track"><span class="loc-fill" style="width:${Math.max(5,c.spend/max*100)}%;background:${accent}"></span></span></span>
          <span class="loc-v">${fmtAED(c.spend)}<small>${c.n} stores</small></span>
        </a>`).join('');
      if(sub)sub.textContent=cities.length+' cit'+(cities.length===1?'y':'ies')+' · '+sc.length+' stores'+(selCountry?' · '+selCountry:'');
    }
    if(cta)cta.href='Geolocation Analytics.html?'+dl();
  }

  map.on('zoomend moveend',render);
  setTimeout(()=>{map.invalidateSize();render();},150);
  window.__loc={map,render};
}
function buildLocCountry(countries,cb){
  const host=document.getElementById('country-pill'); if(!host)return;
  host.style.position='relative';
  const label=host.querySelector('.cv');
  const pop=document.createElement('div'); pop.className='sel-pop country-pop';
  pop.innerHTML='<div class="opt2" data-v="">All Countries</div>'+countries.map(c=>`<div class="opt2" data-v="${c}">${c}</div>`).join('');
  host.appendChild(pop);
  host.onclick=e=>{e.stopPropagation();pop.classList.toggle('open');};
  pop.querySelectorAll('.opt2').forEach(o=>o.onclick=()=>{
    if(label)label.textContent=o.dataset.v||'All Countries';
    host.classList.toggle('has',!!o.dataset.v);
    pop.classList.remove('open');cb(o.dataset.v);});
  document.addEventListener('click',()=>pop.classList.remove('open'));
}

function buildCatSelect(el,cb){
  if(!el)return;
  const pop=document.createElement('div');pop.className='sel-pop';
  pop.innerHTML='<div class="opt2" data-v="">All categories</div>'+CATEGORIES.map(c=>`<div class="opt2" data-v="${c}">${c}</div>`).join('');
  el.appendChild(pop);
  el.onclick=e=>{e.stopPropagation();pop.classList.toggle('open');};
  pop.querySelectorAll('.opt2').forEach(o=>o.onclick=()=>{
    el.querySelector('.sel-val').textContent=o.dataset.v||'Category';
    el.classList.toggle('has',!!o.dataset.v);
    pop.classList.remove('open');cb(o.dataset.v);});
  document.addEventListener('click',()=>pop.classList.remove('open'));
}
})();
