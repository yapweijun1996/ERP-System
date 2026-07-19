/* ============================================================
   ARIA ERP — New Stock Adjustment composer (create flow)
   Single-screen cycle-count / adjustment editor: header +
   item lines comparing system qty to counted qty, with live
   variance and inventory value impact. Posts to the stock
   ledger. Reached from Quick create, the command palette and
   the Stock Movement / Stock on Hand screens.
   ============================================================ */
SCREENS['new-stock-adjustment'] = async function(root){
  const TODAY=new Date().toISOString().slice(0,10);
  const adapter=window.ErpSystemData;
  if(!adapter) throw new Error('ERP data adapter is unavailable.');
  const [warehousePage,productPage,stockPage]=await Promise.all([
    adapter.list('inventory/warehouses',{limit:100}),
    adapter.list('inventory/products',{limit:100}),
    adapter.list('inventory/stock-levels',{limit:100}),
  ]);
  const WH=warehousePage.data||[];
  const ITEMS=(productPage.data||[]).map(item=>({
    id:Number(item.id),sku:item.sku,name:item.name,uom:item.uom,
    cost:Number(item.standardCost||0),
  }));
  const STOCK=stockPage.data||[];
  if(!WH.length) throw new Error('No warehouse is configured for the active company.');
  const REASONS=['Cycle count','Physical count','Damage / breakage','Write-off','Found stock','Revaluation'];

  const S={ date:TODAY, warehouseId:WH[0]&&WH[0].id, reason:'Cycle count', reference:'',
    lines:[] /* {sku,name,uom,sys,counted,cost} */ };
  const warehouseName=()=>{ const w=WH.find(x=>x.id===Number(S.warehouseId)); return w?`${w.code} · ${w.name}`:'—'; };
  const systemQty=(productId,warehouseId)=>{
    const row=STOCK.find(x=>
      Number(x.productId)===Number(productId)&&Number(x.warehouseId)===Number(warehouseId));
    return row?Number(row.qty):0;
  };

  // signed currency — money()/money0() strip the sign via Math.abs
  const sd=n=>(n<0?'−':n>0?'+':'')+money(Math.abs(n));
  const sd0=n=>(n<0?'−':n>0?'+':'')+money0(Math.abs(n));

  function totals(){
    let upQty=0,downQty=0,value=0,lines=0;
    S.lines.forEach(l=>{ const v=l.counted-l.sys; if(v>0)upQty+=v; else downQty+=-v; value+=v*l.cost; if(v!==0)lines++; });
    return {upQty,downQty,value,lines,net:upQty-downQty};
  }

  /* ---------------- lines ---------------- */
  function lineRows(){
    if(!S.lines.length) return `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:26px">No items yet — add an item above to begin counting.</td></tr>`;
    return S.lines.map((l,i)=>{
      const v=l.counted-l.sys, val=v*l.cost;
      const vcol=v>0?'var(--ok)':v<0?'var(--danger)':'var(--muted)';
      return `<tr data-i="${i}">
        <td class="lineno">${i+1}</td>
        <td class="l li-name"><b>${esc(l.name)}</b><small>${esc(l.sku)} · ${esc(l.uom)} @ ${money(l.cost)}</small></td>
        <td class="tnum">${num(l.sys)}</td>
        <td><input class="lineinput wCount" type="number" min="0" value="${l.counted}" style="width:88px;text-align:right"></td>
        <td class="tnum" style="color:${vcol};font-weight:600">${v>0?'+':''}${num(v)}</td>
        <td class="tnum" style="color:${vcol}">${v===0?money(0):sd(val)}</td>
        <td style="text-align:center"><button class="iconbtn wDel" data-tip="Remove" style="width:28px;height:28px">${ic('trash')}</button></td></tr>`;
    }).join('');
  }
  function totalsCard(){
    const t=totals();
    const tone=t.value>0?'ok':t.value<0?'danger':'neutral';
    const label=t.value>0?'Inventory increase':t.value<0?'Inventory decrease':'No net change';
    return `<div class="sectitle" style="margin-top:0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Adjustment impact</div>
      <div class="sumrow"><span class="sk2">Lines changed</span><span class="sv tnum">${t.lines}</span></div>
      <div class="sumrow"><span class="sk2">Units up</span><span class="sv tnum" style="color:var(--ok)">+${num(t.upQty)}</span></div>
      <div class="sumrow"><span class="sk2">Units down</span><span class="sv tnum" style="color:var(--danger)">−${num(t.downQty)}</span></div>
      <div class="sumrow total"><span class="sk2">Net value impact</span><span class="sv tnum" style="color:${t.value>0?'var(--ok)':t.value<0?'var(--danger)':'inherit'}">${t.value===0?money(0):sd(t.value)}</span></div>
      <div style="margin-top:10px">${indicator({tone,icon: t.value<0?'warn':'checkc',label,value:money0(Math.abs(t.value)),sub: t.value===0?'Counted matches system — nothing to post.':`${t.value<0?'Debits':'Credits'} inventory variance (5800), ${t.value<0?'credits':'debits'} inventory (1400).`})}</div>`;
  }
  function refreshLines(){ $('#wLines').innerHTML=lineRows(); $('#wImpact').innerHTML=totalsCard(); bindLines(); updateBar(); }
  function bindLines(){
    $$('#wLines tr[data-i]').forEach(tr=>{
      const i=+tr.dataset.i, l=S.lines[i];
      const c=tr.querySelector('.wCount');
      c.addEventListener('input',()=>{ l.counted=Math.max(0,+c.value||0);
        const v=l.counted-l.sys, val=v*l.cost, vcol=v>0?'var(--ok)':v<0?'var(--danger)':'var(--muted)';
        const cells=tr.querySelectorAll('td');
        cells[4].style.color=vcol; cells[4].textContent=(v>0?'+':'')+num(v);
        cells[5].style.color=vcol; cells[5].textContent=(v===0?money(0):sd(val));
        $('#wImpact').innerHTML=totalsCard(); updateBar(); });
      tr.querySelector('.wDel').addEventListener('click',()=>{ S.lines.splice(i,1); refreshLines(); });
    });
  }

  /* ---------------- bar ---------------- */
  function bar(){
    const t=totals();
    const ok=t.lines>0;
    const hint=ok?`${t.lines} line(s) changed · ${t.value===0?money0(0):sd0(t.value)} impact`:'Count at least one item to post an adjustment';
    return `<div style="font-size:12.5px;color:var(--muted)" class="hideonsmall">${hint}</div>
      <div class="grow"></div>
      ${btn('Cancel',{cls:'soft',attrs:'id="wCancel"'})}
      ${btn('Post adjustment',{icon:'check',cls:'primary',sm:false,attrs:`id="wPost" ${ok?'':'disabled style=\"opacity:.5;pointer-events:none\"'}`})}`;
  }
  function updateBar(){ const b=$('#wBar'); if(b){ b.innerHTML=bar(); wireBar(); } }

  /* ---------------- render ---------------- */
  function render(){
    root.innerHTML=`<div class="content full"><section class="master" data-screen-label="New Stock Adjustment">
      <div class="docwrap"><div class="docpage">
        ${crumbs([DB.company.name,'Inventory','Stock Adjustment',{cur:'New'}])}
        <div class="dochead">
          <div class="dh-row1">
            <div><div class="dt">${ic('adjust')}New Stock Adjustment</div>
              <div style="color:var(--muted);font-size:13px;margin-top:4px">Draft · inventory count &amp; correction · ${esc(DB.company.name)}</div></div>
            <div class="dactions">${cap('Draft','neutral')}</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h">${ic('receipt')}<h3>Adjustment details</h3></div>
          <div class="panel-body">
            <div class="fldrow c3">
              <div class="fld"><span>Warehouse</span><select id="wWh">${WH.map(w=>`<option value="${w.id}" ${w.id===S.warehouseId?'selected':''}>${esc(w.code)} · ${esc(w.name)}</option>`).join('')}</select></div>
              <div class="fld"><span>Adjustment date</span><input type="date" id="wDate" value="${S.date}"></div>
              <div class="fld"><span>Reason</span><select id="wReason">${REASONS.map(r=>`<option ${r===S.reason?'selected':''}>${r}</option>`).join('')}</select></div>
            </div>
            <div class="fld" style="margin-top:12px"><span>Reference / note</span><input id="wRef" value="${esc(S.reference)}" placeholder="e.g. Q2 cycle count — aisle A"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-h">${ic('box')}<h3>Add item</h3></div>
          <div class="panel-body">
            <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
              <div class="fld" style="flex:1;min-width:260px"><span>Item</span>
                <select id="wPick">${ITEMS.map(it=>`<option value="${it.sku}">${esc(it.sku)} · ${esc(it.name)} — here ${num(systemQty(it.id,S.warehouseId))} ${esc(it.uom)}</option>`).join('')}</select></div>
              ${btn('Add to count',{icon:'plus',cls:'primary',attrs:'id="wAdd"'})}
            </div>
          </div>
        </div>

        <div class="doclayout"><div class="docmain">
          <div class="panel">
            <div class="panel-h">${ic('list')}<h3>Count sheet</h3><span style="margin-left:auto;font-size:12px;color:var(--muted)" id="wCount2">${S.lines.length} item${S.lines.length===1?'':'s'}</span></div>
            <table class="lines"><thead><tr><th class="lineno">#</th><th class="l">Item</th><th>System</th><th>Counted</th><th>Variance</th><th>Value</th><th></th></tr></thead>
              <tbody id="wLines">${lineRows()}</tbody></table>
          </div>
        </div>
        <aside class="summary" id="wImpact">${totalsCard()}</aside></div>
        <div style="height:8px"></div>
      </div></div>
      <div class="set-savebar" id="wBar">${bar()}</div>
    </section></div>`;
    bindHeader(); bindLines(); wireBar();
  }
  function bindHeader(){
    const b=(id,key,ev='change')=>{ const el=$('#'+id); el&&el.addEventListener(ev,()=>S[key]=el.value); };
    const wh=$('#wWh'); wh&&wh.addEventListener('change',()=>{
      S.warehouseId=Number(wh.value);
      S.lines.forEach(line=>{
        line.sys=systemQty(line.productId,S.warehouseId);
        line.counted=line.sys;
      });
      refreshLines();
    });
    b('wDate','date'); b('wReason','reason'); b('wRef','reference','input');
    $('#wAdd').addEventListener('click',()=>{
      const sku=$('#wPick').value, it=ITEMS.find(x=>x.sku===sku); if(!it) return;
      if(S.lines.find(l=>l.sku===sku)){ toast('Item already on the count sheet','info'); return; }
      const here=systemQty(it.id,S.warehouseId);
      S.lines.push({productId:it.id,sku:it.sku,name:it.name,uom:it.uom,sys:here,counted:here,cost:it.cost});
      $('#wCount2').textContent=`${S.lines.length} item${S.lines.length===1?'':'s'}`;
      refreshLines();
    });
  }
  function wireBar(){
    const cancel=$('#wCancel'); cancel&&cancel.addEventListener('click',()=>navigate('stock-movement'));
    const post=$('#wPost'); post&&post.addEventListener('click',()=>{
      const t=totals();
      appModal({
        icon: 'adjust',
        title: 'Post stock adjustment?',
        body: `<p style="color:var(--muted);font-size:13.5px;margin:0 0 12px">Adjust <b>${t.lines}</b> item${t.lines===1?'':'s'} in <b>${esc(warehouseName())}</b>. Stock balances update immediately and a variance posting hits the GL.</p>
          <div class="sumrow"><span class="sk2">Units up / down</span><span class="sv tnum"><span style="color:var(--ok)">+${num(t.upQty)}</span> / <span style="color:var(--danger)">−${num(t.downQty)}</span></span></div>
          <div class="sumrow total"><span class="sk2">Net value impact</span><span class="sv tnum" style="color:${t.value>0?'var(--ok)':t.value<0?'var(--danger)':'inherit'}">${t.value===0?money(0):sd(t.value)}</span></div>`,
        actions: `${btn('Cancel',{cls:'soft',attrs:'onclick="closeModal()"'})}${btn('Confirm & post',{icon:'check',cls:'primary',attrs:'onclick="closeModal();window.__saPost&&window.__saPost()"'})}`,
      });
      window.__saPost=async()=>{
        const docNo='SA-'+Date.now().toString(36).toUpperCase();
        try{
          const created=await window.ErpSystemData.create('inventory/adjustments',{
            docNo,
            warehouseId:Number(S.warehouseId),
            adjustmentDate:S.date,
            reason:S.reason,
            reference:S.reference||null,
            lines:S.lines.filter(line=>line.counted!==line.sys)
              .map(line=>({productId:line.productId,countedQty:String(line.counted)})),
          });
          await window.ErpSystemData.action(
            'inventory/adjustments',
            created.data.id,
            'post',
            {},
            'stock-adjustment-'+created.data.id,
          );
          navigate('stock-movement');
          setTimeout(()=>toast(`Stock adjustment ${docNo} posted · ${t.lines} item${t.lines===1?'':'s'} · ${t.value===0?money0(0):sd0(t.value)}`,'ok'),180);
        }catch(error){
          toast(error&&error.message?error.message:'Stock adjustment could not be posted','danger');
        }
      };
    });
  }
  render();
};
