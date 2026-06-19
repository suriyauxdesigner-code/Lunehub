/* ============================================================
   Lune — shared sidebar injector
   active item from <body data-nav="..."> (falls back to data-page)
   ============================================================ */
(function(){
  const map={brands:'Brands',brand:'Brands',categories:'Categories',category:'Categories',dashboard:'Dashboard',geo:'Geography'};
  const active=document.body.dataset.nav||map[document.body.dataset.page]||'';
  const item=(label,href,icon,sub)=>{
    const on=label===active;
    const cls=(sub?'nav-item nav-sub':'nav-item')+(on?(sub?' active':' active'):'');
    const ic=icon?icon:'';
    return `<a class="${cls}" ${href?`href="${href}"`:''}>${ic}${label}${label==='Documentation'?'<span class="ext"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8"/></svg></span>':''}</a>`;
  };
  const I={
    over:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    enrich:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 17l8 4 8-4"/></svg>',
    ana:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    bill:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    doc:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v6h6"/></svg>',
    set:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z"/></svg>',
    sup:'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12a8 8 0 0 1 16 0v5a2 2 0 0 1-2 2h-1v-6h3M4 12v5a2 2 0 0 0 2 2h1v-6H4"/></svg>'
  };
  const html=`
    <div class="brand">
      <div class="brand-mark"></div><div class="brand-name">Lune</div>
      <span class="collapse"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg></span>
    </div>
    <nav class="nav">
      ${item('Overview','',I.over)}
      <a class="nav-item nav-section">${I.enrich}Enrichment</a>
      ${item('Transactions','',null,true)}
      ${item('API keys','',null,true)}
      <a class="nav-item nav-section">${I.ana}Analytics</a>
      ${item('Dashboard','index.html',null,true)}
      ${item('Geography','Geolocation Analytics.html',null,true)}
      ${item('Brands','Brand Explorer.html',null,true)}
      ${item('Categories','Categories Explorer.html',null,true)}
      <a class="nav-item nav-section">${I.bill}Billing</a>
      ${item('Documentation','',I.doc)}
      ${item('Settings','',I.set)}
      ${item('Contact us','',I.sup)}
    </nav>
    <div class="side-foot">
      <div class="user"><div class="avatar">AS</div>
        <div><div class="nm">Alexandre Soued</div><div class="pl">Basic plan</div></div></div>
    </div>`;
  const aside=document.querySelector('aside.sidebar')||(()=>{
    const a=document.createElement('aside');a.className='sidebar';
    const app=document.querySelector('.app');app.insertBefore(a,app.firstChild);return a;})();
  aside.innerHTML=html;
})();
