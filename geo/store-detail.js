/* ============================================================
   Lune — Shared Store Intelligence detail template
   Consumed by both Geolocation Analytics (app.js) and
   Brand/Category explorer (explore.js).
   ============================================================ */
(function(){
  const {fmtAED, fmtNum} = window.GEO;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun'];

  /* Deterministic float [0,1] from two integers — avoids Date/Math.random */
  function det(a, b){
    let s = ((a * 2654435761) ^ (b * 1664525)) >>> 0;
    s ^= s >>> 16; s = (Math.imul(s, 0x45d9f3b) | 0) >>> 0; s ^= s >>> 16;
    return s / 4294967296;
  }

  function momBadge(arr, i){
    if(i === 0) return '<span class="mom-empty">—</span>';
    const base = Math.abs(arr[i-1]);
    const pct = base < 0.001 ? 0 : (arr[i] - arr[i-1]) / base * 100;
    const up = pct >= 0;
    return `<span class="mom ${up?'up':'dn'}">${up?'▲':'▼'}${Math.abs(pct).toFixed(1)}%</span>`;
  }

  /*
   * renderContent(s, ctx) → HTML string (store-detail-head + store-kpis + store-detail-grid)
   *
   * ctx = {
   *   rank           — rank of this store within the current view
   *   total          — total stores in current view
   *   contrib        — % contribution to view spend (number, not string)
   *   displaySpend   — period-adjusted spend for KPI strip
   *   displayTxns    — period-adjusted txns for KPI strip
   *   displayCustomers — period-adjusted customers for KPI strip
   * }
   * s.spend / s.txns (raw 6-month values) are used for the monthly table.
   */
  function renderContent(s, ctx){
    const {rank, total, contrib, displaySpend, displayTxns, displayCustomers} = ctx;
    const ages = window.GEO.AGE_BANDS || ['18-24','25-34','35-44','45-54','55+'];
    const deltaColor = s.delta >= 0 ? '#0E8E6D' : '#C4453D';

    /* Monthly breakdown — always uses raw 6-month totals so table is coherent */
    const trendSum = s.trend.reduce((a,b) => a+b, 0) || 1;
    const mSpend = s.trend.map(t => s.spend * t / trendSum);
    const mTxns  = s.trend.map(t => Math.round(s.txns * t / trendSum));
    const mAvg   = mSpend.map((sp,i) => mTxns[i] > 0 ? sp / mTxns[i] : s.avgTicket);

    /* Deterministic insight values */
    const r1 = det(s.id, 1);
    const repeatPct  = Math.round(52 + r1 * 30);       // 52–82 %
    const retention  = Math.round(60 + r1 * 25);       // 60–85 %

    const r2 = det(s.id, 5);
    const oppScore   = Math.round(45 + r2 * 50);       // 45–95 / 100
    const penetration = Math.round(12 + r2 * 28);      // 12–40 %

    const percentile = Math.max(1, Math.round((1 - (rank-1) / Math.max(total,1)) * 100));
    const tier = percentile >= 90 ? 'Top 10%' : percentile >= 75 ? 'Top 25%' : percentile >= 50 ? 'Top 50%' : 'Bottom 50%';

    const spendPerCust = fmtAED(s.spend / Math.max(1, s.customers));
    const txnsPerCust  = (s.txns  / Math.max(1, s.customers)).toFixed(1);

    return `
    <div class="store-detail-head">
      <div><h3>${s.brand} — ${s.area}</h3><p>${s.code} · ${s.addr} · ${s.city}</p></div>
      <span class="store-status">Store active</span>
    </div>
    <div class="store-kpis">
      <div class="store-kpi"><span>Total spend</span><b>${fmtAED(displaySpend)}</b></div>
      <div class="store-kpi"><span>Transactions</span><b>${fmtNum(displayTxns)}</b></div>
      <div class="store-kpi"><span>Customers</span><b>${fmtNum(displayCustomers)}</b></div>
      <div class="store-kpi"><span>Average ticket</span><b>${fmtAED(s.avgTicket)}</b></div>
      <div class="store-kpi"><span>City contribution</span><b>${contrib.toFixed(1)}%</b></div>
    </div>
    <div class="store-detail-grid">
      <section class="store-section">
        <h4>Performance &amp; market position</h4>
        <div class="channel-row"><span>Rank in view</span><b>#${rank} of ${total}</b></div>
        <div class="channel-row"><span>6-month change</span><b style="color:${deltaColor}">${s.delta>=0?'+':''}${s.delta.toFixed(1)}%</b></div>
        <div class="channel-row"><span>Primary segment</span><b>${s.segment}</b></div>
        <div class="channel-row"><span>Contribution</span><b>${contrib.toFixed(1)}%</b></div>
      </section>
      <section class="store-section">
        <h4>Customer demographics</h4>
        <div class="demo-split"><span style="width:${s.male}%"></span><span style="width:${s.female}%"></span></div>
        <div class="demo-legend"><span>Male ${s.male}%</span><span>Female ${s.female}%</span></div>
        <div class="age-demo-block">
          ${ages.map((a,i)=>`<div class="age-row2"><span>${a}</span><div class="age-track2"><div class="age-fill2" style="width:${s.age[i]}%"></div></div><b>${s.age[i]}%</b></div>`).join('')}
        </div>
      </section>
      <section class="store-section wide">
        <h4>Monthly performance</h4>
        <div class="monthly-table">
          <div class="mt-head"><span>Month</span><span>Transactions</span><span>Spend</span><span>Avg Ticket</span><span>MoM</span></div>
          ${MONTHS.map((m,i)=>`<div class="mt-row${i===MONTHS.length-1?' last':''}">
            <span class="mt-month">${m}</span>
            <span>${fmtNum(mTxns[i])}</span>
            <span>${fmtAED(mSpend[i])}</span>
            <span>${fmtAED(mAvg[i])}</span>
            <span>${momBadge(mSpend,i)}</span>
          </div>`).join('')}
        </div>
      </section>
      <section class="store-section">
        <h4>Customer quality</h4>
        <div class="channel-row"><span>Repeat customers</span><b>${repeatPct}%</b></div>
        <div class="channel-row"><span>New customers</span><b>${100-repeatPct}%</b></div>
        <div class="channel-row"><span>Retention rate</span><b>${retention}%</b></div>
      </section>
      <section class="store-section">
        <h4>Store performance</h4>
        <div class="channel-row"><span>Spend per customer</span><b>${spendPerCust}</b></div>
        <div class="channel-row"><span>Txns per customer</span><b>${txnsPerCust}×</b></div>
        <div class="channel-row"><span>Contribution</span><b>${contrib.toFixed(1)}%</b></div>
      </section>
      <section class="store-section">
        <h4>Benchmarking</h4>
        <div class="channel-row"><span>Rank in view</span><b>#${rank} of ${total}</b></div>
        <div class="channel-row"><span>Performance tier</span><b>${tier}</b></div>
        <div class="channel-row"><span>Percentile</span><b>${percentile}th</b></div>
      </section>
      <section class="store-section">
        <h4>Growth indicators</h4>
        <div class="channel-row"><span>Growth rate</span><b style="color:${deltaColor}">${s.delta>=0?'+':''}${s.delta.toFixed(1)}%</b></div>
        <div class="channel-row"><span>Opportunity score</span><b>${oppScore}/100</b></div>
        <div class="channel-row"><span>Market penetration</span><b>${penetration}%</b></div>
      </section>
    </div>`;
  }

  window.StoreDetail = {renderContent};
})();
