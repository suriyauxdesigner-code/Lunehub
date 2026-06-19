/* ============================================================
   Lune Dashboard — compact Geolocation widget (entry point)
   ============================================================ */
(function(){
  const {SHOPS,fmtAED,fmtNum}=window.GEO;

  /* volume spectrum (matches the full map) */
  const VOL=[[197,231,213],[95,195,154],[31,169,122],[224,162,30],[226,98,46],[176,42,38]];
  function volColor(t){
    t=Math.max(0,Math.min(1,t));
    const x=t*(VOL.length-1),i=Math.floor(x),f=x-i,a=VOL[i],b=VOL[Math.min(i+1,VOL.length-1)];
    return `rgb(${Math.round(a[0]+(b[0]-a[0])*f)},${Math.round(a[1]+(b[1]-a[1])*f)},${Math.round(a[2]+(b[2]-a[2])*f)})`;
  }

  /* ISO-2 country codes for the cities in the dataset */
  const CC={
    'United Arab Emirates':'AE','Saudi Arabia':'SA','Qatar':'QA','Kuwait':'KW',
    'Egypt':'EG','Turkey':'TR','United Kingdom':'GB','France':'FR','Germany':'DE',
    'Spain':'ES','Italy':'IT','Netherlands':'NL','Switzerland':'CH','Sweden':'SE',
    'United States of America':'US','Canada':'CA','Mexico':'MX','Brazil':'BR',
    'Argentina':'AR','India':'IN','Singapore':'SG','Thailand':'TH','Indonesia':'ID',
    'Japan':'JP','China':'CN','South Korea':'KR','Australia':'AU',
    'South Africa':'ZA','Russia':'RU'
  };

  /* muted geo-palette for country/city markers */
  const GEO_COLORS=['#4A7CC7','#5C8FA0','#6B9E7F','#4E8C6A','#7A8FB5','#5A9A88',
    '#6679B5','#5B8EA6','#7B6EA0','#4B8CB5','#6EA07A','#7A7ABF','#5E8DB5','#8A7A6E'];
  function markerColor(name){
    let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xFFFFFFFF;
    return GEO_COLORS[Math.abs(h)%GEO_COLORS.length];
  }

  /* best 2-letter abbreviation for a place name */
  function abbr(name){
    const words=name.split(' ').filter(w=>w.length>1 && !/^of|and|the$/i.test(w));
    if(words.length>=2) return (words[0][0]+words[1][0]).toUpperCase();
    return name.slice(0,2).toUpperCase();
  }

  /* aggregate by city for the map bubbles */
  const bubbleByCity={};
  SHOPS.forEach(s=>{
    const c=bubbleByCity[s.city]||(bubbleByCity[s.city]={lat:0,lng:0,n:0,spend:0});
    c.lat+=s.lat; c.lng+=s.lng; c.n++; c.spend+=s.spend;
  });
  const bubbleCities=Object.values(bubbleByCity).map(c=>({lat:c.lat/c.n,lng:c.lng/c.n,spend:c.spend}));
  const maxSpend=Math.max(...bubbleCities.map(c=>c.spend));

  /* mini map — non-interactive preview */
  const map=L.map('gw-map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,
    doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,tap:false,zoomSnap:0.1}).setView([28,18],1.3);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:6}).addTo(map);
  bubbleCities.forEach(c=>{
    const t=Math.sqrt(c.spend/maxSpend);
    const size=Math.round(13+t*24);
    L.marker([c.lat,c.lng],{icon:L.divIcon({className:'',iconSize:[size,size],
      html:`<div class="gw-bubble" style="width:${size}px;height:${size}px;background:${volColor(t)}"></div>`})}).addTo(map);
  });
  setTimeout(()=>map.invalidateSize(),120);

  /* aggregate by country */
  const byCountry={};
  SHOPS.forEach(s=>{
    const c=byCountry[s.country]||(byCountry[s.country]={spend:0,stores:0,cities:new Set()});
    c.spend+=s.spend; c.stores++; c.cities.add(s.city);
  });
  const countryList=Object.entries(byCountry)
    .map(([name,d])=>({name,code:CC[name]||name.slice(0,2).toUpperCase(),spend:d.spend,stores:d.stores,cities:d.cities.size}))
    .sort((a,b)=>b.spend-a.spend);

  /* aggregate by city within a given country */
  function citiesIn(country){
    const byCt={};
    SHOPS.filter(s=>s.country===country).forEach(s=>{
      const c=byCt[s.city]||(byCt[s.city]={spend:0,stores:0});
      c.spend+=s.spend; c.stores++;
    });
    return Object.entries(byCt).map(([name,d])=>({name,spend:d.spend,stores:d.stores}))
      .sort((a,b)=>b.spend-a.spend);
  }

  /* headline total is always global */
  const total=SHOPS.reduce((a,s)=>a+s.spend,0);
  document.getElementById('gw-total').textContent=fmtAED(total);

  /* state: null = all countries, string = single country selected */
  let selectedCountry=null;

  const pillEl=document.querySelector('.gw-pill');
  const filterEl=document.getElementById('gw-country-filter');
  const topEl=document.getElementById('gw-top');
  const subEl=document.getElementById('gw-sub');

  function render(){
    if(!selectedCountry){
      /* — All Countries mode: show top countries — */
      if(pillEl) pillEl.textContent='Top countries by spend';
      subEl.textContent='total spend · '+fmtNum(SHOPS.length)+' stores · '+countryList.length+' countries';
      /* reset filter pill styling */
      if(filterEl){
        filterEl.style.borderColor='';
        filterEl.style.background='';
        filterEl.style.color='';
        filterEl.querySelector('svg:first-child') && (filterEl.childNodes[1] && (filterEl.childNodes[1].textContent='All Countries '));
        /* rebuild pill label */
        filterEl.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V4l1-1 14 0M4 9h13l-2 4 2 4H4"/></svg>All Countries <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
      }

      topEl.innerHTML=countryList.slice(0,3).map((c,i)=>
        `<div class="gw-row gw-drill-row" data-country="${c.name}" style="cursor:pointer" title="View cities in ${c.name}">
          <span class="gw-rk">${i+1}</span>
          <span class="gw-mk" style="background:${markerColor(c.name)}">${c.code}</span>
          <span class="gw-nm">${c.name}</span>
          <span class="gw-v">${fmtAED(c.spend)}</span>
        </div>`).join('');

      topEl.querySelectorAll('.gw-drill-row').forEach(row=>{
        row.addEventListener('click',e=>{
          e.preventDefault(); e.stopPropagation();
          selectedCountry=row.dataset.country;
          render();
        });
        row.addEventListener('mouseenter',()=>row.style.opacity='0.75');
        row.addEventListener('mouseleave',()=>row.style.opacity='');
      });

    } else {
      /* — Single country mode: show top cities — */
      if(pillEl) pillEl.textContent='Top cities by spend';
      const cts=citiesIn(selectedCountry);
      const countryStores=SHOPS.filter(s=>s.country===selectedCountry).length;
      subEl.textContent=fmtNum(countryStores)+' stores · '+cts.length+' cit'+(cts.length===1?'y':'ies')+' · '+selectedCountry;

      if(filterEl){
        filterEl.innerHTML=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V4l1-1 14 0M4 9h13l-2 4 2 4H4"/></svg>${selectedCountry} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
        filterEl.style.borderColor='var(--green)';
        filterEl.style.background='var(--green-50)';
        filterEl.style.color='var(--green-ink)';
      }

      topEl.innerHTML=cts.slice(0,3).map((c,i)=>
        `<div class="gw-row">
          <span class="gw-rk">${i+1}</span>
          <span class="gw-mk" style="background:${markerColor(c.name)}">${abbr(c.name)}</span>
          <span class="gw-nm">${c.name}</span>
          <span class="gw-v">${fmtAED(c.spend)}</span>
        </div>`).join('');
    }
  }

  /* country filter pill click: reset to all countries */
  if(filterEl){
    filterEl.addEventListener('click',e=>{
      if(selectedCountry){
        e.preventDefault(); e.stopPropagation();
        selectedCountry=null;
        render();
      }
    });
  }

  /* KPI tiles */
  const txns=SHOPS.reduce((a,s)=>a+s.txns,0);
  const cust=SHOPS.reduce((a,s)=>a+s.customers,0);
  document.getElementById('kpi-spend').textContent=fmtAED(total);
  document.getElementById('kpi-txns').textContent=fmtNum(txns);
  document.getElementById('kpi-cust').textContent=fmtNum(cust);

  render();
})();
