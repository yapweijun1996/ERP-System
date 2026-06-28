/* ============================================================
   ARIA ERP — screens: Reporting / BI
   (Management Dashboard, Sales Analysis, Stock Aging)
   ============================================================ */

/* --- chart helpers --- */
function biStat(label,value,delta,sub){
  const up=delta>=0;
  return `<div class="card" style="padding:13px 15px"><small style="display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${label}</small>
    <div style="display:flex;align-items:baseline;gap:8px"><b class="tnum" style="font-size:23px;font-weight:600;letter-spacing:-.02em">${value}</b>
    <span class="tnum" style="font-size:12.5px;font-weight:600;color:${up?'var(--ok)':'var(--danger)'}">${up?'▲':'▼'} ${Math.abs(delta)}%</span></div>
    <small style="display:block;color:var(--muted);font-size:12px;margin-top:3px">${sub}</small></div>`;
}
function sparkArea(data, months){
  const W=640,H=150,P=6;
  const min=Math.min(...data)*0.92, max=Math.max(...data)*1.04;
  const x=i=>P+i*((W-2*P)/(data.length-1));
  const y=v=>H-P-((v-min)/(max-min))*(H-2*P);
  const line=data.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area=`M${x(0)} ${H-P} `+data.map((v,i)=>`L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')+` L${x(data.length-1)} ${H-P} Z`;
  const last=data.length-1;
  const labels=months.map((m,i)=> i%2===0?`<text x="${x(i).toFixed(1)}" y="${H+4}" font-size="11" fill="var(--muted)" text-anchor="middle">${m}</text>`:'').join('');
  return `<svg class="spark" viewBox="0 -4 ${W} ${H+22}" preserveAspectRatio="none" role="img" aria-label="Revenue trend">
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.18"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#sg)"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(last).toFixed(1)}" cy="${y(data[last]).toFixed(1)}" r="4" fill="var(--accent)"/>
    ${labels}
  </svg>`;
}
function barList(rows){
  const max=Math.max(...rows.map(r=>r.value));
  return `<div class="barchart">`+rows.map(r=>`<div class="barrow"${r.route?` data-route="${r.route}" style="cursor:pointer"`:''}>
    <span class="bl">${esc(r.label)}</span>
    <span class="bartrack"><i style="width:${Math.round(r.value/max*100)}%;background:${r.clr||'var(--accent)'}"></i></span>
    <span class="bv">${r.text}</span></div>`).join('')+`</div>`;
}

/* ---------------- MANAGEMENT DASHBOARD (module landing) ---------------- */
SCREENS['bi-dashboard'] = function(root){
  const k=DB.biKpis;
  const segMax=DB.revBySegment;
  root.innerHTML=`<div class="content full"><section class="master">
    <div class="pagehead">${crumbs([DB.company.name,t('nav.bi'),t('bi.crumb')])}
      <div class="h1row"><h1>${esc(t('bi.title'))}</h1><span class="countchip">${DB.company.period}</span></div>
    </div>
    <div class="statwrap"><div class="statcards">
      ${biStat(t('bi.s.revenue'),money0(k.revenueYtd),k.revenueDelta,t('bi.s.revenuesub'))}
      ${biStat(t('bi.s.margin'),k.marginPct+'%',k.marginDelta,t('bi.s.marginsub').replaceAll('{d}','+'+k.marginDelta))}
      ${biStat(t('bi.s.orders'),money0(k.openOrders),k.ordersDelta,t('bi.s.orderssub'))}
      ${biStat(t('dash.kpi.cash'),money0(k.cash),k.cashDelta,t('bi.s.cashsub'))}
    </div></div>
    <div style="padding:0 24px 28px">
      <div class="panel" style="margin-bottom:14px">
        <div class="panel-h"><h3>${esc(t('bi.p.revtrend'))}</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${esc(t('bi.thousands'))}</span></div>
        <div class="panel-body" style="padding:16px 18px 10px">${sparkArea(DB.revTrend,DB.revMonths)}</div>
      </div>
      <div class="kgrid">
        <div class="panel">
          <div class="panel-h"><h3>${esc(t('bi.p.revseg'))}</h3><span class="more" style="margin-left:auto;font-size:12px;color:var(--accent);cursor:pointer" data-route="sales-analysis">${esc(t('bi.analyse'))}</span></div>
          <div class="panel-body" style="padding:14px 18px">${barList(segMax.map(s=>({label:s.name,value:s.value,clr:s.clr,text:money0(s.value)})))}
            <div class="legend">${segMax.map(s=>`<span><i style="background:${s.clr}"></i>${esc(s.name.split(' ')[0])}</span>`).join('')}</div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>${esc(t('bi.p.topcust'))}</h3><span class="more" style="margin-left:auto;font-size:12px;color:var(--accent);cursor:pointer" data-route="ar-aging">${esc(t('bi.receivables'))}</span></div>
          <div class="panel-body" style="padding:14px 18px">${barList(DB.topCustomers.map(c=>({label:c.name,value:c.value,text:money0(c.value)})))}</div>
        </div>
      </div>
    </div>
  </section></div>`;
  root.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.route)));
};

/* ---------------- SALES ANALYSIS (report) ---------------- */
SCREENS['sales-analysis'] = function(root){
  const cats=DB.salesAnalysis.byCategory;
  const totRev=cats.reduce((s,c)=>s+c.revenue,0);
  const totUnits=cats.reduce((s,c)=>s+c.units,0);
  const wMargin=cats.reduce((s,c)=>s+c.revenue*c.margin,0)/totRev;
  const rowHtml=cats.slice().sort((a,b)=>b.revenue-a.revenue).map((c,i)=>`<tr>
    <td class="lineno">${i+1}</td>
    <td class="l li-name"><b>${esc(c.name)}</b></td>
    <td class="tnum">${money0(c.revenue)}</td>
    <td class="tnum">${num(c.units)}</td>
    <td class="tnum">${c.margin.toFixed(1)}%</td>
    <td class="l"><span class="bartrack" style="width:120px;display:inline-block;vertical-align:middle"><i style="width:${Math.round(c.revenue/cats[0].revenue*100)}%;background:${c.margin>35?'var(--ok)':'var(--warn)'}"></i></span></td></tr>`).join('');
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>Dimension</span><select><option>Product category</option><option>Region</option><option>Sales rep</option><option>Customer</option></select></div>
      <div class="fld"><span>Measure</span><select><option>Revenue</option><option>Gross margin</option><option>Units</option></select></div>
      <div class="fld"><span>Period</span><select><option>FY2026 YTD</option><option>Q2 FY2026</option><option>P06 · June</option></select></div>
      <div class="fld"><span>Compare</span><select><option>None</option><option>Prior year</option><option>Budget</option></select></div>
      ${btn('Run analysis',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Analysis refreshed\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">${btn('Open dashboard',{icon:'chart',cls:'soft',attrs:'onclick="navigate(\'bi-dashboard\')"'})}</div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Sales Analysis — by product category</b><div class="report-meta">FY2026 YTD · ${money0(totRev)} revenue · ${num(totUnits)} units · ${wMargin.toFixed(1)}% blended margin</div></div>
        <div class="grow"></div>
        ${btn('Excel',{icon:'filexls',cls:'soft'})}${btn('Print',{icon:'print',cls:'soft'})}
      </div>
      <div style="padding:16px 22px;overflow:auto">
        <div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Revenue by category</h3></div>
          <div class="panel-body" style="padding:14px 18px">${barList(cats.slice().sort((a,b)=>b.revenue-a.revenue).map(c=>({label:c.name,value:c.revenue,clr:c.margin>35?'var(--accent)':'var(--warn)',text:money0(c.revenue)})))}
            <div class="legend"><span><i style="background:var(--accent)"></i>margin &gt; 35%</span><span><i style="background:var(--warn)"></i>margin ≤ 35%</span></div>
          </div>
        </div>
        <div class="panel"><div class="panel-h"><h3>Detail</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)">${cats.length} categories</span></div>
          <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Category</th><th>Revenue</th><th>Units</th><th>Margin %</th><th class="l">Share</th></tr></thead>
            <tbody>${rowHtml}</tbody>
            <tfoot><tr><td></td><td class="l" style="font-weight:600">Total</td><td class="tnum"><b>${money0(totRev)}</b></td><td class="tnum">${num(totUnits)}</td><td class="tnum">${wMargin.toFixed(1)}%</td><td></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  </div></section></div>`;
};

/* ---------------- STOCK AGING (report) ---------------- */
SCREENS['stock-aging'] = function(root){
  const grandVal=DB.stockAging.reduce((s,g)=>s+g.items.reduce((a,it)=>a+it.value,0),0);
  const slow=DB.stockAging.find(g=>g.tone==='danger');
  const slowVal=slow.items.reduce((a,it)=>a+it.value,0);
  const tpl='minmax(220px,2.4fr) minmax(120px,1.2fr) 120px 140px';
  let body='';
  DB.stockAging.forEach(g=>{
    const gv=g.items.reduce((a,it)=>a+it.value,0);
    body+=`<div class="dt-r" style="background:var(--surface-3);font-weight:700"><div class="dt-c l">${cap(g.grp,g.tone)}</div><div class="dt-c l" style="color:var(--muted)">${g.items.length} items</div><div class="dt-c r" style="color:var(--muted)">${num(g.items.reduce((a,it)=>a+it.qty,0))} units</div><div class="dt-c r tnum">${money0(gv)}</div></div>`;
    g.items.forEach(it=>{
      body+=`<div class="dt-r drill" data-sku="${esc(it.sku)}"><div class="dt-c l"><div class="cellsub"><b>${esc(it.name)}</b><small>${esc(it.sku)}</small></div></div><div class="dt-c l">${g.tone==='danger'?cap('Slow mover','danger'):'<span style="color:var(--muted)">—</span>'}</div><div class="dt-c r tnum">${num(it.qty)}</div><div class="dt-c r tnum"><b>${money0(it.value)}</b></div></div>`;
    });
  });
  body+=`<div class="dt-r grandtotal"><div class="dt-c l">Total inventory at cost</div><div class="dt-c l"></div><div class="dt-c r"></div><div class="dt-c r tnum"><b>${money0(grandVal)}</b></div></div>`;
  root.innerHTML=`<div class="content full"><section class="master"><div class="report">
    <aside class="report-params">
      <h3>Parameters</h3>
      <div class="fld"><span>As at date</span><select><option>Jun 20, 2026</option><option>Period end</option></select></div>
      <div class="fld"><span>Aging buckets</span><select><option>30 / 60 / 90 days</option><option>Monthly</option></select></div>
      <div class="fld"><span>Warehouse</span><select><option>All warehouses</option><option>KL-Main</option></select></div>
      <div class="fld"><span>Category</span><select><option>All categories</option><option>Components</option><option>Raw Materials</option></select></div>
      ${btn('Run report',{icon:'play',cls:'primary',sm:false,attrs:'onclick="toast(\'Stock aging recalculated\',\'ok\')"'})}
      <div style="border-top:1px solid var(--hairline);padding-top:12px;margin-top:4px">
        <div class="indicator ${slowVal/grandVal>0.15?'danger':'warn'}"><div class="ind-top">${ic('warn')}<span>Slow movers</span><span class="ind-r">${Math.round(slowVal/grandVal*100)}%</span></div><div class="track"><i style="width:${Math.round(slowVal/grandVal*100)}%"></i></div><small>${money0(slowVal)} held over 90 days — review for write-down.</small></div>
      </div>
    </aside>
    <div class="report-result">
      <div class="report-toolbar">
        <div><b style="font-size:15px">Stock Aging</b><div class="report-meta">As at Jun 20, 2026 · ${money0(grandVal)} at cost · ${money0(slowVal)} slow-moving</div></div>
        <div class="grow"></div>
        ${btn('Valuation',{icon:'chart',cls:'soft',attrs:'onclick="navigate(\'inv-valuation\')"'})}${btn('Excel',{icon:'filexls',cls:'soft'})}
      </div>
      <div class="tablewrap"><div class="dt-page"><div class="dt" role="table" style="--tpl:${tpl}">
        <div class="dt-r dt-head"><div class="dt-c l">Item</div><div class="dt-c l">Flag</div><div class="dt-c r">Qty on hand</div><div class="dt-c r">Value at cost</div></div>
        <div class="dt-body">${body}</div>
      </div></div></div>
    </div>
  </div></section></div>`;
  root.querySelectorAll('.dt-r.drill').forEach(tr=>tr.addEventListener('click',()=>toast('Drill: '+tr.dataset.sku+' → stock movements','info')));
};
