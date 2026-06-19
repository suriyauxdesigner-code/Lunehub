/* ============================================================
   Lune Dashboard — compact Geolocation widget (entry point)
   ============================================================ */
(function(){
  const {SHOPS,BRANDS,fmtAED,fmtNum}=window.GEO;

  /* volume spectrum (matches the full map) */
  const VOL=[[197,231,213],[95,195,154],[31,169,122],[224,162,30],[226,98,46],[176,42,38]];
  function volColor(t){
    t=Math.max(0,Math.min(1,t));
    const x=t*(VOL.length-1),i=Math.floor(x),f=x-i,a=VOL[i],b=VOL[Math.min(i+1,VOL.length-1)];
    return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
  }

  /* aggregate by city */
  const byCity={};
  SHOPS.forEach(s=>{const c=byCity[s.city]||(byCity[s.city]={lat:0,lng:0,n:0,spend:0});c.lat+=s.lat;c.lng+=s.lng;c.n++;c.spend+=s.spend;});
  const cities=Object.values(byCity).map(c=>({lat:c.lat/c.n,lng:c.lng/c.n,spend:c.spend}));
  const maxSpend=Math.max(...cities.map(c=>c.spend));

  /* mini map — non-interactive preview */
  const map=L.map('gw-map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,
    doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false,zoomSnap:0.1}).setView([28,18],1.3);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:6}).addTo(map);
  cities.forEach(c=>{
    const t=Math.sqrt(c.spend/maxSpend);
    const size=Math.round(13+t*24);
    L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',iconSize:[size,size],
      html:`<div class="gw-bubble" style="width:${size}px;height:${size}px;background:${volColor(t)}"></div>`})}).addTo(map);
  });
  setTimeout(()=>map.invalidateSize(),120);

  /* headline + top brands */
  const total=SHOPS.reduce((a,s)=>a+s.spend,0);
  document.getElementById('gw-total').textContent=fmtAED(total);
  document.getElementById('gw-sub').textContent='total spend · '+fmtNum(SHOPS.length)+' stores · 43 cities';

  const byBrand={}; SHOPS.forEach(s=>byBrand[s.brandId]=(byBrand[s.brandId]||0)+s.spend);
  const top=Object.entries(byBrand).map(([id,v])=>({b:BRANDS[+id],v})).sort((a,b)=>b.v-a.v).slice(0,3);
  document.getElementById('gw-top').innerHTML=top.map((t,i)=>
    `<div class="gw-row"><span class="gw-rk">${i+1}</span><span class="gw-mk" style="background:${t.b.color}">${t.b.abbr}</span><span class="gw-nm">${t.b.name}</span><span class="gw-v">${fmtAED(t.v)}</span></div>`).join('');

  /* simple KPI tiles */
  const txns=SHOPS.reduce((a,s)=>a+s.txns,0);
  const cust=SHOPS.reduce((a,s)=>a+s.customers,0);
  document.getElementById('kpi-spend').textContent=fmtAED(total);
  document.getElementById('kpi-txns').textContent=fmtNum(txns);
  document.getElementById('kpi-cust').textContent=fmtNum(cust);
})();
